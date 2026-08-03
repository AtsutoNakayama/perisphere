import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { InputIntent, InputSource } from "../../interaction/types.js";
import type { RendererCallbacks } from "../Renderer.js";

interface MockRendererInstance {
  callbacks: RendererCallbacks;
  startLoop: ReturnType<typeof vi.fn>;
  stopLoop: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  setActiveMode: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
}

// Renderer は UoW-A 以来のテスト境界（vi.mock）をそのまま再利用する。
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
    resize = vi.fn();
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

const { createViewer } = await import("../createViewer.js");

function setFullscreenElement(element: Element | null): void {
  Object.defineProperty(document, "fullscreenElement", {
    value: element,
    configurable: true,
  });
}

function stubNativeSupport(
  container: HTMLElement,
  options: { requestResult?: "resolve" | "reject" } = {},
): void {
  const { requestResult = "resolve" } = options;
  container.requestFullscreen = vi.fn(() => {
    if (requestResult === "reject") return Promise.reject(new Error("denied"));
    setFullscreenElement(container);
    document.dispatchEvent(new Event("fullscreenchange"));
    return Promise.resolve();
  }) as HTMLElement["requestFullscreen"];
  document.exitFullscreen = vi.fn(() => {
    setFullscreenElement(null);
    document.dispatchEvent(new Event("fullscreenchange"));
    return Promise.resolve();
  });
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

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("createViewer — fullscreen (UoW-F)", () => {
  beforeEach(() => {
    rendererInstances.length = 0;
    mockWebGL2Support(true);
  });

  afterEach(() => {
    setFullscreenElement(null);
    vi.restoreAllMocks();
  });

  it("isFullscreen() is false before any call", () => {
    const handle = createViewer(document.createElement("div"));
    expect(handle.isFullscreen()).toBe(false);
  });

  it("enterFullscreen()/exitFullscreen() toggle isFullscreen() and emit fullscreenchange (BR-F-01/03/05)", async () => {
    const container = document.createElement("div");
    stubNativeSupport(container);
    const handle = createViewer(container);
    const onFullscreenChange = vi.fn();
    handle.on("fullscreenchange", onFullscreenChange);

    await handle.enterFullscreen();
    expect(handle.isFullscreen()).toBe(true);
    expect(onFullscreenChange).toHaveBeenCalledWith({ type: "fullscreenchange", active: true });

    await handle.exitFullscreen();
    expect(handle.isFullscreen()).toBe(false);
    expect(onFullscreenChange).toHaveBeenCalledWith({ type: "fullscreenchange", active: false });
  });

  it("calls renderer.resize() after entering and exiting fullscreen (BR-F-09)", async () => {
    const container = document.createElement("div");
    stubNativeSupport(container);
    const handle = createViewer(container);

    await handle.enterFullscreen();
    await handle.exitFullscreen();

    expect(rendererInstances[0]?.resize).toHaveBeenCalledTimes(2);
  });

  it("falls back to pseudo-fullscreen in a non-native environment (BR-F-02, US-22)", async () => {
    const container = document.createElement("div");
    const handle = createViewer(container);

    await handle.enterFullscreen();

    expect(handle.isFullscreen()).toBe(true);
    expect(container.style.position).toBe("fixed");
  });

  it("emits error(FULLSCREEN_FAILED) and rejects when requestFullscreen is denied (BR-F-04)", async () => {
    const container = document.createElement("div");
    stubNativeSupport(container, { requestResult: "reject" });
    const handle = createViewer(container);
    const onError = vi.fn();
    handle.on("error", onError);

    await expect(handle.enterFullscreen()).rejects.toMatchObject({ code: "FULLSCREEN_FAILED" });

    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      type: "error",
      error: { code: "FULLSCREEN_FAILED" },
    });
    expect(handle.isFullscreen()).toBe(false);
  });

  it("reflects an externally-initiated exit (e.g. browser Esc) via fullscreenchange (BR-F-05)", async () => {
    const container = document.createElement("div");
    stubNativeSupport(container);
    const handle = createViewer(container);
    const onFullscreenChange = vi.fn();
    await handle.enterFullscreen();
    handle.on("fullscreenchange", onFullscreenChange);

    setFullscreenElement(null);
    document.dispatchEvent(new Event("fullscreenchange"));

    expect(handle.isFullscreen()).toBe(false);
    expect(onFullscreenChange).toHaveBeenCalledWith({ type: "fullscreenchange", active: false });
  });

  it("a 'toggleFullscreen' intent enters when inactive and exits when active (BR-F-07)", async () => {
    const container = document.createElement("div");
    stubNativeSupport(container);
    const handle = createViewer(container);
    const source = fakeInputSource("fake");
    handle.registerInputSource(source);

    source.emit({ kind: "toggleFullscreen" });
    await flushMicrotasks();
    expect(handle.isFullscreen()).toBe(true);

    source.emit({ kind: "toggleFullscreen" });
    await flushMicrotasks();
    expect(handle.isFullscreen()).toBe(false);
  });

  it("stays functional on a degraded handle (WebGL2 unsupported) since it does not depend on Renderer", async () => {
    mockWebGL2Support(false);
    const container = document.createElement("div");
    const handle = createViewer(container);

    await handle.enterFullscreen();

    expect(handle.isFullscreen()).toBe(true);
    expect(container.style.position).toBe("fixed"); // 非対応環境（jsdom）なので擬似フルスクリーン
  });

  it("dispose() releases fullscreen resources without throwing", async () => {
    const container = document.createElement("div");
    stubNativeSupport(container);
    const handle = createViewer(container);
    await handle.enterFullscreen();

    expect(() => handle.dispose()).not.toThrow();
  });
});
