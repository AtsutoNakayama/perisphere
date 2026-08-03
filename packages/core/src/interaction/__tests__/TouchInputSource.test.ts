import { describe, expect, it, vi } from "vitest";

import { TouchInputSource } from "../TouchInputSource.js";
import type { InputIntent } from "../types.js";

interface FakeTouch {
  clientX: number;
  clientY: number;
  identifier: number;
}

function touchEvent(type: string, touches: FakeTouch[]): TouchEvent {
  return new TouchEvent(type, { touches: touches as unknown as Touch[], cancelable: true });
}

describe("TouchInputSource", () => {
  it("emits pan/tilt intents for a single-finger drag (US-15)", () => {
    const target = document.createElement("div");
    const emit = vi.fn<(intent: InputIntent) => void>();
    const source = new TouchInputSource();

    source.attach(target, emit);
    target.dispatchEvent(touchEvent("touchstart", [{ clientX: 100, clientY: 100, identifier: 0 }]));
    target.dispatchEvent(touchEvent("touchmove", [{ clientX: 90, clientY: 115, identifier: 0 }]));

    expect(emit).toHaveBeenCalledWith({ kind: "pan", deltaPx: -10 });
    expect(emit).toHaveBeenCalledWith({ kind: "tilt", deltaPx: 15 });
  });

  it("emits a zoom(scale) intent for a two-finger pinch, as the ratio of previous/current distance (US-16, BR-D-07)", () => {
    const target = document.createElement("div");
    const emit = vi.fn<(intent: InputIntent) => void>();
    const source = new TouchInputSource();

    source.attach(target, emit);
    target.dispatchEvent(
      touchEvent("touchstart", [
        { clientX: 0, clientY: 0, identifier: 0 },
        { clientX: 100, clientY: 0, identifier: 1 },
      ]),
    );
    // 指を広げる（距離が 100 -> 200）。value = previous/current = 0.5 (ズームイン方向)。
    target.dispatchEvent(
      touchEvent("touchmove", [
        { clientX: 0, clientY: 0, identifier: 0 },
        { clientX: 200, clientY: 0, identifier: 1 },
      ]),
    );

    expect(emit).toHaveBeenCalledWith({ kind: "zoom", mode: "scale", value: 0.5 });
  });

  it("does not emit on the third finger touching down (reset tracking state)", () => {
    const target = document.createElement("div");
    const emit = vi.fn<(intent: InputIntent) => void>();
    const source = new TouchInputSource();

    source.attach(target, emit);
    target.dispatchEvent(touchEvent("touchstart", [{ clientX: 0, clientY: 0, identifier: 0 }]));
    target.dispatchEvent(
      touchEvent("touchmove", [
        { clientX: 0, clientY: 0, identifier: 0 },
        { clientX: 10, clientY: 0, identifier: 1 },
        { clientX: 20, clientY: 0, identifier: 2 },
      ]),
    );

    expect(emit).not.toHaveBeenCalled();
  });

  it("calls preventDefault on touchmove to avoid native scroll/zoom gestures (Q8)", () => {
    const target = document.createElement("div");
    const source = new TouchInputSource();

    source.attach(target, vi.fn());
    const event = touchEvent("touchmove", [{ clientX: 0, clientY: 0, identifier: 0 }]);
    target.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("sets touch-action: none on attach and restores it on detach (Q8)", () => {
    const target = document.createElement("div");
    const source = new TouchInputSource();

    source.attach(target, vi.fn());
    expect(target.style.touchAction).toBe("none");

    source.detach();
    expect(target.style.touchAction).toBe("");
  });

  it("stops emitting after detach", () => {
    const target = document.createElement("div");
    const emit = vi.fn<(intent: InputIntent) => void>();
    const source = new TouchInputSource();

    source.attach(target, emit);
    source.detach();
    target.dispatchEvent(touchEvent("touchstart", [{ clientX: 0, clientY: 0, identifier: 0 }]));
    target.dispatchEvent(touchEvent("touchmove", [{ clientX: 10, clientY: 10, identifier: 0 }]));

    expect(emit).not.toHaveBeenCalled();
  });
});
