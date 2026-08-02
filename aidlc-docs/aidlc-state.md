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
- [ ] Infrastructure Design
- [ ] Code Generation
- [ ] Build and Test（全ユニット共通、最後にまとめて実施）

## Notes

- 監査ログ `aidlc-docs/audit.md` はリポジトリ方針によりローカル限定（`.gitignore` 済み）。
- ブランチ: `docs/21-inception-360-viewer`（Inception フェーズを単一ブランチで実施、最終 PR で `Closes #21`）。
