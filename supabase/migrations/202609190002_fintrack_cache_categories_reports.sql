-- Upgrade an existing prefixed FinTrack database without deleting data.
begin;

alter table public.fintrack_accounts
  add column if not exists include_in_net_worth boolean not null default true;

alter table public.fintrack_categories
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists archived_at timestamptz;

create index if not exists fintrack_categories_plan_active_idx
  on public.fintrack_categories(plan_id, archived_at, type);

alter table public.fintrack_categories
  drop constraint if exists fintrack_categories_plan_id_name_type_key;

create unique index if not exists fintrack_categories_active_name_unique
  on public.fintrack_categories(plan_id, lower(name), type)
  where archived_at is null;

commit;
