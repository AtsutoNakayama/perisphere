# NFR Requirements — UoW-H React アダプタ

- **関連 Issue**: [#46](https://github.com/AtsutoNakayama/perisphere/issues/46)
- **作成日**: 2026-08-04
- **前提資料**: `uow-h-nfr-requirements-plan.md`（Q1〜Q5 回答・採用理由）、`inception/requirements/requirements.md`（NFR-01〜12）、`construction/uow-h/functional-design/`、UoW-A〜G `tech-stack-decisions.md`

## 1. NFR カテゴリ別評価

| カテゴリ | UoW-H での判定 | 詳細 |
|---|---|---|
| Scalability | **N/A** | UoW-A〜G と同じ理由（クライアントサイドライブラリ、負荷分散の概念なし） |
| Availability | **N/A** | UoW-A〜G と同じ理由（稼働サーバー・永続データストアなし） |
| Performance | 適用（Functional Design で具体化済み） | イベント購読は mount 時1回のみ（BR-H-09）、props 変更反映は参照比較の `useEffect`（BR-H-06）。毎フレーム発火のホットパスは存在しない |
| Security | **N/A**（本ユニット固有の新規論点なし） | 利用側から渡された文字列を DOM へ描画する処理を持たない（`UITextMap` の描画は UoW-G の責務）。サプライチェーン対策は UoW-A で導入済みの方針を継続 |
| Reliability | 適用（Functional Design で具体化済み） | `dispose()` の冪等性への依拠・StrictMode 二重実行の許容（BR-H-03）、unmount 時の確実な購読解除（BR-H-11） |
| Maintainability | 適用（本ステージで具体化、Q3） | `eslint-plugin-react-hooks` を導入し hooks 誤用を静的検査する |
| Usability / Accessibility | **N/A** | 本ユニットが新規にレンダリングする DOM はルート `<div>` 1つのみ。アクセシビリティ対応は UoW-G の責務範囲 |

## 2. 前提として再確認した確定済み NFR（変更なし）

UoW-A〜G `nfr-requirements.md` の内容がそのまま適用される。UoW-H 固有の追加確認は以下のみ。

| NFR | 内容 | UoW-H での扱い |
|---|---|---|
| NFR-05 | 拡張性（コア非依存のアダプタ追加） | 本ユニットが主担当。`@perisphere/core` にのみ依存し、コア内部には非依存（`services.md`、US-33） |
| NFR-06 | 依存最小化・広め range | React/react-dom を `three.js` と同じ「広め range・Code Generation 時に具体化」方針で扱う（Q1） |
| NFR-07 | 配布形態（npm 公開、ESM + 型定義） | `@perisphere/react` として `@perisphere/core` と同じ配布形態を踏襲する |
| NFR-09 | PBT 全面適用 | `resolveInitialSource`/`extractViewerOptions`/`toCallbackPayload` を純粋関数として切り出し PBT 対象とする（Q4） |

## 3. 本ステージで確定した技術スタック（サマリ）

詳細な選定理由は `tech-stack-decisions.md` を参照。

| # | 論点 | 決定 |
|---|---|---|
| Q1 | React/react-dom `peerDependencies` 範囲 | `>=18.0.0 <20.0.0`（広め range、下限は Code Generation 時に確定） |
| Q2 | コンポーネントテストツール | `@testing-library/react` を新規追加 |
| Q3 | React hooks 静的検査 | `eslint-plugin-react-hooks` を新規追加 |
| Q4 | PBT 対象範囲 | `resolveInitialSource`/`extractViewerOptions`/`toCallbackPayload` の3関数 |
| Q5 | 新規ランタイム依存 | なし（`@perisphere/core` と `react`/`react-dom` peer のみ） |

## 4. 拡張ルール準拠サマリ

### Security Baseline

| ルール | 判定 | 根拠 |
|---|---|---|
| SECURITY-05（入力検証） | N/A | 本ユニットは利用側文字列を DOM へ描画する処理を持たない。`image`/`photos`/`mode` の入力検証はコア側（`loadImage`/`setPhotos`/`setMode`）に委譲する（`services.md`） |
| SECURITY-09（ハードニング） | N/A | デプロイ対象のサーバー・クレデンシャル・クラウドストレージは存在しない |
| SECURITY-10（サプライチェーン） | Compliant（変更なし） | Q5 により新規ランタイム依存を追加しないため、UoW-A で確定済みの lockfile/Dependabot/CI 監査方針がそのまま適用される。新規 devDependency（`@testing-library/react`/`eslint-plugin-react-hooks`）も同じ CI 監査の対象になる |
| SECURITY-11（セキュア設計） | Compliant | `resolveInitialSource`/`extractViewerOptions`/`toCallbackPayload` を React/DOM から分離した専用モジュールに切り出す設計（Q4）により関心事が分離されている |
| SECURITY-15（例外処理） | Compliant | dispose 後の呼び出し安全性（BR-H-03）、unmount 時の確実なクリーンアップ（BR-H-11）で具体化済み |

### Resiliency Baseline

| ルール | 判定 | 根拠 |
|---|---|---|
| RESILIENCY-01〜09, 11〜15 | N/A | UoW-A〜G と同じ理由 |
| RESILIENCY-10（過剰リトライ回避） | N/A | 本ユニットはリトライを行う処理を持たない |

### Property-Based Testing

| ルール | 判定 | 根拠 |
|---|---|---|
| PBT-01（性質識別） | Compliant | `business-rules.md`（BR-H-05/BR-H-08/BR-H-10）で識別済みの決定的関数を Q4 で PBT 対象として確定 |
| PBT-03（不変条件） | Compliant | `resolveInitialSource`/`extractViewerOptions`/`toCallbackPayload` それぞれの不変条件を Q4 に明記済み |
| PBT-09（フレームワーク選定） | Compliant（変更なし） | fast-check（UoW-A で確定済み）を継続使用 |
| PBT-10（ビジネスクリティカルパスの example-based 併設） | Compliant（方針継続） | マウント/props反映/イベントブリッジ/unmount の各フローは Code Generation で example-based により個別に検証する |

## 5. Code Generation への申し送り事項

- `resolveInitialSource`/`extractViewerOptions`/`toCallbackPayload` は React/DOM から独立した純粋関数として実装し、PBT（fast-check）で不変条件を検証する（Q4）。
- `packages/react/package.json` の `peerDependencies` に `react`/`react-dom` を `>=<Code Generation 時点の最新安定メジャー>.0.0 <20.0.0` で追加し、`devDependencies` に具体的なバージョンを固定する（Q1）。
- `devDependencies` に `@testing-library/react`（Q2）・`eslint-plugin-react-hooks`（Q3）を追加する。
- 新規パッケージ依存の追加は不要（Q5、上記2件の devDependency 追加を除く）。`packages/core/package.json` の変更は不要。
