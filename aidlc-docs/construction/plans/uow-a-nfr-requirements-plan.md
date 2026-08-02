# NFR Requirements Plan — UoW-A コア基盤

- **関連 Issue**: [#27](https://github.com/AtsutoNakayama/perisphere/issues/27)
- **作成日**: 2026-08-02
- **前提資料**: `construction/uow-a/functional-design/`、`inception/requirements/requirements.md`（NFR-01〜12）

## 既に確定済みの NFR（Requirements Analysis 由来・本ステージで再確認しない）

| NFR | 内容 |
|---|---|
| NFR-01 | 性能: 8K まで動作保証、主要対象環境で 60fps 目安 |
| NFR-02 | 対象環境: デスクトップ/モバイル主要ブラウザ、WebGL2 前提 |
| NFR-03 | SSR セーフ（Functional Design BR-A-01 で具体化済み） |
| NFR-05 | アーキテクチャ: core/react 分離モノレポ |
| NFR-06 | three.js は peerDependencies |
| NFR-07 | 配布: npm 公開・ESM + 型定義・tree-shaking 可・CDN/UMD 対象外 |
| NFR-09 | テスト戦略: PBT 全面適用（フレームワーク選定は本ステージ） |
| NFR-10 | セキュリティ: 入力検証・例外安全処理・内部詳細非露出・サプライチェーン対策・セキュア設計 |
| NFR-11 | レジリエンシー: 稼働サーバーなし（RTO/RPO=N/A）、GitHub Flow 運用、障害分離 |
| NFR-12 | MIT License |

## 本ステージで確定する事項（Q3=A: ワークスペースツール等の技術スタックは Construction で確定）

**該当なしと判定した NFR カテゴリ**: Availability（稼働サーバーなし）／ Scalability（クライアントサイドライブラリ、負荷分散の概念なし）／ Usability・Accessibility（UoW-A は UI を持たない。アクセシビリティは UoW-G の責務）。

## 計画ステップ

- [x] Step 1: Functional Design 成果物の分析（本ファイル冒頭に反映）
- [x] Step 2〜4: 本計画ファイルの作成・質問埋め込み
- [ ] Step 5: ユーザー回答の収集・曖昧性分析
- [ ] Step 6: 成果物生成（`nfr-requirements.md` / `tech-stack-decisions.md`）
- [ ] Step 7〜9: 完了メッセージ提示・承認取得・記録

## 確認質問

各質問には簡潔な比較メモと推奨案を添えた。回答は `[Answer]:` タグに記入すること。

### Question 1: パッケージマネージャ / ワークスペースツール

モノレポ（`packages/core` / `packages/react` / `apps/demo`）の管理に何を使うか。

A) pnpm workspaces（**推奨**: ディスク効率・厳格な依存解決〔phantom dependency を防ぎやすい〕・モノレポでの採用実績が広い）

B) npm workspaces（追加ツール不要。依存解決が pnpm ほど厳格ではない）

C) yarn workspaces（Plug'n'Play 等の選択肢もあるが構成がやや複雑）

D) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 2: ビルドツール（ESM + 型定義の出力）

`@perisphere/core` の配布物（ESM + `.d.ts`、tree-shaking 可）をどう生成するか。

A) tsup（**推奨**: esbuild ベースで高速、ESM/型定義出力の設定が最小限、ライブラリ用途での採用実績が多い）

B) Vite のライブラリモード（アプリ用途〔`apps/demo`〕でも Vite を使うなら統一できる）

C) tsc + 手動 rollup 設定（最も低レベルで制御できるが設定コストが高い）

D) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 3: テストランナー

A) Vitest（**推奨**: Vite/esbuild ベースで高速、TypeScript 設定が簡潔、`apps/demo` を Vite にした場合ツールチェーンを統一できる）

B) Jest（実績豊富だが ESM/TypeScript 設定がやや煩雑）

C) Node.js 標準 `node:test`（依存追加なしだが PBT 連携・モック機能等のエコシステムが薄い）

D) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 4: Property-Based Testing ライブラリ（NFR-09・PBT 拡張の全面適用）

A) fast-check（**推奨**: `requirements.md` NFR-09 で「有力」と明記済み。TypeScript 対応・Vitest/Jest 双方との統合実績あり）

B) 他の PBT ライブラリを比較検討する

C) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 5: WebGL 実描画のテスト戦略

Node/jsdom には WebGL2 実装がなく、`Renderer`（three.js ラッパ）を単体テストでそのまま動かせない。

A) `Renderer` を境界としてモック化し、単体テストでは three.js オブジェクト生成呼び出しとパラメータ（カメラ既定値・シーン構成等）のみを検証する。実際の WebGL 描画確認はブラウザベースの手動確認／将来の E2E テスト（Build and Test 以降）に委ねる（**推奨**: 追加のネイティブ依存を避けられ、CI の安定性が高い）

B) `headless-gl` 等のネイティブ WebGL 実装を CI に導入し、Node 上で実際に WebGL2 描画を行うテストを書く（ネイティブビルド依存が増え、CI 環境構築が複雑になるリスクがある）

C) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 6: Lint / フォーマッタ

A) ESLint + Prettier（**推奨**: 最も普及しており周辺プラグイン〔TypeScript, import 順序等〕が豊富）

B) Biome（Rust 製で高速・設定統一だが、ESLint ほどプラグインエコシステムが成熟していない）

C) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 7: TypeScript strictness

A) `strict: true` を最初から全面適用（**推奨**: グリーンフィールドのため段階導入の必要がなく、型安全性を最初から最大化できる）

B) 段階的に strict オプションを有効化していく

C) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 8: three.js の対応バージョン範囲（peerDependencies、NFR-06）

A) 直近の安定メジャーライン以降を許容する広めの範囲（例: `>=0.160.0 <1`。**推奨**: peerDependencies は利用者側の three.js を尊重すべきで、過度に狭めると導入障壁になる）

B) 開発時に検証した特定バージョンのみに限定する狭い範囲

C) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 9: 依存脆弱性スキャンの CI 統合（NFR-10 サプライチェーン対策）

A) GitHub Dependabot（alerts + security updates の自動 PR）を有効化する（**推奨**: 追加の CI ステップ不要でリポジトリ設定のみ、`CONTRIBUTING.md` の運用と親和性が高い）

B) `npm audit`（または pnpm 相当）を CI ワークフローのステップとして追加する

C) 両方（Dependabot + CI 監査ステップ）

D) Other (please describe after [Answer]: tag below)

[Answer]: 

### Question 10: ビルド出力のトランスパイルターゲット

NFR-02（デスクトップ/モバイル主要ブラウザ最新世代、WebGL2 前提）を踏まえた出力ターゲット。

A) ES2020 相当をターゲットにし、対象ブラウザでほぼトランスパイルなしに近い形で配布する（**推奨**: 対象環境が「最新世代」限定のため、古い構文互換のためのポリフィル/変換コストを避けられる）

B) より広い互換性のため ES2017 等の低めのターゲットにする

C) Other (please describe after [Answer]: tag below)

[Answer]: 

## 回答後の進め方

全質問回答後、曖昧・矛盾がないか分析し、必要なら `uow-a-nfr-requirements-clarification-questions.md` を作成する。問題なければ Step 6 の成果物生成（`nfr-requirements.md` / `tech-stack-decisions.md`）に進む。
