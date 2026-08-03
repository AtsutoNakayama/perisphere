# NFR Requirements — UoW-D 視点操作・入力

- **関連 Issue**: [#38](https://github.com/AtsutoNakayama/perisphere/issues/38)
- **作成日**: 2026-08-03
- **前提資料**: `uow-d-nfr-requirements-plan.md`（Q1〜Q7 回答・採用理由）、`inception/requirements/requirements.md`（NFR-01〜12）、`construction/uow-d/functional-design/`

## 1. NFR カテゴリ別評価

| カテゴリ | UoW-D での判定 | 詳細 |
|---|---|---|
| Scalability | **N/A** | クライアントサイドライブラリであり、負荷分散・水平スケーリングの概念が存在しない（UoW-A〜C と同様） |
| Availability | **N/A** | 稼働サーバー・永続データストアなし（NFR-11 で確認済み） |
| Performance | **適用（本ユニットが主担当）** | NFR-01「視点操作・ズームが滑らか（60fps 目安）」の実現手段を本ステージで確定: `viewchange`/`zoomchange` の発火頻度制御（§3 Q1）、ホットパスのオブジェクト生成方針（§3 Q2）。カメラ/シェーダへの実際の反映はイベント発火の間引きと分離し即座に行う（Functional Design BR-D-04〜08 で確定済み） |
| Security | 適用 | `setView`/`setZoomLimits` の入力検証を確定（§3 Q5、SECURITY-05）。既存の `INVALID_INPUT` 正規化方針（UoW-A BR-A-17・UoW-B BR-B-03）を継続 |
| Reliability | 適用（Functional Design で具体化済み） | モード切替直後の視点同期（BR-D-12）・コンテキストロスト復帰時の視点再適用（BR-D-13）は確定済み。本ステージでの追加確認事項なし |
| Maintainability | 適用（継続、変更なし） | Lint/フォーマッタ（ESLint+Prettier）・TypeScript strictness は UoW-A の決定を継続 |
| Usability / Accessibility | **適用（本ユニットが機能面を主担当）** | NFR-04 第一文（キーボードのみで主要操作完結）は UoW-D の責務。UI 表現面（ARIA・フォーカス表示）は UoW-G との境界を確認（§3 Q6） |
| Tech Stack Selection | 本ステージで確認・確定 | 新規ランタイム依存なし（§3 Q7）、テスト境界（§3 Q3, Q4） |

## 2. 前提として再確認した確定済み NFR（変更なし）

| NFR | 内容 | UoW-D での扱い |
|---|---|---|
| NFR-01 | 8K まで動作保証・視点操作/ズームが 60fps 目安 | 本ステージで発火頻度制御・ホットパス方針を確定（§3 Q1, Q2）。具体的な閾値は NFR Design で確定 |
| NFR-02 | デスクトップ/モバイル主要ブラウザ・WebGL2 前提。入力ハンドリングを拡張可能な構造に | Functional Design で `InputSource` IF（Inception 確定済み）に沿った拡張点を確保済み（`registerInputSource`） |
| NFR-04 | キーボードのみで主要操作完結・フォーカス管理/ARIA・文言差し替え | UoW-D は機能面（キーボード操作完結・フォーカス受付）を担当。UI 表現面は UoW-G（§3 Q6） |
| NFR-05 | 拡張点を明確な公開インターフェースとして設計 | `InputSource` IF・`Keymap` は Inception/Functional Design で確定済み |
| NFR-09 | PBT 全面適用 | 適用対象を確定（§3 Q3） |
| NFR-10 | セキュリティ（入力検証・例外安全・内部詳細非露出・サプライチェーン・セキュア設計） | `setView`/`setZoomLimits` の検証を確定（§3 Q5）。他は UoW-A/UoW-B から継続 |
| NFR-11 | 稼働サーバーなし・GitHub Flow・障害分離 | コンテキストロスト復帰時の視点再適用（BR-D-13）で対応済み |
| NFR-12 | MIT License | 変更なし |

## 3. 本ステージで確定した論点（サマリ）

詳細な選定理由は `tech-stack-decisions.md` を参照。

| # | 論点 | 決定 |
|---|---|---|
| Q1 | `viewchange`/`zoomchange` の発火頻度制御 | `requestAnimationFrame` ベースで集約発火（描画反映とは分離）。具体的な閾値は NFR Design で確定 |
| Q2 | ホットパスのオブジェクト生成 | `ViewController` 内部はミュータブル、`getView()` は呼び出しごとに浅いコピーを返す |
| Q3 | PBT の適用対象 | yaw 正規化・pitch クランプ・fov クランプ・`Keymap` マージを純粋関数として切り出し PBT 対象化。統合経路（BR-D-12/13）は example-based |
| Q4 | DOM 入力イベントのテスト境界 | DOM リスナー登録層と intent 組み立てロジックを分離し、後者を jsdom 合成イベントでテスト |
| Q5 | `setView`/`setZoomLimits` の入力検証 | 不正値（非有限数値、`minFov >= maxFov`）は呼び出し全体を無視し `error`（`INVALID_INPUT`）を発火 |
| Q6 | アクセシビリティの UoW-D/UoW-G 境界 | UoW-D はキーボード操作の機能面・フォーカス受付（`tabindex`）まで。ARIA・視覚的フォーカス表示は UoW-G |
| Q7 | 新規ランタイム依存 | 追加なし（DOM 標準 API のみで実装） |
