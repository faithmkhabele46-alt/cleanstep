create extension if not exists pgcrypto;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text unique not null,
  service_id text not null,
  service_title text not null,
  primary_item text,
  location text,
  booking_date date,
  booking_time time,
  total numeric(10,2) not null default 0,
  deposit numeric(10,2) not null default 0,
  status text not null default 'pending',
  payment_reference text unique,
  payment_status text,
  auth_user_id uuid,
  customer_name text,
  customer_email text,
  customer_phone text,
  selections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bookings_created_at_idx on public.bookings (created_at desc);
create index if not exists bookings_service_id_idx on public.bookings (service_id);

alter table public.bookings enable row level security;

drop policy if exists "service role full access on bookings" on public.bookings;

create policy "service role full access on bookings"
on public.bookings
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
