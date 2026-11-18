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
  insert into report_daily(date,revision,document,summary) values(p_date,1,p_document,p_summary)
  on conflict(date) do update set revision=report_daily.revision+1,document=excluded.document,summary=excluded.summary,updated_at=now()
  returning * into v;
  insert into report_changes(report_date,revision,actor_role,source,reason,changed_provinces)
    values(p_date,v.revision,p_actor_role,p_source,coalesce(p_reason,''),p_changed);
  return jsonb_build_object('date',v.date,'revision',v.revision,'document',v.document,'created_at',v.created_at,'updated_at',v.updated_at);
end $$;
