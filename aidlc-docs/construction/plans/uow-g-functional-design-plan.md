# Functional Design Plan — UoW-G 同梱コントロール UI

- **関連 Issue**: [#44](https://github.com/AtsutoNakayama/perisphere/issues/44)
- **作成日**: 2026-08-03
- **前提資料**: `inception/application-design/unit-of-work.md`（UoW-G 節）、`components.md`（C10）/`component-methods.md`（C1 `ViewerHandle` の `setControlsVisibility`/`setText`）/`services.md`（S6 `PresentationControlService`）、`requirements.md`（FR-12, FR-14, FR-15, NFR-04）、`user-stories/stories.md`（US-24, US-26, US-27, US-35）、UoW-A/UoW-C/UoW-D/UoW-E/UoW-F 実装（`packages/core/src/viewer/`, `modes/`, `interaction/`, `gallery/`, `fullscreen/`）

**本ファイルは Functional Design（Part 1: 計画）の単一の情報源である。**

## ユニットコンテキスト

- **責務**: 素 DOM（フレームワーク非依存）によるフルスクリーン／ズーム／モード切替／写真切替＋インジケーターの同梱コントロール UI（`ControlsUI`）。個別の表示/非表示、スタイルカスタマイズ、全体無効化（ヘッドレス）、文言・aria-label 差し替え、フォーカス管理。
- **担当ストーリー**: US-26（標準コントロール UI 同梱：表示/非表示・スタイル・ヘッドレス）、US-27（UI 文言・aria-label の差し替え）、US-35（アクセシビリティ：キーボード完結・フォーカス・ARIA）。補足で US-24（サムネ/インジケーターの表現形式・個別非表示）にも本ユニットが関与する。
- **依存ユニット**: UoW-A（`EventBus`/`ViewerState`/`ViewerHandle`/`DisposableRegistry`）、UoW-C（`listModes`/`registerMode`）、UoW-D（`Keymap`/`KeyboardInputSource`）、UoW-E（`Gallery`/`setPhotos`/`next`/`prev`/`goTo`）、UoW-F（`enterFullscreen`/`exitFullscreen`/`isFullscreen`）。いずれも main にマージ済みのため、全イベント・API が出揃った状態で着手できる。
- **既存の型・IF（Inception で確定済み・変更しない前提）**: `ViewerHandle.setControlsVisibility(config: Partial<ControlsVisibility>): void` / `setText(overrides: Partial<UITextMap>): void`（`component-methods.md`）。`ControlsVisibility`/`UITextMap` 自体の詳細な型は Inception では未確定で、本ステージ（Q2, Q7）で確定する。

## 技術的な背景整理（レビュー時に確認いただきたい前提）

- `packages/core/src/` に `ui/` ディレクトリはまだ存在しない（新規追加）。`ViewerHandle`（`packages/core/src/viewer/types.ts`）に `setControlsVisibility`/`setText` は未追加。`ViewerOptions` は現時点で `[key: string]: unknown` のプレースホルダ型のみで、同梱 UI の初期表示可否を渡す正式なフィールドがない。
- **フォーカス関連の既存制約（BR-D-17）**: `KeyboardInputSource` は `container` に `tabindex="0"` を付与し、**`container` 自体がフォーカスされているときのみ** `keydown` を処理する。`ControlsUI` の DOM は `container` 配下に構築される想定のため、コントロールのボタンをクリックするとフォーカスがそのボタンへ移り、以後キーボードショートカット（pan/tilt/zoom/写真切替/フルスクリーン）が `container` の再フォーカスまで効かなくなる。この相互作用への対処方針を Q8 で確定する。
- **発見したギャップ（写真総数の非公開）**: `Gallery`（`packages/core/src/gallery/Gallery.ts`）は内部に `photos` 配列を保持するが、`ViewerHandle` には `getPhotoIndex()` のみ存在し総数を返すメンバーがない。`ViewerEventMap.photochange` のペイロード（`{ index: number; id?: string }`）にも総数は含まれない。写真インジケーター（「n / 総数」やインデックス分のボタン列）を描画するには総数が必須であり、本ステージで IF を拡張する（Q5）。
- **`PhotoInput`/`ImageInput` の型制約**: `ImageInput = string | Blob`。実サムネイル画像（`<img>`）を描画する場合、`Blob` はそのままでは `src` にできず `URL.createObjectURL()` が必要になる。加えて `string`/`Blob` いずれも「オリジナル解像度（最大 8K 想定・NFR-01）」であり、縮小サムネイル生成パイプラインは Inception のどの FR/NFR にも存在しない。この制約は Q6（写真ナビ UI の表現形式）に直結する。
- **モード動的登録の非通知**: `registerMode()`（UoW-C）は呼び出し時に何のイベントも発火しない。`ControlsUI` 構築後に呼び出し側が独自モードを登録した場合、モード切替 UI の選択肢が古いままになりうる。対処方針を Q4 で確定する。
- SSR セーフティ（`component-dependency.md` 既定方針）: `document`/`window` 等ブラウザ API への参照は module トップレベルでは行わず、`createViewer` のクライアント初期化以降に限定する（C3/C9/C10 共通の既存方針を踏襲）。

## 確認質問（比較情報・推奨案を埋め込み済み）

### Q1. DOM 構造・スタイル分離方式

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | Shadow DOM は使わず、`container` 配下に `<div class="perisphere-controls">` をルートとして追加する（Light DOM）。内部要素は `perisphere-controls__*` の BEM 風クラス名で命名衝突を避ける。スタイルは通常の `<style>` 要素（Q9）で定義し、呼び出し側は同じクラス名や CSS カスタムプロパティを上書きしてスタイルカスタマイズできる | FR-14「スタイルをカスタマイズできる」を素直に満たせる。Shadow DOM のような外部からの到達性の壁がなく、呼び出し側は通常の CSS 上書きだけでスタイル変更できる。命名衝突は名前空間クラスで実務上十分に回避できる |
| B | Shadow DOM（`attachShadow({ mode: 'open' })`）でカプセル化する | ホストページの CSS と完全に分離できるが、外部からのスタイルカスタマイズが `::part`（要素ごとに `part` 属性の作り込みが必要）や CSS カスタムプロパティ経由に限定され、FR-14 の要件を単純には満たしにくい。実装コストも増える |

**理由**: スタイル分離の堅牢さと、呼び出し側からの上書きやすさ（FR-14 の必須要件）はトレードオフの関係にあるため確認する。

**採用理由**: FR-14 の「スタイルをカスタマイズできる」を最優先し、A（Light DOM + 名前空間クラス）を採用する。

[Answer]: A
### Q2. `ControlsVisibility` の型粒度とヘッドレス指定方法

FR-14 は「コントロールは個別に表示/非表示を設定でき」「全体を無効化したヘッドレス利用」の両方を要求する。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `ViewerOptions.controls?: boolean \| Partial<ControlsVisibility>` を新設する。`false` は完全ヘッドレス（`ControlsUI` 自体を構築せず DOM/スタイル注入も行わない）、省略または `true` は全コントロール表示、部分オブジェクトは個別指定（未指定キーは表示扱い）とする。`ControlsVisibility` は `{ fullscreen?: boolean; zoom?: boolean; modeSwitch?: boolean; photoNav?: boolean; photoIndicator?: boolean; }` の5グループ（`photoNav`=前後ボタン、`photoIndicator`=インジケーター、を分離） | FR-14 の「個別に表示/非表示」の粒度要求と「ヘッドレス」要求の両方を、1つのオプションで自然に表現できる。ヘッドレス時は `ControlsUI` を構築しないため、不要な DOM/スタイル注入コストも発生しない |
| B | `photoNav` と `photoIndicator` を1つの `gallery` キーに統合し4グループのみとする | UI はシンプルになるが、US-24（サムネ/インジケーターの個別非表示）や FR-14 の粒度要求をやや切り捨てることになる |

**理由**: グループの粒度（5分割 vs 4分割）は今後の API 安定性に関わるため確認する。

**採用理由**: FR-14/US-24 が要求する粒度を満たす A を採用する。

[Answer]: A
### Q3. 該当データがない場合の自動非表示ルール

`modeSwitch`（登録モードが1種のみ）や `photoNav`/`photoIndicator`（写真が0〜1枚）は、`ControlsVisibility` で表示指定されていても実質的に無意味・無機能になりうる。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `ControlsVisibility` で表示指定されていても、`listModes().length <= 1` のときは `modeSwitch` を、写真総数（Q5）`<= 1` のときは `photoNav`/`photoIndicator` を自動的に非表示にする。該当イベント（`modechange` は発火しないため `registerMode` 呼び出しのタイミングは Q4 の方式に従う。写真総数変化は `photochange`/`setPhotos` 相当のタイミングで再評価）ごとに再評価する | 選択肢が1つしかないモード切替 UI や、1枚しかない写真の送りボタンは操作しても何も起きず、利用者を混乱させるだけの UI ノイズになる。自動非表示は一般的な UI ライブラリの慣行でもある |
| B | `ControlsVisibility` の指定どおりに常に表示する（該当データの有無は考慮しない） | 実装は単純だが、無意味な UI 要素が常に表示され続ける。特に `photoNav`/`photoIndicator` は写真が1枚も設定されていない初期状態（`getPhotoIndex() === -1`）でも表示されてしまい、`goTo`/`next`/`prev` を呼んでも何も起きない状態になる |

**理由**: 明示的な表示指定と、実データに基づく自動非表示のどちらを優先するかは利用者体験に直結するため確認する。

**採用理由**: 利用者体験を優先する A を採用する。「明示的に非表示」（`false`）と「表示指定だが該当データなしで自動非表示」を区別し、後者は該当データが増えれば自動的に再表示される。

[Answer]: A
### Q4. モード切替 UI の表現形式・`registerMode()` 後の反映方法

登録モードは同梱 7 種 + カスタム登録（`registerMode`、上限なし）のため、選択肢数が可変。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | ネイティブ `<select>` 要素を使用する。オプション一覧は `pointerdown`/`focus` イベント（ドロップダウンが開く直前）のたびに `listModes()` を再取得して再構築する。新規イベントの追加は行わない | `<select>` はモード数の増減に関わらずスケールし、ネイティブのキーボード操作・スクリーンリーダー対応を無償で得られる（NFR-04 と相性が良い）。「操作直前に毎回最新化」する遅延構築方式は、`registerMode()` にイベント発火という新しい公開 API 面を追加せずに反映漏れを解消できる |
| B | 構築時（`ControlsUI` 生成時）の `listModes()` 一回のみを反映する。以降の `registerMode()` 呼び出しはモード切替 UI に反映されない仕様上の制約として明記する | 実装は最も単純だが、典型的な利用パターン（`createViewer()` 直後に `registerMode()` でカスタムモードを追加する）で UI が古いままになる既知の不具合を抱えたまま出荷することになる |
| C | `ViewerEventMap` に新規イベント（例: `modesregistered`）を追加し、`registerMode()` 呼び出し時に発火。`ControlsUI` はこれを購読して都度再構築する | 「常に最新」を保証できるが、`registerMode()`（UoW-C 実装済み・本ユニットのスコープ外）への変更と新規公開イベントの追加を要し、UI 表示更新のためだけに他ユニットの確定済み API 面を広げることになり、影響範囲が本ユニットを超える |

**理由**: 「常に最新の選択肢を保証する」ことと「他ユニットの確定済み API への影響を避ける」ことのトレードオフのため確認する。

**採用理由**: 新規公開 API を追加せずに反映漏れを解消できる A を採用する。

[Answer]: A
### Q5. 写真総数を `ControlsUI` へ供給する方法（発見したギャップへの対応）

「技術的な背景整理」の通り、`ViewerHandle` には写真総数を返すメンバーがなく、`photochange` ペイロードにも含まれない。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `ViewerHandle` に `getPhotoCount(): number` を追加する（`Gallery` の内部配列長へ委譲）。加えて `ViewerEventMap.photochange` のペイロードに `total: number` を追加する | 既存の `progress: { loaded, total }` と同じ「変更イベントのペイロードに必要な情報を含める」パターンに一貫する。`ControlsUI` は `photochange` 受信のたびに追加の呼び出しなく総数を得られ、初期表示は `getPhotoCount()` で取得する |
| B | `getPhotoCount()` のみ追加し、`photochange` ペイロードは変更しない。`ControlsUI` は `photochange` 受信のたびに `getPhotoCount()` を呼んで補う | 実害はほぼないが、他イベント（`progress`）が確立したペイロード設計パターンとの一貫性がやや劣る |
| C | 追加せず、`setPhotos()` を呼ぶ利用者側が写真総数を別途 `ControlsUI` 向けに渡す専用 API を用意する | `unit-of-work.md` が定める「`ControlsUI` は `EventBus` 購読のみの疎結合」という設計方針に反し、利用者に状態の二重管理を強いる |

**理由**: 型公開 IF（`ViewerHandle`/`ViewerEventMap`）への非破壊的な追加だが、明示確認すべき事項のため質問とする。

**採用理由**: 既存パターンとの一貫性を優先する A を採用する。

[Answer]: A
### Q6. 写真ナビゲーション/インジケーター UI の表現形式

US-24 の受け入れ基準は「サムネイル/インジケーターを操作する→対応写真へ切り替わる」ことを要求しており、単なる読み取り専用の「n / 総数」表示では満たせない（操作可能である必要がある）。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | インジケーターを「写真枚数と同数のボタン列（番号または点）」として実装し、各ボタンのクリックで対応 `index` へ `goTo()` する。実サムネイル画像（`<img>` によるプレビュー）は本ユニットではレンダリングしない | FR-12「サムネイル一覧**または**ページインジケーター**等**」の後者を採用する。実画像を縮小プレビュー目的で読み込むと、UoW-E のオンデマンドロード方針・NFR-01（8K 想定の性能方針）に反する。ボタン列はクリックで直接 `goTo()` でき、US-24 の受け入れ基準（操作可能）を満たす |
| B | `PhotoInput` が `string`（URL）の場合のみ `<img loading="lazy">` で実サムネイルを表示し、`Blob` の場合は番号ボタンにフォールバックする | 写真の入力形式によって表示形式が変わり一貫性を欠く。`string` の場合も実際にはブラウザが元画像（最大 8K 想定）を丸ごとダウンロード・デコードすることになり（`loading="lazy"` は表示タイミングの遅延であり解像度は縮小しない）、NFR-01 との相性が悪い |
| C | 常に実サムネイル（元画像を `<img>` で縮小表示）を表示する | 写真枚数が多い場合に大量の元画像を同時ダウンロードすることになり性能・帯域面で問題が大きい。専用の縮小サムネイル生成パイプラインは Inception のどの FR/NFR にも要求がなく、本ユニットのスコープ外 |

**理由**: 「サムネイル」という言葉から実画像プレビューを連想しやすいが、性能方針（NFR-01・UoW-E オンデマンドロード）との整合を優先すべきか確認する。

**採用理由**: 性能方針を優先し、FR-12 が明示的に許容する代替表現である A（インジケーター）を採用する。

[Answer]: A
### Q7. `UITextMap` の型設計（文言・aria-label 差し替え）

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 全項目を文字列のみとし、動的な値（現在位置/総数等）は `{current}`/`{total}` のようなプレースホルダトークンを本文に埋め込み、`ControlsUI` 側で単純な文字列置換を行う。例: `photoIndicatorLabel: "Photo {current} of {total}"`。既定値は英語文字列を内蔵し、`setText()`/`ViewerOptions.text` で部分上書き（FR-15） | 公開 API の型が関数を含まない単純な文字列マップに保てるため、シリアライズ・宣言的な設定（JSON 的な props 等）と相性が良い。i18n ライブラリのメッセージテンプレートと同じ慣行でわかりやすい |
| B | 動的な値が必要な項目は関数値（例: `(current: number, total: number) => string`）として定義する | 任意の書式（複数形処理等）を自由に実装できる柔軟性はあるが、公開オプション型に関数を含めることになり、React props 等での宣言的な受け渡しは可能なものの、シンプルな文言差し替えという FR-15 の要求に対してはオーバースペック |

**理由**: 公開型の設計方針（文字列のみ vs 関数許容）は今後の互換性に関わるため確認する。

**採用理由**: シンプルさと FR-15 の要求範囲を優先する A を採用する。

[Answer]: A
### Q8. コントロール操作後のフォーカス返却（BR-D-17 との相互作用）

「技術的な背景整理」の通り、`ControlsUI` のボタンをクリックするとフォーカスが `container` から外れ、以後キーボードショートカットが効かなくなる。

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 単発アクション系ボタン（フルスクリーン切替・ズームイン/アウト・写真前後・インジケーター）はクリックハンドラの末尾で `container.focus()` を呼び、フォーカスを `container` に戻す。モード切替 `<select>`（Q4）は持続的なフォームコントロールのため対象外とし、標準どおり `<select>` 自身にフォーカスを残す | クリック直後にキーボードショートカット（pan/tilt/zoom/写真切替/フルスクリーン）がそのまま使え、マウスとキーボードを行き来する利用者にとって自然。NFR-04（キーボードのみで主要操作が完結）の意図をポインタ操作後も途切れさせない |
| B | 何もしない（標準のブラウザのフォーカス挙動に任せる） | 実装は最小だが、ボタン操作直後にキーボードショートカットが効かなくなり、`container` を再度クリックするか Tab で戻る必要がある。マウス/キーボード混在利用者にとって不自然な体験になる |
| C | `KeyboardInputSource` の購読先を `container` から `document`/`window` に変更し、フォーカス位置に依存しない常時グローバル監視にする | UoW-D の確定済み設計（BR-D-17: フォーカス時のみ処理）を本ユニットの都合で変更することになり、影響範囲が UoW-G を超える。ページ内に複数の入力コンポーネントがある場合にキー入力が意図せず衝突するリスクも生まれ、CLAUDE.md の「タスクが要求する以上の設計をしない」方針にも反する |

**理由**: UoW-D の既存設計を変更せずに UX 上の課題を解消できるか、ユニット境界を明確にする必要があるため確認する。

**採用理由**: UoW-D の設計を変更せず、本ユニット内で完結する A を採用する。

[Answer]: A
### Q9. スタイル注入・`dispose()` 時のクリーンアップ方針

| 選択肢 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `ControlsUI` 構築時、同一 `document` にまだ既定スタイル用の `<style id="perisphere-controls-style">` が存在しなければ一度だけ `document.head` に追加する（同一ページに複数ビューワーがあってもスタイルは1つに集約）。コントロール自体の DOM 要素（Q1 のルート `<div>` 以下）はインスタンス単位で構築し、`dispose()` 時に確実に除去する。共有 `<style>` タグは他インスタンスが使用中の可能性があるため `dispose()` では除去しない | 複数ビューワーインスタンスが同一ページに存在する場合でも CSS 注入が重複しない。要素側は各インスタンスの `Disposable`（NFR-10・既存方針）に従い確実に解放される。共有スタイルタグを残す副作用は無害（次回同ページ内で別インスタンスが再利用できる） |
| B | 各インスタンスが専用の `<style>` タグを自身の DOM 配下に個別に持ち、`dispose()` 時に丸ごと除去する | 各インスタンスが完全に自己完結してクリーンになるが、同一ページに複数ビューワーがある場合に同一 CSS テキストが重複注入される |

**理由**: 単一ページに複数ビューワーインスタンスを埋め込むケース（NFR-08 の被埋め込み方針）での CSS 重複を避けるか、インスタンスごとの完全な自己完結性を優先するかの判断のため確認する。

**採用理由**: 被埋め込み方針（NFR-08）を踏まえ、複数インスタンス時の重複注入を避けられる A を採用する。

[Answer]: A
## 比較検討サマリ

判断軸: (1) 既存の UoW-A/C/D/E/F で確立済みの設計パターン（`Disposable` による確実な解放、イベントペイロードに必要な情報を含める、SSR セーフティ、ユニットの責務境界を超えない）との一貫性を最優先する、(2) FR-12/14/15・NFR-04 の受け入れ基準（個別表示/非表示・スタイルカスタマイズ・ヘッドレス・文言差し替え・キーボード完結・フォーカス管理）を確実に満たす、(3) UoW-E のオンデマンドロード方針・NFR-01 の性能方針（8K 想定）と矛盾する実装（サムネイル画像の安易な読み込み等）を避ける、(4) 本ステージで発見したギャップ（写真総数の非公開、BR-D-17 とのフォーカス相互作用、`registerMode()` の非通知）は本ユニットの責務に必要な最小範囲でのみ解消する。

## 次のステップ（Step 6: 成果物生成、承認後）

- [ ] `aidlc-docs/construction/uow-g/functional-design/domain-entities.md`
- [ ] `aidlc-docs/construction/uow-g/functional-design/business-rules.md`
- [ ] `aidlc-docs/construction/uow-g/functional-design/business-logic-model.md`
- [ ] `aidlc-docs/construction/uow-g/functional-design/frontend-components.md`（`ControlsUI` の DOM 構成・コンポーネント構造）
