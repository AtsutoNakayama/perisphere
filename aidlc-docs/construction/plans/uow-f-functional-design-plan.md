# Functional Design Plan — UoW-F フルスクリーン

- **関連 Issue**: [#42](https://github.com/AtsutoNakayama/perisphere/issues/42)
- **作成日**: 2026-08-03
- **前提資料**: `inception/application-design/unit-of-work.md`（UoW-F 節）、`components.md`（C9）/`component-methods.md`（C1 `ViewerHandle` の fullscreen 関連メンバー）/`services.md`（S6 `PresentationControlService`）、`requirements.md`（FR-10）、`user-stories/stories.md`（US-21, US-22）、UoW-A/UoW-D 実装（`packages/core/src/viewer/`, `packages/core/src/interaction/`）

**本ファイルは Functional Design（Part 1: 計画）の単一の情報源である。**

## ユニットコンテキスト

- **責務**: Fullscreen API による表示のフルスクリーン切替（`enterFullscreen()`/`exitFullscreen()`/`isFullscreen()`）、非対応環境（iOS Safari 等）でのフォールバック、状態変化の `fullscreenchange` イベント発火
- **担当ストーリー**: US-21（フルスクリーン切替 API/UI/キーボードとイベント。UI 自体は UoW-G の範囲で、本ユニットは API・状態管理のみ）、US-22（非対応環境でのフォールバック）
- **依存ユニット**: UoW-A（`EventBus`/`ViewerState`/`ViewerHandle`/`DisposableRegistry` 基盤、マージ済み）
- **既存の型・IF（Inception で確定済み・変更しない前提）**: `ViewerHandle.enterFullscreen(): Promise<void>` / `exitFullscreen(): Promise<void>` / `isFullscreen(): boolean`（`component-methods.md`）

## 技術的な背景整理（レビュー時に確認いただきたい前提）

- `packages/core/src/interaction/types.ts` の `InputIntent`（`toggleFullscreen`）と `Keymap`（既定キー `["f"]`）は UoW-D で先行実装済み。しかし `createViewer.ts` の `handleInputIntent` 内では次のように意図的に no-op になっている:

  ```ts
  case "toggleFullscreen":
    // BR-D-16: UoW-F（フルスクリーン）が未実装のため安全に無視する。
    break;
  ```

  本ユニットでは `toggleFullscreen` を `isFullscreen()` の値に応じて `enterFullscreen()`/`exitFullscreen()` へ結線する。
- `ViewerHandle`（`packages/core/src/viewer/types.ts`）に `enterFullscreen`/`exitFullscreen`/`isFullscreen` は未追加。`ViewerEventMap` にも `fullscreenchange` イベントは未追加であり、本ステージで型を確定する。
- **本ステージで発見したギャップ**: `packages/core/src/viewer/Renderer.ts` は初期化時（`container.clientWidth`/`clientHeight`）にのみ WebGL キャンバスのサイズを設定しており、以後コンテナのサイズが変化してもキャンバスは追従しない（`ResizeObserver` 等は未実装）。Inception のどの FR/NFR にもコンテナリサイズ追従への言及はない。フルスクリーン切替はブラウザがコンテナ（または `documentElement`）のサイズを大きく変えるため、この追従がないと「フルスクリーン化はしたがキャンバスは小さいまま」という破綻した見た目になる。この点は Q8 で本ユニットのスコープとして扱う範囲を確定する。
- SSR セーフティ（`component-dependency.md` 既定方針）: ブラウザ API（`document.fullscreenEnabled`/`Element.prototype.requestFullscreen` 等）への参照は module トップレベルでは行わず、`createViewer` のクライアント初期化以降に限定する（C3/C7/C9/C10 共通の既存方針を踏襲）。

## 確認質問（比較情報・推奨案を埋め込み済み）

### Q1. フルスクリーン化する対象要素

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `createViewer` に渡された `container`（ビューワーの DOM コンテナ）をフルスクリーン化する | FR-10 の文言「**ビューワーを**フルスクリーン表示に切り替え」を素直に反映する。ページ内の他要素（キャプション・ナビ等、呼び出し側が `container` の外に配置したもの）をフルスクリーンの外に保てるため、ライブラリとして埋め込み可能な設計方針（NFR-08）と整合する。他の 360° ビューワーライブラリでも一般的な方式 |
| B | `document.documentElement`（ページ全体）をフルスクリーン化する | 実装は単純だが、呼び出し側がページ内の他要素と組み合わせて `container` を配置している場合（例: キャプションバー付きギャラリー）、それらもまとめてフルスクリーン化されてしまい制御できない |

**理由**: A・B いずれも技術的に実装可能だが、ライブラリとしての被埋め込み性を優先するか、実装の単純さを優先するかで結論が変わるため確認する。

**採用理由**: FR-10 の文言と NFR-08 の被埋め込み方針を優先し、A（`container` をフルスクリーン化）を採用する。

[Answer]: A

### Q2. 非対応環境（Fullscreen API 非対応）でのフォールバック方式

FR-10 は非対応環境（iOS Safari 等）で「代替動作（擬似フルスクリーン等、設計で確定）にフォールバックする」ことを受け入れ基準として明記しており、本ユニットで確定が必須の事項。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `container`（Q1）に `position: fixed; inset: 0; z-index: <最大値>` 等のインラインスタイルを直接適用する「擬似フルスクリーン」を実装する。解除時は変更前のインラインスタイルを保持しておき復元する | 呼び出し側に何のCSS準備も要求せず、ライブラリ単体で完結する。ネイティブ Fullscreen API と同じ `enterFullscreen()`/`exitFullscreen()`/`isFullscreen()` の1つの契約で両ケースを吸収でき、利用側の分岐が不要 |
| B | ライブラリは `container` に特定の CSS クラス名（例: `perisphere-fullscreen`）を付け外しするだけに留め、実際のスタイル定義は呼び出し側の CSS に委ねる | ホストページのスタイル体系に統合しやすい半面、呼び出し側がクラスに対応する CSS を用意し忘れると「フォールバックしたのに何も起きない」という壊れた体験になり、FR-10 の受け入れ基準（フォールバックの動作保証）を満たせない可能性がある |

**理由**: ライブラリ単体で受け入れ基準（非対応環境でも確実にフォールバック動作する）を満たせるか、ホスト側のCSS準備に依存するかの判断が必要なため確認する。

**採用理由**: FR-10 の受け入れ基準をライブラリ単体で確実に満たせる A（インラインスタイル方式の擬似フルスクリーン）を採用する。

[Answer]: A

### Q3. 擬似フルスクリーン中の Esc キーでの解除

ネイティブ Fullscreen API には「Esc キーで自動的に退出する」というブラウザ標準の挙動があるが、Q2 の擬似フルスクリーン（CSS ベース）にはブラウザ標準のそうした挙動が存在しない。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 擬似フルスクリーン中は独自に `keydown`（`Escape`）のリスナーを一時的に追加し、`exitFullscreen()` と同じ処理で解除する。ネイティブ Fullscreen API 使用時はブラウザ標準の Esc 挙動にまかせ、独自リスナーは追加しない | ネイティブ環境と擬似環境で「Esc で閉じる」という利用者体験を揃えられる。US-21 の意図（キーボードでの切替）とも自然に合致する |
| B | 擬似フルスクリーンでは Esc 対応を行わない。解除は `exitFullscreen()` の明示呼び出し（同梱 UI の閉じるボタンや `toggleFullscreen` キー〔既定 `f`〕）のみに限定する | 実装はシンプルだが、ネイティブ環境に慣れた利用者が非対応環境（iOS Safari 等）で Esc（該当する場合）や直感的な操作で閉じられず戸惑う可能性がある |

**理由**: ネイティブ/擬似で体験を統一する追加実装コストを払うかどうかの判断のため確認する。

**採用理由**: ネイティブ・擬似間で一貫した「Esc で閉じる」体験を提供する A を採用する。

[Answer]: A

### Q4. ネイティブ Fullscreen API 呼び出し自体が失敗（reject）した場合の挙動

Fullscreen API が存在する環境でも、`requestFullscreen()` はユーザー操作起点でない呼び出しや Permissions Policy 制限などにより実行時に reject されうる。これは「非対応環境」（Q2 のフォールバック対象）とは異なる、対応環境での実行時エラー。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `error` イベント（新規エラーコード、Q6）を発火しつつ `enterFullscreen()` の返す `Promise` を reject する。Q2 の擬似フォールバックへは自動的に切り替えない | 既存の `loadImage()` の失敗時パターン（`BR-B-11`: `error` 発火 + reject、直前の表示を維持）と対称的で一貫性がある。実行時エラーで勝手に擬似フルスクリーンへ切り替わると、「なぜ急に挙動が変わったか」が利用者・呼び出し側双方にとって不透明になる |
| B | reject を検知したら自動的に Q2 の擬似フルスクリーンにフォールバックする | 「とにかくフルスクリーン相当の見た目にする」という結果は得られるが、本来 FR-10 が要求するフォールバックは「非対応環境」向けであり、対応環境での一時的な失敗（例: ユーザー操作起点でない呼び出し）まで擬似モードに倒すのは受け入れ基準の意図を超えた拡大解釈になる |

**理由**: 「非対応環境向けフォールバック」と「対応環境での実行時エラー」を同一視してよいかは設計判断であり、既存の `loadImage()` パターンとの整合性の観点から確認する。

**採用理由**: `loadImage()`（`BR-B-11`）と対称的な「`error` 発火 + reject」を踏襲し、「非対応環境向けフォールバック」と「対応環境での実行時エラー」を明確に区別する A を採用する。

[Answer]: A

### Q5. 外部要因（ブラウザ UI 操作等）によるネイティブフルスクリーン終了時の状態同期

ネイティブ Fullscreen API では、利用者がブラウザの UI（Esc キー、ブラウザ標準の「フルスクリーン終了」ボタン等）から直接フルスクリーンを終了できる。この場合 `exitFullscreen()` は呼ばれないため、ライブラリ側の内部状態が実際のブラウザ状態と食い違う可能性がある。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `document` の標準 `fullscreenchange` イベントを購読し、実際のブラウザ状態（`document.fullscreenElement === container` か）と内部状態を常に同期する。状態が変化していれば `ViewerEventMap` の `fullscreenchange` イベントを発火する | これを行わないと `isFullscreen()` が実際のブラウザ状態と乖離したまま `true` を返し続けるバグになる。ネイティブ API を使う以上、ブラウザ起点の状態変化を正として追従するのが唯一の正しい実装 |
| B | 内部状態は自前の `enterFullscreen()`/`exitFullscreen()` 呼び出し時のみ更新し、ブラウザの `fullscreenchange` イベントは購読しない | 実装は簡単だが、Esc キー等での終了後も `isFullscreen()` が `true` のままになり、US-21 が求める「状態変化イベント」の発火保証（FR-10）を満たせない |

**理由**: A が技術的に正しい唯一の選択に見えるが、`document` レベルのグローバルイベント購読を追加すること（購読・解除のタイミング、`Disposable` との関係）を明示的に確認したいため質問とする。

**採用理由**: `isFullscreen()`/`fullscreenchange` の正しさを保証できる唯一の方式である A を採用する。購読は `createViewer` 初期化時に開始し、`Disposable`（Q7）で解除する。

[Answer]: A

### Q6. `PerisphereErrorCode` へのフルスクリーン専用エラーコード追加

既存の `PerisphereErrorCode`（`IMAGE_LOAD_FAILED` / `WEBGL_UNSUPPORTED` / `CONTEXT_LOST` / `INVALID_INPUT` / `UNSUPPORTED_FORMAT`）はいずれも本ユニットの失敗シナリオ（Q4: ネイティブ API 呼び出しの実行時失敗）にそのまま流用できるものがない。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 新規コード `FULLSCREEN_FAILED` を `PerisphereErrorCode` に追加する | 既存の `IMAGE_LOAD_FAILED`/`WEBGL_UNSUPPORTED`/`CONTEXT_LOST` と同様、失敗の性質ごとに専用コードを割り当てる既存パターンと一貫する。呼び出し側が `error` イベントの `code` で原因を判別できる |
| B | 既存の `INVALID_INPUT` を流用する | `INVALID_INPUT` は「呼び出し側が渡した値が不正」という意味論（`setView`/`setZoomLimits`/`goTo` 等）であり、Q4 のケース（値は正しいがブラウザ側の実行時制約で失敗）とは性質が異なり誤解を招く |

**理由**: 型定義（`PerisphereErrorCode`）への破壊的でない追加だが、公開型の拡張は明示確認すべき事項のため質問とする。

**採用理由**: 既存の失敗コード分類パターンと一貫する A（`FULLSCREEN_FAILED` を新規追加）を採用する。

[Answer]: A

### Q7. `dispose()` 時、フルスクリーン中であれば自動的に解除するか

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `FullscreenManager` を `DisposableRegistry` に登録し、`dispose()` 時にフルスクリーン中（ネイティブ・擬似いずれも）であれば自動的に解除する | NFR-10（SECURITY-15: リソース・状態を確実に解放する）と一貫する。ビューワーを破棄したのにブラウザがフルスクリーンのまま（あるいは擬似フルスクリーンの固定配置スタイルが `container` に残ったまま）という利用者にとって不可解な状態を防ぐ |
| B | 明示的に解除しない（呼び出し側の責任とする） | 実装は単純だが、`dispose()` 後もページがフルスクリーンのまま、または擬似フルスクリーン用のインラインスタイルが `container` に残留し、呼び出し側がその後の DOM 操作で意図しない見た目になるリスクがある |

**理由**: 既存の `Disposable` 群（C3/C4/C7/C9/C10/C11）と同じ「確実な解放」方針を踏襲するかの確認。

**採用理由**: NFR-10（SECURITY-15）と既存 `Disposable` 群の方針を踏襲する A を採用する。

[Answer]: A

### Q8. フルスクリーン切替時の `Renderer` リサイズ追従（本ステージで発見したギャップへの対応範囲）

「技術的な背景整理」で述べた通り、`Renderer` は初期化時のみキャンバスサイズを設定し、以後のコンテナサイズ変化には追従しない。フルスクリーン切替はこの問題を顕在化させる。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 本ユニットの責務を「フルスクリーン切替（enter/exit）の前後で `Renderer` にサイズ再計算を1回指示する」ことに限定する（`Renderer` に `resize()` 等のメソッドを追加し、`FullscreenManager`/オーケストレーション層がフルスクリーン切替の完了後に呼び出す）。フルスクリーンと無関係な任意タイミングでのコンテナサイズ変化への汎用追従（`ResizeObserver` 等）は、Inception のどの FR/NFR にも記載がない別スコープの課題として扱い、本ユニットでは着手しない（必要であれば別 Issue を起票） | FR-10（フルスクリーン切替）の受け入れ基準を満たすために必要最小限の対応に留め、本ユニットの責務外（汎用リサイズ対応）まで拡張しない。既存の各ユニットが踏襲してきた「発見したギャップは狭く直す」方針（例: UoW-C の `setSphereTexture` マテリアル非依存化、UoW-D の `imageLoadState` 初期化漏れ修正）と一貫する |
| B | 汎用的な `ResizeObserver` によるコンテナサイズの常時追従もあわせて本ユニットで実装し、リサイズ未対応というギャップ自体を解消する | 発見した問題を根本から解消できるが、UoW-F（フルスクリーン）という単位の責務を超えた範囲（あらゆるレイアウト変化への追従）に踏み込むスコープ拡大であり、CLAUDE.md の「タスクが要求する以上の設計をしない」方針に反する |
| C | リサイズ追従は一切実装しない | フルスクリーンにしてもキャンバスサイズが変わらないという、実質的に FR-10 の受け入れ基準（フルスクリーン表示への切替）を満たさない壊れた挙動になるため推奨しない |

**理由**: Inception で見えていなかったスコープの拡張判断であり、本ユニットの責務境界を明確にする必要があるため確認する。

**採用理由**: FR-10 の受け入れ基準を満たすための必要最小限の範囲に留める A を採用する。汎用リサイズ対応（`ResizeObserver`）は別課題として切り出す。

[Answer]: A

## 比較検討サマリ

判断軸: (1) 既存の UoW-A/UoW-B/UoW-D で確立済みの設計パターン（`error` 発火 + Promise reject、`Disposable` による確実な解放、SSR セーフティ）との一貫性を最優先する、(2) FR-10 の受け入れ基準（対応環境での切替・非対応環境でのフォールバック・状態変化イベント）を確実に満たす、(3) 「非対応環境向けフォールバック」と「対応環境での実行時エラー」を混同しない、(4) 本ステージで発見したリサイズ未追従のギャップは、本ユニットの責務（フルスクリーン切替）に必要な最小範囲でのみ解消し、汎用リサイズ対応という別スコープへ拡大しない。

## 次のステップ（Step 6: 成果物生成、承認後）

- [ ] `aidlc-docs/construction/uow-f/functional-design/domain-entities.md`
- [ ] `aidlc-docs/construction/uow-f/functional-design/business-rules.md`
- [ ] `aidlc-docs/construction/uow-f/functional-design/business-logic-model.md`
