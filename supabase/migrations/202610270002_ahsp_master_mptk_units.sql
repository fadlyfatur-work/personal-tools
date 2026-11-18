begin;

-- SIPASTI explicitly identifies labor; its "jam" means a labor hour, not equipment.
create or replace function public.ahsp_validate_mptk_component(c jsonb, p_origin text)
returns jsonb language sql immutable security invoker set search_path = public as $$
  select case when p_origin='sipasti' and c->>'group'='tenaga' and public.ahsp_name_key(c->>'unit')='jam'
    then public.ahsp_validate_mptk_component(c || jsonb_build_object('unit','OJ'))
      || jsonb_build_object('unit',c->>'unit')
    else public.ahsp_validate_mptk_component(c) end;
$$;
revoke all on function public.ahsp_validate_mptk_component(jsonb,text) from public, anon, authenticated;
grant execute on function public.ahsp_validate_mptk_component(jsonb,text) to service_role;

create or replace view public.ahsp_mptk_validation with (security_invoker = true) as
  select i.id as item_id, c.ordinality as position, i.field, i.regulation,
    validated.component
  from public.ahsp_items i
  cross join lateral jsonb_array_elements(i.components) with ordinality c(value,ordinality)
  cross join lateral (
    select public.ahsp_validate_mptk_component(c.value - 'variables',i.analysis_origin) as component
    offset 0
  ) validated
  where i.regulation in ('SE 47/2026','PERMEN 08/2023','SE 182/2025')
    and c.value->>'group' in ('tenaga','bahan','alat');
revoke all on public.ahsp_mptk_validation from public, anon, authenticated;
grant select on public.ahsp_mptk_validation to service_role;
notify pgrst, 'reload schema';
commit;
