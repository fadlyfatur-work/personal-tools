begin;

create table if not exists public.ahsp_sipasti_imports (
  sha256 text primary key check (sha256 ~ '^[a-f0-9]{64}$'),
  source_name text not null,
  source_rows jsonb not null check (jsonb_typeof(source_rows) = 'array'),
  imported_at timestamptz not null default now()
);
alter table public.ahsp_sipasti_imports enable row level security;
revoke all on public.ahsp_sipasti_imports from public, anon, authenticated;
grant all on public.ahsp_sipasti_imports to service_role;

alter table public.ahsp_items
  add column if not exists sipasti_status text check (sipasti_status in ('database_only', 'sipasti_only', 'both')),
  add column if not exists sipasti_origin boolean not null default false,
  add column if not exists sipasti_sha256 text references public.ahsp_sipasti_imports(sha256),
  add column if not exists sipasti_rows integer[] not null default '{}';
create index if not exists ahsp_items_sipasti_status on public.ahsp_items(regulation, sipasti_status);

create or replace function public.ahsp_reconcile_sipasti(
  p_sha256 text, p_source_name text, p_source_rows jsonb, p_changes jsonb
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  expected_existing integer;
  actual_existing integer;
  added integer;
begin
  if p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_source_rows) is distinct from 'array'
    or jsonb_typeof(p_changes) is distinct from 'array'
    or jsonb_array_length(p_source_rows) = 0 or jsonb_array_length(p_changes) = 0 then
    raise exception 'Payload rekonsiliasi tidak valid';
  end if;
  lock table public.ahsp_items in share row exclusive mode;
  if exists (select 1 from jsonb_array_elements(p_changes) c
    where c->>'status' is null or c->>'status' not in ('both', 'database_only', 'sipasti_only')
      or jsonb_typeof(c->'rows') is distinct from 'array'
      or (c->>'status' = 'database_only') <> (jsonb_array_length(c->'rows') = 0)) then
    raise exception 'Status atau referensi baris tidak valid';
  end if;
  if exists (select 1 from jsonb_array_elements(p_changes) c
    cross join lateral jsonb_array_elements_text(c->'rows') r(value)
    where r.value::integer < 1 or r.value::integer > jsonb_array_length(p_source_rows)) then
    raise exception 'Nomor baris SIPASTI di luar sumber';
  end if;
  if (select count(distinct c->>'id') from jsonb_array_elements(p_changes) c) <> jsonb_array_length(p_changes) then
    raise exception 'Identitas item ganda';
  end if;
  select count(*) into expected_existing from jsonb_array_elements(p_changes) c where c->'item' is null;
  select count(*) into actual_existing from ahsp_items where regulation in ('SE 47/2026', 'PERMEN 08/2023');
  if actual_existing <> expected_existing or exists (
    select 1 from jsonb_array_elements(p_changes) c left join ahsp_items i on i.id = (c->>'id')::uuid
    where (c->'item' is null and (i.id is null or i.code is distinct from c->>'code'
      or i.name is distinct from c->>'name' or i.field is distinct from c->>'field'
      or i.regulation is distinct from c->>'regulation'))
      or (c->'item' is not null and i.id is not null)
  ) then raise exception 'Katalog berubah sejak snapshot; ulangi rekonsiliasi'; end if;

  insert into ahsp_sipasti_imports(sha256, source_name, source_rows)
    values(p_sha256, p_source_name, p_source_rows)
    on conflict(sha256) do update set imported_at = now();
  update ahsp_items i set sipasti_status = c->>'status', sipasti_sha256 = p_sha256,
    sipasti_rows = array(select value::integer from jsonb_array_elements_text(c->'rows'))
    from jsonb_array_elements(p_changes) c where i.id = (c->>'id')::uuid;
  insert into ahsp_items(id, code, name, unit, field, division, regulation, ahsp_type,
    analysis_status, reconciliation_status, sipasti_origin, sipasti_status, sipasti_sha256, sipasti_rows)
    select (c->>'id')::uuid, c->>'code', c->>'name', c->'item'->>'unit', c->>'field', '', c->>'regulation',
      c->'item'->>'ahsp_type', 'unavailable', 'belum_ditemukan', true, 'sipasti_only', p_sha256,
      array(select value::integer from jsonb_array_elements_text(c->'rows'))
    from jsonb_array_elements(p_changes) c where c->'item' is not null;
  get diagnostics added = row_count;
  return jsonb_build_object('updated', expected_existing, 'added', added, 'total', expected_existing + added);
end;
$$;
revoke all on function public.ahsp_reconcile_sipasti(text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.ahsp_reconcile_sipasti(text, text, jsonb, jsonb) to service_role;

drop function if exists public.ahsp_search_items(text[], integer, text, text, text, text, text, text, text);
create or replace function public.ahsp_search_items(
  p_terms text[] default '{}', p_page integer default 1,
  p_field text default '', p_division text default '', p_unit text default '',
  p_regulation text default '', p_analysis text default '', p_scope text default 'all', p_match text default 'like',
  p_sipasti text default ''
) returns jsonb language sql stable security invoker set search_path = public as $$
  with terms as (
    select btrim(term) as term, ordinal
    from unnest(coalesce(p_terms, '{}'::text[])) with ordinality t(term, ordinal)
    where btrim(term) <> ''
  ), candidates as materialized (
    select i.id, i.code, i.name, i.unit, i.field, i.division, i.regulation, i.ahsp_type,
      i.analysis_status, i.source_id, i.page_from, i.page_to, i.sipasti_status, i.components from ahsp_items i
    where i.regulation in ('SE 47/2026', 'PERMEN 08/2023')
      and (p_field = '' or i.field = p_field)
      and (p_division = '' or i.division = p_division)
      and (p_unit = '' or i.unit = p_unit)
      and (p_regulation = '' or i.regulation = p_regulation)
      and (p_analysis = '' or i.analysis_status = p_analysis)
      and (p_sipasti = '' or i.sipasti_status = p_sipasti)
  ), term_hits as materialized (
    select i.id, t.term, t.ordinal,
      ((p_scope <> 'components' and (ahsp_term_matches(i.name, t.term, 'exact') or ahsp_term_matches(i.code, t.term, 'exact')))
        or (p_scope <> 'jobs' and exists (select 1 from jsonb_array_elements(i.components) c
          where ahsp_term_matches(c->>'name', t.term, 'exact') or ahsp_term_matches(c->>'code', t.term, 'exact')))) as exact_hit,
      ((p_scope <> 'components' and (ahsp_term_matches(i.name, t.term, 'like') or ahsp_term_matches(i.code, t.term, 'like')))
        or (p_scope <> 'jobs' and exists (select 1 from jsonb_array_elements(i.components) c
          where ahsp_term_matches(c->>'name', t.term, 'like') or ahsp_term_matches(c->>'code', t.term, 'like')))) as like_hit
    from candidates i cross join terms t
  ), term_counts as (
    select t.term, t.ordinal,
      count(h.id) filter (where h.exact_hit) as exact_count,
      count(h.id) filter (where h.like_hit) as like_count
    from terms t left join term_hits h on h.ordinal = t.ordinal
    group by t.term, t.ordinal
  ), item_hits as materialized (
    select id, bool_or(exact_hit) as exact_hit, bool_or(like_hit) as like_hit
    from term_hits group by id
  ), matched as materialized (
    select i.id, i.code, i.name, i.unit, i.field, i.division, i.regulation,
      i.ahsp_type, i.analysis_status, i.source_id, i.page_from, i.page_to, i.sipasti_status
    from candidates i left join item_hits h on h.id = i.id
    where not exists (select 1 from terms)
      or case when p_match = 'exact' then h.exact_hit else h.like_hit end
  ), page_items as (
    select * from matched order by code, id limit 30 offset (greatest(p_page, 1) - 1) * 30
  ), page_results as (
    select i.*,
      case when p_scope = 'components' or not exists (select 1 from terms t
        where ahsp_term_matches(i.name, t.term, p_match) or ahsp_term_matches(i.code, t.term, p_match))
      then coalesce((select jsonb_agg(distinct c->>'name') from jsonb_array_elements(source.components) c
        where exists (select 1 from terms t
          where ahsp_term_matches(c->>'name', t.term, p_match) or ahsp_term_matches(c->>'code', t.term, p_match))), '[]'::jsonb)
      else '[]'::jsonb end as matched_components
    from page_items i join candidates source on source.id = i.id
  ) select jsonb_build_object(
    'total', (select count(*) from matched),
    'items', coalesce((select jsonb_agg(r order by code, id) from page_results r), '[]'::jsonb),
    'pageSize', 30,
    'search_stats', jsonb_build_object(
      'input_count', (select count(*) from terms),
      'found_terms', (select count(*) from term_counts where case when p_match = 'exact' then exact_count > 0 else like_count > 0 end),
      'exact_found_terms', (select count(*) from term_counts where exact_count > 0),
      'like_found_terms', (select count(*) from term_counts where like_count > 0),
      'exact_total', (select count(*) from item_hits where exact_hit),
      'like_total', (select count(*) from item_hits where like_hit),
      'filtered_catalog_total', (select count(*) from candidates),
      'catalog_total', (select count(*) from ahsp_items where regulation in ('SE 47/2026', 'PERMEN 08/2023')),
      'terms', coalesce((select jsonb_agg(t order by ordinal) from term_counts t), '[]'::jsonb)
    ),
    'matched_types', coalesce((select jsonb_agg(t order by type) from (
      select ahsp_type as type, count(*) as count from matched group by ahsp_type
    ) t), '[]'::jsonb),
    'catalog_types', coalesce((select jsonb_agg(t order by type) from (
      select ahsp_type as type, count(*) as count from ahsp_items
      where regulation in ('SE 47/2026', 'PERMEN 08/2023') group by ahsp_type
    ) t), '[]'::jsonb)
  );
$$;
revoke all on function public.ahsp_search_items(text[], integer, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ahsp_search_items(text[], integer, text, text, text, text, text, text, text, text) to service_role;
notify pgrst, 'reload schema';
commit;
