# Functional Design Plan — UoW-D 視点操作・入力

- **関連 Issue**: [#38](https://github.com/AtsutoNakayama/perisphere/issues/38)
- **作成日**: 2026-08-03
- **前提資料**: `inception/application-design/unit-of-work.md`（UoW-D 節）、`components.md`（C6/C7）/`component-methods.md`（C7 `InputSource` IF）/`services.md`（S3 `InteractionService`）、`requirements.md`（FR-06〜09）、`user-stories/stories.md`（US-13〜20）、UoW-A/UoW-C 実装（`packages/core/src/viewer/`, `packages/core/src/modes/`）

**本ファイルは Functional Design（Part 1: 計画）の単一の情報源である。**

## ユニットコンテキスト

- **責務**: ポインタ／タッチ／キーボード入力の集約・正規化、視点状態（yaw/pitch/fov）の更新、ズーム上下限クランプ（モード既定範囲を含む）、キーマップ変更・無効化
- **担当ストーリー**: US-13, US-14, US-15, US-16, US-17, US-18, US-19, US-20
- **依存ユニット**: UoW-A（`ViewerState`/`EventBus`/`ViewerHandle` 基盤、いずれもマージ済み）、UoW-C（モード既定ズーム範囲 `ViewerMode.defaultZoomLimits`、マージ済み）
- **既存の型・IF（変更しない前提）**: `ViewState { yaw, pitch, fov }` / `ZoomLimits { minFov, maxFov }`（`viewer/types.ts` に定義済み）、`ViewerMode.updateView(ctx, view)`（全7モード実装済み・呼び出し元は UoW-D で新設）、`InputSource` IF（`component-methods.md` で `attach(target, emit)`/`detach()` の形は確定済み、実装は本ユニット）

## 技術的な背景整理（レビュー時に確認いただきたい前提）

- `Renderer` は UoW-A から継続 `requestAnimationFrame` で**毎フレーム連続描画**している（`startLoop()`）。よって「次フレームで再描画」は `ViewState` を更新して `currentMode.updateView(ctx, view)` を呼ぶだけで自動的に反映され、UoW-D 側で別途スケジューリング機構を持つ必要はない。
- `ViewerMode.updateView` は既に全7モードで実装済み（camera の rotation/fov、またはシェーダユニフォームへの反映）。UoW-D は「どのモードが今アクティブか」を知る必要はなく、`createViewer` 内の `currentMode` 経由で呼べば良い（UoW-C の `setMode` と同じ結線パターン）。
- `component-methods.md` は `InputIntent` の種類を `pan|tilt|zoom|photoNext|photoPrev|toggleFullscreen|setMode` まで列挙済み（Inception 承認済みの IF）。`photoNext/photoPrev`（UoW-E 未着手）・`toggleFullscreen`（UoW-F 未着手）は本ユニット時点では受け手が存在しない。
- `requirements.md` FR-08 と `stories.md` US-17/US-18 を突き合わせると、既定キーマップの矢印キー割当てに**未解決の重複**がある（US-17: キーボードで視点移動、US-18 見出し: 矢印キーで写真送り）。Q6 で解消する。

## 確認質問（比較情報・推奨案を埋め込み済み）

### Q1. InputIntent → ViewState 反映の全体アーキテクチャ

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `services.md` の記載通り: 各 `InputSource`（Pointer/Touch/Keyboard）が `InputIntent` を emit → `InputManager`（C7）が集約 → `ViewController`（C6）が `ViewState` を更新しズーム上下限でクランプ → `createViewer` が `currentMode.updateView(ctx, view)` を呼ぶ。再描画のスケジューリングは既存の連続 `requestAnimationFrame` ループ（UoW-A）にそのまま乗せ、追加の dirty-flag 機構は持たない | `updateView` は camera 属性設定またはユニフォーム更新のみで O(1) の軽量操作であり、連続ループ上で毎回呼んでもコスト上問題ない。dirty-flag 方式は UoW-A で確立した「常時描画」前提と衝突し、本ユニットの範囲に見合わない最適化（YAGNI） |
| B | 差分検知（dirty flag）を導入し、`ViewState` が変化したフレームのみ `updateView` を呼ぶ | `WebGLRenderer.render` 自体は毎フレーム呼ばれ続けるため（UoW-A の既存設計）、`updateView` だけ呼び控えても描画コストの削減効果は薄く、状態管理の複雑さが増すだけ |

**採用理由**: UoW-A で確立した「常時描画ループ」を前提に、視点更新はその上に単純に乗せるのが一貫性・実装コストの両面で妥当。

[Answer]: A

### Q2. パン/チルトの符号規約・感度モデル（ドラッグ量→角度変換）

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 「つかんで回す」方式（ドラッグ方向と視点回転方向を逆位相にする: 右へドラッグ→`yaw` 減算、下へドラッグ→`pitch` 加算等）。ピクセル→度の変換係数は現在の `fov` に比例させ（`k = fov / baseFov * sensitivity`）、ズームインしているときは同じピクセル移動でも角度変化を小さくする | 「画面内の絵柄が指に追従する」体感が FOV に依存せず一貫する。受け入れ基準（US-13: 視点が連続的に追従）を、ズームイン/アウトどちらの状態でも均質に満たせる |
| B | 固定感度（`fov` に依存しない一定角度/px） | 実装は単純だが、ズームインした状態で同じドラッグ量でも視野に対する回転が相対的に大きくなり「行き過ぎる」体感になりやすい |

**採用理由**: 受け入れ基準の「連続的に追従」をズーム状態によらず均質に満たすため、FOV 比例の感度モデルを採用する。

[Answer]: A

### Q3. pitch のクランプ範囲

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `pitch` を `-89°`〜`+89°` にクランプする | `StandardMode.updateView` は `camera.rotation.set(pitch, yaw, 0, "YXZ")` という YXZ オイラー角順序を使用しており、`pitch` がちょうど `±90°` に達するとジンバルロックにより `yaw` 軸が不定になる。1° のマージンで安全に回避する |
| B | `-90°`〜`+90°`（境界ちょうど） | ジンバルロックのリスクがあり、真上/真下を向いた瞬間に `yaw` の挙動が不安定になり得る |

**採用理由**: 既存の `StandardMode`（および他モード）の YXZ オイラー角実装との整合、ジンバルロック回避。

[Answer]: A

### Q4. ズームの入力→FOV変換モデル（wheel / pinch）

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | wheel は `deltaY` を線形加算（`fov += deltaY * wheelSensitivity`）。pinch は 2 点間距離の変化「比率」を乗算的に反映（`fov *= startDistance / currentDistance`、指の間隔が2倍→見た目も約2倍に近づく）。どちらも共通の `clampFov(fov, limits)` を通す純粋関数として切り出し、PBT で「任意の入力列後も常に `[minFov, maxFov]` に収まる」不変条件を検証する | wheel は離散的な段階入力のため加算モデルが自然。pinch は本質的に「拡大率（スケール比）」を表す操作のためスケール比例（乗算）モデルが直感に合う。クランプの純粋関数化は UoW-C で確立した「PBT 対象を純粋関数に切り出す」パターン（`equidistant.ts` 等）を踏襲でき、Property-Based Testing 拡張（全面適用）とも整合する |
| B | wheel・pinch とも同じ加算モデルに統一する | 実装は単純だが、pinch をピクセル距離の差分（加算）で扱うと、同じ「指を2倍広げる」操作でも開始時のズーム状態によって見た目の拡大率が変わってしまい、直感的な操作感を損なう |

**採用理由**: 入力の性質（離散段階 vs 連続スケール比）に応じた自然なモデルを採用しつつ、クランプ処理を PBT 対象として共通化する。

[Answer]: A

### Q5. ズーム上下限の設定 API とモード切替時の扱い

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `ViewerHandle.setZoomLimits(limits: ZoomLimits \| null): void` を追加する。`null` は明示指定の解除（以後はアクティブモードの `defaultZoomLimits` にフォールバック）。明示設定した場合はモード切替をまたいで維持され、モードの `defaultZoomLimits` より優先される | US-20 の受け入れ基準「未設定時は各モードに適した既定範囲が適用される」は裏を返せば「設定時はモードに関わらず維持される」という自然な解釈。組み込み開発者が一度設定した制約が、利用者のモード切替操作で意図せず失われないことは API として直感的 |
| B | モード切替のたびに必ずモード既定へリセットする（明示設定はモード切替のたびに失われる） | 組み込み開発者が「常にこの範囲に収めたい」という意図で設定したはずの制約が、利用者のモード操作で毎回上書きされてしまい、US-20 の意図（用途に応じた行き過ぎ防止）に反する |

**採用理由**: 明示設定は「利用側の意図的な制約」であり、モード切替という利用者操作で暗黙に失われるべきではない。

[Answer]: A

### Q6. 既定キーマップにおける矢印キーの割当て（要件間の重複の解消）

`requirements.md` FR-08 は「キーボードで視点移動・ズーム・写真切替が完結」としつつ、`stories.md` US-18 の見出しは「矢印キーで写真送り」と明記しており、両者とも矢印キーを想定しうる記述になっている。両立できないため本ステージで解消する。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 矢印キー（↑↓←→）＝視点移動（tilt/pan）の既定とする。写真の前後移動は `PageUp`/`PageDown` を既定とする。ズームは `+`/`-`（`=`/`-`）。フルスクリーンは `f`。既定キーマップにモード切替キーは割り当てない（モード切替は `setMode` API・将来の同梱 UI〔UoW-G〕経由を前提とし、本ユニットでは矢印/文字キーの既定衝突を増やさない） | FR-06（ポインタのドラッグ）・US-13/14 と対称的に「方向キー＝視覚的な見回し操作」という対応がドラッグ操作と一貫する。写真送りに `PageUp`/`PageDown` を使う配置は一般的なページ送り慣習に沿い、矢印キーとの衝突を修飾キーなしで回避できる |
| B | 矢印キー（←→のみ）＝写真送り、視点移動は `Shift+矢印キー` の既定とする | US-18 見出しの字面を最優先するが、US-13（ドラッグでの直感的な視点移動）と対称のはずの「主操作」に修飾キーを要求することになり、キーボードでの主要操作としての手軽さ（US-17 の意図）が下がる |
| C | 矢印キー単体＝視点移動、`Shift+矢印キー`（左右）＝写真送り | A と近いが、矢印キーに機能を集約する分キーマップ設定の項目が減る一方、修飾キー併用を要求する点で A よりわずかに操作コストが高い |

**採用理由**: ドラッグ操作との対称性（方向キー＝見回し）を保ちつつ、修飾キーなしで矢印キーとの衝突を避けられる A を既定とする。いずれの場合も `setKeymap`（Q7 で API 形状確定）で利用側が自由に上書き可能。

[Answer]: A

### Q7. `photoNext`/`photoPrev`/`toggleFullscreen`/`setMode` インテントの結線（UoW-E/F 未実装時点の扱い）

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `InputManager`/`InputSource` は `component-methods.md` 確定済みの全 `InputIntent` kind（`pan`/`tilt`/`zoom`/`photoNext`/`photoPrev`/`toggleFullscreen`/`setMode`）をそのまま正規化して emit する（IF は変更しない）。`createViewer` 側で実際に処理するのは本ユニットで実装可能な `pan`/`tilt`/`zoom`（`ViewController` 経由）と `setMode`（UoW-C で実装済みの `setMode` をそのまま呼ぶ）のみとし、`photoNext`/`photoPrev`/`toggleFullscreen` は対応する実装（UoW-E/F）が未登録のため安全に無視（no-op）する | `InputSource` IF は Inception で承認済みの公開拡張 IF（NFR-02）であり、kind を後から追加すると拡張実装者にとって非互換な変更になる。全 kind を先に定義しつつ未実装分は no-op とする方が IF の安定性を保てる |
| B | `photoNext`/`photoPrev`/`toggleFullscreen` の kind 自体を本ユニットでは定義せず、UoW-E/F 実装時に追加する | `component-methods.md` は Inception（Application Design）で承認済みの確定 IF であり、本来 Construction フェーズで変更する対象ではない。将来的な追加は拡張者（サードパーティの `InputSource` 実装）にとって非互換変更のリスクを生む |

**採用理由**: IF は Inception 承認済みの契約として尊重し、未実装機能への配線は「安全な no-op」で吸収する。

[Answer]: A

### Q8. ブラウザ既定動作の抑制範囲

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | ①ドラッグ中のテキスト選択抑制（コンテナへ CSS `user-select: none`、`pointerdown`/`touchstart` で `preventDefault()`）。② `wheel` は `{ passive: false }` で登録し `preventDefault()` してページスクロールを防ぐ。③コンテナへ CSS `touch-action: none` を設定し、ブラウザのネイティブなパン/ズームジェスチャーとの競合を避ける。④コンテナに `tabindex="0"` を付与し、キー入力はコンテナへのフォーカス時のみ処理する | 抑制しないと、ドラッグ中の意図しないテキスト選択・モバイルでのピンチとページズームの競合・ホイールでのページスクロールが発生し、US-13〜16 の受け入れ基準（滑らかな追従）を満たせない。`tabindex` 付与はキーボード操作の受付に必須で、US-35（アクセシビリティ、UoW-G スコープ）の前提としても必要な最小限の土台になる |
| B | 何も抑制しない（ブラウザ既定挙動のまま） | モバイルでのピンチ操作がブラウザのページズームと競合し、ドラッグ中に不要なテキスト選択が発生するなど、受け入れ基準を満たせない |

**採用理由**: 受け入れ基準（滑らかな追従）を満たすために必要な最小限のブラウザ既定動作抑制であり、過剰な抑制（例: コンテキストメニュー禁止等、要求されていない範囲）までは行わない。

[Answer]: A

## 比較検討サマリ

判断軸: (1) UoW-A/UoW-C で確立済みのアーキテクチャ（連続描画ループ、`Renderer`/`ViewerMode` カプセル化、`ModeContext` 経由の結線）との一貫性、(2) Inception で承認済みの公開 IF（`InputSource`, `ViewState`, `ZoomLimits`）を変更しない、(3) 受け入れ基準（滑らかな追従・ズーム範囲遵守）に対して過不足のない実装コスト、(4) 要件間の記述重複（Q6）は本ステージで明示的に解消し曖昧さを残さない。

## 次のステップ（Step 6: 成果物生成、承認後）

- [ ] `aidlc-docs/construction/uow-d/functional-design/domain-entities.md`
- [ ] `aidlc-docs/construction/uow-d/functional-design/business-rules.md`
- [ ] `aidlc-docs/construction/uow-d/functional-design/business-logic-model.md`
