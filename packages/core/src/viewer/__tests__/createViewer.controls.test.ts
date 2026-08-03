import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DecodedImage, ImageInput } from "../../loader/types.js";
import type { RendererCallbacks } from "../Renderer.js";

const STYLE_ID = "perisphere-controls-style";

interface MockRendererInstance {
  callbacks: RendererCallbacks;
  startLoop: ReturnType<typeof vi.fn>;
  stopLoop: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  setActiveMode: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  setSphereTexture: ReturnType<typeof vi.fn>;
  maxTextureSize: number;
}

// Renderer は UoW-A 以来のテスト境界（vi.mock）をそのまま再利用する。ControlsUI 自体は標準 DOM
// API のみに依存するため、追加のモックは不要（tech-stack-decisions.md）。
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

type LoaderImpl = (
  input: ImageInput,
  onProgress: (loaded: number, total?: number) => void,
  signal: AbortSignal,
) => Promise<DecodedImage>;

function fakeDecoded(width = 4000, height = 2000): DecodedImage {
  return {
    bitmap: { width, height, close: () => {} } as unknown as ImageBitmap,
    width,
    height,
  };
}

vi.mock("../../loader/Loader.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../loader/Loader.js")>();

  class MockLoader {
    validate(): void {
      // 検証は Loader.test.ts で個別に検証済み。
    }
    load(...args: Parameters<LoaderImpl>): ReturnType<LoaderImpl> {
      const [, , signal] = args;
      if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
      return Promise.resolve(fakeDecoded());
    }
  }

  return { ...actual, Loader: MockLoader };
});

const { createViewer } = await import("../createViewer.js");

function mockWebGL2Support(supported: boolean): void {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((type: string) =>
    type === "webgl2" && supported
      ? ({} as unknown)
      : null) as typeof HTMLCanvasElement.prototype.getContext);
}

async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("createViewer — controls (UoW-G)", () => {
  beforeEach(() => {
    rendererInstances.length = 0;
    mockWebGL2Support(true);
    document.getElementById(STYLE_ID)?.remove(); // tech-stack-decisions.md §1
  });

  afterEach(() => {
    document.getElementById(STYLE_ID)?.remove();
    vi.restoreAllMocks();
  });

  it("constructs ControlsUI under the container by default (BR-G-01/02)", () => {
    const container = document.createElement("div");
    createViewer(container);

    expect(container.querySelector(".perisphere-controls")).not.toBeNull();
  });

  it("does not touch the DOM and safely no-ops setControlsVisibility/setText when controls: false (BR-G-03/15)", () => {
    const container = document.createElement("div");
    const handle = createViewer(container, { controls: false });

    expect(container.querySelector(".perisphere-controls")).toBeNull();
    expect(() => {
      handle.setControlsVisibility({ fullscreen: false });
      handle.setText({ zoomInLabel: "Zoom in" });
    }).not.toThrow();
  });

  it("applies an initial partial ControlsVisibility from options.controls", () => {
    const container = document.createElement("div");
    createViewer(container, { controls: { zoom: false } });

    const zoomGroup = container.querySelector(".perisphere-controls__zoom") as HTMLElement;
    expect(zoomGroup.hidden).toBe(true);
  });

  it("getPhotoCount() reflects setPhotos() and stays in sync with photochange.total (BR-G-07)", async () => {
    const handle = createViewer(document.createElement("div"));
    expect(handle.getPhotoCount()).toBe(0);

    const onPhotoChange = vi.fn();
    handle.on("photochange", onPhotoChange);
    handle.setPhotos(["a.jpg", "b.jpg", "c.jpg"]);
    await flushMicrotasks();

    expect(handle.getPhotoCount()).toBe(3);
    expect(onPhotoChange.mock.calls[0]?.[0]).toMatchObject({ total: 3 });
  });

  it("constructs ControlsUI on a degraded handle (WebGL2 unsupported), since it does not depend on Renderer", () => {
    mockWebGL2Support(false);
    const container = document.createElement("div");

    const handle = createViewer(container);

    expect(container.querySelector(".perisphere-controls")).not.toBeNull();
    // モード切替・写真送りは該当データなしで自動的に非表示になる（BR-G-04/05）。
    const select = container.querySelector(".perisphere-controls__mode") as HTMLElement;
    const photoNav = container.querySelector(".perisphere-controls__photo-nav") as HTMLElement;
    expect(select.hidden).toBe(true);
    expect(photoNav.hidden).toBe(true);
    expect(handle.getPhotoCount()).toBe(0);
  });

  it("controls: false keeps the container untouched even on a degraded handle", () => {
    mockWebGL2Support(false);
    const container = document.createElement("div");

    createViewer(container, { controls: false });

    expect(container.children).toHaveLength(0);
  });

  it("dispose() removes the ControlsUI DOM along with the rest of the viewer's resources", () => {
    const container = document.createElement("div");
    const handle = createViewer(container);
    expect(container.querySelector(".perisphere-controls")).not.toBeNull();

    handle.dispose();

    expect(container.querySelector(".perisphere-controls")).toBeNull();
  });
});
