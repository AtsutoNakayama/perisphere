# Functional Design Plan — UoW-B 画像入力・ロード

- **関連 Issue**: [#34](https://github.com/AtsutoNakayama/perisphere/issues/34)
- **作成日**: 2026-08-03
- **前提資料**: `inception/application-design/unit-of-work.md`（UoW-B 節）、`unit-of-work-story-map.md`、`components.md`/`component-methods.md`/`services.md`/`component-dependency.md`、`user-stories/stories.md`（US-01, US-02, US-03, US-04, US-32）、および **実際にマージ済みの UoW-A 実装**（`packages/core/src/viewer/types.ts` / `Renderer.ts` / `createViewer.ts` / `EventBus.ts` / `ErrorManager.ts` / `DisposableRegistry.ts`）

**本ファイルは Functional Design（Part 1: 計画）の単一の情報源である。**

## ユニットコンテキスト

- **責務**: 画像ソース解釈（テクスチャ生成）の交換可能抽象（`ImageSourceAdapter` IF）、正距円筒（エクイレクタングラー）の初期実装、取得・デコード・検証・進行/エラー通知
- **担当ストーリー**: US-01, US-02, US-03, US-04, US-32
- **依存ユニット**: UoW-A（`Renderer` へのテクスチャ反映、`EventBus` 経由の進行/エラー通知、`ErrorManager` によるフォールバック）
- **UoW-A との境界（BR-A-15 より）**: UoW-A の `Renderer` はプレースホルダの無地球体メッシュのみを生成する。テクスチャの実反映は本ユニットの責務。「1 枚の画像を標準ビューで表示」という最初の縦切り到達点は UoW-A + UoW-B の組み合わせで完成する。
- **既存コードへの影響（重要）**: 本ユニットは UoW-A がマージ済みの `packages/core/src/viewer/` を**拡張**する。以下は新規作成ではなく既存ファイルの修正になる:
  - `types.ts`: `ViewerEventMap` に `progress` を追加、`ViewerHandle` に `loadImage`/`registerSource` を追加、`ViewerState` に画像ロード状態フィールドを追加
  - `createViewer.ts`: 上記メソッドの実装を追加
  - `Renderer.ts`: テクスチャ反映用の新規メソッド追加（Q7 参照）
  - 新規ファイルは `packages/core/src/loader/`（`unit-of-work.md` のコード構成戦略）配下に作成

## 確認質問（比較情報・推奨案を埋め込み済み）

直近の UoW-A 各ステージで一貫して比較情報の提示を求められたため、本計画では最初から選択肢比較と推奨案を記載する。承認いただければ推奨案のまま Step 6 に進む。修正があれば `[Answer]:` を書き換えてください。

### Q1. `ImageInput` の型定義

| 選択肢 | 内容 | 評価 |
|---|---|---|
| A | `string`（URL）のみ | US-01（画像を渡すだけ）を満たさない可能性がある（File/Blob を直接渡したいケースを拾えない） |
| **B（推奨）** | `string`（URL）\| `Blob` | US-01（直接データ）と US-03（URL）の両方を過不足なくカバー。`<input type=file>` の `File`（`Blob` のサブクラス）もそのまま渡せる |
| C | `string \| Blob \| ArrayBuffer \| HTMLImageElement` | 現時点でどのストーリーも要求しない入力経路まで含み過剰（YAGNI） |

**採用理由**: US-01/US-03 の両方を過不足なく満たすのは B。

[Answer]: B

### Q2. アスペクト比検証の厳密さ

| 選択肢 | 内容 | 評価 |
|---|---|---|
| A | 厳密に `width === height * 2` のみ許容 | エンコーダ由来の丸め誤差（例: 7680×3839）で正当な画像を誤って拒否するリスク |
| **B（推奨）** | 2:1 ± 許容誤差（例: ±0.5%）を許容 | US-01 受け入れ基準「2:1 でない画像は明確なエラー」を満たしつつ、実用上の誤差を吸収 |

**採用理由**: 受け入れ基準は「2:1 でない画像はエラー」であり「厳密に等しくなければならない」とまでは規定していない。実運用の堅牢性を優先。

[Answer]: B

### Q3. 取得・デコード方式

| 選択肢 | 内容 | 評価 |
|---|---|---|
| A | `fetch` でバイト取得 → `createImageBitmap` でデコード | URL/Blob 双方を同じ経路に統一できる。`Content-Length` があれば実バイト数で `progress` を発火可能。`createImageBitmap` は NFR-02 の対象ブラウザ全て（Safari 15+ 含む）で利用可 |
| B | `new Image()` + `crossOrigin='anonymous'` でロード | 実装は単純だが、URL と Blob で経路が分岐し、進行イベントは疑似的な 0→100 のみになる |

**採用理由**: URL/Blob を同一経路で扱え、実バイト数ベースの `progress`（US-03 受け入れ基準）を自然に提供できる A を採用。

[Answer]: A

### Q4. WebGL 最大テクスチャサイズ超過の検知タイミング

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | デコード後（ビットマップ実寸判明後）、`Renderer` 反映直前に `gl.getParameter(MAX_TEXTURE_SIZE)` と比較 | シンプルで確実。8K 超は性能保証対象外（NFR-01）のため凝った事前判定は不要（YAGNI） |
| B | 画像ヘッダのみ先読みして寸法を推測 | フォーマット依存の実装が必要で複雑。8K 超は稀なケースであり複雑さに見合わない |

**採用理由**: FR-01/NFR-01 が「8K 超は性能保証対象外」と明言しており、厳密な事前チェックへの投資は不要。UoW-A の `Renderer` は WebGL2 コンテキストを既に保持しているため取得は容易。

[Answer]: A

### Q5. `validate` 段階で拒否する条件の範囲

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 形式検証のみ（MIME/拡張子、2:1 比率）。寸法の大小そのものでは拒否しない | FR-01/US-02「寸法上限で一律拒否しない」を厳格に踏襲。WebGL 上限超過は Q4 の load 段階のフォールバックに委ねる |
| B | 明らかに巨大な宣言サイズ（例: 32K 超）を `validate` 時点で早期拒否 | FR-01 の「上限なしで読み込みを試みる」という明示要件と矛盾する |

**採用理由**: FR-01/US-02 が寸法上限の撤廃を明確な意図として持つため、事前の寸法拒否は要件と衝突する。SECURITY-05（入力検証）は形式・型の妥当性検証を求めるものであり、寸法の大小自体を「不正」とはしない。

[Answer]: A

### Q6. `loadImage` 多重呼び出し時の挙動

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 新しい呼び出しが前回を中断（`AbortController`）し、新規ロードを開始する（最新呼び出し優先） | ユーザーが素早く画像を切り替えるユースケースに自然に対応。UoW-E（ギャラリー）の `next`/`prev` が将来 `loadImage` を呼ぶ想定とも整合 |
| B | 前回完了まで新規呼び出しを拒否（エラー） | 呼び出し側に不要な制約を課す |
| C | キューイングして順次実行 | UoW-B 単体では過剰設計（複数枚の同時管理は UoW-E の責務） |

**採用理由**: 最新呼び出し優先が最も直感的で、将来の Gallery 連携とも整合する。

[Answer]: A

### Q7. `Renderer` へのテクスチャ反映方法

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `Renderer` に `setSphereTexture(texture: Texture \| null): void` を追加し、UoW-B はこのメソッド経由でのみ反映 | `Renderer` のカプセル化を維持（`component-dependency.md` の「Renderer は投影の数式を持たない」等の疎結合原則と同じ思想）。UoW-A の `Renderer` に新規 public メソッドを追加する形の拡張 |
| B | `modeContext.sphereMesh` を UoW-B から直接操作（`sphereMesh.material.map = texture`） | `Renderer` の内部実装（マテリアル種別等）に他ユニットが直接依存し、将来の `Renderer` 内部変更が破壊的変更になりやすい |

**採用理由**: UoW-A で確立した境界（`Renderer` が描画資産をカプセル化する）を維持するため A。

[Answer]: A

### Q8. `ViewerState` への画像ロード状態フィールドの追加方法

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `ViewerState` に新規フィールド `imageLoadState: 'idle' \| 'loading' \| 'ready' \| 'error'` を追加する（UoW-A の `loadState` = 初期化状態とは別概念として明確に分離） | UoW-A の `business-rules.md` BR-A-16 が「`loadState` と画像ロードの進捗状態は別概念であり混同しないこと」と明示的に警告している |
| B | 既存の `loadState` を汎用化して画像ロードにも使い回す | BR-A-16 の警告に反する。初期化完了後に `loadState` が再び `'loading'` に戻るのは意味的に紛らわしい |

**採用理由**: BR-A-16 の既存決定を尊重し、別フィールドとして分離する。

[Answer]: A

## 比較検討サマリ

判断軸は一貫して: (1) 該当ストーリー（US-01〜04, US-32）の受け入れ基準を過不足なく満たすか、(2) UoW-A で確定済みの決定・境界（BR-A-15/16、`Renderer` のカプセル化）と整合するか、(3) FR-01/NFR-01 の「寸法上限を設けない」という明示要件と矛盾しないか、(4) YAGNI（8K 超えの最適化やキューイング等、要求されていない複雑さを避ける）。

## 次のステップ（Step 6: 成果物生成、承認後）

- [x] `aidlc-docs/construction/uow-b/functional-design/domain-entities.md`
- [x] `aidlc-docs/construction/uow-b/functional-design/business-rules.md`
- [x] `aidlc-docs/construction/uow-b/functional-design/business-logic-model.md`
