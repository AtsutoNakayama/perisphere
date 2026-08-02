# Application Design（統合版）— perisphere

- **関連 Issue**: [#21](https://github.com/AtsutoNakayama/perisphere/issues/21)
- **作成日**: 2026-06-29
- **ステータス**: レビュー待ち（Application Design 成果物）
- **構成文書**: [`components.md`](./components.md) / [`component-methods.md`](./component-methods.md) / [`services.md`](./services.md) / [`component-dependency.md`](./component-dependency.md)
- **前提**: `inception/requirements/requirements.md`、`inception/user-stories/stories.md`、`inception/plans/application-design-plan.md`

## 1. 設計方針サマリー（確定回答 Q1〜Q8）

| # | 決定 | 影響 |
|---|---|---|
| Q1=A | 単一コア `@perisphere/core`（単一エントリ） | 物理パッケージは core + react の 2 つ。機能は core 内部モジュール |
| Q2=B | 公開 API はファクトリ関数 `createViewer` | 内部クラス非公開。契約は `ViewerHandle` IF。後方互換・tree-shaking に有利 |
| Q3=C | コアは型付き Emitter、React は props ブリッジ | 多購読者・拡張に強い + React の DX を両立 |
| Q4=A | 拡張はインスタンス単位登録 | グローバル副作用なし。`viewer.registerMode/Source/InputSource` |
| Q5=D | 投影実装は Functional Design で決定 | 本ステージは `ViewerMode` を抽象 IF として形だけ確定 |
| Q6=A | プレーン状態 + イベント | 外部状態ライブラリ非依存（NFR-06） |
| Q7=A | 薄い React ラッパ | アダプタはコア `ViewerHandle` へ委譲のみ |
| Q8=A | 素 DOM の同梱 UI | ヘッドレス・任意フレームワークから利用可（FR-14） |

## 2. アーキテクチャ概観

```text
┌───────────────────────────── @perisphere/react ─────────────────────────────┐
│  <Perisphere>(C16) / usePerisphere(C17) / PerisphereHandle(C18)              │
│      └─ 薄いラッパ: props→options, event→callback, ref→命令ハンドル(Q7=A)     │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                     │ depends only on ViewerHandle (一方向)
┌───────────────────────────── @perisphere/core ──────────────────────────────┐
│  createViewer() → ViewerHandle (C1, 公開ファサード / Q2=B)                    │
│  ┌──────────────── Viewer / ViewerService (C2, オーケストレータ) ──────────┐ │
│  │  Renderer(C3)  ImageSourceAdapter(C4)*  ViewerMode/ModeRegistry(C5)*    │ │
│  │  ViewController(C6)  InputManager/InputSource(C7)*  Gallery(C8)         │ │
│  │  FullscreenManager(C9)  ControlsUI[素DOM](C10)                          │ │
│  │  EventBus(C11)  ViewerState(C12)  Loader(C13)  ErrorManager(C14)        │ │
│  │  Disposable(C15, 横断)                       (* = 公開拡張点 / Q4=A)     │ │
│  └─────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
```

詳細なコンポーネント責務は `components.md`、メソッドは `component-methods.md`、サービス協調は `services.md`、依存関係・データフローは `component-dependency.md` を参照。

## 3. 公開インターフェースの要点

- **生成/破棄**: `createViewer(container, options): ViewerHandle` → `dispose()`（クライアントのみ・冪等 / NFR-03・US-31）。
- **拡張点（公開 IF・インスタンス単位）**: `ImageSourceAdapter`（入力フォーマット）/ `ViewerMode`（投影）/ `InputSource`（入力デバイス）。同梱の正距円筒・7 モードも同 IF 上に実装（FR-02/05）。
- **イベント（型付き）**: `ready/progress/error/viewchange/zoomchange/modechange/photochange/fullscreenchange`（FR-17）。

## 4. トレーサビリティ（要件 / ストーリー → コンポーネント・サービス）

| 要件 | 主担当 | ストーリー |
|---|---|---|
| FR-01 画像表示 | C4,C13,C3 / S2 | US-01,02,03 |
| FR-02 入力拡張 | C4 / S2 | US-04,05 |
| FR-03 7 モード | C5,C3 / S4 | US-06〜09 |
| FR-04 モード切替 API | C1,C5 / S1 | US-10,11 |
| FR-05 カスタムモード | C5(ModeRegistry) | US-12 |
| FR-06 ポインタ操作 | C7,C6 / S3 | US-13,14 |
| FR-07 タッチ操作 | C7,C6 / S3 | US-15,16 |
| FR-08 キーボード/写真送り | C7,C8 / S3,S5 | US-17,18,19 |
| FR-09 ズーム範囲 | C6 | US-14,16,20 |
| FR-10 フルスクリーン | C9 / S6 | US-21,22 |
| FR-11 ギャラリー API | C8 / S5 | US-23 |
| FR-12 ギャラリー UI | C10 | US-24 |
| FR-13 ツアー拡張点 | C5/C8 の拡張点（将来） | US-25 |
| FR-14 コントロール UI | C10 / S6 | US-26 |
| FR-15 文言差し替え | C10 | US-27 |
| FR-16 React アダプタ | C16,C17,C18 | US-28 |
| FR-17 イベント API | C11 | US-29 |
| FR-18 エラー/フォールバック | C14 / S7 | US-30,37 |
| NFR-01 性能 | C3,C6 | US-36 |
| NFR-03 SSR セーフ | C2,C16 / S1 | US-34 |
| NFR-04 アクセシビリティ | C7,C10 | US-35 |
| NFR-05 拡張性/アーキ | C1,C4,C5,C7 / 全体 | US-33 |
| NFR-10 セキュリティ | C13,C14,C15 | US-30,31,32 |
| NFR-11 レジリエンシー | C3,C14 / S7 | US-30,37 |

> FR-13（バーチャルツアー）は初期スコープ外。C5/C8 と将来のオーバーレイ拡張点で対応可能な構造を確保（実装は後続）。NFR-02/06/07/08/09/12 は配布・運用・テスト方針であり、Construction（NFR Requirements / NFR Design / Build and Test）で扱う。

## 5. 拡張ルール・コンプライアンス要約（Application Design 段階）

凡例: 反映 = 本設計で対応 / N/A = 本ステージ非該当（理由付き） / 後続 = 該当ステージで対応

### Security Baseline（有効）

| ルール | 状態 | 設計上の反映 |
|---|---|---|
| SECURITY-05 入力検証 | 反映 | `Loader.validate`（C13）で型/範囲/形式検証、不正は `INVALID_INPUT`（US-32） |
| SECURITY-09 ハードニング | 反映 | `PerisphereError` は内部詳細を含めない（C14 / FR-18） |
| SECURITY-11 セキュア設計 | 反映 | 誤用ケース（不正 URL・巨大画像・悪意ある寸法）を C13/C14 で安全に縮退 |
| SECURITY-15 例外/フェイルセーフ | 反映 | `Disposable`(C15) で確実な解放、`dispose` 冪等（US-31） |
| SECURITY-10/13 サプライチェーン/整合性 | 後続 | CI・lockfile・依存スキャンは NFR Design / Build and Test |
| その他（01〜04,06〜08,12,14） | N/A | データストア・サーバー・認証・ネットワークを持たない（要件付録 A と一致） |

### Resiliency Baseline（有効）

| ルール | 状態 | 設計上の反映 |
|---|---|---|
| RESILIENCY-10 依存分離・縮退 | 反映 | ロード失敗・コンテキストロストを `ErrorManager`(C14)/`Renderer`(C3) で巻き込まず縮退（US-37） |
| RESILIENCY-02/03 可用性/変更管理 | 反映/後続 | RTO/RPO=N/A（要件確定）、リリース様式は NFR Design |
| RESILIENCY-04/14/15 デプロイ/テスト/インシデント | 後続 | NFR Design / Build and Test |
| RESILIENCY-05〜09,11〜13 | N/A | 稼働サービス・永続状態なし |

### Property-Based Testing（全面適用）

| ルール | 状態 | 設計上の反映 |
|---|---|---|
| PBT-01 プロパティ特定 | 後続 | 主候補を本設計で明示: 投影変換（C5）の往復/不変条件、`ViewController`(C6) のズームクランプ、`Gallery`(C8) の index 遷移、`EventBus`(C11) の購読/解除整合。確定は Functional Design |
| PBT-02〜10 | 後続 | フレームワーク選定は NFR Requirements、適用は Code Generation / Build and Test |

### 命名ポリシー（恒常）

- 公開 API・モード名は一般的な投影用語または中立名のみ（standard/ultraWide/dewarp/linear/panini/tinyPlanet/crystalBall）。第三者の商標・製品名を使用しない（要件 7 章・メモリ方針に準拠）。

## 6. 本ステージのスコープ外（Construction で確定）

- 投影モードの実装方式（シェーダ/カメラ/ハイブリッド）— Q5=D により Functional Design。
- 視点・FOV の単位、ズームクランプ計算、`viewchange` のスロットリング、ギャラリー端のループ方針 — Functional Design。
- 技術スタック詳細（three.js バージョン範囲、ビルド/バンドラ、PBT フレームワーク）— NFR Requirements。
- リリース/配布パイプライン、デモ静的ホスティング — NFR Design / Infrastructure Design（minimal）。
