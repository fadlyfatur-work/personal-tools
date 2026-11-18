begin;

alter table public.tools_profiles add column if not exists is_suite_admin boolean not null default false;
alter table public.tools_profiles add column if not exists is_active boolean not null default true;
alter table public.tools_profiles add column if not exists revision integer not null default 1;

create or replace function public.tools_bootstrap(p_actor uuid,p_name text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_email text; v_workspace uuid; v_profile tools_profiles%rowtype; v_workspaces jsonb;
begin
  select email into v_email from auth.users where id=p_actor;
  if v_email is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into tools_profiles(user_id,name,email) values(p_actor,left(coalesce(nullif(trim(p_name),''),split_part(v_email,'@',1)),100),v_email)
  on conflict(user_id) do update set email=excluded.email;
  select * into v_profile from tools_profiles where user_id=p_actor;
  if not v_profile.is_active then raise exception 'TOOLS_ACCOUNT_DISABLED'; end if;
  insert into tools_workspaces(name,owner_id,is_personal) values('Ruang pribadi',p_actor,true)
  on conflict(owner_id) where is_personal do nothing;
  select id into v_workspace from tools_workspaces where owner_id=p_actor and is_personal;
  insert into tools_workspace_members(workspace_id,user_id,role) values(v_workspace,p_actor,'owner') on conflict do nothing;
  select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'role',m.role) order by w.is_personal desc,w.created_at,w.id),'[]')
  into v_workspaces from tools_workspaces w join tools_workspace_members m on m.workspace_id=w.id where m.user_id=p_actor;
  return jsonb_build_object('name',v_profile.name,'is_template_admin',v_profile.is_template_admin,'is_suite_admin',v_profile.is_suite_admin,'is_active',v_profile.is_active,'workspaces',v_workspaces);
end; $$;

create or replace function public.tools_manage_user(p_actor uuid,p_user uuid,p_revision integer,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v tools_profiles%rowtype; v_admin boolean; v_active boolean; v_template boolean; v_name text;
begin
  perform pg_advisory_xact_lock(hashtextextended('tools:admin-users',0));
  if not exists(select 1 from tools_profiles where user_id=p_actor and is_suite_admin and is_active) then raise exception 'TOOLS_ADMIN_REQUIRED'; end if;
  select * into v from tools_profiles where user_id=p_user for update;
  if v.user_id is null then raise exception 'TOOLS_USER_NOT_FOUND'; end if;
  if p_revision is null or v.revision<>p_revision then raise exception 'TOOLS_USER_CONFLICT'; end if;
  v_admin:=coalesce((p_data->>'is_suite_admin')::boolean,v.is_suite_admin);
  v_active:=coalesce((p_data->>'is_active')::boolean,v.is_active);
  v_template:=coalesce((p_data->>'is_template_admin')::boolean,v.is_template_admin);
  v_name:=coalesce(p_data->>'name',v.name);
  if char_length(trim(v_name)) not between 1 and 100 then raise exception 'TOOLS_USER_INVALID'; end if;
  if p_actor=p_user and (not v_admin or not v_active) then raise exception 'TOOLS_SELF_LOCKOUT'; end if;
  if v.is_suite_admin and v.is_active and (not v_admin or not v_active)
    and not exists(select 1 from tools_profiles where user_id<>p_user and is_suite_admin and is_active) then raise exception 'TOOLS_LAST_ADMIN'; end if;
  update tools_profiles set name=trim(v_name),is_suite_admin=v_admin,is_template_admin=v_template,is_active=v_active,revision=revision+1 where user_id=p_user returning * into v;
  insert into tools_audit(actor_id,action,subject_id,details) values(p_actor,'user.update',p_user::text,jsonb_build_object('is_suite_admin',v_admin,'is_template_admin',v_template,'is_active',v_active));
  return to_jsonb(v);
end; $$;

revoke all on function public.tools_bootstrap(uuid,text) from public,anon,authenticated;
revoke all on function public.tools_manage_user(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.tools_bootstrap(uuid,text) to service_role;
grant execute on function public.tools_manage_user(uuid,uuid,integer,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
