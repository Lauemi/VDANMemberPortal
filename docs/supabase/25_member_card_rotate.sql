-- VDAN Template — rotate member card key after verification/control
-- Run this after:
-- 24_member_card_verification.sql

begin;

create or replace function public.member_card_rotate_key(
  p_card_id text,
  p_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_new_key text;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can rotate member card key';
  end if;

  select *
  into v_profile
  from public.profiles p
  where p.member_card_id = nullif(trim(p_card_id), '')
    and p.member_card_key = nullif(trim(p_key), '')
  limit 1;

  if v_profile.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  v_new_key := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));

  update public.profiles
  set member_card_key = v_new_key,
      updated_at = now()
  where id = v_profile.id;

  return jsonb_build_object(
    'ok', true,
    'member_card_id', v_profile.member_card_id,
    'member_card_key', v_new_key,
    'display_name', v_profile.display_name,
    'member_no', v_profile.member_no
  );
end;
$$;

grant execute on function public.member_card_rotate_key(text, text) to authenticated;

commit;
