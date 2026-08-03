# NFR Design Plan — UoW-F フルスクリーン

- **関連 Issue**: [#42](https://github.com/AtsutoNakayama/perisphere/issues/42)
- **作成日**: 2026-08-03
- **前提資料**: `construction/uow-f/nfr-requirements/`、`construction/uow-f/functional-design/`

## 必須評価カテゴリの適用可否

| カテゴリ | 適用可否 | 判定根拠 |
|---|---|---|
| Resilience Patterns | 適用（本ステージで発見・確定） | `business-rules.md` BR-F-08（`dispose()` 時、ネイティブモードなら `document.exitFullscreen()` を完了を待たず呼ぶ fire-and-forget）が、実行時に reject された場合の未処理 Promise rejection への対策を明示していないことが判明。本ステージで確定する（Q1） |
| Scalability Patterns | **N/A** | `nfr-requirements.md` §1 で確認済み（クライアントサイドライブラリ） |
| Performance Patterns | 適用（新規パターンなし） | `Renderer.resize()`（BR-F-09）はフルスクリーン切替時に1回のみ呼ばれ、`viewchange`/`zoomchange`（UoW-D `PP-D-1`）のような高頻度イベントのスロットリングは不要（`nfr-requirements.md` Performance 判定の通り、追加確認事項なし） |
| Security Patterns | 適用（新規論点の要否を確認） | `enterFullscreen()`/`exitFullscreen()` に入力検証対象がないため、UoW-A〜E の Defense in Depth（`INVALID_INPUT` 正規化パターン）をそのまま適用する余地がない。新規のセキュリティパターンが必要か確認する（Q2） |
| Logical Components | 適用 | `FullscreenManager` の配置モジュールと、`Renderer.resize()` の計算ロジックを独立関数へ切り出すか（UoW-C `projections/`・UoW-D `viewMath.ts` の前例、UoW-E Q3 では「単一呼び出し元なら切り出さない」と判断済み）を確定する（Q3） |

## 確認質問（比較情報・推奨案を埋め込み済み）

### Q1. `dispose()` の fire-and-forget `document.exitFullscreen()` での未処理 Promise rejection 対策（Resilience、本ステージでの発見）

**発見の経緯**: `business-rules.md` BR-F-08 は「ネイティブモードでは `document.exitFullscreen()` を呼び出すが完了を待たない」と定めている。しかし `document.exitFullscreen()` が返す `Promise` が reject された場合（例: `dispose()` 実行時点で既に何らかの理由でネイティブフルスクリーン状態でなかった、ブラウザ側の一時的な制約等）、誰もその reject をハンドルしないため、Node/ブラウザ双方で「未処理の Promise rejection」として警告・場合によってはテスト実行時にエラー扱いされるリスクがある。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | fire-and-forget 呼び出しに `.catch(() => {})` を明示的に付与し、reject されても静かに無視する（「Silent Best-Effort Cleanup」パターンとして命名） | `dispose()` は「確実な解放を試みる」ことが目的であり、ブラウザ側の reject 理由を利用者に通知する意味がない（`dispose()` 自体が同期 API であり、これ以上呼び出し元にできることもない）。UoW-B の `BR-B-08`（中断されたロードは `error` を発火せず静かに reject される）と同種の「関心のない失敗は静かに握りつぶす」という既存方針とも合致する |
| B | `dispose()` 内では例外処理を行わず、ブラウザ側の未処理 rejection 警告を許容する | 実装は最小だが、テスト実行環境（Vitest）によっては未処理 rejection がテスト失敗として扱われる場合があり、本来無害な `dispose()` の後処理が原因でテストが不安定になるリスクがある |
| C | `DisposeFn` の型自体を `() => void \| Promise<void>` に拡張し、`DisposableRegistry.disposeAll()` 側で `await` する | `DisposableRegistry`（UoW-A で確定済み、`domain-entities.md` E7 相当）は他の全 `Disposable` コンポーネント（C3/C4/C7/C9/C10/C11）が依存する共通契約であり、本ユニット1つの都合でこの契約を変更する（同期→非同期化）のは影響範囲が大きすぎる過剰対応 |

**理由**: 既存の `DisposeFn = () => void`（同期契約）を変更せずに済ませられるか、実装上のリスク（未処理 rejection）をどう吸収するかの判断が必要なため確認する。

**採用理由**: 既存の `DisposableRegistry` の同期契約を変更せず、UoW-B の「関心のない失敗は静かに無視する」既存方針とも一貫する A を採用する。

[Answer]: A

### Q2. 新規セキュリティパターンの要否（Security）

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 新規のセキュリティパターンは追加しない。`enterFullscreen()`/`exitFullscreen()`/`isFullscreen()` はいずれも引数を取らないため、UoW-A〜E の Defense in Depth（`INVALID_INPUT` への正規化）を適用する入力自体が存在しない。唯一の失敗経路（ブラウザ側の実行時拒否）は Functional Design で既に `FULLSCREEN_FAILED`（内部詳細を含まない安全なメッセージ）として正規化済み（`business-rules.md` BR-F-04） | UoW-C・UoW-D・UoW-E も同様に「新規のセキュリティパターン論点はなし」と判断しており一貫した扱い。本ユニット固有の攻撃面（信頼境界を跨ぐ入力）が存在しない |
| B | フルスクリーン化の対象要素（`container`）が DOM に接続されているか（`isConnected`）を事前チェックする等の追加的な防御コードを加える | 未接続要素への `requestFullscreen()` 呼び出しは既にブラウザ自身が reject するため、BR-F-04 の既存の失敗ハンドリングでそのまま吸収される。事前チェックを重ねても防げる追加のリスクがなく、コードが増えるだけの過剰防御 |

**理由**: 本ユニットには UoW-A〜E で継続してきた「公開 API の入力検証」の適用対象（引数）自体が存在しないため、新規パターンの要否を明示的に確認する。

**採用理由**: 攻撃面（信頼境界を跨ぐ入力）が存在せず、唯一の失敗経路も Functional Design で既に安全に正規化済みのため A を採用する。

[Answer]: A

### Q3. モジュール配置・計算ロジックの切り出し方針（Logical Components）

UoW-C（`modes/projections/`）・UoW-D（`interaction/viewMath.ts`）は複数呼び出し元で共有する計算式を独立モジュールへ切り出した前例があるが、UoW-E（`Gallery`）は「単一呼び出し元しかない」ことを理由にクラスメソッドのまま切り出さないと判断した（NFR Design Q3=A）。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `FullscreenManager` は新規ディレクトリ `packages/core/src/fullscreen/`（`FullscreenManager.ts` + `types.ts`〔`FullscreenMode` 等の内部型〕）に配置する（`gallery/`/`loader/`/`modes/`/`interaction/` と同じ、ユニットごとに新規ディレクトリを切る既存パターン）。擬似フルスクリーンのスタイル適用・復元ロジックは `FullscreenManager` のプライベートメソッドとして実装し、独立モジュールへの切り出しは行わない（呼び出し元が `FullscreenManager` 自身のみのため、UoW-E `Gallery`/`normalizePhotoInput` と同じ判断）。`Renderer.resize()`（`viewer/Renderer.ts` への追加メソッド）も、呼び出し元が `Renderer` 自身の初期化処理（`buildSceneGraph`）と共有できる小さな計算であり、独立関数への切り出しは行わない | 過去の切り出し（`viewMath.ts`/`projections/`）の動機は「複数呼び出し元での再利用」であり、`FullscreenManager` の擬似フルスクリーン処理も `Renderer.resize()` の計算も、それぞれ単一の呼び出し元（自クラス）内に閉じている。UoW-E Q3 で確立した判断基準（単一呼び出し元なら切り出さない、YAGNI）をそのまま適用できる |
| B | `fullscreen/fullscreenStyle.ts` のような独立モジュールへスタイル適用・復元ロジックを切り出す | 呼び出し元が `FullscreenManager` のみであり、切り出しても再利用の恩恵がなく、ファイル数が増えるだけの過剰な抽象化になる |

**理由**: 新規コンポーネントの配置場所とモジュール分割粒度は、既存のディレクトリ構成規約（`unit-of-work.md` のパッケージ構成図）と過去の切り出し判断基準（UoW-E Q3）との一貫性を確認する必要がある。

**採用理由**: UoW-E Q3 で確立した「単一呼び出し元なら切り出さない」という判断基準をそのまま適用する A を採用する。

[Answer]: A

## 比較検討サマリ

判断軸: (1) `DisposableRegistry` の既存の同期契約（`DisposeFn = () => void`）を変更せず、UoW-B の「関心のない失敗は静かに無視する」既存方針を継続する（Q1）、(2) 本ユニットには信頼境界を跨ぐ入力自体が存在しないため新規セキュリティパターンは追加しない（Q2）、(3) UoW-E で確立した「単一呼び出し元なら独立モジュールへ切り出さない」という判断基準の継続（Q3、YAGNI）。

## 次のステップ（Step 6: 成果物生成、承認後）

- [ ] `aidlc-docs/construction/uow-f/nfr-design/nfr-design-patterns.md`
- [ ] `aidlc-docs/construction/uow-f/nfr-design/logical-components.md`
- [ ] Q1 承認に伴い `construction/uow-f/functional-design/business-rules.md`（BR-F-08）へ fire-and-forget 呼び出しの `.catch(() => {})` 明記を追記
