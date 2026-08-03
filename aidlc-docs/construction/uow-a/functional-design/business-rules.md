# Business Rules — UoW-A コア基盤

- **関連 Issue**: [#27](https://github.com/AtsutoNakayama/perisphere/issues/27)
- **作成日**: 2026-08-02
- **前提資料**: `uow-a-functional-design-plan.md`（Q1〜Q9 回答・採用理由）、`domain-entities.md`

各ルールには **trace**（対応するストーリー/要件/拡張ルール/計画質問）を付す。

## 初期化・環境ガード

### BR-A-01 環境ガード（SSR セーフ）

`createViewer` 呼び出し時に `window`/`document` が利用できない環境（サーバーサイド）では、WebGL レンダラを構築せず縮退パス（BR-A-03）へ進む。

- **trace**: NFR-03, US-34, Q8=A

### BR-A-02 WebGL2 能力チェック

環境ガードを通過した場合、WebGL2 コンテキストの取得を試行する。取得できない場合は縮退パス（BR-A-03）へ進む。

- **trace**: US-30, Q1=B

### BR-A-03 縮退時のエラー正規化

環境ガード失敗（BR-A-01）と WebGL2 非対応（BR-A-02）は、原因を区別せず共通して `code: 'WEBGL_UNSUPPORTED'` として正規化する（レンダリングが利用不可という結果は共通のため、`code` を分けない）。

- **trace**: US-30, C14 `ErrorManager`

### BR-A-04 初期化エラーイベントの発火タイミング

初期化失敗時の最初の `error` イベントは、`createViewer` の戻り値（`ViewerHandle`）を呼び出し元が受け取った**後**に登録する `on('error', ...)` が確実に間に合うよう、マイクロタスクまで発火を遅延する。

- **trace**: Q1=B の運用上の帰結（US-29 の購読タイミングを取りこぼさないための補足ルール）

### BR-A-05 初期化順序（成功パス）

以下の固定順序で初期化する:

1. 環境ガード（BR-A-01）・WebGL2 能力チェック（BR-A-02）
2. `Renderer` 初期化: シーン・カメラ・WebGL レンダラ・プレースホルダ球体メッシュを生成（BR-A-15）
3. 標準 `ViewerMode`（`StandardMode`）を適用: カメラへ既定 yaw/pitch/fov を設定（BR-A-06）
4. `EventBus`/`ViewerState` 初期化: `mode='standard'`, `ready=false`
5. 描画ループ開始（`requestAnimationFrame`）
6. `webglcontextlost`/`webglcontextrestored` リスナー登録
7. `ViewerState.ready = true` に更新
8. マイクロタスクで `ready` イベント発火（BR-A-04 と同じ遅延方針）

- **trace**: `services.md` 初期化パターン, US-06, US-34

### BR-A-06 標準モードの既定値

`StandardMode` の既定パラメータは `yaw=0`, `pitch=0`, `fov=75`（度）。既定ズーム範囲は `minFov=30`, `maxFov=90`（度、後続ユニットで調整可能な形にする）。

- **trace**: Q6=A, US-06

## イベント

### BR-A-07 `EventBus.emit` は同期実行

`emit` 呼び出し時点で、登録済みハンドラを呼び出し順に**同期的に**実行する。

- **trace**: Q3=A

### BR-A-08 ハンドラ例外の隔離

購読者のハンドラが例外を throw しても、残りのハンドラの実行と `EventBus` 自体の状態には影響しない。例外はコンソールに記録するに留める。

- **trace**: Q4=A（US-37 の障害分離思想をイベント購読者間にも適用）

## モード（標準のみ）

### BR-A-17 `setMode` への非標準値指定

UoW-A の `ViewerHandle.setMode` は `'standard'` 以外の値を受け取った場合、`INVALID_INPUT` として正規化されたエラーを `error` イベントで通知し、現在のモードは変更しない（UoW-C 統合前は他モードが未登録のため）。

- **trace**: Q9=A の帰結（UoW-A が担当する `setMode` の適用範囲）, US-32 の入力検証思想

## エラー処理・コンテキストロスト

### BR-A-09 dispose 後のメソッド呼び出し

`dispose()` 済みの `ViewerHandle` に対して他のメソッドが呼ばれた場合、no-op としつつ `console.warn` 等で開発者に知らせる。

- **trace**: Q2=B

### BR-A-10 dispose の冪等性

`dispose()` を複数回呼び出しても、実際の解体処理は 1 回のみ実行される（2 回目以降は no-op）。

- **trace**: US-31, `services.md` 破棄パターン

### BR-A-11 dispose の解体順序（UoW-A 担当範囲）

`dispose()` は次の順序で解体する（UoW-A が担当する範囲のみ。他ユニット担当分〔入力源・同梱 UI 等〕は該当ユニット実装後に解体シーケンスへ追加する）:

1. 現在の `ViewerMode`（`StandardMode`）の `dispose(ctx)`
2. `Renderer` 破棄（WebGL コンテキスト解放・球体メッシュ/マテリアル解放・描画ループ停止）
3. `webglcontextlost`/`webglcontextrestored` リスナー解除
4. `EventBus.clear()`

- **trace**: US-31（SECURITY-15 リソース解放）, `services.md` 破棄パターン

### BR-A-12 コンテキストロスト復帰は 1 回のみ試行

`webglcontextlost` 検出時は描画ループを一時停止し `error(CONTEXT_LOST)` を発火する。`webglcontextrestored` が発火した時点でリソース再構築を 1 回だけ試行する。再構築に失敗した場合は再試行せず、フォールバック表示を維持する。

- **trace**: Q7=A, US-37, RESILIENCY-10（過剰リトライの回避）

### BR-A-13 エラーメッセージの非内部化

`PerisphereError.message` にスタックトレース・内部パス・フレームワークバージョン等の内部詳細を含めない。利用者向けの安全な文言のみとする。

- **trace**: SECURITY-09, US-30

## 状態

### BR-A-14 `ViewerState` の保持範囲

UoW-A スコープの `ViewerState` は `mode` / `ready` / `loadState` / `lastError` の最小集合のみ保持する。他ユニット（視点/写真/フルスクリーン等）のフィールドは持たない。

- **trace**: Q5=A

### BR-A-16 `loadState` の意味範囲

`loadState` は UoW-A 自身の初期化処理の状態（`idle`/`ready`/`error`）を表す。UoW-A の初期化は同期処理のため `loading` は実質到達しない。画像ロードの進捗状態（UoW-B が非同期で発火する `progress` 等）とは別概念であり、混同しないこと。

- **trace**: Q5=A の運用上の補足。`domain-entities.md` E5 の注記を参照

## 描画スコープ

### BR-A-15 UoW-A 単体でのレンダースコープ

UoW-A 単体では画像テクスチャの表示は行わない。`Renderer` はプレースホルダ（無地マテリアル）の球体メッシュを生成し、実際のテクスチャ反映は UoW-B（`LoadingService`）統合後に行われる。「1 枚の画像を標準ビューで表示」という到達点は UoW-A + UoW-B の組み合わせで達成される（`unit-of-work-dependency.md` M1+M2）。

- **trace**: `unit-of-work.md` UoW-A/UoW-B 境界, `component-dependency.md` Renderer の境界説明

### BR-A-18 描画ループの単一駆動

描画ループは `requestAnimationFrame` で駆動し、1 フレームにつき 1 回のみ描画する（多重ループを生成しない）。詳細な性能チューニング（ピクセル比上限等）は NFR Design ステージで確定する。

- **trace**: NFR-01, US-36（性能の詳細設定は本ステージのスコープ外）
