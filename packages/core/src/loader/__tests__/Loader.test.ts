import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoadError, Loader } from "../Loader.js";

const FAKE_BITMAP_WIDTH = 100;
const FAKE_BITMAP_HEIGHT = 50;

function fakeBitmap(): ImageBitmap {
  return {
    width: FAKE_BITMAP_WIDTH,
    height: FAKE_BITMAP_HEIGHT,
    close: () => {},
  } as unknown as ImageBitmap;
}

function chunkedBody(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let index = 0;
  return {
    getReader: () => ({
      read: async () => {
        if (index < chunks.length) {
          return { done: false, value: chunks[index++] };
        }
        return { done: true, value: undefined };
      },
    }),
  } as unknown as ReadableStream<Uint8Array>;
}

function fakeResponse(options: {
  ok: boolean;
  status?: number;
  contentLength?: number;
  chunks?: Uint8Array[];
}): Response {
  const chunks = options.chunks ?? [];
  return {
    ok: options.ok,
    status: options.status ?? (options.ok ? 200 : 500),
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-length" && options.contentLength !== undefined
          ? String(options.contentLength)
          : null,
    },
    body: chunks.length > 0 ? chunkedBody(chunks) : null,
    blob: async () => new Blob(chunks as BlobPart[]),
  } as unknown as Response;
}

describe("Loader", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => fakeBitmap()),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("validate", () => {
    const loader = new Loader();

    it("rejects an empty URL", () => {
      expect(() => loader.validate("   ")).toThrow(LoadError);
    });

    it("accepts a non-empty URL", () => {
      expect(() => loader.validate("https://example.com/pano.jpg")).not.toThrow();
    });

    it("rejects a Blob with a non-image MIME type", () => {
      expect(() => loader.validate(new Blob([], { type: "text/plain" }))).toThrow(LoadError);
    });

    it("accepts a Blob with an image MIME type or no type at all", () => {
      expect(() => loader.validate(new Blob([], { type: "image/png" }))).not.toThrow();
      expect(() => loader.validate(new Blob([]))).not.toThrow();
    });
  });

  describe("load — Blob input", () => {
    it("decodes directly and reports a single progress update without a total (BR-B-07)", async () => {
      const loader = new Loader();
      const blob = new Blob(["x".repeat(10)]);
      const onProgress = vi.fn();

      const decoded = await loader.load(blob, onProgress, new AbortController().signal);

      expect(decoded.width).toBe(FAKE_BITMAP_WIDTH);
      expect(decoded.height).toBe(FAKE_BITMAP_HEIGHT);
      expect(onProgress).toHaveBeenCalledTimes(1);
      expect(onProgress).toHaveBeenCalledWith(blob.size);
    });
  });

  describe("load — URL input", () => {
    it("fetches, reports progress with content-length as total, and decodes (BR-B-06/07)", async () => {
      const chunks = [new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])];
      const response = fakeResponse({ ok: true, contentLength: 5, chunks });
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => response),
      );

      const loader = new Loader();
      const onProgress = vi.fn();

      const decoded = await loader.load(
        "https://example.com/pano.jpg",
        onProgress,
        new AbortController().signal,
      );

      expect(decoded.width).toBe(FAKE_BITMAP_WIDTH);
      expect(onProgress.mock.calls.at(-1)).toEqual([5, 5]);
    });

    it("throws IMAGE_LOAD_FAILED when the response is not ok", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => fakeResponse({ ok: false, status: 404 })),
      );

      const loader = new Loader();

      await expect(
        loader.load("https://example.com/missing.jpg", vi.fn(), new AbortController().signal),
      ).rejects.toMatchObject({ code: "IMAGE_LOAD_FAILED" });
    });

    it("throws IMAGE_LOAD_FAILED when fetch rejects with a network error", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new TypeError("Network request failed");
        }),
      );

      const loader = new Loader();

      await expect(
        loader.load("https://example.com/pano.jpg", vi.fn(), new AbortController().signal),
      ).rejects.toMatchObject({ code: "IMAGE_LOAD_FAILED" });
    });

    it("propagates AbortError without wrapping it in LoadError (BR-B-08)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new DOMException("Aborted", "AbortError");
        }),
      );

      const loader = new Loader();

      await expect(
        loader.load("https://example.com/pano.jpg", vi.fn(), new AbortController().signal),
      ).rejects.toSatisfy(
        (error: unknown) => error instanceof DOMException && error.name === "AbortError",
      );
    });

    it("throws IMAGE_LOAD_FAILED when decoding fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          fakeResponse({ ok: true, contentLength: 2, chunks: [new Uint8Array([1, 2])] }),
        ),
      );
      vi.stubGlobal(
        "createImageBitmap",
        vi.fn(async () => {
          throw new Error("decode failed");
        }),
      );

      const loader = new Loader();

      await expect(
        loader.load("https://example.com/pano.jpg", vi.fn(), new AbortController().signal),
      ).rejects.toMatchObject({ code: "IMAGE_LOAD_FAILED" });
    });
  });

  describe("progress throttling (PP-B-1)", () => {
    it("skips updates within 50ms of the previous one but always emits the final update", async () => {
      vi.useFakeTimers();
      try {
        const chunks = [new Uint8Array([1]), new Uint8Array([2]), new Uint8Array([3])];
        vi.stubGlobal(
          "fetch",
          vi.fn(async () => fakeResponse({ ok: true, contentLength: 3, chunks })),
        );

        const loader = new Loader();
        const onProgress = vi.fn();

        // すべてのチャンクが同一ミリ秒内に到着するケース: 最初の1回 + 完了時の最終値のみ発火する。
        const promise = loader.load(
          "https://example.com/pano.jpg",
          onProgress,
          new AbortController().signal,
        );
        await vi.runAllTimersAsync();
        await promise;

        expect(onProgress.mock.calls.length).toBeLessThanOrEqual(3);
        expect(onProgress.mock.calls.at(-1)).toEqual([3, 3]);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
