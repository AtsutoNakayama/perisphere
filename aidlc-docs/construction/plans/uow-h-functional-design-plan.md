# Functional Design Plan — UoW-H React アダプタ

- **関連 Issue**: [#46](https://github.com/AtsutoNakayama/perisphere/issues/46)
- **作成日**: 2026-08-04
- **前提資料**: `inception/application-design/unit-of-work.md`（UoW-H 節）、`components.md`（C16〜C18）/`component-methods.md`（C16〜C18 節）/`services.md`（React アダプタはサービス非再実装の方針）、`requirements.md`（FR-16, NFR-03, NFR-05, NFR-07）、`user-stories/stories.md`（US-28, US-33, US-34）、UoW-A〜G 実装（`packages/core/src/viewer/types.ts` の `ViewerHandle`/`ViewerOptions`/`ViewerEventMap`、`index.ts` のエクスポート面）

**本ファイルは Functional Design（Part 1: 計画）の単一の情報源である。**

## ユニットコンテキスト

- **責務**: `@perisphere/react` パッケージとして、`useEffect` によるクライアントマウント後の `createViewer` 呼び出しと unmount 時の `dispose`（SSR セーフ）、宣言的 props → `ViewerOptions`・イベント → `onXxx` props コールバックのブリッジ、ref 経由での命令ハンドル（`PerisphereHandle`）公開を行う薄いラッパ。コア機能の再実装はしない（`services.md`: 「React アダプタはサービスを再実装しない」）。
- **担当ストーリー**: US-28（React コンポーネント＋フック＋ref 命令ハンドル）、US-33（フレームワーク非依存コア＋アダプタ分離、In MVP 範囲）。補足で US-34（SSR セーフ）の React 側マウント制御にも関与する。
- **依存ユニット**: UoW-A（`ViewerHandle`/`ViewerOptions`/`ViewerEventMap` のみに形式的に依存。コア内部には非依存）。実務上は `ViewerHandle` が委譲する全機能（UoW-B〜G）が出揃った状態での結合検証が前提だが、いずれも main にマージ済み。
- **Inception で既に型として確定済み（本ステージでは変更しない前提）**: `component-methods.md`（C16〜C18 節）に以下の暫定シグネチャが定義済み。
  - `const Perisphere: React.ForwardRefExoticComponent<PerisphereProps & React.RefAttributes<PerisphereHandle>>`
  - `function usePerisphere(): { ref: React.RefObject<PerisphereHandle> }`
  - `interface PerisphereProps extends ViewerOptions { image?; photos?; mode?; onReady?; onError?; onModeChange?; onPhotoChange?; /* ... ViewerEventMap に対応する onXxx */ }`
  - `interface PerisphereHandle { setMode; next; prev; goTo; enterFullscreen; exitFullscreen; getView; setView; }`（`ViewerHandle` の部分集合、例示）

## 技術的な背景整理（レビュー時に確認いただきたい前提）

- `packages/` 配下に `react/` はまだ存在しない（新規パッケージ）。
- 現行の `ViewerHandle`（`packages/core/src/viewer/types.ts`）は UoW-A〜G で確定済みで、`on/off/once`・`getMode/setMode/registerMode/listModes`・`loadImage/registerSource`・`getView/setView/setZoomLimits`・`registerInputSource/setKeymap`・`setPhotos/next/prev/goTo/getPhotoIndex`・`enterFullscreen/exitFullscreen/isFullscreen`・`setControlsVisibility/setText/getPhotoCount`・`dispose` を持つ。`PerisphereHandle` は Inception 時点でこの一部（例示）のみを列挙しており、本ステージで「どこまでを ref 経由で公開するか」を確定する必要がある。
- `ViewerOptions`（同ファイル）は現時点で `controls?`/`text?`/`[key: string]: unknown` を持つ。`PerisphereProps extends ViewerOptions` のため、`controls`/`text` は追加作業なしで props として受け取れる。
- `ViewerEventMap` は `ready`/`error`/`modechange`/`progress`/`viewchange`/`zoomchange`/`photochange`/`fullscreenchange` の8種で確定済み（UoW-A〜G）。`onXxx` ブリッジはこの8種全てが対象になる。
- `createViewer(container: HTMLElement, options?: ViewerOptions): ViewerHandle` は同期関数。`loadImage`/`enterFullscreen`/`exitFullscreen` のみ非同期（`Promise`）で、`setMode`/`setPhotos` 等は同期・かつ呼び出し時点で未 `ready` でも安全に呼べる設計（UoW-A の初期化順序・状態機械、UoW-E の `setPhotos` が1枚目ロードを自動開始する設計）が既に確立している。
- React 本体・`react-dom` はランタイム依存ではなく `peerDependencies` になる想定（`@perisphere/core` の `three` と同じパターン）。対象バージョン範囲自体は NFR Requirements（技術スタック確定）で決める。

## 確認質問（比較情報・推奨案を埋め込み済み）

### Q1. コンテナ要素の所有方式とスタイル受け渡し

`createViewer` は `HTMLElement` を要求するが、`PerisphereProps`（Inception 時点）にはコンテナ用の DOM を渡す/受け取る手段が定義されていない。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `Perisphere` コンポーネントが内部で `<div>` をルート要素としてレンダリングし、`useRef<HTMLDivElement>` でその要素を取得して `createViewer` の `container` に渡す。呼び出し側はこの `<div>` を直接扱わず、`className`/`style` を `PerisphereProps` に追加してルート `<div>` へそのまま渡す（サイズ指定等はこの2つで足りる） | 呼び出し側は他の一般的な React コンポーネント同様に配置できる（自己完結）。`ViewerHandle`（コア）に既にサイズ変更追従（`Renderer.resize()`、UoW-F）があるため、React 側は単に要素を用意するだけでよい |
| B | 呼び出し側があらかじめ用意した DOM 要素/ref を `containerRef` prop として渡し、`Perisphere` はそれを使って `createViewer` を呼ぶだけにする（自身では要素をレンダリングしない） | 呼び出し側の自由度は上がるが、`PerisphereProps` に新しい必須連携（ref の受け渡し）が増え、`usePerisphere()` が「`ref` を1つ生成するだけ」という Inception のシンプルな設計（`{ ref: RefObject<PerisphereHandle> }` のみ）と役割が重複・混乱する。US-28 の受け入れ基準（宣言的 props で配置できる）とも合致しにくい |

**理由**: `PerisphereProps` に `className`/`style` を追加する必要があるかどうかは、Inception には明記されていない公開 API 面の拡張のため確認する。

**採用理由**: US-28 の「宣言的 props で構成できる」を素直に満たし、`usePerisphere()` の役割（命令ハンドル取得の補助のみ）とも整合する A を採用する。

[Answer]: A

### Q2. ref（`PerisphereHandle`）の公開タイミング

`createViewer` は同期関数で、返る `ViewerHandle` は未 `ready` でも安全に呼び出せる設計が UoW-A〜G で確立済み。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `useEffect` 内で `createViewer` を呼んだ直後（同期的に、`ready` イベントを待たず）に `useImperativeHandle` へハンドルを設定し、ref を通じて即座に呼び出し可能にする | コアの `ViewerHandle` 自体が「未 `ready` でも安全に呼べる」設計のため、React 層で追加の状態管理（`isReady` による ref のガード等）を持ち込む必要がない。「サービスを再実装しない／薄いラッパ」という本ユニットの設計方針（`services.md`）に最も忠実 |
| B | `ready` イベント発火まで `useImperativeHandle` の中身を `null` 相当にし、`ready` 後にのみ実体を公開する | コアの安全性設計を React 層で二重に模倣することになり、「薄いラッパ」の方針から外れる。呼び出し側は `ready` を待ってから ref を使う独自ガードを強いられ、コア API を直接使う場合との挙動差異が生まれる |

**理由**: React 層で「まだ準備できていないので待つ」という独自の状態を追加するかどうかは、本ユニットの責務範囲（薄いラッパ）に関わるため確認する。

**採用理由**: コアの既存の安全設計と一貫させる A を採用する。

[Answer]: A

### Q3. 宣言的 props（`image`/`photos`/`mode`）の反映方針・優先順位

`PerisphereProps` は `image?`/`photos?`/`mode?` を持つが、初期マウント後に親コンポーネントが再レンダリングでこれらの値を変更した場合の挙動が Inception では未確定。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | マウント時（`useEffect` 初回実行時）に初期値を適用: `photos` が指定されていれば `setPhotos(photos)` のみを呼ぶ（`photos` が1枚目の自動ロードを内包するため）、`photos` 未指定かつ `image` が指定されていれば `loadImage(image)` を呼ぶ（両方指定時は `photos` を優先）。`mode` が指定されていれば併せて `setMode(mode)` を呼ぶ。以降の再レンダリングでは各 prop を個別の `useEffect`（依存配列 `[photos]`/`[image]`/`[mode]`、参照比較）で監視し、**参照が変化した場合のみ**対応するコア API を呼び出す（呼び出し側が同一配列オブジェクトを毎回生成する場合は変化とみなさない、標準的な React の慣行） | US-28 の「宣言的 props ... で主要機能を操作できる」を初期値だけでなく変更時にも満たす。参照比較は React 標準（`useEffect` 依存配列）と同じ挙動のため、呼び出し側にとって驚きが少ない。`image`/`photos` 同時指定時の優先順位を明確化できる |
| B | 初期マウント時にのみ `image`/`photos`/`mode` を適用し、以降の prop 変更は無視する（後続の変更は ref 経由の命令 API でのみ行う仕様として明記） | 実装は単純だが、「宣言的に写真を切り替える」といった典型的な React の使い方（親の state に応じて `photos`/`mode` を変える）ができず、US-28 の受け入れ基準（宣言的 props と命令的 API の双方で操作できる）の宣言的側を弱める |
| C | 配列の中身まで深い比較を行い、内容が同じであれば参照が変わっても再適用しない | 呼び出し側の実装ミス（インライン配列リテラル等）を吸収できるが、比較コストと実装の複雑さが増し、CLAUDE.md の「タスクが要求する以上の設計をしない」方針に反する。標準的な React コンポーネント（`<img src>` 等）も参照/値の単純比較が通例で、深い比較は一般的でない |

**理由**: 「宣言的 props」という表現が初期値のみを指すのか、変更の都度反映することまで含むのかは受け入れ基準の解釈に直結するため確認する。

**採用理由**: US-28 の宣言的側の受け入れ基準を素直に満たす A を採用する。参照比較の挙動（インライン配列は毎回変化とみなされる）はドキュメント（UoW-I）で明記する。

[Answer]: A

### Q4. イベントコールバック（`onXxx` props）の購読方式

`onReady`/`onError`/`onModeChange`/`onPhotoChange` 等（`ViewerEventMap` の8種に対応）は、呼び出し側が親コンポーネントの再レンダリングごとに新しいインライン関数（例: `onModeChange={() => ...}`）を渡すことが一般的な React の利用パターン。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 各 `onXxx` コールバックの最新値を `useRef` に保持し（レンダリングのたびに更新するのみで購読はし直さない）、`ViewerHandle.on(type, handler)` への実際の購読は `useEffect`（依存配列 `[]`、マウント時1回）で行う。内部の `handler` は `refCurrent.current?.(event)` を呼ぶ安定した関数とする | インライン関数を渡す典型的な使い方でも、レンダリングのたびに `off`/`on` を繰り返さない（購読の抜け漏れやイベント取りこぼしのリスクを避ける）。「最新の関数を ref に保持し、購読自体は安定させる」は React でクロージャの陳腐化を避ける確立されたパターン |
| B | 各 `onXxx` prop の identity（関数の同一性）が変わるたびに `useEffect` の依存配列で検知し、`off` してから `on` し直す | 呼び出し側がインライン関数を渡す一般的なケースで、再レンダリングのたびに購読解除・再購読が発生する。イベント発火と再レンダリングのタイミングが重なった場合に取りこぼしが発生しうる不具合の温床になる |

**理由**: React の一般的な利用パターン（インラインコールバック）でイベント取りこぼしが起きないことを保証する設計かどうかは、US-29（イベント購読、UoW-A 主担当だが本ユニットの `onXxx` ブリッジにも直結）の信頼性に関わるため確認する。

**採用理由**: イベント取りこぼしのリスクを避けられる A を採用する。

[Answer]: A

### Q5. `controls`/`text` props（`ViewerOptions` 由来）の反映方針

`PerisphereProps extends ViewerOptions` のため `controls`/`text` は自動的に props として受け取れるが、`ViewerOptions` は `createViewer` の**初期化オプション**であり、`ViewerHandle` には別途 `setControlsVisibility`/`setText`（UoW-G）という更新用メソッドが存在する。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `controls`/`text` は初期マウント時に `ViewerOptions` の一部として `createViewer` にのみ渡す（Q3 の `image`/`photos`/`mode` とは異なり、専用の再適用 `useEffect` は追加しない）。動的に変更したい場合は ref 経由で `setControlsVisibility`/`setText` を呼ぶ（命令的 API 側に委ねる） | `controls`/`text` はコア側で既に「初期値はオプション、更新は専用メソッド」という非対称な設計（UoW-G）になっており、React 層もこれをそのまま踏襲するのが「薄いラッパ」の方針に最も忠実。`image`/`photos`/`mode`（コア側に更新専用メソッドが元々存在する）とは性質が異なる |
| B | `controls`/`text` も Q3 と同様に変更検知して `setControlsVisibility`/`setText` を都度呼ぶ | 一貫性はあるが、`ViewerOptions.controls`/`text` は「部分マージ」の意味論が異なる（初期化時は全体を規定、`setXxx` は差分マージ）ため、props の変更差分を毎回オプション全体として渡すか差分として渡すかの解釈が曖昧になり、UoW-G が確定した意味論とズレる複雑さを本ユニットに持ち込むことになる |

**理由**: コア側 API の非対称性（初期化オプション vs 更新メソッド）を React 層でどう吸収するかは、公開 props の意味論に関わるため確認する。

**採用理由**: コア側の既存の非対称設計をそのまま踏襲する A を採用する。

[Answer]: A

### Q6. マウント前・エラー時のレンダリング内容

`useEffect` はクライアントでのマウント後にのみ実行される（SSR セーフ、NFR-03）。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `Perisphere` は常に Q1 のルート `<div>` のみを返す（サーバーサイドレンダリング時・クライアントでの初期マウント時・`ready` 前後を問わず同一の DOM 構造）。ローディングプレースホルダやエラー表示用の追加 DOM は持たない | SSR とクライアントの初回レンダリングで DOM 構造が一致し、hydration mismatch が発生しない。エラー表示（`error` イベント）は `onError` プロパティ経由でコールバックとして通知されるのみで、実際のフォールバック表示は呼び出し側の責務とする設計は、コア側の `ErrorManager`（内部詳細を出さない安全なエラー通知、UoW-A）の方針とも整合する |
| B | `ready`/`error` 状態を内部 state として持ち、`ready` 前はプレースホルダ、`error` 時は簡易なエラー表示を追加でレンダリングする | 呼び出し側の実装が減る利点はあるが、「サービスを再実装しない」方針（`services.md`）に反し、SSR 時の DOM とクライアント初回レンダリング時の DOM が食い違う（hydration mismatch）リスクを生む。エラー表示の文言・スタイルという UoW-G の責務領域に React 層が踏み込むことにもなる |

**理由**: SSR との整合性（hydration mismatch 回避）と本ユニットの責務範囲（薄いラッパ）の両方に関わる設計判断のため確認する。

**採用理由**: hydration の安全性と「薄いラッパ」の方針を優先する A を採用する。

[Answer]: A

### Q7. 開発時の StrictMode 二重実行（mount→cleanup→mount）への対応方針

React 18/19 の開発モード（`<StrictMode>`）は副作用の耐性を検証するため、`useEffect` を意図的に「マウント→クリーンアップ→再マウント」の順で二重実行する。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 特別なガードを設けず、二重実行をそのまま許容する設計にする。1回目の `useEffect` で `createViewer`→（クリーンアップで）`dispose`、2回目の `useEffect` で改めて `createViewer` が呼ばれ、新しい `ViewerHandle` インスタンスが生成される。同じルート `<div>`（Q1）を使い回せることは `dispose()` が冪等（UoW-A〜G で確立済み）であることから問題にならない | React 公式が推奨する対処方針（副作用を二重実行に耐えられる形で書く）に従う。`dispose()` の冪等性という既存の設計資産をそのまま活用でき、React 層に追加のガード状態（「初回か2回目か」を判定するフラグ等）を持ち込まずに済む |
| B | `useRef` によるガードフラグ（例: `didInit`）で2回目の `createViewer` 呼び出しを抑制する | StrictMode の意図（副作用の非耐性を検出する）を実質的に無効化するアンチパターンで、React 公式ドキュメントも非推奨としている。本番ビルド（StrictMode 無効）との挙動差異を意図的に作ることにもなる |

**理由**: 開発体験（StrictMode 下でのコンソール警告やパフォーマンス）に関わるため、意図的な設計判断として確認する。

**採用理由**: React の推奨パターンに従う A を採用する。

[Answer]: A

### Q8. `ViewerOptions` の索引シグネチャ（`[key: string]: unknown`）経由の未知プロパティの扱い

`ViewerOptions` は将来の拡張に備えた索引シグネチャを持つ。`PerisphereProps extends ViewerOptions` のため、型上は任意のキーを props として渡せる。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `PerisphereProps` のうち `image`/`photos`/`mode`/`onXxx`（8種）/`className`/`style`（Q1）を除いた残りのプロパティを、`ViewerOptions` としてそのまま `createViewer` に渡す（分割代入で既知キーを取り除いた残余オブジェクトを渡す）。将来 `ViewerOptions` に新しいキーが追加されても、本ユニットのコード変更なしに React 層を素通りする | `ViewerOptions` 側で新しいオプションが追加されるたび（例えば将来の UoW-A〜G 系列の拡張）に React 層を改修する必要がなくなり、「コアへ委譲するだけの薄いラッパ」という方針に最も忠実。`controls`/`text`（現時点で確定済みの2キー）も自然にこの経路でカバーされる |
| B | 現時点で `ViewerOptions` に存在が確定しているキー（`controls`/`text`）のみを明示的に props から取り出して `createViewer` に渡す。索引シグネチャ経由の未知プロパティは無視する | 明示的で分かりやすいが、`ViewerOptions` が将来拡張されるたびに本ユニット（`@perisphere/react`）側の改修が必要になり、「コア非依存の拡張性」（US-33 の意図）にわずかに反する |

**理由**: 型の索引シグネチャという設計上の拡張余地を、React 層の実装がどこまで機械的に活かすかは今後の保守性に関わるため確認する。

**採用理由**: 将来のコア拡張に追従しやすい A を採用する。

[Answer]: A

## 比較検討サマリ

判断軸: (1) 「サービスを再実装しない・薄いラッパに徹する」（`services.md`）を最優先し、コア側（UoW-A〜G）で既に確立された設計（未 `ready` でも安全な呼び出し、`dispose()` の冪等性、初期化オプションと更新メソッドの非対称性）をそのまま踏襲する、(2) US-28 の受け入れ基準（宣言的 props と命令的 ref API の双方で操作できる）を props の初期値だけでなく変更時にも満たす、(3) React の一般的な利用パターン（インラインコールバック・StrictMode 二重実行・SSR hydration）に対して驚きの少ない・確立された対処を選ぶ、(4) 本ユニットの責務を超える設計（エラー表示 UI・ローディング UI 等、UoW-G の領域）に踏み込まない。

## 次のステップ（Step 6: 成果物生成、承認後）

- [ ] `aidlc-docs/construction/uow-h/functional-design/domain-entities.md`
- [ ] `aidlc-docs/construction/uow-h/functional-design/business-rules.md`
- [ ] `aidlc-docs/construction/uow-h/functional-design/business-logic-model.md`
- [ ] `aidlc-docs/construction/uow-h/functional-design/frontend-components.md`（`Perisphere` コンポーネント・`usePerisphere` フックの構造）
