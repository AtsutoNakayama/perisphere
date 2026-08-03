# NFR Design Patterns — UoW-B 画像入力・ロード

- **関連 Issue**: [#34](https://github.com/AtsutoNakayama/perisphere/issues/34)
- **作成日**: 2026-08-03
- **前提資料**: `uow-b-nfr-design-plan.md`（Q1〜Q3 回答・採用理由）、`construction/uow-b/functional-design/`

## 1. Resilience Patterns

### RP-B-1 Single-Attempt Load（自動リトライなし）

- **問題**: ネットワーク取得（`fetch`）が失敗した場合、自動的に再試行すべきか。
- **適用**: 自動リトライは行わない。1 回失敗したら即座に `IMAGE_LOAD_FAILED` として `error` を発火し、`Promise` を reject する（NFR Design Q1=A）。UoW-A の RP-3（Single-Attempt Recovery）と同じ思想。
- **効果**: 失敗の意味が明確（1 回の呼び出し＝1 回の結果）。呼び出し側が再試行したい場合は `loadImage` を再度呼べばよく、BR-B-08（多重呼び出し時は前回を中断して最新を優先）がそのまま「呼び出し側主導のリトライ」の経路として機能する。

### RP-B-2 Cancellation-over-Retry（中断優先）

- **問題**: `loadImage` の多重呼び出しをどう扱うか。
- **適用**: 新しい呼び出しが前回の進行中ロードを `AbortController` で中断する（BR-B-08、Functional Design で確定済み）。中断は失敗として扱わず、`error` イベントを発火しない。
- **効果**: ユーザーが素早く画像を切り替えるユースケースで、無駄なエラー通知や表示のちらつきを避けられる。

## 2. Scalability Patterns

**N/A**。`nfr-requirements.md` §1 で確認済み（クライアントサイドライブラリ）。

## 3. Performance Patterns

### PP-B-1 Throttled Progress Emission（進行通知のスロットリング）

- **問題**: `fetch` のストリームチャンクごとに素朴に `progress` を発火すると、高速回線・大容量画像で `EventBus` のハンドラが極めて高頻度に同期実行され（BR-A-07）、メインスレッドを占有しうる。
- **適用**: 前回の `progress` 発火から最低 50ms 経過している場合のみ発火する。ロード完了時（成功/失敗いずれも直前の状態変化）は、スロットリング中であっても必ず最終状態を反映する（成功時は `imageLoadState='ready'`、失敗時は `error` イベント。進行中の中間 `progress` はスロットリング対象だが、完了通知自体はスロットリングしない）（NFR Design Q2=A）。
- **効果**: ハンドラ呼び出し頻度の上限を保証しつつ、BR-B-07（発火回数・頻度を保証しない）とも矛盾しない実装レベルの配慮。

## 4. Security Patterns

UoW-A の Defense in Depth（SP-1）と同じ思想を、UoW-B では検証層の多層化として継続する。

### SP-B-1 Layered Validation（多層検証、SP-1 の継続）

- **問題**: 不正・扱えない画像入力を早期に、かつ確実に検出したい。
- **適用**: (1) `Loader.validate` による形式検証（BR-B-03） → (2) デコード後のアスペクト比検証（BR-B-04） → (3) デコード後の `maxTextureSize` 検証（BR-B-05）という 3 段階の検証を直列に実施する（Functional Design で確定済み、本ステージでの変更なし）。
- **本ステージでの判断**: 新規のセキュリティパターン論点はなし（NFR Design 確認済み）。

## 5. 検討したが採用しなかったパターン（Rejected Patterns）

| パターン | 不採用の理由 | 再検討の契機 |
|---|---|---|
| Automatic Retry with Backoff（自動リトライ＋バックオフ） | RESILIENCY-10（過剰リトライ回避）と UoW-A の RP-3 の方針に反する。失敗の意味が曖昧になる（NFR Design Q1=A の裏返し） | 実際に一時的なネットワーク瞬断による失敗報告が多発した場合 |
| 専用の状態機械（`ContextRecoveryState` 相当）による多重呼び出し管理 | 状態遷移が単純（進行中なら中断）なため、状態機械化のオーバーヘッドに見合わない（NFR Design Q3=A の裏返し） | 将来、キャンセル周りの状態が複雑化した場合（例: 一時停止/再開等） |
| スロットリングなしの素朴な `progress` 発火 | 高速回線・大容量画像でのメインスレッド占有リスク（NFR Design Q2=A の裏返し） | 実測でスロットリングの副作用（体感の遅延等）が問題になった場合 |
