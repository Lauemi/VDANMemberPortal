-- VDAN/FCP - Multi-tenant auth hardening (P0)
-- Date: 2026-03-10
-- Goal:
--   1) Remove implicit cross-club fallback in current_user_club_id() by default.
--   2) Add club-scoped role helpers for explicit tenant-bound authorization.
--   3) Remove legacy broad manager policies that can bypass club context.

begin;

-- -------------------------------------------------------------------
-- 0) Feature flag: legacy single-club fallback (default OFF)
-- -------------------------------------------------------------------
insert into public.app_secure_settings (setting_key, setting_value)
values ('legacy_single_club_fallback_enabled', 'false')
on conflict (setting_key) do update
set setting_value = excluded.setting_value,
    updated_at = now();

create or replace function public.legacy_single_club_fallback_enabled()
returns boolean
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select coalesce(
    (
      select lower(trim(s.setting_value)) in ('1','true','yes','on')
      from public.app_secure_settings s
      where s.setting_key = 'legacy_single_club_fallback_enabled'
      limit 1
    ),
    false
  )
$$;

-- -------------------------------------------------------------------
-- 1) Harder tenant helpers
-- -------------------------------------------------------------------
create or replace function public.current_user_club_id()
returns uuid
language plpgsql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_profile_club uuid;
begin
  if v_uid is null then
    return null;
  end if;

  select p.club_id
    into v_profile_club
  from public.profiles p
  where p.id = v_uid
  limit 1;

  if v_profile_club is not null then
    return v_profile_club;
  end if;

  -- Legacy-only compatibility path (must stay disabled by default).
  if public.legacy_single_club_fallback_enabled() then
    return public.public_active_club_id();
  end if;

  return null;
end;
$$;

create or replace function public.is_same_club(p_club_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
  select p_club_id is not null and p_club_id = public.current_user_club_id()
$$;

create or replace function public.is_admin_in_club(p_club_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.club_id = p_club_id
      and ur.role = 'admin'
  )
$$;

create or replace function public.is_admin_or_vorstand_in_club(p_club_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.club_id = p_club_id
      and ur.role in ('admin','vorstand')
  )
$$;

-- -------------------------------------------------------------------
-- 2) Drop broad legacy policies (global manager scope)
-- -------------------------------------------------------------------
drop policy if exists "fishing_trips_select_own_or_manager" on public.fishing_trips;
drop policy if exists "fishing_trips_insert_own_or_manager" on public.fishing_trips;
drop policy if exists "fishing_trips_update_own_or_manager" on public.fishing_trips;
drop policy if exists "fishing_trips_delete_own_or_manager" on public.fishing_trips;

drop policy if exists "catch_entries_select_own_or_manager" on public.catch_entries;
drop policy if exists "catch_entries_insert_own_or_manager" on public.catch_entries;
drop policy if exists "catch_entries_update_own_or_manager" on public.catch_entries;
drop policy if exists "catch_entries_delete_own_or_manager" on public.catch_entries;

drop policy if exists "work_events_member_select_published" on public.work_events;
drop policy if exists "work_events_manager_all" on public.work_events;

drop policy if exists "work_participations_member_select_own_or_manager" on public.work_participations;
drop policy if exists "work_participations_member_insert_own_published" on public.work_participations;
drop policy if exists "work_participations_member_update_own_or_manager" on public.work_participations;
drop policy if exists "work_participations_manager_delete" on public.work_participations;

drop policy if exists "work_checkins_select_own_or_manager" on public.work_checkins;
drop policy if exists "work_checkins_insert_own_or_manager" on public.work_checkins;

drop policy if exists "documents_write_manager" on public.documents;
drop policy if exists "club_events_manager_all" on public.club_events;

-- -------------------------------------------------------------------
-- 3) Canonical club-scoped manager policies for core tables
-- -------------------------------------------------------------------
drop policy if exists "documents_manager_same_club_all_mt" on public.documents;
create policy "documents_manager_same_club_all_mt"
on public.documents
for all
to authenticated
using (public.is_admin_or_vorstand_in_club(club_id))
with check (public.is_admin_or_vorstand_in_club(club_id));

drop policy if exists "club_events_manager_same_club_all_mt" on public.club_events;
create policy "club_events_manager_same_club_all_mt"
on public.club_events
for all
to authenticated
using (public.is_admin_or_vorstand_in_club(club_id))
with check (public.is_admin_or_vorstand_in_club(club_id));

commit;
