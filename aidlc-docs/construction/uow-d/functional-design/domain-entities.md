# Domain Entities — UoW-D 視点操作・入力

- **関連 Issue**: [#38](https://github.com/AtsutoNakayama/perisphere/issues/38)
- **作成日**: 2026-08-03
- **前提資料**: `uow-d-functional-design-plan.md`（Q1〜Q8 回答）、`inception/application-design/component-methods.md`（`ViewerHandle` 拡張・`InputSource` IF・`ViewerEventMap` 拡張は Inception で確定済み）、UoW-A/UoW-C `domain-entities.md`
- **注記**: 本ユニットのエンティティ番号（E1〜）はこのドキュメント内で独立採番する。`component-methods.md` で既に確定済みの公開 IF（`setView`/`getView`/`setZoomLimits`/`registerInputSource`/`setKeymap`/`viewchange`/`zoomchange`）はここで初めて実装するが、シグネチャ自体は変更しない。

## エンティティ一覧

| # | 名称 | 種別 | 概要 |
|---|---|---|---|
| E1 | `ViewController` | 内部エンティティ（C6） | `ViewState` の保持・更新、ズーム上下限の解決とクランプ |
| E2 | `InputManager` | 内部エンティティ（C7 内部） | 複数の `InputSource` の集約・アタッチ／デタッチ・`InputIntent` の一元受付 |
| E3 | `InputSource`（IF） | 公開拡張 IF（C7、Inception 確定済み） | `attach(target, emit)` / `detach()`（再掲、変更なし） |
| E4 | `PointerInputSource` | `InputSource` の実装 | マウスドラッグ（pan/tilt）＋ホイール（zoom） |
| E5 | `TouchInputSource` | `InputSource` の実装 | 1本指ドラッグ（pan/tilt）＋ピンチ（zoom） |
| E6 | `KeyboardInputSource` | `InputSource` の実装 | `Keymap` に基づくキー入力の正規化 |
| E7 | `Keymap` | 値オブジェクト | アクション → キー列の対応表（`setKeymap` で変更・無効化） |
| E8 | `InputIntent` | 値オブジェクト（判別共用体） | 正規化された入力意図。`kind` で判別 |
| E9 | `ViewerState`（拡張） | 値オブジェクト（UoW-A C12 の拡張） | `view: ViewState` を追加 |
| E10 | `ViewerMode`（拡張、IF） | 公開拡張 IF（UoW-A C5 の拡張） | `defaultView?: ViewState` を追加（本ユニットでの発見・追記、後述） |

## エンティティ詳細

### E1 `ViewController`（C6）

```text
class ViewController {
  getView(): ViewState;
  setView(partial: Partial<ViewState>): void;       // 公開 API（Q5 相当のクランプ込み）
  setZoomLimits(partial: Partial<ZoomLimits>): void; // 公開 API（Q5）
  applyPan(deltaPx: number): void;                   // PointerInputSource/TouchInputSource から
  applyTilt(deltaPx: number): void;
  applyZoomDelta(rawWheelDeltaY: number): void;       // wheel（Q4 加算モデル）
  applyZoomScale(rawDistanceRatio: number): void;     // pinch（Q4 乗算モデル）
  resetToModeDefault(defaultView: ViewState): void;   // setMode 直後に Viewer から呼ばれる（BR-D-11）
}
```

- **責務**: 現在の `ViewState`（yaw/pitch/fov）を唯一の場所で保持し、あらゆる入力経路（ドラッグ・ホイール・ピンチ・キーボード・明示 `setView`/`setZoomLimits`・モード切替直後の同期）からの更新を同じクランプ規則（Q3 の pitch クランプ、Q5 の実効ズーム範囲）に通す。
- **ズーム上下限の解決**（Q5=A）: 明示的に `setZoomLimits` が呼ばれていない間はアクティブモードの `defaultZoomLimits`（未定義の場合は絶対フォールバック `{minFov: 10, maxFov: 170}`）を用いる。明示設定後はモード切替をまたいで維持され、モード既定より優先される。

### E2 `InputManager`（C7 内部）

```text
class InputManager {
  constructor(target: HTMLElement, onIntent: (intent: InputIntent) => void);
  register(source: InputSource): void;   // registerInputSource からも、組み込み3種の初期アタッチにも使う
  detachAll(): void;                     // dispose 時（US-31）
}
```

- **責務**: 組み込み3つの `InputSource`（E4〜E6）と、`registerInputSource`（IF 確定済み）で追加されるカスタム `InputSource` を同一の `target`（コンテナ要素）・同一の `onIntent` コールバックで `attach` する。個々の `InputSource` の実装詳細（どのブラウザイベントを聴くか）には関与しない（NFR-02 の拡張性）。

### E3 `InputSource`（IF、再掲）

`component-methods.md` で確定済み。本ユニットでは変更しない。

```ts
interface InputSource {
  readonly id: string;
  attach(target: HTMLElement, emit: (intent: InputIntent) => void): void;
  detach(): void;
}
```

### E4 `PointerInputSource`（Q2, Q4, Q8）

- **pan/tilt**: `pointerdown`（主ボタンのみ、button===0）でドラッグ開始。`setPointerCapture` を用いて要素外に出てもドラッグ追跡を継続する（Q8）。`pointermove` ごとに前回位置との差分を `{ kind: 'pan', deltaPx }` / `{ kind: 'tilt', deltaPx }` として emit する（水平/垂直を分離、`component-methods.md` の `InputIntent` 例の kind 分離に合わせる）。`pointerup`/`pointercancel` でドラッグ終了。
- **zoom**: `wheel` を `{ passive: false }` で購読し `preventDefault()`（Q8）。`{ kind: 'zoom', mode: 'delta', value: event.deltaY }` を emit する（生値、Q4 の加算モデル向け）。
- **既定動作抑制**: `pointerdown`/`dragstart` で `preventDefault()` しテキスト選択を防止（Q8）。

### E5 `TouchInputSource`（Q2, Q4, Q8）

- **pan/tilt**: `touches.length === 1` のときのみドラッグとして扱う。`touchmove` ごとの差分を `PointerInputSource` と同じ `pan`/`tilt` intent 形式で emit する。
- **zoom（pinch）**: `touches.length === 2` のとき、2点間距離を毎 `touchmove` で計測し、前回距離に対する比率 `previousDistance / currentDistance` を `{ kind: 'zoom', mode: 'scale', value: ratio }` として emit する（Q4 の乗算モデル）。
- **既定動作抑制**: コンテナへ CSS `touch-action: none` を設定し、ブラウザのネイティブなパン/ズームジェスチャーと競合させない（Q8）。

### E6 `KeyboardInputSource`（Q6, Q7）

- コンテナに `tabindex="0"` を付与し、`keydown` はコンテナがフォーカスされている場合のみ処理する（Q8）。
- `Keymap`（E7）に登録されたキーが押されるたびに対応する `InputIntent` を emit する。押下中の連続移動（キーリピート）はブラウザのネイティブな `keydown` 連続発火にそのまま追従する（追加のタイマー等は持たない）。
- pan/tilt/zoom に対応するキーは、`PointerInputSource` と同じ intent 形式（`deltaPx` 相当）ではなく、1回の押下＝1ステップの固定量として emit する（例: `{ kind: 'pan', deltaPx: KEYBOARD_STEP_PX }`、符号はキー種別に応じる）。これによりドラッグ由来の intent と `ViewController` 側の処理経路を共通化できる（E1 は intent の発生源を区別しない）。

### E7 `Keymap`（Q6）

```ts
interface Keymap {
  panLeft: string[];
  panRight: string[];
  tiltUp: string[];
  tiltDown: string[];
  zoomIn: string[];
  zoomOut: string[];
  photoPrev: string[];
  photoNext: string[];
  toggleFullscreen: string[];
}
```

**既定値（Q6=A）**:

| アクション | 既定キー |
|---|---|
| panLeft / panRight | `ArrowLeft` / `ArrowRight` |
| tiltUp / tiltDown | `ArrowUp` / `ArrowDown` |
| zoomIn / zoomOut | `+`, `=` / `-` |
| photoPrev / photoNext | `PageUp` / `PageDown` |
| toggleFullscreen | `f` |

- `setKeymap(map: Partial<Keymap> | null): void`（IF 確定済み）: `null` は `KeyboardInputSource` 自体を無効化する（全キー処理を停止）。`Partial<Keymap>` は指定したアクションのキー列を既定値へマージ・上書きする。あるアクションを無効化したい場合は空配列 `[]` を指定する（US-19「変更・無効化」）。
- モード切替キー（`setMode` intent）は既定キーマップに含めない（Q6 採用理由）。`Keymap` にも項目を持たない。

### E8 `InputIntent`（判別共用体）

```ts
type InputIntent =
  | { kind: "pan"; deltaPx: number }
  | { kind: "tilt"; deltaPx: number }
  | { kind: "zoom"; mode: "delta"; value: number }   // wheel の生 deltaY
  | { kind: "zoom"; mode: "scale"; value: number }    // pinch の距離比（前回/今回）
  | { kind: "photoNext" }
  | { kind: "photoPrev" }
  | { kind: "toggleFullscreen" }
  | { kind: "setMode"; mode: ViewerModeId };
```

- **設計方針**: `InputSource` はブラウザ固有のイベントを「機構ごとの生の量」に正規化するところまでを担い、感度定数・fov 依存のスケーリング・クランプ（Q2/Q3/Q4/Q5 の計算式）は `ViewController`（E1）に一元化する。複数の `InputSource` 実装間で感度定数が重複・乖離するのを防ぐため。

### E9 `ViewerState`（拡張）

```ts
interface ViewerState {
  mode: ViewerModeId;
  ready: boolean;
  loadState: "idle" | "loading" | "ready" | "error";
  lastError: PerisphereError | null;
  imageLoadState: ImageLoadState;
  view: ViewState;   // 新規追加（C12 の責務「モード・視点・写真index・フルスクリーン・ロード状態」の「視点」部分）
}
```

`getView()` はこのフィールドを返す。ズーム上下限（明示設定の有無）は公開 API に対応するゲッターがない（`component-methods.md` に `getZoomLimits` は定義されていない）ため `ViewerState` には含めず、`ViewController`（E1）内部の非公開状態として保持する。

### E10 `ViewerMode`（拡張、発見・追記）

**経緯**: `setMode` はモード切替のたびに新モードの `apply(ctx)` を呼び、各モードは内部の既定値（例: `StandardMode` の `DEFAULT_VIEW = { yaw: 0, pitch: 0, fov: 75 }`）へ視点をリセットする（UoW-C BR-C-04）。UoW-D で `ViewController`（E1）が `ViewState` を一元管理するようになると、モード切替直後に「実際にカメラへ適用された既定ビュー」を `ViewController` 自身の状態にも反映しないと、`getView()` が古い値を返す・次のドラッグ操作が誤った基準値から計算される、という不整合が生じる。既存の7モードはいずれも `apply()` 内で `updateView(ctx, DEFAULT_VIEW)` を呼んでおり、その `DEFAULT_VIEW` はモジュール内部定数にとどまっている。これを `ViewerMode` IF の追加の任意フィールドとして公開する（`defaultZoomLimits?` と同種の後方互換な追加）。

```ts
interface ViewerMode {
  readonly id: ViewerModeId;
  readonly defaultZoomLimits?: ZoomLimits;
  readonly defaultView?: ViewState;   // 新規追加（省略時のフォールバックは BR-D-11 参照）
  apply(ctx: ModeContext): void;
  updateView(ctx: ModeContext, view: ViewState): void;
  dispose(ctx: ModeContext): void;
  disposeResources?(ctx: ModeContext): void;
}
```

既存7モード（`StandardMode` 含む）は、既に保持している `DEFAULT_VIEW` 定数をそのまま `readonly defaultView` として公開するだけで対応できる（Code Generation での機械的な追加）。
