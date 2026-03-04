-- VDAN/FCP - Hotfix: restore role/session/feed access after tenant hardening
-- Run after:
--   72_main_compat_policy_patch.sql
--
-- Symptom fixed:
--   - 403 on /rest/v1/user_roles?select=role&user_id=eq.<auth.uid>
--   - 403 on feed_posts for authenticated users without profile.club_id
--   - unstable session-based guards in UI

begin;

-- -------------------------------------------------------------------
-- 1) user_roles: allow users to read their own roles again
-- -------------------------------------------------------------------
drop policy if exists "roles_select_own" on public.user_roles;
create policy "roles_select_own"
on public.user_roles for select
to authenticated
using (
  auth.uid() = user_id
  or (public.is_admin() and public.is_same_club(club_id))
);

-- keep admin write scope (created in 68)
drop policy if exists "roles_admin_same_club_all" on public.user_roles;
create policy "roles_admin_same_club_all"
on public.user_roles
for all
to authenticated
using (
  public.is_admin()
  and public.is_same_club(club_id)
)
with check (
  public.is_admin()
  and public.is_same_club(club_id)
  and public.profile_club_id(user_id) = club_id
);

-- -------------------------------------------------------------------
-- 2) Make current_user_club_id resilient for authenticated users
-- -------------------------------------------------------------------
create or replace function public.current_user_club_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    (select p.club_id from public.profiles p where p.id = auth.uid() limit 1),
    (select public.public_active_club_id() where auth.uid() is not null)
  )
$$;

create or replace function public.is_same_club(p_club_id uuid)
returns boolean
language sql
stable
as $$
  select p_club_id is not null and p_club_id = public.current_user_club_id()
$$;

-- -------------------------------------------------------------------
-- 3) Backfill missing profile club_ids for users that already have roles
-- -------------------------------------------------------------------
update public.profiles p
   set club_id = public.public_active_club_id()
 where p.club_id is null
   and exists (
     select 1
     from public.user_roles ur
     where ur.user_id = p.id
   );

commit;

-- Post-check:
-- select auth.uid(); -- in app context
-- select * from public.user_roles where user_id = auth.uid();
-- select public.current_user_club_id();
