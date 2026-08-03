import { EquirectangularSource } from "../loader/EquirectangularSource.js";
import { LoadError, Loader } from "../loader/Loader.js";
import type { ImageInput, ImageSourceAdapter, SourceResult } from "../loader/types.js";
import { DisposableRegistry } from "./DisposableRegistry.js";
import { ErrorManager } from "./ErrorManager.js";
import { EventBus } from "./EventBus.js";
import { Renderer } from "./Renderer.js";
import { StandardMode } from "./StandardMode.js";
import { createViewerState } from "./ViewerState.js";
import type {
  ViewerEventMap,
  ViewerEventType,
  ViewerHandle,
  ViewerModeId,
  ViewerOptions,
} from "./types.js";

const WEBGL_UNSUPPORTED_MESSAGE =
  "This browser or environment does not support the WebGL2 rendering required by perisphere.";
const CONTEXT_LOST_MESSAGE = "The WebGL rendering context was lost and could not be recovered.";
const INVALID_MODE_MESSAGE = "The requested viewer mode is not available.";
const DISPOSED_WARNING = "[perisphere] ViewerHandle method called after dispose(); ignoring.";
const LOAD_IMAGE_UNSUPPORTED_MESSAGE =
  "loadImage() is not available because WebGL2 rendering is not supported in this environment.";
const LOAD_IMAGE_UNKNOWN_ERROR_MESSAGE = "Failed to load the image.";

function isBrowserEnvironment(): boolean {
  // BR-A-01: SSR セーフな環境ガード。
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function canObtainWebGL2Context(): boolean {
  // BR-A-02: WebGL2 能力チェック。
  try {
    const probe = document.createElement("canvas");
    return probe.getContext("webgl2") !== null;
  } catch {
    return false;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * 360°ビューワーを初期化する。
 *
 * SSR 環境や WebGL2 非対応環境でも例外を投げず、常に {@link ViewerHandle} を返す。
 * 描画基盤を構築できない場合は縮退したハンドルを返し、`error` イベント（`WEBGL_UNSUPPORTED`）で通知する。
 *
 * @param container - ビューワーを描画する DOM 要素
 * @param options - 初期化オプション（UoW-A 時点では予約のみ）
 */
export function createViewer(container: HTMLElement, _options?: ViewerOptions): ViewerHandle {
  const eventBus = new EventBus();
  const state = createViewerState();
  const errorManager = new ErrorManager(state, eventBus);
  const disposables = new DisposableRegistry();

  const supported = isBrowserEnvironment() && canObtainWebGL2Context();

  if (!supported) {
    // BR-A-03: 縮退時のエラー正規化（原因を区別せず WEBGL_UNSUPPORTED に正規化）。
    state.loadState = "error";
    disposables.register(() => eventBus.clear());

    const handle = buildHandle({
      eventBus,
      state,
      disposables,
      errorManager,
      imageLoading: null,
    });

    // BR-A-04: 呼び出し元が ViewerHandle を受け取った後の on('error', ...) が
    // 確実に間に合うよう、マイクロタスクまで発火を遅延する。
    queueMicrotask(() => {
      if (disposables.isDisposed) return;
      errorManager.report("WEBGL_UNSUPPORTED", WEBGL_UNSUPPORTED_MESSAGE);
    });

    return handle;
  }

  const standardMode = new StandardMode();

  // BR-B-08/BR-B-16: 現在の画像ロードの中断制御・現在表示中のテクスチャの参照。
  // Renderer のコンテキストロスト復帰コールバックからも参照するため、Renderer 構築前に宣言する。
  let currentAbortController: AbortController | null = null;
  let currentSource: { adapter: ImageSourceAdapter; result: SourceResult } | null = null;

  const renderer = new Renderer(container, {
    onContextLost: () => {
      errorManager.report("CONTEXT_LOST", CONTEXT_LOST_MESSAGE);
    },
    onRebuildSucceeded: () => {
      // BR-A-12 復帰成功時、球体メッシュは再生成されプレースホルダに戻っているため、
      // 表示中だった画像テクスチャ（あれば）を再適用する。
      renderer.setSphereTexture(currentSource?.result.texture ?? null);
    },
    onRebuildFailed: () => {
      // BR-A-12: 復帰失敗、再試行しない。フォールバック表示は Renderer 側の停止状態がそのまま維持される。
    },
  });

  renderer.setActiveMode(standardMode);
  standardMode.apply(renderer.modeContext);

  const loader = new Loader();
  const defaultAdapter: ImageSourceAdapter = new EquirectangularSource();
  const registeredAdapters: ImageSourceAdapter[] = [];

  // BR-B-16: dispose 時、現在表示中のテクスチャを最初に解放する。
  disposables.register(() => {
    currentAbortController?.abort();
    if (currentSource) {
      currentSource.adapter.dispose(currentSource.result);
      currentSource = null;
    }
  });
  // BR-A-11: dispose の解体順序（登録順に解体）。
  disposables.register(() => standardMode.dispose(renderer.modeContext));
  disposables.register(() => renderer.dispose());
  disposables.register(() => eventBus.clear());

  renderer.startLoop();
  state.ready = true;
  state.loadState = "ready";

  async function loadImage(input: ImageInput): Promise<void> {
    // BR-B-08: 進行中の前回ロードがあれば中断し、最新呼び出しを優先する。
    currentAbortController?.abort();
    const controller = new AbortController();
    currentAbortController = controller;
    const { signal } = controller;

    state.imageLoadState = "loading";

    try {
      // BR-B-03: 形式検証のみ。
      loader.validate(input);

      // BR-B-02: 登録済みアダプタが既定の EquirectangularSource より優先される。
      const adapter =
        [...registeredAdapters, defaultAdapter].find((candidate) => candidate.canHandle(input)) ??
        defaultAdapter;

      // BR-B-06/BR-B-07: 取得・デコード（進行通知はスロットリング済み）。
      const decoded = await loader.load(
        input,
        (loaded, total) => {
          if (!signal.aborted) {
            eventBus.emit("progress", {
              type: "progress",
              loaded,
              ...(total !== undefined && { total }),
            });
          }
        },
        signal,
      );

      if (signal.aborted) throw new DOMException("Aborted", "AbortError");

      // BR-B-04/BR-B-05: アスペクト比・maxTextureSize 検証はアダプタ内で実施。
      const result = await adapter.createTexture(decoded, {
        maxTextureSize: renderer.maxTextureSize,
      });

      if (signal.aborted) {
        adapter.dispose(result);
        throw new DOMException("Aborted", "AbortError");
      }

      // BR-B-15: 旧テクスチャを解放してから新しいテクスチャを反映する。
      const previous = currentSource;
      currentSource = { adapter, result };
      if (previous) previous.adapter.dispose(previous.result);
      renderer.setSphereTexture(result.texture);

      state.imageLoadState = "ready";
    } catch (error) {
      if (isAbortError(error)) {
        // BR-B-08: 中断されたロードは error を発火せず静かに reject する。
        throw error;
      }

      const normalized =
        error instanceof LoadError
          ? error
          : new LoadError("IMAGE_LOAD_FAILED", LOAD_IMAGE_UNKNOWN_ERROR_MESSAGE);
      state.imageLoadState = "error";
      // BR-B-11: Renderer.setSphereTexture を呼ばないため、直前の表示がそのまま維持される。
      throw errorManager.report(normalized.code, normalized.message);
    }
  }

  function registerSource(adapter: ImageSourceAdapter): void {
    registeredAdapters.push(adapter);
  }

  const handle = buildHandle({
    eventBus,
    state,
    disposables,
    errorManager,
    imageLoading: { loadImage, registerSource },
  });

  // BR-A-04: ready イベントもマイクロタスクまで発火を遅延する（同じ運用上の理由）。
  queueMicrotask(() => {
    if (disposables.isDisposed) return;
    eventBus.emit("ready", { type: "ready" });
  });

  return handle;
}

interface ImageLoadingCapability {
  loadImage: (input: ImageInput) => Promise<void>;
  registerSource: (adapter: ImageSourceAdapter) => void;
}

interface HandleDeps {
  eventBus: EventBus;
  state: ReturnType<typeof createViewerState>;
  disposables: DisposableRegistry;
  errorManager: ErrorManager;
  /** 縮退ハンドル（WebGL2 非対応）の場合は null（BR-B-13）。 */
  imageLoading: ImageLoadingCapability | null;
}

function buildHandle({
  eventBus,
  state,
  disposables,
  errorManager,
  imageLoading,
}: HandleDeps): ViewerHandle {
  const guardDisposed = (): boolean => {
    if (disposables.isDisposed) {
      console.warn(DISPOSED_WARNING);
      return false;
    }
    return true;
  };

  return {
    on<K extends ViewerEventType>(type: K, handler: (event: ViewerEventMap[K]) => void): void {
      if (!guardDisposed()) return;
      eventBus.on(type, handler);
    },
    off<K extends ViewerEventType>(type: K, handler: (event: ViewerEventMap[K]) => void): void {
      if (!guardDisposed()) return;
      eventBus.off(type, handler);
    },
    once<K extends ViewerEventType>(type: K, handler: (event: ViewerEventMap[K]) => void): void {
      if (!guardDisposed()) return;
      eventBus.once(type, handler);
    },
    getMode(): ViewerModeId {
      guardDisposed();
      return state.mode;
    },
    setMode(mode: ViewerModeId): void {
      if (!guardDisposed()) return;
      if (mode !== "standard") {
        // BR-A-17: 非標準値は INVALID_INPUT として通知し、モードは変更しない。
        errorManager.report("INVALID_INPUT", INVALID_MODE_MESSAGE);
        return;
      }
      // 既に標準のため実質的な変更なし（UoW-A では no-op）。
    },
    async loadImage(input: ImageInput): Promise<void> {
      if (!guardDisposed()) return;
      if (!imageLoading) {
        // BR-B-13: 縮退ハンドルでは Renderer が存在しないため反映先がない。
        throw errorManager.report("WEBGL_UNSUPPORTED", LOAD_IMAGE_UNSUPPORTED_MESSAGE);
      }
      return imageLoading.loadImage(input);
    },
    registerSource(adapter: ImageSourceAdapter): void {
      if (!guardDisposed()) return;
      imageLoading?.registerSource(adapter);
    },
    dispose(): void {
      // BR-A-10: 冪等。2回目以降は no-op（警告なし。BR-A-09 は「他のメソッド」向け）。
      disposables.disposeAll();
    },
  };
}
