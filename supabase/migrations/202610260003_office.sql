-- Apply after 202610260001_tools.sql. Additive; no existing application data changes.
begin;
create table if not exists public.office_tasks (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.tools_workspaces(id),
 owner_id uuid not null references auth.users(id), visibility text not null check (visibility in ('private','workspace')),
 title text not null check (length(title) between 1 and 200), status text not null check (status in ('todo','doing','waiting','done','cancelled')),
 data jsonb not null default '{}', revision integer not null default 1 check (revision > 0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,id)
);
create table if not exists public.office_followups (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.tools_workspaces(id),
 task_id uuid not null, owner_id uuid not null references auth.users(id), visibility text not null check(visibility in ('private','workspace')),
 title text not null, status text not null check(status in ('waiting','needed','done','cancelled')), data jsonb not null,
 revision integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(workspace_id,task_id) references public.office_tasks(workspace_id,id)
);
create table if not exists public.office_activities (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.tools_workspaces(id),
 task_id uuid not null, owner_id uuid not null references auth.users(id), visibility text not null check(visibility in ('private','workspace')),
 title text not null default '', status text not null default 'recorded', data jsonb not null,
 revision integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(workspace_id,task_id) references public.office_tasks(workspace_id,id)
);
create table if not exists public.office_meetings (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.tools_workspaces(id),
 owner_id uuid not null references auth.users(id), visibility text not null check(visibility in ('private','workspace')),
 title text not null, status text not null check(status in ('draft','final')), data jsonb not null,
 revision integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,id)
);
create table if not exists public.office_articles (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.tools_workspaces(id),
 owner_id uuid not null references auth.users(id), visibility text not null check(visibility in ('private','workspace')),
 title text not null, status text not null check(status in ('draft','published','archived')), data jsonb not null,
 revision integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.office_action_items (
 id uuid primary key, workspace_id uuid not null, meeting_id uuid not null,
 task_id uuid unique references public.office_tasks(id), data jsonb not null,
 foreign key(workspace_id,meeting_id) references public.office_meetings(workspace_id,id)
);
create table if not exists public.office_events (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.tools_workspaces(id),
 kind text not null, object_id uuid not null, actor_id uuid not null references auth.users(id),
 action text not null, revision integer not null, snapshot jsonb not null, created_at timestamptz not null default clock_timestamp(),
 unique(kind,object_id,revision,action)
);
create table if not exists public.office_followup_notes (
 id uuid primary key default gen_random_uuid(), followup_id uuid not null references public.office_followups(id),
 actor_id uuid not null references auth.users(id), content text not null check(length(content) between 1 and 10000), created_at timestamptz not null default now()
);
create table if not exists public.office_attachments (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.tools_workspaces(id),
 kind text not null check(kind in ('tasks','activities','meetings','knowledge')), object_id uuid not null,
 name text not null, storage_key text unique, url text, mime text, size_bytes integer not null default 0 check(size_bytes between 0 and 10485760),
 actor_id uuid not null references auth.users(id), created_at timestamptz not null default now(), check((storage_key is null) <> (url is null))
);
create table if not exists public.office_reminders (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.tools_workspaces(id),
 followup_id uuid not null references public.office_followups(id), recipient_id uuid not null references auth.users(id),
 scheduled_at timestamptz not null, kind text not null check(kind in ('reminder','overdue')), cancelled_at timestamptz, delivered_at timestamptz,
 unique(followup_id,kind,scheduled_at)
);
create table if not exists public.office_notifications (
 id uuid primary key default gen_random_uuid(), reminder_id uuid not null unique references public.office_reminders(id),
 workspace_id uuid not null references public.tools_workspaces(id), recipient_id uuid not null references auth.users(id),
 followup_id uuid not null references public.office_followups(id), seen_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists office_events_history on public.office_events(kind,object_id,revision desc);
create index if not exists office_followups_task on public.office_followups(workspace_id,task_id);
create index if not exists office_activities_task on public.office_activities(workspace_id,task_id);
create index if not exists office_attachments_parent on public.office_attachments(workspace_id,kind,object_id);
create index if not exists office_reminders_pending on public.office_reminders(scheduled_at) where cancelled_at is null and delivered_at is null;
do $$ declare t text; begin
 foreach t in array array['office_tasks','office_followups','office_activities','office_meetings','office_articles','office_action_items','office_events','office_followup_notes','office_attachments','office_reminders','office_notifications'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
 foreach t in array array['office_tasks','office_meetings','office_articles'] loop
  execute format('create index if not exists %I on public.%I(workspace_id,updated_at desc,id)',t||'_workspace',t);
 end loop;
end $$;
insert into storage.buckets(id,name,public,file_size_limit) values('office-private','office-private',false,10485760) on conflict(id) do update set public=false,file_size_limit=10485760;

create or replace function public.office_table(p_kind text) returns text language sql immutable set search_path=public as $$
 select case p_kind when 'tasks' then 'office_tasks' when 'followups' then 'office_followups' when 'activities' then 'office_activities' when 'meetings' then 'office_meetings' when 'knowledge' then 'office_articles' else null end
$$;
create or replace function public.office_access(p_actor uuid,p_workspace uuid,p_kind text,p_id uuid,p_write boolean default false)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare r jsonb; role_name text; t text; begin
 role_name:=tools_workspace_role(p_actor,p_workspace); t:=office_table(p_kind);
 if role_name is null or t is null or (p_write and role_name='viewer') then return false; end if;
 execute format('select to_jsonb(x) from public.%I x where id=$1 and workspace_id=$2',t) into r using p_id,p_workspace;
 if r is null then return false; end if;
 if p_kind in ('followups','activities') then return office_access(p_actor,p_workspace,'tasks',(r->>'task_id')::uuid,p_write); end if;
 return (r->>'owner_id'=p_actor::text or (r->>'visibility'='workspace' and (not p_write or role_name in ('owner','admin'))));
end $$;

create or replace function public.office_read(p_actor uuid,p_workspace uuid,p_kind text,p_id uuid default null,p_search text default '',p_offset integer default 0,p_filters jsonb default '{}')
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb; t text; begin
 if tools_workspace_role(p_actor,p_workspace) is null then raise exception 'OFFICE_FORBIDDEN'; end if;
 if p_kind='notifications' then
  return coalesce((select jsonb_agg(to_jsonb(n)||jsonb_build_object('title',f.title)) from (select * from office_notifications where workspace_id=p_workspace and recipient_id=p_actor order by created_at desc limit 50) n join office_followups f on f.id=n.followup_id where office_access(p_actor,p_workspace,'followups',f.id)), '[]');
 end if;
 t:=office_table(p_kind); if t is null then raise exception 'OFFICE_INVALID'; end if;
 if p_id is not null and not office_access(p_actor,p_workspace,p_kind,p_id) then raise exception 'OFFICE_NOT_FOUND'; end if;
 execute format($q$select coalesce(jsonb_agg(to_jsonb(x)||case when $4 in ('followups','activities') then coalesce((select jsonb_build_object('visibility',t.visibility) from office_tasks t where t.id=(to_jsonb(x)->>'task_id')::uuid and t.workspace_id=$1),'{}'::jsonb) else '{}'::jsonb end),'[]'::jsonb) from (
 select * from public.%I r where workspace_id=$1 and ($2::uuid is null or id=$2) and public.office_access($3,$1,$4,id)
 and ($5='' or (title||' '||data::text) ilike '%%'||$5||'%%')
 and (coalesce($7->>'status','')='' or status=$7->>'status')
 and (coalesce($7->>'category','')='' or case when $4='followups' then (select t.data->>'category' from office_tasks t where t.id=(to_jsonb(r)->>'task_id')::uuid and t.workspace_id=$1) else data->>'category' end=$7->>'category')
 and (coalesce($7->>'assignee_id','')='' or case when $4='followups' then (select t.data->>'assignee_id' from office_tasks t where t.id=(to_jsonb(r)->>'task_id')::uuid and t.workspace_id=$1) else data->>'assignee_id' end=$7->>'assignee_id')
 and (coalesce($7->>'owner_id','')='' or owner_id::text=$7->>'owner_id')
 and (coalesce($7->>'contact','')='' or data->>'contact' ilike '%%'||($7->>'contact')||'%%')
 and (coalesce($7->>'task_id','')='' or to_jsonb(r)->>'task_id'=$7->>'task_id')
 and (coalesce($7->>'from','')='' or coalesce(data->>'occurred_on',data->>'due_date',substring(data->>'held_at',1,10)) >= $7->>'from')
 and (coalesce($7->>'to','')='' or coalesce(data->>'occurred_on',data->>'due_date',substring(data->>'held_at',1,10)) <= $7->>'to')
 and (coalesce($7->>'overdue','')<>'true' or (status not in ('done','cancelled') and (data->>'due_date')::date < (now() at time zone 'Asia/Jakarta')::date))
 order by updated_at desc,id limit 50 offset case when $2::uuid is null then $6 else 0 end) x$q$,t) into result using p_workspace,p_id,p_actor,p_kind,left(p_search,200),greatest(0,least(p_offset,10000)),p_filters;
 if p_id is null then return result; end if;
 return jsonb_build_object('record',result->0,'can_edit',office_access(p_actor,p_workspace,p_kind,p_id,true),
 'history',coalesce((select jsonb_agg(to_jsonb(e) order by revision desc) from (select * from office_events where workspace_id=p_workspace and kind=p_kind and object_id=p_id order by revision desc limit 100 offset greatest(0,least(p_offset,10000))) e),'[]'),
 'attachments',coalesce((select jsonb_agg(to_jsonb(a)-'storage_key') from office_attachments a where workspace_id=p_workspace and kind=p_kind and object_id=p_id),'[]'),
 'activities',case when p_kind='tasks' then office_read(p_actor,p_workspace,'activities',null,'',0,jsonb_build_object('task_id',p_id)) else '[]'::jsonb end,
 'followups',case when p_kind='tasks' then office_read(p_actor,p_workspace,'followups',null,'',0,jsonb_build_object('task_id',p_id)) else '[]'::jsonb end,
 'notes',case when p_kind='followups' then coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at) from (select * from office_followup_notes where followup_id=p_id order by created_at desc limit 200) n),'[]') else '[]'::jsonb end,
 'action_items',case when p_kind='meetings' then coalesce((select jsonb_agg(to_jsonb(a)) from office_action_items a where meeting_id=p_id and workspace_id=p_workspace),'[]') else '[]'::jsonb end);
end $$;

create or replace function public.office_mutate(p_actor uuid,p_workspace uuid,p_kind text,p_action text,p_id uuid,p_revision integer,p_data jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare t text; old_row jsonb; new_row jsonb; role_name text; parent jsonb; item jsonb; linked uuid; target uuid; next_status text; vis text; confirmed boolean:=coalesce((p_data->>'confirm_incomplete')::boolean,false); ts timestamptz:=clock_timestamp(); begin
 role_name:=tools_workspace_role(p_actor,p_workspace); t:=office_table(p_kind);
 if role_name is null then raise exception 'OFFICE_FORBIDDEN'; end if;
 if p_action='seen' and p_kind='notifications' then update office_notifications set seen_at=coalesce(seen_at,ts) where id=p_id and workspace_id=p_workspace and recipient_id=p_actor; return jsonb_build_object('id',p_id); end if;
 if role_name='viewer' then raise exception 'OFFICE_FORBIDDEN'; end if;
 if t is null or octet_length(p_data::text)>262144 then raise exception 'OFFICE_INVALID'; end if;
 if p_id is not null then
  if not office_access(p_actor,p_workspace,p_kind,p_id,true) then raise exception 'OFFICE_NOT_FOUND'; end if;
  execute format('select to_jsonb(x) from public.%I x where id=$1 and workspace_id=$2 for update',t) into old_row using p_id,p_workspace;
  if not office_access(p_actor,p_workspace,p_kind,p_id,true) then raise exception 'OFFICE_NOT_FOUND'; end if;
  if p_action not in ('convert','note') and (p_revision is null or p_revision<>(old_row->>'revision')::integer) then raise exception 'OFFICE_CONFLICT'; end if;
 end if;
 if p_action='note' and p_kind='followups' then
  if length(trim(p_data->>'content')) not between 1 and 10000 then raise exception 'OFFICE_INVALID'; end if;
  insert into office_followup_notes(followup_id,actor_id,content) values(p_id,p_actor,p_data->>'content'); return old_row;
 end if;
 if p_action='convert' and p_kind='meetings' and p_id is not null then
  select task_id,data into linked,item from office_action_items where meeting_id=p_id and workspace_id=p_workspace and id=(p_data->>'action_item_id')::uuid;
  if item is null then raise exception 'OFFICE_NOT_FOUND'; end if;
  if linked is not null then return jsonb_build_object('task_id',linked,'reused',true); end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(old_row->'data'->'action_items','[]')) a where a->>'id'=p_data->>'action_item_id') then raise exception 'OFFICE_CONFLICT'; end if;
  if item->>'assignee_id' is not null and tools_workspace_role((item->>'assignee_id')::uuid,p_workspace) is null then raise exception 'OFFICE_INVALID_ASSIGNEE'; end if;
  if old_row->>'visibility'='private' and item->>'assignee_id' is not null and item->>'assignee_id'<>p_actor::text then raise exception 'OFFICE_PRIVATE_ASSIGNEE'; end if;
  insert into office_tasks(workspace_id,owner_id,visibility,title,status,data) values(p_workspace,p_actor,old_row->>'visibility',item->>'title','todo',jsonb_build_object('title',item->>'title','visibility',old_row->>'visibility','status','todo','assignee_id',item->'assignee_id','due_date',item->'due_date','description','Action item rapat','priority','normal','category','','checklist','[]'::jsonb)) returning id,to_jsonb(office_tasks.*) into linked,new_row;
  update office_action_items set task_id=linked where id=(p_data->>'action_item_id')::uuid;
  insert into office_events(workspace_id,kind,object_id,actor_id,action,revision,snapshot) values(p_workspace,'tasks',linked,p_actor,'conversion',1,new_row);
  return jsonb_build_object('task_id',linked,'reused',false);
 end if;
 if p_action='restore' and p_kind='knowledge' and p_id is not null then
  select snapshot->'data' into p_data from office_events where workspace_id=p_workspace and kind=p_kind and object_id=p_id and revision=(p_data->>'version')::integer;
  if p_data is null then raise exception 'OFFICE_NOT_FOUND'; end if;
  p_data:=jsonb_set(p_data,'{visibility}',old_row->'visibility');
 elsif p_action not in ('save','reopen') then raise exception 'OFFICE_INVALID'; end if;
 if old_row is not null and old_row->>'status'='final' and p_kind='meetings' and p_action<>'reopen' then raise exception 'OFFICE_FINAL_REVISE'; end if;
 if old_row is not null and p_kind='tasks' and old_row->>'status' in ('done','cancelled') and coalesce(p_data->>'status','todo') not in ('done','cancelled') and p_action<>'reopen' then raise exception 'OFFICE_REOPEN_REQUIRED'; end if;
 if p_action='reopen' then
  if p_kind not in ('tasks','meetings') or old_row is null then raise exception 'OFFICE_INVALID'; end if;
  p_data:=old_row->'data'||jsonb_build_object('status',case when p_kind='meetings' then 'draft' else 'todo' end);
 end if;
 if p_kind in ('activities','followups') then
  target:=coalesce((old_row->>'task_id')::uuid,(p_data->>'task_id')::uuid);
  select to_jsonb(x) into parent from office_tasks x where id=target and workspace_id=p_workspace for update;
  if parent is null or not office_access(p_actor,p_workspace,'tasks',target,true) then raise exception 'OFFICE_NOT_FOUND'; end if;
  if old_row is not null and target<>(p_data->>'task_id')::uuid then raise exception 'OFFICE_INVALID'; end if;
  if p_kind='followups' and parent->>'status' in ('done','cancelled') and p_data->>'status' not in ('done','cancelled') then raise exception 'OFFICE_TASK_CLOSED'; end if;
  vis:=parent->>'visibility';
 else vis:=coalesce(p_data->>'visibility','private'); end if;
 if vis not in ('private','workspace') then raise exception 'OFFICE_INVALID'; end if;
 if old_row is not null and vis<>old_row->>'visibility' and p_actor::text<>old_row->>'owner_id' then raise exception 'OFFICE_FORBIDDEN'; end if;
 if p_kind='tasks' then
  if p_data->>'assignee_id' is not null and tools_workspace_role((p_data->>'assignee_id')::uuid,p_workspace) is null then raise exception 'OFFICE_INVALID_ASSIGNEE'; end if;
  if vis='private' and p_data->>'assignee_id' is not null and p_data->>'assignee_id'<>coalesce(old_row->>'owner_id',p_actor::text) then raise exception 'OFFICE_PRIVATE_ASSIGNEE'; end if;
  if p_data->>'status' in ('done','cancelled') then
   if exists(select 1 from office_followups where task_id=p_id and status not in ('done','cancelled')) then raise exception 'OFFICE_FOLLOWUPS_OPEN'; end if;
   if p_data->>'status'='done' and exists(select 1 from jsonb_array_elements(coalesce(p_data->'checklist','[]')) c where not coalesce((c->>'done')::boolean,false)) and not coalesce((p_data->>'confirm_incomplete')::boolean,false) then raise exception 'OFFICE_CHECKLIST_CONFIRM'; end if;
  end if;
 elsif p_kind='meetings' then
  for item in select value from jsonb_array_elements(coalesce(p_data->'action_items','[]')) loop
   if item->>'assignee_id' is not null and tools_workspace_role((item->>'assignee_id')::uuid,p_workspace) is null then raise exception 'OFFICE_INVALID_ASSIGNEE'; end if;
   if vis='private' and item->>'assignee_id' is not null and item->>'assignee_id'<>coalesce(old_row->>'owner_id',p_actor::text) then raise exception 'OFFICE_PRIVATE_ASSIGNEE'; end if;
   if exists(select 1 from office_action_items where id=(item->>'id')::uuid and meeting_id<>coalesce(p_id,'00000000-0000-0000-0000-000000000000'::uuid)) then raise exception 'OFFICE_INVALID'; end if;
  end loop;
 elsif p_kind='knowledge' then
  for item in select value from jsonb_array_elements(coalesce(p_data->'links','[]')) loop
   if item->>'kind'='template' then
    if coalesce(item->>'code','') !~ '^[A-Za-z0-9_-]{1,100}$' then raise exception 'OFFICE_INVALID'; end if;
   elsif not office_access(p_actor,p_workspace,case item->>'kind' when 'task' then 'tasks' when 'meeting' then 'meetings' else '' end,(item->>'id')::uuid) then raise exception 'OFFICE_NOT_FOUND'; end if;
  end loop;
 end if;
 p_data:=p_data-'confirm_incomplete';
 next_status:=coalesce(p_data->>'status',case p_kind when 'tasks' then 'todo' when 'followups' then 'waiting' when 'activities' then 'recorded' else 'draft' end);
 if p_id is null then
  p_id:=gen_random_uuid();
  if p_kind in ('activities','followups') then
   execute format('insert into public.%I(id,workspace_id,owner_id,visibility,title,status,data,task_id) values($1,$2,$3,$4,$5,$6,$7,$8) returning to_jsonb(%I.*)',t,t) into new_row using p_id,p_workspace,p_actor,vis,coalesce(p_data->>'title',left(p_data->>'progress',200)),next_status,p_data,target;
  else
   execute format('insert into public.%I(id,workspace_id,owner_id,visibility,title,status,data) values($1,$2,$3,$4,$5,$6,$7) returning to_jsonb(%I.*)',t,t) into new_row using p_id,p_workspace,p_actor,vis,p_data->>'title',next_status,p_data;
  end if;
 else
  execute format('update public.%I set visibility=$2,title=$3,status=$4,data=$5,revision=revision+1,updated_at=$6 where id=$1 returning to_jsonb(%I.*)',t,t) into new_row using p_id,vis,coalesce(p_data->>'title',left(p_data->>'progress',200)),next_status,p_data,ts;
 end if;
 if p_kind='meetings' then
  for item in select value from jsonb_array_elements(coalesce(p_data->'action_items','[]')) loop
   insert into office_action_items(id,workspace_id,meeting_id,data) values((item->>'id')::uuid,p_workspace,p_id,item) on conflict(id) do update set data=excluded.data where office_action_items.meeting_id=p_id;
  end loop;
 end if;
 if p_kind='followups' then
  update office_reminders set cancelled_at=ts where followup_id=p_id and delivered_at is null and cancelled_at is null;
  if next_status not in ('done','cancelled') then
   if p_data->>'reminder_at' is not null then
    insert into office_reminders(workspace_id,followup_id,recipient_id,scheduled_at,kind) values(p_workspace,p_id,coalesce((parent->'data'->>'assignee_id')::uuid,(parent->>'owner_id')::uuid),(p_data->>'reminder_at')::timestamptz,'reminder') on conflict(followup_id,kind,scheduled_at) do update set cancelled_at=null,recipient_id=excluded.recipient_id where office_reminders.delivered_at is null;
   end if;
   insert into office_reminders(workspace_id,followup_id,recipient_id,scheduled_at,kind) values(p_workspace,p_id,coalesce((parent->'data'->>'assignee_id')::uuid,(parent->>'owner_id')::uuid),((p_data->>'due_date')::date+1)::timestamp at time zone 'Asia/Jakarta','overdue') on conflict(followup_id,kind,scheduled_at) do update set cancelled_at=null,recipient_id=excluded.recipient_id where office_reminders.delivered_at is null;
  end if;
 end if;
 insert into office_events(workspace_id,kind,object_id,actor_id,action,revision,snapshot) values(p_workspace,p_kind,p_id,p_actor,case when p_kind='tasks' and next_status='done' and confirmed then 'save_confirmed_checklist' else p_action end,(new_row->>'revision')::integer,new_row);
 return new_row;
end $$;

create or replace function public.office_attachment_add(p_actor uuid,p_workspace uuid,p_kind text,p_id uuid,p_name text,p_key text default null,p_url text default null,p_size integer default 0)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; t text; locked uuid; begin
 t:=office_table(p_kind);
 if t is null or p_kind='followups' then raise exception 'OFFICE_INVALID'; end if;
 execute format('select id from public.%I where id=$1 and workspace_id=$2 for update',t) into locked using p_id,p_workspace;
 if locked is null or not office_access(p_actor,p_workspace,p_kind,p_id,true) then raise exception 'OFFICE_NOT_FOUND'; end if;
 if length(p_name) not between 1 and 200 or (p_key is null)=(p_url is null) or (p_key is not null and p_key not like p_workspace::text||'/'||p_kind||'/'||p_id::text||'/%') or (p_url is not null and p_url !~ '^https?://') then raise exception 'OFFICE_INVALID'; end if;
 if (select count(*) from office_attachments where kind=p_kind and object_id=p_id)>=30 then raise exception 'OFFICE_INVALID'; end if;
 insert into office_attachments(workspace_id,kind,object_id,name,storage_key,url,size_bytes,actor_id) values(p_workspace,p_kind,p_id,p_name,p_key,p_url,p_size,p_actor) returning to_jsonb(office_attachments.*)-'storage_key' into result;
 return result;
end $$;

create or replace function public.office_process_reminders(p_now timestamptz default now()) returns integer language plpgsql security definer set search_path=public as $$
declare r record; recipient uuid; processed integer:=0; begin
 for r in select * from office_reminders where scheduled_at<=p_now and delivered_at is null and cancelled_at is null order by scheduled_at limit 500 for update skip locked loop
  recipient:=null;
  insert into office_notifications(reminder_id,workspace_id,recipient_id,followup_id)
   select r.id,r.workspace_id,coalesce((t.data->>'assignee_id')::uuid,t.owner_id),f.id
   from office_followups f join office_tasks t on t.id=f.task_id and t.workspace_id=f.workspace_id
   where f.id=r.followup_id and f.workspace_id=r.workspace_id and f.status not in ('done','cancelled')
   and office_access(coalesce((t.data->>'assignee_id')::uuid,t.owner_id),r.workspace_id,'followups',f.id)
   on conflict(reminder_id) do nothing;
  select recipient_id into recipient from office_notifications where reminder_id=r.id;
  if recipient is not null then
   update office_reminders set delivered_at=p_now,recipient_id=recipient where id=r.id; processed:=processed+1;
  else update office_reminders set cancelled_at=p_now where id=r.id; end if;
 end loop; return processed;
end $$;

create or replace function public.office_report(p_actor uuid,p_workspace uuid,p_from date,p_to date,p_snapshot timestamptz default now()) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if tools_workspace_role(p_actor,p_workspace) is null then raise exception 'OFFICE_FORBIDDEN'; end if;
 if p_to<p_from or p_to-p_from>366 then raise exception 'OFFICE_INVALID'; end if;
 return jsonb_build_object('from',p_from,'to',p_to,'snapshot',least(p_snapshot,now()),'activities',coalesce((select jsonb_agg(x.snapshot order by x.snapshot->'data'->>'occurred_on',x.object_id) from (select * from (
 select distinct on (object_id) object_id,snapshot from office_events where workspace_id=p_workspace and kind='activities' and created_at<=least(p_snapshot,now()) and office_access(p_actor,p_workspace,'activities',object_id) order by object_id,revision desc
 ) versions where (snapshot->'data'->>'occurred_on')::date between p_from and p_to limit 2001) x),'[]'),
 'events',coalesce((select jsonb_agg(jsonb_build_object('created_at',e.created_at,'action',e.action,'snapshot',jsonb_build_object('title',e.snapshot->>'title','status',e.snapshot->>'status','revision',e.revision)) order by e.created_at) from (select * from office_events where workspace_id=p_workspace and kind='tasks' and created_at<=least(p_snapshot,now()) and (created_at at time zone 'Asia/Jakarta')::date between p_from and p_to and office_access(p_actor,p_workspace,'tasks',object_id) order by created_at limit 2001) e),'[]'));
end $$;
do $$ declare f record; begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in ('office_table','office_access','office_read','office_mutate','office_process_reminders','office_report','office_attachment_add') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
commit;
