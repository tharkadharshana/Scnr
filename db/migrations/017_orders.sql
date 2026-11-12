-- Orders (mini POS for Restaurant Kit pages): one row per guest order, lines as jsonb. Run once in the Supabase SQL editor. Safe to re-run.
alter table public.profiles add column if not exists monthly_orders jsonb not null default '{}'::jsonb; -- { "YYYY-MM": n }, bumped inside place_order

create table if not exists public.orders (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null references public.qr_codes(slug) on delete cascade,
  code        text not null,                       -- short code the guest reads out or types (4 chars, no 0 O 1 I)
  token       text not null unique,                -- unguessable; the guest device polls the status with it
  status      text not null default 'new' check (status in ('new', 'accepted', 'cooking', 'ready', 'delivered', 'cancelled', 'rejected')),
  paid        boolean not null default false,
  paid_at     timestamptz,
  type        text not null check (type in ('dine_in', 'takeaway')),
  table_no    text,
  pickup_time text,
  name        text not null,
  phone       text not null,
  note        text,
  items       jsonb not null,                      -- [{ s, i, name, price, qty }] snapshot taken from the stored menu, never from the guest
  total       numeric(12,2) not null,
  currency    text,
  idem        text,                                -- guest-side key: a double tap or retry returns the same order
  find_fails  int not null default 0,              -- wrong-phone attempts at "find my order"; locks the order after 10
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists orders_slug_created_idx on public.orders(slug, created_at desc);
create index if not exists orders_open_idx on public.orders(slug, status) where status in ('new', 'accepted', 'cooking', 'ready');
create index if not exists orders_created_idx on public.orders(created_at);
create unique index if not exists orders_idem_uniq on public.orders(slug, idem) where idem is not null;
create unique index if not exists orders_code_open_uniq on public.orders(slug, code) where status in ('new', 'accepted', 'cooking', 'ready');
alter table public.orders enable row level security;
-- No policies: RLS denies anon/authenticated. The API uses the service-role key, which bypasses RLS.

-- One call per order: idempotency, monthly limit, insert and counter in one transaction.
-- Returns { order: {...} } | { limit: true } | { clash: true } (code taken: the API retries with a new code).
create or replace function public.place_order(p_slug text, p_owner uuid, p_limit int, p_o jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m text := to_char(now() at time zone 'utc', 'YYYY-MM');
  r public.orders;
begin
  if p_o->>'idem' is not null then
    select * into r from public.orders where slug = p_slug and idem = p_o->>'idem';
    if found then return jsonb_build_object('order', to_jsonb(r)); end if;
  end if;
  if coalesce((select (monthly_orders ->> m)::int from public.profiles where id = p_owner), 0) >= p_limit then
    return jsonb_build_object('limit', true);
  end if;
  begin
    insert into public.orders (slug, code, token, type, table_no, pickup_time, name, phone, note, items, total, currency, idem)
    values (p_slug, p_o->>'code', p_o->>'token', p_o->>'type', p_o->>'table_no', p_o->>'pickup_time', p_o->>'name', p_o->>'phone',
            p_o->>'note', p_o->'items', (p_o->>'total')::numeric, p_o->>'currency', p_o->>'idem')
    returning * into r;
  exception when unique_violation then
    if p_o->>'idem' is not null then
      select * into r from public.orders where slug = p_slug and idem = p_o->>'idem';
      if found then return jsonb_build_object('order', to_jsonb(r)); end if;
    end if;
    return jsonb_build_object('clash', true);
  end;
  update public.profiles set monthly_orders = jsonb_inc(monthly_orders, m) where id = p_owner;
  return jsonb_build_object('order', to_jsonb(r));
end $$;
revoke all on function public.place_order(text, uuid, int, jsonb) from public, anon, authenticated;
grant execute on function public.place_order(text, uuid, int, jsonb) to service_role;
