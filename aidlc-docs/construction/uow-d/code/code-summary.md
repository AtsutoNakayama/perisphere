# Code Summary — UoW-D 視点操作・入力

- **関連 Issue**: [#38](https://github.com/AtsutoNakayama/perisphere/issues/38)
- **作成日**: 2026-08-03
- **単一の情報源**: `aidlc-docs/construction/plans/uow-d-code-generation-plan.md`（全 Step 完了、計画からの逸脱を記載）

## 1. 生成・修正ファイル一覧

### 1-1. 新規ファイル（`packages/core/src/interaction/`）

| パス | 内容 |
|---|---|
| `viewMath.ts` | 純粋関数群（L4）: `normalizeYaw`/`clampPitch`/`clampFov`/`applyPanDelta`/`applyTiltDelta`/`applyZoomAdd`/`applyZoomScale`/`mergeKeymap`、`DEFAULT_KEYMAP`/`FALLBACK_ZOOM_LIMITS`/`FALLBACK_DEFAULT_VIEW` |
| `types.ts` | `InputIntent`（判別共用体、E8）、`InputSource`（IF、E3）、`Keymap`（E7） |
| `ViewController.ts` | `ViewController`（E1/L1）。`ViewState`/明示ズーム上下限のミュータブル保持、`pendingNotify` フラグと `flushIfPending()`（PP-D-1） |
| `InputManager.ts` | `InputManager`（E2/L2）。`register`/`detachAll` |
| `PointerInputSource.ts` | `PointerInputSource`（E4/L3）。ドラッグ pan/tilt、wheel zoom、`setPointerCapture` の Graceful Fallback（RP-D-1） |
| `TouchInputSource.ts` | `TouchInputSource`（E5/L3）。1本指 pan/tilt、2本指 pinch zoom |
| `KeyboardInputSource.ts` | `KeyboardInputSource`（E6/L3）。`Keymap` ベースの intent 発火、`setKeymap` |

### 1-2. 既存ファイルの修正（UoW-A/UoW-C マージ済みコードへの拡張）

| パス | 変更内容 |
|---|---|
| `viewer/ViewerMode.ts` | `readonly defaultView?: ViewState` を追加（E10、発見・追記） |
| `viewer/StandardMode.ts`、`modes/UltraWideMode.ts`/`LinearMode.ts`/`DewarpMode.ts`/`PaniniMode.ts`/`TinyPlanetMode.ts`/`CrystalBallMode.ts` | 既存の `DEFAULT_VIEW` 定数を `readonly defaultView` として公開する機械的な追加（7ファイル） |
| `viewer/types.ts` | `ViewerState.view: ViewState` 追加、`ViewerEventMap` に `viewchange`/`zoomchange` 追加、`ViewerHandle` に `setView`/`getView`/`setZoomLimits`/`registerInputSource`/`setKeymap` 追加（`component-methods.md` 確定済みシグネチャの初実装） |
| `viewer/Renderer.ts` | `RendererCallbacks.onFrame?: () => void` を追加し、`startLoop()` の `tick()` 内で毎フレーム呼ぶ（L5、PP-D-1） |
| `viewer/createViewer.ts` | `ViewController`/`InputManager` の構築・3入力源の初期登録、intent ハンドラ（pan/tilt/zoom → `ViewController`、setMode → 内部 `setMode`、photoNext/photoPrev/toggleFullscreen → no-op）、`onFrame` での集約発火、`setMode` 拡張（`resetToModeDefault` + 再クランプ）、`onRebuildSucceeded` 拡張（視点再適用）、`setView`/`getView`/`setZoomLimits`/`registerInputSource`/`setKeymap` の実装、縮退ハンドルでの no-op 実装 |
| `viewer/ViewerState.ts` | **計画外の修正（発見・追記、下記 §4 参照）**: `imageLoadState` の初期化漏れ（UoW-B から未修正のまま残っていた）を修正し、`view` の初期化を追加 |
| `index.ts` | 新規公開型（`InputSource`/`InputIntent`/`Keymap`、`ViewChangeEvent`/`ZoomChangeEvent`）を re-export に追加 |
| `viewer/__tests__/StandardMode.test.ts` / `modes/__tests__/CameraBasedModes.test.ts` / `modes/__tests__/ShaderModes.test.ts` / `modes/__tests__/CrystalBallMode.test.ts` | 各モードが `defaultView` を公開していることを検証するテストを追加 |

### 1-3. テスト（新規）

| ファイル | テスト対象 | 手法 |
|---|---|---|
| `interaction/__tests__/viewMath.test.ts` | yaw 正規化・pitch/fov クランプ・`mergeKeymap` | example-based + fast-check（不変条件・任意長シーケンス） |
| `interaction/__tests__/ViewController.test.ts` | `applyPan`/`applyTilt`/`applyZoomDelta`/`applyZoomScale`/`setView`/`setZoomLimits`/`resetToModeDefault`/`flushIfPending` | example-based |
| `interaction/__tests__/InputManager.test.ts` | `register`/`detachAll` | example-based |
| `interaction/__tests__/PointerInputSource.test.ts` | ドラッグ/wheel intent、ボタン判定、`setPointerCapture` 失敗時のフォールバック（RP-D-1）、`preventDefault`、`detach` | example-based（合成 `PointerEvent`/`WheelEvent`） |
| `interaction/__tests__/TouchInputSource.test.ts` | 1本指/2本指 intent、3本指以降のリセット、`touch-action`、`detach` | example-based（合成 `TouchEvent`） |
| `interaction/__tests__/KeyboardInputSource.test.ts` | 既定 `Keymap` 全アクション、`setKeymap`（`Partial`/空配列/`null`）、`tabindex`、`detach` | example-based（`it.each` + 合成 `KeyboardEvent`） |
| `viewer/__tests__/createViewer.interaction.test.ts` | `registerInputSource` 配線、`setMode` intent、`photoNext`/`photoPrev`/`toggleFullscreen` の安全な無視、PP-D-1 集約発火（`onFrame` 手動起動）、`setView`/`setZoomLimits` の検証と `INVALID_INPUT`、BR-D-12（ズーム上下限のモード切替をまたいだ維持・再クランプ）、`setKeymap`（実 DOM イベント経由）、BR-D-13（コンテキストロスト復帰時の視点再適用）、縮退ハンドルでの no-op | example-based（`Renderer` をモック化、UoW-C `createViewer.setMode.test.ts` と同じ境界） |

**テスト結果**: 24 ファイル・214 テスト全て pass（UoW-A/UoW-C の既存 128 件を含む、回帰なし。UoW-D 新規・拡張分 86 件）。

## 2. ストーリートレーサビリティ

| ストーリー | 対応箇所 | 状態 |
|---|---|---|
| US-13（マウスドラッグでの視点移動） | `PointerInputSource` + `ViewController.applyPan/applyTilt` | ✅ 実装済み |
| US-14（マウスホイールでのズーム） | `PointerInputSource`（wheel）+ `ViewController.applyZoomDelta` | ✅ 実装済み |
| US-15（タッチ1本指での視点移動） | `TouchInputSource` | ✅ 実装済み |
| US-16（ピンチでのズーム） | `TouchInputSource` + `ViewController.applyZoomScale` | ✅ 実装済み |
| US-17（キーボードでの主要操作） | `KeyboardInputSource` + 既定 `Keymap` | ✅ 実装済み |
| US-18（矢印キーでの写真送り、キー入力の正規化まで） | `KeyboardInputSource` が `photoPrev`/`photoNext` intent を emit。実行委譲先（UoW-E）は未実装のため `createViewer` で安全に no-op | ✅ 正規化まで実装済み（BR-D-16 の通り実行はスコープ外） |
| US-19（キーマップの変更・無効化） | `viewMath.mergeKeymap` + `KeyboardInputSource.setKeymap` + `ViewerHandle.setKeymap` | ✅ 実装済み |
| US-20（ズーム上下限の設定とモード既定） | `ViewController`（実効範囲解決・`setZoomLimits`）+ `setMode` 統合（BR-D-12） | ✅ 実装済み |

## 3. 既知の制約・スコープ境界（レビュー時の確認事項）

- **実ブラウザでの操作感確認は未実施**: jsdom は `setPointerCapture`（未実装）・`touch-action`（CSS 設定のみ検証可能、実効果は検証不能）の実効果を提供しないため、ドラッグ/ピンチ操作の実際の手触りはブラウザでの手動確認が必要（`tech-stack-decisions.md` §4）。
- **感度定数は初期値**: `PAN_TILT_SENSITIVITY`/`WHEEL_SENSITIVITY`/`KEYBOARD_PAN_TILT_STEP_PX`/`KEYBOARD_ZOOM_STEP_RAW`（`viewMath.ts`）は Functional Design の受け入れ基準（滑らかな追従）を満たす初期値であり、実機での体感調整は本ユニットのスコープ外（今後の改善 Issue で調整可能）。
- **写真送り・フルスクリーンの実処理は対象外**: `photoNext`/`photoPrev`/`toggleFullscreen` intent の正規化・emit までが本ユニットの責務。実際の写真切替（UoW-E）・フルスクリーン切替（UoW-F）は該当ユニットで `createViewer` 側のハンドラを拡張する（BR-D-16）。
- **同梱 UI のアクセシビリティ表現は対象外**: ARIA 属性・フォーカスの視覚的表示は UoW-G の責務（`nfr-requirements.md` Q6）。本ユニットはキーボード操作の機能面とフォーカス受付（`tabindex`）まで。

## 4. 計画からの主な逸脱と理由

1. **pitch クランプ範囲を `[-89, 89]` から `[-90, 90]` へ訂正**（Functional Design Q3=A からの訂正、`business-rules.md` BR-D-05 に追記済み）。計画時点では YXZ オイラー角のジンバルロック回避を理由に 89° としたが、実装は `yaw`/`pitch` を独立したスカラー値として保持し毎フレーム `camera.rotation.set` で直接設定するのみで、カメラの回転行列から角度を逆算することはないためジンバルロックは実際には発生しない。UoW-C `TinyPlanetMode` の既定 `pitch=-90`（真下方向）を正しく許容するため境界値 90° を含む範囲へ訂正した。
2. **`ViewerState.ts` の計画外バグ修正（発見・追記）**: `createViewerState()` が `imageLoadState`（UoW-B で `ViewerState` へ追加された必須フィールド）を初期化していない欠落を発見した。`pnpm -r build`（tsup の DTS 生成は `noEmitOnError` 未設定のため型エラーがあってもビルド自体は成功する）・`pnpm -r test`（Vitest は esbuild ベースのトランスパイルで型チェックを行わない）・`pnpm -r lint`（ESLint は `recommendedTypeChecked` を使っていないため意味論的な型エラーを検出できない）のいずれでも検出されず UoW-B から残っていた。本ユニットで `view` フィールドを同じオブジェクトへ追加する際に発見し、あわせて修正した。
3. **`Renderer.test.ts` への `onFrame` 単体テスト追加を見送り**（計画 Step 3-7 からの逸脱）: `Renderer` クラス自体は WebGL2 実構築が jsdom で不可能なため単体テスト対象外という既存方針（`tech-stack-decisions.md` UoW-A §5）に従い、`onFrame` の呼び出し確認は `createViewer.interaction.test.ts`（`Renderer` をモック化し `callbacks.onFrame` を直接起動）に統合した。

## 5. 検証結果

- `pnpm -r build`: green（tsup ESM + `.d.ts` 生成成功）
- `pnpm -r test`: green（24 ファイル・214 テスト pass、UoW-A/UoW-C の既存 128 件を含め回帰なし）
- `pnpm -r lint`: green（ESLint・Prettier とも問題なし）
- `pnpm audit --prod`: 既知の脆弱性なし

### 参考: 独自に実施した `tsc --noEmit` によるプロジェクト全体の型チェック（Step 7 の範囲外、追加の自己検証）

上記§4-2 の発見を踏まえ、本ユニットの新規・修正コードに型エラーがないことを `tsc --noEmit -p packages/core` で個別に確認した（新規追加分に起因する型エラーはゼロ）。ただし、この確認の過程で **`pnpm -r build`/`test`/`lint` のいずれも実際には全ファイルの意味論的な型エラーを検出しない**（tsup の DTS 生成は型エラーがあっても成功する、Vitest は型チェックしない、ESLint は type-aware ではない）という、UoW-D に起因しない既存の CI/ツールチェーン上の潜在的なギャップを発見した。UoW-A〜C 由来の未修正の型エラー（例: `CrystalBallMode.ts`/`Renderer.ts` の three.js `Material | Material[]` 型の扱い、`EventBus.ts` のジェネリクス、一部テストファイルの ES2022 API 利用）が複数残存していることを確認済み。これらは本ユニットのスコープ外のため修正していないが、CI に `tsc --noEmit` の追加を検討する価値がある独立した論点として記録する（別 Issue 化を推奨）。
