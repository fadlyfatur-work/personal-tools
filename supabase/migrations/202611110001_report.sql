begin;

create table if not exists public.report_access (
  role text primary key check(role in ('admin','user')),
  pin text not null check(pin ~ '^[0-9]{6,12}$'),
  version integer not null default 1 check(version > 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.report_daily (
  date date primary key,
  revision integer not null check(revision > 0),
  document jsonb not null,
  summary jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.report_changes (
  id bigint generated always as identity primary key,
  report_date date not null references public.report_daily(date),
  revision integer not null,
  created_at timestamptz not null default now(),
  actor_role text not null check(actor_role in ('admin','user')),
  source text not null check(source in ('manual','import','seed')),
  reason text not null default '',
  changed_provinces text[] not null default '{}',
  unique(report_date,revision)
);
alter table public.report_access enable row level security;
alter table public.report_daily enable row level security;
alter table public.report_changes enable row level security;
revoke all on public.report_access, public.report_daily, public.report_changes from anon, authenticated;
grant all on public.report_access, public.report_daily, public.report_changes to service_role;
grant usage,select on sequence public.report_changes_id_seq to service_role;

create or replace function public.report_save_daily(
  p_date date, p_revision integer, p_document jsonb, p_summary jsonb,
  p_actor_role text, p_access_version integer, p_source text, p_reason text, p_changed text[]
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.report_daily;
begin
  perform pg_advisory_xact_lock(hashtextextended('report:save',0));
  if not exists(select 1 from report_access where role=p_actor_role and version=p_access_version)
    then raise exception 'REPORT_ACCESS_DENIED'; end if;
  if p_source not in ('manual','import') or p_date<'2026-11-10'::date or p_date>(now() at time zone 'Asia/Jakarta')::date
    then raise exception 'REPORT_INVALID'; end if;
  select * into v from report_daily where date=p_date;
  if coalesce(v.revision,0)<>p_revision then raise exception 'REPORT_CONFLICT'; end if;
  if v.revision is not null and p_date<(now() at time zone 'Asia/Jakarta')::date and length(trim(p_reason))=0
    then raise exception 'REPORT_INVALID'; end if;
  insert into report_daily(date,revision,document,summary) values(p_date,1,p_document,p_summary)
  on conflict(date) do update set revision=report_daily.revision+1,document=excluded.document,summary=excluded.summary,updated_at=now()
  returning * into v;
  insert into report_changes(report_date,revision,actor_role,source,reason,changed_provinces)
    values(p_date,v.revision,p_actor_role,p_source,p_reason,p_changed);
  return jsonb_build_object('date',v.date,'revision',v.revision,'document',v.document,'created_at',v.created_at,'updated_at',v.updated_at);
end $$;
create or replace function public.report_set_pins(p_access_version integer,p_admin_pin text default null,p_user_pin text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_admin text; v_user text; v_version integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('report:save',0));
  if not exists(select 1 from report_access where role='admin' and version=p_access_version)
    then raise exception 'REPORT_ACCESS_DENIED'; end if;
  select coalesce(p_admin_pin,pin) into v_admin from report_access where role='admin';
  select coalesce(p_user_pin,pin) into v_user from report_access where role='user';
  if v_admin is null or v_user is null or v_admin=v_user or v_admin !~ '^[0-9]{6,12}$' or v_user !~ '^[0-9]{6,12}$'
    then raise exception 'REPORT_PIN_INVALID'; end if;
  update report_access set pin=case role when 'admin' then v_admin else v_user end,version=version+1,updated_at=now()
    where pin<>case role when 'admin' then v_admin else v_user end;
  select version into v_version from report_access where role='admin';
  return jsonb_build_object('admin_version',v_version);
end $$;
revoke all on function public.report_save_daily(date,integer,jsonb,jsonb,text,integer,text,text,text[]) from public,anon,authenticated;
revoke all on function public.report_set_pins(integer,text,text) from public,anon,authenticated;
grant execute on function public.report_save_daily(date,integer,jsonb,jsonb,text,integer,text,text,text[]) to service_role;
grant execute on function public.report_set_pins(integer,text,text) to service_role;

commit;
