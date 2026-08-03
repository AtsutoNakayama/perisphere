# NFR Requirements Plan — UoW-B 画像入力・ロード

- **関連 Issue**: [#34](https://github.com/AtsutoNakayama/perisphere/issues/34)
- **作成日**: 2026-08-03
- **前提資料**: `construction/uow-b/functional-design/`、`inception/requirements/requirements.md`（NFR-01〜12）、UoW-A `construction/uow-a/nfr-requirements/`（`tech-stack-decisions.md` はモノレポ横断決定を含み、UoW-B にも適用済み）

## 確定済み NFR の再確認（UoW-A から変更なし）

UoW-A の `tech-stack-decisions.md` §1（pnpm）・§6（ESLint+Prettier）・§7（TS strict）・§9（Dependabot+CI 監査）はモノレポ横断の決定であり、UoW-B にもそのまま適用する。§2〜5・8・10（tsup/Vitest/fast-check/Renderer モック化境界/three.js range/ES2020）も `packages/core` 全体の決定として UoW-B に引き続き適用する。

NFR-01（性能）・NFR-02（対象環境）・NFR-03（SSR セーフ）・NFR-05（アーキテクチャ）・NFR-07（配布形態）・NFR-11（稼働サーバーなし）・NFR-12（ライセンス）は Requirements Analysis で確定済みで UoW-B 固有の再質問は不要。Scalability / Availability / Usability・Accessibility は UoW-A 同様 **N/A**（クライアントサイドライブラリ、UI を持たない）。

## 確認質問（比較情報・推奨案を埋め込み済み）

### Q1. `fetch`/`createImageBitmap` を含むロード処理のテスト境界

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `Loader`（`fetch`/`createImageBitmap` を呼ぶ層）を境界としてモック化し、`ImageSourceAdapter.createTexture` 以降（アスペクト比・サイズ検証・`Renderer` 反映）を単体テストする | UoW-A で確立した「`Renderer` をモック境界化する」方針と一貫。jsdom は `createImageBitmap` を提供しないため、実デコードはテスト対象にしない |
| B | jsdom に `createImageBitmap` のポリフィルを追加し、実バイナリ画像フィクスチャで統合的にテストする | フィクスチャ管理・ポリフィル導入の複雑さが増す。実描画/実デコード確認は元々ブラウザでの手動確認に委ねる方針（`tech-stack-decisions.md` UoW-A §5）と重複投資になる |

**採用理由**: UoW-A の既存方針との一貫性、テスト複雑度の抑制（YAGNI）。

[Answer]: A

### Q2. `fetch` のモック方法

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `globalThis.fetch` を `vi.fn()` で直接モック | Vitest 標準の手法で追加依存が不要。検証したい範囲（URL・ヘッダ・Response 相当のストリーム/ステータス）に対して十分 |
| B | MSW（Mock Service Worker）等の専用ライブラリを導入 | UoW-B 単体のテスト規模に対して過剰。新規依存が増える |

**採用理由**: 新規ツール導入は必要最小限に留める方針（UoW-A から継続）。

[Answer]: A

### Q3. Property-Based Testing（fast-check）の対象範囲拡張

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `EquirectangularSource` のアスペクト比判定（BR-B-04: 2:1 ± 0.5% の境界値）と、`loadImage` の多重呼び出し時キャンセル（BR-B-08: 何回連続で呼んでも最後の呼び出しのみ成功する不変条件）を PBT 対象に追加 | Requirements Analysis で確定済みの PBT 全面適用方針（PBT-10）に沿い、UoW-B で新たに登場した「境界値判定」「非同期キャンセルの不変条件」という PBT に適したロジックを特定 |
| B | UoW-A 同様 example-based のみとし、PBT 対象は広げない | アスペクト比の境界値・多重呼び出しの競合状態は example だけでは網羅しにくく、PBT-10 の趣旨（ビジネスクリティカルな不変条件の網羅的検証）に合致するロジックを見送ることになる |

**採用理由**: 境界値判定と非同期キャンセルはまさに PBT が得意とする領域であり、確定済みの PBT 全面適用方針とも整合する。

[Answer]: A

### Q4. 新規ランタイム依存の要否

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 新規ランタイム依存を追加しない（`fetch`/`createImageBitmap`/`AbortController` はブラウザネイティブ API、テクスチャ化には既存 peerDependency の three.js を利用） | US-01〜04, US-32 の要件はネイティブ API で満たせる。追加ライブラリはバンドルサイズ・保守コストを増やす（NFR-07 の tree-shaking 可能性とも整合） |
| B | 画像デコード/リサイズ補助ライブラリを追加する | MVP 要件では不要な複雑さ（YAGNI）。将来的に真に必要になった場合は該当ユニット（UoW-B-F 等）で個別検討 |

**採用理由**: MVP 範囲はネイティブ API で完結する。

[Answer]: A

### Q5. `loadImage` への URL 入力に対する追加サニタイズ

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 追加の URL スキーム検証は行わない。`fetch` 自体が `javascript:` 等の非対応スキームを実行不可能として扱う（ブラウザの `fetch` 仕様に委ねる）。`data:`/`blob:` URL はそのまま許容する（正当なユースケースのため） | 本ライブラリはブラウザ内で動作するクライアントサイドコードであり SSRF は成立しない。`fetch` の標準仕様自体が安全境界として機能する。スキーム制限を追加すると `data:`/`blob:` を使った正当な入力（Blob 変換不要の直接指定）を不必要に妨げる |
| B | `http(s):` スキームのみを許可する明示的な URL バリデーションを追加する | 正当な `data:`/`blob:` ユースケースを排除してしまう。ブラウザの `fetch` が既に提供する安全性に対して過剰な二重実装になる |

**採用理由**: クライアントサイド実行という文脈上 SSRF 等のリスクが成立せず、`fetch` の標準仕様が十分な安全境界となる。SECURITY-05（入力検証）は形式検証（BR-B-03）で対応済みと位置づける。

[Answer]: A

## 比較検討サマリ

判断軸: (1) UoW-A で確定済みの技術スタック・テスト戦略との一貫性、(2) YAGNI（不要な依存・複雑さの回避）、(3) 確定済み拡張ルール（PBT-10, SECURITY-05/10）との整合、(4) クライアントサイドライブラリという実行文脈に即した現実的なセキュリティ境界。

## 次のステップ（Step 6: 成果物生成、承認後）

- [x] `aidlc-docs/construction/uow-b/nfr-requirements/nfr-requirements.md`
- [x] `aidlc-docs/construction/uow-b/nfr-requirements/tech-stack-decisions.md`
