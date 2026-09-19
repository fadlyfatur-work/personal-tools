-- Adds atomic negative-balance confirmation and correct liability transfer direction.
begin;

drop function if exists public.fintrack_replace_transaction(uuid, uuid, text, numeric, uuid, uuid, uuid, text, date, boolean);
drop function if exists public.fintrack_replace_transaction(uuid, uuid, text, numeric, uuid, uuid, uuid, text, date);
drop function if exists public.fintrack_create_transaction(uuid, text, numeric, uuid, uuid, uuid, text, date, boolean);
drop function if exists public.fintrack_create_transaction(uuid, text, numeric, uuid, uuid, uuid, text, date);

create function public.fintrack_create_transaction(
  p_actor_id uuid,
  p_type text,
  p_amount numeric,
  p_from_account_id uuid default null,
  p_to_account_id uuid default null,
  p_category_id uuid default null,
  p_note text default null,
  p_transaction_date date default current_date,
  p_allow_negative boolean default false
)
returns public.fintrack_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn public.fintrack_transactions;
  v_plan_id uuid;
  v_from_class text;
  v_to_class text;
  v_from_delta numeric(18, 2);
  v_to_delta numeric(18, 2);
  v_resulting_balance numeric(18, 2);
begin
  if p_amount <= 0 then raise exception 'Nominal harus lebih dari 0'; end if;
  if p_type not in ('income', 'expense', 'transfer') then raise exception 'Tipe transaksi tidak valid'; end if;
  if p_type = 'income' and (p_to_account_id is null or p_from_account_id is not null) then raise exception 'Akun pemasukan tidak valid'; end if;
  if p_type = 'expense' and (p_from_account_id is null or p_to_account_id is not null) then raise exception 'Akun pengeluaran tidak valid'; end if;
  if p_type = 'transfer' and (p_from_account_id is null or p_to_account_id is null or p_from_account_id = p_to_account_id) then raise exception 'Akun transfer tidak valid'; end if;

  perform 1 from public.fintrack_accounts
  where id = any(array_remove(array[p_from_account_id, p_to_account_id]::uuid[], null))
  order by id for update;

  if p_from_account_id is not null then
    if not public.fintrack_can_manage_account(p_actor_id, p_from_account_id) then raise exception 'Tidak punya akses ke dompet asal'; end if;
    select plan_id, classification into v_plan_id, v_from_class from public.fintrack_accounts where id = p_from_account_id;
  end if;

  if p_to_account_id is not null then
    if not public.fintrack_can_manage_account(p_actor_id, p_to_account_id) then raise exception 'Tidak punya akses ke dompet tujuan'; end if;
    if v_plan_id is null then
      select plan_id, classification into v_plan_id, v_to_class from public.fintrack_accounts where id = p_to_account_id;
    else
      select classification into v_to_class from public.fintrack_accounts where id = p_to_account_id and plan_id = v_plan_id;
      if not found then raise exception 'Kedua dompet harus berada di rencana yang sama'; end if;
    end if;
  end if;

  if p_category_id is not null and not exists (
    select 1 from public.fintrack_categories where id = p_category_id and plan_id = v_plan_id
  ) then raise exception 'Kategori tidak valid'; end if;

  if p_from_account_id is not null then
    v_from_delta := case when v_from_class = 'liability' and p_type in ('expense', 'transfer') then p_amount else -p_amount end;
    select current_balance + v_from_delta into v_resulting_balance from public.fintrack_accounts where id = p_from_account_id;
    if v_resulting_balance < 0 and not p_allow_negative then raise exception 'FINTRACK_NEGATIVE_BALANCE'; end if;
  end if;

  if p_to_account_id is not null then
    v_to_delta := case when v_to_class = 'liability' and p_type in ('income', 'transfer') then -p_amount else p_amount end;
    select current_balance + v_to_delta into v_resulting_balance from public.fintrack_accounts where id = p_to_account_id;
    if v_resulting_balance < 0 and not p_allow_negative then raise exception 'FINTRACK_NEGATIVE_BALANCE'; end if;
  end if;

  insert into public.fintrack_transactions (
    plan_id, from_account_id, to_account_id, category_id, amount, type, note,
    transaction_date, created_by, updated_by
  ) values (
    v_plan_id, p_from_account_id, p_to_account_id, p_category_id, p_amount, p_type,
    nullif(trim(p_note), ''), p_transaction_date, p_actor_id, p_actor_id
  ) returning * into v_txn;

  if p_from_account_id is not null then
    insert into public.fintrack_transaction_entries (transaction_id, account_id, amount_delta)
    values (v_txn.id, p_from_account_id, v_from_delta);
    update public.fintrack_accounts set current_balance = current_balance + v_from_delta, updated_at = now() where id = p_from_account_id;
  end if;

  if p_to_account_id is not null then
    insert into public.fintrack_transaction_entries (transaction_id, account_id, amount_delta)
    values (v_txn.id, p_to_account_id, v_to_delta);
    update public.fintrack_accounts set current_balance = current_balance + v_to_delta, updated_at = now() where id = p_to_account_id;
  end if;

  insert into public.fintrack_account_activity_logs (account_id, actor_id, action, entity_type, entity_id)
  select account_id, p_actor_id, 'transaction.created', 'transaction', v_txn.id
  from public.fintrack_transaction_entries where transaction_id = v_txn.id;
  return v_txn;
end;
$$;

create function public.fintrack_replace_transaction(
  p_actor_id uuid,
  p_transaction_id uuid,
  p_type text,
  p_amount numeric,
  p_from_account_id uuid default null,
  p_to_account_id uuid default null,
  p_category_id uuid default null,
  p_note text default null,
  p_transaction_date date default current_date,
  p_allow_negative boolean default false
)
returns public.fintrack_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.fintrack_transactions;
  v_new public.fintrack_transactions;
begin
  v_old := public.fintrack_void_transaction(p_actor_id, p_transaction_id);
  v_new := public.fintrack_create_transaction(
    p_actor_id, p_type, p_amount, p_from_account_id, p_to_account_id,
    p_category_id, p_note, p_transaction_date, p_allow_negative
  );
  insert into public.fintrack_account_activity_logs (account_id, actor_id, action, entity_type, entity_id, metadata)
  select account_id, p_actor_id, 'transaction.replaced', 'transaction', v_new.id,
    jsonb_build_object('replaced_transaction_id', v_old.id)
  from public.fintrack_transaction_entries where transaction_id = v_new.id;
  return v_new;
end;
$$;

revoke all on function public.fintrack_create_transaction(uuid, text, numeric, uuid, uuid, uuid, text, date, boolean) from public, anon, authenticated;
revoke all on function public.fintrack_replace_transaction(uuid, uuid, text, numeric, uuid, uuid, uuid, text, date, boolean) from public, anon, authenticated;
grant execute on function public.fintrack_create_transaction(uuid, text, numeric, uuid, uuid, uuid, text, date, boolean) to service_role;
grant execute on function public.fintrack_replace_transaction(uuid, uuid, text, numeric, uuid, uuid, uuid, text, date, boolean) to service_role;

commit;
