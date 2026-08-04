# Business Rules — UoW-H React アダプタ

- **関連 Issue**: [#46](https://github.com/AtsutoNakayama/perisphere/issues/46)
- **作成日**: 2026-08-04
- **前提資料**: `uow-h-functional-design-plan.md`（Q1〜Q8 回答・採用理由）、`domain-entities.md`、UoW-A `business-rules.md`（BR-A-10 冪等性、SSR セーフティ方針）、UoW-F `business-rules.md`（BR-F-07 Promise reject の握りつぶし）

各ルールには **trace**（対応するストーリー/要件/計画質問）を付す。

## マウント・コンテナ

### BR-H-01 ルート `<div>` の内部レンダリングと `className`/`style` の受け渡し（Q1）

`Perisphere` は常に自身の内部で `<div>` をルート要素としてレンダリングし、`useRef<HTMLDivElement>` で取得したその要素を `createViewer` の `container` に渡す。`PerisphereProps.className`/`style` はこのルート `<div>` にそのまま渡す。呼び出し側はコンテナ DOM を直接扱わない。

- **trace**: US-28（宣言的 props で配置できる）, Q1=A

### BR-H-02 `createViewer`/`dispose` は `useEffect` 内でのみ呼ぶ（SSR セーフティ）

`createViewer` の呼び出しはコンポーネント関数本体（レンダー中）やモジュールトップレベルでは行わず、`useEffect`（クライアントでのマウント後にのみ実行される）内でのみ行う。クリーンアップ関数で `dispose()` を呼ぶ。

- **trace**: NFR-03, US-34（SSR セーフ、React 側のマウント制御）

### BR-H-03 開発時 StrictMode 二重実行はそのまま許容する（Q7）

`useEffect` の二重実行（開発時 `<StrictMode>` による mount→cleanup→mount）を防ぐための独自ガード（`useRef` フラグ等）は設けない。2回目の実行では新しい `ViewerHandle` インスタンスが生成され、1回目のインスタンスは `dispose()` 済みになる。`dispose()` の冪等性（UoW-A〜G で確立済み）に依拠する。

- **trace**: Q7=A（React 公式が推奨する対処方針）

## ref 公開

### BR-H-04 ref は `createViewer` 呼び出し直後に即座に公開する（Q2）

`useImperativeHandle` は `ready` イベントを待たず、`createViewer` が返した `ViewerHandle`（`domain-entities.md` E2）を `useEffect` 内で同期的に設定する。React 層は「準備中」を表す独自の状態を持たない。

- **trace**: Q2=A（コア側の「未 ready でも安全に呼べる」設計との一貫性）

## 宣言的 props の反映

### BR-H-05 `image`/`photos` の優先順位（Q3）

初期マウント時・以降の prop 変更時のいずれも、`photos` が指定されていれば `setPhotos(photos)` のみを呼ぶ（`image` は無視する）。`photos` が指定されておらず `image` が指定されていれば `loadImage(image)` を呼ぶ。両方とも未指定なら何も呼ばない。

- **trace**: US-01〜US-04（単一画像）, US-23（ギャラリー）, Q3=A

### BR-H-06 `image`/`photos`/`mode` の変更検知は参照比較（Q3）

`image`・`photos`・`mode` はそれぞれ個別の `useEffect`（依存配列を該当 prop のみとする）で監視し、直前のレンダリングから**参照が変化した場合にのみ**対応するコア API（`loadImage`/`setPhotos`/`setMode`）を呼び出す。値の中身が同じでも参照が変われば再適用される（呼び出し側がインライン配列リテラル等を渡す場合の挙動として、ドキュメントに明記する）。

- **trace**: US-28（宣言的 props での変更反映）, Q3=A

### BR-H-07 `controls`/`text` は初期化オプションとしてのみ渡す（Q5）

`PerisphereProps.controls`/`text`（`ViewerOptions` 由来）は初期マウント時に `createViewer` の `options` の一部としてのみ渡す。以降の prop 変更を検知して `setControlsVisibility`/`setText` を自動的に呼び出す専用の `useEffect` は設ける**ない**。動的に変更したい場合は呼び出し側が ref 経由で `setControlsVisibility`/`setText` を直接呼ぶ。

- **trace**: Q5=A（コア側の非対称設計〔初期化オプション vs 更新メソッド〕をそのまま踏襲）

### BR-H-08 `ViewerOptions` への未知プロパティの透過（Q8）

`PerisphereProps` から `image`/`photos`/`mode`/`className`/`style`/`onXxx`（8種）を除いた残りのプロパティ（`controls`/`text` を含む、および将来 `ViewerOptions` に追加されるキー）を、分割代入の残余オブジェクトとしてそのまま `createViewer` の `options` に渡す。

- **trace**: US-33（コア非依存の拡張性）, Q8=A

## イベントブリッジ

### BR-H-09 イベントコールバックは最新値を ref に保持し、購読は mount 時1回（Q4）

各 `onXxx` prop の最新の関数値は `useRef` に保持し（レンダリングのたびに代入するのみ）、`ViewerHandle.on(type, handler)` への実際の購読は `useEffect`（依存配列 `[]`）で一度だけ行う。内部 `handler` は常に `ref.current` 経由で最新のコールバックを呼び出す安定した関数であり、購読の張り直しは発生しない。

- **trace**: US-29（イベント購読の信頼性）, Q4=A

### BR-H-10 イベント → コールバックのペイロード変換規則

`ViewerEventMap` の各エントリを対応する `onXxx` コールバックへブリッジする際、次の規則でペイロードを変換する。

| イベント | コールバック | 渡す値 |
|---|---|---|
| `ready` | `onReady` | 引数なし（`ReadyEvent` は `type` 以外のフィールドを持たないため） |
| `error` | `onError` | `event.error`（`PerisphereError`）を**そのまま**渡す（`ErrorEvent` でラップしない） |
| `progress` | `onProgress` | `{ loaded, total }`（`type` を除いたペイロード） |
| `modechange` | `onModeChange` | `{ mode }` |
| `viewchange` | `onViewChange` | `{ yaw, pitch, fov }` |
| `zoomchange` | `onZoomChange` | `{ fov }` |
| `photochange` | `onPhotoChange` | `{ index, total, id? }` |
| `fullscreenchange` | `onFullscreenChange` | `{ active }` |

`ready`/`error` の2件は Inception（`component-methods.md`）のシグネチャに明示済みの特別扱い（`onReady?: () => void` / `onError?: (e: PerisphereError) => void`）を踏襲し、他の6件はイベントオブジェクトから `type` を除いた形を機械的に渡す一貫した規則とする。

- **trace**: US-29, FR-16

## 破棄

### BR-H-11 unmount 時の確実な `dispose()` 呼び出し

`useEffect` のクリーンアップ関数は、`createViewer` が返した `ViewerHandle` の `dispose()` を必ず呼ぶ。`dispose()` は UoW-A〜G で確立済みの冪等な実装のため、BR-H-03（StrictMode 二重実行）の1回目のクリーンアップでも安全に呼べる。

- **trace**: NFR-10（確実なリソース解放）, US-31
