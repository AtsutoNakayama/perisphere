# Functional Design Plan — UoW-A コア基盤

- **関連 Issue**: [#27](https://github.com/AtsutoNakayama/perisphere/issues/27)
- **作成日**: 2026-08-02
- **前提資料**: `inception/application-design/unit-of-work.md`（UoW-A 節）、`unit-of-work-story-map.md`、`components.md`、`component-methods.md`、`services.md`、`user-stories/stories.md`

## ユニット範囲の再確認

UoW-A の責務は以下（Inception 成果物より）:

- ビューワーのライフサイクル統括（初期化順序・SSR セーフな起動・結線・破棄）— C2 `Viewer` / S1 `ViewerService`
- three.js 描画基盤（描画ループ・コンテキストロスト検出/復帰）— C3 `Renderer`
- 型付きイベント発火 — C11 `EventBus`
- 状態保持 — C12 `ViewerState`
- エラー正規化とフォールバック — C14 `ErrorManager` / S7 `DiagnosticsService`
- リソース確実解放 — C15 `Disposable`
- **標準ビュー**（`ViewerMode` IF 上の最小実装 1 件）。ModeRegistry の拡張機構本体・残り 6 モードは UoW-C。

対応ストーリー: US-06, US-29, US-30, US-31, US-34, US-36, US-37

UoW-A 時点でまだ存在しない他ユニットの機能（画像ロード=UoW-B、視点操作=UoW-D、ギャラリー=UoW-E、フルスクリーン=UoW-F、同梱 UI=UoW-G、React アダプタ=UoW-H）は本ユニットのスコープ外。`ViewerHandle`（C1）はユニット横断の公開ファサードだが、本ユニットでは後続ユニットが実装するメソッドの**足場（スタブ/型のみ）**を置くか、後続ユニットで追加するかは Q9 で確認する。

## 計画ステップ

- [x] Step 1: ユニットコンテキスト分析（本ファイル冒頭）
- [x] Step 2〜4: 本計画ファイルの作成・質問埋め込み（本ファイル）
- [x] Step 5: ユーザー回答の収集・曖昧性分析（推奨セットを承認・全回答が明確な単一選択、曖昧表現なし）
- [ ] Step 6: 成果物生成（`business-logic-model.md` / `business-rules.md` / `domain-entities.md`）
- [ ] Step 7〜9: 完了メッセージ提示・承認取得・記録

## 確認質問

質問は `common/question-format-guide.md` の形式に従う。回答は各質問の `[Answer]:` タグに記入すること。

### Question 1: 初期化失敗（WebGL2 非対応）時の `createViewer` の挙動

`ViewerService` が WebGL2 能力を確認できない場合、`createViewer(container, options)` はどう振る舞うべきか。

A) 同期的に例外を throw する（呼び出し元が try/catch する設計）

B) 例外は投げず `ViewerHandle` を返し、直後（同一 tick 完了前）に `error(WEBGL_UNSUPPORTED)` イベントを発火してフォールバック表示に倒す（ハンドルは以後 no-op に近い縮退状態）

C) `Promise` を返す非同期ファクトリにし、解決前に失敗時は reject する

D) Other (please describe after [Answer]: tag below)

[Answer]: B

**採用理由**: `component-methods.md` の `createViewer` シグネチャは同期戻り値であり、A/C は同期 API の設計と矛盾する。US-30/US-37「画面が固まらず状態が分かる」「復帰を試み不能ならフォールバック」という受け入れ基準は、ハンドルを返しつつ `error` イベント＋縮退状態に倒す挙動を直接要求している。SECURITY-15（fail closed・グローバルエラーハンドラでの安全な応答）とも整合。

### Question 2: `dispose()` 後にメソッドを呼んだ場合の挙動

`dispose()` 済みの `ViewerHandle` に対して他のメソッド（`setMode` 等）が呼ばれた場合の扱いは？

A) 何もしない no-op（サイレント）

B) no-op だが `console.warn` 等で開発者に知らせる

C) 例外を throw する

D) Other (please describe after [Answer]: tag below)

[Answer]: B

**採用理由**: サイレント no-op（A）は誤用（dispose 後の呼び出し＝バグの兆候）に開発者が気づけない。例外 throw（C）は SECURITY-15「未処理例外を production で出さない・fail closed」の方針と相性が悪く、SPA の unmount 直後の非同期コールバック等で予期せず例外が飛ぶリスクが高い。B は壊れない（fail-safe）ことを優先しつつ、`console.warn` で誤用を可視化でき両立する。

### Question 3: `EventBus.emit` のタイミング（同期 / 非同期）

型付きイベント（`ready`/`error`/`modechange` 等）の発火は同期・非同期どちらを基本とするか。

A) 常に同期発火（`emit` 呼び出し時点で全ハンドラを即時実行）

B) 常にマイクロタスク/次フレームまで遅延（非同期発火）

C) イベント種別により使い分ける（例: 高頻度系は次フレームまとめ、それ以外は同期）

D) Other (please describe after [Answer]: tag below)

[Answer]: A

**採用理由**: UoW-A が発火する対象イベント（`ready`/`error`/`modechange`）はいずれも低頻度。高頻度イベント（`viewchange`/`zoomchange`）のスロットリング設計は `services.md` にも「Functional Design で確定」と明記されているが、それらは UoW-D で実際に発火されるため、今 B/C のような使い分け設計を導入すると UoW-A の責務を超えて複雑化する。単純な同期実装とし、必要になった時点（UoW-D）で再検討する。同期発火は Property-Based Testing 拡張ともテストしやすさの面で相性が良い。

### Question 4: イベントハンドラ内で例外が発生した場合の `EventBus` の扱い

購読者のハンドラが例外を throw した場合、`EventBus` はどう扱うべきか。

A) 握りつぶして他のハンドラの実行を継続する（コンソールにはエラーを出す）

B) 即座に再 throw し、以降のハンドラの実行を中断する

C) `DiagnosticsService`（`ErrorManager`）に正規化して渡し、内部エラーとして扱う（UI 上のフォールバックは発生させない）

D) Other (please describe after [Answer]: tag below)

[Answer]: A

**採用理由**: US-37「一部の失敗で全体が巻き込まれない（障害分離）」の思想をイベント購読者間にも適用する。1 つの `on()` ハンドラの不具合が他の購読者やビューワー本体を巻き込まないことが最も安全なデフォルト。再 throw（B）は他の正常な購読者の実行まで止めてしまい US-37 の思想に反する。`ErrorManager` への正規化（C）は、購読側ハンドラの不具合はビューワー内部エラーではなく `PerisphereError` の `code` 体系にも該当するものがなく意味的に無理がある。

### Question 5: `ViewerState`（UoW-A スコープ）が保持するフィールド

UoW-A の時点でまだ実装されない機能（視点/写真/フルスクリーン等）を除くと、`ViewerState` が本ユニットで保持すべき状態は何か。

A) `mode`（現在のモード ID）・`ready`（初期化完了フラグ）・`loadState`（idle/loading/error 等の大分類）・`lastError` の最小集合のみ

B) A に加えて、後続ユニットが追加するフィールド（`view`/`photoIndex`/`fullscreen` 等）の型プレースホルダも先出しで定義しておく

C) 状態は `ViewerState` に集約せず、各ユニットが自分のローカル状態を持ち `EventBus` 経由でのみ同期する（UoW-A では実質空に近い）

D) Other (please describe after [Answer]: tag below)

[Answer]: A

**採用理由**: プロジェクトの一貫した方針（小さく作り、必要になった時点で拡張＝Future ユニットと同じ思想）に合う。`services.md`（Q6=A: プレーン状態 + イベントを `ViewerState` に集約する設計）は既に確定済みであり、C はこの Inception 決定と矛盾するため不採用。B は視点/写真の単位・型が UoW-D/E の Functional Design でまだ決まっていない段階で先取りすることになり、手戻りリスクが高い。`unit-of-work.md`「1 unit = 1 Issue」の原則上も、他ユニットの型を先取りしないほうが依存関係がクリーンに保たれる。

### Question 6: 標準モードの投影既定値

標準ビュー（`ViewerMode` 標準実装）の初期パラメータ既定値は？

A) yaw=0, pitch=0（正面中央）、FOV は 75°を既定とし、ズーム上下限は暫定で minFov=30°/maxFov=90°（実際の最終値は UoW-D/C で調整可能な形にする）

B) 既定値は本ユニットでは定義せず `options` 必須（呼び出し元が毎回指定）とする

C) Other (please describe after [Answer]: tag below)

[Answer]: A

**採用理由**: US-06 の受け入れ基準が「モード未指定で初期化される」ことを明示的に前提としており、既定値なし（B）では US-06 を満たせない。既定値ありなら `options` なしで `createViewer` を呼んでも動作し、"1 枚を標準ビューで表示" という最初の到達点（M1+M2）を最短で検証できる。数値自体（75°等）は変更容易なパラメータであり、後から調整可能。

### Question 7: WebGL コンテキストロスト復帰の再試行戦略

`webglcontextlost` 検出後、`webglcontextrestored` を待って自動復帰を試みる際の方針は？

A) `webglcontextrestored` イベントが発火した時点で 1 回だけ自動的にリソースを再構築する。再構築自体が失敗した場合はフォールバック表示のまま復帰しない（再試行ループはしない）

B) 一定回数（例: 3 回）まで再試行し、それでも失敗すればフォールバック

C) 自動復帰はせず、利用者が明示的に再初期化 API を呼ぶまでフォールバック表示を維持する

D) Other (please describe after [Answer]: tag below)

[Answer]: A

**採用理由**: US-37 の受け入れ基準「復帰を試み、不能ならフォールバック」を満たす最小実装。`webglcontextrestored` はブラウザ側が「今なら復帰できる」と判断した通知であり、追加のポーリング的再試行ロジック（B）を導入しても成功率が上がる根拠が薄く、バックオフ/タイムアウト設計は UoW-A の責務としては過剰。C は "試みる" ことを要求する受け入れ基準に反する。RESILIENCY-10（依存の分離／サーキットブレーカ的思想）にも合致し、無限リトライで問題を長引かせず失敗を確定させて安全な状態（フォールバック）に倒す。

### Question 8: SSR セーフティの実装境界

`createViewer` 自体がサーバー環境（`window`/`document` 不在）で呼ばれた場合の扱いは、UoW-A の責務か。

A) UoW-A の責務とする。`createViewer` 内でブラウザ環境チェックを行い、非ブラウザ環境では明確なエラー（例外 or `error` イベント）を返す（呼び出し元の React アダプタ側の `useEffect` ガードと二重の安全網にする）

B) UoW-A の責務外。「クライアントでのみ呼ぶこと」は契約として文書化するのみで、実行時ガードは呼び出し元（UoW-H React アダプタ）の責任とする

C) Other (please describe after [Answer]: tag below)

[Answer]: A

**採用理由**: `unit-of-work.md` の UoW-A 節が NFR-03（SSR セーフ）を明記しており、これはコアの責務と読める。React 以外の将来アダプタ（UoW-H-F）ごとに `useEffect` 相当のガードを毎回正しく実装する保証はなく、"コア改修なしにアダプタを追加できる"（US-33）という拡張性方針からも、安全性をコア側 1 箇所で担保するほうが保守性が高い（呼び出し元のガードと合わせた二重の安全網）。

### Question 9: `ViewerHandle`（C1）の本ユニットでの扱い

`ViewerHandle` は全ユニット共通の公開ファサードだが、UoW-A 時点では他ユニット（B/C/D/E/F/G/H）のメソッド実装はまだ存在しない。どう進めるか。

A) UoW-A では `ViewerHandle` に UoW-A が担当するメンバー（イベント購読 `on/off/once`・`dispose`・`getMode`/`setMode`〔標準モードのみ有効〕）のみを実装する。他メソッドは後続ユニットのマージ時に追加する（本ユニットでは定義しない＝型自体もまだ作らない）

B) `ViewerHandle` インターフェース全体（`component-methods.md` の全シグネチャ）を型として先に定義し、未実装メソッドは `NOT_IMPLEMENTED` 相当で throw するスタブにしておく

C) Other (please describe after [Answer]: tag below)

[Answer]: A

**採用理由**: `component-methods.md` 自身が「型名・引数は実装段階で調整されうる（設計意図を示す擬似定義）」と明記しており、他ユニットの型を先取りするリスク（UoW-B〜G の Functional Design で型を変えたい場合の UoW-A への手戻り）の方が大きい。スタブの `NOT_IMPLEMENTED` throw（B）は SECURITY-15「fail closed だが未処理例外を production に出さない」方針とも噛み合いが悪い。`unit-of-work-dependency.md` の DAG（UoW-A が根、各ユニットが順に機能を追加）にも自然に沿う。

## 回答後の進め方

全質問回答後、曖昧・矛盾がないか分析し、必要なら `uow-a-functional-design-clarification-questions.md` を作成する。問題なければ Step 6 の成果物生成に進む。

## 回答決定プロセスの記録（比較検討サマリ）

各質問はユーザー提示の「推奨セット」をそのまま採用（Q1=B, Q2=B, Q3=A, Q4=A, Q5=A, Q6=A, Q7=A, Q8=A, Q9=A）。決定にあたり比較した選択肢ごとの長所・短所は各質問直下の「採用理由」に記録した通り。判断軸として一貫して優先したのは:

1. **Inception 成果物との整合**（`unit-of-work.md` / `component-methods.md` / `services.md` の既定義との矛盾回避）
2. **対応ユーザーストーリーの受け入れ基準との一致**（US-06, US-30, US-37 等）
3. **Enabled 状態の拡張ルールとの整合**（SECURITY-15 fail closed・未処理例外の非露出、SECURITY-09 内部詳細の非露出、RESILIENCY-10 依存分離／過剰リトライの回避）
4. **YAGNI／ユニット境界の維持**（後続ユニット〔UoW-B〜H〕の型・責務を UoW-A で先取りしない）
