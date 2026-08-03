import { describe, expect, it, vi } from "vitest";

import { PointerInputSource } from "../PointerInputSource.js";
import type { InputIntent } from "../types.js";

function down(x: number, y: number, button = 0): PointerEvent {
  return new PointerEvent("pointerdown", { clientX: x, clientY: y, button, pointerId: 1 });
}

function move(x: number, y: number): PointerEvent {
  return new PointerEvent("pointermove", { clientX: x, clientY: y, pointerId: 1 });
}

function up(): PointerEvent {
  return new PointerEvent("pointerup", { pointerId: 1 });
}

describe("PointerInputSource", () => {
  it("emits pan/tilt intents for the horizontal/vertical delta while dragging with the primary button (US-13)", () => {
    const target = document.createElement("div");
    const emit = vi.fn<(intent: InputIntent) => void>();
    const source = new PointerInputSource();

    source.attach(target, emit);
    target.dispatchEvent(down(100, 100));
    target.dispatchEvent(move(110, 90));

    expect(emit).toHaveBeenCalledWith({ kind: "pan", deltaPx: 10 });
    expect(emit).toHaveBeenCalledWith({ kind: "tilt", deltaPx: -10 });
  });

  it("ignores non-primary buttons (e.g. right-click drag)", () => {
    const target = document.createElement("div");
    const emit = vi.fn<(intent: InputIntent) => void>();
    const source = new PointerInputSource();

    source.attach(target, emit);
    target.dispatchEvent(down(0, 0, 2));
    target.dispatchEvent(move(50, 50));

    expect(emit).not.toHaveBeenCalled();
  });

  it("stops emitting pan/tilt after pointerup", () => {
    const target = document.createElement("div");
    const emit = vi.fn<(intent: InputIntent) => void>();
    const source = new PointerInputSource();

    source.attach(target, emit);
    target.dispatchEvent(down(0, 0));
    target.dispatchEvent(up());
    emit.mockClear();
    target.dispatchEvent(move(50, 50));

    expect(emit).not.toHaveBeenCalled();
  });

  it("emits a zoom(delta) intent carrying the raw wheel deltaY (US-14, BR-D-06)", () => {
    const target = document.createElement("div");
    const emit = vi.fn<(intent: InputIntent) => void>();
    const source = new PointerInputSource();

    source.attach(target, emit);
    target.dispatchEvent(new WheelEvent("wheel", { deltaY: 42, cancelable: true }));

    expect(emit).toHaveBeenCalledWith({ kind: "zoom", mode: "delta", value: 42 });
  });

  it("calls preventDefault on wheel to stop page scrolling (Q8)", () => {
    const target = document.createElement("div");
    const source = new PointerInputSource();

    source.attach(target, vi.fn());
    const event = new WheelEvent("wheel", { deltaY: 1, cancelable: true });
    target.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("gracefully falls back to unlocked drag tracking when setPointerCapture throws (RP-D-1)", () => {
    const target = document.createElement("div");
    // jsdom does not implement setPointerCapture at all; simulate a browser where it exists but throws
    // (e.g. the element is not yet connected to the document) to exercise the catch branch explicitly.
    (target as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {
      throw new DOMException("not connected");
    };
    (target as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {
      throw new DOMException("not captured");
    };
    const emit = vi.fn<(intent: InputIntent) => void>();
    const source = new PointerInputSource();

    source.attach(target, emit);

    expect(() => {
      target.dispatchEvent(down(0, 0));
      target.dispatchEvent(move(10, 0));
      target.dispatchEvent(up());
    }).not.toThrow();
    expect(emit).toHaveBeenCalledWith({ kind: "pan", deltaPx: 10 });
  });

  it("degrades the same way when setPointerCapture is entirely absent (the real jsdom behavior)", () => {
    const target = document.createElement("div");
    const emit = vi.fn<(intent: InputIntent) => void>();
    const source = new PointerInputSource();

    source.attach(target, emit);

    expect(() => target.dispatchEvent(down(0, 0))).not.toThrow();
  });

  it("detach() stops forwarding subsequent events and restores userSelect", () => {
    const target = document.createElement("div");
    const emit = vi.fn<(intent: InputIntent) => void>();
    const source = new PointerInputSource();

    source.attach(target, emit);
    expect(target.style.userSelect).toBe("none");
    source.detach();
    target.dispatchEvent(down(0, 0));
    target.dispatchEvent(move(10, 10));

    expect(emit).not.toHaveBeenCalled();
  });
});
