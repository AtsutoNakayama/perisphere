# NFR Design Plan — UoW-D 視点操作・入力

- **関連 Issue**: [#38](https://github.com/AtsutoNakayama/perisphere/issues/38)
- **作成日**: 2026-08-03
- **前提資料**: `construction/uow-d/nfr-requirements/`、`construction/uow-d/functional-design/`

## 必須評価カテゴリの適用可否

| カテゴリ | 適用可否 | 判定根拠 |
|---|---|---|
| Resilience Patterns | 適用 | `setPointerCapture` 失敗時の扱いを扱う（Q1） |
| Scalability Patterns | **N/A** | `nfr-requirements.md` §1 で確認済み（クライアントサイドライブラリ） |
| Performance Patterns | 適用 | `viewchange`/`zoomchange` の集約発火の具体実装方式を確定する（NFR Requirements Q1 の具体化、Q2） |
| Security Patterns | 適用（新規論点なし） | `setView`/`setZoomLimits` の入力検証（NFR Requirements Q5）は UoW-A/B の Defense in Depth の継続であることを確認する（Q3） |
| Logical Components | 適用 | パン/チルト/ズームの純粋関数モジュールの配置を確定する（Q4） |

## 確認質問（比較情報・推奨案を埋め込み済み）

### Q1. `setPointerCapture` 失敗時の扱い（Resilience）

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `setPointerCapture` の呼び出しを `try/catch` で囲む。失敗した場合でも例外を伝播させず、通常の `pointermove`/`pointerup`（要素内でのみ追跡）にフォールバックする（要素外に出た場合のみドラッグ追跡が途切れる劣化に留め、ビューワー全体には影響させない） | UoW-A の RP-1（Graceful Degradation）と同じ思想。対象ブラウザ（NFR-02）でも要素がまだ DOM に接続されていない等のタイミングで稀に失敗しうるが、視点操作全体を止めるほどの重大度ではない |
| B | 失敗時は例外を投げ、ビューワーの初期化失敗として扱う | ポインタキャプチャの失敗はドラッグ追跡の劣化に過ぎず、ビューワー全体を止めるほどの障害ではない。過剰反応 |

**採用理由**: RP-1 の Graceful Degradation の考え方をそのまま踏襲する。

[Answer]: A

### Q2. `viewchange`/`zoomchange` 集約発火の具体実装方式（Performance）

NFR Requirements Q1 で「`requestAnimationFrame` ベースで集約発火する」という方針までは確定済み。具体的な実装方式を本ステージで確定する。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 独立した専用の `requestAnimationFrame` ループは追加しない。`ViewState` に変化があるたびに「発火保留（pending）」フラグを立てるのみとし、UoW-A から常時稼働している `Renderer` の描画ループ（`startLoop`）の各フレームで「pending フラグが立っていれば `viewchange`/`zoomchange` を最新の `ViewState` で発火してフラグを下ろす」というチェックを追加する | `Renderer` の描画ループは UoW-A 以来ドラッグの有無によらず常時稼働しているため、専用ループの開始/停止という追加のライフサイクル管理が不要になる。実装コストが最小で済む（YAGNI） |
| B | 視点操作専用の独立した `requestAnimationFrame` ループを新設し、ドラッグ/ホイール操作の開始時に起動、一定時間操作がなければ停止する | 操作の開始/停止検出とループのライフサイクル管理という追加の複雑さが生じる。既存の常時描画ループに乗せるだけで同じ効果が得られるため過剰設計 |

**採用理由**: 既存の常時描画ループ（UoW-A で確立済み）にチェックを1つ追加するだけで済み、追加のライフサイクル管理を避けられる。

[Answer]: A

### Q3. `setView`/`setZoomLimits` 検証の位置づけ（Security、新規論点の要否）

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | NFR Requirements Q5 で確定した検証（`Number.isFinite`・`minFov < maxFov`・不正時は `INVALID_INPUT`）は、UoW-A/UoW-B で確立した「公開 API の入力を境界で検証し、不正は明確なエラーとして正規化する」という Defense in Depth の考え方の継続であり、本ステージで新規のセキュリティパターンは追加しない | UoW-C も同様に「新規のセキュリティパターン論点はなし」と判断しており（UoW-C `nfr-design-patterns.md` §4）、一貫した扱い |
| B | `setView`/`setZoomLimits` 専用の追加的な検証層（レート制限等）を設ける | 本ユニットの入力（数値の範囲）に対してレート制限等は過剰。呼び出し頻度そのものは Q2（発火頻度の集約）で別途対処済み |

**採用理由**: 既存方針の継続、過剰設計を避ける。

[Answer]: A

### Q4. パン/チルト/ズーム計算の純粋関数モジュールの配置（Logical Components）

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `packages/core/src/interaction/` に `viewMath.ts`（`normalizeYaw`/`clampPitch`/`clampFov`/`applyPanDelta`/`applyTiltDelta`/`applyZoomDelta`/`applyZoomScale` 等の純粋関数）を配置する独立モジュールとする。`ViewController` はこのモジュールの関数を呼び出して状態を更新するのみとし、計算ロジック自体は保持しない | UoW-C の `modes/projections/`（投影数式を独立モジュールへ切り出し PBT 対象化）と同じパターンを踏襲できる。純粋関数を独立モジュールに切り出すことで PBT（`nfr-requirements.md` §3 Q3 で確定済みの対象）が書きやすくなる |
| B | 計算ロジックを `ViewController` クラスの private メソッドとして実装する（別モジュールに切り出さない） | クラスの private メソッドは直接 import してテストしづらく、PBT 対象として独立にテストする方針（NFR Requirements Q3）と相性が悪い |

**採用理由**: UoW-C の前例踏襲。PBT 対象を明確にテスト可能な形で切り出す。

[Answer]: A

## 比較検討サマリ

判断軸: (1) UoW-A の RP-1（Graceful Degradation）との一貫性、(2) 既存の常時描画ループ（UoW-A `startLoop`）を活用し追加のライフサイクル管理を避ける YAGNI、(3) UoW-A/B/C で確立済みの Defense in Depth・PBT 対象切り出しパターンとの継続性。

## 次のステップ（Step 6: 成果物生成、承認後）

- [ ] `aidlc-docs/construction/uow-d/nfr-design/nfr-design-patterns.md`
- [ ] `aidlc-docs/construction/uow-d/nfr-design/logical-components.md`
