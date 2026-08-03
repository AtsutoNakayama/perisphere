# NFR Requirements Plan — UoW-D 視点操作・入力

- **関連 Issue**: [#38](https://github.com/AtsutoNakayama/perisphere/issues/38)
- **作成日**: 2026-08-03
- **前提資料**: `construction/uow-d/functional-design/`、`inception/requirements/requirements.md`（NFR-01〜12）、UoW-A/UoW-B/UoW-C `tech-stack-decisions.md`（モノレポ横断決定は継承）

## NFR カテゴリ別評価

| カテゴリ | UoW-D での判定 | 詳細 |
|---|---|---|
| Scalability | **N/A** | クライアントサイドライブラリであり、負荷分散・水平スケーリングの概念が存在しない（UoW-A〜C と同様） |
| Availability | **N/A** | 稼働サーバー・永続データストアなし（NFR-11 で確認済み） |
| Performance | **適用（本ユニットが主担当）** | NFR-01「視点操作・ズームが滑らか（60fps 目安）」は UoW-D の入力処理が直接の実現手段。本ステージで発火頻度制御・ホットパスの方針を確定（Q1, Q2） |
| Security | 適用 | NFR-10（SECURITY-05: 公開 API の入力検証・明確なエラー化）を `setView`/`setZoomLimits` に適用（Q5） |
| Reliability | 適用（Functional Design で具体化済み） | モード切替直後の視点同期（BR-D-12）・コンテキストロスト復帰時の視点再適用（BR-D-13）は確定済み。本ステージでの追加確認事項なし |
| Maintainability | 適用（継続） | Lint/フォーマッタ・TypeScript strictness は UoW-A の決定を継続。変更なし |
| Usability / Accessibility | **適用（本ユニットが機能面を主担当）** | NFR-04 の第一文（キーボードのみで主要操作完結）は UoW-D の責務。UI 表現面（ARIA・フォーカス表示）との境界を確認（Q6） |
| Tech Stack Selection | 本ステージで確認 | 新規ランタイム依存の要否（Q7）、テスト境界（Q3, Q4） |

## 確認質問（比較情報・推奨案を埋め込み済み）

### Q1. `viewchange`/`zoomchange` の発火頻度制御方針（Performance, NFR-01）

Functional Design（BR-D-14）は「発火回数・頻度は保証しない」とし、具体案を本ステージへ委ねている。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `pointermove`/`touchmove`/`wheel` 由来の高頻度更新は、同一アニメーションフレーム内の最後の値のみへ集約して `viewchange`/`zoomchange` を発火する（`requestAnimationFrame` ベースの集約、UoW-B PP-B-1 `Throttled Progress Emission` と同じ思想）。カメラ/シェーダへの実際の反映（`currentMode.updateView` 呼び出し）はこの集約とは独立に、intent 受信のたびに即座に行う（滑らかな描画自体はここが担保するため、EventBus 発火の間引きとは分離する）。キーボード操作（1回の押下＝1ステップ）や明示 API 呼び出しは元々低頻度なため素通しでよい | UoW-D 単体では `viewchange`/`zoomchange` の購読者はまだ存在しないが（同梱 UI は UoW-G）、高速ドラッグ時は1フレームに複数回の `pointermove` が発生しうる。将来の購読者（UoW-G）がメインスレッドを占有しないよう、今のうちに間引き方針を確定しておくのが NFR-01 の 60fps 目安達成に資する。具体的な閾値（ms/フレーム数）は NFR Design で確定する（BR-D-14 の記載通り） |
| B | 間引きなし。全ての視点変更で同期的に `viewchange`/`zoomchange` を発火する | 現時点では実害が出にくいが、UoW-G 実装時に高頻度ハンドラ呼び出しによる負荷が顕在化するリスクを先送りするだけになる |

**採用理由**: 描画の滑らかさ（intent→カメラ反映）とイベント通知の頻度制御を分離し、NFR-01 に対する体感遅延リスクを避けつつ将来の購読者負荷にも先回りで備える。

[Answer]: A

### Q2. パン/チルト/ズーム計算のホットパスにおけるオブジェクト生成の扱い（Performance, NFR-01）

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `ViewController` 内部では `ViewState` 相当の可変フィールドを直接更新し、`pointermove` 等の高頻度呼び出しのたびに新しいオブジェクトを生成しない。ただし公開 API `getView()` は呼び出しごとに浅いコピーを返し、呼び出し側が内部状態を誤って書き換えられないようにする | 「内部はミュータブルで高速、公開 API の境界だけコピーして安全性を確保」という一般的なパターン。高頻度経路での不要な GC 負荷を避けつつ、公開 API の安全性（呼び出し側が参照を保持して後から書き換える事故を防ぐ）を両立する |
| B | 内部処理でも毎回新しい `ViewState` オブジェクトを生成するイミュータブルな実装にする | 実装はシンプルだが、`pointermove` のような高頻度呼び出し経路で毎回オブジェクト生成すると GC プレッシャーがかかりうる。本ユニットの計算自体は軽量な算術のみのため実害は小さいと見込まれるが、NFR-01 の 8K 環境（相対的に描画負荷が高い状況）との重ね合わせでは避けておきたい |

**採用理由**: NFR-01 の 60fps 目安に対し、過度な最適化（YAGNI 違反）にならない範囲で最小限のホットパス配慮を行う。

[Answer]: A

### Q3. PBT の適用対象（テスト戦略、NFR-09 継続）

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 次を純粋関数として切り出し PBT（fast-check）の対象とする: ① yaw 正規化（任意の一連の pan 操作後も `yaw ∈ (-180, 180]`）、② pitch クランプ（任意の一連の tilt 操作後も `pitch ∈ [-89, 89]`）、③ fov クランプ（wheel/pinch/`setZoomLimits` の任意の組み合わせ後も `fov` が実効範囲内）、④ `Keymap` のマージ（`setKeymap` への任意の `Partial` 入力後、未指定アクションは既定値を保持し指定アクションのみ上書きされる）。ビジネスクリティカルな経路（モード切替直後の同期 BR-D-12、コンテキストロスト復帰 BR-D-13）は example-based で個別に検証する（PBT-10） | UoW-C の `equidistant.ts` 等と同じ「テスト可能な形に切り出す」パターンを踏襲できる。本ユニットは「入力の任意の組み合わせに対する不変条件」が特に重要な領域であり、PBT の効果が高い |
| B | PBT は行わず example-based のみ | PBT 全面適用方針（NFR-09）に反する |

**採用理由**: NFR-09 の全面適用方針を踏まえ、不変条件が明確な計算ロジックを優先的に PBT 対象とする。

[Answer]: A

### Q4. DOM 入力イベントのテスト境界

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `PointerInputSource`/`TouchInputSource`/`KeyboardInputSource` は、実際の DOM イベントリスナー登録を行う薄い層と、ネイティブイベント（`PointerEvent`/`TouchEvent`/`WheelEvent`/`KeyboardEvent`）から `InputIntent` を組み立てるロジックとに分離する。テストは jsdom が構築可能な合成イベント（`new PointerEvent(...)` 等）で後者を中心に検証する。jsdom が提供しない挙動（`setPointerCapture` の実際の捕捉効果等）は「呼び出されたこと」のみ検証し、実効果はブラウザでの手動確認に委ねる | UoW-A `tech-stack-decisions.md` §5（`Renderer` の境界モック化）と同じ考え方をテスト境界に適用する一貫性。jsdom の制約を明確にしつつユニットテストで可能な限り検証する |
| B | DOM イベント処理を含めてすべてブラウザでの E2E テストに委ねる（jsdom での単体テストは行わない） | UoW-A〜C で確立した「jsdom の範囲内でユニットテストする」方針から外れ、手動確認への依存が過大になる |

**採用理由**: 既存方針（jsdom の制約を認識しつつ可能な範囲は単体テストで担保）の継続。

[Answer]: A

### Q5. `setView`/`setZoomLimits` の入力検証（Security, NFR-10 / SECURITY-05）

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `setView(partial)`/`setZoomLimits(partial)` は渡された各フィールドが有限数値（`Number.isFinite`）であることを検証する。不正な値（`NaN`/`Infinity`/非数値）が1つでも含まれる場合、呼び出し全体を無視し `error`（`INVALID_INPUT`）を発火する（UoW-A BR-A-17・UoW-B BR-B-03 と同じ「誤用は明確なエラーへ正規化」方針）。`setZoomLimits` で `minFov >= maxFov` となる組み合わせも同様に `INVALID_INPUT` として拒否する | SECURITY-05「不正入力は明確なエラーとする」という要求、および UoW-A〜C で一貫してきた「公開 API の誤用は `INVALID_INPUT` イベントへ正規化する」方針との整合性が高い |
| B | 不正な値のみ黙って無視し、有効なフィールドだけ反映する（部分適用、エラー通知なし） | 利用側が入力ミスに気づきにくく、SECURITY-05 の「明確なエラー」という要求を満たさない |

**採用理由**: 既存方針（誤用の明確なエラー化）と SECURITY-05 の要求に整合させる。

[Answer]: A

### Q6. アクセシビリティの範囲確認（UoW-D と UoW-G の境界、NFR-04）

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | UoW-D は NFR-04 第一文「キーボードのみで主要操作（視点移動・ズーム）が完結できる」という**機能面**までを担う（Functional Design E6 の `KeyboardInputSource`・`tabindex="0"` 付与で対応済み）。フォーカスの視覚的表示・`aria-label` 等の ARIA 属性付与・スクリーンリーダー向けの状態通知は、可視要素を持つ同梱 UI（UoW-G `ControlsUI`）の責務とする | `unit-of-work-story-map.md` は US-35（アクセシビリティ）の主担当を UoW-G としている。UoW-D はビューワーの描画領域（可視の UI 要素を持たない）を扱うユニットであり、ARIA・フォーカス表現は可視要素を持つ UoW-G が扱う方が自然な責務分担 |
| B | UoW-D で ARIA 属性・フォーカスリングのスタイルまで実装する | UoW-D のスコープ（`unit-of-work.md` の責務定義）を超え、UoW-G と責務が重複する |

**採用理由**: `unit-of-work-story-map.md` の主担当割り当て（US-35 は UoW-G）との整合性。

[Answer]: A

### Q7. 新規ランタイム依存の要否

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 新規ランタイム依存を追加しない。Pointer Events / Touch Events / Wheel / Keyboard イベントはいずれも DOM 標準 API であり、three.js 以外の追加ライブラリ（ジェスチャー検出ライブラリ等）は不要 | 本ユニットが要求するジェスチャー（1本指ドラッグ、2本指ピンチ）は DOM 標準 API から直接実装可能な範囲であり、UoW-A〜C から継続する「必要最小限の依存」方針（YAGNI）に合致する |
| B | ジェスチャー検出用ライブラリを導入する | 過剰な依存追加。本ユニットの要件に対して投資が見合わない |

**採用理由**: 既存方針の継続。

[Answer]: A

## 比較検討サマリ

判断軸: (1) NFR-01（60fps 目安）の実現手段としての発火頻度制御・ホットパス配慮、(2) NFR-09（PBT 全面適用）に対する不変条件テストの対象選定、(3) UoW-A〜C で確立済みのテスト境界方針（jsdom の制約を踏まえた境界モック化）の継続、(4) SECURITY-05・既存の `INVALID_INPUT` 正規化方針との整合、(5) `unit-of-work-story-map.md` の主担当割り当て（US-35＝UoW-G）に基づく責務境界の明確化、(6) YAGNI（新規依存の抑制）。

## 次のステップ（Step 6: 成果物生成、承認後）

- [ ] `aidlc-docs/construction/uow-d/nfr-requirements/nfr-requirements.md`
- [ ] `aidlc-docs/construction/uow-d/nfr-requirements/tech-stack-decisions.md`
