# Code Generation Plan — UoW-A コア基盤

- **関連 Issue**: [#27](https://github.com/AtsutoNakayama/perisphere/issues/27)
- **作成日**: 2026-08-03
- **前提資料**: `construction/uow-a/functional-design/`（domain-entities.md / business-rules.md / business-logic-model.md）、`construction/uow-a/nfr-requirements/tech-stack-decisions.md`、`construction/uow-a/nfr-design/`（nfr-design-patterns.md / logical-components.md）、`construction/uow-a/infrastructure-design/`

**本ファイルは Code Generation の単一の情報源（single source of truth）である。以下のステップを上から順に実行する。**

## ユニットコンテキスト

- **担当ストーリー**: US-06, US-29, US-30, US-31, US-34, US-36, US-37
- **依存ユニット**: なし（UoW-A は依存関係 DAG の根）
- **公開インターフェース**: `createViewer(container, options?)` → `ViewerHandle`（`on/off/once`・`getMode`/`setMode`〔`'standard'`のみ〕・`dispose`。他のメソッドは後続ユニットが追加）
- **コード配置**: `unit-of-work.md` のコード構成戦略に従い `packages/core/src/viewer/` 配下（ワークスペース初回のためルート設定一式も本ステップで作成）

## Step 1: Project Structure Setup（greenfield）

- [x] 1-1. `pnpm-workspace.yaml`（`packages/*`, `apps/*`）
- [x] 1-2. ルート `package.json`（private workspace root、`scripts.build/test/lint` = `pnpm -r ...`、`packageManager` フィールド）
- [x] 1-3. `.nvmrc`（Node.js LTS メジャーバージョン固定）
- [x] 1-4. `tsconfig.base.json`（`strict: true` 全面適用、target ES2020、NFR Requirements Q7/Q10）
- [x] 1-5. `eslint.config.js`（Flat Config、TypeScript 対応）+ `.prettierrc.json`
- [x] 1-6. `.gitignore` 更新（`node_modules/`, `dist/`, `*.tsbuildinfo` 等を追加）
- [x] 1-7. `packages/core/package.json`（`@perisphere/core`、`private: true`〔Infrastructure Design Q5=A: 未公開〕、`peerDependencies.three` は広めの range、`devDependencies`: three/typescript/vitest/fast-check/tsup/eslint/prettier 等）
- [x] 1-8. `packages/core/tsconfig.json`（`tsconfig.base.json` を extends）
- [x] 1-9. `packages/core/tsup.config.ts`（ESM + `.d.ts` 出力、ES2020 ターゲット）
- [x] 1-10. `packages/core/vitest.config.ts`（jsdom 環境）

## Step 2: Business Logic Generation

`domain-entities.md`（E1〜E11）・`nfr-design-patterns.md`・`logical-components.md`（L1〜L7）に基づき実装する。

- [x] 2-1. `packages/core/src/viewer/types.ts` — `ViewerModeId`（`'standard'` のみ、E5/BR-A-14）、`ViewState`、`ZoomLimits`、`PerisphereError`（E11）、`ViewerEventMap`（`ready`/`error`/`modechange` のみ、E4）、`ViewerOptions`、`ViewerHandle`（E2、UoW-A 担当分のみ）
- [x] 2-2. `packages/core/src/viewer/EventBus.ts` — E4。`emit` は同期実行（BR-A-07）、ハンドラ例外は隔離（BR-A-08、L2 Observer）
- [x] 2-3. `packages/core/src/viewer/DisposableRegistry.ts` — E7。登録順（FIFO）に解体、冪等（BR-A-10、L4 Registry）
- [x] 2-4. `packages/core/src/viewer/ViewerState.ts` — E5。`createViewerState()` ファクトリ。プレーンオブジェクト（BR-A-14/BR-A-16）
- [x] 2-5. `packages/core/src/viewer/ErrorManager.ts` — E6。`PerisphereError` 生成 + `ViewerState.lastError` 反映 + `EventBus.emit('error', ...)`（BR-A-13）
- [x] 2-6. `packages/core/src/viewer/ContextRecoveryState.ts` — L5。`healthy/lost/recovering/degraded` の状態機械（NFR Design Q2=A、BR-A-12）
- [x] 2-7. `packages/core/src/viewer/ModeContext.ts` — E10。`camera`/`scene`/`sphereMesh` への参照
- [x] 2-8. `packages/core/src/viewer/ViewerMode.ts` — E8（IF）。`id`/`defaultZoomLimits?`/`apply`/`updateView`/`dispose`
- [x] 2-9. `packages/core/src/viewer/StandardMode.ts` — E9。既定値 yaw=0/pitch=0/fov=75、ズーム範囲 30〜90（BR-A-06、L3 Strategy）
- [x] 2-10. `packages/core/src/viewer/Renderer.ts` — E3。Scene/PerspectiveCamera/WebGLRenderer/プレースホルダ球体メッシュ（BR-A-15）、単一描画ループ（PP-1/PP-3）、`webglcontextlost`/`restored` ハンドリングと `ContextRecoveryState` 連携（RP-2）、再生成方式（PP-2）
- [x] 2-11. `packages/core/src/viewer/createViewer.ts` — E1/E2/S1。多層防御の初期化パイプライン（SP-1、環境ガード→WebGL2チェック）、成功/縮退パス（BR-A-01〜05）、`ViewerHandle`（UoW-A 担当分）の構築、`dispose()` の解体順序（BR-A-11）、dispose 後 no-op+warn（BR-A-09）、`setMode` 非標準値のエラー化（BR-A-17）、縮退時は DOM 無操作（NFR Design Q6=A）
- [x] 2-12. `packages/core/src/index.ts` — 公開エントリ（`createViewer` と公開型のみ re-export、Q2=B 単一エントリ）

## Step 3: Business Logic Unit Testing

`tech-stack-decisions.md` §3〜5（Vitest / fast-check / Renderer 境界モック化）に基づく。

- [x] 3-1. `EventBus.test.ts` — 同期発火順序、ハンドラ例外の隔離（fast-check: 任意個数のハンドラ登録に対する不変条件）
- [x] 3-2. `DisposableRegistry.test.ts` — 登録順の解体、複数回 `disposeAll()` の冪等性（fast-check）
- [x] 3-3. `ContextRecoveryState.test.ts` — 状態遷移表の全パス検証（`healthy→lost→recovering→healthy/degraded`、不正な遷移が無視されること）
- [x] 3-4. `StandardMode.test.ts` — 既定値・ズーム範囲の example-based 検証
- [x] 3-5. `createViewer.test.ts` — `Renderer` を境界としてモック化（NFR Requirements Q5=A）。初期化成功/縮退（WebGL2 非対応）パス、`error` イベントのマイクロタスク遅延（BR-A-04）、`dispose()` 冪等性、`setMode` 非標準値エラー、縮退時に `container` へ何も描画されないこと（NFR Design Q6=A）を検証

## Step 4: Business Logic Summary

- [x] 4-1. `aidlc-docs/construction/uow-a/code/code-summary.md` — 生成ファイル一覧、ストーリートレーサビリティ、既知の制約（プレースホルダ球体メッシュのみ・テクスチャ未対応等）をまとめる

## Step 5: Documentation Generation（最小限・API リファレンス本体は UoW-I）

- [x] 5-1. 公開 API（`createViewer`, `ViewerHandle`, 公開型）に TSDoc コメントを付与する（IDE 補完用の最小限。網羅的な API リファレンスサイトは UoW-I の責務）

## Step 6: Deployment Artifacts Generation

`infrastructure-design.md` §2〜3 の概念設計を実ファイルに反映する。

- [x] 6-1. `.github/workflows/ci.yml` に `lint`/`build`/`test` ジョブを追加（既存 `markdownlint`/`links` ジョブは変更しない）
- [x] 6-2. `.github/dependabot.yml` を新規作成（npm + github-actions、weekly）

## Step 7: ビルド・テストの実行確認

- [x] 7-1. `pnpm install` を実行しロックファイルを生成
- [x] 7-2. `pnpm -r build` を実行し型エラー・ビルドエラーがないことを確認
- [x] 7-3. `pnpm -r test` を実行し全テストが green であることを確認
- [x] 7-4. `pnpm -r lint` を実行し lint エラーがないことを確認
- [x] 7-5. 問題が見つかった場合は該当コードを修正し、7-2〜7-4 を再実行する

**実行結果**: build green（tsup ESM + .d.ts 生成成功）/ test green（5 ファイル・32 テスト全て pass）/ lint green（ESLint・Prettier とも問題なし）/ `pnpm audit --prod` 既知の脆弱性なし。

**発見した問題と対応**:

- `typescript` devDependency を計画時点の想定（最新版）から `5.9.3` に変更。tsup の `.d.ts` バンドル（`rollup-plugin-dts`）が TypeScript 7.x 系の内部コンパイラ API 変更に未対応で `pnpm -r build` が失敗したため、ビルドツールチェーンと互換性のある最新安定版（5.9.3）に固定した。
- `eslint.config.js`（ワークスペースルート）が import する `@eslint/js`/`typescript-eslint`/`eslint-config-prettier`/`globals` をルート `package.json` の `devDependencies` にも追加。pnpm workspaces は非 hoisting のため、共有 config ファイルの依存はそれを置くディレクトリ（ルート）自身が保持する必要があった。
- `pnpm-workspace.yaml` に pnpm 11 の新しいサプライチェーン保護機構（`allowBuilds`/`minimumReleaseAgeExclude`）由来の設定が `pnpm install` 実行時に自動追加された。`esbuild`（tsup が内部依存）のビルドスクリプトを明示的に許可（`allowBuilds.esbuild: true`）。
- `.prettierignore`（ルート・`packages/core` 双方）を追加し `dist/` を整形対象から除外。
- `@typescript-eslint/no-unused-vars` に `argsIgnorePattern: "^_"` を設定（未使用パラメータを `_` 接頭辞で意図的に無視する慣習に対応）。
- `createViewer.test.ts` で `Renderer` を `vi.mock` する際、モックの `modeContext` に three.js の実オブジェクト（`PerspectiveCamera`/`Scene`/`Mesh`）を使う必要があったが、`vi.mock` ファクトリは import 文より巻き上げられるため、静的 import を `vi.hoisted` から参照すると初期化順序エラーになった。ファクトリ内で `three` を動的 `import()` する形に変更して解決。

**注記**: Step 7 は開発時点での自己検証であり、正式な Build and Test ステージ（全ユニット共通の統合検証）を代替するものではない。

## ストーリートレーサビリティ

| ストーリー | 対応箇所 |
|---|---|
| US-06（既定の標準ビュー表示） | Step 2-9（StandardMode 既定値）、Step 2-11（初期化時の適用） |
| US-29（イベント API の購読） | Step 2-2（EventBus）、Step 2-11（`on/off/once` 委譲） |
| US-30（エラー処理とフォールバック表示） | Step 2-5（ErrorManager）、Step 2-11（縮退パス） |
| US-31（破棄 API によるリソース解放） | Step 2-3（DisposableRegistry）、Step 2-10/2-11（dispose 実装） |
| US-34（SSR セーフ） | Step 2-11（環境ガード） |
| US-36（性能体感 8K/60fps） | Step 2-10（単一描画ループ。詳細チューニングは対象外） |
| US-37（障害分離・縮退） | Step 2-6（ContextRecoveryState）、Step 2-10（コンテキストロスト処理） |

## 完了条件

- 上記 Step 1〜7 の全チェックボックスが `[x]`
- `pnpm -r build` / `pnpm -r test` / `pnpm -r lint` が green
- 生成コードが `business-rules.md`（BR-A-01〜18）・`nfr-design-patterns.md`・`logical-components.md` の決定と矛盾しない
