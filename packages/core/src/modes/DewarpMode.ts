import { MathUtils, ShaderMaterial } from "three";

import type { ModeContext } from "../viewer/ModeContext.js";
import type { ViewerMode } from "../viewer/ViewerMode.js";
import type { ViewState, ZoomLimits } from "../viewer/types.js";

const DEFAULT_VIEW: ViewState = { yaw: 0, pitch: 0, fov: 140 };
const DEFAULT_ZOOM_LIMITS: ZoomLimits = { minFov: 90, maxFov: 160 };

// GLSL 側は modes/projections/equidistant.ts の equidistantRadius と同じ数式を手動移植したもの
// （NFR Requirements Q1）。r = theta / (uFov / 2)。
const VERTEX_SHADER = /* glsl */ `
  uniform float uFov;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
    vec3 dir = normalize(viewPos.xyz);
    float theta = acos(clamp(-dir.z, -1.0, 1.0));
    float phi = atan(dir.y, dir.x);
    float r = theta / (uFov / 2.0);
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
 * 等距離図法（Equidistant）による広視野・低歪み投影モード（domain-entities.md E5、BR-C-06）。
 * `ShaderMaterial` はコンストラクタで1回だけ構築しキャッシュする（NFR Requirements Q3）。
 */
export class DewarpMode implements ViewerMode {
  readonly id = "dewarp";
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
    // BR-C-09: ShaderMaterial 自体は破棄しない（Viewer 全体の dispose 時にのみ破棄）。既定マテリアルへ戻す。
    ctx.setSphereMaterial(null);
  }

  disposeResources(): void {
    this.material.dispose();
  }
}
