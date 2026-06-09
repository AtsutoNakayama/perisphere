# perisphere — Claude Code 指示書（索引）

<!--
このファイルは「索引」です。指示の実体は @import 先のファイルに置きます。
ここには指示本文を直接書かず、import 行と最小限のプロジェクト固有メモだけを置いてください。

- AI-DLC ワークフロー本文: instructions/AIDLC.md（ベンダー管理ファイル）
    直接編集しないこと。AI-DLC のアップデート時は instructions/AIDLC.md を
    丸ごと差し替えるだけで更新が完了します（root のこの索引や CONTRIBUTING.md は無変更）。
- ブランチ / コミット / PR 規約: CONTRIBUTING.md（GitHub 認識のため root に置いたまま参照）

エージェント向け指示を増やす場合は instructions/ に md を追加し、下に @import 行を1行足してください。
（@import 先は起動時に全文ロードされるため、.aidlc-rule-details/ のような「必要時に読む」
　大量ファイルは import しないこと。それらは AIDLC.md の指示に従いオンデマンドで読み込みます。）
-->

@instructions/AIDLC.md

@CONTRIBUTING.md

## プロジェクト固有メモ

### 作業の進め方

- すべての作業は **Issue ベース + GitHub Flow** で進める。詳細は上で取り込んだ `CONTRIBUTING.md` に従う（ブランチ名 `<type>/<issue番号>-<説明>`、Conventional Commits、PR 本文に `Closes #N`、Squash merge）。
- `main` はブランチ保護下にあり直接 push できない。変更は必ず PR 経由で行う。
- 変更は Issue 単位で小さく進め、PR ごとに CI（`Markdown lint` / `Link check`）を緑にする。push 前にローカルで `markdownlint-cli2` を回すと早い。

### AI-DLC ワークフローの適用範囲

`instructions/AIDLC.md` の AI-DLC ワークフロー（ウェルカムメッセージ・段階的ステージ・`aidlc-docs/` への記録など）は **perisphere の「製品開発」にのみ適用**する。

- **リポジトリのガバナンス / メタ作業**（LICENSE・CONTRIBUTING・テンプレート・CI・ブランチ保護・README のひな形・CLAUDE.md 自体の整備・軽微なドキュメント修正など）では、AI-DLC のウェルカムメッセージやステージ機構を**起動せず**、軽量に Issue→ブランチ→PR で進める。
- **製品の機能・コード・仕様**を作るときに初めて AI-DLC のワークフローに乗せる。README の本文（製品説明）もこの成果として整備する。
