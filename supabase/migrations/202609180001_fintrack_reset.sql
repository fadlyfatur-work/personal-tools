-- DESTRUCTIVE RESET: removes only FinTrack data, then recreates it with fintrack_ prefixes.
-- Other modules such as clipboard and templates are intentionally untouched.

begin;

create extension if not exists pgcrypto;

-- Drop prefixed objects when re-running this reset in development.
drop table if exists public.fintrack_account_activity_logs cascade;
drop table if exists public.fintrack_account_join_requests cascade;
drop table if exists public.fintrack_account_invites cascade;
drop table if exists public.fintrack_account_collaborators cascade;
drop table if exists public.fintrack_transaction_entries cascade;
drop table if exists public.fintrack_transactions cascade;
drop table if exists public.fintrack_categories cascade;
drop table if exists public.fintrack_accounts cascade;
drop table if exists public.fintrack_plan_members cascade;
drop table if exists public.fintrack_plans cascade;
drop table if exists public.fintrack_users cascade;

-- Drop the legacy, unprefixed FinTrack tables. Do not add clipboard/templates here.
drop table if exists public.account_activity_logs cascade;
drop table if exists public.account_join_requests cascade;
drop table if exists public.account_invites cascade;
drop table if exists public.account_collaborators cascade;
drop table if exists public.transaction_entries cascade;
drop table if exists public.transactions cascade;
drop table if exists public.categories cascade;
drop table if exists public.accounts cascade;
drop table if exists public.plan_members cascade;
drop table if exists public.login_attempts cascade;
drop table if exists public.financial_plans cascade;
drop table if exists public.users cascade;

create table public.fintrack_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  avatar_url text,
  pin_hash text,
  pin_version integer not null default 0,
  pin_failed_attempts integer not null default 0 check (pin_failed_attempts >= 0),
  pin_locked_until timestamptz,
  pin_last_login_at timestamptz,
  month_cutoff_day integer not null default 1 check (month_cutoff_day between 1 and 28),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index fintrack_users_email_unique on public.fintrack_users(lower(email));

create table public.fintrack_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.fintrack_users(id) on delete cascade,
  name text not null default 'Keuangan Pribadi',
  currency text not null default 'IDR',
  timezone text not null default 'Asia/Jakarta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create unique index fintrack_plans_one_active_personal_plan
  on public.fintrack_plans(owner_id) where archived_at is null;

create table public.fintrack_plan_members (
  plan_id uuid not null references public.fintrack_plans(id) on delete cascade,
  user_id uuid not null references public.fintrack_users(id) on delete cascade,
  role text not null check (role in ('owner')),
  status text not null default 'accepted' check (status in ('accepted', 'revoked')),
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);

create table public.fintrack_accounts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.fintrack_plans(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('cash', 'bank', 'ewallet', 'emergency_fund', 'investment', 'debt', 'receivable')),
  classification text not null check (classification in ('asset', 'liability')),
  initial_balance numeric(18, 2) not null default 0,
  current_balance numeric(18, 2) not null default 0,
  include_in_net_worth boolean not null default true,
  sort_order integer not null default 0,
  color text,
  icon text,
  meta jsonb not null default '{}'::jsonb,
  archived boolean not null default false,
  created_by uuid references public.fintrack_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fintrack_categories (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.fintrack_plans(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.fintrack_transactions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.fintrack_plans(id) on delete cascade,
  from_account_id uuid references public.fintrack_accounts(id) on delete restrict,
  to_account_id uuid references public.fintrack_accounts(id) on delete restrict,
  category_id uuid references public.fintrack_categories(id) on delete set null,
  amount numeric(18, 2) not null check (amount > 0),
  type text not null check (type in ('income', 'expense', 'transfer')),
  note text,
  transaction_date date not null default current_date,
  status text not null default 'posted' check (status in ('posted', 'voided')),
  created_by uuid references public.fintrack_users(id) on delete set null,
  updated_by uuid references public.fintrack_users(id) on delete set null,
  voided_by uuid references public.fintrack_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz
);

create table public.fintrack_transaction_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.fintrack_transactions(id) on delete cascade,
  account_id uuid not null references public.fintrack_accounts(id) on delete restrict,
  amount_delta numeric(18, 2) not null check (amount_delta <> 0),
  created_at timestamptz not null default now(),
  unique (transaction_id, account_id)
);

create table public.fintrack_account_collaborators (
  account_id uuid not null references public.fintrack_accounts(id) on delete cascade,
  user_id uuid not null references public.fintrack_users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'viewer')),
  can_manage boolean not null default true,
  invited_by uuid references public.fintrack_users(id) on delete set null,
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

create table public.fintrack_account_invites (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.fintrack_accounts(id) on delete cascade,
  code_hash text not null unique,
  created_by uuid not null references public.fintrack_users(id) on delete cascade,
  expires_at timestamptz not null,
  max_uses integer not null default 1 check (max_uses between 1 and 20),
  used_count integer not null default 0 check (used_count >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.fintrack_account_join_requests (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.fintrack_account_invites(id) on delete cascade,
  account_id uuid not null references public.fintrack_accounts(id) on delete cascade,
  requester_id uuid not null references public.fintrack_users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  reviewed_by uuid references public.fintrack_users(id) on delete set null,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (account_id, requester_id)
);

create table public.fintrack_account_activity_logs (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.fintrack_accounts(id) on delete cascade,
  actor_id uuid references public.fintrack_users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index fintrack_accounts_plan_active_idx on public.fintrack_accounts(plan_id, archived);
create index fintrack_categories_plan_active_idx on public.fintrack_categories(plan_id, archived_at, type);
create unique index fintrack_categories_active_name_unique on public.fintrack_categories(plan_id, lower(name), type) where archived_at is null;
create index fintrack_transactions_plan_date_idx on public.fintrack_transactions(plan_id, transaction_date desc, created_at desc);
create index fintrack_transaction_entries_account_idx on public.fintrack_transaction_entries(account_id, created_at desc);
create index fintrack_account_collaborators_user_idx on public.fintrack_account_collaborators(user_id) where revoked_at is null;
create index fintrack_join_requests_queue_idx on public.fintrack_account_join_requests(account_id, status, requested_at desc);
create index fintrack_activity_logs_account_idx on public.fintrack_account_activity_logs(account_id, created_at desc);

create or replace function public.fintrack_can_manage_account(p_actor_id uuid, p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.fintrack_accounts a
    join public.fintrack_plans p on p.id = a.plan_id
    where a.id = p_account_id
      and a.archived = false
      and (
        p.owner_id = p_actor_id
        or exists (
          select 1 from public.fintrack_account_collaborators c
          where c.account_id = a.id
            and c.user_id = p_actor_id
            and c.can_manage = true
            and c.revoked_at is null
        )
      )
  );
$$;

create or replace function public.fintrack_bootstrap_user(p_auth_user_id uuid, p_email text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_email text := lower(trim(p_email));
begin
  if not exists (select 1 from auth.users where id = p_auth_user_id) then
    raise exception 'Supabase Auth user tidak ditemukan';
  end if;

  insert into public.fintrack_users (id, email, name)
  values (p_auth_user_id, v_email, coalesce(nullif(trim(p_name), ''), split_part(v_email, '@', 1)))
  on conflict (id) do update set
    email = excluded.email,
    name = excluded.name,
    updated_at = now();

  select id into v_plan_id from public.fintrack_plans
  where owner_id = p_auth_user_id and archived_at is null limit 1;

  if v_plan_id is null then
    insert into public.fintrack_plans (owner_id, name)
    values (p_auth_user_id, 'Keuangan Pribadi') returning id into v_plan_id;

    insert into public.fintrack_plan_members (plan_id, user_id, role)
    values (v_plan_id, p_auth_user_id, 'owner');

    insert into public.fintrack_accounts (plan_id, name, kind, classification, sort_order, created_by)
    values
      (v_plan_id, 'Tunai', 'cash', 'asset', 0, p_auth_user_id),
      (v_plan_id, 'Bank', 'bank', 'asset', 1, p_auth_user_id),
      (v_plan_id, 'E-Wallet', 'ewallet', 'asset', 2, p_auth_user_id);

    insert into public.fintrack_categories (plan_id, name, type)
    values
      (v_plan_id, 'Makan & Minum', 'expense'),
      (v_plan_id, 'Transportasi', 'expense'),
      (v_plan_id, 'Belanja', 'expense'),
      (v_plan_id, 'Hiburan', 'expense'),
      (v_plan_id, 'Gaji', 'income');
  end if;

  return p_auth_user_id;
end;
$$;

create or replace function public.fintrack_record_pin_failure(p_user_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked_until timestamptz;
begin
  update public.fintrack_users
  set pin_locked_until = case
        when pin_failed_attempts + 1 >= 5 then now() + interval '15 minutes'
        else null
      end,
      pin_failed_attempts = case
        when pin_failed_attempts + 1 >= 5 then 0
        else pin_failed_attempts + 1
      end,
      updated_at = now()
  where id = p_user_id
  returning pin_locked_until into v_locked_until;

  return v_locked_until;
end;
$$;

create or replace function public.fintrack_create_transaction(
  p_actor_id uuid,
  p_type text,
  p_amount numeric,
  p_from_account_id uuid default null,
  p_to_account_id uuid default null,
  p_category_id uuid default null,
  p_note text default null,
  p_transaction_date date default current_date,
  p_allow_negative boolean default false
)
returns public.fintrack_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn public.fintrack_transactions;
  v_plan_id uuid;
  v_from_class text;
  v_to_class text;
  v_from_delta numeric(18, 2);
  v_to_delta numeric(18, 2);
  v_resulting_balance numeric(18, 2);
begin
  if p_amount <= 0 then raise exception 'Nominal harus lebih dari 0'; end if;
  if p_type not in ('income', 'expense', 'transfer') then raise exception 'Tipe transaksi tidak valid'; end if;
  if p_type = 'income' and (p_to_account_id is null or p_from_account_id is not null) then raise exception 'Akun pemasukan tidak valid'; end if;
  if p_type = 'expense' and (p_from_account_id is null or p_to_account_id is not null) then raise exception 'Akun pengeluaran tidak valid'; end if;
  if p_type = 'transfer' and (p_from_account_id is null or p_to_account_id is null or p_from_account_id = p_to_account_id) then raise exception 'Akun transfer tidak valid'; end if;

  perform 1 from public.fintrack_accounts
  where id = any(array_remove(array[p_from_account_id, p_to_account_id]::uuid[], null))
  order by id for update;

  if p_from_account_id is not null then
    if not public.fintrack_can_manage_account(p_actor_id, p_from_account_id) then raise exception 'Tidak punya akses ke dompet asal'; end if;
    select plan_id, classification into v_plan_id, v_from_class from public.fintrack_accounts where id = p_from_account_id;
  end if;

  if p_to_account_id is not null then
    if not public.fintrack_can_manage_account(p_actor_id, p_to_account_id) then raise exception 'Tidak punya akses ke dompet tujuan'; end if;
    if v_plan_id is null then
      select plan_id, classification into v_plan_id, v_to_class from public.fintrack_accounts where id = p_to_account_id;
    else
      select classification into v_to_class from public.fintrack_accounts where id = p_to_account_id and plan_id = v_plan_id;
      if not found then raise exception 'Kedua dompet harus berada di rencana yang sama'; end if;
    end if;
  end if;

  if p_category_id is not null and not exists (
    select 1 from public.fintrack_categories where id = p_category_id and plan_id = v_plan_id
  ) then raise exception 'Kategori tidak valid'; end if;

  if p_from_account_id is not null then
    v_from_delta := case when v_from_class = 'liability' and p_type in ('expense', 'transfer') then p_amount else -p_amount end;
    select current_balance + v_from_delta into v_resulting_balance from public.fintrack_accounts where id = p_from_account_id;
    if v_resulting_balance < 0 and not p_allow_negative then raise exception 'FINTRACK_NEGATIVE_BALANCE'; end if;
  end if;

  if p_to_account_id is not null then
    v_to_delta := case when v_to_class = 'liability' and p_type in ('income', 'transfer') then -p_amount else p_amount end;
    select current_balance + v_to_delta into v_resulting_balance from public.fintrack_accounts where id = p_to_account_id;
    if v_resulting_balance < 0 and not p_allow_negative then raise exception 'FINTRACK_NEGATIVE_BALANCE'; end if;
  end if;

  insert into public.fintrack_transactions (
    plan_id, from_account_id, to_account_id, category_id, amount, type, note,
    transaction_date, created_by, updated_by
  ) values (
    v_plan_id, p_from_account_id, p_to_account_id, p_category_id, p_amount, p_type,
    nullif(trim(p_note), ''), p_transaction_date, p_actor_id, p_actor_id
  ) returning * into v_txn;

  if p_from_account_id is not null then
    insert into public.fintrack_transaction_entries (transaction_id, account_id, amount_delta)
    values (v_txn.id, p_from_account_id, v_from_delta);
    update public.fintrack_accounts set current_balance = current_balance + v_from_delta, updated_at = now() where id = p_from_account_id;
  end if;

  if p_to_account_id is not null then
    insert into public.fintrack_transaction_entries (transaction_id, account_id, amount_delta)
    values (v_txn.id, p_to_account_id, v_to_delta);
    update public.fintrack_accounts set current_balance = current_balance + v_to_delta, updated_at = now() where id = p_to_account_id;
  end if;

  insert into public.fintrack_account_activity_logs (account_id, actor_id, action, entity_type, entity_id)
  select account_id, p_actor_id, 'transaction.created', 'transaction', v_txn.id
  from public.fintrack_transaction_entries where transaction_id = v_txn.id;
  return v_txn;
end;
$$;

create or replace function public.fintrack_void_transaction(p_actor_id uuid, p_transaction_id uuid)
returns public.fintrack_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn public.fintrack_transactions;
  v_entry record;
begin
  select * into v_txn from public.fintrack_transactions where id = p_transaction_id for update;
  if not found or v_txn.status <> 'posted' then raise exception 'Transaksi tidak ditemukan atau sudah dibatalkan'; end if;

  for v_entry in select * from public.fintrack_transaction_entries where transaction_id = p_transaction_id order by account_id for update loop
    if not public.fintrack_can_manage_account(p_actor_id, v_entry.account_id) then raise exception 'Tidak punya akses ke dompet transaksi'; end if;
    update public.fintrack_accounts set current_balance = current_balance - v_entry.amount_delta, updated_at = now() where id = v_entry.account_id;
    insert into public.fintrack_account_activity_logs (account_id, actor_id, action, entity_type, entity_id)
    values (v_entry.account_id, p_actor_id, 'transaction.voided', 'transaction', p_transaction_id);
  end loop;

  update public.fintrack_transactions
  set status = 'voided', voided_at = now(), voided_by = p_actor_id, updated_at = now(), updated_by = p_actor_id
  where id = p_transaction_id returning * into v_txn;
  return v_txn;
end;
$$;

create or replace function public.fintrack_replace_transaction(
  p_actor_id uuid,
  p_transaction_id uuid,
  p_type text,
  p_amount numeric,
  p_from_account_id uuid default null,
  p_to_account_id uuid default null,
  p_category_id uuid default null,
  p_note text default null,
  p_transaction_date date default current_date,
  p_allow_negative boolean default false
)
returns public.fintrack_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.fintrack_transactions;
  v_new public.fintrack_transactions;
begin
  v_old := public.fintrack_void_transaction(p_actor_id, p_transaction_id);
  v_new := public.fintrack_create_transaction(
    p_actor_id, p_type, p_amount, p_from_account_id, p_to_account_id,
    p_category_id, p_note, p_transaction_date, p_allow_negative
  );
  insert into public.fintrack_account_activity_logs (account_id, actor_id, action, entity_type, entity_id, metadata)
  select account_id, p_actor_id, 'transaction.replaced', 'transaction', v_new.id,
    jsonb_build_object('replaced_transaction_id', v_old.id)
  from public.fintrack_transaction_entries where transaction_id = v_new.id;
  return v_new;
end;
$$;

create or replace function public.fintrack_request_account_join(p_actor_id uuid, p_code_hash text)
returns public.fintrack_account_join_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.fintrack_account_invites;
  v_owner_id uuid;
  v_request public.fintrack_account_join_requests;
begin
  select * into v_invite from public.fintrack_account_invites
  where code_hash = p_code_hash and revoked_at is null and expires_at > now() and used_count < max_uses
  for update;
  if not found then raise exception 'Kode tidak ditemukan, kedaluwarsa, atau sudah digunakan'; end if;

  select p.owner_id into v_owner_id from public.fintrack_accounts a
  join public.fintrack_plans p on p.id = a.plan_id where a.id = v_invite.account_id;
  if v_owner_id = p_actor_id then raise exception 'Owner tidak perlu bergabung ke dompetnya sendiri'; end if;
  if exists (
    select 1 from public.fintrack_account_collaborators
    where account_id = v_invite.account_id and user_id = p_actor_id and revoked_at is null
  ) then raise exception 'Anda sudah menjadi kolaborator dompet ini'; end if;

  insert into public.fintrack_account_join_requests (invite_id, account_id, requester_id)
  values (v_invite.id, v_invite.account_id, p_actor_id)
  on conflict (account_id, requester_id) do update
    set invite_id = excluded.invite_id, status = 'pending', requested_at = now(), reviewed_by = null, reviewed_at = null
  returning * into v_request;
  update public.fintrack_account_invites set used_count = used_count + 1 where id = v_invite.id;
  return v_request;
end;
$$;

create or replace function public.fintrack_review_join_request(p_actor_id uuid, p_request_id uuid, p_decision text)
returns public.fintrack_account_join_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.fintrack_account_join_requests;
  v_owner_id uuid;
begin
  if p_decision not in ('accepted', 'rejected') then raise exception 'Keputusan tidak valid'; end if;
  select * into v_request from public.fintrack_account_join_requests
  where id = p_request_id and status = 'pending' for update;
  if not found then raise exception 'Permintaan tidak ditemukan atau sudah diproses'; end if;

  select p.owner_id into v_owner_id from public.fintrack_accounts a
  join public.fintrack_plans p on p.id = a.plan_id where a.id = v_request.account_id;
  if v_owner_id <> p_actor_id then raise exception 'Hanya owner dompet yang dapat memproses permintaan'; end if;

  if p_decision = 'accepted' then
    insert into public.fintrack_account_collaborators (account_id, user_id, invited_by)
    values (v_request.account_id, v_request.requester_id, p_actor_id)
    on conflict (account_id, user_id) do update
      set role = 'member', can_manage = true, invited_by = excluded.invited_by, accepted_at = now(), revoked_at = null;
  end if;

  update public.fintrack_account_join_requests
  set status = p_decision, reviewed_by = p_actor_id, reviewed_at = now()
  where id = p_request_id returning * into v_request;
  insert into public.fintrack_account_activity_logs (account_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_request.account_id, p_actor_id, 'collaboration.' || p_decision, 'join_request', v_request.id,
    jsonb_build_object('requester_id', v_request.requester_id));
  return v_request;
end;
$$;

revoke all on function public.fintrack_can_manage_account(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fintrack_bootstrap_user(uuid, text, text) from public, anon, authenticated;
revoke all on function public.fintrack_record_pin_failure(uuid) from public, anon, authenticated;
revoke all on function public.fintrack_create_transaction(uuid, text, numeric, uuid, uuid, uuid, text, date, boolean) from public, anon, authenticated;
revoke all on function public.fintrack_void_transaction(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fintrack_replace_transaction(uuid, uuid, text, numeric, uuid, uuid, uuid, text, date, boolean) from public, anon, authenticated;
revoke all on function public.fintrack_request_account_join(uuid, text) from public, anon, authenticated;
revoke all on function public.fintrack_review_join_request(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.fintrack_can_manage_account(uuid, uuid) to service_role;
grant execute on function public.fintrack_bootstrap_user(uuid, text, text) to service_role;
grant execute on function public.fintrack_record_pin_failure(uuid) to service_role;
grant execute on function public.fintrack_create_transaction(uuid, text, numeric, uuid, uuid, uuid, text, date, boolean) to service_role;
grant execute on function public.fintrack_void_transaction(uuid, uuid) to service_role;
grant execute on function public.fintrack_replace_transaction(uuid, uuid, text, numeric, uuid, uuid, uuid, text, date, boolean) to service_role;
grant execute on function public.fintrack_request_account_join(uuid, text) to service_role;
grant execute on function public.fintrack_review_join_request(uuid, uuid, text) to service_role;

alter table public.fintrack_users enable row level security;
alter table public.fintrack_plans enable row level security;
alter table public.fintrack_plan_members enable row level security;
alter table public.fintrack_accounts enable row level security;
alter table public.fintrack_categories enable row level security;
alter table public.fintrack_transactions enable row level security;
alter table public.fintrack_transaction_entries enable row level security;
alter table public.fintrack_account_collaborators enable row level security;
alter table public.fintrack_account_invites enable row level security;
alter table public.fintrack_account_join_requests enable row level security;
alter table public.fintrack_account_activity_logs enable row level security;

commit;
