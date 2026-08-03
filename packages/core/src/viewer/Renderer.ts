import {
  BackSide,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  WebGLRenderer,
} from "three";
import type { Material, Texture } from "three";

import { ContextRecoveryState } from "./ContextRecoveryState.js";
import type { ModeContext } from "./ModeContext.js";
import type { ViewerMode } from "./ViewerMode.js";

const SPHERE_RADIUS = 500;
const SPHERE_WIDTH_SEGMENTS = 60;
const SPHERE_HEIGHT_SEGMENTS = 40;
const CAMERA_FOV = 75;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 1000;
const PLACEHOLDER_COLOR = 0x808080;
const TEXTURED_COLOR = 0xffffff;

export interface RendererCallbacks {
  /** healthy -> lost 遷移時（BR-A-12）。呼び出し側で error(CONTEXT_LOST) を発火する。 */
  onContextLost: () => void;
  /** recovering -> healthy 遷移時。 */
  onRebuildSucceeded: () => void;
  /** recovering -> degraded 遷移時（再試行しない、BR-A-12）。 */
  onRebuildFailed: () => void;
  /**
   * 毎フレーム、描画（`render`）の直後に呼ばれる（UoW-D 拡張、PP-D-1 Coalesced View Change Emission）。
   * `viewChange`/`zoomChange` の集約発火チェックに用いる。省略可能（呼び出しコストを避けたい場合）。
   */
  onFrame?: () => void;
}

interface SceneGraph {
  scene: Scene;
  camera: PerspectiveCamera;
  sphereMesh: Mesh;
  webglRenderer: WebGLRenderer;
}

/**
 * 球体メッシュのマテリアルへテクスチャを適用/解除する純粋ロジック（BR-B-09、UoW-C でマテリアル種別分岐に拡張）。
 * `Renderer` インスタンス（WebGL コンテキストを要する）から独立してテスト可能にするため関数として切り出す。
 * `MeshBasicMaterial` は `.map`、`ShaderMaterial`（UoW-C 導入）は `uniforms.map`（規約名）を更新する（NFR Requirements Q2）。
 */
export function applySphereTexture(material: Material, texture: Texture | null): void {
  if (material instanceof MeshBasicMaterial) {
    material.map = texture;
    material.color.set(texture ? TEXTURED_COLOR : PLACEHOLDER_COLOR);
    material.needsUpdate = true;
    return;
  }
  if (material instanceof ShaderMaterial && material.uniforms.map) {
    material.uniforms.map.value = texture;
    material.needsUpdate = true;
  }
}

/**
 * シーン・カメラ・WebGL レンダラ・球体メッシュを保持する（domain-entities.md E3）。
 * 単一描画ループ（PP-1/PP-3）とコンテキストロスト検出/復帰（RP-1〜3, L5）を担う。
 * 画像テクスチャ自体は扱わない（BR-A-15、UoW-B の責務）。UoW-C でモード別マテリアルの差し替えに対応。
 */
export class Renderer {
  private readonly container: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly callbacks: RendererCallbacks;
  private readonly contextRecoveryState = new ContextRecoveryState();

  private scene: Scene;
  private camera: PerspectiveCamera;
  private sphereMesh: Mesh;
  private webglRenderer: WebGLRenderer;
  /** Renderer 自身が所有する既定マテリアル（プレースホルダ/通常表示用）。シェーダベースモードのマテリアルはモードが所有する。 */
  private defaultMaterial: MeshBasicMaterial;
  private currentTexture: Texture | null = null;

  private activeMode: ViewerMode | null = null;
  private rafHandle: number | null = null;

  constructor(container: HTMLElement, callbacks: RendererCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    const graph = Renderer.buildSceneGraph(container);
    this.scene = graph.scene;
    this.camera = graph.camera;
    this.sphereMesh = graph.sphereMesh;
    this.webglRenderer = graph.webglRenderer;
    this.defaultMaterial = this.sphereMesh.material as MeshBasicMaterial;
    this.canvas = this.webglRenderer.domElement;

    this.canvas.addEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.addEventListener("webglcontextrestored", this.handleContextRestored);
  }

  get modeContext(): ModeContext {
    return {
      camera: this.camera,
      scene: this.scene,
      sphereMesh: this.sphereMesh,
      texture: this.currentTexture,
      setSphereMaterial: (material) => this.setSphereMaterial(material),
    };
  }

  get contextState() {
    return this.contextRecoveryState.value;
  }

  /** WebGL2 コンテキストの最大テクスチャサイズ（`SourceContext.maxTextureSize` の情報源、BR-B-05）。 */
  get maxTextureSize(): number {
    return this.webglRenderer.capabilities.maxTextureSize;
  }

  setActiveMode(mode: ViewerMode): void {
    this.activeMode = mode;
  }

  /**
   * container の現在のサイズでカメラのアスペクト比・WebGL キャンバスサイズを再計算する
   * （domain-entities.md E7、BR-F-09）。フルスクリーン切替の前後で呼ばれる想定。
   */
  resize(): void {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.webglRenderer.setSize(width, height);
  }

  /**
   * 球体メッシュへテクスチャを反映する（BR-B-09）。`texture` が `null` の場合はプレースホルダの無地表示へ戻す。
   * テクスチャ自体の dispose はこのメソッドの責務外（呼び出し元が管理する、L1/BR-B-15）。
   */
  setSphereTexture(texture: Texture | null): void {
    this.currentTexture = texture;
    applySphereTexture(this.sphereMesh.material, texture);
  }

  /**
   * 球体メッシュのマテリアルを差し替える（BR-C-08、UoW-C 拡張）。`material` が `null` の場合は
   * `Renderer` 既定の `MeshBasicMaterial` へ戻す（BR-C-09）。差し替え後、現在のテクスチャを
   * 新しいマテリアルへ自動的に反映する（マテリアル種別に応じた分岐は `applySphereTexture` が担う）。
   */
  setSphereMaterial(material: Material | null): void {
    const next = material ?? this.defaultMaterial;
    applySphereTexture(next, this.currentTexture);
    this.sphereMesh.material = next;
  }

  /** requestAnimationFrame ハンドルを1つだけ保持する（PP-3 / BR-A-18）。 */
  startLoop(): void {
    if (this.rafHandle !== null) return;
    const tick = (): void => {
      this.webglRenderer.render(this.scene, this.camera);
      this.callbacks.onFrame?.();
      this.rafHandle = requestAnimationFrame(tick);
    };
    this.rafHandle = requestAnimationFrame(tick);
  }

  stopLoop(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  dispose(): void {
    this.stopLoop();
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.handleContextRestored);
    this.disposeSceneResources();
    if (this.canvas.parentNode === this.container) {
      this.container.removeChild(this.canvas);
    }
  }

  private handleContextLost = (event: Event): void => {
    // preventDefault しない場合、ブラウザはコンテキストを復帰させない。
    event.preventDefault();
    const transitioned = this.contextRecoveryState.notifyContextLost();
    if (!transitioned) return;
    this.stopLoop();
    this.callbacks.onContextLost();
  };

  private handleContextRestored = (): void => {
    const transitioned = this.contextRecoveryState.notifyContextRestored();
    if (!transitioned) return;

    const rebuilt = this.rebuild();
    if (rebuilt) {
      this.contextRecoveryState.notifyRebuildSucceeded();
      this.startLoop();
      this.callbacks.onRebuildSucceeded();
    } else {
      this.contextRecoveryState.notifyRebuildFailed();
      this.callbacks.onRebuildFailed();
    }
  };

  /** PP-2: 都度破棄して再生成する（プーリングは行わない）。 */
  private rebuild(): boolean {
    try {
      this.disposeSceneResources();
      const graph = Renderer.buildSceneGraph(this.container, this.canvas);
      this.scene = graph.scene;
      this.camera = graph.camera;
      this.sphereMesh = graph.sphereMesh;
      this.webglRenderer = graph.webglRenderer;
      this.defaultMaterial = this.sphereMesh.material as MeshBasicMaterial;
      this.activeMode?.apply(this.modeContext);
      return true;
    } catch {
      return false;
    }
  }

  private disposeSceneResources(): void {
    this.sphereMesh.geometry.dispose();
    // シェーダベースモードが所有する ShaderMaterial はここでは破棄しない（BR-C-09、Viewer dispose 時にモード側が破棄）。
    if (this.sphereMesh.material === this.defaultMaterial) {
      this.defaultMaterial.dispose();
    }
    this.webglRenderer.dispose();
  }

  private static buildSceneGraph(
    container: HTMLElement,
    existingCanvas?: HTMLCanvasElement,
  ): SceneGraph {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;

    const scene = new Scene();

    const camera = new PerspectiveCamera(CAMERA_FOV, width / height, CAMERA_NEAR, CAMERA_FAR);

    const geometry = new SphereGeometry(
      SPHERE_RADIUS,
      SPHERE_WIDTH_SEGMENTS,
      SPHERE_HEIGHT_SEGMENTS,
    );
    const material = new MeshBasicMaterial({ color: PLACEHOLDER_COLOR, side: BackSide });
    const sphereMesh = new Mesh(geometry, material);
    scene.add(sphereMesh);

    const webglRenderer = new WebGLRenderer({
      canvas: existingCanvas,
      antialias: true,
    });
    webglRenderer.setPixelRatio(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    webglRenderer.setSize(width, height);

    if (!existingCanvas) {
      container.appendChild(webglRenderer.domElement);
    }

    return { scene, camera, sphereMesh, webglRenderer };
  }
}
