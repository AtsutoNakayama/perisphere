# Code Summary — UoW-G 同梱コントロール UI

- **関連 Issue**: [#44](https://github.com/AtsutoNakayama/perisphere/issues/44)
- **作成日**: 2026-08-04
- **単一の情報源**: `aidlc-docs/construction/plans/uow-g-code-generation-plan.md`（全 Step 完了、計画からの逸脱を記載）

## 1. 生成・修正ファイル一覧

### 1-1. 新規ファイル（`packages/core/src/ui/`）

| パス | 内容 |
|---|---|
| `types.ts` | `ControlsVisibility`（E2）、`UITextMap`（E3）、既定文言 `DEFAULT_UI_TEXT` |
| `controlsLogic.ts` | `computeEffectiveVisibility`/`resolveText`（L2、純粋関数、DOM/EventBus 非依存） |
| `ControlsUI.ts` | `ControlsUIDeps` インターフェースと `ControlsUI` クラス（E1/L1）: Light DOM 構築（`.perisphere-controls` ルート＋フルスクリーン/ズーム/モード切替/写真前後/写真インジケーターの各要素、`data-testid` 付与）、共有 `<style id="perisphere-controls-style">` の重複防止注入（BR-G-12）、モード select の `pointerdown`/`focus` 時遅延構築（BR-G-06）、写真インジケーターのボタン列（BR-G-08）、`modechange`/`photochange`/`fullscreenchange` 購読による同期・自動非表示再評価（BR-G-04/05）、単発アクションボタン後の `container.focus()` 復帰（BR-G-11）、`textContent`/`setAttribute` のみによる文言反映（SP-G-1） |

### 1-2. 既存ファイルの修正（UoW-A〜F マージ済みコードへの拡張）

| パス | 変更内容 |
|---|---|
| `viewer/types.ts` | `PhotoChangeEvent` に `total: number` 追加（E6、BR-G-07）、`ViewerOptions` に `controls?: boolean \| Partial<ControlsVisibility>`/`text?: Partial<UITextMap>` 追加（E4）、`ViewerHandle` に `setControlsVisibility`/`setText`/`getPhotoCount` 追加（`component-methods.md` 確定済みシグネチャの初実装＋新規拡張、E5） |
| `viewer/createViewer.ts` | `_options` を `options` に改名し実際に読む。`getMode()` ヘルパーを追加。`GalleryCapability` に `getPhotoCount` を追加（正常系 `() => gallery.size`／縮退ハンドル `() => 0`）。`switchToPhoto` の `photochange` 発火に `total: gallery.size` を追加（BR-G-07）。`buildControlsUI(...)` ヘルパーを新設し、正常系・縮退ハンドル系の両方の分岐から `ControlsUI` を構築（下記「4. 計画からの主な逸脱」参照）。`HandleDeps`/`buildHandle` に `controls` capability（`setVisibility`/`setText`）を追加し、`ViewerHandle.setControlsVisibility`/`setText`/`getPhotoCount` を実装 |
| `index.ts` | 新規公開型（`ControlsVisibility`/`UITextMap`）を re-export に追加 |
| `viewer/__tests__/createViewer.test.ts` | 「縮退時も container に何も描画しない」テスト（NFR Design Q6=A、UoW-A）を `options.controls: false` を明示したヘッドレス検証に更新（下記「4」参照） |
| `viewer/__tests__/createViewer.gallery.test.ts` | `photochange` の `toHaveBeenCalledWith` アサーション2箇所に `total` を追加 |

### 1-3. テスト（新規）

| ファイル | テスト対象 | 手法 |
|---|---|---|
| `ui/__tests__/controlsLogic.test.ts` | `computeEffectiveVisibility`/`resolveText` の不変条件 | fast-check（PBT、`tech-stack-decisions.md` §2） |
| `ui/__tests__/ControlsUI.test.ts` | DOM 構築、共有 `<style>` の重複防止、各コントロールのクリック/change ハンドラ、`container.focus()` 復帰、モード select の遅延構築、写真インジケーターの構築・`goTo`、`modechange`/`photochange`/`fullscreenchange` による同期・自動非表示再評価、`setVisibility`/`setText`（`innerHTML` 未使用の確認込み）、`dispose()` | example-based（標準 DOM API のみに依存するためモック不要。フェイクの `ControlsUIDeps` を都度注入） |
| `viewer/__tests__/createViewer.controls.test.ts` | `options.controls` 省略/`false`/部分オブジェクトでの初期表示、`getPhotoCount()`・`photochange.total` の整合、縮退ハンドルでの構築・自動非表示、`dispose()` での DOM 除去 | example-based（既存 `MockRenderer`/`MockLoader` パターンを再利用） |

**テスト結果**: 31 ファイル・293 テスト全て pass（UoW-A〜F の既存 266 件を含む、回帰なし。UoW-G 新規・拡張分 27 件）。

## 2. ストーリートレーサビリティ

| ストーリー | 対応箇所 | 状態 |
|---|---|---|
| US-26（表示/非表示・スタイル・ヘッドレス） | `ControlsVisibility`/`computeEffectiveVisibility`、`ViewerOptions.controls`/`setControlsVisibility`、Light DOM + 名前空間クラスによるスタイルカスタマイズ | ✅ 実装済み |
| US-27（文言・aria-label 差し替え） | `UITextMap`/`resolveText`、`ViewerOptions.text`/`setText` | ✅ 実装済み |
| US-35（アクセシビリティ） | ネイティブ `<button>`/`<select>`・ARIA 属性（`role`/`aria-label`/`aria-current`）・`container.focus()` 復帰（BR-G-11） | ✅ 実装済み |
| US-24（サムネ/インジケーター表現、補足） | 写真インジケーターのボタン列（BR-G-08） | ✅ 実装済み |

## 3. 既知の制約・スコープ境界（レビュー時の確認事項）

- **実サムネイル画像は描画しない**（Functional Design Q6=A の裏返し）: 写真インジケーターは番号ボタン列であり、`<img>` によるプレビューは提供しない（性能方針との整合を優先、`business-rules.md` BR-G-08）。
- **モード動的登録の反映は select の操作直前まで遅延する**（Functional Design Q4=A の裏返し）: `registerMode()` 呼び出し直後は select の選択肢に即座には反映されない。次回の `pointerdown`/`focus`（または `modechange` による自動非表示の再評価）まで遅延する既知の制約。
- **`setPhotos([])` による明示的なクリアは自動非表示に反映されない**（`business-rules.md` BR-G-05 の既知の制約）: 空リストへのクリアは `photochange` を発火させないため、`photoNav`/`photoIndicator` は直前の表示状態のまま残る。
- **実ブラウザでの操作感確認は未実施**: UoW-D/UoW-E/UoW-F と同様、実際の見た目・キーボードとマウスの切替時の体験は手動確認が必要。

## 4. 計画からの主な逸脱と理由

1. **`ControlsUI` は縮退ハンドル（WebGL2 非対応）でも構築することにした**（Functional Design 時点では明示していなかった設計判断、Code Generation 計画時点で発見。UoW-F `FullscreenManager` の先例を踏襲）: `interaction`/`gallery` capability が縮退ハンドルで安全な no-op になるのは「反映先の `Renderer` が存在しないため」だが、`ControlsUI` は DOM のみに依存し `Renderer`/WebGL に一切依存しない。したがって `inBrowser`（真の SSR でない）であれば縮退ハンドルでも構築する設計とした。`modeSwitch`（`listModes()` が `["standard"]` のみ）・`photoNav`/`photoIndicator`（`getPhotoCount()` が `0`）は自動非表示（BR-G-04/05）になるため、実質的に「フルスクリーンボタンのみ表示される」縮退 UI として自然にフォールバックする。`createViewer.controls.test.ts` の「縮退ハンドルでも構築される」テストで検証済み。
2. **UoW-A の既存テスト「縮退時も container に何も描画しない（NFR Design Q6=A）」を更新した**: 当時の UoW-A `nfr-design-patterns.md` は「縮退時のフォールバック UI の見た目は UoW-G の責務」と明記しており、UoW-G が実装されれば `container` へ描画すること自体は当初から想定内だった。UoW-D の `toggleFullscreen` no-op テストが UoW-F で置き換えられたのと同じパターンとして、本テストを `options.controls: false`（ヘッドレス明示）での検証に更新し、「UoW-A（Renderer/WebGL 層）自体は縮退時も何も描画しない」という原意は維持した。

## 5. 検証結果

- `pnpm -r build`: green（tsup ESM + `.d.ts` 生成成功）
- `pnpm -r test`: green（31 ファイル・293 テスト pass、UoW-A〜F の既存 266 件を含め回帰なし）
- `pnpm -r lint`: green（`prettier --write` によるフォーマット整形3件を適用済み、ESLint エラーなし）
- `pnpm audit --prod`: 既知の脆弱性なし
