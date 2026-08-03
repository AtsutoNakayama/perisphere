import type { ControlsVisibility } from "./types.js";

/**
 * 明示指定（`explicit`）と該当データの有無（`modeCount`/`photoCount`）から実効表示可否を計算する
 * 純粋関数（`business-rules.md` BR-G-04/05、NFR Requirements Q2、NFR Design LC-G-2）。
 * DOM・EventBus のいずれにも依存しない。
 */
export function computeEffectiveVisibility(
  explicit: ControlsVisibility,
  modeCount: number,
  photoCount: number,
): Required<ControlsVisibility> {
  return {
    fullscreen: explicit.fullscreen ?? true,
    zoom: explicit.zoom ?? true,
    modeSwitch: (explicit.modeSwitch ?? true) && modeCount > 1,
    photoNav: (explicit.photoNav ?? true) && photoCount > 1,
    photoIndicator: (explicit.photoIndicator ?? true) && photoCount > 1,
  };
}

/**
 * `template` 中の `{key}` トークンを `values` の対応する値へ置換する純粋関数（`business-rules.md` BR-G-10）。
 * 未知のトークンはそのまま残す。
 */
export function resolveText(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template,
  );
}
