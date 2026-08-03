# NFR Requirements Plan — UoW-F フルスクリーン

- **関連 Issue**: [#42](https://github.com/AtsutoNakayama/perisphere/issues/42)
- **作成日**: 2026-08-03
- **前提資料**: `construction/uow-f/functional-design/`、`inception/requirements/requirements.md`（NFR-01〜12）、UoW-A/UoW-B/UoW-C/UoW-D/UoW-E `tech-stack-decisions.md`（モノレポ横断決定は継承）

## NFR カテゴリ別評価

| カテゴリ | UoW-F での判定 | 詳細 |
|---|---|---|
| Scalability | **N/A** | クライアントサイドライブラリであり、負荷分散・水平スケーリングの概念が存在しない（UoW-A〜E と同様） |
| Availability | **N/A** | 稼働サーバー・永続データストアなし（UoW-A〜E と同様） |
| Performance | 適用（Functional Design で具体化済み・追加確認不要） | `Renderer.resize()`（`business-rules.md` BR-F-09）はフルスクリーン切替の前後で1回だけ呼ばれる操作であり、UoW-D の `onFrame` のような毎フレーム発火のホットパスではないため、追加のスロットリング等は不要 |
| Security | 適用（Functional Design で具体化済み・追加確認不要） | `enterFullscreen()`/`exitFullscreen()` は引数を取らないため入力検証の対象がない。実行時失敗は `FULLSCREEN_FAILED`（内部詳細を含まない安全なメッセージ、BR-A-13 の既存方針）として正規化済み（BR-F-04） |
| Reliability | 適用（Functional Design で具体化済み・追加確認不要） | `document` の `fullscreenchange` への状態一本化（BR-F-05）・`dispose()` 時の自動解除（BR-F-08）で確定済み |
| Maintainability | UoW-A の決定を継続 | Lint/フォーマッタ・TypeScript strictness は変更なし |
| Usability / Accessibility | **N/A（UoW-F スコープ外）** | `FullscreenManager` 自体は可視要素（ボタン等）を持たない。US-21 のキーボード操作は既存の `KeyboardInputSource`（UoW-D）をそのまま利用し、フルスクリーンボタンの aria-label 等は UoW-G の範囲（`unit-of-work-story-map.md`） |
| Tech Stack Selection | 本ステージで確認 | Fullscreen API のテスト境界・モック方式（Q1）、PBT 対象範囲（Q2）、新規ランタイム依存の要否（Q3）、`Renderer.resize()` のテスト境界（Q4） |

## 確認質問（比較情報・推奨案を埋め込み済み）

### Q1. Fullscreen API のテスト境界・モック方式（Tech Stack Selection）

本プロジェクトのテスト環境（`vitest.config.ts` の `environment: "jsdom"`）で調査した結果、使用中の jsdom は Fullscreen API を一切実装していない（`HTMLElement.prototype.requestFullscreen`/`document.exitFullscreen`/`document.fullscreenElement`/`document.fullscreenEnabled` のいずれも存在しない）。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 「非対応環境」の分岐（擬似フルスクリーン、`business-rules.md` BR-F-02）は、jsdom がそのまま `requestFullscreen` を持たないためモックなしで自然にテストできる。「対応環境」の分岐（ネイティブ Fullscreen API）は、UoW-A の WebGL モック（`vi.spyOn(HTMLCanvasElement.prototype, "getContext")`）と同じパターンで、テストごとに `container.requestFullscreen`/`document.exitFullscreen` を `vi.fn()` で明示的に定義し、`document.fullscreenElement` は `Object.defineProperty` で読み書き可能なテスト用プロパティとして差し込む。`fullscreenchange` イベントは `document.dispatchEvent(new Event("fullscreenchange"))` で模擬する | 既存の「実際の環境で欠けているブラウザ API はテストごとに最小限のスタブを注入する」という UoW-A の確立済みパターンをそのまま踏襲できる。jsdom が Fullscreen API を持たないという事実そのものが「非対応環境」テストを追加のモックなしで検証できる利点にもなる |
| B | Fullscreen API 全体をモックするテスト用ヘルパーモジュール（例: `test-utils/mockFullscreen.ts`）を新設し、全テストで共通利用する | 現時点でこの API を使うテストファイルは1つ（`FullscreenManager` 単体テスト）＋統合テスト1〜2ファイル程度と見込まれ、UoW-A〜E で共通ヘルパーモジュールを新設した前例もないため、テストファイルごとに `beforeEach` でスタブする方式で十分（過剰な抽象化を避ける） |

**理由**: 本ユニット特有の技術的制約（テスト環境が対象 API を持たない）であり、モック方式の選択がテスト実装の見通しに直結するため確認する。

**採用理由**: UoW-A で確立済みの「テストごとに最小限のスタブを注入する」既存パターンとの一貫性を優先し、A を採用する。

[Answer]: A

### Q2. PBT の適用対象（テスト戦略、NFR-09 継続）

`requirements.md` NFR-09 は「状態管理（ギャラリー・モード切替）」を PBT の主対象候補として名指ししているが、`FullscreenManager` の3状態（`domain-entities.md` E2: `none`/`native`/`pseudo`）の状態遷移も同種の「状態管理」に該当する。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `FullscreenManager` の状態遷移を PBT（fast-check）の対象とする。検証する不変条件: ①`enter()`/`exit()`/外部要因（`fullscreenchange`）の任意の呼び出し列に対し、`isActive()` は常に `mode !== "none"` と一致する、②`enter()` を連続して複数回呼んでも2回目以降は状態変化なし（冪等、BR-F-01）、③`dispose()` 後は必ず非アクティブになり、以後の `enter()`/`exit()` 呼び出しは行われない（呼び出し元の `guardDisposed` が防ぐため `FullscreenManager` 自体の不変条件としては対象外） | NFR-09 の「状態管理」という主対象候補にモード遷移も合致する。UoW-D の `ViewController`（純粋な状態計算）や UoW-E の `Gallery`（index 状態計算）と同様、`FullscreenManager` も「呼び出し列に対する状態の妥当性」を検証しやすい設計（`domain-entities.md` E1/E2）になっている |
| B | PBT は行わず example-based のみ | PBT 全面適用方針（NFR-09、拡張オプトイン: Yes）に反する。`FullscreenManager` は状態遷移を持つため、UoW-D/UoW-E と同種の対象外とする根拠が薄い |

**理由**: NFR-09 の全面適用方針のもとで、本ユニットの状態機械（`FullscreenMode`）を対象に含めるべきかを確認する。

**採用理由**: NFR-09 の全面適用方針と、UoW-D/UoW-E で確立した「状態機械は PBT 対象」という継続的な判断基準に従い A を採用する。

[Answer]: A

### Q3. 新規ランタイム依存の要否

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 新規ランタイム依存を追加しない。`FullscreenManager` はブラウザ標準の Fullscreen API と DOM API（`addEventListener`/インラインスタイル操作）のみを使用し、`Renderer.resize()` も既存の three.js（`PerspectiveCamera`/`WebGLRenderer`、UoW-A から継続する peerDependency）の範囲内で完結する | UoW-A〜E から継続する「必要最小限の依存」方針（YAGNI）に合致する |
| B | 何らかのライブラリを導入する | 本ユニットの要件（標準 Fullscreen API のラップ）に対して投資が見合わない |

**理由**: 型定義・パッケージ構成への影響がないか確認する既存の定型質問。

**採用理由**: 既存方針の継続。

[Answer]: A

### Q4. `Renderer.resize()`（Q8 で新設）のテスト境界

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `Renderer` の既存テスト境界（`vi.spyOn(HTMLCanvasElement.prototype, "getContext")` によるモック WebGL2 コンテキスト、UoW-A で確立済み）をそのまま再利用する。`resize()` のテストでは `container.clientWidth`/`clientHeight` をテスト用に書き換えた上で `resize()` を呼び、`webglRenderer.setSize` 相当の呼び出し（three.js の `WebGLRenderer` インスタンスのモック済みメソッド呼び出し）と `camera.aspect` の値を検証する | 既存の `Renderer` テストが確立している境界・モック方式をそのまま拡張でき、新たなテストインフラを増やさない |
| B | `resize()` は実装するがユニットテストは行わず、`FullscreenManager` との統合テストでのみ間接的に検証する | `resize()` 単体の計算ロジック（アスペクト比再計算）の境界値検証がしにくくなる |

**理由**: 新設する `Renderer.resize()` メソッドの検証方法を確認する。

**採用理由**: 既存の `Renderer` テスト境界を再利用でき、単体レベルでの計算ロジック検証も可能な A を採用する。

[Answer]: A

## 比較検討サマリ

判断軸: (1) UoW-A で確立済みの「欠けているブラウザ API はテストごとに最小限のスタブを注入する」というテスト境界方針の継続、(2) NFR-09 が求める PBT 全面適用方針のもとで、状態機械を持つコンポーネント（`FullscreenManager`）を一貫して PBT 対象に含める、(3) 必要最小限の依存（YAGNI）、(4) 新設する `Renderer.resize()` も既存の `Renderer` テスト境界の延長で検証する。

## 次のステップ（Step 6: 成果物生成、承認後）

- [ ] `aidlc-docs/construction/uow-f/nfr-requirements/nfr-requirements.md`
- [ ] `aidlc-docs/construction/uow-f/nfr-requirements/tech-stack-decisions.md`
