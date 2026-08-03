import fc from "fast-check";
import { Texture } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DecodedImage,
  ImageInput,
  ImageSourceAdapter,
  SourceResult,
} from "../../loader/types.js";
import type { RendererCallbacks } from "../Renderer.js";

interface MockRendererInstance {
  callbacks: RendererCallbacks;
  startLoop: ReturnType<typeof vi.fn>;
  stopLoop: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  setActiveMode: ReturnType<typeof vi.fn>;
  setSphereTexture: ReturnType<typeof vi.fn>;
  maxTextureSize: number;
}

// Renderer は WebGL 境界としてモック化する（tech-stack-decisions.md §5、UoW-A から継続）。
const { rendererInstances } = vi.hoisted(() => ({
  rendererInstances: [] as MockRendererInstance[],
}));

vi.mock("../Renderer.js", async () => {
  const { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene } = await import("three");

  class MockRenderer {
    callbacks: RendererCallbacks;
    startLoop = vi.fn();
    stopLoop = vi.fn();
    dispose = vi.fn();
    setActiveMode = vi.fn();
    setSphereTexture = vi.fn();
    maxTextureSize = 4096;
    modeContext = {
      camera: new PerspectiveCamera(),
      scene: new Scene(),
      sphereMesh: new Mesh(new BoxGeometry(), new MeshBasicMaterial()),
    };

    constructor(_container: HTMLElement, callbacks: RendererCallbacks) {
      this.callbacks = callbacks;
      rendererInstances.push(this as unknown as MockRendererInstance);
    }
  }

  return { Renderer: MockRenderer };
});

// Loader は UoW-B の NFR Requirements Q1 で確定したテスト境界（fetch/createImageBitmap を含む層）。
// EquirectangularSource は実装のまま使い、createViewer 側のオーケストレーション（中断・状態遷移・
// イベント発火・dispose 連携）を検証する。
type LoaderImpl = (
  input: ImageInput,
  onProgress: (loaded: number, total?: number) => void,
  signal: AbortSignal,
) => Promise<DecodedImage>;

const { loaderControl } = vi.hoisted(() => ({
  loaderControl: { impl: null as LoaderImpl | null },
}));

vi.mock("../../loader/Loader.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../loader/Loader.js")>();

  class MockLoader {
    validate(): void {
      // 検証は Loader.test.ts で個別に検証済み。
    }
    load(...args: Parameters<LoaderImpl>): ReturnType<LoaderImpl> {
      if (!loaderControl.impl)
        throw new Error("loaderControl.impl is not configured for this test");
      return loaderControl.impl(...args);
    }
  }

  return { ...actual, Loader: MockLoader };
});

const { createViewer } = await import("../createViewer.js");

function fakeDecoded(width = 4000, height = 2000): DecodedImage {
  return {
    bitmap: { width, height, close: () => {} } as unknown as ImageBitmap,
    width,
    height,
  };
}

function immediateResolve(decoded: DecodedImage = fakeDecoded()): LoaderImpl {
  return async (_input, _onProgress, signal) => {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    return decoded;
  };
}

function delayedResolve(decoded: DecodedImage, delayMs: number): LoaderImpl {
  return (_input, _onProgress, signal) =>
    new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      const timer = setTimeout(() => resolve(decoded), delayMs);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function mockWebGL2Support(supported: boolean): void {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((type: string) =>
    type === "webgl2" && supported
      ? ({} as unknown)
      : null) as typeof HTMLCanvasElement.prototype.getContext);
}

describe("createViewer — loadImage/registerSource", () => {
  beforeEach(() => {
    rendererInstances.length = 0;
    loaderControl.impl = immediateResolve();
    mockWebGL2Support(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves and reflects the texture via Renderer.setSphereTexture on success", async () => {
    const container = document.createElement("div");
    const handle = createViewer(container);

    await handle.loadImage("https://example.com/pano.jpg");

    expect(rendererInstances[0]?.setSphereTexture).toHaveBeenCalledTimes(1);
    expect(rendererInstances[0]?.setSphereTexture.mock.calls[0]?.[0]).toBeInstanceOf(Texture);
  });

  it("rejects with INVALID_INPUT and does not touch the Renderer for a non-2:1 image (BR-B-04/11)", async () => {
    const container = document.createElement("div");
    const handle = createViewer(container);
    const onError = vi.fn();
    handle.on("error", onError);
    loaderControl.impl = immediateResolve(fakeDecoded(100, 100));

    await expect(handle.loadImage("https://example.com/pano.jpg")).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(rendererInstances[0]?.setSphereTexture).not.toHaveBeenCalled();
  });

  it("rejects with IMAGE_LOAD_FAILED and keeps the previous display when maxTextureSize is exceeded (BR-B-05/11)", async () => {
    const container = document.createElement("div");
    const handle = createViewer(container);
    // MockRenderer.maxTextureSize = 4096。8000 はそれを超える。
    loaderControl.impl = immediateResolve(fakeDecoded(8000, 4000));

    await expect(handle.loadImage("https://example.com/pano.jpg")).rejects.toMatchObject({
      code: "IMAGE_LOAD_FAILED",
    });
    expect(rendererInstances[0]?.setSphereTexture).not.toHaveBeenCalled();
  });

  it("cancels the previous in-flight load when loadImage is called again (BR-B-08)", async () => {
    const container = document.createElement("div");
    const handle = createViewer(container);

    loaderControl.impl = delayedResolve(fakeDecoded(), 20);
    const firstCatch = handle
      .loadImage("https://example.com/first.jpg")
      .catch((error: unknown) => error);

    loaderControl.impl = delayedResolve(fakeDecoded(2000, 1000), 5);
    const secondPromise = handle.loadImage("https://example.com/second.jpg");

    const firstResult = await firstCatch;
    await secondPromise;

    expect(isAbortError(firstResult)).toBe(true);
    expect(rendererInstances[0]?.setSphereTexture).toHaveBeenCalledTimes(1);
  });

  it("PBT: of N consecutive loadImage calls, only the last one settles successfully (BR-B-08)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (callCount) => {
        const container = document.createElement("div");
        const handle = createViewer(container);
        loaderControl.impl = delayedResolve(fakeDecoded(), 2);

        const results = await Promise.allSettled(
          Array.from({ length: callCount }, (_, i) =>
            handle.loadImage(`https://example.com/${i}.jpg`),
          ),
        );

        results.slice(0, -1).forEach((result) => {
          expect(result.status).toBe("rejected");
        });
        expect(results.at(-1)?.status).toBe("fulfilled");

        handle.dispose();
      }),
      { numRuns: 15 },
    );
  });

  it("prefers a registered adapter over the default EquirectangularSource (US-04/BR-B-02)", async () => {
    const container = document.createElement("div");
    const handle = createViewer(container);
    const fakeResult: SourceResult = { texture: new Texture(), width: 10, height: 10 };
    const customAdapter: ImageSourceAdapter = {
      id: "custom",
      canHandle: vi.fn(() => true),
      createTexture: vi.fn(async () => fakeResult),
      dispose: vi.fn(),
    };
    handle.registerSource(customAdapter);

    await handle.loadImage("https://example.com/pano.jpg");

    expect(customAdapter.createTexture).toHaveBeenCalledTimes(1);
    expect(rendererInstances[0]?.setSphereTexture).toHaveBeenCalledWith(fakeResult.texture);
  });

  it("rejects with WEBGL_UNSUPPORTED immediately on a degraded handle (BR-B-13)", async () => {
    mockWebGL2Support(false);
    const container = document.createElement("div");
    const handle = createViewer(container);

    await expect(handle.loadImage("https://example.com/pano.jpg")).rejects.toMatchObject({
      code: "WEBGL_UNSUPPORTED",
    });
  });

  it("no-ops loadImage after dispose() (BR-B-14)", async () => {
    const container = document.createElement("div");
    const handle = createViewer(container);
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    handle.dispose();
    await handle.loadImage("https://example.com/pano.jpg");

    expect(consoleWarn).toHaveBeenCalled();
  });

  it("disposes the current texture when the viewer is disposed (BR-B-16)", async () => {
    const container = document.createElement("div");
    const handle = createViewer(container);
    const fakeResult: SourceResult = { texture: new Texture(), width: 10, height: 10 };
    const disposeSpy = vi.fn();
    const customAdapter: ImageSourceAdapter = {
      id: "custom",
      canHandle: () => true,
      createTexture: async () => fakeResult,
      dispose: disposeSpy,
    };
    handle.registerSource(customAdapter);
    await handle.loadImage("https://example.com/pano.jpg");

    handle.dispose();

    expect(disposeSpy).toHaveBeenCalledWith(fakeResult);
  });

  it("reapplies the current texture after a WebGL context-loss recovery", async () => {
    const container = document.createElement("div");
    const handle = createViewer(container);
    await handle.loadImage("https://example.com/pano.jpg");
    const appliedTexture = rendererInstances[0]?.setSphereTexture.mock.calls[0]?.[0];

    rendererInstances[0]?.callbacks.onRebuildSucceeded();

    expect(rendererInstances[0]?.setSphereTexture).toHaveBeenLastCalledWith(appliedTexture);
  });
});
