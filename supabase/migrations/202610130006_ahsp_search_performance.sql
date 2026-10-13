begin;

create or replace function public.ahsp_search_items(
  p_terms text[] default '{}', p_page integer default 1,
  p_field text default '', p_division text default '', p_unit text default '',
  p_regulation text default '', p_analysis text default '', p_scope text default 'all', p_match text default 'like'
) returns jsonb language sql stable security invoker set search_path = public as $$
  with terms as (
    select btrim(term) as term, ordinal
    from unnest(coalesce(p_terms, '{}'::text[])) with ordinality t(term, ordinal)
    where btrim(term) <> ''
  ), candidates as materialized (
    select i.id, i.code, i.name, i.unit, i.field, i.division, i.regulation, i.ahsp_type,
      i.analysis_status, i.source_id, i.page_from, i.page_to, i.components from ahsp_items i
    where i.regulation in ('SE 47/2026', 'PERMEN 08/2023')
      and (p_field = '' or i.field = p_field)
      and (p_division = '' or i.division = p_division)
      and (p_unit = '' or i.unit = p_unit)
      and (p_regulation = '' or i.regulation = p_regulation)
      and (p_analysis = '' or i.analysis_status = p_analysis)
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
      i.ahsp_type, i.analysis_status, i.source_id, i.page_from, i.page_to
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
revoke all on function public.ahsp_search_items(text[], integer, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ahsp_search_items(text[], integer, text, text, text, text, text, text, text) to service_role;
notify pgrst, 'reload schema';
commit;
