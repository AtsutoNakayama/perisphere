import type { Texture } from "three";

/** 画像入力。URL 指定（US-03）またはデータ直接指定（US-01、`File` を含む）。 */
export type ImageInput = string | Blob;

/** デコード済み画像。`Loader.load` の戻り値（フォーマット非依存）。 */
export interface DecodedImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

/**
 * {@link ImageSourceAdapter.createTexture} に渡す実行環境コンテキスト。
 */
export interface SourceContext {
  /** `Renderer` の WebGL2 コンテキストから取得した最大テクスチャサイズ。 */
  maxTextureSize: number;
}

/** {@link ImageSourceAdapter.createTexture} の戻り値。 */
export interface SourceResult {
  texture: Texture;
  width: number;
  height: number;
}

/**
 * 画像ソース解釈（テクスチャ生成）の交換可能な抽象（公開拡張 IF、US-04）。
 * 取得・デコードはフォーマット非依存の {@link DecodedImage} として `Loader` が担う。
 * 本 IF はデコード済みビットマップをテクスチャ化するフォーマット固有ロジックのみを担う。
 */
export interface ImageSourceAdapter {
  readonly id: string;
  /** この入力を扱えるかどうかを判定する（形式の粗い判定。詳細検証は行わない）。 */
  canHandle(input: ImageInput): boolean;
  /** デコード済み画像からテクスチャを生成する。失敗は `PerisphereError` 相当の例外を投げる。 */
  createTexture(decoded: DecodedImage, ctx: SourceContext): Promise<SourceResult>;
  /** 生成したテクスチャを解放する（US-31）。 */
  dispose(result: SourceResult): void;
}
