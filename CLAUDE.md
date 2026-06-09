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

- git 操作（ブランチ作成・コミット・PR 作成）を行う前に、必ず上で取り込んだ `CONTRIBUTING.md` の規約（GitHub Flow / Issue ベース運用 / Conventional Commits / Squash merge）に従うこと。
