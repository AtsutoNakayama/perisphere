# Tech Stack Decisions — UoW-B 画像入力・ロード

- **関連 Issue**: [#34](https://github.com/AtsutoNakayama/perisphere/issues/34)
- **作成日**: 2026-08-03
- **前提資料**: `uow-b-nfr-requirements-plan.md`（Q1〜Q5 回答・採用理由）
- **注記**: UoW-A `tech-stack-decisions.md` §1（pnpm）・§6（ESLint+Prettier）・§7（TS strict）・§9（Dependabot+CI 監査）はモノレポ横断の決定として UoW-B にもそのまま適用される。§2〜5・8・10（tsup/Vitest/fast-check/テスト境界方針/three.js range/ES2020）も `packages/core` 全体の決定として継続する。本ドキュメントは UoW-B 固有の追加決定のみを記録する。

## 1. ロード処理のテスト境界: `Loader` のモック化

- **決定**: 単体テストでは `Loader`（`fetch`/`createImageBitmap` を呼ぶ層）を境界としてモック化する。`EquirectangularSource.createTexture` 以降（アスペクト比検証・`maxTextureSize` 検証・`Renderer.setSphereTexture` 呼び出し）を実際のロジックとして検証する。
- **理由**: jsdom は `createImageBitmap` を提供しない。UoW-A で確立した「`Renderer` を境界としてモック化する」方針（`tech-stack-decisions.md` UoW-A §5）と一貫させる。
- **実描画・実デコード確認**: ブラウザでの手動確認、および将来の Build and Test / UoW-I デモサイトに委ねる。

## 2. `fetch` のモック方法: `globalThis.fetch` の直接モック

- **決定**: `vi.fn()` で `globalThis.fetch` を直接差し替える。MSW 等の専用ライブラリは導入しない。
- **理由**: 新規依存を避け、検証したい範囲（呼び出し URL、疑似 `Response`（`ok`/`status`/`headers.get('content-length')`/`body` のストリーム、または `blob()`）で十分にカバーできる。

## 3. Property-Based Testing 対象範囲の拡張

- **決定**: fast-check の対象に以下を追加する。
  - `EquirectangularSource` のアスペクト比判定（BR-B-04）: 任意の `width`/`height` の組に対し、`|width/height - 2| <= 0.01` の境界で判定結果が一貫すること
  - `loadImage` の多重呼び出しキャンセル（BR-B-08）: 任意回数連続で `loadImage` を呼び出した場合、最後の呼び出しのみが成功/失敗として解決され、それ以前の呼び出しは静かに中断されること
- **example-based との併設方針**: ロード成功/失敗の主要シナリオ（URL 取得成功、404、CORS 失敗、2:1 でない画像、8K 超過）は example-based で個別に検証する（PBT-10、UoW-A と同方針）。

## 4. 新規ランタイム依存: なし

- **決定**: `packages/core` に新規のランタイム依存を追加しない。`fetch`/`createImageBitmap`/`AbortController` はブラウザネイティブ API を利用し、テクスチャ化には既存の peerDependency である three.js（`Texture` クラス）を利用する。
- **理由**: MVP 要件（US-01〜04, US-32）はネイティブ API で充足できる。追加ライブラリはバンドルサイズ・保守コストを増やす。

## 5. URL 入力への追加サニタイズ: 不要（`fetch` 標準仕様に委任）

- **決定**: `loadImage` の URL 入力に対して、スキーム制限などの追加サニタイズは実装しない。`Loader.validate`（BR-B-03）は形式検証（MIME/拡張子）のみを行う。
- **理由**: 本ライブラリはブラウザ内で実行されるクライアントサイドコードであり、サーバーサイドの SSRF は成立しない。`fetch` は `javascript:` 等の実行不可能なスキームを自然に拒否する。`data:`/`blob:` URL は正当なユースケースであり、追加のスキーム制限を課すとこれらを不必要に妨げる。

## 決定の適用範囲に関する注記

本ドキュメントの決定は `packages/core` の `loader/` 実装に関するものであり、他ユニット（UoW-C 以降）が独自の取得・デコード処理を持つ場合は当該ユニットの NFR Requirements で個別に検討する。
