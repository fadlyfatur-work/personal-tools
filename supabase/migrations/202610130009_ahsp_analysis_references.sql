begin;
alter table public.ahsp_items
  add column if not exists analysis_target_id uuid references public.ahsp_items(id),
  add column if not exists analysis_reference jsonb check (analysis_reference is null or jsonb_typeof(analysis_reference) = 'object');
create index if not exists ahsp_items_analysis_target on public.ahsp_items(analysis_target_id) where analysis_target_id is not null;

create or replace function public.ahsp_set_analysis_references(p_references jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare changed integer;
begin
  if jsonb_typeof(p_references) is distinct from 'array' then raise exception 'Payload rujukan harus array'; end if;
  lock table public.ahsp_items in share row exclusive mode;
  if (select count(distinct r->>'item_id') from jsonb_array_elements(p_references) r) <> jsonb_array_length(p_references) then
    raise exception 'Item rujukan ganda';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_references) r
    left join ahsp_items i on i.id = (r->>'item_id')::uuid
    left join ahsp_items t on t.id = (r->>'target_item_id')::uuid
    where i.id is null or i.regulation <> 'SE 47/2026' or i.code is distinct from r->>'item_code'
      or i.name is distinct from r->>'item_name' or i.source_id is distinct from r->>'source_id'
      or r->>'status' is null or r->>'status' not in ('verified', 'review', 'missing')
      or r->>'target_regulation' is distinct from 'PERMEN 08/2023'
      or i.id = t.id
      or (r->>'target_item_id' is not null and (t.id is null or t.regulation <> 'PERMEN 08/2023' or t.code is distinct from r->>'target_code'))
      or (r->>'status' = 'verified' and (t.id is null or t.analysis_status <> 'extracted' or jsonb_array_length(t.components) = 0))
  ) then raise exception 'Identitas/status rujukan tidak sesuai katalog'; end if;
  update ahsp_items i set analysis_target_id = (r->>'target_item_id')::uuid,
    analysis_reference = r - 'item_id' - 'item_code' - 'item_name'
    from jsonb_array_elements(p_references) r where i.id = (r->>'item_id')::uuid;
  get diagnostics changed = row_count;
  return changed;
end;
$$;
revoke all on function public.ahsp_set_analysis_references(jsonb) from public, anon, authenticated;
grant execute on function public.ahsp_set_analysis_references(jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
