-- ============================================================
-- Runback — Phase 3: overall score on sessions
-- ============================================================
-- Run this in the Supabase SQL editor (Josh runs it manually) BEFORE the
-- Phase 3 code ships. Additive and backward-compatible:
--   * Nullable column, no default, no backfill — existing rows and guest rows
--     stay valid with score = NULL (the profile page renders "—" for those).
--   * No RLS change needed: the existing sessions_update policy already lets a
--     user update their own row and anon update null-owned (guest) rows, and it
--     does not restrict which columns may be written. The results page writes
--     the overall score here after evaluation completes.
-- ============================================================

alter table public.sessions
  add column if not exists score numeric;
