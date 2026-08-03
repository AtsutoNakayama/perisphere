# NFR Design Plan — UoW-A コア基盤

- **関連 Issue**: [#27](https://github.com/AtsutoNakayama/perisphere/issues/27)
- **作成日**: 2026-08-02
- **前提資料**: `construction/uow-a/nfr-requirements/`、`construction/uow-a/functional-design/`

## カテゴリ別の適用可否判定（必須評価）

| カテゴリ | 判定 | 根拠 |
|---|---|---|
| Resilience Patterns | **適用**（一部は Functional Design で確定済み・本ステージで補足） | US-30/US-37 対応の障害分離・コンテキストロスト復帰（BR-A-03/12）が既にあるが、パターンとしての形（状態機械にするか等）は未確定 |
| Scalability Patterns | **N/A** | クライアントサイドライブラリで水平/垂直スケーリングの概念が存在しない（`nfr-requirements.md` §1 で確認済み） |
| Performance Patterns | **適用** | NFR-01（8K/60fps 目安）に対し、描画ループのスケジューリング方式やリソース再利用方針が未確定 |
| Security Patterns | **適用（大部分は既確定・残りを本ステージで確認）** | 多層防御（環境ガード→WebGL2チェック）は Functional Design で確定済み。誤用防止のための追加パターン（例: 多重初期化への防御）が未検討 |
| Logical Components | **適用** | `EventBus`/`DisposableRegistry`/`StandardMode` 等を、パターン名（Observer/Registry/Strategy/Facade 等）で明確化し、後続ユニットが参照できる形にする |

## 計画ステップ

- [x] Step 1: NFR Requirements 成果物の分析（上表に反映）
- [x] Step 2〜4: 本計画ファイルの作成・質問埋め込み
- [x] Step 5: ユーザー回答の収集・曖昧性分析（推奨セットを承認・全回答が明確な単一選択、曖昧表現なし）
- [x] Step 6: 成果物生成（`nfr-design-patterns.md` / `logical-components.md`）
- [ ] Step 7〜9: 完了メッセージ提示・承認取得・記録

## 確認質問

各質問には簡潔な比較メモと推奨案を添えた。回答は `[Answer]:` タグに記入すること。

### Question 1: 描画ループのスケジューリングパターン（Performance）

`requestAnimationFrame` ベースの描画ループを、常時連続描画にするか、状態変化時のみ再描画する方式にするか。

A) 常時連続描画（**推奨**: 実装が単純で、UoW-D（視点操作のドラッグ追従）等の高頻度更新が入る後続ユニットとも自然に整合する。モバイルでの電力消費増は将来 NFR Design の見直し対象とし、今は「滑らかさ」〔NFR-01〕を優先する）

B) 状態変化時のみ再描画（dirty flag 方式）。バッテリー効率は良いが、変化検知ロジックの複雑さが増し、UoW-D 統合時に「何が dirty か」の判定基準の作り直しが必要になるリスクがある

C) Other (please describe after [Answer]: tag below)

[Answer]: A

**採用理由**: UoW-A 単体では静的な標準ビューしか対象にならず、今 dirty flag の判定基準を精緻に設計しても後続ユニット（UoW-D 等）統合時に手戻りが起きやすい。まず単純な実装で「滑らかさ」（NFR-01）を優先し、電力最適化が実測で問題になった時点で dirty flag 化を再検討する。

### Question 2: コンテキストロスト復帰のパターン形式（Resilience）

BR-A-12（1 回だけ自動復帰を試みる）を、実装上どういう形の論理コンポーネントとして表現するか。

A) 明示的な状態機械（`healthy → lost → recovering → healthy` または `degraded`）として実装する（**推奨**: 状態が可視化され、`ViewerState`/イベントとの対応も取りやすい。後続ユニットのデバッグ・テストもしやすい）

B) シンプルな一度きりのブールフラグ（`hasAttemptedRecovery`）で最小限に実装する。実装は簡単だが、将来 UoW-C/D 等が「現在復帰中か」を参照したくなった場合に状態機械への作り直しが必要になる

C) Other (please describe after [Answer]: tag below)

[Answer]: A

**採用理由**: BR-A-12 で「1 回だけ試行」という業務ルールは確定済みだが、その実装の"形"は `unit-of-work-dependency.md` で UoW-A が全ユニットの根とされる基盤コンポーネントとして長く参照される。最初から状態を可視化しておくコストは小さく、テスト（PBT を含む）とも相性が良い。

### Question 3: リソース再生成 vs プーリング（Performance / コンテキストロスト復帰時）

コンテキストロスト復帰時、three.js リソース（シーン・カメラ・球体メッシュ）をどう扱うか。

A) 都度破棄して再生成する（**推奨**: UoW-A の対象がプレースホルダの球体メッシュ 1 個のみで再生成コストが小さく、プーリングの複雑さに見合わない。将来大きな画像テクスチャ等プーリングの価値が出た時点〔UoW-B 以降〕で再検討する）

B) 再利用可能なオブジェクトプールを用意し、破棄せず使い回す

C) Other (please describe after [Answer]: tag below)

[Answer]: A

**採用理由**: プーリングは「頻繁に生成/破棄されるオブジェクトが多数ある」場合に効くパターンだが、UoW-A の描画対象はプレースホルダの球体メッシュ 1 個のみで対象がほぼない。画像テクスチャ等プーリングの価値が出る要素は UoW-B 以降で導入される。時期尚早な最適化を避ける。

### Question 4: `EventBus` ハンドラ登録の防御的上限（Security / 誤用防止）

`on()` によるハンドラ登録数に上限を設けるか（意図しない大量登録＝メモリリーク的誤用の検知）。

A) 上限を設けない。ライブラリ利用者の責任範囲とし、`dispose()`（`EventBus.clear()`）で解放される設計（BR-A-11）で十分とする（**推奨**: UoW-A は稼働サーバーではなくクライアントライブラリであり、外部からの攻撃者が登録数を操作できる経路がない。過剰な防御はライブラリの使い勝手を損なう）

B) 一定数（例: イベント種別ごとに 100 件）を超えたら `console.warn` で警告する

C) Other (please describe after [Answer]: tag below)

[Answer]: A

**採用理由**: この上限は「外部攻撃者から保護するセキュリティ境界」ではなく「呼び出し元自身の実装ミスに対する開発者向けヒント」に過ぎない。UoW-A はサーバーではなくクライアントライブラリであり、悪意ある第三者が `on()` を呼べる経路（＝攻撃面）がそもそも存在しない。SECURITY-11 の「誤用ケースの考慮」は主に入力検証（UoW-B の画像入力等）が対象であり、内部 API の呼び出し回数はその対象外と判断する。

### Question 5: 多重初期化への防御パターン（Security / 誤用防止）

同一 `container` 要素に対して `createViewer` が複数回呼ばれた場合の扱いは、UoW-A で設計すべきか。

A) UoW-A では設計しない（対象外）。各 `createViewer` 呼び出しは独立したインスタンスを生成する単純な工場関数とし、同一 DOM 要素への多重マウントの是非は呼び出し元（アプリケーションコード）の責任とする（**推奨**: `component-methods.md` の `createViewer` シグネチャにも多重呼び出し検知の仕組みは定義されておらず、Inception の設計方針を超える追加仕様になる。DOM 要素の所有権管理はフレームワーク側〔React 等〕が担うのが自然）

B) UoW-A が `container` への二重マウントを検知し、警告または拒否する

C) Other (please describe after [Answer]: tag below)

[Answer]: A

**採用理由**: `component-methods.md` の `createViewer` シグネチャは単純な工場関数であり、多重呼び出し検知の仕組みは定義されていない。DOM 要素の所有権管理はフレームワーク側（React 等）が担うのが自然な責務分担。また React の `StrictMode` は開発時に意図的に二重マウントする仕様があり、B のような検知ロジックは開発時に誤って警告/拒否してしまうリスクがある。

### Question 6: 縮退時（WebGL2 非対応等）の DOM 操作（Logical Components / Security の境界）

`error(WEBGL_UNSUPPORTED)` で縮退する際、`container` 要素に何か描画するか。

A) `container` には何も描画しない。フォールバック表示は `error` イベントを受け取った呼び出し元の責任とする（**推奨**: `ControlsUI`（UoW-G）等の見た目を伴うフォールバック UI は他ユニットの責務であり、UoW-A が独自の DOM 要素を挿入すると後続ユニットの UI 設計と衝突するリスクがある。`component-methods.md` も `ViewerHandle` の責務を状態通知〔イベント〕に限定している）

B) 最小限のプレースホルダ要素（例: 汎用的なエラーメッセージ用 `div`）を `container` に挿入する

C) Other (please describe after [Answer]: tag below)

[Answer]: A

**採用理由**: UI 表現は一貫して UoW-G（同梱コントロール UI）に集約するという Inception の責務分担（`components.md` C10 `ControlsUI`）を尊重する。UoW-A は「何が起きたか」を正確にイベントで伝えることに専念し、見た目の責務は持たない。`component-methods.md` も `ViewerHandle` の責務を状態通知（イベント）に限定している。

## 回答後の進め方

全質問回答後、曖昧・矛盾がないか分析し、必要なら `uow-a-nfr-design-clarification-questions.md` を作成する。問題なければ Step 6 の成果物生成（`nfr-design-patterns.md` / `logical-components.md`）に進む。

## 回答決定プロセスの記録（比較検討サマリ）

各質問はユーザー提示の「推奨セット」をそのまま採用（Q1=A, Q2=A, Q3=A, Q4=A, Q5=A, Q6=A）。決定にあたり比較した選択肢ごとの長所・短所は各質問直下の「採用理由」に記録した通り。判断軸として一貫して優先したのは:

1. **時期尚早な最適化・過剰設計の回避**（dirty flag・オブジェクトプール・多重初期化検知・防御的上限は、現時点で価値に見合わないと判断）
2. **ユニット境界の尊重**（UI 表現は UoW-G、入力検証は UoW-B というように、他ユニットの責務を UoW-A で先取りしない）
3. **将来の参照容易性**（コンテキストロスト復帰の状態機械化は、基盤コンポーネントとして長く使われることを見込んだ投資）
4. **Inception 成果物との整合**（`component-methods.md` のシグネチャ・責務分担を超える追加仕様を持ち込まない）
