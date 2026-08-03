# Infrastructure Design — UoW-B 画像入力・ロード

- **関連 Issue**: [#34](https://github.com/AtsutoNakayama/perisphere/issues/34)
- **作成日**: 2026-08-03
- **前提資料**: `uow-b-infrastructure-design-plan.md`（Q1 回答・採用理由）

## 1. カテゴリ別マッピング結果

| カテゴリ | 判定 | マッピング内容 |
|---|---|---|
| Deployment Environment | N/A | UoW-A と同じ（GitHub Actions のみ、npm 公開はスコープ外） |
| Compute Infrastructure | N/A | 既存 `ubuntu-latest` ランナーで完結 |
| Storage Infrastructure | N/A | 変更なし |
| Messaging Infrastructure | N/A | 該当なし |
| Networking Infrastructure | N/A | 該当なし |
| Monitoring Infrastructure | N/A | 既存 GitHub Actions のチェック結果表示で足りる |
| Shared Infrastructure | 適用（変更不要と確認） | Q1=A |

## 2. CI/Dependabot への変更: 不要

UoW-A で追加した `.github/workflows/ci.yml` の `lint`/`build`/`test` ジョブは `pnpm -r` によりワークスペース全体（`packages/core` を含む）を対象にしている。UoW-B は `packages/core/src/loader/` にファイルを追加するのみで、既存ジョブが自動的にカバーする。

`.github/dependabot.yml` も `npm`/`github-actions` エコシステム全体を対象にしており、UoW-B が新規のランタイム依存を追加しない（`nfr-requirements.md` Q4=A）ため変更不要。

**結論**: UoW-B では `.github/workflows/ci.yml`・`.github/dependabot.yml` を含め、インフラ関連ファイルの変更は一切発生しない。

## 3. 拡張ルール準拠サマリ

| ルール | 判定 | 根拠 |
|---|---|---|
| SECURITY-10（サプライチェーン） | Compliant（変更なし） | 新規依存を追加しないため、UoW-A で確定済みの lockfile/Dependabot/CI 監査方針がそのまま適用される |
| SECURITY-13（CI/CD パイプラインの整合性） | Compliant（変更なし） | CI 設定ファイル自体を変更しないため、UoW-A 時点の評価から変化なし |
| RESILIENCY-04（自動デプロイ・ロールバック） | N/A | UoW-A と同じ理由（デプロイパイプライン自体が存在しない） |

## 4. Code Generation への申し送り事項

- インフラ関連ファイル（`.github/workflows/ci.yml`・`.github/dependabot.yml`）への変更は不要。Code Generation では `packages/core/src/loader/` 配下のアプリケーションコードとテストのみを生成する。
