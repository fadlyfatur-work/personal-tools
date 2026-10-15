begin;

create or replace function public.ahsp_catalog_options()
returns jsonb language sql stable security invoker set search_path = public as $$
  with catalog as materialized (
    select * from ahsp_items where regulation in ('SE 47/2026', 'PERMEN 08/2023', 'SE 182/2025')
  ) select jsonb_build_object(
    'total', (select count(*) from catalog),
    'fields', coalesce((select jsonb_agg(field order by field) from (select distinct field from catalog) f), '[]'::jsonb),
    'divisions', coalesce((select jsonb_agg(d order by field, division) from (select distinct field, division from catalog where division <> '') d), '[]'::jsonb),
    'units', coalesce((select jsonb_agg(unit order by unit) from (select distinct unit from catalog where unit <> '') u), '[]'::jsonb),
    'statuses', coalesce((select jsonb_agg(s) from (select reconciliation_status as status, count(*) as count from catalog group by reconciliation_status) s), '[]'::jsonb),
    'analysis', coalesce((select jsonb_agg(a) from (select analysis_status as status, count(*) as count from catalog group by analysis_status) a), '[]'::jsonb),
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
  with terms as (
    select min(btrim(term)) as term, min(ordinal) as ordinal
    from unnest(coalesce(p_terms, '{}'::text[])) with ordinality t(term, ordinal)
    where btrim(term) <> ''
    group by case when p_match = 'phrases' then lower(btrim(term)) else ordinal::text end
  ), candidates as materialized (
    select i.id, i.code, i.name, i.unit, i.field, i.division, i.regulation, i.ahsp_type,
      i.analysis_status, i.source_id, i.page_from, i.page_to, i.sipasti_status, i.components from ahsp_items i
    where i.regulation in ('SE 47/2026', 'PERMEN 08/2023', 'SE 182/2025')
      and case when p_regulation = '' then i.regulation in ('SE 47/2026', 'PERMEN 08/2023') else i.regulation = p_regulation end
      and (p_field = '' or i.field = p_field)
      and (p_division = '' or i.division = p_division)
      and (p_unit = '' or i.unit = p_unit)
      and (p_analysis = '' or i.analysis_status = p_analysis)
      and (p_sipasti = '' or i.sipasti_status = p_sipasti)
  ), term_hits as materialized (
    select i.id, t.term, t.ordinal,
      case when p_match = 'phrases' then ahsp_term_matches(i.name, t.term, 'exact') else
        ((p_scope <> 'components' and (ahsp_term_matches(i.name, t.term, 'exact') or ahsp_term_matches(i.code, t.term, 'exact')))
          or (p_scope <> 'jobs' and exists (select 1 from jsonb_array_elements(i.components) c
            where ahsp_term_matches(c->>'name', t.term, 'exact') or ahsp_term_matches(c->>'code', t.term, 'exact')))) end as exact_hit,
      case when p_match = 'phrases' then ahsp_term_matches(regexp_replace(i.name, '\s+', ' ', 'g'), t.term, 'like') else
        ((p_scope <> 'components' and (ahsp_term_matches(i.name, t.term, 'like') or ahsp_term_matches(i.code, t.term, 'like')))
          or (p_scope <> 'jobs' and exists (select 1 from jsonb_array_elements(i.components) c
            where ahsp_term_matches(c->>'name', t.term, 'like') or ahsp_term_matches(c->>'code', t.term, 'like')))) end as like_hit
    from candidates i cross join terms t
  ), item_hits as materialized (
    select id, bool_or(exact_hit) as exact_hit, bool_or(like_hit) as like_hit,
      case when p_match = 'phrases' then count(*) filter (where like_hit) else 0 end as phrase_hits
    from term_hits group by id
  ), term_counts as (
    select t.term, t.ordinal,
      count(h.id) filter (where h.exact_hit) as exact_count,
      count(h.id) filter (where h.like_hit) as like_count
    from terms t left join term_hits h on h.ordinal = t.ordinal
      and (p_match <> 'phrases' or h.id in (select id from item_hits where phrase_hits >= 2))
    group by t.term, t.ordinal
  ), matched as materialized (
    select i.id, i.code, i.name, i.unit, i.field, i.division, i.regulation,
      i.ahsp_type, i.analysis_status, i.source_id, i.page_from, i.page_to, i.sipasti_status,
      case when p_match = 'phrases' then h.phrase_hits else 0 end as matched_phrase_count
    from candidates i left join item_hits h on h.id = i.id
    where (p_match <> 'phrases' and not exists (select 1 from terms))
      or case when p_match = 'phrases' then h.phrase_hits >= 2
        when p_match = 'exact' then h.exact_hit else h.like_hit end
  ), page_items as (
    select * from matched order by matched_phrase_count desc, code, id
    limit 30 offset (greatest(p_page, 1) - 1) * 30
  ), page_results as (
    select i.*,
      case when p_match = 'phrases' then '[]'::jsonb
      when p_scope = 'components' or not exists (select 1 from terms t
        where ahsp_term_matches(i.name, t.term, p_match) or ahsp_term_matches(i.code, t.term, p_match))
      then coalesce((select jsonb_agg(distinct c->>'name') from jsonb_array_elements(source.components) c
        where exists (select 1 from terms t
          where ahsp_term_matches(c->>'name', t.term, p_match) or ahsp_term_matches(c->>'code', t.term, p_match))), '[]'::jsonb)
      else '[]'::jsonb end as matched_components
    from page_items i join candidates source on source.id = i.id
  ) select jsonb_build_object(
    'archive_supported', true,
    'total', (select count(*) from matched),
    'items', coalesce((select jsonb_agg(r order by matched_phrase_count desc, code, id) from page_results r), '[]'::jsonb),
    'pageSize', 30,
    'search_stats', jsonb_build_object(
      'match', p_match,
      'input_count', (select count(*) from terms),
      'found_terms', (select count(*) from term_counts where case when p_match = 'exact' then exact_count > 0 else like_count > 0 end),
      'exact_found_terms', (select count(*) from term_counts where exact_count > 0),
      'like_found_terms', (select count(*) from term_counts where like_count > 0),
      'exact_total', (select count(*) from item_hits where exact_hit),
      'like_total', (select count(*) from item_hits where case when p_match = 'phrases' then phrase_hits >= 2 else like_hit end),
      'filtered_catalog_total', (select count(*) from candidates),
      'catalog_total', (select count(*) from ahsp_items where regulation in ('SE 47/2026', 'PERMEN 08/2023', 'SE 182/2025')),
      'terms', coalesce((select jsonb_agg(t order by ordinal) from term_counts t), '[]'::jsonb)
    ),
    'matched_types', coalesce((select jsonb_agg(t order by type) from (
      select ahsp_type as type, count(*) as count from matched group by ahsp_type
    ) t), '[]'::jsonb),
    'catalog_types', coalesce((select jsonb_agg(t order by type) from (
      select ahsp_type as type, count(*) as count from ahsp_items
      where regulation in ('SE 47/2026', 'PERMEN 08/2023', 'SE 182/2025') group by ahsp_type
    ) t), '[]'::jsonb)
  );
$$;
revoke all on function public.ahsp_search_items(text[], integer, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ahsp_search_items(text[], integer, text, text, text, text, text, text, text, text) to service_role;
notify pgrst, 'reload schema';
commit;
