import type { ImageInput } from "../loader/types.js";

/**
 * `setPhotos` に渡す1枚の写真の入力表現（FR-11）。`ImageInput` を直接渡せる形と、
 * `id`（`photochange` イベントで利用者に返す任意の識別子）を指定できるオブジェクト形の
 * ユニオン型（Functional Design Q1）。`id` は perisphere 内部では解釈しない不透明な値。
 */
export type PhotoInput = ImageInput | { src: ImageInput; id?: string };

/**
 * `Gallery` の移動系メソッド（`next`/`prev`/`goTo`）の結果（Functional Design E3）。
 * 「移動できた」「写真未設定」「範囲外」を型で明示的に区別する。
 */
export type GalleryMoveResult =
  { status: "moved"; index: number } | { status: "empty" } | { status: "out-of-range" };
