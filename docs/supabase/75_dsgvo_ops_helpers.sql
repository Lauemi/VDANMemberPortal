-- VDAN/FCP - DSGVO operational helpers (admin-only)
-- Run after:
--   74_security_dsgvo_baseline.sql
--
-- Purpose:
--   - Provide an admin-only subject data snapshot (DSAR support)
--   - Provide an admin-only compliance event log table + writer function

begin;

-- -------------------------------------------------------------------
-- 1) Compliance event log table (operational evidence trail)
-- -------------------------------------------------------------------
create table if not exists public.dsgvo_compliance_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  actor_user_id uuid null default auth.uid(),
  club_id uuid null,
  event_type text not null,
  subject_member_no text null,
  legal_basis text null,
  purpose text null,
  details jsonb not null default '{}'::jsonb
);

create index if not exists idx_dsgvo_events_created_at
  on public.dsgvo_compliance_events(created_at desc);

create index if not exists idx_dsgvo_events_club_id
  on public.dsgvo_compliance_events(club_id);

create index if not exists idx_dsgvo_events_member_no
  on public.dsgvo_compliance_events(subject_member_no);

alter table public.dsgvo_compliance_events enable row level security;

drop policy if exists "dsgvo_events_admin_same_club_select" on public.dsgvo_compliance_events;
create policy "dsgvo_events_admin_same_club_select"
on public.dsgvo_compliance_events
for select
to authenticated
using (
  public.is_admin()
  and (club_id is null or public.is_same_club(club_id))
);

drop policy if exists "dsgvo_events_admin_same_club_insert" on public.dsgvo_compliance_events;
create policy "dsgvo_events_admin_same_club_insert"
on public.dsgvo_compliance_events
for insert
to authenticated
with check (
  public.is_admin()
  and (club_id is null or public.is_same_club(club_id))
);

-- -------------------------------------------------------------------
-- 2) Admin writer for compliance events
-- -------------------------------------------------------------------
drop function if exists public.admin_dsgvo_log_event(text, text, text, text, uuid, jsonb);

create or replace function public.admin_dsgvo_log_event(
  p_event_type text,
  p_subject_member_no text default null,
  p_legal_basis text default null,
  p_purpose text default null,
  p_club_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_id bigint;
begin
  if not public.is_admin() then
    raise exception 'Only admin can log DSGVO events';
  end if;

  insert into public.dsgvo_compliance_events (
    actor_user_id,
    club_id,
    event_type,
    subject_member_no,
    legal_basis,
    purpose,
    details
  )
  values (
    auth.uid(),
    p_club_id,
    coalesce(nullif(trim(p_event_type), ''), 'unspecified'),
    nullif(trim(p_subject_member_no), ''),
    nullif(trim(p_legal_basis), ''),
    nullif(trim(p_purpose), ''),
    coalesce(p_details, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.admin_dsgvo_log_event(text, text, text, text, uuid, jsonb) to authenticated;

-- -------------------------------------------------------------------
-- 3) Admin subject snapshot export (DSAR support)
-- -------------------------------------------------------------------
drop function if exists public.admin_dsgvo_subject_snapshot(text);

create or replace function public.admin_dsgvo_subject_snapshot(p_member_no text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_member_no text := nullif(trim(p_member_no), '');
  v_profile_id uuid;
  v_club_id uuid;
  v_payload jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only admin can export DSGVO subject snapshot';
  end if;

  if v_member_no is null then
    raise exception 'p_member_no is required';
  end if;

  select p.id, p.club_id
    into v_profile_id, v_club_id
  from public.profiles p
  where p.member_no = v_member_no
  limit 1;

  if v_club_id is not null and not public.is_same_club(v_club_id) then
    raise exception 'Cross-club export is not allowed';
  end if;

  v_payload := jsonb_build_object(
    'member_no', v_member_no,
    'exported_at', now(),
    'exported_by', auth.uid(),
    'club_member', (
      select to_jsonb(cm)
      from public.club_members cm
      where cm.member_no = v_member_no
      limit 1
    ),
    'member_master', (
      select to_jsonb(m)
      from public.members m
      where m.membership_number = v_member_no
      limit 1
    ),
    'profile', (
      select to_jsonb(p)
      from public.profiles p
      where p.member_no = v_member_no
      limit 1
    ),
    'roles', coalesce((
      select jsonb_agg(to_jsonb(ur) order by ur.role)
      from public.user_roles ur
      where ur.user_id = v_profile_id
    ), '[]'::jsonb),
    'fishing_trips_count', (
      select count(*)
      from public.fishing_trips ft
      where ft.user_id = v_profile_id
    ),
    'catch_entries_count', (
      select count(*)
      from public.catch_entries ce
      where ce.user_id = v_profile_id
    ),
    'notes_count', (
      select count(*)
      from public.app_notes an
      where an.user_id = v_profile_id
    ),
    'membership_application', (
      select to_jsonb(ma)
      from public.members m
      join public.membership_applications ma on ma.id = m.source_application_id
      where m.membership_number = v_member_no
      limit 1
    ),
    'membership_application_audit', coalesce((
      select jsonb_agg(to_jsonb(maa) order by maa.created_at asc)
      from public.members m
      join public.membership_application_audit maa on maa.application_id = m.source_application_id
      where m.membership_number = v_member_no
    ), '[]'::jsonb)
  );

  perform public.admin_dsgvo_log_event(
    'dsar_export',
    v_member_no,
    'art_15_dsgvo',
    'Betroffenen-Auskunft',
    v_club_id,
    jsonb_build_object('profile_id', v_profile_id)
  );

  return v_payload;
end;
$$;

grant execute on function public.admin_dsgvo_subject_snapshot(text) to authenticated;

commit;

-- -------------------------------------------------------------------
-- Verification (manual)
-- -------------------------------------------------------------------
-- 1) Run as admin in app context:
-- select public.admin_dsgvo_log_event(
--   'policy_review',
--   null,
--   'art_6_abs_1_f',
--   'Berechtigungsprüfung',
--   public.current_user_club_id(),
--   jsonb_build_object('scope','release_gate')
-- );
--
-- 2) Subject snapshot export:
-- select public.admin_dsgvo_subject_snapshot('<MEMBER_NO>');
--
-- 3) Evidence log:
-- select id, created_at, event_type, subject_member_no, legal_basis, purpose
-- from public.dsgvo_compliance_events
-- order by id desc
-- limit 20;
