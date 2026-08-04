# NFR Requirements Plan — UoW-H React アダプタ

- **関連 Issue**: [#46](https://github.com/AtsutoNakayama/perisphere/issues/46)
- **作成日**: 2026-08-04
- **前提資料**: `construction/uow-h/functional-design/`、`inception/requirements/requirements.md`（NFR-01〜12）、UoW-A〜G `tech-stack-decisions.md`（モノレポ横断決定は継承）

## NFR カテゴリ別評価

| カテゴリ | UoW-H での判定 | 詳細 |
|---|---|---|
| Scalability | **N/A** | クライアントサイドライブラリであり、負荷分散・水平スケーリングの概念が存在しない（UoW-A〜G と同様） |
| Availability | **N/A** | 稼働サーバー・永続データストアなし（UoW-A〜G と同様） |
| Performance | 適用（Functional Design で具体化済み・追加確認不要） | イベント購読は mount 時1回のみ（BR-H-09）、props 変更の反映は参照比較による `useEffect`（BR-H-06）で、UoW-D `onFrame` のような毎フレーム発火のホットパスは存在しない |
| Security | **N/A**（本ユニット固有の新規論点なし） | 本ユニットは利用側から渡された文字列を DOM へ描画する処理を持たない（`UITextMap` の描画は UoW-G の責務であり、`container` 配下に `ControlsUI` が独立に構築する）。React 自体が JSX のテキスト展開時に自動エスケープするため、UoW-G のような `textContent`/`setAttribute` 限定方針を新たに定める必要はない。サプライチェーン対策（lockfile・`pnpm audit`・Dependabot）は UoW-A で導入済みのものを継続適用する |
| Reliability | 適用（Functional Design で具体化済み・追加確認不要） | `dispose()` の冪等性への依拠（BR-H-03）、StrictMode 二重実行の許容（BR-H-03）、unmount 時の確実な購読解除・破棄（BR-H-11）で確定済み |
| Maintainability | 本ステージで確認（Q3） | React hooks 専用の静的検査（`exhaustive-deps` 等）を導入するかどうか |
| Usability / Accessibility | **N/A** | 本ユニットが新規にレンダリングする DOM はルート `<div>` 1つのみで、インタラクティブ要素・文言を持たない（`frontend-components.md`）。アクセシビリティ対応（NFR-04, US-35）は UoW-G の責務範囲 |
| Tech Stack Selection | 本ステージで確認 | React/react-dom の対象バージョン範囲（Q1）、コンポーネントテストツール（Q2）、React hooks lint（Q3）、PBT 適用対象（Q4）、新規ランタイム依存の要否（Q5） |

## 確認質問（比較情報・推奨案を埋め込み済み）

### Q1. React/react-dom の対象バージョン範囲（`peerDependencies`）

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `peerDependencies` に `react`/`react-dom` を `>=18.0.0 <20.0.0`（React 18・19 系列を許容）として指定する。具体的な下限バージョンは Code Generation 着手時点の最新安定版を確認して確定する（`three.js` と同じ「広めの range・Code Generation 時に具体化」方針、NFR-06 の延長） | `Perisphere` の実装方針（Q2 で確定済み: `React.forwardRef` + `useImperativeHandle`）は React 18・19 いずれでも同一に動作するため、意図的にサポート範囲を狭める理由がない。NFR-06 の依存最小化・広め range 方針と一貫する |
| B | React 19 系列のみサポートする（`>=19.0.0 <20.0.0`） | 新しい API に絞れるが、`forwardRef` 方式は React 18 でも問題なく動作するにもかかわらず React 18 利用者を早期に切り捨てることになり、NFR-06 の方針にもそぐわない |

**理由**: `@perisphere/react` の利用可能な React バージョン範囲は公開 API の一部であり、破壊的変更に相当するため確認する。

**採用理由**: 広め range を優先する A を採用する。

[Answer]: A

### Q2. React コンポーネントのテストツール

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `@testing-library/react` を新規 devDependency として追加し、既存の `vitest` + `jsdom`（モノレポ共通決定、UoW-A）と組み合わせて `render`/`act`/`cleanup` を利用する | React コンポーネントテストの業界標準ツールで、DOM のマウント/アンマウント・`act()` によるエフェクトのフラッシュ・各テスト後の自動 `cleanup` を提供し、テスト記述量を削減する。UoW-A〜G が確立した「テストは各ケースで必要な初期状態を明示的に作る」独立性の方針とも相性が良い |
| B | `@testing-library/react` を追加せず、`react-dom/client` の `createRoot`/`act` を直接使い、DOM のマウント・アンマウント・クリーンアップを自前で実装する | 依存追加を避けられるが、mount/unmount のたびに手動でコンテナ要素の生成・破棄・`act()` のラップを書く必要があり、UoW-A〜G のテスト密度（300件超）を本ユニットでも維持するには保守コストが増す |

**理由**: React コンポーネントテストにおける新規テスト依存の追加要否を確認する。

**採用理由**: 標準的で保守コストの低い A を採用する。

[Answer]: A

### Q3. React hooks 専用の静的検査

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `eslint-plugin-react-hooks`（`rules-of-hooks`/`exhaustive-deps`）を新規 devDependency として導入する。BR-H-09（イベントコールバック購読用 `useEffect` の依存配列を意図的に `[]` とする、`ref` で最新値を参照する設計）のように意図的にルールへ違反する箇所には、理由を示すインラインコメント付きで `eslint-disable-next-line` を明記する | hooks の誤用（条件付き呼び出し、依存配列の漏れ）を機械的に検出できる業界標準ツールで、UoW-A〜G の「ESLint + Prettier」方針を React コードに自然に拡張したもの。意図的な例外は理由コメント付きで明示するため、`exhaustive-deps` の警告と設計判断（BR-H-09）を混同しない |
| B | 導入せず、既存の `eslint.config.js`（React 非依存の汎用ルール）のみを適用する | 依存追加を避けられるが、本ユニットで初めて登場する React hooks 特有の誤用リスク（依存配列漏れ等）を静的検査なしで運用することになる |

**理由**: 本ユニットで初めて React hooks を使用するため、専用の静的検査を導入するかどうかを確認する。

**採用理由**: hooks 誤用の機械的検出を優先する A を採用する。

[Answer]: A

### Q4. PBT 適用対象（NFR-09 継続・全面適用方針）

本ユニットは薄いブリッジ層だが、決定的な入出力を持つ小さな純粋関数が3つ識別できる（`business-rules.md` BR-H-05/BR-H-08/BR-H-10 に対応）。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 以下3つを React/DOM から独立した純粋関数として実装し、fast-check（UoW-A で確定済み）による PBT の対象とする。<br>① `resolveInitialSource(image, photos)`（BR-H-05）: `photos` が非 `undefined` なら常に `{ kind: "photos" }`、`photos` が `undefined` かつ `image` が非 `undefined` なら `{ kind: "image" }`、両方 `undefined` なら `{ kind: "none" }`<br>② `extractViewerOptions(props)`（BR-H-08）: 戻り値に `image`/`photos`/`mode`/`className`/`style`/`onXxx`（8種）のキーが含まれない、それ以外の任意のキーはそのまま保持される<br>③ `toCallbackPayload(event)`（BR-H-10）: `error` 以外の全イベントで戻り値に `type` キーが含まれない、`error` の場合は `event.error` がそのまま返る | 投影計算・座標変換のような複雑さはないが、いずれも「入力の性質に応じて出力の形が決定的に定まる」検証可能な不変条件を持つ関数であり、Property-Based Testing 拡張の全面適用方針（PBT-03: 不変条件）のもとで対象とするのが一貫する。UoW-D `viewMath.ts` と同じ「計算は純粋関数、副作用は呼び出し元」という設計方針にも合致する |
| B | 分岐が少ない（2〜3分岐）ため example-based テストのみで十分とし、PBT を適用しない | 実装・検証コストは下がるが、Property-Based Testing 拡張は「全面適用」で選択されており（`aidlc-state.md` Extension Configuration）、分岐数の少なさを理由に対象から除外する基準は他ユニットとの一貫性を欠く |

**理由**: 全面適用方針のもとで、本ユニット固有の小さな決定的関数群を PBT 対象に含めるべきか確認する。

**採用理由**: 全面適用方針との一貫性を優先する A を採用する。

[Answer]: A

### Q5. 新規ランタイム依存の要否

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `@perisphere/core`（ワークスペース内依存）と `react`/`react-dom`（`peerDependencies`）以外、新規ランタイム依存を追加しない | UoW-A〜G から継続する「必要最小限の依存」方針（YAGNI, NFR-06）に合致する |
| B | 何らかのユーティリティライブラリ（イベント購読ヘルパー等）を導入する | 本ユニットの規模（薄いブリッジ層）に対して過剰。「サービスを再実装しない」方針（`services.md`）や CLAUDE.md の過剰設計禁止にも反する |

**理由**: 型定義・パッケージ構成への影響がないか確認する既存の定型質問。

**採用理由**: 既存方針の継続。

[Answer]: A

## 比較検討サマリ

判断軸: (1) `three.js` と同じ「広め range・Code Generation 時に具体化」という NFR-06 の依存方針を React にも適用する、(2) UoW-A〜G が確立した「ESLint + Prettier」「fast-check による PBT」というテスト・静的検査基盤を、React 固有の追加ツール（`@testing-library/react`・`eslint-plugin-react-hooks`）で自然に拡張する、(3) Property-Based Testing 拡張の全面適用方針との一貫性を、小さな純粋関数群にも適用することで維持する、(4) 必要最小限の依存（YAGNI）。

## 次のステップ（Step 6: 成果物生成、承認後）

- [ ] `aidlc-docs/construction/uow-h/nfr-requirements/nfr-requirements.md`
- [ ] `aidlc-docs/construction/uow-h/nfr-requirements/tech-stack-decisions.md`
