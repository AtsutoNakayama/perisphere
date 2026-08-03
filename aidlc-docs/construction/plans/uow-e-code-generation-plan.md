# Code Generation Plan — UoW-E ギャラリー

- **関連 Issue**: [#40](https://github.com/AtsutoNakayama/perisphere/issues/40)
- **作成日**: 2026-08-03
- **前提資料**: `construction/uow-e/functional-design/`（domain-entities.md〔E1〜E6〕/ business-rules.md〔BR-E-01〜13〕/ business-logic-model.md〔P1〜P5〕）、`construction/uow-e/nfr-requirements/tech-stack-decisions.md`、`construction/uow-e/nfr-design/`（nfr-design-patterns.md〔RP-E-1, RP-E-2, SP-E-1〕/ logical-components.md〔L1〜L4〕）、`construction/uow-e/infrastructure-design/`（変更不要と確認済み）

**本ファイルは Code Generation の単一の情報源である。**

## ユニットコンテキスト

- **担当ストーリー**: US-23, US-24（標準 UI 自体は UoW-G の範囲）
- **依存ユニット**: UoW-A（マージ済み）、UoW-B（マージ済み）
- **公開インターフェースの追加**: `ViewerHandle.setPhotos`/`next`/`prev`/`goTo`/`getPhotoIndex`（Inception `component-methods.md` で確定済み、本ユニットで初実装）、`ViewerEventMap.photochange`、公開型 `PhotoInput`
- **コード配置**: 新規ディレクトリ `packages/core/src/gallery/`（`interaction/`/`loader/`/`modes/` と並ぶユニット単位のディレクトリ構成、`unit-of-work.md` のコード構成戦略）。既存の `viewer/types.ts`/`viewer/ViewerState.ts`/`viewer/createViewer.ts`/`index.ts` は既存ファイルの修正
- **実装上の設計判断（NFR Design からの継続）**: 写真切替は UoW-B `loadImage()` の内部処理（`Loader.validate` → アダプタ選定 → `Loader.load` → `createTexture` → `Renderer.setSphereTexture`）を共有関数として抽出し、`loadImage()`・写真切替の両方から呼ぶ（BR-E-06/RP-E-2）。これにより `currentAbortController`/`currentSource` によるキャンセル制御（UoW-B BR-B-08）が自動的に写真切替にも適用される（BR-E-09 は新規実装不要）
- **縮退ハンドル（WebGL2 非対応）での扱い**: `setPhotos`/`next`/`prev`/`goTo`/`getPhotoIndex` は同期 API（`void`/`number` 戻り値、Promise を返さない）であるため、UoW-D の `interaction` capability（`setView`/`setZoomLimits` 等）と同じく縮退ハンドルでも安全な no-op とする（`getPhotoIndex` は常に `-1`）。`loadImage()`（Promise を返し `WEBGL_UNSUPPORTED` で reject する）とは異なる扱いだが、これは戻り値の型が異なることによる既存パターンの単純な適用であり、新規の設計判断ではない

## Step 1: Project Structure Setup

**該当なし（スキップ）**。既存ワークスペース・`packages/core` 構成をそのまま使う。新規ディレクトリは `packages/core/src/gallery/`（Step 2 内で作成）。

## Step 2: Business Logic Generation

- [x] 2-1. `packages/core/src/gallery/types.ts`（新規）— `PhotoInput`（E2、`ImageInput | { src: ImageInput; id?: string }`）、`GalleryMoveResult`（E3、判別共用体 `"moved" | "empty" | "out-of-range"`）
- [x] 2-2. `packages/core/src/gallery/Gallery.ts`（新規）— `Gallery` クラス（E1/L1）:
  - `setPhotos(photos)`: リスト差し替え、`current` を `0`（非空）または `-1`（空）にリセット（BR-E-02）
  - `next()`/`prev()`: モジュロ演算による巡回、`size === 0` なら `{ status: "empty" }`、それ以外は即座に `current` を更新し `{ status: "moved", index }`（BR-E-03、RP-E-1 の目標ポインタ）
  - `goTo(index)`: `size === 0` なら `{ status: "empty" }`、整数でない/範囲外なら `current` を変更せず `{ status: "out-of-range" }`、範囲内なら `current` を更新し `{ status: "moved", index }`（BR-E-05）
  - `get current()`/`get size()`/`getPhoto(index)`
  - `normalizePhotoInput(photo: PhotoInput)`（BR-E-01、モジュール内ヘルパー関数。独立モジュール化しない、NFR Design Q3）
- [x] 2-3. `packages/core/src/viewer/types.ts`（既存修正）:
  - `PhotoChangeEvent`（`{ type: "photochange"; index: number; id?: string }`）を追加し `ViewerEventMap.photochange` へ追加（E5）
  - `ViewerState.photoIndex: number` を追加（E4）
  - `ViewerHandle` に `setPhotos(photos: readonly PhotoInput[]): void` / `next(): void` / `prev(): void` / `goTo(index: number): void` / `getPhotoIndex(): number` を追加（`component-methods.md` 確定済みシグネチャ、E6）
  - `../gallery/types.js` から `PhotoInput` を import
- [x] 2-4. `packages/core/src/viewer/ViewerState.ts`（既存修正）— `createViewerState()` の戻り値に `photoIndex: -1` を追加
- [x] 2-5. `packages/core/src/viewer/createViewer.ts`（既存修正、L3）:
  - `Gallery`（`../gallery/Gallery.js`）・`PhotoInput`（型）を import し、`const gallery = new Gallery();` を生成
  - 既存 `loadImage` 関数内の共通ロード処理（`validate` → アダプタ選定 → `load` → `createTexture` → テクスチャ差し替え → `state.imageLoadState` 更新、中断・エラー処理を含む）を `performLoad(input: ImageInput): Promise<void>` として抽出する（BR-E-06/RP-E-2）。既存の `loadImage(input)` はこの関数をそのまま呼ぶ薄いラッパーになる（外部から見た挙動は変更しない）
  - `switchToPhoto(index: number): Promise<void>` を新設: `gallery.getPhoto(index)` → `normalizePhotoInput` → `performLoad(normalized.src)` を呼ぶ。成功時: `state.photoIndex = index` を更新し `photochange`（`{ type: "photochange", index, ...(normalized.id !== undefined && { id: normalized.id }) }`）を発火（BR-E-07、RP-E-1 の確定側）。`isAbortError` の場合は静かに終了（BR-E-09）。それ以外の失敗は `performLoad` が既に `error` を発火・reject 済みのため、ここで catch して握りつぶす（`photoIndex` は更新しない、BR-E-08）
  - `setPhotos(photos)`: `gallery.setPhotos(photos)` → `photos.length > 0` なら `void switchToPhoto(0)`（BR-E-02）
  - `next()`/`prev()`: `gallery.next()`/`gallery.prev()` の結果が `"moved"` なら `void switchToPhoto(index)`、`"empty"` なら何もしない（BR-E-03/04）
  - `goTo(index)`: `gallery.goTo(index)` の結果が `"moved"` なら `void switchToPhoto(index)`、`"out-of-range"` なら `errorManager.report("INVALID_INPUT", ...)`、`"empty"` なら何もしない（BR-E-04/05）
  - `getPhotoIndex()`: `state.photoIndex` を返す
  - `handleInputIntent` の `photoNext`/`photoPrev` ケース（UoW-D 時点は no-op、`BR-D-16`）をそれぞれ `next()`/`prev()` の呼び出しへ差し替える（BR-E-11）。`toggleFullscreen` は UoW-F 未実装のまま no-op を継続
  - `buildHandle`/`HandleDeps` に新しい `gallery` capability（`{ setPhotos, next, prev, goTo, getPhotoIndex }`）を追加。縮退ハンドル（WebGL2 非対応）では安全な no-op 実装（`getPhotoIndex` は常に `-1`）を渡す（既存の `interaction` capability と同じ扱い）
- [x] 2-6. `packages/core/src/index.ts`（既存修正）— 新規公開型（`PhotoInput`）を re-export に追加

## Step 3: Business Logic Unit Testing

- [x] 3-1. `packages/core/src/gallery/__tests__/Gallery.test.ts`:
  - PBT（fast-check、`tech-stack-decisions.md` §3）: ①任意の `size >= 0` と任意の操作列後も `current ∈ [-1, size)`、②`next()`/`prev()` の巡回が任意の `size >= 1` で閉じる（`size` 回繰り返すと元の index に戻る）、③`goTo(index)` は `size > 0` かつ `index` が整数で `[0, size)` の範囲内のときのみ `"moved"` を返す
  - example-based: 空リストでの `next`/`prev`/`goTo`（`"empty"`）、1枚のみのリストでの `next`/`prev`（常に index 0）、`goTo` の範囲外（負数・`size` 以上・非整数）、`normalizePhotoInput` が文字列/`Blob`/オブジェクトそれぞれを正しく正規化すること
- [x] 3-2. `packages/core/src/viewer/__tests__/createViewer.gallery.test.ts`（新規、`createViewer.loadImage.test.ts` と同じ `Renderer`/`Loader` モック方針を再利用）:
  - `setPhotos` が1枚目を自動的にロードし `photochange`（`{ index: 0 }`）を発火すること（BR-E-02/07）
  - `next()`/`prev()` が巡回すること（末尾→先頭、先頭→末尾）、ロード成功のたびに `photochange` が発火すること（BR-E-03）
  - `goTo(index)` の範囲外指定が `error(INVALID_INPUT)` を発火し `photoIndex`/表示を変更しないこと（BR-E-05）
  - 写真未設定（`setPhotos` 未呼び出し、または空配列）での `next`/`prev`/`goTo` が安全に無視されること（BR-E-04）
  - 写真切替中に連続して `next()` が呼ばれた場合、前回のロードが中断され最終呼び出しのみ確定すること（BR-E-09、`createViewer.loadImage.test.ts` の中断テストと同型）
  - ロード失敗時、`error` のみ発火し `photoIndex` は変更されない（直前の写真を維持）こと（BR-E-08）
  - `id` を含む `PhotoInput` を渡した場合、`photochange` のペイロードに `id` が含まれること（BR-E-01/07）
  - 縮退ハンドル（WebGL2 非対応）で `setPhotos`/`next`/`prev`/`goTo`/`getPhotoIndex` が例外を投げず安全な no-op として動作すること
  - **計画からの逸脱**: `photoNext`/`photoPrev` インテントが `setPhotos` 済みの状態で実際に切り替わることの検証（BR-E-11）は、当初 Step 3-3 で `createViewer.interaction.test.ts` に追加する計画だったが、同ファイルは `Loader` をモック化しておらず（実装のまま使用）、写真ロードを伴うテストを追加すると実際の `fetch` が発生してしまうため、本ファイル（`Loader` モック済み）側に追加した
- [x] 3-3. `packages/core/src/viewer/__tests__/createViewer.interaction.test.ts`（既存修正）— `it.each(["photoNext", "photoPrev", "toggleFullscreen"])` の「安全に無視される（BR-D-16）」テストを分割する: `toggleFullscreen` は引き続き「安全に無視される」ことを検証し、`photoNext`/`photoPrev` は「写真未設定なら安全に無視される」ケースに更新する（BR-E-04）。実際に写真が切り替わることの検証は Step 3-2 の逸脱注記の通り `createViewer.gallery.test.ts` 側に追加した（BR-E-11）

## Step 4: Business Logic Summary

- [x] 4-1. `aidlc-docs/construction/uow-e/code/code-summary.md`

## Step 5: Documentation Generation

- [x] 5-1. 新規公開 API（`setPhotos`, `next`, `prev`, `goTo`, `getPhotoIndex`, `PhotoInput`, `photochange`）に TSDoc コメントを付与する（Step 2 実装と同時に付与）

## Step 6: Deployment Artifacts Generation

**該当なし（スキップ）**。`infrastructure-design.md` で確認済みの通り、CI/Dependabot への変更は不要。

## Step 7: ビルド・テストの実行確認

- [x] 7-1. `pnpm -r build` を実行し型エラー・ビルドエラーがないことを確認
- [x] 7-2. `pnpm -r test` を実行し全テスト（UoW-A/B/C/D の既存分 + UoW-E 新規分）が green であることを確認（26ファイル・241テスト）
- [x] 7-3. `pnpm -r lint` を実行し lint エラーがないことを確認（Step 3 実装時に1件の `no-unused-expressions` と Prettier フォーマット2件を検出・修正）
- [x] 7-4. `pnpm audit --prod` で既知の脆弱性がないことを確認
- [x] 7-5. 問題が見つかった場合は該当コードを修正し、7-1〜7-4 を再実行する（上記の通り実施済み）

**注記**: Step 7 は開発時点での自己検証であり、実際のブラウザでの動作確認は含まない。正式な Build and Test ステージ（全ユニット共通の統合検証）を代替するものではない。

## ストーリートレーサビリティ

| ストーリー | 対応箇所 |
|---|---|
| US-23（ギャラリー API: リスト・next/prev・index・イベント） | Step 2-2（`Gallery`）、Step 2-5（`createViewer` 統合: `setPhotos`/`next`/`prev`/`goTo`/`getPhotoIndex`/`photochange`） |
| US-18（矢印キーでの写真送り、実行部分） | Step 2-5（`photoNext`/`photoPrev` intent を `next()`/`prev()` へ結線、BR-E-11） |
| US-24（標準ギャラリー UI、API・データモデルのみ） | Step 2-1（`PhotoInput`）。UI 実装自体は UoW-G の範囲 |

## 完了条件

- 上記 Step 2〜5、7 の全チェックボックスが `[x]`（Step 1・6 は該当なし）
- `pnpm -r build` / `pnpm -r test` / `pnpm -r lint` が green
- 生成コードが `business-rules.md`（BR-E-01〜13）・`nfr-design-patterns.md`（RP-E-1, RP-E-2, SP-E-1）・`logical-components.md`（L1〜L4）の決定と矛盾しない
- UoW-A/B/C/D の既存テストが引き続き green（既存動作への回帰がないこと）
