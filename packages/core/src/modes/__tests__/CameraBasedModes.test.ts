import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene } from "three";
import { describe, expect, it } from "vitest";

import { LinearMode } from "../LinearMode.js";
import { UltraWideMode } from "../UltraWideMode.js";
import type { ModeContext } from "../../viewer/ModeContext.js";
import type { ViewerMode } from "../../viewer/ViewerMode.js";

function createModeContext(): ModeContext {
  return {
    camera: new PerspectiveCamera(),
    scene: new Scene(),
    sphereMesh: new Mesh(new BoxGeometry(), new MeshBasicMaterial()),
    texture: null,
    setSphereMaterial: () => {},
  };
}

describe.each([
  {
    name: "UltraWideMode",
    Mode: UltraWideMode,
    id: "ultraWide",
    fov: 100,
    zoom: { minFov: 60, maxFov: 120 },
  },
  { name: "LinearMode", Mode: LinearMode, id: "linear", fov: 50, zoom: { minFov: 20, maxFov: 70 } },
])("$name (BR-C-05)", ({ Mode, id, fov, zoom }) => {
  it(`has id '${id}'`, () => {
    expect(new (Mode as new () => ViewerMode)().id).toBe(id);
  });

  it("exposes the documented default zoom range", () => {
    expect(new (Mode as new () => ViewerMode)().defaultZoomLimits).toEqual(zoom);
  });

  it(`exposes defaultView matching fov=${fov}, yaw=0, pitch=0 (UoW-D, domain-entities.md E10)`, () => {
    expect(new (Mode as new () => ViewerMode)().defaultView).toEqual({ yaw: 0, pitch: 0, fov });
  });

  it(`apply() sets the default fov=${fov}, yaw=0, pitch=0`, () => {
    const mode = new (Mode as new () => ViewerMode)();
    const ctx = createModeContext();

    mode.apply(ctx);

    expect(ctx.camera.fov).toBe(fov);
    expect(ctx.camera.rotation.x).toBeCloseTo(0);
    expect(ctx.camera.rotation.y).toBeCloseTo(0);
  });

  it("updateView() applies the given yaw/pitch/fov to the camera", () => {
    const mode = new (Mode as new () => ViewerMode)();
    const ctx = createModeContext();

    mode.updateView(ctx, { yaw: 90, pitch: 45, fov: 60 });

    expect(ctx.camera.fov).toBe(60);
    expect(ctx.camera.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(ctx.camera.rotation.x).toBeCloseTo(Math.PI / 4);
  });

  it("dispose() does not throw", () => {
    const mode = new (Mode as new () => ViewerMode)();
    const ctx = createModeContext();

    expect(() => mode.dispose(ctx)).not.toThrow();
  });
});
