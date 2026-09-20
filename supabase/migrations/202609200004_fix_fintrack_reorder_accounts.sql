alter table public.fintrack_accounts
  add column if not exists sort_order integer not null default 0;

create or replace function public.fintrack_reorder_accounts(
  p_actor_id uuid,
  p_account_ids uuid[]
) returns setof public.fintrack_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_expected integer;
begin
  select id into v_plan_id
  from public.fintrack_plans
  where owner_id = p_actor_id and archived_at is null
  order by created_at
  limit 1;

  if v_plan_id is null then
    raise exception 'Rencana pribadi tidak ditemukan';
  end if;

  select count(*) into v_expected
  from public.fintrack_accounts
  where plan_id = v_plan_id and archived = false;

  if coalesce(array_length(p_account_ids, 1), 0) <> v_expected
    or (select count(distinct account_id) from unnest(p_account_ids) as input(account_id)) <> v_expected
    or exists (
      select 1 from unnest(p_account_ids) as input(account_id)
      where not exists (
        select 1 from public.fintrack_accounts a
        where a.id = input.account_id and a.plan_id = v_plan_id and a.archived = false
      )
    ) then
    raise exception 'Urutan dompet tidak valid';
  end if;

  update public.fintrack_accounts a
  set sort_order = ordered.position - 1, updated_at = now()
  from unnest(p_account_ids) with ordinality as ordered(id, position)
  where a.id = ordered.id;

  return query
  select a.* from public.fintrack_accounts a
  where a.plan_id = v_plan_id and a.archived = false
  order by a.sort_order, a.created_at;
end;
$$;

revoke all on function public.fintrack_reorder_accounts(uuid, uuid[]) from public;
grant execute on function public.fintrack_reorder_accounts(uuid, uuid[]) to service_role;
