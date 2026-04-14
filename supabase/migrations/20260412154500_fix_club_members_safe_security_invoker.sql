create or replace view public.club_members_safe
with (security_invoker = true) as
  select
    member_no,
    club_id,
    member_number,
    source,
    first_name,
    last_name,
    email,
    status,
    is_youth,
    membership_kind,
    birthdate,
    phone,
    city,
    invite_sent_at,
    invite_claimed_at,
    invite_expires_at,
    auth_user_id,
    created_at,
    updated_at
  from public.club_members;

notify pgrst, 'reload schema';
