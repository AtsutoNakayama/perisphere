# Unit of Work Plan — perisphere（システム分解計画）

- **関連 Issue**: [#21](https://github.com/AtsutoNakayama/perisphere/issues/21)
- **作成日**: 2026-06-29
- **ステータス**: 質問回答確定（Q1〜Q6 = A）。曖昧性・矛盾なしと判定。Part 1 承認待ち（Units Generation Part 1）
- **前提資料**: `inception/application-design/`（components / services / component-dependency / application-design）、`inception/user-stories/stories.md`、`inception/requirements/requirements.md`

## このステージの目的

システムを開発上の管理単位（**Unit of Work**）に分解する。perisphere は単一アプリ（モノレポ・ライブラリ）であり、各ユニットは「ストーリーの論理的グルーピング」＝ Construction で個別に設計・実装する単位、かつ後続 Issue の起票単位になる。

- 用語: 独立配布物 = **Package**（`@perisphere/core` / `@perisphere/react`）、論理モジュール = **Module/Unit**、計画上の括り = **Unit of Work**。
- Construction（Functional Design 以降）は本 Issue（#21）のスコープ外。ユニットごとに後続 Issue で着手する。

## 計画ステップ（チェックボックス）

- [x] 1. コンテキスト分析（components / services / dependency と Epic E1〜E8・US-01〜37 を突き合わせ、凝集度の高いまとまりを抽出。暫定ユニット候補 UoW-A〜I として提示済み）
- [x] 2. 分解方針の確認質問に回答を得る（本書末尾 Q1〜Q6。回答: すべて A）
- [x] 3. 回答の曖昧性・矛盾を分析（結果: 曖昧・矛盾なし。Q1=A の9ユニット細分化と Q2=A のパッケージ構成〔core/react/apps/demo/docs〕は「Unit of Work」と「Package」が別レイヤの概念であるため整合。Q1=A（小さく刻める）と Q5=A（1 unit = 1 Issue）は方向性が一致。Q4=A により Future ストーリー専用ユニットが基本9ユニットに追加され得る点を Part 2 で反映。follow-up 質問は不要と判断）
- [x] 4. 成果物生成（承認後 / Part 2）:
  - [x] `inception/application-design/unit-of-work.md`（ユニット定義・責務・担当コンポーネント・コード構成戦略。13 ユニット: In MVP 9 + Future 4）
  - [x] `inception/application-design/unit-of-work-dependency.md`（ユニット間依存マトリクス・ビルド/実装順。UoW-A を根とする DAG、循環なし）
  - [x] `inception/application-design/unit-of-work-story-map.md`（US-01〜37 → ユニット割当。全 37 ストーリー網羅を確認）
- [x] 5. ユニット境界・依存の検証（循環なし／全ストーリーがいずれかのユニットに属することを `unit-of-work-story-map.md` の網羅性検証で確認）
- [x] 6. Part 1 計画承認 → Part 2 生成 → aidlc-state.md 更新

---

## 分解方針の確認質問（[Answer]: に英字で回答してください）

> 暫定のユニット候補（粒度の議論用。Q1 で粒度を決めます）:
> UoW-A コア基盤（Renderer/Viewer/EventBus/State/Error/Disposable）、UoW-B 画像入力・ロード、UoW-C 投影モード、UoW-D 視点操作・入力、UoW-E ギャラリー、UoW-F フルスクリーン、UoW-G 同梱コントロール UI、UoW-H React アダプタ、UoW-I ドキュメント/デモ。

## Question 1
ユニット分解の粒度・戦略はどれにしますか？

A) 機能ドメイン単位で細かく（上記 UoW-A〜I の 9 ユニット相当）。後続 Issue を小さく刻める／管理対象は増える

B) レイヤ粗め（例: 「コア基盤」「コア機能群（入力/投影/ギャラリー/フルスクリーン/UI）」「React アダプタ」「ドキュメント/デモ」の 4 ユニット）

C) パッケージ境界に一致（`@perisphere/core` = 1 ユニット、`@perisphere/react` = 1 ユニット、docs/demo = 1 ユニットの 3 ユニット）

D) Other（[Answer]: の後に記述）

[Answer]: A

## Question 2
グリーンフィールドのコード構成（ディレクトリ/配布モデル）はどうしますか？（Q1=A 単一コア・モノレポ前提）

A) `packages/core`・`packages/react`・`apps/demo`（デモサイト）・`docs`（API リファレンス）のワークスペース構成

B) `packages/*` のみ（デモは `examples/` に最小サンプルとして同梱、独立アプリにしない）

C) Other（[Answer]: の後に記述）

[Answer]: A

## Question 3
ワークスペース管理ツール（パッケージマネージャ）は本ステージで確定しますか？

A) ここでは決めず、Construction の NFR Requirements（技術スタック確定）で決める（ディレクトリ構成のみ先に固定）

B) ここで方針だけ確定する（その場合は X) Other で希望ツールを記述: pnpm / npm / yarn workspaces 等）

C) Other（[Answer]: の後に記述）

[Answer]: A

## Question 4
Future 優先度のストーリー（US-05 入力ソース追加 / US-11 アニメ遷移 / US-25 ツアー / US-33 の Vue 等）の扱いは？

A) Future 専用ユニットに隔離する（拡張点の確保は対応 In MVP ユニットに含め、Future 実装自体は別ユニット＝後続 Issue）

B) Future 実装はユニット化せず、対応する In MVP ユニットに「拡張点のみ」を含める（Future 実装は将来別途 Issue 化）

C) Other（[Answer]: の後に記述）

[Answer]: A

## Question 5
ユニットと後続 Issue/PR の対応方針は？（CONTRIBUTING の短命ブランチ・Issue ベース運用前提）

A) 原則 1 ユニット = 1 後続 Issue = 1 PR（小さく刻む）

B) 依存の強いユニットをまとめて 1 Issue 化（例: コア基盤 + 投影をまず 1 本）

C) Other（[Answer]: の後に記述）

[Answer]: A

## Question 6
ユニットの実装順（マイルストーン）の方針は？

A) 基盤優先（コア基盤 → 画像入力 → 投影 → 操作 → ギャラリー/フルスクリーン/UI → React アダプタ → docs/demo）。最短で「1 枚を標準ビューで表示」できる縦切りを最初の到達点にする

B) 縦切り MVP 優先（最小機能の end-to-end〔表示+ドラッグ+1モード+React+デモ〕を最初に通し、以降モードや UI を肉付け）

C) Other（[Answer]: の後に記述）

[Answer]: A