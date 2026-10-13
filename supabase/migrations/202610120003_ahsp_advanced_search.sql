begin;

create or replace function public.ahsp_search_items(
  p_terms text[] default '{}', p_page integer default 1,
  p_field text default '', p_division text default '', p_unit text default '',
  p_regulation text default '', p_analysis text default '', p_scope text default 'all'
) returns jsonb language sql stable security invoker set search_path = public as $$
  with terms as (
    select distinct lower(btrim(term)) as term from unnest(coalesce(p_terms, '{}'::text[])) term
    where btrim(term) <> ''
  ), matched as materialized (
    select i.id, i.code, i.name, i.unit, i.field, i.division, i.regulation,
      i.ahsp_type, i.analysis_status, i.source_id, i.page_from, i.page_to,
      case when p_scope = 'components' or not exists (
        select 1 from terms t where position(t.term in lower(i.name)) > 0 or position(t.term in lower(i.code)) > 0
      ) then coalesce((
        select jsonb_agg(distinct c->>'name') from jsonb_array_elements(i.components) c
        where exists (select 1 from terms t where
          position(t.term in lower(coalesce(c->>'name', ''))) > 0 or
          position(t.term in lower(coalesce(c->>'code', ''))) > 0)
      ), '[]'::jsonb) else '[]'::jsonb end as matched_components
    from ahsp_items i
    where i.regulation in ('SE 47/2026', 'PERMEN 08/2023')
      and (p_field = '' or i.field = p_field)
      and (p_division = '' or i.division = p_division)
      and (p_unit = '' or i.unit = p_unit)
      and (p_regulation = '' or i.regulation = p_regulation)
      and (p_analysis = '' or i.analysis_status = p_analysis)
      and (not exists (select 1 from terms) or exists (
        select 1 from terms t where
          (p_scope <> 'components' and (position(t.term in lower(i.name)) > 0 or position(t.term in lower(i.code)) > 0))
          or (p_scope <> 'jobs' and exists (
            select 1 from jsonb_array_elements(i.components) c where
              position(t.term in lower(coalesce(c->>'name', ''))) > 0 or
              position(t.term in lower(coalesce(c->>'code', ''))) > 0
          ))
      ))
  ) select jsonb_build_object(
    'total', (select count(*) from matched),
    'items', coalesce((select jsonb_agg(r) from (
      select * from matched order by code, id
      limit 30 offset (greatest(p_page, 1) - 1) * 30
    ) r), '[]'::jsonb),
    'pageSize', 30
  );
$$;

revoke all on function public.ahsp_search_items(text[], integer, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ahsp_search_items(text[], integer, text, text, text, text, text, text) to service_role;
commit;
