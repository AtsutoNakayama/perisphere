# Deployment Architecture — UoW-E ギャラリー

- **関連 Issue**: [#40](https://github.com/AtsutoNakayama/perisphere/issues/40)
- **作成日**: 2026-08-03

## 現時点の配布フロー（UoW-A〜D から変更なし）

```mermaid
flowchart LR
    Dev["開発者"] -->|"push"| PR["Pull Request"]
    PR --> CI["GitHub Actions CI\n(markdownlint / links / lint / build / test)"]
    CI -->|"green"| Review["コードオーナーレビュー"]
    Review -->|"承認"| Merge["main へ Merge"]
```

UoW-A〜D の `deployment-architecture.md` と同一のフロー。UoW-E によるインフラ変更はない。npm 公開フローは引き続き未構築。

## UoW-E 完了時点でのインフラ変更サマリ

なし。`packages/core/src/gallery/` 配下のアプリケーションコード追加と `viewer/` への拡張のみで、既存 CI ジョブ（`lint`/`build`/`test`）がそのままカバーする。
