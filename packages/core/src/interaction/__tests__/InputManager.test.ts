import { describe, expect, it, vi } from "vitest";

import { InputManager } from "../InputManager.js";
import type { InputSource } from "../types.js";

function fakeSource(id: string): {
  source: InputSource;
  attach: ReturnType<typeof vi.fn>;
  detach: ReturnType<typeof vi.fn>;
} {
  const attach = vi.fn();
  const detach = vi.fn();
  const source: InputSource = { id, attach, detach };
  return { source, attach, detach };
}

describe("InputManager", () => {
  it("register() attaches the source to the shared target with the shared intent handler (BR-D-01)", () => {
    const target = document.createElement("div");
    const onIntent = vi.fn();
    const manager = new InputManager(target, onIntent);
    const { source, attach } = fakeSource("fake");

    manager.register(source);

    expect(attach).toHaveBeenCalledTimes(1);
    expect(attach).toHaveBeenCalledWith(target, onIntent);
  });

  it("detachAll() detaches every registered source regardless of registration order (BR-D-03)", () => {
    const target = document.createElement("div");
    const manager = new InputManager(target, vi.fn());
    const a = fakeSource("a");
    const b = fakeSource("b");
    manager.register(a.source);
    manager.register(b.source);

    manager.detachAll();

    expect(a.detach).toHaveBeenCalledTimes(1);
    expect(b.detach).toHaveBeenCalledTimes(1);
  });

  it("detachAll() is safe to call with no registered sources", () => {
    const manager = new InputManager(document.createElement("div"), vi.fn());

    expect(() => manager.detachAll()).not.toThrow();
  });
});
