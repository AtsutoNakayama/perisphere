import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene } from "three";
import { describe, expect, it } from "vitest";

import type { ModeContext } from "../ModeContext.js";
import { StandardMode } from "../StandardMode.js";

function createModeContext(): ModeContext {
  return {
    camera: new PerspectiveCamera(),
    scene: new Scene(),
    sphereMesh: new Mesh(new BoxGeometry(), new MeshBasicMaterial()),
  };
}

describe("StandardMode", () => {
  it("has id 'standard'", () => {
    expect(new StandardMode().id).toBe("standard");
  });

  it("exposes the default zoom range 30..90 (BR-A-06)", () => {
    expect(new StandardMode().defaultZoomLimits).toEqual({ minFov: 30, maxFov: 90 });
  });

  it("apply() sets the default view yaw=0, pitch=0, fov=75 (BR-A-06)", () => {
    const mode = new StandardMode();
    const ctx = createModeContext();

    mode.apply(ctx);

    expect(ctx.camera.fov).toBe(75);
    expect(ctx.camera.rotation.x).toBeCloseTo(0);
    expect(ctx.camera.rotation.y).toBeCloseTo(0);
  });

  it("updateView() applies the given yaw/pitch/fov to the camera", () => {
    const mode = new StandardMode();
    const ctx = createModeContext();

    mode.updateView(ctx, { yaw: 90, pitch: 45, fov: 60 });

    expect(ctx.camera.fov).toBe(60);
    expect(ctx.camera.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(ctx.camera.rotation.x).toBeCloseTo(Math.PI / 4);
  });

  it("dispose() does not throw", () => {
    const mode = new StandardMode();
    const ctx = createModeContext();

    expect(() => mode.dispose(ctx)).not.toThrow();
  });
});
