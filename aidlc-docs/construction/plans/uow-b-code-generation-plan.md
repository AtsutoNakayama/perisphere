# Code Generation Plan — UoW-B 画像入力・ロード

- **関連 Issue**: [#34](https://github.com/AtsutoNakayama/perisphere/issues/34)
- **作成日**: 2026-08-03
- **前提資料**: `construction/uow-b/functional-design/`（domain-entities.md / business-rules.md / business-logic-model.md）、`construction/uow-b/nfr-requirements/tech-stack-decisions.md`、`construction/uow-b/nfr-design/`（nfr-design-patterns.md / logical-components.md）、`construction/uow-b/infrastructure-design/`（変更不要と確認済み）

**本ファイルは Code Generation の単一の情報源（single source of truth）である。以下のステップを上から順に実行する。**

## ユニットコンテキスト

- **担当ストーリー**: US-01, US-02, US-03, US-04, US-32
- **依存ユニット**: UoW-A（マージ済み。`packages/core/src/viewer/` 一式）
- **公開インターフェースの追加**: `ViewerHandle.loadImage(input)` / `registerSource(adapter)`、公開型 `ImageInput` / `ImageSourceAdapter` / `SourceContext` / `SourceResult`
- **コード配置**: `unit-of-work.md` のコード構成戦略に従い新規ディレクトリ `packages/core/src/loader/` を作成。既存の `packages/core/src/viewer/types.ts` / `createViewer.ts` / `Renderer.ts` / `index.ts` は **新規作成ではなく既存ファイルの修正**（ブラウンフィールド的拡張。重複ファイルは作らない）

## Step 1: Project Structure Setup

**該当なし（スキップ）**。UoW-A で構築済みのワークスペース・`packages/core` 構成をそのまま使う。新規のディレクトリ作成は `packages/core/src/loader/`（Step 2 内で作成）のみ。

## Step 2: Business Logic Generation

`domain-entities.md`（E1〜E8 + 既存拡張点）・`business-rules.md`（BR-B-01〜16）・`nfr-design-patterns.md`/`logical-components.md`（L1〜L5）に基づき実装する。

- [ ] 2-1. `packages/core/src/loader/types.ts`（新規）— `ImageInput`（E1）、`ImageSourceAdapter` IF（E2）、`SourceContext`（E4）、`SourceResult`（E5）、`DecodedImage`（E7）
- [ ] 2-2. `packages/core/src/loader/Loader.ts`（新規）— `validate`（BR-B-03）、`load`（fetch/直接 → `createImageBitmap`、BR-B-06）、進行通知のスロットリング（PP-B-1、最低 50ms 間隔 + 完了時は必ず発火）、`AbortSignal` 対応
- [ ] 2-3. `packages/core/src/loader/EquirectangularSource.ts`（新規）— `ImageSourceAdapter` 実装。`canHandle`（BR-B-02）、`createTexture`（アスペクト比検証 BR-B-04 → `maxTextureSize` 検証 BR-B-05 → `THREE.Texture` 生成）、`dispose`
- [ ] 2-4. `packages/core/src/viewer/types.ts`（既存修正）— `ViewerEventMap` に `progress` 追加、`ViewerState` に `imageLoadState`（E8）追加、`ViewerHandle` に `loadImage`/`registerSource` 追加（`loader/types.ts` の型を import）
- [ ] 2-5. `packages/core/src/viewer/Renderer.ts`（既存修正）— `setSphereTexture(texture: Texture | null): void` を追加（テクスチャ適用時は `material.map` 設定 + `color` を白にリセット、`null` 時はプレースホルダ色に戻す。テクスチャの dispose 自体はこのメソッドの責務外、BR-B-09/L1）
- [ ] 2-6. `packages/core/src/viewer/createViewer.ts`（既存修正）— アダプタ一覧（既定 `EquirectangularSource` + `registerSource` で先頭に追加、BR-B-02）、`loadImage` 実装（中断ロジック L3・検証パイプライン起動・成功/失敗パス・`imageLoadState` 更新・`Promise` resolve/reject、BR-B-01〜14）、`registerSource` 実装、`dispose()` 解体順序への現在の `SourceResult` 解放組み込み（BR-B-16。既存の BR-A-11 順序: モード→Renderer→リスナー→EventBus の**前**に現在のテクスチャを解放するステップを追加）
- [ ] 2-7. `packages/core/src/index.ts`（既存修正）— 新規公開型（`ImageInput`/`ImageSourceAdapter`/`SourceContext`/`SourceResult`）を re-export に追加

## Step 3: Business Logic Unit Testing

`tech-stack-decisions.md`（UoW-A 継承分 + UoW-B §1〜3）に基づく。

- [ ] 3-1. `packages/core/src/loader/__tests__/Loader.test.ts` — `validate` の形式検証、`fetch` を `vi.fn()` でモックした `load`（成功/404/ネットワーク失敗/中断）、`progress` スロットリング（fast-check: 任意のチャンク到着間隔に対し発火間隔が 50ms 未満にならない不変条件）
- [ ] 3-2. `packages/core/src/loader/__tests__/EquirectangularSource.test.ts` — `canHandle` の判定、アスペクト比検証（fast-check: 2:1 ± 0.5% の境界値）、`maxTextureSize` 超過時の拒否、正常系のテクスチャ生成
- [ ] 3-3. `packages/core/src/viewer/__tests__/Renderer.test.ts`（新規）— `setSphereTexture` がプレースホルダ material の `map`/`color` を正しく更新すること、`null` 指定でプレースホルダ状態に戻ること（three.js 実オブジェクトを使用、WebGL 不要）
- [ ] 3-4. `packages/core/src/viewer/__tests__/createViewer.loadImage.test.ts`（新規、既存 `createViewer.test.ts` は変更しない）— `Loader`/`EquirectangularSource` を境界としてモック化。`loadImage` 成功/失敗（`INVALID_INPUT`/`IMAGE_LOAD_FAILED`）パス、失敗時に直前表示が維持されること（`Renderer.setSphereTexture` が呼ばれない、BR-B-11）、多重呼び出し時のキャンセル（fast-check: 任意回数連続呼び出しで最後の呼び出しのみ解決する不変条件、BR-B-08）、`registerSource` で登録したアダプタが既定より優先されること、縮退ハンドルでの `loadImage`（`WEBGL_UNSUPPORTED` 即時 reject）、`dispose()` 後の `loadImage`（no-op + warn）、`dispose()` 時の現在テクスチャ解放

## Step 4: Business Logic Summary

- [ ] 4-1. `aidlc-docs/construction/uow-b/code/code-summary.md` — 生成/修正ファイル一覧、ストーリートレーサビリティ、既知の制約（キューブマップ等の追加フォーマット未対応・EXIF 回転情報は無視 等）をまとめる

## Step 5: Documentation Generation（最小限・API リファレンス本体は UoW-I）

- [ ] 5-1. 新規公開 API（`loadImage`, `registerSource`, `ImageSourceAdapter`, `ImageInput`, `SourceContext`, `SourceResult`）に TSDoc コメントを付与する

## Step 6: Deployment Artifacts Generation

**該当なし（スキップ）**。`infrastructure-design.md` で確認済みの通り、CI/Dependabot への変更は不要。

## Step 7: ビルド・テストの実行確認

- [ ] 7-1. `pnpm -r build` を実行し型エラー・ビルドエラーがないことを確認
- [ ] 7-2. `pnpm -r test` を実行し全テスト（UoW-A の既存 32 件 + UoW-B 新規分）が green であることを確認
- [ ] 7-3. `pnpm -r lint` を実行し lint エラーがないことを確認
- [ ] 7-4. `pnpm audit --prod` で既知の脆弱性がないことを確認
- [ ] 7-5. 問題が見つかった場合は該当コードを修正し、7-1〜7-4 を再実行する

**注記**: Step 7 は開発時点での自己検証であり、正式な Build and Test ステージ（全ユニット共通の統合検証）を代替するものではない。

## ストーリートレーサビリティ

| ストーリー | 対応箇所 |
|---|---|
| US-01（エクイレクタングラー画像の表示） | Step 2-3（`EquirectangularSource`）、Step 2-6（`loadImage` 成功パス） |
| US-02（8K を動作保証ラインとし上限なしで読み込む） | Step 2-3（`maxTextureSize` 検証、上限拒否はしない BR-B-03） |
| US-03（URL 指定での画像読み込み） | Step 2-1/2-2（`ImageInput` に `string` URL を含む、`Loader.load` の fetch 経路） |
| US-04（入力フォーマットの拡張アダプタ） | Step 2-1（`ImageSourceAdapter` IF 公開）、Step 2-6（`registerSource`） |
| US-32（公開 API の入力検証） | Step 2-2/2-3（`validate`・アスペクト比検証）、Step 2-6（`INVALID_INPUT` 正規化） |

## 完了条件

- 上記 Step 2〜5、7 の全チェックボックスが `[x]`（Step 1・6 は該当なし）
- `pnpm -r build` / `pnpm -r test` / `pnpm -r lint` が green
- 生成コードが `business-rules.md`（BR-B-01〜16）・`nfr-design-patterns.md`・`logical-components.md` の決定と矛盾しない
- UoW-A の既存 32 テストが引き続き green（既存動作への回帰がないこと）
