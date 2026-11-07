# ドキュメント索引

最終更新: 2026-11-07

## まず読む

| ドキュメント | 対象 | 内容 |
|---|---|---|
| [SETUP.md](./SETUP.md) | 導入担当 | Supabase / Vercel のセットアップ |
| [OPERATIONS.md](./OPERATIONS.md) | 司会者・運営 | 当日の運用手順・障害対応 |
| [GUIDE-PLAYER.md](./GUIDE-PLAYER.md) | 参加者 | 参加方法、回答のしかた、得点のしくみ、FAQ |
| [GUIDE-HOST.md](./GUIDE-HOST.md) | 司会者・幹事 | ログイン、参加受付、進行、統合、当日チェックリスト |

## 仕様

| ドキュメント | 内容 | 位置づけ |
|---|---|---|
| [SPEC.md](./SPEC.md) | 現行実装の仕様（データモデル、状態遷移、API、認証、保存） | **実装の正本** |
| [requirements-v1.2.md](./requirements-v1.2.md) | 目標とする要件定義 | 目標仕様 |
| [requirements-status.md](./requirements-status.md) | 要件と実装の対応表 | 差分の確認 |
| [tech.md](./tech.md) | 技術選定と構成 | 現行構成 |
| [ui-design.md](./ui-design.md) | 画面設計・画面一覧 | 設計資料 |

## 設計・デザイン

| ドキュメント | 内容 |
|---|---|
| [design.md](./design.md) | Duolingo風ビジュアルのスタイルリファレンス |
| [figma-handoff.md](./figma-handoff.md) | Figmaデザインの引き継ぎ |
| [architecture/nomikai-architecture.html](./architecture/nomikai-architecture.html) | インフラ構成図（[PNG](./architecture/nomikai-architecture.png) / [ダーク](./architecture/nomikai-architecture-dark.png)） |
| [architecture/nomikai-code-architecture.html](./architecture/nomikai-code-architecture.html) | ソースコード構成図（機能単位。画面→API→エンジン→永続化）（[PNG](./architecture/nomikai-code-architecture.png) / [ダーク](./architecture/nomikai-code-architecture-dark.png)） |

## リポジトリ直下

| ファイル | 内容 |
|---|---|
| [README.md](../README.md) | プロジェクト概要、クイックスタート |
| [.env.example](../.env.example) | 環境変数のテンプレート |

## 注記

- `design.md` / `figma-handoff.md` / `ui-design.md` は設計時点の資料です。実装状況は `SPEC.md` と `requirements-status.md` を参照してください。
- 会社固有のお題・情報はこのリポジトリに含めていません。
