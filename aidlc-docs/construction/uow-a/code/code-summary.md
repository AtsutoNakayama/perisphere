# Code Summary — UoW-A コア基盤

- **関連 Issue**: [#27](https://github.com/AtsutoNakayama/perisphere/issues/27)
- **作成日**: 2026-08-03
- **単一の情報源**: `aidlc-docs/construction/plans/uow-a-code-generation-plan.md`（全 Step 完了、実行結果・発見した問題と対応を記載）

## 1. 生成ファイル一覧

### 1-1. ワークスペース基盤（Greenfield 初回セットアップ）

| パス | 内容 |
|---|---|
| `pnpm-workspace.yaml` | ワークスペース定義（`packages/*`, `apps/*`）。pnpm 11 のサプライチェーン保護設定（`allowBuilds.esbuild`）を含む |
| `package.json`（ルート） | private workspace root。`build`/`test`/`lint` = `pnpm -r ...`。lint 用共有 devDependencies |
| `.nvmrc` | Node.js LTS（22系）固定 |
| `tsconfig.base.json` | `strict: true` 全面適用、target ES2020、`noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` 追加 |
| `eslint.config.js` | Flat Config。TypeScript 対応 + Prettier 競合ルール無効化 |
| `.prettierrc.json` / `.prettierignore` | フォーマット設定（`dist/` 等を除外） |
| `.gitignore` | `node_modules/`/`dist/`/`*.tsbuildinfo`/`coverage/` を追加 |

### 1-2. `packages/core`（`@perisphere/core`）

| パス | 内容 |
|---|---|
| `package.json` | `private: true`（未公開）。`peerDependencies.three` は広め range。devDependencies に技術スタック決定を反映 |
| `tsconfig.json` | `tsconfig.base.json` を extends |
| `tsup.config.ts` | ESM + `.d.ts` 出力、target es2020 |
| `vitest.config.ts` | jsdom 環境 |
| `.prettierignore` | `dist/` 除外 |

### 1-3. ビジネスロジック（`packages/core/src/viewer/`）

| ファイル | 対応エンティティ/コンポーネント | 概要 |
|---|---|---|
| `types.ts` | E4/E5/E11 他 | `ViewerModeId`/`ViewState`/`ZoomLimits`/`PerisphereError`/`ViewerEventMap`/`ViewerOptions`/`ViewerHandle` |
| `EventBus.ts` | E4 / L2 Observer | 型付き pub/sub。同期発火（BR-A-07）、ハンドラ例外隔離（BR-A-08） |
| `DisposableRegistry.ts` | E7 / L4 Registry | 登録順（FIFO）解体、冪等（BR-A-10） |
| `ViewerState.ts` | E5 | `createViewerState()` ファクトリ。プレーンオブジェクト |
| `ErrorManager.ts` | E6 | `PerisphereError` 正規化 + 状態反映 + `error` 発火（BR-A-13） |
| `ContextRecoveryState.ts` | L5 State Machine | `healthy/lost/recovering/degraded`（RP-2、BR-A-12） |
| `ModeContext.ts` | E10 | `camera`/`scene`/`sphereMesh` への参照 |
| `ViewerMode.ts` | E8（IF） / L3 Strategy | `id`/`defaultZoomLimits?`/`apply`/`updateView`/`dispose` |
| `StandardMode.ts` | E9 | 既定 yaw=0/pitch=0/fov=75、ズーム範囲 30〜90（BR-A-06） |
| `Renderer.ts` | E3 | Scene/PerspectiveCamera/WebGLRenderer/プレースホルダ球体メッシュ、単一描画ループ（PP-1/PP-3）、コンテキストロスト検出/復帰（RP-1〜3） |
| `createViewer.ts` | E1/E2/S1 | 多層防御初期化（SP-1）、成功/縮退パス（BR-A-01〜05）、`ViewerHandle` 構築、dispose 順序（BR-A-11）、`setMode` バリデーション（BR-A-17） |
| `index.ts` | 公開エントリ | `createViewer` + 公開型のみ re-export |

### 1-4. テスト（`packages/core/src/viewer/__tests__/`）

| ファイル | テスト対象 | 手法 |
|---|---|---|
| `EventBus.test.ts` | 同期発火順序・`off`/`once`・ハンドラ例外隔離 | example-based + fast-check（任意個数のハンドラ登録に対する不変条件） |
| `DisposableRegistry.test.ts` | FIFO 解体・`disposeAll()` 冪等性 | example-based + fast-check（任意回数の `disposeAll()` 呼び出しに対する不変条件） |
| `ContextRecoveryState.test.ts` | 状態遷移表の全パス・不正遷移の無視 | example-based |
| `StandardMode.test.ts` | 既定値・ズーム範囲・`updateView` の反映 | example-based |
| `createViewer.test.ts` | 初期化成功/縮退パス、`ready`/`error` のマイクロタスク遅延、`dispose()` 冪等性、`setMode` バリデーション、コンテキストロストコールバック、dispose 後の no-op+warn | example-based（`Renderer` を境界としてモック化） |

**テスト結果**: 5 ファイル・32 テスト全て pass（`pnpm -r test`）。

### 1-5. デプロイメント成果物

| パス | 内容 |
|---|---|
| `.github/workflows/ci.yml`（既存ファイルへ追加） | `lint`/`build`/`test` ジョブを追加（`test` ジョブに `pnpm audit --prod` を含む）。既存の `markdownlint`/`links` ジョブは変更なし |
| `.github/dependabot.yml`（新規） | `npm` + `github-actions`、weekly |

## 2. ストーリートレーサビリティ

| ストーリー | 対応箇所 | 状態 |
|---|---|---|
| US-06（既定の標準ビュー表示） | `StandardMode.ts`（既定値）、`createViewer.ts`（適用） | ✅ 実装済み |
| US-29（イベント API の購読） | `EventBus.ts`、`createViewer.ts`（`on`/`off`/`once` 委譲） | ✅ 実装済み |
| US-30（エラー処理とフォールバック表示） | `ErrorManager.ts`、`createViewer.ts`（縮退パス） | ✅ 実装済み |
| US-31（破棄 API によるリソース解放） | `DisposableRegistry.ts`、`Renderer.ts`/`createViewer.ts`（dispose 実装） | ✅ 実装済み |
| US-34（SSR セーフ） | `createViewer.ts`（環境ガード） | ✅ 実装済み |
| US-36（性能体感 8K/60fps） | `Renderer.ts`（単一描画ループ） | ⚠️ 単一ループの業務ルールのみ実装。詳細な性能チューニング（ピクセル比上限等）は対象外（NFR Design で明示的に見送り） |
| US-37（障害分離・縮退） | `ContextRecoveryState.ts`、`Renderer.ts`（コンテキストロスト処理） | ✅ 実装済み |

## 3. 既知の制約・スコープ境界（レビュー時の確認事項）

- **プレースホルダ球体メッシュのみ**: `Renderer` は無地マテリアルの球体メッシュを生成する。画像テクスチャの反映は UoW-B（`LoadingService`）統合後に行われる（BR-A-15）。「1 枚の画像を標準ビューで表示」という到達点は UoW-A + UoW-B の組み合わせで達成される。
- **標準モードのみ**: `ViewerModeId`/`setMode` は `'standard'` のみ有効。他モード（クリスタルボール等）は UoW-C 以降で追加される。
- **`ViewerHandle` は UoW-A 担当分のみ**: `loadImage`/`setView`/`next`/`enterFullscreen` 等は該当ユニットのマージ時に追加される。
- **実 WebGL 描画は自動テスト対象外**: jsdom は WebGL2 コンテキストを提供しないため、単体テストでは `Renderer` を境界としてモック化した（tech-stack-decisions.md §5）。実描画確認はブラウザでの手動確認、および将来の Build and Test / UoW-I デモサイトに委ねる。
- **npm 未公開**: `packages/core/package.json` は `private: true`。公開パイプラインは本ユニットのスコープ外（infrastructure-design.md §4）。

## 4. 計画からの主な逸脱と理由

`uow-a-code-generation-plan.md` の Step 7 実行結果セクションに記載（要旨）:

- `typescript` を計画時点で想定していた最新版から `5.9.3` に変更（tsup の `.d.ts` バンドルが TypeScript 7.x 系の内部 API 変更に未対応だったため、ビルドツールチェーンと互換性のある最新安定版に固定）。
- lint 用共有パッケージ（`@eslint/js` 等）をルート `package.json` にも追加（pnpm workspaces の非 hoisting 特性により、共有 `eslint.config.js` が置かれるルート自身が依存を保持する必要があったため）。

## 5. 検証結果

- `pnpm -r build`: green（tsup ESM + `.d.ts` 生成成功）
- `pnpm -r test`: green（32/32 テスト pass）
- `pnpm -r lint`: green（ESLint・Prettier とも問題なし）
- `pnpm audit --prod`: 既知の脆弱性なし

**注記**: これは開発時点での自己検証であり、正式な Build and Test ステージ（全ユニット共通の統合検証）を代替するものではない。
