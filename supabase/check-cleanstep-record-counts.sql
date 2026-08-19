select
  'loyalty_customers' as table_name,
  count(*) as saved_records
from public.loyalty_customers
union all
select
  'loyalty_visits' as table_name,
  count(*) as saved_records
from public.loyalty_visits
union all
select
  'loyalty_reward_claims' as table_name,
  count(*) as saved_records
from public.loyalty_reward_claims
union all
select
  'daily_finance_sales' as table_name,
  count(*) as saved_records
from public.daily_finance_sales
order by table_name;
