# NFR Requirements — UoW-G 同梱コントロール UI

- **関連 Issue**: [#44](https://github.com/AtsutoNakayama/perisphere/issues/44)
- **作成日**: 2026-08-04
- **前提資料**: `uow-g-nfr-requirements-plan.md`（Q1〜Q4 回答・採用理由）、`inception/requirements/requirements.md`（NFR-01〜12）、`construction/uow-g/functional-design/`、UoW-A〜F `tech-stack-decisions.md`

## 1. NFR カテゴリ別評価

| カテゴリ | UoW-G での判定 | 詳細 |
|---|---|---|
| Scalability | **N/A** | UoW-A〜F と同じ理由（クライアントサイドライブラリ、負荷分散の概念なし） |
| Availability | **N/A** | UoW-A〜F と同じ理由（稼働サーバー・永続データストアなし） |
| Performance | 適用（Functional Design で具体化済み） | DOM 構築は `ControlsUI` 生成時の1回のみ。表示状態の再評価・インジケーター再構築はイベント駆動（`modechange`/`photochange`）で、毎フレーム発火するホットパスではない（`business-logic-model.md` P8） |
| Security | 適用（本ステージで具体化、Q3） | `UITextMap` の値を DOM に反映する際は `textContent`/`setAttribute` のみを使用し、`innerHTML` 等の HTML パーサ経由 API は使用しない（SECURITY-05） |
| Reliability | 適用（Functional Design で具体化済み） | ヘッドレス時の安全な no-op（BR-G-15）、縮退ハンドルでも `ControlsUI` は実機能として動作（`Renderer` 非依存） |
| Maintainability | UoW-A の決定を継続 | Lint/フォーマッタ・TypeScript strictness は変更なし |
| Usability / Accessibility | 適用（Functional Design で具体化済み） | ネイティブ `<button>`/`<select>`・ARIA 属性・フォーカス管理（BR-G-11）で確定済み（NFR-04, US-35） |

## 2. 前提として再確認した確定済み NFR（変更なし）

UoW-A〜F `nfr-requirements.md` の内容がそのまま適用される。UoW-G 固有の追加確認は以下のみ。

| NFR | 内容 | UoW-G での扱い |
|---|---|---|
| NFR-04 | アクセシビリティ（キーボード完結・フォーカス・ARIA・文言差し替え） | 本ユニットが主担当。Functional Design で具体化済み（BR-G-06, BR-G-11） |
| NFR-08 | 被埋め込み方針 | 共有 `<style>` タグの重複防止（BR-G-12）で具体化済み |
| NFR-09 | PBT 全面適用。状態管理が主対象候補 | 表示状態計算・文言トークン置換を純粋関数へ切り出し PBT 対象とする（Q2） |
| NFR-10 | セキュリティ（安全なエラーメッセージ・確実なリソース解放） | `UITextMap` の安全な DOM 反映（Q3）・`dispose()` 時のクリーンアップ範囲（BR-G-13）で具体化済み |

## 3. 本ステージで確定した技術スタック（サマリ）

詳細な選定理由は `tech-stack-decisions.md` を参照。

| # | 論点 | 決定 |
|---|---|---|
| Q1 | 共有 `<style>` タグのテスト戦略 | `beforeEach`/`afterEach` で該当要素を除去し、各テストを未注入状態から開始する |
| Q2 | PBT 対象範囲・純粋関数への切り出し | `computeEffectiveVisibility`/`resolveText` を DOM 操作から分離した純粋関数として実装し PBT 対象とする |
| Q3 | `UITextMap` の DOM 反映方式 | `textContent`/`setAttribute` のみ使用。`innerHTML` は不使用 |
| Q4 | 新規ランタイム依存 | なし |

## 4. 拡張ルール準拠サマリ

### Security Baseline

| ルール | 判定 | 根拠 |
|---|---|---|
| SECURITY-05（入力検証） | Compliant | `UITextMap` の値（利用側が渡す任意文字列）は `textContent`/`setAttribute` のみで DOM に反映し、`innerHTML` を使用しないため HTML/スクリプトとして解釈されない（Q3） |
| SECURITY-09（ハードニング） | N/A | 本ユニットにデプロイ対象のサーバー・クレデンシャル・クラウドストレージは存在しない |
| SECURITY-10（サプライチェーン） | Compliant（変更なし） | Q4 により新規依存を追加しないため、UoW-A で確定済みの lockfile/Dependabot/CI 監査方針がそのまま適用される |
| SECURITY-11（セキュア設計） | Compliant | 表示状態計算・文言処理を DOM 操作から分離した専用モジュールに切り出す設計（Q2）により、関心事が分離されている |
| SECURITY-15（例外処理） | Compliant | ヘッドレス時の安全な no-op（BR-G-15）、`dispose()` 時の確実なクリーンアップ（BR-G-13）で具体化済み |

### Resiliency Baseline

| ルール | 判定 | 根拠 |
|---|---|---|
| RESILIENCY-01〜09, 11〜15 | N/A | UoW-A〜F と同じ理由 |
| RESILIENCY-10（過剰リトライ回避） | N/A | `ControlsUI` はリトライを行う処理を持たない |

### Property-Based Testing

| ルール | 判定 | 根拠 |
|---|---|---|
| PBT 対象範囲の拡張 | Compliant | Q2 により `computeEffectiveVisibility`/`resolveText` を PBT 対象として特定。NFR-09 の「状態管理」という主対象候補に対応 |
| PBT-10（ビジネスクリティカルパスの example-based 併設） | Compliant（方針継続） | 各コントロールのクリックハンドラ・イベント同期は Code Generation で example-based により個別に検証する |

## 5. Code Generation への申し送り事項

- `computeEffectiveVisibility`/`resolveText` は DOM 操作を持たない純粋関数として実装し、PBT（fast-check）で不変条件を検証する（Q2）。
- `UITextMap` の値の DOM への反映は `textContent`/`setAttribute` のみを使用する（Q3、`innerHTML` 禁止）。
- 共有 `<style>` タグ（BR-G-12）に関わるテストは `beforeEach`/`afterEach` で除去し、テストごとに未注入状態から開始する（Q1）。
- 新規パッケージ依存の追加は不要（Q4）。`packages/core/package.json` の変更は不要。
