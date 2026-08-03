import type { ImageInput } from "../loader/types.js";
import type { GalleryMoveResult, PhotoInput } from "./types.js";

/**
 * `PhotoInput` を内部処理向けに正規化する（BR-E-01）。生の `ImageInput` は `id` なしとして扱う。
 */
export function normalizePhotoInput(photo: PhotoInput): { src: ImageInput; id?: string } {
  if (typeof photo === "string" || photo instanceof Blob) {
    return { src: photo };
  }
  return photo;
}

/**
 * 写真リストとカレントインデックスの保持・計算（C8、E1）。
 *
 * `current` は「目標（pending）インデックス」であり、`next`/`prev`/`goTo` 呼び出しのたびに
 * 対応する画像ロードの成否を待たず即座に更新される（BR-E-13、RP-E-1）。実際の画像ロード起動・
 * `photochange` 発火・エラー通知は行わない（副作用を持たない、呼び出し元の `createViewer` が担う）。
 */
export class Gallery {
  private photos: readonly PhotoInput[] = [];
  private currentIndex = -1;

  setPhotos(photos: readonly PhotoInput[]): void {
    // BR-E-02: リストを差し替え、current を 0（非空）または -1（空）にリセットする。
    this.photos = photos;
    this.currentIndex = photos.length > 0 ? 0 : -1;
  }

  next(): GalleryMoveResult {
    return this.move(this.currentIndex + 1);
  }

  prev(): GalleryMoveResult {
    return this.move(this.currentIndex - 1);
  }

  private move(rawIndex: number): GalleryMoveResult {
    // BR-E-04: 写真未設定時は安全に無視する。
    if (this.photos.length === 0) return { status: "empty" };

    // BR-E-03: モジュロ演算による巡回（末尾→先頭、先頭→末尾）。
    const size = this.photos.length;
    const index = ((rawIndex % size) + size) % size;
    this.currentIndex = index; // RP-E-1: 目標ポインタを即座に前進させる。
    return { status: "moved", index };
  }

  goTo(index: number): GalleryMoveResult {
    // BR-E-04: 写真未設定時は範囲外エラーより優先して安全に無視する。
    if (this.photos.length === 0) return { status: "empty" };

    // BR-E-05: 範囲外・非整数の明示指定は目標ポインタを変更せずエラーとする。
    if (!Number.isInteger(index) || index < 0 || index >= this.photos.length) {
      return { status: "out-of-range" };
    }

    this.currentIndex = index; // RP-E-1: 目標ポインタを即座に前進させる。
    return { status: "moved", index };
  }

  get current(): number {
    return this.currentIndex;
  }

  get size(): number {
    return this.photos.length;
  }

  getPhoto(index: number): PhotoInput | undefined {
    return this.photos[index];
  }
}
