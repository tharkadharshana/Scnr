-- Every object has a category (restaurant, page, form, ...) and may have a design (the id of its public-page look).
-- Run once in the Supabase SQL editor. Safe to re-run.
-- A restaurant is a qr_type 'page' row, so plan caps and the Worker keep working.
alter table public.qr_codes add column if not exists category text;
alter table public.qr_codes add column if not exists design text;

-- Rows saved before this migration: a page with a menu block (or an old Kit) is a restaurant, any other page is a page, other types keep their name.
update public.qr_codes set category = case
  when qr_type = 'page' then (case
    when content_data ? 'kit' or exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(content_data->'blocks') = 'array' then content_data->'blocks' else '[]'::jsonb end) b
      where b->>'kind' = 'menu') then 'restaurant'
    else 'page' end)
  when qr_type in ('url', 'vcard', 'wifi', 'text', 'email', 'event', 'form') then qr_type
  else 'url' end
where category is null;

-- The design a Kit page already stores inside content_data becomes the column value.
update public.qr_codes set design = content_data->>'design'
where design is null and category = 'restaurant' and content_data->>'design' is not null;

alter table public.qr_codes alter column category set default 'url';
alter table public.qr_codes alter column category set not null;
alter table public.qr_codes drop constraint if exists qr_codes_category_check;
alter table public.qr_codes add constraint qr_codes_category_check
  check (category in ('restaurant', 'page', 'form', 'vcard', 'wifi', 'event', 'text', 'email', 'url'));
create index if not exists qr_codes_user_category_idx on public.qr_codes(user_uid, category);

-- Optional, owner only (there are no real customers): remove old test pages so every page starts on the new data contract.
-- delete from public.qr_codes where qr_type = 'page';
