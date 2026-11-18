begin;

create table if not exists public.tools_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  email text not null,
  is_template_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.tools_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  owner_id uuid not null references auth.users(id),
  is_personal boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists tools_personal_workspace_owner on public.tools_workspaces(owner_id) where is_personal;
create table if not exists public.tools_workspace_members (
  workspace_id uuid not null references public.tools_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member','viewer')),
  primary key(workspace_id,user_id)
);
create index if not exists tools_members_user on public.tools_workspace_members(user_id,workspace_id);
create table if not exists public.tools_workspace_invites (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.tools_workspaces(id) on delete cascade,
  email text not null, role text not null check(role in ('admin','member','viewer')),
  token_hash text not null unique, invited_by uuid not null references auth.users(id), expires_at timestamptz not null,
  accepted_at timestamptz, revoked_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.tools_rate_limits (key text primary key, count integer not null, reset_at timestamptz not null);
create table if not exists public.tools_audit (
  id bigint generated always as identity primary key, actor_id uuid references auth.users(id), workspace_id uuid references public.tools_workspaces(id),
  action text not null, subject_id text, details jsonb not null default '{}', created_at timestamptz not null default now()
);

create or replace function public.tools_workspace_role(p_actor uuid,p_workspace uuid) returns text
language sql stable security definer set search_path=public as $$
  select role from tools_workspace_members where user_id=p_actor and workspace_id=p_workspace;
$$;

create or replace function public.tools_bootstrap(p_actor uuid,p_name text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_email text; v_workspace uuid; v_profile tools_profiles%rowtype; v_workspaces jsonb;
begin
  select email into v_email from auth.users where id=p_actor;
  if v_email is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into tools_profiles(user_id,name,email) values(p_actor,left(coalesce(nullif(trim(p_name),''),split_part(v_email,'@',1)),100),v_email)
  on conflict(user_id) do update set email=excluded.email;
  insert into tools_workspaces(name,owner_id,is_personal) values('Ruang pribadi',p_actor,true)
  on conflict(owner_id) where is_personal do nothing;
  select id into v_workspace from tools_workspaces where owner_id=p_actor and is_personal;
  insert into tools_workspace_members(workspace_id,user_id,role) values(v_workspace,p_actor,'owner') on conflict do nothing;
  select * into v_profile from tools_profiles where user_id=p_actor;
  select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'role',m.role) order by w.is_personal desc,w.created_at,w.id),'[]')
  into v_workspaces from tools_workspaces w join tools_workspace_members m on m.workspace_id=w.id where m.user_id=p_actor;
  return jsonb_build_object('name',v_profile.name,'is_template_admin',v_profile.is_template_admin,'workspaces',v_workspaces);
end; $$;

create or replace function public.tools_create_workspace(p_actor uuid,p_name text) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not exists(select 1 from tools_profiles where user_id=p_actor) then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(trim(p_name)) not between 1 and 100 then raise exception 'INVALID_NAME'; end if;
  insert into tools_workspaces(name,owner_id) values(trim(p_name),p_actor) returning id into v_id;
  insert into tools_workspace_members values(v_id,p_actor,'owner');
  insert into tools_audit(actor_id,workspace_id,action,subject_id) values(p_actor,v_id,'workspace.create',v_id::text);
  return v_id;
end; $$;

create or replace function public.tools_take_rate_limit(p_key text,p_limit integer,p_seconds integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v tools_rate_limits%rowtype;
begin
  if p_limit<1 or p_seconds<1 or p_seconds>86400 or char_length(p_key)>300 then raise exception 'INVALID_LIMIT'; end if;
  insert into tools_rate_limits(key,count,reset_at) values(p_key,1,now()+make_interval(secs=>p_seconds))
  on conflict(key) do update set count=case when tools_rate_limits.reset_at<=now() then 1 else tools_rate_limits.count+1 end,
    reset_at=case when tools_rate_limits.reset_at<=now() then now()+make_interval(secs=>p_seconds) else tools_rate_limits.reset_at end returning * into v;
  delete from tools_rate_limits where key in(select key from tools_rate_limits where reset_at<now()-interval '1 day' limit 100);
  return jsonb_build_object('allowed',v.count<=p_limit,'retry_after',greatest(1,ceil(extract(epoch from v.reset_at-now()))::integer));
end; $$;

create or replace function public.tools_manage_member(p_actor uuid,p_workspace uuid,p_user uuid,p_role text,p_remove boolean default false) returns void
language plpgsql security definer set search_path=public as $$
declare v_owner uuid; v_actor_role text;
begin
  select owner_id into v_owner from tools_workspaces where id=p_workspace for update;
  v_actor_role:=tools_workspace_role(p_actor,p_workspace);
  if v_actor_role is null or v_actor_role not in ('owner','admin') then raise exception 'FORBIDDEN'; end if;
  if p_user=v_owner then raise exception 'OWNER_REQUIRED'; end if;
  if not exists(select 1 from tools_workspace_members where workspace_id=p_workspace and user_id=p_user) then raise exception 'NOT_FOUND'; end if;
  if p_role='owner' and not p_remove then
    if p_actor<>v_owner then raise exception 'FORBIDDEN'; end if;
    update tools_workspace_members set role='admin' where workspace_id=p_workspace and user_id=v_owner;
    update tools_workspace_members set role='owner' where workspace_id=p_workspace and user_id=p_user;
    update tools_workspaces set owner_id=p_user where id=p_workspace;
  elsif p_remove then
    if p_user=p_actor then raise exception 'CANNOT_REMOVE_SELF'; end if;
    delete from tools_workspace_members where workspace_id=p_workspace and user_id=p_user;
  else
    if p_role not in ('admin','member','viewer') then raise exception 'INVALID_ROLE'; end if;
    if v_actor_role='admin' and (p_role='admin' or (select role from tools_workspace_members where workspace_id=p_workspace and user_id=p_user)='admin') then raise exception 'FORBIDDEN'; end if;
    update tools_workspace_members set role=p_role where workspace_id=p_workspace and user_id=p_user;
  end if;
  insert into tools_audit(actor_id,workspace_id,action,subject_id,details) values(p_actor,p_workspace,'workspace.member',p_user::text,jsonb_build_object('role',p_role,'removed',p_remove));
end; $$;

create or replace function public.tools_accept_invite(p_actor uuid,p_hash text) returns uuid
language plpgsql security definer set search_path=public as $$
declare v tools_workspace_invites%rowtype; v_email text;
begin
  select * into v from tools_workspace_invites where token_hash=p_hash for update;
  select lower(email) into v_email from auth.users where id=p_actor;
  if v.id is null or v_email<>lower(v.email) or v.expires_at<=now() or v.revoked_at is not null then raise exception 'INVITE_INVALID'; end if;
  if v.accepted_at is not null then
    if tools_workspace_role(p_actor,v.workspace_id) is not null then return v.workspace_id; end if;
    raise exception 'INVITE_INVALID';
  end if;
  if coalesce(tools_workspace_role(v.invited_by,v.workspace_id),'') not in ('owner','admin') then raise exception 'INVITE_INVALID'; end if;
  insert into tools_workspace_members values(v.workspace_id,p_actor,v.role) on conflict do nothing;
  update tools_workspace_invites set accepted_at=now() where id=v.id;
  insert into tools_audit(actor_id,workspace_id,action,subject_id) values(p_actor,v.workspace_id,'invite.accept',v.id::text);
  return v.workspace_id;
end; $$;

do $$ declare t text; f record; begin
  foreach t in array array['tools_profiles','tools_workspaces','tools_workspace_members','tools_workspace_invites','tools_rate_limits','tools_audit'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in('tools_workspace_role','tools_bootstrap','tools_create_workspace','tools_take_rate_limit','tools_manage_member','tools_accept_invite') loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
grant usage,select on sequence public.tools_audit_id_seq to service_role;
notify pgrst,'reload schema';
commit;
