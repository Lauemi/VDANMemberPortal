-- VDAN Template — member card validity
-- Run this after:
-- 17_profiles_force_password_change.sql

begin;

alter table if exists public.profiles
  add column if not exists member_card_valid boolean not null default true,
  add column if not exists member_card_valid_from date,
  add column if not exists member_card_valid_until date;

update public.profiles
set member_card_valid = true,
    member_card_valid_from = coalesce(member_card_valid_from, current_date),
    member_card_valid_until = coalesce(member_card_valid_until, (current_date + interval '1 year' - interval '1 day')::date)
where member_card_valid is distinct from true
   or member_card_valid_from is null
   or member_card_valid_until is null;

create index if not exists idx_profiles_member_card_valid
on public.profiles(member_card_valid, member_card_valid_until);

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
on public.profiles for update
using (public.is_admin())
with check (public.is_admin());

commit;

