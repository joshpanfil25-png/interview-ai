-- ============================================================
-- Runback — Phase 4: saved resume (one per user)
-- ============================================================
-- Run this in the Supabase SQL editor (Josh runs it manually) BEFORE the
-- Phase 4 code ships. Additive and backward-compatible:
--   * Nullable text column holding the EXTRACTED resume text (not the PDF).
--     Existing profiles read NULL (no saved resume); guests have no profile
--     row, so they are unaffected.
--   * No RLS change needed: profiles already has per-user row policies from
--     Phase 1 (profiles_select_own / _update_own / _insert_own, all
--     auth.uid() = id). RLS is row-level, so this column is automatically
--     covered — a user can only read/write resume_text on their own row.
-- ============================================================

alter table public.profiles
  add column if not exists resume_text text;
