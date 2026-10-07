begin;

alter table public.fintrack_categories
  add column if not exists parent_id uuid references public.fintrack_categories(id),
  add column if not exists budget_mode text not null default 'fixed'
    check (budget_mode in ('fixed', 'children'));

create index if not exists fintrack_categories_parent_idx on public.fintrack_categories(parent_id);
drop index if exists public.fintrack_categories_active_name_unique;
create unique index fintrack_categories_active_name_unique
  on public.fintrack_categories(plan_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name), type)
  where archived_at is null;

create or replace function public.fintrack_check_category_tree()
returns trigger language plpgsql set search_path = public as $$
declare
  parent public.fintrack_categories;
  allocated numeric;
begin
  -- Serialize category changes per plan so simultaneous child allocations cannot exceed the cap.
  perform 1 from public.fintrack_plans where id = new.plan_id for update;
  if tg_op = 'UPDATE' and (new.plan_id <> old.plan_id or new.id <> old.id) then
    raise exception using errcode = '23514', message = 'Identitas kategori tidak dapat diubah';
  end if;
  if new.type = 'income' or new.budget_mode = 'children' then new.budget_amount := null; end if;
  if new.parent_id is not null then
    select * into parent from public.fintrack_categories where id = new.parent_id;
    if parent.id is null or parent.plan_id <> new.plan_id or parent.type <> new.type
      or parent.parent_id is not null or parent.id = new.id
      or (new.archived_at is null and parent.archived_at is not null) then
      raise exception using errcode = '23514', message = 'Pilih kategori induk aktif dengan tipe yang sama';
    end if;
    if new.budget_mode <> 'fixed' then
      raise exception using errcode = '23514', message = 'Subkategori menggunakan budget sendiri';
    end if;
    if exists(select 1 from public.fintrack_categories where parent_id = new.id) then
      raise exception using errcode = '23514', message = 'Kategori yang memiliki subkategori tidak dapat dijadikan subkategori';
    end if;
    select coalesce(sum(budget_amount), 0) into allocated from public.fintrack_categories
      where parent_id = new.parent_id and id <> new.id and archived_at is null;
    if new.archived_at is null and parent.budget_mode = 'fixed' and parent.budget_amount is not null
      and allocated + coalesce(new.budget_amount, 0) > parent.budget_amount then
      raise exception using errcode = '23514', message = 'Total budget subkategori melebihi budget induk';
    end if;
  end if;
  if exists(select 1 from public.fintrack_categories where parent_id = new.id and archived_at is null
    and (new.archived_at is not null or type <> new.type)) then
    raise exception using errcode = '23514', message = 'Arsipkan atau pindahkan subkategori sebelum mengubah induk';
  end if;
  select coalesce(sum(budget_amount), 0) into allocated from public.fintrack_categories
    where parent_id = new.id and archived_at is null;
  if new.budget_mode = 'fixed' and new.budget_amount is not null and allocated > new.budget_amount then
    raise exception using errcode = '23514', message = 'Budget induk tidak boleh kurang dari total budget subkategori';
  end if;
  return new;
end;
$$;

drop trigger if exists fintrack_category_tree on public.fintrack_categories;
create trigger fintrack_category_tree before insert or update on public.fintrack_categories
  for each row execute function public.fintrack_check_category_tree();

commit;
