-- VDAN Template — enforce manager-only attendees in meeting sessions
-- Run this after:
-- 34_meeting_sessions_and_agenda.sql

begin;

create or replace function public.enforce_meeting_attendee_is_manager()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = new.user_id
      and ur.role in ('admin', 'vorstand')
  ) then
    raise exception 'Only admin/vorstand can be meeting attendees';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_meeting_attendee_is_manager on public.meeting_session_attendees;
create trigger trg_enforce_meeting_attendee_is_manager
before insert or update of user_id on public.meeting_session_attendees
for each row
execute function public.enforce_meeting_attendee_is_manager();

-- Cleanup existing rows that violate the manager-only rule.
delete from public.meeting_session_attendees msa
where not exists (
  select 1
  from public.user_roles ur
  where ur.user_id = msa.user_id
    and ur.role in ('admin', 'vorstand')
);

commit;

-- Verification
-- select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'enforce_meeting_attendee_is_manager';
-- select tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'meeting_session_attendees' and t.tgname = 'trg_enforce_meeting_attendee_is_manager';
-- select count(*) from public.meeting_session_attendees msa where not exists (select 1 from public.user_roles ur where ur.user_id = msa.user_id and ur.role in ('admin','vorstand'));
