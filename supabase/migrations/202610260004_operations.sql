begin;

create table public.tools_services (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.tools_workspaces(id) on delete cascade,
  name text not null check(length(name) between 1 and 120), created_at timestamptz not null default now(),
  unique(workspace_id, name), unique(id, workspace_id)
);
create table public.tools_environments (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.tools_workspaces(id) on delete cascade,
  service_id uuid not null, name text not null check(length(name) between 1 and 80), created_at timestamptz not null default now(),
  foreign key(service_id,workspace_id) references public.tools_services(id,workspace_id), unique(service_id,name), unique(id,service_id,workspace_id)
);
create table public.operations_deployments (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.tools_workspaces(id) on delete cascade,
  service_id uuid not null, environment_id uuid not null, version text not null check(length(version) between 1 and 120),
  deployed_at timestamptz not null, performer text not null check(length(performer) between 1 and 160),
  status text not null check(status in ('planned','in_progress','succeeded','failed','cancelled')),
  changelog text not null default '' check(length(changelog)<=12000), configuration_notes text not null default '' check(length(configuration_notes)<=6000),
  evidence_url text not null default '' check(length(evidence_url)<=2000), rollback_plan text not null default '' check(length(rollback_plan)<=6000),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), revision integer not null default 1,
  foreign key(environment_id,service_id,workspace_id) references public.tools_environments(id,service_id,workspace_id), unique(id,workspace_id)
);
create index operations_deployments_timeline on public.operations_deployments(workspace_id,deployed_at desc);
create table public.operations_rollbacks (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, deployment_id uuid not null,
  target_version text not null check(length(target_version) between 1 and 120), performed_at timestamptz not null,
  performer text not null check(length(performer) between 1 and 160), result text not null check(length(result) between 1 and 6000),
  status text not null check(status in ('planned','succeeded','failed')), created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  foreign key(deployment_id,workspace_id) references public.operations_deployments(id,workspace_id)
);
create table public.operations_monitors (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.tools_workspaces(id) on delete cascade,
  service_id uuid not null, environment_id uuid not null, name text not null check(length(name) between 1 and 120), url text not null check(length(url)<=2000),
  expected_statuses integer[] not null default '{200}' check(cardinality(expected_statuses) between 1 and 10),
  interval_seconds integer not null default 300 check(interval_seconds between 300 and 86400), timeout_ms integer not null default 10000 check(timeout_ms between 1000 and 10000),
  failure_threshold integer not null default 3 check(failure_threshold between 1 and 10), recovery_threshold integer not null default 2 check(recovery_threshold between 1 and 10),
  active boolean not null default true, maintenance boolean not null default false, maintenance_note text not null default '' check(length(maintenance_note)<=1000),
  revision integer not null default 1, state text not null default 'unknown', disabled_reason text, last_checked_at timestamptz, watermark timestamptz,
  consecutive_failures integer not null default 0, consecutive_successes integer not null default 0, next_due_at timestamptz not null default now(),
  created_at timestamptz not null default now(), created_by uuid not null references auth.users(id),
  foreign key(environment_id,service_id,workspace_id) references public.tools_environments(id,service_id,workspace_id), unique(id,workspace_id)
);
create index operations_monitors_due on public.operations_monitors(next_due_at);
create table public.operations_check_slots (
  id uuid primary key default gen_random_uuid(), monitor_id uuid not null, workspace_id uuid not null, scheduled_at timestamptz not null,
  duration_seconds integer not null, monitor_revision integer not null, lease_token uuid not null default gen_random_uuid(), lease_until timestamptz not null,
  finished_at timestamptz, outcome text check(outcome in ('healthy','failed','blocked','maintenance','paused','unknown')),
  checked_at timestamptz, http_status integer, response_ms integer, tls_expires_at timestamptz, tls_valid boolean, error_code text,
  foreign key(monitor_id,workspace_id) references public.operations_monitors(id,workspace_id) on delete cascade,
  unique(monitor_id, scheduled_at)
);
create index operations_check_history on public.operations_check_slots(workspace_id,scheduled_at desc);
create table public.operations_incidents (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, monitor_id uuid not null, opened_at timestamptz not null,
  recovered_at timestamptz, foreign key(monitor_id,workspace_id) references public.operations_monitors(id,workspace_id) on delete cascade
);
create unique index operations_one_open_incident on public.operations_incidents(monitor_id) where recovered_at is null;
create table public.operations_notifications (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.tools_workspaces(id) on delete cascade,
  incident_id uuid not null references public.operations_incidents(id) on delete cascade, kind text not null check(kind in ('open','recovery')),
  recipient_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), read_at timestamptz,
  unique(incident_id, kind, recipient_id)
);

create function public.operations_monitor_limit() returns trigger language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.workspace_id::text, 41));
  if (select count(*) from operations_monitors where workspace_id=new.workspace_id)>=50 then raise exception 'MONITOR_LIMIT'; end if;
  return new;
end $$;
create trigger operations_monitor_limit before insert on public.operations_monitors for each row execute function public.operations_monitor_limit();

create function public.operations_claim_checks(p_limit integer default 8)
returns jsonb language plpgsql security definer set search_path=public as $$
declare m operations_monitors; s operations_check_slots; jobs jsonb := '[]'::jsonb; v_scheduled timestamptz;
begin
  -- A lease retry reuses its scheduled identity. Old unobserved intervals remain unknown coverage.
  for m in select * from operations_monitors om where exists(select 1 from operations_check_slots os where os.monitor_id=om.id and os.finished_at is null and os.lease_until<now()) order by next_due_at limit least(greatest(p_limit,1),8) for update skip locked loop
    select * into s from operations_check_slots where monitor_id=m.id and finished_at is null and lease_until<now() order by scheduled_at limit 1 for update skip locked;
    if found then
      update operations_check_slots set lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds' where id=s.id returning * into s;
      jobs := jobs || jsonb_build_array(jsonb_build_object('slot',to_jsonb(s),'monitor',to_jsonb(m)));
    end if;
  end loop;
  for m in select * from operations_monitors om where next_due_at<=now() and not exists(select 1 from operations_check_slots os where os.monitor_id=om.id and os.finished_at is null) order by next_due_at limit greatest(0,least(greatest(p_limit,1),8)-jsonb_array_length(jobs)) for update skip locked loop
    v_scheduled := m.next_due_at + make_interval(secs=>floor(extract(epoch from(now()-m.next_due_at))/m.interval_seconds)*m.interval_seconds);
    insert into operations_check_slots(monitor_id,workspace_id,scheduled_at,duration_seconds,monitor_revision,lease_until)
    values(m.id,m.workspace_id,v_scheduled,m.interval_seconds,m.revision,now()+interval '90 seconds') returning * into s;
    update operations_monitors set next_due_at=v_scheduled+make_interval(secs=>m.interval_seconds) where id=m.id;
    jobs := jobs || jsonb_build_array(jsonb_build_object('slot',to_jsonb(s),'monitor',to_jsonb(m)));
  end loop;
  return jobs;
end $$;

create function public.operations_finish_check(p_slot uuid,p_lease uuid,p_result jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare s operations_check_slots; m operations_monitors; v_incident uuid; v_kind text; v_outcome text;
begin
  -- Lock the monitor before its slot consistently with monitor configuration updates.
  select om.* into m from operations_monitors om join operations_check_slots os on os.monitor_id=om.id where os.id=p_slot for update of om;
  if not found then return false; end if;
  select * into s from operations_check_slots where id=p_slot for update;
  if s.finished_at is not null or s.lease_token<>p_lease then return false; end if;
  v_outcome := p_result->>'outcome';
  if now() > s.scheduled_at + make_interval(secs=>s.duration_seconds) + m.timeout_ms * interval '1 millisecond' then v_outcome := 'unknown'; end if;
  if m.revision<>s.monitor_revision then v_outcome := 'unknown'; end if;
  if not m.active then v_outcome := 'paused'; elsif m.maintenance then v_outcome := 'maintenance'; end if;
  update operations_check_slots set finished_at=now(),checked_at=now(),outcome=v_outcome,
    http_status=(p_result->>'http_status')::integer,response_ms=(p_result->>'response_ms')::integer,
    tls_expires_at=(p_result->>'tls_expires_at')::timestamptz,tls_valid=(p_result->>'tls_valid')::boolean,error_code=left(p_result->>'error_code',80) where id=s.id;
  if m.watermark is null or s.scheduled_at > m.watermark then
    if m.watermark is null or s.scheduled_at-m.watermark > make_interval(secs=>m.interval_seconds*1.5) then m.consecutive_failures:=0; m.consecutive_successes:=0; end if;
    if v_outcome in ('maintenance','paused','unknown') then m.consecutive_failures:=0; m.consecutive_successes:=0;
    elsif v_outcome='healthy' then m.consecutive_successes:=m.consecutive_successes+1; m.consecutive_failures:=0;
    else m.consecutive_failures:=m.consecutive_failures+1; m.consecutive_successes:=0; end if;
    select id into v_incident from operations_incidents where monitor_id=m.id and recovered_at is null;
    if v_outcome in ('failed','blocked') and m.consecutive_failures>=m.failure_threshold and v_incident is null then
      insert into operations_incidents(workspace_id,monitor_id,opened_at) values(m.workspace_id,m.id,s.scheduled_at) returning id into v_incident; v_kind:='open';
    elsif v_outcome='healthy' and m.consecutive_successes>=m.recovery_threshold and v_incident is not null then
      update operations_incidents set recovered_at=s.scheduled_at where id=v_incident; v_kind:='recovery';
    end if;
    update operations_monitors set state=case when v_outcome='healthy' and v_incident is not null and v_kind is distinct from 'recovery' then 'recovering' else v_outcome end,
      last_checked_at=now(),watermark=s.scheduled_at,consecutive_failures=m.consecutive_failures,consecutive_successes=m.consecutive_successes,
      active=case when v_outcome='blocked' then false else active end,
      disabled_reason=case when v_outcome='blocked' then 'TARGET_BLOCKED' else disabled_reason end where id=m.id;
    if v_kind is not null then
      insert into operations_notifications(workspace_id,incident_id,kind,recipient_id)
      select m.workspace_id,v_incident,v_kind,user_id from tools_workspace_members where workspace_id=m.workspace_id
      union select m.workspace_id,v_incident,v_kind,owner_id from tools_workspaces where id=m.workspace_id
      on conflict(incident_id,kind,recipient_id) do nothing;
    end if;
  end if;
  return true;
end $$;

do $$ declare t text; begin
  foreach t in array array['tools_services','tools_environments','operations_deployments','operations_rollbacks','operations_monitors','operations_check_slots','operations_incidents','operations_notifications'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
revoke execute on function public.operations_claim_checks(integer),public.operations_finish_check(uuid,uuid,jsonb),public.operations_monitor_limit() from public, anon, authenticated;
grant execute on function public.operations_claim_checks(integer),public.operations_finish_check(uuid,uuid,jsonb) to service_role;
commit;
