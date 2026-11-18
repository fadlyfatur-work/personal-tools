-- Run 202610260001_tools.sql and 202610280001_tools_admin.sql first.
-- Passwords stay in Supabase Auth; this file only assigns application roles.
begin;

do $$
declare
  v_admin uuid;
  v_user uuid;
begin
  select id into v_admin from auth.users where lower(email) = 'admin@mail.com';
  select id into v_user from auth.users where lower(email) = 'fdly@mail.com';
  if v_admin is null or v_user is null then
    raise exception 'Both requested accounts must exist in Supabase Auth before assigning roles';
  end if;

  perform public.tools_bootstrap(v_admin, 'Admin');
  perform public.tools_bootstrap(v_user, 'Fdly');

  update public.tools_profiles
  set is_template_admin = (user_id = v_admin), is_suite_admin = (user_id = v_admin)
  where user_id in (v_admin, v_user);

  insert into public.tools_audit(actor_id, action, subject_id, details)
  values
    (v_admin, 'documents.admin.bootstrap', v_admin::text, '{"is_template_admin":true}'),
    (v_admin, 'tools.account.bootstrap', v_user::text, '{"is_template_admin":false}');
end;
$$;

select email, is_template_admin, is_suite_admin, is_active
from public.tools_profiles
where lower(email) in ('admin@mail.com', 'fdly@mail.com')
order by email;

commit;
