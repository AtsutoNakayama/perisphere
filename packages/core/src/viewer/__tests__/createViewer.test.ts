import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RendererCallbacks } from "../Renderer.js";

interface MockRendererInstance {
  callbacks: RendererCallbacks;
  startLoop: ReturnType<typeof vi.fn>;
  stopLoop: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  setActiveMode: ReturnType<typeof vi.fn>;
}

// vi.mock は import 文より先に巻き上げられるため、three.js への参照はモックファクトリ内の
// 動的 import で解決する（トップレベルの静的 import を hoisted な参照から使うと初期化順序エラーになる）。
const { instances } = vi.hoisted(() => ({ instances: [] as MockRendererInstance[] }));

// Renderer は WebGL 境界としてモック化する（tech-stack-decisions.md §5）。
// jsdom は WebGL2 コンテキストを提供しないため、実描画確認はブラウザ手動確認に委ねる。
// modeContext は StandardMode（実装コード）が実際に操作する対象のため、three.js の実オブジェクトを使う。
vi.mock("../Renderer.js", async () => {
  const { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene } = await import("three");

  class MockRenderer {
    callbacks: RendererCallbacks;
    startLoop = vi.fn();
    stopLoop = vi.fn();
    dispose = vi.fn();
    setActiveMode = vi.fn();
    modeContext = {
      camera: new PerspectiveCamera(),
      scene: new Scene(),
      sphereMesh: new Mesh(new BoxGeometry(), new MeshBasicMaterial()),
    };

    constructor(_container: HTMLElement, callbacks: RendererCallbacks) {
      this.callbacks = callbacks;
      instances.push(this as unknown as MockRendererInstance);
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

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("createViewer", () => {
  beforeEach(() => {
    instances.length = 0;
    mockWebGL2Support(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a ViewerHandle synchronously and initializes the Renderer on the success path", () => {
    const container = document.createElement("div");

    const handle = createViewer(container);

    expect(handle.getMode()).toBe("standard");
    expect(instances).toHaveLength(1);
    expect(instances[0]?.setActiveMode).toHaveBeenCalledTimes(1);
    expect(instances[0]?.startLoop).toHaveBeenCalledTimes(1);
  });

  it("emits 'ready' asynchronously via microtask so a handler registered right after the call is not missed (BR-A-04)", async () => {
    const container = document.createElement("div");
    const handle = createViewer(container);
    const onReady = vi.fn();
    handle.on("ready", onReady);

    expect(onReady).not.toHaveBeenCalled();
    await flushMicrotasks();

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith({ type: "ready" });
  });

  it("falls back to a degraded handle without constructing a Renderer when WebGL2 is unavailable (BR-A-01/02/03)", () => {
    mockWebGL2Support(false);
    const container = document.createElement("div");

    const handle = createViewer(container);

    expect(handle).toBeDefined();
    expect(instances).toHaveLength(0);
  });

  it("never touches the container DOM in the degraded path (NFR Design Q6=A)", async () => {
    mockWebGL2Support(false);
    const container = document.createElement("div");

    createViewer(container);
    await flushMicrotasks();

    expect(container.children).toHaveLength(0);
  });

  it("emits 'error' with code WEBGL_UNSUPPORTED asynchronously in the degraded path (BR-A-03/04)", async () => {
    mockWebGL2Support(false);
    const container = document.createElement("div");
    const handle = createViewer(container);
    const onError = vi.fn();
    handle.on("error", onError);

    expect(onError).not.toHaveBeenCalled();
    await flushMicrotasks();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      type: "error",
      error: { code: "WEBGL_UNSUPPORTED" },
    });
  });

  it("dispose() is idempotent: the underlying Renderer is disposed exactly once (BR-A-10)", () => {
    const container = document.createElement("div");
    const handle = createViewer(container);

    handle.dispose();
    handle.dispose();
    handle.dispose();

    expect(instances[0]?.dispose).toHaveBeenCalledTimes(1);
  });

  it("setMode('standard') is a no-op and setMode(other) reports INVALID_INPUT without changing mode (BR-A-17)", () => {
    const container = document.createElement("div");
    const handle = createViewer(container);
    const onError = vi.fn();
    handle.on("error", onError);

    handle.setMode("standard");
    expect(onError).not.toHaveBeenCalled();
    expect(handle.getMode()).toBe("standard");

    // @ts-expect-error — 非標準値を意図的に渡して BR-A-17 を検証する
    handle.setMode("cinematic");

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      type: "error",
      error: { code: "INVALID_INPUT" },
    });
    expect(handle.getMode()).toBe("standard");
  });

  it("forwards Renderer context-loss callbacks into an 'error' event with code CONTEXT_LOST", () => {
    const container = document.createElement("div");
    const handle = createViewer(container);
    const onError = vi.fn();
    handle.on("error", onError);

    instances[0]?.callbacks.onContextLost();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      type: "error",
      error: { code: "CONTEXT_LOST" },
    });
  });

  it("no-ops and warns when methods are called after dispose() (BR-A-09)", () => {
    const container = document.createElement("div");
    const handle = createViewer(container);
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onReady = vi.fn();

    handle.dispose();
    handle.on("ready", onReady);
    handle.setMode("standard");
    const mode = handle.getMode();

    expect(mode).toBe("standard");
    expect(consoleWarn).toHaveBeenCalled();
  });
});
