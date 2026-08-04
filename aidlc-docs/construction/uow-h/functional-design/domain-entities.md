# Domain Entities — UoW-H React アダプタ

- **関連 Issue**: [#46](https://github.com/AtsutoNakayama/perisphere/issues/46)
- **作成日**: 2026-08-04
- **前提資料**: `uow-h-functional-design-plan.md`（Q1〜Q8 回答・採用理由）、`inception/application-design/component-methods.md`（C16〜C18 節、暫定シグネチャ）、UoW-A `domain-entities.md`（`ViewerHandle`/`ViewerOptions`/`ViewerEventMap` の確定版は `packages/core/src/viewer/types.ts`）
- **注記**: 本ユニットのエンティティ番号（E1〜）はこのドキュメント内で独立採番する。パッケージ名は `@perisphere/react`、配置は `packages/react/src/`。

## エンティティ一覧

| # | 名称 | 種別 | 概要 |
|---|---|---|---|
| E1 | `PerisphereProps` | 公開型（新規） | `Perisphere` コンポーネントの props。`ViewerOptions` を拡張し、宣言的 props とイベントコールバックを追加 |
| E2 | `PerisphereHandle` | 公開型（新規） | ref 経由で公開する命令ハンドル。`ViewerHandle` の全量エイリアス（Q2・本ステージでの確定、下記「設計判断」参照） |
| E3 | `Perisphere` | 公開 React コンポーネント（新規、C16） | `useEffect` での `createViewer`/`dispose` ライフサイクル管理、props↔コアのブリッジ |
| E4 | `usePerisphere` | 公開フック（新規、C17） | `PerisphereHandle` 型の `ref` を生成するだけの薄いヘルパー |

## 設計判断: `PerisphereHandle` の範囲（Inception からの確定）

`component-methods.md` は `PerisphereHandle` を「`ViewerHandle` の部分集合」として例示（`setMode`/`next`/`prev`/`goTo`/`enterFullscreen`/`exitFullscreen`/`getView`/`setView` のみ列挙）していたが、本ステージで **`ViewerHandle` の全メンバーを公開する型エイリアスとして確定**する。

- **理由**: 一部メンバーのみを恣意的に選んで別型として複製すると、(1) UoW-A〜G で確立済みの「サービスを再実装しない・薄いラッパに徹する」方針（`services.md`）に反し React 層に独自の制限を持ち込むことになる、(2) 将来 `ViewerHandle` にメンバーが追加されるたび `PerisphereHandle` 側も手動で追従させる保守負担が生まれる（Q8 で `ViewerOptions` の索引シグネチャに対して採った「将来のコア拡張に追従しやすい」判断と同じ思想）。全量エイリアスであれば追加の保守なしに追従する。
- **除外するメンバーはない**: `on`/`off`/`once`（イベント購読）も含め、`ViewerHandle` の全メンバーをそのまま ref 経由で使える。

## エンティティ詳細

### E1 `PerisphereProps`（新規、C16）

```ts
import type {
  FullscreenChangeEvent,
  ImageInput,
  ImageProgressEvent,
  ModeChangeEvent,
  PerisphereError,
  PhotoChangeEvent,
  PhotoInput,
  ViewChangeEvent,
  ViewerModeId,
  ViewerOptions,
  ZoomChangeEvent,
} from "@perisphere/core";
import type { CSSProperties } from "react";

export interface PerisphereProps extends ViewerOptions {
  /** ルート要素へ渡す CSS クラス名（Q1）。 */
  className?: string;
  /** ルート要素へ渡すインラインスタイル（Q1）。サイズ指定（width/height 等）はこれで行う。 */
  style?: CSSProperties;

  /** 単一画像の初期表示・切替（Q3）。`photos` が指定されている場合は無視される（BR-H-03）。 */
  image?: ImageInput;
  /** ギャラリー写真リストの初期設定・切替（Q3）。`image` より優先される（BR-H-03）。 */
  photos?: readonly PhotoInput[];
  /** 初期ビューワーモード・モード切替（Q3）。 */
  mode?: ViewerModeId;

  // イベント → props コールバック（BR-H-10、`type` フィールドを除いたペイロードを渡す）
  onReady?: () => void;
  onError?: (error: PerisphereError) => void;
  onProgress?: (event: Omit<ImageProgressEvent, "type">) => void;
  onModeChange?: (event: Omit<ModeChangeEvent, "type">) => void;
  onViewChange?: (event: Omit<ViewChangeEvent, "type">) => void;
  onZoomChange?: (event: Omit<ZoomChangeEvent, "type">) => void;
  onPhotoChange?: (event: Omit<PhotoChangeEvent, "type">) => void;
  onFullscreenChange?: (event: Omit<FullscreenChangeEvent, "type">) => void;
}
```

- `ViewerOptions` を継承するため `controls`/`text`（UoW-G）は自動的に props として受け取れる（Q5）。索引シグネチャ `[key: string]: unknown` 経由の未知プロパティは `createViewer` へそのまま透過する（Q8、BR-H-09）。
- `image`/`photos`/`mode` は UoW-A〜E の `ViewerHandle` メソッド（`loadImage`/`setPhotos`/`setMode`）に対応する宣言的 props（Q3）。

### E2 `PerisphereHandle`（新規、C18）

```ts
import type { ViewerHandle } from "@perisphere/core";

export type PerisphereHandle = ViewerHandle;
```

- 「設計判断」節の通り、`ViewerHandle` の全量エイリアス。`ref.current` は `createViewer()` の戻り値がそのまま入る（`business-logic-model.md` P1）。

### E3 `Perisphere`（新規、C16）

```ts
import { forwardRef } from "react";

export const Perisphere: React.ForwardRefExoticComponent<
  PerisphereProps & React.RefAttributes<PerisphereHandle>
> = forwardRef<PerisphereHandle, PerisphereProps>(function Perisphere(props, ref) {
  /* business-logic-model.md P1〜P5 参照 */
});
```

- `component-methods.md` で確定済みの型シグネチャをそのまま実装する（`React.forwardRef` を使用、Q2 の関連整理: `forwardRef` は React 18/19 いずれでも動作するため、対象 React バージョン範囲（NFR Requirements で確定）によらず利用できる）。
- 内部で Q1 のルート `<div>` をレンダリングする（`frontend-components.md` 参照）。

### E4 `usePerisphere`（新規、C17）

```ts
import { useRef } from "react";

export function usePerisphere(): { ref: React.RefObject<PerisphereHandle | null> } {
  const ref = useRef<PerisphereHandle | null>(null);
  return { ref };
}
```

- `component-methods.md` で確定済みの型シグネチャ（`{ ref: React.RefObject<PerisphereHandle> }`）をそのまま実装する。`useRef<T>(null)` の戻り値型は `RefObject<T | null>` となる（React の型定義上の標準的な挙動）ため、公開型は `RefObject<PerisphereHandle | null>` として明示する。
- 追加の状態（`isReady`/`error` 等）は持たない（本ステージの確定事項、`uow-h-functional-design-plan.md` 参照 — Inception のシグネチャが既に `{ ref }` のみで固定されているため、Functional Design の確認質問としては扱わず本ドキュメントで直接確定）。
