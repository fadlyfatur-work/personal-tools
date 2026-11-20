begin;

create or replace view public.ahsp_catalog_versions with (security_invoker = true) as
  select i.id, i.code, i.name, i.unit, i.field, i.division, i.regulation, i.ahsp_type,
    i.analysis_status, i.source_id, i.page_from, i.page_to, i.sipasti_status, i.components, i.reconciliation_status,
    public.ahsp_name_key(i.name) as name_key,
    case i.regulation when 'SE 47/2026' then 0 when 'PERMEN 08/2023' then 1 when 'SE 182/2025' then 2 else 3 end as regulation_rank,
    case i.analysis_status when 'extracted' then 0 when 'needs_review' then 1 else 2 end as analysis_rank,
    case when i.source_id is not null then 0 else 1 end as source_rank,
    case when i.code <> '' then 0 else 1 end as code_rank
  from public.ahsp_items i
  where i.regulation in ('SE 47/2026','PERMEN 08/2023','SE 182/2025','SPTJM');
revoke all on public.ahsp_catalog_versions from public, anon, authenticated;
grant select on public.ahsp_catalog_versions to service_role;

notify pgrst, 'reload schema';
commit;
