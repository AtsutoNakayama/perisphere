import type {
  FullscreenChangeEvent,
  ModeChangeEvent,
  PhotoChangeEvent,
  ViewerEventMap,
  ViewerEventType,
  ViewerModeId,
  ViewState,
} from "../viewer/types.js";
import { computeEffectiveVisibility, resolveText } from "./controlsLogic.js";
import { DEFAULT_UI_TEXT } from "./types.js";
import type { ControlsVisibility, UITextMap } from "./types.js";

const STYLE_ELEMENT_ID = "perisphere-controls-style";
/** ズームボタン1回あたりの倍率（BR-G-14、ピンチズームと同じ乗算モデル）。 */
const CONTROLS_ZOOM_RATIO = 0.9;

const CONTROLS_CSS = `
.perisphere-controls {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-family: system-ui, sans-serif;
  font-size: 14px;
  box-sizing: border-box;
}
.perisphere-controls button,
.perisphere-controls select {
  background: rgba(255, 255, 255, 0.15);
  color: inherit;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  font: inherit;
}
.perisphere-controls__zoom,
.perisphere-controls__photo-nav {
  display: flex;
  gap: 0.25rem;
}
.perisphere-controls__photo-indicator {
  display: flex;
  gap: 0.25rem;
  overflow-x: auto;
}
`;

/** 共有スタイルタグを同一 `document` に一度だけ注入する（BR-G-12）。 */
function ensureSharedStylesheet(): void {
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ELEMENT_ID;
  style.textContent = CONTROLS_CSS;
  document.head.appendChild(style);
}

/**
 * `ControlsUI` が呼び出す `ViewerHandle` の部分集合（`domain-entities.md` E1）。
 * `unit-of-work.md` の「`EventBus`/`State` の購読のみ・疎結合」という設計方針どおり、
 * コアの内部状態には直接アクセスしない。
 */
export interface ControlsUIDeps {
  getMode(): ViewerModeId;
  setMode(mode: ViewerModeId): void;
  listModes(): ViewerModeId[];
  getView(): ViewState;
  setView(view: Partial<ViewState>): void;
  getPhotoIndex(): number;
  getPhotoCount(): number;
  next(): void;
  prev(): void;
  goTo(index: number): void;
  enterFullscreen(): Promise<void>;
  exitFullscreen(): Promise<void>;
  isFullscreen(): boolean;
  on<K extends ViewerEventType>(type: K, handler: (event: ViewerEventMap[K]) => void): void;
  off<K extends ViewerEventType>(type: K, handler: (event: ViewerEventMap[K]) => void): void;
}

/**
 * 素 DOM による同梱コントロール UI（C10、`domain-entities.md` E1、`logical-components.md` L1）。
 * フルスクリーン／ズーム／モード切替／写真切替＋インジケーターを構築し、`ControlsUIDeps` の呼び出しと
 * `EventBus` 購読のみでコアと連携する（Renderer 等の内部状態には依存しない）。
 */
export class ControlsUI {
  private visibility: ControlsVisibility;
  private text: Required<UITextMap>;

  private readonly root: HTMLDivElement;
  private readonly fullscreenButton: HTMLButtonElement;
  private readonly zoomGroup: HTMLDivElement;
  private readonly zoomInButton: HTMLButtonElement;
  private readonly zoomOutButton: HTMLButtonElement;
  private readonly modeSelect: HTMLSelectElement;
  private readonly photoNavGroup: HTMLDivElement;
  private readonly photoPrevButton: HTMLButtonElement;
  private readonly photoNextButton: HTMLButtonElement;
  private readonly photoIndicator: HTMLDivElement;
  private photoIndicatorButtons: HTMLButtonElement[] = [];
  private lastIndicatorTotal = -1;

  constructor(
    private readonly container: HTMLElement,
    private readonly deps: ControlsUIDeps,
    initialVisibility: ControlsVisibility,
    initialText: UITextMap,
  ) {
    ensureSharedStylesheet();
    this.visibility = initialVisibility;
    this.text = { ...DEFAULT_UI_TEXT, ...initialText };

    this.root = document.createElement("div");
    this.root.className = "perisphere-controls";
    this.root.setAttribute("role", "toolbar");

    this.fullscreenButton = document.createElement("button");
    this.fullscreenButton.type = "button";
    this.fullscreenButton.className = "perisphere-controls__fullscreen";
    this.fullscreenButton.dataset.testid = "perisphere-controls-fullscreen";
    this.fullscreenButton.addEventListener("click", this.handleFullscreenClick);

    this.zoomInButton = document.createElement("button");
    this.zoomInButton.type = "button";
    this.zoomInButton.className = "perisphere-controls__zoom-in";
    this.zoomInButton.dataset.testid = "perisphere-controls-zoom-in";
    this.zoomInButton.textContent = "+";
    this.zoomInButton.addEventListener("click", this.handleZoomIn);

    this.zoomOutButton = document.createElement("button");
    this.zoomOutButton.type = "button";
    this.zoomOutButton.className = "perisphere-controls__zoom-out";
    this.zoomOutButton.dataset.testid = "perisphere-controls-zoom-out";
    this.zoomOutButton.textContent = "−";
    this.zoomOutButton.addEventListener("click", this.handleZoomOut);

    this.zoomGroup = document.createElement("div");
    this.zoomGroup.className = "perisphere-controls__zoom";
    this.zoomGroup.append(this.zoomInButton, this.zoomOutButton);

    this.modeSelect = document.createElement("select");
    this.modeSelect.className = "perisphere-controls__mode";
    this.modeSelect.dataset.testid = "perisphere-controls-mode";
    this.modeSelect.addEventListener("pointerdown", this.handleModeSelectOpen);
    this.modeSelect.addEventListener("focus", this.handleModeSelectOpen);
    this.modeSelect.addEventListener("change", this.handleModeSelectChange);

    this.photoPrevButton = document.createElement("button");
    this.photoPrevButton.type = "button";
    this.photoPrevButton.className = "perisphere-controls__photo-prev";
    this.photoPrevButton.dataset.testid = "perisphere-controls-photo-prev";
    this.photoPrevButton.textContent = "‹";
    this.photoPrevButton.addEventListener("click", this.handlePhotoPrev);

    this.photoNextButton = document.createElement("button");
    this.photoNextButton.type = "button";
    this.photoNextButton.className = "perisphere-controls__photo-next";
    this.photoNextButton.dataset.testid = "perisphere-controls-photo-next";
    this.photoNextButton.textContent = "›";
    this.photoNextButton.addEventListener("click", this.handlePhotoNext);

    this.photoNavGroup = document.createElement("div");
    this.photoNavGroup.className = "perisphere-controls__photo-nav";
    this.photoNavGroup.append(this.photoPrevButton, this.photoNextButton);

    this.photoIndicator = document.createElement("div");
    this.photoIndicator.className = "perisphere-controls__photo-indicator";
    this.photoIndicator.setAttribute("role", "tablist");

    this.root.append(
      this.fullscreenButton,
      this.zoomGroup,
      this.modeSelect,
      this.photoNavGroup,
      this.photoIndicator,
    );
    container.appendChild(this.root);

    this.rebuildModeOptions();
    this.rebuildPhotoIndicator(deps.getPhotoCount());
    this.applyText();
    this.applyVisibility();

    deps.on("modechange", this.handleModeChange);
    deps.on("photochange", this.handlePhotoChange);
    deps.on("fullscreenchange", this.handleFullscreenChange);
  }

  /** 現在の設定へ部分的にマージする（BR-G-02）。 */
  setVisibility(config: Partial<ControlsVisibility>): void {
    this.visibility = { ...this.visibility, ...config };
    this.applyVisibility();
  }

  /** 現在の文言へ部分的にマージする（BR-G-10）。 */
  setText(overrides: Partial<UITextMap>): void {
    this.text = { ...this.text, ...overrides };
    this.applyText();
  }

  /** DOM 要素の除去とイベント購読の解除のみ行う。共有 `<style>` は除去しない（BR-G-13）。 */
  dispose(): void {
    this.deps.off("modechange", this.handleModeChange);
    this.deps.off("photochange", this.handlePhotoChange);
    this.deps.off("fullscreenchange", this.handleFullscreenChange);
    this.root.remove();
  }

  private applyZoom(ratio: number): void {
    const view = this.deps.getView();
    this.deps.setView({ fov: view.fov * ratio }); // クランプは setView 側で自動適用される
    this.container.focus(); // BR-G-11
  }

  private rebuildModeOptions(): void {
    const modes = this.deps.listModes();
    this.modeSelect.replaceChildren(
      ...modes.map((id) => {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = id;
        return option;
      }),
    );
    this.modeSelect.value = this.deps.getMode();
  }

  private rebuildPhotoIndicator(total: number): void {
    this.lastIndicatorTotal = total;
    this.photoIndicatorButtons = Array.from({ length: total }, (_, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "perisphere-controls__photo-indicator-item";
      button.setAttribute("role", "tab");
      button.dataset.testid = `perisphere-controls-photo-indicator-${index}`;
      button.textContent = String(index + 1);
      button.addEventListener("click", () => {
        this.deps.goTo(index);
        this.container.focus(); // BR-G-11
      });
      return button;
    });
    this.photoIndicator.replaceChildren(...this.photoIndicatorButtons);
    this.syncPhotoIndicatorCurrent(this.deps.getPhotoIndex());
    this.applyIndicatorLabels();
  }

  private syncPhotoIndicatorCurrent(index: number): void {
    this.photoIndicatorButtons.forEach((button, i) => {
      if (i === index) {
        button.setAttribute("aria-current", "true");
        button.setAttribute("aria-selected", "true");
      } else {
        button.removeAttribute("aria-current");
        button.setAttribute("aria-selected", "false");
      }
    });
  }

  private applyIndicatorLabels(): void {
    const total = this.lastIndicatorTotal;
    this.photoIndicatorButtons.forEach((button, index) => {
      button.setAttribute(
        "aria-label",
        resolveText(this.text.photoIndicatorItemLabel, { current: index + 1, total }),
      );
    });
  }

  private syncFullscreenButtonText(active: boolean): void {
    this.fullscreenButton.textContent = active ? "✕" : "⛶";
    this.fullscreenButton.setAttribute(
      "aria-label",
      active ? this.text.fullscreenExitLabel : this.text.fullscreenEnterLabel,
    );
  }

  private applyText(): void {
    // SP-G-1: textContent/setAttribute のみを使用し、innerHTML 等は使用しない。
    this.root.setAttribute("aria-label", this.text.controlsLabel);
    this.syncFullscreenButtonText(this.deps.isFullscreen());
    this.zoomInButton.setAttribute("aria-label", this.text.zoomInLabel);
    this.zoomOutButton.setAttribute("aria-label", this.text.zoomOutLabel);
    this.modeSelect.setAttribute("aria-label", this.text.modeSwitchLabel);
    this.photoPrevButton.setAttribute("aria-label", this.text.photoPrevLabel);
    this.photoNextButton.setAttribute("aria-label", this.text.photoNextLabel);
    this.applyIndicatorLabels();
  }

  private applyVisibility(): void {
    const effective = computeEffectiveVisibility(
      this.visibility,
      this.deps.listModes().length,
      this.deps.getPhotoCount(),
    );
    this.fullscreenButton.hidden = !effective.fullscreen;
    this.zoomGroup.hidden = !effective.zoom;
    this.modeSelect.hidden = !effective.modeSwitch;
    this.photoNavGroup.hidden = !effective.photoNav;
    this.photoIndicator.hidden = !effective.photoIndicator;
  }

  private readonly handleFullscreenClick = (): void => {
    const promise = this.deps.isFullscreen()
      ? this.deps.exitFullscreen()
      : this.deps.enterFullscreen();
    promise.catch(() => {}); // RP-G-1 Silent Best-Effort Action
    this.container.focus(); // BR-G-11
  };

  private readonly handleZoomIn = (): void => this.applyZoom(CONTROLS_ZOOM_RATIO);
  private readonly handleZoomOut = (): void => this.applyZoom(1 / CONTROLS_ZOOM_RATIO);

  private readonly handleModeSelectOpen = (): void => this.rebuildModeOptions(); // BR-G-06

  private readonly handleModeSelectChange = (): void => {
    // BR-G-11: select は持続的コントロールのため container.focus() は呼ばない。
    this.deps.setMode(this.modeSelect.value);
  };

  private readonly handlePhotoPrev = (): void => {
    this.deps.prev();
    this.container.focus(); // BR-G-11
  };

  private readonly handlePhotoNext = (): void => {
    this.deps.next();
    this.container.focus(); // BR-G-11
  };

  private readonly handleModeChange = (_event: ModeChangeEvent): void => {
    this.modeSelect.value = this.deps.getMode();
    this.applyVisibility(); // BR-G-04
  };

  private readonly handlePhotoChange = (event: PhotoChangeEvent): void => {
    if (event.total !== this.lastIndicatorTotal) {
      this.rebuildPhotoIndicator(event.total);
    } else {
      this.syncPhotoIndicatorCurrent(event.index);
    }
    this.applyVisibility(); // BR-G-05
  };

  private readonly handleFullscreenChange = (event: FullscreenChangeEvent): void => {
    this.syncFullscreenButtonText(event.active);
  };
}
