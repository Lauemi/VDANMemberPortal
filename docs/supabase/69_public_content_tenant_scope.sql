-- VDAN/FCP - Phase 3: tenant scope for public-facing content
-- Run after:
--   68_club_id_not_null_and_tenant_rls.sql
--
-- Purpose:
--   - Keep public pages working for ONE active public club at a time
--   - Enforce club_id scope for feed/events/documents/media/water data
--
-- Operational note:
--   The currently public club is configured via:
--     app_secure_settings.setting_key = 'public_active_club_id'

begin;

-- -------------------------------------------------------------------
-- 0) Ensure public_active_club_id setting exists
-- -------------------------------------------------------------------
do $$
declare
  v_default_club_id uuid;
begin
  select cm.club_id
    into v_default_club_id
  from public.club_members cm
  where cm.club_id is not null
  limit 1;

  if v_default_club_id is null then
    raise exception 'No club_id found in club_members.';
  end if;

  insert into public.app_secure_settings(setting_key, setting_value)
  values ('public_active_club_id', v_default_club_id::text)
  on conflict (setting_key) do nothing;
end $$;

-- -------------------------------------------------------------------
-- 1) Helpers for public/auth tenant scope
-- -------------------------------------------------------------------
create or replace function public.public_active_club_id()
returns uuid
language plpgsql
security definer
stable
set search_path = public, pg_catalog
as $$
declare
  v_val text;
begin
  select s.setting_value
    into v_val
  from public.app_secure_settings s
  where s.setting_key = 'public_active_club_id'
  limit 1;

  if v_val is null or trim(v_val) = '' then
    return null;
  end if;

  return trim(v_val)::uuid;
exception
  when others then
    return null;
end;
$$;

create or replace function public.can_access_club_content(p_club_id uuid)
returns boolean
language sql
stable
as $$
  select
    case
      when auth.uid() is null
        then p_club_id = public.public_active_club_id()
      else public.is_same_club(p_club_id)
    end
$$;

-- -------------------------------------------------------------------
-- 2) Feed posts
-- -------------------------------------------------------------------
drop policy if exists "feed_select_all" on public.feed_posts;
drop policy if exists "feed_select_public_or_member_only" on public.feed_posts;

create policy "feed_select_tenant_public_or_member_only"
on public.feed_posts for select
using (
  public.can_access_club_content(club_id)
  and (
    category <> 'nur_mitglieder'
    or auth.uid() is not null
  )
);

drop policy if exists "feed_insert_manager" on public.feed_posts;
drop policy if exists "feed_update_manager" on public.feed_posts;
drop policy if exists "feed_delete_manager" on public.feed_posts;

create policy "feed_insert_manager_same_club"
on public.feed_posts for insert
to authenticated
with check (
  public.is_admin_or_vorstand()
  and auth.uid() = author_id
  and public.is_same_club(club_id)
);

create policy "feed_update_manager_same_club"
on public.feed_posts for update
to authenticated
using (
  public.is_admin_or_vorstand()
  and public.is_same_club(club_id)
)
with check (
  public.is_admin_or_vorstand()
  and public.is_same_club(club_id)
);

create policy "feed_delete_manager_same_club"
on public.feed_posts for delete
to authenticated
using (
  public.is_admin_or_vorstand()
  and public.is_same_club(club_id)
);

-- -------------------------------------------------------------------
-- 3) Feed media
-- -------------------------------------------------------------------
drop policy if exists "feed_media_select_all" on public.feed_post_media;
create policy "feed_media_select_tenant"
on public.feed_post_media for select
using (public.can_access_club_content(club_id));

drop policy if exists "feed_media_insert_manager" on public.feed_post_media;
drop policy if exists "feed_media_update_manager" on public.feed_post_media;
drop policy if exists "feed_media_delete_manager" on public.feed_post_media;

create policy "feed_media_insert_manager_same_club"
on public.feed_post_media for insert
to authenticated
with check (
  public.is_admin_or_vorstand()
  and auth.uid() = created_by
  and public.is_same_club(club_id)
);

create policy "feed_media_update_manager_same_club"
on public.feed_post_media for update
to authenticated
using (
  public.is_admin_or_vorstand()
  and public.is_same_club(club_id)
)
with check (
  public.is_admin_or_vorstand()
  and public.is_same_club(club_id)
);

create policy "feed_media_delete_manager_same_club"
on public.feed_post_media for delete
to authenticated
using (
  public.is_admin_or_vorstand()
  and public.is_same_club(club_id)
);

-- -------------------------------------------------------------------
-- 4) Club events (Termine)
-- -------------------------------------------------------------------
drop policy if exists "club_events_select_published_or_manager" on public.club_events;
create policy "club_events_select_tenant_published_or_manager"
on public.club_events for select
using (
  public.can_access_club_content(club_id)
  and (
    status = 'published'
    or (auth.uid() is not null and public.is_admin_or_vorstand() and public.is_same_club(club_id))
  )
);

drop policy if exists "club_events_manager_all" on public.club_events;
create policy "club_events_manager_same_club_all"
on public.club_events for all
to authenticated
using (
  public.is_admin_or_vorstand()
  and public.is_same_club(club_id)
)
with check (
  public.is_admin_or_vorstand()
  and public.is_same_club(club_id)
);

-- -------------------------------------------------------------------
-- 5) Documents (downloads)
-- -------------------------------------------------------------------
drop policy if exists "documents_select_public" on public.documents;
create policy "documents_select_tenant_public"
on public.documents for select
using (
  is_active = true
  and public.can_access_club_content(club_id)
);

drop policy if exists "documents_write_manager" on public.documents;
create policy "documents_write_manager_same_club"
on public.documents for all
to authenticated
using (
  public.is_admin_or_vorstand()
  and public.is_same_club(club_id)
)
with check (
  public.is_admin_or_vorstand()
  and public.is_same_club(club_id)
);

-- -------------------------------------------------------------------
-- 6) Water data
-- -------------------------------------------------------------------
drop policy if exists "water_select_all" on public.water_bodies;
create policy "water_select_tenant"
on public.water_bodies for select
using (public.can_access_club_content(club_id));

drop policy if exists "water_write_manager" on public.water_bodies;
create policy "water_write_manager_same_club"
on public.water_bodies for all
to authenticated
using (
  public.is_admin_or_vorstand()
  and public.is_same_club(club_id)
)
with check (
  public.is_admin_or_vorstand()
  and public.is_same_club(club_id)
);

drop policy if exists "water_areas_select_authenticated" on public.water_areas;
create policy "water_areas_select_tenant"
on public.water_areas for select
to authenticated
using (
  public.is_same_club(club_id)
  and auth.uid() is not null
);

drop policy if exists "water_areas_write_manager" on public.water_areas;
create policy "water_areas_write_manager_same_club"
on public.water_areas for all
to authenticated
using (
  public.is_admin_or_vorstand()
  and public.is_same_club(club_id)
)
with check (
  public.is_admin_or_vorstand()
  and public.is_same_club(club_id)
);

commit;

-- Quick verification:
-- select setting_value from public.app_secure_settings where setting_key='public_active_club_id';
-- select count(*) from public.feed_posts where club_id is null;
-- select count(*) from public.documents where club_id is null;
--
-- Switch active public club:
-- update public.app_secure_settings
-- set setting_value = '<TARGET_CLUB_UUID>', updated_at = now()
-- where setting_key = 'public_active_club_id';
