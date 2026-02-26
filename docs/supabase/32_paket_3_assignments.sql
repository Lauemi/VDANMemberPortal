-- VDAN Template — PAKET_3_ASSIGNMENTS
-- Run this after:
-- 31_paket_2_usage_tracking.sql

begin;

-- =========================================
-- 1) Sitzungstasks (Protokoll-Maßnahmen)
-- =========================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'meeting_task_status') then
    create type public.meeting_task_status as enum ('open', 'done', 'blocked');
  end if;
end $$;

create table if not exists public.meeting_tasks (
  id uuid primary key default gen_random_uuid(),
  club_event_id uuid references public.club_events(id) on delete set null,
  title text not null check (char_length(trim(title)) >= 3),
  description text,
  status public.meeting_task_status not null default 'open',
  due_date date,
  status_note text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_meeting_tasks_status_due
  on public.meeting_tasks(status, due_date);

create index if not exists idx_meeting_tasks_club_event
  on public.meeting_tasks(club_event_id);

create index if not exists idx_meeting_tasks_created_by
  on public.meeting_tasks(created_by);

drop trigger if exists trg_meeting_tasks_touch on public.meeting_tasks;
create trigger trg_meeting_tasks_touch
before update on public.meeting_tasks
for each row execute function public.touch_updated_at();

alter table public.meeting_tasks enable row level security;
grant select, insert, update, delete on public.meeting_tasks to authenticated;

-- =========================================
-- 2) Multi-Assign für Sitzungstasks
-- =========================================
create table if not exists public.task_assignees (
  task_id uuid not null references public.meeting_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null,
  primary key (task_id, user_id)
);

create index if not exists idx_task_assignees_user
  on public.task_assignees(user_id);

alter table public.task_assignees enable row level security;
grant select, insert, update, delete on public.task_assignees to authenticated;

-- =========================================
-- 3) Multi-Assign Leitung für Arbeitseinsätze
-- =========================================
create table if not exists public.work_event_leads (
  work_event_id uuid not null references public.work_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null,
  primary key (work_event_id, user_id)
);

create index if not exists idx_work_event_leads_user
  on public.work_event_leads(user_id);

alter table public.work_event_leads enable row level security;
grant select, insert, update, delete on public.work_event_leads to authenticated;

-- =========================================
-- 4) Policies
-- =========================================
drop policy if exists "meeting_tasks_select_assignee_or_manager" on public.meeting_tasks;
create policy "meeting_tasks_select_assignee_or_manager"
on public.meeting_tasks for select
using (
  public.is_admin_or_vorstand()
  or created_by = auth.uid()
  or exists (
    select 1
    from public.task_assignees ta
    where ta.task_id = id
      and ta.user_id = auth.uid()
  )
);

drop policy if exists "meeting_tasks_manager_write" on public.meeting_tasks;
create policy "meeting_tasks_manager_write"
on public.meeting_tasks for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

drop policy if exists "task_assignees_select_own_or_manager" on public.task_assignees;
create policy "task_assignees_select_own_or_manager"
on public.task_assignees for select
using (user_id = auth.uid() or public.is_admin_or_vorstand());

drop policy if exists "task_assignees_manager_write" on public.task_assignees;
create policy "task_assignees_manager_write"
on public.task_assignees for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

drop policy if exists "work_event_leads_select_own_or_manager" on public.work_event_leads;
create policy "work_event_leads_select_own_or_manager"
on public.work_event_leads for select
using (user_id = auth.uid() or public.is_admin_or_vorstand());

drop policy if exists "work_event_leads_manager_write" on public.work_event_leads;
create policy "work_event_leads_manager_write"
on public.work_event_leads for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

-- =========================================
-- 5) Meine Zuständigkeiten (auth.uid())
-- =========================================
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

commit;

-- Verification
-- select table_name from information_schema.tables where table_schema='public' and table_name in ('meeting_tasks','task_assignees','work_event_leads');
-- select column_name from information_schema.columns where table_schema='public' and table_name='meeting_tasks' and column_name in ('status','due_date','status_note');
-- select * from public.v_my_responsibilities limit 20;
