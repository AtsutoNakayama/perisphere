# NFR Design Plan — UoW-G 同梱コントロール UI

- **関連 Issue**: [#44](https://github.com/AtsutoNakayama/perisphere/issues/44)
- **作成日**: 2026-08-04
- **前提資料**: `construction/uow-g/nfr-requirements/`、`construction/uow-g/functional-design/`

## 必須評価カテゴリの適用可否

| カテゴリ | 適用可否 | 判定根拠 |
|---|---|---|
| Resilience Patterns | 適用（既存パターンの正式記録・追加要否を確認） | `ControlsUI` が呼び出す `ViewerHandle` メンバーの大半は同期・例外を投げない設計だが、フルスクリーンボタンのみ非同期（`Promise`）呼び出しを行う。追加のフォールト処理が必要か確認する（Q1） |
| Scalability Patterns | **N/A** | `nfr-requirements.md` §1 で確認済み（クライアントサイドライブラリ） |
| Performance Patterns | **新規パターンなし** | `nfr-requirements.md` Performance 判定の通り、DOM 構築は1回のみ・表示状態再評価とインジケーター再構築はイベント駆動（`modechange`/`photochange`）であり、UoW-D `PP-D-1`（高頻度イベントの間引き）に相当する高頻度発火は存在しない |
| Security Patterns | 適用（本ステージでの正式記録・追加論点の要否を確認） | NFR Requirements Q3 で確定した DOM 反映方式（`textContent`/`setAttribute`）を正式なパターンとして記録し、追加の Defense in Depth（入力検証）が必要かを確認する（Q2） |
| Logical Components | 適用 | 新規コンポーネント（`ControlsUI`・表示状態計算・文言置換）の配置場所とモジュール分割粒度を確定する（Q3） |

## 確認質問（比較情報・推奨案を埋め込み済み）

### Q1. `ControlsUI` から呼び出す非同期操作へのフォールト処理（Resilience）

`ControlsUI` が呼び出す `ViewerHandle` メンバーのうち、`setMode`/`setView`/`next`/`prev`/`goTo` はいずれも同期 API で例外を投げない設計（不正な入力は `error` イベントへ正規化、`dispose()` 後は安全な no-op）。唯一の非同期呼び出しはフルスクリーンボタンが呼ぶ `enterFullscreen()`/`exitFullscreen()`（`Promise` を返す）。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 新規のレジリエンスパターンは追加しない。フルスクリーンボタンの `Promise` 呼び出しは Functional Design で確定済みの `.catch(() => {})`（`business-logic-model.md` P3）をそのまま UoW-F `RP-F-1 Silent Best-Effort Cleanup` と同じ思想の適用として正式に記録する（失敗理由は既に `error` イベントで通知済みのため、ここでは未処理 rejection を防ぐだけ）。同期 API 群（`setMode`/`setView`/`next`/`prev`/`goTo` 等）は例外を投げない設計のため、`ControlsUI` 側での try/catch は不要 | `ControlsUI` は他ユニットが確立済みの安全な API 契約（例外を投げない・非同期失敗は `error` イベントへ正規化済み）の上に成り立っており、UI 層で新たなフォールト処理を追加する必要がない。起こりえない例外への防御コードを追加しないという既存方針とも一貫する |
| B | 念のため全ての呼び出しを try/catch で包む防御的コードを追加する | いずれの `ViewerHandle` メンバーも例外を投げない設計であることが確定済みのため、到達しない分岐のコードが増えるだけの過剰防御になる |

**理由**: `ControlsUI` は他ユニットが確立済みの安全な API の上に構築されるため、UI 層固有の追加フォールト処理が必要かを明示的に確認する。

**採用理由**: 既存の安全な API 契約を信頼し、UoW-F の既存パターンをそのまま適用する A を採用する。

[Answer]: A

### Q2. `UITextMap`/`ControlsVisibility` への追加の Defense in Depth（Security）

NFR Requirements Q3 で「`UITextMap` の値は `textContent`/`setAttribute` のみで DOM に反映する」ことは確定済み。本ステージでは、UoW-A〜F が確立してきた「公開 API の入力を境界で検証し `INVALID_INPUT` へ正規化する」パターン（数値のクランプ・範囲チェック等）を、本ユニットの新規公開型（`ControlsVisibility`/`UITextMap`）にも適用すべきか確認する。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | NFR Requirements Q3 の決定を `SP-G-1`（Safe Text Rendering）として正式に記録する。`ControlsVisibility`/`UITextMap` は構造的に `boolean`/`string` のみで構成され、UoW-D の `setView`/`setZoomLimits` が検証していた「非有限数値」「範囲の妥当性」に相当する不正状態が型として存在しない（`string` はどんな値でも `textContent`/`setAttribute` で安全に扱える、BR-G-10）ため、追加の `INVALID_INPUT` 正規化パターンは導入しない | 新規の検証対象（数値のクランプ等）が存在しない型に対して、UoW-D と同型の検証パターンを機械的に複製する意味がない。`textContent`/`setAttribute` という「常に安全な API のみを使う」設計自体が Defense in Depth の実質を満たす |
| B | `UITextMap` の各文字列に長さ上限（例: 200文字）を設け、超過時は `INVALID_INPUT` を発火する | SECURITY-05 の「Length/size bounds」はサーバーサイド API エンドポイントでのリソース枯渇・注入攻撃対策を主眼とした項目であり、クライアントサイドの表示文言に上限を設ける実益が薄い（長すぎる文言は CSS 側の表示崩れとして現れるだけでセキュリティ上のリスクではない）。要件にない機能を追加することになる |

**理由**: 新規公開型に対して、既存の入力検証パターンをそのまま複製すべきか、型の性質（構造的に不正状態を持たない）に基づいて省略してよいかを確認する。

**採用理由**: 型の性質上、追加の検証対象が存在しない A を採用する。

[Answer]: A

### Q3. モジュール配置・純粋関数の切り出し方針（Logical Components）

NFR Requirements Q2 で「表示状態計算（`computeEffectiveVisibility`）・文言トークン置換（`resolveText`）を DOM 操作から分離した純粋関数として実装し PBT 対象とする」ことは確定済み。UoW-E `Gallery`（NFR Design Q3=A）は「単一呼び出し元なら独立モジュールへ切り出さない」と判断した前例があるが、これらの純粋関数もやはり呼び出し元は `ControlsUI` 自身のみ。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 新規ディレクトリ `packages/core/src/ui/` を新設し、`types.ts`（`ControlsVisibility`/`UITextMap`/既定文言 `DEFAULT_UI_TEXT`）・`controlsLogic.ts`（`computeEffectiveVisibility`/`resolveText`）・`ControlsUI.ts`（DOM 構築・イベント購読クラス）の3ファイルに分割する。`gallery/`/`loader/`/`modes/`/`interaction/`/`fullscreen/` と同じ、ユニットごとに新規ディレクトリを切る既存パターンを踏襲する | UoW-E `Gallery` の「単一呼び出し元なら切り出さない」という判断基準は「**再利用**の恩恵がない」ことを理由にしていたが、本ユニットの分離動機はそれとは異なり「**DOM/jsdom を介さない高速な PBT 実行**」（NFR Requirements Q2）である。UoW-D `viewMath.ts` も複数呼び出し元だけでなく「純粋計算とDOM/three.js操作の分離」自体を動機にしており、本ユニットも同じ動機に基づく分離として一貫する |
| B | `ControlsUI.ts` 内にすべてのロジックをまとめ、独立ファイルへの分離を行わない | NFR Requirements Q2 で「DOM 操作を持たない純粋関数として実装する」ことが既に確定しているため、この場で見送ると前ステージの決定と矛盾する |

**理由**: 新規コンポーネントの配置場所と、UoW-E の切り出し判断基準（再利用性）が本ユニットにそのまま当てはまるかを確認する。

**採用理由**: NFR Requirements Q2 の決定（テスト容易性のための分離）と一貫する A を採用する。

[Answer]: A

## 比較検討サマリ

判断軸: (1) `ControlsUI` は他ユニットが確立済みの安全な API 契約（例外を投げない・非同期失敗は `error` イベントへ正規化済み）の上に構築されるため、UI 層で新規のフォールト処理・入力検証パターンを重複して追加しない（Q1, Q2）、(2) NFR Requirements で確定済みの「純粋関数への分離」を、UoW-E とは異なる動機（テスト容易性）に基づく分離として整合的にモジュール構成へ落とし込む（Q3）。

## 次のステップ（Step 6: 成果物生成、承認後）

- [ ] `aidlc-docs/construction/uow-g/nfr-design/nfr-design-patterns.md`
- [ ] `aidlc-docs/construction/uow-g/nfr-design/logical-components.md`
