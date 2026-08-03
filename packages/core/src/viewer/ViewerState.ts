import type { ViewerState } from "./types.js";

/**
 * ViewerState はプレーンオブジェクト（BR-A-14/BR-A-16）。
 * UoW-A スコープでは mode/ready/loadState/lastError の最小集合のみを保持する。
 */
export function createViewerState(): ViewerState {
  return {
    mode: "standard",
    ready: false,
    loadState: "idle",
    lastError: null,
  };
}
