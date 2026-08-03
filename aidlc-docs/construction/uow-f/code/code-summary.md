# Code Summary — UoW-F フルスクリーン

- **関連 Issue**: [#42](https://github.com/AtsutoNakayama/perisphere/issues/42)
- **作成日**: 2026-08-03
- **単一の情報源**: `aidlc-docs/construction/plans/uow-f-code-generation-plan.md`（全 Step 完了、計画からの逸脱を記載）

## 1. 生成・修正ファイル一覧

### 1-1. 新規ファイル（`packages/core/src/fullscreen/`）

| パス | 内容 |
|---|---|
| `types.ts` | `FullscreenMode`（`"none" \| "native" \| "pseudo"`、E2） |
| `FullscreenManager.ts` | `FullscreenManager` クラス（E1/L1）: `enter`/`exit`/`isActive`/`dispose`。ネイティブモードの状態遷移は `document` の `fullscreenchange` イベントに一本化（BR-F-05/RP-F-2）。非対応環境ではインラインスタイル方式の擬似フルスクリーンにフォールバック（BR-F-02）、擬似モード中は `document` への `Escape` キーリスナーで解除（BR-F-06）。`dispose()` の fire-and-forget `document.exitFullscreen()` は `.catch(() => {})` で失敗を握りつぶす（RP-F-1） |

### 1-2. 既存ファイルの修正（UoW-A〜E マージ済みコードへの拡張）

| パス | 変更内容 |
|---|---|
| `viewer/types.ts` | `PerisphereErrorCode` に `FULLSCREEN_FAILED` 追加（E3）、`FullscreenChangeEvent` 追加・`ViewerEventMap.fullscreenchange` 追加（E5）、`ViewerState.isFullscreen: boolean` 追加（E4）、`ViewerHandle` に `enterFullscreen`/`exitFullscreen`/`isFullscreen` 追加（`component-methods.md` 確定済みシグネチャの初実装、E6） |
| `viewer/ViewerState.ts` | `createViewerState()` に `isFullscreen: false` を追加 |
| `viewer/Renderer.ts` | `resize(): void` を追加（E7、BR-F-09）。`container.clientWidth`/`clientHeight` を読み直し `camera.aspect`/`updateProjectionMatrix()`/`webglRenderer.setSize()` を実行 |
| `viewer/createViewer.ts` | `isBrowserEnvironment()` の結果を `inBrowser` として WebGL2 可否（`supported`）とは独立に保持。`inBrowser` のときのみ `FullscreenManager` を構築し、`onChange` で `state.isFullscreen` 更新 → `fullscreenchange` 発火 → `activeRenderer?.resize()`（BR-F-09）。`enterFullscreen()`/`exitFullscreen()`/`isFullscreen()` を実装し、ネイティブ API の実行時失敗は `error(FULLSCREEN_FAILED)` 発火 + reject（BR-F-04）。`handleInputIntent` の `toggleFullscreen`（UoW-D 時点は no-op、`BR-D-16`）を `isFullscreen()` に応じた `enterFullscreen`/`exitFullscreen` 呼び出しへ結線（BR-F-07）。`buildHandle`/`HandleDeps` へ `fullscreen` capability を追加。**縮退ハンドル（WebGL2 非対応）でも `interaction`/`gallery` とは異なり実機能をそのまま渡す**（下記「4. 計画からの主な逸脱」参照） |
| `index.ts` | 新規公開型（`FullscreenChangeEvent`）を re-export に追加 |
| `viewer/__tests__/createViewer.test.ts`/`createViewer.loadImage.test.ts`/`createViewer.interaction.test.ts`/`createViewer.setMode.test.ts`/`createViewer.gallery.test.ts` | 各 `MockRenderer` に `resize = vi.fn()` を追加（`createViewer.ts` から無条件に参照されるため） |
| `viewer/__tests__/createViewer.interaction.test.ts` | UoW-E 時点で残っていた `toggleFullscreen` の「安全に無視される（BR-D-16）」テストを削除（本ユニットで実際に結線されたため、`createViewer.fullscreen.test.ts` 側の新しい挙動検証に置き換え） |

### 1-3. テスト（新規）

| ファイル | テスト対象 | 手法 |
|---|---|---|
| `fullscreen/__tests__/FullscreenManager.test.ts` | ネイティブ/擬似双方の `enter`/`exit`/冪等性/失敗時の reject/外部要因（Esc・ブラウザ標準 UI）による状態同期/`dispose()` の解除・fire-and-forget失敗の握りつぶし | example-based + fast-check（PBT: `enter()`/`exit()` の任意呼び出し列に対する `isActive()` の整合性、ネイティブ・擬似双方、`tech-stack-decisions.md` §2） |
| `viewer/__tests__/createViewer.fullscreen.test.ts` | `enterFullscreen`/`exitFullscreen`/`isFullscreen`/`fullscreenchange` 発火、`renderer.resize()` 呼び出し、失敗時の `error(FULLSCREEN_FAILED)`、外部要因での状態反映、`toggleFullscreen` インテント結線、縮退ハンドルでの実機能動作 | example-based（`Renderer` を UoW-A 以来の方針でモック化。`FullscreenManager` はモックせず実装のまま使用し、`container.requestFullscreen`/`document.exitFullscreen` のみをテストごとにスタブ） |

**テスト結果**: 28 ファイル・266 テスト全て pass（UoW-A〜E の既存 241 件を含む、回帰なし。UoW-F 新規・拡張分 25 件）。

## 2. ストーリートレーサビリティ

| ストーリー | 対応箇所 | 状態 |
|---|---|---|
| US-21（フルスクリーン切替 API とイベント。UI は UoW-G） | `FullscreenManager` + `createViewer` の `enterFullscreen`/`exitFullscreen`/`isFullscreen`/`fullscreenchange`、`toggleFullscreen` インテント結線（BR-F-07、UoW-D `BR-D-16` の解消） | ✅ 実装済み |
| US-22（非対応環境でのフォールバック） | `FullscreenManager` の `enterPseudo`/`exitPseudo`（BR-F-02） | ✅ 実装済み |

## 3. 既知の制約・スコープ境界（レビュー時の確認事項）

- **フルスクリーンボタン等の同梱 UI は対象外**: `enterFullscreen`/`exitFullscreen`/`isFullscreen` という API・状態管理までが本ユニットの責務。実際の UI（ボタン・aria-label）は UoW-G の範囲。
- **汎用的なコンテナリサイズ追従（`ResizeObserver` 等）は対象外**（`nfr-design-patterns.md` LC-F-2 の裏返し、`business-rules.md` BR-F-09）: `Renderer.resize()` はフルスクリーン切替の前後でのみ呼ばれる。フルスクリーンと無関係な任意タイミングでのコンテナサイズ変化には追従しない。
- **実ブラウザでの操作感確認は未実施**: 擬似フルスクリーンの見た目・Esc キーでの解除・実際の "f" キー操作を含む一連の体験は、UoW-D/UoW-E と同様ブラウザでの手動確認が必要。

## 4. 計画からの主な逸脱と理由

1. **フルスクリーンは縮退ハンドル（WebGL2 非対応）でも実機能とした**（Functional Design 時点では明示していなかった設計判断、Code Generation 計画時点で発見）: `interaction`/`gallery` capability が縮退ハンドルで安全な no-op になるのは「反映先の `Renderer` が存在しないため」（`BR-B-13` 等）だが、`FullscreenManager` は `container`（DOM 要素）と `document` のみに依存し `Renderer`/WebGL に一切依存しない。したがって WebGL2 非対応でも実ブラウザである限り `enterFullscreen`/`exitFullscreen`/`isFullscreen` を実機能として提供する設計とした。**真の SSR**（`window`/`document` 自体が存在しない環境）でのみ、既存の `isBrowserEnvironment()` 判定を `supported`（WebGL2 可否）とは独立に再利用し、`FullscreenManager` を構築せず安全な no-op とする。`createViewer.fullscreen.test.ts` の「縮退ハンドルでも実機能として動作する」テストで検証済み。
2. **`Renderer.resize()` に独立ユニットテストを追加しなかった**（NFR Requirements Q4 の前提を Code Generation 時点で訂正）: NFR Requirements では「既存の `Renderer` テスト境界（WebGL2 コンテキストのモック）を再利用する」と決定していたが、実際に `Renderer.test.ts` を調査した結果、`Renderer` クラス自体は `WebGLRenderer` の実構築を要し jsdom で生成できないため直接テストされておらず、`applySphereTexture`（純粋関数として切り出し済み）のみが直接テストされていることが判明した。`Renderer` クラス本体は各 `createViewer.*.test.ts` の `vi.mock("../Renderer.js", ...)` によるモック（`MockRenderer`）を通じてのみ間接的に検証される既存方針だったため、新設した `resize()` も同じ境界に従い、5つの既存 `MockRenderer` に `resize: vi.fn()` を追加し、新規 `createViewer.fullscreen.test.ts` で `resize` が呼ばれることを検証する方式に変更した。

## 5. 検証結果

- `pnpm -r build`: green（tsup ESM + `.d.ts` 生成成功）
- `pnpm -r test`: green（28 ファイル・266 テスト pass、UoW-A〜E の既存 241 件を含め回帰なし）
- `pnpm -r lint`: green（実装時に検出した PBT テスト内の `no-useless-assignment` 2件〔ループ内の中間変数を `op === "enter"` の直接比較へ整理〕を修正済み）
- `pnpm audit --prod`: 既知の脆弱性なし
