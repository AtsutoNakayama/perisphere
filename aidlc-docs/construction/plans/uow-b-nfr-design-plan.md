# NFR Design Plan — UoW-B 画像入力・ロード

- **関連 Issue**: [#34](https://github.com/AtsutoNakayama/perisphere/issues/34)
- **作成日**: 2026-08-03
- **前提資料**: `construction/uow-b/nfr-requirements/`、`construction/uow-b/functional-design/`（特に BR-B-05〜08）

## 必須評価カテゴリの適用可否

| カテゴリ | 適用可否 | 判定根拠 |
|---|---|---|
| Resilience Patterns | 適用 | ネットワーク取得（`fetch`）の失敗時挙動、多重呼び出し時のキャンセル方式を扱う |
| Scalability Patterns | **N/A** | `nfr-requirements.md` §1 で確認済み（クライアントサイドライブラリ） |
| Performance Patterns | 適用 | `progress` イベントの発火頻度（大容量画像で高頻度になりうる） |
| Security Patterns | 適用（既存パターンの継続） | UoW-A の Defense in Depth（SP-1）を検証層（形式→デコード後寸法）にも適用する設計は Functional Design で確定済み。本ステージでの新規論点はなし（§ Q3 で確認） |
| Logical Components | 適用 | 多重呼び出しキャンセルの管理を専用コンポーネント化するか、`loadImage` 内のローカル状態で済ませるかを判断する |

## 確認質問（比較情報・推奨案を埋め込み済み）

### Q1. ネットワーク取得失敗時の自動リトライ

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 自動リトライしない。1 回失敗したら即座に `IMAGE_LOAD_FAILED` として通知する | UoW-A の RP-3（Single-Attempt Recovery、過剰リトライの回避）・RESILIENCY-10 の精神と一貫。呼び出し側は `loadImage` を再度呼べば良く、BR-B-08 の仕組みにより自然に「最新の呼び出しが有効」という単純なリトライ経路が既に用意されている |
| B | ネットワークエラー時に 1〜2 回、短い間隔を空けて自動リトライする | 一時的なネットワーク瞬断には強くなるが、失敗の意味が曖昧になる（何回目の失敗で通知するか）。UoW-A で明示的に採用しなかった「過剰リトライ」寄りの複雑さを持ち込む |

**採用理由**: 確定済みの RESILIENCY-10 の解釈（過剰リトライ回避）と一貫させる。呼び出し側による再試行（＝再度の `loadImage` 呼び出し）で十分にカバーできる。

[Answer]: A

### Q2. `progress` イベントの発火頻度制御

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 軽量なスロットリングを行う（例: 前回発火から最低 50ms 経過、または完了時は必ず発火） | `fetch` のストリームチャンクごとに素朴に発火すると、高速回線・大容量画像で `EventBus` のハンドラが極めて高頻度に呼ばれ、UI 側（将来の UoW-G 等）の再描画負荷につながりうる。BR-A-07（同期発火）と組み合わさるとメインスレッドを占有するリスクがある |
| B | スロットリングなし。チャンク受信のたびに素朴に発火する | 実装は単純だが、性能上の懸念がある。BR-B-07 は「発火回数・頻度を保証しない」としており、呼び出し側がスロットリングすべきという考え方もあるが、ライブラリ側で最低限の配慮をする方が親切 |

**採用理由**: BR-B-07 は頻度を保証しないと定めているため、実装は自由度があるが、極端な高頻度発火はライブラリ利用者の体験を損ないうる。軽量なスロットリングは実装コストが低く、リスクを下げる。

[Answer]: A

### Q3. 多重呼び出しキャンセルの管理方式

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 専用の論理コンポーネントは導入せず、`loadImage` のクロージャ内で `currentAbortController: AbortController \| null` を保持するローカル状態で済ませる | UoW-A の `ContextRecoveryState`（healthy/lost/recovering/degraded の 4 状態遷移）ほどの複雑さは無く、「進行中なら中断して新規開始」という単純な単一フィールドの入れ替えで表現できる（YAGNI） |
| B | UoW-A の `ContextRecoveryState` に倣い、明示的な状態機械（`idle/loading/cancelling` 等）を導入する | 状態遷移が単純（実質 1 種類の遷移: 進行中なら中断）なため、状態機械化のオーバーヘッドに見合わない |

**採用理由**: 状態遷移が単純な場合にまで状態機械を導入するのは過剰設計（UoW-A の NFR Design で確立した「時期尚早な最適化の回避」という判断軸と同じ）。

[Answer]: A

## Security Patterns（新規論点なし・確認のみ）

UoW-A の Defense in Depth（SP-1: 環境ガード→WebGL2 チェックの多層防御）と同じ思想を、UoW-B では「形式検証（`validate`）→ デコード後アスペクト比検証 → デコード後サイズ検証」という 3 段階の検証層として Functional Design（BR-B-03〜05）で既に確定している。本ステージでの追加のセキュリティパターン論点はないと判断する。

[Answer]: 確認済み・異論なければこのまま進める

## 比較検討サマリ

判断軸: (1) UoW-A で確立した「過剰な複雑さ・時期尚早な最適化を避ける」方針との一貫性（RP-3・状態機械化の要否判断）、(2) BR-B-07 が発火頻度を保証しないと定めている中でも、実利用者体験に配慮した最低限の防御（スロットリング）を入れるかどうかのトレードオフ、(3) YAGNI。

## 次のステップ（Step 6: 成果物生成、承認後）

- [x] `aidlc-docs/construction/uow-b/nfr-design/nfr-design-patterns.md`
- [x] `aidlc-docs/construction/uow-b/nfr-design/logical-components.md`
