const DEFAULT_D = 1;

/**
 * Panini 図法の近似式（BR-C-06）。水平方向は円柱的に圧縮しつつ、垂直方向の直線性を保つ。
 * 学術的に完全な光学モデルの再現ではなく、視覚的特性を満たす近似（Functional Design Q5=A）。
 *
 * @param thetaH - 前方軸から見た水平角（ラジアン。正面が 0、左右に ± π/2 程度）
 * @param dyOverHypot - 前方軸との水平距離に対する垂直成分の比（`dy / sqrt(dx² + dz²)`）
 * @param fov - 水平視野角（ラジアン）。`thetaH = fov/2` のとき `x` の絶対値が 1（画面端）になるよう正規化する
 * @param d - Panini 図法のパラメータ（既定 1、"true Panini"）
 */
export function paniniProject(
  thetaH: number,
  dyOverHypot: number,
  fov: number,
  d = DEFAULT_D,
): { x: number; y: number } {
  const s = (d + 1) / (d + Math.cos(thetaH));
  const x = s * Math.sin(thetaH);
  const y = s * dyOverHypot;

  const edgeThetaH = fov / 2;
  const edgeS = (d + 1) / (d + Math.cos(edgeThetaH));
  const scale = 1 / (edgeS * Math.sin(edgeThetaH));

  return { x: x * scale, y: y * scale };
}
