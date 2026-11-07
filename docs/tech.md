# 技術構成（現行実装）

最終更新: 2026-11-07  
位置づけ: 現在動いているライブMVPの技術選定と構成。  
実装の詳細仕様は [SPEC.md](./SPEC.md)、要件との差分は [requirements-status.md](./requirements-status.md) を参照。

---

## 1. サマリー

| 項目 | 採用技術 |
|---|---|
| フロントエンド | Next.js 15（App Router）+ React 19 + TypeScript |
| スタイル | Tailwind CSS v4 |
| API | Next.js Route Handlers（`app/api/**/route.ts`） |
| 状態保存 | Supabase Postgres `game_states`（1行JSON） |
| フォールバック保存 | `.data/game-state.json` |
| 同期 | HTTPポーリング（1.0〜1.2秒） |
| 競合制御 | `version` による楽観ロック＋再試行 |
| 認証 | 司会者キー＋参加者Cookie＋スクリーントークン |
| ホスティング | Vercel（Functions `hnd1`） |
| CI | GitHub Actions（テスト・lint・build） |

### 採用理由

- **Next.js一本**: 画面とAPIを同じリポジトリで管理でき、Vercelへそのままデプロイできる
- **単一JSON**: 30人規模のゲーム進行には正規化テーブルより単純で、状態の整合性を1行の更新で保てる
- **ポーリング**: Realtimeの接続管理・再接続・権限制御を省き、当日の障害点を減らす
- **Supabase**: マネージドPostgresで、Vercelの複数インスタンス間でも状態を共有できる
- **ファイルフォールバック**: ネットワークなしの会場でも、同一PC内で完結できる

---

## 2. アーキテクチャ

```text
[参加者スマホ]  /play  ─┐
[司会者PC]      /host  ─┼─ HTTPS ─→ [Vercel / Next.js]
[会場スクリーン] /stage ─┘              │
                                       ├─ Route Handlers
                                       ├─ lib/live（ゲームエンジン）
                                       └─ lib/server/game-store
                                              │
                                   ┌──────────┴──────────┐
                                   ▼                     ▼
                            Supabase game_states    .data/game-state.json
                            （本番・共有）           （ローカル）
```

### データの流れ（1回の操作）

1. クライアントがAPIへリクエスト
2. Route Handlerが認証・入力検証
3. `mutateGameState` が現在の状態を読み、期限切れフェーズを進める
4. ゲームエンジンが状態を変更
5. ストアが `version` を1つ進めて保存
6. 変更後のViewを返す
7. 各画面は次のポーリングで最新状態を取得

---

## 3. 技術スタック

| 分類 | ライブラリ / サービス | 用途 |
|---|---|---|
| フレームワーク | Next.js 15.5 | App Router / Route Handlers |
| UI | React 19 | 画面 |
| 言語 | TypeScript 5 | 型安全 |
| スタイル | Tailwind CSS v4 | Duolingo風ライト／Kahoot!風ステージ |
| バリデーション | Zod 4 | API入力検証 |
| DB | Supabase Postgres | `game_states` |
| DBクライアント | `@supabase/supabase-js` | サーバー専用 |
| QR | `qrcode` | 参加用QRのPNG生成 |
| テスト | Vitest | ユニットテスト |
| E2E/UI確認 | Playwright | `scripts/review-*.mjs` |
| ホスティング | Vercel | 本番 |
| CI | GitHub Actions | テスト・lint・build |

### 使っていないもの

- Supabase Realtime / Broadcast / WebSocket
- Supabase Auth / JWT / bcrypt
- 正規化テーブル（rooms / players / answers など）
- React Query（依存にはあるが、ライブ画面は `usePollingJson` を使用）
- 6桁ルームコードの自動発行

---

## 4. 状態管理

### 4-1. 単一JSON

```ts
type GameState = {
  schemaVersion: 1;
  version: number;
  room: LiveRoom;
  teams: LiveTeam[];
  players: LivePlayer[];
  questions: LiveQuestion[];
  answers: LiveAnswer[];
  groups: LiveAnswerGroup[];
  scores: LiveScore[];
  logs: LiveLog[];
  questionsFrozen: boolean;
};
```

- 1ルーム = 1行
- すべての更新は `mutateGameState` を通す
- クライアントには `GameState` を直接返さず、画面用のViewに変換する
- 変更履歴は `logs` に最大500件

### 4-2. 楽観ロック

Supabase更新時は `where room_code = ... and version = ...` を付け、更新行が0なら競合として再試行する。

- 最大40回
- 指数バックオフ＋ジッター（上限400ms）
- 同一インスタンス内はキューで直列化
- 参加・回答・司会者操作のたびに `version` が増える

### 4-3. 同期

- 共通フック `lib/client/use-live-data.ts` の `usePollingJson`
- 前のリクエスト完了後に次を予約（重ならない）
- 参加者1.2秒 / 司会者1.2秒 / スクリーン1.0秒
- 操作後は `refresh()` で即時再取得
- 通信エラー時は次回ポーリングで自動回復

---

## 5. 認証

| 対象 | 方式 | 保存 |
|---|---|---|
| 司会者 | 共有キー `HOST_KEY` | `nomikai_host` Cookie（12時間）／`sessionStorage` |
| 参加者 | ランダムトークン | `nomikai_player` Cookie（12時間）／状態にはSHA-256 |
| スクリーン | `room.screenToken` | URLの `?token=` |

- 司会者キーは `x-host-key` ヘッダー、`?key=`、Cookieの順で受け付ける
- 比較は `timingSafeEqual`
- `STAGE_REQUIRE_TOKEN=1` でスクリーントークンを必須化
- 個人アカウント・権限分離・ログアウトUIはない

---

## 6. データ永続化

### 6-1. Supabase

`supabase/migrations/0002_game_state.sql`:

| カラム | 型 | 説明 |
|---|---|---|
| `room_code` | text PK | 行キー。既定 `default` |
| `state` | jsonb | `GameState` |
| `version` | integer | 楽観ロック用 |
| `updated_at` | timestamptz | 更新日時 |

- RLS有効・ポリシーなし
- `service_role` キーでサーバーからのみアクセス
- ブラウザはSupabaseへ直接接続しない

### 6-2. ファイル

- 既定 `.data/game-state.json`
- 一時ファイルへ書いてから `rename`
- プロセス内キューで直列化
- 複数プロセス・複数インスタンスでは安全でない

### 6-3. 選択ロジック

`NEXT_PUBLIC_SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` の両方があればSupabase、なければファイル。

---

## 7. 得点計算

```text
rate   = 最大グループ人数 / 回答者数
points = round(rate × 10)
```

- 回答者4人未満は `not_scored`
- 統合グループは子グループの合計人数
- チームごとに独立
- 最終順位は 総得点 → 全員一致回数 → 最終お題得点 → 抽選

実装: `lib/scoring.ts` / `lib/live/engine.ts`

---

## 8. ディレクトリ構成

```text
app/
  api/                  Route Handlers
    join/ state/ answers/ room/ stage/ qr/ health/
    host/ auth/ state/ advance/ questions/ teams/ groups/
  play/                 参加者画面
  host/                 司会者画面
    questions/          お題管理
  stage/                会場スクリーン
components/
  live/                 実データで動く画面
  game/ host/ stage/    UI部品・プレビュー
lib/
  live/                 ゲームエンジン・型・View変換
  server/               ストア・認証・APIエラー
  client/               ポーリング・APIクライアント
  supabase/             サーバークライアント
  demo/                 プレビュー用モック
supabase/
  migrations/           SQL
scripts/                smoke / review / load / 運用
docs/                   仕様・ガイド・履歴
```

---

## 9. 性能・可用性

| 項目 | 実績 / 設計 |
|---|---|
| 30人一斉回答 | 成功（負荷テスト） |
| 回答API p50 | 約1.35秒（30人時） |
| 回答API max | 約2.34秒（30人時） |
| 締切・公開の反映 | 約0.8〜1.5秒 |
| Vercel Functions | `hnd1`（東京） |
| Supabase | `ap-northeast-1`（東京） |
| 同時更新 | 楽観ロック＋再試行＋キュー |

- 30人一斉回答で一部500が出たため、再試行40回・ジッター・キュー・東京リージョン化を実施済み
- それでも40回失敗した場合は500を返す

---

## 10. 既知の制約

- 1デプロイ = 1ルーム
- ゲーム中のチーム追加・参加者移動・チーム名変更は不可
- 参加者の退出・スリープ・削除UIはない
- 開始後のお題変更は不可。リセットは最終結果画面のみ
- レート制限・CSRFトークン・noindexは未実装
- 修正内容の完全な履歴はない（回数のみ）
- 24時間後の自動削除はない
- 本番ビルドのCookieは `Secure` のため、HTTPのLAN運用では参加Cookieが保存されない場合がある
- Supabase無料プランは7日間アクセスがないと一時停止する
- オフライン・デスクトップアプリは未対応

---

## 11. 環境変数

| 変数 | 必須 | 既定 | 説明 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 本番 | - | Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 本番 | - | サーバー専用キー |
| `HOST_KEY` | 本番必須 | `4821` | 司会者キー |
| `ROOM_CODE` | 任意 | `4821` | ルームコード |
| `TEAM_COUNT` | 任意 | `5` | 初期チーム数 |
| `TEAM_CAPACITY` | 任意 | `7` | 初期定員 |
| `STAGE_REQUIRE_TOKEN` | 推奨 | - | `1` でトークン必須 |
| `GAME_ROOM_KEY` | 任意 | `default` | Supabase行キー |
| `GAME_STATE_FILE` | 任意 | `.data/game-state.json` | ファイル保存先 |

レガシー（未使用）: `NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SESSION_SECRET`、`HOST_LOGIN_ID`、`HOST_PASSWORD`。

---

## 12. テスト

```bash
npm test        # Vitest
npm run lint
npm run build
```

起動中のサーバーに対する検証:

```bash
npm run smoke:live
npm run review:live
npm run load:live
```

- 3つは同じルーム状態を書き換えるため同時実行しない
- `load:live` は本番ビルド（`npm run build && npm start`）に対して実行する
- 検証後は `WAITING` / 参加者0に戻す

---

## 13. 参考

- [SPEC.md](./SPEC.md): 実装仕様の正本
- [requirements-status.md](./requirements-status.md): 要件との差分
- [OPERATIONS.md](./OPERATIONS.md): 本番運用
- [GUIDE-HOST.md](./GUIDE-HOST.md): 司会者向け
- [GUIDE-PLAYER.md](./GUIDE-PLAYER.md): 参加者向け
