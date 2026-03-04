-- VDAN/FCP - Enforce: passive members must not have a valid fishing card
-- Run after:
-- 16_wiso_members_import.sql
-- 19_member_card_validity.sql

begin;

-- Defensive: ensure required profile columns exist.
alter table if exists public.profiles
  add column if not exists fishing_card_type text,
  add column if not exists member_card_valid boolean not null default true,
  add column if not exists member_card_valid_from date,
  add column if not exists member_card_valid_until date;

-- Helper: is status passive?
create or replace function public.is_passive_status(p_status text)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(p_status, ''))) in ('passiv', 'passive');
$$;

-- Helper: enforce profile card rules based on club_members.status.
create or replace function public.enforce_passive_member_card_for_member_no(p_member_no text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if p_member_no is null or trim(p_member_no) = '' then
    return;
  end if;

  select cm.status
    into v_status
  from public.club_members cm
  where cm.member_no = p_member_no
  limit 1;

  if public.is_passive_status(v_status) then
    update public.profiles p
       set fishing_card_type = '-',
           member_card_valid = false,
           member_card_valid_from = null,
           member_card_valid_until = null,
           updated_at = now()
     where p.member_no = p_member_no
       and (
         coalesce(p.fishing_card_type, '') <> '-'
         or coalesce(p.member_card_valid, false) <> false
         or p.member_card_valid_from is not null
         or p.member_card_valid_until is not null
       );
  end if;
end;
$$;

-- Trigger on club_members changes (import/update path).
create or replace function public.trg_enforce_passive_member_card_from_club_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enforce_passive_member_card_for_member_no(new.member_no);
  return new;
end;
$$;

drop trigger if exists trg_club_members_enforce_passive_member_card on public.club_members;
create trigger trg_club_members_enforce_passive_member_card
after insert or update of status on public.club_members
for each row
execute function public.trg_enforce_passive_member_card_from_club_members();

-- Optional hard guard: if a profile is passive in club_members, force invalid on profile update too.
create or replace function public.trg_profiles_block_passive_valid_card()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if new.member_no is null or trim(new.member_no) = '' then
    return new;
  end if;

  select cm.status
    into v_status
  from public.club_members cm
  where cm.member_no = new.member_no
  limit 1;

  if public.is_passive_status(v_status) then
    new.fishing_card_type := '-';
    new.member_card_valid := false;
    new.member_card_valid_from := null;
    new.member_card_valid_until := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_block_passive_valid_card on public.profiles;
create trigger trg_profiles_block_passive_valid_card
before insert or update of fishing_card_type, member_card_valid, member_card_valid_from, member_card_valid_until, member_no
on public.profiles
for each row
execute function public.trg_profiles_block_passive_valid_card();

-- One-time backfill for existing passive members.
update public.profiles p
   set fishing_card_type = '-',
       member_card_valid = false,
       member_card_valid_from = null,
       member_card_valid_until = null,
       updated_at = now()
where exists (
  select 1
  from public.club_members cm
  where cm.member_no = p.member_no
    and public.is_passive_status(cm.status)
)
and (
  coalesce(p.fishing_card_type, '') <> '-'
  or coalesce(p.member_card_valid, false) <> false
  or p.member_card_valid_from is not null
  or p.member_card_valid_until is not null
);

commit;

-- Verification query:
-- select p.member_no, p.display_name, cm.status, p.fishing_card_type, p.member_card_valid, p.member_card_valid_from, p.member_card_valid_until
-- from public.profiles p
-- join public.club_members cm on cm.member_no = p.member_no
-- where lower(trim(coalesce(cm.status,''))) in ('passiv','passive')
-- order by p.member_no;
