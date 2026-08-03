# NFR Design Patterns — UoW-C 投影モード

- **関連 Issue**: [#36](https://github.com/AtsutoNakayama/perisphere/issues/36)
- **作成日**: 2026-08-03
- **前提資料**: `uow-c-nfr-design-plan.md`（Q1〜Q3 回答・採用理由）、`construction/uow-c/functional-design/`

## 1. Resilience Patterns

### RP-C-1 No Runtime Fallback for Developer-Caused Shader Defects（開発者起因の欠陥には実行時フォールバックを設けない）

- **問題**: `ShaderMaterial` のコンパイル失敗にどう対処するか。
- **適用**: 実行時のフォールバック機構は設けない（NFR Design Q1=A）。シェーダコードは開発者が記述する固定文字列であり、ユーザー入力や実行環境に依存しない。コンパイル失敗はテスト・手動 QA で検出・修正すべきコード上の欠陥として扱う。
- **UoW-A の RP-1（Graceful Degradation）との違い**: RP-1 は WebGL2 非対応等の**環境要因**による失敗を対象とする。本パターンは**開発者起因**の欠陥を対象外とする、対象範囲の明確化。

## 2. Scalability Patterns

**N/A**。`nfr-requirements.md` §1 で確認済み。

## 3. Performance Patterns

### PP-C-1 Shared Geometry over Per-Mode Tessellation（ジオメトリ共用、モード別高解像度化は不採用）

- **問題**: 非線形投影（特に Tiny Planet）は頂点単位の計算のため、低分割ジオメトリではファセットが見える可能性がある。
- **適用**: `Renderer` が所有する既存の球体ジオメトリ（60×40 分割）をそのまま共用する。専用の高解像度ジオメトリは用意しない（NFR Design Q2=A）。
- **見直しの契機**: 実装後の目視確認でファセットが実際に問題になった場合、UoW-C 完了後の改善 Issue で個別に対応する。

### PP-C-2 Per-Mode ShaderMaterial Caching（NFR Requirements Q3 の継続、補足）

- **問題**: モード切替のたびにシェーダを再コンパイルすると US-10「即時切替」の体感を損なう。
- **適用**: 各シェーダベースモードは `ShaderMaterial` を初回構築時にキャッシュし、以降の `apply` で再利用する（`nfr-requirements.md` Q3 で確定済み。本ステージでは NFR Design の観点から妥当性を再確認し、変更なしと判断）。

## 4. Security Patterns

**N/A**。`nfr-requirements.md` §1 で確認済み（新規の外部入力を扱わない）。

## 5. 検討したが採用しなかったパターン（Rejected Patterns）

| パターン | 不採用の理由 | 再検討の契機 |
|---|---|---|
| シェーダコンパイル失敗時の自動フォールバック | 開発者起因の欠陥を実行時対応で隠蔽するリスク。検出自体にも追加コストがかかる（NFR Design Q1=A の裏返し） | 本番環境依存の予期しないシェーダコンパイル失敗が実際に報告された場合 |
| シェーダベースモード専用の高解像度ジオメトリ | `Renderer` にジオメトリ差し替え機構という追加スコープを要求する（NFR Design Q2=A の裏返し） | 実装後の目視確認でファセットが実際に問題になった場合 |
