-- 以心伝心ゲーム initial schema
-- All client access goes through the Next.js server using the service role key.
-- RLS is enabled with no policies, so anon/authenticated cannot read or write directly.

create type public.room_phase as enum (
  'WAITING',
  'READY',
  'ANSWERING',
  'ANSWER_CLOSED',
  'FINAL_CHECK',
  'REVEAL',
  'GROUPING',
  'SCORED',
  'FINISHED'
);

create type public.player_status as enum ('active', 'sleeping', 'left');
create type public.score_status as enum ('scored', 'not_scored');

create table public.host_users (
  id uuid primary key default gen_random_uuid(),
  login_id text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  constraint host_users_login_id_length check (char_length(login_id) between 1 and 50)
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  screen_token text not null unique,
  title text not null default '以心伝心ゲーム',
  phase public.room_phase not null default 'WAITING',
  current_question_id uuid,
  phase_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  constraint rooms_code_format check (code ~ '^[A-Z0-9]{4,8}$'),
  constraint rooms_title_length check (char_length(title) between 1 and 60)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  capacity integer not null default 6,
  color text not null default '#58cc02',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (room_id, name),
  constraint teams_name_length check (char_length(name) between 1 and 30),
  constraint teams_capacity_range check (capacity between 1 and 50),
  constraint teams_color_format check (color ~ '^#[0-9A-Fa-f]{6}$')
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  name text not null,
  status public.player_status not null default 'active',
  token_hash text unique,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint players_name_length check (char_length(name) between 1 and 30)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  text text not null,
  order_index integer not null,
  time_limit_seconds integer not null default 60,
  created_at timestamptz not null default now(),
  unique (room_id, order_index),
  constraint questions_text_length check (char_length(text) between 1 and 100),
  constraint questions_time_limit_range check (
    time_limit_seconds between 10 and 600
  )
);

alter table public.rooms
  add constraint rooms_current_question_fk
  foreign key (current_question_id)
  references public.questions(id)
  on delete set null;

create table public.answer_groups (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  label text not null,
  reason text,
  created_by text,
  created_at timestamptz not null default now(),
  constraint answer_groups_label_length check (char_length(label) between 1 and 40)
);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  group_id uuid references public.answer_groups(id) on delete set null,
  raw_text text not null,
  normalized_text text not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, player_id),
  constraint answers_raw_text_length check (char_length(raw_text) between 1 and 20)
);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  answer_count integer not null default 0,
  max_group_size integer not null default 0,
  rate numeric(5, 4),
  points integer,
  status public.score_status not null default 'not_scored',
  created_at timestamptz not null default now(),
  unique (question_id, team_id),
  constraint scores_answer_count_range check (answer_count >= 0),
  constraint scores_max_group_range check (
    max_group_size >= 0 and max_group_size <= answer_count
  ),
  constraint scores_rate_range check (
    rate is null or (rate >= 0 and rate <= 1)
  ),
  constraint scores_points_range check (
    points is null or (points >= 0 and points <= 10)
  )
);

create table public.operation_logs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade,
  operator_name text not null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint operation_logs_operator_length check (
    char_length(operator_name) between 1 and 30
  )
);

create index teams_room_id_idx on public.teams(room_id);
create index players_room_id_idx on public.players(room_id);
create index players_team_id_idx on public.players(team_id);
create index questions_room_id_idx on public.questions(room_id);
create index answer_groups_question_id_idx on public.answer_groups(question_id);
create index answer_groups_team_id_idx on public.answer_groups(team_id);
create index answers_room_question_idx on public.answers(room_id, question_id);
create index answers_team_question_idx on public.answers(team_id, question_id);
create index answers_group_id_idx on public.answers(group_id);
create index scores_room_id_idx on public.scores(room_id);
create index operation_logs_room_id_idx on public.operation_logs(room_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger rooms_set_updated_at
before update on public.rooms
for each row execute function public.set_updated_at();

create trigger answers_set_updated_at
before update on public.answers
for each row execute function public.set_updated_at();

-- RLS: deny all for anon/authenticated. The service role bypasses RLS.
alter table public.host_users enable row level security;
alter table public.rooms enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.answer_groups enable row level security;
alter table public.scores enable row level security;
alter table public.operation_logs enable row level security;

-- Explicitly revoke direct access from client roles.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

comment on table public.answers is
  'team_id is a snapshot of the team at submission time. Moving a player later must not change past scores.';
comment on table public.scores is
  'One row per question and team. rate = max_group_size / answer_count; points = round(rate * 10).';
