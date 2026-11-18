begin;

create table public.ahsp_ai_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 100),
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  encrypted_key text not null check (length(encrypted_key) > 20),
  is_default boolean not null default false,
  updated_at timestamptz not null default now()
);
create unique index ahsp_ai_one_default on public.ahsp_ai_profiles (is_default) where is_default;
alter table public.ahsp_ai_profiles enable row level security;
revoke all on public.ahsp_ai_profiles from anon, authenticated;
grant all on public.ahsp_ai_profiles to service_role;

create table public.ahsp_ai_request_quota (
  window_start timestamptz primary key,
  request_count integer not null check (request_count between 1 and 120)
);
alter table public.ahsp_ai_request_quota enable row level security;
revoke all on public.ahsp_ai_request_quota from anon, authenticated;
grant all on public.ahsp_ai_request_quota to service_role;

create function public.ahsp_ai_save_profile(p_id uuid, p_name text, p_config jsonb, p_encrypted_key text, p_is_default boolean)
returns uuid language plpgsql security invoker set search_path = public as $$
declare result uuid;
begin
  perform pg_advisory_xact_lock(647032510);
  if p_is_default then update public.ahsp_ai_profiles set is_default = false where is_default; end if;
  if p_id is null then
    if (select count(*) from public.ahsp_ai_profiles) >= 20 then raise exception 'Profile limit'; end if;
    insert into public.ahsp_ai_profiles(name, config, encrypted_key, is_default)
    values(p_name, p_config, p_encrypted_key, p_is_default) returning id into result;
  else
    update public.ahsp_ai_profiles set name = p_name, config = p_config, encrypted_key = p_encrypted_key,
      is_default = p_is_default, updated_at = now() where id = p_id returning id into result;
    if result is null then raise exception 'Profile missing'; end if;
  end if;
  return result;
end;
$$;

create function public.ahsp_ai_take_request() returns boolean
language plpgsql security invoker set search_path = public as $$
declare result integer;
begin
  delete from public.ahsp_ai_request_quota where window_start < date_trunc('hour', now()) - interval '24 hours';
  insert into public.ahsp_ai_request_quota(window_start, request_count) values(date_trunc('hour', now()), 1)
  on conflict(window_start) do update set request_count = ahsp_ai_request_quota.request_count + 1
  where ahsp_ai_request_quota.request_count < 120 returning request_count into result;
  return result is not null;
end;
$$;

revoke all on function public.ahsp_ai_save_profile(uuid,text,jsonb,text,boolean) from public, anon, authenticated;
revoke all on function public.ahsp_ai_take_request() from public, anon, authenticated;
grant execute on function public.ahsp_ai_save_profile(uuid,text,jsonb,text,boolean) to service_role;
grant execute on function public.ahsp_ai_take_request() to service_role;

commit;
