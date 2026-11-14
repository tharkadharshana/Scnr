-- Guest events: what visitors do on a page after they scan (an order placed, a form submitted, a link clicked), tagged with the category, design and template.
-- Run once in the Supabase SQL editor. Safe to re-run.
create table if not exists public.guest_events (
  id        uuid primary key default gen_random_uuid(),
  slug      text not null references public.qr_codes(slug) on delete cascade,
  at        timestamptz not null default now(),
  name      text not null,
  ref       text,    -- a tracked link key, never a name, phone or IP
  category  text,
  design    text,
  tpl       text
);
create index if not exists guest_events_slug_at_idx on public.guest_events(slug, at desc);
create index if not exists guest_events_slug_name_idx on public.guest_events(slug, name);
alter table public.guest_events enable row level security;
-- No policies: RLS denies anon/authenticated. The API uses the service-role key, which bypasses RLS.

alter table public.qr_stats add column if not exists events jsonb not null default '{}'::jsonb;  -- { "order_placed": 12, "link_click": 40 }

-- One call writes the row and bumps the counter.
create or replace function public.record_event(p_slug text, p_name text, p_ref text, p_category text, p_design text, p_tpl text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into guest_events (slug, name, ref, category, design, tpl)
  values (p_slug, p_name, nullif(p_ref, ''), nullif(p_category, ''), nullif(p_design, ''), nullif(p_tpl, ''));
  insert into qr_stats (slug) values (p_slug) on conflict (slug) do nothing;
  update qr_stats set events = jsonb_inc(events, p_name), updated_at = now() where slug = p_slug;
end $$;
revoke all on function public.record_event(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_event(text, text, text, text, text, text) to service_role;
