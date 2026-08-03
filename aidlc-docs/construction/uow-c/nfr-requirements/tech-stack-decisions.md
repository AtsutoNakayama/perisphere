# Tech Stack Decisions — UoW-C 投影モード

- **関連 Issue**: [#36](https://github.com/AtsutoNakayama/perisphere/issues/36)
- **作成日**: 2026-08-03
- **前提資料**: `uow-c-nfr-requirements-plan.md`（Q1〜Q5 回答・採用理由）
- **注記**: UoW-A/UoW-B の `tech-stack-decisions.md` に記載のモノレポ横断決定・`packages/core` 決定は継続適用される。本ドキュメントは UoW-C 固有の追加決定のみを記録する。

## 1. 投影数式のテスト戦略: TypeScript 純粋関数への切り出し

- **決定**: 等距離図法（Dewarp）・Panini 近似式（Panini）・ステレオ図法（Tiny Planet）の投影数式を、GLSL シェーダとは別に同じ数式を持つ純粋 TypeScript 関数として実装する。fast-check で数値的性質（有効角度範囲での有限性、単調性、境界値での挙動）を検証する。GLSL シェーダ側は同じ数式を手動で移植し、テストは TS 関数側が担保する。
- **理由**: jsdom は WebGL2 を提供せず GLSL を直接実行検証できない。PBT 全面適用方針（PBT-10）に対し、投影数式は複雑な数値ロジックでありテストする価値が高い。

## 2. `Renderer.setSphereTexture` のマテリアル非依存化

- **決定**: `Renderer.setSphereTexture` の内部実装を、現在のマテリアルの種類で分岐させる。`MeshBasicMaterial` の場合は `.map` を、`ShaderMaterial`（UoW-C 導入）の場合は `uniforms.map.value` を更新する。シェーダベースモードは自身の `ShaderMaterial` のテクスチャユニフォームを必ず `map` という名前で公開する規約とする。
- **理由**: UoW-B との統合で発見した欠陥（シェーダベースモード表示中の `loadImage` 差し替えが反映されない）への対応。`Renderer` によるテクスチャ管理の一元化（カプセル化）を維持する。

## 3. モード切替時の `ShaderMaterial` 管理: モードごとに1回構築しキャッシュ

- **決定**: 各シェーダベースモード（`DewarpMode`/`PaniniMode`/`TinyPlanetMode`）は、自身の `ShaderMaterial` をコンストラクタまたは初回 `apply` 呼び出し時に 1 回だけ構築し、モードインスタンスのフィールドとして保持する。`dispose(ctx)` では破棄しない（`Renderer.setSphereMaterial` で既定マテリアルへ切り替えるのみ）。`Viewer` 全体の `dispose()` 時に、`DisposableRegistry` 経由で全モードの `ShaderMaterial` を解放する。
- **理由**: US-10「即時切替」という受け入れ基準に対し、モード切替のたびにシェーダを再コンパイルするコスト・遅延を避ける。

## 4. 新規ランタイム依存: なし

- **決定**: `packages/core` に新規のランタイム依存を追加しない。シェーダコードは文字列リテラルとして実装し、既存の three.js（`ShaderMaterial`）のみを利用する。
- **理由**: 現時点の規模（3 シェーダ）に対してビルド時検証ツール等の追加投資は不要（YAGNI）。

## 5. テスト境界: `Renderer` のモック化継続

- **決定**: UoW-A/UoW-B と同じく `Renderer` をモック境界化する。`setSphereMaterial`/`setSphereTexture` の呼び出し（引数を含む）を検証し、各モードの `apply`/`updateView`/`dispose` が正しい引数でこれらを呼ぶことをテストする。
- **理由**: `Renderer`（WebGL 実構築）は jsdom で構築不能という制約が UoW-C でも変わらない。

## 決定の適用範囲に関する注記

本ドキュメントの決定は `packages/core` の `modes/` 実装（UoW-C）に関するものであり、UoW-D 以降が独自の描画関連の課題を持つ場合は当該ユニットの NFR Requirements で個別に検討する。
