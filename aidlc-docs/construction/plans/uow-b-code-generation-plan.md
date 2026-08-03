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

- [x] 2-1. `packages/core/src/loader/types.ts`（新規）— `ImageInput`（E1）、`ImageSourceAdapter` IF（E2）、`SourceContext`（E4）、`SourceResult`（E5）、`DecodedImage`（E7）
- [x] 2-2. `packages/core/src/loader/Loader.ts`（新規）— `validate`（BR-B-03）、`load`（fetch/直接 → `createImageBitmap`、BR-B-06）、進行通知のスロットリング（PP-B-1、最低 50ms 間隔 + 完了時は必ず発火）、`AbortSignal` 対応
- [x] 2-3. `packages/core/src/loader/EquirectangularSource.ts`（新規）— `ImageSourceAdapter` 実装。`canHandle`（BR-B-02）、`createTexture`（アスペクト比検証 BR-B-04 → `maxTextureSize` 検証 BR-B-05 → `THREE.Texture` 生成）、`dispose`
- [x] 2-4. `packages/core/src/viewer/types.ts`（既存修正）— `ViewerEventMap` に `progress` 追加、`ViewerState` に `imageLoadState`（E8）追加、`ViewerHandle` に `loadImage`/`registerSource` 追加（`loader/types.ts` の型を import）
- [x] 2-5. `packages/core/src/viewer/Renderer.ts`（既存修正）— `setSphereTexture(texture: Texture | null): void` を追加。加えて計画時点で未検討だった論点として、コンテキストロスト復帰時（`rebuild()`）に球体メッシュが再生成されプレースホルダに戻る問題に対応するため `maxTextureSize` getter も追加（レビュー対象、下記「計画からの逸脱」参照）
- [x] 2-6. `packages/core/src/viewer/createViewer.ts`（既存修正）— アダプタ一覧（既定 `EquirectangularSource` + `registerSource` で先頭に追加、BR-B-02）、`loadImage` 実装（中断ロジック・検証パイプライン起動・成功/失敗パス・`imageLoadState` 更新・`Promise` resolve/reject、BR-B-01〜16）、`registerSource` 実装、`dispose()` 解体順序への現在の `SourceResult` 解放組み込み（BR-B-16）、コンテキストロスト復帰時の現在テクスチャ再適用（`onRebuildSucceeded` 内、レビュー対象）
- [x] 2-7. `packages/core/src/index.ts`（既存修正）— 新規公開型（`ImageInput`/`ImageSourceAdapter`/`SourceContext`/`SourceResult`/`ImageProgressEvent`）を re-export に追加

**計画からの逸脱（レビュー対象）**: NFR Design では「コンテキストロスト復帰」は UoW-A のスコープとして扱われ、UoW-B の計画時点では言及していなかったが、実装時に「復帰時に `Renderer.rebuild()` が球体メッシュを再生成し、表示中の画像テクスチャがプレースホルダに戻ってしまう」という UoW-A と UoW-B の境界にまたがる回帰を発見した。`Renderer` の `onRebuildSucceeded` コールバックで現在のテクスチャを再適用するよう `createViewer.ts` を修正して対応した。

## Step 3: Business Logic Unit Testing

`tech-stack-decisions.md`（UoW-A 継承分 + UoW-B §1〜3）に基づく。

- [x] 3-1. `packages/core/src/loader/__tests__/Loader.test.ts` — `validate` の形式検証、`fetch` を `vi.fn()` でモックした `load`（成功/404/ネットワーク失敗/中断/デコード失敗）、`progress` スロットリング（例示ベース。PBT対象はNFR Requirements Q3でアスペクト比境界値と多重呼び出しキャンセルの2件に確定済みのため、スロットリングは例示ベースとした）
- [x] 3-2. `packages/core/src/loader/__tests__/EquirectangularSource.test.ts` — `canHandle` の判定、アスペクト比検証（fast-check: 2:1 ± 0.5% の境界値）、`maxTextureSize` 超過時の拒否、正常系のテクスチャ生成、dispose
- [x] 3-3. `packages/core/src/viewer/__tests__/Renderer.test.ts`（新規）— `Renderer` 本体は WebGLRenderer の実構築を要し jsdom では生成不能なため、`setSphereTexture` の実体を `applySphereTexture` 純粋関数として切り出し直接検証（レビュー対象、下記「計画からの逸脱」参照）
- [x] 3-4. `packages/core/src/viewer/__tests__/createViewer.loadImage.test.ts`（新規、既存 `createViewer.test.ts` は変更しない）— `Renderer`/`Loader` を境界としてモック化（`EquirectangularSource` は実装のまま使用）。成功パス、`INVALID_INPUT`/`IMAGE_LOAD_FAILED` パスと直前表示維持（BR-B-11）、多重呼び出し時のキャンセル（例示 + fast-check: 任意回数連続呼び出しで最後のみ成功する不変条件、BR-B-08）、`registerSource` 優先順位、縮退ハンドルでの即時 reject（BR-B-13）、dispose 後の no-op（BR-B-14）、dispose 時のテクスチャ解放（BR-B-16）、コンテキストロスト復帰時のテクスチャ再適用

**計画からの逸脱（レビュー対象）**: 3-3 は計画時点で「three.js 実オブジェクトを使用、WebGL 不要」としていたが、実際には `Renderer` のコンストラクタが `THREE.WebGLRenderer` を構築するため jsdom では `Renderer` を直接インスタンス化できないことが判明した（UoW-A の `tech-stack-decisions.md` §5 で `Renderer` 全体をモック境界とする方針を確認済みだったことと整合）。`setSphereTexture` のロジックを `applySphereTexture` という独立した純粋関数として `Renderer.ts` から切り出し、`MeshBasicMaterial`（WebGL 不要）に対して直接テストする形に変更した。

## Step 4: Business Logic Summary

- [x] 4-1. `aidlc-docs/construction/uow-b/code/code-summary.md` — 生成/修正ファイル一覧、ストーリートレーサビリティ、既知の制約（キューブマップ等の追加フォーマット未対応・EXIF 回転情報は無視 等）をまとめる

## Step 5: Documentation Generation（最小限・API リファレンス本体は UoW-I）

- [x] 5-1. 新規公開 API（`loadImage`, `registerSource`, `ImageSourceAdapter`, `ImageInput`, `SourceContext`, `SourceResult`, `ImageProgressEvent`）に TSDoc コメントを付与する（Step 2 実装時点で付与済みであることを確認）

## Step 6: Deployment Artifacts Generation

**該当なし（スキップ）**。`infrastructure-design.md` で確認済みの通り、CI/Dependabot への変更は不要。

## Step 7: ビルド・テストの実行確認

- [x] 7-1. `pnpm -r build` を実行し型エラー・ビルドエラーがないことを確認
- [x] 7-2. `pnpm -r test` を実行し全テスト（UoW-A の既存 32 件 + UoW-B 新規分）が green であることを確認
- [x] 7-3. `pnpm -r lint` を実行し lint エラーがないことを確認
- [x] 7-4. `pnpm audit --prod` で既知の脆弱性がないことを確認
- [x] 7-5. 問題が見つかった場合は該当コードを修正し、7-1〜7-4 を再実行する

**実行結果**: build green（tsup ESM + `.d.ts` 生成成功、`exactOptionalPropertyTypes` 対応のため `progress` イベント構築をスプレッド構文に修正）/ test green（9 ファイル・66 テスト全て pass、UoW-A の既存 32 件を含め回帰なし）/ lint green（ESLint・Prettier とも問題なし）/ `pnpm audit --prod` 既知の脆弱性なし。

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
