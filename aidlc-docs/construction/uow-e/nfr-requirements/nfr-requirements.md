# NFR Requirements — UoW-E ギャラリー

- **関連 Issue**: [#40](https://github.com/AtsutoNakayama/perisphere/issues/40)
- **作成日**: 2026-08-03
- **前提資料**: `uow-e-nfr-requirements-plan.md`（Q1〜Q4 回答・採用理由）、`inception/requirements/requirements.md`（NFR-01〜12）、`construction/uow-e/functional-design/`、UoW-A/UoW-B/UoW-D `tech-stack-decisions.md`

## 1. NFR カテゴリ別評価

| カテゴリ | UoW-E での判定 | 詳細 |
|---|---|---|
| Scalability | **N/A** | UoW-A〜D と同じ理由（クライアントサイドライブラリ、負荷分散の概念なし） |
| Availability | **N/A** | UoW-A〜D と同じ理由（稼働サーバー・永続データストアなし） |
| Performance | 適用（本ステージで確定） | プリロードは行わずオンデマンドロードとする（Q1）。テクスチャ反映・8K 動作保証は UoW-B の既存パイプライン再利用（`business-rules.md` BR-E-06）でカバー済み |
| Security | 適用（Functional Design で具体化済み + 本ステージで確認） | `goTo` の範囲外検証（BR-E-05、`INVALID_INPUT`）で SECURITY-05 を満たす。`PhotoInput.id` は perisphere 内部で解釈しない不透明な識別子のため追加のサニタイズは行わない |
| Reliability | 適用（Functional Design で具体化済み） | ロード失敗時のフォールバック（BR-E-08）・連続呼び出し時のキャンセル（BR-E-09）は確定済み。本ステージでの追加確認事項なし |
| Maintainability | UoW-A の決定を継続 | Lint/フォーマッタ・TypeScript strictness は変更なし |
| Usability / Accessibility | **N/A（UoW-E スコープ外）** | `Gallery` 自体は可視要素を持たない。US-24 の標準 UI・アクセシビリティ対応は UoW-G の範囲（`unit-of-work-story-map.md`） |

## 2. 前提として再確認した確定済み NFR（変更なし）

UoW-A〜D `nfr-requirements.md` の内容がそのまま適用される。UoW-E 固有の追加確認は以下のみ。

| NFR | 内容 | UoW-E での扱い |
|---|---|---|
| NFR-09 | PBT 全面適用。投影計算・座標変換・**状態管理（ギャラリー・モード切替）**が主対象候補 | `Gallery.next()`/`prev()`/`goTo()` の不変条件を PBT 対象とする（Q3） |
| NFR-10 | セキュリティ（公開 API の入力検証） | `goTo` の範囲外検証（BR-E-05）で具体化済み |
| NFR-11 | レジリエンシー（過剰リトライ回避等） | `AbortController` によるキャンセル（BR-E-09、リトライではなく中断）で具体化済み |

## 3. 本ステージで確定した技術スタック（サマリ）

詳細な選定理由は `tech-stack-decisions.md` を参照。

| # | 論点 | 決定 |
|---|---|---|
| Q1 | 写真切替時の先読み（プリロード）方針 | 行わない。オンデマンドロード（`loadImage()` と同じ方式） |
| Q2 | 写真切替オーケストレーションのテスト境界 | `Gallery` は依存なしで直接テスト。ロード処理は UoW-B の既存モック方針（`Loader` 境界化・`fetch` を `vi.fn()`）を再利用 |
| Q3 | PBT 対象範囲 | `Gallery.next()`/`prev()`/`goTo()` の不変条件（index 範囲・巡回・範囲外判定） |
| Q4 | 新規ランタイム依存 | なし |

## 4. 拡張ルール準拠サマリ

### Security Baseline

| ルール | 判定 | 根拠 |
|---|---|---|
| SECURITY-05（入力検証） | Compliant | `business-rules.md` BR-E-05（`goTo` の範囲外検証、`INVALID_INPUT`）で具体化済み |
| SECURITY-09（内部詳細の非露出） | Compliant（変更なし） | UoW-A `ErrorManager` の既存方針をそのまま利用（`error` イベントは安全なメッセージのみ） |
| SECURITY-10（サプライチェーン） | Compliant（変更なし） | Q4 により新規依存を追加しないため、UoW-A で確定済みの lockfile/Dependabot/CI 監査方針がそのまま適用される |
| SECURITY-11（セキュア設計） | Compliant | `PhotoInput.id` を perisphere 内部で解釈しない不透明値として扱う判断（過剰検証を避ける）を記録 |
| SECURITY-15（例外処理） | Compliant | BR-E-08（ロード失敗時は `error` のみ発火し状態を維持）で確定済み |

### Resiliency Baseline

| ルール | 判定 | 根拠 |
|---|---|---|
| RESILIENCY-01〜09, 11〜15 | N/A | UoW-A〜D と同じ理由 |
| RESILIENCY-10（過剰リトライ回避） | Compliant | BR-E-09（連続呼び出しは `AbortController` で中断、リトライではなくキャンセル。UoW-B `BR-B-08` の再利用） |

### Property-Based Testing

| ルール | 判定 | 根拠 |
|---|---|---|
| PBT 対象範囲の拡張 | Compliant | Q3 により `Gallery` の index 管理（巡回・範囲外判定）を PBT 対象として特定。NFR-09 が名指しした「ギャラリー」状態管理に直接対応 |
| PBT-10（ビジネスクリティカルパスの example-based 併設） | Compliant（方針継続） | 写真切替の成功/失敗分岐（BR-E-07/08）は Code Generation で example-based により個別に検証する |

## 5. Code Generation への申し送り事項

- `Gallery` は外部依存を持たない純粋なクラスとして実装し、PBT（fast-check）で index 不変条件を検証する（Q3）。
- 写真切替のロード処理は UoW-B の既存モック方針（`Loader` 境界化）をそのまま再利用する（Q2）。新規パッケージ依存の追加は不要（Q4）。`packages/core/package.json` の変更は不要。
- プリロード（先読み）は実装しない（Q1）。
