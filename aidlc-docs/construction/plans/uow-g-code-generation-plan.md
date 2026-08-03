# Code Generation Plan — UoW-G 同梱コントロール UI

- **関連 Issue**: [#44](https://github.com/AtsutoNakayama/perisphere/issues/44)
- **作成日**: 2026-08-04
- **前提資料**: `construction/uow-g/functional-design/`（domain-entities.md〔E1〜E6〕/ business-rules.md〔BR-G-01〜15〕/ business-logic-model.md〔P1〜P10〕/ frontend-components.md）、`construction/uow-g/nfr-requirements/tech-stack-decisions.md`、`construction/uow-g/nfr-design/`（nfr-design-patterns.md〔RP-G-1, SP-G-1, SP-G-2, LC-G-1, LC-G-2〕/ logical-components.md〔L1〜L5〕）、`construction/uow-g/infrastructure-design/`（変更不要と確認済み）

**本ファイルは Code Generation の単一の情報源である。**

## ユニットコンテキスト

- **担当ストーリー**: US-26（表示/非表示・スタイル・ヘッドレス）、US-27（文言・aria-label 差し替え）、US-35（アクセシビリティ）。補足で US-24（サムネ/インジケーター表現）
- **依存ユニット**: UoW-A〜F（すべてマージ済み）
- **公開インターフェースの追加**: `ControlsVisibility`/`UITextMap`（新規公開型）、`ViewerOptions.controls`/`text`（新規）、`ViewerHandle.setControlsVisibility`/`setText`/`getPhotoCount`（新規、`setControlsVisibility`/`setText` は Inception `component-methods.md` で確定済みシグネチャ）、`ViewerEventMap.photochange` への `total: number` 追加
- **コード配置**: 新規ディレクトリ `packages/core/src/ui/`（`types.ts` / `controlsLogic.ts` / `ControlsUI.ts`、LC-G-1）。既存の `viewer/types.ts`/`viewer/createViewer.ts`/`index.ts` は既存ファイルの修正

### 実装上の設計判断（本ステージでの発見・確定）

- **`ControlsUI` は縮退ハンドル（WebGL2 非対応）でも構築する（UoW-F の先例を踏襲した発見）**: `ControlsUI` は DOM のみに依存し `Renderer`/WebGL に一切依存しない。UoW-F の `FullscreenManager` が縮退ハンドルでも実機能として提供されたのと同じ理由で、`ControlsUI` も `inBrowser`（真の SSR でない）かつ `options.controls !== false` であれば縮退ハンドルでも構築する。縮退ハンドルでは `modeSwitch`（`listModes()` が `["standard"]` のみ）・`photoNav`/`photoIndicator`（`getPhotoCount()` が `0`）が自動非表示（BR-G-04/05）になるため、実質的に「フルスクリーンボタンのみ表示される」縮退 UI として自然にフォールバックする。この分岐は Functional Design 時点では明示していなかったため `code-summary.md` に逸脱として記録する。
- **`getPhotoCount()` は既存の `Gallery.size` ゲッター（UoW-E で実装済み）にそのまま委譲できる**: 新規メソッドを `Gallery` に追加する必要はない。
- **`ControlsUI` への依存注入は `buildHandle` に渡す capability オブジェクト（`modeSwitching`/`interaction`/`gallery`/`fullscreen`）をそのまま再利用する**: `handle`（ガード付き公開 API）経由ではなく、`createViewer` 内部の生の関数群を直接束ねることで、`dispose()` 実行順序に伴う `guardDisposed` の影響を受けない（`ControlsUI.dispose()` が `deps.off(...)` を呼ぶ際に確実に解除されることを保証する）。

## Step 1: Project Structure Setup

**該当なし（スキップ）**。既存ワークスペース・`packages/core` 構成をそのまま使う。新規ディレクトリは `packages/core/src/ui/`（Step 2 内で作成）。

## Step 2: Business Logic Generation

- [x] 2-1. `packages/core/src/ui/types.ts`（新規）— `ControlsVisibility`（E2）、`UITextMap`（E3）、既定文言 `DEFAULT_UI_TEXT`
- [x] 2-2. `packages/core/src/ui/controlsLogic.ts`（新規、L2）— `computeEffectiveVisibility`（BR-G-04/05）、`resolveText`（BR-G-10）の純粋関数
- [x] 2-3. `packages/core/src/ui/ControlsUI.ts`（新規、L1）— `ControlsUIDeps` インターフェースと `ControlsUI` クラス（`frontend-components.md`/`business-logic-model.md` P1〜P9 の通り）:
  - 共有 `<style id="perisphere-controls-style">` の重複防止注入（BR-G-12）
  - Light DOM 構築（`.perisphere-controls` ルート + 各グループ、BR-G-01）。`data-testid`（`perisphere-controls-*`）付与（Automation Friendly Code Rules）
  - フルスクリーン/ズーム/モード切替/写真前後/写真インジケーターの各クリック/change ハンドラ（BR-G-06, BR-G-08, BR-G-09, BR-G-11, BR-G-14, RP-G-1）
  - `modechange`/`photochange`/`fullscreenchange` 購読による同期（`business-logic-model.md` P8）
  - `setVisibility`/`setText`/`dispose`（BR-G-02, BR-G-10, BR-G-13）。テキスト反映は `textContent`/`setAttribute` のみ（SP-G-1）
- [x] 2-4. `packages/core/src/gallery/types.ts`（既存修正なし、確認のみ）— `Gallery.size` ゲッターが既に写真総数を提供済みであることを確認（新規追加不要）
- [x] 2-5. `packages/core/src/viewer/types.ts`（既存修正）:
  - `PhotoChangeEvent` に `total: number` を追加（E6、BR-G-07）
  - `ViewerOptions` に `controls?: boolean | Partial<ControlsVisibility>` / `text?: Partial<UITextMap>` を追加（E4）
  - `ViewerHandle` に `setControlsVisibility(config: Partial<ControlsVisibility>): void` / `setText(overrides: Partial<UITextMap>): void` / `getPhotoCount(): number` を追加（E5、`component-methods.md` 確定済みシグネチャ）
- [x] 2-6. `packages/core/src/viewer/createViewer.ts`（既存修正、L4）:
  - `ControlsUI`（`../ui/ControlsUI.js`）を import
  - `GalleryCapability` に `getPhotoCount: () => number` を追加。正常系は `() => gallery.size`、縮退ハンドルは `() => 0`
  - `switchToPhoto` の `photochange` 発火に `total: gallery.size` を追加（BR-G-07）
  - `_options: ViewerOptions | undefined` を `options` に改名し実際に読む
  - `buildControlsUI(...)` ヘルパーを追加: `inBrowser` かつ `options?.controls !== false` の場合のみ `ControlsUIDeps` を組み立てて `ControlsUI` を構築し `disposables.register` する。正常系・縮退ハンドル系の両方の分岐から呼び出す（本ステージの発見）
  - `HandleDeps`/`buildHandle` に `controls: { setVisibility, setText }` capability を追加し、`controlsUI`（`ControlsUI | null`）が存在すれば委譲、なければ no-op（BR-G-15）
  - `ViewerHandle.getPhotoCount()` を `gallery.getPhotoCount()` に委譲する形で `buildHandle` の返り値へ追加
- [x] 2-7. `packages/core/src/index.ts`（既存修正）— `ControlsVisibility`/`UITextMap` を re-export に追加

## Step 3: Business Logic Unit Testing

- [x] 3-1. `packages/core/src/ui/__tests__/controlsLogic.test.ts`:
  - PBT（fast-check、`tech-stack-decisions.md` §2）: `computeEffectiveVisibility` の不変条件（`explicit.xxx === false` なら常に `false`、それ以外は `count > 1` と一致、`fullscreen`/`zoom` は `explicit` の値をそのまま反映）
  - PBT: `resolveText` の出力に `{current}`/`{total}` が残らないこと
- [x] 3-2. `packages/core/src/ui/__tests__/ControlsUI.test.ts`（jsdom、モック不要 — `ControlsUI` は標準 DOM API のみに依存）:
  - 各コントロールの初期表示・`data-testid` 存在確認
  - フルスクリーンボタンのクリックで `deps.enterFullscreen`/`exitFullscreen` が呼ばれ、`container.focus()` が呼ばれること（BR-G-11）
  - ズームボタンのクリックで `deps.setView` が `CONTROLS_ZOOM_RATIO` に基づく `fov` で呼ばれること（BR-G-14）
  - モード select の `pointerdown` で `listModes()` が再取得され option が再構築されること（BR-G-06）、`change` で `deps.setMode` が呼ばれること
  - 写真前後ボタン・インジケーターボタンのクリックで `deps.prev`/`next`/`goTo` が呼ばれること
  - `photochange`（`total` 変化）でインジケーターが再構築されること、`aria-current` が現在位置に付与されること
  - `modechange`/`photochange` 受信で `modeSwitch`/`photoNav`/`photoIndicator` の自動非表示が再評価されること（BR-G-04/05）
  - `setVisibility()`/`setText()` の反映（`hidden` 属性・`textContent`/`aria-label` の更新）
  - 共有 `<style>` タグの重複防止（`beforeEach`/`afterEach` で除去してから検証、`tech-stack-decisions.md` §1）
  - `dispose()` で DOM 要素が除去されイベント購読が解除されること
- [x] 3-3. `packages/core/src/viewer/__tests__/createViewer.controls.test.ts`（新規、既存 `MockRenderer` パターンを再利用）:
  - `options.controls` 省略時に `ControlsUI` が構築され `container` 配下に DOM が追加されること
  - `options.controls === false` でヘッドレス（DOM が追加されないこと、`setControlsVisibility`/`setText` が安全な no-op であること）
  - `getPhotoCount()` が `setPhotos()` 前後で正しい値を返すこと
  - `photochange` イベントに `total` が含まれること
  - 縮退ハンドル（WebGL2 非対応）でも `ControlsUI` が構築されること（フルスクリーンボタンのみ実質的に機能する構成、本ステージの発見）
- [x] 3-4. `packages/core/src/viewer/__tests__/createViewer.gallery.test.ts`（既存修正）— `photochange` の `toHaveBeenCalledWith` アサーションに `total` を追加（2箇所）

## Step 4: Business Logic Summary

- [x] 4-1. `aidlc-docs/construction/uow-g/code/code-summary.md`

## Step 5: Documentation Generation

- [x] 5-1. 新規公開 API（`ControlsVisibility`, `UITextMap`, `ViewerOptions.controls`/`text`, `setControlsVisibility`, `setText`, `getPhotoCount`）に TSDoc コメントを付与する（Step 2 実装と同時に付与）

## Step 6: Deployment Artifacts Generation

**該当なし（スキップ）**。`infrastructure-design.md` で確認済みの通り、CI/Dependabot への変更は不要。

## Step 7: ビルド・テストの実行確認

- [x] 7-1. `pnpm -r build` を実行し型エラー・ビルドエラーがないことを確認
- [x] 7-2. `pnpm -r test` を実行し全テスト（UoW-A〜F の既存分 + UoW-G 新規分）が green であることを確認
- [x] 7-3. `pnpm -r lint` を実行し lint エラーがないことを確認
- [x] 7-4. `pnpm audit --prod` で既知の脆弱性がないことを確認
- [x] 7-5. 問題が見つかった場合は該当コードを修正し、7-1〜7-4 を再実行する

**注記**: Step 7 は開発時点での自己検証であり、実際のブラウザでの動作確認は含まない。正式な Build and Test ステージ（全ユニット共通の統合検証）を代替するものではない。

## ストーリートレーサビリティ

| ストーリー | 対応箇所 |
|---|---|
| US-26（表示/非表示・スタイル・ヘッドレス） | Step 2-1〜2-3（`ControlsVisibility`/`ControlsUI`）、Step 2-6（`options.controls`/`setControlsVisibility` 結線） |
| US-27（文言・aria-label 差し替え） | Step 2-1, 2-3（`UITextMap`/`resolveText`/`setText`） |
| US-35（アクセシビリティ） | Step 2-3（ネイティブ `<button>`/`<select>`・ARIA・`container.focus()` 復帰） |
| US-24（サムネ/インジケーター表現、補足） | Step 2-3（写真インジケーターのボタン列） |

## 完了条件

- 上記 Step 2〜5、7 の全チェックボックスが `[x]`（Step 1・6 は該当なし）
- `pnpm -r build` / `pnpm -r test` / `pnpm -r lint` が green
- 生成コードが `business-rules.md`（BR-G-01〜15）・`nfr-design-patterns.md`（RP-G-1, SP-G-1, SP-G-2, LC-G-1, LC-G-2）・`logical-components.md`（L1〜L5）の決定と矛盾しない
- UoW-A〜F の既存テストが引き続き green（既存動作への回帰がないこと）
