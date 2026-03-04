-- VDAN/FCP - Main compatibility policy patch (public experience + secure split)
-- Run after:
--   71_main_compat_insert_guards.sql
--
-- Goal:
--   - Avoid visible regressions for public visitors
--   - Keep tenant isolation for authenticated users

begin;

-- -------------------------------------------------------------------
-- 0) Water bodies: split anon/auth select behavior
-- -------------------------------------------------------------------
drop policy if exists "water_select_tenant" on public.water_bodies;

create policy "water_select_tenant_public"
on public.water_bodies for select
to anon
using (
  is_active = true
  and public.can_access_club_content(club_id)
);

create policy "water_select_tenant_authenticated"
on public.water_bodies for select
to authenticated
using (public.can_access_club_content(club_id));

-- -------------------------------------------------------------------
-- 1) Water areas: allow public read for active club (map pages),
--    authenticated users stay club-scoped.
-- -------------------------------------------------------------------
drop policy if exists "water_areas_select_tenant" on public.water_areas;
drop policy if exists "water_areas_select_authenticated" on public.water_areas;

create policy "water_areas_select_tenant_public"
on public.water_areas for select
to anon
using (
  is_active = true
  and public.can_access_club_content(club_id)
);

create policy "water_areas_select_tenant_authenticated"
on public.water_areas for select
to authenticated
using (public.is_same_club(club_id));

-- -------------------------------------------------------------------
-- 2) Feed/events/documents: explicit role targets for clarity/stability
-- -------------------------------------------------------------------
drop policy if exists "feed_select_tenant_public_or_member_only" on public.feed_posts;
create policy "feed_select_tenant_public_or_member_only"
on public.feed_posts for select
to anon, authenticated
using (
  public.can_access_club_content(club_id)
  and (
    category <> 'nur_mitglieder'
    or auth.uid() is not null
  )
);

drop policy if exists "club_events_select_tenant_published_or_manager" on public.club_events;
create policy "club_events_select_tenant_published_or_manager"
on public.club_events for select
to anon, authenticated
using (
  public.can_access_club_content(club_id)
  and (
    status = 'published'
    or (auth.uid() is not null and public.is_admin_or_vorstand() and public.is_same_club(club_id))
  )
);

drop policy if exists "documents_select_tenant_public" on public.documents;
create policy "documents_select_tenant_public"
on public.documents for select
to anon, authenticated
using (
  is_active = true
  and public.can_access_club_content(club_id)
);

commit;

-- Verification:
-- select count(*) from public.water_bodies where is_active and public.can_access_club_content(club_id);
-- select count(*) from public.water_areas where is_active and public.can_access_club_content(club_id);
