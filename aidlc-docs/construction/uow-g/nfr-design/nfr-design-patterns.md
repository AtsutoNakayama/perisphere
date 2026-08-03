# NFR Design Patterns — UoW-G 同梱コントロール UI

- **関連 Issue**: [#44](https://github.com/AtsutoNakayama/perisphere/issues/44)
- **作成日**: 2026-08-04
- **前提資料**: `uow-g-nfr-design-plan.md`（Q1〜Q3 回答・採用理由）、`construction/uow-g/functional-design/`

## 1. Resilience Patterns

### RP-G-1 Silent Best-Effort Action（UI アクションの `Promise` reject の静かな握りつぶし）

- **問題**: フルスクリーンボタンのクリックハンドラが呼ぶ `enterFullscreen()`/`exitFullscreen()` は `Promise` を返し、実行時に reject されうる（`FULLSCREEN_FAILED`）。誰も処理しないと未処理の Promise rejection になる。
- **適用**: `.catch(() => {})` を付与し、reject されても静かに無視する（`business-logic-model.md` P3、Q1=A）。失敗理由は呼び出し元の `FullscreenManager`（UoW-F `BR-F-04`）が既に `error` イベントで発火済みのため、`ControlsUI` 側で追加の通知は行わない。
- **効果**: UoW-F `RP-F-1 Silent Best-Effort Cleanup` と同じ「関心のない失敗は握りつぶす」思想を、破棄処理だけでなく UI アクション起点の呼び出しにも一貫して適用する。
- **適用対象外**: `setMode`/`setView`/`next`/`prev`/`goTo` 等の同期 API はいずれも例外を投げない設計（不正入力は `error` イベントへ正規化、`dispose()` 後は安全な no-op）のため、これらの呼び出しに `try/catch` は付与しない（Q1=A）。

## 2. Scalability Patterns

**N/A**。`nfr-requirements.md` §1 で確認済み（クライアントサイドライブラリ）。

## 3. Performance Patterns

**新規パターンなし**。`nfr-requirements.md` Performance 判定の通り、DOM 構築は `ControlsUI` 生成時の1回のみ・表示状態再評価とインジケーター再構築はイベント駆動（`modechange`/`photochange`）であり、UoW-D `PP-D-1 Coalesced View Change Emission`（毎フレーム発火するホットパスの間引き）に相当する高頻度発火は存在しない。

## 4. Security Patterns

### SP-G-1 Safe Text Rendering（安全な文言反映）

- **問題**: `UITextMap`（利用側が任意の文字列を渡せる、FR-15）の値を DOM に反映する際、`innerHTML` 等の HTML パーサ経由 API を使うと DOM based XSS のリスクがある。
- **適用**: テキストノードへの反映は `element.textContent = value`、属性への反映は `element.setAttribute(name, value)` のみを使用する（NFR Requirements Q3、SECURITY-05）。`packages/core/src/ui/` 配下で `innerHTML`/`insertAdjacentHTML`/`outerHTML` は使用しない。
- **効果**: 値にどのような文字列（`<script>` 等を含む）が渡されても、常に文字列として扱われ HTML/スクリプトとして解釈されない。

### SP-G-2 追加の入力検証パターンなし（型の性質による判断）

- **問題**: UoW-A〜F が確立してきた「公開 API の入力を境界で検証し `INVALID_INPUT` へ正規化する」パターン（数値のクランプ・範囲チェック）を、新規公開型 `ControlsVisibility`/`UITextMap` にも適用すべきか。
- **判断**: いずれも `boolean`/`string` のみで構成され、`setView`/`setZoomLimits` が検証していた「非有限数値」「範囲の妥当性」に相当する不正状態が型として存在しない。`string` はどんな値でも `textContent`/`setAttribute`（SP-G-1）で安全に扱えるため、追加の `INVALID_INPUT` 正規化パターンは導入しない（Q2=A）。

## 5. Logical Components

### LC-G-1 新規ディレクトリ配置

- **問題**: `ControlsUI` とその関連ロジックをどこに配置するか。
- **適用**: `packages/core/src/ui/` を新設する。`gallery/`/`loader/`/`modes/`/`interaction/`/`fullscreen/` と同じ、ユニットごとに新規ディレクトリを切る既存パターンを踏襲する（Q3=A）。

### LC-G-2 純粋計算ロジックの分離（テスト容易性が動機、UoW-E とは異なる判断基準）

- **問題**: `computeEffectiveVisibility`/`resolveText`（NFR Requirements Q2 で PBT 対象と確定済み）を独立モジュールへ切り出すか。呼び出し元は `ControlsUI` 自身のみ。
- **判断**: UoW-E `Gallery`（NFR Design Q3=A）の「単一呼び出し元なら切り出さない」という基準は「**再利用**の恩恵がない」ことを理由にしていたが、本ユニットの分離動機はそれとは異なり「**DOM/jsdom を介さない高速な PBT 実行**」である。UoW-D `viewMath.ts` が体現する「純粋計算と DOM/three.js 操作の分離」という設計思想と同じ動機に基づき、`controlsLogic.ts` として分離する（Q3=A）。

## 6. 検討したが採用しなかったパターン（Rejected Patterns）

| パターン | 不採用の理由 | 再検討の契機 |
|---|---|---|
| `ControlsUI` から `ViewerHandle` への全呼び出しを try/catch で防御的に包む | 呼び出し先の同期 API はいずれも例外を投げない設計であることが確定済みで、到達しない分岐のコードが増えるだけ（NFR Design Q1 の裏返し） | `ViewerHandle` の契約が将来変更され、同期 API が例外を投げるようになった場合 |
| `UITextMap` の各文字列に長さ上限を設ける | クライアントサイドの表示文言に上限を設ける実益が薄く、要件にない機能を追加することになる（NFR Design Q2 の裏返し） | 極端に長い文言によるレイアウト崩れが実運用上の問題として報告された場合 |
| `computeEffectiveVisibility`/`resolveText` を `ControlsUI.ts` 内に留める | NFR Requirements Q2 で「DOM 操作を持たない純粋関数として実装する」ことが既に確定しており、この場で見送ると矛盾する（NFR Design Q3 の裏返し） | 該当なし |
