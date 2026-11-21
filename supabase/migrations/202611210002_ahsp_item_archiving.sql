begin;

alter table public.ahsp_items
  add column if not exists archived_at timestamptz;

create index if not exists ahsp_items_active_catalog
  on public.ahsp_items (regulation, id)
  where archived_at is null;

create table if not exists public.ahsp_catalog_state (
  id smallint primary key check (id = 1),
  revision bigint not null default 1
);
insert into public.ahsp_catalog_state (id, revision)
  values (1, 1)
  on conflict (id) do nothing;
alter table public.ahsp_catalog_state enable row level security;
revoke all on public.ahsp_catalog_state from public, anon, authenticated;
grant select on public.ahsp_catalog_state to service_role;

-- Keep the existing view columns in the same order; CREATE OR REPLACE cannot remove or reorder them.
create or replace view public.ahsp_catalog_versions with (security_invoker = true) as
  select i.id, i.code, i.name, i.unit, i.field, i.division, i.regulation, i.ahsp_type,
    i.analysis_status, i.source_id, i.page_from, i.page_to, i.sipasti_status, i.components, i.reconciliation_status,
    public.ahsp_name_key(i.name) as name_key,
    case i.regulation when 'SE 47/2026' then 0 when 'PERMEN 08/2023' then 1 when 'SE 182/2025' then 2 else 3 end as regulation_rank,
    case i.analysis_status when 'extracted' then 0 when 'needs_review' then 1 else 2 end as analysis_rank,
    case when i.source_id is not null then 0 else 1 end as source_rank,
    case when i.code <> '' then 0 else 1 end as code_rank
  from public.ahsp_items i
  where i.regulation in ('SE 47/2026','PERMEN 08/2023','SE 182/2025','SPTJM')
    and i.archived_at is null;
revoke all on public.ahsp_catalog_versions from public, anon, authenticated;
grant select on public.ahsp_catalog_versions to service_role;

-- Preserve the five existing columns of the validation view.
create or replace view public.ahsp_mptk_validation with (security_invoker = true) as
  select i.id as item_id, c.ordinality as position, i.field, i.regulation, validated.component
  from public.ahsp_items i
  cross join lateral jsonb_array_elements(i.components) with ordinality c(value,ordinality)
  cross join lateral (
    select public.ahsp_validate_mptk_component(c.value - 'variables', i.analysis_origin) as component
    offset 0
  ) validated
  where i.regulation in ('SE 47/2026','PERMEN 08/2023','SE 182/2025','SPTJM')
    and i.archived_at is null
    and c.value->>'group' in ('tenaga','bahan','alat');
revoke all on public.ahsp_mptk_validation from public, anon, authenticated;
grant select on public.ahsp_mptk_validation to service_role;

-- Preserve the existing MPTK occurrence columns, including validation metadata.
create or replace view public.ahsp_mptk_occurrences with (security_invoker = true) as
  select md5(jsonb_build_array(c.component->>'group', public.ahsp_name_key(c.component->>'name'),
      public.ahsp_unit_key(c.component->>'unit'))::text) as component_key,
    c.component->>'group' as component_group, c.component->>'name' as name,
    coalesce(c.component->>'code','') as code, c.component->>'unit' as unit,
    c.component->'coefficient' as coefficient, coalesce(c.component->>'expression','') as expression,
    c.position, i.id as item_id, i.code as item_code, i.name as item_name,
    i.unit as item_unit, i.output_quantity, i.field, i.division, i.regulation,
    i.analysis_status, i.source_id, i.page_from, i.page_to,
    c.component->>'original_group' as original_group,
    c.component->>'original_name' as original_name,
    (c.component->>'category_corrected')::boolean as category_corrected
  from public.ahsp_mptk_validation c
  join public.ahsp_items i on i.id = c.item_id
  where i.regulation in ('SE 47/2026','PERMEN 08/2023','SE 182/2025','SPTJM')
    and i.archived_at is null
    and c.component->>'group' in ('tenaga','bahan','alat')
    and c.component->'validation_issues' = '[]'::jsonb
    and public.ahsp_name_key(c.component->>'name') <> ''
    and public.ahsp_unit_key(c.component->>'unit') <> '';
revoke all on public.ahsp_mptk_occurrences from public, anon, authenticated;
grant select on public.ahsp_mptk_occurrences to service_role;

create or replace function public.ahsp_archive_item(p_item_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  item public.ahsp_items%rowtype;
begin
  select * into item
    from public.ahsp_items
    where id = p_item_id
    for update;
  if not found then
    raise exception 'Item katalog tidak ditemukan';
  end if;
  if item.archived_at is not null then
    return jsonb_build_object('archived', true, 'already_archived', true, 'item_id', item.id);
  end if;

  update public.ahsp_items set archived_at = now() where id = item.id;
  update public.ahsp_catalog_state set revision = revision + 1 where id = 1;
  update public.ahsp_analysis_submissions
    set status = 'superseded', review_note = 'Item pekerjaan diarsipkan.', reviewed_at = now()
    where item_id = item.id and status = 'pending';

  return jsonb_build_object('archived', true, 'already_archived', false, 'item_id', item.id);
end;
$$;
revoke all on function public.ahsp_archive_item(uuid) from public, anon, authenticated;
grant execute on function public.ahsp_archive_item(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
