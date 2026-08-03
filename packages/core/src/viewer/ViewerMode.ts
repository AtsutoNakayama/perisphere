import type { ModeContext } from "./ModeContext.js";
import type { ViewState, ZoomLimits } from "./types.js";

/**
 * 投影適用ロジックの差し替え可能な実装（domain-entities.md E8 / logical-components.md L3 Strategy）。
 */
export interface ViewerMode {
  readonly id: string;
  readonly defaultZoomLimits?: ZoomLimits;
  apply(ctx: ModeContext): void;
  updateView(ctx: ModeContext, view: ViewState): void;
  dispose(ctx: ModeContext): void;
}
