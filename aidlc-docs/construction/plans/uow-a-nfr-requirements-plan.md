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
- [x] Step 5: ユーザー回答の収集・曖昧性分析（推奨セットを承認・全回答が明確な単一選択、曖昧表現なし）
- [x] Step 6: 成果物生成（`nfr-requirements.md` / `tech-stack-decisions.md`）
- [ ] Step 7〜9: 完了メッセージ提示・承認取得・記録

## 確認質問

各質問には簡潔な比較メモと推奨案を添えた。回答は `[Answer]:` タグに記入すること。

### Question 1: パッケージマネージャ / ワークスペースツール

モノレポ（`packages/core` / `packages/react` / `apps/demo`）の管理に何を使うか。

A) pnpm workspaces（**推奨**: ディスク効率・厳格な依存解決〔phantom dependency を防ぎやすい〕・モノレポでの採用実績が広い）

B) npm workspaces（追加ツール不要。依存解決が pnpm ほど厳格ではない）

C) yarn workspaces（Plug'n'Play 等の選択肢もあるが構成がやや複雑）

D) Other (please describe after [Answer]: tag below)

[Answer]: A

**採用理由**: `unit-of-work.md` のコード構成戦略（`packages/core`/`packages/react`/`apps/demo`）はモノレポ前提であり、NFR-05（保守性・拡張性）を重視する方針とも合致する厳格な依存管理（phantom dependency 防止）が有利。npm workspaces（B）は追加ツール不要だが依存解決が緩く、yarn workspaces（C）は pnpm に対する明確な優位性が薄い。

### Question 2: ビルドツール（ESM + 型定義の出力）

`@perisphere/core` の配布物（ESM + `.d.ts`、tree-shaking 可）をどう生成するか。

A) tsup（**推奨**: esbuild ベースで高速、ESM/型定義出力の設定が最小限、ライブラリ用途での採用実績が多い）

B) Vite のライブラリモード（アプリ用途〔`apps/demo`〕でも Vite を使うなら統一できる）

C) tsc + 手動 rollup 設定（最も低レベルで制御できるが設定コストが高い）

D) Other (please describe after [Answer]: tag below)

[Answer]: A

**採用理由**: NFR-07（ESM + 型定義 + tree-shaking、CDN/UMD 対象外）の要求にライブラリ配布特化のシンプルさで最短距離で応える。Vite ライブラリモード（B）は `apps/demo` 側で別途使えばよく無理に統一する必要はない。tsc + 手動 rollup（C）は UoW-A の規模ではオーバースペック。

### Question 3: テストランナー

A) Vitest（**推奨**: Vite/esbuild ベースで高速、TypeScript 設定が簡潔、`apps/demo` を Vite にした場合ツールチェーンを統一できる）

B) Jest（実績豊富だが ESM/TypeScript 設定がやや煩雑）

C) Node.js 標準 `node:test`（依存追加なしだが PBT 連携・モック機能等のエコシステムが薄い）

D) Other (please describe after [Answer]: tag below)

[Answer]: A

**採用理由**: Q2 で tsup（esbuild ベース）を採用するため、同系統のツールチェーン（Vitest も esbuild/Vite ベース）で揃えられ設定の重複・食い違いを避けられる。Jest（B）は ESM/TypeScript のネイティブ対応が煩雑、`node:test`（C）はエコシステムが薄く fast-check との統合実績も少ない。

### Question 4: Property-Based Testing ライブラリ（NFR-09・PBT 拡張の全面適用）

A) fast-check（**推奨**: `requirements.md` NFR-09 で「有力」と明記済み。TypeScript 対応・Vitest/Jest 双方との統合実績あり）

B) 他の PBT ライブラリを比較検討する

C) Other (please describe after [Answer]: tag below)

[Answer]: A

**採用理由**: `requirements.md` NFR-09 で既に fast-check が本命として名指しされており、TypeScript エコシステムでの事実上のデファクトであるため覆す積極的理由がない（B の比較検討は対抗馬が実質存在せずコストに見合わない）。

### Question 5: WebGL 実描画のテスト戦略

Node/jsdom には WebGL2 実装がなく、`Renderer`（three.js ラッパ）を単体テストでそのまま動かせない。

A) `Renderer` を境界としてモック化し、単体テストでは three.js オブジェクト生成呼び出しとパラメータ（カメラ既定値・シーン構成等）のみを検証する。実際の WebGL 描画確認はブラウザベースの手動確認／将来の E2E テスト（Build and Test 以降）に委ねる（**推奨**: 追加のネイティブ依存を避けられ、CI の安定性が高い）

B) `headless-gl` 等のネイティブ WebGL 実装を CI に導入し、Node 上で実際に WebGL2 描画を行うテストを書く（ネイティブビルド依存が増え、CI 環境構築が複雑になるリスクがある）

C) Other (please describe after [Answer]: tag below)

[Answer]: A

**採用理由**: UoW-A の対応ストーリー（US-06 等）の受け入れ基準検証は本質的にブラウザでの見た目確認を要する性質のもの。ユニットテストでは「正しい three.js API 呼び出し・パラメータで初期化しているか」という契約レベルの検証に留め、CI の安定性を優先する。`headless-gl`（B）はネイティブビルド依存が増え、WebGL2 対応が不完全/開発停滞気味という既知の懸念がある。実描画確認は Build and Test ステージ（UoW-I のデモサイト等）で別途扱う。

### Question 6: Lint / フォーマッタ

A) ESLint + Prettier（**推奨**: 最も普及しており周辺プラグイン〔TypeScript, import 順序等〕が豊富）

B) Biome（Rust 製で高速・設定統一だが、ESLint ほどプラグインエコシステムが成熟していない）

C) Other (please describe after [Answer]: tag below)

[Answer]: A

**採用理由**: OSS ライブラリとして外部コントリビューターを迎える前提（`CONTRIBUTING.md`）を踏まえ、最も普及したツールを使うほうがコントリビューターのエディタ設定・学習コストが低い。Biome（B）は単一ツールで高速だが、プラグインエコシステムが ESLint ほど成熟していない。

### Question 7: TypeScript strictness

A) `strict: true` を最初から全面適用（**推奨**: グリーンフィールドのため段階導入の必要がなく、型安全性を最初から最大化できる）

B) 段階的に strict オプションを有効化していく

C) Other (please describe after [Answer]: tag below)

[Answer]: A

**採用理由**: グリーンフィールドであり段階導入の必要がない。最初から `strict: true` にすることで、後から有効化する際の大量の型エラー修正という手戻りコスト（B のデメリット）を避けられる。ライブラリコードは利用者の型安全性に直結するため最大化するメリットが大きい。

### Question 8: three.js の対応バージョン範囲（peerDependencies、NFR-06）

A) 直近の安定メジャーライン以降を許容する広めの範囲（例: `>=0.160.0 <1`。**推奨**: peerDependencies は利用者側の three.js を尊重すべきで、過度に狭めると導入障壁になる）

B) 開発時に検証した特定バージョンのみに限定する狭い範囲

C) Other (please describe after [Answer]: tag below)

[Answer]: A

**採用理由**: `NFR-06` の peerDependencies 化の目的自体が「利用者側の three.js を尊重する」ことにあるため、範囲を広く取るほど既存プロジェクトへの導入障壁が下がり NFR-06 の意図と整合する。狭い範囲（B）は three.js の頻繁なマイナー更新への追従負荷が大きく、peerDependencies の思想にも反する。

### Question 9: 依存脆弱性スキャンの CI 統合（NFR-10 サプライチェーン対策）

A) GitHub Dependabot（alerts + security updates の自動 PR）を有効化する（**推奨**: 追加の CI ステップ不要でリポジトリ設定のみ、`CONTRIBUTING.md` の運用と親和性が高い）

B) `npm audit`（または pnpm 相当）を CI ワークフローのステップとして追加する

C) 両方（Dependabot + CI 監査ステップ）

D) Other (please describe after [Answer]: tag below)

[Answer]: C

**採用理由**: `NFR-10` は「依存脆弱性スキャンの CI 組み込み」を明記しており、Dependabot 単体（A）では GitHub 側のスキャン頻度に依存し「CI 組み込み」の要求を厳密には満たさない。CI 監査ステップ（B）だけでは既知脆弱性の自動更新 PR が得られない。両方を組み合わせることで NFR-10 の文言により正確に応える。

### Question 10: ビルド出力のトランスパイルターゲット

NFR-02（デスクトップ/モバイル主要ブラウザ最新世代、WebGL2 前提）を踏まえた出力ターゲット。

A) ES2020 相当をターゲットにし、対象ブラウザでほぼトランスパイルなしに近い形で配布する（**推奨**: 対象環境が「最新世代」限定のため、古い構文互換のためのポリフィル/変換コストを避けられる）

B) より広い互換性のため ES2017 等の低めのターゲットにする

C) Other (please describe after [Answer]: tag below)

[Answer]: A

**採用理由**: `NFR-02` が対象を「最新世代」ブラウザに明示的に絞っているため、それを超える互換性投資（B）は要件に基づかない過剰実装であり、不要なポリフィル/変換コストとバンドルサイズ増を避けられる。

## 回答後の進め方

全質問回答後、曖昧・矛盾がないか分析し、必要なら `uow-a-nfr-requirements-clarification-questions.md` を作成する。問題なければ Step 6 の成果物生成（`nfr-requirements.md` / `tech-stack-decisions.md`）に進む。

## 回答決定プロセスの記録（比較検討サマリ）

各質問はユーザー提示の「推奨セット」をそのまま採用（Q1=A, Q2=A, Q3=A, Q4=A, Q5=A, Q6=A, Q7=A, Q8=A, Q9=C, Q10=A）。決定にあたり比較した選択肢ごとの長所・短所は各質問直下の「採用理由」に記録した通り。判断軸として一貫して優先したのは:

1. **既存 NFR（NFR-02, 05, 06, 07, 09, 10）との整合**
2. **ツールチェーンの一貫性**（tsup/Vitest 等 esbuild/Vite 系で統一し設定の食い違いを避ける）
3. **OSS としての開放性**（外部コントリビューターの学習コストを下げる、普及度の高いツールを優先）
4. **CI の安定性**（ネイティブ依存を避け、jsdom + モック境界でテストを完結させる）
