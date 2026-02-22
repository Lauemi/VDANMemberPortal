-- VDAN Template — meeting sessions, attendance chips, agenda points
-- Run this after:
-- 33_member_card_check_tracking.sql

begin;

-- =========================================
-- 1) Enums
-- =========================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'meeting_attendance_status') then
    create type public.meeting_attendance_status as enum ('present', 'absent');
  end if;
end $$;

-- =========================================
-- 2) Meeting sessions
-- =========================================
create table if not exists public.meeting_sessions (
  id uuid primary key default gen_random_uuid(),
  meeting_date date not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_meeting_sessions_date
  on public.meeting_sessions(meeting_date desc);

drop trigger if exists trg_meeting_sessions_touch on public.meeting_sessions;
create trigger trg_meeting_sessions_touch
before update on public.meeting_sessions
for each row execute function public.touch_updated_at();

alter table public.meeting_sessions enable row level security;
grant select, insert, update, delete on public.meeting_sessions to authenticated;

drop policy if exists "meeting_sessions_select_manager" on public.meeting_sessions;
create policy "meeting_sessions_select_manager"
on public.meeting_sessions for select
using (public.is_admin_or_vorstand());

drop policy if exists "meeting_sessions_manager_write" on public.meeting_sessions;
create policy "meeting_sessions_manager_write"
on public.meeting_sessions for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

-- =========================================
-- 3) Session attendees (chips: present/absent)
-- =========================================
create table if not exists public.meeting_session_attendees (
  session_id uuid not null references public.meeting_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  attendance_status public.meeting_attendance_status not null default 'absent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (session_id, user_id)
);

create index if not exists idx_meeting_session_attendees_user
  on public.meeting_session_attendees(user_id);

drop trigger if exists trg_meeting_session_attendees_touch on public.meeting_session_attendees;
create trigger trg_meeting_session_attendees_touch
before update on public.meeting_session_attendees
for each row execute function public.touch_updated_at();

drop trigger if exists trg_meeting_session_attendees_updated_by on public.meeting_session_attendees;
create trigger trg_meeting_session_attendees_updated_by
before insert or update on public.meeting_session_attendees
for each row execute function public.touch_updated_by();

alter table public.meeting_session_attendees enable row level security;
grant select, insert, update, delete on public.meeting_session_attendees to authenticated;

drop policy if exists "meeting_session_attendees_select_own_or_manager" on public.meeting_session_attendees;
create policy "meeting_session_attendees_select_own_or_manager"
on public.meeting_session_attendees for select
using (user_id = auth.uid() or public.is_admin_or_vorstand());

drop policy if exists "meeting_session_attendees_manager_write" on public.meeting_session_attendees;
create policy "meeting_session_attendees_manager_write"
on public.meeting_session_attendees for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

-- =========================================
-- 4) Agenda points (automatic numbering)
-- =========================================
create table if not exists public.meeting_agenda_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.meeting_sessions(id) on delete cascade,
  item_no integer not null,
  title text not null check (char_length(trim(title)) >= 2),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, item_no)
);

create index if not exists idx_meeting_agenda_items_session
  on public.meeting_agenda_items(session_id, item_no);

drop trigger if exists trg_meeting_agenda_items_touch on public.meeting_agenda_items;
create trigger trg_meeting_agenda_items_touch
before update on public.meeting_agenda_items
for each row execute function public.touch_updated_at();

create or replace function public.meeting_agenda_items_auto_number()
returns trigger
language plpgsql
as $$
begin
  if new.item_no is null or new.item_no <= 0 then
    select coalesce(max(ai.item_no), 0) + 1
      into new.item_no
    from public.meeting_agenda_items ai
    where ai.session_id = new.session_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_meeting_agenda_items_auto_number on public.meeting_agenda_items;
create trigger trg_meeting_agenda_items_auto_number
before insert on public.meeting_agenda_items
for each row execute function public.meeting_agenda_items_auto_number();

alter table public.meeting_agenda_items enable row level security;
grant select, insert, update, delete on public.meeting_agenda_items to authenticated;

drop policy if exists "meeting_agenda_items_select_manager" on public.meeting_agenda_items;
create policy "meeting_agenda_items_select_manager"
on public.meeting_agenda_items for select
using (public.is_admin_or_vorstand());

drop policy if exists "meeting_agenda_items_manager_write" on public.meeting_agenda_items;
create policy "meeting_agenda_items_manager_write"
on public.meeting_agenda_items for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

-- =========================================
-- 5) Extend meeting tasks: bind to session + agenda point
-- =========================================
alter table if exists public.meeting_tasks
  add column if not exists meeting_session_id uuid references public.meeting_sessions(id) on delete set null,
  add column if not exists agenda_item_id uuid references public.meeting_agenda_items(id) on delete set null;

create index if not exists idx_meeting_tasks_session
  on public.meeting_tasks(meeting_session_id);

create index if not exists idx_meeting_tasks_agenda_item
  on public.meeting_tasks(agenda_item_id);

create or replace function public.enforce_meeting_task_agenda_scope()
returns trigger
language plpgsql
as $$
declare
  v_session_id uuid;
begin
  if new.agenda_item_id is null then
    return new;
  end if;

  select ai.session_id
    into v_session_id
  from public.meeting_agenda_items ai
  where ai.id = new.agenda_item_id
  limit 1;

  if v_session_id is null then
    raise exception 'agenda_item_id not found';
  end if;

  if new.meeting_session_id is null then
    new.meeting_session_id := v_session_id;
  elsif new.meeting_session_id <> v_session_id then
    raise exception 'meeting_session_id must match agenda item session';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_meeting_task_agenda_scope on public.meeting_tasks;
create trigger trg_enforce_meeting_task_agenda_scope
before insert or update on public.meeting_tasks
for each row execute function public.enforce_meeting_task_agenda_scope();

commit;

-- Verification
-- select table_name from information_schema.tables where table_schema='public' and table_name in ('meeting_sessions','meeting_session_attendees','meeting_agenda_items');
-- select column_name from information_schema.columns where table_schema='public' and table_name='meeting_tasks' and column_name in ('meeting_session_id','agenda_item_id');
-- select tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='meeting_tasks' and t.tgname='trg_enforce_meeting_task_agenda_scope';
