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

**UoW-D Per-Unit Loop 完了（2026-08-03）。マウス/タッチ/キーボードでの視点操作（pan/tilt/zoom）とキーマップ・ズーム上下限の設定が完成。**

## Notes

- 監査ログ `aidlc-docs/audit.md` はリポジトリ方針によりローカル限定（`.gitignore` 済み）。
- ブランチ: `docs/21-inception-360-viewer`（Inception フェーズを単一ブランチで実施、最終 PR で `Closes #21`）。
