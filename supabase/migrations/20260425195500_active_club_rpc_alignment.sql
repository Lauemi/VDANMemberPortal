begin;

create or replace function public.self_member_profile_get()
returns table(
  member_no text,
  internal_member_no text,
  club_code text,
  first_name text,
  last_name text,
  email text,
  street text,
  zip text,
  city text,
  phone text,
  mobile text
)
language sql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
  with current_actor as (
    select auth.uid() as uid
  ),
  profile_row as (
    select p.*
    from public.profiles p
    join current_actor ca on ca.uid = p.id
    limit 1
  ),
  club_candidates as (
    select distinct cmi.club_id
    from public.club_member_identities cmi
    join current_actor ca on ca.uid = cmi.user_id
    where cmi.club_id is not null
  ),
  candidate_stats as (
    select count(*)::int as cnt, min(club_id) as only_club
    from club_candidates
  ),
  selected_club as (
    select coalesce(
      (
        select pr.active_club_id
        from profile_row pr
        where pr.active_club_id is not null
          and exists (select 1 from club_candidates cc where cc.club_id = pr.active_club_id)
        limit 1
      ),
      (
        select cs.only_club
        from candidate_stats cs
        where cs.cnt = 1
      ),
      (
        select pr.club_id
        from profile_row pr
        where (select cnt from candidate_stats) = 0
        limit 1
      )
    ) as club_id
  ),
  identity_row as (
    select cmi.*
    from public.club_member_identities cmi
    join current_actor ca on ca.uid = cmi.user_id
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
    coalesce(
      nullif(trim(mr.club_member_no), ''),
      nullif(trim(cr.club_member_no), ''),
      nullif(trim(cr.member_no), ''),
      nullif(trim(pr.member_no), '')
    ) as member_no,
    coalesce(
      nullif(trim(cr.member_no), ''),
      nullif(trim(ir.member_no), ''),
      nullif(trim(pr.member_no), '')
    ) as internal_member_no,
    coalesce(nullif(trim(cr.club_code), ''), '-') as club_code,
    coalesce(
      nullif(trim(mr.first_name), ''),
      nullif(trim(cr.first_name), ''),
      nullif(trim(pr.first_name), ''),
      '-'
    ) as first_name,
    coalesce(
      nullif(trim(mr.last_name), ''),
      nullif(trim(cr.last_name), ''),
      nullif(trim(pr.last_name), ''),
      '-'
    ) as last_name,
    coalesce(
      nullif(trim(mr.email), ''),
      nullif(trim(pr.email), ''),
      '-'
    ) as email,
    coalesce(nullif(trim(mr.street), ''), '-') as street,
    coalesce(nullif(trim(mr.zip), ''), '-') as zip,
    coalesce(nullif(trim(mr.city), ''), '-') as city,
    coalesce(nullif(trim(mr.phone), ''), '-') as phone,
    coalesce(nullif(trim(mr.mobile), ''), '-') as mobile
  from current_actor ca
  left join profile_row pr on true
  left join identity_row ir on true
  left join club_row cr on true
  left join member_row mr on true
  where ca.uid is not null
    and (
      pr.id is not null
      or ir.user_id is not null
      or cr.member_no is not null
      or mr.membership_number is not null
    );
$$;

grant execute on function public.self_member_profile_get() to authenticated;

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
  club_candidates as (
    select distinct cmi.club_id
    from public.club_member_identities cmi
    join actor a on a.uid = cmi.user_id
    where cmi.club_id is not null
  ),
  candidate_stats as (
    select count(*)::int as cnt, min(club_id) as only_club
    from club_candidates
  ),
  selected_club as (
    select coalesce(
      (
        select pr.active_club_id
        from profile_row pr
        where pr.active_club_id is not null
          and exists (select 1 from club_candidates cc where cc.club_id = pr.active_club_id)
        limit 1
      ),
      (
        select cs.only_club
        from candidate_stats cs
        where cs.cnt = 1
      ),
      (
        select pr.club_id
        from profile_row pr
        where (select cnt from candidate_stats) = 0
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

  select coalesce(
    public.current_user_club_id(),
    (
      select min(cmi.club_id)
      from public.club_member_identities cmi
      where cmi.user_id = v_uid
      group by cmi.user_id
      having count(distinct cmi.club_id) = 1
    )
  )
  into v_club_id;

  select coalesce(
    (
      select cmi.member_no
      from public.club_member_identities cmi
      where cmi.user_id = v_uid
        and (
          v_club_id is null
          or cmi.club_id = v_club_id
        )
      order by cmi.created_at asc nulls last, cmi.club_id asc
      limit 1
    ),
    (
      select p.member_no
      from public.profiles p
      where p.id = v_uid
      limit 1
    )
  )
  into v_member_no;

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
