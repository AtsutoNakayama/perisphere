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
  /** モード切替のたびに呼ばれる（BR-C-03）。次のモードへ渡す前の後片付け（マテリアル復帰等）を行う。 */
  dispose(ctx: ModeContext): void;
  /**
   * Viewer 全体の dispose 時に一度だけ呼ばれる（UoW-C 拡張）。モードが保持するリソース
   * （`ShaderMaterial` 等）の最終解放を行う。`dispose` とは異なりモード切替のたびには呼ばれない（BR-C-09）。
   */
  disposeResources?(ctx: ModeContext): void;
}
