# Business Rules — UoW-G 同梱コントロール UI

- **関連 Issue**: [#44](https://github.com/AtsutoNakayama/perisphere/issues/44)
- **作成日**: 2026-08-04
- **前提資料**: `uow-g-functional-design-plan.md`（Q1〜Q9 回答・採用理由）、`domain-entities.md`、UoW-A `business-rules.md`（BR-A-10 冪等性）、UoW-D `business-rules.md`（BR-D-17 コンテナフォーカス限定・BR-D-16 未実装機能への安全な無視）、UoW-E `business-rules.md`（BR-E-03 巡回・BR-E-04 未設定時の無視）、UoW-F `business-rules.md`（BR-F-07 Promise reject の握りつぶし・BR-F-08 dispose 時の確実な解放）

各ルールには **trace**（対応するストーリー/要件/計画質問）を付す。

## DOM 構造・スタイル分離

### BR-G-01 Light DOM + 名前空間クラスでの構築（Q1）

`ControlsUI` は Shadow DOM を使わず、`container` 配下に `<div class="perisphere-controls">` をルートとして追加する。内部要素は `perisphere-controls__*`（BEM 風）の命名規則を用いる。スタイルは通常の `<style>` 要素（BR-G-11）で定義し、呼び出し側は同じクラス名・CSS カスタムプロパティを上書きしてスタイルカスタマイズできる。

- **trace**: FR-14（スタイルカスタマイズ）, Q1=A

## 表示制御

### BR-G-02 `ControlsVisibility` の既定値とマージ規則（Q2）

`ViewerOptions.controls`（初期値）・`setControlsVisibility()`（動的変更）はいずれも `Partial<ControlsVisibility>` を受け取り、現在の設定へキー単位でマージする（`setZoomLimits`・`setText` と同じマージ方式）。未指定キーは `true`（表示）として扱う。`ViewerOptions.controls` が `boolean` の場合は `true`=全て`true`、`false`=BR-G-03（完全ヘッドレス）。

- **trace**: FR-14, US-26, Q2=A

### BR-G-03 完全ヘッドレス時は `ControlsUI` を構築しない（Q2）

`ViewerOptions.controls === false` の場合、`createViewer` は `ControlsUI`（`domain-entities.md` E1）を一切構築しない。DOM 要素・`<style>` 注入（BR-G-11）のいずれも発生しない。

- **trace**: FR-14（ヘッドレス利用）, Q2=A

### BR-G-04 `modeSwitch` の自動非表示（Q3・Q4）

`ControlsVisibility.modeSwitch` が `true`（既定含む）でも、`listModes().length <= 1` の間は `modeSwitch` コントロールを実際には非表示にする。この判定は (1) `ControlsUI` 構築時、(2) `modechange` イベント受信時、のたびに再評価する。`registerMode()`（UoW-C）自体はイベントを発火しないため（BR-G-06 参照）、「モードを登録してから実際にそのモードへ切り替える」という典型的な利用パターンにおいて、`setMode()` 呼び出しに伴う `modechange` 発火が再評価のトリガーとなる。モードを登録したが一度も切り替えなかった場合、`modeSwitch` は次回いずれかのモード変更が発火するまで非表示のままとなる既知の制約とする。

- **trace**: US-26（該当データなしでの UI ノイズ回避）, Q3=A, Q4=A

### BR-G-05 `photoNav`/`photoIndicator` の自動非表示（Q3）

`ControlsVisibility.photoNav`/`photoIndicator` が `true`（既定含む）でも、写真総数（`getPhotoCount()`）`<= 1` の間はそれぞれ実際には非表示にする。この判定は (1) `ControlsUI` 構築時、(2) `photochange` イベント受信時、のたびに再評価する。`photochange` は `setPhotos()` に非空の配列を渡した場合・`next()`/`prev()`/`goTo()` で実際に切り替わった場合に発火する（`business-logic-model.md` 参照）。**既知の制約**: 既に写真が設定された状態から `setPhotos([])` で空リストへ戻す操作は `photochange` を発火させないため（1枚目のロードが発生しないため）、この場合 `photoNav`/`photoIndicator` は直前の表示状態のまま残る。写真を「設定してから減らす」よりも「設定してから増やす／切り替える」利用が主眼であり、空リストへの明示的なクリアは本ステージのスコープ外の既知の制約として扱う。

- **trace**: US-24, US-26, Q3=A

## モード切替 UI

### BR-G-06 `<select>` の遅延構築（Q4）

モード切替 UI はネイティブ `<select>` 要素として実装する。`<option>` 一覧は `pointerdown`/`focus` イベント（ドロップダウンが開く直前）のたびに `listModes()` を再取得して再構築する。構築のたびに現在値（`getMode()`）を選択状態に反映する。`registerMode()` に対応する新規イベントは追加しない。

- **trace**: US-12（間接）, NFR-04, Q4=A

## 写真総数の公開

### BR-G-07 `getPhotoCount()`・`photochange.total` の追加（Q5）

`ViewerHandle.getPhotoCount()`（`domain-entities.md` E5）は `Gallery` が保持する写真配列の長さをそのまま返す（写真未設定なら `0`）。`ViewerEventMap.photochange`（E6）のペイロードに `total: number` を追加し、`switchToPhoto` が発火する際は常に現在の写真総数を含める。

- **trace**: US-24, Q5=A（`progress: { loaded, total }` と同じペイロード設計パターン）

## 写真ナビゲーション/インジケーター UI

### BR-G-08 インジケーターはボタン列として実装し実サムネイルは描画しない（Q6）

`photoIndicator` は写真枚数（`getPhotoCount()`）と同数のボタン列として構築する。各ボタンのクリックで対応する `index` へ `goTo()` を呼ぶ。現在表示中のインデックス（`getPhotoIndex()`）に対応するボタンには `aria-current="true"` を付与する。実画像（`<img>` によるサムネイルプレビュー）は本ユニットでは描画しない（元画像の縮小読み込みは UoW-E のオンデマンドロード方針・NFR-01 の性能方針に反するため）。

- **trace**: FR-12（受け入れ基準: 操作可能なインジケーター）, US-24, Q6=A

### BR-G-09 `photoNav`（前後ボタン）は常に有効（巡回動作の踏襲）

`photoNav` の前後ボタンは `next()`/`prev()`（UoW-E、末尾/先頭で巡回、BR-E-03）をそのまま呼び出す。境界での無効化（disabled）は行わない（巡回するため境界という概念がない）。

- **trace**: US-18, US-23

## 文言・aria-label

### BR-G-10 `UITextMap` のプレースホルダトークン置換（Q7）

`photoIndicatorItemLabel` 等、動的な値を含む文言は `{current}`/`{total}` トークンを本文中に含められる。`ControlsUI` は表示直前に単純な文字列置換（`String.prototype.replace` 相当）でトークンを実値に置き換える。未知のトークンはそのまま残す（エラーにしない）。

- **trace**: FR-15, NFR-04, Q7=A

## フォーカス管理

### BR-G-11 単発アクションボタン操作後の `container.focus()` 復帰（Q8）

フルスクリーン切替・ズームイン/アウト・写真前後・写真インジケーターの各ボタンは、クリックハンドラの末尾で `container.focus()` を呼び、フォーカスを `container` に戻す。モード切替 `<select>`（BR-G-06）は持続的なフォームコントロールのため対象外とし、標準どおり `<select>` 自身にフォーカスを残す。`KeyboardInputSource`（UoW-D `BR-D-17`）は `container` がフォーカスされているときのみキー入力を処理するため、この復帰によりボタン操作の直後もキーボードショートカットが引き続き機能する。

- **trace**: NFR-04（キーボードのみで主要操作が完結）, US-35, Q8=A

## スタイル注入・破棄

### BR-G-12 共有 `<style>` タグの重複防止（Q9）

`ControlsUI` 構築時、同一 `document` 内にまだ `<style id="perisphere-controls-style">` が存在しなければ一度だけ `document.head` に追加する。同一ページに複数のビューワーインスタンスが存在してもスタイル注入は1つに集約される。

- **trace**: NFR-08（被埋め込み方針）, Q9=A

### BR-G-13 `dispose()` 時のクリーンアップ範囲（Q9）

`ControlsUI.dispose()` は自身が構築した DOM 要素（ルート `<div class="perisphere-controls">` 以下）を `container` から除去し、`EventBus` への購読を解除する。共有 `<style>` タグ（BR-G-12）は他インスタンスが使用中の可能性があるため除去しない。`DisposableRegistry`（UoW-A）に登録され、`ViewerHandle.dispose()` から確実に呼ばれる。

- **trace**: NFR-10（SECURITY-15: 確実なリソース解放）, Q9=A

## ズーム操作

### BR-G-14 ズームボタンの倍率方式

ズームイン/アウトボタンは `getView().fov` を基準に固定比率（`CONTROLS_ZOOM_RATIO`）を乗算/除算した値を `setView({ fov: newFov })` で反映する。`setView()` は既存のクランプ処理（`viewMath.clampFov` と実効ズーム範囲、`BR-D-11`）をそのまま適用するため、`ControlsUI` 側で上下限判定を再実装する必要はない。倍率モデルはタッチのピンチズーム（`viewMath.applyZoomScale`、UoW-D）と同じ乗算方式を踏襲し、キーボード/ホイールの生 delta 方式（`applyZoomDelta`）とは独立した単純な実装とする。

- **trace**: US-13, US-20

## ヘッドレス時の安全性

### BR-G-15 `setControlsVisibility`/`setText` のヘッドレス時 no-op

`ControlsUI` が未構築（`ViewerOptions.controls === false`、BR-G-03）の場合、`ViewerHandle.setControlsVisibility()`/`setText()` はいずれも安全な no-op とする（UoW-A/UoW-F の縮退ハンドルと同じ「存在しない機能への呼び出しは静かに無視する」方針を踏襲）。

- **trace**: NFR-10（想定外呼び出しでも例外を投げない）
