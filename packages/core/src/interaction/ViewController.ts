import type { ViewState, ZoomLimits } from "../viewer/types.js";
import * as viewMath from "./viewMath.js";

/** `flushIfPending` の戻り値。`fovChanged` は前回の発火時点からの fov 変化の有無（BR-D-14）。 */
export interface ViewChangeFlush {
  view: ViewState;
  fovChanged: boolean;
}

function isFiniteViewState(view: ViewState): boolean {
  return Number.isFinite(view.yaw) && Number.isFinite(view.pitch) && Number.isFinite(view.fov);
}

function isValidZoomLimits(limits: ZoomLimits): boolean {
  return (
    Number.isFinite(limits.minFov) &&
    Number.isFinite(limits.maxFov) &&
    limits.minFov < limits.maxFov
  );
}

/**
 * 視点状態（yaw/pitch/fov）を一元管理する（domain-entities.md E1、`logical-components.md` L1）。
 * 計算は `viewMath.ts` へ委譲し、自身はミュータブルな状態保持と `EventBus` 発火の集約制御
 * （`pendingNotify`、PP-D-1）のみを担う。
 */
export class ViewController {
  private view: ViewState = { ...viewMath.FALLBACK_DEFAULT_VIEW };
  /** 明示的に `setZoomLimits` が設定された範囲（モード切替をまたいで維持、BR-D-09/10）。 */
  private explicitZoomLimits: ZoomLimits | null = null;
  /** アクティブモードの `defaultZoomLimits`（`resetToModeDefault` で更新、BR-D-09）。 */
  private activeModeZoomLimits: ZoomLimits | undefined;
  private pendingNotify = false;
  private lastNotifiedFov: number = this.view.fov;

  /** 現在の `ViewState` の浅いコピーを返す（NFR Requirements Q2、内部状態を誤って書き換えられないように）。 */
  getView(): ViewState {
    return { ...this.view };
  }

  /** 実効ズーム範囲を解決する: 明示設定 > アクティブモード既定 > 絶対フォールバック（BR-D-09）。 */
  private effectiveZoomLimits(): ZoomLimits {
    return this.explicitZoomLimits ?? this.activeModeZoomLimits ?? viewMath.FALLBACK_ZOOM_LIMITS;
  }

  applyPan(deltaPx: number): void {
    this.view = {
      ...this.view,
      yaw: viewMath.applyPanDelta(this.view.yaw, deltaPx, this.view.fov),
    };
    this.pendingNotify = true;
  }

  applyTilt(deltaPx: number): void {
    this.view = {
      ...this.view,
      pitch: viewMath.applyTiltDelta(this.view.pitch, deltaPx, this.view.fov),
    };
    this.pendingNotify = true;
  }

  applyZoomDelta(rawDeltaY: number): void {
    const raw = viewMath.applyZoomAdd(this.view.fov, rawDeltaY);
    this.view = { ...this.view, fov: viewMath.clampFov(raw, this.effectiveZoomLimits()) };
    this.pendingNotify = true;
  }

  applyZoomScale(ratio: number): void {
    const raw = viewMath.applyZoomScale(this.view.fov, ratio);
    this.view = { ...this.view, fov: viewMath.clampFov(raw, this.effectiveZoomLimits()) };
    this.pendingNotify = true;
  }

  /**
   * 明示的な視点設定（BR-D-11）。ドラッグ等と同じクランプ（pitch/fov）・yaw 正規化を適用する。
   * 不正値（非有限数値）を含む場合は状態を変更せず `onInvalid` を呼ぶ（NFR Requirements Q5）。
   */
  setView(partial: Partial<ViewState>, onInvalid: () => void): void {
    const merged = { ...this.view, ...partial };
    if (!isFiniteViewState(merged)) {
      onInvalid();
      return;
    }
    this.view = {
      yaw: viewMath.normalizeYaw(merged.yaw),
      pitch: viewMath.clampPitch(merged.pitch),
      fov: viewMath.clampFov(merged.fov, this.effectiveZoomLimits()),
    };
    this.pendingNotify = true;
  }

  /**
   * ズーム上下限の明示設定（BR-D-10）。現在の実効範囲に `partial` をマージし、以後の明示設定として
   * 保持する。不正値（非有限数値、`minFov >= maxFov`）の場合は状態を変更せず `onInvalid` を呼ぶ。
   */
  setZoomLimits(partial: Partial<ZoomLimits>, onInvalid: () => void): void {
    const merged = { ...this.effectiveZoomLimits(), ...partial };
    if (!isValidZoomLimits(merged)) {
      onInvalid();
      return;
    }
    this.explicitZoomLimits = merged;
    const clampedFov = viewMath.clampFov(this.view.fov, merged);
    if (clampedFov !== this.view.fov) {
      this.view = { ...this.view, fov: clampedFov };
    }
    this.pendingNotify = true;
  }

  /**
   * モード切替直後、実際にカメラへ適用された既定ビューへ内部状態を同期する（BR-D-12、発見・追記）。
   * 明示的なズーム上下限が設定済みの場合、同期後の fov をその範囲へ再クランプする
   * （モードの既定 fov が利用側の明示設定を上書きしないようにする）。
   */
  resetToModeDefault(defaultView: ViewState, modeZoomLimits: ZoomLimits | undefined): void {
    this.activeModeZoomLimits = modeZoomLimits;
    let next = { ...defaultView };
    if (this.explicitZoomLimits) {
      next = { ...next, fov: viewMath.clampFov(next.fov, this.explicitZoomLimits) };
    }
    this.view = next;
    this.pendingNotify = true;
  }

  /**
   * 発火保留（pending）があれば最新の `ViewState` を返しフラグを下ろす（PP-D-1、`Renderer` の
   * 描画ループから毎フレーム呼ばれる）。保留がなければ `null` を返す。
   */
  flushIfPending(): ViewChangeFlush | null {
    if (!this.pendingNotify) return null;
    this.pendingNotify = false;
    const fovChanged = this.view.fov !== this.lastNotifiedFov;
    this.lastNotifiedFov = this.view.fov;
    return { view: { ...this.view }, fovChanged };
  }
}
