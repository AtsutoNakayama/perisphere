# Component Methods — perisphere（メソッドシグネチャ・入出力型・概要）

- **関連 Issue**: [#21](https://github.com/AtsutoNakayama/perisphere/issues/21)
- **作成日**: 2026-06-29
- **注記**: シグネチャは**設計意図を示す TypeScript 風の擬似定義**。詳細なビジネスルール（投影数式・クランプ計算・状態遷移の細部）は Construction の **Functional Design**（ユニットごと）で確定する。型名・引数は実装段階で調整されうる。

## 共通の型（抜粋・暫定）

```ts
type ViewerModeId = 'standard' | 'ultraWide' | 'dewarp' | 'linear'
  | 'panini' | 'tinyPlanet' | 'crystalBall' | (string & {}); // カスタムも許容

interface ViewState { yaw: number; pitch: number; fov: number; } // 単位は Functional Design で確定
interface ZoomLimits { minFov: number; maxFov: number; }

interface PerisphereError {        // 内部詳細を含めない（FR-18 / SECURITY-09）
  code: 'IMAGE_LOAD_FAILED' | 'WEBGL_UNSUPPORTED' | 'CONTEXT_LOST'
      | 'INVALID_INPUT' | 'UNSUPPORTED_FORMAT';
  message: string;                 // 利用者向けの安全なメッセージ
}

// FR-17 のイベント → ペイロード対応（型付き Emitter / Q3=C）
interface ViewerEventMap {
  ready:           void;
  progress:        { loaded: number; total?: number };
  error:           PerisphereError;
  viewchange:      ViewState;
  zoomchange:      { fov: number };
  modechange:      { mode: ViewerModeId };
  photochange:     { index: number; id?: string };
  fullscreenchange:{ active: boolean };
}
```

## C1 `ViewerHandle`（公開ファサード / `createViewer` の戻り値）

```ts
function createViewer(
  container: HTMLElement,
  options?: ViewerOptions
): ViewerHandle;                              // FR-01 / NFR-03（呼び出しはクライアントのみ）

interface ViewerHandle {
  // モード（FR-03,04,05 / US-06〜12）
  setMode(mode: ViewerModeId, options?: ModeChangeOptions): void; // 即時切替。options は将来のアニメ用拡張余地（FR-04/US-11）
  getMode(): ViewerModeId;
  registerMode(mode: ViewerMode): void;       // インスタンス単位登録（Q4=A / FR-05）
  listModes(): ViewerModeId[];

  // 画像 / 入力ソース（FR-01,02 / US-01〜05）
  loadImage(source: ImageInput): Promise<void>;        // URL or データ。検証→ロード（NFR-10）
  registerSource(adapter: ImageSourceAdapter): void;   // 入力フォーマット拡張（Q4=A / FR-02）

  // 視点・ズーム（FR-06〜09 / US-13〜20）
  setView(view: Partial<ViewState>): void;
  getView(): ViewState;
  setZoomLimits(limits: Partial<ZoomLimits>): void;

  // ギャラリー（FR-11 / US-18,23）
  setPhotos(photos: PhotoInput[]): void;
  next(): void;
  prev(): void;
  goTo(index: number): void;
  getPhotoIndex(): number;

  // フルスクリーン（FR-10 / US-21,22）
  enterFullscreen(): Promise<void>;
  exitFullscreen(): Promise<void>;
  isFullscreen(): boolean;

  // 入力デバイス / キーマップ（FR-08 / US-19, NFR-02）
  registerInputSource(source: InputSource): void;
  setKeymap(map: Partial<Keymap> | null): void;        // null で無効化

  // イベント（FR-17 / US-29 / Q3=C 型付き Emitter）
  on<K extends keyof ViewerEventMap>(type: K, handler: (e: ViewerEventMap[K]) => void): void;
  off<K extends keyof ViewerEventMap>(type: K, handler: (e: ViewerEventMap[K]) => void): void;
  once<K extends keyof ViewerEventMap>(type: K, handler: (e: ViewerEventMap[K]) => void): void;

  // 同梱 UI（FR-14,15 / US-24,26,27）
  setControlsVisibility(config: Partial<ControlsVisibility>): void;
  setText(overrides: Partial<UITextMap>): void;         // 文言・aria-label 差し替え

  // ライフサイクル（US-31 / SECURITY-15）
  dispose(): void;                                       // WebGL/リスナー/テクスチャを解放
}
```

## C4 `ImageSourceAdapter`（公開拡張 IF / FR-02）

```ts
interface ImageSourceAdapter {
  readonly id: string;
  canHandle(input: ImageInput): boolean;
  // 取得したテクスチャと投影ヒントを返す。失敗は PerisphereError に正規化
  createTexture(input: ImageInput, ctx: SourceContext): Promise<SourceResult>;
  dispose(result: SourceResult): void;        // テクスチャ解放（US-31）
}
```

## C5 `ViewerMode`（公開拡張 IF / FR-05・Q5=D により形のみ）

```ts
interface ViewerMode {
  readonly id: ViewerModeId;
  readonly defaultZoomLimits?: ZoomLimits;    // モード既定範囲（FR-09 / US-20）
  apply(ctx: ModeContext): void;              // モード適用（具体は Functional Design）
  updateView(ctx: ModeContext, view: ViewState): void;
  dispose(ctx: ModeContext): void;
}
```

## C7 `InputSource`（公開拡張 IF / NFR-02）

```ts
interface InputSource {
  readonly id: string;
  attach(target: HTMLElement, emit: (intent: InputIntent) => void): void;
  detach(): void;                              // dispose 時に解除（US-31）
}
// InputIntent 例: { kind: 'pan'|'tilt'|'zoom'|'photoNext'|'photoPrev'|'toggleFullscreen'|'setMode'; ... }
```

## C8 `Gallery`（内部 / FR-11）

```ts
class Gallery {
  setPhotos(photos: PhotoInput[]): void;
  next(): number;                              // 戻り値は新 index。端のループ方針は Functional Design で確定
  prev(): number;
  goTo(index: number): number;
  get current(): number;
}
```

## C11 `EventBus`（内部・型付き Emitter / FR-17）

```ts
class EventBus<M> {
  on<K extends keyof M>(type: K, h: (e: M[K]) => void): void;
  off<K extends keyof M>(type: K, h: (e: M[K]) => void): void;
  once<K extends keyof M>(type: K, h: (e: M[K]) => void): void;
  emit<K extends keyof M>(type: K, payload: M[K]): void;
  clear(): void;                               // dispose 時に全解除（US-31）
}
```

## C13 `Loader`（内部 / NFR-10）

```ts
class Loader {
  validate(input: ImageInput): void;           // 型/範囲/形式（不正は INVALID_INPUT）SECURITY-05/11
  load(input: ImageInput, onProgress: (p: ProgressEvent) => void): Promise<DecodedImage>; // CORS 対応
}
```

## C16〜C18 React アダプタ（薄いラッパ / Q7=A / FR-16）

```ts
interface PerisphereProps extends ViewerOptions {
  image?: ImageInput;
  photos?: PhotoInput[];
  mode?: ViewerModeId;
  // イベント → props コールアウト（Q3=C のブリッジ）
  onReady?: () => void;
  onError?: (e: PerisphereError) => void;
  onModeChange?: (e: { mode: ViewerModeId }) => void;
  onPhotoChange?: (e: { index: number }) => void;
  // ... ViewerEventMap に対応する onXxx
}

const Perisphere: React.ForwardRefExoticComponent<
  PerisphereProps & React.RefAttributes<PerisphereHandle>
>;                                              // useEffect 内で createViewer / unmount で dispose（NFR-03/US-31）

function usePerisphere(): {
  ref: React.RefObject<PerisphereHandle>;
};

interface PerisphereHandle {                    // ref 経由の命令 API（ViewerHandle の部分集合）
  setMode(mode: ViewerModeId, options?: ModeChangeOptions): void;
  next(): void; prev(): void; goTo(index: number): void;
  enterFullscreen(): Promise<void>; exitFullscreen(): Promise<void>;
  getView(): ViewState; setView(v: Partial<ViewState>): void;
}
```

> 上記の数値の意味・既定値・境界条件・エラー分岐の詳細、および `ViewerMode.apply` 等の中身は **Functional Design** で確定する。
