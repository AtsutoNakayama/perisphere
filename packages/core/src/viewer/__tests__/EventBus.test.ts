import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import { EventBus } from "../EventBus.js";

describe("EventBus", () => {
  it("emits to handlers synchronously in registration order (BR-A-07)", () => {
    const bus = new EventBus();
    const calls: number[] = [];
    bus.on("ready", () => calls.push(1));
    bus.on("ready", () => calls.push(2));
    bus.on("ready", () => calls.push(3));

    bus.emit("ready", { type: "ready" });

    expect(calls).toEqual([1, 2, 3]);
  });

  it("stops notifying a handler after off()", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("ready", handler);
    bus.off("ready", handler);

    bus.emit("ready", { type: "ready" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("invokes a once() handler exactly once", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.once("ready", handler);

    bus.emit("ready", { type: "ready" });
    bus.emit("ready", { type: "ready" });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("isolates a throwing handler so remaining handlers still run (BR-A-08)", () => {
    const bus = new EventBus();
    const calls: string[] = [];
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    bus.on("ready", () => {
      calls.push("first");
      throw new Error("boom");
    });
    bus.on("ready", () => calls.push("second"));

    expect(() => bus.emit("ready", { type: "ready" })).not.toThrow();
    expect(calls).toEqual(["first", "second"]);
    expect(consoleError).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });

  it("clear() removes all handlers", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("ready", handler);

    bus.clear();
    bus.emit("ready", { type: "ready" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("PBT: any number of handlers are all invoked exactly once regardless of thrown exceptions", () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 0, maxLength: 20 }), (throwsFlags) => {
        const bus = new EventBus();
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        const callCounts = throwsFlags.map(() => 0);

        throwsFlags.forEach((shouldThrow, index) => {
          bus.on("ready", () => {
            callCounts[index] = (callCounts[index] ?? 0) + 1;
            if (shouldThrow) throw new Error(`handler ${index} failed`);
          });
        });

        expect(() => bus.emit("ready", { type: "ready" })).not.toThrow();
        expect(callCounts.every((count) => count === 1)).toBe(true);

        consoleError.mockRestore();
      }),
    );
  });
});
