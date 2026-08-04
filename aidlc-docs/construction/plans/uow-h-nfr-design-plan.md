# NFR Design Plan — UoW-H React アダプタ

- **関連 Issue**: [#46](https://github.com/AtsutoNakayama/perisphere/issues/46)
- **作成日**: 2026-08-04
- **前提資料**: `construction/uow-h/nfr-requirements/`、`construction/uow-h/functional-design/`

## 必須評価カテゴリの適用可否

| カテゴリ | 適用可否 | 判定根拠 |
|---|---|---|
| Resilience Patterns | 適用（本ステージで確認、Q1） | `business-logic-model.md` P4（`image`/`photos`/`mode` の反映）で呼ぶ `loadImage()` は `Promise` を返し失敗時に reject する（UoW-B `BR-B-11`）。props 変更から自動的に呼ばれるため、`.catch()` の要否を確認する |
| Scalability Patterns | **N/A** | `nfr-requirements.md` §1 で確認済み（クライアントサイドライブラリ） |
| Performance Patterns | **新規パターンなし** | `nfr-requirements.md` Performance 判定の通り、イベント購読は mount 時1回のみ、props 反映は参照比較の `useEffect`。UoW-D `PP-D-1` に相当する高頻度発火の間引きは不要 |
| Security Patterns | **新規パターンなし** | `nfr-requirements.md` Security 判定の通り、本ユニットは利用側文字列を DOM へ描画しない。UoW-G `SP-G-1` に相当する対象が存在しない |
| Logical Components | 適用（本ステージで確認、Q2・Q3） | `packages/react/src/` 配下のモジュール分割粒度（純粋関数3つの配置場所、イベントブリッジ処理の抽出要否）を確定する |

## 確認質問（比較情報・推奨案を埋め込み済み）

### Q1. `loadImage()` の `Promise` reject への対処（Resilience）

`business-logic-model.md` P4 は `photos` 未指定・`image` 指定時に `loadImage(image)` を呼ぶ。`loadImage()` は失敗時に `error` イベントを発火しつつ `Promise` を reject する（UoW-B `BR-B-11`）。呼び出し元（本ユニットの `useEffect`）が reject を処理しないと、未処理の Promise rejection になりうる。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `loadImage(image).catch(() => {})` を付与し、reject されても静かに無視する。失敗理由は `error`/`onError`（コールバックブリッジ、BR-H-10）で既に利用側へ通知済みのため、ここでは未処理 rejection を防ぐだけの役割とする（UoW-F `RP-F-1`/UoW-G `RP-G-1` と同じ Silent Best-Effort 思想） | UoW-F（`enterFullscreen`/`exitFullscreen`）・UoW-G（同左）で確立済みの「失敗は既に `error` イベントで通知されているため、呼び出し元では黙って無視する」というパターンを、props 駆動の `loadImage()` 呼び出しにも一貫して適用する |
| B | `.catch()` を付与せず、呼び出し元（利用側アプリケーション）が未処理 rejection の警告に対処する前提とする | 開発者コンソールに意図しない `Unhandled Promise Rejection` 警告が出続け、`onError` で正しく通知を受け取っているにもかかわらず利用側に不要な混乱を与える |

**理由**: 本ユニットで初めて「props の変更から自動的に非同期 API を呼ぶ」ケースが登場するため、確立済みパターンの適用可否を確認する。

**採用理由**: 既存パターンとの一貫性を優先する A を採用する。

[Answer]: A

### Q2. 純粋関数（`resolveInitialSource`/`extractViewerOptions`/`toCallbackPayload`）の配置場所（Logical Components）

NFR Requirements Q4 で、これら3関数を React/DOM から独立した純粋関数として実装し PBT 対象とすることは確定済み。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `packages/react/src/internal.ts` に3関数をまとめて配置する。`Perisphere.tsx`（コンポーネント本体）・`usePerisphere.ts`（フック）はこのモジュールを import して使う。UoW-G `controlsLogic.ts`（DOM/jsdom を介さない高速な PBT 実行が動機）と同じ分離動機を踏襲する | NFR Requirements Q4 で「React/DOM から独立した純粋関数」とすることが既に確定しているため、独立ファイルへの分離はその決定を素直に反映したもの。UoW-D `viewMath.ts`・UoW-G `controlsLogic.ts` と同じ「計算は純粋関数、副作用は呼び出し元」という設計方針とも一貫する |
| B | `Perisphere.tsx` 内にプライベート関数として定義する | NFR Requirements Q4 で「PBT の対象とする」ことが確定済みだが、コンポーネントファイル内のプライベート関数は外部（テストファイル）から import できず、PBT テストの記述が困難になる |

**理由**: NFR Requirements で確定済みの「純粋関数として実装する」方針を、実際のモジュール構成へどう落とし込むかを確認する。

**採用理由**: PBT テストの実施可能性を優先する A を採用する。

[Answer]: A

### Q3. イベントブリッジ処理の抽出要否（Logical Components）

`business-logic-model.md` P3（8種のイベント購読、`ref` による最新コールバック保持）は、`Perisphere` コンポーネント内の1つの `useEffect` にまとめて実装できる分量だが、UoW-A〜G は複数の関心事が混ざる処理を専用のヘルパー関数/モジュールへ分離する傾向がある。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 専用モジュールへは分離せず、P3 のロジック（8種の `on`/`off`・`ref` への callback 代入）は `Perisphere.tsx` 内のカスタムフック `useEventBridge(handle, props)`（同一ファイル内のプライベート関数）として実装する。別ファイルへの切り出しは行わない | P3 は「`ViewerHandle`（引数）と `PerisphereProps` の8つの `onXxx` を結びつけるだけ」の単純な処理で、UoW-E `Gallery`（NFR Design Q3=A）が示した「単一呼び出し元なら独立ファイルへ切り出さない」という基準がそのまま当てはまる（呼び出し元は `Perisphere` コンポーネントのみ、再利用の見込みがない）。`toCallbackPayload`（Q2 で `internal.ts` に分離済み）を呼び出す薄い接着層に留まる |
| B | `packages/react/src/useEventBridge.ts` として独立ファイルに切り出す | UoW-G の `controlsLogic.ts` 分離とは動機が異なる（あちらは「DOM から独立した PBT 対象の純粋関数」が動機）。`useEventBridge` は `useEffect`/`useRef` という React 依存のコードであり、PBT 対象にもならないため、独立ファイル化の実益（テスト容易性・再利用性）がなく、ファイル数を増やすだけになる |

**理由**: UoW-E の「単一呼び出し元なら切り出さない」という判断基準が、動機の異なる本ユニットの状況にもそのまま当てはまるかを確認する。

**採用理由**: 実益のない分離を避ける A を採用する。

[Answer]: A

## 比較検討サマリ

判断軸: (1) 本ユニットで初めて登場する「props 駆動の非同期 API 呼び出し」（`loadImage()`）にも、UoW-F/UoW-G で確立済みの Silent Best-Effort パターンを一貫して適用する（Q1）、(2) NFR Requirements で確定済みの「PBT 対象の純粋関数」という決定を、実際に import 可能な独立モジュールへ落とし込む（Q2）、(3) UoW-E が示した「単一呼び出し元・再利用の見込みなしなら切り出さない」という基準を、動機の異なるケース（React 依存コード）にも一貫して適用する（Q3）。

## 次のステップ（Step 6: 成果物生成、承認後）

- [ ] `aidlc-docs/construction/uow-h/nfr-design/nfr-design-patterns.md`
- [ ] `aidlc-docs/construction/uow-h/nfr-design/logical-components.md`
