# perisphere プロジェクト固有メモ

<!-- perisphere 独自の運用メモ（ベンダー管理ではない）。root CLAUDE.md から @import される。 -->

## 作業の進め方

- すべての作業は **Issue ベース + GitHub Flow** で進める。詳細は `CONTRIBUTING.md` に従う（ブランチ名 `<type>/<issue番号>-<説明>`、Conventional Commits、PR 本文に `Closes #N`、Squash merge）。
- `main` はブランチ保護下にあり直接 push できない。変更は必ず PR 経由で行う。
- 変更は Issue 単位で小さく進め、PR ごとに CI（`Markdown lint` / `Link check`）を緑にする。push 前にローカルで `markdownlint-cli2` を回すと早い。

## AI-DLC ワークフローの適用範囲

`instructions/AIDLC.md` の AI-DLC ワークフロー（ウェルカムメッセージ・段階的ステージ・`aidlc-docs/` への記録など）は **perisphere の「製品開発」にのみ適用**する。

- **リポジトリのガバナンス / メタ作業**（LICENSE・CONTRIBUTING・テンプレート・CI・ブランチ保護・README のひな形・CLAUDE.md 自体の整備・軽微なドキュメント修正など）では、AI-DLC のウェルカムメッセージやステージ機構を**起動せず**、軽量に Issue→ブランチ→PR で進める。
- **製品の機能・コード・仕様**を作るときに初めて AI-DLC のワークフローに乗せる。README の本文（製品説明）もこの成果として整備する。
