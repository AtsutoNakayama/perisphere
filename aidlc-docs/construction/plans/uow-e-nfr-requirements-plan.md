# NFR Requirements Plan — UoW-E ギャラリー

- **関連 Issue**: [#40](https://github.com/AtsutoNakayama/perisphere/issues/40)
- **作成日**: 2026-08-03
- **前提資料**: `construction/uow-e/functional-design/`、`inception/requirements/requirements.md`（NFR-01〜12）、UoW-A/UoW-B/UoW-D `tech-stack-decisions.md`（モノレポ横断決定は継承）

## NFR カテゴリ別評価

| カテゴリ | UoW-E での判定 | 詳細 |
|---|---|---|
| Scalability | **N/A** | クライアントサイドライブラリであり、負荷分散・水平スケーリングの概念が存在しない（UoW-A〜D と同様） |
| Availability | **N/A** | 稼働サーバー・永続データストアなし（UoW-A〜D と同様） |
| Performance | **適用（本ユニットが決定）** | 写真切替時の先読み（プリロード）方針が未決定（Q1）。それ以外の性能面（テクスチャ反映・8K 動作保証）は UoW-B の既存パイプライン再利用（BR-E-06）でカバー済み |
| Security | 適用（Functional Design で具体化済み） | `goTo` の範囲外検証（BR-E-05, `INVALID_INPUT`）で NFR-10/SECURITY-05 を満たす。`PhotoInput.id` は perisphere 内部では解釈しない不透明な利用者向け識別子であり、追加のサニタイズは行わない（UoW-B Q5 の「標準仕様への委任」と同じ判断） |
| Reliability | 適用（Functional Design で具体化済み） | ロード失敗時のフォールバック（BR-E-08）・連続呼び出し時のキャンセル（BR-E-09）は確定済み。本ステージでの追加確認事項なし |
| Maintainability | 適用（継続） | Lint/フォーマッタ・TypeScript strictness は UoW-A の決定を継続。変更なし |
| Usability / Accessibility | **N/A（UoW-E スコープ外）** | `Gallery` 自体は可視要素を持たない（`unit-of-work-story-map.md` の通り US-24 の標準 UI 実装・アクセシビリティ対応は UoW-G の範囲） |
| Tech Stack Selection | 本ステージで確認 | テスト境界（Q2）、PBT 対象範囲（Q3、NFR-09 が名指しで「ギャラリー」を候補に挙げている）、新規ランタイム依存の要否（Q4） |

## 確認質問（比較情報・推奨案を埋め込み済み）

### Q1. 写真切替時の先読み（プリロード）方針（Performance）

`unit-of-work.md`（UoW-E 節）・`requirements.md`（FR-11）はプリロードに言及していない。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 先読みしない。`next()`/`prev()`/`goTo()` が呼ばれた時点で初めてロードを開始する（`loadImage()` と同じオンデマンド方式）。前後の写真をあらかじめフェッチする処理は持たない | `FR-11`/US-23 の受け入れ基準はオンデマンドロードで満たせる。プリフェッチを導入すると、どのタイミングで対象を再計算するか（`setPhotos` 直後／切替直後）・追加のメモリ保持・キャンセル制御の複雑化が伴い、初期リリースのスコープに対して過剰investment（YAGNI）。将来必要になった場合も `Gallery`/`createViewer` の内部実装のみで非破壊的に追加できる |
| B | 現在の index の前後1枚を事前にプリフェッチし、切替時の体感待ち時間を短縮する | UX 上の利点はあるが、`unit-of-work.md`/要件のいずれにも根拠がなく、本ユニットの責務（「写真切替時のロード**起動**」）を超える先回りの最適化になる |

**採用理由**: 要件・ユニット定義のいずれにも先読みの要求がなく、オンデマンド方式の方が実装・テストとも単純で本ユニットの責務に対して過不足がない。

[Answer]: A

### Q2. 写真切替オーケストレーションのテスト境界（Tech Stack Selection）

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `Gallery`（E1、純粋なインデックス計算）はモック不要でそのまま単体テストする。写真切替の共通ロード処理（BR-E-06〜09、`createViewer` 内のオーケストレーション）は UoW-B で確立済みのテスト境界（`Loader` をモック境界化し `globalThis.fetch` を `vi.fn()` で直接モック）をそのまま再利用し、新たなモック機構は導入しない | `Gallery` は外部依存を持たない値オブジェクト的なクラスであり、実際の入出力（DOM／ネットワーク）に触れるのは既存の `loadImage()` と共通のロードパイプラインのみ。UoW-A〜D で確立した「境界のみモック化する」方針（`tech-stack-decisions.md` 系列）との一貫性が高い |
| B | `createViewer` 全体を通した結合テストのみで検証し、`Gallery` 単体のテストは行わない | `Gallery` の巡回・範囲外判定ロジック（BR-E-03〜05）は分岐が多く、結合テストのみでは境界値（`size=0`, `size=1`, `index` の上下端）の網羅が難しい |

**採用理由**: 既存方針の継続。`Gallery` を独立してテストしやすい形（純粋関数的な計算クラス）に切り出した Functional Design（E1）の設計判断とも整合する。

[Answer]: A

### Q3. PBT の適用対象（テスト戦略、NFR-09 継続）

`requirements.md` NFR-09 は「投影計算・座標変換・状態管理（**ギャラリー**・モード切替）が PBT の主対象候補」と、本ユニットの状態管理を名指ししている。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `Gallery.next()`/`prev()`/`goTo()` を PBT（fast-check）の対象とする。検証する不変条件: ①任意の `size >= 0` と任意の操作列に対し `current` は常に `[-1, size)` の範囲に収まる（`size === 0` なら常に `-1`）、②`next()`/`prev()` の巡回が任意の `size >= 1` で正しく閉じる（`size` 回 `next()` を繰り返すと元の index に戻る）、③`goTo(index)` は `index` が整数かつ `[0, size)` の範囲内のときのみ `"moved"` を返し、それ以外は常に `"out-of-range"`（`size > 0` のとき）または `"empty"`（`size === 0` のとき）を返す。写真切替の成功/失敗分岐（BR-E-07/08）はビジネスクリティカルな統合経路として example-based で個別に検証する（PBT-10） | NFR-09 本文が「ギャラリー」を名指しで PBT 主対象候補に挙げており、全面適用方針（拡張オプトイン: Yes）にも合致する。`Gallery` が純粋関数的な計算クラス（Q2 の設計判断）であるため PBT 対象として切り出しやすい |
| B | PBT は行わず example-based のみ | PBT 全面適用方針（NFR-09）およびギャラリーの名指しに反する |

**採用理由**: NFR-09 が本ユニットの状態管理を名指しで PBT 対象候補に挙げているため、全面適用方針に従い A を採用する。

[Answer]: A

### Q4. 新規ランタイム依存の要否

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 新規ランタイム依存を追加しない。`Gallery` はインデックス計算のみを行う純粋な内部クラスであり、写真切替は UoW-B の既存ロードパイプラインをそのまま再利用するため、three.js 以外の追加ライブラリは不要 | UoW-A〜D から継続する「必要最小限の依存」方針（YAGNI）に合致する |
| B | 何らかのライブラリを導入する | 本ユニットの要件に対して投資が見合わない |

**採用理由**: 既存方針の継続。

[Answer]: A

## 比較検討サマリ

判断軸: (1) `unit-of-work.md`/`requirements.md` に根拠のない先回りの最適化（プリロード等）は行わない（YAGNI）、(2) NFR-09 が名指しした「ギャラリー」状態管理への PBT 全面適用、(3) UoW-A〜D で確立済みのテスト境界方針（境界のみモック化）の継続、(4) 既存の `INVALID_INPUT` 正規化・不透明識別子（`id`）への非過剰検証という Security 方針との整合。

## 次のステップ（Step 6: 成果物生成、承認後）

- [ ] `aidlc-docs/construction/uow-e/nfr-requirements/nfr-requirements.md`
- [ ] `aidlc-docs/construction/uow-e/nfr-requirements/tech-stack-decisions.md`
