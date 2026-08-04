import type { ViewerEventMap, ViewerEventType, ViewerHandle } from "@perisphere/core";
import type { Mocked } from "vitest";
import { vi } from "vitest";

/**
 * `@perisphere/core` をモジュール境界としてモック化するテスト用フェイク（UoW-A の
 * WebGL 境界〔Renderer〕モックと同じ思想、uow-h-code-generation-plan.md 参照）。
 * `emit`/`listenerCount` はテストヘルパー用の拡張で `ViewerHandle` の一部ではない。
 * `Mocked<ViewerHandle>` により各メンバーが `mockClear()` 等を持つ `vi.fn()` として扱える。
 */
export interface MockViewerHandle extends Mocked<ViewerHandle> {
  emit<K extends ViewerEventType>(type: K, event: ViewerEventMap[K]): void;
  listenerCount(type: ViewerEventType): number;
}

type AnyHandler = (event: never) => void;

export function createMockViewerHandle(): MockViewerHandle {
  const listeners = new Map<ViewerEventType, Set<AnyHandler>>();

  const on = vi.fn((type: ViewerEventType, handler: AnyHandler) => {
    let set = listeners.get(type);
    if (!set) {
      set = new Set();
      listeners.set(type, set);
    }
    set.add(handler);
  });
  const off = vi.fn((type: ViewerEventType, handler: AnyHandler) => {
    listeners.get(type)?.delete(handler);
  });

  const base = {
    on,
    off,
    once: vi.fn(),
    getMode: vi.fn(() => "standard"),
    setMode: vi.fn(),
    registerMode: vi.fn(),
    listModes: vi.fn(() => ["standard"]),
    loadImage: vi.fn(() => Promise.resolve()),
    registerSource: vi.fn(),
    getView: vi.fn(() => ({ yaw: 0, pitch: 0, fov: 75 })),
    setView: vi.fn(),
    setZoomLimits: vi.fn(),
    registerInputSource: vi.fn(),
    setKeymap: vi.fn(),
    setPhotos: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
    goTo: vi.fn(),
    getPhotoIndex: vi.fn(() => -1),
    enterFullscreen: vi.fn(() => Promise.resolve()),
    exitFullscreen: vi.fn(() => Promise.resolve()),
    isFullscreen: vi.fn(() => false),
    setControlsVisibility: vi.fn(),
    setText: vi.fn(),
    getPhotoCount: vi.fn(() => 0),
    dispose: vi.fn(),
  };

  return Object.assign(base, {
    emit<K extends ViewerEventType>(type: K, event: ViewerEventMap[K]): void {
      for (const handler of listeners.get(type) ?? []) {
        (handler as (event: ViewerEventMap[K]) => void)(event);
      }
    },
    listenerCount(type: ViewerEventType): number {
      return listeners.get(type)?.size ?? 0;
    },
  }) as unknown as MockViewerHandle;
}
