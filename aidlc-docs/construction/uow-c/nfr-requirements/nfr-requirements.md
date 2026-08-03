# NFR Requirements — UoW-C 投影モード

- **関連 Issue**: [#36](https://github.com/AtsutoNakayama/perisphere/issues/36)
- **作成日**: 2026-08-03
- **前提資料**: `uow-c-nfr-requirements-plan.md`（Q1〜Q5 回答・採用理由）、`construction/uow-c/functional-design/`、UoW-A/UoW-B `tech-stack-decisions.md`

## 1. NFR カテゴリ別評価

| カテゴリ | UoW-C での判定 | 詳細 |
|---|---|---|
| Scalability / Availability | **N/A** | UoW-A/UoW-B と同じ理由 |
| Performance | 適用（本ステージで具体化） | US-10「即時切替」に対応するため `ShaderMaterial` をモードごとにキャッシュする方針を確定（§3 Q3） |
| Security | 変更なし | 新規の入力・外部データを扱わないため UoW-A/UoW-B の既存方針を継続 |
| Reliability | 適用（Functional Design で具体化済み・本ステージで統合上の欠陥を追加発見） | シェーダベースモード表示中の `loadImage` 差し替えに対応する `Renderer.setSphereTexture` のマテリアル非依存化（§3 Q2） |
| Maintainability | 本ステージで確定 | 投影数式のテスト戦略（§3 Q1）、新規ランタイム依存なし（§3 Q4） |
| Usability / Accessibility | **N/A（UoW-C スコープ外）** | 同梱 UI は UoW-G の責務 |

## 2. 発見した統合上の欠陥と対応

UoW-B の `Renderer.setSphereTexture` は `MeshBasicMaterial.map` を直接書き換える実装であり、UoW-C が導入する `ShaderMaterial`（Dewarp/Panini/Tiny Planet）には効かない。`Renderer.setSphereTexture` をマテリアルの種類に応じて分岐させる（`ShaderMaterial` の場合は規約化されたユニフォーム名 `uniforms.map` を更新）ことで対応する（Q2=A）。

## 3. 本ステージで確定した技術スタック（サマリ）

| # | 論点 | 決定 |
|---|---|---|
| Q1 | 投影数式のテスト戦略 | GLSL とは別に同じ数式を持つ純粋 TypeScript 関数を実装し fast-check で検証 |
| Q2 | `Renderer.setSphereTexture` のマテリアル非依存化 | マテリアル種別で分岐（`MeshBasicMaterial.map` / `ShaderMaterial.uniforms.map`） |
| Q3 | モード切替時の `ShaderMaterial` 管理 | モードごとに 1 回だけ構築しキャッシュ（`Viewer` dispose 時のみ破棄） |
| Q4 | 新規ランタイム依存 | なし（three.js の `ShaderMaterial` のみ） |
| Q5 | テスト境界 | `Renderer` をモック境界化（UoW-A/B から継続） |

## 4. 拡張ルール準拠サマリ

### Security Baseline

| ルール | 判定 | 根拠 |
|---|---|---|
| SECURITY-05〜15 該当分 | Compliant（変更なし） | 新規の外部入力を扱わないため UoW-A/UoW-B の既存評価から変化なし |

### Resiliency Baseline

| ルール | 判定 | 根拠 |
|---|---|---|
| RESILIENCY-01〜15 | N/A（変更なし） | UoW-A/UoW-B と同じ理由 |

### Property-Based Testing

| ルール | 判定 | 根拠 |
|---|---|---|
| PBT 対象範囲の拡張 | Compliant | Q1 により投影数式（等距離図法・Panini 近似式・ステレオ図法）を TS 純粋関数として切り出し PBT 対象に追加 |
| PBT-10（ビジネスクリティカルパスの example-based 併設） | Compliant（方針継続） | モード切替の主要シナリオ（各モードへの切替、未登録 id）は example-based で個別に検証する |

## 5. Code Generation への申し送り事項

- `Renderer.setSphereTexture` をマテリアル種別で分岐させる実装が必要（Q2）。
- シェーダベースモードの `ShaderMaterial` はテクスチャユニフォームを `uniforms.map` という規約名で公開する。
- 投影数式は `packages/core/src/modes/projections/`（想定）等に純粋 TS 関数として実装し、シェーダ文字列内の GLSL コードは同じ数式を手動で移植する。
- 各シェーダベースモードは `ShaderMaterial` をコンストラクタまたは初回 `apply` 時に 1 回だけ構築し、インスタンスフィールドとして保持する（Q3）。
