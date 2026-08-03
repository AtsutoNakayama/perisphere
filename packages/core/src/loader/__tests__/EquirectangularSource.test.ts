import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import { LoadError } from "../Loader.js";
import { EquirectangularSource } from "../EquirectangularSource.js";
import type { DecodedImage, SourceContext } from "../types.js";

function fakeDecoded(width: number, height: number): DecodedImage {
  return {
    bitmap: { width, height, close: () => {} } as unknown as ImageBitmap,
    width,
    height,
  };
}

const ROOMY_CTX: SourceContext = { maxTextureSize: 16384 };

describe("EquirectangularSource", () => {
  describe("canHandle", () => {
    const adapter = new EquirectangularSource();

    it.each([
      "https://example.com/pano.jpg",
      "https://example.com/pano.JPEG",
      "/local/pano.png?v=2",
    ])("accepts URL %s ending in a supported extension", (url) => {
      expect(adapter.canHandle(url)).toBe(true);
    });

    it("rejects a URL without a supported extension", () => {
      expect(adapter.canHandle("https://example.com/pano.gif")).toBe(false);
    });

    it.each(["image/jpeg", "image/png"])("accepts a Blob with MIME type %s", (type) => {
      expect(adapter.canHandle(new Blob([], { type }))).toBe(true);
    });

    it("rejects a Blob with an unsupported MIME type", () => {
      expect(adapter.canHandle(new Blob([], { type: "image/gif" }))).toBe(false);
    });
  });

  describe("createTexture", () => {
    const adapter = new EquirectangularSource();

    it("creates a texture for a valid 2:1 image", async () => {
      const decoded = fakeDecoded(4000, 2000);

      const result = await adapter.createTexture(decoded, ROOMY_CTX);

      expect(result.width).toBe(4000);
      expect(result.height).toBe(2000);
      expect(result.texture.image).toBe(decoded.bitmap);
    });

    it("rejects an image whose size exceeds maxTextureSize (BR-B-05)", async () => {
      const decoded = fakeDecoded(4000, 2000);

      await expect(adapter.createTexture(decoded, { maxTextureSize: 1000 })).rejects.toMatchObject({
        code: "IMAGE_LOAD_FAILED",
      });
    });

    it("disposes the underlying texture", async () => {
      const decoded = fakeDecoded(4000, 2000);
      const result = await adapter.createTexture(decoded, ROOMY_CTX);
      const disposeSpy = vi.spyOn(result.texture, "dispose");

      adapter.dispose(result);

      expect(disposeSpy).toHaveBeenCalledTimes(1);
    });

    it("PBT: accepts iff the aspect ratio is within 2:1 ± 0.5% (BR-B-04)", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 8000 }),
          fc.integer({ min: 1, max: 8000 }),
          async (width, height) => {
            const ratio = width / height;
            const withinTolerance = Math.abs(ratio - 2) <= 0.01;
            const decoded = fakeDecoded(width, height);

            if (withinTolerance) {
              await expect(adapter.createTexture(decoded, ROOMY_CTX)).resolves.toBeDefined();
            } else {
              await expect(adapter.createTexture(decoded, ROOMY_CTX)).rejects.toBeInstanceOf(
                LoadError,
              );
              await expect(adapter.createTexture(decoded, ROOMY_CTX)).rejects.toMatchObject({
                code: "INVALID_INPUT",
              });
            }
          },
        ),
      );
    });
  });
});
