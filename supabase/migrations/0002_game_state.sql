-- 以心伝心ゲーム live state
-- 1ルームの進行状態をJSONで保持する。サーバーのservice roleだけが読み書きする。
-- 正規化テーブル（0001）は将来の分析用に残し、当日の進行はこのテーブルを使う。

create table if not exists public.game_states (
  room_code text primary key,
  state jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint game_states_room_code_length check (
    char_length(room_code) between 1 and 40
  ),
  constraint game_states_version_positive check (version >= 1)
);

alter table public.game_states enable row level security;
revoke all on public.game_states from anon, authenticated;

comment on table public.game_states is
  'Single-row live game snapshot for the MVP. Optimistic locking uses version.';
