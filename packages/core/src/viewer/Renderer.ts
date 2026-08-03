import {
  BackSide,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from "three";
import type { Texture } from "three";

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
}

interface SceneGraph {
  scene: Scene;
  camera: PerspectiveCamera;
  sphereMesh: Mesh;
  webglRenderer: WebGLRenderer;
}

/**
 * プレースホルダ球体メッシュのマテリアルへテクスチャを適用/解除する純粋ロジック（BR-B-09）。
 * `Renderer` インスタンス（WebGL コンテキストを要する）から独立してテスト可能にするため関数として切り出す。
 */
export function applySphereTexture(material: MeshBasicMaterial, texture: Texture | null): void {
  material.map = texture;
  material.color.set(texture ? TEXTURED_COLOR : PLACEHOLDER_COLOR);
  material.needsUpdate = true;
}

/**
 * シーン・カメラ・WebGL レンダラ・プレースホルダ球体メッシュを保持する（domain-entities.md E3）。
 * 単一描画ループ（PP-1/PP-3）とコンテキストロスト検出/復帰（RP-1〜3, L5）を担う。
 * 画像テクスチャは扱わない（BR-A-15、UoW-B の責務）。
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
    this.canvas = this.webglRenderer.domElement;

    this.canvas.addEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.addEventListener("webglcontextrestored", this.handleContextRestored);
  }

  get modeContext(): ModeContext {
    return { camera: this.camera, scene: this.scene, sphereMesh: this.sphereMesh };
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
   * プレースホルダ球体メッシュへテクスチャを反映する（BR-B-09）。
   * `texture` が `null` の場合はプレースホルダの無地マテリアルへ戻す。
   * テクスチャ自体の dispose はこのメソッドの責務外（呼び出し元が管理する、L1/BR-B-15）。
   */
  setSphereTexture(texture: Texture | null): void {
    applySphereTexture(this.sphereMesh.material as MeshBasicMaterial, texture);
  }

  /** requestAnimationFrame ハンドルを1つだけ保持する（PP-3 / BR-A-18）。 */
  startLoop(): void {
    if (this.rafHandle !== null) return;
    const tick = (): void => {
      this.webglRenderer.render(this.scene, this.camera);
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
      this.activeMode?.apply(this.modeContext);
      return true;
    } catch {
      return false;
    }
  }

  private disposeSceneResources(): void {
    this.sphereMesh.geometry.dispose();
    (this.sphereMesh.material as MeshBasicMaterial).dispose();
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
