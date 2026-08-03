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

    const handle = buildHandle({ eventBus, state, disposables, errorManager });

    // BR-A-04: 呼び出し元が ViewerHandle を受け取った後の on('error', ...) が
    // 確実に間に合うよう、マイクロタスクまで発火を遅延する。
    queueMicrotask(() => {
      if (disposables.isDisposed) return;
      errorManager.report("WEBGL_UNSUPPORTED", WEBGL_UNSUPPORTED_MESSAGE);
    });

    return handle;
  }

  const standardMode = new StandardMode();

  const renderer = new Renderer(container, {
    onContextLost: () => {
      errorManager.report("CONTEXT_LOST", CONTEXT_LOST_MESSAGE);
    },
    onRebuildSucceeded: () => {
      // BR-A-12: 復帰成功。追加の状態変更は不要（描画ループは Renderer 側で再開済み）。
    },
    onRebuildFailed: () => {
      // BR-A-12: 復帰失敗、再試行しない。フォールバック表示は Renderer 側の停止状態がそのまま維持される。
    },
  });

  renderer.setActiveMode(standardMode);
  standardMode.apply(renderer.modeContext);

  // BR-A-11: dispose の解体順序（登録順に解体）。
  disposables.register(() => standardMode.dispose(renderer.modeContext));
  disposables.register(() => renderer.dispose());
  disposables.register(() => eventBus.clear());

  renderer.startLoop();
  state.ready = true;
  state.loadState = "ready";

  const handle = buildHandle({ eventBus, state, disposables, errorManager });

  // BR-A-04: ready イベントもマイクロタスクまで発火を遅延する（同じ運用上の理由）。
  queueMicrotask(() => {
    if (disposables.isDisposed) return;
    eventBus.emit("ready", { type: "ready" });
  });

  return handle;
}

interface HandleDeps {
  eventBus: EventBus;
  state: ReturnType<typeof createViewerState>;
  disposables: DisposableRegistry;
  errorManager: ErrorManager;
}

function buildHandle({ eventBus, state, disposables, errorManager }: HandleDeps): ViewerHandle {
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
    dispose(): void {
      // BR-A-10: 冪等。2回目以降は no-op（警告なし。BR-A-09 は「他のメソッド」向け）。
      disposables.disposeAll();
    },
  };
}
