import type { EventBus } from "./EventBus.js";
import type { PerisphereError, PerisphereErrorCode, ViewerState } from "./types.js";

/**
 * 失敗要因を PerisphereError に正規化し、ViewerState.lastError へ反映しつつ
 * EventBus 経由で error を発火する（domain-entities.md E6 / BR-A-13）。
 */
export class ErrorManager {
  constructor(
    private readonly state: ViewerState,
    private readonly eventBus: EventBus,
  ) {}

  report(code: PerisphereErrorCode, message: string): PerisphereError {
    const error: PerisphereError = { code, message };
    this.state.lastError = error;
    this.eventBus.emit("error", { type: "error", error });
    return error;
  }
}
