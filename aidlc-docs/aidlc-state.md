# AI-DLC State Tracking

## Project Information

- **Project Type**: Greenfield
- **Project Name**: perisphere — 360°写真 Web ビューワーライブラリ
- **Related Issue**: [#21](https://github.com/AtsutoNakayama/perisphere/issues/21)
- **Start Date**: 2026-06-10T13:12:41Z
- **Current Stage**: INCEPTION PHASE 完了（Units Generation 承認: 2026-07-20）。Issue #21 スコープの Inception 作業は完了。CONSTRUCTION は unit ごとの後続 Issue で着手予定

## Workspace State

- **Existing Code**: No（ガバナンス文書・CI 設定のみ。製品コードなし）
- **Reverse Engineering Needed**: No（グリーンフィールドのためスキップ）
- **Workspace Root**: /home/nakayama/repos/perisphere

## Code Location Rules

- **Application Code**: Workspace root (NEVER in aidlc-docs/)
- **Documentation**: aidlc-docs/ only
- **Structure patterns**: See code-generation.md Critical Rules

## Extension Configuration

| Extension | Enabled | Decided At |
|---|---|---|
| Security Baseline | Yes | Requirements Analysis（2026-06-10） |
| Resiliency Baseline | Yes | Requirements Analysis（2026-06-10） |
| Property-Based Testing | Yes（全面適用 / Full enforcement） | Requirements Analysis（2026-06-10） |

## Stage Progress

### 🔵 INCEPTION PHASE

- [x] Workspace Detection（完了: 2026-06-10 / グリーンフィールド判定）
- [x] Reverse Engineering — スキップ（グリーンフィールドのため対象なし）
- [x] Requirements Analysis（成果物 `inception/requirements/requirements.md` / 深度: Comprehensive。**ユーザー承認: 2026-06-17**。承認前に FR-01・NFR-01 を修正: 画像サイズの固定上限を撤廃し 8K を動作保証ラインに再定義）
- [x] User Stories（Part 1 計画承認済み。Part 2 で `user-stories/personas.md`（P1〜P3）・`user-stories/stories.md`（US-01〜US-37, Epic E1〜E8）生成。**ユーザー承認: 2026-06-29**）
- [x] Workflow Planning（実行計画 `inception/plans/execution-plan.md` 作成。Application Design = EXECUTE / Units Generation = EXECUTE を推奨。**ユーザー承認: 2026-06-29**）
- [x] Application Design（設計方針 Q1〜Q8 回答確定: A,B,C,A,D,A,A,A。成果物 `inception/application-design/`（components / component-methods / services / component-dependency / application-design）生成。**ユーザー承認: 2026-06-29**）
- [x] Units Generation（Part 1: 分解方針質問 Q1〜Q6 回答確定（すべて A）・曖昧性なしと判定・**Part 1 承認: 2026-07-20**。Part 2: `unit-of-work.md`（13 ユニット: In MVP 9 + Future 4）／`unit-of-work-dependency.md`（DAG・循環なし）／`unit-of-work-story-map.md`（US-01〜37 全件網羅）を生成。**ユーザー承認: 2026-07-20**）

**INCEPTION PHASE 完了（2026-07-20）**

### 🟢 CONSTRUCTION PHASE

（Issue #21 のスコープ外 — unit ごとに後続 Issue を起票予定。実行計画の暫定推奨: Functional Design / NFR Requirements / NFR Design / Infrastructure Design（minimal）/ Code Generation / Build and Test をいずれも EXECUTE）

#### UoW-A コア基盤（[#27](https://github.com/AtsutoNakayama/perisphere/issues/27) / ブランチ `feat/27-uow-a-core`）

- [x] Functional Design（成果物 `construction/uow-a/functional-design/`: domain-entities.md / business-rules.md / business-logic-model.md。**ユーザー承認: 2026-08-02**）
- [x] NFR Requirements（成果物 `construction/uow-a/nfr-requirements/`: nfr-requirements.md / tech-stack-decisions.md。技術スタック確定: pnpm workspaces / tsup / Vitest / fast-check / ESLint+Prettier / TS strict / three.js peerDependencies広めrange / Dependabot+CI監査 / ES2020ターゲット。**ユーザー承認: 2026-08-02**）
- [x] NFR Design（成果物 `construction/uow-a/nfr-design/`: nfr-design-patterns.md / logical-components.md。Resilience/Performance/Securityパターン確定、新規論理コンポーネント ContextRecoveryState（状態機械）を導入。**ユーザー承認: 2026-08-02**）
- [x] Infrastructure Design（成果物 `construction/uow-a/infrastructure-design/`: infrastructure-design.md / deployment-architecture.md。CI ジョブ〔lint/build/test〕・Dependabot 概念設計、npm 公開はスコープ外。**ユーザー承認: 2026-08-03**）
- [x] Code Generation（成果物 `construction/plans/uow-a-code-generation-plan.md`（Step 1〜7 全完了）、`packages/core`（`@perisphere/core`）一式、`construction/uow-a/code/code-summary.md`。`pnpm -r build`/`test`/`lint` 全て green。**ユーザー承認: 2026-08-03**）
- [ ] Build and Test（全ユニット共通、最後にまとめて実施のため UoW-A 時点では保留）

**UoW-A Per-Unit Loop 完了（2026-08-03）。PR #28 マージ・Issue #27 クローズ済み。main 同期済み。**

#### UoW-B 画像入力・ロード（[#34](https://github.com/AtsutoNakayama/perisphere/issues/34) / ブランチ `feat/34-uow-b-loading`）

- [x] Functional Design（Q1〜Q8 回答確定〔全て推奨案採用〕。成果物 `construction/uow-b/functional-design/`: domain-entities.md / business-rules.md / business-logic-model.md。UoW-A 既存実装への拡張点（ViewerEventMap.progress・ViewerState.imageLoadState・ViewerHandle.loadImage/registerSource・Renderer.setSphereTexture）を明記。**ユーザー承認: 2026-08-03**）
- [x] NFR Requirements（成果物 `construction/uow-b/nfr-requirements/`: nfr-requirements.md / tech-stack-decisions.md。UoW-A のモノレポ横断決定を継承し、UoW-B固有: Loaderをテスト境界化・fetchのvi.fn直接モック・PBT対象拡大（アスペクト比境界値/多重呼び出しキャンセル）・新規ランタイム依存なし。**ユーザー承認: 2026-08-03**）
- [x] NFR Design（成果物 `construction/uow-b/nfr-design/`: nfr-design-patterns.md / logical-components.md。Resilience: Single-Attempt Load/Cancellation-over-Retry、Performance: Throttled Progress Emission、Security: Layered Validation継続、L1〜L5論理コンポーネント確定。**ユーザー承認: 2026-08-03**）
- [x] Infrastructure Design（成果物 `construction/uow-b/infrastructure-design/`: infrastructure-design.md / deployment-architecture.md。インフラ変更なし（CI/Dependabotとも既存でカバー）。**ユーザー承認: 2026-08-03**）
- [x] Code Generation（成果物 `construction/plans/uow-b-code-generation-plan.md`（Step 2〜5,7 全完了）、`packages/core/src/loader/` 新規一式、`viewer/` への拡張、`construction/uow-b/code/code-summary.md`。テスト9ファイル66件（UoW-A既存32件含む）green、`pnpm -r build/test/lint`・`pnpm audit --prod` 全て green。**ユーザー承認: 2026-08-03**）
- [ ] Build and Test（全ユニット共通、最後にまとめて実施のため保留）

**UoW-B Per-Unit Loop 完了（2026-08-03）。「1枚の画像を標準ビューで表示」という最初の縦切り到達点（UoW-A+UoW-B）が完成。**

#### UoW-C 投影モード（[#36](https://github.com/AtsutoNakayama/perisphere/issues/36) / ブランチ `feat/36-uow-c-modes`）

- [x] Functional Design（Q1〜Q6 回答確定〔全て推奨案採用〕。成果物 `construction/uow-c/functional-design/`: domain-entities.md / business-rules.md / business-logic-model.md。実装方式をハイブリッド確定（カメラベース: UltraWide/Linear、シェーダベース: Dewarp/Panini/TinyPlanet、外部カメラ: CrystalBall）。UoW-A `Renderer`/`ModeContext` への拡張点（`setSphereMaterial`・`texture` フィールド）を明記。**ユーザー承認: 2026-08-03**）
- [x] NFR Requirements（成果物 `construction/uow-c/nfr-requirements/`: nfr-requirements.md / tech-stack-decisions.md。UoW-Bとの統合欠陥を発見・対応方針確定（Renderer.setSphereTextureのマテリアル非依存化）。ShaderMaterialのモードごとキャッシュ、投影数式のTS純粋関数切り出し+PBT。**ユーザー承認: 2026-08-03**）
- [x] NFR Design（成果物 `construction/uow-c/nfr-design/`: nfr-design-patterns.md / logical-components.md。Resilience: シェーダ欠陥への実行時フォールバック不採用、Performance: ジオメトリ共用+ShaderMaterialキャッシュ、L1〜L5論理コンポーネント確定。**ユーザー承認: 2026-08-03**）
- [x] Infrastructure Design（成果物 `construction/uow-c/infrastructure-design/`: infrastructure-design.md / deployment-architecture.md。インフラ変更なし。**ユーザー承認: 2026-08-03**）
- [x] Code Generation（成果物 `construction/plans/uow-c-code-generation-plan.md`（Step 2〜5,7 全完了）、`packages/core/src/modes/` 新規一式、`viewer/` への拡張、`construction/uow-c/code/code-summary.md`。テスト17ファイル128件（UoW-A/B既存66件含む）green、`pnpm -r build/test/lint`・`pnpm audit --prod` 全て green。**ユーザー承認: 2026-08-03**）
- [ ] Build and Test（全ユニット共通、最後にまとめて実施のため保留）

**UoW-C Per-Unit Loop 完了（2026-08-03）。標準以外の6モード（UltraWide/Dewarp/Linear/Panini/TinyPlanet/CrystalBall）+ カスタムモード登録機構が完成。**

#### UoW-D 視点操作・入力（[#38](https://github.com/AtsutoNakayama/perisphere/issues/38) / ブランチ `feat/38-uow-d-input`）

- [x] Functional Design（Q1〜Q8 回答確定〔全て推奨案採用〕。成果物 `construction/uow-d/functional-design/`: domain-entities.md / business-rules.md / business-logic-model.md。既存 IF との突き合わせで発見: `ViewerHandle.setView/getView/setZoomLimits/registerInputSource/setKeymap` と `viewchange`/`zoomchange` イベントは Inception で確定済みだったため計画時の誤りを訂正（`setZoomLimits` は `Partial<ZoomLimits>` 方式）。`ViewerMode` IF へ `defaultView?` を追加（モード切替直後の ViewController 同期のため）。**ユーザー承認: 2026-08-03**）
- [x] NFR Requirements（Q1〜Q7 回答確定〔全て推奨案採用〕。成果物 `construction/uow-d/nfr-requirements/`: nfr-requirements.md / tech-stack-decisions.md。Performance（発火頻度制御・ホットパス方針）と Accessibility（UoW-D/UoW-G境界）を本ユニットの主担当カテゴリと判定。新規ランタイム依存なし。**ユーザー承認: 2026-08-03**）
- [x] NFR Design（Q1〜Q4 回答確定〔全て推奨案採用〕。成果物 `construction/uow-d/nfr-design/`: nfr-design-patterns.md（RP-D-1 Graceful Pointer Capture Fallback / PP-D-1 Coalesced View Change Emission、既存Rendererループへ相乗り / Security新規論点なし）/ logical-components.md（L1〜L5、`viewMath.ts` 純粋関数モジュール新設）。**ユーザー承認: 2026-08-03**）
- [x] Infrastructure Design（Q1=A で確定。成果物 `construction/uow-d/infrastructure-design/`: infrastructure-design.md / deployment-architecture.md。インフラ変更なし（既存 `pnpm -r` CI ジョブでカバー）。**ユーザー承認: 2026-08-03**）
- [x] Code Generation（成果物 `construction/plans/uow-d-code-generation-plan.md`（Step 2〜5,7 全完了）、`packages/core/src/interaction/` 新規一式、`viewer/`・`modes/` への拡張、`construction/uow-d/code/code-summary.md`。テスト24ファイル214件（UoW-A/C既存128件含む）green、`pnpm -r build/test/lint`・`pnpm audit --prod` 全て green。計画からの逸脱3件（pitchクランプ[-89,89]→[-90,90]訂正、`ViewerState.ts`のUoW-B由来の`imageLoadState`初期化漏れを発見・修正、`Renderer.test.ts`へのonFrame単体テスト追加を見送りcreateViewer.interaction.test.tsへ統合）を code-summary.md に記載。**ユーザー承認: 2026-08-03**）
- [ ] Build and Test（全ユニット共通、最後にまとめて実施のため保留）

**UoW-D Per-Unit Loop 完了（2026-08-03）。マウス/タッチ/キーボードでの視点操作（pan/tilt/zoom）とキーマップ・ズーム上下限の設定が完成。PR #39 マージ・Issue #38 クローズ済み。main 同期済み。**

#### UoW-E ギャラリー（[#40](https://github.com/AtsutoNakayama/perisphere/issues/40) / ブランチ `feat/40-uow-e-gallery`）

- [x] Functional Design（Q1〜Q8 回答確定〔全て推奨案採用〕。成果物 `construction/uow-e/functional-design/`: domain-entities.md / business-rules.md / business-logic-model.md。`PhotoInput`型を新規定義（`ImageInput | { src; id? }`）、`GalleryMoveResult`判別型で写真未設定時の無視（Q3）とgoTo範囲外エラー（Q4）を区別、UoW-D `BR-D-16`（photoNext/photoPrev意図的no-op）を本ユニットで解消する設計を確定。**ユーザー承認: 2026-08-03**）
- [x] NFR Requirements（Q1〜Q4 回答確定〔全て推奨案採用〕。成果物 `construction/uow-e/nfr-requirements/`: nfr-requirements.md / tech-stack-decisions.md。プリロードなし・オンデマンドロード方針、Gallery独立テスト境界、NFR-09が名指しした「ギャラリー」状態管理のPBT対象化を確定。**ユーザー承認: 2026-08-03**）
- [x] NFR Design（Q1〜Q3 回答確定〔全て推奨案採用〕。成果物 `construction/uow-e/nfr-design/`: nfr-design-patterns.md（RP-E-1 Pending-vs-Confirmed Pointer Separation〔本ステージでの発見〕/ RP-E-2 / SP-E-1、Rejected Patterns）/ logical-components.md（L1〜L4）。Q1 承認に伴い Functional Design 成果物（domain-entities.md/business-rules.md/business-logic-model.md）へ `Gallery.current`（目標ポインタ）と `ViewerState.photoIndex`（表示中ポインタ）の分離を遡及反映。**ユーザー承認: 2026-08-03**）
- [x] Infrastructure Design（Q1=A で確定。成果物 `construction/uow-e/infrastructure-design/`: infrastructure-design.md / deployment-architecture.md。インフラ変更なし（既存 `pnpm -r` CI ジョブでカバー）。**ユーザー承認: 2026-08-03**）
- [x] Code Generation（成果物 `construction/plans/uow-e-code-generation-plan.md`（Step 2〜5,7 全完了）、`packages/core/src/gallery/` 新規一式、`viewer/`・`index.ts` への拡張、`construction/uow-e/code/code-summary.md`。テスト26ファイル241件（UoW-A/B/C/D既存214件含む）green、`pnpm -r build/test/lint`・`pnpm audit --prod` 全て green。計画からの逸脱1件（`photoNext`/`photoPrev`実切替検証テストの配置先を`createViewer.interaction.test.ts`〔Loader未モック〕から`createViewer.gallery.test.ts`〔Loaderモック済み〕へ変更）を code-summary.md に記載。**ユーザー承認: 2026-08-03**）
- [ ] Build and Test（全ユニット共通、最後にまとめて実施のため保留）

**UoW-E Per-Unit Loop 完了（2026-08-03）。複数写真の next/prev/index切替とギャラリーAPI（setPhotos/next/prev/goTo/getPhotoIndex/photochange）が完成。UoW-D で先行実装済みだった photoNext/photoPrev キー操作もここで実際の写真切替に結線された。PR #41 マージ・Issue #40 クローズ済み。main 同期済み。**

#### UoW-F フルスクリーン（[#42](https://github.com/AtsutoNakayama/perisphere/issues/42) / ブランチ `feat/42-uow-f-fullscreen`）

- [x] Functional Design（Q1〜Q8 回答確定〔全て推奨案採用〕。成果物 `construction/uow-f/functional-design/`: domain-entities.md / business-rules.md / business-logic-model.md。`FullscreenManager`（C9）の設計を確定: 対象要素は container（Q1）、非対応環境は擬似フルスクリーン〔インラインスタイル方式〕（Q2）、擬似モード中のEscキー対応（Q3）、ネイティブAPI実行時失敗は`error`(`FULLSCREEN_FAILED`新設)発火+reject・擬似へは自動フォールバックしない（Q4/Q6）、ネイティブモードの状態遷移は`document`の`fullscreenchange`イベントに一本化（Q5）、`dispose()`時の自動解除（Q7）。本ステージで発見したギャップ（`Renderer`がコンテナサイズ変化に追従しない）への対応として`Renderer.resize()`を新設しフルスクリーン切替時のみ呼び出す範囲に限定（Q8）。**ユーザー承認: 2026-08-03（全質問を推奨案で確定、以降の全ステージを事前承認）**）
- [x] NFR Requirements（Q1〜Q4 回答確定〔全て推奨案採用〕。成果物 `construction/uow-f/nfr-requirements/`: nfr-requirements.md / tech-stack-decisions.md。jsdom が Fullscreen API 未実装であることを確認し、非対応分岐はモック不要・対応分岐はテストごとの `vi.fn()` スタブ注入で検証する方針を確定（UoW-A の WebGL モックと同パターン）。`FullscreenManager` の状態遷移を PBT 対象化。新規ランタイム依存なし。`Renderer.resize()` は既存 Renderer テスト境界を再利用。**ユーザー承認: 2026-08-03（事前承認済み・全て推奨案）**）
- [x] NFR Design（Q1〜Q3 回答確定〔全て推奨案採用〕。成果物 `construction/uow-f/nfr-design/`: nfr-design-patterns.md（RP-F-1 Silent Best-Effort Cleanup〔新規発見〕/ RP-F-2 Native-Change-Event as Single Source of Truth / SP-F-1 攻撃面の不在 / LC-F-1,2、Rejected Patterns）/ logical-components.md（L1〜L5）。Q1 承認に伴い Functional Design 成果物（business-rules.md BR-F-08）へ fire-and-forget 呼び出しの `.catch(() => {})` 明記を遡及反映。**ユーザー承認: 2026-08-03（事前承認済み・全て推奨案）**）
- [x] Infrastructure Design（Q1=A で確定。成果物 `construction/uow-f/infrastructure-design/`: infrastructure-design.md / deployment-architecture.md。インフラ変更なし（既存 `pnpm -r` CI ジョブでカバー）。**ユーザー承認: 2026-08-03（事前承認済み）**）
- [x] Code Generation（成果物 `construction/plans/uow-f-code-generation-plan.md`（Step 2〜5,7 全完了）、`packages/core/src/fullscreen/` 新規一式、`viewer/`・`index.ts` への拡張、`construction/uow-f/code/code-summary.md`。テスト28ファイル266件（UoW-A/B/C/D/E既存241件含む）green、`pnpm -r build/test/lint`・`pnpm audit --prod` 全て green。計画からの逸脱2件（フルスクリーンは縮退ハンドル〔WebGL2非対応〕でも実機能とする設計判断〔Renderer非依存のため〕、`Renderer.resize()`のテスト境界を実際の`Renderer`モック方式に訂正）を code-summary.md に記載。**ユーザー承認: 2026-08-03（事前承認済み）**）
- [ ] Build and Test（全ユニット共通、最後にまとめて実施のため保留）

**UoW-F Per-Unit Loop 完了（2026-08-03）。フルスクリーン切替 API（enterFullscreen/exitFullscreen/isFullscreen/fullscreenchange）と非対応環境向け擬似フルスクリーンが完成。UoW-D で先行実装済みだった toggleFullscreen キー操作もここで実際の切替に結線された。PR #43 マージ・Issue #42 クローズ済み。main 同期済み。**

#### UoW-G 同梱コントロール UI（[#44](https://github.com/AtsutoNakayama/perisphere/issues/44) / ブランチ `feat/44-uow-g-controls-ui`）

- [x] Functional Design（Q1〜Q9 回答確定〔全て推奨案採用〕。成果物 `construction/uow-g/functional-design/`: domain-entities.md / business-rules.md / business-logic-model.md / frontend-components.md。`ControlsVisibility`/`UITextMap` 新規型、`ViewerOptions.controls`/`text`・`ViewerHandle.setControlsVisibility`/`setText`/`getPhotoCount` 追加、`photochange.total` 追加を確定。発見したギャップ3件（写真総数非公開・BR-D-17とのフォーカス相互作用・registerMode非通知）への対応方針を確定。**ユーザー承認: 2026-08-04（包括承認・全て推奨案）**）
- [x] NFR Requirements（Q1〜Q4 回答確定〔全て推奨案採用〕。成果物 `construction/uow-g/nfr-requirements/`: nfr-requirements.md / tech-stack-decisions.md。共有`<style>`タグのテスト独立性確保方針、表示状態計算・文言置換の純粋関数化とPBT対象化、`UITextMap`のtextContent/setAttribute限定（SECURITY-05）を確定。新規ランタイム依存なし。**ユーザー承認: 2026-08-04（包括承認）**）
- [x] NFR Design（Q1〜Q3 回答確定〔全て推奨案採用〕。成果物 `construction/uow-g/nfr-design/`: nfr-design-patterns.md（RP-G-1 Silent Best-Effort Action / SP-G-1 Safe Text Rendering / SP-G-2 追加検証パターンなし / LC-G-1,2、Rejected Patterns）/ logical-components.md（L1〜L5、新規ディレクトリ`packages/core/src/ui/`確定）。**ユーザー承認: 2026-08-04（包括承認）**）
- [x] Infrastructure Design（Q1=A で確定。成果物 `construction/uow-g/infrastructure-design/`: infrastructure-design.md / deployment-architecture.md。インフラ変更なし。**ユーザー承認: 2026-08-04（包括承認）**）
- [x] Code Generation（成果物 `construction/plans/uow-g-code-generation-plan.md`（Step 2〜5,7 全完了）、`packages/core/src/ui/` 新規一式、`viewer/`（`types.ts`/`createViewer.ts`）・`index.ts` への拡張、`construction/uow-g/code/code-summary.md`。テスト31ファイル293件（UoW-A/B/C/D/E/F既存266件含む）green、`pnpm -r build/test/lint`・`pnpm audit --prod` 全て green。計画からの逸脱2件（`ControlsUI`は縮退ハンドル〔WebGL2非対応〕でも実機能とする設計判断〔UoW-F FullscreenManagerの先例を踏襲〕、UoW-A の「縮退時container無変更」テストを`options.controls:false`明示のヘッドレス検証へ更新）を code-summary.md に記載。**ユーザー承認: 2026-08-04（事前の包括承認済み）**）
- [ ] Build and Test（全ユニット共通、最後にまとめて実施のため保留）

**UoW-G Per-Unit Loop 完了（2026-08-04）。素DOMによる同梱コントロールUI（フルスクリーン/ズーム/モード切替/写真前後/写真インジケーター）と、表示/非表示・スタイル・ヘッドレス・文言差し替えのAPI（setControlsVisibility/setText/ViewerOptions.controls/text）が完成。**

## Notes

- 監査ログ `aidlc-docs/audit.md` はリポジトリ方針によりローカル限定（`.gitignore` 済み）。
- ブランチ: `docs/21-inception-360-viewer`（Inception フェーズを単一ブランチで実施、最終 PR で `Closes #21`）。
