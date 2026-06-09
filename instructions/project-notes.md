# perisphere プロジェクト固有メモ

<!-- perisphere 独自の運用メモ（ベンダー管理ではない）。root CLAUDE.md から @import される。 -->

## 作業の進め方

- すべての作業は **Issue ベース + GitHub Flow** で進める。詳細は `CONTRIBUTING.md` に従う（ブランチ名 `<type>/<issue番号>-<説明>`、Conventional Commits、PR 本文に `Closes #N`、Squash merge）。
- `main` はブランチ保護下にあり直接 push できない。変更は必ず PR 経由で行う。
- 変更は Issue 単位で小さく進める。PR ごとに CI（`Markdown lint` / `Link check`）を緑にする。push 前にローカルで `markdownlint-cli2` を回すと早い。
- PR をマージしたら、次のブランチを切る前に `git switch main && git pull` で `main` を同期する。
- Issue を閉じずに後続作業を残したい場合（本文を後で整備する等）は、PR 本文で `Closes #N` ではなく `Refs #N` を使う（例: README はプレースホルダのみ先行し、本文は AI-DLC 成果として #1 を継続）。

## AI-DLC ワークフローの適用範囲

`instructions/AIDLC.md` の AI-DLC ワークフロー（ウェルカムメッセージ・段階的ステージ・`aidlc-docs/` への記録など）は **perisphere の「製品開発」にのみ適用**する。

- **リポジトリのガバナンス / メタ作業**（LICENSE・CONTRIBUTING・テンプレート・CI・ブランチ保護・README のひな形・CLAUDE.md 自体の整備・軽微なドキュメント修正など）では、AI-DLC のウェルカムメッセージやステージ機構を**起動せず**、軽量に Issue→ブランチ→PR で進める。
- **製品の機能・コード・仕様**を作るときに初めて AI-DLC のワークフローに乗せる。README の本文（製品説明）もこの成果として整備する。

## CLAUDE.md と指示ファイルの構成ルール

- `CLAUDE.md` は **`@import` だけの索引**。指示本文を直接書かない。指示を増やすときは `instructions/` に md を追加し、`CLAUDE.md` に `@import` 行を1行足す。
- `instructions/AIDLC.md` と `.aidlc-rule-details/` は AI-DLC の **ベンダー管理ファイル**。手で編集しない。更新は upstream のファイルを丸ごと差し替えるだけにし、編集を AI-DLC の更新範囲に閉じる。
- `@import` 先は起動時に全文ロードされる。`.aidlc-rule-details/` のような「必要時に読む」大量ファイルは **import しない**（`AIDLC.md` の指示に従いオンデマンドで読む）。
- `CONTRIBUTING.md` は GitHub に認識させるため **root に置いたまま**にする（移動しない）。`@import` で参照する。
- CI の markdownlint は **自分たちが書く Markdown のみ**を対象とし、ベンダーの `instructions/AIDLC.md` と `.aidlc-rule-details/` は除外している。`instructions/` に**自作**の md を足すと自動で lint 対象になる（新たに**ベンダー**の md を置く場合は `.github/workflows/ci.yml` の globs に除外（`!`）を追加する）。

## 恒常的な知識・ルールの追加方針

プロジェクトで一貫して Claude Code に把握させたい恒常的な情報（規約・前提・全体に効く文脈）が増えたら、次の基準で記録先を選ぶ。

- **常時必要・簡潔・プロジェクト全体に効く** → 適切な既存 md に追記（貢献ルールは `CONTRIBUTING.md`、運用・構成は本ファイル）、または新規 md を `instructions/` に作成し `CLAUDE.md` に `@import` を1行足す。
- **特定タスク・特定パスでのみ必要 / 量が多い** → `@import` しない。パススコープルール（`.claude/rules/` の `paths:` frontmatter）や Skill など「必要時のみ読み込む」仕組みを使う。
- 理由: `@import` 先は**起動時に毎回全文ロード**されコンテキストを消費する（import してもコンテキストは減らない）。常時ロードに値する内容だけを `@import` し、それ以外はオンデマンド機構へ回して起動コンテキストの肥大を防ぐ。
