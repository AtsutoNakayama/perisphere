# Business Rules — UoW-F フルスクリーン

- **関連 Issue**: [#42](https://github.com/AtsutoNakayama/perisphere/issues/42)
- **作成日**: 2026-08-03
- **前提資料**: `uow-f-functional-design-plan.md`（Q1〜Q8 回答・採用理由）、`domain-entities.md`、UoW-A `business-rules.md`（BR-A-10 冪等性, BR-A-13 安全なエラーメッセージ）、UoW-B `business-rules.md`（BR-B-11 失敗時の表示維持）、UoW-D `business-rules.md`（BR-D-16 未実装機能への安全な無視）

各ルールには **trace**（対応するストーリー/要件/計画質問）を付す。

## フルスクリーン化する対象要素

### BR-F-01 `container` を対象としたフルスクリーン切替（Q1）

`enterFullscreen()`/`exitFullscreen()`（IF 確定済み）は、`createViewer` に渡された `container`（ビューワーの DOM コンテナ）を対象にフルスクリーン化する。`document.documentElement`（ページ全体）は対象にしない。

- **trace**: FR-10, Q1=A

## 非対応環境でのフォールバック

### BR-F-02 擬似フルスクリーンの実現方式（Q2）

`container.requestFullscreen` が関数として存在しない環境（iOS Safari 等）では、`enterFullscreen()` は `container` に `position: fixed; inset: 0; z-index: <十分大きい値>` 等のインラインスタイルを直接適用する「擬似フルスクリーン」にフォールバックする。適用前の `container.style.cssText` を保持しておき、`exitFullscreen()`（またはBR-F-06 の Esc キー）呼び出し時にそのまま復元する。この判定・適用はライブラリ内部で完結し、呼び出し側に追加の CSS 定義を要求しない。

- **trace**: FR-10（受け入れ基準: 非対応環境でのフォールバック）, US-22, Q2=A

### BR-F-03 対応環境ではネイティブ API を優先

`container.requestFullscreen` が存在する環境では、常にネイティブ Fullscreen API（BR-F-01 の対象要素に対する `requestFullscreen()`/`document.exitFullscreen()`）を使用する。擬似フルスクリーン（BR-F-02）はネイティブ API が存在しない場合のみのフォールバックであり、対応環境で選択的に擬似モードへ切り替えることはない。

- **trace**: FR-10, Q2=A

## ネイティブ Fullscreen API の実行時失敗

### BR-F-04 実行時失敗と `FULLSCREEN_FAILED`（Q4/Q6）

対応環境（`container.requestFullscreen` が存在する環境）で `requestFullscreen()`/`document.exitFullscreen()` が実行時に reject された場合（ユーザー操作起点でない呼び出し、Permissions Policy 制限等）、`error` イベント（`FULLSCREEN_FAILED`、`domain-entities.md` E3）を発火しつつ `enterFullscreen()`/`exitFullscreen()` の返す `Promise` を reject する。**擬似フルスクリーン（BR-F-02）へは自動的にフォールバックしない**。「非対応環境向けのフォールバック」と「対応環境での実行時エラー」は性質が異なるためであり、後者を擬似モードに倒すと呼び出し側にとって予期しない挙動の変化になる。

- **trace**: FR-10, Q4=A, Q6=A（UoW-B `BR-B-11` と対称的な「`error` 発火 + reject」パターン）

## 状態同期

### BR-F-05 `fullscreenchange`（DOM 標準イベント）への一本化（Q5）

ネイティブモードでの `mode`（`domain-entities.md` E2）の更新・`onChange` 呼び出し（→ `fullscreenchange` イベント発火・`ViewerState.isFullscreen` 更新）は、`FullscreenManager` 自身の `enter()`/`exit()` 呼び出しからではなく、`document` の標準 `fullscreenchange` イベント（`document.fullscreenElement === container` を判定）を検知した内部ハンドラからのみ行う。これにより、(1) 自ら `enterFullscreen()`/`exitFullscreen()` を呼んだ場合と、(2) Esc キーやブラウザ標準 UI など `FullscreenManager` の外側でネイティブフルスクリーンが開始/終了した場合の両方が、同じ1本のコードパスで正しく状態に反映される。擬似モード中はこのハンドラを無視する（擬似モードはネイティブの `fullscreenchange` を発生させないため）。

- **trace**: FR-10（状態変化の通知保証）, US-21, Q5=A

### BR-F-06 擬似フルスクリーン中の Esc キーでの解除（Q3）

擬似フルスクリーン（BR-F-02）がアクティブな間、`container` の `Escape` キー押下を検知する専用のリスナーを一時的に追加し、`exitFullscreen()` と同じ処理（スタイル復元・`onChange(false)`）を実行する。ネイティブモードでは追加のリスナーは設置せず、ブラウザ標準の Esc 挙動（BR-F-05 の `fullscreenchange` 経由で検知される）に委ねる。

- **trace**: US-21, US-22, Q3=A

## `InputIntent` との統合（UoW-D 拡張）

### BR-F-07 `toggleFullscreen` インテントの結線（UoW-D `BR-D-16` の解消）

`{ kind: "toggleFullscreen" }` intent 受信時、`createViewer` の intent ハンドラは UoW-D 時点の no-op（`BR-D-16` のコメント「UoW-F（フルスクリーン）が未実装のため安全に無視する」）を解消し、`isFullscreen()` が `false` なら `enterFullscreen()` を、`true` なら `exitFullscreen()` を呼ぶ。いずれも `Promise` の reject は握りつぶす（`.catch(() => {})`）。失敗時の `error` イベントは BR-F-04 により既に発火済みのため、ここで追加の通知は不要であり、キーボード操作起点の呼び出しで未処理の Promise rejection を発生させないためのガードに過ぎない。

- **trace**: US-21, UoW-D BR-D-16

## 破棄

### BR-F-08 `dispose()` 時のフルスクリーン自動解除（Q7）

`FullscreenManager` は `DisposableRegistry`（UoW-A）に登録される。ビューワーの `dispose()` 呼び出し時、フルスクリーン中（ネイティブ・擬似いずれも）であれば自動的に解除する。ネイティブモードでは `document.exitFullscreen()` を呼び出すが完了を待たない（`DisposeFn = () => void` という同期シグネチャに合わせた意図的な fire-and-forget。ブラウザ側の解除自体は非同期に進行する）。擬似モードではスタイル復元は同期的に完了する。いずれの場合も `document` の `fullscreenchange` リスナー・（擬似モード中の）`Escape` キーリスナーを解除する。

**fire-and-forget 呼び出しの未処理 rejection 対策（NFR Design Q1）**: `document.exitFullscreen()` の呼び出しには `.catch(() => {})` を付与し、reject されても静かに無視する（「Silent Best-Effort Cleanup」。`DisposableRegistry` の同期契約は変更しない。UoW-B `BR-B-08`〔中断されたロードは静かに reject される〕と同種の「関心のない失敗は握りつぶす」方針の継続）。

- **trace**: NFR-10（SECURITY-15: 確実なリソース解放）, Q7=A

## `Renderer` のリサイズ追従

### BR-F-09 フルスクリーン切替時の `Renderer.resize()` 呼び出し（Q8）

`FullscreenManager.onChange` コールバック（`domain-entities.md` E1）内で、`ViewerState.isFullscreen` の更新・`fullscreenchange` イベント発火に加えて `Renderer.resize()`（E7）を呼び出す。`Renderer` は初期化時にのみキャンバスサイズを設定し以後のコンテナサイズ変化に追従しないため（本ステージで発見したギャップ）、フルスクリーン切替の前後でこの呼び出しがないと「フルスクリーン化したがキャンバスは元のサイズのまま」という破綻した表示になる。フルスクリーンと無関係な任意タイミングでのコンテナリサイズへの汎用追従（`ResizeObserver` 等）は本ユニットのスコープ外（Q8=A、別課題）。

- **trace**: FR-10, Q8=A
