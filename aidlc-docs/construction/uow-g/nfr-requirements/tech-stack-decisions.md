# Tech Stack Decisions — UoW-G 同梱コントロール UI

- **関連 Issue**: [#44](https://github.com/AtsutoNakayama/perisphere/issues/44)
- **作成日**: 2026-08-04
- **前提資料**: `uow-g-nfr-requirements-plan.md`（Q1〜Q4 回答・採用理由）
- **注記**: パッケージマネージャ・ビルドツール・テストランナー・PBT ライブラリ・Lint/フォーマッタ・TypeScript strictness・three.js peerDependencies range・ES2020 ターゲット等のモノレポ横断決定（UoW-A で確定）は変更なくそのまま適用する。本ドキュメントは UoW-G 固有の決定のみを扱う。

## 1. 共有 `<style>` タグのテスト戦略（Q1）

- **決定**: `<style id="perisphere-controls-style">`（`business-rules.md` BR-G-12）に関わるテストは、`beforeEach`/`afterEach` で `document.getElementById("perisphere-controls-style")?.remove()` を行い、各テストケースを未注入状態から開始させる。重複防止ロジック自体を検証するテストは `createViewer` を明示的に2回呼び出し、`document.querySelectorAll("#perisphere-controls-style")` の件数が `1` であることを検証する。
- **理由**: `vitest.config.ts` は `environment: "jsdom"` のみを指定し明示的な `isolate` 設定を持たないため、既定でファイル単位（テストケース単位ではない）の `document` 共有になる。本ユニットで初めて登場する「複数インスタンス間のグローバル DOM 副作用」を、テスト実行順序に依存しない形で検証する。

## 2. PBT の適用対象・純粋関数への切り出し（Q2）

- **決定**: 以下の2つを DOM 操作を持たない純粋関数として実装し、fast-check（UoW-A で確定済み）による PBT の対象とする。
  - `computeEffectiveVisibility(explicit: ControlsVisibility, modeCount: number, photoCount: number): ControlsVisibility`（`business-logic-model.md` P2）
  - `resolveText(template: string, values: Record<string, string | number>): string`（`business-rules.md` BR-G-10）
- **検証する不変条件**:
  - `explicit.modeSwitch === false` のとき、`modeCount` の値に関わらず結果の `modeSwitch` は常に `false`
  - `explicit.modeSwitch` が `false` でないとき、結果の `modeSwitch` は `modeCount > 1` と一致する（`photoNav`/`photoIndicator` も `photoCount` について同様）
  - `explicit.fullscreen`/`zoom` は自動非表示の対象外のため、結果はそのまま `explicit` の値（未指定は `true`）と一致する
  - `resolveText` の出力に `{current}`/`{total}` という文字列が残らない（既知のトークンは常に置換される）
- **example-based との併設**: 各コントロールのクリックハンドラ（`ViewerHandle` メンバー呼び出し）・イベント購読による DOM 同期（`business-logic-model.md` P3〜P8）はビジネスクリティカルな分岐として example-based テストで個別に検証する（PBT-10）。

## 3. `UITextMap` の DOM 反映方式（Q3）

- **決定**: テキストノードへの反映は `element.textContent = value`、属性への反映は `element.setAttribute(name, value)` のみを使用する。`innerHTML`/`insertAdjacentHTML`/`outerHTML` は `packages/core/src/ui/` 配下で一切使用しない（ESLint ルールでの機械的な禁止は本ユニットの規模では過剰と判断し、コードレビュー・本方針の明文化で担保する）。
- **理由**: `UITextMap` は利用側アプリケーションが任意の文字列（多くの場合、エンドユーザー入力や外部データ由来）を渡せる（FR-15）。`textContent`/`setAttribute` は値を常に文字列として扱い HTML/スクリプトとして解釈しないため、DOM based XSS が発生しない（SECURITY-05）。

## 4. 新規ランタイム依存（Q4）

- **決定**: 新規ランタイム依存を追加しない。`ControlsUI` は標準 DOM API（`document.createElement`/`classList`/`addEventListener`/`<style>` 要素/`textContent`/`setAttribute`）のみを使用する。
