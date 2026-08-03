import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PhotoInput } from "../../gallery/types.js";
import type { InputIntent, InputSource } from "../../interaction/types.js";
import type { DecodedImage, ImageInput } from "../../loader/types.js";
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

// Renderer/Loader は UoW-B のテスト境界（createViewer.loadImage.test.ts）と同じモック方針を再利用する。
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

function rejecting(): LoaderImpl {
  return async () => {
    throw new Error("network error");
  };
}

function fakeInputSource(id: string): InputSource & { emit: (intent: InputIntent) => void } {
  let captured: ((intent: InputIntent) => void) | null = null;
  return {
    id,
    attach: (_target, emit) => {
      captured = emit;
    },
    detach: () => {
      captured = null;
    },
    emit(intent: InputIntent) {
      captured?.(intent);
    },
  };
}

function mockWebGL2Support(supported: boolean): void {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((type: string) =>
    type === "webgl2" && supported
      ? ({} as unknown)
      : null) as typeof HTMLCanvasElement.prototype.getContext);
}

// performLoad は複数回 await を挟む（loader.load → adapter.createTexture）ため、
// Promise.resolve() の連鎖ではなくマクロタスク境界まで待って確実に完了させる。
async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("createViewer — gallery (UoW-E)", () => {
  beforeEach(() => {
    rendererInstances.length = 0;
    loaderControl.impl = immediateResolve();
    mockWebGL2Support(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getPhotoIndex() is -1 before setPhotos is called (BR-E-12)", () => {
    const handle = createViewer(document.createElement("div"));
    expect(handle.getPhotoIndex()).toBe(-1);
  });

  it("setPhotos() auto-loads the first photo and emits photochange (BR-E-02/07)", async () => {
    const handle = createViewer(document.createElement("div"));
    const onPhotoChange = vi.fn();
    handle.on("photochange", onPhotoChange);

    handle.setPhotos(["a.jpg", "b.jpg", "c.jpg"]);
    await flushMicrotasks();

    expect(handle.getPhotoIndex()).toBe(0);
    expect(onPhotoChange).toHaveBeenCalledWith({ type: "photochange", index: 0 });
    expect(rendererInstances[0]?.setSphereTexture).toHaveBeenCalledTimes(1);
  });

  it("next()/prev() cycle at the list boundaries (BR-E-03)", async () => {
    const handle = createViewer(document.createElement("div"));
    handle.setPhotos(["a.jpg", "b.jpg", "c.jpg"]);
    await flushMicrotasks();

    handle.prev(); // 0 -> wraps to 2
    await flushMicrotasks();
    expect(handle.getPhotoIndex()).toBe(2);

    handle.next(); // 2 -> wraps to 0
    await flushMicrotasks();
    expect(handle.getPhotoIndex()).toBe(0);
  });

  it("goTo() switches to a valid index and includes id in photochange (BR-E-01/07)", async () => {
    const photos: PhotoInput[] = ["a.jpg", { src: "b.jpg", id: "photo-b" }, "c.jpg"];
    const handle = createViewer(document.createElement("div"));
    const onPhotoChange = vi.fn();
    handle.on("photochange", onPhotoChange);
    handle.setPhotos(photos);
    await flushMicrotasks();
    onPhotoChange.mockClear();

    handle.goTo(1);
    await flushMicrotasks();

    expect(handle.getPhotoIndex()).toBe(1);
    expect(onPhotoChange).toHaveBeenCalledWith({
      type: "photochange",
      index: 1,
      id: "photo-b",
    });
  });

  it("goTo() reports INVALID_INPUT for an out-of-range index and keeps the current photo (BR-E-05)", async () => {
    const handle = createViewer(document.createElement("div"));
    const onError = vi.fn();
    handle.on("error", onError);
    handle.setPhotos(["a.jpg", "b.jpg"]);
    await flushMicrotasks();

    handle.goTo(5);
    await flushMicrotasks();

    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      type: "error",
      error: { code: "INVALID_INPUT" },
    });
    expect(handle.getPhotoIndex()).toBe(0);
  });

  it("next()/prev()/goTo() safely no-op when no photos are set (BR-E-04)", async () => {
    const handle = createViewer(document.createElement("div"));
    const onError = vi.fn();
    handle.on("error", onError);

    expect(() => {
      handle.next();
      handle.prev();
      handle.goTo(0);
    }).not.toThrow();
    await flushMicrotasks();

    expect(handle.getPhotoIndex()).toBe(-1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("cancels the previous in-flight photo switch when next() is called again (BR-E-09)", async () => {
    const handle = createViewer(document.createElement("div"));
    handle.setPhotos(["a.jpg", "b.jpg", "c.jpg"]);
    await flushMicrotasks();

    loaderControl.impl = delayedResolve(fakeDecoded(), 20);
    handle.next(); // targets index 1, load in-flight

    loaderControl.impl = delayedResolve(fakeDecoded(2000, 1000), 5);
    handle.next(); // targets index 2, cancels the previous in-flight load

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(handle.getPhotoIndex()).toBe(2);
    // 初回ロード（setPhotos の index 0）+ 最終的に確定した1回のみ反映される。
    expect(rendererInstances[0]?.setSphereTexture).toHaveBeenCalledTimes(2);
  });

  it("keeps the previous photoIndex and emits only error when a switch fails (BR-E-08)", async () => {
    const handle = createViewer(document.createElement("div"));
    const onError = vi.fn();
    const onPhotoChange = vi.fn();
    handle.on("error", onError);
    handle.on("photochange", onPhotoChange);
    handle.setPhotos(["a.jpg", "b.jpg"]);
    await flushMicrotasks();
    onPhotoChange.mockClear();

    loaderControl.impl = rejecting();
    handle.next();
    await flushMicrotasks();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onPhotoChange).not.toHaveBeenCalled();
    expect(handle.getPhotoIndex()).toBe(0);
  });

  it("a 'photoNext'/'photoPrev' intent switches photos via Gallery (BR-E-11)", async () => {
    const container = document.createElement("div");
    const handle = createViewer(container);
    const source = fakeInputSource("fake");
    handle.registerInputSource(source);
    handle.setPhotos(["a.jpg", "b.jpg", "c.jpg"]);
    await flushMicrotasks();

    source.emit({ kind: "photoNext" });
    await flushMicrotasks();
    expect(handle.getPhotoIndex()).toBe(1);

    source.emit({ kind: "photoPrev" });
    await flushMicrotasks();
    expect(handle.getPhotoIndex()).toBe(0);
  });

  it("no-ops setPhotos/next/prev/goTo/getPhotoIndex on a degraded handle (WebGL2 unsupported)", async () => {
    mockWebGL2Support(false);
    const handle = createViewer(document.createElement("div"));

    expect(() => {
      handle.setPhotos(["a.jpg", "b.jpg"]);
      handle.next();
      handle.prev();
      handle.goTo(0);
    }).not.toThrow();
    expect(handle.getPhotoIndex()).toBe(-1);
  });
});
