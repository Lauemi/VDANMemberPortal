-- VDAN Template — Demo users (template)
-- Run this after:
-- 12_cto_qr_hidden_and_member_no.sql
--
-- IMPORTANT:
-- 1) First create these three users in Supabase Auth (Dashboard):
--    - demo_vorstand@...
--    - demo_member@...
--    - demo_admin@...
-- 2) Replace the UUID/email/member_no placeholders below.

begin;

-- Profile upserts with member_no as required business reference.
insert into public.profiles (id, email, display_name, club_id, member_no)
values
  ('00000000-0000-0000-0000-000000000101', 'demo_vorstand@example.org', 'Demo Vorstand', null, 'WISO-XXX1'),
  ('00000000-0000-0000-0000-000000000102', 'demo_member@example.org',   'Demo Mitglied', null, 'WISO-XXX2'),
  ('00000000-0000-0000-0000-000000000103', 'demo_admin@example.org',    'Demo Admin',    null, 'WISO-XXX3')
on conflict (id) do update
set email = excluded.email,
    display_name = excluded.display_name,
    club_id = excluded.club_id,
    member_no = excluded.member_no,
    updated_at = now();

-- Role mapping stays in user_roles (member/vorstand/admin).
insert into public.user_roles (user_id, role)
values
  ('00000000-0000-0000-0000-000000000101', 'vorstand'),
  ('00000000-0000-0000-0000-000000000102', 'member'),
  ('00000000-0000-0000-0000-000000000103', 'admin')
on conflict (user_id, role) do nothing;

commit;
