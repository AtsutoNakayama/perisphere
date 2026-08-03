import { Gallery, normalizePhotoInput } from "../gallery/Gallery.js";
import type { PhotoInput } from "../gallery/types.js";
import { InputManager } from "../interaction/InputManager.js";
import { KeyboardInputSource } from "../interaction/KeyboardInputSource.js";
import { PointerInputSource } from "../interaction/PointerInputSource.js";
import { TouchInputSource } from "../interaction/TouchInputSource.js";
import type { InputIntent, InputSource, Keymap } from "../interaction/types.js";
import { ViewController } from "../interaction/ViewController.js";
import { FALLBACK_DEFAULT_VIEW } from "../interaction/viewMath.js";
import { EquirectangularSource } from "../loader/EquirectangularSource.js";
import { LoadError, Loader } from "../loader/Loader.js";
import type { ImageInput, ImageSourceAdapter, SourceResult } from "../loader/types.js";
import { CrystalBallMode } from "../modes/CrystalBallMode.js";
import { DewarpMode } from "../modes/DewarpMode.js";
import { LinearMode } from "../modes/LinearMode.js";
import { ModeRegistry } from "../modes/ModeRegistry.js";
import { PaniniMode } from "../modes/PaniniMode.js";
import { TinyPlanetMode } from "../modes/TinyPlanetMode.js";
import { UltraWideMode } from "../modes/UltraWideMode.js";
import { DisposableRegistry } from "./DisposableRegistry.js";
import { ErrorManager } from "./ErrorManager.js";
import { EventBus } from "./EventBus.js";
import { Renderer } from "./Renderer.js";
import { StandardMode } from "./StandardMode.js";
import { createViewerState } from "./ViewerState.js";
import type { ViewerMode } from "./ViewerMode.js";
import type {
  ModeChangeOptions,
  ViewerEventMap,
  ViewerEventType,
  ViewerHandle,
  ViewerModeId,
  ViewerOptions,
  ViewState,
  ZoomLimits,
} from "./types.js";

const WEBGL_UNSUPPORTED_MESSAGE =
  "This browser or environment does not support the WebGL2 rendering required by perisphere.";
const CONTEXT_LOST_MESSAGE = "The WebGL rendering context was lost and could not be recovered.";
const INVALID_MODE_MESSAGE = "The requested viewer mode is not available.";
const DISPOSED_WARNING = "[perisphere] ViewerHandle method called after dispose(); ignoring.";
const LOAD_IMAGE_UNSUPPORTED_MESSAGE =
  "loadImage() is not available because WebGL2 rendering is not supported in this environment.";
const LOAD_IMAGE_UNKNOWN_ERROR_MESSAGE = "Failed to load the image.";
const INVALID_VIEW_MESSAGE = "The provided view contains a non-finite value.";
const INVALID_ZOOM_LIMITS_MESSAGE =
  "The provided zoom limits are invalid (non-finite, or minFov is not less than maxFov).";
const INVALID_PHOTO_INDEX_MESSAGE = "The provided photo index is not an integer within range.";

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
      modeSwitching: {
        // BR-C-02 相当の最小限の挙動。縮退ハンドルには Renderer が存在せずモード適用先がないため、
        // 'standard' のみ有効な no-op として扱い、他は INVALID_INPUT とする。
        setMode: (mode) => {
          if (mode !== "standard") {
            errorManager.report("INVALID_INPUT", INVALID_MODE_MESSAGE);
          }
        },
        registerMode: () => {
          // 縮退ハンドルでは登録しても反映先がないため no-op。
        },
        listModes: () => ["standard"],
      },
      interaction: {
        // 縮退ハンドルには Renderer/ModeContext が存在せず反映先がないため、全て安全な no-op とする。
        getView: () => ({ ...FALLBACK_DEFAULT_VIEW }),
        setView: () => {},
        setZoomLimits: () => {},
        registerInputSource: () => {},
        setKeymap: () => {},
      },
      gallery: {
        // 縮退ハンドルには Renderer が存在せず写真を反映できないため、全て安全な no-op とする
        // （`interaction` と同じ思想。同期 API のため `loadImage` のような reject はしない）。
        setPhotos: () => {},
        next: () => {},
        prev: () => {},
        goTo: () => {},
        getPhotoIndex: () => -1,
      },
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
  // BR-C-03: 現在のモード。Renderer のコンテキストロスト復帰コールバックからも参照するため、
  // Renderer 構築前に宣言する。
  let currentAbortController: AbortController | null = null;
  let currentSource: { adapter: ImageSourceAdapter; result: SourceResult } | null = null;
  let currentMode: ViewerMode = standardMode;
  // BR-D-13: コンテキストロスト復帰コールバックからも参照するため、Renderer 構築前に宣言する。
  const viewController = new ViewController();
  // BR-E-13: 写真リストと目標（pending）インデックスの保持（RP-E-1）。
  const gallery = new Gallery();

  const renderer = new Renderer(container, {
    onContextLost: () => {
      errorManager.report("CONTEXT_LOST", CONTEXT_LOST_MESSAGE);
    },
    onRebuildSucceeded: () => {
      // BR-A-12 復帰成功時、球体メッシュは再生成されているため、表示中だった画像テクスチャ
      // （あれば）を再適用する。現在のモードが Renderer.rebuild() 内で再適用済みだが、
      // カメラベースモードはテクスチャに触れないため、ここで明示的に反映する（冪等）。
      renderer.setSphereTexture(currentSource?.result.texture ?? null);
      // BR-D-13: rebuild() は activeMode.apply() を呼びモード既定ビューへ戻すため、
      // コンテキストロスト直前まで利用者が操作していた視点を再適用する。
      currentMode.updateView(renderer.modeContext, viewController.getView());
    },
    onRebuildFailed: () => {
      // BR-A-12: 復帰失敗、再試行しない。フォールバック表示は Renderer 側の停止状態がそのまま維持される。
    },
    onFrame: () => {
      // PP-D-1 Coalesced View Change Emission: 毎フレーム、発火保留があれば集約して発火する。
      const flushed = viewController.flushIfPending();
      if (!flushed) return;
      eventBus.emit("viewchange", { type: "viewchange", ...flushed.view });
      if (flushed.fovChanged) {
        eventBus.emit("zoomchange", { type: "zoomchange", fov: flushed.view.fov });
      }
    },
  });

  // BR-C-01: 全7モードを登録順（FR-03 の列挙順）で ModeRegistry へ登録する。
  const modeRegistry = new ModeRegistry();
  const builtinModes: ViewerMode[] = [
    standardMode,
    new UltraWideMode(),
    new DewarpMode(),
    new LinearMode(),
    new PaniniMode(),
    new TinyPlanetMode(),
    new CrystalBallMode(),
  ];
  for (const mode of builtinModes) {
    modeRegistry.register(mode);
  }

  renderer.setActiveMode(standardMode);
  standardMode.apply(renderer.modeContext);
  // BR-D-12 相当の初期同期: 起動時に実際に適用された既定ビュー/ズーム範囲へ ViewController を同期する。
  viewController.resetToModeDefault(
    standardMode.defaultView ?? FALLBACK_DEFAULT_VIEW,
    standardMode.defaultZoomLimits,
  );

  function reflectView(): void {
    currentMode.updateView(renderer.modeContext, viewController.getView());
  }

  function handleInputIntent(intent: InputIntent): void {
    switch (intent.kind) {
      case "pan":
        viewController.applyPan(intent.deltaPx);
        reflectView();
        break;
      case "tilt":
        viewController.applyTilt(intent.deltaPx);
        reflectView();
        break;
      case "zoom":
        if (intent.mode === "delta") {
          viewController.applyZoomDelta(intent.value);
        } else {
          viewController.applyZoomScale(intent.value);
        }
        reflectView();
        break;
      case "setMode":
        setMode(intent.mode);
        break;
      case "photoNext":
        // BR-E-11: UoW-D 時点の no-op（BR-D-16）を解消し、next() へ結線する。
        next();
        break;
      case "photoPrev":
        // BR-E-11: UoW-D 時点の no-op（BR-D-16）を解消し、prev() へ結線する。
        prev();
        break;
      case "toggleFullscreen":
        // BR-D-16: UoW-F（フルスクリーン）が未実装のため安全に無視する。
        break;
    }
  }

  // BR-D-01: 組み込み入力源をコンテナへアタッチする。共有の intent ハンドラを渡す。
  const inputManager = new InputManager(container, handleInputIntent);
  const keyboardInputSource = new KeyboardInputSource();
  inputManager.register(new PointerInputSource());
  inputManager.register(new TouchInputSource());
  inputManager.register(keyboardInputSource);

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
  // BR-A-11 拡張: 現在のモードの dispose → 全登録モードの disposeResources（BR-C-09）→ Renderer → EventBus。
  disposables.register(() => currentMode.dispose(renderer.modeContext));
  disposables.register(() => {
    for (const id of modeRegistry.listIds()) {
      modeRegistry.get(id)?.disposeResources?.(renderer.modeContext);
    }
  });
  // BR-D-03: 組み込み・登録済みを問わず全 InputSource を破棄時にデタッチする。
  disposables.register(() => inputManager.detachAll());
  disposables.register(() => renderer.dispose());
  disposables.register(() => eventBus.clear());

  renderer.startLoop();
  state.ready = true;
  state.loadState = "ready";

  // BR-E-06/RP-E-2: loadImage()・写真切替（switchToPhoto）の両方から呼ばれる共通ロード処理。
  async function performLoad(input: ImageInput): Promise<void> {
    // BR-B-08/BR-E-09: 進行中の前回ロードがあれば中断し、最新呼び出しを優先する。
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
        // BR-B-08/BR-E-09: 中断されたロードは error を発火せず静かに reject する。
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

  async function loadImage(input: ImageInput): Promise<void> {
    return performLoad(input);
  }

  function registerSource(adapter: ImageSourceAdapter): void {
    registeredAdapters.push(adapter);
  }

  // BR-E-06: 写真切替は既存のロードパイプライン（performLoad）を再利用する。
  async function switchToPhoto(index: number, photo: PhotoInput): Promise<void> {
    const normalized = normalizePhotoInput(photo);
    try {
      await performLoad(normalized.src);
      // BR-E-07/BR-E-13: ロード成功時にのみ「表示中」ポインタを確定させる。
      state.photoIndex = index;
      eventBus.emit("photochange", {
        type: "photochange",
        index,
        ...(normalized.id !== undefined && { id: normalized.id }),
      });
    } catch (error) {
      if (isAbortError(error)) {
        // BR-E-09: より新しい呼び出しに追い越された。静かに終了する。
        return;
      }
      // BR-E-08: performLoad が既に error を発火・reject 済み。photoIndex は変更しない。
    }
  }

  function setPhotos(photos: readonly PhotoInput[]): void {
    // BR-E-02: リストを差し替え、1枚目があれば自動的にロードを開始する。
    gallery.setPhotos(photos);
    const photo = gallery.getPhoto(0);
    if (photo !== undefined) {
      void switchToPhoto(0, photo);
    }
  }

  function next(): void {
    const result = gallery.next();
    if (result.status !== "moved") return; // BR-E-04: 写真未設定時は安全に無視する。
    const photo = gallery.getPhoto(result.index);
    if (photo !== undefined) void switchToPhoto(result.index, photo);
  }

  function prev(): void {
    const result = gallery.prev();
    if (result.status !== "moved") return; // BR-E-04
    const photo = gallery.getPhoto(result.index);
    if (photo !== undefined) void switchToPhoto(result.index, photo);
  }

  function goTo(index: number): void {
    const result = gallery.goTo(index);
    if (result.status === "out-of-range") {
      // BR-E-05: 範囲外の明示指定は INVALID_INPUT を発火する。
      errorManager.report("INVALID_INPUT", INVALID_PHOTO_INDEX_MESSAGE);
      return;
    }
    if (result.status === "empty") return; // BR-E-04
    const photo = gallery.getPhoto(result.index);
    if (photo !== undefined) void switchToPhoto(result.index, photo);
  }

  function getPhotoIndex(): number {
    return state.photoIndex;
  }

  function setMode(mode: ViewerModeId, _options?: ModeChangeOptions): void {
    // BR-C-14: options は将来のアニメーション遷移向けの予約引数で、UoW-C 時点では無視する。
    const target = modeRegistry.get(mode);
    if (!target) {
      // BR-C-02: 未登録の id は INVALID_INPUT として通知し、モードは変更しない。
      errorManager.report("INVALID_INPUT", INVALID_MODE_MESSAGE);
      return;
    }
    if (target === currentMode) {
      // 既に適用中のモードへの切替は実質的な変更なし（UoW-A StandardMode の既存挙動を踏襲）。
      return;
    }

    // BR-C-03: dispose(旧) → apply(新) → 状態更新 → イベント発火。
    currentMode.dispose(renderer.modeContext);
    currentMode = target;
    renderer.setActiveMode(target);
    target.apply(renderer.modeContext);
    // BR-D-12: ViewController を実際に適用された既定ビューへ同期し、明示ズーム上下限があれば再クランプする。
    viewController.resetToModeDefault(
      target.defaultView ?? FALLBACK_DEFAULT_VIEW,
      target.defaultZoomLimits,
    );
    reflectView();
    state.mode = target.id;
    eventBus.emit("modechange", { type: "modechange", mode: target.id });
  }

  function registerMode(mode: ViewerMode): void {
    // BR-C-12: 同梱モードと同じ ModeRegistry の上に登録される。
    modeRegistry.register(mode);
  }

  function listModes(): ViewerModeId[] {
    // BR-C-13
    return modeRegistry.listIds();
  }

  function getView(): ViewState {
    return viewController.getView();
  }

  function setView(partial: Partial<ViewState>): void {
    // BR-D-11: 不正値（非有限数値）は反映せず INVALID_INPUT を発火する（NFR Requirements Q5）。
    viewController.setView(partial, () => {
      errorManager.report("INVALID_INPUT", INVALID_VIEW_MESSAGE);
    });
    reflectView();
  }

  function setZoomLimits(limits: Partial<ZoomLimits>): void {
    // BR-D-10: 不正値（非有限数値、minFov >= maxFov）は反映せず INVALID_INPUT を発火する。
    viewController.setZoomLimits(limits, () => {
      errorManager.report("INVALID_INPUT", INVALID_ZOOM_LIMITS_MESSAGE);
    });
    reflectView();
  }

  function registerInputSource(source: InputSource): void {
    // BR-D-02
    inputManager.register(source);
  }

  function setKeymap(map: Partial<Keymap> | null): void {
    keyboardInputSource.setKeymap(map);
  }

  const handle = buildHandle({
    eventBus,
    state,
    disposables,
    errorManager,
    imageLoading: { loadImage, registerSource },
    modeSwitching: { setMode, registerMode, listModes },
    interaction: { getView, setView, setZoomLimits, registerInputSource, setKeymap },
    gallery: { setPhotos, next, prev, goTo, getPhotoIndex },
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

interface ModeSwitchingCapability {
  setMode: (mode: ViewerModeId, options?: ModeChangeOptions) => void;
  registerMode: (mode: ViewerMode) => void;
  listModes: () => ViewerModeId[];
}

interface InteractionCapability {
  getView: () => ViewState;
  setView: (partial: Partial<ViewState>) => void;
  setZoomLimits: (limits: Partial<ZoomLimits>) => void;
  registerInputSource: (source: InputSource) => void;
  setKeymap: (map: Partial<Keymap> | null) => void;
}

interface GalleryCapability {
  setPhotos: (photos: readonly PhotoInput[]) => void;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  getPhotoIndex: () => number;
}

interface HandleDeps {
  eventBus: EventBus;
  state: ReturnType<typeof createViewerState>;
  disposables: DisposableRegistry;
  errorManager: ErrorManager;
  /** 縮退ハンドル（WebGL2 非対応）の場合は null（BR-B-13）。 */
  imageLoading: ImageLoadingCapability | null;
  modeSwitching: ModeSwitchingCapability;
  /** 縮退ハンドルでも安全な no-op 実装を持つため null にはしない（BR-D-16 と同じ思想）。 */
  interaction: InteractionCapability;
  /** 縮退ハンドルでも安全な no-op 実装を持つため null にはしない（`interaction` と同じ思想）。 */
  gallery: GalleryCapability;
}

function buildHandle({
  eventBus,
  state,
  disposables,
  errorManager,
  imageLoading,
  modeSwitching,
  interaction,
  gallery,
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
    setMode(mode: ViewerModeId, options?: ModeChangeOptions): void {
      if (!guardDisposed()) return;
      modeSwitching.setMode(mode, options);
    },
    registerMode(mode: ViewerMode): void {
      if (!guardDisposed()) return;
      modeSwitching.registerMode(mode);
    },
    listModes(): ViewerModeId[] {
      guardDisposed();
      return modeSwitching.listModes();
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
    getView(): ViewState {
      guardDisposed();
      return interaction.getView();
    },
    setView(view: Partial<ViewState>): void {
      if (!guardDisposed()) return;
      interaction.setView(view);
    },
    setZoomLimits(limits: Partial<ZoomLimits>): void {
      if (!guardDisposed()) return;
      interaction.setZoomLimits(limits);
    },
    registerInputSource(source: InputSource): void {
      if (!guardDisposed()) return;
      interaction.registerInputSource(source);
    },
    setKeymap(map: Partial<Keymap> | null): void {
      if (!guardDisposed()) return;
      interaction.setKeymap(map);
    },
    setPhotos(photos: readonly PhotoInput[]): void {
      if (!guardDisposed()) return;
      gallery.setPhotos(photos);
    },
    next(): void {
      if (!guardDisposed()) return;
      gallery.next();
    },
    prev(): void {
      if (!guardDisposed()) return;
      gallery.prev();
    },
    goTo(index: number): void {
      if (!guardDisposed()) return;
      gallery.goTo(index);
    },
    getPhotoIndex(): number {
      guardDisposed();
      return gallery.getPhotoIndex();
    },
    dispose(): void {
      // BR-A-10: 冪等。2回目以降は no-op（警告なし。BR-A-09 は「他のメソッド」向け）。
      disposables.disposeAll();
    },
  };
}
