# Code Summary — UoW-C 投影モード

- **関連 Issue**: [#36](https://github.com/AtsutoNakayama/perisphere/issues/36)
- **作成日**: 2026-08-03
- **単一の情報源**: `aidlc-docs/construction/plans/uow-c-code-generation-plan.md`（全 Step 完了、計画からの逸脱を記載）

## 1. 生成・修正ファイル一覧

### 1-1. 新規ファイル（`packages/core/src/modes/`）

| パス | 内容 |
|---|---|
| `projections/equidistant.ts` | `equidistantRadius`（E5 Dewarp の投影数式、純粋関数） |
| `projections/stereographic.ts` | `stereographicRadius`（E7 Tiny Planet の投影数式、純粋関数） |
| `projections/panini.ts` | `paniniProject`（E6 Panini の近似投影数式、純粋関数） |
| `ModeRegistry.ts` | `ModeRegistry`（E1）: `register`/`get`/`has`/`listIds` |
| `UltraWideMode.ts` / `LinearMode.ts` | カメラベースモード（E3/E4）。`StandardMode` と同じ実装パターン |
| `DewarpMode.ts` / `PaniniMode.ts` / `TinyPlanetMode.ts` | シェーダベースモード（E5/E6/E7）。`ShaderMaterial` をキャッシュし、GLSL 頂点シェーダで投影数式を直接計算 |
| `CrystalBallMode.ts` | 外部カメラモード（E8）。カメラを球外部へ移動しマテリアル面を反転 |

### 1-2. 既存ファイルの修正（UoW-A/UoW-B マージ済みコードへの拡張）

| パス | 変更内容 |
|---|---|
| `viewer/ModeContext.ts` | `texture: Texture \| null` と `setSphereMaterial: (material: Material \| null) => void`（`Renderer.setSphereMaterial` へのバインド済み関数）を追加 |
| `viewer/Renderer.ts` | `setSphereMaterial` 追加、`applySphereTexture` をマテリアル種別（`MeshBasicMaterial`/`ShaderMaterial`）で分岐するよう拡張、`defaultMaterial`/`currentTexture` を内部保持、`disposeSceneResources` をモード所有マテリアルの誤破棄を避けるよう修正 |
| `viewer/ViewerMode.ts` | 任意メソッド `disposeResources?(ctx): void` を追加（Viewer 全体の dispose 時に一度だけ呼ばれる、既存 `StandardMode` 等は未実装のままで後方互換） |
| `viewer/types.ts` | `ViewerModeId` を7モードの既知リテラル + `(string & {})` に拡張、`ModeChangeOptions` 追加、`ViewerHandle.setMode` にオプション引数追加、`registerMode`/`listModes` を追加 |
| `viewer/createViewer.ts` | `ModeRegistry` 統合、`setMode`/`registerMode`/`listModes` 実装、全登録モードの `disposeResources` を dispose 時に呼ぶ処理を追加 |
| `viewer/__tests__/StandardMode.test.ts` | `ModeContext` ヘルパーに `texture`/`setSphereMaterial` を追加（型エラー回避のため必須の修正） |
| `viewer/__tests__/Renderer.test.ts` | `applySphereTexture` の `ShaderMaterial` 分岐を追加検証 |
| `index.ts` | 新規公開型（`ViewerMode`/`ModeContext`/`ModeChangeOptions`）を re-export に追加 |

### 1-3. テスト（新規）

| ファイル | テスト対象 | 手法 |
|---|---|---|
| `modes/projections/__tests__/equidistant.test.ts` | 等距離図法の数式 | example-based + fast-check（有限性・単調性・境界値） |
| `modes/projections/__tests__/stereographic.test.ts` | ステレオ図法の数式 | 同上 |
| `modes/projections/__tests__/panini.test.ts` | Panini 近似式 | 同上 |
| `modes/__tests__/ModeRegistry.test.ts` | 登録・解決・上書き・一覧順 | example-based |
| `modes/__tests__/CameraBasedModes.test.ts` | `UltraWideMode`/`LinearMode` | example-based（`it.each`） |
| `modes/__tests__/ShaderModes.test.ts` | `DewarpMode`/`PaniniMode`/`TinyPlanetMode` 共通契約（マテリアル差し替え・キャッシュ・ユニフォーム更新・破棄） | example-based（`it.each`） |
| `modes/__tests__/CrystalBallMode.test.ts` | カメラ配置・マテリアル面の切替/復帰 | example-based |
| `viewer/__tests__/createViewer.setMode.test.ts` | 全7モード切替、未登録 `id`、`registerMode`/`listModes`、縮退ハンドル | example-based + fast-check（未使用、多重呼び出し系はUoW-Bで対応済みのため対象外） |

**テスト結果**: 17 ファイル・128 テスト全て pass（UoW-A/UoW-B の既存 66 件を含む、回帰なし）。

## 2. ストーリートレーサビリティ

| ストーリー | 対応箇所 | 状態 |
|---|---|---|
| US-07（広視野系モードの選択と投影特性） | `UltraWideMode`/`LinearMode`/`DewarpMode`/`PaniniMode` | ✅ 実装済み |
| US-08（特殊表現モードの選択と投影特性） | `TinyPlanetMode`/`CrystalBallMode` | ✅ 実装済み |
| US-09（モード横断で視点操作が破綻しない） | 各シェーダの `clamp`（GLSL）・投影数式のテスト（PBT） | ✅ 数式レベルで検証済み。実際の入力操作（マウス/タッチ/キーボード）は UoW-D の責務 |
| US-10（モード切替 API） | `createViewer.ts` `setMode` 実装 | ✅ 実装済み |
| US-12（カスタムビューワーモードの登録） | `ModeRegistry`、`registerMode`/`listModes` | ✅ 実装済み |

## 3. 既知の制約・スコープ境界（レビュー時の確認事項）

- **実描画確認は未実施**: jsdom は WebGL2/シェーダコンパイルを提供しないため、GLSL シェーダの実際の描画結果はブラウザでの手動確認が必要（`tech-stack-decisions.md` の制約）。テストは同じ数式を持つ TypeScript 純粋関数で検証している。
- **投影数式は視覚的近似**: Dewarp（等距離図法）・Panini（近似式、d=1 固定）・Tiny Planet（ステレオ図法）は学術的に完全な光学モデルの再現ではなく、視覚的特性を満たす近似（Functional Design Q5=A）。
- **球体ジオメトリはモード間で共用**: 非線形投影（特に Tiny Planet）は低分割ジオメトリでファセットが見える可能性がある（NFR Design Q2=A で意図的に許容、専用高解像度ジオメトリは不採用）。
- **視点操作の実際の入力処理は対象外**: マウス/タッチ/キーボードでの pan/tilt/zoom は UoW-D の責務。本ユニットは `updateView(ctx, view)` が正しく描画に反映されることまでを扱う。

## 4. 計画からの主な逸脱と理由

`uow-c-code-generation-plan.md` の Step 2 に記載（要旨）:

1. `ModeContext` に `setSphereMaterial`（`Renderer.setSphereMaterial` へのバインド済み関数）を追加し、モードが `Renderer` インスタンス全体ではなく `ModeContext` 経由でのみマテリアルを差し替えられるよう修正（`ViewerMode` IF の既存契約との整合）。
2. `Renderer.setSphereMaterial` がマテリアル差し替え時に現在のテクスチャを自動反映するよう設計し、各モードでのユニフォーム手動設定を不要にした。
3. `ViewerMode` IF に任意メソッド `disposeResources?(ctx): void` を新設し、`ShaderMaterial` の最終破棄を実現した（既存モードとの後方互換を維持）。
4. `CrystalBallMode.dispose()` がカメラ位置の復帰を自ら行うよう修正した（他モードが `camera.position` を操作しない前提と、計画時点の記述との矛盾を解消）。
5. Functional Design で欠落していた `registerMode`/`listModes`/`setMode` オプション引数を Code Generation 計画作成時に発見し、`business-rules.md` へ BR-C-12〜15 として追記した（UoW-B の前例に倣う）。

## 5. 検証結果

- `pnpm -r build`: green（tsup ESM + `.d.ts` 生成成功）
- `pnpm -r test`: green（17 ファイル・128 テスト pass、UoW-A/UoW-B の既存 66 件を含め回帰なし）
- `pnpm -r lint`: green（ESLint・Prettier とも問題なし）

**注記**: これは開発時点での自己検証であり、実際のブラウザでのシェーダ描画確認は含まない。正式な Build and Test ステージ（全ユニット共通の統合検証）を代替するものではない。
