# Frontend Components — UoW-G 同梱コントロール UI

- **関連 Issue**: [#44](https://github.com/AtsutoNakayama/perisphere/issues/44)
- **作成日**: 2026-08-04
- **前提資料**: `domain-entities.md`、`business-rules.md`、`business-logic-model.md`
- **注記**: `ControlsUI`（C10）は React 等のフレームワークを使わない素 DOM 実装（Q1=A）。本ドキュメントの「コンポーネント」は React コンポーネントではなく、`ControlsUI` が構築する DOM 要素の論理単位を指す。

## DOM 構成（コンポーネント階層）

```text
.perisphere-controls                          （ルート、role="toolbar"、BR-G-01）
├── .perisphere-controls__fullscreen           （<button>、visibility: fullscreen）
├── .perisphere-controls__zoom
│   ├── .perisphere-controls__zoom-in           （<button>、visibility: zoom）
│   └── .perisphere-controls__zoom-out          （<button>、visibility: zoom）
├── .perisphere-controls__mode                  （<select>、visibility: modeSwitch、BR-G-06）
├── .perisphere-controls__photo-nav
│   ├── .perisphere-controls__photo-prev        （<button>、visibility: photoNav）
│   └── .perisphere-controls__photo-next        （<button>、visibility: photoNav）
└── .perisphere-controls__photo-indicator       （<div role="tablist">、visibility: photoIndicator）
    └── .perisphere-controls__photo-indicator-item （<button role="tab"> × 写真総数、BR-G-08）
```

- ルート `.perisphere-controls` は `container`（`createViewer` の第1引数）の直下に追加される Light DOM 要素（BR-G-01）。`role="toolbar"` と `aria-label`（`UITextMap.controlsLabel`）を持つ。
- 各グループ（`.perisphere-controls__fullscreen` 等）は、対応する `ControlsVisibility` キーの実効表示可否（`business-logic-model.md` P2）に応じて `hidden` 属性の付け外しで表示/非表示を切り替える（DOM からの完全な着脱ではなく、再表示時に再構築コストがかからないようにする）。

## コンポーネント詳細

### `.perisphere-controls__fullscreen`

- **要素**: `<button type="button">`
- **props 相当（構築時に受け取る値）**: `ControlsUIDeps.isFullscreen`/`enterFullscreen`/`exitFullscreen`
- **状態**: 現在の `isFullscreen()` 値に応じて `aria-pressed` とラベル文言（`fullscreenEnterLabel`/`fullscreenExitLabel`）を切り替える
- **操作**: クリック → `business-logic-model.md` P3
- **同期元イベント**: `fullscreenchange`（P8）

### `.perisphere-controls__zoom-in` / `.perisphere-controls__zoom-out`

- **要素**: `<button type="button">` × 2
- **props 相当**: `ControlsUIDeps.getView`/`setView`
- **状態**: なし（常時有効。境界はクランプ側〔`setView`〕が吸収するため無効化制御は行わない）
- **操作**: クリック → `business-logic-model.md` P4
- **aria-label**: `zoomInLabel`/`zoomOutLabel`

### `.perisphere-controls__mode`

- **要素**: `<select>`
- **props 相当**: `ControlsUIDeps.getMode`/`setMode`/`listModes`
- **状態**: `<option>` 一覧（`listModes()` から遅延構築、BR-G-06）、選択中の値（`getMode()`）
- **操作**: `pointerdown`/`focus` → option 再構築、`change` → `business-logic-model.md` P5
- **aria-label**: `modeSwitchLabel`
- **自動非表示**: `listModes().length <= 1` で非表示（BR-G-04）

### `.perisphere-controls__photo-prev` / `.perisphere-controls__photo-next`

- **要素**: `<button type="button">` × 2
- **props 相当**: `ControlsUIDeps.prev`/`next`
- **状態**: なし（巡回のため境界の無効化なし、BR-G-09）
- **操作**: クリック → `business-logic-model.md` P6
- **aria-label**: `photoPrevLabel`/`photoNextLabel`
- **自動非表示**: `getPhotoCount() <= 1` で非表示（BR-G-05）

### `.perisphere-controls__photo-indicator`

- **要素**: `<div role="tablist">` を親に、写真総数分の `<button role="tab">` を子として持つ
- **props 相当**: `ControlsUIDeps.goTo`/`getPhotoIndex`/`getPhotoCount`
- **状態**: 総数が変わるたびに子ボタンを再構築（BR-G-08）。現在位置（`getPhotoIndex()`）に対応するボタンに `aria-current="true"`/`aria-selected="true"` を付与
- **操作**: 各ボタンのクリック → `business-logic-model.md` P7
- **aria-label**（各ボタン）: `photoIndicatorItemLabel` を `{current}`/`{total}` 置換して使用（BR-G-10）
- **自動非表示**: `getPhotoCount() <= 1` で非表示（BR-G-05）

## フォーカス管理（横断）

単発アクション系ボタン（フルスクリーン・ズーム・写真前後・インジケーター）はクリック後に `container.focus()` を呼び、`KeyboardInputSource`（UoW-D BR-D-17）によるキーボードショートカットの継続利用を妨げない（BR-G-11）。モード切替 `<select>` はこの対象外で、標準の `<select>` フォーカス挙動をそのまま用いる。すべてのインタラクティブ要素はネイティブの `<button>`/`<select>` を用いるため、Tab 順・Enter/Space での操作・スクリーンリーダーでの読み上げは追加実装なしにブラウザ標準の挙動に従う（NFR-04）。

## スタイルカスタマイズ

呼び出し側は `.perisphere-controls`/`.perisphere-controls__*` クラスに対する通常の CSS 上書きでスタイルをカスタマイズできる（BR-G-01）。既定スタイルは共有 `<style id="perisphere-controls-style">`（BR-G-12）で提供され、レイアウト（配置・間隔）と最小限の視認性（ボタンサイズ・コントラスト）のみを定義する。

## API 統合ポイント

`ControlsUI` が呼び出す `ViewerHandle` メンバー（`ControlsUIDeps`、`domain-entities.md` E1）と購読するイベントの対応は以下の通り。

| コンポーネント | 呼び出す API | 購読イベント |
|---|---|---|
| fullscreen | `isFullscreen`/`enterFullscreen`/`exitFullscreen` | `fullscreenchange` |
| zoom | `getView`/`setView` | なし |
| mode | `getMode`/`setMode`/`listModes` | `modechange` |
| photo-nav | `prev`/`next` | `photochange` |
| photo-indicator | `goTo`/`getPhotoIndex`/`getPhotoCount` | `photochange` |

`setControlsVisibility()`/`setText()`（`ViewerHandle`）はいずれのコンポーネントにも横断的に作用し、DOM の表示可否・文言を即座に再計算する（`business-logic-model.md` P9）。
