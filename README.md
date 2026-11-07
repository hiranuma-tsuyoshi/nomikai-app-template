# 以心伝心ゲーム

飲み会・社内イベント向けの、チーム対抗「回答一致率」ゲームです。
参加者はスマホ、司会者はPC、会場スクリーンは16:9で表示します。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhiranuma-tsuyoshi%2Fnomikai-app-template)

> 別名のリポジトリで公開する場合は、上のDeployボタンの `repository-url` を自分のリポジトリに変更してください。

## 特徴

- 参加人数の固定なし（30人規模を想定）
- チーム対抗。得点は「一致率 × 10」
- 表記ゆれの自動正規化と、司会者による意味統合
- 回答締切後に30秒の最終確認
- 同点順位は「全員一致の回数 → 最終お題の得点 → 抽選」
- スマホ・司会者PCはライトテーマ、会場スクリーンはステージ表示
- Supabase未設定時はファイル保存でローカル運用可能

## 技術スタック

- Next.js 15（App Router）+ TypeScript
- Tailwind CSS v4
- Supabase（Postgres）
- Vercel（任意）
- 状態同期: 1.0〜1.2秒ポーリング + `version` による楽観ロック

## 必要環境

- Node.js 20以上
- Supabaseアカウント
- Vercelアカウント（インターネット公開する場合）

## クイックスタート

### 1. Supabaseプロジェクトを作成

Supabase Dashboardで新規プロジェクトを作成します。リージョンは東京（`ap-northeast-1`）を推奨します。

### 2. マイグレーションを実行

SQL Editorで以下の順に実行します。

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_game_state.sql`

CLIを使う場合:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

### 3. 環境変数を設定

```bash
npm install
npm run setup
```

`npm run setup` はSupabase URLとservice_role keyを対話で受け取り、`.env.local` とランダムな `HOST_KEY` を生成します。

手動で設定する場合は `.env.example` を `.env.local` にコピーしてください。

### 4. 起動

```bash
npm run dev
```

`http://localhost:3000/api/health` を開き、`store.backend` が `supabase` になっていることを確認します。

## 画面

| 画面 | URL |
|---|---|
| 参加者 | `/play?code=4821` |
| 司会者 | `/host`（初回は `?key=司会者キー`） |
| 会場スクリーン | 司会者画面の「スクリーン」リンク（`/stage?token=...`） |
| お題管理 | `/host/questions` |

## 環境変数

| 変数 | 必須 | 説明 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 必須 | SupabaseのプロジェクトURL |
| `SUPABASE_SERVICE_ROLE_KEY` | 必須 | サーバー専用キー。`NEXT_PUBLIC_` を付けない |
| `HOST_KEY` | 本番必須 | 司会者ログインキー。既定値のままにしない |
| `ROOM_CODE` | 任意 | 参加者が入力するルームコード（既定: `4821`） |
| `TEAM_COUNT` | 任意 | 初期チーム数（既定: `5`） |
| `TEAM_CAPACITY` | 任意 | 1チームの定員（既定: `7`） |
| `STAGE_REQUIRE_TOKEN` | 推奨 | `1` でスクリーンURLにトークンを必須化 |
| `GAME_ROOM_KEY` | 任意 | Supabaseの `game_states` 行キー（既定: `default`） |
| `GAME_STATE_FILE` | 任意 | ファイル保存先（既定: `.data/game-state.json`） |

## Vercelへデプロイ

1. このリポジトリをGitHubへpush
2. VercelでImport
3. 環境変数を設定（`.env.local` をImportすると楽です）
4. Deploy

`NEXT_PUBLIC_SUPABASE_URL` はビルド時に埋め込まれるため、**環境変数を設定してからデプロイ**してください。変更した場合は再デプロイが必要です。

`vercel.json` で関数の実行リージョンを東京（`hnd1`）にしています。Supabaseのリージョンに合わせて変更してください。同じ地域に揃えると、回答が集中したときの更新が安定します。

詳細は [docs/SETUP.md](docs/SETUP.md) を参照してください。

## 運用

- 司会者キーは初回に `?key=...` で渡すか、ログイン画面で入力します
- 会場スクリーンは司会者画面から開きます。`STAGE_REQUIRE_TOKEN=1` の場合、tokenがないURLは401になります
- お題は `/host/questions` で事前に登録し、開始すると凍結されます
- 進行状態のバックアップはSupabaseの `game_states` 行、または `.data/game-state.json` をエクスポートします
- 当日の手順は [docs/OPERATIONS.md](docs/OPERATIONS.md) を参照してください

## テスト

```bash
npm test
npm run lint
npm run build
```

起動中の環境に対するAPI通し確認:

```bash
# bash
BASE_URL=http://localhost:3000 HOST_KEY=your-host-key npm run smoke:live

# PowerShell
$env:BASE_URL="http://localhost:3000"; $env:HOST_KEY="your-host-key"; npm run smoke:live
```

`smoke:live`、`review:live`、`load:live` は同じルーム状態を書き換えるため、同時に実行しないでください。

## セキュリティ

- `SUPABASE_SERVICE_ROLE_KEY` はサーバー専用です。クライアントへ渡したり、`NEXT_PUBLIC_` を付けたりしないでください
- RLSは全テーブルで有効、ポリシーなしです。`anon` / `authenticated` は直接アクセスできません
- `HOST_KEY` は司会者用の共有秘密です。既定値のまま公開しないでください
- スクリーンURLのtokenは会場関係者だけに共有してください
- Supabase無料プランは7日間アクセスがないと一時停止します。本番前に起こしてください

## 制限事項

- **1デプロイ = 1ルーム** です。複数イベントを同時に1つのデプロイで運用する機能はありません
- チームの追加・定員変更・参加者移動はゲーム開始前のみです。チーム名変更・チーム削除・参加者の退出UIはありません
- ゲーム開始後はお題を変更できません。リセットは最終結果画面からのみ行えます
- 途中参加は可能ですが、回答受付中なら現行のお題から回答できます
- 主催者アカウント・課金・多テナント分離は未実装です
- UIは日本語のみです
- Vercel Hobbyプランは非商用向けです。商用利用する場合はVercelの規約を確認してください

## ドキュメント

- [docs/README.md](docs/README.md): ドキュメント索引
- [docs/SETUP.md](docs/SETUP.md): Supabase / Vercel の詳細セットアップ
- [docs/OPERATIONS.md](docs/OPERATIONS.md): 当日の運用手順・障害対応
- [docs/GUIDE-PLAYER.md](docs/GUIDE-PLAYER.md): 参加者向け利用ガイド
- [docs/GUIDE-HOST.md](docs/GUIDE-HOST.md): 司会者・運営向け利用ガイド
- [docs/SPEC.md](docs/SPEC.md): 現行実装の仕様書（実装の正本）
- [docs/requirements-v1.2.md](docs/requirements-v1.2.md): 目標とする要件定義
- [docs/requirements-status.md](docs/requirements-status.md): 要件と実装の対応表
- [docs/tech.md](docs/tech.md): 技術構成
- [docs/design.md](docs/design.md): デザイン方針
- [docs/ui-design.md](docs/ui-design.md): 画面設計
- [docs/architecture/nomikai-architecture.html](docs/architecture/nomikai-architecture.html): 構成図

## ライセンス

MIT License. 詳細は [LICENSE](LICENSE) を参照してください。
