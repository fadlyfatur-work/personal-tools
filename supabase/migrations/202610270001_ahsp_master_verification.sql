begin;

alter table public.ahsp_items
  add column if not exists verification_status text not null default 'needs_review' check (verification_status in ('verified','needs_review')),
  add column if not exists verification_notes jsonb not null default '[]' check (jsonb_typeof(verification_notes) = 'array'),
  add column if not exists analysis_origin text not null default 'pdf' check (analysis_origin in ('pdf','sipasti')),
  add column if not exists master_provenance jsonb;

-- JSON SIPASTI is a separate analysis source; it does not invent PDF page references.
do $$
declare constraint_name text;
begin
  for constraint_name in select conname from pg_constraint
    where conrelid = 'public.ahsp_items'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%analysis_status%'
      and pg_get_constraintdef(oid) like '%source_id%'
      and pg_get_constraintdef(oid) like '%jsonb_array_length%'
  loop execute format('alter table public.ahsp_items drop constraint %I', constraint_name); end loop;
end $$;
alter table public.ahsp_items add constraint ahsp_analysis_source_complete check (
  analysis_status <> 'extracted' or (jsonb_array_length(components) > 0 and (
    (analysis_origin = 'pdf' and source_id is not null and page_from is not null) or
    (analysis_origin = 'sipasti' and master_provenance->>'source_sha256' ~ '^[a-f0-9]{64}$'
      and verification_status = 'verified')
  ))
);
create index if not exists ahsp_items_verification on public.ahsp_items(regulation,verification_status);

create table if not exists public.ahsp_master_runs (
  id text primary key check (id ~ '^[a-f0-9]{64}$'), source_sha256 text not null,
  source_name text not null, snapshot_sha256 text not null,
  summary jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.ahsp_master_changes (
  run_id text not null references public.ahsp_master_runs(id),
  item_id uuid not null references public.ahsp_items(id),
  before_row jsonb not null, after_row jsonb not null,
  applied_at timestamptz not null default now(), primary key(run_id,item_id)
);
alter table public.ahsp_master_runs enable row level security;
alter table public.ahsp_master_changes enable row level security;
revoke all on public.ahsp_master_runs, public.ahsp_master_changes from public, anon, authenticated;
grant all on public.ahsp_master_runs, public.ahsp_master_changes to service_role;

create or replace function public.ahsp_apply_master_batch(p_run jsonb, p_changes jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare change jsonb; current_row jsonb; next_row jsonb; prior jsonb; changed integer := 0; skipped integer := 0;
begin
  if p_run->>'id' is null or p_run->>'id' !~ '^[a-f0-9]{64}$'
    or p_run->>'source_sha256' is null or p_run->>'source_sha256' !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes) not between 1 and 50
    then raise exception 'Payload rekonsiliasi master tidak valid'; end if;
  if (select count(distinct c->>'id') from jsonb_array_elements(p_changes) c) <> jsonb_array_length(p_changes)
    then raise exception 'Identitas katalog ganda dalam batch'; end if;
  insert into ahsp_master_runs(id,source_sha256,source_name,snapshot_sha256,summary)
    values(p_run->>'id',p_run->>'source_sha256',p_run->>'source_name',p_run->>'snapshot_sha256',p_run->'summary')
    on conflict(id) do nothing;
  if exists (select 1 from ahsp_master_runs where id=p_run->>'id' and
      (source_sha256 is distinct from p_run->>'source_sha256' or snapshot_sha256 is distinct from p_run->>'snapshot_sha256'))
    then raise exception 'Run berbeda dari snapshot sumber'; end if;
  for change in select value from jsonb_array_elements(p_changes) order by value->>'id' loop
    select to_jsonb(i) into current_row from ahsp_items i where id=(change->>'id')::uuid for update;
    if current_row is null then raise exception 'Item katalog tidak ditemukan'; end if;
    select after_row into prior from ahsp_master_changes where run_id=p_run->>'id' and item_id=(change->>'id')::uuid;
    if prior is not null then
      if current_row is distinct from prior then raise exception 'Item berubah sesudah rekonsiliasi; jangan timpa'; end if;
      skipped := skipped+1; continue;
    end if;
    if jsonb_typeof(change->'before') is distinct from 'object' or not (current_row @> (change->'before'))
      then raise exception 'Katalog berubah sejak snapshot; ulangi audit'; end if;
    if change->>'verification_status' is null or change->>'verification_status' not in ('verified','needs_review')
      or jsonb_typeof(change->'verification_notes') is distinct from 'array'
      or (change->>'verification_status'='verified' and jsonb_array_length(change->'verification_notes')>0)
      then raise exception 'Status atau alasan verifikasi tidak valid'; end if;
    if change->>'verification_status'='verified' and not coalesce((change->>'matched')::boolean,false)
      then raise exception 'Verified membutuhkan pasangan identitas'; end if;
    update ahsp_items set
      verification_status=change->>'verification_status', verification_notes=change->'verification_notes',
      components=case when jsonb_typeof(change->'components')='array' then change->'components' else components end,
      analysis_origin=case when jsonb_typeof(change->'components')='array' and field<>'SMKK' then 'sipasti' else analysis_origin end,
      analysis_status=change->>'analysis_status',
      master_provenance=jsonb_build_object('run_id',p_run->>'id','source_sha256',p_run->>'source_sha256',
        'source_name',p_run->>'source_name','source_rows',change->'source_rows','source_job_ids',change->'source_job_ids',
        'differences',change->'differences','matched',change->'matched','checked_at',now()),
      analysis_target_id=case when jsonb_typeof(change->'components')='array' and jsonb_array_length(change->'components')>0 then null else analysis_target_id end,
      analysis_reference=case when jsonb_typeof(change->'components')='array' and jsonb_array_length(change->'components')>0 then null else analysis_reference end
      where id=(change->>'id')::uuid returning to_jsonb(ahsp_items.*) into next_row;
    insert into ahsp_master_changes(run_id,item_id,before_row,after_row)
      values(p_run->>'id',(change->>'id')::uuid,current_row,next_row);
    changed := changed+1;
  end loop;
  return jsonb_build_object('changed',changed,'skipped',skipped);
end;
$$;
revoke all on function public.ahsp_apply_master_batch(jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.ahsp_apply_master_batch(jsonb,jsonb) to service_role;

-- Keep the existing search signature and grouped pagination, but use the two verification states.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.ahsp_search_items(text[],integer,text,text,text,text,text,text,text,text)'::regprocedure) into definition;
  definition := replace(definition, '(p_sipasti = '''' or sipasti_status = p_sipasti)',
    '(p_sipasti = '''' or id in (select v.id from public.ahsp_items v where v.verification_status = p_sipasti))');
  execute definition;
end $$;
notify pgrst, 'reload schema';
commit;
