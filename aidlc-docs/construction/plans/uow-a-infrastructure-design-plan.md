# Infrastructure Design Plan — UoW-A コア基盤

- **関連 Issue**: [#27](https://github.com/AtsutoNakayama/perisphere/issues/27)
- **作成日**: 2026-08-02
- **前提資料**: `construction/uow-a/functional-design/`、`construction/uow-a/nfr-design/`、`construction/uow-a/nfr-requirements/tech-stack-decisions.md`、`inception/plans/execution-plan.md`（Infrastructure Design = EXECUTE minimal depth の根拠）、既存 `.github/workflows/ci.yml`

## カテゴリ別の適用可否判定（必須評価）

| カテゴリ | 判定 | 根拠 |
|---|---|---|
| Deployment Environment | **限定的に適用** | クラウド環境は持たない（NFR-11）。唯一の「デプロイ環境」は CI（GitHub Actions）と将来の npm レジストリ公開のみ |
| Compute Infrastructure | **限定的に適用** | GitHub Actions ランナー（`ubuntu-latest`）上でのビルド/テスト実行のみ。サイジング・オートスケーリングの概念はない |
| Storage Infrastructure | **N/A** | データベース・永続ストレージなし。npm レジストリへの配布は NFR-07 で既に確定済みで、本ステージで追加検討する事項はない |
| Messaging Infrastructure | **N/A** | キュー・非同期処理・イベント駆動インフラなし（クライアントサイドライブラリ） |
| Networking Infrastructure | **N/A** | ロードバランサ・API ゲートウェイ・ネットワークトポロジの概念なし |
| Monitoring Infrastructure | **N/A（本ユニットでは）** | 稼働サーバーがなく、テレメトリ収集は要件外（プライバシー上の合意もない）。CI の成否確認は既存 GitHub Actions のチェックで足りる |
| Shared Infrastructure | **適用** | CI ワークフロー（`.github/workflows/ci.yml`）は UoW-A 以降の全ユニットが共有するインフラであり、後続ユニット追加時に手直しが要らない形で設計する必要がある |

## 計画ステップ

- [x] Step 1: Functional Design / NFR Design 成果物の分析（上表に反映）
- [x] Step 2〜4: 本計画ファイルの作成・質問埋め込み
- [x] Step 5: ユーザー回答の収集・曖昧性分析（推奨案を全問採用・曖昧表現なし）
- [x] Step 6: 成果物生成（`infrastructure-design.md` / `deployment-architecture.md`）
- [ ] Step 7〜9: 完了メッセージ提示・承認取得・記録

## 確認質問

各質問には比較情報と推奨案を記載した（前回までのフィードバックを踏まえた形式）。回答は `[Answer]:` タグに記入すること。

### Question 1: CI ジョブ構成（既存ワークフローの拡張 vs 新規ファイル分離）

| 選択肢 | メリット | デメリット |
|---|---|---|
| A) 既存 `.github/workflows/ci.yml` にビルド/テスト/Lint ジョブを追加する | 単一ファイルで PR チェックの全体像を把握できる。`ci.yml` 冒頭のコメント「アプリコード導入後に build / test / lint ジョブを追加する」という既存の設計意図と一致する | ジョブ数が増えるとファイルが長くなる |
| B) `build-test.yml` 等、新規ワークフローファイルに分離する | ファイルごとの責務が明確 | 既存 `ci.yml` の設計意図（将来ジョブを追加する前提で書かれている）と食い違う。ブランチ保護の必須ステータスチェック設定の追加変更も必要になる |

**推奨: A**。既存ファイルのコメントが本ステージの作業を想定して書かれており、素直にそれに従う。

[Answer]: A

### Question 2: CI 上の Node.js バージョン方針

| 選択肢 | メリット | デメリット |
|---|---|---|
| A) 単一の最新 LTS バージョンのみでテストする | シンプル・CI 実行時間が短い | 利用者側の Node.js バージョン差異による問題を CI で検知できない |
| B) 複数の Node.js バージョン（例: 現行 LTS + 1 つ前の LTS）をマトリクスでテストする | 幅広いバージョンでの動作を保証できる | CI 実行時間が伸びる。UoW-A はビルド専用ツール（pnpm/tsup/Vitest）の実行環境であり、成果物自体はブラウザ実行のため Node.js バージョン差異の影響は限定的 |

**推奨: A**。成果物（`@perisphere/core`）はブラウザで実行され、Node.js は開発/CI 時のビルド・テストツールチェーンとしてのみ使われる（NFR-02 はブラウザ環境の話で Node.js バージョンとは無関係）。ツールチェーン自体の Node.js 互換性リスクは低く、マトリクス化の運用コストに見合わない。

[Answer]: A

### Question 3: GitHub Actions のバージョン固定方針（SECURITY-10）

| 選択肢 | メリット | デメリット |
|---|---|---|
| A) メジャーバージョンタグで固定する（例: `actions/checkout@v4`、既存 `ci.yml` と同じ方式） | 既存の慣習と一貫する。タグの信頼性は GitHub 公式/著名なアクションであれば実務上十分 | コミット SHA 固定ほど厳密ではない（タグの指す内容が理論上変わりうる） |
| B) コミット SHA で固定する（例: `actions/checkout@11bd719...`） | 最も厳密なサプライチェーン保護 | 可読性が落ち、更新時の差分レビューが煩雑になる。既存 `ci.yml` の全アクションを SHA 固定に書き換える追加のスコープが発生し、UoW-A の範囲を超える |

**推奨: A**。既存 `ci.yml`（`actions/checkout@v4`, `DavidAnson/markdownlint-cli2-action@v16`, `lycheeverse/lychee-action@v2`）と一貫した方式を維持する。SECURITY-10 の「pinned tool versions」はメジャータグ固定でも満たせる（`latest` を使わないことが本質）。

[Answer]: A

### Question 4: Dependabot 設定

| 選択肢 | メリット | デメリット |
|---|---|---|
| A) `.github/dependabot.yml` に `package-ecosystem: npm`（pnpm ワークスペース対応）+ `github-actions` の 2 エコシステムを weekly で設定する | pnpm 依存と CI アクション双方の更新を継続的に追跡できる。GitHub Actions 自体のバージョン固定（Q3=A）と組み合わせて更新経路を確保できる | 特になし |
| B) `npm` エコシステムのみ設定する | 設定が最小限 | CI で使う GitHub Actions 自体の脆弱性・更新が追跡されず、Q3 で固定したメジャータグが古いまま放置されるリスクが残る |

**推奨: A**。`NFR-10` のサプライチェーン対策は依存関係（npm パッケージ）だけでなく CI/CD ツール自体のバージョン管理も要求しており、`github-actions` エコシステムも対象に含めるべき。

[Answer]: A

### Question 5: npm 公開パイプラインの本ユニットでの扱い

| 選択肢 | メリット | デメリット |
|---|---|---|
| A) 本ユニット（UoW-A）では npm 公開パイプラインを構築しない。ビルド成果物の検証（`pnpm -r build`）までを CI 対象とし、実際の `npm publish` はリリース設計（`NFR-11` で「運用詳細は Construction フェーズのリリース設計で確定」と明記）に委ねる | UoW-A 単体はまだ公開に値する完成度（1 枚の画像すら表示できない基盤のみ）ではなく、時期尚早な公開パイプライン構築を避けられる | 後続ユニットが揃った時点で改めてリリース設計のステージ/ユニットが必要になる（ただし NFR-11 で既に想定済み） |
| B) 今のうちに `npm publish` ワークフローの雛形（手動トリガー）だけ作っておく | 後で作る手間が減る | まだ npm に公開する成果物として不完全な段階でパイプラインを用意するのは時期尚早（`nfr-design-patterns.md` で確立した「時期尚早な最適化を避ける」判断軸と矛盾する） |

**推奨: A**。`requirements.md` NFR-11 が既に「正式版リリース時の運用詳細は Construction のリリース設計で確定する」と明記しており、UoW-A の Infrastructure Design で先取りする理由がない。

[Answer]: A

### Question 6: CI ジョブのユニット追加への拡張性（Shared Infrastructure）

後続ユニット（UoW-B 以降）や `packages/react`/`apps/demo` が追加されたときも、CI 設定の手直しが最小限で済む構成にするか。

| 選択肢 | メリット | デメリット |
|---|---|---|
| A) `pnpm -r build` / `pnpm -r test` / `pnpm -r lint` のようにワークスペース全体に対して再帰実行するコマンドを CI ジョブに組む | 新しいパッケージ（`packages/react`, `apps/demo`）が `pnpm-workspace.yaml` に追加されるだけで自動的に CI 対象になり、CI 設定の変更が不要になる（Shared Infrastructure として全ユニットが再利用できる） | 個別パッケージのみを対象にした高速なフィードバックは得にくい（ただし現時点ではパッケージ数が少なく問題にならない） |
| B) `packages/core` を名指しでジョブに書く | 現時点では意図が明確 | 後続ユニット（UoW-H の `packages/react` 等）追加のたびに CI 設定の修正 PR が必要になり、`unit-of-work.md` の「1 unit = 1 Issue」の原則上、毎回インフラ変更が割り込む形になる |

**推奨: A**。UoW-A は今後 12 ユニットが積み上がっていく基盤であり、CI 設定を最初からワークスペース全体対応にしておくことで、後続ユニットの Infrastructure Design/Code Generation で毎回同じ変更を繰り返さずに済む。

[Answer]: A

## 回答後の進め方

全質問回答後、曖昧・矛盾がないか分析し、必要なら `uow-a-infrastructure-design-clarification-questions.md` を作成する。問題なければ Step 6 の成果物生成（`infrastructure-design.md` / `deployment-architecture.md`）に進む。

## 回答決定プロセスの記録（比較検討サマリ）

Q1〜Q6 全問で推奨案（A）を採用。決定にあたり比較した選択肢ごとの長所・短所は各質問直下の表に記録した通り。判断軸として一貫して優先したのは:

1. **既存資産との一貫性**（`ci.yml` の既存コメント・Actions バージョン固定方式を踏襲）
2. **時期尚早な整備の回避**（npm 公開パイプラインは NFR-11 が指すリリース設計まで持ち越す）
3. **将来ユニットへの拡張性**（`pnpm -r` によるワークスペース全体対応で、後続ユニットが CI 設定を都度触らずに済む形にする）
4. **NFR-10（サプライチェーン対策）との整合**（Dependabot は npm + github-actions の両方を対象にする）
