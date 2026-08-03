import type { Material, Mesh, PerspectiveCamera, Scene, Texture } from "three";

/**
 * ViewerMode の各フックに渡す描画ハンドル（domain-entities.md E10、UoW-C で `texture`/`setSphereMaterial` を拡張）。
 * Renderer 自体を ViewerMode に直接握らせない疎結合の意図を維持する（`Renderer.setSphereMaterial` への
 * バインド済み関数のみを渡し、`Renderer` インスタンス全体は渡さない）。
 */
export interface ModeContext {
  camera: PerspectiveCamera;
  scene: Scene;
  sphereMesh: Mesh;
  /** 現在表示中のテクスチャ（UoW-B `SourceResult.texture` 相当）。未ロード時は `null`。 */
  texture: Texture | null;
  /**
   * 球体メッシュのマテリアルを差し替える（`Renderer.setSphereMaterial` へのバインド済み関数、BR-C-08）。
   * `null` を渡すと既定の `MeshBasicMaterial` へ戻る（BR-C-09）。
   */
  setSphereMaterial: (material: Material | null) => void;
}
