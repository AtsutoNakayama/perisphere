import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { paniniProject } from "../panini.js";

const FOV = Math.PI * (120 / 180); // PaniniMode の既定 FOV

describe("paniniProject", () => {
  it("returns x = 0 at the horizontal center (thetaH = 0)", () => {
    expect(paniniProject(0, 0, FOV).x).toBeCloseTo(0);
  });

  it("returns |x| = 1 at the horizontal edge (thetaH = fov / 2)", () => {
    expect(paniniProject(FOV / 2, 0, FOV).x).toBeCloseTo(1);
    expect(paniniProject(-FOV / 2, 0, FOV).x).toBeCloseTo(-1);
  });

  it("PBT: x is finite and monotonically increasing in thetaH within a safe range", () => {
    // d+cos(thetaH) が 0 に近づく特異点（thetaH → ±180°）を避けるため、実際のモードが
    // 使う範囲（FOV 最大 150°、edge=75°）より十分内側（±80°）に制限する。
    const safeAngle = Math.fround((80 * Math.PI) / 180);
    fc.assert(
      fc.property(
        fc.float({ min: -safeAngle, max: safeAngle, noNaN: true }),
        fc.float({ min: -safeAngle, max: safeAngle, noNaN: true }),
        (a, b) => {
          const xa = paniniProject(a, 0, FOV).x;
          const xb = paniniProject(b, 0, FOV).x;
          expect(Number.isFinite(xa)).toBe(true);
          expect(Number.isFinite(xb)).toBe(true);
          if (a < b) expect(xa).toBeLessThanOrEqual(xb);
          if (a > b) expect(xa).toBeGreaterThanOrEqual(xb);
        },
      ),
    );
  });
});
