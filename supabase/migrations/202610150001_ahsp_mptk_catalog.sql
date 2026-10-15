  begin;

  create or replace view public.ahsp_mptk_occurrences with (security_invoker = true) as
    select md5(jsonb_build_array(c.value->>'group', public.ahsp_name_key(c.value->>'name'),
        public.ahsp_unit_key(c.value->>'unit'))::text) as component_key,
      c.value->>'group' as component_group, c.value->>'name' as name,
      coalesce(c.value->>'code', '') as code, c.value->>'unit' as unit,
      c.value->'coefficient' as coefficient, coalesce(c.value->>'expression', '') as expression,
      c.ordinality as position, i.id as item_id, i.code as item_code, i.name as item_name,
      i.unit as item_unit, i.output_quantity, i.field, i.division, i.regulation,
      i.analysis_status, i.source_id, i.page_from, i.page_to
    from public.ahsp_items i
    cross join lateral jsonb_array_elements(i.components) with ordinality c(value, ordinality)
    where i.regulation in ('SE 47/2026', 'PERMEN 08/2023', 'SE 182/2025')
      and c.value->>'group' in ('tenaga', 'bahan', 'alat')
      and public.ahsp_name_key(c.value->>'name') <> ''
      and public.ahsp_unit_key(c.value->>'unit') <> '';

  revoke all on public.ahsp_mptk_occurrences from public, anon, authenticated;
  grant select on public.ahsp_mptk_occurrences to service_role;

  create or replace function public.ahsp_search_mptk(
    p_q text default '', p_group text default '', p_field text default '',
    p_unit text default '', p_regulation text default '', p_analysis text default '',
    p_page integer default 1, p_key text default ''
  ) returns jsonb language sql stable security invoker set search_path = public as $$
    with scope as materialized (
      select * from ahsp_mptk_occurrences
      where case when p_regulation = '' then regulation in ('SE 47/2026', 'PERMEN 08/2023') else regulation = p_regulation end
        and (p_field = '' or field = p_field)
    ), matching as materialized (
      select * from scope
      where (p_unit = '' or ahsp_unit_key(unit) = ahsp_unit_key(p_unit))
        and (p_analysis = '' or analysis_status = p_analysis)
        and (ahsp_name_key(p_q) = '' or strpos(ahsp_name_key(name), ahsp_name_key(p_q)) > 0
          or strpos(ahsp_name_key(code), ahsp_name_key(p_q)) > 0)
    ), filtered as materialized (
      select * from matching where (p_group = '' or component_group = p_group)
        and (p_key = '' or component_key = p_key)
    ), grouped as materialized (
      select component_key as key, component_group as "group", min(btrim(name)) as name,
        min(unit) as unit, array_agg(distinct code order by code) filter (where code <> '') as codes,
        count(*) as occurrence_count, count(distinct item_id) as job_count,
        count(*) filter (where analysis_status = 'needs_review') as review_count,
        array_agg(distinct field order by field) as fields,
        array_agg(distinct regulation order by regulation) as regulations
      from filtered group by component_key, component_group
    ), page as (
      select * from grouped order by name, "group", key limit 30 offset (greatest(p_page, 1) - 1) * 30
    ), usages as (
      select f.*, s.title as source_title, s.url as source_url, s.annex
      from filtered f left join ahsp_sources s on s.id = f.source_id
      where p_key <> ''
      order by case f.regulation when 'SE 47/2026' then 0 when 'PERMEN 08/2023' then 1 else 2 end,
        item_code, item_id, position
      limit 30 offset (greatest(p_page, 1) - 1) * 30
    ), coverage_jobs as materialized (
      select id from ahsp_items
      where field <> 'SMKK'
        and case when p_regulation = '' then regulation in ('SE 47/2026', 'PERMEN 08/2023') else regulation = p_regulation end
        and (p_field = '' or field = p_field)
    )
    select jsonb_build_object(
      'total', (select count(*) from grouped), 'page_size', 30,
      'items', coalesce((select jsonb_agg(p order by name, "group", key) from page p), '[]'::jsonb),
      'component', (select to_jsonb(g) from grouped g where p_key <> '' limit 1),
      'usages', coalesce((select jsonb_agg(u order by case regulation when 'SE 47/2026' then 0 when 'PERMEN 08/2023' then 1 else 2 end,
        item_code, item_id, position) from usages u), '[]'::jsonb),
      'usage_total', (select count(*) from filtered where p_key <> ''),
      'groups', coalesce((select jsonb_agg(g order by "group") from (
        select component_group as "group", count(distinct component_key) as count from matching group by component_group
      ) g), '[]'::jsonb),
      'fields', coalesce((select jsonb_agg(field order by field) from (
        select distinct field from ahsp_items where field <> 'SMKK'
          and case when p_regulation = '' then regulation in ('SE 47/2026', 'PERMEN 08/2023') else regulation = p_regulation end
      ) f), '[]'::jsonb),
      'units', coalesce((select jsonb_agg(unit order by unit) from (
        select distinct case when ahsp_unit_key(unit) = 'buah' then 'Buah' else unit end as unit from scope
      ) u), '[]'::jsonb),
      'coverage', jsonb_build_object('jobs', (select count(*) from coverage_jobs),
        'with_components', (select count(distinct item_id) from scope))
    );
  $$;

  revoke all on function public.ahsp_search_mptk(text,text,text,text,text,text,integer,text) from public, anon, authenticated;
  grant execute on function public.ahsp_search_mptk(text,text,text,text,text,text,integer,text) to service_role;
  commit;
