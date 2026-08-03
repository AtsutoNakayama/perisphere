# Deployment Architecture — UoW-C 投影モード

- **関連 Issue**: [#36](https://github.com/AtsutoNakayama/perisphere/issues/36)
- **作成日**: 2026-08-03

## 現時点の配布フロー（UoW-A/UoW-B から変更なし）

```mermaid
flowchart LR
    Dev["開発者"] -->|"push"| PR["Pull Request"]
    PR --> CI["GitHub Actions CI\n(markdownlint / links / lint / build / test)"]
    CI -->|"green"| Review["コードオーナーレビュー"]
    Review -->|"承認"| Merge["main へ Merge"]
```

UoW-A/UoW-B の `deployment-architecture.md` と同一のフロー。UoW-C によるインフラ変更はない。npm 公開フローは引き続き未構築。

## UoW-C 完了時点でのインフラ変更サマリ

なし。`packages/core/src/modes/` 配下のアプリケーションコード追加のみで、既存 CI ジョブ（`lint`/`build`/`test`）がそのままカバーする。
