begin;

create or replace function public.ahsp_mptk_coefficients(
  p_keys text[], p_q text default '', p_group text default '', p_field text default '',
  p_unit text default '', p_regulation text default '', p_analysis text default ''
) returns jsonb language sql stable security invoker set search_path = public as $$
  with candidates as materialized (
    select o.*,
      case when jsonb_typeof(coefficient)='number' then coefficient else 'null'::jsonb end as numeric_coefficient
    from ahsp_mptk_occurrences o
    where component_key = any(p_keys)
      and case when p_regulation='' then regulation in ('SE 47/2026','PERMEN 08/2023') else regulation=p_regulation end
      and (p_group='' or component_group=p_group)
      and (p_field='' or field=p_field)
      and (p_unit='' or ahsp_unit_key(unit)=ahsp_unit_key(p_unit))
      and (p_analysis='' or analysis_status=p_analysis)
      and (ahsp_name_key(p_q)='' or strpos(ahsp_name_key(name),ahsp_name_key(p_q))>0
        or strpos(ahsp_name_key(code),ahsp_name_key(p_q))>0)
  ), variants as (
    select distinct on (component_key,numeric_coefficient,expression,output_quantity,ahsp_unit_key(item_unit))
      component_key,numeric_coefficient as coefficient,expression,output_quantity,item_unit,
      item_id,item_code,item_name,regulation,analysis_status,position
    from candidates
    where numeric_coefficient<>'null'::jsonb or btrim(expression)<>''
    order by component_key,numeric_coefficient,expression,output_quantity,ahsp_unit_key(item_unit),
      case regulation when 'SE 47/2026' then 0 when 'PERMEN 08/2023' then 1 else 2 end,
      case analysis_status when 'extracted' then 0 else 1 end,item_code,item_id,position
  ), ranked as (
    select v.*,row_number() over (partition by component_key order by
      case regulation when 'SE 47/2026' then 0 when 'PERMEN 08/2023' then 1 else 2 end,
      case analysis_status when 'extracted' then 0 else 1 end,item_code,item_id,position) as choice
    from variants v
  ), summaries as (
    select component_key,
      count(*) filter (where numeric_coefficient<>'null'::jsonb) as numeric_count,
      count(*) filter (where numeric_coefficient='null'::jsonb and btrim(expression)<>'') as formula_count,
      count(*) filter (where numeric_coefficient='null'::jsonb and btrim(expression)='') as missing_count
    from candidates group by component_key
  )
  select coalesce(jsonb_object_agg(s.component_key,jsonb_build_object(
    'variant_count',(select count(*) from ranked r where r.component_key=s.component_key),
    'numeric_count',s.numeric_count,'formula_count',s.formula_count,'missing_count',s.missing_count,
    'samples',coalesce((select jsonb_agg(jsonb_build_object(
      'coefficient',r.coefficient,'expression',r.expression,'output_quantity',r.output_quantity,
      'item_unit',r.item_unit,'item_id',r.item_id,'item_code',r.item_code,'item_name',r.item_name,
      'regulation',r.regulation) order by choice)
      from ranked r where r.component_key=s.component_key and choice<=2),'[]'::jsonb)
  )),'{}'::jsonb) from summaries s;
$$;

revoke all on function public.ahsp_mptk_coefficients(text[],text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.ahsp_mptk_coefficients(text[],text,text,text,text,text,text) to service_role;
commit;
