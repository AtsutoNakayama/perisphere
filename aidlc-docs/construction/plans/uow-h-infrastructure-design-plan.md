# Infrastructure Design Plan — UoW-H React アダプタ

- **関連 Issue**: [#46](https://github.com/AtsutoNakayama/perisphere/issues/46)
- **作成日**: 2026-08-04
- **前提資料**: `construction/uow-h/functional-design/`、`construction/uow-h/nfr-design/`、UoW-A〜G `construction/*/infrastructure-design/`（既存 CI 構成）

## 必須評価カテゴリの適用可否

| カテゴリ | 適用可否 | 判定根拠 |
|---|---|---|
| Deployment Environment | **N/A** | UoW-A〜G と同じ（GitHub Actions のみ、npm 公開はスコープ外） |
| Compute Infrastructure | **N/A** | 既存 `ubuntu-latest` ランナーで完結 |
| Storage Infrastructure | **N/A** | 変更なし |
| Messaging Infrastructure | **N/A** | 該当なし |
| Networking Infrastructure | **N/A** | 該当なし |
| Monitoring Infrastructure | **N/A** | 既存 GitHub Actions のチェック結果表示で足りる |
| Shared Infrastructure | 確認のみ | UoW-H は UoW-A〜G と異なり**新規パッケージ**（`packages/react`）を追加するため、`pnpm-workspace.yaml`・CI・Dependabot が変更なしで新規パッケージを自動的にカバーするかを確認する（Q1） |

## 確認質問

### Q1. 新規パッケージ（`packages/react`）追加に伴う CI/Dependabot/ワークスペース設定への変更要否

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 変更不要。`pnpm-workspace.yaml` の `packages: ["packages/*", "apps/*"]` は既にグロブパターンのため、`packages/react/` を新設するだけで自動的にワークスペースメンバーとして認識される（`pnpm-workspace.yaml` 自体の編集は不要）。既存の `lint`/`build`/`test` CI ジョブは `pnpm -r` でワークスペース全体を対象にしており、新規パッケージ追加だけで自動的に対象に含まれる。`.github/dependabot.yml` の `npm` エコシステムも `directory: "/"` でルートの pnpm ロックファイル（`pnpm-lock.yaml`）全体を監視するため、新規パッケージの新規依存（`react`/`react-dom` peer、`@testing-library/react`/`eslint-plugin-react-hooks` dev）も自動的にスキャン対象になる | UoW-A で確立済みの「CI・Dependabot はグロブ/ルート監視でユニット追加に自動対応する」という設計意図がそのまま機能する。新規パッケージであっても、既存の仕組みに変更を加える必要はない |
| B | `packages/react` 専用の CI ジョブ・ステップ、または `dependabot.yml` への個別エントリを追加する | 既存の `pnpm -r` ジョブとルート監視の Dependabot で完全にカバーされるため冗長。UoW-A の設計意図（ユニット追加への拡張性）に反してファイル変更を増やすことになる |

**採用理由**: 新規パッケージであっても既存インフラの拡張性でカバーされるため。

[Answer]: A

## 次のステップ（Step 6: 成果物生成、承認後）

- [ ] `aidlc-docs/construction/uow-h/infrastructure-design/infrastructure-design.md`
- [ ] `aidlc-docs/construction/uow-h/infrastructure-design/deployment-architecture.md`
