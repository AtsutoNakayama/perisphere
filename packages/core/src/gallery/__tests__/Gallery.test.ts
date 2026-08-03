import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { Gallery, normalizePhotoInput } from "../Gallery.js";
import type { PhotoInput } from "../types.js";

describe("Gallery — empty list (BR-E-04)", () => {
  it("next/prev/goTo all report 'empty' before setPhotos is called", () => {
    const gallery = new Gallery();

    expect(gallery.next()).toEqual({ status: "empty" });
    expect(gallery.prev()).toEqual({ status: "empty" });
    expect(gallery.goTo(0)).toEqual({ status: "empty" });
    expect(gallery.current).toBe(-1);
  });

  it("next/prev/goTo all report 'empty' after setPhotos([])", () => {
    const gallery = new Gallery();
    gallery.setPhotos(["a.jpg", "b.jpg"]);

    gallery.setPhotos([]);

    expect(gallery.next()).toEqual({ status: "empty" });
    expect(gallery.current).toBe(-1);
  });
});

describe("Gallery — single photo (BR-E-03)", () => {
  it("next() and prev() both stay on index 0", () => {
    const gallery = new Gallery();
    gallery.setPhotos(["only.jpg"]);

    expect(gallery.next()).toEqual({ status: "moved", index: 0 });
    expect(gallery.prev()).toEqual({ status: "moved", index: 0 });
  });
});

describe("Gallery — setPhotos (BR-E-02)", () => {
  it("resets current to 0 for a non-empty list", () => {
    const gallery = new Gallery();
    gallery.setPhotos(["a.jpg", "b.jpg"]);
    expect(gallery.current).toBe(0);
  });

  it("resets current to -1 for an empty list", () => {
    const gallery = new Gallery();
    gallery.setPhotos([]);
    expect(gallery.current).toBe(-1);
  });
});

describe("Gallery — goTo out-of-range (BR-E-05)", () => {
  it.each([-1, 3, 3.5, NaN, Infinity])(
    "reports 'out-of-range' for %s without changing current",
    (index) => {
      const gallery = new Gallery();
      gallery.setPhotos(["a.jpg", "b.jpg", "c.jpg"]);
      gallery.next(); // current === 1

      expect(gallery.goTo(index)).toEqual({ status: "out-of-range" });
      expect(gallery.current).toBe(1);
    },
  );

  it("moves to a valid index", () => {
    const gallery = new Gallery();
    gallery.setPhotos(["a.jpg", "b.jpg", "c.jpg"]);

    expect(gallery.goTo(2)).toEqual({ status: "moved", index: 2 });
    expect(gallery.current).toBe(2);
  });
});

describe("Gallery — PBT invariants (tech-stack-decisions.md §3)", () => {
  type Op = { kind: "next" } | { kind: "prev" } | { kind: "goTo"; index: number };

  const opArb = fc.oneof(
    fc.constant<Op>({ kind: "next" }),
    fc.constant<Op>({ kind: "prev" }),
    fc.integer({ min: -3, max: 6 }).map((index): Op => ({ kind: "goTo", index })),
  );

  it("PBT: current always stays within [-1, size) for any sequence of operations", () => {
    fc.assert(
      fc.property(fc.nat({ max: 5 }), fc.array(opArb, { maxLength: 20 }), (size, ops) => {
        const gallery = new Gallery();
        gallery.setPhotos(Array.from({ length: size }, (_, i) => `${i}.jpg`));

        for (const op of ops) {
          if (op.kind === "next") gallery.next();
          else if (op.kind === "prev") gallery.prev();
          else gallery.goTo(op.index);

          if (size === 0) {
            expect(gallery.current).toBe(-1);
          } else {
            expect(gallery.current).toBeGreaterThanOrEqual(0);
            expect(gallery.current).toBeLessThan(size);
          }
        }
      }),
    );
  });

  it("PBT: next()/prev() cycles close after `size` repeated calls", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 8 }), fc.boolean(), (size, forward) => {
        const gallery = new Gallery();
        gallery.setPhotos(Array.from({ length: size }, (_, i) => `${i}.jpg`));
        const start = gallery.current;

        for (let i = 0; i < size; i++) {
          if (forward) gallery.next();
          else gallery.prev();
        }

        expect(gallery.current).toBe(start);
      }),
    );
  });

  it("PBT: goTo(index) reports 'moved' iff index is an integer within [0, size)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: -3, max: 8 }),
        (size, index) => {
          const gallery = new Gallery();
          gallery.setPhotos(Array.from({ length: size }, (_, i) => `${i}.jpg`));

          const result = gallery.goTo(index);
          const withinRange = Number.isInteger(index) && index >= 0 && index < size;

          expect(result.status).toBe(withinRange ? "moved" : "out-of-range");
        },
      ),
    );
  });
});

describe("normalizePhotoInput (BR-E-01)", () => {
  it("wraps a raw string ImageInput with no id", () => {
    expect(normalizePhotoInput("a.jpg")).toEqual({ src: "a.jpg" });
  });

  it("wraps a raw Blob ImageInput with no id", () => {
    const blob = new Blob();
    expect(normalizePhotoInput(blob)).toEqual({ src: blob });
  });

  it("passes an object PhotoInput through unchanged", () => {
    const photo: PhotoInput = { src: "a.jpg", id: "photo-a" };
    expect(normalizePhotoInput(photo)).toEqual(photo);
  });
});
