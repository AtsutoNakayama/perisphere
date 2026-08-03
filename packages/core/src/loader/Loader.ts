import type { PerisphereErrorCode } from "../viewer/types.js";
import type { DecodedImage, ImageInput } from "./types.js";

const PROGRESS_THROTTLE_MS = 50;

/** `Loader`/`ImageSourceAdapter` 内部で使う正規化前のエラー。呼び出し元が安全なメッセージへ変換する。 */
export class LoadError extends Error {
  constructor(
    readonly code: PerisphereErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LoadError";
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * 形式検証・取得・デコードを担う、フォーマット非依存の内部コンポーネント（domain-entities.md E6）。
 */
export class Loader {
  /** 形式検証のみ（BR-B-03）。寸法の大小では拒否しない。 */
  validate(input: ImageInput): void {
    if (typeof input === "string") {
      if (input.trim().length === 0) {
        throw new LoadError("INVALID_INPUT", "Image URL must not be empty.");
      }
      return;
    }
    if (input.type.length > 0 && !input.type.startsWith("image/")) {
      throw new LoadError("INVALID_INPUT", "Blob must have an image/* MIME type.");
    }
  }

  /**
   * 取得・デコードする（BR-B-06）。URL は `fetch`、`Blob` は直接デコードする。
   * `onProgress` はスロットリング済み（PP-B-1、最低 50ms 間隔 + 完了時は必ず発火）。
   */
  async load(
    input: ImageInput,
    onProgress: (loaded: number, total?: number) => void,
    signal: AbortSignal,
  ): Promise<DecodedImage> {
    const blob =
      typeof input === "string" ? await this.fetchBlob(input, onProgress, signal) : input;

    if (typeof input !== "string") {
      onProgress(blob.size);
    }

    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(blob);
    } catch {
      throw new LoadError("IMAGE_LOAD_FAILED", "Failed to decode the image data.");
    }

    if (signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    return { bitmap, width: bitmap.width, height: bitmap.height };
  }

  private async fetchBlob(
    url: string,
    onProgress: (loaded: number, total?: number) => void,
    signal: AbortSignal,
  ): Promise<Blob> {
    let response: Response;
    try {
      response = await fetch(url, { signal });
    } catch (error) {
      if (isAbortError(error)) throw error;
      throw new LoadError("IMAGE_LOAD_FAILED", "Failed to fetch the image URL.");
    }

    if (!response.ok) {
      throw new LoadError(
        "IMAGE_LOAD_FAILED",
        `Image request failed with status ${response.status}.`,
      );
    }

    const totalHeader = response.headers.get("content-length");
    const total = totalHeader !== null ? Number(totalHeader) : undefined;

    if (!response.body) {
      return response.blob();
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    let lastEmit = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;

      const now = Date.now();
      if (now - lastEmit >= PROGRESS_THROTTLE_MS) {
        onProgress(loaded, total);
        lastEmit = now;
      }
    }

    onProgress(loaded, total);

    return new Blob(chunks as BlobPart[]);
  }
}
