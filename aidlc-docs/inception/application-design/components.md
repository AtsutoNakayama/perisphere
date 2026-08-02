# Components — perisphere（コンポーネント定義・責務・公開インターフェース）

- **関連 Issue**: [#21](https://github.com/AtsutoNakayama/perisphere/issues/21)
- **作成日**: 2026-06-29
- **設計方針**: 単一コア `@perisphere/core`（Q1=A）／公開 API はファクトリ関数 `createViewer`（Q2=B）／コアは型付き Emitter・React アダプタが props ブリッジ（Q3=C）／拡張はインスタンス単位登録（Q4=A）／投影実装は抽象 IF のみ・具体は Functional Design（Q5=D）／プレーン状態 + イベント（Q6=A）／薄い React ラッパ（Q7=A）／素 DOM の同梱 UI（Q8=A）
- **前提資料**: `requirements.md`、`stories.md`、`application-design-plan.md`

> 本ステージは**高レベルの責務と公開インターフェース**の確定が目的。投影数式・状態遷移の詳細は Construction の Functional Design（ユニットごと）で扱う。

## パッケージ構成

| パッケージ | 役割 | 公開 |
|---|---|---|
| `@perisphere/core` | フレームワーク非依存のビューワー本体・レンダリング・投影・入力・ギャラリー・素 DOM の同梱 UI・拡張点 | `createViewer` 他（単一エントリ / Q1=A） |
| `@perisphere/react` | React コンポーネント／フック／ref 命令ハンドル（コアの薄いラッパ） | `Perisphere`、`usePerisphere` 他 |

## コンポーネント一覧

| # | コンポーネント | 所属 | 種別 | 主な責務 | 主トレース |
|---|---|---|---|---|---|
| C1 | `ViewerHandle` | core | 公開 IF | `createViewer` が返す操作ハンドル（ファサード）。命令 API・イベント購読・破棄を集約 | FR-04,10,11,17,18 / US-31 |
| C2 | `Viewer`（内部オーケストレータ） | core | 内部 | 各サブシステムの結線・初期化順序・ライフサイクル統括 | NFR-03,05 |
| C3 | `Renderer` | core | 内部 | three.js の Scene/Camera/WebGLRenderer 管理、描画ループ、WebGL コンテキストロスト検出・復帰 | NFR-01,11 / US-37 |
| C4 | `ImageSourceAdapter`（IF）+ `EquirectangularSource` | core | 公開 IF + 実装 | 画像ソース解釈（テクスチャ生成）の交換可能抽象。初期実装は正距円筒 | FR-01,02 / US-04,05 |
| C5 | `ViewerMode`（IF）+ `ModeRegistry` | core | 公開 IF + 内部 | 投影モードの抽象 IF と**インスタンス単位**の登録簿。同梱 7 モードも同 IF 上に実装 | FR-03,04,05 / US-06〜12 |
| C6 | `ViewController` | core | 内部 | 視点状態（yaw/pitch/fov）の保持と更新、ズーム上下限クランプ・モード既定範囲 | FR-06〜09 / US-13,14,16,20 |
| C7 | `InputManager` + `InputSource`（IF） | core | 内部 + 公開 IF | ポインタ／タッチ／キーボード入力源の集約と正規化。入力デバイス拡張点 | FR-06,07,08 / NFR-02 / US-13〜19 |
| C8 | `Gallery` | core | 内部 | 写真リスト管理、`next/prev/index`、端でのループ方針、写真切替イベント | FR-11 / US-18,23 |
| C9 | `FullscreenManager` | core | 内部 | Fullscreen API 切替と非対応環境のフォールバック、状態通知 | FR-10 / US-21,22 |
| C10 | `ControlsUI`（素 DOM） | core | 内部 | フルスクリーン／ズーム／モード／写真切替＋サムネ/インジケータの同梱 UI。個別表示・スタイル・ヘッドレス・文言/aria 差し替え | FR-12,14,15 / NFR-04 / US-24,26,27 |
| C11 | `EventBus`（型付き Emitter） | core | 内部 | FR-17 の全イベントの型付き購読/発火。`on/off/once` | FR-17 / US-29 |
| C12 | `ViewerState` | core | 内部 | モード・視点・写真 index・フルスクリーン・ロード状態のプレーン保持。変更時に EventBus へ発火（Q6=A） | FR-17 / NFR-05 |
| C13 | `Loader` | core | 内部 | 画像取得・デコード、公開入力の検証（型/範囲/形式）、進行/エラー、CORS | FR-01,03 / NFR-10 / US-03,32 |
| C14 | `ErrorManager` | core | 内部 | エラー正規化、安全なフォールバック表示、内部詳細の非露出 | FR-18 / NFR-10,11 / US-30,37 |
| C15 | `Disposable`（破棄機構） | core | 横断 | WebGL コンテキスト・リスナー・テクスチャの確実な解放 | NFR-10 / US-31 |
| C16 | `Perisphere`（React コンポーネント） | react | 公開 | props→options、イベント→props コールバック、ref→命令ハンドルの薄いラッパ | FR-16 / US-28 |
| C17 | `usePerisphere`（フック） | react | 公開 | ref/ハンドル取得と生成/破棄ライフサイクルの補助 | FR-16 / US-28 |
| C18 | `PerisphereHandle`（ref 型） | react | 公開 IF | ref 経由で公開する命令 API（`ViewerHandle` の部分集合） | FR-16 / US-28 |

## コンポーネント詳細

### C1 `ViewerHandle`（公開ファサード / Q2=B）

- **目的**: 利用者が触れる唯一の操作面。内部実装（C2 以降）は隠蔽し、契約（インターフェース）だけを公開。
- **責務**: 命令 API（モード切替・写真切替・フルスクリーン・破棄）の委譲、イベント購読（`on/off/once`）、現在状態の読み取り。
- **公開 IF**: メソッドシグネチャは `component-methods.md` 参照。

### C3 `Renderer`

- **責務**: three.js リソース（Scene/Camera/WebGLRenderer/Mesh/Texture）の生成・更新・破棄、`requestAnimationFrame` ループ、`webglcontextlost`/`webglcontextrestored` のハンドリングと復帰試行（US-37）。
- **境界**: 投影の「数式」は持たず、適用された `ViewerMode`（C5）の指示に従って描画する（Q5=D の抽象境界）。

### C4 `ImageSourceAdapter`（IF）/ `EquirectangularSource`

- **責務**: 入力（URL/画像データ）を解釈し、Renderer が使えるテクスチャ＋メタ（投影種別ヒント等）へ変換する交換可能抽象。コア改修なしに将来ソース（キューブマップ・動画等）を追加可能にする拡張点（FR-02）。
- **登録**: インスタンス単位（Q4=A）。初期実装の正距円筒も同 IF 上。

### C5 `ViewerMode`（IF）/ `ModeRegistry`

- **責務**: 「球面→画面」の投影プリセットを表す抽象 IF（適用・更新・破棄のフック）と、その**インスタンス単位**の登録簿。同梱 7 モードも同 IF 上に実装し拡張機構の実用性を担保（FR-05）。
- **本ステージのスコープ**: IF 形だけ確定。具体実装方式（シェーダ/カメラ/ハイブリッド）は Functional Design で決定（Q5=D）。

### C7 `InputManager` / `InputSource`（IF）

- **責務**: 複数の入力源（Pointer/Touch/Keyboard、将来ジャイロ等）を共通 IF で集約し、視点操作の意図（pan/tilt/zoom/写真送り）へ正規化して `ViewController`（C6）へ渡す。キーマップ変更・無効化（FR-08/US-19）。
- **拡張点**: 入力デバイスを追加可能（NFR-02）。

### C10 `ControlsUI`（素 DOM / Q8=A）

- **責務**: バニラ DOM + CSS による同梱コントロール。React 等に非依存でヘッドレス利用可（FR-14）。個別の表示/非表示、スタイル、文言・aria-label 差し替え（FR-15）、フォーカス管理（NFR-04）。
- **購読**: `EventBus` の内部購読者として状態を反映（Q3=C のコア側 Emitter を利用）。

### C16〜C18 React アダプタ（薄いラッパ / Q7=A）

- **責務**: `useEffect` でクライアントマウント後にのみ `createViewer` を呼び（NFR-03 SSR セーフ）、unmount で `dispose`。props の `onXxx` をコアの `on(...)` へブリッジ（Q3=C）、`ref` に `PerisphereHandle` を公開。
- **境界**: 機能の再実装はせず、コアの `ViewerHandle` へ委譲するのみ。
