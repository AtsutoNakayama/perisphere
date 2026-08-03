/**
 * 等距離図法（Equidistant / f-θ 投影）による正規化スクリーン半径（Dewarp、BR-C-06）。
 * 中心からの角度 θ に比例して半径が増加するため、透視投影と異なり θ が 90° を超えても
 * 連続的に描画でき、広視野でも周辺の伸びが穏やかになる。
 *
 * @param theta - 視線中心からの角度（ラジアン、0 以上）
 * @param fov - 視野角（ラジアン）。θ = fov/2 のとき半径 1（画面端）になるよう正規化する
 */
export function equidistantRadius(theta: number, fov: number): number {
  return theta / (fov / 2);
}
