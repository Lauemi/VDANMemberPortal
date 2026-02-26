-- VDAN Patch — fix linter errors for SECURITY DEFINER views
-- Run this after existing migrations (especially 26/31/32)

begin;

create or replace view public.v_admin_online_users
with (security_invoker = true)
as
select
  p.id as user_id,
  p.member_no,
  p.display_name,
  p.first_login_at,
  p.last_seen_at,
  (p.last_seen_at is not null and p.last_seen_at >= (now() - interval '5 minutes')) as is_online
from public.profiles p
where public.is_admin_or_vorstand();

grant select on public.v_admin_online_users to authenticated;

create or replace view public.v_my_responsibilities
with (security_invoker = true)
as
select
  'meeting_task'::text as responsibility_type,
  mt.id as source_id,
  mt.title,
  mt.status::text as status,
  mt.due_date,
  mt.status_note,
  null::timestamptz as starts_at,
  null::timestamptz as ends_at,
  null::text as location,
  mt.created_at,
  mt.updated_at
from public.meeting_tasks mt
join public.task_assignees ta
  on ta.task_id = mt.id
 and ta.user_id = auth.uid()

union all

select
  'work_event_lead'::text as responsibility_type,
  we.id as source_id,
  we.title,
  we.status::text as status,
  (we.starts_at at time zone 'Europe/Berlin')::date as due_date,
  null::text as status_note,
  we.starts_at,
  we.ends_at,
  we.location,
  we.created_at,
  we.updated_at
from public.work_events we
join public.work_event_leads wl
  on wl.work_event_id = we.id
 and wl.user_id = auth.uid();

grant select on public.v_my_responsibilities to authenticated;

create or replace view public.export_members
with (security_invoker = true)
as
select
  m.membership_number,
  m.first_name,
  m.last_name,
  m.birthdate,
  m.street,
  m.zip,
  m.city,
  m.fishing_card_type,
  m.is_local,
  m.created_at
from public.members m
where m.status = 'active';

grant select on public.export_members to authenticated;

commit;
