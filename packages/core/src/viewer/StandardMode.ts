import { MathUtils } from "three";

import type { ModeContext } from "./ModeContext.js";
import type { ViewerMode } from "./ViewerMode.js";
import type { ViewState, ZoomLimits } from "./types.js";

const DEFAULT_VIEW: ViewState = { yaw: 0, pitch: 0, fov: 75 };
const DEFAULT_ZOOM_LIMITS: ZoomLimits = { minFov: 30, maxFov: 90 };

/**
 * ViewerMode の標準実装（domain-entities.md E9 / BR-A-06）。
 * 既定 yaw=0, pitch=0, fov=75。既定ズーム範囲 30〜90。
 */
export class StandardMode implements ViewerMode {
  readonly id = "standard";
  readonly defaultZoomLimits: ZoomLimits = DEFAULT_ZOOM_LIMITS;
  readonly defaultView: ViewState = DEFAULT_VIEW;

  apply(ctx: ModeContext): void {
    this.updateView(ctx, DEFAULT_VIEW);
  }

  updateView(ctx: ModeContext, view: ViewState): void {
    ctx.camera.rotation.set(MathUtils.degToRad(view.pitch), MathUtils.degToRad(view.yaw), 0, "YXZ");
    ctx.camera.fov = view.fov;
    ctx.camera.updateProjectionMatrix();
  }

  dispose(_ctx: ModeContext): void {
    // three.js オブジェクト自体は Renderer が破棄するため、ここではカメラ設定の解除のみ（現状は no-op）。
  }
}
