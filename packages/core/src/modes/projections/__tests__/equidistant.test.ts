import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { equidistantRadius } from "../equidistant.js";

const FOV = Math.PI * (140 / 180);

describe("equidistantRadius", () => {
  it("returns 0 at the center (theta = 0)", () => {
    expect(equidistantRadius(0, FOV)).toBe(0);
  });

  it("returns 1 at the edge (theta = fov / 2)", () => {
    expect(equidistantRadius(FOV / 2, FOV)).toBeCloseTo(1);
  });

  it("PBT: is finite and monotonically increasing over the valid angle range", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: Math.fround(Math.PI), noNaN: true }),
        fc.float({ min: 0, max: Math.fround(Math.PI), noNaN: true }),
        fc.float({ min: Math.fround(0.1), max: Math.fround(Math.PI * 1.5), noNaN: true }),
        (a, b, fov) => {
          const ra = equidistantRadius(a, fov);
          const rb = equidistantRadius(b, fov);
          expect(Number.isFinite(ra)).toBe(true);
          expect(Number.isFinite(rb)).toBe(true);
          if (a < b) expect(ra).toBeLessThanOrEqual(rb);
          if (a > b) expect(ra).toBeGreaterThanOrEqual(rb);
        },
      ),
    );
  });
});
