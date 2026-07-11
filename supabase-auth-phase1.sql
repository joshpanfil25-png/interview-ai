-- ============================================================
-- Runback — Phase 1 Auth: profiles + optional user association + RLS
-- ============================================================
-- Run this in the Supabase SQL editor (Josh runs it manually).
--
-- BACKWARD-COMPATIBLE with the deployed guest flow: every interview row keeps
-- working with user_id = NULL, and guest (NULL-owned) rows stay fully
-- accessible to the anon role — so the current anonymous flow is unchanged.
-- The app uses the anon key only, so RLS is enforced; these policies preserve
-- the guest path while adding per-user isolation for future authenticated users.
--
-- Run during low traffic and verify a guest interview immediately after.
-- ============================================================

-- 1) profiles table, 1:1 with auth.users
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 2) Auto-create a profile when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3) Optional user association on sessions.
--    Nullable + ON DELETE SET NULL: existing/future guest rows keep user_id = NULL
--    and stay valid; deleting a user demotes their sessions to guest rows
--    instead of destroying interview history.
alter table public.sessions
  add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists sessions_user_id_idx on public.sessions(user_id);

-- 4) Replace "allow all" with guest-preserving, per-user policies.
--    Guest rows (user_id IS NULL) stay fully accessible to anon → current
--    anonymous flow is unchanged. Authenticated users also get their own rows.

-- sessions
drop policy if exists "Allow all on sessions" on public.sessions;
create policy "sessions_select" on public.sessions
  for select using (user_id is null or auth.uid() = user_id);
create policy "sessions_insert" on public.sessions
  for insert with check (user_id is null or auth.uid() = user_id);
create policy "sessions_update" on public.sessions
  for update using (user_id is null or auth.uid() = user_id)
             with check (user_id is null or auth.uid() = user_id);
create policy "sessions_delete" on public.sessions
  for delete using (user_id is null or auth.uid() = user_id);

-- questions (ownership inherited from parent session)
drop policy if exists "Allow all on questions" on public.questions;
create policy "questions_select" on public.questions
  for select using (exists (select 1 from public.sessions s
    where s.id = questions.session_id and (s.user_id is null or s.user_id = auth.uid())));
create policy "questions_insert" on public.questions
  for insert with check (exists (select 1 from public.sessions s
    where s.id = questions.session_id and (s.user_id is null or s.user_id = auth.uid())));
create policy "questions_update" on public.questions
  for update using (exists (select 1 from public.sessions s
    where s.id = questions.session_id and (s.user_id is null or s.user_id = auth.uid())))
             with check (exists (select 1 from public.sessions s
    where s.id = questions.session_id and (s.user_id is null or s.user_id = auth.uid())));
create policy "questions_delete" on public.questions
  for delete using (exists (select 1 from public.sessions s
    where s.id = questions.session_id and (s.user_id is null or s.user_id = auth.uid())));

-- answers (ownership inherited from parent session)
drop policy if exists "Allow all on answers" on public.answers;
create policy "answers_select" on public.answers
  for select using (exists (select 1 from public.sessions s
    where s.id = answers.session_id and (s.user_id is null or s.user_id = auth.uid())));
create policy "answers_insert" on public.answers
  for insert with check (exists (select 1 from public.sessions s
    where s.id = answers.session_id and (s.user_id is null or s.user_id = auth.uid())));
create policy "answers_update" on public.answers
  for update using (exists (select 1 from public.sessions s
    where s.id = answers.session_id and (s.user_id is null or s.user_id = auth.uid())))
             with check (exists (select 1 from public.sessions s
    where s.id = answers.session_id and (s.user_id is null or s.user_id = auth.uid())));
create policy "answers_delete" on public.answers
  for delete using (exists (select 1 from public.sessions s
    where s.id = answers.session_id and (s.user_id is null or s.user_id = auth.uid())));
