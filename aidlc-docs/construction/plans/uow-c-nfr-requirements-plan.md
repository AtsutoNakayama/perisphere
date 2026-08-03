# NFR Requirements Plan — UoW-C 投影モード

- **関連 Issue**: [#36](https://github.com/AtsutoNakayama/perisphere/issues/36)
- **作成日**: 2026-08-03
- **前提資料**: `construction/uow-c/functional-design/`、UoW-A/UoW-B `tech-stack-decisions.md`（モノレポ横断決定は継承）

## 確定済み NFR の再確認（変更なし）

パッケージマネージャ・Lint/フォーマッタ・TS strictness・依存脆弱性スキャン（UoW-A モノレポ横断決定）、ビルドツール・テストランナー・PBT ライブラリ・three.js range・ES2020 ターゲット（`packages/core` 決定）はそのまま UoW-C にも適用する。Scalability / Availability / Usability・Accessibility は UoW-A/UoW-B 同様 **N/A**。

## 実装時に発見した統合上の論点（レビュー時に確認いただきたい前提）

Functional Design 承認後、UoW-B との統合を精査した結果、1 点見落としを発見した。UoW-B の `Renderer.setSphereTexture` は `MeshBasicMaterial.map` を直接書き換える実装であり、シェーダベースモード（Dewarp/Panini/Tiny Planet）が適用する `ShaderMaterial` にはこの実装は効かない（`ShaderMaterial` はテクスチャをユニフォーム経由で受け取るため）。つまり「シェーダベースモード表示中に `loadImage` で新しい画像に差し替える」というシナリオで、UoW-C を素朴に実装すると新しいテクスチャが反映されない不具合が起こりうる。本ステージ（NFR Requirements）で対処方針を確定する（Q2）。

## 確認質問（比較情報・推奨案を埋め込み済み）

### Q1. 投影数式のテスト戦略

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 各投影数式（等距離図法・Panini 近似式・ステレオ図法）を、GLSL シェーダとは別に**同じ数式を持つ純粋 TypeScript 関数**として実装し、その TS 関数を fast-check で検証する（例: 「入力角度が有効範囲内なら出力は有限」「単調性」「境界値での挙動」）。GLSL シェーダ側は同じ数式を手動で移植する（テストは TS 関数が担保する「数式としての正しさ」に依拠し、GLSL への移植は目視レビューで担保） | jsdom は WebGL2 を提供しないため GLSL を直接実行検証できない（UoW-A `tech-stack-decisions.md` §5 の制約を継続）。PBT 全面適用方針（PBT-10）に対して、投影数式はまさに「入力範囲に対する不変条件」を持つ複雑なロジックであり、テストする価値が高い |
| B | シェーダのテストは行わない（目視確認のみ） | PBT 全面適用方針に反する。投影数式は本ユニットで最もバグが混入しやすい箇所であり、テストなしは監査ルール（PBT-10）と整合しない |

**採用理由**: PBT-10 の方針を踏まえ、テスト可能な形（TS 純粋関数）に切り出すことで数式の正しさを検証する。

[Answer]: A

### Q2. `Renderer` のテクスチャ更新をマテリアル非依存にする方式

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `Renderer.setSphereTexture` を、現在のマテリアルが `MeshBasicMaterial` なら `.map` を、`ShaderMaterial`（本ユニットが導入）なら規約化されたユニフォーム名（`uniforms.map`）を更新するよう拡張する。シェーダベースモードは自身の `ShaderMaterial` のテクスチャユニフォームを必ず `map` という名前で公開する規約とする | `Renderer` が「現在のテクスチャ」を一元管理するという UoW-B の設計（`setSphereTexture` が唯一の反映経路）を維持できる。呼び出し側（`createViewer.ts` の `loadImage`）を変更せずに済む |
| B | `loadImage` 成功時、`createViewer.ts` 側でモード種別を判定してテクスチャの反映方法を出し分ける | `Renderer` のカプセル化が崩れ、`createViewer.ts` がマテリアルの内部実装（`MeshBasicMaterial` か `ShaderMaterial` か）を知る必要が生じる（UoW-A/B で一貫して避けてきた設計） |

**採用理由**: `Renderer` によるカプセル化を維持する一貫性。

[Answer]: A

### Q3. モード切替時の `ShaderMaterial` 再構築 vs キャッシュ

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 各シェーダベースモードのインスタンスは `ShaderMaterial` を 1 回だけ構築し、以降の `apply` 呼び出しでは再利用する（`dispose` 時も破棄しない。`Viewer` 全体の `dispose` 時にのみ破棄） | モード切替は US-10 で「即時切替」が求められており、毎回のシェーダコンパイルはコストと遅延を生む。UoW-A の NFR Design で確立した「時期尚早な最適化を避ける」方針とは別の話で、これは実際に体感遅延に直結するため先取りで対応する価値がある |
| B | `apply` のたびに新しい `ShaderMaterial` を構築する | シェーダコンパイルは three.js/WebGL 内部でコストがかかる処理であり、モード切替のたびに再コンパイルするとカクつきが生じうる |

**採用理由**: US-10 の「即時切替」という明示的な受け入れ基準に対する現実的な配慮。

[Answer]: A

### Q4. 新規ランタイム依存の要否

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 新規ランタイム依存を追加しない。シェーダコードは文字列リテラルとして実装し、既存の three.js（`ShaderMaterial`）のみを利用する | GLSL のコード生成・バリデーション用ライブラリ等は本ユニットの要件を満たすために必須ではない（YAGNI） |
| B | シェーダのビルド時検証ツール（glslify 等）を導入する | 現時点の規模（3 シェーダ）に対して過剰な投資 |

**採用理由**: UoW-A/UoW-B から継続する「必要最小限の依存」方針。

[Answer]: A

### Q5. テスト境界（`Renderer` のモック化継続）

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | UoW-A/UoW-B と同じく `Renderer` をモック境界化する。`setSphereMaterial`/`setSphereTexture` の呼び出し（引数を含む）を検証し、各モードの `apply`/`updateView`/`dispose` が正しい引数でこれらを呼ぶことをテストする | 一貫したテスト境界方針。`Renderer` 自体（WebGL 実構築）は引き続き jsdom で構築不能なため |

**採用理由**: 既存方針の継続。

[Answer]: A

## 比較検討サマリ

判断軸: (1) PBT-10 の全面適用方針にどう応えるか（テスト不能な GLSL を純粋関数として切り出す）、(2) UoW-B との統合で見落とすと実害が出る箇所（`Renderer.setSphereTexture` のマテリアル非依存化）への先回り対応、(3) US-10 の「即時切替」という明示的な受け入れ基準、(4) YAGNI・既存方針の継続。

## 次のステップ（Step 6: 成果物生成、承認後）

- [x] `aidlc-docs/construction/uow-c/nfr-requirements/nfr-requirements.md`
- [x] `aidlc-docs/construction/uow-c/nfr-requirements/tech-stack-decisions.md`
