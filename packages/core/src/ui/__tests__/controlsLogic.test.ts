import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { computeEffectiveVisibility, resolveText } from "../controlsLogic.js";
import type { ControlsVisibility } from "../types.js";

const visibilityArb: fc.Arbitrary<ControlsVisibility> = fc.record(
  {
    fullscreen: fc.boolean(),
    zoom: fc.boolean(),
    modeSwitch: fc.boolean(),
    photoNav: fc.boolean(),
    photoIndicator: fc.boolean(),
  },
  { requiredKeys: [] },
);

describe("computeEffectiveVisibility — PBT invariants (BR-G-04/05, tech-stack-decisions.md §2)", () => {
  it("PBT: fullscreen/zoom always mirror the explicit value (default true when unspecified)", () => {
    fc.assert(
      fc.property(
        visibilityArb,
        fc.nat({ max: 10 }),
        fc.nat({ max: 10 }),
        (explicit, modeCount, photoCount) => {
          const result = computeEffectiveVisibility(explicit, modeCount, photoCount);
          expect(result.fullscreen).toBe(explicit.fullscreen ?? true);
          expect(result.zoom).toBe(explicit.zoom ?? true);
        },
      ),
    );
  });

  it("PBT: an explicit false always wins regardless of data availability", () => {
    fc.assert(
      fc.property(fc.nat({ max: 10 }), fc.nat({ max: 10 }), (modeCount, photoCount) => {
        const result = computeEffectiveVisibility(
          { modeSwitch: false, photoNav: false, photoIndicator: false },
          modeCount,
          photoCount,
        );
        expect(result.modeSwitch).toBe(false);
        expect(result.photoNav).toBe(false);
        expect(result.photoIndicator).toBe(false);
      }),
    );
  });

  it("PBT: when not explicitly false, modeSwitch/photoNav/photoIndicator match count > 1", () => {
    fc.assert(
      fc.property(
        visibilityArb,
        fc.nat({ max: 10 }),
        fc.nat({ max: 10 }),
        (explicit, modeCount, photoCount) => {
          const result = computeEffectiveVisibility(explicit, modeCount, photoCount);
          if (explicit.modeSwitch !== false) {
            expect(result.modeSwitch).toBe(modeCount > 1);
          }
          if (explicit.photoNav !== false) {
            expect(result.photoNav).toBe(photoCount > 1);
          }
          if (explicit.photoIndicator !== false) {
            expect(result.photoIndicator).toBe(photoCount > 1);
          }
        },
      ),
    );
  });
});

describe("resolveText — PBT invariants (BR-G-10, tech-stack-decisions.md §2)", () => {
  it("PBT: replaces every {current}/{total} occurrence, leaving no literal token behind", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999 }),
        fc.integer({ min: 0, max: 999 }),
        (current, total) => {
          const result = resolveText("Photo {current} of {total} ({current}/{total})", {
            current,
            total,
          });
          expect(result).not.toContain("{current}");
          expect(result).not.toContain("{total}");
          expect(result).toBe(`Photo ${current} of ${total} (${current}/${total})`);
        },
      ),
    );
  });

  it("leaves unknown tokens untouched", () => {
    expect(resolveText("{unknown} of {total}", { total: 3 })).toBe("{unknown} of 3");
  });

  it("returns the template unchanged when it has no tokens", () => {
    expect(resolveText("no tokens here", { current: 1, total: 2 })).toBe("no tokens here");
  });
});
