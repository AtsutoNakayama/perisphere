import type {
  ImageInput,
  PhotoInput,
  ViewerEventMap,
  ViewerEventType,
  ViewerOptions,
} from "@perisphere/core";

import type { PerisphereProps } from "./types.js";

/** `resolveInitialSource` の結果（BR-H-05）。 */
export type ResolvedSource =
  | { kind: "photos"; value: readonly PhotoInput[] }
  | { kind: "image"; value: ImageInput }
  | { kind: "none" };

/**
 * `image`/`photos` のどちらを初期適用するか決定する（BR-H-05）。
 * `photos` が指定されていれば常に優先し、`image` は無視する。
 */
export function resolveInitialSource(
  image: ImageInput | undefined,
  photos: readonly PhotoInput[] | undefined,
): ResolvedSource {
  if (photos !== undefined) return { kind: "photos", value: photos };
  if (image !== undefined) return { kind: "image", value: image };
  return { kind: "none" };
}

/** `PerisphereProps` のうち、`ViewerOptions` へ渡さない既知のキー（BR-H-08）。 */
const KNOWN_PROP_KEYS = [
  "image",
  "photos",
  "mode",
  "className",
  "style",
  "onReady",
  "onError",
  "onProgress",
  "onModeChange",
  "onViewChange",
  "onZoomChange",
  "onPhotoChange",
  "onFullscreenChange",
] as const satisfies readonly (keyof PerisphereProps)[];

/**
 * `PerisphereProps` から `createViewer` の `options` として渡す残余部分を抽出する（BR-H-08）。
 * 既知のキーを除いた残りは `controls`/`text`（`ViewerOptions` 由来）や将来追加されるキーを
 * 含め、そのまま透過する。
 */
export function extractViewerOptions(props: PerisphereProps): ViewerOptions {
  const rest: Record<string, unknown> = { ...props };
  for (const key of KNOWN_PROP_KEYS) delete rest[key];
  return rest as ViewerOptions;
}

type AnyViewerEvent = ViewerEventMap[ViewerEventType];

/**
 * `ViewerEventMap` のイベントを `onXxx` コールバックへ渡すペイロードへ変換する（BR-H-10）。
 * `ready` は引数なし相当の `undefined`、`error` はラップせず `PerisphereError` をそのまま返す。
 * それ以外は `type` フィールドを除いたオブジェクトを返す。
 */
export function toCallbackPayload(event: AnyViewerEvent): unknown {
  if (event.type === "ready") return undefined;
  if (event.type === "error") return event.error;
  const { type: _type, ...rest } = event;
  return rest;
}

/** イベント種別 → 対応する `onXxx` prop 名（BR-H-10）。 */
export const EVENT_PROP_NAMES = {
  ready: "onReady",
  error: "onError",
  progress: "onProgress",
  modechange: "onModeChange",
  viewchange: "onViewChange",
  zoomchange: "onZoomChange",
  photochange: "onPhotoChange",
  fullscreenchange: "onFullscreenChange",
} as const satisfies Record<ViewerEventType, keyof PerisphereProps>;
