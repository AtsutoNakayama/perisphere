import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ViewerMode } from "../ViewerMode.js";
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
// modeContext は各モード実装（実装のまま使用）が実際に操作する対象のため、three.js の実オブジェクトを使う。
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
    setSphereMaterial = vi.fn();
    maxTextureSize = 4096;
    private readonly camera = new PerspectiveCamera();
    private readonly scene = new Scene();
    private readonly sphereMesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());

    constructor(_container: HTMLElement, callbacks: RendererCallbacks) {
      this.callbacks = callbacks;
      rendererInstances.push(this as unknown as MockRendererInstance);
    }

    get modeContext() {
      return {
        camera: this.camera,
        scene: this.scene,
        sphereMesh: this.sphereMesh,
        texture: null,
        setSphereMaterial: this.setSphereMaterial,
      };
    }
  }

  return { Renderer: MockRenderer };
});

const { createViewer } = await import("../createViewer.js");

function mockWebGL2Support(supported: boolean): void {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((type: string) =>
    type === "webgl2" && supported
      ? ({} as unknown)
      : null) as typeof HTMLCanvasElement.prototype.getContext);
}

function fakeMode(id: string): ViewerMode {
  return {
    id,
    apply: () => {},
    updateView: () => {},
    dispose: () => {},
  };
}

describe("createViewer — setMode/registerMode/listModes", () => {
  beforeEach(() => {
    rendererInstances.length = 0;
    mockWebGL2Support(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in standard mode", () => {
    const container = document.createElement("div");
    const handle = createViewer(container);

    expect(handle.getMode()).toBe("standard");
  });

  it.each(["ultraWide", "dewarp", "linear", "panini", "tinyPlanet", "crystalBall"])(
    "switches to built-in mode '%s' and fires modechange (BR-C-01/03)",
    (id) => {
      const container = document.createElement("div");
      const handle = createViewer(container);
      const onModeChange = vi.fn();
      handle.on("modechange", onModeChange);

      handle.setMode(id);

      expect(handle.getMode()).toBe(id);
      expect(onModeChange).toHaveBeenCalledWith({ type: "modechange", mode: id });
    },
  );

  it("emits INVALID_INPUT and keeps the current mode for an unregistered id (BR-C-02)", () => {
    const container = document.createElement("div");
    const handle = createViewer(container);
    const onError = vi.fn();
    handle.on("error", onError);

    handle.setMode("doesNotExist");

    expect(handle.getMode()).toBe("standard");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      type: "error",
      error: { code: "INVALID_INPUT" },
    });
  });

  it("setMode to the already-active mode is a no-op (no modechange event)", () => {
    const container = document.createElement("div");
    const handle = createViewer(container);
    const onModeChange = vi.fn();
    handle.on("modechange", onModeChange);

    handle.setMode("standard");

    expect(onModeChange).not.toHaveBeenCalled();
  });

  it("accepts an options argument without effect (BR-C-14)", () => {
    const container = document.createElement("div");
    const handle = createViewer(container);

    expect(() => handle.setMode("ultraWide", { transition: "fade" })).not.toThrow();
    expect(handle.getMode()).toBe("ultraWide");
  });

  it("registerMode + setMode selects a custom mode (US-12/BR-C-12)", () => {
    const container = document.createElement("div");
    const handle = createViewer(container);
    const custom = fakeMode("myCustomMode");
    const applySpy = vi.spyOn(custom, "apply");

    handle.registerMode(custom);
    handle.setMode("myCustomMode");

    expect(handle.getMode()).toBe("myCustomMode");
    expect(applySpy).toHaveBeenCalledTimes(1);
  });

  it("listModes returns built-in ids in FR-03 order, with custom modes appended (BR-C-13)", () => {
    const container = document.createElement("div");
    const handle = createViewer(container);

    handle.registerMode(fakeMode("myCustomMode"));

    expect(handle.listModes()).toEqual([
      "standard",
      "ultraWide",
      "dewarp",
      "linear",
      "panini",
      "tinyPlanet",
      "crystalBall",
      "myCustomMode",
    ]);
  });

  describe("degraded handle (WebGL2 unsupported, BR-B-13 相当)", () => {
    beforeEach(() => {
      mockWebGL2Support(false);
    });

    it("setMode('standard') is a no-op", () => {
      const container = document.createElement("div");
      const handle = createViewer(container);
      const onError = vi.fn();
      handle.on("error", onError);

      handle.setMode("standard");

      expect(onError).not.toHaveBeenCalled();
    });

    it("setMode(other) reports INVALID_INPUT", () => {
      const container = document.createElement("div");
      const handle = createViewer(container);
      const onError = vi.fn();
      handle.on("error", onError);

      handle.setMode("ultraWide");

      expect(onError.mock.calls[0]?.[0]).toMatchObject({
        type: "error",
        error: { code: "INVALID_INPUT" },
      });
    });

    it("listModes returns ['standard']", () => {
      const container = document.createElement("div");
      const handle = createViewer(container);

      expect(handle.listModes()).toEqual(["standard"]);
    });
  });
});
