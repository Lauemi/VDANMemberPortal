-- VDAN Template — extend role catalog with orga roles
-- Run after existing role migrations on staging/prod.
--
-- Adds the following roles (no automatic manager-right escalation):
-- - webmaster
-- - gewaesserwart
-- - kassenwart
-- - schriftfuehrer
-- - jugendwart

begin;

-- user_roles constraint
alter table if exists public.user_roles
  drop constraint if exists user_roles_role_check;
alter table if exists public.user_roles
  add constraint user_roles_role_check
  check (role in ('member','vorstand','admin','webmaster','gewaesserwart','kassenwart','schriftfuehrer','jugendwart'));

-- club_members constraint (if table exists in this installation)
alter table if exists public.club_members
  drop constraint if exists club_members_role_check;
alter table if exists public.club_members
  add constraint club_members_role_check
  check (role in ('member','vorstand','admin','webmaster','gewaesserwart','kassenwart','schriftfuehrer','jugendwart'));

-- memberships constraint (if multi-tenant table exists)
alter table if exists public.memberships
  drop constraint if exists memberships_role_check;
alter table if exists public.memberships
  add constraint memberships_role_check
  check (role in ('member','vorstand','admin','webmaster','gewaesserwart','kassenwart','schriftfuehrer','jugendwart'));

commit;
