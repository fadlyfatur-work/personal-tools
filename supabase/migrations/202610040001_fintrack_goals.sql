begin;
create table public.fintrack_goals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.fintrack_accounts(id),
  name text not null check (length(trim(name)) between 1 and 60),
  emoji text not null default '🎯' check (length(emoji) between 1 and 16),
  kind text not null default 'purchase' check (kind in ('purchase', 'investment')),
  target_amount numeric(18,2) not null check (target_amount > 0),
  target_date date,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now()
);
create table public.fintrack_goal_items (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.fintrack_goals(id),
  name text not null check (length(trim(name)) between 1 and 60),
  estimated_amount numeric(18,2) not null check (estimated_amount > 0),
  created_at timestamptz not null default now()
);
create index fintrack_goal_items_goal_idx on public.fintrack_goal_items(goal_id);
alter table public.fintrack_transactions add column goal_item_id uuid references public.fintrack_goal_items(id) on delete set null;
create index fintrack_transactions_goal_item_idx on public.fintrack_transactions(goal_item_id) where goal_item_id is not null;
alter table public.fintrack_goals enable row level security;
alter table public.fintrack_goal_items enable row level security;
revoke all on public.fintrack_goals, public.fintrack_goal_items from anon, authenticated;
grant all on public.fintrack_goals, public.fintrack_goal_items to service_role;
create view public.fintrack_goal_totals with (security_invoker = true) as
select g.*, a.plan_id, a.current_balance, a.archived as account_archived,
  coalesce((select sum(t.amount) from public.fintrack_transactions t where t.from_account_id = g.account_id and t.type = 'expense' and t.status = 'posted'), 0) as spent
from public.fintrack_goals g join public.fintrack_accounts a on a.id = g.account_id;
create view public.fintrack_goal_item_totals with (security_invoker = true) as
select i.*, coalesce((select sum(t.amount) from public.fintrack_transactions t where t.goal_item_id = i.id and t.type = 'expense' and t.status = 'posted'), 0) as spent
from public.fintrack_goal_items i;
revoke all on public.fintrack_goal_totals, public.fintrack_goal_item_totals from anon, authenticated;
grant select on public.fintrack_goal_totals, public.fintrack_goal_item_totals to service_role;
create function public.fintrack_create_goal(p_actor_id uuid, p_name text, p_emoji text, p_kind text, p_target_amount numeric, p_target_date date)
returns public.fintrack_goals language plpgsql security definer set search_path = public as $$
declare v_plan uuid; v_account uuid; v_goal public.fintrack_goals;
begin
  select id into v_plan from public.fintrack_plans where owner_id = p_actor_id and archived_at is null order by created_at limit 1;
  if v_plan is null then raise exception 'Rencana pribadi belum tersedia'; end if;
  insert into public.fintrack_accounts(plan_id, name, kind, classification, initial_balance, current_balance, include_in_net_worth, sort_order, created_by)
  values(v_plan, p_name, case when p_kind = 'investment' then 'investment' else 'bank' end, 'asset', 0, 0, true,
    coalesce((select max(sort_order) + 1 from public.fintrack_accounts where plan_id = v_plan), 0), p_actor_id) returning id into v_account;
  insert into public.fintrack_goals(account_id, name, emoji, kind, target_amount, target_date)
  values(v_account, p_name, p_emoji, p_kind, p_target_amount, p_target_date) returning * into v_goal;
  return v_goal;
end $$;
-- Item association and balance changes commit together, including replacements.
create function public.fintrack_save_goal_transaction(
  p_actor_id uuid, p_type text, p_amount numeric,
  p_from_account_id uuid default null, p_to_account_id uuid default null, p_category_id uuid default null,
  p_note text default null, p_transaction_date date default current_date, p_allow_negative boolean default false,
  p_transaction_id uuid default null, p_goal_item_id uuid default null
) returns public.fintrack_transactions language plpgsql security definer set search_path = public as $$
declare v_txn public.fintrack_transactions;
begin
  if p_goal_item_id is not null then
    perform 1 from public.fintrack_goal_items i join public.fintrack_goals g on g.id = i.goal_id
      join public.fintrack_accounts a on a.id = g.account_id join public.fintrack_plans p on p.id = a.plan_id
      where i.id = p_goal_item_id and g.account_id = p_from_account_id and p_type = 'expense'
      and p.owner_id = p_actor_id and not a.archived for share of i, g;
    if not found then raise exception 'Item tujuan tidak valid untuk dompet ini'; end if;
  end if;
  if p_transaction_id is null then
    v_txn := public.fintrack_create_transaction(p_actor_id, p_type, p_amount, p_from_account_id, p_to_account_id, p_category_id, p_note, p_transaction_date, p_allow_negative);
  else
    v_txn := public.fintrack_replace_transaction(p_actor_id, p_transaction_id, p_type, p_amount, p_from_account_id, p_to_account_id, p_category_id, p_note, p_transaction_date, p_allow_negative);
  end if;
  update public.fintrack_transactions set goal_item_id = p_goal_item_id where id = v_txn.id returning * into v_txn;
  return v_txn;
end $$;
revoke all on function public.fintrack_create_goal(uuid, text, text, text, numeric, date) from public, anon, authenticated;
grant execute on function public.fintrack_create_goal(uuid, text, text, text, numeric, date) to service_role;
revoke all on function public.fintrack_save_goal_transaction(uuid, text, numeric, uuid, uuid, uuid, text, date, boolean, uuid, uuid) from public, anon, authenticated;
grant execute on function public.fintrack_save_goal_transaction(uuid, text, numeric, uuid, uuid, uuid, text, date, boolean, uuid, uuid) to service_role;
commit;
