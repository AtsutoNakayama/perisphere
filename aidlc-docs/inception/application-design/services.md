# Services — perisphere（サービス定義・責務・オーケストレーション）

- **関連 Issue**: [#21](https://github.com/AtsutoNakayama/perisphere/issues/21)
- **作成日**: 2026-06-29
- **注記**: ここでの「サービス」は稼働サーバーではなく、**コア内部のオーケストレーション層**（コンポーネント間の協調を担う論理的なまとまり）を指す。perisphere は稼働サービス・永続ストアを持たない（NFR-11）。

## サービス一覧

| サービス | 担当コンポーネント | 責務 |
|---|---|---|
| S1 `ViewerService` | C2 Viewer 内のオーケストレータ | ライフサイクル統括。初期化順序の制御（SSR セーフ）、全サブシステムの結線、モード/写真切替の調停、破棄 |
| S2 `LoadingService` | C13 Loader + C4 ImageSourceAdapter + C3 Renderer | 入力検証→取得/デコード→テクスチャ生成→Renderer へ反映。進行/エラーイベント発火 |
| S3 `InteractionService` | C7 InputManager + C6 ViewController + C3 Renderer | 入力意図（InputIntent）を視点状態更新へ写像し、再描画をスケジュール |
| S4 `PresentationService` | C5 ModeRegistry/ViewerMode + C3 Renderer | 現在モードを毎フレーム適用して描画。モード切替時の差し替え |
| S5 `NavigationService` | C8 Gallery + S2 LoadingService | 写真の前後/インデックス移動と、対象写真のロード起動・写真切替イベント |
| S6 `PresentationControlService` | C9 FullscreenManager + C10 ControlsUI | フルスクリーン切替・フォールバック、同梱 UI の状態反映と操作受付 |
| S7 `DiagnosticsService` | C14 ErrorManager + C11 EventBus | エラー正規化、安全なフォールバック表示、コンテキストロスト復帰の調停 |

## オーケストレーションパターン

### 初期化（SSR セーフ / NFR-03・US-34）

1. `createViewer(container, options)` 呼び出し（**クライアントのみ**。module import 時はブラウザ API に触れない）。
2. `ViewerService` が WebGL2 能力を確認 → 不可なら `DiagnosticsService` 経由で `error(WEBGL_UNSUPPORTED)` ＋フォールバック（処理中断、例外を投げず安全に縮退）。
3. `Renderer` 初期化 → 既定 `ViewerMode`（standard）登録・適用 → 入力源（Pointer/Touch/Keyboard）アタッチ → 同梱 UI 構築（有効時）。
4. `options.image` があれば `LoadingService` を起動。完了で `ready` 発火。

### モード切替（FR-04 / US-10）

`ViewerHandle.setMode` → `ViewerService` が `ModeRegistry` から対象 `ViewerMode` を取得 → 旧モード `dispose` → 新モード `apply` → `ViewerState` 更新 → `modechange` 発火。即時切替（将来のアニメは options 拡張余地）。

### 画像/写真ロード（FR-01,11 / US-01,03,18,23）

`loadImage`/`next`/`prev`/`goTo` → `NavigationService`/`LoadingService` が適切な `ImageSourceAdapter.canHandle` を選択 → `Loader.validate`（不正は `INVALID_INPUT`）→ 取得/デコード（`progress` 発火）→ テクスチャ生成 → `Renderer` 反映 → `photochange` 発火。失敗は `DiagnosticsService` で `error` ＋フォールバック（US-30/37）。

### 入力→視点（FR-06〜09 / US-13〜20）

`InputSource` が `InputIntent` を emit → `InteractionService` が `ViewController` の `ViewState` を更新（ズーム上下限クランプ）→ 次フレームで `PresentationService` が再描画 → 必要に応じ `viewchange`/`zoomchange` 発火（高頻度・スロットリングは Functional Design）。

### コンテキストロスト復帰（NFR-11 / US-37）

`Renderer` が `webglcontextlost` を捕捉 → `DiagnosticsService` が描画停止・`error(CONTEXT_LOST)` 通知 → `webglcontextrestored` でリソース再構築を試行、不能ならフォールバック表示維持。

### 破棄（US-31 / SECURITY-15）

`dispose()` → `ViewerService` が逆順に解体: 入力源 detach → UI 破棄 → モード/ソース `dispose`（テクスチャ解放）→ Renderer 破棄（WebGL コンテキスト解放）→ `EventBus.clear`。冪等（多重呼び出し安全）。

## サービス境界の原則

- **コアは外部ランタイム依存を持たない**（Q6=A / NFR-06）。状態はプレーンオブジェクト、変更通知は `EventBus` 経由。
- **拡張点はインスタンス単位**（Q4=A）。サービスはグローバル状態を持たず、各 `Viewer` インスタンスに閉じる。
- **React アダプタはサービスを再実装しない**（Q7=A）。`ViewerHandle` 経由で上記サービス群を呼ぶだけ。
