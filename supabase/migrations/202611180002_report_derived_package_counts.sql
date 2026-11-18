begin;

with province_counts as (
  select
    r.date,
    p.ordinality,
    p.value->>'id' as province_id,
    coalesce(metrics.total,0)::integer as total,
    coalesce(metrics.integrated,0)::integer as integrated,
    coalesce((
      select item.value->'accounts'
      from jsonb_array_elements(coalesce(r.summary->'provinces','[]'::jsonb)) as item(value)
      where item.value->>'id'=p.value->>'id'
      limit 1
    ),'0'::jsonb) as accounts
  from public.report_daily r
  cross join lateral jsonb_array_elements(r.document->'provinces') with ordinality as p(value,ordinality)
  left join lateral (
    select
      count(*)::integer as total,
      count(*) filter (where coalesce(
        pkg.value->>'workflowStatus',
        case
          when pkg.value->>'perbaikan'='proses' then 'returned_pu'
          when pkg.value->>'apip'='selesai' then 'ready'
          when pkg.value->>'apip'='proses' then 'apip'
          when pkg.value->>'bpkad'='selesai' then 'apip'
          when pkg.value->>'bpkad'='proses' then 'bpkad'
          when pkg.value->>'pu'='selesai' then 'bpkad'
          else 'pu'
        end
      ) in ('ready','received'))::integer as integrated
    from jsonb_array_elements(coalesce(p.value->'packages','[]'::jsonb)) as pkg(value)
    where pkg.value->>'active'='true'
      and nullif(trim(pkg.value->>'name'),'') is not null
  ) as metrics on true
), report_counts as (
  select
    date,
    count(*)::integer as coverage,
    sum(total)::integer as total,
    sum(integrated)::integer as integrated,
    jsonb_agg(jsonb_build_object(
      'id',province_id,
      'total',total,
      'integrated',integrated,
      'percent',case when total>0 then round(integrated::numeric/total*10000)/100 else null end,
      'accounts',accounts
    ) order by ordinality) as provinces
  from province_counts
  group by date
)
update public.report_daily as r
set summary=r.summary||jsonb_build_object(
  'packageCoverage',c.coverage,
  'integratedCoverage',c.coverage,
  'totalPackages',c.total,
  'integratedPackages',c.integrated,
  'integrationPercent',case when c.total>0 then round(c.integrated::numeric/c.total*10000)/100 else null end,
  'provinces',c.provinces
)
from report_counts as c
where r.date=c.date;

commit;
