# Tech Stack Decisions — UoW-H React アダプタ

- **関連 Issue**: [#46](https://github.com/AtsutoNakayama/perisphere/issues/46)
- **作成日**: 2026-08-04
- **前提資料**: `uow-h-nfr-requirements-plan.md`（Q1〜Q5 回答・採用理由）
- **注記**: パッケージマネージャ・ビルドツール（tsup）・テストランナー（vitest + jsdom）・PBT ライブラリ（fast-check）・Lint/フォーマッタ（ESLint + Prettier）・TypeScript strictness・ES2020 ターゲット等のモノレポ横断決定（UoW-A で確定）は変更なくそのまま適用する。本ドキュメントは UoW-H 固有の決定のみを扱う。

## 1. React/react-dom バージョン範囲（`peerDependencies`）（Q1）

- **決定**: `packages/react/package.json` の `peerDependencies` に `react`/`react-dom` を `>=18.0.0 <20.0.0`（React 18・19 系列を許容）として指定する。
- **具体的な下限バージョン**: Code Generation 着手時点で React の最新安定版を確認し、必要であれば下限を引き上げる（`three.js` と同じ「方針は本ステージで確定し、具体的なバージョン番号は Code Generation で確定する」パターン、UoW-A `tech-stack-decisions.md` §8 を踏襲）。
- **開発時の devDependencies**: 実装・テストで使用する具体的な React/react-dom バージョンは `devDependencies` に固定し、CI の再現性を確保する。
- **理由**: `Perisphere` の実装（`React.forwardRef` + `useImperativeHandle`、Functional Design Q2 で確定）は React 18・19 いずれでも同一に動作するため、サポート範囲を狭める技術的な理由がない。

## 2. コンポーネントテストツール（Q2）

- **決定**: `@testing-library/react` を `packages/react` の新規 devDependency として追加する。既存の `vitest` + `jsdom`（モノレポ共通決定）と組み合わせ、`render`/`act`/`cleanup`/`renderHook` を使用する。
- **理由**: React コンポーネント/フックテストの業界標準ツールで、DOM のマウント/アンマウント・`act()` によるエフェクトのフラッシュ・各テスト後の自動 `cleanup` を提供する。`usePerisphere`（フック単体）のテストには `renderHook` を使用する。

## 3. React hooks 静的検査（Q3）

- **決定**: `eslint-plugin-react-hooks` を `packages/react` の新規 devDependency として追加し、`eslint.config.js`（または `packages/react` 用の設定）に `rules-of-hooks`/`exhaustive-deps` を有効化する。
- **意図的な例外の扱い**: BR-H-09（イベントコールバック購読用 `useEffect` の依存配列を意図的に `[]` とする設計）等、`exhaustive-deps` の警告に反する箇所は、理由を1行で示すコメント付きの `// eslint-disable-next-line react-hooks/exhaustive-deps` で明示する。
- **理由**: hooks の誤用（条件付き呼び出し、依存配列の漏れ）を機械的に検出できる業界標準ツールで、UoW-A の「ESLint + Prettier」方針を React コードに自然に拡張する。

## 4. PBT の適用対象（Q4）

- **決定**: 以下3つを React/DOM から独立した純粋関数として実装し、fast-check（UoW-A で確定済み）による PBT の対象とする。
  - `resolveInitialSource(image: ImageInput | undefined, photos: readonly PhotoInput[] | undefined): { kind: "photos"; value: readonly PhotoInput[] } | { kind: "image"; value: ImageInput } | { kind: "none" }`（`business-rules.md` BR-H-05）
  - `extractViewerOptions(props: PerisphereProps): ViewerOptions`（`business-rules.md` BR-H-08）
  - `toCallbackPayload<K extends ViewerEventType>(event: ViewerEventMap[K]): unknown`（`business-rules.md` BR-H-10）
- **検証する不変条件**:
  - `resolveInitialSource`: `photos !== undefined` ならば結果は常に `{ kind: "photos", value: photos }`（`image` の値に関わらず）。`photos === undefined` かつ `image !== undefined` ならば `{ kind: "image", value: image }`。両方 `undefined` ならば `{ kind: "none" }`
  - `extractViewerOptions`: 戻り値のオブジェクトのキー集合に `image`/`photos`/`mode`/`className`/`style`/`onReady`/`onError`/`onProgress`/`onModeChange`/`onViewChange`/`onZoomChange`/`onPhotoChange`/`onFullscreenChange` のいずれも含まれない。それ以外の任意のキー（`controls`/`text`/将来の追加キーを模した任意プロパティ）はすべて元の値のまま保持される
  - `toCallbackPayload`: `event.type !== "error"` の場合、戻り値のキー集合に `type` が含まれない。`event.type === "ready"` の場合、戻り値は `undefined`。`event.type === "error"` の場合、戻り値は `event.error` と参照等価
- **example-based との併設**: マウント時の `createViewer` 呼び出し、props 変更反映、イベントブリッジ、unmount 時の破棄という一連のフロー（`business-logic-model.md` P1〜P5）はビジネスクリティカルなパスとして、`@testing-library/react` を用いた example-based テストで個別に検証する（PBT-10）。

## 5. 新規ランタイム依存（Q5）

- **決定**: 新規ランタイム依存を追加しない。`@perisphere/react` は `@perisphere/core`（ワークスペース内依存）と `react`/`react-dom`（`peerDependencies`）のみに依存する。
