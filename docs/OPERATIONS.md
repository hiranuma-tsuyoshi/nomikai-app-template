# 運用手順

## 役割

| 役割 | 担当 | 画面 |
|---|---|---|
| 司会者 | 進行・お題・統合・採点 | `/host` |
| スクリーン | 会場投影 | `/stage?token=...` |
| 参加者 | スマホで回答 | `/play?code=...` |
| サブ幹事 | 参加者の入場支援・トラブル対応 | 参加者画面 |

## 本番前チェック

### 1週間前

- [ ] Supabaseプロジェクトが起動している（無料プランは7日で停止）
- [ ] Vercelの本番URLが開ける
- [ ] `/api/health` の `store.backend` が `supabase`
- [ ] 司会者キーを本番用に変更した
- [ ] お題を確定した
- [ ] チーム数・定員を決めた
- [ ] 会場Wi-Fiでスマホから接続できるか確認した

### 前日

- [ ] `npm test` / `npm run lint` / `npm run build` が成功
- [ ] `smoke:live` が成功
- [ ] 30人規模の負荷テストが成功（可能なら）
- [ ] スクリーンURLのtokenを控えた
- [ ] 予備の司会者端末を用意した

### 負荷テスト

本番URLに対して、参加 → 一斉回答 → 締切 → 公開までを確認します。

```bash
BASE_URL=https://your-app.vercel.app \
HOST_KEY=your-host-key \
ROOM_CODE=4821 \
TEAM_COUNT=5 \
PLAYER_COUNT=30 \
npm run load:live
```

PowerShell:

```powershell
$env:BASE_URL="https://your-app.vercel.app"
$env:HOST_KEY="your-host-key"
$env:ROOM_CODE="4821"
$env:TEAM_COUNT="5"
$env:PLAYER_COUNT="30"
npm run load:live
```

- `ROOM_CODE` / `TEAM_COUNT` は本番設定に合わせる
- テスト終了時は自動で `WAITING` に戻り、お題も復元される
- `smoke:live` / `review:live` / `load:live` は**同時に実行しない**

### 当日開始前

- [ ] 司会者PCを電源に接続
- [ ] スクリーンをHDMIで接続し、解像度を確認
- [ ] `/host?key=...` を開く
- [ ] 「スクリーン」リンクを開き、参加用QRコードが表示されることを確認
- [ ] スマホで参加テスト（1人）
- [ ] 参加者を `WAITING` で待機させる
- [ ] お題が8問など想定件数あることを確認

## ゲームの流れ

```
WAITING
  ↓ 開始
ANSWERING（回答受付）
  ↓ 締切
FINAL_CHECK（30秒の最終確認）
  ↓ 公開
REVEAL（回答公開）
  ↓ 統合へ
GROUPING（意味統合）
  ↓ 得点確定
SCORED（得点発表）
  ↓ 次のお題 / 終了
ANSWERING ... → FINISHED（最終結果）
```

### 開始

1. 参加者が揃ったら「ゲームを開始」
2. お題が凍結される
3. 回答時間が終わると自動で締切、または手動で締切

### 最終確認

- 回答締切後、30秒間は参加者が回答を修正できる
- 司会者は「公開」で確定

### 回答公開・統合

- 表記ゆれは自動で正規化される
- 意味が同じ回答は司会者が理由を付けて統合する
- 統合は取消可能
- 統合理由は全チームに表示される

### 採点・次へ

- 「得点確定」で一致率×10が確定
- 「次のお題」で次へ
- 最終お題の後は「終了」で最終結果

## チーム運営

- 参加者数に上限はない
- チーム数は2以上（目安2〜6）
- 欠席・遅刻・途中参加・早退はそのまま参加/退出で対応
- 司会者も選手として参加できる
- チームの追加・定員変更・参加者移動は司会者画面から行う
- 回答者4人未満のチームは採点対象外

## 同点順位

1. 全員一致の回数
2. 最終お題の得点
3. 抽選

## トラブル対応

| 症状 | 対応 |
|---|---|
| 画面が更新されない | 1〜1.5秒ポーリング。Wi-Fiを確認し、再読み込み |
| 参加できない | ルームコード、URL、Cookieを確認。別ブラウザで試す |
| 司会者画面が401 | `HOST_KEY` と `?key=` を確認 |
| スクリーンが401 | `STAGE_REQUIRE_TOKEN=1` の場合は `?token=` が必要 |
| Supabaseが停止 | DashboardからRestore。復旧後に再読み込み |
| お題を変更できない | 開始後は凍結。`reset-all` で待機に戻す |
| 参加者が重複 | 司会者画面で退出処理、または本人に別端末で参加してもらう |
| 進行状態が壊れた | `reset-all`。必要ならバックアップから復元 |

## リセット

司会者画面の **reset-all** で以下を初期化します。

- フェーズを `WAITING`
- 参加者・回答・得点を削除
- お題の凍結を解除
- チームを初期状態に戻す

本番中に誤って押さないよう、確認ダイアログの内容を確認してください。

## バックアップと復元

### Supabase

`game_states` テーブルの行をエクスポートします。

```sql
select state from public.game_states where room_code = 'default';
```

復元する場合は `state` をJSONとして保存し、同じ行に戻します。復元前にアプリを停止するか、`reset-all` で初期化してください。

### ファイル保存

`.data/game-state.json` をコピーします。

## 障害時のフォールバック

Supabaseが使えない場合、ローカルPCでファイル保存モードに切り替えられます。

1. `.env.local` から `NEXT_PUBLIC_SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` を外す
2. サーバーを再起動
3. `/api/health` が `file` になることを確認
4. 会場の同一Wi-Fiから `http://<PCのIP>:3000` でアクセス

ただし、Vercel上の本番ではこの切り替えはできません。会場予備PCにローカル環境を用意しておくと安心です。
