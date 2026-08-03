# NFR Requirements — UoW-F フルスクリーン

- **関連 Issue**: [#42](https://github.com/AtsutoNakayama/perisphere/issues/42)
- **作成日**: 2026-08-03
- **前提資料**: `uow-f-nfr-requirements-plan.md`（Q1〜Q4 回答・採用理由）、`inception/requirements/requirements.md`（NFR-01〜12）、`construction/uow-f/functional-design/`、UoW-A〜E `tech-stack-decisions.md`

## 1. NFR カテゴリ別評価

| カテゴリ | UoW-F での判定 | 詳細 |
|---|---|---|
| Scalability | **N/A** | UoW-A〜E と同じ理由（クライアントサイドライブラリ、負荷分散の概念なし） |
| Availability | **N/A** | UoW-A〜E と同じ理由（稼働サーバー・永続データストアなし） |
| Performance | 適用（Functional Design で具体化済み） | `Renderer.resize()`（`business-rules.md` BR-F-09）はフルスクリーン切替の前後で1回のみ呼ばれ、毎フレーム発火するホットパスではない |
| Security | 適用（Functional Design で具体化済み） | `enterFullscreen()`/`exitFullscreen()` は引数を取らず入力検証対象がない。実行時失敗は `FULLSCREEN_FAILED`（内部詳細を含まない安全なメッセージ）として正規化済み（BR-F-04） |
| Reliability | 適用（Functional Design で具体化済み） | `fullscreenchange` への状態一本化（BR-F-05）・`dispose()` 時の自動解除（BR-F-08）で確定済み |
| Maintainability | UoW-A の決定を継続 | Lint/フォーマッタ・TypeScript strictness は変更なし |
| Usability / Accessibility | **N/A（UoW-F スコープ外）** | `FullscreenManager` 自体は可視要素を持たない。フルスクリーンボタンの aria-label 等は UoW-G の範囲（`unit-of-work-story-map.md`） |

## 2. 前提として再確認した確定済み NFR（変更なし）

UoW-A〜E `nfr-requirements.md` の内容がそのまま適用される。UoW-F 固有の追加確認は以下のみ。

| NFR | 内容 | UoW-F での扱い |
|---|---|---|
| NFR-09 | PBT 全面適用。状態管理が主対象候補 | `FullscreenManager` の状態遷移（`none`/`native`/`pseudo`）を PBT 対象とする（Q2） |
| NFR-10 | セキュリティ（安全なエラーメッセージ・確実なリソース解放） | `FULLSCREEN_FAILED`（BR-F-04）・`dispose()` 時の自動解除（BR-F-08）で具体化済み |
| NFR-11 | レジリエンシー（安全な縮退） | ネイティブ API 実行時失敗時は擬似モードへ自動フォールバックせず、明確なエラー通知に倒す（BR-F-04）という判断を維持 |

## 3. 本ステージで確定した技術スタック（サマリ）

詳細な選定理由は `tech-stack-decisions.md` を参照。

| # | 論点 | 決定 |
|---|---|---|
| Q1 | Fullscreen API のテスト境界・モック方式 | jsdom は Fullscreen API 未実装のため、非対応分岐はモック不要。対応分岐は `vi.fn()` によるテストごとのスタブ注入（UoW-A の WebGL モックと同じパターン） |
| Q2 | PBT 対象範囲 | `FullscreenManager` の状態遷移（`isActive()` と `mode` の一致・`enter()` の冪等性） |
| Q3 | 新規ランタイム依存 | なし |
| Q4 | `Renderer.resize()` のテスト境界 | 既存の `Renderer` テスト境界（WebGL2 コンテキストのモック）を再利用 |

## 4. 拡張ルール準拠サマリ

### Security Baseline

| ルール | 判定 | 根拠 |
|---|---|---|
| SECURITY-05（入力検証） | N/A | `enterFullscreen()`/`exitFullscreen()`/`isFullscreen()` はいずれも引数を取らず、検証対象の入力がない |
| SECURITY-09（内部詳細の非露出） | Compliant | `FULLSCREEN_FAILED`（BR-F-04）はブラウザの reject 理由をそのまま露出せず、安全な固定メッセージに正規化する（UoW-A `ErrorManager`/BR-A-13 の既存方針） |
| SECURITY-10（サプライチェーン） | Compliant（変更なし） | Q3 により新規依存を追加しないため、UoW-A で確定済みの lockfile/Dependabot/CI 監査方針がそのまま適用される |
| SECURITY-11（セキュア設計） | Compliant | 対応環境での実行時失敗（誤用に近いケース: ユーザー操作起点でない呼び出し等）を擬似モードへ自動的に倒さず、明確なエラーとして通知する設計（BR-F-04）を採用 |
| SECURITY-15（例外処理） | Compliant | BR-F-04（`error` 発火 + reject）・BR-F-08（`dispose()` 時の確実な解放）で具体化済み |

### Resiliency Baseline

| ルール | 判定 | 根拠 |
|---|---|---|
| RESILIENCY-01〜09, 11〜15 | N/A | UoW-A〜E と同じ理由 |
| RESILIENCY-10（過剰リトライ回避） | N/A | `FullscreenManager` はリトライを行う処理を持たない（失敗時は即座にエラー通知、BR-F-04） |

### Property-Based Testing

| ルール | 判定 | 根拠 |
|---|---|---|
| PBT 対象範囲の拡張 | Compliant | Q2 により `FullscreenManager` の状態遷移（`mode`/`isActive()`の整合性、`enter()`の冪等性）を PBT 対象として特定。NFR-09 の「状態管理」という主対象候補に対応 |
| PBT-10（ビジネスクリティカルパスの example-based 併設） | Compliant（方針継続） | ネイティブ/擬似の分岐・`FULLSCREEN_FAILED` の発火経路は Code Generation で example-based により個別に検証する |

## 5. Code Generation への申し送り事項

- `FullscreenManager` の状態遷移は PBT（fast-check）で不変条件を検証する（Q2）。ネイティブ/擬似の具体的な分岐・エラー発火経路は example-based で検証する。
- Fullscreen API のテストは、対応環境の分岐のみ `container.requestFullscreen`/`document.exitFullscreen` を `vi.fn()` でスタブし、`document.fullscreenElement` は `Object.defineProperty` で差し込む。非対応環境の分岐は jsdom の既定状態（未実装）をそのまま利用する（Q1）。
- `Renderer.resize()` は既存の `Renderer` テスト境界（`vi.spyOn(HTMLCanvasElement.prototype, "getContext")`）を再利用して検証する（Q4）。
- 新規パッケージ依存の追加は不要（Q3）。`packages/core/package.json` の変更は不要。
