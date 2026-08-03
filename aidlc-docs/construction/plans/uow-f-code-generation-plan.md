# Code Generation Plan — UoW-F フルスクリーン

- **関連 Issue**: [#42](https://github.com/AtsutoNakayama/perisphere/issues/42)
- **作成日**: 2026-08-03
- **前提資料**: `construction/uow-f/functional-design/`（domain-entities.md〔E1〜E7〕/ business-rules.md〔BR-F-01〜09〕/ business-logic-model.md〔P1〜P6〕）、`construction/uow-f/nfr-requirements/tech-stack-decisions.md`、`construction/uow-f/nfr-design/`（nfr-design-patterns.md〔RP-F-1, RP-F-2, SP-F-1〕/ logical-components.md〔L1〜L5〕）、`construction/uow-f/infrastructure-design/`（変更不要と確認済み）

**本ファイルは Code Generation の単一の情報源である。**

## ユニットコンテキスト

- **担当ストーリー**: US-21（API・状態管理のみ、UI は UoW-G）、US-22（非対応環境フォールバック）
- **依存ユニット**: UoW-A（マージ済み）
- **公開インターフェースの追加**: `ViewerHandle.enterFullscreen`/`exitFullscreen`/`isFullscreen`（Inception `component-methods.md` で確定済み、本ユニットで初実装）、`ViewerEventMap.fullscreenchange`、`PerisphereErrorCode.FULLSCREEN_FAILED`（新規）
- **コード配置**: 新規ディレクトリ `packages/core/src/fullscreen/`（`gallery/`/`loader/`/`modes/`/`interaction/` と並ぶユニット単位のディレクトリ構成、NFR Design LC-F-1）。既存の `viewer/types.ts`/`viewer/ViewerState.ts`/`viewer/Renderer.ts`/`viewer/createViewer.ts`/`index.ts` は既存ファイルの修正

### 実装上の設計判断（本ステージでの発見・確定）

- **フルスクリーンは縮退ハンドル（WebGL2 非対応）でも実機能とする（計画からの発見）**: `interaction`/`gallery` capability が縮退ハンドルで安全な no-op になる理由は「反映先の `Renderer` が存在しないため」（`BR-B-13` 等）だが、`FullscreenManager`（E1）は `container`（DOM 要素）と `document` のみに依存し `Renderer`/WebGL に一切依存しない。したがって WebGL2 非対応でも実ブラウザである限り `enterFullscreen`/`exitFullscreen`/`isFullscreen` は実機能として提供する。**真の SSR（`window`/`document` 自体が存在しない環境）でのみ**安全な no-op とする（`isBrowserEnvironment()` の判定を再利用し、`supported`〔WebGL2 可否〕とは独立に分岐する）。この分岐は Functional Design 時点では明示していなかったため、`code-summary.md` に逸脱として記録する。
- **`Renderer` クラス自体は直接ユニットテストされない（NFR Requirements Q4 の前提の訂正）**: `Renderer.test.ts` の調査の結果、`Renderer` 本体は `WebGLRenderer` の実構築を要し jsdom で生成できないため直接テストされておらず、`applySphereTexture`（純粋関数として切り出し済み）のみが直接テストされている。`Renderer` クラス自体は各 `createViewer.*.test.ts` の `vi.mock("../Renderer.js", ...)` によるモック（`MockRenderer`）を通じてのみ間接的に検証される。新設する `resize()` も同じ境界に従い、独立ユニットテストは追加せず、5つの既存 `MockRenderer` に `resize: vi.fn()` を追加し、新規 `createViewer.fullscreen.test.ts` で `resize` が呼ばれることを検証する。NFR Requirements Q4 で「既存の `Renderer` テスト境界（WebGL2 コンテキストのモック）を再利用する」とした判断は、実際には「`Renderer` は `createViewer` テストの中で `vi.mock` によりモック化される」という境界だったため、本ステージで訂正する。

## Step 1: Project Structure Setup

**該当なし（スキップ）**。既存ワークスペース・`packages/core` 構成をそのまま使う。新規ディレクトリは `packages/core/src/fullscreen/`（Step 2 内で作成）。

## Step 2: Business Logic Generation

- [x] 2-1. `packages/core/src/fullscreen/types.ts`（新規）— `FullscreenMode`（E2、`"none" | "native" | "pseudo"`）
- [x] 2-2. `packages/core/src/fullscreen/FullscreenManager.ts`（新規）— `FullscreenManager` クラス（E1/L1、logical-components.md の擬似コード通り）:
  - `constructor(container, onChange)`: `document` の `fullscreenchange` を購読（RP-F-2）
  - `isActive()`: `mode !== "none"`
  - `enter()`: 冪等（BR-F-01）。`container.requestFullscreen` があれば試行（失敗時はそのまま reject、BR-F-04）。なければ擬似フルスクリーン（`enterPseudo`、BR-F-02）
  - `exit()`: 冪等。擬似モードは同期的に復元、ネイティブモードは `document.exitFullscreen()`（失敗時はそのまま reject）
  - `dispose()`: ネイティブモードは `document.exitFullscreen().catch(() => {})`（RP-F-1）、擬似モードは同期復元。リスナー解除
  - `enterPseudo`/`exitPseudo`（プライベート）: `container.style` の `position`/`top`/`right`/`bottom`/`left`/`zIndex` を直接操作し保存・復元（BR-F-02）。擬似モード中のみ `document` に `keydown`（`Escape`）リスナーを追加/削除（BR-F-06、確実に捕捉するため `container` ではなく `document` に付与するよう Functional Design の記述を補足）
  - `handleNativeChange`（プライベート、`fullscreenchange` ハンドラ）: 擬似モード中は無視。`document.fullscreenElement === container` で `mode`/`onChange` を一本化して更新（BR-F-05）
- [x] 2-3. `packages/core/src/viewer/types.ts`（既存修正）:
  - `PerisphereErrorCode` に `"FULLSCREEN_FAILED"` を追加（E3）
  - `FullscreenChangeEvent`（`{ type: "fullscreenchange"; active: boolean }`）を追加し `ViewerEventMap.fullscreenchange` へ追加（E5）
  - `ViewerState.isFullscreen: boolean` を追加（E4）
  - `ViewerHandle` に `enterFullscreen(): Promise<void>` / `exitFullscreen(): Promise<void>` / `isFullscreen(): boolean` を追加（`component-methods.md` 確定済みシグネチャ、E6）
- [x] 2-4. `packages/core/src/viewer/ViewerState.ts`（既存修正）— `createViewerState()` の戻り値に `isFullscreen: false` を追加
- [x] 2-5. `packages/core/src/viewer/Renderer.ts`（既存修正、L4）— `resize(): void` を追加（`container.clientWidth`/`clientHeight` を読み直し `camera.aspect`/`updateProjectionMatrix()`/`webglRenderer.setSize()`。BR-F-09）
- [x] 2-6. `packages/core/src/viewer/createViewer.ts`（既存修正、L3）:
  - `FullscreenManager`（`../fullscreen/FullscreenManager.js`）を import
  - `isBrowserEnvironment()` の結果を `inBrowser` として保持し、`supported`（WebGL2 可否）とは独立に使う
  - `disposables` 構築直後、`if (!supported)` 分岐より前に、`activeRenderer: Renderer | null = null`（フルスクリーン切替時のリサイズ用）と `fullscreenManager`（`inBrowser` のときのみ構築、真の SSR では `null`）を宣言する。`onChange` コールバックで `state.isFullscreen` 更新 → `fullscreenchange` 発火 → `activeRenderer?.resize()`（BR-F-09）
  - `fullscreenManager` があれば `disposables.register(() => fullscreenManager.dispose())`
  - `enterFullscreen()`/`exitFullscreen()`（async 関数）: `fullscreenManager` が `null`（真の SSR）なら安全に no-op で解決。それ以外は `fullscreenManager.enter()`/`exit()` を試行し、失敗（reject）したら `error(FULLSCREEN_FAILED)` を発火しつつ reject（BR-F-04）
  - `isFullscreen()`: `fullscreenManager?.isActive() ?? false`
  - `supported` 分岐（Renderer 構築後）で `activeRenderer = renderer;` を設定
  - `handleInputIntent` の `toggleFullscreen` ケース（UoW-D 時点は no-op、`BR-D-16`）を `(isFullscreen() ? exitFullscreen() : enterFullscreen()).catch(() => {})` へ差し替える（BR-F-07）
  - `buildHandle`/`HandleDeps` に新しい `fullscreen` capability（`{ enterFullscreen, exitFullscreen, isFullscreen }`）を追加。**縮退ハンドル（WebGL2 非対応）でも同じ実装をそのまま渡す**（本ステージの発見の通り、`interaction`/`gallery` とは異なり Renderer 非依存のため no-op にしない）
- [x] 2-7. `packages/core/src/index.ts`（既存修正）— 新規公開型（`FullscreenChangeEvent`）を re-export に追加

## Step 3: Business Logic Unit Testing

- [x] 3-1. `packages/core/src/fullscreen/__tests__/FullscreenManager.test.ts`:
  - PBT（fast-check、`tech-stack-decisions.md` §2）: `enter()`/`exit()`/外部要因（`fullscreenchange` 模擬）の任意の呼び出し列に対し `isActive()` が内部状態と常に一致すること、`enter()` の連続呼び出しが冪等であること
  - example-based（対応環境、`vi.fn()` でスタブ）: ネイティブ `enter()`/`exit()` の成功、失敗（reject）時に `FullscreenManager` 自体はそのまま reject する（`error` 発火はしない、それは呼び出し元の責務）こと、Esc キー等の外部要因による `fullscreenchange` で `onChange` が呼ばれること
  - example-based（非対応環境、jsdom 既定＝`requestFullscreen` なし）: `enter()` が擬似フルスクリーン（スタイル適用）にフォールバックすること、`exit()` でスタイルが復元されること、擬似モード中の `Escape` キーで解除されること（BR-F-06）
  - `dispose()`: ネイティブモード・擬似モードそれぞれで解除処理が行われ、リスナーが解除されること（以後の外部 `fullscreenchange` で `onChange` が呼ばれないこと）
- [x] 3-2. `packages/core/src/viewer/__tests__/createViewer.fullscreen.test.ts`（新規、`createViewer.gallery.test.ts` と同じ `MockRenderer` パターンを再利用、`resize: vi.fn()` を追加）:
  - `enterFullscreen()`/`exitFullscreen()`/`isFullscreen()` の基本動作（対応環境スタブ）
  - 失敗時に `error(FULLSCREEN_FAILED)` が発火し reject されること（BR-F-04）
  - `fullscreenchange` イベントが発火し `renderer.resize()` が呼ばれること（BR-F-09）
  - 縮退ハンドル（WebGL2 非対応）でも `enterFullscreen`/`exitFullscreen`/`isFullscreen` が実機能として動作すること（本ステージの発見）
  - `toggleFullscreen` インテントが `isFullscreen()` に応じて `enterFullscreen`/`exitFullscreen` を呼ぶこと（BR-F-07）
- [x] 3-3. 既存 `MockRenderer`（`createViewer.test.ts`/`createViewer.loadImage.test.ts`/`createViewer.interaction.test.ts`/`createViewer.setMode.test.ts`/`createViewer.gallery.test.ts`）に `resize = vi.fn()` を追加（`createViewer.ts` から無条件に参照されうるため）
- [x] 3-4. `packages/core/src/viewer/__tests__/createViewer.interaction.test.ts`（既存修正）— `toggleFullscreen` の「安全に無視される（BR-D-16）」テストを削除し、Step 3-2 側の新しい挙動検証に置き換える

## Step 4: Business Logic Summary

- [x] 4-1. `aidlc-docs/construction/uow-f/code/code-summary.md`

## Step 5: Documentation Generation

- [x] 5-1. 新規公開 API（`enterFullscreen`, `exitFullscreen`, `isFullscreen`, `fullscreenchange`, `FULLSCREEN_FAILED`）に TSDoc コメントを付与する（Step 2 実装と同時に付与）

## Step 6: Deployment Artifacts Generation

**該当なし（スキップ）**。`infrastructure-design.md` で確認済みの通り、CI/Dependabot への変更は不要。

## Step 7: ビルド・テストの実行確認

- [x] 7-1. `pnpm -r build` を実行し型エラー・ビルドエラーがないことを確認
- [x] 7-2. `pnpm -r test` を実行し全テスト（UoW-A〜E の既存分 + UoW-F 新規分）が green であることを確認
- [x] 7-3. `pnpm -r lint` を実行し lint エラーがないことを確認
- [x] 7-4. `pnpm audit --prod` で既知の脆弱性がないことを確認
- [x] 7-5. 問題が見つかった場合は該当コードを修正し、7-1〜7-4 を再実行する

**注記**: Step 7 は開発時点での自己検証であり、実際のブラウザでの動作確認は含まない。正式な Build and Test ステージ（全ユニット共通の統合検証）を代替するものではない。

## ストーリートレーサビリティ

| ストーリー | 対応箇所 |
|---|---|
| US-21（フルスクリーン切替 API とイベント。UI は UoW-G） | Step 2-2（`FullscreenManager`）、Step 2-6（`createViewer` 統合: `enterFullscreen`/`exitFullscreen`/`isFullscreen`/`fullscreenchange`/`toggleFullscreen` intent 結線） |
| US-22（非対応環境でのフォールバック） | Step 2-2（`enterPseudo`/`exitPseudo`、擬似フルスクリーン） |

## 完了条件

- 上記 Step 2〜5、7 の全チェックボックスが `[x]`（Step 1・6 は該当なし）
- `pnpm -r build` / `pnpm -r test` / `pnpm -r lint` が green
- 生成コードが `business-rules.md`（BR-F-01〜09）・`nfr-design-patterns.md`（RP-F-1, RP-F-2, SP-F-1）・`logical-components.md`（L1〜L5）の決定と矛盾しない
- UoW-A〜E の既存テストが引き続き green（既存動作への回帰がないこと）
