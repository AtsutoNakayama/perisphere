import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import { DisposableRegistry } from "../DisposableRegistry.js";

describe("DisposableRegistry", () => {
  it("disposes registered disposers in registration order (FIFO)", () => {
    const registry = new DisposableRegistry();
    const order: number[] = [];
    registry.register(() => order.push(1));
    registry.register(() => order.push(2));
    registry.register(() => order.push(3));

    registry.disposeAll();

    expect(order).toEqual([1, 2, 3]);
  });

  it("runs each disposer exactly once even if disposeAll() is called multiple times (BR-A-10)", () => {
    const registry = new DisposableRegistry();
    const disposer = vi.fn();
    registry.register(disposer);

    registry.disposeAll();
    registry.disposeAll();
    registry.disposeAll();

    expect(disposer).toHaveBeenCalledTimes(1);
  });

  it("reports isDisposed only after disposeAll() has run", () => {
    const registry = new DisposableRegistry();
    expect(registry.isDisposed).toBe(false);

    registry.disposeAll();

    expect(registry.isDisposed).toBe(true);
  });

  it("PBT: any number of disposers each run exactly once no matter how many times disposeAll() is called", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 1, max: 5 }),
        (disposerCount, disposeCallCount) => {
          const registry = new DisposableRegistry();
          const counts = new Array(disposerCount).fill(0);

          for (let i = 0; i < disposerCount; i++) {
            registry.register(() => {
              counts[i] += 1;
            });
          }

          for (let i = 0; i < disposeCallCount; i++) {
            registry.disposeAll();
          }

          expect(counts.every((count) => count === 1)).toBe(true);
        },
      ),
    );
  });
});
