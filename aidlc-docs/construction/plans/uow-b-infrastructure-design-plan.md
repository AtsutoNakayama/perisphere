# Infrastructure Design Plan — UoW-B 画像入力・ロード

- **関連 Issue**: [#34](https://github.com/AtsutoNakayama/perisphere/issues/34)
- **作成日**: 2026-08-03
- **前提資料**: `construction/uow-b/functional-design/`、`construction/uow-b/nfr-design/`、UoW-A `construction/uow-a/infrastructure-design/`（既存 CI 構成）

## 必須評価カテゴリの適用可否

| カテゴリ | 適用可否 | 判定根拠 |
|---|---|---|
| Deployment Environment | **N/A** | UoW-A で GitHub Actions（CI）のみと確定済み。npm 公開パイプラインは UoW-A 同様スコープ外（`unit-of-work.md` の到達点は UoW-A+B で「表示」までであり配布整備は対象外） |
| Compute Infrastructure | **N/A** | 新規の実行環境（ランナー種別等）は不要。既存 `ubuntu-latest` ランナーで完結 |
| Storage Infrastructure | **N/A** | 変更なし（`nfr-requirements.md` UoW-A §1 で確認済み） |
| Messaging Infrastructure | **N/A** | 該当なし |
| Networking Infrastructure | **N/A** | 該当なし（`fetch` はブラウザ内で完結し、CI 上でのネットワーク構成変更は不要） |
| Monitoring Infrastructure | **N/A** | 既存 GitHub Actions のチェック結果表示で足りる（UoW-A と同じ） |
| Shared Infrastructure | 確認のみ | UoW-A の CI（`.github/workflows/ci.yml` の `lint`/`build`/`test` ジョブ）が `pnpm -r` によりワークスペース全体対応で設計済みのため、UoW-B のコード追加だけで自動的にカバーされるかを確認する（§ Q1） |

## 確認質問

### Q1. UoW-B に伴う CI/Dependabot への変更要否

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 変更不要。既存の `lint`/`build`/`test` ジョブは `pnpm -r` でワークスペース全体（`packages/core` を含む）を対象にしており、UoW-B で `packages/core/src/loader/` にファイルを追加するだけで自動的に対象に含まれる。`.github/dependabot.yml` も `npm`/`github-actions` エコシステム全体を対象にしており新規依存を追加しない（NFR Requirements Q4=A）ため変更不要 | UoW-A Infrastructure Design の Q6=A（CI ジョブのユニット追加への拡張性）の設計意図がそのまま機能している |
| B | UoW-B 専用の CI ジョブ・ステップを追加する | 既存ジョブで完全にカバーされるため冗長。過剰設計 |

**採用理由**: UoW-A で「後続ユニットが追加された際も CI 設定の変更が不要であること」を明示的な設計意図（Q6=A）として盛り込んでおり、実際に新規依存もないため、その通りに機能する。

[Answer]: A

## 比較検討サマリ

判断軸: UoW-A で確立した CI/インフラの拡張性設計が実際に機能するかどうかの確認。新規インフラ・新規依存・新規デプロイ先が一切ないため、本ステージは実質的に「変更不要であることの確認」のみ。

## 次のステップ（Step 6: 成果物生成、承認後）

- `aidlc-docs/construction/uow-b/infrastructure-design/infrastructure-design.md`
- `aidlc-docs/construction/uow-b/infrastructure-design/deployment-architecture.md`
