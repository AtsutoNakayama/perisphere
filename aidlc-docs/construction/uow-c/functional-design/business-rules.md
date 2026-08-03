# Business Rules — UoW-C 投影モード

- **関連 Issue**: [#36](https://github.com/AtsutoNakayama/perisphere/issues/36)
- **作成日**: 2026-08-03
- **前提資料**: `uow-c-functional-design-plan.md`（Q1〜Q6 回答・採用理由）、`domain-entities.md`、UoW-A `business-rules.md`（特に BR-A-06/BR-A-17）

各ルールには **trace**（対応するストーリー/要件/計画質問/UoW-A ルールとの関係）を付す。

## モード登録・解決

### BR-C-01 全7モードの初期登録

`createViewer` の初期化時、`ModeRegistry`（E1）へ `StandardMode`（UoW-A）を含む全 7 モードを登録する。同梱モードは他の登録済みモードと同一の `ViewerMode` IF 上に実装される（US-12 の受け入れ基準「同梱モード自体もこの登録機構の上に実装されている」）。

- **trace**: US-12, Q6=A

### BR-C-02 `setMode` の拡張（未登録 `id` の扱い）

`ViewerHandle.setMode(id)` は `ModeRegistry.get(id)` で解決を試みる。解決できない場合、UoW-A BR-A-17 と同じ `INVALID_INPUT` として正規化し、現在のモードは変更しない。UoW-A 時点では `id !== 'standard'` という固定チェックだったが、本ユニットで `ModeRegistry` による動的解決に置き換える（既存実装の修正）。

- **trace**: BR-A-17（拡張）, US-10

### BR-C-03 モード切替の手順

`setMode(id)` が解決に成功した場合、以下の順序で実行する: (1) 現在のモードの `dispose(ctx)` → (2) `ModeContext` の更新（`texture` を含む） → (3) 新モードの `apply(ctx)` → (4) `ViewerState.mode` 更新 → (5) `modechange` イベント発火。

- **trace**: US-10, `services.md` モード切替オーケストレーションパターン

### BR-C-04 モード切替時の視点リセット

モード切替時、視点（yaw/pitch/fov）は前モードの状態を引き継がず、新モードの既定ビュー（`apply(ctx)` が設定する値）にリセットされる。UoW-A の `StandardMode.apply` と同じ契約（`apply` は常に既定ビューを設定する）を全モードで踏襲する。

- **trace**: US-10, UoW-A `StandardMode.apply` の既存契約

## 各モードの既定値

### BR-C-05 カメラベースモードの既定値（UltraWide/Linear）

| モード | 既定 FOV | 既定ズーム範囲 |
|---|---|---|
| UltraWide | 100° | 60〜120° |
| Linear | 50° | 20〜70° |

`StandardMode` と同じ `apply`/`updateView` 実装パターン（カメラの `rotation`/`fov` を設定）を用いる。

- **trace**: US-07, Q1=A①

### BR-C-06 シェーダベースモードの既定値（Dewarp/Panini/Tiny Planet）

| モード | 投影方式 | 既定 FOV | 既定ズーム範囲 |
|---|---|---|---|
| Dewarp | 等距離図法 | 140° | 90〜160° |
| Panini | Panini 図法（近似、d≈1） | 120° | 80〜150° |
| Tiny Planet | ステレオ図法 | 160° | 100〜180° |

- **trace**: US-07, US-08, Q1=A②, Q5=A（近似式で可）

### BR-C-07 Crystal Ball の既定値・配置

既定 FOV 75°・既定ズーム範囲 30〜90°（Standard と同じ）。カメラは球中心から半径の 2.5 倍の距離に配置し、球体メッシュのマテリアルの `side` を `FrontSide` に切り替える。

- **trace**: US-08, Q4=A

## シェーダベースモードのマテリアル管理

### BR-C-08 `Renderer.setSphereMaterial` によるマテリアル差し替え

シェーダベースモード（Dewarp/Panini/Tiny Planet）は `apply(ctx)` 内で `Renderer.setSphereMaterial(material)`（新規拡張メソッド）を呼び、投影数式を実装した専用 `ShaderMaterial` を球体メッシュへ適用する。`ctx.texture`（`ModeContext` 拡張）をシェーダのユニフォームとして渡す。

- **trace**: Q1=A②, Q2=A, Q3=A

### BR-C-09 マテリアルの復帰

シェーダベースモードの `dispose(ctx)` は、`Renderer.setSphereMaterial` を呼んで既定の `MeshBasicMaterial`（UoW-A/UoW-B が確立した通常表示用マテリアル、`ctx.texture` を `map` として設定）へ戻す。カメラベースモード（Standard/UltraWide/Linear/Crystal Ball）へ切り替える際に正しいマテリアルへ復帰していることを保証する。

- **trace**: Q3=A, BR-C-03（モード切替手順の一部）

### BR-C-10 シェーダの数値的安定性

投影数式が発散しうる角度（例: 中心からの角度 θ が 180° に近づく場合）では、スクリーン座標をクランプし `NaN`/`Infinity` を出力しない。US-09（モード横断で視点操作が破綻しない）を満たすための最低限の保護。

- **trace**: US-09

## Crystal Ball 固有の考慮事項

### BR-C-11 Crystal Ball でのマテリアル面の復帰

Crystal Ball の `dispose(ctx)` は、球体メッシュのマテリアルの `side` を他モード共通の `BackSide` へ戻す。

- **trace**: Q4=A, BR-C-03（モード切替手順の一部）

## 公開 API の拡張（Code Generation Part 1 計画時に発見・追記）

**経緯**: Functional Design 承認後、Code Generation の計画作成時に `inception/application-design/component-methods.md` を再確認したところ、`ViewerHandle` に `registerMode`/`listModes` および `setMode` のオプション引数が定義されていたにもかかわらず、本ドキュメントの初版では欠落していたことが判明した。UoW-B の BR-B-11/13/14 と同様、承認済み Functional Design への追記として扱う（レビュー対象）。

### BR-C-12 `registerMode` によるカスタムモード登録

`ViewerHandle.registerMode(mode: ViewerMode): void` を追加する。`ModeRegistry.register`（E1）へ委譲する。同梱 7 モードもこの機構の上に実装されているため（BR-C-01）、利用者が登録するカスタムモードと同梱モードは対等に扱われる。

- **trace**: US-12, FR-05, `component-methods.md` L47

### BR-C-13 `listModes` による登録済みモード一覧の取得

`ViewerHandle.listModes(): ViewerModeId[]` を追加する。`ModeRegistry` に登録済みの全モードの `id` を返す（登録順）。

- **trace**: `component-methods.md` L48（US-12 に付随する探索用 API）

### BR-C-14 `setMode` のオプション引数（将来のアニメーション遷移への予約）

`ViewerHandle.setMode(mode: ViewerModeId, options?: ModeChangeOptions): void` に拡張する。`options` は UoW-C 時点では未使用（受け取っても無視する）。`unit-of-work.md` の UoW-C-F（モード遷移演出、Future）が「API 形状の拡張余地は UoW-C で確保済み」と定義しているため、本ユニットで型のみ予約する。

- **trace**: US-11（Future、`unit-of-work.md` UoW-C-F の記述）, FR-04

### BR-C-15 `ViewerModeId` 型の拡張

`ViewerModeId` を `'standard' | 'ultraWide' | 'dewarp' | 'linear' | 'panini' | 'tinyPlanet' | 'crystalBall' | (string & {})` に拡張する（`component-methods.md` の型定義通り）。同梱 6 モードの `id` はそれぞれ `'ultraWide'`/`'dewarp'`/`'linear'`/`'panini'`/`'tinyPlanet'`/`'crystalBall'` とする。`(string & {})` により `registerMode`（BR-C-12）で登録するカスタムモードの任意 `id` も型エラーにならない。

- **trace**: US-12, `component-methods.md` 共通型定義
