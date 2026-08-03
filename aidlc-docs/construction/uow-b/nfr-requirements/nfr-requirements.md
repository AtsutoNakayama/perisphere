# NFR Requirements — UoW-B 画像入力・ロード

- **関連 Issue**: [#34](https://github.com/AtsutoNakayama/perisphere/issues/34)
- **作成日**: 2026-08-03
- **前提資料**: `uow-b-nfr-requirements-plan.md`（Q1〜Q5 回答・採用理由）、`inception/requirements/requirements.md`（NFR-01〜12）、`construction/uow-b/functional-design/`、UoW-A `tech-stack-decisions.md`

## 1. NFR カテゴリ別評価

| カテゴリ | UoW-B での判定 | 詳細 |
|---|---|---|
| Scalability | **N/A** | UoW-A と同じ理由（クライアントサイドライブラリ、負荷分散の概念なし） |
| Performance | 適用（既確定 + Functional Design で具体化済み） | NFR-01（8K/60fps 目安）は Requirements で確定済み。8K 超の読み込み試行・WebGL 上限超過時のフォールバックは `business-rules.md` BR-B-05 で確定済み。詳細な性能チューニングは本ステージの対象外 |
| Availability | **N/A** | UoW-A と同じ理由（稼働サーバー・永続データストアなし） |
| Security | 適用（既確定 + 本ステージで具体化） | NFR-10（SECURITY-05 入力検証）を本ステージで具体化（§4）。URL スキームの安全性は Q5 で判断 |
| Tech Stack Selection | 本ステージで確定 | §2・§3・`tech-stack-decisions.md` 参照。大部分は UoW-A のモノレポ横断決定を継承 |
| Reliability | 適用（Functional Design で具体化済み） | ロード失敗時のフォールバック維持（BR-B-11）、多重呼び出し時のキャンセル（BR-B-08）は Functional Design で確定済み |
| Maintainability | UoW-A の決定を継承 | Lint/フォーマッタ・TypeScript strictness は変更なし |
| Usability / Accessibility | **N/A（UoW-B スコープ外）** | UoW-B は UI を持たない |

## 2. 前提として再確認した確定済み NFR（変更なし）

UoW-A `nfr-requirements.md` §2 の表と同じ内容が UoW-B にも適用される。UoW-B 固有の追加確認は以下のみ。

| NFR | 内容 | UoW-B での扱い |
|---|---|---|
| NFR-01 | 8K まで動作保証・上限なしで読み込みを試みる | `business-rules.md` BR-B-03/05 で確定済み |
| NFR-02 | 対象環境（WebGL2 前提） | `fetch`/`createImageBitmap`/`AbortController` は対象ブラウザ全てでネイティブサポート（追加確認不要、Q4 の前提） |
| NFR-10 | セキュリティ（入力検証等） | SECURITY-05 を本ステージで具体化（§4） |

## 3. 本ステージで確定した技術スタック（サマリ）

詳細な選定理由は `tech-stack-decisions.md` を参照。

| # | 論点 | 決定 |
|---|---|---|
| Q1 | `fetch`/`createImageBitmap` を含むロード処理のテスト境界 | `Loader` をモック境界化（UoW-A の `Renderer` モック化方針を継続） |
| Q2 | `fetch` のモック方法 | `globalThis.fetch` を `vi.fn()` で直接モック |
| Q3 | PBT 対象範囲拡張 | `EquirectangularSource` のアスペクト比境界値判定、`loadImage` 多重呼び出しキャンセルの不変条件を追加 |
| Q4 | 新規ランタイム依存 | なし（ネイティブ API + 既存 three.js peerDependency のみ） |
| Q5 | URL 入力への追加サニタイズ | 追加のスキーム検証は行わない（`fetch` 標準仕様に委ねる） |

## 4. 拡張ルール準拠サマリ

### Security Baseline

| ルール | 判定 | 根拠 |
|---|---|---|
| SECURITY-05（入力検証） | Compliant | `business-rules.md` BR-B-01（型制約）・BR-B-03（形式検証）・BR-B-04（アスペクト比検証）で具体化済み |
| SECURITY-09（内部詳細の非露出） | Compliant | BR-B-12 のエラーコード対応表が UoW-A BR-A-13 の方針（安全なメッセージのみ）を継承 |
| SECURITY-10（サプライチェーン） | Compliant（変更なし） | Q4 により新規依存を追加しないため、UoW-A で確定済みの lockfile/Dependabot/CI 監査方針がそのまま適用される |
| SECURITY-11（セキュア設計） | Compliant | Q5 の判断（`fetch` 標準仕様への委任、スキーム制限の不追加）を、成立しない脅威（SSRF）への過剰実装を避けた設計判断として記録 |
| SECURITY-15（例外処理） | Compliant | BR-B-13/14（縮退ハンドル・dispose 後の `loadImage`）で確定済み |

### Resiliency Baseline

| ルール | 判定 | 根拠 |
|---|---|---|
| RESILIENCY-01〜09, 11〜15 | N/A | UoW-A と同じ理由 |
| RESILIENCY-10（過剰リトライ回避） | Compliant | BR-B-08（多重呼び出しは中断して最新のみ実行、リトライではなくキャンセル） |

### Property-Based Testing

| ルール | 判定 | 根拠 |
|---|---|---|
| PBT 対象範囲の拡張 | Compliant | Q3 によりアスペクト比境界値判定・多重呼び出しキャンセルの不変条件を追加特定 |
| PBT-10（ビジネスクリティカルパスの example-based 併設） | Compliant（方針継続） | ロード成功/失敗の主要シナリオは Code Generation で example-based により個別検証する |

## 5. Code Generation への申し送り事項

- `Loader`（`fetch`/`createImageBitmap` 呼び出し層）をテスト境界としてモック化する（Q1/Q2）。
- 新規パッケージ依存の追加は不要（Q4）。`packages/core/package.json` の変更は不要。
- PBT 対象: `EquirectangularSource` のアスペクト比判定（境界値）、`loadImage` の多重呼び出しキャンセル（Q3）。
