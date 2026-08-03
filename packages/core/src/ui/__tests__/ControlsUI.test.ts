import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  FullscreenChangeEvent,
  ModeChangeEvent,
  PhotoChangeEvent,
  ViewerEventMap,
  ViewerEventType,
  ViewerModeId,
  ViewState,
} from "../../viewer/types.js";
import { ControlsUI } from "../ControlsUI.js";
import type { ControlsUIDeps } from "../ControlsUI.js";

const STYLE_ID = "perisphere-controls-style";

function createFakeDeps(overrides: Partial<ControlsUIDeps> = {}): {
  deps: ControlsUIDeps;
  emit: <K extends ViewerEventType>(type: K, event: ViewerEventMap[K]) => void;
} {
  const handlers = new Map<ViewerEventType, Set<(event: never) => void>>();

  const deps: ControlsUIDeps = {
    getMode: vi.fn((): ViewerModeId => "standard"),
    setMode: vi.fn(),
    listModes: vi.fn((): ViewerModeId[] => ["standard", "ultraWide"]),
    getView: vi.fn((): ViewState => ({ yaw: 0, pitch: 0, fov: 75 })),
    setView: vi.fn(),
    getPhotoIndex: vi.fn(() => 0),
    getPhotoCount: vi.fn(() => 3),
    next: vi.fn(),
    prev: vi.fn(),
    goTo: vi.fn(),
    enterFullscreen: vi.fn(() => Promise.resolve()),
    exitFullscreen: vi.fn(() => Promise.resolve()),
    isFullscreen: vi.fn(() => false),
    on(type, handler) {
      const set = handlers.get(type) ?? new Set();
      set.add(handler as never);
      handlers.set(type, set);
    },
    off(type, handler) {
      handlers.get(type)?.delete(handler as never);
    },
    ...overrides,
  };

  return {
    deps,
    emit: (type, event) => {
      for (const handler of handlers.get(type) ?? []) handler(event as never);
    },
  };
}

function query<T extends Element>(root: ParentNode, testid: string): T {
  const el = root.querySelector(`[data-testid="${testid}"]`);
  if (!el) throw new Error(`element with data-testid="${testid}" not found`);
  return el as T;
}

describe("ControlsUI", () => {
  beforeEach(() => {
    document.getElementById(STYLE_ID)?.remove(); // tech-stack-decisions.md §1: テストごとに未注入状態から開始
  });

  afterEach(() => {
    document.getElementById(STYLE_ID)?.remove();
  });

  it("builds the DOM under the container with data-testid hooks on construction", () => {
    const container = document.createElement("div");
    const { deps } = createFakeDeps();

    new ControlsUI(container, deps, {}, {});

    expect(container.querySelector(".perisphere-controls")).not.toBeNull();
    expect(query(container, "perisphere-controls-fullscreen")).toBeInstanceOf(HTMLButtonElement);
    expect(query(container, "perisphere-controls-zoom-in")).toBeInstanceOf(HTMLButtonElement);
    expect(query(container, "perisphere-controls-zoom-out")).toBeInstanceOf(HTMLButtonElement);
    expect(query(container, "perisphere-controls-mode")).toBeInstanceOf(HTMLSelectElement);
    expect(query(container, "perisphere-controls-photo-prev")).toBeInstanceOf(HTMLButtonElement);
    expect(query(container, "perisphere-controls-photo-next")).toBeInstanceOf(HTMLButtonElement);
  });

  it("injects the shared stylesheet only once across instances (BR-G-12)", () => {
    const container1 = document.createElement("div");
    const container2 = document.createElement("div");

    new ControlsUI(container1, createFakeDeps().deps, {}, {});
    new ControlsUI(container2, createFakeDeps().deps, {}, {});

    expect(document.querySelectorAll(`#${STYLE_ID}`)).toHaveLength(1);
  });

  it("clicking the fullscreen button calls enterFullscreen/exitFullscreen and restores focus (BR-G-11, RP-G-1)", async () => {
    const container = document.createElement("div");
    const { deps } = createFakeDeps({ isFullscreen: vi.fn(() => false) });
    const focusSpy = vi.spyOn(container, "focus");
    new ControlsUI(container, deps, {}, {});

    query<HTMLButtonElement>(container, "perisphere-controls-fullscreen").click();
    await Promise.resolve();

    expect(deps.enterFullscreen).toHaveBeenCalledTimes(1);
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it("does not let a rejected enterFullscreen() surface as an unhandled rejection (RP-G-1)", async () => {
    const container = document.createElement("div");
    const { deps } = createFakeDeps({
      enterFullscreen: vi.fn(() => Promise.reject(new Error("denied"))),
    });
    new ControlsUI(container, deps, {}, {});

    expect(() =>
      query<HTMLButtonElement>(container, "perisphere-controls-fullscreen").click(),
    ).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });

  it("zoom in/out apply CONTROLS_ZOOM_RATIO to the current fov via setView (BR-G-14)", () => {
    const container = document.createElement("div");
    const { deps } = createFakeDeps({
      getView: vi.fn((): ViewState => ({ yaw: 0, pitch: 0, fov: 100 })),
    });
    new ControlsUI(container, deps, {}, {});

    query<HTMLButtonElement>(container, "perisphere-controls-zoom-in").click();
    expect(deps.setView).toHaveBeenCalledWith({ fov: 90 });

    query<HTMLButtonElement>(container, "perisphere-controls-zoom-out").click();
    expect(deps.setView).toHaveBeenLastCalledWith({ fov: 100 / 0.9 });
  });

  it("rebuilds mode <select> options on pointerdown and reflects a change via setMode (BR-G-06)", () => {
    const container = document.createElement("div");
    const listModes = vi.fn((): ViewerModeId[] => ["standard"]);
    const { deps } = createFakeDeps({ listModes });
    new ControlsUI(container, deps, {}, {});
    const select = query<HTMLSelectElement>(container, "perisphere-controls-mode");

    listModes.mockReturnValue(["standard", "ultraWide", "dewarp"]);
    select.dispatchEvent(new Event("pointerdown"));
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      "standard",
      "ultraWide",
      "dewarp",
    ]);

    select.value = "dewarp";
    select.dispatchEvent(new Event("change"));
    expect(deps.setMode).toHaveBeenCalledWith("dewarp");
  });

  it("photo prev/next call deps.prev/next and restore focus (BR-G-09, BR-G-11)", () => {
    const container = document.createElement("div");
    const { deps } = createFakeDeps();
    const focusSpy = vi.spyOn(container, "focus");
    new ControlsUI(container, deps, {}, {});

    query<HTMLButtonElement>(container, "perisphere-controls-photo-next").click();
    expect(deps.next).toHaveBeenCalledTimes(1);
    query<HTMLButtonElement>(container, "perisphere-controls-photo-prev").click();
    expect(deps.prev).toHaveBeenCalledTimes(1);
    expect(focusSpy).toHaveBeenCalledTimes(2);
  });

  it("builds one indicator button per photo, marks the current one, and jumps via goTo() on click (BR-G-08)", () => {
    const container = document.createElement("div");
    const { deps } = createFakeDeps({
      getPhotoCount: vi.fn(() => 3),
      getPhotoIndex: vi.fn(() => 1),
    });
    new ControlsUI(container, deps, {}, {});

    const buttons = container.querySelectorAll(
      '[data-testid^="perisphere-controls-photo-indicator-"]',
    );
    expect(buttons).toHaveLength(3);
    expect(buttons[1]?.getAttribute("aria-current")).toBe("true");
    expect(buttons[0]?.hasAttribute("aria-current")).toBe(false);

    (buttons[2] as HTMLButtonElement).click();
    expect(deps.goTo).toHaveBeenCalledWith(2);
  });

  it("re-evaluates auto-hide (modeSwitch/photoNav/photoIndicator) on modechange/photochange (BR-G-04/05)", () => {
    const container = document.createElement("div");
    const listModes = vi.fn((): ViewerModeId[] => ["standard"]);
    const getPhotoCount = vi.fn(() => 1);
    const { deps, emit } = createFakeDeps({ listModes, getPhotoCount });
    new ControlsUI(container, deps, {}, {});

    const select = query<HTMLSelectElement>(container, "perisphere-controls-mode");
    const photoNav = container.querySelector(".perisphere-controls__photo-nav") as HTMLElement;
    expect(select.hidden).toBe(true); // only 1 mode
    expect(photoNav.hidden).toBe(true); // only 1 photo

    listModes.mockReturnValue(["standard", "ultraWide"]);
    emit("modechange", { type: "modechange", mode: "ultraWide" } satisfies ModeChangeEvent);
    expect(select.hidden).toBe(false);

    // 実運用では photochange 発火時点で Gallery の総数は既に更新済みのため、
    // deps.getPhotoCount() もイベントの total と同じ値を返す（BR-G-07）。
    getPhotoCount.mockReturnValue(4);
    emit("photochange", { type: "photochange", index: 0, total: 4 } satisfies PhotoChangeEvent);
    expect(photoNav.hidden).toBe(false);
  });

  it("rebuilds the indicator when photochange reports a different total, and just syncs current otherwise (BR-G-08)", () => {
    const container = document.createElement("div");
    const { deps, emit } = createFakeDeps({ getPhotoCount: vi.fn(() => 3) });
    new ControlsUI(container, deps, {}, {});

    emit("photochange", { type: "photochange", index: 2, total: 3 } satisfies PhotoChangeEvent);
    let buttons = container.querySelectorAll(
      '[data-testid^="perisphere-controls-photo-indicator-"]',
    );
    expect(buttons).toHaveLength(3);
    expect(buttons[2]?.getAttribute("aria-current")).toBe("true");

    emit("photochange", { type: "photochange", index: 0, total: 5 } satisfies PhotoChangeEvent);
    buttons = container.querySelectorAll('[data-testid^="perisphere-controls-photo-indicator-"]');
    expect(buttons).toHaveLength(5);
    expect(buttons[0]?.getAttribute("aria-current")).toBe("true");
  });

  it("syncs the fullscreen button label on fullscreenchange", () => {
    const container = document.createElement("div");
    const { deps, emit } = createFakeDeps();
    new ControlsUI(
      container,
      deps,
      {},
      { fullscreenEnterLabel: "Enter FS", fullscreenExitLabel: "Exit FS" },
    );
    const button = query<HTMLButtonElement>(container, "perisphere-controls-fullscreen");
    expect(button.getAttribute("aria-label")).toBe("Enter FS");

    emit("fullscreenchange", {
      type: "fullscreenchange",
      active: true,
    } satisfies FullscreenChangeEvent);
    expect(button.getAttribute("aria-label")).toBe("Exit FS");
  });

  it("setVisibility() merges into the current config and re-applies (BR-G-02)", () => {
    const container = document.createElement("div");
    const { deps } = createFakeDeps();
    const controlsUI = new ControlsUI(container, deps, {}, {});
    const fullscreenButton = query<HTMLButtonElement>(container, "perisphere-controls-fullscreen");

    controlsUI.setVisibility({ fullscreen: false });
    expect(fullscreenButton.hidden).toBe(true);

    controlsUI.setVisibility({ zoom: false });
    expect(fullscreenButton.hidden).toBe(true); // 前回のマージが維持される
    expect((container.querySelector(".perisphere-controls__zoom") as HTMLElement).hidden).toBe(
      true,
    );
  });

  it("setText() re-applies textContent/aria-label via textContent/setAttribute only (SP-G-1)", () => {
    const container = document.createElement("div");
    const { deps } = createFakeDeps();
    const controlsUI = new ControlsUI(container, deps, {}, {});
    const innerHTMLSpy = vi.spyOn(HTMLElement.prototype, "innerHTML", "set");

    controlsUI.setText({ zoomInLabel: "<img src=x onerror=alert(1)>" });

    const zoomInButton = query<HTMLButtonElement>(container, "perisphere-controls-zoom-in");
    expect(zoomInButton.getAttribute("aria-label")).toBe("<img src=x onerror=alert(1)>");
    expect(zoomInButton.querySelector("img")).toBeNull();
    expect(innerHTMLSpy).not.toHaveBeenCalled();

    innerHTMLSpy.mockRestore();
  });

  it("dispose() removes the root element and unsubscribes from events, but keeps the shared stylesheet (BR-G-13)", () => {
    const container = document.createElement("div");
    const { deps, emit } = createFakeDeps();
    const controlsUI = new ControlsUI(container, deps, {}, {});

    controlsUI.dispose();

    expect(container.querySelector(".perisphere-controls")).toBeNull();
    expect(document.getElementById(STYLE_ID)).not.toBeNull();
    // 購読解除後は modechange を受けても select の値を書き換えない（例外も投げない）。
    expect(() =>
      emit("modechange", { type: "modechange", mode: "dewarp" } satisfies ModeChangeEvent),
    ).not.toThrow();
  });
});
