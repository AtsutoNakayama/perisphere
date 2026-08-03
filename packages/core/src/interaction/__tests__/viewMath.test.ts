import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  applyPanDelta,
  applyTiltDelta,
  applyZoomAdd,
  applyZoomScale,
  clampFov,
  clampPitch,
  DEFAULT_KEYMAP,
  mergeKeymap,
  normalizeYaw,
} from "../viewMath.js";
import type { Keymap } from "../types.js";

const LIMITS = { minFov: 30, maxFov: 90 };

describe("normalizeYaw (BR-D-04)", () => {
  it("keeps values already within (-180, 180] unchanged", () => {
    expect(normalizeYaw(0)).toBe(0);
    expect(normalizeYaw(179)).toBe(179);
    expect(normalizeYaw(180)).toBe(180);
    expect(normalizeYaw(-179)).toBe(-179);
  });

  it("wraps values outside the range", () => {
    expect(normalizeYaw(181)).toBeCloseTo(-179);
    expect(normalizeYaw(-181)).toBeCloseTo(179);
    expect(normalizeYaw(360)).toBeCloseTo(0);
    expect(normalizeYaw(-360)).toBeCloseTo(0);
  });

  it("PBT: always returns a value in (-180, 180] regardless of magnitude", () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(-10000), max: Math.fround(10000), noNaN: true }),
        (yaw) => {
          const result = normalizeYaw(yaw);
          expect(result).toBeGreaterThan(-180);
          expect(result).toBeLessThanOrEqual(180);
        },
      ),
    );
  });

  it("PBT: an arbitrary sequence of pan applications keeps yaw normalized (BR-D-04)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: Math.fround(-500), max: Math.fround(500), noNaN: true }), {
          minLength: 0,
          maxLength: 50,
        }),
        (deltas) => {
          let yaw = 0;
          for (const deltaPx of deltas) {
            yaw = applyPanDelta(yaw, deltaPx, 75);
          }
          expect(yaw).toBeGreaterThan(-180);
          expect(yaw).toBeLessThanOrEqual(180);
        },
      ),
    );
  });
});

describe("clampPitch (BR-D-05)", () => {
  it("clamps to [-90, 90]", () => {
    expect(clampPitch(100)).toBe(90);
    expect(clampPitch(-100)).toBe(-90);
    expect(clampPitch(45)).toBe(45);
  });

  it("PBT: an arbitrary sequence of tilt applications keeps pitch within [-90, 90]", () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: Math.fround(-500), max: Math.fround(500), noNaN: true }), {
          minLength: 0,
          maxLength: 50,
        }),
        (deltas) => {
          let pitch = 0;
          for (const deltaPx of deltas) {
            pitch = applyTiltDelta(pitch, deltaPx, 75);
          }
          expect(pitch).toBeGreaterThanOrEqual(-90);
          expect(pitch).toBeLessThanOrEqual(90);
        },
      ),
    );
  });
});

describe("clampFov (BR-D-09)", () => {
  it("clamps to the given limits", () => {
    expect(clampFov(10, LIMITS)).toBe(30);
    expect(clampFov(200, LIMITS)).toBe(90);
    expect(clampFov(60, LIMITS)).toBe(60);
  });

  it("PBT: an arbitrary sequence of additive/multiplicative zoom applications keeps fov within limits", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.record({
              kind: fc.constant("add" as const),
              value: fc.float({ min: Math.fround(-2000), max: Math.fround(2000), noNaN: true }),
            }),
            fc.record({
              kind: fc.constant("scale" as const),
              value: fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
            }),
          ),
          { minLength: 0, maxLength: 50 },
        ),
        (ops) => {
          let fov = 60;
          for (const op of ops) {
            const raw =
              op.kind === "add" ? applyZoomAdd(fov, op.value) : applyZoomScale(fov, op.value);
            fov = clampFov(raw, LIMITS);
          }
          expect(fov).toBeGreaterThanOrEqual(LIMITS.minFov);
          expect(fov).toBeLessThanOrEqual(LIMITS.maxFov);
        },
      ),
    );
  });
});

describe("mergeKeymap (US-19)", () => {
  it("keeps unspecified actions at their default and overrides only the specified ones", () => {
    const merged = mergeKeymap(DEFAULT_KEYMAP, { panLeft: ["a"] });

    expect(merged.panLeft).toEqual(["a"]);
    expect(merged.panRight).toEqual(DEFAULT_KEYMAP.panRight);
    expect(merged.tiltUp).toEqual(DEFAULT_KEYMAP.tiltUp);
  });

  it("an empty array disables a single action without affecting others", () => {
    const merged = mergeKeymap(DEFAULT_KEYMAP, { toggleFullscreen: [] });

    expect(merged.toggleFullscreen).toEqual([]);
    expect(merged.zoomIn).toEqual(DEFAULT_KEYMAP.zoomIn);
  });

  it("PBT: every action in the merged result is either the override or the default", () => {
    const actionArb = fc.constantFrom<keyof Keymap>(
      "panLeft",
      "panRight",
      "tiltUp",
      "tiltDown",
      "zoomIn",
      "zoomOut",
      "photoPrev",
      "photoNext",
      "toggleFullscreen",
    );

    fc.assert(
      fc.property(
        fc.dictionary(actionArb, fc.array(fc.string(), { maxLength: 3 }), { maxKeys: 9 }),
        (partial) => {
          const merged = mergeKeymap(DEFAULT_KEYMAP, partial as Partial<Keymap>);
          for (const action of Object.keys(DEFAULT_KEYMAP) as (keyof Keymap)[]) {
            const expected = Object.prototype.hasOwnProperty.call(partial, action)
              ? partial[action]
              : DEFAULT_KEYMAP[action];
            expect(merged[action]).toEqual(expected);
          }
        },
      ),
    );
  });
});
