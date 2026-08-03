# NFR Requirements Plan — UoW-G 同梱コントロール UI

- **関連 Issue**: [#44](https://github.com/AtsutoNakayama/perisphere/issues/44)
- **作成日**: 2026-08-04
- **前提資料**: `construction/uow-g/functional-design/`、`inception/requirements/requirements.md`（NFR-01〜12）、UoW-A〜F `tech-stack-decisions.md`（モノレポ横断決定は継承）

## NFR カテゴリ別評価

| カテゴリ | UoW-G での判定 | 詳細 |
|---|---|---|
| Scalability | **N/A** | クライアントサイドライブラリであり、負荷分散・水平スケーリングの概念が存在しない（UoW-A〜F と同様） |
| Availability | **N/A** | 稼働サーバー・永続データストアなし（UoW-A〜F と同様） |
| Performance | 適用（Functional Design で具体化済み・追加確認不要） | DOM 構築は `ControlsUI` 生成時の1回のみ。表示状態の再評価は `modechange`/`photochange` 受信時のみで、UoW-D `onFrame` のような毎フレーム発火のホットパスではない。写真インジケーターのボタン列再構築も `event.total` が変化したときのみ行う（`business-logic-model.md` P8）ため、写真枚数が多い場合でも不要な再構築は発生しない |
| Security | 本ステージで確認（Q3） | `UITextMap`（利用側が任意の文字列を渡せる、FR-15）を DOM に反映する際の実装方式が Security Baseline（拡張有効）の対象になりうる |
| Reliability | 適用（Functional Design で具体化済み・追加確認不要） | ヘッドレス時の `setControlsVisibility`/`setText` 安全な no-op（BR-G-15）、縮退ハンドル（WebGL2 非対応）でも `ControlsUI` 自体は実機能として動作（`Renderer` 非依存、UoW-F と同じ扱い）で確定済み |
| Maintainability | UoW-A の決定を継続 | Lint/フォーマッタ・TypeScript strictness は変更なし |
| Usability / Accessibility | 適用（Functional Design で具体化済み・本ステージでは PBT 対象の確認のみ、Q2） | ネイティブ `<button>`/`<select>`・ARIA 属性・フォーカス管理（BR-G-11）は Functional Design で確定済み（NFR-04, US-35） |
| Tech Stack Selection | 本ステージで確認 | 共有 `<style>` タグ（BR-G-12）のテスト戦略（Q1）、PBT 適用対象・純粋関数への切り出し方針（Q2）、`UITextMap` のレンダリング方式（Q3）、新規ランタイム依存の要否（Q4） |

## 確認質問（比較情報・推奨案を埋め込み済み）

### Q1. 共有 `<style>` タグ（BR-G-12）の重複防止ルールをテストで検証する方法

`vitest.config.ts` は `environment: "jsdom"` のみを指定しており、明示的な `isolate` 設定がないため既定（ファイル単位で1つの `document` を共有し、同一ファイル内の複数 `it()` は同じ `document` を使い回す）で動作する。BR-G-12 の「同一 `document` に既に存在すれば追加しない」というルールは、テスト実行順序によって暗黙に依存関係が生まれうる。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `<style id="perisphere-controls-style">` に関わるテストでは `beforeEach`/`afterEach` で `document.getElementById("perisphere-controls-style")?.remove()` を行い、各テストケースを「未注入状態」から開始させる。重複防止ロジック自体を検証するテストは、`createViewer` を明示的に2回呼び出し `document.querySelectorAll("#perisphere-controls-style").length === 1` を検証する | テストケースが前後のテストの残留 DOM 状態に依存しない（独立性・可読性の確保）。UoW-A 以来、テストは他ユニットの成功パターン（各テストで必要な初期状態を明示的に作る）を踏襲できる |
| B | 特別なクリーンアップは行わず、テスト実行順序に依存する形で「既に存在する」分岐を間接的にカバーする | 実装コストは最小だが、テストの意図が実行順序という暗黙の前提に依存し、テストファイルの並び替えや新規テスト追加で意図せず壊れるリスクがある |

**理由**: 本ユニットで初めて「複数インスタンス間で共有されるグローバル DOM 副作用」（`document.head` への追加）が登場するため、テスト独立性の確保方法を確認する。

**採用理由**: テストの独立性を優先する A を採用する。

[Answer]: A

### Q2. PBT 適用対象・純粋関数への切り出し方針（NFR-09 継続）

`requirements.md` NFR-09 は「状態管理（ギャラリー・モード切替）」を PBT の主対象候補として名指ししている。UoW-G の表示状態計算（`business-logic-model.md` P2: 明示指定 × 該当データ有無 → 実効表示可否）と文言のプレースホルダトークン置換（`business-rules.md` BR-G-10）は、いずれも入出力が明確な計算処理。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `computeEffectiveVisibility(explicit: ControlsVisibility, modeCount: number, photoCount: number): ControlsVisibility` と `resolveText(template: string, values: Record<string, string \| number>): string` を DOM 操作から切り離した純粋関数として実装し（UoW-D `viewMath.ts`・UoW-E `Gallery` の副作用フリー計算と同じパターン）、PBT（fast-check）の対象とする。検証する不変条件の例: ①`explicit.modeSwitch === false` なら `modeCount` に関わらず結果は常に `false`、②`explicit.modeSwitch !== false` のとき結果は `modeCount > 1` と一致する（photoNav/photoIndicator も同様）、③`resolveText` の出力に `{current}`/`{total}` という文字列が残らない | NFR-09 の「状態管理」という主対象候補に、本ユニットの表示状態計算も性質上合致する。DOM 操作（`ControlsUI` 本体）から計算ロジックを分離することで、jsdom を介さない高速な PBT 実行が可能になり、UoW-D/UoW-E で確立した「計算は純粋関数、副作用は呼び出し元」という設計方針とも一貫する |
| B | 計算ロジックを `ControlsUI` クラス内に留め、PBT は行わず example-based のみで検証する | PBT 全面適用方針（NFR-09、拡張オプトイン: Yes）に反する。UoW-D/UoW-E で確立した「状態遷移・計算ロジックは PBT 対象」という継続的な判断基準からも外れる |

**理由**: NFR-09 の全面適用方針のもとで対象とすべき計算ロジックの範囲と、DOM 操作からの分離設計を確認する。

**採用理由**: NFR-09 の全面適用方針と UoW-D/UoW-E の設計継続性を優先し A を採用する。

[Answer]: A

### Q3. `UITextMap` の値を DOM へ反映する方式（Security Baseline）

`UITextMap`（利用側が任意の文字列を渡せる、FR-15）の値をボタンのラベルテキストや `aria-label` に反映する実装方式は、Security Baseline（`aidlc-state.md` で拡張有効）の対象になりうる。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | テキストノードへの反映は常に `element.textContent = value` を使用し、属性（`aria-label` 等）への反映は常に `element.setAttribute("aria-label", value)` を使用する。`innerHTML`/`insertAdjacentHTML` 等の HTML パーサを経由する API は本ユニット内で一切使用しない | `UITextMap` の値は利用側アプリケーションが（多くの場合、エンドユーザー入力や外部 CMS 由来のデータを経由して）任意の文字列を渡しうる。`textContent`/`setAttribute` は値を常に文字列として扱いHTML/スクリプトとして解釈しないため、値に `<script>` 等が含まれていても DOM based XSS が発生しない。UoW-A の `ErrorManager`（内部詳細を含まない安全なメッセージ、BR-A-13）と同様、「外部から渡りうる文字列は常に安全な API で扱う」という既存方針の延長 |
| B | 実装時に個別判断とし、明文化しない | Security Baseline 拡張が有効な本プロジェクトで、XSS 対策方針を明文化せず実装者の判断に委ねるのはリスクが残る |

**理由**: Security Baseline 拡張（有効）の観点から、外部から渡りうる文字列（`UITextMap`）を DOM に反映する際の安全な実装方式を明文化する必要があるため確認する。

**採用理由**: Security Baseline の要求に沿って安全な API のみを使用する A を採用する。

[Answer]: A

### Q4. 新規ランタイム依存の要否

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 新規ランタイム依存を追加しない。`ControlsUI` は標準 DOM API（`document.createElement`/`classList`/`addEventListener`/`<style>` 要素）のみを使用する | UoW-A〜F から継続する「必要最小限の依存」方針（YAGNI）に合致する |
| B | 何らかの UI ライブラリ・テンプレートエンジンを導入する | Q1=A（Application Design）で確定済みの「素 DOM・フレームワーク非依存」という本ユニットの前提そのものに反する |

**理由**: 型定義・パッケージ構成への影響がないか確認する既存の定型質問。

**採用理由**: 既存方針の継続。

[Answer]: A

## 比較検討サマリ

判断軸: (1) 本ユニットで初めて登場する「複数インスタンス間で共有されるグローバル DOM 副作用」（共有 `<style>` タグ）のテスト独立性を確保する、(2) NFR-09 の PBT 全面適用方針のもとで、UoW-D/UoW-E と同じ「計算は純粋関数に切り出し PBT 対象とする」設計を継続する、(3) Security Baseline のもとで、利用側から渡りうる文字列（`UITextMap`）を安全な DOM API のみで扱う、(4) 必要最小限の依存（YAGNI）。

## 次のステップ（Step 6: 成果物生成、承認後）

- [ ] `aidlc-docs/construction/uow-g/nfr-requirements/nfr-requirements.md`
- [ ] `aidlc-docs/construction/uow-g/nfr-requirements/tech-stack-decisions.md`
