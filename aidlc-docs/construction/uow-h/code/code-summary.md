# Code Summary — UoW-H React アダプタ

- **関連 Issue**: [#46](https://github.com/AtsutoNakayama/perisphere/issues/46)
- **作成日**: 2026-08-04
- **単一の情報源**: `aidlc-docs/construction/plans/uow-h-code-generation-plan.md`（全 Step 完了、計画からの逸脱を記載）

## 1. 生成ファイル一覧（新規パッケージ `packages/react`、`@perisphere/react`）

### 1-1. パッケージ構成

| パス | 内容 |
|---|---|
| `package.json` | `dependencies: { "@perisphere/core": "workspace:*" }`、`peerDependencies: { react/react-dom: ">=18.0.0 <20.0.0" }`（`tech-stack-decisions.md` §1）、devDependencies に `react@19.2.8`/`react-dom@19.2.8`/`@testing-library/react@16.3.2`/`eslint-plugin-react-hooks@7.1.1` を追加 |
| `tsconfig.json` | `../../tsconfig.base.json` 継承 + `"jsx": "react-jsx"` |
| `tsup.config.ts` | `packages/core` と同一構成 |
| `vitest.config.ts` | `environment: "jsdom"` + `@perisphere/core` をワークスペースソースへ alias（下記「4」参照） |
| `eslint.config.js` | ルート設定を継承 + `eslint-plugin-react-hooks` の `configs.flat.recommended` |
| `.prettierignore` | `dist/`（下記「4」参照） |

### 1-2. アプリケーションコード（`src/`）

| パス | 内容 |
|---|---|
| `types.ts` | `PerisphereProps`（E1）/`PerisphereHandle`（E2、`ViewerHandle` の全量エイリアス） |
| `internal.ts` | `resolveInitialSource`（BR-H-05）/`extractViewerOptions`（BR-H-08）/`toCallbackPayload`（BR-H-10）/`EVENT_PROP_NAMES`。React/DOM 非依存の純粋関数（L3、LC-H-1） |
| `Perisphere.tsx` | `PerisphereComponent`（実装本体、L1）+ `forwardRef` でラップした公開 `Perisphere`。マウント時初期化（P1）・ref 公開（P2、`createHandleProxy`）・イベントブリッジ（P3、`useEventBridge`）・props 反映（P4）・破棄（P5） |
| `usePerisphere.ts` | `usePerisphere`（L2、E4）。`useRef` のみの薄いラップ |
| `index.ts` | バレルエクスポート（L5） |

### 1-3. テスト（新規）

| ファイル | テスト対象 | 手法 |
|---|---|---|
| `__tests__/internal.test.ts` | `resolveInitialSource`/`extractViewerOptions`/`toCallbackPayload` の不変条件 | fast-check（PBT、`tech-stack-decisions.md` §4） |
| `__tests__/Perisphere.test.tsx` | マウント時の `createViewer` 呼び出し・`className`/`style`・未知 props の透過、`image`/`photos` 優先順位と `loadImage` の Silent Best-Effort（RP-H-1）、ref の即時公開（BR-H-04）、props 変更の参照比較反映（BR-H-06）、イベントブリッジ（stale closure 対策・ペイロード変換、BR-H-09/10）、unmount 時の `dispose`/購読解除（BR-H-11） | example-based（`@testing-library/react` + `vi.mock("@perisphere/core")`、下記「4」参照） |
| `__tests__/usePerisphere.test.tsx` | `{ ref }` の初期値、`<Perisphere ref={ref}>` との統合 | example-based（`renderHook` + `render`） |
| `__tests__/testUtils.ts` | `createMockViewerHandle`（テストヘルパー、成果物ではないがテスト共通基盤） | — |

**テスト結果**: 3 ファイル・29 テスト全て pass（`@perisphere/core` 側 UoW-A〜G の既存 293 件は無変更・回帰なし。合計 34 ファイル・322 テスト）。

## 2. ストーリートレーサビリティ

| ストーリー | 対応箇所 | 状態 |
|---|---|---|
| US-28（React コンポーネント＋フック＋ref 命令ハンドル） | `Perisphere`/`usePerisphere`、宣言的 props と ref 経由の命令的 API の両立（`frontend-components.md`） | ✅ 実装済み |
| US-33（コア非依存アダプタ分離） | `@perisphere/react` は `@perisphere/core` の公開 API のみに依存（`dependencies`）、コア内部への変更ゼロで実装 | ✅ 実装済み |

## 3. 既知の制約・スコープ境界（レビュー時の確認事項）

- **`children` は受け取らない**（`frontend-components.md` の設計判断）: `ControlsUI`（UoW-G）が同じ `container` 配下に自らの DOM を構築するため、任意の子要素をレンダリングする API は提供しない。
- **`controls`/`text` props は初期値のみ反映**（BR-H-07）: 動的に変更したい場合は ref 経由で `setControlsVisibility`/`setText` を呼ぶ必要がある（宣言的 props としての自動反映は行わない、コア側の非対称設計をそのまま踏襲）。
- **`image`/`photos`/`mode` の変更検知は参照比較**（BR-H-06）: インライン配列リテラル（例: `photos={[...]}`）を毎レンダリング渡すと、内容が同じでも毎回再適用される。呼び出し側で `useMemo` 等による安定参照が推奨されるが、本ユニットのスコープでは強制しない。
- **実ブラウザでの操作感確認は未実施**: `@testing-library/react` + jsdom によるテストのみ。SSR（Next.js 等）環境での実際の動作確認は手動確認が必要。

## 4. 計画からの逸脱と理由

1. **`PerisphereProps` を `forwardRef` に直接渡すと全プロパティの型が `unknown` に潰れる問題を発見・回避した**（重要なバグ修正、Code Generation 時点での発見）: `PerisphereProps` は `ViewerOptions`（`[key: string]: unknown` を持つ）を継承しているため `keyof PerisphereProps` が `string` 型に潰れる。React の `forwardRef<T, P>` は内部で `render: ForwardRefRenderFunction<T, PropsWithoutRef<P>>` という型を要求し、`PropsWithoutRef<P>` は `"ref" extends keyof P` を判定してから `Omit<P, "ref">` を計算する条件型である。`"ref" extends keyof P` は `keyof P` が `string` であるため常に `true` と判定され、結果として `Omit<P, "ref">`（`keyof` が一般の `string` 型に対する `Pick`/`Omit`）が計算される。TypeScript は「キーが具体的なリテラルの集合ではなく一般の `string` 型」の `Pick`/`Omit` を、各プロパティの実際の型ではなく索引シグネチャの型（`unknown`）へ潰して解決するため、`forwardRef(function Perisphere(props, ref) {...})` のような無名関数の文脈的型付けでは `props.image`/`props.mode`/`props.className` 等が軒並み `unknown`（または `unknown` を `!== undefined` で絞り込んだ `{} | null`）型になってしまう。回避策として、実装本体を明示的な引数型注釈を持つ**名前付き関数**（`PerisphereComponent(props: PerisphereProps, forwardedRef: Ref<PerisphereHandle>)`）として宣言し、`forwardRef()` へはこの名前付き関数を渡すことで文脈的型付けを経由させず、最終的な公開定数に `ForwardRefExoticComponent<PerisphereProps & RefAttributes<PerisphereHandle>>`（`component-methods.md` の確定済みシグネチャそのもの）を明示注釈する構成に変更した。
2. **ref 公開方式を「`handleRef` の直接返却」から「実行時に遅延委譲する `Proxy`」へ変更した**（重要なバグ修正、Code Generation 時点での発見。`nfr-design-patterns.md`/`logical-components.md` からの実装上の refinement として計画時点で識別済み）: `useImperativeHandle` は内部的にレイアウトエフェクト相当で実行され、マウント処理を行う通常の `useEffect`（`handleRef.current` を設定する処理）より先に発火する。素朴な実装では初回コミット時点の（まだ `null` の）値に `forwardedRef.current` が固定され、以後 `handleRef.current` が更新されても反映されない（ref のミューテーションは再レンダリングを引き起こさないため）。`createHandleProxy(handleRef)` が返す `Proxy` は各メンバーアクセスのたびに `handleRef.current` を実行時に読むため、実行順序に依存せず常に最新のハンドルへ委譲する。
3. **イベントコールバック props の型を `@perisphere/core` の named event 型ではなく `ViewerEventMap["xxx"]` のインデックスアクセスで表現した**: `@perisphere/core` の `index.ts` は `ModeChangeEvent`（`modechange` の型）を re-export していない。インデックスアクセス型を使うことで、コア側の `index.ts` への変更ゼロで実装できた。
4. **`vitest.config.ts` に `@perisphere/core` → ワークスペースソースの `resolve.alias` を追加した**: CI の `test` ジョブ（`.github/workflows/ci.yml`）は `build` ジョブと独立しており `pnpm -r build` を事前実行しないため、通常の `dependencies` 解決（`package.json` の `exports`/`dist/`）では `packages/core/dist/` が存在せず解決に失敗する。ワークスペースソースへの alias により、ビルド成果物に依存せずテストできるようにした（`infrastructure-design.md` の「CI 変更不要」の結論は維持、テスト構成のみの変更）。`dist` 削除後に `pnpm -r test` が green であることを確認済み。
5. **テストは `@perisphere/core` をモジュール境界としてモック化する方針を採用した**: UoW-A が確立した「WebGL 境界（`Renderer`）をモック化する」方針と同じ思想。`vi.mock("@perisphere/core", ...)` で `createViewer` をフェイク `ViewerHandle`（`vi.fn()` 群 + 簡易な `on`/`off` イベントエミュレーション、`testUtils.ts`）に差し替え、本ユニット自身の責務（props↔API のブリッジ、ライフサイクル管理）のみを検証する。
6. **`propsRef.current = props` の代入を、レンダー本体から `useEffect` 内へ移動した**（Code Generation 時点での発見）: `eslint-plugin-react-hooks@7`（React Compiler 対応の新しいルールセット）は「レンダー中の ref ミューテーション」を新設の `react-hooks/refs` ルールでエラーとして検出する。旧来「レンダーのたびに ref へ最新値を代入する」という stale closure 対策の定石パターンが、このルールでは禁止されるため、`useEffect(() => { propsRef.current = props; });`（依存配列なし、毎レンダー後に実行）へ変更した。イベントは非同期にしか発火しないため、コミット後に実行されるこの代入で実用上のタイミング問題は生じない。
7. **`onReady` は引数を渡さず呼び出すよう `toCallbackPayload` 呼び出し側で分岐した**: `toCallbackPayload` が `ready` に対して返す `undefined` をそのまま `callback?.(undefined)` のように渡すと、`onReady: () => void` の呼び出しに明示的な `undefined` 引数が1つ渡ってしまう（実害はないが `BR-H-10` の「引数なし」という記述と厳密には食い違う）。`payload === undefined` の場合は `callback?.()`（引数なし）、それ以外は `callback?.(payload)` を呼ぶよう分岐した。
8. **`packages/react/.prettierignore`（`dist/`）を追加した**: ルートの `.prettierignore`/`.gitignore` はいずれも `dist/` を含むが、`packages/react` を CWD として `prettier --check .` を実行した場合にのみ `dist/` が正しく無視されない現象を確認した（`packages/core` では同じ実行方法で正しく無視される。原因はプロジェクト固有の prettier ignore ファイル探索の挙動によるもので特定には至らなかったが、パッケージローカルな `.prettierignore` を追加することで確実に解決した）。ビルド成果物を lint 対象から除外する目的のみで、実装コードには影響しない。

## 5. 検証結果

- `pnpm -r build`: green（tsup ESM + `.d.ts` 生成成功、`packages/core` → `packages/react` の順にビルドされることを確認）
- `pnpm -r test`: green（34 ファイル・322 テスト。`packages/core/dist`/`packages/react/dist` を削除した状態〔CI の `test` ジョブを再現〕でも green であることを確認）
- `pnpm -r lint`: green（ESLint + Prettier、`eslint-plugin-react-hooks` 含む）
- `pnpm audit --prod`: 既知の脆弱性なし
