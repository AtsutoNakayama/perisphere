# Code Summary — UoW-B 画像入力・ロード

- **関連 Issue**: [#34](https://github.com/AtsutoNakayama/perisphere/issues/34)
- **作成日**: 2026-08-03
- **単一の情報源**: `aidlc-docs/construction/plans/uow-b-code-generation-plan.md`（全 Step 完了、計画からの逸脱を記載）

## 1. 生成・修正ファイル一覧

### 1-1. 新規ファイル（`packages/core/src/loader/`）

| パス | 内容 |
|---|---|
| `types.ts` | `ImageInput`（E1）/ `DecodedImage`（E7）/ `SourceContext`（E4）/ `SourceResult`（E5）/ `ImageSourceAdapter` IF（E2） |
| `Loader.ts` | `Loader`（E6）: `validate`（BR-B-03）、`load`（fetch/直接 → `createImageBitmap`、進行通知スロットリング PP-B-1）。内部エラー型 `LoadError` も本ファイルからエクスポート |
| `EquirectangularSource.ts` | `EquirectangularSource`（E3、`ImageSourceAdapter` 実装）: `canHandle`（BR-B-02）、`createTexture`（アスペクト比検証 BR-B-04 → `maxTextureSize` 検証 BR-B-05 → `THREE.Texture` 生成）、`dispose` |

### 1-2. 既存ファイルの修正（UoW-A マージ済みコードへの拡張）

| パス | 変更内容 |
|---|---|
| `viewer/types.ts` | `ViewerEventMap` に `progress`（`ImageProgressEvent`）追加、`ViewerState` に `imageLoadState`（E8）追加、`ViewerHandle` に `loadImage`/`registerSource` 追加 |
| `viewer/Renderer.ts` | `setSphereTexture(texture: Texture \| null): void` 追加、`maxTextureSize` getter 追加。テクスチャ反映ロジックは `applySphereTexture`（純粋関数、テスト容易性のため切り出し）に実装 |
| `viewer/createViewer.ts` | アダプタ一覧（既定 `EquirectangularSource` + `registerSource` で優先登録）、`loadImage`/`registerSource` の実装、dispose 解体順序への現在テクスチャ解放の組み込み、コンテキストロスト復帰時の現在テクスチャ再適用 |
| `index.ts` | 新規公開型（`ImageInput`/`ImageSourceAdapter`/`SourceContext`/`SourceResult`/`ImageProgressEvent`）を re-export に追加 |

### 1-3. テスト（新規、既存 `createViewer.test.ts` は変更なし）

| ファイル | テスト対象 | 手法 |
|---|---|---|
| `loader/__tests__/Loader.test.ts` | `validate` の形式検証、`fetch`/`createImageBitmap` をモックした `load`（成功/404/ネットワーク失敗/中断/デコード失敗）、進行通知のスロットリング | example-based |
| `loader/__tests__/EquirectangularSource.test.ts` | `canHandle`、アスペクト比検証、`maxTextureSize` 超過拒否、正常系テクスチャ生成、dispose | example-based + fast-check（アスペクト比境界値） |
| `viewer/__tests__/Renderer.test.ts` | `applySphereTexture`（純粋関数として切り出した `setSphereTexture` の実体） | example-based |
| `viewer/__tests__/createViewer.loadImage.test.ts` | `loadImage`/`registerSource` の統合的な振る舞い（成功/失敗パス、直前表示維持、多重呼び出しキャンセル、アダプタ優先順位、縮退ハンドル、dispose 後、dispose 時のテクスチャ解放、コンテキストロスト復帰時の再適用） | example-based + fast-check（多重呼び出しキャンセルの不変条件） |

**テスト結果**: 9 ファイル・66 テスト全て pass（UoW-A の既存 32 件を含む、回帰なし）。

## 2. ストーリートレーサビリティ

| ストーリー | 対応箇所 | 状態 |
|---|---|---|
| US-01（エクイレクタングラー画像の表示） | `EquirectangularSource.createTexture`、`createViewer.ts` `loadImage` 成功パス | ✅ 実装済み |
| US-02（8K を動作保証ラインとし上限なしで読み込む） | `Loader.validate`（寸法で拒否しない）、`EquirectangularSource.createTexture`（`maxTextureSize` 検証） | ✅ 実装済み（実測での 60fps 目安検証は対象外、NFR-01 の性能保証範囲） |
| US-03（URL 指定での画像読み込み） | `ImageInput`（`string`）、`Loader.load` の fetch 経路 | ✅ 実装済み |
| US-04（入力フォーマットの拡張アダプタ） | `ImageSourceAdapter` IF の公開、`registerSource` | ✅ 実装済み |
| US-32（公開 API の入力検証） | `Loader.validate`、`EquirectangularSource` のアスペクト比検証、`INVALID_INPUT` 正規化 | ✅ 実装済み |

## 3. 既知の制約・スコープ境界（レビュー時の確認事項）

- **正距円筒のみ**: `ImageSourceAdapter` の実装は `EquirectangularSource` のみ。キューブマップ・デュアルフィッシュアイ・360°動画等は UoW-B-F（Future）の責務。
- **EXIF 回転情報は無視**: `createImageBitmap` はデフォルトで EXIF Orientation を適用しない（`imageOrientation: 'none'` 相当）。スマートフォン等で縦向き情報が付与された画像は意図と異なる向きで表示される可能性がある。本ユニットでは対応しない（要件・ストーリーに明記がないため）。UoW-B-F または独立した改善 Issue で検討可能。
- **自動リトライなし**: ネットワーク取得失敗時に自動リトライしない設計（RP-B-1）。呼び出し側が `loadImage` を再度呼ぶことで再試行できる。
- **同一 `id` のアダプタ重複登録の扱いは未規定**: `registerSource` で同じ `id` のアダプタを複数回登録した場合の上書き可否は本ユニットのスコープでは規定しない（YAGNI）。
- **`progress` イベントの発火有無は保証されない**: `Content-Length` が取得できない環境・入力（`Blob`）では `total` を伴わない `progress` のみ、または発火頻度が実装依存になる（BR-B-07）。

## 4. 計画からの主な逸脱と理由

`uow-b-code-generation-plan.md` の Step 2-5/2-6・Step 3-3 に記載（要旨）:

- **コンテキストロスト復帰時のテクスチャ再適用**: NFR Design 時点では UoW-A スコープと整理されていたコンテキストロスト復帰が、実装時に「復帰後、球体メッシュが再生成されプレースホルダに戻り、表示中の画像が消える」という UoW-A/UoW-B 境界にまたがる回帰を引き起こすことが判明。`Renderer.onRebuildSucceeded` コールバックで現在のテクスチャを再適用するよう対応。
- **`Renderer.test.ts` の実装方式変更**: `Renderer` 本体は `WebGLRenderer` の実構築を要し jsdom では生成不能なため、計画時点の想定（実オブジェクトで直接テスト）を修正し、`setSphereTexture` のロジックを `applySphereTexture` という独立した純粋関数に切り出してテストする方式に変更。

## 5. 検証結果

- `pnpm -r build`: green（tsup ESM + `.d.ts` 生成成功、`exactOptionalPropertyTypes` 対応済み）
- `pnpm -r test`: green（9 ファイル・66 テスト pass、UoW-A の既存 32 件を含む）
- `pnpm -r lint`: green（ESLint・Prettier とも問題なし）

**注記**: これは開発時点での自己検証であり、正式な Build and Test ステージ（全ユニット共通の統合検証）を代替するものではない。
