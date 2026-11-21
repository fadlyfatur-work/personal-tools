begin;

-- Preserve SIPASTI's explicit labor-hour spelling for manually verified rows too.
create or replace function public.ahsp_validate_mptk_component(c jsonb, p_origin text)
returns jsonb language sql immutable security invoker set search_path = public as $$
  select case when p_origin in ('sipasti','manual') and c->>'group'='tenaga' and public.ahsp_name_key(c->>'unit')='jam'
    then public.ahsp_validate_mptk_component(c || jsonb_build_object('unit','OJ'))
      || jsonb_build_object('unit',c->>'unit')
    else public.ahsp_validate_mptk_component(c) end;
$$;
revoke all on function public.ahsp_validate_mptk_component(jsonb,text) from public, anon, authenticated;
grant execute on function public.ahsp_validate_mptk_component(jsonb,text) to service_role;

alter table public.ahsp_items
  drop constraint if exists ahsp_items_analysis_origin_check,
  drop constraint if exists ahsp_analysis_source_complete;

alter table public.ahsp_items
  add constraint ahsp_items_analysis_origin_check
    check (analysis_origin in ('pdf','sipasti','manual')),
  add constraint ahsp_analysis_source_complete check (
    analysis_status <> 'extracted' or (jsonb_array_length(components) > 0 and (
      (analysis_origin = 'pdf' and source_id is not null and page_from is not null) or
      (analysis_origin = 'sipasti' and master_provenance->>'source_sha256' ~ '^[a-f0-9]{64}$'
        and verification_status = 'verified') or
      (analysis_origin = 'manual' and master_provenance->>'submission_id' ~ '^[0-9a-f-]{36}$'
        and verification_status = 'verified')
    ))
  );

create table if not exists public.ahsp_analysis_submissions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.ahsp_items(id),
  base_snapshot jsonb not null check (jsonb_typeof(base_snapshot) = 'object'),
  components jsonb not null check (jsonb_typeof(components) = 'array' and jsonb_array_length(components) between 1 and 250),
  source_reference text not null check (length(btrim(source_reference)) between 1 and 500),
  status text not null default 'pending' check (status in ('pending','approved','rejected','superseded')),
  review_note text not null default '' check (length(review_note) <= 1000),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check ((status = 'pending' and reviewed_at is null) or (status <> 'pending' and reviewed_at is not null))
);
create unique index if not exists ahsp_analysis_one_pending_per_item
  on public.ahsp_analysis_submissions(item_id) where status = 'pending';
create index if not exists ahsp_analysis_submissions_queue
  on public.ahsp_analysis_submissions(submitted_at desc) where status = 'pending';

create table if not exists public.ahsp_approval_pin_limits (
  source_hash text primary key check (source_hash ~ '^[a-f0-9]{64}$'),
  failures integer not null default 0 check (failures between 0 and 5),
  window_started_at timestamptz not null default now(),
  locked_until timestamptz
);

alter table public.ahsp_analysis_submissions enable row level security;
alter table public.ahsp_approval_pin_limits enable row level security;
revoke all on public.ahsp_analysis_submissions, public.ahsp_approval_pin_limits from public, anon, authenticated;
grant all on public.ahsp_analysis_submissions, public.ahsp_approval_pin_limits to service_role;

create or replace function public.ahsp_record_approval_pin_failure(p_source_hash text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare result public.ahsp_approval_pin_limits%rowtype;
begin
  if p_source_hash is null or p_source_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Sumber permintaan tidak valid';
  end if;
  insert into public.ahsp_approval_pin_limits(source_hash, failures, window_started_at, locked_until)
    values (p_source_hash, 1, now(), null)
  on conflict (source_hash) do update set
    failures = case
      when ahsp_approval_pin_limits.window_started_at < now() - interval '15 minutes'
        or ahsp_approval_pin_limits.locked_until <= now() then 1
      else least(5, ahsp_approval_pin_limits.failures + 1)
    end,
    window_started_at = case
      when ahsp_approval_pin_limits.window_started_at < now() - interval '15 minutes'
        or ahsp_approval_pin_limits.locked_until <= now() then now()
      else ahsp_approval_pin_limits.window_started_at
    end,
    locked_until = case
      when ahsp_approval_pin_limits.window_started_at < now() - interval '15 minutes'
        or ahsp_approval_pin_limits.locked_until <= now() then null
      when ahsp_approval_pin_limits.failures >= 4 then now() + interval '15 minutes'
      else ahsp_approval_pin_limits.locked_until
    end
  returning * into result;
  return jsonb_build_object('failures', result.failures, 'locked_until', result.locked_until);
end;
$$;
revoke all on function public.ahsp_record_approval_pin_failure(text) from public, anon, authenticated;
grant execute on function public.ahsp_record_approval_pin_failure(text) to service_role;

create or replace function public.ahsp_review_analysis_submission(
  p_submission_id uuid, p_action text, p_review_note text default '', p_confirm_identity boolean default false
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  submission public.ahsp_analysis_submissions%rowtype;
  item public.ahsp_items%rowtype;
  component jsonb;
  validated jsonb;
  normalized jsonb := '[]'::jsonb;
  coefficient jsonb;
  expression text;
  component_count integer := 0;
begin
  if p_action not in ('approve','reject') or length(coalesce(p_review_note,'')) > 1000 then
    raise exception 'Keputusan approval tidak valid';
  end if;
  if p_action = 'approve' and p_confirm_identity is not true then
    raise exception 'Konfirmasi identitas dan regulasi wajib';
  end if;
  if p_action = 'reject' and length(btrim(coalesce(p_review_note,''))) < 3 then
    raise exception 'Alasan penolakan wajib diisi';
  end if;

  select * into submission from public.ahsp_analysis_submissions where id = p_submission_id for update;
  if not found then raise exception 'Usulan tidak ditemukan'; end if;
  if submission.status <> 'pending' then raise exception 'Usulan tidak lagi menunggu approval'; end if;
  select * into item from public.ahsp_items where id = submission.item_id for update;
  if not found then raise exception 'Item katalog tidak ditemukan'; end if;
  if item.verification_status <> 'needs_review' or item.field = 'SMKK' then
    raise exception 'Item tidak lagi memenuhi syarat pengajuan';
  end if;
  if p_action = 'approve' and (submission.base_snapshot->>'code' is distinct from item.code
    or submission.base_snapshot->>'name' is distinct from item.name
    or submission.base_snapshot->>'unit' is distinct from item.unit
    or submission.base_snapshot->>'field' is distinct from item.field
    or submission.base_snapshot->>'regulation' is distinct from item.regulation
    or submission.base_snapshot->'components' is distinct from to_jsonb(item.components)
    or submission.base_snapshot->>'analysis_status' is distinct from item.analysis_status) then
    raise exception 'Item berubah sejak usulan dibuat; muat ulang dan ajukan kembali';
  end if;

  if p_action = 'reject' then
    update public.ahsp_analysis_submissions
      set status = 'rejected', review_note = btrim(p_review_note), reviewed_at = now()
      where id = p_submission_id;
    return jsonb_build_object('status','rejected','item_id',item.id);
  end if;

  for component in select value from jsonb_array_elements(submission.components) loop
    component_count := component_count + 1;
    if coalesce(component->>'group','') not in ('tenaga','bahan','alat')
      or length(btrim(coalesce(component->>'name',''))) not between 1 and 240
      or length(btrim(coalesce(component->>'unit',''))) not between 1 and 40
      or length(btrim(coalesce(component->>'code',''))) > 120
      or length(btrim(coalesce(component->>'expression',''))) > 500 then
      raise exception 'Identitas komponen % tidak lengkap atau terlalu panjang', component_count;
    end if;

    coefficient := component->'coefficient';
    if coefficient is not null and jsonb_typeof(coefficient) not in ('number','null') then
      raise exception 'Koefisien komponen % harus berupa angka', component_count;
    end if;
    if jsonb_typeof(coefficient) = 'number' and (coefficient #>> '{}')::numeric < 0 then
      raise exception 'Koefisien komponen % tidak boleh negatif', component_count;
    end if;
    expression := btrim(coalesce(component->>'expression',''));
    if expression = '0' then expression := ''; end if;
    if (coefficient is null or jsonb_typeof(coefficient) = 'null') and expression = '' then
      raise exception 'Komponen % memerlukan koefisien atau rumus', component_count;
    end if;

    validated := public.ahsp_validate_mptk_component(jsonb_build_object(
      'group', component->>'group', 'name', btrim(component->>'name'),
      'code', btrim(coalesce(component->>'code','')), 'unit', btrim(component->>'unit'),
      'coefficient', coefficient, 'expression', expression, 'sourceLine', submission.source_reference
    ));
    if validated->'validation_issues' <> '[]'::jsonb then
      raise exception 'Kelompok atau satuan komponen % perlu diperbaiki', component_count;
    end if;
    normalized := normalized || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text, 'group', component->>'group',
      'name', btrim(component->>'name'), 'code', btrim(coalesce(component->>'code','')),
      'unit', btrim(component->>'unit'),
      'coefficient', case when coefficient is null then 'null'::jsonb else coefficient end,
      'expression', expression, 'sourceLine', submission.source_reference
    ));
  end loop;
  if component_count = 0 then raise exception 'Analisis perlu memiliki komponen'; end if;

  update public.ahsp_items set
    components = normalized,
    analysis_status = 'extracted',
    analysis_origin = 'manual',
    verification_status = 'verified',
    verification_notes = '[]'::jsonb,
    master_provenance = jsonb_build_object(
      'submission_id', submission.id, 'source_name', 'Usulan pengguna',
      'source_reference', submission.source_reference, 'checked_at', now(),
      'matched', true, 'differences', '[]'::jsonb
    ),
    analysis_target_id = null,
    analysis_reference = null
  where id = item.id;

  update public.ahsp_analysis_submissions
    set status = 'approved', review_note = btrim(coalesce(p_review_note,'')), reviewed_at = now()
    where id = p_submission_id;
  update public.ahsp_analysis_submissions
    set status = 'superseded', review_note = 'Usulan lain untuk item ini telah disetujui.', reviewed_at = now()
    where item_id = item.id and status = 'pending' and id <> p_submission_id;
  return jsonb_build_object('status','approved','item_id',item.id,'component_count',component_count);
end;
$$;
revoke all on function public.ahsp_review_analysis_submission(uuid,text,text,boolean) from public, anon, authenticated;
grant execute on function public.ahsp_review_analysis_submission(uuid,text,text,boolean) to service_role;

create or replace view public.ahsp_mptk_validation with (security_invoker = true) as
  select i.id as item_id, c.ordinality as position, i.field, i.regulation, validated.component
  from public.ahsp_items i
  cross join lateral jsonb_array_elements(i.components) with ordinality c(value,ordinality)
  cross join lateral (
    select public.ahsp_validate_mptk_component(c.value - 'variables',i.analysis_origin) as component
    offset 0
  ) validated
  where i.regulation in ('SE 47/2026','PERMEN 08/2023','SE 182/2025','SPTJM')
    and c.value->>'group' in ('tenaga','bahan','alat');
revoke all on public.ahsp_mptk_validation from public, anon, authenticated;
grant select on public.ahsp_mptk_validation to service_role;

create or replace view public.ahsp_mptk_occurrences with (security_invoker = true) as
  select md5(jsonb_build_array(c.component->>'group', public.ahsp_name_key(c.component->>'name'),
      public.ahsp_unit_key(c.component->>'unit'))::text) as component_key,
    c.component->>'group' as component_group, c.component->>'name' as name,
    coalesce(c.component->>'code','') as code, c.component->>'unit' as unit,
    c.component->'coefficient' as coefficient, coalesce(c.component->>'expression','') as expression,
    c.position, i.id as item_id, i.code as item_code, i.name as item_name,
    i.unit as item_unit, i.output_quantity, i.field, i.division, i.regulation,
    i.analysis_status, i.source_id, i.page_from, i.page_to,
    c.component->>'original_group' as original_group,
    c.component->>'original_name' as original_name,
    (c.component->>'category_corrected')::boolean as category_corrected
  from public.ahsp_mptk_validation c
  join public.ahsp_items i on i.id = c.item_id
  where i.regulation in ('SE 47/2026','PERMEN 08/2023','SE 182/2025','SPTJM')
    and c.component->>'group' in ('tenaga','bahan','alat')
    and c.component->'validation_issues' = '[]'::jsonb
    and public.ahsp_name_key(c.component->>'name') <> ''
    and public.ahsp_unit_key(c.component->>'unit') <> '';
revoke all on public.ahsp_mptk_occurrences from public, anon, authenticated;
grant select on public.ahsp_mptk_occurrences to service_role;

notify pgrst, 'reload schema';
commit;
