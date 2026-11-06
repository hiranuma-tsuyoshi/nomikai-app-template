# Supabase セットアップ

## 1. プロジェクト作成

Supabase Dashboardで新規プロジェクトを作成します。リージョンは東京（`ap-northeast-1`）を推奨します。

## 2. マイグレーション

SQL Editorで以下の順に実行します。

1. `migrations/0001_init.sql`
2. `migrations/0002_game_state.sql`

CLIを使う場合:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --password <database-password>
```

`0002_game_state.sql` はライブ進行のJSONスナップショット用です。これがないと `/api/health` の `store.backend` が `supabase` になってもAPIが失敗します。

## 3. 環境変数

リポジトリのルートで:

```bash
npm install
npm run setup
```

`npm run setup` はSupabase URLとservice_role keyを対話で受け取り、`.env.local` を生成します。

手動で設定する場合は `.env.example` を `.env.local` にコピーし、以下を設定します。

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `HOST_KEY`（本番用に変更）
- `ROOM_CODE` / `TEAM_COUNT` / `TEAM_CAPACITY` / `STAGE_REQUIRE_TOKEN`

`anon` / `publishable` keyは不要です。このアプリはブラウザからSupabaseへ直接アクセスせず、Next.jsのAPI経由で操作します。

## 4. 確認

```bash
npm run dev
```

`http://localhost:3000/api/health` を開き、`store.backend` が `supabase` になることを確認します。

## ライブ状態の保存

- `NEXT_PUBLIC_SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` の両方が設定されていると、進行状態は `game_states` テーブルに保存される
- 未設定の場合は `.data/game-state.json` に保存される（ローカル・同一Wi-Fi運用のフォールバック）
- 更新は `version` による楽観ロック。同時回答は自動で再試行する
- `GAME_ROOM_KEY` で `game_states` の行を切り替えられる（既定: `default`）

## 注意

- `SUPABASE_SERVICE_ROLE_KEY` はサーバー専用。`NEXT_PUBLIC_` を付けない
- RLSは全テーブルで有効、ポリシーなし。`anon` / `authenticated` は直接アクセスできない
- 無料プロジェクトは7日間アクセスがないと一時停止する。本番前に起こす
- 本番前にバックアップを取得する
- 当日の `game_states` は1行JSON。トラブル時はこの行をエクスポートすれば復元できる
