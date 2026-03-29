begin;

alter table if exists public.profiles
  add column if not exists must_verify_identity boolean not null default false,
  add column if not exists identity_verified_at timestamptz;

drop function if exists public.identity_dialog_gate_state();

create or replace function public.identity_dialog_gate_state()
returns table(
  dialog_enabled boolean,
  force_enabled boolean,
  preview_enabled boolean,
  must_verify_identity boolean,
  member_no text,
  club_code text,
  first_name text,
  last_name text,
  profile_email text,
  access_name text
)
language sql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
  with actor as (
    select auth.uid() as uid
  ),
  settings as (
    select
      coalesce(max(case when setting_key = 'identity_dialog_enabled' then setting_value end), 'false') as dialog_raw,
      coalesce(max(case when setting_key = 'identity_dialog_force' then setting_value end), 'false') as force_raw,
      coalesce(max(case when setting_key = 'identity_dialog_preview_user_ids' then setting_value end), '') as preview_ids_raw
    from public.app_secure_settings
    where setting_key in ('identity_dialog_enabled', 'identity_dialog_force', 'identity_dialog_preview_user_ids')
  ),
  profile_row as (
    select p.*
    from public.profiles p
    join actor a on a.uid = p.id
    limit 1
  ),
  selected_club as (
    select coalesce(
      (select pr.club_id from profile_row pr limit 1),
      (
        select cmi.club_id
        from public.club_member_identities cmi
        join actor a on a.uid = cmi.user_id
        order by cmi.created_at asc nulls last, cmi.club_id asc
        limit 1
      )
    ) as club_id
  ),
  identity_row as (
    select cmi.*
    from public.club_member_identities cmi
    join actor a on a.uid = cmi.user_id
    join selected_club sc on sc.club_id = cmi.club_id
    limit 1
  ),
  resolved_internal as (
    select coalesce(
      (select ir.member_no from identity_row ir limit 1),
      (select pr.member_no from profile_row pr limit 1)
    ) as member_no
  ),
  club_row as (
    select cm.*
    from public.club_members cm
    join selected_club sc on sc.club_id = cm.club_id
    join resolved_internal ri on ri.member_no = cm.member_no
    limit 1
  ),
  member_row as (
    select m.*
    from public.members m
    join selected_club sc on sc.club_id = m.club_id
    join resolved_internal ri on ri.member_no = m.membership_number
    limit 1
  )
  select
    lower(trim(s.dialog_raw)) in ('1', 'true', 'yes', 'on') as dialog_enabled,
    lower(trim(s.force_raw)) in ('1', 'true', 'yes', 'on') as force_enabled,
    case
      when nullif(trim(s.preview_ids_raw), '') is null then false
      else coalesce((select a.uid::text from actor a), '') = any(regexp_split_to_array(replace(s.preview_ids_raw, ' ', ''), ','))
    end as preview_enabled,
    coalesce((select pr.must_verify_identity from profile_row pr limit 1), false) as must_verify_identity,
    coalesce(
      nullif(trim((select mr.club_member_no from member_row mr limit 1)), ''),
      nullif(trim((select cr.club_member_no from club_row cr limit 1)), ''),
      nullif(trim((select cr.member_no from club_row cr limit 1)), ''),
      nullif(trim((select pr.member_no from profile_row pr limit 1)), '')
    ) as member_no,
    coalesce(nullif(trim((select cr.club_code from club_row cr limit 1)), ''), '') as club_code,
    coalesce(
      nullif(trim((select mr.first_name from member_row mr limit 1)), ''),
      nullif(trim((select cr.first_name from club_row cr limit 1)), ''),
      nullif(trim((select pr.first_name from profile_row pr limit 1)), ''),
      ''
    ) as first_name,
    coalesce(
      nullif(trim((select mr.last_name from member_row mr limit 1)), ''),
      nullif(trim((select cr.last_name from club_row cr limit 1)), ''),
      nullif(trim((select pr.last_name from profile_row pr limit 1)), ''),
      ''
    ) as last_name,
    coalesce(
      nullif(trim((select mr.email from member_row mr limit 1)), ''),
      nullif(trim((select pr.email from profile_row pr limit 1)), ''),
      ''
    ) as profile_email,
    coalesce(nullif(trim((select cr.club_code from club_row cr limit 1)), ''), '')
      || coalesce(
        nullif(trim((select mr.club_member_no from member_row mr limit 1)), ''),
        nullif(trim((select cr.club_member_no from club_row cr limit 1)), ''),
        nullif(trim((select cr.member_no from club_row cr limit 1)), ''),
        nullif(trim((select pr.member_no from profile_row pr limit 1)), '')
      ) as access_name
  from actor a
  cross join settings s
  where a.uid is not null;
$$;

grant execute on function public.identity_dialog_gate_state() to authenticated;

drop function if exists public.self_identity_verification_complete(boolean);
drop function if exists public.self_identity_verification_complete(boolean, boolean);

create or replace function public.self_identity_verification_complete(
  p_confirmed boolean default false,
  p_sepa_approved boolean default false
)
returns table(
  ok boolean,
  verified_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_club_id uuid;
  v_member_no text;
  v_verified_at timestamptz;
begin
  if v_uid is null then
    raise exception 'login_required';
  end if;

  if not coalesce(p_confirmed, false) then
    raise exception 'confirmation_required';
  end if;

  if not coalesce(p_sepa_approved, false) then
    raise exception 'sepa_confirmation_required';
  end if;

  select
    coalesce(
      p.club_id,
      (
        select cmi.club_id
        from public.club_member_identities cmi
        where cmi.user_id = v_uid
        order by cmi.created_at asc nulls last, cmi.club_id asc
        limit 1
      )
    ),
    coalesce(
      (
        select cmi.member_no
        from public.club_member_identities cmi
        where cmi.user_id = v_uid
          and (
            p.club_id is null
            or cmi.club_id = p.club_id
          )
        order by cmi.created_at asc nulls last, cmi.club_id asc
        limit 1
      ),
      p.member_no
    )
  into v_club_id, v_member_no
  from public.profiles p
  where p.id = v_uid
  limit 1;

  if v_club_id is null or nullif(trim(coalesce(v_member_no, '')), '') is null then
    raise exception 'member_context_not_found';
  end if;

  update public.members m
     set sepa_approved = true,
         updated_at = now()
   where m.club_id = v_club_id
     and m.membership_number = v_member_no;

  update public.profiles p
     set must_verify_identity = false,
         identity_verified_at = now(),
         updated_at = now()
   where p.id = v_uid
   returning p.identity_verified_at
    into v_verified_at;

  ok := v_verified_at is not null;
  verified_at := v_verified_at;
  return next;
end;
$$;

grant execute on function public.self_identity_verification_complete(boolean, boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
