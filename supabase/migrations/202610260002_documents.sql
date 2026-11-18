begin;
create table if not exists public.documents_access_tags (
  id uuid primary key default gen_random_uuid(),name text not null check(char_length(trim(name)) between 1 and 100),
  normalized_name text generated always as (lower(trim(name))) stored unique,
  kind text not null default 'instansi',organization text not null default '',division text not null default '',
  active boolean not null default true,revision integer not null default 1,access_version integer not null default 1,
  pin_hash text,pin_digest text unique,created_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create table if not exists public.documents_pin_history(digest text primary key,tag_id uuid not null references public.documents_access_tags(id),created_at timestamptz not null default now());
create table if not exists public.documents_templates (
  id uuid primary key default gen_random_uuid(),code text not null unique check(code ~ '^[a-zA-Z][a-zA-Z0-9_-]{0,79}$'),
  name text not null check(char_length(trim(name)) between 1 and 160),kind text not null default '',organization text not null default '',division text not null default '',description text not null default '',
  access_tag_id uuid not null references public.documents_access_tags(id),status text not null default 'draft' check(status in('draft','published','inactive','deleted')),
  active_version_id uuid,revision integer not null default 1,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.documents_template_versions (
  id uuid primary key default gen_random_uuid(),template_id uuid not null references public.documents_templates(id),
  fields jsonb not null check(jsonb_typeof(fields)='object'),file_key text not null unique,file_name text not null,checksum text not null,
  status text not null default 'draft' check(status in('draft','validated','active','history')),
  validated_at timestamptz,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
  unique(template_id,id)
);
alter table public.documents_templates drop constraint if exists documents_template_version_parent;
alter table public.documents_templates add constraint documents_template_version_parent foreign key(id,active_version_id) references public.documents_template_versions(template_id,id) deferrable initially deferred;
create index if not exists documents_templates_tag_catalog on public.documents_templates(access_tag_id,status,name,id);
create index if not exists documents_versions_template on public.documents_template_versions(template_id,created_at desc);

create or replace function public.documents_require_admin(p_actor uuid) returns void
language plpgsql security definer set search_path=public as $$ begin
  if not exists(select 1 from tools_profiles where user_id=p_actor and is_template_admin) then raise exception 'ADMIN_REQUIRED';end if;
end; $$;

create or replace function public.documents_save_tag(p_actor uuid,p_id uuid,p_revision integer,p_data jsonb,p_hash text default null,p_digest text default null,p_revoke boolean default false) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v documents_access_tags%rowtype;v_id uuid;v_old_digest text;v_old_active boolean;
begin
  perform documents_require_admin(p_actor);
  if p_id is null then
    if p_hash is null or p_digest is null then raise exception 'PIN_REQUIRED';end if;
    insert into documents_access_tags(name,kind,organization,division,created_by) values(trim(p_data->>'name'),coalesce(p_data->>'kind','instansi'),coalesce(p_data->>'organization',''),coalesce(p_data->>'division',''),p_actor) returning id into v_id;
  else
    v_id:=p_id;
  end if;
  select * into v from documents_access_tags where id=v_id for update;
  if v.id is null then raise exception 'NOT_FOUND';end if;
  if p_id is not null and v.revision<>p_revision then raise exception 'REVISION_CONFLICT';end if;
  v_old_digest:=v.pin_digest;v_old_active:=v.active;
  if p_digest is not null then
    if p_hash is null then raise exception 'PIN_REQUIRED';end if;
    insert into documents_pin_history(digest,tag_id) values(p_digest,v_id) on conflict(digest) do nothing;
    if not exists(select 1 from documents_pin_history where digest=p_digest and tag_id=v_id) then raise exception 'PIN_ALREADY_USED';end if;
    v.pin_hash:=p_hash;v.pin_digest:=p_digest;
  end if;
  if p_revoke then v.pin_hash:=null;v.pin_digest:=null;end if;
  v.active:=coalesce((p_data->>'active')::boolean,v.active);
  update documents_access_tags set name=coalesce(nullif(trim(p_data->>'name'),''),v.name),kind=coalesce(p_data->>'kind',v.kind),organization=coalesce(p_data->>'organization',v.organization),division=coalesce(p_data->>'division',v.division),
    active=v.active,pin_hash=v.pin_hash,pin_digest=v.pin_digest,revision=revision+1,
    access_version=access_version+case when p_revoke or v_old_digest is distinct from v.pin_digest or v_old_active is distinct from v.active then 1 else 0 end where id=v_id returning * into v;
  insert into tools_audit(actor_id,action,subject_id,details) values(p_actor,'documents.tag.save',v_id::text,jsonb_build_object('active',v.active,'pin_changed',p_digest is not null or p_revoke));
  return to_jsonb(v)-'pin_hash'-'pin_digest'||jsonb_build_object('pin_configured',v.pin_hash is not null);
end; $$;

create or replace function public.documents_archive_tag(p_actor uuid,p_id uuid,p_revision integer) returns void
language plpgsql security definer set search_path=public as $$ begin
  perform documents_require_admin(p_actor);
  perform 1 from documents_access_tags where id=p_id and revision=p_revision for update;
  if not found then raise exception 'REVISION_CONFLICT';end if;
  if exists(select 1 from documents_templates where access_tag_id=p_id and status<>'deleted') then raise exception 'TAG_NOT_EMPTY';end if;
  update documents_access_tags set active=false,revision=revision+1,access_version=access_version+1,pin_hash=null,pin_digest=null where id=p_id;
  insert into tools_audit(actor_id,action,subject_id) values(p_actor,'documents.tag.archive',p_id::text);
end; $$;

create or replace function public.documents_save_template(p_actor uuid,p_id uuid,p_revision integer,p_data jsonb,p_version jsonb default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v documents_templates%rowtype;v_tag uuid;v_status text;v_existing documents_template_versions%rowtype;
begin
  perform documents_require_admin(p_actor);
  if p_version is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_version->>'id',67));
    select * into v_existing from documents_template_versions where id=(p_version->>'id')::uuid;
    if v_existing.id is not null then
      if v_existing.created_by<>p_actor or v_existing.checksum<>p_version->>'checksum' or v_existing.fields is distinct from p_version->'fields' then raise exception 'REVISION_CONFLICT';end if;
      select * into v from documents_templates where id=v_existing.template_id;
      if (p_id is not null and v.id<>p_id) or (p_id is null and v.code<>p_data->>'code') then raise exception 'REVISION_CONFLICT';end if;
      return to_jsonb(v);
    end if;
  end if;
  if p_id is null then
    v_tag:=(p_data->>'access_tag_id')::uuid;
    if not exists(select 1 from documents_access_tags where id=v_tag and active) then raise exception 'TAG_INVALID';end if;
    insert into documents_templates(code,name,kind,organization,division,description,access_tag_id,created_by)
      values(p_data->>'code',trim(p_data->>'name'),coalesce(p_data->>'kind',''),coalesce(p_data->>'organization',''),coalesce(p_data->>'division',''),coalesce(p_data->>'description',''),v_tag,p_actor) returning * into v;
  else
    select * into v from documents_templates where id=p_id for update;
    if v.id is null then raise exception 'NOT_FOUND';end if;
    if v.revision<>p_revision then raise exception 'REVISION_CONFLICT';end if;
    v_tag:=coalesce((p_data->>'access_tag_id')::uuid,v.access_tag_id);
    if not exists(select 1 from documents_access_tags where id=v_tag and active) and coalesce(p_data->>'status','') not in('inactive','deleted') then raise exception 'TAG_INVALID';end if;
    v_status:=coalesce(p_data->>'status',v.status);
    if v_status='published' and v.status<>'published' then raise exception 'PUBLISH_REQUIRED';end if;
    if v_status='draft' and v.status='published' then raise exception 'INVALID_TRANSITION';end if;
    update documents_templates set name=coalesce(nullif(trim(p_data->>'name'),''),v.name),kind=coalesce(p_data->>'kind',v.kind),organization=coalesce(p_data->>'organization',v.organization),division=coalesce(p_data->>'division',v.division),description=coalesce(p_data->>'description',v.description),access_tag_id=v_tag,status=v_status,revision=revision+1,updated_at=now() where id=v.id returning * into v;
  end if;
  if p_version is not null then
    insert into documents_template_versions(id,template_id,fields,file_key,file_name,checksum,created_by)
      values((p_version->>'id')::uuid,v.id,p_version->'fields',p_version->>'file_key',p_version->>'file_name',p_version->>'checksum',p_actor);
  end if;
  insert into tools_audit(actor_id,action,subject_id,details) values(p_actor,'documents.template.save',v.id::text,jsonb_build_object('status',v.status,'new_version',p_version is not null));
  return to_jsonb(v);
end; $$;

create or replace function public.documents_validate_version(p_actor uuid,p_template uuid,p_version uuid) returns void
language plpgsql security definer set search_path=public as $$ begin
  perform documents_require_admin(p_actor);
  update documents_template_versions set status='validated',validated_at=now() where id=p_version and template_id=p_template and status='draft';
  if not found and not exists(select 1 from documents_template_versions where id=p_version and template_id=p_template and status in('validated','active','history')) then raise exception 'VERSION_INVALID';end if;
end; $$;

create or replace function public.documents_publish_template(p_actor uuid,p_template uuid,p_version uuid,p_revision integer,p_reviewed boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v documents_templates%rowtype;v_version documents_template_versions%rowtype;
begin
  perform documents_require_admin(p_actor);
  select * into v from documents_templates where id=p_template for update;
  if v.id is null then raise exception 'NOT_FOUND';end if;
  if v.active_version_id=p_version and v.status='published' then return to_jsonb(v);end if;
  if v.revision<>p_revision then raise exception 'REVISION_CONFLICT';end if;
  if not p_reviewed then raise exception 'REVIEW_REQUIRED';end if;
  if not exists(select 1 from documents_access_tags where id=v.access_tag_id and active and pin_hash is not null) then raise exception 'TAG_INVALID';end if;
  select * into v_version from documents_template_versions where id=p_version and template_id=p_template for update;
  if v_version.id is null or v_version.status not in('validated','history','active') then raise exception 'VALIDATION_REQUIRED';end if;
  update documents_template_versions set status='history' where template_id=p_template and status='active';
  update documents_template_versions set status='active' where id=p_version;
  update documents_templates set active_version_id=p_version,status='published',revision=revision+1,updated_at=now() where id=p_template returning * into v;
  insert into tools_audit(actor_id,action,subject_id,details) values(p_actor,'documents.template.publish',p_template::text,jsonb_build_object('version_id',p_version));
  return to_jsonb(v);
end; $$;

do $$ declare t text;f record;begin
  foreach t in array array['documents_access_tags','documents_pin_history','documents_templates','documents_template_versions'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'documents_%' loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('documents-private','documents-private',false,10485760,array['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- The new application does not use anonymous legacy template reads. Roll out with the protected application together.
do $$ begin if to_regclass('public.templates') is not null then
  execute 'alter table public.templates enable row level security';
  execute 'revoke all on public.templates from anon, authenticated';
end if;end $$;
notify pgrst,'reload schema';
commit;
