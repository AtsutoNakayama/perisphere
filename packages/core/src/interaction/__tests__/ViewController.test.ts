import { describe, expect, it, vi } from "vitest";

import { ViewController } from "../ViewController.js";

describe("ViewController", () => {
  it("starts with the fallback default view (yaw=0, pitch=0, fov=75)", () => {
    const controller = new ViewController();

    expect(controller.getView()).toEqual({ yaw: 0, pitch: 0, fov: 75 });
  });

  it("getView() returns a fresh copy each time (NFR Requirements Q2)", () => {
    const controller = new ViewController();

    const a = controller.getView();
    const b = controller.getView();

    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it("applyPan updates yaw using the fov-proportional sensitivity (BR-D-04)", () => {
    const controller = new ViewController();

    controller.applyPan(100);

    expect(controller.getView().yaw).not.toBe(0);
    expect(controller.getView().pitch).toBe(0);
  });

  it("applyTilt updates pitch and clamps to [-90, 90] (BR-D-05)", () => {
    const controller = new ViewController();

    controller.applyTilt(100000);

    expect(controller.getView().pitch).toBe(90);
  });

  it("applyZoomDelta/applyZoomScale clamp fov to the effective zoom limits (BR-D-06/07/09)", () => {
    const controller = new ViewController();

    // resetToModeDefault 未呼び出しの間は絶対フォールバック（FALLBACK_ZOOM_LIMITS = 10..170）が有効。
    controller.applyZoomDelta(100000);
    expect(controller.getView().fov).toBe(170);

    controller.applyZoomScale(0.0001);
    expect(controller.getView().fov).toBeGreaterThanOrEqual(10);
  });

  describe("setView (BR-D-11)", () => {
    it("merges the partial view and applies the same clamps as drag input", () => {
      const controller = new ViewController();
      const onInvalid = vi.fn();

      controller.setView({ yaw: 400, pitch: -400 }, onInvalid);

      expect(onInvalid).not.toHaveBeenCalled();
      const view = controller.getView();
      expect(view.pitch).toBe(-90);
      expect(view.yaw).toBeGreaterThan(-180);
      expect(view.yaw).toBeLessThanOrEqual(180);
    });

    it("rejects non-finite values and leaves the view unchanged (NFR Requirements Q5)", () => {
      const controller = new ViewController();
      const before = controller.getView();
      const onInvalid = vi.fn();

      controller.setView({ fov: Number.NaN }, onInvalid);

      expect(onInvalid).toHaveBeenCalledTimes(1);
      expect(controller.getView()).toEqual(before);
    });
  });

  describe("setZoomLimits (BR-D-09/10)", () => {
    it("merges onto the current effective range and re-clamps the current fov immediately", () => {
      const controller = new ViewController();
      const onInvalid = vi.fn();

      controller.setZoomLimits({ minFov: 50, maxFov: 60 }, onInvalid);

      expect(onInvalid).not.toHaveBeenCalled();
      expect(controller.getView().fov).toBe(60); // 既定 75 は新しい上限 60 を超えるためクランプされる
    });

    it("rejects minFov >= maxFov without changing state", () => {
      const controller = new ViewController();
      const onInvalid = vi.fn();

      controller.setZoomLimits({ minFov: 90, maxFov: 30 }, onInvalid);

      expect(onInvalid).toHaveBeenCalledTimes(1);
      controller.applyZoomDelta(100000);
      expect(controller.getView().fov).toBe(170); // 依然として絶対フォールバック（10..170）が有効
    });

    it("persists across resetToModeDefault and re-clamps the new mode's default fov (BR-D-12)", () => {
      const controller = new ViewController();
      const onInvalid = vi.fn();
      controller.setZoomLimits({ minFov: 50, maxFov: 60 }, onInvalid);

      // 新モードの既定 fov=100 は、明示設定した実効範囲(50..60)を超えるため再クランプされる。
      controller.resetToModeDefault({ yaw: 10, pitch: 20, fov: 100 }, { minFov: 60, maxFov: 120 });

      expect(controller.getView()).toEqual({ yaw: 10, pitch: 20, fov: 60 });
    });
  });

  describe("flushIfPending (PP-D-1)", () => {
    it("returns null when there is no pending change", () => {
      const controller = new ViewController();

      expect(controller.flushIfPending()).toBeNull();
    });

    it("returns the latest view once after a change, then null again", () => {
      const controller = new ViewController();

      controller.applyPan(50);
      const flushed = controller.flushIfPending();

      expect(flushed).not.toBeNull();
      expect(flushed?.view).toEqual(controller.getView());
      expect(controller.flushIfPending()).toBeNull();
    });

    it("coalesces multiple changes within the same flush cycle into a single result", () => {
      const controller = new ViewController();

      controller.applyPan(10);
      controller.applyPan(10);
      controller.applyTilt(5);
      const flushed = controller.flushIfPending();

      expect(flushed).not.toBeNull();
      expect(controller.flushIfPending()).toBeNull();
    });

    it("reports fovChanged only when fov actually changed since the last flush (BR-D-14)", () => {
      const controller = new ViewController();

      controller.applyPan(10);
      expect(controller.flushIfPending()?.fovChanged).toBe(false);

      controller.applyZoomDelta(10);
      expect(controller.flushIfPending()?.fovChanged).toBe(true);
    });
  });
});
