import { describe, expect, it } from "vitest";

import { ModeRegistry } from "../ModeRegistry.js";
import type { ViewerMode } from "../../viewer/ViewerMode.js";

function fakeMode(id: string): ViewerMode {
  return {
    id,
    apply: () => {},
    updateView: () => {},
    dispose: () => {},
  };
}

describe("ModeRegistry", () => {
  it("registers and resolves modes by id", () => {
    const registry = new ModeRegistry();
    const mode = fakeMode("standard");

    registry.register(mode);

    expect(registry.get("standard")).toBe(mode);
    expect(registry.has("standard")).toBe(true);
  });

  it("returns undefined/false for unregistered ids", () => {
    const registry = new ModeRegistry();

    expect(registry.get("unknown")).toBeUndefined();
    expect(registry.has("unknown")).toBe(false);
  });

  it("overwrites a previously registered mode with the same id", () => {
    const registry = new ModeRegistry();
    const first = fakeMode("custom");
    const second = fakeMode("custom");

    registry.register(first);
    registry.register(second);

    expect(registry.get("custom")).toBe(second);
  });

  it("lists registered ids in registration order (BR-C-13)", () => {
    const registry = new ModeRegistry();
    registry.register(fakeMode("a"));
    registry.register(fakeMode("b"));
    registry.register(fakeMode("c"));

    expect(registry.listIds()).toEqual(["a", "b", "c"]);
  });
});
