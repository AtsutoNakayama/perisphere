# Application Design Plan — perisphere（360°写真 Web ビューワーライブラリ）

- **関連 Issue**: [#21](https://github.com/AtsutoNakayama/perisphere/issues/21)
- **作成日**: 2026-06-29
- **ステータス**: 設計方針回答確定（Q1=A, Q2=B, Q3=C, Q4=A, Q5=D, Q6=A, Q7=A, Q8=A / 曖昧性・矛盾なし）→ 成果物生成中
- **前提資料**: `inception/requirements/requirements.md`、`inception/user-stories/stories.md`、`inception/user-stories/personas.md`

## このステージの目的

高レベルのコンポーネント識別とサービス層（オーケストレーション）の設計を行う。
**詳細なビジネスロジック（投影数式の具体・状態遷移の詳細）は Construction の Functional Design（ユニットごと）で扱う**ため、本ステージでは責務・公開インターフェース・依存関係の確定に集中する。

## 設計対象（要件・ストーリーからの抽出）

- コア（`@perisphere/core`）: ビューワー本体、レンダリング、投影モード、視点操作/入力、ギャラリー、イベント、エラー/破棄、拡張点。
- React アダプタ（`@perisphere/react`）: コンポーネント／フック／ref 命令ハンドル。
- 拡張点（公開 IF）: 入力フォーマットアダプタ、ビューワーモード、入力デバイス、（将来）ツアー/動画オーバーレイ。
- 横断: SSR セーフ、アクセシビリティ、セキュリティ（入力検証・破棄）、レジリエンシー（縮退・コンテキストロスト復帰）。

## 計画ステップ（チェックボックス）

- [x] 1. コンテキスト分析（requirements.md / stories.md を読み、機能領域とコンポーネント境界を抽出）
- [x] 2. 設計方針の確認質問に回答を得る（本書末尾 Q1〜Q8 / 回答: A,B,C,A,D,A,A,A）
- [x] 3. 回答の曖昧性・矛盾を分析（矛盾・曖昧なし。clarification 不要と判断）
- [ ] 4. 成果物生成（承認後）:
  - [ ] `application-design/components.md`（コンポーネント定義・責務・公開 IF）
  - [ ] `application-design/component-methods.md`（メソッドシグネチャ・入出力型・概要。詳細ルールは Functional Design）
  - [ ] `application-design/services.md`（サービス定義・オーケストレーション）
  - [ ] `application-design/component-dependency.md`（依存マトリクス・通信パターン・データフロー）
  - [ ] `application-design/application-design.md`（上記を統合した一枚物）
- [ ] 5. 設計の完全性・一貫性検証（全 FR/NFR・全 US がいずれかのコンポーネント/メソッドにトレースできること）
- [ ] 6. 拡張ルール（Security / Resiliency / PBT）の該当箇所を設計に反映し、コンプライアンス要約を付す
- [ ] 7. 完了メッセージ提示 → ユーザー承認 → aidlc-state.md 更新

---

## 設計方針の確認質問（[Answer]: に英字で回答してください）

> 各設問は本ライブラリの**コンポーネント境界・公開 API 形状・拡張機構**を確定するためのものです。迷う場合は「Other」を選び、自由記述してください。

## Question 1
コア（`@perisphere/core`）のパッケージ分割の粒度はどうしますか？（モノレポ内の物理パッケージ構成）

A) 単一パッケージ `@perisphere/core` に内部モジュール（投影・入力・ギャラリー・UI 等）を内包し、公開は 1 エントリにまとめる（最初はシンプルに）

B) コアを更に細分割（例: `@perisphere/core` + `@perisphere/controls-ui` 等）し、UI 同梱部分やレンダラを別パッケージに分ける

C) コアは単一だが、サブパスエクスポート（`@perisphere/core/ui` 等）で機能群を分けて tree-shaking しやすくする

D) Other（[Answer]: の後に記述）

[Answer]: A

## Question 2
ビューワー本体の公開 API のスタイルはどうしますか？（コア = フレームワーク非依存層）

A) クラスベース（`new Viewer(container, options)`）。メソッド・プロパティで操作

B) ファクトリ関数（`createViewer(container, options)` がハンドルオブジェクトを返す）。内部実装を隠蔽

C) 両方提供（内部はクラス、推奨 API はファクトリ関数）

D) Other（[Answer]: の後に記述）

[Answer]: B

## Question 3
イベント API（FR-17）の購読スタイルはどうしますか？

A) Emitter スタイル（`viewer.on('modechange', handler)` / `off`）。一般的で多イベント向き

B) オプションのコールバック（`createViewer(el, { onModeChange, onError, ... })`）中心

C) 両方（コアは Emitter、React アダプタは props コールバックへブリッジ）

D) Other（[Answer]: の後に記述）

[Answer]: C

## Question 4
拡張機構（入力アダプタ FR-02 / ビューワーモード FR-05 / 入力デバイス）の登録モデルはどうしますか？

A) インスタンス単位の登録（`viewer.registerMode(...)`）。インスタンスごとに独立、副作用が局所的

B) グローバルレジストリ（`registerMode(...)` を import して全インスタンス共有）。プリセット配布が楽

C) 両方（既定はインスタンス単位、必要なら明示的にグローバル登録も可能）

D) Other（[Answer]: の後に記述）

[Answer]: A

## Question 5
ビューワーモード（投影）の実装アプローチの基本方針はどれを中核に据えますか？（高レベル方針。具体数式は Functional Design）

A) シェーダ中心（フルスクリーンクワッド + 全天球テクスチャを GLSL で投影変換）。モード差を主にフラグメントシェーダで表現

B) ジオメトリ/カメラ中心（球メッシュ + カメラ・レンズパラメータ操作）。three.js の標準機能寄り

C) ハイブリッド（標準系はカメラ操作、Tiny Planet / Crystal Ball 等の特殊投影はシェーダ）

D) 設計ステージ（Functional Design）で評価して決めたい（本ステージでは抽象 IF のみ定義）

E) Other（[Answer]: の後に記述）

[Answer]: D

## Question 6
ビューワー内部の状態管理（モード・FOV・視点・ギャラリーインデックス等）の持ち方は？

A) プレーンな内部状態 + イベント発火（外部ライブラリ非依存、最小依存方針 NFR-06 に沿う）

B) 軽量な内部リアクティブストア（購読可能な state）を自前実装し、アダプタが購読

C) Other（[Answer]: の後に記述）

[Answer]: A

## Question 7
React アダプタ（`@perisphere/react`）とコアの関係は？

A) 薄いラッパ（コアのインスタンスを `useEffect` で生成・破棄し、props→命令 API、イベント→props コールバックへブリッジ。ref で命令ハンドル公開）

B) React 寄りに再設計（フック群で状態を React 管理しつつコアのレンダラのみ利用）

C) Other（[Answer]: の後に記述）

[Answer]: A

## Question 8
同梱コントロール UI（FR-14）の実装技術は？（コアはフレームワーク非依存である必要がある）

A) 素の DOM / Web 標準（バニラ DOM 要素 + CSS）でコア側に同梱。React 等に依存しない（ヘッドレス・任意フレームワークから使える）

B) コアは UI を持たず、同梱 UI は各アダプタ側（React 版 UI 等）にのみ用意する

C) コアに素の DOM 版を同梱しつつ、アダプタでネイティブなラッパも提供（二層）

D) Other（[Answer]: の後に記述）

[Answer]: A
