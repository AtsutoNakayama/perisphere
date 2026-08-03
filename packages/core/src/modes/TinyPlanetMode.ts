import { MathUtils, ShaderMaterial } from "three";

import type { ModeContext } from "../viewer/ModeContext.js";
import type { ViewerMode } from "../viewer/ViewerMode.js";
import type { ViewState, ZoomLimits } from "../viewer/types.js";

const DEFAULT_VIEW: ViewState = { yaw: 0, pitch: -90, fov: 160 };
const DEFAULT_ZOOM_LIMITS: ZoomLimits = { minFov: 100, maxFov: 180 };

// GLSL 側は modes/projections/stereographic.ts の stereographicRadius と同じ数式を手動移植したもの
// （NFR Requirements Q1）。r = tan(theta/2) / tan(uFov/4)。
const VERTEX_SHADER = /* glsl */ `
  uniform float uFov;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
    vec3 dir = normalize(viewPos.xyz);
    float theta = acos(clamp(-dir.z, -1.0, 1.0));
    float phi = atan(dir.y, dir.x);
    float r = tan(theta / 2.0) / tan(uFov / 4.0);
    gl_Position = vec4(r * cos(phi), r * sin(phi), 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D map;
  varying vec2 vUv;

  void main() {
    gl_FragColor = texture2D(map, vUv);
  }
`;

/**
 * ステレオ図法（Stereographic）による「小惑星」投影モード（domain-entities.md E7、BR-C-06）。
 * 既定 pitch=-90（真下方向）とし、球全体が惑星状に見える構図を既定とする（US-08）。
 * `ShaderMaterial` はコンストラクタで1回だけ構築しキャッシュする（NFR Requirements Q3）。
 */
export class TinyPlanetMode implements ViewerMode {
  readonly id = "tinyPlanet";
  readonly defaultZoomLimits: ZoomLimits = DEFAULT_ZOOM_LIMITS;
  readonly defaultView: ViewState = DEFAULT_VIEW;

  private readonly material = new ShaderMaterial({
    uniforms: { map: { value: null }, uFov: { value: MathUtils.degToRad(DEFAULT_VIEW.fov) } },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
  });

  apply(ctx: ModeContext): void {
    ctx.setSphereMaterial(this.material);
    this.updateView(ctx, DEFAULT_VIEW);
  }

  updateView(ctx: ModeContext, view: ViewState): void {
    ctx.camera.rotation.set(MathUtils.degToRad(view.pitch), MathUtils.degToRad(view.yaw), 0, "YXZ");
    this.material.uniforms.uFov!.value = MathUtils.degToRad(view.fov);
  }

  dispose(ctx: ModeContext): void {
    ctx.setSphereMaterial(null);
  }

  disposeResources(): void {
    this.material.dispose();
  }
}
