begin;
alter table public.system_process_controls
  drop constraint if exists system_process_controls_priority_check;
alter table public.system_process_controls
  add constraint system_process_controls_priority_check
  check (priority in ('niedrig', 'normal', 'mittel', 'hoch', 'kritisch'));
create or replace function public.fcp_process_controls_get()
returns setof public.system_process_controls
language plpgsql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
begin
  if not public.fcp_is_superadmin() then
    raise exception 'Only superadmin can read FCP process control state';
  end if;

  return query
  select *
  from public.system_process_controls
  order by
    case priority
      when 'kritisch' then 1
      when 'hoch' then 2
      when 'mittel' then 3
      when 'normal' then 4
      when 'niedrig' then 5
      else 99
    end,
    title asc,
    process_id asc;
end;
$$;
grant execute on function public.fcp_process_controls_get() to authenticated;
commit;
