import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
} from "three";
import { describe, expect, it, vi } from "vitest";

import { DewarpMode } from "../DewarpMode.js";
import { PaniniMode } from "../PaniniMode.js";
import { TinyPlanetMode } from "../TinyPlanetMode.js";
import type { ModeContext } from "../../viewer/ModeContext.js";
import type { ViewerMode } from "../../viewer/ViewerMode.js";

function createModeContext(): ModeContext & { setSphereMaterial: ReturnType<typeof vi.fn> } {
  return {
    camera: new PerspectiveCamera(),
    scene: new Scene(),
    sphereMesh: new Mesh(new BoxGeometry(), new MeshBasicMaterial()),
    texture: null,
    setSphereMaterial: vi.fn(),
  };
}

describe.each([
  {
    name: "DewarpMode",
    Mode: DewarpMode,
    id: "dewarp",
    fov: 140,
    zoom: { minFov: 90, maxFov: 160 },
  },
  {
    name: "PaniniMode",
    Mode: PaniniMode,
    id: "panini",
    fov: 120,
    zoom: { minFov: 80, maxFov: 150 },
  },
  {
    name: "TinyPlanetMode",
    Mode: TinyPlanetMode,
    id: "tinyPlanet",
    fov: 160,
    zoom: { minFov: 100, maxFov: 180 },
  },
])("$name (BR-C-06/08/09)", ({ Mode, id, fov, zoom }) => {
  type ModeCtor = new () => ViewerMode & { disposeResources?: () => void };

  it(`has id '${id}' and the documented default zoom range`, () => {
    const mode = new (Mode as ModeCtor)();
    expect(mode.id).toBe(id);
    expect(mode.defaultZoomLimits).toEqual(zoom);
  });

  it(`apply() installs a ShaderMaterial via ctx.setSphereMaterial and sets fov=${fov} as the uFov uniform`, () => {
    const mode = new (Mode as ModeCtor)();
    const ctx = createModeContext();

    mode.apply(ctx);

    expect(ctx.setSphereMaterial).toHaveBeenCalledTimes(1);
    const installed = ctx.setSphereMaterial.mock.calls[0]?.[0];
    expect(installed).toBeInstanceOf(ShaderMaterial);
    expect((installed as ShaderMaterial).uniforms.uFov?.value).toBeCloseTo((fov * Math.PI) / 180);
  });

  it("apply() reuses the same ShaderMaterial instance across multiple calls (caching, NFR Requirements Q3)", () => {
    const mode = new (Mode as ModeCtor)();
    const ctx1 = createModeContext();
    const ctx2 = createModeContext();

    mode.apply(ctx1);
    mode.apply(ctx2);

    expect(ctx1.setSphereMaterial.mock.calls[0]?.[0]).toBe(
      ctx2.setSphereMaterial.mock.calls[0]?.[0],
    );
  });

  it("updateView() sets camera rotation and updates the uFov uniform", () => {
    const mode = new (Mode as ModeCtor)();
    const ctx = createModeContext();
    mode.apply(ctx);
    const material = ctx.setSphereMaterial.mock.calls[0]?.[0] as ShaderMaterial;

    mode.updateView(ctx, { yaw: 90, pitch: 45, fov: 130 });

    expect(ctx.camera.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(ctx.camera.rotation.x).toBeCloseTo(Math.PI / 4);
    expect(material.uniforms.uFov?.value).toBeCloseTo((130 * Math.PI) / 180);
  });

  it("dispose() restores the default material via ctx.setSphereMaterial(null) (BR-C-09)", () => {
    const mode = new (Mode as ModeCtor)();
    const ctx = createModeContext();
    mode.apply(ctx);

    mode.dispose(ctx);

    expect(ctx.setSphereMaterial).toHaveBeenLastCalledWith(null);
  });

  it("disposeResources() disposes the cached ShaderMaterial", () => {
    const mode = new (Mode as ModeCtor)();
    const ctx = createModeContext();
    mode.apply(ctx);
    const material = ctx.setSphereMaterial.mock.calls[0]?.[0] as ShaderMaterial;
    const disposeSpy = vi.spyOn(material, "dispose");

    mode.disposeResources?.();

    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });
});
