import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StandardMode } from "../StandardMode.js";
import type { RendererCallbacks } from "../Renderer.js";
import type { ViewerMode } from "../ViewerMode.js";
import type { InputIntent, InputSource } from "../../interaction/types.js";

interface MockRendererInstance {
  callbacks: RendererCallbacks;
  startLoop: ReturnType<typeof vi.fn>;
  stopLoop: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  setActiveMode: ReturnType<typeof vi.fn>;
  setSphereTexture: ReturnType<typeof vi.fn>;
  setSphereMaterial: ReturnType<typeof vi.fn>;
}

// Renderer は WebGL 境界としてモック化する（tech-stack-decisions.md §5、UoW-A から継続）。
// PointerInputSource/TouchInputSource/KeyboardInputSource はモック化せず実装をそのまま使う
// （container への実 DOM イベントで検証できるため）。
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

function fakeMode(id: string, overrides: Partial<ViewerMode> = {}): ViewerMode {
  return {
    id,
    apply: () => {},
    updateView: () => {},
    dispose: () => {},
    ...overrides,
  };
}

describe("createViewer — interaction (UoW-D)", () => {
  beforeEach(() => {
    rendererInstances.length = 0;
    mockWebGL2Support(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with the StandardMode default view (US-20)", () => {
    const handle = createViewer(document.createElement("div"));

    expect(handle.getView()).toEqual({ yaw: 0, pitch: 0, fov: 75 });
  });

  describe("registerInputSource (BR-D-02)", () => {
    it("forwards a registered source's pan/tilt/zoom intents to the view (NFR-02)", () => {
      const container = document.createElement("div");
      const handle = createViewer(container);
      const source = fakeInputSource("fake");

      handle.registerInputSource(source);
      source.emit({ kind: "pan", deltaPx: 100 });

      expect(handle.getView().yaw).not.toBe(0);
    });

    it("a setMode intent from a custom source switches the mode (Q7=A)", () => {
      const container = document.createElement("div");
      const handle = createViewer(container);
      const source = fakeInputSource("fake");
      handle.registerInputSource(source);

      source.emit({ kind: "setMode", mode: "ultraWide" });

      expect(handle.getMode()).toBe("ultraWide");
    });

    it.each(["photoNext", "photoPrev", "toggleFullscreen"] as const)(
      "safely ignores '%s' intents since UoW-E/F are not implemented yet (BR-D-16)",
      (kind) => {
        const container = document.createElement("div");
        const handle = createViewer(container);
        const source = fakeInputSource("fake");
        handle.registerInputSource(source);

        expect(() => source.emit({ kind })).not.toThrow();
      },
    );
  });

  describe("PP-D-1 Coalesced View Change Emission", () => {
    it("does not emit viewchange until the Renderer's onFrame callback flushes it", () => {
      const container = document.createElement("div");
      const handle = createViewer(container);
      const onViewChange = vi.fn();
      handle.on("viewchange", onViewChange);
      const source = fakeInputSource("fake");
      handle.registerInputSource(source);

      source.emit({ kind: "pan", deltaPx: 100 });
      expect(onViewChange).not.toHaveBeenCalled();

      rendererInstances[0]?.callbacks.onFrame?.();
      expect(onViewChange).toHaveBeenCalledTimes(1);
      expect(onViewChange.mock.calls[0]?.[0]).toMatchObject({ type: "viewchange" });
    });

    it("coalesces multiple intents within the same frame into a single viewchange", () => {
      const container = document.createElement("div");
      const handle = createViewer(container);
      const onViewChange = vi.fn();
      handle.on("viewchange", onViewChange);
      const source = fakeInputSource("fake");
      handle.registerInputSource(source);

      source.emit({ kind: "pan", deltaPx: 10 });
      source.emit({ kind: "pan", deltaPx: 10 });
      source.emit({ kind: "tilt", deltaPx: 5 });
      rendererInstances[0]?.callbacks.onFrame?.();

      expect(onViewChange).toHaveBeenCalledTimes(1);
    });

    it("emits zoomchange alongside viewchange only when fov actually changed (BR-D-14)", () => {
      const container = document.createElement("div");
      const handle = createViewer(container);
      const onZoomChange = vi.fn();
      handle.on("zoomchange", onZoomChange);
      const source = fakeInputSource("fake");
      handle.registerInputSource(source);

      source.emit({ kind: "pan", deltaPx: 10 });
      rendererInstances[0]?.callbacks.onFrame?.();
      expect(onZoomChange).not.toHaveBeenCalled();

      source.emit({ kind: "zoom", mode: "delta", value: 10 });
      rendererInstances[0]?.callbacks.onFrame?.();
      expect(onZoomChange).toHaveBeenCalledTimes(1);
    });

    it("does nothing when onFrame fires with no pending change", () => {
      const container = document.createElement("div");
      const handle = createViewer(container);
      // 初期化時の resetToModeDefault 同期分の pending を最初の1回で消費しておく。
      rendererInstances[0]?.callbacks.onFrame?.();
      const onViewChange = vi.fn();
      handle.on("viewchange", onViewChange);

      rendererInstances[0]?.callbacks.onFrame?.();

      expect(onViewChange).not.toHaveBeenCalled();
    });
  });

  describe("setView / setZoomLimits (BR-D-10/11)", () => {
    it("setView merges and clamps pitch/fov, normalizes yaw", () => {
      const container = document.createElement("div");
      const handle = createViewer(container);

      handle.setView({ pitch: 400, yaw: 720 });

      const view = handle.getView();
      expect(view.pitch).toBe(90);
      expect(view.yaw).toBeGreaterThan(-180);
      expect(view.yaw).toBeLessThanOrEqual(180);
    });

    it("setView with a non-finite value reports INVALID_INPUT and leaves the view unchanged", () => {
      const container = document.createElement("div");
      const handle = createViewer(container);
      const before = handle.getView();
      const onError = vi.fn();
      handle.on("error", onError);

      handle.setView({ fov: Number.POSITIVE_INFINITY });

      expect(onError.mock.calls[0]?.[0]).toMatchObject({
        type: "error",
        error: { code: "INVALID_INPUT" },
      });
      expect(handle.getView()).toEqual(before);
    });

    it("setZoomLimits with minFov >= maxFov reports INVALID_INPUT and leaves limits unchanged", () => {
      const container = document.createElement("div");
      const handle = createViewer(container);
      const onError = vi.fn();
      handle.on("error", onError);

      handle.setZoomLimits({ minFov: 90, maxFov: 30 });

      expect(onError.mock.calls[0]?.[0]).toMatchObject({
        type: "error",
        error: { code: "INVALID_INPUT" },
      });
    });

    it("an explicit zoom limit persists across setMode and re-clamps the new mode's default fov (BR-D-12)", () => {
      const container = document.createElement("div");
      const handle = createViewer(container);
      handle.registerMode(
        fakeMode("wide", {
          defaultView: { yaw: 0, pitch: 0, fov: 150 },
          defaultZoomLimits: { minFov: 100, maxFov: 170 },
        }),
      );

      handle.setZoomLimits({ minFov: 50, maxFov: 60 });
      handle.setMode("wide");

      expect(handle.getView().fov).toBe(60);
    });

    it("without an explicit zoom limit, setMode adopts the new mode's own default view (custom mode with no defaultView falls back)", () => {
      const container = document.createElement("div");
      const handle = createViewer(container);
      handle.registerMode(fakeMode("bare")); // defaultView/defaultZoomLimits とも省略

      handle.setMode("bare");

      expect(handle.getView()).toEqual({ yaw: 0, pitch: 0, fov: 75 }); // FALLBACK_DEFAULT_VIEW
    });
  });

  describe("setKeymap (US-19)", () => {
    it("null disables the built-in KeyboardInputSource", () => {
      const container = document.createElement("div");
      const handle = createViewer(container);

      handle.setKeymap(null);
      container.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));

      expect(handle.getView().yaw).toBe(0);
    });

    it("a Partial<Keymap> remap changes which key drives an action", () => {
      const container = document.createElement("div");
      const handle = createViewer(container);

      handle.setKeymap({ panLeft: ["a"] });
      container.dispatchEvent(
        new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true }),
      );

      expect(handle.getView().yaw).not.toBe(0);
    });
  });

  describe("BR-D-13: context-lost recovery re-applies the last known view", () => {
    it("calls currentMode.updateView with the panned view once onRebuildSucceeded fires", () => {
      const updateViewSpy = vi.spyOn(StandardMode.prototype, "updateView");
      const container = document.createElement("div");
      const handle = createViewer(container);
      const source = fakeInputSource("fake");
      handle.registerInputSource(source);
      source.emit({ kind: "pan", deltaPx: 100 });
      const viewAfterPan = handle.getView();
      updateViewSpy.mockClear();

      rendererInstances[0]?.callbacks.onRebuildSucceeded();

      expect(updateViewSpy).toHaveBeenCalledWith(expect.anything(), viewAfterPan);
    });
  });

  describe("degraded handle (WebGL2 unsupported, BR-B-13 相当)", () => {
    beforeEach(() => {
      mockWebGL2Support(false);
    });

    it("getView/setView/setZoomLimits/registerInputSource/setKeymap are safe no-ops", () => {
      const container = document.createElement("div");
      const handle = createViewer(container);

      expect(handle.getView()).toEqual({ yaw: 0, pitch: 0, fov: 75 });
      expect(() => handle.setView({ yaw: 10 })).not.toThrow();
      expect(() => handle.setZoomLimits({ minFov: 40 })).not.toThrow();
      expect(() => handle.registerInputSource(fakeInputSource("fake"))).not.toThrow();
      expect(() => handle.setKeymap(null)).not.toThrow();
    });
  });
});
