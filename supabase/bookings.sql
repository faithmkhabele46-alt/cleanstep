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

alter table public.bookings
add column if not exists booking_code text,
add column if not exists service_id text,
add column if not exists service_title text,
add column if not exists primary_item text,
add column if not exists location text,
add column if not exists booking_date date,
add column if not exists booking_time time,
add column if not exists total numeric(10,2) not null default 0,
add column if not exists deposit numeric(10,2) not null default 0,
add column if not exists status text not null default 'pending',
add column if not exists payment_reference text,
add column if not exists payment_status text,
add column if not exists auth_user_id uuid,
add column if not exists customer_name text,
add column if not exists customer_email text,
add column if not exists customer_phone text,
add column if not exists selections jsonb not null default '[]'::jsonb,
add column if not exists created_at timestamptz not null default now();

alter table public.bookings
alter column total set default 0,
alter column deposit set default 0,
alter column status set default 'pending',
alter column selections set default '[]'::jsonb,
alter column created_at set default now();

create unique index if not exists bookings_booking_code_unique_idx
on public.bookings (booking_code);

create unique index if not exists bookings_payment_reference_unique_idx
on public.bookings (payment_reference)
where payment_reference is not null;

create index if not exists bookings_created_at_idx on public.bookings (created_at desc);
create index if not exists bookings_service_id_idx on public.bookings (service_id);

alter table public.bookings enable row level security;

drop policy if exists "service role full access on bookings" on public.bookings;

create policy "service role full access on bookings"
on public.bookings
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
