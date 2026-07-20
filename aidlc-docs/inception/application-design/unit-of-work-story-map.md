# Unit of Work Story Map — perisphere（ストーリー → ユニット割当）

- **関連 Issue**: [#21](https://github.com/AtsutoNakayama/perisphere/issues/21)
- **作成日**: 2026-07-20
- **前提資料**: `unit-of-work.md`、`user-stories/stories.md`

## 割当表（US-01〜US-37 全件）

各ストーリーは主担当ユニットに 1 件割当（「全ストーリーがいずれかのユニットに属する」の検証対象）。実装が複数ユニットにまたがる場合は「関連ユニット」に記載する。

| ストーリー | Epic | 優先度 | 主担当 UoW | 関連 UoW |
|---|---|---|---|---|
| US-01 エクイレクタングラー画像の表示 | E1 | In MVP | UoW-B | — |
| US-02 8K を動作保証ラインとし上限なしで読み込む | E1 | In MVP | UoW-B | UoW-A（性能） |
| US-03 URL 指定での画像読み込み | E1 | In MVP | UoW-B | — |
| US-04 入力フォーマットの拡張アダプタ（インターフェース） | E1 | In MVP | UoW-B | — |
| US-05 将来の入力ソース追加（キューブマップ等） | E1 | Future | UoW-B-F | UoW-B |
| US-06 既定の標準ビュー表示 | E2 | In MVP | UoW-A | — |
| US-07 広視野系モードの選択と投影特性 | E2 | In MVP | UoW-C | — |
| US-08 特殊表現モードの選択と投影特性 | E2 | In MVP | UoW-C | — |
| US-09 モード横断で視点操作が破綻しない | E2 | In MVP | UoW-C | UoW-D |
| US-10 モード切替 API（即時切替＋イベント） | E2 | In MVP | UoW-C | UoW-A（EventBus） |
| US-11 将来のアニメ遷移を見据えた切替 API 形状 | E2 | Future | UoW-C-F | UoW-C |
| US-12 カスタムビューワーモードの登録 | E2 | In MVP | UoW-C | — |
| US-13 マウスドラッグによる視点移動（パン/チルト） | E3 | In MVP | UoW-D | — |
| US-14 マウスホイールによるズーム | E3 | In MVP | UoW-D | — |
| US-15 タッチ 1 本指による視点移動 | E3 | In MVP | UoW-D | — |
| US-16 ピンチによるズーム | E3 | In MVP | UoW-D | — |
| US-17 キーボードによる主要操作 | E3 | In MVP | UoW-D | UoW-F,G（切替対象） |
| US-18 写真の前後選択移動（矢印キー） | E3 | In MVP | UoW-D | UoW-E（実行委譲先） |
| US-19 キーマップの変更・無効化 | E3 | In MVP | UoW-D | — |
| US-20 ズーム範囲（FOV）上下限の設定とモード既定 | E3 | In MVP | UoW-D | UoW-C（モード既定範囲） |
| US-21 フルスクリーン切替（API/UI/キーボード）とイベント | E4 | In MVP | UoW-F | UoW-D,G |
| US-22 非対応環境でのフォールバック | E4 | In MVP | UoW-F | — |
| US-23 ギャラリー API（リスト・next/prev・index・イベント） | E5 | In MVP | UoW-E | — |
| US-24 標準ギャラリー UI（サムネ/インジケータ・非表示・スタイル） | E5 | In MVP | UoW-E | UoW-G |
| US-25 バーチャルツアー拡張点 | E5 | Future | UoW-E-F | UoW-E |
| US-26 標準コントロール UI 同梱（表示/非表示・スタイル・ヘッドレス） | E6 | In MVP | UoW-G | — |
| US-27 UI 文言・aria-label の差し替え | E6 | In MVP | UoW-G | — |
| US-28 React コンポーネント＋フック＋ref 命令ハンドル | E7 | In MVP | UoW-H | — |
| US-29 イベント API の購読 | E7 | In MVP | UoW-A | — |
| US-30 エラー処理とフォールバック表示 | E7 | In MVP | UoW-A | UoW-B（読込失敗経路） |
| US-31 破棄 API によるリソース解放 | E7 | In MVP | UoW-A | — |
| US-32 公開 API の入力検証 | E7 | In MVP | UoW-B | — |
| US-33 フレームワーク非依存コア＋アダプタ分離 | E7 | In MVP / Future | UoW-H（MVP 範囲） | UoW-H-F（Future 範囲） |
| US-34 SSR セーフ | E8 | In MVP | UoW-A | UoW-H（マウント制御） |
| US-35 アクセシビリティ（キーボード完結・フォーカス・ARIA） | E8 | In MVP | UoW-G | UoW-D（キーボード操作） |
| US-36 性能体感（8K で 60fps 目安） | E8 | In MVP | UoW-A | UoW-D（操作応答） |
| US-37 障害分離・縮退（読込失敗/コンテキストロスト復帰） | E8 | In MVP | UoW-A | UoW-B（読込失敗経路） |

## ユニット別カバレッジ（逆引き）

| UoW | 割当ストーリー数 | ストーリー |
|---|---|---|
| UoW-A コア基盤 | 7 | US-06, US-29, US-30, US-31, US-34, US-36, US-37 |
| UoW-B 画像入力・ロード | 5 | US-01, US-02, US-03, US-04, US-32 |
| UoW-B-F 入力ソース拡張（Future） | 1 | US-05 |
| UoW-C 投影モード | 5 | US-07, US-08, US-09, US-10, US-12 |
| UoW-C-F モード遷移演出（Future） | 1 | US-11 |
| UoW-D 視点操作・入力 | 8 | US-13, US-14, US-15, US-16, US-17, US-18, US-19, US-20 |
| UoW-E ギャラリー | 2 | US-23, US-24 |
| UoW-E-F バーチャルツアー拡張点（Future） | 1 | US-25 |
| UoW-F フルスクリーン | 2 | US-21, US-22 |
| UoW-G 同梱コントロール UI | 3 | US-26, US-27, US-35 |
| UoW-H React アダプタ | 2 | US-28, US-33 |
| UoW-H-F 他フレームワークアダプタ（Future） | 0（US-33 の Future 範囲を参照のみ） | — |
| UoW-I ドキュメント・デモ | 0（NFR-08 制約に対応。直接のストーリーなし） | — |

**合計**: 7+5+1+5+1+8+2+1+2+3+2 = **37**（`stories.md` の全ストーリー US-01〜US-37 と一致）。

## 網羅性検証

- [x] `stories.md` の全 37 ストーリー（US-01〜US-37）がいずれか 1 つの主担当ユニットに割当済み。
- [x] In MVP ストーリー（33 件）はすべて In MVP ユニット（UoW-A〜I）に割当済み。
- [x] Future ストーリー（US-05, US-11, US-25, US-33 の Future 範囲）はすべて Future 専用ユニット（UoW-B-F, UoW-C-F, UoW-E-F, UoW-H-F）に隔離済み（Q4=A）。
- [x] UoW-I（ドキュメント・デモ）はストーリー起源ではなく NFR-08（制約・注記）起源であることを明記。`stories.md` の「制約・注記」セクションと整合。
- [x] 未割当ストーリーなし。重複割当（主担当が 2 つ以上）なし。
