import type { InputIntent, InputSource } from "./types.js";

/**
 * マウスドラッグ（pan/tilt）とホイール（zoom）を正規化する（domain-entities.md E4）。
 * ドラッグ中のテキスト選択抑制・`wheel` の `preventDefault`（ページスクロール防止）を行う（BR-D-17, Q8）。
 */
export class PointerInputSource implements InputSource {
  readonly id = "pointer";

  private target: HTMLElement | null = null;
  private emit: ((intent: InputIntent) => void) | null = null;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private readonly previousUserSelect = new WeakMap<HTMLElement, string>();

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !this.target) return;
    this.dragging = true;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    try {
      this.target.setPointerCapture(event.pointerId);
    } catch {
      // RP-D-1: Graceful Pointer Capture Fallback。失敗しても例外を伝播させず、
      // 要素内限定の pointermove/pointerup 追跡へ劣化させる。
    }
    event.preventDefault();
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.dragging || !this.emit) return;
    const deltaX = event.clientX - this.lastX;
    const deltaY = event.clientY - this.lastY;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    if (deltaX !== 0) this.emit({ kind: "pan", deltaPx: deltaX });
    if (deltaY !== 0) this.emit({ kind: "tilt", deltaPx: deltaY });
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    this.dragging = false;
    try {
      this.target?.releasePointerCapture(event.pointerId);
    } catch {
      // 既にキャプチャされていない等は無視してよい（RP-D-1 と同じ寛容な扱い）。
    }
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.emit?.({ kind: "zoom", mode: "delta", value: event.deltaY });
  };

  private readonly handleDragStart = (event: DragEvent): void => {
    event.preventDefault();
  };

  attach(target: HTMLElement, emit: (intent: InputIntent) => void): void {
    this.target = target;
    this.emit = emit;
    this.previousUserSelect.set(target, target.style.userSelect);
    target.style.userSelect = "none";
    target.addEventListener("pointerdown", this.handlePointerDown);
    target.addEventListener("pointermove", this.handlePointerMove);
    target.addEventListener("pointerup", this.handlePointerUp);
    target.addEventListener("pointercancel", this.handlePointerUp);
    target.addEventListener("wheel", this.handleWheel, { passive: false });
    target.addEventListener("dragstart", this.handleDragStart);
  }

  detach(): void {
    const target = this.target;
    if (!target) return;
    target.style.userSelect = this.previousUserSelect.get(target) ?? "";
    target.removeEventListener("pointerdown", this.handlePointerDown);
    target.removeEventListener("pointermove", this.handlePointerMove);
    target.removeEventListener("pointerup", this.handlePointerUp);
    target.removeEventListener("pointercancel", this.handlePointerUp);
    target.removeEventListener("wheel", this.handleWheel);
    target.removeEventListener("dragstart", this.handleDragStart);
    this.target = null;
    this.emit = null;
    this.dragging = false;
  }
}
