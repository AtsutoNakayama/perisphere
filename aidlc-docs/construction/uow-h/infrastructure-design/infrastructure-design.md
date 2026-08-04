# Infrastructure Design — UoW-H React アダプタ

- **関連 Issue**: [#46](https://github.com/AtsutoNakayama/perisphere/issues/46)
- **作成日**: 2026-08-04
- **前提資料**: `uow-h-infrastructure-design-plan.md`（Q1 回答・採用理由）

## 1. カテゴリ別マッピング結果

| カテゴリ | 判定 | マッピング内容 |
|---|---|---|
| Deployment Environment | N/A | UoW-A〜G と同じ |
| Compute Infrastructure | N/A | 既存 `ubuntu-latest` ランナーで完結 |
| Storage Infrastructure | N/A | 変更なし |
| Messaging Infrastructure | N/A | 該当なし |
| Networking Infrastructure | N/A | 該当なし |
| Monitoring Infrastructure | N/A | 既存 GitHub Actions のチェック結果表示で足りる |
| Shared Infrastructure | 適用（変更不要と確認） | Q1=A |

## 2. CI/Dependabot/ワークスペース設定への変更: 不要

`packages/react/` を新設するだけで、`pnpm-workspace.yaml` の既存グロブ（`packages/*`）により自動的にワークスペースメンバーとして認識される。既存の `lint`/`build`/`test` CI ジョブ（`pnpm -r`）はワークスペース全体を対象にしており、新規パッケージも自動的に対象へ含まれる。`.github/dependabot.yml` はルートの `pnpm-lock.yaml` 全体を監視するため、新規依存（`react`/`react-dom` peer、`@testing-library/react`/`eslint-plugin-react-hooks` dev）も自動的にスキャン対象になる。

**結論**: UoW-H ではインフラ関連ファイル（`pnpm-workspace.yaml`・`.github/workflows/ci.yml`・`.github/dependabot.yml`）の変更は一切発生しない。

## 3. 拡張ルール準拠サマリ

| ルール | 判定 | 根拠 |
|---|---|---|
| SECURITY-10（サプライチェーン） | Compliant（変更なし） | 新規依存（`react`/`react-dom`/`@testing-library/react`/`eslint-plugin-react-hooks`）は既存の Dependabot・`pnpm audit` の監視対象に自動的に含まれる |
| SECURITY-13（CI/CD パイプラインの整合性） | Compliant（変更なし） | CI 設定ファイル自体を変更しないため |
| RESILIENCY-04（自動デプロイ・ロールバック） | N/A | UoW-A〜G と同じ理由 |

## 4. Code Generation への申し送り事項

- インフラ関連ファイル（`pnpm-workspace.yaml`・`.github/workflows/ci.yml`・`.github/dependabot.yml`）への変更は不要。Code Generation では `packages/react/` 一式（アプリケーションコード・テスト・`package.json`/`tsconfig.json`/`tsup.config.ts`/`vitest.config.ts`）のみを新規作成する。
