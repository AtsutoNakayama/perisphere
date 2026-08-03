# Business Rules — UoW-B 画像入力・ロード

- **関連 Issue**: [#34](https://github.com/AtsutoNakayama/perisphere/issues/34)
- **作成日**: 2026-08-03
- **前提資料**: `uow-b-functional-design-plan.md`（Q1〜Q8 回答・採用理由）、`domain-entities.md`、UoW-A `business-rules.md`（BR-A-01〜18、特に BR-A-15/16 との整合）

各ルールには **trace**（対応するストーリー/要件/計画質問/UoW-A ルールとの関係）を付す。

## 入力・検証

### BR-B-01 `ImageInput` の型

`loadImage`/`registerSource` が受け付ける入力は `string`（URL）または `Blob` のみ。それ以外の型は呼び出し側の型エラーとする（実行時検証の対象外、TypeScript の型で防止）。

- **trace**: Q1=B, US-01, US-03

### BR-B-02 アダプタ選択（`canHandle`）

`EquirectangularSource.canHandle` は、入力が画像として扱えそうな形式（`Blob.type` が `image/jpeg`・`image/png`、または URL の拡張子が `.jpg`/`.jpeg`/`.png` ）であれば `true` を返す。`registerSource` で登録されたアダプタは登録順に先に評価され、いずれも `canHandle=false` の場合に既定の `EquirectangularSource` が最後の候補として評価される。

- **trace**: US-04（拡張アダプタが既定実装より優先されることで拡張の実効性を担保）

### BR-B-03 `validate` は形式検証のみ

`Loader.validate` は MIME/拡張子などの形式検証のみを行い、寸法の大小そのものでは拒否しない。8K を超える画像も `validate` の時点では通過させる。

- **trace**: Q5=A, FR-01, US-02, SECURITY-05

### BR-B-04 アスペクト比検証（2:1、許容誤差あり）

デコード後の実寸（`DecodedImage.width`/`height`）に対し、`width / height` が `2 ± 0.01`（許容誤差 0.5%）の範囲外の場合、`INVALID_INPUT` として正規化する。URL 文字列や `Blob` の時点では実寸が不明なため、この検証は取得・デコード後に行われる。

- **trace**: Q2=B, US-01

### BR-B-05 WebGL 最大テクスチャサイズ超過の検知

`EquirectangularSource.createTexture` は、`DecodedImage` の実寸が `SourceContext.maxTextureSize` を超える場合、`Renderer` へは反映せず `IMAGE_LOAD_FAILED` として正規化する（形式は正しいが実行環境で描画できないため）。

- **trace**: Q4=A, FR-01, NFR-01（8K 超は性能保証対象外）

## 取得・デコード・進行通知

### BR-B-06 取得・デコード方式

`Loader.load` は、入力が URL（`string`）の場合は `fetch` でバイト取得し、`Blob` の場合は直接デコードする。いずれも `createImageBitmap` でデコードする。

- **trace**: Q3=A

### BR-B-07 進行イベントの発火

`fetch` のレスポンスに `Content-Length` があれば実バイト数で `progress`（`{ loaded, total }`）を発火する。`Content-Length` が取得できない場合、または入力が `Blob` の場合は `total` を省略した `progress`（`{ loaded }`）を発火する。発火回数・頻度は環境依存であり保証しない。

- **trace**: Q3=A, US-03

### BR-B-08 多重呼び出し時のキャンセル

`loadImage` が進行中に再度呼ばれた場合、前回の `Loader.load` を `AbortController` で中断し、新しい呼び出しを開始する（最新呼び出し優先）。中断された前回の呼び出しはエラーイベントを発火せず、静かに破棄される（ユーザー起因の意図的な切り替えであり、障害ではないため）。

- **trace**: Q6=A

## テクスチャ反映・状態

### BR-B-09 `Renderer` への反映経路

`SourceResult.texture` は `Renderer.setSphereTexture(texture)` 経由でのみ反映する。`Renderer` の内部プロパティ（`sphereMesh` 等）への直接操作は行わない。

- **trace**: Q7=A

### BR-B-10 `ImageLoadState` の独立性

`ViewerState.imageLoadState` は UoW-A の `loadState`（初期化状態）とは独立して管理する。`loadImage` 呼び出し開始時に `'loading'`、成功時に `'ready'`、失敗時に `'error'` へ遷移する（初期値は `'idle'`）。

- **trace**: Q8=A, BR-A-16

### BR-B-11 失敗時のフォールバック（既存表示の維持）

`loadImage` が失敗した場合、`Renderer.setSphereTexture` を呼ばない。これにより、直前に成功していたテクスチャ（あれば）または初期のプレースホルダ球体メッシュ（BR-A-15）がそのまま表示され続ける。失敗を理由に表示中の画像を消去することはしない。

- **trace**: US-30 の思想（フォールバック表示）を画像切り替え時にも適用。新規設計判断（Part 1 の質問には含まれない詳細レベルの決定）

### BR-B-12 エラーコードの正規化対応

| 失敗要因 | `PerisphereError.code` |
|---|---|
| 形式不正・2:1 でない | `INVALID_INPUT` |
| 取得失敗（404・CORS・ネットワーク） | `IMAGE_LOAD_FAILED` |
| WebGL 最大テクスチャサイズ超過 | `IMAGE_LOAD_FAILED` |

いずれも `error` イベントを発火し、かつ `loadImage` が返す `Promise` を同じ `PerisphereError` で reject する（イベント購読と `await` の両方で失敗を検知できるようにする）。

- **trace**: US-01, US-03, US-32, BR-A-13（メッセージの非内部化を継承）

### BR-B-13 縮退（WebGL2 非対応）ハンドルでの `loadImage`

WebGL2 非対応等で縮退した `ViewerHandle`（`Renderer` が存在しない）に対し `loadImage` が呼ばれた場合、`WEBGL_UNSUPPORTED` として即座に `error` を発火し、`Promise` を reject する。

- **trace**: BR-A-01〜03（縮退パス）の一貫した継続。新規設計判断

### BR-B-14 dispose 後の `loadImage`

`dispose()` 済みの `ViewerHandle` に対する `loadImage` 呼び出しは、UoW-A の BR-A-09 と同様に no-op としつつ `console.warn` する（`Promise` は解決も拒否もされない実行未到達として扱わず、即座に拒否する）。

- **trace**: BR-A-09 の拡張

## リソース解放

### BR-B-15 旧テクスチャの解放

新しいテクスチャへの切り替え時、旧 `SourceResult` は選択されたアダプタの `dispose(oldResult)` で解放してから新しいテクスチャを反映する。

- **trace**: US-31, BR-A-11（UoW-A の解体順序パターンを踏襲）

### BR-B-16 `Viewer` 全体の dispose 時

`ViewerHandle.dispose()` 時、現在表示中のテクスチャ（存在すれば）も `DisposableRegistry`（UoW-A E7）へ登録された解体手順の一部として解放される。

- **trace**: US-31, BR-A-11
