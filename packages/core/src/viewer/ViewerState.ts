import { FALLBACK_DEFAULT_VIEW } from "../interaction/viewMath.js";
import type { ViewerState } from "./types.js";

/**
 * ViewerState はプレーンオブジェクト（BR-A-14/BR-A-16）。
 *
 * `imageLoadState` は UoW-B で `ViewerState` へ追加された必須フィールドだが、この初期値の
 * 設定漏れが `pnpm -r build`/`test`/`lint` のいずれでも検出されず残っていた（tsup の DTS 生成は
 * `noEmitOnError` を設定していないため型エラーがあってもビルド自体は成功し、Vitest は esbuild
 * ベースのトランスパイルで型チェックを行わず、ESLint も `recommendedTypeChecked` を使っていないため
 * TS2741 相当の意味論的エラーを検出できない）。UoW-D で本ファイルへ `view` を追加するのに合わせて
 * 発見・修正した（Code Generation 時点での発見・追記）。
 */
export function createViewerState(): ViewerState {
  return {
    mode: "standard",
    ready: false,
    loadState: "idle",
    lastError: null,
    imageLoadState: "idle",
    view: { ...FALLBACK_DEFAULT_VIEW },
    photoIndex: -1,
    isFullscreen: false,
  };
}
