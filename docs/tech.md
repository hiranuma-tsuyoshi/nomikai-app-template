# 以心伝心ゲーム 技術選定書 v0.1

| 項目 | 内容 |
|---|---|
| 版 | v0.1 |
| 日付 | 2026-11-01 |
| 前提 | `requirements-v1.2.md` / `ui-design.md` / `design.md` |
| 結論 | **Next.js + Supabase + Vercel** |
| 次工程 | 実装 |

---

## 1. 結論

```
フロントエンド : Next.js 15（App Router）+ TypeScript + Tailwind CSS
バックエンド   : Next.js の Route Handlers / Server Actions
データベース   : Supabase Postgres（東京リージョン）
リアルタイム   : Supabase Realtime Broadcast
ホスティング   : Vercel（Hobby）
認証           : 独自セッションCookie（jose）+ bcrypt
```

**クライアントはDBに直接アクセスしない。** すべてNext.jsサーバー経由にすることで、
公開前の回答保護と権限チェックを1か所に集約する。

---

## 2. 選定の前提

| 制約 | 内容 |
|---|---|
| 規模 | 30人前後（設計上50人） |
| 期間 | 1ヶ月 |
| 予算 | 無料枠 |
| 画面 | 司会者PC／参加者スマホ／会場スクリーンの3系統 |
| 性能 | 回答送信からスクリーン反映まで2秒以内 |
| セキュリティ | 公開前の回答を他者に見せない。本名を扱う |
| 運用 | 幹事5人。当日の欠席・途中参加に対応 |

---

## 3. 候補の比較

| 候補 | 構成 | リアルタイム | 関係データ | 1ヶ月での実装 | 評価 |
|---|---|---|---|---|---|
| **A. Supabase** | Next.js + Supabase + Vercel | ◎ Broadcast | ◎ Postgres | ◎ | **採用** |
| B. Firebase | Next.js + Firestore | ◎ | △ NoSQLで集計が面倒 | ○ | 次点 |
| C. Cloudflare | Workers + Durable Objects + D1 | ◎ | △ D1の制約 | △ 実装量が多い | 不採用 |
| D. 自前VPS | Node + Socket.io + Postgres | ◎ | ◎ | △ 運用・SSL・監視が増える | 不採用 |

### 採用理由

1. **得点計算が関係データ向き**
   チーム・回答・グループ・得点をSQLで一貫して扱える。Firestoreだと集計ロジックがアプリ側に散る。
2. **リアルタイムが標準装備**
   Broadcastで「状態が変わった」ことだけ通知し、クライアントが再取得する方式が取れる。
3. **無料枠で足りる**
   同時接続30〜50、DB容量は数百MB程度。無料枠の範囲に収まる。
4. **1ヶ月で間に合う**
   認証・DB・リアルタイムを自前で組まなくてよい。

---

## 4. アーキテクチャ

```
[参加者スマホ]  ─┐
[司会者PC]      ─┼─ HTTPS ─→ [Vercel: Next.js]
[会場スクリーン] ─┘              │
                                ├─→ [Supabase Postgres]  ← service role（サーバーのみ）
                                └─→ [Supabase Realtime]  ← 通知のみ（内容は載せない）
```

### データの流れ（1問の進行）

```
司会者が「締切」を押す
  → Next.js が DB の phase を ANSWER_CLOSED に更新
  → Realtime Broadcast で "state_changed" を送信
  → 参加者・スクリーンが /state を再取得
  → 画面が切り替わる
```

**Broadcastに回答内容や個人名を載せない。** 通知だけにして、本文は認可付きのAPIから取る。

---

## 5. 技術スタック

| 領域 | 採用 | 理由 |
|---|---|---|
| フレームワーク | Next.js 15（App Router） | 3画面系を1プロジェクトで持てる |
| 言語 | TypeScript | 得点計算・状態遷移の型安全 |
| スタイル | Tailwind CSS | 画面ごとの作り込みが速い |
| デザインシステム | `design.md` のトークン（Tailwind v4 `@theme`） | 白背景・12px角丸・2pxボーダー・緑/青 |
| フォント | M PLUS Rounded 1c（日本語）+ Nunito（英数字） | `next/font/google` で配信 |
| DB | Supabase Postgres | 関係データ・無料枠・東京リージョン |
| リアルタイム | Supabase Realtime Broadcast | 通知専用。実装が軽い |
| ホスティング | Vercel Hobby | Next.jsとの相性。無料 |
| データ取得 | TanStack Query | 再取得・キャッシュ・ポーリング併用 |
| バリデーション | Zod | クライアント／サーバー共通 |
| セッション | jose（JWT）+ HttpOnly Cookie | 独自認証で十分 |
| パスワード | bcrypt | 司会者1アカウントのみ |
| ID生成 | nanoid | ルームコード・トークン |
| QRコード | qrcode | 待機画面・ロビー |
| テスト | Vitest | 得点計算・正規化・状態遷移 |

> ORMは導入しない。Supabase JS + SQLマイグレーション + 生成された型で十分。
> 複雑な集計はSQL関数（RPC）に寄せる。

### 5-1. デザインシステム

- `design.md` のDuolingoスタイルを採用する（白背景、12px角丸、2pxボーダー、緑/青）
- トークンは `app/globals.css` のTailwind v4 `@theme` に定義する
- フォントは `next/font/google` で M PLUS Rounded 1c と Nunito を読み込む
- Duolingoのロゴ・マスコット・画像素材は使わない。マスコットは自作SVG
- 緑 `#58cc02` は白背景の本文にはコントラストが足りないため、本文は `#367a00`、緑ボタンの文字は `#000437` を使う（`ui-design.md` 9-4）
- 会場スクリーンはKahoot!風ステージモード（深紫背景＋鮮やかアクセント）を採用する（V-08決定）。スマホ・司会者PCはDuolingo風ライトテーマのまま
- Kahoot!のロゴ・キャラクター・画像素材も使わない。参考にするのは参加体験と演出だけ

---

## 6. 認証・セッション

### 6-1. 司会者

- 共有アカウント1つ（5人で運用）
- ログイン時に**操作者名**を選択し、操作ログに記録
- パスワードはbcryptでハッシュ化
- セッションは署名付きJWTをHttpOnly Cookieに保存（有効期限12時間）

### 6-2. 参加者

- ルームコード + 名前 + チームで参加
- 参加時に32バイトのランダムトークンを発行
  - Cookie（HttpOnly）と localStorage の両方に保存
  - DBにはハッシュのみ保存
- 再接続時はトークンで本人を復元
- 両方失った場合は、同名・同チームでの再入室を許可する（当日運用でカバー）

### 6-3. 会場スクリーン

- ルーム作成時に発行する `screen_token` をURLに含める
- 読み取り専用。書き込みAPIは一切叩けない
- `noindex` を付与

### 6-4. 共通

- Cookieは `HttpOnly` / `Secure` / `SameSite=Lax`
- 書き込み系はPOSTのみ。CSRFはSameSiteで対策
- ルームコードの試行にレート制限（同一IP・同一ルームで1分10回まで）

---

## 7. データモデル

### 7-1. テーブル

| テーブル | 主なカラム |
|---|---|
| `rooms` | `id`, `code`, `screen_token`, `phase`, `current_question_id`, `phase_ends_at`, `created_at` |
| `teams` | `id`, `room_id`, `name`, `capacity`, `color`, `sort_order` |
| `players` | `id`, `room_id`, `team_id`, `name`, `status`, `token_hash`, `joined_at`, `last_seen_at` |
| `questions` | `id`, `room_id`, `text`, `order_index` |
| `answers` | `id`, `room_id`, `question_id`, `player_id`, `raw_text`, `normalized_text`, `submitted_at`, `updated_at` |
| `answer_groups` | `id`, `room_id`, `question_id`, `team_id`, `label`, `reason`, `created_by` |
| `scores` | `id`, `room_id`, `question_id`, `team_id`, `answer_count`, `max_group_size`, `rate`, `points`, `status` |
| `host_users` | `id`, `login_id`, `password_hash` |
| `operation_logs` | `id`, `room_id`, `operator_name`, `action`, `payload`, `created_at` |

### 7-2. 制約・インデックス

- `answers` は `(question_id, player_id)` に一意制約
- `scores` は `(question_id, team_id)` に一意制約
- `rooms.code` に一意制約
- `answers(room_id, question_id)`、`players(room_id, team_id)` にインデックス
- `answers.group_id` は nullable（統合前はNULL）

### 7-3. RLS

- 全テーブルでRLSを有効化し、**anonキーからのアクセスを全拒否**
- アクセスはサーバーのservice roleのみ
- service roleキーはVercelの環境変数に置き、クライアントへ露出させない

> 「公開前の回答を見せない」はRLSではなく**APIの認可**で保証する。
> クライアントがDBに直接触れない構成なので、境界が1か所に集まる。

---

## 8. 得点計算

### 8-1. 純関数

```ts
export function calcScore(answerCount: number, maxGroupSize: number) {
  if (answerCount < 4) return { status: "not_scored" as const };
  const rate = maxGroupSize / answerCount;
  return {
    status: "scored" as const,
    rate,
    points: Math.round(rate * 10),
  };
}
```

- 回答者4人未満は `not_scored`（0点と区別）
- `Math.round` で四捨五入
- 最大グループが0（全員バラバラ）なら0点

### 8-2. 正規化

```ts
export function normalizeAnswer(input: string) {
  return input
    .normalize("NFKC")
    .trim()
    .replace(/[\s\u3000]+/g, "")
    .replace(/[ァ-ヶ]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0x60)
    )
    .toLowerCase()
    .replace(/[。、．，!！?？]+$/g, "");
}
```

### 8-3. テストケース（必須）

| 回答者数 | 最大グループ | 期待得点 |
|---|---|---|
| 6 | 6 | 10 |
| 6 | 5 | 8 |
| 6 | 4 | 7 |
| 6 | 3 | 5 |
| 6 | 2 | 3 |
| 6 | 0 | 0 |
| 5 | 4 | 8 |
| 4 | 3 | 8 |
| 3 | 3 | 採点対象外 |
| 0 | 0 | 採点対象外 |

---

## 9. リアルタイム設計

### 9-1. 方式

- チャンネル名：`room:{screen_token}`
- サーバーが状態変更後に `{ type: "state_changed", phase }` をBroadcast
- クライアントは受信したら `/api/rooms/{code}/state` を再取得
- 切断時は5秒間隔のポーリングにフォールバック

### 9-2. Postgres Changesを使わない理由

- 回答行の変更がそのまま流れると、公開前に内容が漏れるリスクがある
- RLSに依存すると、認可の境界がDB側に分散する
- 30人規模では「通知＋再取得」で十分な性能が出る

### 9-3. タイマーの扱い

- サーバーは `phase_ends_at` を持つ
- クライアントはローカルでカウントダウン
- 0秒になったら `/tick` を呼ぶ
- 状態取得時にも期限切れを判定し、必要ならフェーズを進める（遅延遷移）
- Vercel Cronには依存しない

---

## 10. API

| メソッド | パス | 用途 | 認可 |
|---|---|---|---|
| POST | `/api/host/login` | 司会者ログイン | なし |
| POST | `/api/host/logout` | ログアウト | 司会者 |
| POST | `/api/host/rooms` | ルーム作成 | 司会者 |
| PATCH | `/api/host/rooms/:id` | チーム・お題・設定の更新 | 司会者 |
| POST | `/api/host/rooms/:id/start` | ゲーム開始 | 司会者 |
| POST | `/api/host/rooms/:id/advance` | 締切・公開・得点確定・次へ | 司会者 |
| POST | `/api/host/rooms/:id/groups/merge` | 回答グループの統合 | 司会者 |
| POST | `/api/host/rooms/:id/groups/unmerge` | 統合の取消 | 司会者 |
| POST | `/api/host/rooms/:id/teams/move` | 参加者のチーム移動 | 司会者 |
| POST | `/api/host/rooms/:id/reset` | ゲームのリセット | 司会者 |
| POST | `/api/rooms/:code/join` | 参加 | なし |
| GET | `/api/rooms/:code/state` | 状態取得 | 参加者／司会者 |
| GET | `/api/rooms/:code/screen` | スクリーン用状態取得 | screen_token |
| POST | `/api/rooms/:code/answers` | 回答の送信・修正 | 参加者 |
| POST | `/api/rooms/:code/tick` | 期限切れの反映 | 参加者 |
| GET | `/api/health` | 死活監視 | なし |

> `advance` はリクエストに `expectedPhase` を含め、現在のphaseと一致しない場合は409を返す。
> 二重クリックや複数タブからの操作で状態が飛ぶのを防ぐ。

---

## 11. 公開前の回答保護

| 対策 | 内容 |
|---|---|
| クライアント | DBに直接アクセスしない |
| API | `phase` が `REVEAL` 以降でなければ、回答内容をレスポンスに含めない |
| スクリーン | `FINAL_CHECK` 中は回答数のみ返す |
| Broadcast | 回答内容・個人名を載せない |
| DB | RLSでanonキーを全拒否。service roleはサーバーのみ |
| ログ | 回答内容をアプリログに出さない |

---

## 12. 無料枠と制約

| サービス | 無料枠の目安 | 対策 |
|---|---|---|
| Supabase Free | DB 500MB、Realtime同時200接続、メッセージ200万/月 | 30〜50人では余裕。7日間アクセスなしで一時停止するため、**本番1週間前に起こす** |
| Vercel Hobby | 帯域100GB/月、個人利用 | 非商用のイベント利用なので範囲内 |
| ドメイン | 任意 | 未取得なら `*.vercel.app` で運用 |

> 数値は契約時点で最新を確認する。無料枠の変更に備え、当日の負荷（50接続）を事前に測る。

---

## 13. 環境

| 環境 | 用途 | 構成 |
|---|---|---|
| local | 開発 | `.env.local` + Supabase開発プロジェクト |
| preview | 確認 | Vercel Preview + 開発プロジェクト |
| production | 本番 | Vercel Production + 本番プロジェクト |

### 環境変数

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # サーバーのみ
SESSION_SECRET=                 # JWT署名
HOST_INITIAL_PASSWORD=          # 初回のみ
```

> `SUPABASE_SERVICE_ROLE_KEY` と `SESSION_SECRET` は `NEXT_PUBLIC_` を付けない。

---

## 14. テスト方針

| 種別 | 対象 | ツール |
|---|---|---|
| 単体 | 得点計算、正規化、状態遷移 | Vitest |
| 結合 | 参加→回答→公開→得点確定 | Vitest + テストDB |
| E2E | 3画面の同期 | Playwright（余裕があれば） |
| 負荷 | 50クライアントの同時回答 | k6 または Artillery |
| 受入 | 下記の受け入れ基準 | 手動 |

### 受け入れ基準

| ID | 基準 |
|---|---|
| AC-01 | QRから60秒以内に参加できる |
| AC-02 | 50端末同時接続で、回答が2秒以内にスクリーンへ反映される |
| AC-03 | 端末を閉じて5分後に開いても、同じ参加者として復帰する |
| AC-04 | 公開前のAPIレスポンスに、他者の回答内容が含まれない |
| AC-05 | 回答者4人未満のチームが「採点対象外」と表示される |
| AC-06 | 退出・途中参加があっても、お題ごとの回答者数で正しく採点される |
| AC-07 | 司会者の二重クリックで状態が飛ばない |
| AC-08 | 5分間のネットワーク切断後、自動で復帰する |
| AC-09 | 会場スクリーンの文字が3mから読める |
| AC-10 | ゲーム終了後、ワンクリックで全データを削除できる |

---

## 15. 開発計画（1ヶ月）

| 週 | 期間 | 内容 | 完了条件 |
|---|---|---|---|
| 第1週 | 11/1–11/7 | 雛形、DBスキーマ、認証、状態遷移の骨格 | ルーム作成→参加→待機まで動く |
| 第2週 | 11/8–11/14 | 回答、締切、最終確認、公開、統合、得点 | 1問のラウンドが最後まで通る |
| 第3週 | 11/15–11/21 | 3画面の同期、復帰、エラー、負荷テスト | 50クライアントで2秒以内 |
| 第4週 | 11/22–11/28 | リハーサル、修正、本番 | AC-01〜AC-10を満たす |

---

## 16. リスク

| リスク | 影響 | 対策 |
|---|---|---|
| Supabaseの無料プロジェクトが一時停止 | 当日動かない | 1週間前に起こす。前日に疎通確認 |
| Realtimeの接続上限 | 一部が同期しない | 5秒ポーリングにフォールバック |
| Vercelのコールドスタート | 初回表示が遅い | 開始前にウォームアップ |
| サーバーレスのタイマー精度 | 締切がずれる | `phase_ends_at` をサーバー基準にし、遅延遷移で補正 |
| service roleキーの漏洩 | 全データ露出 | サーバー専用。`NEXT_PUBLIC_`を付けない |
| 会場Wi-Fiの制限 | 接続できない | 当日の事前確認、テザリング予備 |
| 端末の時刻ずれ | カウントダウンのずれ | サーバー時刻との差分を補正して表示 |

---

## 17. 未決事項

| ID | 論点 | 推奨 |
|---|---|---|
| T-01 | ドメイン | 取得しない（`*.vercel.app`） |
| T-02 | Supabaseアカウント | 無料プランで作成（東京リージョン） |
| T-03 | Vercelアカウント | Hobbyで作成 |
| T-04 | 監視 | 初期版は `/api/health` とVercelのログのみ |
| T-05 | バックアップ | 本番前に `pg_dump` を1回取得 |
