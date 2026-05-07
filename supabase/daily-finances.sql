create extension if not exists pgcrypto;

create table if not exists public.daily_finance_sales (
  id uuid primary key default gen_random_uuid(),
  product_code text not null,
  product_name text not null,
  category text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  payment_method text not null check (payment_method in ('cash', 'card')),
  sale_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists daily_finance_sales_sale_date_idx
on public.daily_finance_sales (sale_date desc, created_at desc);

alter table public.daily_finance_sales enable row level security;

drop policy if exists "service role full access on daily finance sales" on public.daily_finance_sales;

create policy "service role full access on daily finance sales"
on public.daily_finance_sales
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
