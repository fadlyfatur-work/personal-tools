begin;

create table if not exists public.ahsp_sources (
  id text primary key, title text not null, annex text not null,
  url text not null check (url like 'https://%'), sha256 text not null,
  page_count integer not null check (page_count > 0), checked_at timestamptz not null,
  regulation text not null default 'SE 47/2026',
  assets jsonb not null default '[]' check (jsonb_typeof(assets) = 'array')
);

create table if not exists public.ahsp_master_fields (
  id text primary key, name text not null, unor_id text, unor_name text
);

create table if not exists public.ahsp_items (
  id uuid primary key, code text not null, name text not null, unit text not null,
  field text not null, division text not null default '', regulation text not null,
  ahsp_type text not null default '', regulation_status text not null default '',
  source_id text references public.ahsp_sources(id),
  page_from integer check (page_from > 0), page_to integer check (page_to >= page_from),
  printed_page text not null default '', source_text text not null default '',
  analysis_status text not null check (analysis_status in ('extracted','needs_review','unavailable')),
  components jsonb not null default '[]' check (jsonb_typeof(components) = 'array'),
  overhead_min numeric, overhead_max numeric, output_quantity numeric not null default 1 check (output_quantity > 0),
  reconciliation_status text not null check (reconciliation_status in ('cocok','berbeda','belum_ditemukan','perlu_ditinjau','hanya_regulasi')),
  reconciliation_notes jsonb not null default '[]' check (jsonb_typeof(reconciliation_notes) = 'array'),
  master_rows integer[] not null default '{}',
  check (analysis_status <> 'extracted' or (source_id is not null and page_from is not null and jsonb_array_length(components) > 0)),
  check (overhead_min is null or overhead_min >= 0),
  check (overhead_max is null or overhead_max >= overhead_min)
);
create index if not exists ahsp_items_filters on public.ahsp_items(regulation, field, division, unit);
create index if not exists ahsp_items_code on public.ahsp_items(code);
create index if not exists ahsp_items_reconciliation on public.ahsp_items(reconciliation_status);

create table if not exists public.ahsp_master_rows (
  row_number integer primary key, original_id text not null,
  field_id text references public.ahsp_master_fields(id), regulation text not null,
  code text not null, name text not null, unit text not null,
  division text not null default '', raw jsonb not null,
  item_id uuid references public.ahsp_items(id),
  status text not null check (status in ('cocok','berbeda','belum_ditemukan','perlu_ditinjau','arsip')),
  notes jsonb not null default '[]'
);

alter table public.ahsp_sources enable row level security;
alter table public.ahsp_items enable row level security;
alter table public.ahsp_master_fields enable row level security;
alter table public.ahsp_master_rows enable row level security;
revoke all on public.ahsp_sources, public.ahsp_items, public.ahsp_master_fields, public.ahsp_master_rows from anon, authenticated;
grant all on public.ahsp_sources, public.ahsp_items, public.ahsp_master_fields, public.ahsp_master_rows to service_role;

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
commit;
