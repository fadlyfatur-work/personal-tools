alter table public.fintrack_accounts add column if not exists provider_code text;
alter table public.fintrack_accounts drop constraint if exists fintrack_accounts_provider_check;
alter table public.fintrack_accounts add constraint fintrack_accounts_provider_check check (
  provider_code is null
  or (kind = 'bank' and provider_code in ('bca', 'mandiri', 'bri', 'bni', 'bsi'))
  or (kind = 'ewallet' and provider_code in ('gopay', 'ovo', 'dana', 'shopeepay'))
);
