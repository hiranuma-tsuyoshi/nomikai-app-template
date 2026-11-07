# 実装仕様書（現行実装の正本）

最終更新: 2026-11-07  
対象: 本リポジトリのライブMVP（Vercel本番運用）  
位置づけ: **コードの現状**を説明する仕様書。目標仕様は [requirements-v1.2.md](./requirements-v1.2.md)、要件との差分は [requirements-status.md](./requirements-status.md) を参照。

---

## 1. スコープ

- 飲み会・社内イベント向けのチーム対抗「回答一致率」ゲーム
- 参加者スマホ、司会者PC、会場スクリーンの3画面
- 1デプロイ = 1ルーム。同時に複数イベントは運用しない
- 認証は司会者キー＋参加者Cookie。ユーザーアカウントは持たない
- 状態は1つのJSONとして保存し、クライアントはポーリングで同期する

構成図: [architecture/nomikai-architecture.html](./architecture/nomikai-architecture.html)（[PNG](./architecture/nomikai-architecture.png) / [ダーク](./architecture/nomikai-architecture-dark.png)）

---

## 2. システム構成

```text
参加者スマホ ─┐
司会者PC ─────┼─ HTTPS ─→ Vercel (Next.js 15 / Route Handlers, hnd1)
会場スクリーン ┘                    │
                                    ├─ Supabase Postgres (game_states 1行)
                                    └─ または .data/game-state.json
```

| 層 | 実装 |
|---|---|
| フロントエンド | Next.js 15 App Router / React 19 / TypeScript / Tailwind CSS v4 |
| API | Next.js Route Handlers（`app/api/**/route.ts`）。すべて `runtime = "nodejs"` |
| 状態保存 | Supabase `game_states` またはファイル |
| 同期 | HTTPポーリング（Realtime / WebSocketは未使用） |
| ホスティング | Vercel。`vercel.json` で `hnd1` |
| CI | GitHub Actions（テンプレート）。テスト・lint・build |

---

## 3. 画面とルーティング

| 画面 | パス | 認証 | ポーリング間隔 |
|---|---|---|---|
| ランディング | `/` | なし | - |
| 参加者 | `/play?code=（ルームコード）` | 参加者Cookie（参加後） | 1.2秒 |
| 司会者 | `/host` | 司会者キー | 1.2秒 |
| お題管理 | `/host/questions` | 司会者キー | 操作時 |
| 会場スクリーン | `/stage?token=（screenToken）` | トークン（任意で必須化） | 1.0秒 |

- `?preview=1` はUI確認用のモック表示。実データを読み書きしない
- `/play` は参加前、参加後に同じパスを使う
- スクリーンは司会者画面の「スクリーン」リンクから開く

---

## 4. データモデル

### 4-1. `GameState`

保存単位は1つのJSON。`schemaVersion: 1`。

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

### 4-2. `room`

| フィールド | 型 | 説明 |
|---|---|---|
| `code` | string | 参加者が入力するルームコード。既定 `4821` |
| `title` | string | `以心伝心ゲーム` |
| `screenToken` | string | スクリーンURL用トークン。初期化時にランダム生成 |
| `phase` | LivePhase | 現在フェーズ |
| `currentQuestionIndex` | number | 0始まり |
| `phaseEndsAt` | string \| null | ISO日時。回答・最終確認の期限 |
| `finalCheckSeconds` | number | 既定30 |
| `startedAt` | string \| null | 開始日時 |
| `finishedAt` | string \| null | 終了日時 |
| `lottery` | Record<string, number> | チームID → 0..1。終了時に抽選 |
| `updatedAt` | string | 更新日時 |

### 4-3. `teams`

```ts
type LiveTeam = {
  id: string;        // team-a, team-b, ...
  name: string;      // チームA, チームB, ...
  color: string;     // パレットから順番に割当
  capacity: number;  // 1〜50。既定7
  sortOrder: number;
};
```

- 初期チーム数は `TEAM_COUNT`（既定5、2未満なら5）
- チーム名の変更UIはない
- チーム追加は `WAITING` / `READY` のみ。最大10チーム
- 追加チームは定員7で作られる

### 4-4. `players`

```ts
type LivePlayer = {
  id: string;
  teamId: string;
  name: string;
  status: "active" | "sleeping" | "left";
  tokenHash: string | null; // 参加者CookieのSHA-256
  joinedAt: string;
  lastSeenAt: string;
};
```

- 参加時に `active` で作成
- `sleeping` / `left` は型定義のみ。現行UI・APIに変更手段はない
- チーム定員は `active + sleeping` で判定
- 同じ名前は全参加者を対象に自動採番（`名前 2`, `名前 3` …）

### 4-5. `questions`

```ts
type LiveQuestion = {
  id: string;
  text: string;              // 1〜100文字
  timeLimitSeconds: number;  // 10〜600秒
  orderIndex: number;        // 0始まり
};
```

- 最大50問
- 初期値は汎用8問（`SEED_QUESTION_TEXTS`）
- 開始時に `questionsFrozen = true`

### 4-6. `answers`

```ts
type LiveAnswer = {
  id: string;
  questionId: string;
  playerId: string;
  teamId: string;
  rawText: string;        // 1〜20文字
  normalizedText: string;
  submittedAt: string;
  updatedAt: string;
  revisionCount: number;  // 修正回数
};
```

- 1人1問1回答。修正は上書き
- `teamId` は回答時点の所属。開始前の参加者移動時は現行お題の回答も追従

### 4-7. `groups`（手動統合）

```ts
type LiveAnswerGroup = {
  id: string;
  questionId: string;
  teamId: string;
  label: string;    // 統合後の回答名 1〜20文字
  reason: string;   // 統合理由 1〜40文字
  childKeys: string[]; // 正規化キー
  children: Array<{ text: string; count: number }>; // 統合時スナップショット
  createdBy: string;
  createdAt: string;
};
```

### 4-8. `scores`

```ts
type LiveScore = {
  questionId: string;
  teamId: string;
  answerCount: number;
  maxGroupSize: number;
  rate: number | null;
  points: number | null;
  status: "scored" | "not_scored";
  perfect: boolean;
  createdAt: string;
};
```

- `not_scored` は `rate` / `points` が `null`
- `perfect` は10点のとき `true`

### 4-9. `logs`

```ts
type LiveLog = {
  id: string;
  action: string;
  actor: string;
  payload: Record<string, unknown>;
  createdAt: string;
};
```

- 最大500件。古いものから削除
- 参加・統合・司会者操作・自動遷移などを記録
- 回答送信は記録しない

---

## 5. 状態遷移

### 5-1. フェーズ一覧

| フェーズ | 意味 | 現行UIでの到達 |
|---|---|---|
| `WAITING` | 参加受付・開始待ち | 初期状態 / リセット後 |
| `READY` | 開始待ち（別名） | API上のみ。UIは使わない |
| `ANSWERING` | 回答受付中 | 開始 / 次のお題 |
| `ANSWER_CLOSED` | 回答締切（中間） | 定義のみ。UIは経由しない |
| `FINAL_CHECK` | 最終確認30秒 | 締切 / 時間切れ |
| `REVEAL` | 回答公開 | 公開 / 時間切れ |
| `GROUPING` | 意味統合 | 「グループ統合へ」 |
| `SCORED` | 得点確定 | 「得点を確定する」 |
| `FINISHED` | 最終結果 | 最終問題後の「最終結果を表示」 |

### 5-2. 通常の流れ

```text
WAITING
  └─ start ─→ ANSWERING
                 ├─ close / 時間切れ ─→ FINAL_CHECK
                 │                          ├─ reveal / 時間切れ ─→ REVEAL
                 │                          │                          └─ grouping ─→ GROUPING
                 │                          │                                            └─ score ─→ SCORED
                 │                          └─ score（REVEALから直接も可） ───────────────→ SCORED
                 └─ next（最終問題） ───────────────────────────────────────────────────→ FINISHED
```

- `score` は `GROUPING` または `REVEAL` から実行可能
- `next` は `SCORED` のみ。最終問題なら `finishGame`
- `finish` はAPI上どのフェーズからでも実行可能。UIは得点確定後・最終結果画面に表示
- `reset` / `reset-all` はAPI上どのフェーズからでも実行可能。UIは `FINISHED` のみ

### 5-3. 期限切れの扱い

- `phaseEndsAt` を過ぎると、次に状態を読んだ/変更したタイミングで自動遷移する
- `ANSWERING` → `FINAL_CHECK`（`finalCheckSeconds` を再設定）
- `FINAL_CHECK` → `REVEAL`
- `ANSWER_CLOSED` は読み込んだ時点で `FINAL_CHECK` へ
- 自動遷移はリクエスト駆動。誰もアクセスしないと進まない
- ポーリング間隔の分だけ最大1〜1.5秒遅れる

### 5-4. 最終確認の延長

- `extend` は `FINAL_CHECK` のみ
- `deltaSeconds` は -120〜180
- 新しい期限は `now + 1秒` 〜 `now + 180秒` にクランプ
- UIは `−30秒` / `＋30秒`

### 5-5. リセット

`reset` / `reset-all` の共通処理:

| 対象 | reset | reset-all |
|---|---|---|
| `answers` | 消去 | 消去 |
| `groups` | 消去 | 消去 |
| `scores` | 消去 | 消去 |
| `phase` | `WAITING` | `WAITING` |
| `currentQuestionIndex` | 0 | 0 |
| `phaseEndsAt` / `startedAt` / `finishedAt` / `lottery` | 初期化 | 初期化 |
| `questionsFrozen` | `false` | `false` |
| `players` | 残す | 消去 |
| `teams` | **残す（変更しない）** | **残す（変更しない）** |
| `questions` | **残す（変更しない）** | **残す（変更しない）** |

> チームは初期状態に戻らない。チーム数を戻したい場合はAPI/DBを直接操作するか、再デプロイ前に初期化する。お題も消えない。

---

## 6. ドメインルール

### 6-1. 参加

`joinState` の条件:

1. `phase !== "FINISHED"`
2. 指定チームが存在する
3. チームの `active + sleeping` が定員未満
4. 名前が1〜20文字（見た目上の文字数、絵文字は1文字）
5. ルームコードが一致する（API層）

- 参加可能なのはゲーム終了前まで。`ANSWERING` / `FINAL_CHECK` なら現行のお題に回答できる
- `REVEAL` / `GROUPING` / `SCORED` の途中参加は、次のお題から回答できる
- 同名は `名前 2`、`名前 3` … と自動採番
- 参加者Cookieは12時間有効。`httpOnly` / `sameSite=lax` / 本番は `secure`
- Cookieを失うと同一人物と判別できない。再参加すると別参加者になる

### 6-2. 回答

`submitAnswer` の条件:

1. 参加者が存在し、`left` でない
2. `phase` が `ANSWERING` または `FINAL_CHECK`
3. `phaseEndsAt` が未来、または期限なし
4. 現行のお題が存在する
5. 回答が1〜20文字

- 同一参加者・同一お題は上書き。`revisionCount` を加算
- 公開（`REVEAL`）後は変更不可
- レート制限・連打対策はサーバー側にない（ボタン無効化のみ）

### 6-3. 正規化

`normalizeAnswer` の順序:

1. NFKC（全角英数字→半角、半角カナ→全角カナ）
2. 前後の空白除去
3. すべての空白（半角・全角）を除去
4. カタカナ（ァ〜ヶ）→ ひらがな
5. 小文字化
6. 末尾の `。、．，!！?？` を1文字以上除去

補足:

- NFKCでASCIIの `.` `,` になったものは末尾除去の対象外
- 長音符 `ー`、濁点の違い、漢字の異体字は吸収しない
- 意味の統合は司会者の手動操作

### 6-4. 回答グループ

**自動グループ**

- 同一チーム・同一お題・同一 `normalizedText` をまとめる
- 表示テキストは最頻出の `rawText`。同数なら `submittedAt` が早いもの
- 並びは人数降順 → 正規化キー昇順

**手動統合**

- `GROUPING` のみ
- 同一チーム内の自動グループを2つ以上選択
- 統合後の名前 1〜20文字、理由 1〜40文字
- すでに統合済みのキーは含められない（入れ子統合は不可）
- 表示は統合グループを人数降順 → テキスト昇順
- 統合の理由は `REVEAL` / `GROUPING` / `SCORED` の全チームに表示
- 取消は `GROUPING` のみ。統合IDを削除する
- 統合時点の子グループをスナップショット保存する

### 6-5. 得点

```text
rate   = 最大グループ人数 / そのお題の回答者数
points = round(rate × 10)
```

- `answerCount < 4` は `not_scored`（0点ではない）
- `maxGroupSize` は `answerCount` を超えないようクランプ
- 統合グループは子グループの人数合計
- チームごとに独立して計算
- 得点確定時に、そのお題の既存スコアを置き換える
- 得点確定後の再計算はAPI上不可（`score` は `GROUPING` / `REVEAL` のみ）

### 6-6. 順位

**ゲーム中**

1. 総得点の降順
2. 全員一致回数の降順
3. チームID昇順（表示順の安定用）
4. 順位は総得点のみで決定。同点は同順位（competition ranking）

**最終結果**

1. 総得点の降順
2. 全員一致回数の降順
3. 最終お題の得点の降順
4. `lottery` の昇順（小さいほど上位）
5. 順位は1〜Nの連番

- `lottery` は `finishGame` 時にチームごと `Math.random()` で未設定なら代入
- 最終お題の得点は「お題リストの最後」のスコア。途中終了時は0になり得る

---

## 7. API

### 7-1. 共通

- 形式: JSON（QRのみPNG）
- エラー: `{ error: string, code: string, details?: string[] }`
- `GameError` は指定ステータス、Zodは422 `VALIDATION_ERROR`、不明は500 `INTERNAL_ERROR`
- 日時はISO 8601（UTC）
- すべて `dynamic = "force-dynamic"`

### 7-2. 参加者・公開

| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| POST | `/api/join` | なし | `{code,name,teamId}` → 201 `{view}`。参加者Cookieを発行 |
| GET | `/api/state` | 参加者Cookie | `{view}`。未参加は401 `NEEDS_JOIN` + `room` |
| POST | `/api/answers` | 参加者Cookie | `{text}` → `{view}` |
| GET | `/api/room` | なし | `{room}`。参加画面の初期表示用 |
| GET | `/api/stage?token=` | スクリーントークン | `{view}`。`STAGE_REQUIRE_TOKEN=1` なら必須 |
| GET | `/api/qr?text=` | なし | PNG。`text` は500文字以内 |
| GET | `/api/health` | なし | `{ok,service,now,region,commit,store}` |

### 7-3. 司会者

認証: `x-host-key` ヘッダー、`?key=`、または `nomikai_host` Cookie。

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/api/host/auth` | `{key}` → `{ok}`。Cookie発行 |
| GET | `/api/host/state` | `{view}` |
| POST | `/api/host/advance` | `{action, expectedPhase?, deltaSeconds?}` → `{view}` |
| GET | `/api/host/questions` | `{questions,frozen,phase}` |
| PUT | `/api/host/questions` | `{questions:[{id?,text,timeLimitSeconds}]}` → `{questions,frozen:false}` |
| POST | `/api/host/teams` | `{action:"capacity"\|"add"\|"move-player", ...}` → `{view}` |
| POST | `/api/host/groups` | `{action:"merge"\|"unmerge", ...}` → `{view}` |

`/api/host/advance` の `action`:

| action | 遷移 | 主なエラー |
|---|---|---|
| `start` | WAITING/READY → ANSWERING | お題0件、チーム2未満、開始済み |
| `close` | ANSWERING → FINAL_CHECK | 回答受付中でない |
| `reveal` | FINAL_CHECK/ANSWER_CLOSED → REVEAL | 最終確認中でない |
| `grouping` | REVEAL → GROUPING | 回答公開中でない |
| `score` | GROUPING/REVEAL → SCORED | 統合フェーズでない |
| `next` | SCORED → ANSWERING / FINISHED | 得点確定後でない |
| `finish` | 任意 → FINISHED | - |
| `reset` | 任意 → WAITING（参加者保持） | - |
| `reset-all` | 任意 → WAITING（参加者消去） | - |
| `extend` | FINAL_CHECKの期限変更 | 最終確認中でない |

`expectedPhase` を付けると、現在フェーズと不一致時に409 `PHASE_CONFLICT`。司会者UIは常に付与する。

### 7-4. 主なエラーコード

| コード | HTTP | 意味 |
|---|---|---|
| `ROOM_NOT_FOUND` | 404 | ルームコード不一致 |
| `TEAM_NOT_FOUND` | 404 | チーム不在 |
| `TEAM_FULL` | 409 | チーム定員超過 |
| `GAME_FINISHED` | 409 | 終了後の参加 |
| `NEEDS_JOIN` | 401 | 参加者Cookieなし |
| `ANSWERS_CLOSED` | 409 | 回答受付終了 |
| `INVALID_ANSWER` | 422 | 回答が空、または20文字超 |
| `INVALID_PHASE` | 409 | フェーズ違い |
| `PHASE_CONFLICT` | 409 | 画面が古い |
| `QUESTIONS_FROZEN` | 409 | 開始後のお題変更 |
| `HOST_UNAUTHORIZED` | 401 | 司会者キー不一致 |
| `SCREEN_UNAUTHORIZED` | 401/403 | スクリーントークン不備 |
| `ALREADY_MERGED` | 409 | 統合済みの回答を再統合 |
| `MERGE_NEEDS_TWO` | 422 | 統合対象が2未満 |
| `INTERNAL_ERROR` | 500 | 想定外。状態更新競合の枯渇も含む |

---

## 8. 認証

### 8-1. 司会者

- 共有秘密 `HOST_KEY`。未設定時は `4821`
- 比較は `crypto.timingSafeEqual`（長さ不一致は即false）
- 初回 `?key=` でCookie `nomikai_host` を発行（12時間、`httpOnly`、`sameSite=lax`、本番 `secure`）
- クライアントは `sessionStorage` にもキーを保存し、`x-host-key` ヘッダーで送る
- 操作者名は `x-host-actor` があれば使用。なければ「運営」

> `HOST_KEY` は全司会者で共有する。個人アカウント・権限分離・操作者認証はない。

### 8-2. 参加者

- 参加時に32バイト相当のランダムトークンを発行
- 状態には `SHA-256` ハッシュだけを保存（生トークンは保存しない）
- Cookie `nomikai_player`（12時間、`httpOnly`、`sameSite=lax`、本番 `secure`）
- APIはCookieのハッシュを参加者一覧と照合
- 退出・失効・再発行のAPIはない

### 8-3. スクリーン

- `room.screenToken` を `?token=` で渡す
- `STAGE_REQUIRE_TOKEN=1` の場合は必須（未指定401、不一致403）
- トークンのローテーション機能はない

### 8-4. 保護範囲

- 回答は `REVEAL` まで他者に返さない（参加者APIは自分の回答のみ）
- 司会者APIは全回答を返す
- CSRFトークンはなし（SameSite=Laxに依存）
- レート制限・IP制限・WAFはなし

---

## 9. 永続化

### 9-1. 保存先の選択

`NEXT_PUBLIC_SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` の**両方**が設定されていればSupabase、なければファイル。

| モード | 保存先 | 用途 |
|---|---|---|
| Supabase | `public.game_states` の1行 | 本番・複数インスタンス |
| ファイル | `.data/game-state.json`（`GAME_STATE_FILE`で変更可） | ローカル・同一Wi-Fiフォールバック |

### 9-2. Supabaseスキーマ

`supabase/migrations/0002_game_state.sql`:

- `room_code text primary key`
- `state jsonb not null`
- `version integer not null`
- `updated_at timestamptz not null`

行キーは `GAME_ROOM_KEY`（既定 `default`）。RLS有効・ポリシーなし。`service_role` のみアクセス。

### 9-3. 楽観ロック

Supabaseの更新は次の条件付きUPDATE:

```sql
update game_states
set state = $state, version = $next, updated_at = now()
where room_code = $room and version = $current
```

- 更新行が0なら競合。再試行する
- 最大40回。指数バックオフ＋ジッター（上限400ms）
- 同一インスタンス内はキューで直列化
- 40回失敗すると500（「状態更新が混み合っています」）
- 参加・回答・司会者操作のたびに `version` が1増える

### 9-4. ファイル保存

- 書き込みは同一ディレクトリの一時ファイル→`rename`
- `rename` 失敗時は既存ファイルを削除して再試行
- プロセス内キューで直列化
- 複数プロセス・複数インスタンスでは安全でない

### 9-5. 読み取り時の自動遷移

`readGameState()` は毎回 `tickState()` を実行し、変更があった場合だけ保存する。  
`mutateGameState()` は変更関数の前後に `tickState()` と `room.updatedAt` 更新を行う。

---

## 10. クライアント同期

- 共通フック `usePollingJson`
- 前のリクエスト完了後に次を予約。リクエストは重ならない
- 間隔: 参加者1.2秒、司会者1.2秒、スクリーン1.0秒
- 操作後は `refresh()` で即時再取得
- 通信失敗時はエラーを保持し、次回ポーリングで自動回復
- カウントダウンはサーバーの期限と `serverNow` を基準に表示
- 画面復帰・再接続の専用処理はない（ポーリングがそのまま再開）

---

## 11. 環境変数

| 変数 | 必須 | 既定 | 説明 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 本番 | - | Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 本番 | - | サーバー専用キー。`NEXT_PUBLIC_` を付けない |
| `HOST_KEY` | 本番必須 | `4821` | 司会者キー。既定値のまま公開しない |
| `ROOM_CODE` | 任意 | `4821` | 参加用ルームコード |
| `TEAM_COUNT` | 任意 | `5` | 初期チーム数。2未満は5 |
| `TEAM_CAPACITY` | 任意 | `7` | 初期定員。1未満は7 |
| `STAGE_REQUIRE_TOKEN` | 推奨 | - | `1` でスクリーントークン必須 |
| `GAME_ROOM_KEY` | 任意 | `default` | Supabase行キー |
| `GAME_STATE_FILE` | 任意 | `.data/game-state.json` | ファイル保存先 |
| `VERCEL_REGION` | 自動 | - | `/api/health` 表示用 |
| `VERCEL_GIT_COMMIT_SHA` | 自動 | - | `/api/health` の `commit` |

### 未使用（レガシー）

以下は現行ライブ実装では使っていない。`.env.example` から削除済み／削除予定。

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SESSION_SECRET`
- `HOST_LOGIN_ID`
- `HOST_PASSWORD`

`npm run create-host` と `host_users` テーブルも旧認証方式の遺物。現行の司会者認証は `HOST_KEY` のみ。

---

## 12. テストと検証

### 12-1. 自動テスト

```bash
npm test        # Vitest（scoring / questions / format）
npm run lint
npm run build
```

### 12-2. ライブ検証スクリプト

| スクリプト | 内容 | 前提 |
|---|---|---|
| `npm run smoke:live` | 参加→開始→回答→最終確認→公開→統合→得点→終了 | 起動中のサーバー |
| `npm run review:live` | UI通し・スクリーンショット | 起動中のサーバー |
| `npm run load:live` | 30人参加・一斉回答 | 本番ビルド推奨 |
| `npm run review:*` | 各画面のUIレビュー | 起動中のサーバー |

- `smoke:live` / `review:live` / `load:live` は**同じルーム状態を書き換える**。同時実行しない
- 検証後は `WAITING` / 参加者0 / お題復元に戻す
- `load:live` は `PLAYER_COUNT`（既定30）で人数を変更できる

### 12-3. 本番確認

```bash
curl https://your-app.vercel.app/api/health
```

確認項目:

- `ok: true`
- `store.backend: "supabase"`
- `region: "hnd1"`
- `commit` がデプロイしたコミットと一致

---

## 13. 既知の制約・未実装

### 運用上の制約

- 1デプロイ = 1ルーム。複数ルームの同時運用は不可
- ゲーム中のチーム追加・参加者移動・チーム名変更は不可
- 参加者の退出・スリープ・削除UIはない
- 開始後のお題変更は不可。リセットは最終結果画面のみ
- 途中参加者は現行のお題から回答できる（要件の「次のお題から」とは異なる）
- 司会者キーは共有秘密。個人アカウント・操作者別権限はない
- スクリーントークンは固定。ローテーションなし
- UIは日本語のみ
- オフライン・デスクトップアプリは未対応（本番後に対応予定）

### セキュリティ・信頼性

- レート制限・CSRFトークン・IP制限はない
- 回答の完全な監査履歴はない（`logs` は最大500件、回答送信は未記録）
- 24時間後の自動削除・保持期限の自動処理はない
- 本番ビルドはCookieに `Secure` を付けるため、`http://192.168.x.x:3000` のLAN運用ではスマホ参加が失敗し得る
- Supabase無料プランは7日間アクセスがないと一時停止する
- `HOST_KEY` 未設定時は `4821` になる。本番では必ず設定する

### 目標仕様との差分

詳細は [requirements-status.md](./requirements-status.md) を参照。

---

## 14. 変更時の注意

1. `GameState` の形を変える場合は `schemaVersion` を上げ、既存JSONの移行を用意する
2. 状態遷移を変える場合は `tickState` と `applyHostAction` の両方を確認する
3. 得点・順位を変える場合は `lib/scoring.ts` と `buildRanking` のテストを追加する
4. APIの認証を変える場合は `lib/server/request-auth.ts` と各Route Handlerを確認する
5. 保存方式を変える場合は `lib/server/game-store.ts` の `read` / `mutate` 契約を守る
6. UIのフェーズ表示は `HostView` / `ParticipantView` / `StageView` のView型を経由する。`GameState` を直接クライアントへ返さない
