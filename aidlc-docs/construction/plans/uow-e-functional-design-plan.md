# Functional Design Plan — UoW-E ギャラリー

- **関連 Issue**: [#40](https://github.com/AtsutoNakayama/perisphere/issues/40)
- **作成日**: 2026-08-03
- **前提資料**: `inception/application-design/unit-of-work.md`（UoW-E 節）、`components.md`（C8）/`component-methods.md`（C8 `Gallery` 擬似定義）/`services.md`（S5 `NavigationService`）、`requirements.md`（FR-11, FR-12）、`user-stories/stories.md`（US-23, US-24）、UoW-A/UoW-B/UoW-D 実装（`packages/core/src/viewer/`, `packages/core/src/loader/`, `packages/core/src/interaction/`）

**本ファイルは Functional Design（Part 1: 計画）の単一の情報源である。**

## ユニットコンテキスト

- **責務**: 写真リスト管理（`setPhotos`）、`next()`/`prev()`/`goTo(index)` によるインデックス移動、リスト端での挙動（ループ方針）、写真切替時のロード起動（既存 `Loader`/`ImageSourceAdapter` パイプラインの再利用）と `photochange` イベント発火
- **担当ストーリー**: US-23（ギャラリー API）、US-24（標準ギャラリー UI。ただし UI 自体の実装は UoW-G の範囲で、本ユニットは UI が使う API・データモデルのみ）
- **依存ユニット**: UoW-A（`EventBus`/`ViewerState`/`ViewerHandle` 基盤、マージ済み）、UoW-B（画像ロードパイプライン。`Loader.validate`/`Loader.load`/`ImageSourceAdapter`、マージ済み）
- **既存の型・IF（変更しない前提）**: `ImageInput = string | Blob`（`loader/types.ts`）、`ViewerEventMap`（`photochange: { index: number; id?: string }` は Inception 承認済みの型のまま）

## 技術的な背景整理（レビュー時に確認いただきたい前提）

- `packages/core/src/interaction/types.ts` の `InputIntent`（`photoNext`/`photoPrev`）と `Keymap`（`photoPrev: ["PageUp"]`/`photoNext: ["PageDown"]`）は UoW-D で先行実装済み。しかし `createViewer.ts` の `handleInputIntent` 内では次のように意図的に no-op になっている:

  ```ts
  case "photoNext":
  case "photoPrev":
  case "toggleFullscreen":
    // BR-D-16: UoW-E（ギャラリー）/UoW-F（フルスクリーン）が未実装のため安全に無視する。
    break;
  ```

  本ユニットでは `photoNext`/`photoPrev` を `Gallery`（`next()`/`prev()`）へ結線する（`toggleFullscreen` は UoW-F の範囲のまま）。
- `component-methods.md` は `PhotoInput` 型を `setPhotos(photos: PhotoInput[]): void` 等で**参照のみ**しており、実体は未定義。本ステージで確定する。
- `services.md` は S5 `NavigationService` を「C8 Gallery + S2 LoadingService」と定義し、処理フローを「`next`/`prev`/`goTo` → `NavigationService`/`LoadingService` が適切な `ImageSourceAdapter.canHandle` を選択 → `Loader.validate` → 取得/デコード（`progress` 発火）→ テクスチャ生成 → `Renderer` 反映 → `photochange` 発火」と定めている。既存の `createViewer.ts` 内 `loadImage()` はこのパイプライン（`currentAbortController` によるキャンセル制御 `BR-B-08` を含む）を既に実装済みであり、`Gallery` 経由の写真切替もこれを再利用する想定。
- `component-methods.md` の C8 `Gallery` 擬似定義は `next()`/`prev()`/`goTo()` が**同期的に新 index を返す**純粋なインデックス計算クラスとして書かれている（`class Gallery { next(): number; ... }`）。これは UoW-D の `ViewController`（純粋な視点計算）と `InputManager`/`createViewer`（実際の副作用の実行）の責務分離パターンと同じ設計思想であり、本ユニットでも踏襲する: `Gallery` はインデックス計算のみを担当し、実際の画像ロード起動・イベント発火は `createViewer` 側のオーケストレーションが担う。
- `getPhotoIndex()` は `setPhotos()` 未呼び出し時（写真リスト未設定）は `-1` を返す（JS 配列の `indexOf` 未検出時の慣習に合わせる）。この点は自明性が高いためアンケート化せず、本ステージの既定仕様として明記する。

## 確認質問（比較情報・推奨案を埋め込み済み）

### Q1. `PhotoInput` 型の定義

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `PhotoInput = ImageInput \| { src: ImageInput; id?: string }`（生の `ImageInput` を直接渡せる利便性 + オプションで `id` 指定も可能なユニオン型） | `ImageInput` 自体が `string \| Blob` というシンプルな型であり、多くの利用シーン（`setPhotos(['a.jpg', 'b.jpg'])` のような単純な複数写真配列）で `id` を省略して直感的に書ける。`photochange` イベントの `id` は Inception 時点で既に `optional`（`{ index: number; id?: string }`）として確定済みであり、`id` を省略できるユニオン型と整合する |
| B | `PhotoInput = { src: ImageInput; id?: string }`（常にオブジェクト形式に統一） | シンプルさ・将来のフィールド追加のしやすさはあるが、`id` 不要な単純ケースでも `{ src: ... }` のラップを常に書かせることになり、A に比べて冗長 |
| C | UoW-G（ControlsUI）のサムネイル表示も見据え、`{ src: ImageInput; id?: string; thumbnail?: ImageInput; label?: string }` を今のうちに定義 | サムネイル/ラベルは UoW-G（同梱 UI）が必要になった時点でオプションフィールドとして非破壊的に追加できる（`PhotoInput` はどの案でも拡張用にオブジェクト形式の分岐を持つ）。本ユニットの責務外の項目を先取りして定義するのは過剰設計（YAGNI）で、CLAUDE.md の「hypothetical future requirements のために設計しない」方針に反する |

**採用理由**: `id` を省略できる利便性を優先しつつ、`photochange` イベントの既存の型（`id?: string`）とも整合する A を採用する。UoW-G で thumbnail 等が必要になった時点で、オブジェクト形式の分岐に非破壊的にフィールド追加すればよい。

[Answer]: A

### Q2. リスト端での `next()`/`prev()` の挙動（ループ方針）

`unit-of-work.md`（UoW-E 節）は「端でのループ方針」を本ユニットで確定する事項として明記している。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | ループする（末尾で `next()` → 先頭（index 0）に戻る、先頭で `prev()` → 末尾に戻る） | 複数写真を巡回的に閲覧する「ギャラリー/カルーセル」的 UX として一般的で直感的。US-18（矢印キーでの写真送り）のような連打操作でも「端で止まって反応がなくなる」という戸惑いを生まない |
| B | クランプする（末尾で `next()` は末尾のまま変化なし、先頭で `prev()` も同様） | 「リストの終わり」を明示的に感じさせたい用途では妥当だが、US-23 の受け入れ基準は挙動の存在のみを求めており、クランプを積極的に選ぶ理由は薄い |
| C | `setPhotos(photos, { loop?: boolean })` のようにオプションで利用側が選べるようにする | API 表面積が増え、本ユニットの初期スコープに対して過剰。将来必要になった場合も `Partial` オプション引数の追加は非破壊的に可能なため、今は最小限の A に絞る（YAGNI） |

**採用理由**: 巡回的なギャラリー UX が一般的であり、US-18 のような連続操作でも一貫した反応を維持できる A を採用する。将来的な設定可能化（C）は非破壊的に追加できるため今は見送る。

[Answer]: A

### Q3. 写真未設定（空リスト／`setPhotos` 未呼び出し）時に `next()`/`prev()`/`goTo()` を呼んだ場合の挙動

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 安全に no-op とする（エラーなし、状態も変化しない） | `ViewerHandle` 全体で「致命的でない状態不整合は安全な no-op で吸収する」方針が一貫している（例: 縮退ハンドルでの各種 no-op、`BR-D-16` の `photoNext`/`photoPrev` 意図的 no-op）。写真リストが空なのは「明確な誤入力」というより単なる未設定状態であり、`error` を出すほどの利用者ミスとは言えない |
| B | `error` イベント（`INVALID_INPUT`）を発火する | `setView`/`setZoomLimits` の不正値と同様の「明示的な誤り入力」への対応パターンと一貫させる考え方もあるが、写真未設定は「値の間違い」ではなく「まだ設定していないだけ」であり性質が異なる |
| C | 例外を `throw` する | 他の `ViewerHandle` API（`loadImage` の reject を除く）は同期呼び出しで例外を投げない設計方針（`setMode`/`setView`/`setZoomLimits` はいずれも `error` イベントで通知し例外は投げない）と矛盾する |

**採用理由**: 既存の `BR-D-16`（未実装機能への配線は安全な no-op で吸収する）という設計方針と一貫させ、A を採用する。

[Answer]: A

### Q4. `goTo(index)` の範囲外指定（負数・リスト長以上）

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `error` イベント（`INVALID_INPUT`）を発火し、インデックスは変更しない | `setView`/`setZoomLimits` は既に「不正値は反映せず `error`（`INVALID_INPUT`）を発火する」という確立済みパターン（`BR-D-10`/`BR-D-11`）を持つ。`goTo` への範囲外指定も同種の「明示的な誤り入力」であり、同じパターンを踏襲することで API 全体の一貫性を保てる |
| B | クランプする（負数は `0`、リスト長以上は末尾にクランプ） | 実装は単純だが、呼び出し側の誤り（例: リスト長を勘違いした index 指定）を静かに握りつぶしてしまい、デバッグ時に気づきにくい |
| C | ループする（`index` をリスト長で正規化する。例: `index % length`） | `next()`/`prev()` の「端の巡回」（Q2）と混同しやすく、`goTo` という「明示的な位置指定」の意味論としては直感に反する（利用者が指定した index と実際に表示される index が乖離する） |

**採用理由**: 既存の `setView`/`setZoomLimits` と同じ「不正な明示値は反映せず `error` で通知する」パターンを踏襲する A を採用する。

[Answer]: A

### Q5. 写真切替のロード成功/失敗と `index`/`photochange` 発火タイミング

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | ロード成功後に `index` と `photochange` を確定・発火する。ロード失敗時は `error` イベントのみ発火し、`index` は変更せず直前の写真をそのまま維持する | 既存の `loadImage()` の失敗時挙動（`BR-B-11`: 「`Renderer.setSphereTexture` を呼ばないため、直前の表示がそのまま維持される」）と対称的な一貫性を持つ。US-23 の受け入れ基準（「対応する写真へ切り替わり、写真切替イベントが発火する」）も成功を前提とした記述であり、既存の Resiliency 方針（NFR-11、失敗時は安全に縮退）とも合致する |
| B | 呼び出し直後に楽観的に `index`/`photochange` を発火し、ロードは非同期でバックグラウンド実行する（失敗時も `index` は戻さない） | `getPhotoIndex()` が指す index と実際に表示されているテクスチャが一致しない状態が生じうる（ロード失敗時に index だけ進んでいるのに画面は旧写真のまま）。UoW-G（同梱 UI）がこの index を見てサムネイル選択状態等を描画する際に不整合の原因になる |

**採用理由**: 既存の `loadImage()`（`BR-B-11`）と対称的な「成功確定後に状態を更新する」方式を踏襲し、`index` と実際の表示内容の整合性を保証する A を採用する。

[Answer]: A

### Q6. 写真切替中（ロード中）に連続して `next()`/`prev()`/`goTo()` が呼ばれた場合の挙動

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 既存の `loadImage()` と同じ `AbortController` 方式を再利用し、最新呼び出しが常に優先される（前回のロードは中断、`BR-B-08` と同じ） | 実装をそのまま再利用でき一貫性が高い。矢印キー連打（US-18）で素早く複数回切替が呼ばれても、最終的に落ち着いた写真だけが表示される直感的な挙動になる |
| B | 前回のロード完了までキューイングし、順番に処理する | 連打した回数分のロードが逐次実行され、利用者が最後に選んだ写真にたどり着くまで無関係な中間の写真が一瞬ずつ表示され続け、直感に反する上に無駄な帯域消費が生じる |
| C | ロード中は追加の切替呼び出し自体を無視する | 連打操作の大部分が無視されてしまい、UX として「反応が悪い」という印象を与える |

**採用理由**: 既存の `loadImage()` のキャンセル制御（`BR-B-08`）をそのまま再利用でき、実装の一貫性とシンプルさ、UX の両面で最も妥当な A を採用する。

[Answer]: A

### Q7. `setPhotos()` 呼び出し時の初期表示・ロード開始

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `setPhotos()` 呼び出し時に `index` を `0` にリセットし、1 枚目の写真の内部ロードを自動的に開始する（`next`/`prev`/`goTo` と共通の内部ロード関数を呼ぶだけ） | `component-methods.md` の `setPhotos(photos: PhotoInput[]): void` と US-23 の文脈（「写真リストを設定 / When `next()`/`prev()`/インデックス指定を呼ぶ」）を素直に読むと、設定直後から何らかの写真が表示されている状態が期待される。何も表示されないまま `next()` を待つのは、`loadImage()` 単体呼び出し時の体験（呼べば即座にロードが始まる）と非対称で利用者の直感に反する |
| B | `setPhotos()` はリストの登録のみ行い、実際のロードは `next()`/`prev()`/`goTo()` の明示呼び出しを待つ | リスト設定だけでは何も画面に表示されないため、組み込み開発者が「設定したのに何も映らない」と誤解しやすい |
| C | 直前に `loadImage()` で個別ロード済みの画像があれば、それを 1 枚目とみなし `setPhotos()` では何もロードしない | `loadImage()` で読み込んだ画像と `photos[0]` が同一画像である保証がなく、暗黙の対応関係を仮定するのは危険（Q8 で `loadImage()` と `setPhotos()` の関係を別途整理する） |

**採用理由**: `loadImage()` 単体呼び出しと対称的に「呼べば表示される」という一貫した体験を提供する A を採用する。内部実装は Q5/Q6 と共通の「ロード確定後に index/`photochange` を更新する」関数を `index=0` で呼ぶだけで済み、追加の複雑性は小さい。

[Answer]: A

### Q8. `setPhotos()` と既存 `loadImage()`/`registerSource` との関係

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 独立した機能として共存を許容する。`registerSource` で登録したアダプタは `setPhotos` 経由のロードにも同じパイプラインでそのまま適用される。`setPhotos()` 呼び出し後に `loadImage()` を直接呼ぶと、`Gallery` の index 追跡外で画像を差し替えることになる点は実装上の相互排他制御をせず、TSDoc で「`Gallery` の index 管理外になる」と明記するに留める | `loadImage()` は元々単一画像用途の独立 API（UoW-B）であり、`Gallery`（複数写真管理、UoW-E）はその上に積む追加レイヤー。相互排他のガード（例: 状態フラグ管理）を追加すると複雑性が増す一方、実際に両方を混在させて呼ぶシナリオは考えにくく、過剰な防御はYAGNIに反する。`registerSource` は「入力フォーマットの解釈方式」というグローバルな拡張点であるため、単一画像・複数写真いずれの経路でも同じ挙動が自然 |
| B | `setPhotos()` 呼び出し後は `loadImage()` の直接呼び出しを禁止し、呼ばれた場合は `error`（`INVALID_INPUT`）を発火する | 実装・テストの複雑性が増す割に、両者を混在させる正当なユースケースを想定しづらく、防御的すぎる |

**採用理由**: `loadImage()`（単一画像）と `Gallery`（複数写真管理）を独立したレイヤーとして扱いつつ、共通の画像ロードパイプライン（`Loader`/`registerSource` によるアダプタ拡張）は両方から等しく再利用する A を採用する。

[Answer]: A

## 比較検討サマリ

判断軸: (1) 既存の UoW-A/UoW-B/UoW-D で確立済みの設計パターン（安全な no-op、`error`(`INVALID_INPUT`) による不正値通知、`AbortController` によるキャンセル制御、純粋計算層とオーケストレーション層の分離）との一貫性を最優先する、(2) Inception で承認済みの公開 IF（`ViewerEventMap`, `InputIntent`, `Keymap`）は変更しない、(3) `unit-of-work.md` が本ユニットでの確定を明記した「端でのループ方針」を明示的に決定する、(4) 本ユニットの責務外（UoW-G のサムネイル UI 等）を先取りした過剰設計は避ける。

## 次のステップ（Step 6: 成果物生成、承認後）

- [ ] `aidlc-docs/construction/uow-e/functional-design/domain-entities.md`
- [ ] `aidlc-docs/construction/uow-e/functional-design/business-rules.md`
- [ ] `aidlc-docs/construction/uow-e/functional-design/business-logic-model.md`
