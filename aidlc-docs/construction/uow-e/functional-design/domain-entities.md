# Domain Entities — UoW-E ギャラリー

- **関連 Issue**: [#40](https://github.com/AtsutoNakayama/perisphere/issues/40)
- **作成日**: 2026-08-03
- **前提資料**: `uow-e-functional-design-plan.md`（Q1〜Q8 回答）、`inception/application-design/component-methods.md`（`Gallery` 擬似定義・`ViewerHandle` 拡張点は Inception で確定済み）、UoW-A/UoW-B/UoW-D `domain-entities.md`
- **注記**: 本ユニットのエンティティ番号（E1〜）はこのドキュメント内で独立採番する。`component-methods.md` 冒頭の注記の通り、擬似定義（`next(): number` 等）は「設計意図を示す」ものであり、詳細な戻り値型はここで確定する（Q3/Q4 のエラー・no-op 区別のため）。

## エンティティ一覧

| # | 名称 | 種別 | 概要 |
|---|---|---|---|
| E1 | `Gallery` | 内部エンティティ（C8） | 写真リストとカレントインデックスの保持、`next`/`prev`/`goTo` の純粋なインデックス計算 |
| E2 | `PhotoInput` | 公開値オブジェクト（判別可能なユニオン、新規） | `setPhotos` に渡す 1 枚の写真の入力表現（Q1） |
| E3 | `GalleryMoveResult` | 内部値オブジェクト（判別共用体、新規） | `Gallery` の移動系メソッドの結果。「移動できた」「写真未設定」「範囲外」を型で区別する（Q3/Q4） |
| E4 | `ViewerState`（拡張） | 値オブジェクト（UoW-A C12 の拡張） | `photoIndex: number` を追加 |
| E5 | `ViewerEventMap`（拡張） | 値オブジェクト（UoW-A C11 の拡張） | `photochange: PhotoChangeEvent` を追加 |
| E6 | `ViewerHandle`（拡張） | 公開ファサード（UoW-A C1 の拡張、Inception 確定済み IF） | `setPhotos`/`next`/`prev`/`goTo`/`getPhotoIndex` を追加 |

## エンティティ詳細

### E1 `Gallery`（C8）

```ts
class Gallery {
  setPhotos(photos: readonly PhotoInput[]): void;   // Q7: 呼び出しごとに index をリセット
  next(): GalleryMoveResult;                        // Q2: 巡回（ループ）
  prev(): GalleryMoveResult;                        // Q2: 巡回（ループ）
  goTo(index: number): GalleryMoveResult;            // Q4: 範囲外は "out-of-range"
  get current(): number;                             // 未設定時は -1
  get size(): number;
  getPhoto(index: number): PhotoInput | undefined;
}
```

- **責務**: 写真リストとカレントインデックスの保持、および `next`/`prev`/`goTo` の入力に対する新インデックスの計算のみ。実際の画像ロード起動・`photochange` 発火・エラー通知は行わない（副作用を持たない）。UoW-D の `ViewController`（純粋な視点計算）と `InputManager`/`createViewer`（実際の副作用実行）の責務分離パターンをそのまま踏襲する。
- **`current` は「目標（pending）インデックス」（NFR Design Q1 での発見・確定）**: `current`（このメソッドが返す・保持する値）は、`next()`/`prev()`/`goTo()` 呼び出しのたびに、対応する画像ロードの成否を待たず**即座に**更新される。これは `ViewerState.photoIndex`（E4、ロード成功時にのみ更新される「表示中（confirmed）インデックス」）とは意図的に別の値である。両者を同一視すると、ロード確定前に `next()` を連打した場合、2回目以降の呼び出しが「まだロード未確定の同じ位置」から計算されてしまい、`business-rules.md` BR-E-09 が想定する「連打すれば確実に複数先へ進む」挙動を満たせない。
- **`next()`/`prev()`（Q2=A 巡回）**: `size === 0` なら `{ status: "empty" }` を返す。それ以外は `(current + 1) % size` / `(current - 1 + size) % size` で新インデックスを計算し、`{ status: "moved", index }` を返す（`size` がどの値でも常に有効な巡回結果になる）。
- **`goTo(index)`（Q4）**: `size === 0` なら `{ status: "empty" }`。`size > 0` かつ `index` が整数でない、または `[0, size)` の範囲外なら `{ status: "out-of-range" }`。範囲内なら `{ status: "moved", index }`。
- **`setPhotos(photos)`（Q7）**: リストを差し替え、`photos.length > 0` なら `current` を `0` に、`photos.length === 0` なら `current` を `-1` にリセットする。

### E2 `PhotoInput`（公開値オブジェクト、Q1）

```ts
/** setPhotos に渡す1枚の写真の入力表現（FR-11）。id を省略できる利便性を優先したユニオン型（Q1=A）。 */
export type PhotoInput = ImageInput | { src: ImageInput; id?: string };
```

- **設計方針**: `ImageInput`（`string | Blob`）を直接渡せる簡潔な形と、`id` を指定したい場合のオブジェクト形の両方を許容する。`id` は `photochange` イベント（E5）で利用者に返す任意の識別子であり、`Gallery`/`createViewer` 内部では使用しない（内部処理は常にインデックスで管理する）。
- **正規化（BR-E-01 参照）**: `PhotoInput` を `{ src: ImageInput; id?: string }` へ正規化するヘルパー（`normalizePhotoInput`）を介してから内部処理に渡す。

### E3 `GalleryMoveResult`（内部値オブジェクト、Q3/Q4）

```ts
type GalleryMoveResult =
  | { status: "moved"; index: number }
  | { status: "empty" }          // 写真未設定（size === 0）。Q3: 呼び出し元は無視（no-op）する
  | { status: "out-of-range" };  // goTo() の範囲外指定のみ。Q4: 呼び出し元は error(INVALID_INPUT) を発火する
```

- **設計方針**: `next()`/`prev()`/`goTo()` の「何もしない（Q3）」と「エラー通知が必要（Q4）」を、`null` のような曖昧な単一の sentinel ではなく型で明示的に区別する。呼び出し元（`createViewer`）は `status` を見て分岐するだけでよく、`Gallery` 自体は `EventBus`/`ErrorManager` を知る必要がない（E1 の副作用フリーな設計を維持する）。

### E4 `ViewerState`（拡張）

```ts
export interface ViewerState {
  mode: ViewerModeId;
  ready: boolean;
  loadState: "idle" | "loading" | "ready" | "error";
  lastError: PerisphereError | null;
  imageLoadState: ImageLoadState;
  view: ViewState;
  photoIndex: number;   // 新規追加。未設定時は -1（C12 の責務「写真 index」部分、Q3/getPhotoIndex 既定値）
}
```

`getPhotoIndex()` はこのフィールドをそのまま返す（BR-E-12）。写真リスト自体（`PhotoInput[]`）は `ViewerState` には含めず、`Gallery`（E1）内部の非公開状態として保持する（`ViewerState` は「プレーンな状態のスナップショット」という UoW-A の既存方針〔C12〕を踏襲し、リストのような可変長データは持たせない）。

**`photoIndex` は「表示中（confirmed）インデックス」（NFR Design Q1 での発見・確定）**: `Gallery.current`（E1、呼び出しのたびに即座に前進する「目標」インデックス）とは異なり、`photoIndex` は写真切替のロードが実際に成功した場合にのみ、その時点の目標インデックスの値で更新される（`business-rules.md` BR-E-07）。`getPhotoIndex()` が返すのは常にこの確定値であり、ロード中・ロード失敗中の目標値を先読みして返すことはない。

### E5 `ViewerEventMap`（拡張）

```ts
/** 写真切替通知。UoW-A〜D の他イベント（ReadyEvent 等）と同じく判別用の type フィールドを持つ。 */
export interface PhotoChangeEvent {
  type: "photochange";
  index: number;
  id?: string;
}

export interface ViewerEventMap {
  ready: ReadyEvent;
  error: ErrorEvent;
  modechange: ModeChangeEvent;
  progress: ImageProgressEvent;
  viewchange: ViewChangeEvent;
  zoomchange: ZoomChangeEvent;
  photochange: PhotoChangeEvent;   // 新規追加
}
```

- **`component-methods.md` からの精緻化**: Inception の擬似定義は `photochange: { index: number; id?: string } `（`type` フィールドなし）だったが、`viewer/types.ts` の既存イベント型（`ReadyEvent`/`ErrorEvent`/`ModeChangeEvent`/`ImageProgressEvent`/`ViewChangeEvent`/`ZoomChangeEvent`）は全て判別用の `type: "..."` リテラルを持つ実装済みパターンがあるため、`PhotoChangeEvent` もこれに合わせる（UoW-D の `ViewChangeEvent`/`ZoomChangeEvent` 追加時と同じ精緻化）。ペイロードの意味（`index`/`id?`）自体は変更しない。

### E6 `ViewerHandle`（拡張）

```ts
export interface ViewerHandle {
  // ...UoW-A〜D で追加済みのメンバー...

  /** 写真リストを設定する。index は 0 にリセットされ、1 枚目のロードが自動的に開始される（Q7=A）。 */
  setPhotos(photos: readonly PhotoInput[]): void;
  /** 次の写真へ切り替える。リスト末尾では先頭へ巡回する（Q2=A）。写真が未設定なら何もしない（Q3=A）。 */
  next(): void;
  /** 前の写真へ切り替える。リスト先頭では末尾へ巡回する（Q2=A）。写真が未設定なら何もしない（Q3=A）。 */
  prev(): void;
  /** 指定インデックスの写真へ切り替える。範囲外は `error`（`INVALID_INPUT`）を発火し変更しない（Q4=A）。写真が未設定なら何もしない（Q3=A）。 */
  goTo(index: number): void;
  /** 現在の写真インデックスを返す。写真が一度も設定されていなければ `-1`。 */
  getPhotoIndex(): number;
}
```

`component-methods.md` で確定済みのシグネチャ（`setPhotos(photos: PhotoInput[]): void` / `next(): void` / `prev(): void` / `goTo(index: number): void` / `getPhotoIndex(): number`）は変更しない。`PhotoInput` の実体（E2）と、未設定・範囲外時の挙動（Q3/Q4）を本ステージで確定する。
