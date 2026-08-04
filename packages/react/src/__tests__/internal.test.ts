import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  EVENT_PROP_NAMES,
  extractViewerOptions,
  resolveInitialSource,
  toCallbackPayload,
} from "../internal.js";
import type { PerisphereProps } from "../types.js";

describe("resolveInitialSource — PBT invariants (BR-H-05, tech-stack-decisions.md §4)", () => {
  it("PBT: photos, when defined, always wins regardless of image", () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(fc.webUrl(), fc.record({ src: fc.webUrl() }))),
        fc.option(
          fc.oneof(
            fc.webUrl(),
            fc.uint8Array().map((bytes) => new Blob([bytes])),
          ),
          {
            nil: undefined,
          },
        ),
        (photos, image) => {
          const result = resolveInitialSource(image, photos);
          expect(result).toEqual({ kind: "photos", value: photos });
        },
      ),
    );
  });

  it("PBT: image is used only when photos is undefined", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.webUrl(),
          fc.uint8Array().map((bytes) => new Blob([bytes])),
        ),
        (image) => {
          const result = resolveInitialSource(image, undefined);
          expect(result).toEqual({ kind: "image", value: image });
        },
      ),
    );
  });

  it("both undefined resolves to none", () => {
    expect(resolveInitialSource(undefined, undefined)).toEqual({ kind: "none" });
  });
});

describe("extractViewerOptions — PBT invariants (BR-H-08, tech-stack-decisions.md §4)", () => {
  const knownKeys = [
    "image",
    "photos",
    "mode",
    "className",
    "style",
    "onReady",
    "onError",
    "onProgress",
    "onModeChange",
    "onViewChange",
    "onZoomChange",
    "onPhotoChange",
    "onFullscreenChange",
  ] as const;

  it("PBT: known props are never present in the result", () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string({ minLength: 1 }), fc.jsonValue()), (extra) => {
        const props: PerisphereProps = {
          ...extra,
          image: "https://example.com/a.jpg",
          photos: [],
          mode: "standard",
          className: "foo",
          onReady: () => {},
        };
        const result = extractViewerOptions(props);
        for (const key of knownKeys) {
          expect(Object.prototype.hasOwnProperty.call(result, key)).toBe(false);
        }
      }),
    );
  });

  it("PBT: unknown keys (including controls/text) are preserved as-is", () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc
            .string({ minLength: 1 })
            .filter((key) => !(knownKeys as readonly string[]).includes(key)),
          fc.jsonValue(),
        ),
        (extra) => {
          const props = { ...extra, image: "https://example.com/a.jpg" } as PerisphereProps;
          const result = extractViewerOptions(props);
          for (const [key, value] of Object.entries(extra)) {
            expect(result[key]).toEqual(value);
          }
        },
      ),
    );
  });
});

describe("toCallbackPayload — PBT invariants (BR-H-10, tech-stack-decisions.md §4)", () => {
  it("ready resolves to undefined", () => {
    expect(toCallbackPayload({ type: "ready" })).toBeUndefined();
  });

  it("error resolves to the unwrapped PerisphereError", () => {
    const error = { code: "IMAGE_LOAD_FAILED", message: "failed" } as const;
    expect(toCallbackPayload({ type: "error", error })).toBe(error);
  });

  it("PBT: all other event types strip the type field only", () => {
    fc.assert(
      fc.property(
        fc.record({
          loaded: fc.nat(),
          total: fc.nat(),
        }),
        (rest) => {
          const event = { type: "progress" as const, ...rest };
          const result = toCallbackPayload(event) as Record<string, unknown>;
          expect(result).not.toHaveProperty("type");
          expect(result.loaded).toBe(rest.loaded);
        },
      ),
    );
  });
});

describe("EVENT_PROP_NAMES", () => {
  it("covers all 8 ViewerEventMap keys with a distinct onXxx name", () => {
    const names = Object.values(EVENT_PROP_NAMES);
    expect(new Set(names).size).toBe(names.length);
    expect(Object.keys(EVENT_PROP_NAMES).sort()).toEqual(
      [
        "ready",
        "error",
        "progress",
        "modechange",
        "viewchange",
        "zoomchange",
        "photochange",
        "fullscreenchange",
      ].sort(),
    );
  });
});
