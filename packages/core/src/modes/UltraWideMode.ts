import { MathUtils } from "three";

import type { ModeContext } from "../viewer/ModeContext.js";
import type { ViewerMode } from "../viewer/ViewerMode.js";
import type { ViewState, ZoomLimits } from "../viewer/types.js";

const DEFAULT_VIEW: ViewState = { yaw: 0, pitch: 0, fov: 100 };
const DEFAULT_ZOOM_LIMITS: ZoomLimits = { minFov: 60, maxFov: 120 };

/**
 * 広視野・周辺歪み許容の透視投影モード（domain-entities.md E3、BR-C-05）。
 * `StandardMode` と同じ実装パターン（透視投影カメラ）で、既定値のみ異なる。
 */
export class UltraWideMode implements ViewerMode {
  readonly id = "ultraWide";
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
