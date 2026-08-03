# Code Generation Plan — UoW-C 投影モード

- **関連 Issue**: [#36](https://github.com/AtsutoNakayama/perisphere/issues/36)
- **作成日**: 2026-08-03
- **前提資料**: `construction/uow-c/functional-design/`（domain-entities.md / business-rules.md〔BR-C-12〜15 追記済み〕/ business-logic-model.md）、`construction/uow-c/nfr-requirements/tech-stack-decisions.md`、`construction/uow-c/nfr-design/`（nfr-design-patterns.md / logical-components.md）、`construction/uow-c/infrastructure-design/`（変更不要と確認済み）

**本ファイルは Code Generation の単一の情報源である。**

## ユニットコンテキスト

- **担当ストーリー**: US-07, US-08, US-09, US-10, US-12
- **依存ユニット**: UoW-A（マージ済み）、UoW-B（マージ済み）
- **公開インターフェースの追加**: `ViewerHandle.registerMode`/`listModes`、`setMode` へのオプション引数、`ViewerModeId` 型の拡張、公開型 `ViewerMode`/`ModeContext`/`ModeChangeOptions`
- **コード配置**: 新規ディレクトリ `packages/core/src/modes/`（`unit-of-work.md` のコード構成戦略）。既存の `viewer/types.ts`/`ModeContext.ts`/`Renderer.ts`/`createViewer.ts`/`index.ts` は既存ファイルの修正

## シェーダ実装方針（Code Generation 時点で確定する技術詳細）

`nfr-requirements.md`/`nfr-design.md` の決定に基づき、以下の頂点シェーダ方式を採用する:

- カメラの `rotation`（yaw/pitch）は他モードと同じ `camera.rotation.set(pitch, yaw, 0, 'YXZ')` を継続利用する（three.js 標準の `modelViewMatrix` に反映される）。
- 頂点シェーダは `modelViewMatrix * position` で view space 方向 `dir` を求め、`dir` から前方軸（-Z）に対する角度 `theta`（Dewarp/Tiny Planet）または水平角 `thetaH`（Panini）を計算し、モード別の半径公式で NDC 座標（`gl_Position.xy`、`z=0, w=1`）を直接算出する。
- フラグメントシェーダは球体ジオメトリに既に焼き込まれた等距円筒 UV（`vUv`）でテクスチャをそのままサンプリングする（UV 自体は変更しない）。
- 半径公式は `modes/projections/` の TS 純粋関数と同じ数式を GLSL へ手動移植する（`nfr-requirements.md` Q1）。

## Step 1: Project Structure Setup

**該当なし（スキップ）**。既存ワークスペース・`packages/core` 構成をそのまま使う。新規ディレクトリは `packages/core/src/modes/`（Step 2 内で作成）。

## Step 2: Business Logic Generation

- [ ] 2-1. `packages/core/src/modes/projections/equidistant.ts`（新規）— `equidistantRadius(theta, fov): number`（BR-C-06 Dewarp の数式）
- [ ] 2-2. `packages/core/src/modes/projections/stereographic.ts`（新規）— `stereographicRadius(theta, fov): number`（BR-C-06 Tiny Planet の数式）
- [ ] 2-3. `packages/core/src/modes/projections/panini.ts`（新規）— `paniniProject(thetaH, dyOverHypot, fov, d?): { x: number; y: number }`（BR-C-06 Panini の近似数式）
- [ ] 2-4. `packages/core/src/modes/ModeRegistry.ts`（新規）— `register`/`get`/`has`（E1、BR-C-01、Map ベース）
- [ ] 2-5. `packages/core/src/viewer/ModeContext.ts`（既存修正）— `texture: Texture | null` を追加（E2、BR-C-08 の前提）
- [ ] 2-6. `packages/core/src/viewer/Renderer.ts`（既存修正）— `setSphereMaterial(material: Material): void` を追加。`applySphereTexture`（UoW-B で切り出した純粋関数）をマテリアル種別で分岐するよう拡張（`MeshBasicMaterial.map` / `ShaderMaterial.uniforms.map.value`、NFR Requirements Q2）。`currentTexture` を内部保持し `modeContext.texture` で公開
- [ ] 2-7. `packages/core/src/modes/UltraWideMode.ts` / `LinearMode.ts`（新規）— `StandardMode` と同じ実装パターン、既定値のみ変更（BR-C-05）
- [ ] 2-8. `packages/core/src/modes/DewarpMode.ts` / `PaniniMode.ts` / `TinyPlanetMode.ts`（新規）— `ShaderMaterial` をコンストラクタで 1 回構築しキャッシュ（NFR Requirements Q3）。`apply`: `Renderer.setSphereMaterial` 経由で適用 + `ctx.texture` をユニフォームへ設定 + 既定ビューを `updateView` に委譲。`updateView`: カメラの `rotation` 設定 + `uFov` ユニフォーム更新（BR-C-06、数値的安定性のクランプ BR-C-10）。`dispose`: `Renderer.setSphereMaterial` で既定マテリアルへ復帰（`ShaderMaterial` 自体は破棄しない、BR-C-09）
- [ ] 2-9. `packages/core/src/modes/CrystalBallMode.ts`（新規）— `apply`: カメラを外部へ移動 + `material.side = FrontSide`（BR-C-07）。`dispose`: `material.side = BackSide` へ復帰（BR-C-11）
- [ ] 2-10. `packages/core/src/viewer/types.ts`（既存修正）— `ViewerModeId` を7モードの既知リテラル + `(string & {})` に拡張（BR-C-15）、`ModeChangeOptions`（空オブジェクト、将来のアニメ用予約）を追加、`ViewerHandle.setMode` にオプション引数追加（BR-C-14）、`ViewerHandle.registerMode`/`listModes` を追加（BR-C-12/13）
- [ ] 2-11. `packages/core/src/viewer/createViewer.ts`（既存修正）— 初期化時に `ModeRegistry` へ全7モードを登録（BR-C-01）、`setMode` を `ModeRegistry` 解決 + 5手順（BR-C-02〜04）に置き換え、`registerMode`/`listModes` 実装、全モードの `ShaderMaterial` を `Viewer` dispose 時に解放する disposer 登録
- [ ] 2-12. `packages/core/src/index.ts`（既存修正）— 新規公開型（`ViewerMode`/`ModeContext`/`ModeChangeOptions`）を re-export に追加。個別モードクラス自体は非公開（`registerMode` は `ViewerMode` IF を満たす任意のオブジェクトを受け付けるため、具体クラスの公開は不要）

## Step 3: Business Logic Unit Testing

- [ ] 3-1. `packages/core/src/modes/projections/__tests__/equidistant.test.ts` — fast-check（有効角度範囲での有限性・単調性・θ=0で半径0）
- [ ] 3-2. `packages/core/src/modes/projections/__tests__/stereographic.test.ts` — 同上
- [ ] 3-3. `packages/core/src/modes/projections/__tests__/panini.test.ts` — 同上（水平角の単調性・θ_h=0でx=0）
- [ ] 3-4. `packages/core/src/modes/__tests__/ModeRegistry.test.ts` — register/get/has、同一 id の上書き
- [ ] 3-5. `packages/core/src/modes/__tests__/CameraBasedModes.test.ts` — `UltraWideMode`/`LinearMode` の既定値・`updateView` の反映（`StandardMode.test.ts` と同パターン）
- [ ] 3-6. `packages/core/src/modes/__tests__/ShaderModes.test.ts` — `DewarpMode`/`PaniniMode`/`TinyPlanetMode` 共通契約を `it.each` で検証: `apply` が `Renderer.setSphereMaterial`/`setSphereTexture` 相当を正しい引数で呼ぶこと、複数回の `apply` で同一 `ShaderMaterial` インスタンスが再利用されること（キャッシュ）、`dispose` 後に既定マテリアルへ戻ること
- [ ] 3-7. `packages/core/src/modes/__tests__/CrystalBallMode.test.ts` — カメラ位置の変更、`material.side` の切替・復帰
- [ ] 3-8. `packages/core/src/viewer/__tests__/Renderer.test.ts`（既存拡張）— `applySphereTexture` の `ShaderMaterial` 分岐（`uniforms.map.value` 更新）を追加検証
- [ ] 3-9. `packages/core/src/viewer/__tests__/createViewer.setMode.test.ts`（新規、既存 `createViewer.test.ts`/`createViewer.loadImage.test.ts` は変更しない）— 全7モードへの切替、未登録 `id` での `INVALID_INPUT`（動的解決版）、`registerMode` で登録したカスタムモードへの切替、`listModes` の内容、`setMode` の `options` 引数を渡しても無視されること

## Step 4: Business Logic Summary

- [ ] 4-1. `aidlc-docs/construction/uow-c/code/code-summary.md`

## Step 5: Documentation Generation

- [ ] 5-1. 新規公開 API（`registerMode`, `listModes`, `setMode` のオプション引数, `ViewerMode`, `ModeContext`, `ModeChangeOptions`）に TSDoc コメントを付与する

## Step 6: Deployment Artifacts Generation

**該当なし（スキップ）**。`infrastructure-design.md` で確認済みの通り、CI/Dependabot への変更は不要。

## Step 7: ビルド・テストの実行確認

- [ ] 7-1. `pnpm -r build` を実行し型エラー・ビルドエラーがないことを確認
- [ ] 7-2. `pnpm -r test` を実行し全テスト（UoW-A/UoW-B の既存 66 件 + UoW-C 新規分）が green であることを確認
- [ ] 7-3. `pnpm -r lint` を実行し lint エラーがないことを確認
- [ ] 7-4. `pnpm audit --prod` で既知の脆弱性がないことを確認
- [ ] 7-5. 問題が見つかった場合は該当コードを修正し、7-1〜7-4 を再実行する

**注記**: Step 7 は開発時点での自己検証であり、実際のブラウザでのシェーダ描画確認は含まない（`tech-stack-decisions.md` の制約により jsdom では検証不能）。正式な Build and Test ステージ（全ユニット共通の統合検証）を代替するものではない。

## ストーリートレーサビリティ

| ストーリー | 対応箇所 |
|---|---|
| US-07（広視野系モードの選択と投影特性） | Step 2-7（UltraWide/Linear）、Step 2-8（Dewarp/Panini） |
| US-08（特殊表現モードの選択と投影特性） | Step 2-8（Tiny Planet）、Step 2-9（Crystal Ball） |
| US-09（モード横断で視点操作が破綻しない） | Step 2-8（クランプ、BR-C-10）、Step 3-6/3-7 |
| US-10（モード切替 API） | Step 2-11（`setMode` 実装）、Step 3-9 |
| US-12（カスタムビューワーモードの登録） | Step 2-4（`ModeRegistry`）、Step 2-10/2-11（`registerMode`/`listModes`）、Step 3-9 |

## 完了条件

- 上記 Step 2〜5、7 の全チェックボックスが `[x]`（Step 1・6 は該当なし）
- `pnpm -r build` / `pnpm -r test` / `pnpm -r lint` が green
- 生成コードが `business-rules.md`（BR-C-01〜15）・`nfr-design-patterns.md`・`logical-components.md` の決定と矛盾しない
- UoW-A/UoW-B の既存 66 テストが引き続き green（既存動作への回帰がないこと）
