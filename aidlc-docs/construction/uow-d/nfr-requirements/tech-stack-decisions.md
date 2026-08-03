# Tech Stack Decisions — UoW-D 視点操作・入力

- **関連 Issue**: [#38](https://github.com/AtsutoNakayama/perisphere/issues/38)
- **作成日**: 2026-08-03
- **前提資料**: `uow-d-nfr-requirements-plan.md`（Q1〜Q7 回答・採用理由）
- **注記**: パッケージマネージャ・ビルドツール・テストランナー・PBT ライブラリ・Lint/フォーマッタ・TypeScript strictness・three.js peerDependencies range・ES2020 ターゲット等のモノレポ横断決定（UoW-A で確定）は変更なくそのまま適用する。本ドキュメントは UoW-D 固有の決定のみを扱う。

## 1. `viewchange`/`zoomchange` の発火頻度制御（Q1）

- **決定**: `pointermove`/`touchmove`/`wheel` 由来の高頻度な視点更新は、`requestAnimationFrame` ベースで「そのフレーム内の最後の値のみ」へ集約して `viewchange`/`zoomchange` を発火する（UoW-B の `Throttled Progress Emission`（PP-B-1）と同じ思想）。
- **描画反映との分離**: `currentMode.updateView(ctx, view)` によるカメラ/シェーダへの実際の反映は、この集約とは独立して intent 受信のたびに即座に行う。滑らかな描画（NFR-01）はこちらが担保し、EventBus 発火の間引きは「将来の購読者（UoW-G 等）の負荷軽減」が目的であることを明確に分離する。
- **低頻度経路**: キーボード操作（1回の押下＝1ステップ）・明示 API（`setView`/`setZoomLimits`）呼び出しは素通しで発火する（間引き不要なほど低頻度）。
- **具体的な閾値**: 「1フレームにつき最大1回」という方針までを本ステージで確定し、実装上の具体的な仕組み（`requestAnimationFrame` コールバック内でのフラグ管理等）は NFR Design で確定する。

## 2. ホットパスのオブジェクト生成方針（Q2）

- **決定**: `ViewController` 内部の `ViewState` 相当の状態は可変フィールドとして保持し、`pointermove` 等の高頻度呼び出しのたびに新しいオブジェクトを生成しない。
- **公開 API の安全性**: `getView(): ViewState` は呼び出しごとに浅いコピー（`{ ...internalState }`）を返し、呼び出し側が返り値を保持して内部状態を誤って書き換える事故を防ぐ。

## 3. PBT の適用対象（Q3）

- **決定**: 次を純粋関数として切り出し、fast-check（UoW-A で確定済み）による PBT の対象とする。
  - **yaw 正規化**: 任意の一連の `pan` 適用後も `yaw ∈ (-180, 180]`（BR-D-04）
  - **pitch クランプ**: 任意の一連の `tilt` 適用後も `pitch ∈ [-90, 90]`（BR-D-05、Code Generation 時点で `[-89,89]` から訂正）
  - **fov クランプ**: `zoom`（加算・乗算）と `setZoomLimits` の任意の組み合わせ後も `fov` が実効ズーム範囲内（BR-D-06, BR-D-07, BR-D-09, BR-D-10）
  - **`Keymap` マージ**: `setKeymap` への任意の `Partial<Keymap>` 入力後、未指定アクションは既定値を保持し、指定アクションのみ上書きされる（BR-D の `Keymap` マージ規則）
- **example-based との併設**: モード切替直後の視点同期（BR-D-12）、コンテキストロスト復帰時の視点再適用（BR-D-13）はビジネスクリティカルな統合経路として example-based テストで個別に検証する（PBT-10）。

## 4. DOM 入力イベントのテスト境界（Q4）

- **決定**: `PointerInputSource`/`TouchInputSource`/`KeyboardInputSource` の実装を、①実際の DOM イベントリスナー登録を行う薄い層（`attach`/`detach`）と、②ネイティブイベントから `InputIntent` を組み立てるロジックとに分離する。
- **テスト方針**: ②を中心に、jsdom が構築可能な合成イベント（`new PointerEvent(...)`/`new WheelEvent(...)`/`new KeyboardEvent(...)` 等）でテストする。`TouchEvent`/`touches` は jsdom のサポートが限定的なため、必要に応じて `touches` 相当のプレーンオブジェクトを直接ハンドラへ渡す形でテストする。
- **ブラウザ依存の実効果**: `setPointerCapture`/`touch-action` 等の「呼ばれたことは検証できるが実際の捕捉・抑制効果は jsdom で確認できない」項目は、呼び出しの有無のみを単体テストで検証し、実効果はブラウザでの手動確認（UoW-A `tech-stack-decisions.md` §5 と同じ切り分け）に委ねる。

## 5. `setView`/`setZoomLimits` の入力検証（Q5）

- **決定**: `setView(partial: Partial<ViewState>)`/`setZoomLimits(partial: Partial<ZoomLimits>)` は、渡された各フィールドについて `Number.isFinite` を検証する。
- **不正値の扱い**: `NaN`/`Infinity`/非数値が1つでも含まれる場合、呼び出し全体を無視し `error`（`INVALID_INPUT`）を発火する（`ViewState`/`ZoomLimits` は変更しない）。`setZoomLimits` で結果として `minFov >= maxFov` となる組み合わせも同様に `INVALID_INPUT` として拒否する。
- **既存方針との整合**: UoW-A の `setMode`（BR-A-17）・UoW-B の `Loader.validate`（BR-B-03）と同じ「公開 API の誤用は `INVALID_INPUT` イベントへ正規化する」方針を継続する。

## 6. アクセシビリティの UoW-D/UoW-G 境界（Q6）

- **決定**: UoW-D は NFR-04 第一文（キーボードのみで主要操作＝視点移動・ズームが完結できる）という機能面と、キーボード操作を受け付けるためのフォーカス受付（コンテナへの `tabindex="0"` 付与）までを担う。
- **UoW-G の担当範囲**: フォーカスの視覚的表示（フォーカスリング等のスタイル）・`aria-label` 等の ARIA 属性・スクリーンリーダー向けの状態通知は、可視要素を持つ同梱 UI（`ControlsUI`）の責務とする（`unit-of-work-story-map.md` の US-35 主担当）。

## 7. 新規ランタイム依存（Q7）

- **決定**: 新規ランタイム依存を追加しない。Pointer Events / Touch Events / Wheel Events / Keyboard Events はいずれも DOM 標準 API であり、three.js（UoW-A から継続する peerDependency）以外の追加ライブラリは不要。
