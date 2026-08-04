import type {
  ImageInput,
  PerisphereError,
  PhotoInput,
  ViewerEventMap,
  ViewerHandle,
  ViewerModeId,
  ViewerOptions,
} from "@perisphere/core";
import type { CSSProperties } from "react";

/**
 * ref 経由で公開する命令ハンドル。`ViewerHandle`（`@perisphere/core`）の全量エイリアス。
 * 一部メンバーのみを複製すると `ViewerHandle` の変更に追従できなくなるため、意図的に
 * 全量エイリアスとする（`domain-entities.md` の設計判断）。
 */
export type PerisphereHandle = ViewerHandle;

/** {@link Perisphere} コンポーネントの props（`domain-entities.md` E1）。 */
export interface PerisphereProps extends ViewerOptions {
  /** ルート要素へ渡す CSS クラス名（BR-H-01）。 */
  className?: string;
  /** ルート要素へ渡すインラインスタイル（BR-H-01）。サイズ指定はこれで行う。 */
  style?: CSSProperties;

  /** 単一画像の初期表示・切替（BR-H-05/BR-H-06）。`photos` が指定されている場合は無視される。 */
  image?: ImageInput;
  /** ギャラリー写真リストの初期設定・切替（BR-H-05/BR-H-06）。`image` より優先される。 */
  photos?: readonly PhotoInput[];
  /** 初期ビューワーモード・モード切替（BR-H-06）。 */
  mode?: ViewerModeId;

  /** `ready` イベントのブリッジ（BR-H-10）。 */
  onReady?: () => void;
  /** `error` イベントのブリッジ。`PerisphereError` をそのまま渡す（BR-H-10）。 */
  onError?: (error: PerisphereError) => void;
  /** `progress` イベントのブリッジ（BR-H-10）。 */
  onProgress?: (event: Omit<ViewerEventMap["progress"], "type">) => void;
  /** `modechange` イベントのブリッジ（BR-H-10）。 */
  onModeChange?: (event: Omit<ViewerEventMap["modechange"], "type">) => void;
  /** `viewchange` イベントのブリッジ（BR-H-10）。 */
  onViewChange?: (event: Omit<ViewerEventMap["viewchange"], "type">) => void;
  /** `zoomchange` イベントのブリッジ（BR-H-10）。 */
  onZoomChange?: (event: Omit<ViewerEventMap["zoomchange"], "type">) => void;
  /** `photochange` イベントのブリッジ（BR-H-10）。 */
  onPhotoChange?: (event: Omit<ViewerEventMap["photochange"], "type">) => void;
  /** `fullscreenchange` イベントのブリッジ（BR-H-10）。 */
  onFullscreenChange?: (event: Omit<ViewerEventMap["fullscreenchange"], "type">) => void;
}
