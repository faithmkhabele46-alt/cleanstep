create extension if not exists "pgcrypto";

create table if not exists public.loyalty_customers (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  whatsapp_number text not null unique,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.loyalty_visits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.loyalty_customers(id) on delete cascade,
  shoe_type text not null,
  quantity integer not null default 1,
  visit_date date not null,
  receipt_number text,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.loyalty_visits
  add column if not exists quantity integer not null default 1;

create table if not exists public.loyalty_accounts (
  customer_id uuid primary key references public.loyalty_customers(id) on delete cascade,
  password_salt text not null,
  password_hash text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.loyalty_reward_claims (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.loyalty_customers(id) on delete cascade,
  claimed_at timestamptz not null default timezone('utc'::text, now()),
  points_claimed numeric not null default 5,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.loyalty_reward_claims
  add column if not exists points_claimed numeric not null default 5;

create index if not exists loyalty_visits_customer_id_idx on public.loyalty_visits(customer_id);
create index if not exists loyalty_visits_visit_date_idx on public.loyalty_visits(visit_date desc);
create index if not exists loyalty_reward_claims_customer_id_idx on public.loyalty_reward_claims(customer_id);
create index if not exists loyalty_reward_claims_claimed_at_idx on public.loyalty_reward_claims(claimed_at desc);
