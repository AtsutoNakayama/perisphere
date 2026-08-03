# Domain Entities — UoW-F フルスクリーン

- **関連 Issue**: [#42](https://github.com/AtsutoNakayama/perisphere/issues/42)
- **作成日**: 2026-08-03
- **前提資料**: `uow-f-functional-design-plan.md`（Q1〜Q8 回答・採用理由）、`inception/application-design/component-methods.md`（`ViewerHandle` の fullscreen 関連メンバーは Inception で確定済み）、UoW-A `domain-entities.md`（C1/C11/C12/C14/C15）、UoW-D `domain-entities.md`（`InputIntent`/`Keymap` の `toggleFullscreen`）
- **注記**: 本ユニットのエンティティ番号（E1〜）はこのドキュメント内で独立採番する。

## エンティティ一覧

| # | 名称 | 種別 | 概要 |
|---|---|---|---|
| E1 | `FullscreenManager` | 内部エンティティ（C9、新規） | ネイティブ Fullscreen API / 擬似フルスクリーンの一本化された状態管理と切替 |
| E2 | `FullscreenMode` | 内部値オブジェクト（新規） | `FullscreenManager` が保持する現在の実現方式（`"none" \| "native" \| "pseudo"`） |
| E3 | `PerisphereErrorCode`（拡張） | 公開列挙型（UoW-A の拡張） | `FULLSCREEN_FAILED` を追加（Q6） |
| E4 | `ViewerState`（拡張） | 値オブジェクト（UoW-A C12 の拡張） | `isFullscreen: boolean` を追加 |
| E5 | `ViewerEventMap`（拡張） | 値オブジェクト（UoW-A C11 の拡張） | `fullscreenchange: FullscreenChangeEvent` を追加 |
| E6 | `ViewerHandle`（拡張） | 公開ファサード（UoW-A C1 の拡張、Inception 確定済み IF） | `enterFullscreen`/`exitFullscreen`/`isFullscreen` を追加 |
| E7 | `Renderer`（拡張） | 内部エンティティ（UoW-A C3 の拡張） | `resize(): void` を追加（Q8） |

## エンティティ詳細

### E1 `FullscreenManager`（C9、新規）

```ts
class FullscreenManager {
  constructor(container: HTMLElement, onChange: (active: boolean) => void);
  enter(): Promise<void>;   // Q1: container を対象、Q2: 非対応時は擬似フォールバック
  exit(): Promise<void>;
  isActive(): boolean;
  dispose(): void;          // Q7: フルスクリーン中なら自動解除、リスナー解除
}
```

- **責務**: `container`（Q1）のネイティブ Fullscreen API 切替、非対応環境での擬似フルスクリーン（Q2）、`document` の `fullscreenchange` イベント購読による外部要因（Esc・ブラウザ UI 操作等）との状態同期（Q5）を一手に引き受ける。`EventBus`/`ErrorManager` は直接扱わず、状態が変化するたびにコンストラクタで受け取った `onChange` コールバックを呼ぶだけに留める。実際の `fullscreenchange` イベント発火・`error` イベント発火は `createViewer` 側のオーケストレーション層が担う（UoW-D `InputManager`（`onIntent` コールバック）・UoW-E `Gallery`（副作用フリーな計算結果の返却）と同じ「DOM/ブラウザ API を扱う内部コンポーネントは通知のみ、実際の EventBus/ErrorManager 呼び出しはオーケストレーション層」という責務分離パターンを踏襲する）。
- **`onChange` が呼ばれるタイミング**: (1) `enter()`/`exit()` によって自ら状態を変えたとき、(2) `document` の `fullscreenchange` イベント（Esc キー等、`FullscreenManager` の外側で発生したネイティブフルスクリーンの終了/開始）を検知したとき、の両方。呼び出し元（`createViewer`）はこの2つの経路を区別する必要がなく、常に「現在の `active` 値」だけを受け取ればよい。
- **`enter()`（Q1/Q2/Q4）**: 既に `isActive()` なら何もせず解決する（冪等、BR-F-01）。`container.requestFullscreen` が関数として存在すればネイティブ Fullscreen API を試行し、失敗（reject）した場合はそのまま reject する（呼び出し元が `FULLSCREEN_FAILED` として正規化する、Q4/BR-F-04）。存在しなければ擬似フルスクリーン（Q2）を同期的に適用する（失敗しうる操作がないため常に解決する）。
- **`exit()`（Q4）**: 既に非アクティブなら何もせず解決する（冪等）。ネイティブモードなら `document.exitFullscreen()` を試行し、失敗した場合はそのまま reject する。擬似モードならスタイルを復元する（常に解決する）。
- **ネイティブモードの状態遷移は `fullscreenchange` リスナーに一本化（Q5）**: `enter()`/`exit()` はネイティブ API の呼び出し（成功/失敗の判定）のみを行い、`mode`（E2）の更新と `onChange` 呼び出し自体は行わない。実際の `mode` 更新・`onChange` 呼び出しは、`document` の `fullscreenchange` イベントを検知した内部ハンドラが一元的に行う。これにより「自ら `exitFullscreen()` を呼んだ場合」と「Esc キーで外部から終了した場合」を同じ1本のコードパスで扱え、状態の二重管理・食い違いを避けられる。
- **`dispose()`（Q7）**: `mode` がネイティブなら `document.exitFullscreen()` を呼び出す（結果を待たない。`DisposeFn = () => void` という同期シグネチャ〔`DisposableRegistry`〕に合わせるための意図的な fire-and-forget、BR-F-07）。擬似モードならスタイルを同期的に復元する。いずれの場合も `document` の `fullscreenchange` リスナーと（擬似モード中であれば）`Escape` キーリスナーを解除する。

### E2 `FullscreenMode`（内部値オブジェクト、新規）

```ts
type FullscreenMode = "none" | "native" | "pseudo";
```

- **設計方針**: `FullscreenManager`（E1）が「非アクティブ」「ネイティブ Fullscreen API 使用中」「擬似フルスクリーン使用中」の3状態を明示的に区別するための内部専用の型。`isActive()` は `mode !== "none"` として計算される（呼び出し元にとってはネイティブ/擬似の区別は不要なため、`ViewerHandle.isFullscreen()`（E6）や `fullscreenchange`（E5）では単純な `boolean` に折りたたむ）。

### E3 `PerisphereErrorCode`（拡張、Q6）

```ts
export type PerisphereErrorCode =
  | "IMAGE_LOAD_FAILED"
  | "WEBGL_UNSUPPORTED"
  | "CONTEXT_LOST"
  | "INVALID_INPUT"
  | "UNSUPPORTED_FORMAT"
  | "FULLSCREEN_FAILED";   // 新規追加（Q6）
```

- **`FULLSCREEN_FAILED` の発火条件**: `enterFullscreen()`/`exitFullscreen()`（E6）が、対応環境（ネイティブ Fullscreen API が存在する環境）において実行時にブラウザから拒否された場合（例: ユーザー操作起点でない呼び出し、Permissions Policy による制限）。**非対応環境での擬似フォールバック（Q2）はこのコードの対象外**（擬似フォールバックはエラーではなく正常な代替動作のため、`FULLSCREEN_FAILED` は発火しない。BR-F-04 参照）。

### E4 `ViewerState`（拡張）

```ts
export interface ViewerState {
  mode: ViewerModeId;
  ready: boolean;
  loadState: "idle" | "loading" | "ready" | "error";
  lastError: PerisphereError | null;
  imageLoadState: ImageLoadState;
  view: ViewState;
  photoIndex: number;
  isFullscreen: boolean;   // 新規追加。初期値 false（C12 の責務「フルスクリーン状態」部分）
}
```

`isFullscreen()`（E6）はこのフィールドをそのまま返す。`FullscreenManager.isActive()`（E1）の値が変化するたび（`onChange` 経由）にこのフィールドを更新する。

### E5 `ViewerEventMap`（拡張）

```ts
/** フルスクリーン状態変化通知（Q5）。自らの enterFullscreen()/exitFullscreen() 呼び出し・
 *  外部要因（Esc キー等）によるネイティブフルスクリーン終了のいずれでも発火する。 */
export interface FullscreenChangeEvent {
  type: "fullscreenchange";
  active: boolean;
}

export interface ViewerEventMap {
  ready: ReadyEvent;
  error: ErrorEvent;
  modechange: ModeChangeEvent;
  progress: ImageProgressEvent;
  viewchange: ViewChangeEvent;
  zoomchange: ZoomChangeEvent;
  photochange: PhotoChangeEvent;
  fullscreenchange: FullscreenChangeEvent;   // 新規追加
}
```

- **`component-methods.md` からの精緻化**: Inception の擬似定義は `fullscreenchange:{ active: boolean }`（`type` フィールドなし）だったが、`viewer/types.ts` の既存イベント型は全て判別用の `type: "..."` リテラルを持つ実装済みパターンがあるため、`FullscreenChangeEvent` もこれに合わせる（UoW-D/UoW-E での同様の精緻化と同じ）。ペイロードの意味（`active`）自体は変更しない。

### E6 `ViewerHandle`（拡張）

```ts
export interface ViewerHandle {
  // ...UoW-A〜E で追加済みのメンバー...

  /**
   * フルスクリーン表示に切り替える（US-21）。対応環境ではネイティブ Fullscreen API を、
   * 非対応環境（iOS Safari 等）では擬似フルスクリーンを使用する（Q2=A）。
   * 既にフルスクリーン中の場合は何もせず解決する（Q1 冪等）。
   * ネイティブ API が対応環境で実行時に拒否された場合は `error`（`FULLSCREEN_FAILED`）を
   * 発火しつつ reject する（Q4=A）。
   */
  enterFullscreen(): Promise<void>;
  /** フルスクリーン表示を解除する（US-21）。既に非フルスクリーンの場合は何もせず解決する。 */
  exitFullscreen(): Promise<void>;
  /** 現在フルスクリーン表示中かどうかを返す（ネイティブ・擬似いずれも `true`）。 */
  isFullscreen(): boolean;
}
```

`component-methods.md` で確定済みのシグネチャ（`enterFullscreen(): Promise<void>` / `exitFullscreen(): Promise<void>` / `isFullscreen(): boolean`）は変更しない。挙動の詳細（対象要素・フォールバック方式・失敗時挙動）を本ステージで確定する。

### E7 `Renderer`（拡張、Q8）

```ts
class Renderer {
  // ...UoW-A〜D で追加済みのメンバー...

  /** container の現在のサイズでカメラのアスペクト比・WebGL キャンバスサイズを再計算する（Q8）。 */
  resize(): void;
}
```

- **責務**: `container.clientWidth`/`clientHeight` を読み直し、`camera.aspect` の更新（`updateProjectionMatrix()` 呼び出し込み）と `webglRenderer.setSize()` を行う。初期化時のサイズ設定処理（`Renderer.buildSceneGraph`）と同じ計算をコンテナサイズ変化後に再実行できるようにしたもの。フルスクリーン切替（enter/exit 完了後）にオーケストレーション層（`FullscreenManager.onChange`）から呼び出される（Q8=A、スコープはフルスクリーン切替時のみ）。
