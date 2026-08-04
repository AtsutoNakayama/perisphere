import { cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Perisphere } from "../Perisphere.js";
import type { PerisphereHandle } from "../types.js";
import { createMockViewerHandle } from "./testUtils.js";
import type { MockViewerHandle } from "./testUtils.js";

const { createViewer } = vi.hoisted(() => ({ createViewer: vi.fn() }));

// @perisphere/core をモジュール境界としてモック化する（uow-h-code-generation-plan.md 参照）。
vi.mock("@perisphere/core", () => ({ createViewer }));

let handle: MockViewerHandle;

beforeEach(() => {
  handle = createMockViewerHandle();
  createViewer.mockReturnValue(handle);
});

afterEach(() => {
  cleanup();
  createViewer.mockReset();
});

describe("Perisphere — mount (P1, BR-H-01/02)", () => {
  it("calls createViewer with the root div as container", () => {
    const { container } = render(<Perisphere />);
    const root = container.querySelector('[data-testid="perisphere-root"]');
    expect(createViewer).toHaveBeenCalledTimes(1);
    expect(createViewer.mock.calls[0]?.[0]).toBe(root);
  });

  it("passes className/style to the root div (BR-H-01)", () => {
    const { container } = render(<Perisphere className="foo" style={{ width: 10 }} />);
    const root = container.querySelector('[data-testid="perisphere-root"]') as HTMLDivElement;
    expect(root.className).toBe("foo");
    expect(root.style.width).toBe("10px");
  });

  it("passes unknown props (e.g. controls/text) through as ViewerOptions (BR-H-08)", () => {
    render(<Perisphere controls={false} />);
    expect(createViewer.mock.calls[0]?.[1]).toEqual({ controls: false });
  });
});

describe("Perisphere — initial source application (BR-H-05)", () => {
  it("applies photos over image when both are given", () => {
    render(<Perisphere image="https://example.com/a.jpg" photos={["https://example.com/b.jpg"]} />);
    expect(handle.setPhotos).toHaveBeenCalledWith(["https://example.com/b.jpg"]);
    expect(handle.loadImage).not.toHaveBeenCalled();
  });

  it("applies image when photos is absent", () => {
    render(<Perisphere image="https://example.com/a.jpg" />);
    expect(handle.loadImage).toHaveBeenCalledWith("https://example.com/a.jpg");
  });

  it("applies mode when given", () => {
    render(<Perisphere mode="dewarp" />);
    expect(handle.setMode).toHaveBeenCalledWith("dewarp");
  });

  it("does not reject unhandled when loadImage fails (RP-H-1)", async () => {
    handle.loadImage = vi.fn(() => Promise.reject(new Error("boom")));
    expect(() => render(<Perisphere image="https://example.com/a.jpg" />)).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });
});

describe("Perisphere — ref exposure (P2, BR-H-04)", () => {
  it("exposes the full ViewerHandle via ref immediately after mount", () => {
    const ref = createRef<PerisphereHandle>();
    render(<Perisphere ref={ref} />);
    ref.current?.setMode("linear");
    expect(handle.setMode).toHaveBeenCalledWith("linear");
  });

  it("does not throw when a ref member is accessed before mount effects run", () => {
    const ref = createRef<PerisphereHandle>();
    expect(() => ref.current?.getMode()).not.toThrow();
  });
});

describe("Perisphere — props change reflection (P4, BR-H-06)", () => {
  it("reflects a new photos reference", () => {
    const photosA = ["https://example.com/a.jpg"];
    const photosB = ["https://example.com/b.jpg"];
    const { rerender } = render(<Perisphere photos={photosA} />);
    handle.setPhotos.mockClear();
    rerender(<Perisphere photos={photosB} />);
    expect(handle.setPhotos).toHaveBeenCalledWith(photosB);
  });

  it("does not re-apply when the same photos reference is passed again", () => {
    const photos = ["https://example.com/a.jpg"];
    const { rerender } = render(<Perisphere photos={photos} />);
    handle.setPhotos.mockClear();
    rerender(<Perisphere photos={photos} />);
    expect(handle.setPhotos).not.toHaveBeenCalled();
  });

  it("reflects a new mode value", () => {
    const { rerender } = render(<Perisphere mode="standard" />);
    handle.setMode.mockClear();
    rerender(<Perisphere mode="panini" />);
    expect(handle.setMode).toHaveBeenCalledWith("panini");
  });
});

describe("Perisphere — event bridge (P3, BR-H-09/10)", () => {
  it("invokes onReady with no arguments", () => {
    const onReady = vi.fn();
    render(<Perisphere onReady={onReady} />);
    handle.emit("ready", { type: "ready" });
    expect(onReady).toHaveBeenCalledWith();
  });

  it("invokes onError with the unwrapped PerisphereError", () => {
    const onError = vi.fn();
    render(<Perisphere onError={onError} />);
    const error = { code: "IMAGE_LOAD_FAILED", message: "failed" } as const;
    handle.emit("error", { type: "error", error });
    expect(onError).toHaveBeenCalledWith(error);
  });

  it("invokes onPhotoChange with the type field stripped", () => {
    const onPhotoChange = vi.fn();
    render(<Perisphere onPhotoChange={onPhotoChange} />);
    handle.emit("photochange", { type: "photochange", index: 1, total: 3 });
    expect(onPhotoChange).toHaveBeenCalledWith({ index: 1, total: 3 });
  });

  it("subscribes once (8 event types) even when callbacks are new inline functions each render", () => {
    const { rerender } = render(<Perisphere onModeChange={() => {}} />);
    expect(handle.on).toHaveBeenCalledTimes(8);
    rerender(<Perisphere onModeChange={() => {}} />);
    expect(handle.on).toHaveBeenCalledTimes(8);
  });

  it("always calls the latest callback after a rerender with a new inline function", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Perisphere onModeChange={first} />);
    rerender(<Perisphere onModeChange={second} />);
    handle.emit("modechange", { type: "modechange", mode: "linear" });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({ mode: "linear" });
  });
});

describe("Perisphere — unmount (P5, BR-H-11)", () => {
  it("calls dispose and unsubscribes all events", () => {
    const { unmount } = render(<Perisphere onReady={() => {}} />);
    unmount();
    expect(handle.dispose).toHaveBeenCalledTimes(1);
    expect(handle.listenerCount("ready")).toBe(0);
  });
});
