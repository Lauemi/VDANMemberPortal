-- VDAN Template — member card verification with card_id + key + QR support
-- Run this after:
-- 19_member_card_validity.sql

begin;

alter table if exists public.profiles
  add column if not exists member_card_id text,
  add column if not exists member_card_key text;

update public.profiles
set member_card_id = coalesce(nullif(trim(member_card_id), ''), 'MC-' || upper(substr(md5(id::text), 1, 10))),
    member_card_key = coalesce(nullif(trim(member_card_key), ''), upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12)))
where member_card_id is null
   or trim(member_card_id) = ''
   or member_card_key is null
   or trim(member_card_key) = '';

alter table if exists public.profiles
  alter column member_card_id set not null,
  alter column member_card_key set not null;

create unique index if not exists uq_profiles_member_card_id
on public.profiles(member_card_id);

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
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can verify member cards';
  end if;

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

  return jsonb_build_object(
    'ok', true,
    'valid', v_is_valid,
    'display_name', v_profile.display_name,
    'member_no', v_profile.member_no,
    'member_card_id', v_profile.member_card_id,
    'member_card_valid_from', v_profile.member_card_valid_from,
    'member_card_valid_until', v_profile.member_card_valid_until,
    'fishing_card_type', v_profile.fishing_card_type,
    'role', v_role
  );
end;
$$;

grant execute on function public.member_card_verify(text, text) to authenticated;

commit;
