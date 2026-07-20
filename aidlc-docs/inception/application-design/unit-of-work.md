# Unit of Work — perisphere（ユニット定義・責務・コード構成戦略）

- **関連 Issue**: [#21](https://github.com/AtsutoNakayama/perisphere/issues/21)
- **作成日**: 2026-07-20
- **決定方針**: `plans/unit-of-work-plan.md`（Q1=A 機能ドメイン単位で細分化 ／ Q2=A ワークスペース構成 ／ Q3=A パッケージマネージャは Construction で確定 ／ Q4=A Future 専用ユニットに隔離 ／ Q5=A 原則 1 unit = 1 Issue = 1 PR ／ Q6=A 基盤優先＋最初の縦切りは「1 枚を標準ビューで表示」）
- **前提資料**: `application-design.md`、`components.md`、`services.md`、`component-dependency.md`、`user-stories/stories.md`

## 用語

- **Package**: 独立配布物（`@perisphere/core` / `@perisphere/react`）
- **Module**: パッケージ内の論理モジュール（ディレクトリ単位）
- **Unit of Work (UoW)**: Construction で個別に設計・実装する開発単位。後続 Issue の起票単位（Q5=A）

## ユニット一覧（サマリ）

| UoW | 名称 | 優先度 | 所属パッケージ | 主な担当コンポーネント/サービス |
|---|---|---|---|---|
| UoW-A | コア基盤 | In MVP | `@perisphere/core` | C2 Viewer, C3 Renderer, C11 EventBus, C12 ViewerState, C14 ErrorManager, C15 Disposable, 標準モード（Standard）の最小実装／ S1 ViewerService, S7 DiagnosticsService |
| UoW-B | 画像入力・ロード | In MVP | `@perisphere/core` | C4 ImageSourceAdapter/EquirectangularSource, C13 Loader ／ S2 LoadingService |
| UoW-B-F | 入力ソース拡張（Future） | Future | `@perisphere/core` | 追加 `ImageSourceAdapter` 実装（キューブマップ／デュアルフィッシュアイ／360°動画） |
| UoW-C | 投影モード | In MVP | `@perisphere/core` | C5 ViewerMode(IF)/ModeRegistry、標準以外の 6 モード実装 ／ S4 PresentationService |
| UoW-C-F | モード遷移演出（Future） | Future | `@perisphere/core` | モード切替 API のアニメーション遷移実装 |
| UoW-D | 視点操作・入力 | In MVP | `@perisphere/core` | C6 ViewController, C7 InputManager/InputSource(IF) ／ S3 InteractionService |
| UoW-E | ギャラリー | In MVP | `@perisphere/core` | C8 Gallery ／ S5 NavigationService |
| UoW-E-F | バーチャルツアー拡張点（Future） | Future | `@perisphere/core` | ホットスポット配置・遷移の実装 |
| UoW-F | フルスクリーン | In MVP | `@perisphere/core` | C9 FullscreenManager（S6 の一部） |
| UoW-G | 同梱コントロール UI | In MVP | `@perisphere/core` | C10 ControlsUI（S6 の一部） |
| UoW-H | React アダプタ | In MVP | `@perisphere/react` | C16 Perisphere, C17 usePerisphere, C18 PerisphereHandle |
| UoW-H-F | 他フレームワークアダプタ（Future） | Future | 新規パッケージ（例: `@perisphere/vue`） | Vue 等の追加アダプタ |
| UoW-I | ドキュメント・デモ | In MVP | `docs` / `apps/demo` | API リファレンス、全モード体験デモ、React/Next.js サンプル（NFR-08） |

**合計 13 ユニット**（In MVP 9 + Future 4）。Q1=A の機能ドメイン細分化（UoW-A〜I の 9 系統）に、Q4=A で Future ストーリーの実装分を専用ユニットとして追加したもの。

## ユニット詳細

### UoW-A コア基盤

- **責務**: ビューワーのライフサイクル統括（初期化順序・SSR セーフな起動・結線・破棄）、three.js 描画基盤、型付きイベント発火、状態保持、エラー正規化とフォールバック、リソース確実解放。**加えて、既定（標準）ビューでの描画が可能な最小限の投影適用**を含む。
- **担当**: C2 Viewer, C3 Renderer, C11 EventBus, C12 ViewerState, C14 ErrorManager, C15 Disposable ／ S1 ViewerService, S7 DiagnosticsService
- **対応ストーリー**: US-06, US-29, US-30, US-31, US-34, US-36, US-37（詳細は `unit-of-work-story-map.md`）
- **設計判断（Q6 由来）**: 「標準ビュー（C5 ViewerMode IF 上の 1 実装）」はモード拡張機構本体（UoW-C）ではなく本ユニットに含める。理由: Q6=A が最初の到達点を「1 枚を標準ビューで表示」する縦切りと定義しており、`Renderer` が動作するには最低 1 つの投影実装が要る。ModeRegistry によるモード**拡張機構**（登録・切替・残り 6 モード）は UoW-C に分離する。
- **依存**: なし（最も基盤。他の全 In MVP ユニットの前提）

### UoW-B 画像入力・ロード

- **責務**: 画像ソース解釈（テクスチャ生成）の交換可能抽象と正距円筒の初期実装、取得・デコード・検証・進行/エラー通知。
- **担当**: C4 ImageSourceAdapter(IF)/EquirectangularSource, C13 Loader ／ S2 LoadingService
- **対応ストーリー**: US-01, US-02, US-03, US-04, US-32
- **依存**: UoW-A（Renderer へのテクスチャ反映、EventBus 経由の進行/エラー通知、ErrorManager によるフォールバック）

### UoW-B-F 入力ソース拡張（Future）

- **責務**: US-05 に対応する追加 `ImageSourceAdapter` 実装（キューブマップ・デュアルフィッシュアイ・360°動画等）。拡張点自体（IF）は UoW-B で確保済みのため、本ユニットは具体実装のみを扱う。
- **対応ストーリー**: US-05
- **依存**: UoW-B（`ImageSourceAdapter` IF）、UoW-A
- **ステータス**: バックログ。着手時期未定。Q5=A に従い着手時に個別 Issue 化。

### UoW-C 投影モード

- **責務**: 投影プリセットの抽象 IF とインスタンス単位の登録簿（拡張機構）、標準以外の 6 モード（UltraWide / Dewarp / Linear / Panini / Tiny Planet / Crystal Ball）の実装、モード切替 API。
- **担当**: C5 ViewerMode(IF)/ModeRegistry（標準以外の実装） ／ S4 PresentationService
- **対応ストーリー**: US-07, US-08, US-09, US-10, US-12
- **依存**: UoW-A（Renderer へのモード適用、EventBus 経由の modechange 通知、標準モードとの IF 整合）

### UoW-C-F モード遷移演出（Future）

- **責務**: US-11 に対応するモード切替のアニメーション遷移実装。API 形状（オプション引数の拡張余地）は UoW-C で確保済み。
- **対応ストーリー**: US-11
- **依存**: UoW-C、UoW-A
- **ステータス**: バックログ。

### UoW-D 視点操作・入力

- **責務**: ポインタ／タッチ／キーボード入力の集約・正規化、視点状態（yaw/pitch/fov）の更新、ズーム上下限クランプ（モード既定範囲を含む）、キーマップ変更・無効化。
- **担当**: C6 ViewController, C7 InputManager/InputSource(IF) ／ S3 InteractionService
- **対応ストーリー**: US-13, US-14, US-15, US-16, US-17, US-18, US-19, US-20
- **依存**: UoW-A（ViewerState 更新・EventBus 通知）、UoW-C（モード既定ズーム範囲の参照）
- **備考**: US-18（矢印キーでの写真送り）はキー入力の正規化まで本ユニットの責務。実際の写真切替実行は UoW-E（Gallery）に委譲する（`Viewer` 経由の疎結合、`component-dependency.md` の通り InputManager は Gallery に直接依存しない）。

### UoW-E ギャラリー

- **責務**: 写真リスト管理、`next/prev/index`、端でのループ方針、写真切替時のロード起動と切替イベント発火。
- **担当**: C8 Gallery ／ S5 NavigationService
- **対応ストーリー**: US-23, US-24
- **依存**: UoW-A（EventBus/State）、UoW-B（対象写真のロード起動）

### UoW-E-F バーチャルツアー拡張点（Future）

- **責務**: US-25 に対応するホットスポットからの写真間遷移（バーチャルツアー）の実装。シーングラフへのオーバーレイ配置・相互作用の拡張点は UoW-E で確保。
- **対応ストーリー**: US-25
- **依存**: UoW-E、UoW-A
- **ステータス**: バックログ。

### UoW-F フルスクリーン

- **責務**: Fullscreen API 切替と非対応環境（iOS Safari 等）でのフォールバック、状態変化通知。
- **担当**: C9 FullscreenManager
- **対応ストーリー**: US-21, US-22
- **依存**: UoW-A（EventBus/State/ErrorManager）

### UoW-G 同梱コントロール UI

- **責務**: 素 DOM によるフルスクリーン／ズーム／モード／写真切替＋サムネ/インジケータの同梱 UI。個別表示・スタイル・ヘッドレス切替・文言/aria-label 差し替え、フォーカス管理。
- **担当**: C10 ControlsUI
- **対応ストーリー**: US-26, US-27, US-35
- **依存**: UoW-A（EventBus/State の購読のみ・疎結合）。機能的には UoW-C（モード名表示）・UoW-D（キーボード操作との整合／US-35）・UoW-E（写真送り）・UoW-F（フルスクリーン状態）が発火するイベントを購読して状態を反映するため、実装順としてはこれらの後（もしくは並行）が現実的（`unit-of-work-dependency.md` 参照）。

### UoW-H React アダプタ

- **責務**: `useEffect` によるクライアントマウント後の `createViewer` 呼び出しと `dispose`、props→options・イベント→props コールバックのブリッジ、ref 経由の命令ハンドル公開。
- **担当**: C16 Perisphere, C17 usePerisphere, C18 PerisphereHandle
- **対応ストーリー**: US-28, US-33（core/react 分離という MVP 範囲）
- **依存**: UoW-A（`ViewerHandle` にのみ形式的に依存。`component-dependency.md` の通りコア内部には依存しない）。ただし `ViewerHandle` が委譲する全機能（UoW-B〜G）が出揃った状態で結合検証するのが実務上合理的（Q6 の基盤優先順）。

### UoW-H-F 他フレームワークアダプタ（Future）

- **責務**: US-33 の Future 範囲（例: `@perisphere/vue` 等）。コア改修なしに新アダプタを追加できることの実証。
- **対応ストーリー**: US-33（Future 範囲）
- **依存**: UoW-H（アダプタ設計パターンの参照）、UoW-A
- **ステータス**: バックログ。着手時に新規パッケージとして追加。

### UoW-I ドキュメント・デモ

- **責務**: API リファレンス、全モード体験デモ、React/Next.js サンプルの整備（NFR-08）。
- **対応ストーリー**: なし（直接のユーザーストーリーは持たず、NFR-08 の制約に対応する成果物ユニット）
- **依存**: UoW-A〜H（`@perisphere/core` と `@perisphere/react` が使える状態が前提）

## コード構成戦略（グリーンフィールド / Q2=A）

```text
perisphere/
├── packages/
│   ├── core/                  # @perisphere/core
│   │   └── src/
│   │       ├── viewer/        # UoW-A: Viewer, Renderer, EventBus, ViewerState, ErrorManager, Disposable, 標準モード
│   │       ├── loader/        # UoW-B: Loader, ImageSourceAdapter, EquirectangularSource
│   │       │   └── sources/   # UoW-B-F（Future）: 追加 ImageSourceAdapter 実装
│   │       ├── modes/         # UoW-C: ModeRegistry, ViewerMode 実装（標準以外の6モード）
│   │       ├── interaction/   # UoW-D: InputManager, InputSource, ViewController
│   │       ├── gallery/       # UoW-E: Gallery
│   │       │   └── tour/      # UoW-E-F（Future）: バーチャルツアー実装
│   │       ├── fullscreen/    # UoW-F: FullscreenManager
│   │       └── ui/            # UoW-G: ControlsUI（素DOM）
│   ├── react/                 # @perisphere/react（UoW-H）
│   │   └── src/
│   └── vue/                   # UoW-H-F（Future）: 着手時に新規追加
├── apps/
│   └── demo/                  # UoW-I: デモサイト
├── docs/                      # UoW-I: API リファレンス
└── aidlc-docs/                # ドキュメントのみ（本ワークフロー成果物）
```

- ワークスペースツール（pnpm/npm/yarn workspaces 等）は本ステージでは確定しない。Construction の NFR Requirements（技術スタック確定）で決定する（Q3=A）。
- Future ユニット（B-F/C-F/E-F）は着手時期未定のため、着手時に対応ディレクトリを新設する（現時点で空ディレクトリは作らない）。UoW-H-F のみ新規パッケージとして追加する想定。

## ユニット↔Issue/PR 対応方針（Q5=A）

- 原則 **1 ユニット = 1 後続 Issue = 1 PR**。ブランチ名は `<type>/<issue番号>-<uow名>` の形式（`CONTRIBUTING.md` 準拠）。
- Future ユニット（B-F/C-F/E-F/H-F）はバックログとして記録するのみで、本 Issue（#21）の後続 Issue 起票対象には含めない。着手が決まった時点で個別に Issue 化する。
- In MVP 9 ユニット（A〜I）は、後続 Issue 群として `unit-of-work-dependency.md` の実装順に沿って順次起票する想定。
