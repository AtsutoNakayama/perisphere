# NFR Requirements — UoW-A コア基盤

- **関連 Issue**: [#27](https://github.com/AtsutoNakayama/perisphere/issues/27)
- **作成日**: 2026-08-02
- **前提資料**: `uow-a-nfr-requirements-plan.md`（Q1〜Q10 回答・採用理由）、`inception/requirements/requirements.md`（NFR-01〜12）、`construction/uow-a/functional-design/`

## 1. NFR カテゴリ別評価

| カテゴリ | UoW-A での判定 | 詳細 |
|---|---|---|
| Scalability | **N/A** | クライアントサイドライブラリであり、負荷分散・水平スケーリングの概念が存在しない（稼働サーバーを持たない） |
| Performance | 適用（既確定 + 本ステージで補足） | NFR-01（8K/60fps 目安）は Requirements で確定済み。本ステージでは実現手段としてビルド出力ターゲット（§3 Q10）を確定。詳細なレンダラチューニング（ピクセル比上限等）は NFR Design で扱う |
| Availability | **N/A** | 稼働サーバー・永続データストアなし（NFR-11 で確認済み。RTO/RPO=N/A） |
| Security | 適用（既確定 + 本ステージで具体化） | NFR-10 の要求（入力検証・例外安全処理・内部詳細非露出・サプライチェーン対策）を、本ステージで具体的なツール（依存脆弱性スキャン）に落とし込んだ（§3 Q9） |
| Tech Stack Selection | 本ステージで確定 | §2・§3・`tech-stack-decisions.md` 参照 |
| Reliability | 適用（Functional Design で具体化済み） | US-30/US-37 に対応する障害分離・コンテキストロスト復帰は `business-rules.md` BR-A-03/12 で確定済み。本ステージでの追加確認事項なし |
| Maintainability | 本ステージで確定 | Lint/フォーマッタ・TypeScript strictness（§3 Q6・Q7） |
| Usability / Accessibility | **N/A（UoW-A スコープ外）** | UoW-A は UI を持たない。アクセシビリティは同梱 UI（UoW-G）の責務（NFR-04） |

## 2. 前提として再確認した確定済み NFR（変更なし）

| NFR | 内容 | UoW-A での扱い |
|---|---|---|
| NFR-01 | 8K まで動作保証・60fps 目安 | ビルドターゲット確定で補足（§3 Q10）。詳細チューニングは NFR Design |
| NFR-02 | デスクトップ/モバイル主要ブラウザ・WebGL2 前提 | ビルドターゲット確定の前提として採用（§3 Q10） |
| NFR-03 | SSR セーフ | `business-rules.md` BR-A-01 で確定済み |
| NFR-05 | core/react 分離モノレポ | ワークスペースツール確定で具体化（§3 Q1） |
| NFR-06 | three.js は peerDependencies | バージョン範囲を確定（§3 Q8） |
| NFR-07 | npm 公開・ESM + 型定義・tree-shaking 可 | ビルドツール確定で具体化（§3 Q2） |
| NFR-09 | PBT 全面適用 | フレームワークを fast-check に確定（§3 Q4） |
| NFR-10 | セキュリティ（入力検証・例外安全・内部詳細非露出・サプライチェーン・セキュア設計） | サプライチェーン対策のツールを確定（§3 Q9）。他は Functional Design で確定済み or Code Generation で実装 |
| NFR-11 | 稼働サーバーなし・GitHub Flow・障害分離 | 変更なし |
| NFR-12 | MIT License | 変更なし |

## 3. 本ステージで確定した技術スタック（サマリ）

詳細な選定理由は `tech-stack-decisions.md` を参照。

| # | 論点 | 決定 |
|---|---|---|
| Q1 | パッケージマネージャ/ワークスペース | pnpm workspaces |
| Q2 | ビルドツール | tsup |
| Q3 | テストランナー | Vitest |
| Q4 | PBT ライブラリ | fast-check |
| Q5 | WebGL 実描画のテスト戦略 | `Renderer` をモック化する境界テスト（実描画確認は Build and Test 以降） |
| Q6 | Lint / フォーマッタ | ESLint + Prettier |
| Q7 | TypeScript strictness | `strict: true` 全面適用 |
| Q8 | three.js バージョン範囲（peerDependencies） | 広めの範囲（直近安定メジャーライン以降） |
| Q9 | 依存脆弱性スキャン | GitHub Dependabot + CI 監査ステップの両方 |
| Q10 | ビルド出力トランスパイルターゲット | ES2020 相当 |

## 4. 拡張ルール準拠サマリ

`aidlc-state.md` の Extension Configuration により、Security Baseline / Resiliency Baseline / Property-Based Testing の 3 拡張が Enabled。本ステージ（技術スタック確定）に関連するルールを評価する。

### Security Baseline

| ルール | 判定 | 根拠 |
|---|---|---|
| SECURITY-05（入力検証） | N/A（本ステージ） | 具体的な検証ロジックは UoW-A の `loadImage`/`registerSource` を持たないため対象外。UoW-B の Functional Design/Code Generation で対応 |
| SECURITY-09（内部詳細の非露出） | Compliant | `business-rules.md` BR-A-13 で確定済み（本ステージでの変更なし） |
| SECURITY-10（サプライチェーン） | Compliant | pnpm lockfile のコミット（Q1）、Dependabot + CI 監査（Q9）、three.js を含む依存は公式レジストリ（npm）のみを利用する方針を確認 |
| SECURITY-11（セキュア設計） | Compliant（Functional Design で対応済み） | `setMode` への不正値の扱い（BR-A-17）等、誤用ケースを設計で考慮済み |
| SECURITY-13（CI/CD 整合性・成果物検証） | 部分対応・残課題として記録 | CI ワークフローのアクションバージョン固定（`latest` タグ不使用）は Infrastructure Design / Code Generation で CI 設定を追加する際に適用する。デシリアライズ安全性は画像データを扱う UoW-B の責務。CDN 配布は NFR-07 でスコープ外のため SRI は N/A |
| SECURITY-15（例外処理） | Compliant | `business-rules.md` BR-A-09〜12 で確定済み（本ステージでの変更なし） |

### Resiliency Baseline

| ルール | 判定 | 根拠 |
|---|---|---|
| RESILIENCY-01〜09, 11〜15 | N/A | 稼働サーバー・デプロイ・DR の概念が存在しないため（NFR-11 で確認済み） |
| RESILIENCY-10（依存分離・過剰リトライ回避） | Compliant | `business-rules.md` BR-A-12（コンテキストロスト復帰は 1 回のみ試行）で確定済み |

### Property-Based Testing

| ルール | 判定 | 根拠 |
|---|---|---|
| PBT フレームワーク選定 | Compliant | fast-check を採用（Q4）。Vitest との統合を前提に Code Generation で導入する |
| PBT 対象範囲の特定 | 一部特定・残課題 | UoW-A では投影数式等の複雑な計算ロジックが少ない（標準モードの既定値設定が中心）。PBT の主対象（座標変換・状態遷移）は UoW-C（投影モード）・UoW-D（視点操作）・UoW-E（ギャラリー）で本格化する。UoW-A では `EventBus`（任意個数のハンドラ登録・発火順序の不変条件）と `DisposableRegistry`（複数回 dispose の冪等性）が PBT 候補として妥当 |
| PBT-10（ビジネスクリティカルパスの example-based 併設） | Compliant（方針確認済み） | Code Generation で PBT と example-based テストを併設する方針を継続する |

## 5. Code Generation への申し送り事項

- ワークスペースルートに `pnpm-workspace.yaml` を作成し、`packages/core` を先行して構築する（`packages/react`/`apps/demo` は該当ユニット実装時に追加）。
- `packages/core/package.json` の `three` は `peerDependencies` として広めの range で宣言する（`tech-stack-decisions.md` §7 参照）。
- CI ワークフロー（`.github/workflows/ci.yml`）へのビルド/テストジョブ追加、Dependabot 設定（`.github/dependabot.yml`）の追加は Infrastructure Design（または Code Generation、ユニットの Infrastructure Design が minimal スコープの場合）で行う。
