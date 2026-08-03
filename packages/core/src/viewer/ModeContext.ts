import type { Mesh, PerspectiveCamera, Scene } from "three";

/**
 * ViewerMode の各フックに渡す描画ハンドル（domain-entities.md E10）。
 * Renderer 自体を ViewerMode に直接握らせない疎結合の意図を維持する。
 */
export interface ModeContext {
  camera: PerspectiveCamera;
  scene: Scene;
  sphereMesh: Mesh;
}
