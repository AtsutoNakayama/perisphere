# NFR Design Patterns — UoW-H React アダプタ

- **関連 Issue**: [#46](https://github.com/AtsutoNakayama/perisphere/issues/46)
- **作成日**: 2026-08-04
- **前提資料**: `uow-h-nfr-design-plan.md`（Q1〜Q3 回答・採用理由）、`construction/uow-h/functional-design/`

## 1. Resilience Patterns

### RP-H-1 Silent Best-Effort Load（props 駆動 `loadImage()` の `Promise` reject の静かな握りつぶし）

- **問題**: `image` prop（`photos` 未指定時）から自動的に呼ばれる `loadImage()` は失敗時に `Promise` を reject する（UoW-B `BR-B-11`）。呼び出し元が処理しないと未処理の Promise rejection になる。
- **適用**: `loadImage(image).catch(() => {})` を付与する（`business-logic-model.md` P4、Q1=A）。失敗理由は `error`/`onError`（`business-rules.md` BR-H-10）で既に利用側へ通知済みのため、ここでは未処理 rejection を防ぐだけの役割とする。
- **効果**: UoW-F `RP-F-1 Silent Best-Effort Cleanup`・UoW-G `RP-G-1 Silent Best-Effort Action` と同じ「関心のない失敗は握りつぶす（通知は別経路で済んでいる）」思想を、props 駆動の非同期呼び出しにも一貫して適用する。
- **適用対象外**: `setPhotos`/`setMode`（`business-logic-model.md` P4）はいずれも同期 API で `Promise` を返さないため対象外。

## 2. Scalability Patterns

**N/A**。`nfr-requirements.md` §1 で確認済み（クライアントサイドライブラリ）。

## 3. Performance Patterns

**新規パターンなし**。`nfr-requirements.md` Performance 判定の通り、イベント購読は mount 時1回のみ（BR-H-09）、props 反映は参照比較の `useEffect`（BR-H-06）。UoW-D `PP-D-1`（高頻度イベントの間引き）に相当する高頻度発火のホットパスは存在しない。

## 4. Security Patterns

**新規パターンなし**。`nfr-requirements.md` Security 判定の通り、本ユニットは利用側から渡された文字列を DOM へ描画する処理を持たない（`UITextMap` の描画は UoW-G の責務）。UoW-G `SP-G-1 Safe Text Rendering` に相当する対象が本ユニットには存在しない。

## 5. Logical Components

### LC-H-1 純粋関数の独立モジュール化

- **問題**: `resolveInitialSource`/`extractViewerOptions`/`toCallbackPayload`（NFR Requirements Q4 で PBT 対象と確定済み）をどこに配置するか。
- **適用**: `packages/react/src/internal.ts` に3関数をまとめて配置する。`Perisphere.tsx`/`usePerisphere.ts` から import して使う（Q2=A）。UoW-G `controlsLogic.ts`（DOM/jsdom を介さない高速な PBT 実行が動機）と同じ分離動機を踏襲する。

### LC-H-2 イベントブリッジ処理は同一ファイル内のプライベートフックに留める

- **問題**: 8種のイベント購読・`ref` による最新コールバック保持（`business-logic-model.md` P3）を独立ファイルへ切り出すか。
- **判断**: UoW-E `Gallery`（NFR Design Q3=A）の「単一呼び出し元・再利用の見込みなしなら切り出さない」という基準がそのまま当てはまる。React 依存（`useEffect`/`useRef`）のコードで PBT 対象にもならないため、独立ファイル化の実益がない。`Perisphere.tsx` 内のプライベートカスタムフック `useEventBridge(handle, props)` として実装する（Q3=A）。

## 6. 検討したが採用しなかったパターン（Rejected Patterns）

| パターン | 不採用の理由 | 再検討の契機 |
|---|---|---|
| `loadImage()` の reject を `onError` とは別に何らかの形で再通知する | `error`/`onError` で既に通知済みであり、二重通知になる（RP-H-1 の裏返し） | 該当なし |
| `resolveInitialSource`/`extractViewerOptions`/`toCallbackPayload` を `Perisphere.tsx` 内のプライベート関数に留める | NFR Requirements Q4 で「PBT の対象とする」ことが確定済みで、コンポーネントファイル内に留めるとテストから import できない（LC-H-1 の裏返し） | 該当なし |
| `useEventBridge` を独立ファイルへ切り出す | 呼び出し元が `Perisphere` コンポーネントのみで、再利用・PBT 対象化のいずれの実益もない（LC-H-2 の裏返し） | 将来、他のフレームワークアダプタ（UoW-H-F）が同種のイベントブリッジ処理を必要とし、共有モジュール化の実益が生まれた場合 |
