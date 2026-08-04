import { useRef } from "react";
import type { RefObject } from "react";

import type { PerisphereHandle } from "./types.js";

/**
 * {@link PerisphereHandle} 型の `ref` を生成するだけの薄いヘルパー（C17、US-28）。
 * 追加の状態（`isReady` 等）は持たない。
 */
export function usePerisphere(): { ref: RefObject<PerisphereHandle | null> } {
  return { ref: useRef<PerisphereHandle | null>(null) };
}
