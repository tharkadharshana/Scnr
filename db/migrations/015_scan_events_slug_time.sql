-- Phase 15: speed. The Recent scans and GPS views read the newest scans for a set of codes (slug in (...), newest first).
-- One composite index serves that, so Postgres no longer sorts a slug's whole history. Run once in the Supabase SQL editor. Safe to re-run.
create index if not exists scan_events_slug_time_idx on public.scan_events (slug, scanned_at desc);
