-- VDAN/FCP - Demo tester setup + bug report workflow
-- Run after: 00_baseline.sql, 02_feed_posts.sql

begin;

-- ==========================================
-- 1) Demo tester setup (member-only)
-- ==========================================
-- Usage:
--  - Replace DEMO_USER_UUID with real auth.users.id
--  - Keep role = member (no admin/vorstand)
--
-- Example:
-- insert into public.user_roles (user_id, role)
-- values ('DEMO_USER_UUID'::uuid, 'member')
-- on conflict (user_id, role) do nothing;

-- ==========================================
-- 2) Bug reports table
-- ==========================================
create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 4 and 140),
  description text not null check (char_length(description) between 10 and 4000),
  current_path text,
  app_channel text,
  app_version text,
  screenshot_url text,
  status text not null default 'open' check (status in ('open','in_progress','needs_info','fixed','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  admin_note text,
  resolution_note text,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bug_reports_reporter_created
  on public.bug_reports(reporter_user_id, created_at desc);
create index if not exists idx_bug_reports_status_created
  on public.bug_reports(status, created_at desc);
create index if not exists idx_bug_reports_priority_status
  on public.bug_reports(priority, status);

alter table public.bug_reports enable row level security;

drop trigger if exists trg_bug_reports_touch on public.bug_reports;
create trigger trg_bug_reports_touch
before update on public.bug_reports
for each row execute function public.touch_updated_at();

grant select, insert on public.bug_reports to authenticated;
grant update on public.bug_reports to authenticated;

-- Reporter can read only own reports.
drop policy if exists "bug_reports_select_own_or_manager" on public.bug_reports;
create policy "bug_reports_select_own_or_manager"
on public.bug_reports for select
using (
  auth.uid() = reporter_user_id
  or public.is_admin_or_vorstand()
);

-- Reporter inserts only for own user id.
drop policy if exists "bug_reports_insert_own" on public.bug_reports;
create policy "bug_reports_insert_own"
on public.bug_reports for insert
with check (auth.uid() = reporter_user_id);

-- Reporter may update only a restricted subset while report is open/needs_info.
drop policy if exists "bug_reports_update_own_limited" on public.bug_reports;
create policy "bug_reports_update_own_limited"
on public.bug_reports for update
using (
  auth.uid() = reporter_user_id
  and status in ('open','needs_info')
)
with check (
  auth.uid() = reporter_user_id
);

-- Managers (admin/vorstand) may process all reports.
drop policy if exists "bug_reports_update_manager" on public.bug_reports;
create policy "bug_reports_update_manager"
on public.bug_reports for update
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

-- ==========================================
-- 3) Admin processing RPC
-- ==========================================
create or replace function public.admin_process_bug_report(
  p_report_id uuid,
  p_status text,
  p_admin_note text default null,
  p_resolution_note text default null,
  p_priority text default null
)
returns public.bug_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.bug_reports;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only admin/vorstand can process bug reports';
  end if;

  if p_status is null or p_status not in ('open','in_progress','needs_info','fixed','closed') then
    raise exception 'Invalid status';
  end if;

  if p_priority is not null and p_priority not in ('low','normal','high','critical') then
    raise exception 'Invalid priority';
  end if;

  update public.bug_reports
  set
    status = p_status,
    admin_note = coalesce(p_admin_note, admin_note),
    resolution_note = case
      when p_status in ('fixed','closed') then coalesce(p_resolution_note, resolution_note)
      else resolution_note
    end,
    priority = coalesce(p_priority, priority),
    resolved_at = case when p_status in ('fixed','closed') then now() else null end,
    resolved_by = case when p_status in ('fixed','closed') then auth.uid() else null end,
    updated_at = now()
  where id = p_report_id
  returning * into v_report;

  if v_report.id is null then
    raise exception 'Report not found';
  end if;

  return v_report;
end;
$$;

grant execute on function public.admin_process_bug_report(uuid, text, text, text, text) to authenticated;

commit;
