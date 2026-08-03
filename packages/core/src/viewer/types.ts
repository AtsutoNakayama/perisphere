import type { ImageInput, ImageSourceAdapter } from "../loader/types.js";
import type { ViewerMode } from "./ViewerMode.js";

/**
 * ビューワーモード識別子。同梱7モードの既知リテラルに加え、`registerMode`（BR-C-12）で
 * 登録するカスタムモードの任意の `id` も許容する（`component-methods.md` の型定義通り、BR-C-15）。
 */
export type ViewerModeId =
  | "standard"
  | "ultraWide"
  | "dewarp"
  | "linear"
  | "panini"
  | "tinyPlanet"
  | "crystalBall"
  | (string & {});

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
 * {@link ViewerHandle.setMode} に渡すオプション。将来のアニメーション遷移（US-11、Future）向けの
 * 予約型で、UoW-C 時点ではフィールドを持たない（BR-C-14）。
 */
export interface ModeChangeOptions {
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
  /**
   * ビューワーモードを切り替える。未登録の `id` を渡すと `error` イベント（`INVALID_INPUT`）が発火し、
   * モードは変更されない（BR-C-02）。`options` は将来のアニメーション遷移（US-11、Future）向けの
   * 予約引数で、UoW-C 時点では受け取っても無視する（BR-C-14）。
   */
  setMode(mode: ViewerModeId, options?: ModeChangeOptions): void;
  /** 独自の投影モードを登録する（US-12）。同梱モードと同じ `ModeRegistry` の上に登録される（BR-C-12）。 */
  registerMode(mode: ViewerMode): void;
  /** 登録済みモードの `id` 一覧を返す（登録順、BR-C-13）。 */
  listModes(): ViewerModeId[];

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
