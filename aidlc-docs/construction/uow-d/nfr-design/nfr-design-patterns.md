# NFR Design Patterns — UoW-D 視点操作・入力

- **関連 Issue**: [#38](https://github.com/AtsutoNakayama/perisphere/issues/38)
- **作成日**: 2026-08-03
- **前提資料**: `uow-d-nfr-design-plan.md`（Q1〜Q4 回答・採用理由）、`construction/uow-d/functional-design/`、`construction/uow-d/nfr-requirements/`

## 1. Resilience Patterns

### RP-D-1 Graceful Pointer Capture Fallback（ポインタキャプチャ失敗時の劣化）

- **問題**: `PointerInputSource` がドラッグ追跡の安定化に用いる `setPointerCapture` は、要素が DOM に未接続なタイミング等で稀に失敗しうる（NFR Design Q1）。
- **適用**: `setPointerCapture` の呼び出しを `try/catch` で囲む。失敗しても例外を伝播させず、通常の `pointermove`/`pointerup`（要素内でのみ追跡）にフォールバックする。要素外へドラッグが出た場合のみ追跡が途切れる劣化に留め、ビューワー全体（他モード・他入力源）には影響させない。UoW-A の RP-1（Graceful Degradation）と同じ思想。
- **効果**: `setPointerCapture` の失敗がビューワー全体の初期化失敗やクラッシュに波及しない。

## 2. Scalability Patterns

**N/A**。`nfr-requirements.md` §1 で確認済み（クライアントサイドライブラリ）。

## 3. Performance Patterns

### PP-D-1 Coalesced View Change Emission（視点変更イベントの集約発火）

- **問題**: `pointermove`/`touchmove`/`wheel` は1フレーム内に複数回発火しうる。素朴に毎回 `viewchange`/`zoomchange` を発火すると、`EventBus` のハンドラ（将来の UoW-G 等）が高頻度に同期実行され、メインスレッドを占有しうる（NFR-01 の 60fps 目安に対するリスク）。
- **適用**: `ViewController` は `ViewState` が変化するたびに内部の「発火保留（pending）」フラグを立てるのみとし、実際のイベント発火は行わない。UoW-A から常時稼働している `Renderer` の描画ループ（`startLoop`、既存の `requestAnimationFrame` ループ）の各フレームで、pending フラグが立っていれば最新の `ViewState` で `viewchange`（と `fov` が変化していれば `zoomchange`）を1回だけ発火し、フラグを下ろす。専用の独立した `requestAnimationFrame` ループは追加しない（NFR Design Q2）。
- **描画反映との分離**: カメラ/シェーダへの実際の反映（`currentMode.updateView(ctx, view)`）はこの集約とは独立して intent 受信のたびに即座に行う。滑らかな描画（NFR-01）はここが担保する。
- **効果**: `viewchange`/`zoomchange` の発火は最大でも「1フレームにつき1回」に抑えられる。UoW-B の PP-B-1（Throttled Progress Emission）とは異なり時間ベースの間引き（50ms 等）ではなく、既存の描画ループへ相乗りするフレームベースの集約である点が UoW-D 固有の実装。

## 4. Security Patterns

### 継続確認（新規論点なし）

- `setView`/`setZoomLimits` の入力検証（`Number.isFinite`・`minFov < maxFov`、不正時は `INVALID_INPUT`、NFR Requirements Q5 で確定済み）は、UoW-A/UoW-B で確立した Defense in Depth（境界での検証・不正入力の明確なエラー化）の継続である。本ステージでの新規セキュリティパターンの追加はない（NFR Design Q3、UoW-C `nfr-design-patterns.md` §4 と同じ判断）。

## 5. 検討したが採用しなかったパターン（Rejected Patterns）

| パターン | 不採用の理由 | 再検討の契機 |
|---|---|---|
| 視点操作専用の独立 `requestAnimationFrame` ループ | 既存の常時描画ループ（UoW-A `startLoop`）へ相乗りするだけで同じ効果が得られ、開始/停止のライフサイクル管理という追加の複雑さを避けられる（NFR Design Q2=A の裏返し） | 将来、描画ループ自体をオンデマンド化（非ドラッグ中は停止）する設計変更が入った場合、再設計が必要になる |
| `setPointerCapture` 失敗時に例外を伝播させビューワー初期化を失敗として扱う | ドラッグ追跡の劣化に過ぎず、ビューワー全体を止めるほどの重大度ではない（NFR Design Q1=A の裏返し） | 実際に多くの環境で失敗が頻発し、劣化状態のままでは UX 上問題になる場合 |
| `setView`/`setZoomLimits` 専用の追加検証層（レート制限等） | 入力は数値範囲の検証で十分であり、呼び出し頻度への対処は PP-D-1 で別途行っている（NFR Design Q3=A の裏返し） | 悪意あるスクリプトによる高頻度呼び出しが実害を出した場合（ただしライブラリの信頼境界内であり優先度は低い） |
