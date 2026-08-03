import type { ViewState, ZoomLimits } from "../viewer/types.js";
import type { Keymap } from "./types.js";

/** `StandardMode` の既定 fov（BR-A-06）。fov 比例の感度計算の基準値として用いる（BR-D-04/05）。 */
const BASE_FOV = 75;
/** ドラッグ 1px あたりの回転角（度、`BASE_FOV` 時点の値。BR-D-04/05）。 */
const PAN_TILT_SENSITIVITY = 0.15;
/** wheel の生 `deltaY` 1 単位あたりの fov 変化量（度、BR-D-06）。 */
const WHEEL_SENSITIVITY = 0.05;
/**
 * pitch のクランプ範囲（Q3=A からの訂正、Code Generation 時点での発見・追記）。
 * 計画時点では YXZ オイラー角のジンバルロック回避のため 89° 案としたが、実装は `yaw`/`pitch` を
 * `ViewController` が独立したスカラー値として保持し、毎フレーム `camera.rotation.set(pitch, yaw, 0, 'YXZ')`
 * で直接設定するのみで、カメラの回転行列から角度を逆算（分解）することはない。そのためジンバルロックに
 * よる `yaw` 不定化は実際には発生しない。UoW-C `TinyPlanetMode` の既定 `pitch=-90`（真下方向、BR-C-06）を
 * 正しく許容するため、境界値である 90° 自体は許容する `[-90, 90]` とする。
 */
const PITCH_LIMIT_DEG = 90;

/** アクティブモードが `defaultZoomLimits` を持たない場合の絶対フォールバック（BR-D-09）。 */
export const FALLBACK_ZOOM_LIMITS: ZoomLimits = { minFov: 10, maxFov: 170 };
/** アクティブモードが `defaultView` を持たない場合の絶対フォールバック（`domain-entities.md` E10）。 */
export const FALLBACK_DEFAULT_VIEW: ViewState = { yaw: 0, pitch: 0, fov: BASE_FOV };

/** 既定キーマップ（Q6=A）。 */
export const DEFAULT_KEYMAP: Keymap = {
  panLeft: ["ArrowLeft"],
  panRight: ["ArrowRight"],
  tiltUp: ["ArrowUp"],
  tiltDown: ["ArrowDown"],
  zoomIn: ["+", "="],
  zoomOut: ["-"],
  photoPrev: ["PageUp"],
  photoNext: ["PageDown"],
  toggleFullscreen: ["f"],
};

/** `yaw` を `(-180, 180]` へ正規化する（無限回転を許容し、クランプはしない。BR-D-04）。 */
export function normalizeYaw(yaw: number): number {
  const wrapped = ((yaw % 360) + 360) % 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

/** `pitch` を `[-89, 89]` にクランプする（BR-D-05, Q3=A）。 */
export function clampPitch(pitch: number): number {
  return Math.min(PITCH_LIMIT_DEG, Math.max(-PITCH_LIMIT_DEG, pitch));
}

/** `fov` を実効ズーム範囲でクランプする（BR-D-09）。 */
export function clampFov(fov: number, limits: ZoomLimits): number {
  return Math.min(limits.maxFov, Math.max(limits.minFov, fov));
}

/**
 * ドラッグ/キーボードの水平差分から新しい `yaw` を計算する（クランプは正規化のみ、BR-D-04）。
 * 右へドラッグ（正の `deltaPx`）＝ `yaw` 減算＝視点は左を向く「つかんで回す」方式。
 * 感度は現在の `fov` に比例させる（ズームインしているときは同じ px 移動の角度変化を小さくする）。
 */
export function applyPanDelta(yaw: number, deltaPx: number, currentFov: number): number {
  const degrees = deltaPx * PAN_TILT_SENSITIVITY * (currentFov / BASE_FOV);
  return normalizeYaw(yaw - degrees);
}

/**
 * ドラッグ/キーボードの垂直差分から新しい `pitch` を計算する（BR-D-05）。
 * 下へドラッグ（正の `deltaPx`）＝ `pitch` 加算＝視点は上を向く。
 */
export function applyTiltDelta(pitch: number, deltaPx: number, currentFov: number): number {
  const degrees = deltaPx * PAN_TILT_SENSITIVITY * (currentFov / BASE_FOV);
  return clampPitch(pitch + degrees);
}

/** wheel/キーボードの加算モデルによる新しい `fov`（クランプ前、BR-D-06/08）。 */
export function applyZoomAdd(fov: number, rawDeltaY: number): number {
  return fov + rawDeltaY * WHEEL_SENSITIVITY;
}

/** pinch の乗算モデルによる新しい `fov`（クランプ前、BR-D-07）。`ratio` は前回距離/今回距離。 */
export function applyZoomScale(fov: number, ratio: number): number {
  return fov * ratio;
}

/** `setKeymap` のマージ規則: 常に既定キーマップへ `partial` をマージする（累積しない）。 */
export function mergeKeymap(base: Keymap, partial: Partial<Keymap>): Keymap {
  return { ...base, ...partial };
}
