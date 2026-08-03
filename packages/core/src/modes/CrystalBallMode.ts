import { BackSide, FrontSide, MathUtils, SphereGeometry } from "three";

import type { ModeContext } from "../viewer/ModeContext.js";
import type { ViewerMode } from "../viewer/ViewerMode.js";
import type { ViewState, ZoomLimits } from "../viewer/types.js";

const DEFAULT_VIEW: ViewState = { yaw: 0, pitch: 0, fov: 75 };
const DEFAULT_ZOOM_LIMITS: ZoomLimits = { minFov: 30, maxFov: 90 };
const EXTERNAL_DISTANCE_FACTOR = 2.5;

/**
 * 球を外側から眺める投影モード（domain-entities.md E8、BR-C-07）。
 * カメラを球外部へ移動し、マテリアルの面を反転して外側から見えるようにする。
 */
export class CrystalBallMode implements ViewerMode {
  readonly id = "crystalBall";
  readonly defaultZoomLimits: ZoomLimits = DEFAULT_ZOOM_LIMITS;
  readonly defaultView: ViewState = DEFAULT_VIEW;

  apply(ctx: ModeContext): void {
    const radius = (ctx.sphereMesh.geometry as SphereGeometry).parameters.radius;
    ctx.camera.position.set(0, 0, radius * EXTERNAL_DISTANCE_FACTOR);
    ctx.sphereMesh.material.side = FrontSide;
    ctx.sphereMesh.material.needsUpdate = true;
    this.updateView(ctx, DEFAULT_VIEW);
  }

  updateView(ctx: ModeContext, view: ViewState): void {
    ctx.camera.rotation.set(MathUtils.degToRad(view.pitch), MathUtils.degToRad(view.yaw), 0, "YXZ");
    ctx.camera.fov = view.fov;
    ctx.camera.updateProjectionMatrix();
  }

  dispose(ctx: ModeContext): void {
    // BR-C-11: マテリアルの面を他モード共通の BackSide へ戻す。
    // カメラ position も原点へ戻す（他モードは position を一切操作しない前提のため、
    // 移動させた本モード自身が責任を持って復元する。business-logic-model.md P4 の
    // 初版記述「次モードの apply が復帰を担う」は、他モードが position を設定しない
    // ことと矛盾するため実装時に本方式へ修正した）。
    ctx.sphereMesh.material.side = BackSide;
    ctx.sphereMesh.material.needsUpdate = true;
    ctx.camera.position.set(0, 0, 0);
  }
}
