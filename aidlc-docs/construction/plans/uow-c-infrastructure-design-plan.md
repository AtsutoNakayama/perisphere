# Infrastructure Design Plan — UoW-C 投影モード

- **関連 Issue**: [#36](https://github.com/AtsutoNakayama/perisphere/issues/36)
- **作成日**: 2026-08-03
- **前提資料**: `construction/uow-c/functional-design/`、`construction/uow-c/nfr-design/`、UoW-A/UoW-B `construction/*/infrastructure-design/`（既存 CI 構成）

## 必須評価カテゴリの適用可否

| カテゴリ | 適用可否 | 判定根拠 |
|---|---|---|
| Deployment Environment | **N/A** | UoW-A/UoW-B と同じ（GitHub Actions のみ、npm 公開はスコープ外） |
| Compute Infrastructure | **N/A** | 既存 `ubuntu-latest` ランナーで完結 |
| Storage Infrastructure | **N/A** | 変更なし |
| Messaging Infrastructure | **N/A** | 該当なし |
| Networking Infrastructure | **N/A** | 該当なし |
| Monitoring Infrastructure | **N/A** | 既存 GitHub Actions のチェック結果表示で足りる |
| Shared Infrastructure | 確認のみ | UoW-C は新規ランタイム依存を追加しない（`nfr-requirements.md` Q4=A）ため、既存 CI（`pnpm -r`）・Dependabot がそのままカバーするかを確認する（§ Q1） |

## 確認質問

### Q1. UoW-C に伴う CI/Dependabot への変更要否

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 変更不要。既存の `lint`/`build`/`test` ジョブは `pnpm -r` でワークスペース全体を対象にしており、`packages/core/src/modes/` へのファイル追加だけで自動的に対象に含まれる。新規ランタイム依存もないため `.github/dependabot.yml` も変更不要 | UoW-B と同じ状況（UoW-A の設計意図〔CI のユニット追加への拡張性〕がそのまま機能する） |
| B | UoW-C 専用の CI ジョブ・ステップを追加する | 既存ジョブで完全にカバーされるため冗長 |

**採用理由**: UoW-B と同様、新規インフラ・新規依存が一切ないため。

[Answer]: A

## 次のステップ（Step 6: 成果物生成、承認後）

- [x] `aidlc-docs/construction/uow-c/infrastructure-design/infrastructure-design.md`
- [x] `aidlc-docs/construction/uow-c/infrastructure-design/deployment-architecture.md`
