import { SRGBColorSpace, Texture } from "three";

import { LoadError } from "./Loader.js";
import type {
  DecodedImage,
  ImageInput,
  ImageSourceAdapter,
  SourceContext,
  SourceResult,
} from "./types.js";

const ASPECT_RATIO_TARGET = 2;
const ASPECT_RATIO_TOLERANCE = 0.01;
const URL_EXTENSION_PATTERN = /\.(jpe?g|png)(\?.*)?(#.*)?$/i;
const SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

/**
 * 正距円筒（エクイレクタングラー）画像の `ImageSourceAdapter` 実装（domain-entities.md E3）。
 */
export class EquirectangularSource implements ImageSourceAdapter {
  readonly id = "equirectangular";

  /** 形式の粗い判定のみ（BR-B-02）。詳細検証は `createTexture` のアスペクト比検証で行う。 */
  canHandle(input: ImageInput): boolean {
    if (typeof input === "string") {
      return URL_EXTENSION_PATTERN.test(input);
    }
    return SUPPORTED_MIME_TYPES.has(input.type);
  }

  async createTexture(decoded: DecodedImage, ctx: SourceContext): Promise<SourceResult> {
    const ratio = decoded.width / decoded.height;
    if (Math.abs(ratio - ASPECT_RATIO_TARGET) > ASPECT_RATIO_TOLERANCE) {
      // BR-B-04: 2:1 ± 許容誤差の範囲外。
      throw new LoadError(
        "INVALID_INPUT",
        "The image must have a 2:1 (equirectangular) aspect ratio.",
      );
    }

    if (decoded.width > ctx.maxTextureSize || decoded.height > ctx.maxTextureSize) {
      // BR-B-05: WebGL 最大テクスチャサイズ超過。形式は正しいが環境上で描画できない。
      throw new LoadError(
        "IMAGE_LOAD_FAILED",
        "The image exceeds the maximum texture size supported by this environment.",
      );
    }

    const texture = new Texture(decoded.bitmap);
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;

    return { texture, width: decoded.width, height: decoded.height };
  }

  dispose(result: SourceResult): void {
    result.texture.dispose();
  }
}
