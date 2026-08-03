import type { ViewerModeId } from "../viewer/types.js";

/**
 * 正規化された入力意図（domain-entities.md E8）。`InputSource` はブラウザ固有のイベントを
 * 機構ごとの生の量へ正規化するところまでを担い、感度定数・クランプは `ViewController` に一元化する。
 */
export type InputIntent =
  | { kind: "pan"; deltaPx: number }
  | { kind: "tilt"; deltaPx: number }
  | { kind: "zoom"; mode: "delta"; value: number }
  | { kind: "zoom"; mode: "scale"; value: number }
  | { kind: "photoNext" }
  | { kind: "photoPrev" }
  | { kind: "toggleFullscreen" }
  | { kind: "setMode"; mode: ViewerModeId };

/**
 * 入力源の公開拡張 IF（`component-methods.md` 確定済み / NFR-02）。
 * `registerInputSource` で追加する独自の入力源（ジャイロ等）もこの IF を実装する。
 */
export interface InputSource {
  readonly id: string;
  attach(target: HTMLElement, emit: (intent: InputIntent) => void): void;
  detach(): void;
}

/** キーボード操作のアクション→キー列の対応表（domain-entities.md E7）。 */
export interface Keymap {
  panLeft: string[];
  panRight: string[];
  tiltUp: string[];
  tiltDown: string[];
  zoomIn: string[];
  zoomOut: string[];
  photoPrev: string[];
  photoNext: string[];
  toggleFullscreen: string[];
}
