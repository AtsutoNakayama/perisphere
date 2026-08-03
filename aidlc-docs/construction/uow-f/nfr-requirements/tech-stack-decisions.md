# Tech Stack Decisions — UoW-F フルスクリーン

- **関連 Issue**: [#42](https://github.com/AtsutoNakayama/perisphere/issues/42)
- **作成日**: 2026-08-03
- **前提資料**: `uow-f-nfr-requirements-plan.md`（Q1〜Q4 回答・採用理由）
- **注記**: パッケージマネージャ・ビルドツール・テストランナー・PBT ライブラリ・Lint/フォーマッタ・TypeScript strictness・three.js peerDependencies range・ES2020 ターゲット等のモノレポ横断決定（UoW-A で確定）は変更なくそのまま適用する。本ドキュメントは UoW-F 固有の決定のみを扱う。

## 1. Fullscreen API のテスト境界・モック方式（Q1）

- **決定**: 対象のテスト環境（`vitest.config.ts` の `environment: "jsdom"`）で使用中の jsdom は Fullscreen API を一切実装していないことを確認済み（`HTMLElement.prototype.requestFullscreen`/`document.exitFullscreen`/`document.fullscreenElement`/`document.fullscreenEnabled` のいずれも未定義）。
  - **非対応環境（擬似フルスクリーン）の分岐**: jsdom の既定状態（`requestFullscreen` が存在しない）をそのまま利用し、追加のモックなしでテストする。
  - **対応環境（ネイティブ Fullscreen API）の分岐**: テストごとに `container.requestFullscreen = vi.fn().mockResolvedValue(undefined)`（失敗ケースは `mockRejectedValue`）、`document.exitFullscreen = vi.fn().mockResolvedValue(undefined)` を明示的に定義する。`document.fullscreenElement` は `Object.defineProperty(document, "fullscreenElement", { value, configurable: true })` で読み書き可能なテスト用プロパティとして差し込む。`fullscreenchange` イベントは `document.dispatchEvent(new Event("fullscreenchange"))` で模擬する。
- **理由**: UoW-A で確立済みの「テスト環境に欠けているブラウザ API はテストごとに最小限のスタブを注入する」パターン（`vi.spyOn(HTMLCanvasElement.prototype, "getContext")` による WebGL2 モック）と一貫性を保つ。共通ヘルパーモジュールの新設は、対象テストファイル数が少ないため見送る。

## 2. PBT の適用対象（Q2）

- **決定**: `FullscreenManager` の状態遷移（`domain-entities.md` E1/E2）を fast-check（UoW-A で確定済み）による PBT の対象とする。
- **検証する不変条件**:
  - `enter()`/`exit()`/外部要因（`fullscreenchange` イベント模擬）の任意の呼び出し列に対し、`isActive()` の返り値は常に内部 `mode !== "none"` と一致する
  - `enter()` を連続して複数回呼んでも2回目以降は状態変化・追加の副作用が発生しない（冪等、BR-F-01）。`exit()` も同様（非アクティブ時の連続呼び出しで副作用が発生しない）
- **example-based との併設**: ネイティブ/擬似の分岐選択（BR-F-02/03）、`FULLSCREEN_FAILED` の発火経路（BR-F-04）、Esc キー解除（BR-F-06）、`dispose()` 時の解除（BR-F-08）はビジネスクリティカルな分岐として example-based テストで個別に検証する（PBT-10）。

## 3. 新規ランタイム依存（Q3）

- **決定**: 新規ランタイム依存を追加しない。`FullscreenManager` はブラウザ標準の Fullscreen API・DOM API（`addEventListener`/インラインスタイル操作）のみを使用する。`Renderer.resize()` も既存の three.js（`PerspectiveCamera`/`WebGLRenderer`）の範囲内で完結する。

## 4. `Renderer.resize()` のテスト境界（Q4）

- **決定**: 既存の `Renderer` テスト境界（`vi.spyOn(HTMLCanvasElement.prototype, "getContext")` によるモック WebGL2 コンテキスト、UoW-A で確立済み）をそのまま再利用する。
- **検証方法**: テスト用の `container` の `clientWidth`/`clientHeight` を書き換えた上で `resize()` を呼び、内部の `webglRenderer.setSize` 呼び出しと `camera.aspect`/`updateProjectionMatrix` の反映を検証する。
