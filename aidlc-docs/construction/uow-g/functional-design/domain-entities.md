# Domain Entities — UoW-G 同梱コントロール UI

- **関連 Issue**: [#44](https://github.com/AtsutoNakayama/perisphere/issues/44)
- **作成日**: 2026-08-04
- **前提資料**: `uow-g-functional-design-plan.md`（Q1〜Q9 回答・採用理由）、`inception/application-design/component-methods.md`（`ViewerHandle` の `setControlsVisibility`/`setText` は Inception で確定済み）、UoW-A `domain-entities.md`（C1/C11/C12）、UoW-C `domain-entities.md`（`listModes`/`registerMode`）、UoW-D `domain-entities.md`（`Keymap`/`KeyboardInputSource`）、UoW-E `domain-entities.md`（`Gallery`/`PhotoInput`）、UoW-F `domain-entities.md`（`FullscreenManager`）
- **注記**: 本ユニットのエンティティ番号（E1〜）はこのドキュメント内で独立採番する。

## エンティティ一覧

| # | 名称 | 種別 | 概要 |
|---|---|---|---|
| E1 | `ControlsUI` | 内部エンティティ（C10、新規） | 素 DOM による同梱コントロールの構築・イベント購読・破棄 |
| E2 | `ControlsVisibility` | 公開型（新規） | コントロールグループごとの表示/非表示指定（Q2） |
| E3 | `UITextMap` | 公開型（新規） | コントロールの文言・aria-label 差し替え用マップ（Q7） |
| E4 | `ViewerOptions`（拡張） | 公開オプション（UoW-A の拡張） | `controls`/`text` を追加（Q2、発見） |
| E5 | `ViewerHandle`（拡張） | 公開ファサード（UoW-A C1 の拡張、Inception 確定済み IF） | `setControlsVisibility`/`setText`/`getPhotoCount` を追加 |
| E6 | `ViewerEventMap.photochange`（拡張） | 値オブジェクト（UoW-E の拡張） | `total: number` を追加（Q5） |

## エンティティ詳細

### E1 `ControlsUI`（C10、新規）

```ts
interface ControlsUIDeps {
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

class ControlsUI {
  constructor(
    container: HTMLElement,
    deps: ControlsUIDeps,
    initialVisibility: ControlsVisibility,
    initialText: UITextMap,
  );
  setVisibility(config: Partial<ControlsVisibility>): void;   // Q2, setControlsVisibility から委譲
  setText(overrides: Partial<UITextMap>): void;                // Q7, setText から委譲
  dispose(): void;                                              // Q9
}
```

- **責務**: `container`（Q1）配下への同梱コントロール DOM の構築、`EventBus` 経由のイベント購読による表示状態の同期、クリック等の DOM イベントを `ControlsUIDeps`（`ViewerHandle` の部分集合）の呼び出しへ変換すること。`unit-of-work.md` が定める「`EventBus`/`State` の購読のみ・疎結合」という方針どおり、`ControlsUIDeps` 以外のコア内部状態（`ViewController`/`Gallery`/`Renderer` 等）には一切直接アクセスしない。`FullscreenManager`（UoW-F）・`Gallery`（UoW-E）・`ViewController`（UoW-D）と同様、DOM/ブラウザ API を扱う内部コンポーネントとして `createViewer` から構築される。
- **`deps`（`ControlsUIDeps`）**: `ViewerHandle` のうち `ControlsUI` が実際に呼び出すメンバーのみを抜き出した部分インターフェース。`createViewer` は自身が組み立てる各メンバー関数（`setMode`/`next`/`enterFullscreen` 等）をそのまま渡す。縮退ハンドル（WebGL2 非対応環境、UoW-A/UoW-F と同じ思想）でも `ControlsUI` 自体は構築される（DOM 操作は `Renderer` に依存しないため）が、`deps` に渡される各関数は縮退ハンドルの安全な no-op 実装（`getPhotoCount` は `0`、`listModes` は `[]` 等）がそのまま使われるため、`ControlsUI` 側で追加の分岐は不要。
- **構築タイミング**: `createViewer` 初期化時、`ViewerOptions.controls`（E4）が `false` でなければ構築する。`false` の場合は `ControlsUI` を一切構築せず、DOM/`<style>` 注入も行わない（Q2、完全ヘッドレス）。
- **`setVisibility`/`setText`**: `ViewerHandle.setControlsVisibility`/`setText`（E5）からそのまま委譲される。`ControlsUI` が未構築（ヘッドレス）の場合、`ViewerHandle` 側のラッパーは安全な no-op になる（BR-G-14）。

### E2 `ControlsVisibility`（新規、Q2）

```ts
export interface ControlsVisibility {
  fullscreen?: boolean;
  zoom?: boolean;
  modeSwitch?: boolean;
  photoNav?: boolean;
  photoIndicator?: boolean;
}
```

- **既定値**: 全キー `true`（すべて表示）。未指定キーは `true` として扱う（BR-G-02）。
- **`modeSwitch`/`photoNav`/`photoIndicator` の実効表示**: この型による明示指定に加え、該当データの有無による自動非表示（Q3、`business-rules.md` BR-G-04/BR-G-05）が重なって最終的な表示可否が決まる。

### E3 `UITextMap`（新規、Q7）

```ts
export interface UITextMap {
  controlsLabel?: string;             // ルート（toolbar）の aria-label
  fullscreenEnterLabel?: string;
  fullscreenExitLabel?: string;
  zoomInLabel?: string;
  zoomOutLabel?: string;
  modeSwitchLabel?: string;
  photoPrevLabel?: string;
  photoNextLabel?: string;
  photoIndicatorItemLabel?: string;   // "{current}"/"{total}" トークンを含められる（Q7）
}
```

- **既定値（内蔵・英語）**:

  ```ts
  const DEFAULT_UI_TEXT: Required<UITextMap> = {
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
  ```

- **プレースホルダトークン**: `photoIndicatorItemLabel` の `{current}`（1始まりの表示位置）・`{total}`（総数）は文字列置換で解決する（Q7）。他の項目は静的文字列としてそのまま使う。
- **i18n**: FR-15 の方針どおり、多言語化自体は利用側の責務。本マップは差し替え手段のみを提供する。

### E4 `ViewerOptions`（拡張、Q2・発見）

```ts
export interface ViewerOptions {
  controls?: boolean | Partial<ControlsVisibility>;
  text?: Partial<UITextMap>;
  [key: string]: unknown;
}
```

- **`controls`（Q2）**: `false` で完全ヘッドレス（`ControlsUI` 自体を構築しない）。省略または `true` で全コントロール表示。部分オブジェクトで個別指定（未指定キーは表示扱い、`ControlsVisibility`（E2）と同じ既定）。
- **`text`（発見・対称設計）**: `setText()`（E5）による構築後の動的変更に加え、初期状態から差し替えたい場合（例: 初期表示から日本語文言にする）に `createViewer` 呼び出し時点で指定できる。`ViewerOptions.controls` と同じ「初期値は options、動的変更は `setXxx()`」という対称パターンを踏襲する（Inception で確定済みの型を破壊しない非破壊的な追加）。

### E5 `ViewerHandle`（拡張）

```ts
export interface ViewerHandle {
  // ...UoW-A〜F で追加済みのメンバー...

  /** 同梱コントロールの表示/非表示を変更する（US-26）。現在の設定へ部分的にマージする。 */
  setControlsVisibility(config: Partial<ControlsVisibility>): void;
  /** 同梱 UI の文言・aria-label を差し替える（US-27）。現在の文言へ部分的にマージする。 */
  setText(overrides: Partial<UITextMap>): void;
  /** 設定済み写真の総数を返す（Q5）。写真が一度も設定されていなければ `0`。 */
  getPhotoCount(): number;
}
```

`component-methods.md` で確定済みのシグネチャ（`setControlsVisibility(config: Partial<ControlsVisibility>): void` / `setText(overrides: Partial<UITextMap>): void`）は変更しない。`getPhotoCount()` は本ステージで新規追加する非破壊的な拡張（Q5）。

### E6 `ViewerEventMap.photochange`（拡張、Q5）

```ts
export interface PhotoChangeEvent {
  type: "photochange";
  index: number;
  total: number;      // 新規追加（Q5）。setPhotos() 時点の写真総数
  id?: string;
}
```

`progress: { loaded, total }`（UoW-B）と同じ「変更イベントのペイロードに変更後の全体量を含める」パターンに一貫する。`total` は `Gallery` の内部配列長（＝ `getPhotoCount()` と同じ値）。
