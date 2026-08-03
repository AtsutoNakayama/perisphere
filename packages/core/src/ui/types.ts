/**
 * 同梱コントロールの表示/非表示指定（`ViewerHandle.setControlsVisibility`、FR-14）。
 * 未指定キーは表示（`true`）として扱う。`modeSwitch`/`photoNav`/`photoIndicator` は該当データが
 * ない場合（登録モードが1種のみ／写真が0〜1枚）、明示指定に関わらず自動的に非表示になる
 * （`business-rules.md` BR-G-04/05）。
 */
export interface ControlsVisibility {
  fullscreen?: boolean;
  zoom?: boolean;
  modeSwitch?: boolean;
  photoNav?: boolean;
  photoIndicator?: boolean;
}

/**
 * 同梱コントロールの文言・aria-label 差し替え（`ViewerHandle.setText`、FR-15）。
 * `photoIndicatorItemLabel` は `{current}`/`{total}` トークンを含められる（`business-rules.md` BR-G-10）。
 * i18n 自体は利用側の責務であり、本マップは差し替え手段のみを提供する。
 */
export interface UITextMap {
  /** ルート（toolbar）の aria-label。 */
  controlsLabel?: string;
  fullscreenEnterLabel?: string;
  fullscreenExitLabel?: string;
  zoomInLabel?: string;
  zoomOutLabel?: string;
  modeSwitchLabel?: string;
  photoPrevLabel?: string;
  photoNextLabel?: string;
  photoIndicatorItemLabel?: string;
}

/** 既定の英語文言（`domain-entities.md` E3）。 */
export const DEFAULT_UI_TEXT: Required<UITextMap> = {
  controlsLabel: "Viewer controls",
  fullscreenEnterLabel: "Enter fullscreen",
  fullscreenExitLabel: "Exit fullscreen",
  zoomInLabel: "Zoom in",
  zoomOutLabel: "Zoom out",
  modeSwitchLabel: "Viewing mode",
  photoPrevLabel: "Previous photo",
  photoNextLabel: "Next photo",
  photoIndicatorItemLabel: "Photo {current} of {total}",
};
