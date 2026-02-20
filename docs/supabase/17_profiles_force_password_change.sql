-- VDAN Template — first-login password change flag
-- Run this after:
-- 12_cto_qr_hidden_and_member_no.sql

begin;

alter table if exists public.profiles
  add column if not exists must_change_password boolean not null default false,
  add column if not exists password_changed_at timestamptz;

create index if not exists idx_profiles_must_change_password
on public.profiles(must_change_password);

commit;

