alter table public.fintrack_categories
  add column if not exists emoji text,
  add column if not exists budget_amount numeric(18, 2);

alter table public.fintrack_categories
  drop constraint if exists fintrack_categories_emoji_length_check;

alter table public.fintrack_categories
  add constraint fintrack_categories_emoji_length_check
  check (emoji is null or char_length(emoji) between 1 and 16);

alter table public.fintrack_categories
  drop constraint if exists fintrack_categories_budget_amount_check;

alter table public.fintrack_categories
  add constraint fintrack_categories_budget_amount_check
  check (budget_amount is null or budget_amount > 0);

alter table public.fintrack_users
  add column if not exists sort_accounts_by_balance boolean not null default false;

alter table public.fintrack_transactions
  drop constraint if exists fintrack_transactions_note_length_check;

alter table public.fintrack_transactions
  add constraint fintrack_transactions_note_length_check
  check (note is null or char_length(note) <= 100) not valid;

comment on column public.fintrack_categories.budget_amount is
  'Optional expense budget for one user reporting period, following month_cutoff_day.';

comment on column public.fintrack_users.sort_accounts_by_balance is
  'When true, wallet presentation is sorted by current_balance descending instead of manual sort_order.';
