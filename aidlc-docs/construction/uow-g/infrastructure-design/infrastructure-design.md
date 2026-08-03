# Infrastructure Design — UoW-G 同梱コントロール UI

- **関連 Issue**: [#44](https://github.com/AtsutoNakayama/perisphere/issues/44)
- **作成日**: 2026-08-04
- **前提資料**: `uow-g-infrastructure-design-plan.md`（Q1 回答・採用理由）

## 1. カテゴリ別マッピング結果

| カテゴリ | 判定 | マッピング内容 |
|---|---|---|
| Deployment Environment | N/A | UoW-A〜F と同じ |
| Compute Infrastructure | N/A | 既存 `ubuntu-latest` ランナーで完結 |
| Storage Infrastructure | N/A | 変更なし |
| Messaging Infrastructure | N/A | 該当なし |
| Networking Infrastructure | N/A | 該当なし |
| Monitoring Infrastructure | N/A | 既存 GitHub Actions のチェック結果表示で足りる |
| Shared Infrastructure | 適用（変更不要と確認） | Q1=A |

## 2. CI/Dependabot への変更: 不要

既存の `lint`/`build`/`test` ジョブは `pnpm -r` でワークスペース全体を対象にしており、`packages/core/src/ui/`（`ControlsUI`/`controlsLogic`/`types.ts`）への新規ファイル追加と `viewer/`/`gallery/`（`createViewer.ts`/`Gallery.ts` 等）への拡張だけで自動的にカバーされる。UoW-G は新規のランタイム依存を追加しない（`nfr-requirements.md` Q4=A）ため `.github/dependabot.yml` も変更不要。

**結論**: UoW-G ではインフラ関連ファイルの変更は一切発生しない。

## 3. 拡張ルール準拠サマリ

| ルール | 判定 | 根拠 |
|---|---|---|
| SECURITY-10（サプライチェーン） | Compliant（変更なし） | 新規依存を追加しないため |
| SECURITY-13（CI/CD パイプラインの整合性） | Compliant（変更なし） | CI 設定ファイル自体を変更しないため |
| RESILIENCY-04（自動デプロイ・ロールバック） | N/A | UoW-A〜F と同じ理由 |

## 4. Code Generation への申し送り事項

- インフラ関連ファイル（`.github/workflows/ci.yml`・`.github/dependabot.yml`）への変更は不要。Code Generation では `packages/core/src/ui/` 配下のアプリケーションコードとテスト、および `viewer/`/`gallery/`（`createViewer.ts`/`Gallery.ts`）への拡張のみを生成する。
