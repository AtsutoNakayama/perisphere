import { describe, expect, it, vi } from "vitest";

import { KeyboardInputSource } from "../KeyboardInputSource.js";
import type { InputIntent } from "../types.js";

function keydown(key: string): KeyboardEvent {
  return new KeyboardEvent("keydown", { key, cancelable: true, bubbles: true });
}

describe("KeyboardInputSource", () => {
  it("attach() sets tabindex=0 on the container so it can receive keyboard focus (Q8)", () => {
    const target = document.createElement("div");
    const source = new KeyboardInputSource();

    source.attach(target, vi.fn());

    expect(target.getAttribute("tabindex")).toBe("0");
  });

  it("does not override an existing tabindex", () => {
    const target = document.createElement("div");
    target.setAttribute("tabindex", "-1");
    const source = new KeyboardInputSource();

    source.attach(target, vi.fn());

    expect(target.getAttribute("tabindex")).toBe("-1");
  });

  it.each([
    ["ArrowLeft", { kind: "pan", deltaPx: 20 }],
    ["ArrowRight", { kind: "pan", deltaPx: -20 }],
    ["ArrowUp", { kind: "tilt", deltaPx: 20 }],
    ["ArrowDown", { kind: "tilt", deltaPx: -20 }],
    ["+", { kind: "zoom", mode: "delta", value: -100 }],
    ["-", { kind: "zoom", mode: "delta", value: 100 }],
    ["PageUp", { kind: "photoPrev" }],
    ["PageDown", { kind: "photoNext" }],
    ["f", { kind: "toggleFullscreen" }],
  ])("emits the intent for default key '%s' (US-17)", (key, expected) => {
    const target = document.createElement("div");
    const emit = vi.fn<(intent: InputIntent) => void>();
    const source = new KeyboardInputSource();
    source.attach(target, emit);

    target.dispatchEvent(keydown(key));

    expect(emit).toHaveBeenCalledWith(expected);
  });

  it("ignores keys that are not part of the keymap", () => {
    const target = document.createElement("div");
    const emit = vi.fn<(intent: InputIntent) => void>();
    const source = new KeyboardInputSource();
    source.attach(target, emit);

    target.dispatchEvent(keydown("q"));

    expect(emit).not.toHaveBeenCalled();
  });

  it("calls preventDefault only for recognized keys (Q8)", () => {
    const target = document.createElement("div");
    const source = new KeyboardInputSource();
    source.attach(target, vi.fn());

    const recognized = keydown("ArrowLeft");
    target.dispatchEvent(recognized);
    expect(recognized.defaultPrevented).toBe(true);

    const unrecognized = keydown("q");
    target.dispatchEvent(unrecognized);
    expect(unrecognized.defaultPrevented).toBe(false);
  });

  describe("setKeymap (US-19)", () => {
    it("a Partial<Keymap> overrides only the specified action, default keys keep working for others", () => {
      const target = document.createElement("div");
      const emit = vi.fn<(intent: InputIntent) => void>();
      const source = new KeyboardInputSource();
      source.attach(target, emit);

      source.setKeymap({ panLeft: ["a"] });
      target.dispatchEvent(keydown("a"));
      expect(emit).toHaveBeenCalledWith({ kind: "pan", deltaPx: 20 });

      emit.mockClear();
      target.dispatchEvent(keydown("ArrowLeft"));
      expect(emit).not.toHaveBeenCalled(); // 上書きされたため既定キーはもう効かない

      emit.mockClear();
      target.dispatchEvent(keydown("ArrowUp"));
      expect(emit).toHaveBeenCalledWith({ kind: "tilt", deltaPx: 20 }); // 他のアクションは既定のまま
    });

    it("an empty array for an action disables just that action", () => {
      const target = document.createElement("div");
      const emit = vi.fn<(intent: InputIntent) => void>();
      const source = new KeyboardInputSource();
      source.attach(target, emit);

      source.setKeymap({ toggleFullscreen: [] });
      target.dispatchEvent(keydown("f"));

      expect(emit).not.toHaveBeenCalled();
    });

    it("null disables all keyboard intents", () => {
      const target = document.createElement("div");
      const emit = vi.fn<(intent: InputIntent) => void>();
      const source = new KeyboardInputSource();
      source.attach(target, emit);

      source.setKeymap(null);
      target.dispatchEvent(keydown("ArrowLeft"));
      target.dispatchEvent(keydown("f"));

      expect(emit).not.toHaveBeenCalled();
    });

    it("each call re-merges onto the default keymap, not the previous call's result (BR-D domain E7)", () => {
      const target = document.createElement("div");
      const emit = vi.fn<(intent: InputIntent) => void>();
      const source = new KeyboardInputSource();
      source.attach(target, emit);

      source.setKeymap({ panLeft: ["a"] });
      source.setKeymap({ tiltUp: ["w"] }); // 既定へ再マージするため、前回の panLeft:["a"] は失われる

      target.dispatchEvent(keydown("a"));
      expect(emit).not.toHaveBeenCalled();

      target.dispatchEvent(keydown("ArrowLeft"));
      expect(emit).toHaveBeenCalledWith({ kind: "pan", deltaPx: 20 }); // 既定キーへ戻っている

      emit.mockClear();
      target.dispatchEvent(keydown("w"));
      expect(emit).toHaveBeenCalledWith({ kind: "tilt", deltaPx: 20 });
    });
  });

  it("detach() stops forwarding subsequent keydown events", () => {
    const target = document.createElement("div");
    const emit = vi.fn<(intent: InputIntent) => void>();
    const source = new KeyboardInputSource();
    source.attach(target, emit);

    source.detach();
    target.dispatchEvent(keydown("ArrowLeft"));

    expect(emit).not.toHaveBeenCalled();
  });
});
