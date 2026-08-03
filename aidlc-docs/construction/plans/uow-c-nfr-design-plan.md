# NFR Design Plan — UoW-C 投影モード

- **関連 Issue**: [#36](https://github.com/AtsutoNakayama/perisphere/issues/36)
- **作成日**: 2026-08-03
- **前提資料**: `construction/uow-c/nfr-requirements/`、`construction/uow-c/functional-design/`

## 必須評価カテゴリの適用可否

| カテゴリ | 適用可否 | 判定根拠 |
|---|---|---|
| Resilience Patterns | 適用 | シェーダコンパイル失敗時の扱いを扱う |
| Scalability Patterns | **N/A** | `nfr-requirements.md` §1 で確認済み |
| Performance Patterns | 適用 | 球体ジオメトリの分割数（シェーダベースモードの見た目の滑らかさ）、`ShaderMaterial` キャッシュ（NFR Requirements Q3 で確定済み、本ステージでは補足のみ） |
| Security Patterns | **N/A** | 新規の外部入力を扱わないため UoW-A/UoW-B の既存評価から変化なし |
| Logical Components | 適用 | 投影数式モジュールの位置づけを確定する |

## 確認質問（比較情報・推奨案を埋め込み済み）

### Q1. シェーダコンパイル失敗時の扱い

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 実行時のフォールバック機構は設けない。シェーダのコードは開発者が記述する固定文字列（ユーザー入力に依存しない）であり、コンパイル失敗はテスト・手動 QA で検出すべきコード上の欠陥として扱う | UoW-A の RP-1（Graceful Degradation）は「環境要因による失敗」（WebGL2 非対応等）を対象としたものであり、シェーダの実装バグは環境要因ではなく開発時に潰すべき欠陥。実行時フォールバックを作ると欠陥を隠蔽してしまうリスクがある |
| B | シェーダコンパイル失敗を検出し、該当モードを標準モードにフォールバックする機構を実装する | three.js は既定でシェーダコンパイルエラーを同期的に例外として投げない（`renderer.debug.checkShaderErrors` 等の追加設定が必要）ため検出自体にコストがかかる。開発時に確実に検出・修正すべき欠陥に対して実行時対応を作るのは過剰設計 |

**採用理由**: 開発者起因の欠陥と環境起因の失敗を区別し、後者のみを対象とする UoW-A の既存方針を踏襲する。

[Answer]: A

### Q2. シェーダベースモードの球体ジオメトリ分割数

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `Renderer` が所有する既存の球体ジオメトリ（60×40 分割）をそのまま共用する。専用の高解像度ジオメトリは用意しない | 投影数式は頂点単位で計算されるため、非線形性が強いモード（特に Tiny Planet）では低分割によるファセット（多角形の輪郭）が見える可能性があるが、Functional Design Q5=A（学術的正確性より視覚的な近似を優先）と同じ判断軸で許容する。ジオメトリ差し替えは `Renderer` にさらなる拡張（マテリアルに加えてジオメトリの差し替え）を要求し、スコープが拡大する |
| B | シェーダベースモード用に高解像度ジオメトリ（例: 128×96 分割）を別途用意し、モード適用時に差し替える | 見た目の滑らかさは向上するが、`Renderer` にジオメトリ差し替え機構を追加する必要があり、実装コストが増す。ファセットが実際に問題になるかは実装後の目視確認で判断すべきで、先回りした投資は時期尚早 |

**採用理由**: YAGNI。ファセットの問題が実際に確認された場合は、UoW-C 完了後の改善 Issue で個別に対応できる。

[Answer]: A

### Q3. 投影数式モジュールの位置づけ（論理コンポーネント）

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `packages/core/src/modes/projections/` に投影数式ごとの純粋 TypeScript 関数（例: `equidistant.ts`/`panini.ts`/`stereographic.ts`）を配置する独立モジュールとする。各モードクラス（`DewarpMode` 等）はこのモジュールの関数を import し、GLSL 文字列内には同じ数式を手動移植したコードを埋め込む | テスト対象（TS 関数）と実行対象（GLSL 文字列）の対応が明確になり、`nfr-requirements.md` Q1 の方針（TS 関数を PBT で検証、GLSL は目視レビュー）を実装レベルで具体化できる |

**採用理由**: NFR Requirements で確定した方針をそのままディレクトリ構造に反映する。

[Answer]: 確認済み・異論なければこのまま進める

## 比較検討サマリ

判断軸: (1) 開発者起因の欠陥と環境起因の失敗の区別（UoW-A RP-1 の対象範囲との整合）、(2) YAGNI（ジオメトリ差し替えという追加スコープを避ける）、(3) NFR Requirements で確定した投影数式のテスト戦略をディレクトリ構造に反映する一貫性。

## 次のステップ（Step 6: 成果物生成、承認後）

- `aidlc-docs/construction/uow-c/nfr-design/nfr-design-patterns.md`
- `aidlc-docs/construction/uow-c/nfr-design/logical-components.md`
