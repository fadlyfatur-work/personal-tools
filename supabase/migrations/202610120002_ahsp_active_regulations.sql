create or replace function public.ahsp_catalog_options()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'total', (select count(*) from ahsp_items where regulation in ('SE 47/2026','PERMEN 08/2023')),
    'fields', coalesce((select jsonb_agg(field order by field) from (select distinct field from ahsp_items where regulation in ('SE 47/2026','PERMEN 08/2023')) f), '[]'::jsonb),
    'divisions', coalesce((select jsonb_agg(d order by field, division) from (select distinct field, division from ahsp_items where regulation in ('SE 47/2026','PERMEN 08/2023') and division <> '') d), '[]'::jsonb),
    'units', coalesce((select jsonb_agg(unit order by unit) from (select distinct unit from ahsp_items where regulation in ('SE 47/2026','PERMEN 08/2023') and unit <> '') u), '[]'::jsonb),
    'statuses', coalesce((select jsonb_agg(s) from (select reconciliation_status as status, count(*) as count from ahsp_items where regulation in ('SE 47/2026','PERMEN 08/2023') group by reconciliation_status) s), '[]'::jsonb),
    'analysis', coalesce((select jsonb_agg(a) from (select analysis_status as status, count(*) as count from ahsp_items where regulation in ('SE 47/2026','PERMEN 08/2023') group by analysis_status) a), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(s order by annex) from ahsp_sources s), '[]'::jsonb)
  );
$$;
revoke all on function public.ahsp_catalog_options() from public, anon, authenticated;
grant execute on function public.ahsp_catalog_options() to service_role;


