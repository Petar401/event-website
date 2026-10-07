-- Tilda POS schema.
-- Document-style tables: every row stores the full domain object in `data` (jsonb) plus typed,
-- indexed columns for the fields we filter and report on. The app talks to these tables from the
-- server with the service-role key; RLS is enabled with no anon policies, so the public anon key
-- can't read or write POS data directly.

create table if not exists public.settings (
  id text primary key default 'default',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.staff (
  id text primary key,
  name text not null,
  role text not null check (role in ('owner', 'manager', 'cashier')),
  active boolean not null default true,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id text primary key,
  sort int not null default 0,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.modifier_groups (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  category_id text not null,
  name text not null,
  price int not null,
  stock int not null default 0,
  available boolean not null default true,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products (category_id);

create table if not exists public.dining_tables (
  id text primary key,
  data jsonb not null
);

create table if not exists public.customers (
  id text primary key,
  name text not null,
  email text,
  phone text,
  points int not null default 0,
  last_visit_at timestamptz,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists customers_name_idx on public.customers (lower(name));

create table if not exists public.orders (
  id text primary key,
  number int not null unique,
  status text not null,
  channel text not null default 'pos',
  staff_id text,
  table_id text,
  customer_id text,
  total int not null default 0,
  created_at timestamptz not null,
  closed_at timestamptz,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_table_idx on public.orders (table_id) where status = 'open';
create index if not exists orders_customer_idx on public.orders (customer_id);

create table if not exists public.gift_cards (
  code text primary key,
  balance int not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.shifts (
  id text primary key,
  opened_at timestamptz not null,
  closed_at timestamptz,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id text primary key,
  number int not null unique,
  status text not null,
  supplier text not null,
  created_at timestamptz not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.approvals (
  id text primary key,
  status text not null,
  tool text not null,
  created_at timestamptz not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists approvals_status_idx on public.approvals (status, created_at desc);

create table if not exists public.audit_log (
  id text primary key,
  at timestamptz not null,
  tool text not null,
  actor_type text not null,
  agent text,
  outcome text not null,
  data jsonb not null
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);

create table if not exists public.api_keys (
  id text primary key,
  kind text not null,
  revoked boolean not null default false,
  created_at timestamptz not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.idempotency_keys (
  key text primary key,
  result jsonb,
  created_at timestamptz not null default now()
);

-- Lock everything down: only the service role (server) can touch POS tables.
do $$
declare t text;
begin
  foreach t in array array['settings','staff','categories','modifier_groups','products','dining_tables',
    'customers','orders','gift_cards','shifts','purchase_orders','approvals','audit_log','api_keys','idempotency_keys']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Reporting helpers for SQL users / BI tools.
create or replace view public.order_lines as
select
  o.id as order_id,
  o.number,
  o.status,
  o.channel,
  o.staff_id,
  o.created_at,
  l->>'productId' as product_id,
  l->>'name' as name,
  (l->>'qty')::int as qty,
  (l->>'refundedQty')::int as refunded_qty,
  (l->>'unitPrice')::int as unit_price,
  coalesce((select sum((m->>'price')::int) from jsonb_array_elements(l->'modifiers') m), 0) as modifiers_price,
  (l->>'taxRate')::numeric as tax_rate
from public.orders o, jsonb_array_elements(o.data->'lines') l;

create or replace view public.daily_sales as
select
  date_trunc('day', coalesce(closed_at, created_at)) as day,
  count(*) as orders,
  sum(total) as gross_cents,
  sum((data->>'tipTotal')::int) as tips_cents,
  count(*) filter (where channel like 'agent:%') as agent_orders
from public.orders
where status in ('paid', 'refunded', 'partially_refunded')
group by 1
order by 1 desc;

revoke all on public.order_lines, public.daily_sales from anon, authenticated;

-- Old idempotency keys can be pruned periodically:
--   delete from public.idempotency_keys where created_at < now() - interval '7 days';
