import type { PhotoInput } from "../gallery/types.js";
import type { ImageInput, ImageSourceAdapter } from "../loader/types.js";
import type { InputSource, Keymap } from "../interaction/types.js";
import type { ControlsVisibility, UITextMap } from "../ui/types.js";
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
  | "UNSUPPORTED_FORMAT"
  | "FULLSCREEN_FAILED";

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
  /** 現在の視点（yaw/pitch/fov）。UoW-D で追加（`domain-entities.md` E9）。 */
  view: ViewState;
  /**
   * 現在表示中（ロード成功が確定済み）の写真インデックス。写真が一度も設定されていなければ `-1`。
   * `Gallery` 内部の目標ポインタとは別の「表示中（confirmed）」ポインタ（UoW-E `BR-E-13`）。
   */
  photoIndex: number;
  /** 現在フルスクリーン表示中かどうか（ネイティブ・擬似いずれも `true`、UoW-F）。 */
  isFullscreen: boolean;
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

/** 視点（yaw/pitch/fov）変更通知（BR-D-14）。発火回数・頻度は保証しない（PP-D-1 で集約発火）。 */
export interface ViewChangeEvent extends ViewState {
  type: "viewchange";
}

/** ズーム（fov）変更通知（BR-D-14）。`viewchange` のうち fov が変化した場合に併せて発火する。 */
export interface ZoomChangeEvent {
  type: "zoomchange";
  fov: number;
}

/** 写真切替通知（BR-E-07）。ロードが成功した場合にのみ発火する。 */
export interface PhotoChangeEvent {
  type: "photochange";
  index: number;
  /** 設定済み写真の総数（UoW-G、BR-G-07）。`progress: { loaded, total }` と同じペイロード設計。 */
  total: number;
  id?: string;
}

/**
 * フルスクリーン状態変化通知（UoW-F、BR-F-05）。自らの `enterFullscreen()`/`exitFullscreen()`
 * 呼び出し・外部要因（Esc キー等）によるネイティブフルスクリーン終了のいずれでも発火する。
 */
export interface FullscreenChangeEvent {
  type: "fullscreenchange";
  active: boolean;
}

/** {@link ViewerHandle.on} などで購読できるイベントの型マップ。 */
export interface ViewerEventMap {
  ready: ReadyEvent;
  error: ErrorEvent;
  modechange: ModeChangeEvent;
  progress: ImageProgressEvent;
  viewchange: ViewChangeEvent;
  zoomchange: ZoomChangeEvent;
  photochange: PhotoChangeEvent;
  fullscreenchange: FullscreenChangeEvent;
}

export type ViewerEventType = keyof ViewerEventMap;

/** {@link createViewer} に渡すオプション。 */
export interface ViewerOptions {
  /**
   * 同梱コントロールの初期表示状態（UoW-G、FR-14）。`false` は完全ヘッドレス（`ControlsUI` 自体を
   * 構築しない）、省略または `true` は全コントロール表示、部分オブジェクトは個別指定（未指定キーは
   * 表示扱い）。
   */
  controls?: boolean | Partial<ControlsVisibility>;
  /** 同梱 UI の初期文言・aria-label（UoW-G、FR-15）。構築後の変更は {@link ViewerHandle.setText}。 */
  text?: Partial<UITextMap>;
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

  /** 現在の視点（yaw/pitch/fov）を返す（US-20）。 */
  getView(): ViewState;
  /**
   * 視点を明示的に設定する（US-20）。ドラッグ等と同じクランプ（pitch/fov）・yaw 正規化を適用する。
   * 非有限数値（`NaN`/`Infinity`）を含む場合は反映せず `error` イベント（`INVALID_INPUT`）を発火する（BR-D-11）。
   */
  setView(view: Partial<ViewState>): void;
  /**
   * ズームの上下限を設定する（US-20）。現在の実効範囲に `limits` をマージし、以後モード切替をまたいで
   * 維持される明示設定として扱う（BR-D-10）。`minFov >= maxFov` 等の不正な組み合わせは `error`
   * イベント（`INVALID_INPUT`）を発火し反映しない。
   */
  setZoomLimits(limits: Partial<ZoomLimits>): void;
  /** 独自の入力源を登録する（NFR-02）。組み込みのポインタ/タッチ/キーボード入力源と対等に扱われる。 */
  registerInputSource(source: InputSource): void;
  /** キーマップを変更する（US-19）。`null` はキーボード操作全体を無効化する。 */
  setKeymap(map: Partial<Keymap> | null): void;

  /**
   * 写真リストを設定する（US-23）。インデックスは `0` にリセットされ、1枚目のロードが
   * 自動的に開始される（BR-E-02）。
   */
  setPhotos(photos: readonly PhotoInput[]): void;
  /** 次の写真へ切り替える。リスト末尾では先頭へ巡回する（BR-E-03）。写真が未設定なら何もしない（BR-E-04）。 */
  next(): void;
  /** 前の写真へ切り替える。リスト先頭では末尾へ巡回する（BR-E-03）。写真が未設定なら何もしない（BR-E-04）。 */
  prev(): void;
  /**
   * 指定インデックスの写真へ切り替える。範囲外は `error`（`INVALID_INPUT`）を発火し変更しない
   * （BR-E-05）。写真が未設定なら何もしない（BR-E-04）。
   */
  goTo(index: number): void;
  /** 現在表示中の写真インデックスを返す。写真が一度も設定されていなければ `-1`。 */
  getPhotoIndex(): number;

  /**
   * フルスクリーン表示に切り替える（US-21）。対応環境ではネイティブ Fullscreen API を、
   * 非対応環境（iOS Safari 等）では擬似フルスクリーンを使用する（BR-F-02）。
   * 既にフルスクリーン中の場合は何もせず解決する（BR-F-01）。
   * 対応環境で実行時に拒否された場合は `error`（`FULLSCREEN_FAILED`）を発火しつつ reject する
   * （BR-F-04）。
   */
  enterFullscreen(): Promise<void>;
  /** フルスクリーン表示を解除する（US-21）。既に非フルスクリーンの場合は何もせず解決する。 */
  exitFullscreen(): Promise<void>;
  /** 現在フルスクリーン表示中かどうかを返す（ネイティブ・擬似いずれも `true`）。 */
  isFullscreen(): boolean;

  /**
   * 同梱コントロールの表示/非表示を変更する（US-26）。現在の設定へ部分的にマージする
   * （BR-G-02）。同梱 UI が構築されていない場合（ヘッドレス）は安全な no-op（BR-G-15）。
   */
  setControlsVisibility(config: Partial<ControlsVisibility>): void;
  /**
   * 同梱 UI の文言・aria-label を差し替える（US-27）。現在の文言へ部分的にマージする
   * （BR-G-10）。同梱 UI が構築されていない場合（ヘッドレス）は安全な no-op（BR-G-15）。
   */
  setText(overrides: Partial<UITextMap>): void;
  /** 設定済み写真の総数を返す（BR-G-07）。写真が一度も設定されていなければ `0`。 */
  getPhotoCount(): number;

  /** ビューワーが保持するリソースを解放する。複数回呼び出しても安全（冪等）。 */
  dispose(): void;
}
