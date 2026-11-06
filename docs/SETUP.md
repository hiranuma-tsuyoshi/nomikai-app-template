# セットアップ

## 前提

- Node.js 20以上
- Supabaseアカウント
- Vercelアカウント（インターネット公開する場合）

## 1. Supabaseプロジェクト

1. [Supabase Dashboard](https://supabase.com/dashboard) で **New project**
2. 名前・DBパスワードを設定
3. Regionは **Tokyo (`ap-northeast-1`)** を推奨
4. 作成完了まで待つ

## 2. マイグレーション

### SQL Editorで実行する場合

`supabase/migrations/` の以下を順番に実行します。

1. `0001_init.sql`
2. `0002_game_state.sql`

`0002_game_state.sql` はライブ進行状態を保存する `game_states` テーブルを作ります。これがないと `/api/health` が `supabase` を返してもAPIが失敗します。

### Supabase CLIで実行する場合

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --password <database-password>
```

`link` はプロジェクト情報とAPIキーの読み取りにManagement APIを使います。`db push` はDBパスワードでPostgresへ直接接続します。

## 3. 環境変数

```bash
npm install
npm run setup
```

`npm run setup` は以下を行います。

- Supabase URLとservice_role keyを対話で入力
- ランダムな `HOST_KEY` を生成
- `.env.local` を書き出す（既存ファイルがある場合は上書きしない）

CIなど非対話で実行する場合:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="..." \
npm run setup
```

PowerShell:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="..."
npm run setup
```

手動で設定する場合は `.env.example` を `.env.local` にコピーし、値を埋めます。

### キーの取得場所

Supabase Dashboard > **Project Settings** > **API**:

- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `service_role` key（または新しい `sb_secret_...`）→ `SUPABASE_SERVICE_ROLE_KEY`

`anon` / `publishable` keyはこのアプリでは使いません。ブラウザからSupabaseへ直接アクセスせず、Next.jsのAPI経由でDBを操作するためです。

## 4. ローカル起動

```bash
npm run dev
```

確認:

```bash
curl http://localhost:3000/api/health
```

`store.backend` が `supabase` になっていれば接続成功です。

```json
{
  "ok": true,
  "store": { "backend": "supabase", "file": null }
}
```

`file` になる場合は、URLまたはservice_role keyが読まれていません。`.env.local` を作成した後にサーバーを再起動してください。

## 5. Vercelへデプロイ

1. GitHubへpush
2. [Vercel](https://vercel.com/new) でリポジトリをImport
3. Framework Presetが **Next.js** であることを確認
4. 環境変数を設定
   - 画面の **Import .env** で `.env.local` を読み込むのが簡単です
   - 手動の場合は `.env.local` と同じ変数を追加
5. **Deploy**

`NEXT_PUBLIC_SUPABASE_URL` はビルド時に埋め込まれるため、必ず**デプロイ前に**設定してください。変更した場合は再デプロイが必要です。

## 6. デプロイ後の確認

1. `https://your-app.vercel.app/api/health` が `supabase` を返す
2. `/host?key=<HOST_KEY>` で司会者画面に入れる
3. スマホで `/play?code=4821` を開いて参加できる
4. 司会者画面からスクリーンリンクを開ける

## トラブルシューティング

| 症状 | 確認すること |
|---|---|
| `store.backend` が `file` | `.env.local` のURL/service_role key、サーバー再起動、Vercelの再デプロイ |
| 司会者画面が401 | `HOST_KEY` とURLの `?key=` が一致しているか |
| スクリーンが401 | `STAGE_REQUIRE_TOKEN=1` の場合、`/stage?token=...` が必要 |
| 参加できない | `ROOM_CODE` と参加URLの `code` が一致しているか |
| 管理画面でお題を変更できない | ゲーム開始後は凍結されています。`reset-all` で戻してください |
| Supabaseが止まった | 無料プランの一時停止。DashboardからRestoreしてください |
| Vercelで環境変数を変えたのに反映されない | 再デプロイが必要です |

## バックアップ

- Supabase: `game_states` テーブルの行をエクスポート
- ファイル保存: `.data/game-state.json` をコピー
- 本番前はSupabase Dashboardのバックアップも確認してください
