# Business Rules — UoW-E ギャラリー

- **関連 Issue**: [#40](https://github.com/AtsutoNakayama/perisphere/issues/40)
- **作成日**: 2026-08-03
- **前提資料**: `uow-e-functional-design-plan.md`（Q1〜Q8 回答・採用理由）、`domain-entities.md`、UoW-A `business-rules.md`（BR-A-05〜07）、UoW-B `business-rules.md`（BR-B-02〜08, BR-B-11, BR-B-15）、UoW-D `business-rules.md`（BR-D-10, BR-D-16）

各ルールには **trace**（対応するストーリー/要件/計画質問）を付す。

## `PhotoInput` の正規化

### BR-E-01 `PhotoInput` → 内部表現への正規化（Q1）

`PhotoInput`（`ImageInput | { src: ImageInput; id?: string }`）を受け取るすべての箇所（`setPhotos` の各要素）で、`normalizePhotoInput(photo: PhotoInput): { src: ImageInput; id?: string }` を通してから内部処理に渡す。`photo` が `ImageInput`（`string | Blob`）そのものであれば `{ src: photo }` として扱い、`id` は `undefined`（`photochange` イベントでは省略）とする。

- **trace**: FR-11, Q1=A

## 写真リストの設定

### BR-E-02 `setPhotos` の初期化と自動ロード（Q7）

`setPhotos(photos: readonly PhotoInput[]): void`（IF 確定済み）は、まず `Gallery.setPhotos(photos)`（`domain-entities.md` E1）でリストを差し替え `current` を `0`（`photos.length > 0` の場合）または `-1`（空配列の場合）にリセットする。`photos.length > 0` の場合、続けて「写真切替の共通ロード処理」（BR-E-06〜08）を `index = 0` で内部的に実行し、1 枚目の写真の表示を自動的に開始する。`loadImage()`（UoW-B）と対称的に、`setPhotos` 呼び出し自体は同期 API（戻り値 `void`）のままとし、内部ロードの完了を待たない。

- **trace**: US-23, Q7=A

## `next()` / `prev()`（巡回移動）

### BR-E-03 巡回によるインデックス計算（Q2）

`next()`/`prev()`（IF 確定済み）は `Gallery.next()`/`Gallery.prev()`（E1）を呼ぶ。`GalleryMoveResult`（E3）が `{ status: "moved", index }` であれば「写真切替の共通ロード処理」（BR-E-06〜08）を `index` で実行する。`{ status: "empty" }` であれば BR-E-04 に従い何もしない。`Gallery` は末尾での `next()` を先頭（`index 0`）へ、先頭での `prev()` を末尾へ巡回させる（`size` によらず常に `moved` を返す）。

- **trace**: US-23, US-18（矢印キー相当の写真送り）, Q2=A

## 写真未設定・範囲外の扱い

### BR-E-04 写真未設定時の安全な無視（Q3）

`Gallery` の `current`/`next`/`prev`/`goTo` が `{ status: "empty" }` を返した場合（写真リストが空、または `setPhotos` が一度も呼ばれていない）、`next()`/`prev()`/`goTo(index)` はいずれも状態を変更せず `error` イベントも発火しない（UoW-D の `BR-D-16`「未実装機能へのインテントの安全な無視」と同じ「安全な no-op」方針）。

- **trace**: US-23, Q3=A

### BR-E-05 `goTo()` の範囲外指定（Q4）

`goTo(index: number): void`（IF 確定済み）は `Gallery.goTo(index)`（E1）を呼ぶ。結果が `{ status: "out-of-range" }`（写真は設定済みだが `index` が `[0, size)` の範囲外、または整数でない）の場合、`error` イベント（`INVALID_INPUT`）を発火し、`photoIndex`（`ViewerState`）・現在表示中の写真はいずれも変更しない。`{ status: "moved", index }` の場合は BR-E-06〜08 に従いロード処理を実行する。`{ status: "empty" }` の場合は BR-E-04 に従う（範囲外エラーより優先。写真が1枚も設定されていない状態は「明示的な誤り」ではなく単なる未設定状態のため）。

- **trace**: US-23, Q4=A（`setView`/`setZoomLimits` の `INVALID_INPUT` パターン〔UoW-D BR-D-10/11〕と一貫）

## 写真切替の共通ロード処理

### BR-E-06 既存ロードパイプラインの再利用

`services.md`（S5 `NavigationService`）の定義通り、写真切替（BR-E-02, BR-E-03, BR-E-05 いずれの経路からも）は UoW-B で実装済みのロードパイプライン（`Loader.validate` → 登録済みアダプタの選定〔`registerSource` で追加されたものが優先〕→ `Loader.load`（`progress` 発火）→ `ImageSourceAdapter.createTexture` → `Renderer.setSphereTexture`）をそのまま再利用する。`loadImage()`（UoW-B）専用のロジックを重複実装しない。`normalizePhotoInput`（BR-E-01）で得た `src` を、`loadImage(src)` に渡すのと同じ入力として扱う。

- **trace**: US-23, `services.md` S5, UoW-B BR-B-02〜07

### BR-E-07 ロード成功時の `photoIndex`/`photochange` 確定（Q5）

写真切替のロードが成功した場合にのみ、`ViewerState.photoIndex` を新しい `index` に更新し、`photochange`（`{ type: "photochange", index, ...(id !== undefined && { id }) }`）を発火する。`id` は BR-E-01 で正規化した `PhotoInput` の `id`（省略時はペイロードに含めない）。`photoIndex` と `Gallery.current` が別々の値である理由は BR-E-13 を参照。

- **trace**: US-23, Q5=A（UoW-B `BR-B-15`「旧テクスチャを解放してから新しいテクスチャを反映する」の後続として実行）

### BR-E-08 ロード失敗時のフォールバック（Q5）

写真切替のロードが失敗した場合、`error` イベントのみを発火し、`ViewerState.photoIndex` は変更しない（直前の写真の表示・インデックスをそのまま維持する）。UoW-B `BR-B-11`（`loadImage()` 失敗時に直前の表示が維持される）と対称的な扱い。

- **trace**: US-23, Q5=A, NFR-11（Resiliency: 安全な縮退）

### BR-E-09 連続呼び出し時のキャンセル制御（Q6）

写真切替中（ロード進行中）に `next()`/`prev()`/`goTo()`（またはこれらの内部実行）が新たに呼ばれた場合、UoW-B の `loadImage()` と同じ `AbortController` によるキャンセル機構（`BR-B-08`）をそのまま再利用し、進行中のロードを中断して最新の呼び出しを優先する。中断されたロードは `error` を発火せず静かに reject される（`BR-B-08` と同じ扱い）。この挙動が「連打すれば確実に複数先へ進む」という直感的な結果になるのは、`Gallery.current`（目標ポインタ）が呼び出しのたびに即座に前進するため（BR-E-13）である。

- **trace**: US-18（矢印キー連打）, Q6=A

### BR-E-13 `Gallery.current`（目標ポインタ）と `ViewerState.photoIndex`（表示中ポインタ）の分離（NFR Design Q1 での発見・確定）

`Gallery.current`（`domain-entities.md` E1）と `ViewerState.photoIndex`（E4）は意図的に別々の値として扱う。

- **`Gallery.current`（目標/pending）**: `next()`/`prev()`/`goTo()` 呼び出しのたびに、対応する画像ロードの成否を待たず**即座に**更新される（BR-E-03〜05 の計算結果がそのまま反映される）。
- **`ViewerState.photoIndex`（表示中/confirmed）**: 対応する画像ロードが実際に成功した場合にのみ、その時点の `Gallery.current` の値で更新される（BR-E-07）。`getPhotoIndex()` は常にこちらを返す。

**この分離が必要な理由**: 両者を同一視する（`current` をロード成功時のみ更新する単一の値とする）と、ロード確定前に `next()` を連打した場合、2回目以降の呼び出しが「まだロード未確定の同じ位置」から計算されてしまい、BR-E-09 が意図する「連打すれば確実に複数先へ進む」挙動を満たせない。分離することで、各回の呼び出しが確実に1つずつ目標を前進させられる。副次効果として、リスト中に恒常的にロードに失敗する写真があっても、利用者が `next()` を押し続ければ目標ポインタは前進し続けるため、自動リトライやスキップ処理を実装せずとも「連打で壊れた写真を通り過ぎて次の正常な写真へたどり着ける」という回復性が自然に得られる。

- **trace**: NFR Design Q1=A, BR-E-09

## `setPhotos` と `loadImage`/`registerSource` の関係

### BR-E-10 独立レイヤーとしての共存（Q8）

`setPhotos`/`next`/`prev`/`goTo`（`Gallery` 経由）と `loadImage`（UoW-B、単一画像用途）は独立した API として共存を許容し、相互排他の制御は行わない。`registerSource` で登録された `ImageSourceAdapter` は、`Gallery` 経由・`loadImage` 直接呼び出しのいずれのロードにも同じ優先順位（登録済みアダプタ > 既定の `EquirectangularSource`）で適用される（BR-E-06 が再利用する共通パイプラインの一部のため）。`setPhotos` 呼び出し後に `loadImage()` を直接呼んだ場合、表示は切り替わるが `Gallery` の `current`/`photoIndex` の追跡外になる点を公開 API の TSDoc に明記する。

- **trace**: Q8=A

## `InputIntent` との統合（UoW-D 拡張）

### BR-E-11 `photoNext`/`photoPrev` インテントの結線（UoW-D `BR-D-16` の解消）

`{ kind: "photoNext" }` / `{ kind: "photoPrev" }` intent 受信時、`createViewer` の intent ハンドラは UoW-D 時点の no-op（`BR-D-16` のコメント「UoW-E（ギャラリー）が未実装のため安全に無視する」）を解消し、それぞれ内部の `next()`/`prev()`（BR-E-03）をそのまま呼ぶ。`InputManager`/`InputSource`/`Keymap`（UoW-D で確定済み）は変更しない。`toggleFullscreen` は UoW-F 未実装のまま no-op を継続する。

- **trace**: US-18, UoW-D BR-D-16

## `getPhotoIndex()` の既定値

### BR-E-12 未設定時のデフォルト値

`getPhotoIndex(): number`（IF 確定済み）は `ViewerState.photoIndex`（初期値 `-1`）をそのまま返す。`setPhotos` が一度も呼ばれていない、または空配列が設定された状態では `-1` を返す（JS 配列の `indexOf` が未検出時に `-1` を返す慣習に合わせる）。

- **trace**: US-23
