begin;

-- The matcher uses only built-ins. A function-level SET prevents SQL inlining.
create or replace function public.ahsp_term_matches(p_text text, p_term text, p_match text)
returns boolean language sql immutable security invoker as $$
  select case when p_match = 'exact'
    then pg_catalog.lower(pg_catalog.btrim(coalesce(p_text, ''))) = pg_catalog.lower(pg_catalog.btrim(p_term))
    else pg_catalog.strpos(pg_catalog.lower(coalesce(p_text, '')), pg_catalog.lower(pg_catalog.btrim(p_term))) > 0
  end;
$$;
alter function public.ahsp_term_matches(text, text, text) reset all;
revoke all on function public.ahsp_term_matches(text, text, text) from public, anon, authenticated;
grant execute on function public.ahsp_term_matches(text, text, text) to service_role;

notify pgrst, 'reload schema';
commit;
