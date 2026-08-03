# Business Rules — UoW-D 視点操作・入力

- **関連 Issue**: [#38](https://github.com/AtsutoNakayama/perisphere/issues/38)
- **作成日**: 2026-08-03
- **前提資料**: `uow-d-functional-design-plan.md`（Q1〜Q8 回答・採用理由）、`domain-entities.md`、UoW-A `business-rules.md`（BR-A-05, BR-A-07, BR-A-12）、UoW-C `business-rules.md`（BR-C-03, BR-C-04）

各ルールには **trace**（対応するストーリー/要件/計画質問）を付す。

## 入力源の初期化

### BR-D-01 組み込み入力源のアタッチ

`createViewer` の初期化時（UoW-A BR-A-05 の初期化パイプラインの一部として）、`InputManager`（E2）を生成し、`PointerInputSource`・`TouchInputSource`・`KeyboardInputSource`（E4〜E6）をコンテナ要素へ `attach` する。3つとも同一の intent ハンドラ（`ViewController` への委譲、後述 BR-D-05〜08）を共有する。

- **trace**: US-13〜19, Q1=A

### BR-D-02 `registerInputSource` によるカスタム入力源登録

`ViewerHandle.registerInputSource(source: InputSource): void`（IF 確定済み）は `InputManager.register` へ委譲し、組み込み3種と同じ `target`/`onIntent` で `attach` する（NFR-02）。

- **trace**: NFR-02, `component-methods.md` L72

### BR-D-03 破棄時のデタッチ

`dispose()` 時、`InputManager.detachAll()` を呼び、組み込み・登録済みを問わず全 `InputSource` の `detach()` を呼ぶ（US-31）。UoW-A の `DisposableRegistry` へ他リソースと同じ順序で登録する。

- **trace**: US-31

## パン・チルト（ドラッグ）

### BR-D-04 パンの角度変換（Q2）

`pan` intent（`deltaPx`）受信時、`yawDeltaDeg = -deltaPx * PAN_TILT_SENSITIVITY * (currentFov / BASE_FOV)` を計算し、`yaw` に加算する（右へドラッグ＝正の `deltaPx`＝`yaw` 減算＝視点は左を向く「つかんで回す」方式）。`BASE_FOV` は `StandardMode` の既定 fov（75°）を基準値として用いる。結果の `yaw` は `(-180, 180]` へ正規化する（無限回転を許容し、クランプはしない）。

- **trace**: US-13, Q2=A

### BR-D-05 チルトの角度変換とクランプ（Q2, Q3、Code Generation 時点で訂正）

`tilt` intent（`deltaPx`）受信時、`pitchDeltaDeg = deltaPx * PAN_TILT_SENSITIVITY * (currentFov / BASE_FOV)` を計算し `pitch` に加算する（下へドラッグ＝正の `deltaPx`＝`pitch` 加算＝視点は上を向く）。結果の `pitch` は `[-90, 90]` にクランプする。

**Q3=A からの訂正（Code Generation 時点での発見・追記）**: 計画時点では YXZ オイラー角のジンバルロック回避のため `[-89, 89]` としたが、実装（`ViewController`）は `yaw`/`pitch` を独立したスカラー値として保持し、毎フレーム `camera.rotation.set(pitch, yaw, 0, 'YXZ')` で直接設定するのみで、カメラの回転行列から角度を逆算（分解）することはない。そのためジンバルロックによる `yaw` 不定化は実際には発生せず、89° への制限は不要だった。UoW-C `TinyPlanetMode` の既定 `pitch=-90`（真下方向、BR-C-06）を正しく許容するため、境界値の 90° 自体は許容する `[-90, 90]` へ訂正する。

- **trace**: US-13, Q2=A, Q3=A（訂正）

## ズーム（ホイール・ピンチ・キーボード）

### BR-D-06 ホイールによるズーム（Q4 加算モデル）

`{ kind: 'zoom', mode: 'delta', value }` 受信時、`fov += value * WHEEL_SENSITIVITY` を計算し、結果を実効ズーム範囲（BR-D-09）でクランプする。

- **trace**: US-14, Q4=A

### BR-D-07 ピンチによるズーム（Q4 乗算モデル）

`{ kind: 'zoom', mode: 'scale', value }` 受信時、`fov *= value` を計算し（`value` は前回距離/今回距離の比。指を広げる＝`value < 1`＝`fov` 減少＝ズームイン）、結果を実効ズーム範囲（BR-D-09）でクランプする。

- **trace**: US-16, Q4=A

### BR-D-08 キーボードによるパン・チルト・ズーム

`KeyboardInputSource`（E6）の `panLeft`/`panRight`/`tiltUp`/`tiltDown` キーは、1回の押下（`keydown`、ブラウザのキーリピートに追従）ごとに固定量 `KEYBOARD_PAN_TILT_STEP_PX` 相当の `pan`/`tilt` intent を emit し、BR-D-04/BR-D-05 と同じ経路で処理される。`zoomIn`/`zoomOut` キーは固定量 `KEYBOARD_ZOOM_STEP` の `{ kind: 'zoom', mode: 'delta', value }` を emit し、BR-D-06 と同じ経路で処理される。

- **trace**: US-17

## ズーム上下限

### BR-D-09 実効ズーム範囲の解決（Q5）

`ViewController` は「実効ズーム範囲」を次の優先順位で解決する: (1) 明示的に `setZoomLimits` が呼ばれていればその値、(2) アクティブモードの `defaultZoomLimits`（UoW-C 確定）、(3) いずれも無ければ絶対フォールバック `{ minFov: 10, maxFov: 170 }`。全てのズーム操作（BR-D-06〜08）およびモード切替直後の同期（BR-D-11）はこの実効ズーム範囲でクランプする。

- **trace**: US-20, Q5=A

### BR-D-10 `setZoomLimits` の明示設定（Q5）

`setZoomLimits(partial: Partial<ZoomLimits>): void`（IF 確定済み）は、現在の実効ズーム範囲（BR-D-09）に `partial` をマージした結果を「明示設定」として保持する。以後、アクティブモードが切り替わっても明示設定はクリアされず、実効ズーム範囲の解決（BR-D-09 の (1)）で優先され続ける。呼び出し直後、現在の `fov` が新しい範囲外であれば直ちに範囲内へクランプし、変化があれば `viewchange`/`zoomchange`（BR-D-13）を発火する。

- **trace**: US-20, Q5=A

## `setView` API

### BR-D-11 明示的な視点設定

`setView(partial: Partial<ViewState>): void`（IF 確定済み）は、現在の `ViewState` に `partial` をマージし、ドラッグ・ホイール等と同じクランプ（`pitch` は BR-D-05 の範囲、`fov` は BR-D-09 の実効ズーム範囲、`yaw` は BR-D-04 の正規化）を適用してから反映する。入力経路（ドラッグ/ホイール/ピンチ/キーボード/明示 API）によらず、`ViewState` の不変条件（`pitch ∈ [-90, 90]`〔BR-D-05 訂正〕、`fov ∈ [実効minFov, 実効maxFov]`）は常に成立する。

- **trace**: US-20, FR-06〜09（不変条件は Property-Based Testing 拡張の対象、NFR Requirements で確定）

## モード切替との統合（UoW-C 拡張）

### BR-D-12 モード切替直後の `ViewState` 同期（発見・追記）

`setMode`（UoW-C BR-C-03）が新モードの `apply(ctx)` を呼んだ直後、`ViewController.resetToModeDefault(target.defaultView ?? FALLBACK_DEFAULT_VIEW)` を呼び、`ViewController` が保持する `ViewState` をカメラへ実際に適用された既定ビューへ同期する。続けて、明示的なズーム上下限（BR-D-10）が設定されている場合は、同期後の `fov` をその範囲へ再クランプする（モードの既定 fov が利用側の明示設定より優先されないようにするため）。同期・再クランプの結果は `state.view` へ反映するが、`modechange` に加えて追加の `viewchange` を発火するかは実装レベルの判断とする（両者は同一ユーザー操作＝モード切替に起因するため、二重通知を避けたい場合は `modechange` のみでよい）。

- **trace**: Q5=A（ズーム上下限のモード切替をまたいだ維持を実際に成立させるための前提）, UoW-C BR-C-03/BR-C-04

### BR-D-13 コンテキストロスト復帰時の `ViewState` 再適用（UoW-A BR-A-12 拡張）

`Renderer` の WebGL コンテキスト復帰成功時（UoW-A BR-A-12、`onRebuildSucceeded`）、`Renderer.rebuild()` は `activeMode.apply(ctx)` を呼ぶためカメラは一旦モード既定ビューへ戻る。UoW-D はこれに続けて `currentMode.updateView(ctx, viewController.getView())` を呼び、コンテキストロスト直前まで利用者が操作していた `ViewState`（`ViewController` が保持し続けている値、破棄されない）を再適用する。これにより、コンテキストロスト復帰は利用者の視点操作を失わせない（US-37 の障害分離・縮退の趣旨を踏襲）。

- **trace**: US-37, UoW-A BR-A-12

## イベント発火

### BR-D-14 `viewchange`/`zoomchange` の発火（頻度は保証しない）

`ViewState` が変化するたび（BR-D-04〜08, BR-D-10〜13 のいずれか経由）、`viewchange`（`ViewState` 全体）を発火する。変化に `fov` の変更が含まれる場合は `zoomchange`（`{ fov }`）も発火する。ドラッグ・ピンチは高頻度に発火しうるため、発火回数・頻度自体は保証しない（UoW-B BR-B-07 と同じ扱い）。具体的なスロットリングの要否・数値は NFR Design で確定する。

- **trace**: US-13〜16, US-20, `component-methods.md` `ViewerEventMap`

## 入力インテントの結線範囲（Q7）

### BR-D-15 `setMode` インテントの結線

`{ kind: 'setMode', mode }` intent 受信時、UoW-C で実装済みの `setMode(mode)`（内部関数）をそのまま呼ぶ。既定キーマップ（`Keymap`、Q6）にはこの intent を emit するキーを割り当てないが、`registerInputSource`（BR-D-02）で追加されるカスタム入力源が emit した場合は同じ経路で処理する。

- **trace**: Q7=A, UoW-C BR-C-02/03

### BR-D-16 未実装機能へのインテントの安全な無視

`{ kind: 'photoNext' }` / `{ kind: 'photoPrev' }`（UoW-E 未実装）・`{ kind: 'toggleFullscreen' }`（UoW-F 未実装）は、対応する処理系が登録されるまで `createViewer` の intent ハンドラで安全に無視（no-op）する。`InputManager`/`InputSource` 側の実装・IF は変更しない（UoW-E/F 実装時、`createViewer` 側のハンドラのみを拡張する）。

- **trace**: Q7=A

## ブラウザ既定動作の抑制（Q8）

### BR-D-17 抑制範囲

`PointerInputSource`/`TouchInputSource`/`KeyboardInputSource` は、それぞれ以下の既定動作抑制を行う（`domain-entities.md` E4〜E6 に実装詳細）: ①ドラッグ中のテキスト選択抑制、② `wheel` の `preventDefault()` によるページスクロール防止、③コンテナへの `touch-action: none` によるネイティブジェスチャーとの競合回避、④コンテナへの `tabindex="0"` 付与によるキーボードフォーカス受付。これを超える抑制（コンテキストメニュー禁止等）は行わない。

- **trace**: US-13〜17, Q8=A
