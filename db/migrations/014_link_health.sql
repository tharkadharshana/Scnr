-- Phase 14: destination link health. A daily job re-checks live URL codes and records the verdict here.
-- Run once in the Supabase SQL editor. Safe to re-run.
-- link_status: ok | warn | fail (null = never checked). link_fail_count counts consecutive failed checks;
-- link_notified_at is set when the owner has been emailed about the current failure and cleared when the link recovers.
alter table public.qr_codes
  add column if not exists link_status text check (link_status in ('ok', 'warn', 'fail')),
  add column if not exists link_reason text,
  add column if not exists link_checked_at timestamptz,
  add column if not exists link_fail_count int not null default 0,
  add column if not exists link_notified_at timestamptz;
-- The job picks the least recently checked codes first.
create index if not exists qr_codes_link_checked_idx on public.qr_codes (link_checked_at nulls first) where is_active and is_dynamic;
