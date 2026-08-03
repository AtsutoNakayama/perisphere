import type { FullscreenMode } from "./types.js";

/** 擬似フルスクリーン（BR-F-02）で使う z-index。32bit 符号付き整数の最大値（他ライブラリの慣習）。 */
const PSEUDO_FULLSCREEN_Z_INDEX = "2147483647";

/**
 * ネイティブ Fullscreen API / 擬似フルスクリーンの一本化された状態管理と切替を行う
 * （domain-entities.md E1, logical-components.md L1）。
 *
 * `EventBus`/`ErrorManager` は直接扱わず、状態が変化するたびにコンストラクタで受け取った
 * `onChange` を呼ぶだけに留める（RP-F-2）。実際のイベント発火・エラー正規化は呼び出し元
 * （`createViewer`）が担う。呼び出し元は `document`/`window` が存在する環境でのみ本クラスを
 * 構築する前提（真の SSR では構築しない、BR-A-01 と同じ境界の外側での判断）。
 */
export class FullscreenManager {
  private mode: FullscreenMode = "none";
  private savedInlineStyle: {
    position: string;
    top: string;
    right: string;
    bottom: string;
    left: string;
    zIndex: string;
  } | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly onChange: (active: boolean) => void,
  ) {
    document.addEventListener("fullscreenchange", this.handleNativeChange);
  }

  isActive(): boolean {
    return this.mode !== "none";
  }

  /** BR-F-01: 既にアクティブなら何もせず解決する（冪等）。 */
  async enter(): Promise<void> {
    if (this.mode !== "none") return;
    if (typeof this.container.requestFullscreen === "function") {
      // BR-F-04: 失敗時はそのまま reject する（呼び出し元が FULLSCREEN_FAILED に正規化する）。
      // 成功時の mode 更新・onChange 呼び出しは handleNativeChange に一本化する（RP-F-2, BR-F-05）。
      await this.container.requestFullscreen();
      return;
    }
    // BR-F-02: 非対応環境では擬似フルスクリーンにフォールバックする。
    this.enterPseudo();
  }

  /** 既に非アクティブなら何もせず解決する（冪等）。 */
  async exit(): Promise<void> {
    if (this.mode === "none") return;
    if (this.mode === "pseudo") {
      this.exitPseudo();
      return;
    }
    // BR-F-04: 失敗時はそのまま reject する。成功時の状態更新は handleNativeChange に一本化する。
    await document.exitFullscreen();
  }

  /** BR-F-08: dispose 時、フルスクリーン中であれば自動的に解除する。 */
  dispose(): void {
    if (this.mode === "native") {
      // RP-F-1 Silent Best-Effort Cleanup: 同期シグネチャ（DisposeFn）に合わせた fire-and-forget。
      void document.exitFullscreen().catch(() => {});
    } else if (this.mode === "pseudo") {
      this.exitPseudo();
    }
    document.removeEventListener("fullscreenchange", this.handleNativeChange);
  }

  private enterPseudo(): void {
    const style = this.container.style;
    this.savedInlineStyle = {
      position: style.position,
      top: style.top,
      right: style.right,
      bottom: style.bottom,
      left: style.left,
      zIndex: style.zIndex,
    };
    style.position = "fixed";
    style.top = "0";
    style.right = "0";
    style.bottom = "0";
    style.left = "0";
    style.zIndex = PSEUDO_FULLSCREEN_Z_INDEX;
    // BR-F-06: 擬似モード中のみ Escape キーで解除できるようにする。フォーカス位置に関わらず
    // 確実に捕捉するため、container ではなく document に付与する。
    document.addEventListener("keydown", this.handleEscapeKey);
    this.mode = "pseudo";
    this.onChange(true);
  }

  private exitPseudo(): void {
    const saved = this.savedInlineStyle;
    const style = this.container.style;
    style.position = saved?.position ?? "";
    style.top = saved?.top ?? "";
    style.right = saved?.right ?? "";
    style.bottom = saved?.bottom ?? "";
    style.left = saved?.left ?? "";
    style.zIndex = saved?.zIndex ?? "";
    this.savedInlineStyle = null;
    document.removeEventListener("keydown", this.handleEscapeKey);
    this.mode = "none";
    this.onChange(false);
  }

  /**
   * BR-F-05: ネイティブモードの mode 更新・onChange 呼び出しをここに一本化する。
   * 自己起点（enter()/exit() の成功）・外部起点（Esc キー・ブラウザ標準 UI）の
   * いずれもこの1本のコードパスで正しく反映される。
   */
  private readonly handleNativeChange = (): void => {
    if (this.mode === "pseudo") return;
    const active = document.fullscreenElement === this.container;
    const nextMode: FullscreenMode = active ? "native" : "none";
    if (nextMode === this.mode) return;
    this.mode = nextMode;
    this.onChange(active);
  };

  private readonly handleEscapeKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape") this.exitPseudo();
  };
}
