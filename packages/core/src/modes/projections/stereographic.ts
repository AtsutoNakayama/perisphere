/**
 * ステレオ図法（Stereographic）による正規化スクリーン半径（Tiny Planet、BR-C-06）。
 * `r = 2·tan(θ/2)` を FOV に応じて正規化する。中心からの角度が大きいほど急激に圧縮され、
 * 「小さな惑星」状の見た目になる。
 *
 * @param theta - 視線中心からの角度（ラジアン、0 以上 π 未満）
 * @param fov - 視野角（ラジアン）。θ = fov/2 のとき半径 1（画面端）になるよう正規化する
 */
export function stereographicRadius(theta: number, fov: number): number {
  return Math.tan(theta / 2) / Math.tan(fov / 4);
}
