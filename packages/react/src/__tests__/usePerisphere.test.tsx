import { cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Perisphere } from "../Perisphere.js";
import { usePerisphere } from "../usePerisphere.js";
import { createMockViewerHandle } from "./testUtils.js";
import type { MockViewerHandle } from "./testUtils.js";

const { createViewer } = vi.hoisted(() => ({ createViewer: vi.fn() }));
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

describe("usePerisphere", () => {
  it("returns a ref initialized to null", () => {
    const { result } = renderHook(() => usePerisphere());
    expect(result.current.ref.current).toBeNull();
  });

  it("the returned ref becomes usable once passed to <Perisphere ref={ref} />", () => {
    const { result } = renderHook(() => usePerisphere());
    render(<Perisphere ref={result.current.ref} />);
    result.current.ref.current?.setMode("crystalBall");
    expect(handle.setMode).toHaveBeenCalledWith("crystalBall");
  });
});
