# NFR Design Patterns — UoW-A コア基盤

- **関連 Issue**: [#27](https://github.com/AtsutoNakayama/perisphere/issues/27)
- **作成日**: 2026-08-02
- **前提資料**: `uow-a-nfr-design-plan.md`（Q1〜Q6 回答・採用理由）、`construction/uow-a/functional-design/`

## 1. Resilience Patterns

### RP-1 Graceful Degradation（縮退運転）

- **問題**: WebGL2 非対応・SSR 環境等、描画基盤が構築できない状況でも、呼び出し元のアプリ全体をクラッシュさせてはならない。
- **適用**: `createViewer` は例外を投げず、常に `ViewerHandle` を返す。描画不可能な場合は縮退したハンドル（`on/off/once`・`dispose` のみ有効）を返し、`error` イベントで状況を通知する（BR-A-01〜04）。
- **UI 表現の境界**: 縮退時も `container` には何も描画しない（NFR Design Q6=A）。フォールバック UI の見た目は UoW-G の責務であり、UoW-A は状態通知に専念する。

### RP-2 Context Recovery State Machine（コンテキスト復帰の状態機械）

- **問題**: WebGL コンテキストロストからの復帰試行（BR-A-12: 1 回のみ）を、後続ユニットや呼び出し元が状態として参照・観測できる形にしたい。
- **適用**: `healthy → lost → recovering → healthy`（成功時）または `recovering → degraded`（失敗時）の明示的な状態機械として実装する（NFR Design Q2=A）。詳細は `logical-components.md` §2 参照。
- **効果**: `recovering` という一時的な状態も明示的にモデル化されるため、テスト（fast-check による状態遷移の網羅検証を含む）が書きやすい。

### RP-3 Single-Attempt Recovery（過剰リトライの回避）

- **問題**: 失敗する見込みが薄い再試行を繰り返すと、問題を長引かせるだけでなくリソースを浪費する。
- **適用**: `webglcontextrestored` 発火時に 1 回だけ再構築を試行し、失敗したら `degraded` へ遷移して再試行しない（RESILIENCY-10 の精神に沿う、BR-A-12）。

## 2. Scalability Patterns

**N/A**。クライアントサイドライブラリであり、水平/垂直スケーリング・負荷分散の概念が存在しない（`nfr-requirements.md` §1 で確認済み）。

## 3. Performance Patterns

### PP-1 Continuous Render Loop（常時連続描画）

- **問題**: 描画更新のタイミング制御方式（常時 vs 変化時のみ）を決める必要がある。
- **適用**: `requestAnimationFrame` による常時連続描画を採用する（NFR Design Q1=A）。UoW-D（視点操作）等の高頻度更新が入る後続ユニットとの整合を優先し、dirty flag 方式による「何が変化とみなされるか」の判定基準の設計は見送る。
- **見直しの契機**: モバイルでの電力消費が実測で問題になった場合、NFR Design を再実施して dirty flag 方式へ移行することを想定する（本ステージでは意図的に採用しない = Rejected Pattern として §5 に記録）。

### PP-2 Recreate-over-Pool（再生成優先・プーリング不採用）

- **問題**: コンテキストロスト復帰時の three.js リソース（シーン・カメラ・球体メッシュ）の扱い方。
- **適用**: 都度破棄して再生成する。オブジェクトプールは導入しない（NFR Design Q3=A）。UoW-A が扱うリソースはプレースホルダの球体メッシュ 1 個のみで、プーリングの複雑さに見合わない。
- **見直しの契機**: UoW-B（画像テクスチャ）以降でプーリングの価値が出た場合、当該ユニットの NFR Design で再検討する。

### PP-3 Single-Loop Invariant（単一描画ループの不変条件）

- **問題**: 多重ループが生成されるとフレームレートが不安定になる。
- **適用**: `Renderer` は `requestAnimationFrame` ハンドルを 1 つだけ保持し、`dispose()` で確実に `cancelAnimationFrame` する（BR-A-18, BR-A-11）。

## 4. Security Patterns

### SP-1 Defense in Depth（多層防御）

- **問題**: 初期化失敗の原因（SSR 環境／WebGL2 非対応）を単一のチェックに頼ると見落としが生じうる。
- **適用**: 環境ガード（BR-A-01）→ WebGL2 能力チェック（BR-A-02）の 2 段階チェックを直列に実施し、いずれかで失敗すれば共通の縮退パスへ倒す（BR-A-03）。

### SP-2 Fail-Safe Default（安全側への既定動作）

- **問題**: エラー発生時に内部詳細が漏れたり、不定状態のまま処理が継続するリスク。
- **適用**: `PerisphereError.message` は内部詳細を含まない安全な文言に固定（BR-A-13, SECURITY-09）。`dispose()` 後の呼び出しは例外を投げず no-op + warn に倒す（BR-A-09, SECURITY-15 の fail closed 思想を継承しつつ、クライアントライブラリとして例外伝播よりフェイルセーフを優先）。

## 5. 検討したが採用しなかったパターン（Rejected Patterns）

過剰設計・時期尚早な最適化を避けるため、以下は本ステージで明示的に不採用と判断した。後から「検討漏れ」と誤解されないよう、判断根拠と再検討の契機を記録する。

| パターン | 不採用の理由 | 再検討の契機 |
|---|---|---|
| Rate Limiter（`EventBus.on()` 登録数の上限） | UoW-A はクライアントライブラリであり外部攻撃者が登録数を操作できる経路がない。呼び出し元の実装ミス対策に過ぎず、正当な大規模利用を誤検知するリスクの方が大きい（NFR Design Q4=A） | 実際にメモリリーク報告が多発した場合 |
| Multi-Init Guard（同一 `container` への多重初期化検知） | `component-methods.md` の `createViewer` シグネチャの範囲を超える追加仕様。React `StrictMode` の意図的二重マウントと衝突するリスク（NFR Design Q5=A） | UoW-H（React アダプタ）で具体的な不具合が確認された場合 |
| Dirty Flag（状態変化検知による再描画抑制） | UoW-A 単体では判定基準を精緻化する材料がなく、UoW-D 統合時の手戻りリスクが高い（NFR Design Q1=A の裏返し） | モバイルでの電力消費が実測で問題になった場合 |
| Object Pool（three.js リソースの再利用） | UoW-A の対象リソースが少なく複雑さに見合わない（NFR Design Q3=A の裏返し） | UoW-B（画像テクスチャ）統合以降 |
