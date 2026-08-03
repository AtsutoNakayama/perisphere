# Code Generation Plan — UoW-D 視点操作・入力

- **関連 Issue**: [#38](https://github.com/AtsutoNakayama/perisphere/issues/38)
- **作成日**: 2026-08-03
- **前提資料**: `construction/uow-d/functional-design/`（domain-entities.md〔E1〜E10〕/ business-rules.md〔BR-D-01〜17〕/ business-logic-model.md〔P1〜P6〕）、`construction/uow-d/nfr-requirements/tech-stack-decisions.md`、`construction/uow-d/nfr-design/`（nfr-design-patterns.md〔RP-D-1, PP-D-1〕/ logical-components.md〔L1〜L5〕）、`construction/uow-d/infrastructure-design/`（変更不要と確認済み）

**本ファイルは Code Generation の単一の情報源である。**

## ユニットコンテキスト

- **担当ストーリー**: US-13, US-14, US-15, US-16, US-17, US-18, US-19, US-20
- **依存ユニット**: UoW-A（マージ済み）、UoW-C（マージ済み）
- **公開インターフェースの追加**: `ViewerHandle.setView`/`getView`/`setZoomLimits`/`registerInputSource`/`setKeymap`（Inception `component-methods.md` で確定済み、本ユニットで初実装）、`ViewerEventMap.viewchange`/`zoomchange`、公開型 `InputSource`/`InputIntent`/`Keymap`、`ViewerMode.defaultView?`（本ユニットでの追加）
- **コード配置**: 新規ディレクトリ `packages/core/src/interaction/`（`modes/`/`loader/` と並ぶユニット単位のディレクトリ構成、`unit-of-work.md` のコード構成戦略）。既存の `viewer/types.ts`/`viewer/ViewerMode.ts`/`viewer/Renderer.ts`/`viewer/createViewer.ts`/`viewer/StandardMode.ts`/`modes/*.ts`（6モード）/`index.ts` は既存ファイルの修正

## Step 1: Project Structure Setup

**該当なし（スキップ）**。既存ワークスペース・`packages/core` 構成をそのまま使う。新規ディレクトリは `packages/core/src/interaction/`（Step 2 内で作成）。

## Step 2: Business Logic Generation

- [x] 2-1. `packages/core/src/interaction/viewMath.ts`（新規）— 純粋関数群（L4、BR-D-04〜09）:
  - `normalizeYaw(yaw): number`（`(-180, 180]` へ正規化、BR-D-04）
  - `clampPitch(pitch): number`（`[-89, 89]`、BR-D-05）
  - `clampFov(fov, limits): number`（実効ズーム範囲、BR-D-09）
  - `applyPanDelta(yaw, deltaPx, currentFov): number` / `applyTiltDelta(pitch, deltaPx, currentFov): number`（fov 比例の感度、BR-D-04/05）
  - `applyZoomAdd(fov, rawDeltaY): number`（wheel/キーボード加算、BR-D-06/08） / `applyZoomScale(fov, ratio): number`（pinch 乗算、BR-D-07）
  - `mergeKeymap(base, partial): Keymap`（`setKeymap` のマージ規則）
  - `DEFAULT_KEYMAP: Keymap`（Q6 既定値）、`FALLBACK_ZOOM_LIMITS`/`FALLBACK_DEFAULT_VIEW` 定数（BR-D-09/12）
- [x] 2-2. `packages/core/src/interaction/types.ts`（新規）— `InputIntent`（判別共用体、E8）、`InputSource`（IF、`component-methods.md` 確定済みの再掲）、`Keymap`（E7）
- [x] 2-3. `packages/core/src/interaction/ViewController.ts`（新規）— E1（L1）。`viewMath.ts` の関数へ計算を委譲し、`view`/`explicitZoomLimits` をミュータブルに保持（NFR Requirements Q2）。`pendingNotify` フラグ（PP-D-1）と `flushIfPending()` を持つ。`setView`/`setZoomLimits` は不正値（非有限数値、`minFov >= maxFov`）を検知するとコールバックで通知する（`createViewer` 側で `INVALID_INPUT` へ正規化、NFR Requirements Q5）
- [x] 2-4. `packages/core/src/interaction/InputManager.ts`（新規）— E2（L2）。`register(source)`/`detachAll()`
- [x] 2-5. `packages/core/src/interaction/PointerInputSource.ts`（新規）— E4（L3）。`pointerdown`（button===0）→ `setPointerCapture`（`try/catch` フォールバック、RP-D-1）→ `pointermove` で pan/tilt intent → `pointerup`/`pointercancel` で終了。`wheel`（`{ passive: false }`）→ zoom(delta) intent、`preventDefault()`。ドラッグ中のテキスト選択抑制（Q8）
- [x] 2-6. `packages/core/src/interaction/TouchInputSource.ts`（新規）— E5（L3）。1本指 `touchmove` → pan/tilt intent。2本指 `touchmove` → zoom(scale) intent。コンテナへ `touch-action: none`
- [x] 2-7. `packages/core/src/interaction/KeyboardInputSource.ts`（新規）— E6（L3）。コンテナへ `tabindex="0"` 付与、フォーカス時のみ `keydown` を処理。`Keymap` に基づき pan/tilt/zoom/photoNext/photoPrev/toggleFullscreen intent を emit（BR-D-08）。`setKeymap` 相当の更新用メソッドを持つ
- [x] 2-8. `packages/core/src/viewer/ViewerMode.ts`（既存修正）— `readonly defaultView?: ViewState` を追加（E10、発見・追記）
- [x] 2-9. 7モードファイル（既存修正、`defaultView` を公開フィールド化）:
  `packages/core/src/viewer/StandardMode.ts`、`packages/core/src/modes/UltraWideMode.ts`、`LinearMode.ts`、`DewarpMode.ts`、`PaniniMode.ts`、`TinyPlanetMode.ts`、`CrystalBallMode.ts` — 既存のモジュール内部 `DEFAULT_VIEW` 定数を `readonly defaultView = DEFAULT_VIEW;` として公開する機械的な追加
- [x] 2-10. `packages/core/src/viewer/types.ts`（既存修正）— `ViewerState.view: ViewState` を追加（E9）。`ViewerEventMap` に `viewchange: ViewState`/`zoomchange: { fov: number }` を追加。`ViewerHandle` に `setView`/`getView`/`setZoomLimits`/`registerInputSource`/`setKeymap` を追加（`component-methods.md` 確定済みシグネチャ）。`interaction/types.ts` から `InputSource`/`Keymap` を import
- [x] 2-11. `packages/core/src/viewer/Renderer.ts`（既存修正）— `RendererCallbacks` に `onFrame?: () => void` を追加し、`startLoop()` の `tick()` 内で `render` 呼び出し後に毎フレーム呼ぶ（L5、PP-D-1）
- [x] 2-12. `packages/core/src/viewer/createViewer.ts`（既存修正）:
  - `ViewController` を生成し、`InputManager` へ `PointerInputSource`/`TouchInputSource`/`KeyboardInputSource` を初期登録（BR-D-01）。共有 intent ハンドラで `pan`/`tilt`/`zoom` は `ViewController` へ、`setMode` は既存の内部 `setMode` へ、`photoNext`/`photoPrev`/`toggleFullscreen` は no-op（BR-D-15/16）
  - `Renderer` の `onFrame` コールバックで `viewController.flushIfPending()` を呼び、変更があれば `viewchange`（+ fov 変化時は `zoomchange`）を発火（PP-D-1）
  - `setMode` を拡張: `target.apply(ctx)` 後に `viewController.resetToModeDefault(target.defaultView ?? FALLBACK_DEFAULT_VIEW)` を呼び、明示的なズーム上下限があれば再クランプ（BR-D-12）
  - `onRebuildSucceeded` コールバックを拡張: `currentMode.updateView(ctx, viewController.getView())` を呼び、コンテキストロスト直前の視点を再適用（BR-D-13）
  - `setView`/`getView`/`setZoomLimits`/`registerInputSource`/`setKeymap` をハンドルに実装。不正値検知時は `errorManager.report('INVALID_INPUT', ...)`（NFR Requirements Q5）
  - `dispose()` 時に `InputManager.detachAll()` を `disposables` へ登録（BR-D-03）
  - 縮退ハンドル（WebGL2 非対応）では `setView`/`getView`/`setZoomLimits`/`registerInputSource`/`setKeymap` は安全な no-op/既定値返却とする（既存の `imageLoading: null` と同じ扱い）
- [x] 2-13. `packages/core/src/index.ts`（既存修正）— 新規公開型（`InputSource`, `InputIntent`, `Keymap`）を re-export に追加

## Step 3: Business Logic Unit Testing

- [x] 3-1. `packages/core/src/interaction/__tests__/viewMath.test.ts` — fast-check で PBT: yaw 正規化（任意の一連の加算後も `(-180,180]`）、pitch クランプ（`[-89,89]`）、fov クランプ（実効範囲内）、`mergeKeymap`（未指定アクションは既定保持・指定アクションのみ上書き）
- [x] 3-2. `packages/core/src/interaction/__tests__/ViewController.test.ts` — `applyPan`/`applyTilt`/`applyZoomDelta`/`applyZoomScale` の反映値、`setView`/`setZoomLimits` の不正値検知（コールバック呼び出し確認）、`setZoomLimits` の明示設定がモード切替後も維持されること（`resetToModeDefault` 後の再クランプ含む）、`flushIfPending` の pending 管理
- [x] 3-3. `packages/core/src/interaction/__tests__/InputManager.test.ts` — `register` が `attach` を正しい引数で呼ぶこと、`detachAll` が全登録済みソースの `detach` を呼ぶこと
- [x] 3-4. `packages/core/src/interaction/__tests__/PointerInputSource.test.ts` — 合成 `PointerEvent`/`WheelEvent` による pan/tilt/zoom intent の emit、`setPointerCapture` が例外を投げるケースでのフォールバック動作（RP-D-1）、`preventDefault` 呼び出しの確認（Q8）
- [x] 3-5. `packages/core/src/interaction/__tests__/TouchInputSource.test.ts` — 1本指/2本指の合成タッチイベントによる pan/tilt/zoom(scale) intent の emit
- [x] 3-6. `packages/core/src/interaction/__tests__/KeyboardInputSource.test.ts` — 既定 `Keymap` での intent 発火、`setKeymap`（`Partial`/`null`）によるマージ・無効化、コンテナがフォーカスされていない場合は無視されること
- [x] 3-7. **計画からの逸脱**: `Renderer.test.ts` は `Renderer` クラス自体を実インスタンス化するテストを持たず（WebGL2 実構築が jsdom で不可能なため、既存方針通り `applySphereTexture` という切り出した純粋関数のみを検証している）、`onFrame` 呼び出し自体もこの制約の対象となる。`this.callbacks.onFrame?.()` という1行の追加自体はテストの必要性が薄いため本ファイルへの追加は見送り、`onFrame` が実際に `viewchange`/`zoomchange` を正しく駆動することは Step 3-9 の `createViewer.interaction.test.ts`（`Renderer` をモック化し `callbacks.onFrame` を直接呼び出す）で代わりに検証する
- [x] 3-8. `packages/core/src/viewer/__tests__/StandardMode.test.ts`（既存拡張）/ `modes/__tests__/CameraBasedModes.test.ts`（既存拡張）/ `modes/__tests__/ShaderModes.test.ts`（既存拡張）/ `modes/__tests__/CrystalBallMode.test.ts`（既存拡張）— 各モードが `defaultView` を公開していることを検証
- [x] 3-9. `packages/core/src/viewer/__tests__/createViewer.interaction.test.ts`（新規）— `registerInputSource` の配線、`setView`/`getView`/`setZoomLimits`/`setKeymap` のハンドル動作と不正値での `INVALID_INPUT`、`onFrame` 経由の `viewchange`/`zoomchange` 集約発火、`setMode` 統合（視点リセットとズーム上下限の維持）、コンテキストロスト復帰時の視点再適用、`photoNext`/`photoPrev`/`toggleFullscreen` の安全な無視、縮退ハンドルでの no-op 動作

## Step 4: Business Logic Summary

- [x] 4-1. `aidlc-docs/construction/uow-d/code/code-summary.md`

## Step 5: Documentation Generation

- [x] 5-1. 新規公開 API（`setView`, `getView`, `setZoomLimits`, `registerInputSource`, `setKeymap`, `InputSource`, `InputIntent`, `Keymap`, `ViewerMode.defaultView`）に TSDoc コメントを付与する（Step 2 実装と同時に付与）

## Step 6: Deployment Artifacts Generation

**該当なし（スキップ）**。`infrastructure-design.md` で確認済みの通り、CI/Dependabot への変更は不要。

## Step 7: ビルド・テストの実行確認

- [x] 7-1. `pnpm -r build` を実行し型エラー・ビルドエラーがないことを確認
- [x] 7-2. `pnpm -r test` を実行し全テスト（UoW-A/UoW-C の既存分 + UoW-D 新規分）が green であることを確認
- [x] 7-3. `pnpm -r lint` を実行し lint エラーがないことを確認
- [x] 7-4. `pnpm audit --prod` で既知の脆弱性がないことを確認
- [x] 7-5. 問題が見つかった場合は該当コードを修正し、7-1〜7-4 を再実行する

**注記**: Step 7 は開発時点での自己検証であり、実際のブラウザでのドラッグ/ピンチ/キーボード操作の描画確認は含まない（jsdom では実ブラウザの `setPointerCapture`/`touch-action` の実効果を検証できない、`tech-stack-decisions.md` §4）。正式な Build and Test ステージ（全ユニット共通の統合検証）を代替するものではない。

## ストーリートレーサビリティ

| ストーリー | 対応箇所 |
|---|---|
| US-13（マウスドラッグでの視点移動） | Step 2-5（`PointerInputSource`）、Step 2-3（`ViewController.applyPan/applyTilt`） |
| US-14（マウスホイールでのズーム） | Step 2-5、Step 2-3（`applyZoomDelta`） |
| US-15（タッチ1本指での視点移動） | Step 2-6（`TouchInputSource`） |
| US-16（ピンチでのズーム） | Step 2-6、Step 2-3（`applyZoomScale`） |
| US-17（キーボードでの主要操作） | Step 2-7（`KeyboardInputSource`）、Step 2-1（既定 `Keymap`） |
| US-18（矢印キーでの写真送り、キー入力の正規化まで） | Step 2-7（`photoNext`/`photoPrev` intent の emit）、Step 2-12（`createViewer` での no-op 結線、UoW-E 未実装のため） |
| US-19（キーマップの変更・無効化） | Step 2-1（`mergeKeymap`）、Step 2-7（`KeyboardInputSource` の更新）、Step 2-12（`setKeymap` ハンドル実装） |
| US-20（ズーム上下限の設定とモード既定） | Step 2-1（`clampFov`）、Step 2-3（`setZoomLimits`/実効範囲解決）、Step 2-12（`setMode` 統合での維持） |

## 完了条件

- 上記 Step 2〜5、7 の全チェックボックスが `[x]`（Step 1・6 は該当なし）
- `pnpm -r build` / `pnpm -r test` / `pnpm -r lint` が green
- 生成コードが `business-rules.md`（BR-D-01〜17）・`nfr-design-patterns.md`（RP-D-1, PP-D-1）・`logical-components.md`（L1〜L5）の決定と矛盾しない
- UoW-A/UoW-C の既存テストが引き続き green（既存動作への回帰がないこと）
