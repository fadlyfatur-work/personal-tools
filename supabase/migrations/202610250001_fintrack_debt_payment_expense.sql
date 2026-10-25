begin;
alter table public.fintrack_transactions add column debt_payment_expense boolean not null default false;
alter table public.fintrack_transactions add constraint fintrack_debt_payment_type check (not debt_payment_expense or type = 'transfer');

create or replace view public.fintrack_goal_totals with (security_invoker = true) as
select g.*, a.plan_id, a.current_balance, a.archived as account_archived,
  coalesce((select sum(t.amount) from public.fintrack_transactions t
    where t.from_account_id = g.account_id and (t.type = 'expense' or t.debt_payment_expense) and t.status = 'posted'), 0) as spent
from public.fintrack_goals g join public.fintrack_accounts a on a.id = g.account_id;

-- Keep reporting metadata and both balance changes in the same transaction.
create function public.fintrack_save_payment_transaction(
  p_actor_id uuid, p_type text, p_amount numeric,
  p_from_account_id uuid default null, p_to_account_id uuid default null,
  p_category_id uuid default null, p_note text default null,
  p_transaction_date date default current_date, p_allow_negative boolean default false,
  p_transaction_id uuid default null, p_goal_item_id uuid default null,
  p_debt_payment_expense boolean default false
) returns public.fintrack_transactions
language plpgsql security definer set search_path = public as $$
declare v_txn public.fintrack_transactions;
begin
  v_txn := public.fintrack_save_goal_transaction(p_actor_id, p_type, p_amount,
    p_from_account_id, p_to_account_id, p_category_id, p_note, p_transaction_date,
    p_allow_negative, p_transaction_id, p_goal_item_id);
  if p_debt_payment_expense then
    if p_type <> 'transfer' or not exists (
      select 1 from public.fintrack_accounts src join public.fintrack_accounts dst on dst.id = p_to_account_id
      where src.id = p_from_account_id and src.classification = 'asset' and dst.classification = 'liability'
    ) then raise exception 'Pengeluaran pembayaran utang harus dari dompet aset ke dompet utang'; end if;
    if p_category_id is not null and not exists (
      select 1 from public.fintrack_categories where id = p_category_id and type = 'expense' and plan_id = v_txn.plan_id and archived_at is null
    ) then raise exception 'Kategori pembayaran utang tidak valid'; end if;
  end if;
  update public.fintrack_transactions set debt_payment_expense = p_debt_payment_expense
    where id = v_txn.id returning * into v_txn;
  return v_txn;
end $$;
revoke all on function public.fintrack_save_payment_transaction(uuid, text, numeric, uuid, uuid, uuid, text, date, boolean, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.fintrack_save_payment_transaction(uuid, text, numeric, uuid, uuid, uuid, text, date, boolean, uuid, uuid, boolean) to service_role;
commit;
