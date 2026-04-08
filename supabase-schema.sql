-- Run this in your Supabase SQL editor to set up the schema

create table if not exists sessions (
  id uuid primary key,
  company text not null,
  role text not null,
  linkedin_url text,
  created_at timestamptz default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  question_text text not null,
  question_type text not null check (question_type in ('behavioral', 'role-specific', 'curveball')),
  order_index integer not null,
  created_at timestamptz default now()
);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  answer_text text not null,
  created_at timestamptz default now(),
  unique(session_id, question_id)
);

-- Enable Row Level Security (allow all for now since there's no auth)
alter table sessions enable row level security;
alter table questions enable row level security;
alter table answers enable row level security;

create policy "Allow all on sessions" on sessions for all using (true) with check (true);
create policy "Allow all on questions" on questions for all using (true) with check (true);
create policy "Allow all on answers" on answers for all using (true) with check (true);

-- HeyGen video columns (run if upgrading an existing schema)
alter table questions add column if not exists heygen_video_id text;
alter table questions add column if not exists video_url text;
