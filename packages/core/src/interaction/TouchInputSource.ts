import type { InputIntent, InputSource } from "./types.js";

interface Point {
  x: number;
  y: number;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * 1本指ドラッグ（pan/tilt）と2本指ピンチ（zoom）を正規化する（domain-entities.md E5）。
 * コンテナへ `touch-action: none` を設定し、ブラウザのネイティブジェスチャーと競合させない（BR-D-17, Q8）。
 */
export class TouchInputSource implements InputSource {
  readonly id = "touch";

  private target: HTMLElement | null = null;
  private emit: ((intent: InputIntent) => void) | null = null;
  private lastSingle: Point | null = null;
  private lastPinchDistance: number | null = null;
  private readonly previousTouchAction = new WeakMap<HTMLElement, string>();

  private readonly handleTouchStart = (event: TouchEvent): void => {
    this.syncFromTouches(event.touches, true);
  };

  private readonly handleTouchMove = (event: TouchEvent): void => {
    event.preventDefault();
    this.syncFromTouches(event.touches, false);
  };

  private readonly handleTouchEnd = (event: TouchEvent): void => {
    this.syncFromTouches(event.touches, true);
  };

  private syncFromTouches(touches: TouchList, reset: boolean): void {
    if (touches.length === 1) {
      const point: Point = { x: touches[0]!.clientX, y: touches[0]!.clientY };
      if (!reset && this.lastSingle && this.emit) {
        const deltaX = point.x - this.lastSingle.x;
        const deltaY = point.y - this.lastSingle.y;
        if (deltaX !== 0) this.emit({ kind: "pan", deltaPx: deltaX });
        if (deltaY !== 0) this.emit({ kind: "tilt", deltaPx: deltaY });
      }
      this.lastSingle = point;
      this.lastPinchDistance = null;
      return;
    }

    if (touches.length === 2) {
      const a: Point = { x: touches[0]!.clientX, y: touches[0]!.clientY };
      const b: Point = { x: touches[1]!.clientX, y: touches[1]!.clientY };
      const currentDistance = distance(a, b);
      if (!reset && this.lastPinchDistance !== null && this.lastPinchDistance > 0 && this.emit) {
        this.emit({ kind: "zoom", mode: "scale", value: this.lastPinchDistance / currentDistance });
      }
      this.lastPinchDistance = currentDistance;
      this.lastSingle = null;
      return;
    }

    // 0本または3本以上: パン/チルト・ピンチいずれの追跡対象でもない。
    this.lastSingle = null;
    this.lastPinchDistance = null;
  }

  attach(target: HTMLElement, emit: (intent: InputIntent) => void): void {
    this.target = target;
    this.emit = emit;
    this.previousTouchAction.set(target, target.style.touchAction);
    target.style.touchAction = "none";
    target.addEventListener("touchstart", this.handleTouchStart, { passive: true });
    target.addEventListener("touchmove", this.handleTouchMove, { passive: false });
    target.addEventListener("touchend", this.handleTouchEnd, { passive: true });
    target.addEventListener("touchcancel", this.handleTouchEnd, { passive: true });
  }

  detach(): void {
    const target = this.target;
    if (!target) return;
    target.style.touchAction = this.previousTouchAction.get(target) ?? "";
    target.removeEventListener("touchstart", this.handleTouchStart);
    target.removeEventListener("touchmove", this.handleTouchMove);
    target.removeEventListener("touchend", this.handleTouchEnd);
    target.removeEventListener("touchcancel", this.handleTouchEnd);
    this.target = null;
    this.emit = null;
    this.lastSingle = null;
    this.lastPinchDistance = null;
  }
}
