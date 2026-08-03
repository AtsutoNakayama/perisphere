import type { ImageInput, ImageSourceAdapter } from "../loader/types.js";

/** UoW-A で有効な唯一のビューワーモード識別子。他モードは UoW-C 以降で追加される。 */
export type ViewerModeId = "standard";

/** カメラの向き（度単位の yaw/pitch）とズーム量（fov、度単位）。 */
export interface ViewState {
  yaw: number;
  pitch: number;
  fov: number;
}

/** モードごとのズーム（fov）範囲。 */
export interface ZoomLimits {
  minFov: number;
  maxFov: number;
}

/** perisphere が発生させうるエラーの分類。 */
export type PerisphereErrorCode =
  | "IMAGE_LOAD_FAILED"
  | "WEBGL_UNSUPPORTED"
  | "CONTEXT_LOST"
  | "INVALID_INPUT"
  | "UNSUPPORTED_FORMAT";

/** message は内部詳細（スタックトレース・内部パス）を含まない利用者向け安全な文言のみ（BR-A-13）。 */
export interface PerisphereError {
  code: PerisphereErrorCode;
  message: string;
}

/** 画像ロードの進捗状態（UoW-A の `loadState`＝初期化状態とは別概念、BR-B-10/BR-A-16）。 */
export type ImageLoadState = "idle" | "loading" | "ready" | "error";

export interface ViewerState {
  mode: ViewerModeId;
  ready: boolean;
  loadState: "idle" | "loading" | "ready" | "error";
  lastError: PerisphereError | null;
  imageLoadState: ImageLoadState;
}

export interface ReadyEvent {
  type: "ready";
}

export interface ErrorEvent {
  type: "error";
  error: PerisphereError;
}

export interface ModeChangeEvent {
  type: "modechange";
  mode: ViewerModeId;
}

/** 画像ロードの進行通知（BR-B-07、スロットリング済み）。DOM 標準の `ProgressEvent` とは無関係。 */
export interface ImageProgressEvent {
  type: "progress";
  loaded: number;
  total?: number;
}

/** {@link ViewerHandle.on} などで購読できるイベントの型マップ。 */
export interface ViewerEventMap {
  ready: ReadyEvent;
  error: ErrorEvent;
  modechange: ModeChangeEvent;
  progress: ImageProgressEvent;
}

export type ViewerEventType = keyof ViewerEventMap;

/** {@link createViewer} に渡すオプション。UoW-A 時点では予約のみ。 */
export interface ViewerOptions {
  [key: string]: unknown;
}

/**
 * {@link createViewer} が返す公開ファサード。
 * UoW-A が実装するメンバーのみ。他ユニットの担当分（loadImage/setView/next 等）は該当ユニットで追加される。
 */
export interface ViewerHandle {
  /** イベントを購読する。 */
  on<K extends ViewerEventType>(type: K, handler: (event: ViewerEventMap[K]) => void): void;
  /** {@link ViewerHandle.on} で登録したハンドラの購読を解除する。 */
  off<K extends ViewerEventType>(type: K, handler: (event: ViewerEventMap[K]) => void): void;
  /** 次の1回だけ発火するイベントを購読する。 */
  once<K extends ViewerEventType>(type: K, handler: (event: ViewerEventMap[K]) => void): void;

  /** 現在のビューワーモードを返す。 */
  getMode(): ViewerModeId;
  /** ビューワーモードを切り替える。`'standard'` 以外を渡すと `error` イベント（`INVALID_INPUT`）が発火する。 */
  setMode(mode: ViewerModeId): void;

  /**
   * 画像を読み込み、標準ビューに反映する。
   * 進行中に再度呼び出すと前回のロードは中断される（BR-B-08）。
   * 失敗時は `error` イベントを発火しつつ `Promise` を reject し、直前の表示は維持される（BR-B-11）。
   */
  loadImage(input: ImageInput): Promise<void>;
  /** 独自の画像ソースアダプタを登録する（US-04）。既定の `EquirectangularSource` より優先される。 */
  registerSource(adapter: ImageSourceAdapter): void;

  /** ビューワーが保持するリソースを解放する。複数回呼び出しても安全（冪等）。 */
  dispose(): void;
}
