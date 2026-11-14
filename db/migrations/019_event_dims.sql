-- Every scan records which category, design and template the page had, and each code counts its scans per design.
-- Run once in the Supabase SQL editor. Safe to re-run.
alter table public.scan_events add column if not exists category text;
alter table public.scan_events add column if not exists design text;
alter table public.scan_events add column if not exists tpl text;
alter table public.qr_codes add column if not exists tpl text;
alter table public.qr_stats add column if not exists by_design jsonb not null default '{}'::jsonb;

-- Same as the 13-argument record_scan (which stays, so an older API keeps working), plus the three tags. It calls that function, then stamps the event and counts the design.
create or replace function public.record_scan(
  p_slug text, p_owner uuid, p_country text, p_device text, p_browser text, p_os text,
  p_referer text, p_is_unique boolean, p_failed boolean,
  p_id uuid, p_city text, p_lang text, p_ref_host text,
  p_category text, p_design text, p_tpl text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
begin
  perform public.record_scan(p_slug, p_owner, p_country, p_device, p_browser, p_os, p_referer, p_is_unique, p_failed, v_id, p_city, p_lang, p_ref_host);
  update scan_events set category = nullif(p_category, ''), design = nullif(p_design, ''), tpl = nullif(p_tpl, '') where id = v_id;
  if not p_failed then  -- wrong-PIN attempts are logged, not counted
    update qr_stats set by_design = jsonb_inc(by_design, coalesce(nullif(p_design, ''), 'none')) where slug = p_slug;
  end if;
end $$;
revoke all on function public.record_scan(text, uuid, text, text, text, text, text, boolean, boolean, uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_scan(text, uuid, text, text, text, text, text, boolean, boolean, uuid, text, text, text, text, text, text) to service_role;
