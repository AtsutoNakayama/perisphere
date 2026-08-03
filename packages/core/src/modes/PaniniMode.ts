import { MathUtils, ShaderMaterial } from "three";

import type { ModeContext } from "../viewer/ModeContext.js";
import type { ViewerMode } from "../viewer/ViewerMode.js";
import type { ViewState, ZoomLimits } from "../viewer/types.js";

const DEFAULT_VIEW: ViewState = { yaw: 0, pitch: 0, fov: 120 };
const DEFAULT_ZOOM_LIMITS: ZoomLimits = { minFov: 80, maxFov: 150 };

// GLSL 側は modes/projections/panini.ts の paniniProject と同じ数式（d=1 の "true Panini"）を
// 手動移植したもの（NFR Requirements Q1）。
const VERTEX_SHADER = /* glsl */ `
  uniform float uFov;
  varying vec2 vUv;
  const float PANINI_D = 1.0;

  void main() {
    vUv = uv;
    vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
    vec3 dir = normalize(viewPos.xyz);

    float thetaH = atan(dir.x, -dir.z);
    float hypotXZ = length(vec2(dir.x, dir.z));
    float dyOverHypot = dir.y / max(hypotXZ, 1e-6);

    float s = (PANINI_D + 1.0) / (PANINI_D + cos(thetaH));
    float x = s * sin(thetaH);
    float y = s * dyOverHypot;

    float edgeThetaH = uFov / 2.0;
    float edgeS = (PANINI_D + 1.0) / (PANINI_D + cos(edgeThetaH));
    float scale = 1.0 / (edgeS * sin(edgeThetaH));

    gl_Position = vec4(x * scale, y * scale, 0.0, 1.0);
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
 * Panini 図法の近似式による広視野・垂直線保持投影モード（domain-entities.md E6、BR-C-06）。
 * `ShaderMaterial` はコンストラクタで1回だけ構築しキャッシュする（NFR Requirements Q3）。
 */
export class PaniniMode implements ViewerMode {
  readonly id = "panini";
  readonly defaultZoomLimits: ZoomLimits = DEFAULT_ZOOM_LIMITS;

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
