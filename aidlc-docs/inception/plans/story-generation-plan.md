# Story Generation Plan — perisphere（360°写真 Web ビューワーライブラリ）

- **関連 Issue**: [#21](https://github.com/AtsutoNakayama/perisphere/issues/21)
- **作成日**: 2026-06-17
- **ステージ**: INCEPTION / User Stories — Part 1（計画）
- **前提資料**: `aidlc-docs/inception/requirements/requirements.md`（FR-01〜FR-18 / NFR-01〜NFR-12）、`user-stories-assessment.md`

このファイルは「ストーリー生成の方針」を決めるための計画です。下部の **質問（[Answer]: タグ）に回答**いただいた後、Part 2 でストーリー本体（`stories.md`）とペルソナ（`personas.md`）を生成します。

---

## 1. 方針決定のための質問

各質問の `[Answer]:` に **A〜X の記号**で回答してください（必要なら記号の後に補足を書けます）。

### Question 1 — どのペルソナをストーリーの主語に含めるか
本ライブラリには複数のユーザー種別が存在します。ストーリーの「As a ...」として扱う対象を選んでください。

A) 組み込み開発者（React/Next.js でライブラリを使うアプリ開発者）＋ エンドユーザー（同梱 UI で 360°写真を閲覧する人）の 2 種

B) 上記 2 種に加えて「拡張開発者」（カスタムビューワーモード・入力フォーマットアダプタ・将来の Vue アダプタを作る人）を加えた 3 種

C) 上記 3 種に加えて「OSS コントリビューター／メンテナ」（ドキュメント・デモ・リリース運用の観点）も加えた 4 種

X) Other（[Answer]: の後に記述）

[Answer]:B

### Question 2 — ストーリーの分割（ブレークダウン）方式
要件をどの軸でストーリーに割るかを選んでください（各方式の説明は下部「2. ブレークダウン方式の選択肢」参照）。

A) Feature-Based（機能単位: 画像入力 / ビューワーモード / 視点操作 / フルスクリーン / ギャラリー / UI / React 対応 ＝ 要件の章立てに沿う）

B) Persona-Based（ペルソナ単位でグルーピング）

C) User Journey-Based（利用フロー単位: 初期表示→操作→モード切替→写真切替 等）

D) Hybrid: Feature-Based を主軸にしつつ Epic でグルーピング（機能=Epic、その下に story）

X) Other（[Answer]: の後に記述）

[Answer]: D

### Question 3 — ストーリーの粒度
1 ストーリーあたりの大きさの目安を選んでください。

A) 細かめ（FR 1 つ ≒ 複数ストーリーに分割。受け入れ基準ごとに分けることもある）

B) 中程度（FR 1 つ ≒ おおむね 1 ストーリー。INVEST の Small を重視）

C) 粗め（関連する複数 FR をまとめた大きめのストーリー＝Epic 寄り）

X) Other（[Answer]: の後に記述）

[Answer]: A

### Question 4 — 受け入れ基準（Acceptance Criteria）の記法
各ストーリーの受け入れ基準の書き方を選んでください。

A) Given / When / Then（Gherkin 風。テスト・PBT への写像がしやすい）

B) 箇条書きのチェックリスト（要件定義書の現行スタイルに近い）

C) 両者併用（主要シナリオは Given/When/Then、補足条件は箇条書き）

X) Other（[Answer]: の後に記述）

[Answer]: C

### Question 5 — 非機能要件（NFR）のストーリー化
NFR-01〜NFR-12（性能・SSR・A11y・拡張性・依存方針・配布・テスト戦略・セキュリティ・レジリエンシー 等）の扱いを選んでください。

A) 関連する機能ストーリーの受け入れ基準に織り込む（独立した NFR ストーリーは作らない）

B) 横断的 NFR は専用の「品質ストーリー / 制約ストーリー」として別建てにする

C) 併用: ユーザー観察可能な NFR（A11y・SSR セーフ・性能体感）はストーリー化し、純粋な開発・運用方針（依存方針・配布・ライセンス）は制約として注記に留める

X) Other（[Answer]: の後に記述）

[Answer]: C

### Question 6 — 優先度の付け方
各ストーリーに付ける優先度の基準を選んでください（初期リリース MVP の線引きに使います）。

A) MoSCoW（Must / Should / Could / Won't[今回は見送り]）

B) 初期リリース対象か否かの 2 値（In MVP / Future）＋ 要件のスコープ外表に準拠

C) リポジトリの優先度ラベル（P0 / P1 / P2）に揃える

X) Other（[Answer]: の後に記述）

[Answer]: B

### Question 7 — 出力言語と記法
ストーリー文書の言語を選んでください。

A) 日本語（要件定義書と統一）

B) 英語

C) 日本語主体＋ API 名・モード名等の固有名は英語併記

X) Other（[Answer]: の後に記述）

[Answer]: C

---

## 2. ブレークダウン方式の選択肢（参考）

| 方式 | 内容 | 向いている場面 | トレードオフ |
|---|---|---|---|
| Feature-Based | システム機能ごとにストーリーを構成 | 機能境界が明確な本件に適合。要件の章立てと 1:1 で追跡しやすい | ペルソナ横断の体験が見えにくい |
| Persona-Based | ユーザー種別ごとにグルーピング | 各ペルソナの関心を漏れなく把握 | 同一機能が複数ペルソナに分散し重複しやすい |
| User Journey-Based | 利用フローに沿って構成 | 体験の連続性・UX 検証に有効 | ライブラリ API の網羅性が落ちやすい |
| Domain-Based | 業務ドメイン単位 | 業務システム向き | 本件は単一ドメインのため効果薄 |
| Epic-Based（Hybrid） | 機能=Epic、その下に story | 大規模機能群の階層管理に有効。unit 分割の前段にしやすい | 階層管理のオーバーヘッド |

> 推奨: 本件は機能境界が明確で、後続の unit 分割（後続 Issue）に直結するため **D（Feature-Based を Epic でグルーピング）** が無難です。最終決定は Q2 の回答に従います。

---

## 3. 実行チェックリスト（Part 1: Planning）

- [x] User Stories 実施妥当性アセスメント作成（`user-stories-assessment.md`）
- [x] ストーリー生成計画の作成（本ファイル）
- [x] 方針質問の作成（Q1〜Q7、[Answer]: タグ付き）
- [x] ユーザーによる全 [Answer]: の回答（Q1=B, Q2=D, Q3=A, Q4=C, Q5=C, Q6=B, Q7=C / 2026-06-17）
- [x] 回答の曖昧性分析（曖昧点・矛盾なし。明確化質問は不要）
- [x] 計画のユーザー承認（2026-06-17）

## 4. 実行チェックリスト（Part 2: Generation・承認後に実施）

- [x] `aidlc-docs/inception/user-stories/personas.md` を生成（ペルソナの原型・特性・動機）
- [x] `aidlc-docs/inception/user-stories/stories.md` を生成（INVEST 準拠のユーザーストーリー / US-01〜US-37）
- [x] 各ストーリーに受け入れ基準を付与（Q4 の記法: G/W/T + 箇条書き）
- [x] 各ストーリーを要件（FR/NFR）へトレース（追跡表 + FR カバレッジ表）
- [x] ペルソナとストーリーのマッピング（personas.md の Epic マップ + stories.md の主語）
- [x] ストーリーが Independent / Negotiable / Valuable / Estimable / Small / Testable を満たすことを確認
- [x] `aidlc-state.md` の進捗更新

## 5. 生成する成果物（Part 2）

- `aidlc-docs/inception/user-stories/stories.md` — ユーザーストーリー（受け入れ基準・優先度・トレーサビリティ付き）
- `aidlc-docs/inception/user-stories/personas.md` — ペルソナ定義とストーリーへのマッピング
