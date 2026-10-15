begin;

create or replace function public.ahsp_name_key(p_name text)
returns text language sql immutable security invoker as $$
  select pg_catalog.lower(pg_catalog.btrim(pg_catalog.regexp_replace(
    normalize(coalesce(p_name, ''), NFKC), '[[:space:]]+', ' ', 'g')));
$$;
create or replace function public.ahsp_unit_key(p_unit text)
returns text language sql immutable security invoker as $$
  select case when public.ahsp_name_key(p_unit) in ('bh', 'bh.', 'buah') then 'buah'
    else public.ahsp_name_key(p_unit) end;
$$;
revoke all on function public.ahsp_name_key(text), public.ahsp_unit_key(text) from public, anon, authenticated;
grant execute on function public.ahsp_name_key(text), public.ahsp_unit_key(text) to service_role;
create index if not exists ahsp_items_name_key on public.ahsp_items(public.ahsp_name_key(name));

create or replace view public.ahsp_catalog_versions with (security_invoker = true) as
  select i.id, i.code, i.name, i.unit, i.field, i.division, i.regulation, i.ahsp_type,
    i.analysis_status, i.source_id, i.page_from, i.page_to, i.sipasti_status, i.components, i.reconciliation_status,
    public.ahsp_name_key(i.name) as name_key,
    case i.regulation when 'SE 47/2026' then 0 when 'PERMEN 08/2023' then 1 else 2 end as regulation_rank,
    case i.analysis_status when 'extracted' then 0 when 'needs_review' then 1 else 2 end as analysis_rank,
    case when i.source_id is not null then 0 else 1 end as source_rank,
    case when i.code <> '' then 0 else 1 end as code_rank
  from public.ahsp_items i where i.regulation in ('SE 47/2026', 'PERMEN 08/2023', 'SE 182/2025');
revoke all on public.ahsp_catalog_versions from public, anon, authenticated;
grant select on public.ahsp_catalog_versions to service_role;

create or replace function public.ahsp_catalog_options()
returns jsonb language sql stable security invoker set search_path = public as $$
  with catalog as materialized (select * from ahsp_catalog_versions), ranked as (
    select c.*, row_number() over (partition by name_key order by regulation_rank, analysis_rank, source_rank, code_rank, code, id) as choice
    from catalog c
  ), preferred as (select * from ranked where choice = 1)
  select jsonb_build_object(
    'grouped_by_name', true,
    'total', (select count(*) from preferred),
    'version_total', (select count(*) from catalog),
    'fields', coalesce((select jsonb_agg(field order by field) from (select distinct field from catalog) f), '[]'::jsonb),
    'field_counts', coalesce((select jsonb_agg(f order by field) from (
      select field, count(distinct name_key) as count from catalog group by field
    ) f), '[]'::jsonb),
    'divisions', coalesce((select jsonb_agg(d order by field, division) from (select distinct field, division from catalog where division <> '') d), '[]'::jsonb),
    'units', coalesce((select jsonb_agg(unit order by unit) from (
      select distinct case when ahsp_unit_key(unit) = 'buah' then 'Buah' else unit end as unit from catalog where unit <> ''
    ) u), '[]'::jsonb),
    'statuses', coalesce((select jsonb_agg(s) from (select reconciliation_status as status, count(*) as count from preferred group by reconciliation_status) s), '[]'::jsonb),
    'analysis', coalesce((select jsonb_agg(a) from (select analysis_status as status, count(*) as count from preferred group by analysis_status) a), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(s order by annex) from ahsp_sources s), '[]'::jsonb)
  );
$$;
revoke all on function public.ahsp_catalog_options() from public, anon, authenticated;
grant execute on function public.ahsp_catalog_options() to service_role;

create or replace function public.ahsp_search_items(
  p_terms text[] default '{}', p_page integer default 1,
  p_field text default '', p_division text default '', p_unit text default '',
  p_regulation text default '', p_analysis text default '', p_scope text default 'all', p_match text default 'like',
  p_sipasti text default ''
) returns jsonb language sql stable security invoker set search_path = public as $$
  with terms as materialized (
    select min(btrim(term)) as term, min(ordinal) as ordinal, ahsp_name_key(min(btrim(term))) as name_term
    from unnest(coalesce(p_terms, '{}'::text[])) with ordinality t(term, ordinal)
    where btrim(term) <> ''
    group by case when p_match = 'phrases' then ahsp_name_key(term) else ordinal::text end
  ), catalog as materialized (
    select * from ahsp_catalog_versions
  ), candidates as materialized (
    select c.* from catalog c
    where case when p_regulation = '' then regulation in ('SE 47/2026', 'PERMEN 08/2023') else regulation = p_regulation end
      and (p_field = '' or field = p_field)
      and (p_division = '' or division = p_division)
      and (p_unit = '' or ahsp_unit_key(unit) = ahsp_unit_key(p_unit))
      and (p_analysis = '' or analysis_status = p_analysis)
      and (p_sipasti = '' or sipasti_status = p_sipasti)
  ), term_hits as materialized (
    select i.id, i.name_key, t.ordinal,
      case when p_match = 'phrases' then ahsp_term_matches(i.name_key, t.name_term, 'exact') else
        ((p_scope <> 'components' and (ahsp_term_matches(i.name_key, t.name_term, 'exact') or ahsp_term_matches(i.code, t.term, 'exact')))
          or (p_scope <> 'jobs' and exists (select 1 from jsonb_array_elements(i.components) c
            where ahsp_term_matches(c->>'name', t.term, 'exact') or ahsp_term_matches(c->>'code', t.term, 'exact')))) end as exact_hit,
      case when p_match = 'phrases' then ahsp_term_matches(i.name_key, t.name_term, 'like') else
        ((p_scope <> 'components' and (ahsp_term_matches(i.name_key, t.name_term, 'like') or ahsp_term_matches(i.code, t.term, 'like')))
          or (p_scope <> 'jobs' and exists (select 1 from jsonb_array_elements(i.components) c
            where ahsp_term_matches(c->>'name', t.term, 'like') or ahsp_term_matches(c->>'code', t.term, 'like')))) end as like_hit
    from candidates i cross join terms t
  ), item_hits as materialized (
    select id, name_key, bool_or(exact_hit) as exact_hit, bool_or(like_hit) as like_hit,
      case when p_match = 'phrases' then count(*) filter (where like_hit) else 0 end as phrase_hits
    from term_hits group by id, name_key
  ), term_counts as (
    select t.term, t.ordinal,
      count(distinct h.name_key) filter (where h.exact_hit) as exact_count,
      count(distinct h.name_key) filter (where h.like_hit) as like_count
    from terms t left join term_hits h on h.ordinal = t.ordinal
      and (p_match <> 'phrases' or h.id in (select id from item_hits where phrase_hits >= 2))
    group by t.term, t.ordinal
  ), matching_versions as (
    select i.*, case when p_match = 'phrases' then h.phrase_hits else 0 end as matched_phrase_count
    from candidates i left join item_hits h on h.id = i.id
    where (p_match <> 'phrases' and not exists (select 1 from terms))
      or case when p_match = 'phrases' then h.phrase_hits >= 2
        when p_match = 'exact' then h.exact_hit else h.like_hit end
  ), matched as materialized (
    select distinct on (name_key) id, code, name, unit, field, division, regulation, ahsp_type,
      analysis_status, source_id, page_from, page_to, sipasti_status, name_key, matched_phrase_count
    from matching_versions
    order by name_key, regulation_rank, analysis_rank, source_rank, code_rank, code, id
  ), page_items as materialized (
    select * from matched order by matched_phrase_count desc, code, id
    limit 30 offset (greatest(p_page, 1) - 1) * 30
  ), version_groups as (
    select c.name_key, jsonb_agg(jsonb_build_object(
      'id', c.id, 'code', c.code, 'name', c.name, 'unit', c.unit, 'field', c.field, 'division', c.division,
      'regulation', c.regulation, 'ahsp_type', c.ahsp_type, 'analysis_status', c.analysis_status,
      'source_id', c.source_id, 'page_from', c.page_from, 'page_to', c.page_to, 'sipasti_status', c.sipasti_status
    ) order by c.regulation_rank, c.analysis_rank, c.source_rank, c.code_rank, c.code, c.id) as versions
    from catalog c join page_items p on p.name_key = c.name_key group by c.name_key
  ), page_results as (
    select i.*, v.versions,
      case when p_match = 'phrases' then '[]'::jsonb
      when p_scope = 'components' or not exists (select 1 from terms t
        where ahsp_term_matches(i.name_key, t.name_term, p_match) or ahsp_term_matches(i.code, t.term, p_match))
      then coalesce((select jsonb_agg(distinct c->>'name') from jsonb_array_elements(source.components) c
        where exists (select 1 from terms t
          where ahsp_term_matches(c->>'name', t.term, p_match) or ahsp_term_matches(c->>'code', t.term, p_match))), '[]'::jsonb)
      else '[]'::jsonb end as matched_components
    from page_items i join candidates source on source.id = i.id join version_groups v on v.name_key = i.name_key
  ), catalog_preferred as (
    select distinct on (name_key) name_key, ahsp_type from catalog
    order by name_key, regulation_rank, analysis_rank, source_rank, code_rank, code, id
  ) select jsonb_build_object(
    'grouped_by_name', true, 'archive_supported', true,
    'total', (select count(*) from matched),
    'items', coalesce((select jsonb_agg(to_jsonb(r) - 'name_key' order by matched_phrase_count desc, code, id) from page_results r), '[]'::jsonb),
    'pageSize', 30,
    'search_stats', jsonb_build_object(
      'match', p_match,
      'input_count', (select count(*) from terms),
      'found_terms', (select count(*) from term_counts where case when p_match = 'exact' then exact_count > 0 else like_count > 0 end),
      'exact_found_terms', (select count(*) from term_counts where exact_count > 0),
      'like_found_terms', (select count(*) from term_counts where like_count > 0),
      'exact_total', (select count(distinct name_key) from item_hits where exact_hit),
      'like_total', (select count(distinct name_key) from item_hits where case when p_match = 'phrases' then phrase_hits >= 2 else like_hit end),
      'filtered_catalog_total', (select count(distinct name_key) from candidates),
      'catalog_total', (select count(*) from catalog_preferred),
      'terms', coalesce((select jsonb_agg(t order by ordinal) from term_counts t), '[]'::jsonb)
    ),
    'matched_types', coalesce((select jsonb_agg(t order by type) from (
      select ahsp_type as type, count(*) as count from matched group by ahsp_type
    ) t), '[]'::jsonb),
    'catalog_types', coalesce((select jsonb_agg(t order by type) from (
      select ahsp_type as type, count(*) as count from catalog_preferred group by ahsp_type
    ) t), '[]'::jsonb)
  );
$$;
revoke all on function public.ahsp_search_items(text[], integer, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ahsp_search_items(text[], integer, text, text, text, text, text, text, text, text) to service_role;
notify pgrst, 'reload schema';
commit;
