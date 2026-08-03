# NFR Design Plan — UoW-E ギャラリー

- **関連 Issue**: [#40](https://github.com/AtsutoNakayama/perisphere/issues/40)
- **作成日**: 2026-08-03
- **前提資料**: `construction/uow-e/nfr-requirements/`、`construction/uow-e/functional-design/`

## 必須評価カテゴリの適用可否

| カテゴリ | 適用可否 | 判定根拠 |
|---|---|---|
| Resilience Patterns | 適用（本ステージで発見・確定） | `Gallery` の内部ポインタと `ViewerState.photoIndex` の関係が Functional Design 時点で未確定だったことが判明。連打時の挙動（BR-E-09）と破損写真からの回復可能性に直結するため本ステージで確定する（Q1） |
| Scalability Patterns | **N/A** | `nfr-requirements.md` §1 で確認済み（クライアントサイドライブラリ） |
| Performance Patterns | 適用（新規パターンなし） | `photochange` はロード成功確定後にのみ発火する低頻度イベント（ユーザーの明示操作起点）であり、`viewchange`/`zoomchange`（UoW-D PP-D-1）のような高頻度スロットリングは不要。NFR Requirements Q1（プリロードなし）から追加で確定する事項はない |
| Security Patterns | 適用（新規論点なし） | `goTo` の範囲外検証（`BR-E-05`）は UoW-A〜D の Defense in Depth の継続であることを確認する（Q2） |
| Logical Components | 適用 | `Gallery` の配置モジュールと、PBT 対象計算を独立モジュールへ切り出すか（UoW-C `projections/`・UoW-D `viewMath.ts` の前例）を確定する（Q3） |

## 確認質問（比較情報・推奨案を埋め込み済み）

### Q1. `Gallery` 内部ポインタと `ViewerState.photoIndex` の関係（Resilience、本ステージでの発見）

**発見の経緯**: `business-rules.md` BR-E-09（連続呼び出し時のキャンセル）は「矢印キー連打（US-18）でも、最終的に落ち着いた写真だけが表示される」ことを意図している。これは各回の `next()` 呼び出しが、直前の呼び出しのロード完了を待たずに**確実に1つずつ目標を前進させる**ことを暗黙に前提とする。一方 `domain-entities.md` E1 の `Gallery.current` と、E4 の `ViewerState.photoIndex`（ロード成功時のみ更新、BR-E-07）の関係は Functional Design 時点では明示されていなかった。両者を「常に同一の値」として扱うと、ロード確定前に連打した場合、2回目以降の `next()` が「まだロード確定していない同じ位置」から計算されてしまい、連打しても実際には1つ先にしか進まない可能性がある。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `Gallery.current` は「目標（pending）インデックス」として、`next()`/`prev()`/`goTo()` 呼び出しのたびに即座に（ロードの成否を待たず）前進させる。`ViewerState.photoIndex`（`getPhotoIndex()` が返す値）は「表示中（confirmed）インデックス」として、ロード成功時にのみ `Gallery.current` の値で更新する（`BR-E-07` の通り）。両者は意図的に分離した別の値として扱う | BR-E-09 が想定する「連打で複数先へ進む」体験を実現できる（各回の呼び出しが確実に1つずつ目標を前進させる）。副次効果として、リスト中に恒常的にロードに失敗する写真があっても、利用者が `next()` を押し続ければ目標ポインタは前進し続けるため、自動リトライやスキップ処理を実装せずとも「連打で壊れた写真を通り過ぎて次の正常な写真へたどり着ける」という回復性が自然に得られる |
| B | `Gallery.current` を `ViewerState.photoIndex` と常に同期させる（ロード成功時のみ更新する単一の値とする） | 実装・概念ともに単純だが、BR-E-09 が意図する「連打で複数先へ進む」体験を満たせない可能性がある（ロード確定前の連打が同じ位置からの計算になる）。恒常的に壊れた写真がリストにあると `next()` を連打しても同じ写真に留まり続け、`goTo()` での明示的な回避（範囲チェックのみで到達可能な写真かは問わない）に頼るしかなくなる |

**採用理由**: BR-E-09 で既に確定している「連打時の意図」を正しく実現するには A が必要であり、破損写真からの回復性という副次的な利点もある。承認後、`domain-entities.md`/`business-rules.md` にこの分離を明記する追記を行う。

[Answer]: A

### Q2. `goTo` 検証の位置づけ（Security、新規論点の要否）

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | Functional Design で確定した検証（`goTo` の範囲外指定は `INVALID_INPUT`、`BR-E-05`）は、UoW-A〜D で確立した「公開 API の入力を境界で検証し、不正は明確なエラーとして正規化する」という Defense in Depth の継続であり、本ステージで新規のセキュリティパターンは追加しない | UoW-C・UoW-D も同様に「新規のセキュリティパターン論点はなし」と判断しており、一貫した扱い |
| B | `goTo`/`setPhotos` 専用の追加的な検証層（レート制限等）を設ける | 本ユニットの入力（写真リストとインデックス）に対してレート制限等は過剰。呼び出し頻度そのものへの配慮は不要（`photochange` は低頻度、Performance 判定の通り） |

**採用理由**: 既存方針の継続、過剰設計を避ける。

[Answer]: A

### Q3. `Gallery` の配置モジュールと計算ロジックの切り出し方針（Logical Components）

UoW-C（`modes/projections/`）・UoW-D（`interaction/viewMath.ts`）は、PBT 対象の計算式を独立した純粋関数モジュールへ切り出し、呼び出し元クラス（`ViewerMode` 実装・`ViewController`）はその関数を呼ぶだけにする、という前例がある。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `Gallery` クラス自身のメソッド（`next`/`prev`/`goTo`）として index 計算を実装し、独立した純粋関数モジュールへの切り出しは行わない。配置は `packages/core/src/gallery/Gallery.ts`（クラス本体・`normalizePhotoInput` ヘルパー）と `packages/core/src/gallery/types.ts`（`PhotoInput`/`GalleryMoveResult`） | `viewMath.ts`/`projections/` を切り出した理由は「同じ計算式を複数の呼び出し元（3種の `InputSource`、7つの `ViewerMode` 実装）が共有する」ためだった。`Gallery` の index 計算は `Gallery` 自身だけが呼ぶ内部ロジックであり、複数呼び出し元での共有という切り出しの動機がない。`Gallery` 自体が既に外部依存のない小さなクラス（`nfr-requirements.md` Q2 でモックなし直接テスト方針が確定済み）であるため、クラスメソッドのまま PBT 対象にできる（インスタンスを生成してメソッドを呼ぶだけで十分テスト可能） |
| B | `viewMath.ts`/`projections/` と同じパターンを踏襲し、`computeNext(current, size)`/`computeGoTo(index, size)` 等を独立モジュール（例: `gallery/galleryMath.ts`）へ切り出す | 呼び出し元が `Gallery` 自身のみのため、切り出しても再利用の恩恵がなく、ファイル数が増えるだけの過剰な抽象化になる（YAGNI） |

**採用理由**: 過去の切り出し（`viewMath.ts`/`projections/`）は「複数呼び出し元での再利用」が動機であり、`Gallery` にはその動機が存在しない。既に小さく独立してテスト可能なクラスであるため、追加の抽象化は行わない。

[Answer]: A

## 比較検討サマリ

判断軸: (1) BR-E-09（連打時のキャンセル制御）が意図する挙動を正しく実現する状態管理（Q1）、(2) UoW-A〜D で確立済みの Defense in Depth との整合（Q2）、(3) 過去の PBT 対象切り出し（`viewMath.ts`/`projections/`）の動機（複数呼び出し元での再利用）が本ユニットには当てはまらないことの確認（Q3、YAGNI）。

## 次のステップ（Step 6: 成果物生成、承認後）

- [ ] `aidlc-docs/construction/uow-e/nfr-design/nfr-design-patterns.md`
- [ ] `aidlc-docs/construction/uow-e/nfr-design/logical-components.md`
- [ ] Q1 承認に伴い `construction/uow-e/functional-design/domain-entities.md`（E1, E4）・`business-rules.md`（BR-E-03, BR-E-04, BR-E-05, BR-E-07）へ「`current`＝目標ポインタ／`photoIndex`＝確定ポインタ」の分離を追記
