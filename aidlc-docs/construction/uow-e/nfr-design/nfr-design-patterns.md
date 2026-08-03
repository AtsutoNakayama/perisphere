# NFR Design Patterns — UoW-E ギャラリー

- **関連 Issue**: [#40](https://github.com/AtsutoNakayama/perisphere/issues/40)
- **作成日**: 2026-08-03
- **前提資料**: `uow-e-nfr-design-plan.md`（Q1〜Q3 回答・採用理由）、`construction/uow-e/functional-design/`（BR-E-13 で本ステージの発見を反映済み）

## 1. Resilience Patterns

### RP-E-1 Pending-vs-Confirmed Pointer Separation（目標ポインタと表示中ポインタの分離）

- **問題**: `next()`/`prev()`/`goTo()` の連打（US-18）で、各回の呼び出しが確実に1つずつ先へ進むことをどう保証するか。また、リスト中に恒常的にロードが失敗する写真がある場合、どう回復するか。
- **適用**: `Gallery.current`（目標/pending）は呼び出しのたびに即座に前進させ、`ViewerState.photoIndex`（表示中/confirmed）はロード成功時にのみ更新する、という2つの独立したポインタとして扱う（`business-rules.md` BR-E-13、Q1=A）。
- **効果**: 連打時、各回の呼び出しがロード確定を待たずに目標を前進させるため、UoW-B の `RP-B-2 Cancellation-over-Retry`（中断優先）と組み合わさり「最終的に落ち着いた写真だけが表示される」体験が成立する。副次効果として、破損写真（恒常的に読み込みに失敗する写真）があっても、利用者が `next()` を押し続ければ目標ポインタは前進し続け、自動リトライやスキップ処理を実装せずとも「連打で通り過ぎて次の正常な写真へたどり着く」という回復性が自然に得られる。

### RP-E-2 既存パイプラインの再利用による継続（RP-B-1/RP-B-2 の継続）

- **問題**: 写真切替のロード失敗時、自動的に再試行すべきか。
- **適用**: UoW-B の `RP-B-1 Single-Attempt Load`（自動リトライなし、1回失敗したら即座に `error` 発火）をそのまま再利用する（`business-rules.md` BR-E-06）。写真切替専用の追加的なリトライ機構は持たない。
- **効果**: UoW-B と一貫した「失敗の意味が明確」という性質を写真切替にもそのまま引き継ぐ。再試行したい場合は `next()`/`prev()`/`goTo()` を再度呼べばよく、RP-E-1 の目標ポインタ前進がそのまま「利用者主導の再試行・スキップ」の経路として機能する。

## 2. Scalability Patterns

**N/A**。`nfr-requirements.md` §1 で確認済み（クライアントサイドライブラリ）。

## 3. Performance Patterns

**新規パターンなし**。`photochange` はロード成功確定後にのみ発火する低頻度イベント（ユーザーの明示操作起点）であり、`viewchange`/`zoomchange`（UoW-D `PP-D-1 Coalesced View Change Emission`）のような高頻度スロットリングは不要（`nfr-requirements.md` Performance 判定の通り）。写真切替の先読み（プリロード）も行わない（NFR Requirements Q1）。

## 4. Security Patterns

UoW-A の Defense in Depth（SP-1）と同じ思想を、UoW-E でも新規論点なく継続する。

### SP-E-1 既存の入力検証パターンの継続（SP-1 の継続）

- **問題**: `goTo(index)` への不正な明示指定をどう扱うか。
- **適用**: `goTo` の範囲外指定は `error`（`INVALID_INPUT`）へ正規化する（`business-rules.md` BR-E-05、UoW-A〜D と同じ「公開 API の誤用は `INVALID_INPUT` イベントへ正規化する」方針）。
- **本ステージでの判断**: 新規のセキュリティパターン論点はなし（NFR Design Q2=A）。

## 5. 検討したが採用しなかったパターン（Rejected Patterns）

| パターン | 不採用の理由 | 再検討の契機 |
|---|---|---|
| `Gallery.current` と `ViewerState.photoIndex` の単一値化（同期） | BR-E-09 が意図する「連打で複数先へ進む」挙動を満たせない可能性がある（NFR Design Q1=A の裏返し） | 実装がシンプルすぎる価値を優先したい場合（現時点では想定しない） |
| ロード失敗写真の自動スキップ（`next()` 内部で失敗を検出し次の写真へ自動的に進む） | RP-E-1 により「利用者が連打すれば自然に通り過ぎられる」ため、自動化する動機が薄い。自動スキップは「何枚先まで自動的に試すか」等の追加パラメータが必要になり、本ユニットのスコープに対して過剰（YAGNI） | 実際に「1回の `next()` で自動的に次の正常な写真まで進んでほしい」という要求が明確になった場合 |
| 写真切替専用のプリフェッチ/プリロード機構 | `nfr-requirements.md` Q1 で見送り済み（要件・ユニット定義に根拠がない） | 体感待ち時間の短縮が要求として明確になった場合 |
| index 計算の独立モジュール化（`viewMath.ts`/`projections/` 相当） | 複数呼び出し元での再利用という切り出しの動機が `Gallery` にはない（NFR Design Q3=A の裏返し） | 将来、`Gallery` 以外からも同じ index 計算を呼ぶ必要が生じた場合 |
