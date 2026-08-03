# Tech Stack Decisions — UoW-A コア基盤

- **関連 Issue**: [#27](https://github.com/AtsutoNakayama/perisphere/issues/27)
- **作成日**: 2026-08-02
- **前提資料**: `uow-a-nfr-requirements-plan.md`（Q1〜Q10 回答・採用理由）
- **注記**: ここでの決定はモノレポ全体（`packages/core`/`packages/react`/`apps/demo`）に適用されるツールチェーンを含む。UoW-A が最初のユニットのため本ステージで確定するが、後続ユニットはこの決定を前提として進める。変更が必要になった場合は当該ユニットの NFR Requirements で再検討する。

## 1. パッケージマネージャ / ワークスペースツール: pnpm workspaces

- **決定**: pnpm workspaces を採用する。
- **構成ファイル**: リポジトリルートに `pnpm-workspace.yaml`（`packages: ["packages/*", "apps/*"]`）、`.npmrc` に厳格な依存解決の設定を必要に応じて追加。
- **Node.js エンジン要件**: `package.json` の `engines.node` に稼働実績のある LTS 世代の範囲を明記する（具体バージョンは Code Generation 時点の最新 LTS を確認して決定）。
- **lockfile**: `pnpm-lock.yaml` をコミットする（SECURITY-10）。

## 2. ビルドツール: tsup

- **決定**: `packages/core`（および後続の `packages/react`）のビルドに tsup を採用する。
- **出力形式**: ESM（`NFR-07`）+ `.d.ts`。CJS 出力は行わない（NFR-07 が ESM 配布を前提とし CDN/UMD を対象外としているため）。
- **エントリポイント**: `src/index.ts` を単一の公開エントリとする（`components.md` Q1=A の単一コア方針に対応）。
- **設定ファイル**: `packages/core/tsup.config.ts`。

## 3. テストランナー: Vitest

- **決定**: Vitest を採用する。
- **環境**: `jsdom` 環境で実行（`window`/`document` は存在するが WebGL2 は利用不可 — §5 の WebGL テスト戦略と対になる前提）。
- **設定ファイル**: `packages/core/vitest.config.ts`（もしくはワークスペースルートの共有設定 + パッケージ側の継承。具体構成は Code Generation で確定）。

## 4. Property-Based Testing ライブラリ: fast-check

- **決定**: fast-check を採用し、Vitest と組み合わせる。
- **UoW-A での適用対象候補**:
  - `EventBus`: 任意個数・任意順序のハンドラ登録に対する発火順序・例外隔離の不変条件（BR-A-07/08）
  - `DisposableRegistry`: 複数回 `dispose()` 呼び出しに対する冪等性（BR-A-10）
- **example-based との併設方針**: 初期化の成功/縮退パス（BR-A-01〜05）、コンテキストロスト復帰（BR-A-12）等のビジネスクリティカルなシナリオは example-based テストで個別に検証する（PBT-10）。

## 5. WebGL 実描画のテスト戦略: `Renderer` の境界モック化

- **決定**: 単体テストでは `Renderer` を境界としてモック化する。three.js の実オブジェクト生成は行わず、「正しい呼び出し・パラメータで初期化を試みたか」（例: カメラの既定 FOV=75 が設定されたか、`webglcontextlost` リスナーが登録されたか）を検証する。
- **理由**: `jsdom` は WebGL2 コンテキストを提供しない。ネイティブ WebGL 実装（`headless-gl` 等）は CI の安定性・保守負荷の観点で不採用（`uow-a-nfr-requirements-plan.md` Q5 参照）。
- **実描画確認**: ブラウザでの手動確認、および将来の Build and Test ステージでのブラウザベース確認（UoW-I のデモサイト等）に委ねる。UoW-A の Code Generation では自動テストの対象としない。

## 6. Lint / フォーマッタ: ESLint + Prettier

- **決定**: ESLint（`@typescript-eslint` 込み）+ Prettier を採用する。
- **設定ファイル**: ワークスペースルートに共有設定（`eslint.config.js` / `.prettierrc`）を置き、各パッケージが継承する。
- **CI 統合**: 既存 CI（`Markdown lint` / `Link check`）に加え、Lint/Format チェックジョブを追加する（Infrastructure Design または Code Generation で実施）。

## 7. TypeScript strictness: `strict: true` 全面適用

- **決定**: ワークスペース共有の `tsconfig.base.json` で `strict: true` を含む厳格設定を最初から適用する。
- **追加推奨オプション**（Code Generation 時に具体化）: `noUncheckedIndexedAccess`、`exactOptionalPropertyTypes` 等、ライブラリコードの型安全性を高める追加オプションの要否を Code Generation で検討する。

## 8. three.js バージョン範囲（peerDependencies）: 広めの range

- **決定**: `packages/core/package.json` の `peerDependencies.three` に、直近の安定メジャーライン以降を許容する広めの range を指定する（NFR-06）。
- **具体的な下限バージョン**: Code Generation 着手時点で three.js の最新安定版を確認し、`>=<最新安定メジャー>.0.0 <1` の形で確定する（本ステージ時点で具体的なバージョン番号を固定すると Code Generation 時に陳腐化するリスクがあるため、方針のみ確定する）。
- **開発時の devDependencies**: 実装・テストで使用する具体的な three.js バージョンは `devDependencies` に固定し、CI の再現性を確保する。

## 9. 依存脆弱性スキャンの CI 統合: Dependabot + CI 監査ステップ

- **決定**: 以下の両方を導入する。
  1. `.github/dependabot.yml` で `npm`（pnpm 含む）エコシステムの `version-updates` + `security-updates` を有効化
  2. CI ワークフローに `pnpm audit`（または同等コマンド）のステップを追加
- **導入タイミング**: 実際の設定ファイル追加は Infrastructure Design（または Code Generation の CI 更新）で行う。本ステージでは方針のみ確定。

## 10. ビルド出力のトランスパイルターゲット: ES2020 相当

- **決定**: tsup（§2）のビルドターゲットを ES2020 相当に設定する。
- **前提**: NFR-02（デスクトップ/モバイル主要ブラウザの「最新世代」）。ポリフィルは行わない。

## 決定の適用範囲に関する注記

上記のうち §1（パッケージマネージャ）・§6（Lint/フォーマッタ）・§7（TypeScript strictness）・§9（依存脆弱性スキャン）はワークスペース全体に適用されるモノレポ横断の決定であり、後続ユニット（UoW-B 以降）はこれを前提として進める。§2〜§5・§8・§10 は `packages/core` の実装に関する決定であり、`packages/react`（UoW-H）着手時に React 固有の追加検討（例: ビルドターゲットへの JSX 変換設定追加）が必要になる場合がある。
