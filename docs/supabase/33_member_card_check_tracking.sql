-- VDAN Template — member card check tracking (checked at/by)
-- Run this after:
-- 32_paket_3_assignments.sql

begin;

alter table if exists public.profiles
  add column if not exists member_card_checked_at timestamptz,
  add column if not exists member_card_checked_by uuid references auth.users(id) on delete set null,
  add column if not exists member_card_checked_by_label text;

create index if not exists idx_profiles_member_card_checked_at
  on public.profiles(member_card_checked_at desc);

create or replace function public.member_card_verify(p_card_id text, p_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_role text := 'member';
  v_is_valid boolean := false;
  v_verifier_id uuid := auth.uid();
  v_verifier_label text;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can verify member cards';
  end if;

  if v_verifier_id is not null then
    select coalesce(
      nullif(trim(p.display_name), ''),
      nullif(trim(p.member_no), ''),
      nullif(trim(p.email), '')
    )
    into v_verifier_label
    from public.profiles p
    where p.id = v_verifier_id
    limit 1;
  end if;

  v_verifier_label := coalesce(
    nullif(trim(v_verifier_label), ''),
    nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''),
    'Vorstand/Admin'
  );

  select *
  into v_profile
  from public.profiles p
  where p.member_card_id = nullif(trim(p_card_id), '')
    and p.member_card_key = nullif(trim(p_key), '')
  limit 1;

  if v_profile.id is null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'not_found'
    );
  end if;

  select case
           when exists (select 1 from public.user_roles ur where ur.user_id = v_profile.id and ur.role = 'admin') then 'admin'
           when exists (select 1 from public.user_roles ur where ur.user_id = v_profile.id and ur.role = 'vorstand') then 'vorstand'
           else 'member'
         end
  into v_role;

  v_is_valid := coalesce(v_profile.member_card_valid, false)
                and coalesce(v_profile.member_card_valid_from, current_date) <= current_date
                and coalesce(v_profile.member_card_valid_until, current_date) >= current_date;

  -- Only successful and currently valid scans are logged as control.
  if v_is_valid then
    update public.profiles
    set member_card_checked_at = now(),
        member_card_checked_by = v_verifier_id,
        member_card_checked_by_label = v_verifier_label,
        updated_at = now()
    where id = v_profile.id
    returning * into v_profile;
  end if;

  return jsonb_build_object(
    'ok', true,
    'valid', v_is_valid,
    'display_name', v_profile.display_name,
    'member_no', v_profile.member_no,
    'member_card_id', v_profile.member_card_id,
    'member_card_valid_from', v_profile.member_card_valid_from,
    'member_card_valid_until', v_profile.member_card_valid_until,
    'member_card_checked_at', v_profile.member_card_checked_at,
    'member_card_checked_by', v_profile.member_card_checked_by,
    'member_card_checked_by_label', v_profile.member_card_checked_by_label,
    'fishing_card_type', v_profile.fishing_card_type,
    'role', v_role
  );
end;
$$;

grant execute on function public.member_card_verify(text, text) to authenticated;

commit;

-- Verification
-- select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name in ('member_card_checked_at','member_card_checked_by','member_card_checked_by_label');
-- select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='member_card_verify';
-- select id, member_card_checked_at, member_card_checked_by_label from public.profiles where member_card_checked_at is not null order by member_card_checked_at desc limit 10;
