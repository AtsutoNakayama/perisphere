# Infrastructure Design — UoW-A コア基盤

- **関連 Issue**: [#27](https://github.com/AtsutoNakayama/perisphere/issues/27)
- **作成日**: 2026-08-03
- **前提資料**: `uow-a-infrastructure-design-plan.md`（Q1〜Q6 回答・採用理由）

## 1. カテゴリ別マッピング結果

| カテゴリ | 判定 | マッピング内容 |
|---|---|---|
| Deployment Environment | 限定適用 | GitHub Actions（CI）のみ。npm レジストリへの公開は本ユニットのスコープ外（§4） |
| Compute Infrastructure | 限定適用 | GitHub Actions `ubuntu-latest` ランナー、単一 Node.js LTS（Q2=A） |
| Storage Infrastructure | N/A | 変更なし（NFR-07 で確定済み） |
| Messaging Infrastructure | N/A | 該当なし |
| Networking Infrastructure | N/A | 該当なし |
| Monitoring Infrastructure | N/A（本ユニットでは） | 既存 GitHub Actions のチェック結果表示で足りる |
| Shared Infrastructure | 適用 | CI ワークフローをワークスペース全体対応（`pnpm -r`）で設計し、後続ユニットが再利用する（Q6=A） |

## 2. CI インフラ設計（既存 `.github/workflows/ci.yml` への追加）

Q1=A（既存ファイル拡張）、Q2=A（単一 LTS）、Q3=A（メジャータグ固定）、Q6=A（`pnpm -r` によるワークスペース全体対応）に基づく設計。

### 追加するジョブ（概念設計。実ファイルへの反映は Code Generation で行う）

| ジョブ名 | 内容 | 依存ステップ |
|---|---|---|
| `install`（共通セットアップ、または各ジョブ内で実施） | pnpm セットアップ → `pnpm install --frozen-lockfile` | Node.js LTS セットアップ、pnpm セットアップ（`pnpm/action-setup`） |
| `lint` | `pnpm -r lint`（ESLint + Prettier チェック、Q6=A のワークスペース全体対応） | install |
| `build` | `pnpm -r build`（tsup によるビルド。型エラーがあれば失敗） | install |
| `test` | `pnpm -r test`（Vitest。fast-check による PBT を含む） | install |

既存の `markdownlint` / `links` ジョブは変更しない。ブランチ保護の必須ステータスチェック（`CONTRIBUTING.md` 記載）に `lint`/`build`/`test` を追加する運用変更が伴う（Code Generation 完了後、実際に CI がグリーンになった時点でリポジトリ設定を更新する）。

### 概念設計（YAML 断片、Code Generation での実装の指針）

```yaml
# 追加ジョブのイメージ（既存 ci.yml に追記。実際のステップ順・キャッシュ設定は Code Generation で確定）
jobs:
  # ...既存の markdownlint / links ジョブ...
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r lint

  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r build

  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r test
```

上記は設計意図を示す概念的な YAML であり、実際のファイル編集（`node-version-file` に対応する `.nvmrc` の追加を含む）は Code Generation ステージで行う。

## 3. Dependabot 設定（Q4=A）

```yaml
# .github/dependabot.yml（概念設計。実ファイル作成は Code Generation で行う）
version: 2
updates:
  - package-ecosystem: "npm"          # pnpm ワークスペースも npm エコシステム扱い
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

CI ワークフロー内の `pnpm audit`（NFR Requirements Q9 で確定した「両方」方針の CI 監査ステップ側）は、`lint`/`build`/`test` ジョブとは別に軽量な監査ステップとして追加することを Code Generation で検討する（本ステージでは方針のみ確定）。

## 4. npm 公開パイプライン（Q5=A: 本ユニットではスコープ外）

- 本ユニット（UoW-A）は「1 枚の画像を標準ビューで表示」という到達点にすら達していない基盤のみのため、実際の `npm publish` フローは構築しない。
- CI では `pnpm -r build` によるビルド成功確認までを行う（§2）。
- 公開パイプラインの構築は、`requirements.md` NFR-11 が指す「正式版リリース時のリリースブランチ運用」を含むリリース設計のタイミングで改めて Infrastructure Design を実施する（後続ユニットが出揃った段階、または専用のリリース準備ユニット/Issue）。

## 5. 拡張ルール準拠サマリ

| ルール | 判定 | 根拠 |
|---|---|---|
| SECURITY-10（サプライチェーン: lockfile・脆弱性スキャン・バージョン固定・公式レジストリ） | Compliant | pnpm lockfile（既存決定）、Dependabot 2 エコシステム（§3）、Actions のメジャータグ固定（既存慣習を継続、§2）、npm 公式レジストリのみ利用（変更なし） |
| SECURITY-13（CI/CD パイプラインの整合性） | 部分対応 | Actions のメジャータグ固定は継続。CI 設定ファイルへの変更はブランチ保護（コードオーナー承認必須、`CONTRIBUTING.md`）により既にアクセス制御されている。SHA 固定・SBOM 生成は本ユニットのスコープ外（Q3=A の判断） |
| RESILIENCY-04（自動デプロイ・ロールバック） | N/A（本ユニットでは） | npm 公開パイプライン自体を構築しないため、デプロイ/ロールバック機構の設計対象がない（§4） |

## 6. Code Generation への申し送り事項

- `.nvmrc`（または `package.json` の `engines.node`）でワークスペースの Node.js LTS バージョンを固定する。
- `pnpm-workspace.yaml`・`packages/core/package.json` 等の作成と合わせて、`.github/workflows/ci.yml` に §2 のジョブを追加する。
- `.github/dependabot.yml` を §3 の内容で作成する。
- ブランチ保護の必須ステータスチェックへの `lint`/`build`/`test` 追加は、CI が実際にグリーンになった後（Build and Test ステージ完了後）にリポジトリ設定側で行う。
