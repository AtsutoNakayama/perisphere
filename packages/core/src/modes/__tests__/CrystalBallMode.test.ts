import {
  BackSide,
  FrontSide,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
} from "three";
import { describe, expect, it } from "vitest";

import { CrystalBallMode } from "../CrystalBallMode.js";
import type { ModeContext } from "../../viewer/ModeContext.js";

const RADIUS = 500;

function createModeContext(): ModeContext {
  return {
    camera: new PerspectiveCamera(),
    scene: new Scene(),
    sphereMesh: new Mesh(
      new SphereGeometry(RADIUS, 8, 8),
      new MeshBasicMaterial({ side: BackSide }),
    ),
    texture: null,
    setSphereMaterial: () => {},
  };
}

describe("CrystalBallMode (BR-C-07/11)", () => {
  it("has id 'crystalBall' and the documented default zoom range", () => {
    const mode = new CrystalBallMode();
    expect(mode.id).toBe("crystalBall");
    expect(mode.defaultZoomLimits).toEqual({ minFov: 30, maxFov: 90 });
  });

  it("apply() moves the camera outside the sphere and flips the material to FrontSide", () => {
    const mode = new CrystalBallMode();
    const ctx = createModeContext();

    mode.apply(ctx);

    expect(ctx.camera.position.z).toBeCloseTo(RADIUS * 2.5);
    expect(ctx.sphereMesh.material.side).toBe(FrontSide);
    expect(ctx.camera.fov).toBe(75);
  });

  it("dispose() restores BackSide and resets the camera position to the origin", () => {
    const mode = new CrystalBallMode();
    const ctx = createModeContext();
    mode.apply(ctx);

    mode.dispose(ctx);

    expect(ctx.sphereMesh.material.side).toBe(BackSide);
    expect(ctx.camera.position.x).toBe(0);
    expect(ctx.camera.position.y).toBe(0);
    expect(ctx.camera.position.z).toBe(0);
  });

  it("updateView() rotates the camera without moving its position", () => {
    const mode = new CrystalBallMode();
    const ctx = createModeContext();
    mode.apply(ctx);
    const positionAfterApply = ctx.camera.position.clone();

    mode.updateView(ctx, { yaw: 45, pitch: 10, fov: 80 });

    expect(ctx.camera.position.equals(positionAfterApply)).toBe(true);
    expect(ctx.camera.fov).toBe(80);
  });
});
