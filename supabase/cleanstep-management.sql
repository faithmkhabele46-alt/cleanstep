create extension if not exists pgcrypto;

create table if not exists public.cleanstep_service_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  report_group text not null check (
    report_group in (
      'footwear',
      'bags',
      'carpets',
      'upholstery',
      'other_services',
      'third_party',
      'print_retail'
    )
  ),
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.cleanstep_services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.cleanstep_service_categories(id) on delete restrict,
  code text not null unique,
  name text not null,
  pricing_type text not null default 'fixed' check (
    pricing_type in ('fixed', 'from', 'per_sqm', 'configurable')
  ),
  default_unit_price numeric(10,2) check (default_unit_price is null or default_unit_price >= 0),
  unit_label text not null default 'item',
  loyalty_eligible boolean not null default false,
  allow_price_override boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.cleanstep_visits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.loyalty_customers(id) on delete restrict,
  customer_name_snapshot text not null,
  whatsapp_snapshot text not null,
  source text not null default 'admin' check (source in ('admin', 'booking', 'import')),
  status text not null default 'received' check (
    status in ('received', 'in_progress', 'ready', 'completed', 'cancelled')
  ),
  received_at timestamptz not null default timezone('utc'::text, now()),
  visit_date date not null default ((timezone('Africa/Johannesburg'::text, now()))::date),
  payment_method text check (payment_method is null or payment_method in ('cash', 'card', 'mixed', 'unpaid')),
  subtotal numeric(10,2) not null default 0 check (subtotal >= 0),
  discount_total numeric(10,2) not null default 0 check (discount_total >= 0),
  total numeric(10,2) not null default 0 check (total >= 0),
  amount_paid numeric(10,2) not null default 0 check (amount_paid >= 0),
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.cleanstep_visit_items (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.cleanstep_visits(id) on delete cascade,
  service_id uuid references public.cleanstep_services(id) on delete set null,
  category_code_snapshot text not null,
  report_group_snapshot text not null,
  service_code_snapshot text not null,
  service_name_snapshot text not null,
  pricing_type_snapshot text not null,
  unit_label_snapshot text not null default 'item',
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(10,2) not null default 0 check (unit_price >= 0),
  line_total numeric(10,2) generated always as ((quantity * unit_price)::numeric(10,2)) stored,
  loyalty_eligible_snapshot boolean not null default false,
  third_party_partner text check (
    third_party_partner is null or third_party_partner in ('Eldoraigne', 'Kitwe', 'Clubview')
  ),
  prep_status text not null default 'waiting' check (
    prep_status in ('waiting', 'to_prepare', 'ready', 'not_required')
  ),
  prep_due_at timestamptz,
  ready_at timestamptz,
  delivery_status text not null default 'not_required' check (
    delivery_status in ('not_required', 'required', 'delivered')
  ),
  delivered_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.cleanstep_third_party_deliveries (
  id uuid primary key default gen_random_uuid(),
  partner text not null check (partner in ('Eldoraigne', 'Kitwe', 'Clubview')),
  delivery_date date not null,
  status text not null default 'required' check (status in ('required', 'delivered', 'cancelled')),
  notes text,
  delivered_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.cleanstep_third_party_delivery_items (
  delivery_id uuid not null references public.cleanstep_third_party_deliveries(id) on delete cascade,
  visit_item_id uuid not null references public.cleanstep_visit_items(id) on delete cascade,
  primary key (delivery_id, visit_item_id)
);

create table if not exists public.cleanstep_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default ((timezone('Africa/Johannesburg'::text, now()))::date),
  description text not null,
  category text not null default 'other',
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  amount numeric(10,2) not null check (amount >= 0),
  recorded_by text,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists cleanstep_service_categories_report_group_idx
on public.cleanstep_service_categories(report_group, display_order);

create index if not exists cleanstep_services_category_id_idx
on public.cleanstep_services(category_id, sort_order);

create index if not exists cleanstep_visits_customer_id_idx
on public.cleanstep_visits(customer_id, visit_date desc);

create index if not exists cleanstep_visits_status_date_idx
on public.cleanstep_visits(status, visit_date desc);

create index if not exists cleanstep_visit_items_visit_id_idx
on public.cleanstep_visit_items(visit_id);

create index if not exists cleanstep_visit_items_report_group_idx
on public.cleanstep_visit_items(report_group_snapshot);

create index if not exists cleanstep_visit_items_prep_due_idx
on public.cleanstep_visit_items(prep_status, prep_due_at);

create index if not exists cleanstep_visit_items_third_party_idx
on public.cleanstep_visit_items(third_party_partner, delivery_status);

create index if not exists cleanstep_expenses_expense_date_idx
on public.cleanstep_expenses(expense_date desc);

alter table public.cleanstep_service_categories enable row level security;
alter table public.cleanstep_services enable row level security;
alter table public.cleanstep_visits enable row level security;
alter table public.cleanstep_visit_items enable row level security;
alter table public.cleanstep_third_party_deliveries enable row level security;
alter table public.cleanstep_third_party_delivery_items enable row level security;
alter table public.cleanstep_expenses enable row level security;

alter table public.cleanstep_visit_items
drop constraint if exists cleanstep_visit_items_third_party_partner_check;

alter table public.cleanstep_visit_items
add constraint cleanstep_visit_items_third_party_partner_check
check (
  third_party_partner is null or third_party_partner in ('Eldoraigne', 'Kitwe', 'Clubview')
);

alter table public.cleanstep_third_party_deliveries
drop constraint if exists cleanstep_third_party_deliveries_partner_check;

alter table public.cleanstep_third_party_deliveries
add constraint cleanstep_third_party_deliveries_partner_check
check (partner in ('Eldoraigne', 'Kitwe', 'Clubview'));

alter table public.cleanstep_service_categories
drop constraint if exists cleanstep_service_categories_report_group_check;

update public.cleanstep_service_categories
set
  report_group = 'upholstery',
  updated_at = timezone('utc'::text, now())
where code in ('mattresses', 'couches')
  or report_group in ('mattresses', 'couches');

alter table public.cleanstep_service_categories
add constraint cleanstep_service_categories_report_group_check
check (
  report_group in (
    'footwear',
    'bags',
    'carpets',
    'upholstery',
    'other_services',
    'third_party',
    'print_retail'
  )
);

drop policy if exists "service role full access on cleanstep service categories"
on public.cleanstep_service_categories;

create policy "service role full access on cleanstep service categories"
on public.cleanstep_service_categories
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "service role full access on cleanstep services"
on public.cleanstep_services;

create policy "service role full access on cleanstep services"
on public.cleanstep_services
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "service role full access on cleanstep visits"
on public.cleanstep_visits;

create policy "service role full access on cleanstep visits"
on public.cleanstep_visits
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "service role full access on cleanstep visit items"
on public.cleanstep_visit_items;

create policy "service role full access on cleanstep visit items"
on public.cleanstep_visit_items
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "service role full access on cleanstep third party deliveries"
on public.cleanstep_third_party_deliveries;

create policy "service role full access on cleanstep third party deliveries"
on public.cleanstep_third_party_deliveries
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "service role full access on cleanstep third party delivery items"
on public.cleanstep_third_party_delivery_items;

create policy "service role full access on cleanstep third party delivery items"
on public.cleanstep_third_party_delivery_items
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "service role full access on cleanstep expenses"
on public.cleanstep_expenses;

create policy "service role full access on cleanstep expenses"
on public.cleanstep_expenses
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

insert into public.cleanstep_service_categories (code, name, report_group, display_order)
values
  ('footwear_ordinary', 'Ordinary Sneakers & Shoes', 'footwear', 10),
  ('footwear_suede', 'Suede, Nubuck & Leather', 'footwear', 20),
  ('footwear_refurbish', 'Refurbish / Express', 'footwear', 30),
  ('footwear_laces_insoles', 'Laces & Insoles', 'footwear', 40),
  ('bags', 'Bags', 'bags', 50),
  ('carpets_loose_persian', 'Persian Loose Carpets', 'carpets', 60),
  ('carpets_loose_standard', 'Non-Persian / Other Loose Carpets', 'carpets', 70),
  ('carpets_domestic', 'Domestic Fitted Carpets', 'carpets', 80),
  ('carpets_commercial', 'Commercial Carpets', 'carpets', 90),
  ('mattresses', 'Mattresses - Deep Cleaning', 'upholstery', 100),
  ('couches', 'Couches - Deep Cleaning', 'upholstery', 110),
  ('other_services', 'Other Services', 'other_services', 120),
  ('third_party', 'Third-Party Services', 'third_party', 130),
  ('print_retail', 'Print & Retail', 'print_retail', 140)
on conflict (code) do update
set
  name = excluded.name,
  report_group = excluded.report_group,
  display_order = excluded.display_order,
  active = true,
  updated_at = timezone('utc'::text, now());

with service_seed (
  category_code,
  code,
  name,
  pricing_type,
  default_unit_price,
  unit_label,
  loyalty_eligible,
  allow_price_override,
  sort_order,
  notes,
  metadata
) as (
  values
    ('footwear_ordinary', 'ordinary_other_colours', 'Other colours', 'fixed', 130.00, 'item', true, false, 10, null, '{}'::jsonb),
    ('footwear_ordinary', 'ordinary_white', 'White', 'fixed', 140.00, 'item', true, false, 20, null, '{}'::jsonb),
    ('footwear_ordinary', 'ordinary_boots', 'Boots', 'fixed', 160.00, 'item', true, false, 30, null, '{}'::jsonb),
    ('footwear_suede', 'suede_other_colours', 'Other colours', 'fixed', 140.00, 'item', true, false, 40, null, '{}'::jsonb),
    ('footwear_suede', 'suede_white_cream', 'White / Cream', 'fixed', 150.00, 'item', true, false, 50, null, '{}'::jsonb),
    ('footwear_suede', 'suede_boots', 'Boots', 'fixed', 170.00, 'item', true, false, 60, null, '{}'::jsonb),
    ('footwear_refurbish', 'refurbish_same_day', 'Same day', 'fixed', 210.00, 'item', true, false, 70, null, '{}'::jsonb),
    ('footwear_refurbish', 'refurbish_next_day', 'Next day', 'fixed', 190.00, 'item', true, false, 80, null, '{}'::jsonb),
    ('footwear_refurbish', 'refurbish_deep_cleaning', 'Deep Cleaning', 'fixed', 190.00, 'item', true, false, 90, null, '{}'::jsonb),
    ('footwear_refurbish', 'refurbish_restore_colour', 'Restore Colour', 'fixed', 250.00, 'item', true, false, 100, null, '{}'::jsonb),
    ('footwear_laces_insoles', 'laces_insoles', 'Laces & Insoles', 'configurable', null, 'item', false, true, 110, 'Price not shown on the 2026 price list. Configure before using as a fixed price.', '{}'::jsonb),
    ('bags', 'bag_hand_bag', 'Hand bags', 'from', 160.00, 'item', false, true, 120, 'From R160. Admin should enter the final charged price per visit.', '{}'::jsonb),
    ('bags', 'bag_back_pack', 'Back pack', 'from', 160.00, 'item', false, true, 130, 'From R160. Admin should enter the final charged price per visit.', '{}'::jsonb),
    ('carpets_loose_persian', 'persian_small', 'Small (up to 1.4 sqm)', 'fixed', 250.00, 'item', false, false, 140, null, '{"size": "up to 1.4 sqm"}'::jsonb),
    ('carpets_loose_persian', 'persian_medium', 'Medium (2 m x 1.2 m)', 'fixed', 550.00, 'item', false, false, 150, null, '{"size": "2 m x 1.2 m"}'::jsonb),
    ('carpets_loose_persian', 'persian_large', 'Large (1.3 m x 3 m)', 'fixed', 650.00, 'item', false, false, 160, null, '{"size": "1.3 m x 3 m"}'::jsonb),
    ('carpets_loose_persian', 'persian_x_large', 'X-Large (2.6 m x 5 m)', 'fixed', 790.00, 'item', false, false, 170, null, '{"size": "2.6 m x 5 m"}'::jsonb),
    ('carpets_loose_standard', 'standard_carpet_small', 'Small (up to 1.4 sqm)', 'fixed', 190.00, 'item', false, false, 180, null, '{"size": "up to 1.4 sqm"}'::jsonb),
    ('carpets_loose_standard', 'standard_carpet_medium', 'Medium (2 m x 1.2 m)', 'fixed', 440.00, 'item', false, false, 190, null, '{"size": "2 m x 1.2 m"}'::jsonb),
    ('carpets_loose_standard', 'standard_carpet_large', 'Large (1.3 m x 3 m)', 'fixed', 530.00, 'item', false, false, 200, null, '{"size": "1.3 m x 3 m"}'::jsonb),
    ('carpets_loose_standard', 'standard_carpet_x_large', 'X-Large (2.6 m x 5 m)', 'fixed', 690.00, 'item', false, false, 210, null, '{"size": "2.6 m x 5 m"}'::jsonb),
    ('carpets_domestic', 'domestic_small_bedroom', 'Small Bedrooms', 'fixed', 550.00, 'item', false, false, 220, null, '{}'::jsonb),
    ('carpets_domestic', 'domestic_big_bedroom', 'Big Bedrooms', 'fixed', 690.00, 'item', false, false, 230, null, '{}'::jsonb),
    ('carpets_domestic', 'domestic_lounge_carpets', 'Lounge Carpets', 'fixed', 890.00, 'item', false, false, 240, null, '{}'::jsonb),
    ('carpets_commercial', 'commercial_carpet_0_100_sqm', '0-100 sqm', 'per_sqm', 22.00, 'sqm', false, false, 250, 'Commercial carpet price per square metre.', '{"min_sqm": 0, "max_sqm": 100}'::jsonb),
    ('carpets_commercial', 'commercial_carpet_100_400_sqm', '100-400 sqm', 'per_sqm', 20.00, 'sqm', false, false, 260, 'Commercial carpet price per square metre.', '{"min_sqm": 100, "max_sqm": 400}'::jsonb),
    ('carpets_commercial', 'commercial_carpet_400_plus_sqm', '400 sqm and above', 'per_sqm', 18.00, 'sqm', false, false, 270, 'Commercial carpet price per square metre.', '{"min_sqm": 400}'::jsonb),
    ('mattresses', 'mattress_single', 'Single', 'fixed', 350.00, 'item', false, false, 280, null, '{}'::jsonb),
    ('mattresses', 'mattress_double', 'Double', 'fixed', 490.00, 'item', false, false, 290, null, '{}'::jsonb),
    ('mattresses', 'mattress_queen', 'Queen', 'fixed', 550.00, 'item', false, false, 300, null, '{}'::jsonb),
    ('mattresses', 'mattress_king', 'King', 'fixed', 590.00, 'item', false, false, 310, null, '{}'::jsonb),
    ('couches', 'couch_chair', 'Chair', 'fixed', 180.00, 'item', false, false, 320, null, '{}'::jsonb),
    ('couches', 'couch_1_seater', '1 Seater', 'fixed', 350.00, 'item', false, false, 330, null, '{}'::jsonb),
    ('couches', 'couch_2_seater', '2 Seater', 'fixed', 490.00, 'item', false, false, 340, null, '{}'::jsonb),
    ('couches', 'couch_3_seater', '3 Seater', 'fixed', 580.00, 'item', false, false, 350, null, '{}'::jsonb),
    ('couches', 'couch_4_seater', '4 Seater', 'fixed', 710.00, 'item', false, false, 360, null, '{}'::jsonb),
    ('couches', 'couch_5_seater', '5 Seater', 'fixed', 920.00, 'item', false, false, 370, null, '{}'::jsonb),
    ('couches', 'couch_6_seater', '6 Seater', 'fixed', 1180.00, 'item', false, false, 380, null, '{}'::jsonb)
)
insert into public.cleanstep_services (
  category_id,
  code,
  name,
  pricing_type,
  default_unit_price,
  unit_label,
  loyalty_eligible,
  allow_price_override,
  sort_order,
  notes,
  metadata
)
select
  categories.id,
  seed.code,
  seed.name,
  seed.pricing_type,
  seed.default_unit_price,
  seed.unit_label,
  seed.loyalty_eligible,
  seed.allow_price_override,
  seed.sort_order,
  seed.notes,
  seed.metadata
from service_seed seed
join public.cleanstep_service_categories categories
  on categories.code = seed.category_code
on conflict (code) do update
set
  category_id = excluded.category_id,
  name = excluded.name,
  pricing_type = excluded.pricing_type,
  default_unit_price = excluded.default_unit_price,
  unit_label = excluded.unit_label,
  loyalty_eligible = excluded.loyalty_eligible,
  allow_price_override = excluded.allow_price_override,
  sort_order = excluded.sort_order,
  notes = excluded.notes,
  metadata = excluded.metadata,
  active = true,
  updated_at = timezone('utc'::text, now());

create or replace view public.cleanstep_service_revenue_daily
with (security_invoker = true) as
select
  visits.visit_date,
  case
    when items.report_group_snapshot in ('mattresses', 'couches') then 'upholstery'
    else items.report_group_snapshot
  end as report_group,
  count(distinct visits.id) as visit_count,
  count(items.id) as line_item_count,
  coalesce(sum(items.quantity), 0)::numeric(12,2) as total_quantity,
  coalesce(sum(items.line_total), 0)::numeric(12,2) as total_revenue
from public.cleanstep_visits visits
join public.cleanstep_visit_items items
  on items.visit_id = visits.id
where visits.status <> 'cancelled'
group by
  visits.visit_date,
  case
    when items.report_group_snapshot in ('mattresses', 'couches') then 'upholstery'
    else items.report_group_snapshot
  end;

create or replace view public.cleanstep_customer_value
with (security_invoker = true) as
select
  customers.id as customer_id,
  customers.customer_name,
  customers.whatsapp_number,
  count(distinct visits.id) as total_visits,
  coalesce(sum(items.line_total), 0)::numeric(12,2) as total_spent,
  coalesce(
    sum(items.quantity) filter (where items.report_group_snapshot = 'footwear'),
    0
  )::numeric(12,2) as total_shoes,
  coalesce(
    sum(items.quantity) filter (where items.report_group_snapshot = 'carpets'),
    0
  )::numeric(12,2) as total_carpets,
  min(visits.visit_date) as first_visit_date,
  max(visits.visit_date) as most_recent_visit_date
from public.loyalty_customers customers
left join public.cleanstep_visits visits
  on visits.customer_id = customers.id
  and visits.status <> 'cancelled'
left join public.cleanstep_visit_items items
  on items.visit_id = visits.id
group by customers.id, customers.customer_name, customers.whatsapp_number;

create or replace view public.cleanstep_expense_daily_totals
with (security_invoker = true) as
select
  expense_date,
  category,
  count(id) as expense_count,
  coalesce(sum(quantity), 0)::numeric(12,2) as total_quantity,
  coalesce(sum(amount), 0)::numeric(12,2) as total_spent
from public.cleanstep_expenses
group by expense_date, category;
