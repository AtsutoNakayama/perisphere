import { DEFAULT_KEYMAP, mergeKeymap } from "./viewMath.js";
import type { InputIntent, InputSource, Keymap } from "./types.js";

/** キー1回押下（キーリピート追従）あたりの pan/tilt 固定量（px 相当、BR-D-08）。 */
const KEYBOARD_PAN_TILT_STEP_PX = 20;
/** キー1回押下あたりの zoom 固定量（wheel の生 deltaY 相当、BR-D-08）。 */
const KEYBOARD_ZOOM_STEP_RAW = 100;

type Action = keyof Keymap;

const ACTIONS: Action[] = [
  "panLeft",
  "panRight",
  "tiltUp",
  "tiltDown",
  "zoomIn",
  "zoomOut",
  "photoPrev",
  "photoNext",
  "toggleFullscreen",
];

function intentFor(action: Action): InputIntent {
  switch (action) {
    case "panLeft":
      return { kind: "pan", deltaPx: KEYBOARD_PAN_TILT_STEP_PX };
    case "panRight":
      return { kind: "pan", deltaPx: -KEYBOARD_PAN_TILT_STEP_PX };
    case "tiltUp":
      return { kind: "tilt", deltaPx: KEYBOARD_PAN_TILT_STEP_PX };
    case "tiltDown":
      return { kind: "tilt", deltaPx: -KEYBOARD_PAN_TILT_STEP_PX };
    case "zoomIn":
      return { kind: "zoom", mode: "delta", value: -KEYBOARD_ZOOM_STEP_RAW };
    case "zoomOut":
      return { kind: "zoom", mode: "delta", value: KEYBOARD_ZOOM_STEP_RAW };
    case "photoPrev":
      return { kind: "photoPrev" };
    case "photoNext":
      return { kind: "photoNext" };
    case "toggleFullscreen":
      return { kind: "toggleFullscreen" };
  }
}

/**
 * `Keymap` に基づきキー入力を正規化する（domain-entities.md E6）。コンテナへ `tabindex="0"` を付与し、
 * フォーカス時のみ `keydown` を処理する（BR-D-17, Q8）。既定モード切替キーは持たない（Q6）。
 */
export class KeyboardInputSource implements InputSource {
  readonly id = "keyboard";

  private target: HTMLElement | null = null;
  private emit: ((intent: InputIntent) => void) | null = null;
  /** `null` は `setKeymap(null)` による全体無効化（`domain-entities.md` E7）。 */
  private keymap: Keymap | null = DEFAULT_KEYMAP;

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.keymap || !this.emit) return;
    const action = this.resolveAction(event.key);
    if (!action) return;
    event.preventDefault();
    this.emit(intentFor(action));
  };

  private resolveAction(key: string): Action | null {
    if (!this.keymap) return null;
    for (const action of ACTIONS) {
      if (this.keymap[action].includes(key)) return action;
    }
    return null;
  }

  /** `ViewerHandle.setKeymap`（BR-D-08 の `Keymap`、`domain-entities.md` E7）から呼ばれる。 */
  setKeymap(map: Partial<Keymap> | null): void {
    this.keymap = map === null ? null : mergeKeymap(DEFAULT_KEYMAP, map);
  }

  attach(target: HTMLElement, emit: (intent: InputIntent) => void): void {
    this.target = target;
    this.emit = emit;
    if (!target.hasAttribute("tabindex")) {
      target.setAttribute("tabindex", "0");
    }
    target.addEventListener("keydown", this.handleKeyDown);
  }

  detach(): void {
    this.target?.removeEventListener("keydown", this.handleKeyDown);
    this.target = null;
    this.emit = null;
  }
}
