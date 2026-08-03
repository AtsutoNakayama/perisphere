# NFR Design Patterns — UoW-F フルスクリーン

- **関連 Issue**: [#42](https://github.com/AtsutoNakayama/perisphere/issues/42)
- **作成日**: 2026-08-03
- **前提資料**: `uow-f-nfr-design-plan.md`（Q1〜Q3 回答・採用理由）、`construction/uow-f/functional-design/`（BR-F-08 で本ステージの発見を反映済み）

## 1. Resilience Patterns

### RP-F-1 Silent Best-Effort Cleanup（fire-and-forget 破棄処理の静かな失敗吸収）

- **問題**: `dispose()`（同期 API、`DisposeFn = () => void`）からネイティブ Fullscreen API の非同期解除（`document.exitFullscreen()`）を呼び出す際、その `Promise` が reject された場合に誰も処理しないと未処理の Promise rejection になる。
- **適用**: fire-and-forget 呼び出しに `.catch(() => {})` を付与し、reject されても静かに無視する（`business-rules.md` BR-F-08、Q1=A）。`DisposableRegistry`（UoW-A）の同期契約（`DisposeFn = () => void`）は変更しない。
- **効果**: `dispose()` 自体が「確実な解放を試みる」ことが目的であり、ブラウザ側の reject 理由を利用者に通知する意味がないため、UoW-B の `RP-B-2`（中断されたロードは `error` を発火せず静かに reject される）と同種の「関心のない失敗は握りつぶす」思想を踏襲する。

### RP-F-2 Native-Change-Event as Single Source of Truth（既存: Functional Design で確定済み）

- **問題**: ネイティブフルスクリーンの終了は `exitFullscreen()` の明示呼び出しだけでなく、Esc キーやブラウザ標準 UI からも起こりうる。
- **適用**: `document` の `fullscreenchange` イベントを状態更新の唯一の情報源とし、`enter()`/`exit()` 自身は API 呼び出しの成否判定のみ行う（`business-rules.md` BR-F-05）。
- **効果**: 自己起点・外部起点のいずれの状態変化も同じ1本のコードパスで正しく反映され、状態の二重管理・食い違いを防ぐ。

## 2. Scalability Patterns

**N/A**。`nfr-requirements.md` §1 で確認済み（クライアントサイドライブラリ）。

## 3. Performance Patterns

**新規パターンなし**。`Renderer.resize()`（`business-rules.md` BR-F-09）はフルスクリーン切替の前後で1回のみ呼ばれ、`viewchange`/`zoomchange`（UoW-D `PP-D-1 Coalesced View Change Emission`）のような高頻度イベントのスロットリングは不要（`nfr-requirements.md` Performance 判定の通り）。

## 4. Security Patterns

UoW-A〜E の Defense in Depth と同じ思想を確認したうえで、本ユニットには適用対象となる入力自体が存在しないことを明記する。

### SP-F-1 攻撃面の不在（新規パターンなし）

- **問題**: `enterFullscreen()`/`exitFullscreen()`/`isFullscreen()` への不正な入力をどう扱うか。
- **判断**: いずれも引数を取らないため、UoW-A〜E で継続してきた「公開 API の入力を境界で検証し `INVALID_INPUT` へ正規化する」パターンを適用する対象（入力）が存在しない。唯一の失敗経路（ブラウザ側の実行時拒否）は `FULLSCREEN_FAILED`（内部詳細を含まない安全なメッセージ）として既に正規化済み（BR-F-04）。未接続要素への呼び出し等も同じ経路でブラウザ自身が reject するため、追加の事前チェックは行わない（NFR Design Q2=A）。

## 5. Logical Components

### LC-F-1 新規ディレクトリ配置

- **問題**: `FullscreenManager` をどこに配置するか。
- **適用**: `packages/core/src/fullscreen/`（`FullscreenManager.ts` + `types.ts`）に新規配置する。`gallery/`/`loader/`/`modes/`/`interaction/` と同じ、ユニットごとに新規ディレクトリを切る既存パターンを踏襲する（Q3=A）。

### LC-F-2 計算ロジックの切り出し不要（YAGNI、UoW-E Q3 の判断基準を継続）

- **問題**: 擬似フルスクリーンのスタイル適用・復元、`Renderer.resize()` の計算を独立モジュールへ切り出すか。
- **判断**: いずれも呼び出し元が単一（`FullscreenManager` 自身／`Renderer` 自身）であり、UoW-C/UoW-D の切り出し（`projections/`/`viewMath.ts`）の動機である「複数呼び出し元での再利用」に該当しない。UoW-E `Gallery`（NFR Design Q3=A）と同じ判断基準により、クラスのプライベートメソッドのまま実装する（Q3=A）。

## 6. 検討したが採用しなかったパターン（Rejected Patterns）

| パターン | 不採用の理由 | 再検討の契機 |
|---|---|---|
| `DisposeFn` を非同期化し `dispose()` 完了を `await` する | `DisposableRegistry` は他の全 `Disposable`（C3/C4/C7/C9/C10/C11）が依存する共通契約であり、本ユニット1つの都合で同期→非同期化するのは影響範囲が大きすぎる過剰対応（NFR Design Q1 の裏返し） | 複数ユニットにまたがって非同期な破棄処理が本質的に必要になった場合 |
| `container` の DOM 接続チェック等の追加防御コード | 既存の失敗ハンドリング（`FULLSCREEN_FAILED`）で同じ経路により吸収されるため、防げる追加リスクがない（NFR Design Q2 の裏返し） | ブラウザの reject 理由の粒度だけでは不十分な、より詳細な事前診断が要求された場合 |
| 擬似フルスクリーンスタイル・`resize()` 計算の独立モジュール化 | 単一呼び出し元しかなく、切り出しても再利用の恩恵がない（NFR Design Q3 の裏返し） | 将来、`FullscreenManager`/`Renderer` 以外からも同じ計算を呼ぶ必要が生じた場合 |
