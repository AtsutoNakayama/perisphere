import { createViewer } from "@perisphere/core";
import type { ViewerEventMap, ViewerEventType, ViewerHandle } from "@perisphere/core";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { ForwardRefExoticComponent, ReactElement, Ref, RefAttributes, RefObject } from "react";

import {
  EVENT_PROP_NAMES,
  extractViewerOptions,
  resolveInitialSource,
  toCallbackPayload,
} from "./internal.js";
import type { PerisphereHandle, PerisphereProps } from "./types.js";

const EVENT_TYPES = Object.keys(EVENT_PROP_NAMES) as ViewerEventType[];

/**
 * `handleRef` へ実行時に遅延委譲する `Proxy` を作る。
 *
 * `useImperativeHandle` は内部的にレイアウトエフェクト相当で実行され、マウント用の通常の
 * `useEffect`（`handleRef.current` を設定する処理）より先に発火する。`handleRef.current` を
 * そのまま返すと初回コミット時点の（まだ `null` の）値に固定されてしまうため、プロパティ
 * アクセスのたびに `handleRef.current` を読む `Proxy` を返すことで、実行順序に依存せず常に
 * 最新のハンドルへ委譲する（BR-H-04）。`handleRef.current` が `null` の間（極端に早いタイミング
 * での呼び出し）はメンバーアクセスが `undefined` になり、呼び出そうとすると例外になる。
 */
function createHandleProxy(handleRef: RefObject<ViewerHandle | null>): ViewerHandle {
  return new Proxy({} as ViewerHandle, {
    get(_target, prop, receiver) {
      const handle = handleRef.current;
      if (handle === null) return undefined;
      const value = Reflect.get(handle, prop, receiver) as unknown;
      return typeof value === "function"
        ? (value as (...args: unknown[]) => unknown).bind(handle)
        : value;
    },
  });
}

/**
 * 8種の `onXxx` props をイベント購読へブリッジする（P3, LC-H-2）。
 * 購読は mount 時1回のみ行い、コールバックの最新値は ref 経由で参照する（BR-H-09）。
 */
function useEventBridge(handleRef: RefObject<ViewerHandle | null>, props: PerisphereProps): void {
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;

    const subscriptions = EVENT_TYPES.map((type) => {
      const handler = (event: ViewerEventMap[typeof type]): void => {
        const propName = EVENT_PROP_NAMES[type];
        const callback = propsRef.current[propName] as ((payload?: unknown) => void) | undefined;
        const payload = toCallbackPayload(event);
        // BR-H-10: onReady は引数なしで呼ぶ（payload が undefined になるのは ready のみ）。
        if (payload === undefined) callback?.();
        else callback?.(payload);
      };
      handle.on(type, handler);
      return { type, handler };
    });

    return () => {
      for (const { type, handler } of subscriptions) {
        handle.off(type, handler);
      }
    };
    // 購読は mount 時1回のみ行い、onXxx コールバック自体は propsRef 経由で最新値を参照する（BR-H-09）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * `PerisphereProps` は `ViewerOptions`（`[key: string]: unknown` を持つ）を継承しているため、
 * `keyof PerisphereProps` は `string` に潰れる。`forwardRef` は内部で `PropsWithoutRef<P>`
 * （`"ref" extends keyof P` の判定を経て `Omit<P, "ref">` を計算する条件型）を props の
 * コンテキスト型として使うため、`forwardRef(...)` の引数に無名関数を直接渡すと、その無名関数の
 * `props` 引数の型が `Omit<PerisphereProps, "ref">` という「`keyof` が `string` の型に対する
 * 汎用 `Omit`」に文脈的推論されてしまい、各プロパティの型が索引シグネチャの型（`unknown`）へ
 * 潰れてしまう（React 自体の既知の制約）。名前付き関数として明示的な引数型注釈を与えたうえで
 * `forwardRef()` に渡す（文脈的型付けを経由させない）ことでこの問題を回避する。
 */
function PerisphereComponent(
  props: PerisphereProps,
  forwardedRef: Ref<PerisphereHandle>,
): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<ViewerHandle | null>(null);
  const image = props.image;
  const photos = props.photos;
  const mode = props.mode;

  useEffect(() => {
    const container = rootRef.current;
    if (!container) return;

    const handle = createViewer(container, extractViewerOptions(props));
    handleRef.current = handle;

    const initial = resolveInitialSource(image, photos);
    if (initial.kind === "photos") handle.setPhotos(initial.value);
    if (initial.kind === "image") handle.loadImage(initial.value).catch(() => {}); // RP-H-1
    if (mode !== undefined) handle.setMode(mode);

    return () => {
      handle.dispose(); // BR-H-11
      handleRef.current = null;
    };
    // マウント時1回のみ実行する意図的な設計（BR-H-02）。StrictMode 二重実行も許容する（BR-H-03）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(forwardedRef, () => createHandleProxy(handleRef), []); // BR-H-04

  useEventBridge(handleRef, props);

  useEffect(() => {
    if (photos !== undefined) handleRef.current?.setPhotos(photos);
  }, [photos]);

  useEffect(() => {
    if (photos === undefined && image !== undefined) {
      handleRef.current?.loadImage(image).catch(() => {}); // RP-H-1
    }
  }, [image, photos]);

  useEffect(() => {
    if (mode !== undefined) handleRef.current?.setMode(mode);
  }, [mode]);

  return (
    <div
      ref={rootRef}
      className={props.className}
      style={props.style}
      data-testid="perisphere-root"
    /> // BR-H-01
  );
}

/**
 * `@perisphere/core` の `createViewer` をラップする React コンポーネント（C16、US-28）。
 * `useEffect` でクライアントマウント後にのみ初期化し（NFR-03）、unmount で破棄する。
 */
export const Perisphere: ForwardRefExoticComponent<
  PerisphereProps & RefAttributes<PerisphereHandle>
> = forwardRef(PerisphereComponent);
