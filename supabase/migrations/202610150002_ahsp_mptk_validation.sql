begin;

create or replace function public.ahsp_validate_mptk_component(c jsonb)
returns jsonb language plpgsql immutable security invoker set search_path = public as $$
declare
  original_group text := coalesce(c->>'group','');
  original_name text := coalesce(c->>'name','');
  corrected_group text := original_group;
  corrected_name text := original_name;
  marker text := substring(coalesce(c->>'sourceLine','') from '^[[:space:]]*([ABC])([[:space:]]|$)');
  unit_key text := public.ahsp_name_key(c->>'unit');
  issues text[] := '{}';
begin
  if marker = 'A' and original_name ~* '^tenaga[[:space:]]+kerja([[:space:]]|$)' then corrected_group := 'tenaga';
  elsif marker = 'B' and original_name ~* '^bahan([[:space:]]|$)' then corrected_group := 'bahan';
  elsif marker = 'C' and original_name ~* '^(peralatan|alat)([[:space:]]|$)' then corrected_group := 'alat';
  end if;
  if marker in ('A','B','C') and (
    (marker='A' and corrected_group='tenaga' and original_name ~* '^tenaga[[:space:]]+kerja([[:space:]]|$)') or
    (marker='B' and corrected_group='bahan' and original_name ~* '^bahan([[:space:]]|$)') or
    (marker='C' and corrected_group='alat' and original_name ~* '^(peralatan|alat)([[:space:]]|$)')
  ) then
    corrected_name := btrim(regexp_replace(original_name,
      '^(tenaga[[:space:]]+kerja|bahan|peralatan|alat)[[:space:]]*(\*+[)]?[[:space:]]*)?', '', 'i'));
  end if;
  if public.ahsp_name_key(corrected_name) = '' or unit_key in ('','-') then issues := array_append(issues,'missing_identity'); end if;
  if (unit_key ~ '[[:space:]]' and unit_key not in ('orang hari','orang jam','orang bulan','unit hari'))
    or coalesce(c->>'expression','') ~ '^[0-9]+([,.][0-9]+)?([[:space:]]+[0-9]+([,.][0-9]+)?)+$'
    or coalesce(c->>'code','') ~ '[[:space:]]+(L|M|E|T|To|G)[.]'
    then issues := array_append(issues,'merged_resources'); end if;
  if corrected_group = 'tenaga' and unit_key not in ('oh','oj','ob','orang hari','orang jam','orang bulan')
    then issues := array_append(issues,'labor_unit_mismatch'); end if;
  if corrected_group in ('bahan','alat') and unit_key in ('oh','oj','ob','orang hari','orang jam','orang bulan')
    then issues := array_append(issues,'non_labor_unit_mismatch'); end if;
  return c || jsonb_build_object('group',corrected_group,'name',corrected_name,
    'original_group',original_group,'original_name',original_name,
    'category_corrected',corrected_group<>original_group,'validation_issues',to_jsonb(issues));
end;
$$;
revoke all on function public.ahsp_validate_mptk_component(jsonb) from public, anon, authenticated;
grant execute on function public.ahsp_validate_mptk_component(jsonb) to service_role;

create or replace view public.ahsp_mptk_validation with (security_invoker = true) as
  with validated as materialized (
  select i.id as item_id, c.ordinality as position, i.field, i.regulation,
    public.ahsp_validate_mptk_component(c.value) as component
  from public.ahsp_items i
  cross join lateral jsonb_array_elements(i.components) with ordinality c(value, ordinality)
  where i.regulation in ('SE 47/2026','PERMEN 08/2023','SE 182/2025')
    and c.value->>'group' in ('tenaga','bahan','alat')
  ) select * from validated;
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
    c.component->>'original_group' as original_group, c.component->>'original_name' as original_name,
    (c.component->>'category_corrected')::boolean as category_corrected
  from public.ahsp_mptk_validation c join public.ahsp_items i on i.id=c.item_id
  where c.component->'validation_issues' = '[]'::jsonb;

create or replace function public.ahsp_mptk_validation_stats(p_regulation text default '', p_field text default '')
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object('validated',true,
    'excluded',count(*) filter (where component->'validation_issues' <> '[]'::jsonb),
    'corrected',count(*) filter (where component->>'category_corrected'='true' and component->'validation_issues'='[]'::jsonb))
  from ahsp_mptk_validation
  where case when p_regulation='' then regulation in ('SE 47/2026','PERMEN 08/2023') else regulation=p_regulation end
    and (p_field='' or field=p_field);
$$;
revoke all on function public.ahsp_mptk_validation_stats(text,text) from public, anon, authenticated;
grant execute on function public.ahsp_mptk_validation_stats(text,text) to service_role;
commit;
