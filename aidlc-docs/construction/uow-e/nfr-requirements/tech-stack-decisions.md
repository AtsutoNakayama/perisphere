# Tech Stack Decisions — UoW-E ギャラリー

- **関連 Issue**: [#40](https://github.com/AtsutoNakayama/perisphere/issues/40)
- **作成日**: 2026-08-03
- **前提資料**: `uow-e-nfr-requirements-plan.md`（Q1〜Q4 回答・採用理由）
- **注記**: パッケージマネージャ・ビルドツール・テストランナー・PBT ライブラリ・Lint/フォーマッタ・TypeScript strictness・three.js peerDependencies range・ES2020 ターゲット等のモノレポ横断決定（UoW-A で確定）は変更なくそのまま適用する。本ドキュメントは UoW-E 固有の決定のみを扱う。

## 1. 写真切替時の先読み（プリロード）方針（Q1）

- **決定**: プリロードは行わない。`next()`/`prev()`/`goTo()` が呼ばれた時点で初めてロードを開始する（`loadImage()` と同じオンデマンド方式）。
- **理由**: `unit-of-work.md`/`requirements.md`（FR-11）のいずれにも先読みの要求がなく、導入すると対象の再計算タイミング・追加のメモリ保持・キャンセル制御の複雑化を伴う。将来必要になった場合も `Gallery`/`createViewer` の内部実装のみで非破壊的に追加できるため、初期リリースでは見送る。

## 2. 写真切替オーケストレーションのテスト境界（Q2）

- **決定**: `Gallery`（純粋なインデックス計算クラス）は外部依存を持たないため、モックなしでそのまま単体テストする。写真切替の共通ロード処理（`business-rules.md` BR-E-06〜09）は UoW-B で確立済みのテスト境界（`Loader` をモック境界化し `globalThis.fetch` を `vi.fn()` で直接モック）をそのまま再利用する。
- **テスト対象の分離**: `Gallery` 単体のテスト（境界値・巡回・範囲外判定）と、`createViewer` を通した写真切替の統合テスト（ロード成功/失敗・`photochange` 発火）を分けて作成する（UoW-D の `ViewController`/`createViewer.interaction.test.ts` 分離と同じパターン）。

## 3. PBT の適用対象（Q3）

- **決定**: `Gallery.next()`/`prev()`/`goTo()` を純粋関数として、fast-check（UoW-A で確定済み）による PBT の対象とする。
- **検証する不変条件**:
  - 任意の `size >= 0` と任意の操作列（`setPhotos`/`next`/`prev`/`goTo` の組み合わせ）に対し、`current` は常に `[-1, size)` の範囲に収まる（`size === 0` なら常に `-1`）
  - `next()`/`prev()` の巡回が任意の `size >= 1` で正しく閉じる（同じ操作を `size` 回繰り返すと元の index に戻る）
  - `goTo(index)` は `size > 0` かつ `index` が整数で `[0, size)` の範囲内のときのみ `{ status: "moved", index }` を返し、それ以外（`size === 0` は `"empty"`、それ以外の不正な `index` は `"out-of-range"`）を返す
- **example-based との併設**: 写真切替の成功/失敗分岐（BR-E-07/08、ロードパイプラインとの統合）はビジネスクリティカルな経路として example-based テストで個別に検証する（PBT-10）。

## 4. 新規ランタイム依存（Q4）

- **決定**: 新規ランタイム依存を追加しない。`Gallery` はインデックス計算のみを行う内部クラスであり、写真切替は UoW-B の既存ロードパイプラインをそのまま再利用するため、three.js（UoW-A から継続する peerDependency）以外の追加ライブラリは不要。
