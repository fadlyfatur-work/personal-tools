alter table public.fintrack_users
  add column if not exists month_cutoff_day integer not null default 1;

alter table public.fintrack_users
  drop constraint if exists fintrack_users_month_cutoff_day_check;

alter table public.fintrack_users
  add constraint fintrack_users_month_cutoff_day_check
  check (month_cutoff_day between 1 and 28);
