-- VDAN Template — member deletion/anonymization lifecycle
-- Run this after:
-- 26_membership_applications.sql

begin;

alter table if exists public.members
  add column if not exists deleted_at timestamptz,
  add column if not exists anonymized_at timestamptz;

alter table if exists public.profiles
  add column if not exists deleted_at timestamptz,
  add column if not exists anonymized_at timestamptz;

create index if not exists idx_members_deleted_at on public.members(deleted_at);
create index if not exists idx_members_anonymized_at on public.members(anonymized_at);
create index if not exists idx_profiles_deleted_at on public.profiles(deleted_at);
create index if not exists idx_profiles_anonymized_at on public.profiles(anonymized_at);

create or replace function public.admin_delete_or_anonymize_member(
  p_member_id uuid,
  p_mode text default 'anonymize'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text := lower(coalesce(trim(p_mode), 'anonymize'));
  v_member public.members;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can process member deletion';
  end if;

  select *
  into v_member
  from public.members m
  where m.id = p_member_id
  for update;

  if v_member.id is null then
    raise exception 'Member not found';
  end if;

  if v_mode not in ('anonymize', 'hard') then
    raise exception 'Unsupported mode: %, allowed: anonymize|hard', v_mode;
  end if;

  if v_mode = 'hard' then
    delete from public.member_bank_data where member_id = v_member.id;
    delete from public.members where id = v_member.id;
    return;
  end if;

  update public.members
  set
    status = 'inactive',
    first_name = 'ANONYM',
    last_name = 'ANONYM',
    birthdate = date '1900-01-01',
    street = '',
    zip = '',
    city = '',
    known_member = null,
    deleted_at = coalesce(deleted_at, now()),
    anonymized_at = now(),
    updated_at = now()
  where id = v_member.id;

  delete from public.member_bank_data where member_id = v_member.id;
end;
$$;

grant execute on function public.admin_delete_or_anonymize_member(uuid, text) to authenticated;

commit;
