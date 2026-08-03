# Functional Design Plan — UoW-C 投影モード

- **関連 Issue**: [#36](https://github.com/AtsutoNakayama/perisphere/issues/36)
- **作成日**: 2026-08-03
- **前提資料**: `inception/application-design/unit-of-work.md`（UoW-C 節）、`components.md`/`component-methods.md`/`services.md`、`user-stories/stories.md`（US-07, US-08, US-09, US-10, US-12）、UoW-A/UoW-B 実装（`packages/core/src/viewer/`）

**本ファイルは Functional Design（Part 1: 計画）の単一の情報源である。**

## ユニットコンテキスト

- **責務**: `ViewerMode` IF に対するインスタンス単位の登録簿（`ModeRegistry`）、標準以外の6モード（UltraWide/Dewarp/Linear/Panini/Tiny Planet/Crystal Ball）実装、モード切替 API
- **担当ストーリー**: US-07, US-08, US-09, US-10, US-12
- **依存ユニット**: UoW-A（`ViewerMode` IF・`Renderer`・`StandardMode` 実装パターン）
- **Application Design からの申し送り（Q5=D）**: 投影の具体的な実装方式（シェーダ/カメラ/ハイブリッド）は Application Design では確定せず、本ステージ（Functional Design）で決定する。

## 技術的な背景整理（レビュー時に確認いただきたい前提）

6 モードは視覚的特性が大きく異なり、単一の技法では実現できない:

- **UltraWide・Linear**: 既存の `StandardMode`（透視投影カメラ + 球体メッシュ）と数学的に同種（直線的透視投影）。既定 FOV・ズーム範囲が異なるのみで実現できる。
- **Dewarp・Panini・Tiny Planet**: 直線的透視投影では原理的に表現できない非線形の投影（three.js の `PerspectiveCamera` は透視投影のみサポート）。カメラの投影行列を差し替えることはできないため、球体メッシュに独自のシェーダ（頂点シェーダで投影数式を直接計算）を適用する必要がある。
- **Crystal Ball**: 「球を外側から眺める」ため、カメラを球の内部ではなく外部に置く構図が必要（他モードとは全く異なる配置）。

## 確認質問（比較情報・推奨案を埋め込み済み）

### Q1. 全体アーキテクチャ（実装方式、Application Design Q5=D の決定事項）

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | **ハイブリッド方式**。①カメラベース（既存 `StandardMode` と同じ透視投影カメラ + 球体メッシュ、既定 FOV/ズーム範囲のみ変更）: UltraWide・Linear。②シェーダベース（球体メッシュに専用 `ShaderMaterial` を適用し、頂点シェーダで投影数式を直接計算）: Dewarp・Panini・Tiny Planet。③外部カメラ（球の外側にカメラを配置、マテリアルの面を反転）: Crystal Ball | UoW-A で確立した「カメラが球体メッシュの中心にあり、`Renderer` が球体メッシュ・テクスチャを保持する」という既存アーキテクチャを最大限再利用しつつ、技術的に不可能な要求（透視投影カメラだけでの非線形投影表現）だけをシェーダで補う、最小限の拡張 |
| B | 全モードをスクリーン空間シェーダ（フルスクリーンクアッド + フラグメントシェーダでレイ方向を計算しテクスチャをサンプリング）に統一し、球体メッシュ自体を廃止する | 技法として洗練されているが、UoW-A/UoW-B で確立し**マージ済み**の球体メッシュ・`Renderer.setSphereTexture` アーキテクチャ全体を置き換える大規模な変更になる。Crystal Ball の実カメラ的な奥行き表現とも相性が悪い。Application Design Q5=D は「モードごとの実装方式」を Functional Design に委ねたのであり、既存アーキテクチャ全体の刷新までは意図していないと判断 |
| C | 全モードをカメラ（透視投影）のみで実装する | Dewarp/Panini/Tiny Planet の非線形投影は透視投影カメラでは原理的に表現不可能なため、技術的に採用不可 |

**採用理由**: 既存のマージ済みアーキテクチャ（UoW-A `Renderer`／UoW-B `setSphereTexture`）を尊重しつつ、技術的に必要な箇所（非線形投影）だけをシェーダで補う最小限の拡張とする。

[Answer]: A

### Q2. `ModeContext` の拡張要否（シェーダベースモードのテクスチャアクセス）

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `ModeContext`（UoW-A で確定済み、`camera`/`scene`/`sphereMesh`）に `texture: Texture \| null` を追加する | シェーダベースモードは `ShaderMaterial` 構築時にテクスチャをユニフォームとして渡す必要があるが、現状の `ModeContext` はテクスチャへの参照を持たない。`sphereMesh.material` 経由で間接的に取得することも可能だが、`Renderer` のマテリアル実装詳細（`MeshBasicMaterial` か `ShaderMaterial` か）にモードが依存してしまう。`ModeContext` に直接持たせる方が疎結合 |
| B | `sphereMesh.material` から現在のマテリアルの `map` プロパティを読み取る（`ModeContext` は拡張しない） | `MeshBasicMaterial` を前提にした実装になり、モード切替後に別のモードが `ShaderMaterial` へ差し替えていた場合に `map` が存在せず破綻する。`Renderer` の内部実装詳細への依存が生じる |

**採用理由**: モードが `Renderer` の内部マテリアル実装に依存しない疎結合を保つため。

[Answer]: A

### Q3. モード切替時のマテリアル管理

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `Renderer` に `setSphereMaterial(material: Material): void` を追加する。シェーダベースモードの `apply(ctx)` はこのメソッド経由で自身の `ShaderMaterial` を設定し、`dispose(ctx)` で `setSphereMaterial` を呼んで既定の `MeshBasicMaterial` へ戻す（テクスチャは `ctx.texture` から引き継ぐ） | UoW-B の `setSphereTexture` と同じ設計思想（`Renderer` がカプセル化を維持しつつ、必要な差し替え操作だけを公開メソッドとして提供）を踏襲できる |
| B | 各モードが `ctx.sphereMesh.material` を直接書き換える | `Renderer` のカプセル化を破る（UoW-A/UoW-B で一貫して避けてきた設計、Q7=A 系の既存判断と矛盾） |

**採用理由**: UoW-A/UoW-B で確立した `Renderer` カプセル化の一貫性を維持する。

[Answer]: A

### Q4. Crystal Ball の具体的な実装方式

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | カメラを球の中心から外側（例: 半径の 2〜3 倍の距離）へ移動し、球体メッシュのマテリアルの `side` を `BackSide`（内側から見える、他モード共通）から `FrontSide`（外側から見える）に切り替える | 既存の球体ジオメトリ・テクスチャをそのまま再利用でき、three.js 標準機能（カメラ位置・マテリアルの `side` プロパティ）のみで実現できる。実装コストが小さい |
| B | 球体メッシュとは別に、専用の縮小版メッシュを新規生成して重ねる | 既存メッシュを再利用できず、ジオメトリ・テクスチャの二重管理が発生する。A で同じ視覚効果が得られるため過剰 |

**採用理由**: 既存資産の再利用性と実装コストの低さ。

[Answer]: A

### Q5. Dewarp・Panini・Tiny Planet の投影数式の厳密さ

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 視覚的にモード名の特性（US-07/US-08 の受け入れ基準）を満たす一般的な近似式を採用する（学術的に完全に正確な光学レンズモデルの再現は目指さない） | 受け入れ基準は「当該投影の見た目特性を満たす」という定性的な表現であり、光学的完全性までは要求していない。過剰な精度追求は本ユニットのスコープを超える（YAGNI） |
| B | 各投影の学術的定義（Panini 投影の正確な数式等）を厳密に実装する | 実装・検証コストが大幅に増える。受け入れ基準を超える精度への投資であり本ユニットのスコープに見合わない |

**採用理由**: 受け入れ基準（見た目特性を満たすこと）に対して過不足のない実装コストとする。

[Answer]: A

### Q6. `ModeRegistry` の API 形状

`component-methods.md` は `ModeRegistry` の具体的なメソッドシグネチャを定義していない（IF 形のみ確定、Q5=D）。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `register(mode: ViewerMode): void` / `get(id: string): ViewerMode \| undefined` / `has(id: string): boolean` のシンプルな Map ベース登録簿とする。同梱 6 モードは `createViewer` 内で `ModeRegistry` 構築時に自動登録される | US-12 の要求（同梱モードも同じ登録機構の上に実装）を満たす最小限の設計。`UoW-B` の `registerSource`（配列ベース、優先順位あり）とは異なり、モードは `id` で一意に選択されるため優先順位の概念が不要（`Map` で十分） |
| B | UoW-B の `registerSource` と同様、配列 + `canHandle` 相当の判定関数を持たせる | モード選択は `setMode(id)` による明示指定であり、`ImageSourceAdapter` のような「どれが対応できるか自動判定」という要件がない。過剰設計 |

**採用理由**: モード選択は ID 指定という明確な要求（US-10）であり、`Map` ベースの登録簿で十分。

[Answer]: A

## 比較検討サマリ

判断軸: (1) UoW-A/UoW-B で確立済みのアーキテクチャ（`Renderer` カプセル化、モード IF）との一貫性、(2) 技術的に実現可能な範囲での最小限の拡張（透視投影カメラでは表現不可能な投影のみシェーダを導入）、(3) 受け入れ基準（見た目特性を満たす）に対して過不足のない実装コスト、(4) YAGNI。

## 次のステップ（Step 6: 成果物生成、承認後）

- `aidlc-docs/construction/uow-c/functional-design/domain-entities.md`
- `aidlc-docs/construction/uow-c/functional-design/business-rules.md`
- `aidlc-docs/construction/uow-c/functional-design/business-logic-model.md`
