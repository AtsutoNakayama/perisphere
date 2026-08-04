# Code Generation Plan — UoW-H React アダプタ

- **関連 Issue**: [#46](https://github.com/AtsutoNakayama/perisphere/issues/46)
- **作成日**: 2026-08-04
- **前提資料**: `construction/uow-h/functional-design/`（domain-entities.md〔E1〜E4〕/ business-rules.md〔BR-H-01〜11〕/ business-logic-model.md〔P1〜P6〕/ frontend-components.md）、`construction/uow-h/nfr-requirements/tech-stack-decisions.md`、`construction/uow-h/nfr-design/`（nfr-design-patterns.md〔RP-H-1, LC-H-1, LC-H-2〕/ logical-components.md〔L1〜L5〕）、`construction/uow-h/infrastructure-design/`（変更不要と確認済み）

**本ファイルは Code Generation の単一の情報源である。**

## ユニットコンテキスト

- **担当ストーリー**: US-28（React コンポーネント＋フック＋ref 命令ハンドル）、US-33（コア非依存アダプタ分離）
- **依存ユニット**: UoW-A〜G（すべてマージ済み）。本ユニットは `@perisphere/core` の公開 API（`createViewer`/`ViewerHandle`/`ViewerOptions`/`ViewerEventMap`）のみに依存する
- **新規パッケージ**: `packages/react`（`@perisphere/react`）
- **公開インターフェースの追加**: `PerisphereProps`/`PerisphereHandle`（新規公開型）、`Perisphere`（コンポーネント）、`usePerisphere`（フック）

### 実装上の設計判断（本ステージでの発見・確定）

- **ref 公開方式を「`handleRef` の直接返却」から「遅延委譲する `Proxy`」へ変更（バグ修正）**: Functional Design（`business-logic-model.md` P2）は `useImperativeHandle` が `handleRef.current`（マウント用 `useEffect` で設定）をそのまま返す設計だったが、`useImperativeHandle` は内部的に `useLayoutEffect` 相当で実行され、通常の `useEffect`（マウント処理、P1）より**先に**発火する。そのため素朴な実装では初回コミット時に `handleRef.current` がまだ `null` の状態で `forwardedRef.current` に固定されてしまい、以後 P1 が完了しても更新されない（`handleRef.current` へのミューテーションは再レンダリングを引き起こさないため）。対策として、`useImperativeHandle` には `handleRef` を実行時に間接参照する `Proxy`（`ViewerHandle` の全メンバーを `handleRef.current` へ遅延委譲する）を返させ、`handleRef` 自体が未設定の間にプロパティアクセスされた場合は `undefined` を返す。これにより Q2 の意図（ref は待たされることなく使える）を保ったまま、実行順序に依存しない正しい実装になる。`domain-entities.md`/`business-rules.md` の意図（`PerisphereHandle` は `ViewerHandle` の全量、ready を待たない）は変更しない。
- **イベントコールバック props の型を、個別の named イベント型ではなく `ViewerEventMap["xxx"]` のインデックスアクセスで表現**: `@perisphere/core` の `index.ts` は `ModeChangeEvent`（`modechange` の型）を re-export していない（`ModeChangeOptions` という別の型のみ export 済み）。個別 named 型を import する代わりに `Omit<ViewerEventMap["modechange"], "type">` のようにインデックスアクセス型を使うことで、`@perisphere/core` の `index.ts` に新規 export を追加せずに済む（コア側への変更ゼロで本ユニットを実装できる）。
- **`vitest.config.ts` に `@perisphere/core` → ワークスペースソースのエイリアスを追加**: CI の `test` ジョブ（`.github/workflows/ci.yml`）は `build` ジョブとは独立しており `pnpm -r build` を事前実行しない。`@perisphere/react` が `@perisphere/core` を通常の `dependencies`（パッケージ名）として import すると、`package.json` の `exports`/`main`（`./dist/index.js`）経由の解決になり `packages/core` の `dist/` が存在しない `test` ジョブで解決に失敗する。`packages/react/vitest.config.ts` に `resolve.alias` で `@perisphere/core` を `../core/src/index.ts` へ直接向けることで、ビルド成果物に依存せずソースを直接テストできるようにする（`infrastructure-design.md` の「CI 変更不要」の結論を保ったまま解決する、テスト構成のみの変更）。
- **`@perisphere/react` のテストは `@perisphere/core` をモジュール境界としてモック化する**: UoW-A が「WebGL 境界（`Renderer`）をモック化する」方針を確立しているのと同じ思想で、`Perisphere`/`usePerisphere` の単体テストは実際の `createViewer`（three.js・WebGL 挙動を含む）を呼ばず、`vi.mock("@perisphere/core", ...)` で `createViewer` をテスト用のフェイク `ViewerHandle`（`vi.fn()` 群 + 簡易な `on`/`off` イベントエミュレーション）に差し替える。これにより本ユニット自身の責務（props↔API のブリッジ、ライフサイクル管理）のみを検証し、コア側の実装詳細には依存しないテストになる。

## Step 1: Project Structure Setup（Greenfield: 新規パッケージ）

- [x] 1-1. `packages/react/package.json`（新規）— `name: "@perisphere/react"`, `dependencies: { "@perisphere/core": "workspace:*" }`, `peerDependencies: { react: ">=18.0.0 <20.0.0", "react-dom": ">=18.0.0 <20.0.0" }`（`tech-stack-decisions.md` §1）、devDependencies に `react@19.2.8`/`react-dom@19.2.8`/`@types/react@19.2.18`/`@types/react-dom@19.2.4`/`@testing-library/react@16.3.2`（§2）/`eslint-plugin-react-hooks@7.1.1`（§3）を追加、他は `packages/core` と同じバージョンのモノレポ横断ツール（typescript/tsup/vitest/jsdom/fast-check/eslint/prettier 等）
- [x] 1-2. `packages/react/tsconfig.json`（新規）— `../../tsconfig.base.json` を継承、`"jsx": "react-jsx"` を追加、`outDir: "dist"`, `rootDir: "src"`
- [x] 1-3. `packages/react/tsup.config.ts`（新規）— `packages/core/tsup.config.ts` と同一構成（`entry: ["src/index.ts"]`, `format: ["esm"]`, `target: "es2020"`, `dts: true`, `sourcemap: true`, `clean: true`）
- [x] 1-4. `packages/react/vitest.config.ts`（新規）— `environment: "jsdom"` + `resolve.alias["@perisphere/core"]` をワークスペースソース（`../core/src/index.ts`）へ向ける（本ステージでの発見）
- [x] 1-5. `packages/react/eslint.config.js`（新規）— ルートの `eslint.config.js` の配列を import して継承し、`eslint-plugin-react-hooks` の `configs.flat.recommended` を追加

## Step 2: Business Logic Generation

- [x] 2-1. `packages/react/src/types.ts`（新規、L4）— `PerisphereProps`（E1）/`PerisphereHandle`（E2、`ViewerHandle` の型エイリアス）
- [x] 2-2. `packages/react/src/internal.ts`（新規、L3）— `resolveInitialSource`（BR-H-05）/`extractViewerOptions`（BR-H-08）/`toCallbackPayload`（BR-H-10）/`EVENT_PROP_NAMES` マッピング定数。React/DOM 非依存の純粋関数群
- [x] 2-3. `packages/react/src/Perisphere.tsx`（新規、L1、E3）:
  - ルート `<div>` のレンダリングと `className`/`style` の受け渡し（BR-H-01）
  - マウント時 `useEffect`（依存配列 `[]`）: `createViewer(container, extractViewerOptions(props))` → `resolveInitialSource` に基づく初期値適用（`setPhotos`/`loadImage().catch(() => {})`〔RP-H-1〕/`setMode`）→ クリーンアップで `dispose()`（BR-H-02, BR-H-03, BR-H-11）
  - `useImperativeHandle`: `handleRef` へ遅延委譲する `Proxy` を返す（本ステージでの発見、上記「実装上の設計判断」参照）
  - プライベートフック `useEventBridge`（LC-H-2）: 8種のイベント購読、`callbacksRef` による最新値保持（BR-H-09）、`toCallbackPayload` によるペイロード変換（BR-H-10）
  - `photos`/`image`/`mode` 個別 `useEffect`（参照比較、BR-H-06、`business-logic-model.md` P4）
- [x] 2-4. `packages/react/src/usePerisphere.ts`（新規、L2、E4）— `useRef` のみの薄いラップ
- [x] 2-5. `packages/react/src/index.ts`（新規、L5）— バレルエクスポート

## Step 3: Business Logic Unit Testing

- [x] 3-1. `packages/react/src/__tests__/internal.test.ts`:
  - PBT（fast-check）: `resolveInitialSource` の不変条件（`photos` 優先、`image` フォールバック、両方未指定で `none`）
  - PBT: `extractViewerOptions` の不変条件（既知キーが結果に含まれない、未知キーは保持される）
  - PBT: `toCallbackPayload` の不変条件（`error` 以外は `type` を含まない、`ready` は `undefined`、`error` は `event.error` と等価）
- [x] 3-2. `packages/react/src/__tests__/Perisphere.test.tsx`（`@testing-library/react` + `vi.mock("@perisphere/core")`、本ステージでの発見「テストは `@perisphere/core` をモック境界にする」）:
  - マウント時に `createViewer` が呼ばれ、ルート `<div>` が `container` として渡されること（BR-H-01, BR-H-02）
  - `image`/`photos`/`mode` の初期適用（`photos` 優先、BR-H-05）
  - ref 経由で `PerisphereHandle` の任意メンバーを呼べること（マウント直後、`ready` を待たない、BR-H-04）。マウント前（極端なタイミング）に `ref.current?.getMode()` を呼んでも例外にならないこと（`Proxy` の `undefined` フォールバック）
  - `photos`/`image`/`mode` prop 変更時の反映（参照比較、BR-H-06）。同一参照での再レンダリングでは再適用されないこと
  - `onReady`/`onError`/`onModeChange`/`onPhotoChange` 等の発火（`toCallbackPayload` の変換規則通りのペイロードで呼ばれること、BR-H-10）
  - インラインコールバック（レンダリングごとに新しい関数）を渡しても購読が1回のみで済むこと（`handle.on`/`off` の呼び出し回数、BR-H-09）
  - `loadImage()` が reject しても未処理の rejection にならないこと（RP-H-1）
  - unmount 時に `dispose()` と全イベントの `off()` が呼ばれること（BR-H-11）
  - `className`/`style` がルート要素へ反映されること
- [x] 3-3. `packages/react/src/__tests__/usePerisphere.test.tsx`（`@testing-library/react` の `renderHook`）:
  - `usePerisphere()` が `{ ref }` を返し、`ref.current` が初期状態で `null` であること
  - 返した `ref` を `<Perisphere ref={ref} />` に渡すとマウント後に `ref.current` が使えること（`Perisphere.test.tsx` と合わせた統合的な確認）

## Step 4: Business Logic Summary

- [x] 4-1. `aidlc-docs/construction/uow-h/code/code-summary.md`

## Step 5: Documentation Generation

- [x] 5-1. 新規公開 API（`Perisphere`, `usePerisphere`, `PerisphereProps`, `PerisphereHandle`）に TSDoc コメントを付与する（Step 2 実装と同時に付与）

## Step 6: Deployment Artifacts Generation

**該当なし（スキップ）**。`infrastructure-design.md` で確認済みの通り、CI/Dependabot への変更は不要（新規パッケージはグロブ・ルート監視で自動的にカバーされる）。

## Step 7: ビルド・テストの実行確認

- [x] 7-1. `pnpm install`（新規パッケージの依存解決）
- [x] 7-2. `pnpm -r build` を実行し型エラー・ビルドエラーがないことを確認（`packages/core` → `packages/react` の順にビルドされることを確認）
- [x] 7-3. `pnpm -r test` を実行し全テスト（UoW-A〜G の既存分 + UoW-H 新規分）が green であることを確認
- [x] 7-4. `pnpm -r lint` を実行し lint エラーがないことを確認
- [x] 7-5. `pnpm audit --prod` で既知の脆弱性がないことを確認
- [x] 7-6. 問題が見つかった場合は該当コードを修正し、7-1〜7-5 を再実行する

**注記**: Step 7 は開発時点での自己検証であり、実際のブラウザでの動作確認は含まない。正式な Build and Test ステージ（全ユニット共通の統合検証）を代替するものではない。

## ストーリートレーサビリティ

| ストーリー | 対応箇所 |
|---|---|
| US-28（React コンポーネント＋フック＋ref 命令ハンドル） | Step 2-3, 2-4（`Perisphere`/`usePerisphere`） |
| US-33（コア非依存アダプタ分離） | Step 1-1（`@perisphere/core` のみに依存する `package.json`）、パッケージ全体の構成 |

## 完了条件

- 上記 Step 1〜5、7 の全チェックボックスが `[x]`（Step 6 は該当なし）
- `pnpm -r build` / `pnpm -r test` / `pnpm -r lint` が green
- 生成コードが `business-rules.md`（BR-H-01〜11）・`nfr-design-patterns.md`（RP-H-1, LC-H-1, LC-H-2）・`logical-components.md`（L1〜L5）の決定と矛盾しない（本ステージでの発見による実装上の refinement を除く。差異は `code-summary.md` に記録する）
- UoW-A〜G の既存テストが引き続き green（既存動作への回帰がないこと）
