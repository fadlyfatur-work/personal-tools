begin;

alter table public.fintrack_users
  add column if not exists pin_version integer not null default 0,
  add column if not exists pin_failed_attempts integer not null default 0,
  add column if not exists pin_locked_until timestamptz,
  add column if not exists pin_last_login_at timestamptz;

update public.fintrack_users
set pin_version = coalesce(pin_version, 0),
    pin_failed_attempts = coalesce(pin_failed_attempts, 0)
where pin_version is null or pin_failed_attempts is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fintrack_users_pin_failed_attempts_check'
      and conrelid = 'public.fintrack_users'::regclass
  ) then
    alter table public.fintrack_users
      add constraint fintrack_users_pin_failed_attempts_check
      check (pin_failed_attempts >= 0);
  end if;
end;
$$;

create or replace function public.fintrack_record_pin_failure(p_user_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked_until timestamptz;
begin
  update public.fintrack_users
  set pin_locked_until = case
        when pin_failed_attempts + 1 >= 5 then now() + interval '15 minutes'
        else null
      end,
      pin_failed_attempts = case
        when pin_failed_attempts + 1 >= 5 then 0
        else pin_failed_attempts + 1
      end,
      updated_at = now()
  where id = p_user_id
  returning pin_locked_until into v_locked_until;

  return v_locked_until;
end;
$$;

revoke all on function public.fintrack_record_pin_failure(uuid) from public, anon, authenticated;
grant execute on function public.fintrack_record_pin_failure(uuid) to service_role;

notify pgrst, 'reload schema';

commit;
