begin;

create or replace function public.governance_health_snapshot()
returns table (
  club_id uuid,
  club_code text,
  club_name text,
  identity_gaps integer,
  roles_without_membership integer,
  duplicate_identities integer,
  members_without_identity_link integer,
  club_name_or_code_missing integer,
  total_issues integer,
  health_status text
)
language sql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
  with code_map as (
    select
      s.setting_value::uuid as club_id,
      upper(trim(replace(s.setting_key, 'club_code_map:', ''))) as club_code
    from public.app_secure_settings s
    where s.setting_key like 'club_code_map:%'
      and upper(trim(replace(s.setting_key, 'club_code_map:', ''))) ~ '^[A-Z]{2}[0-9]{2}$'
      and s.setting_value::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  name_map as (
    select
      replace(s.setting_key, 'club_name:', '')::uuid as club_id,
      nullif(trim(s.setting_value::text), '') as club_name
    from public.app_secure_settings s
    where s.setting_key like 'club_name:%'
      and replace(s.setting_key, 'club_name:', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  clubs as (
    select distinct club_id from public.club_user_roles
    union
    select distinct club_id from public.club_members
    union
    select distinct club_id from public.club_member_identities
    union
    select distinct club_id from code_map
    union
    select distinct club_id from name_map
  ),
  role_users as (
    select
      cur.club_id,
      cur.user_id
    from public.club_user_roles cur
    where cur.role_key in ('member', 'vorstand', 'admin')
    group by cur.club_id, cur.user_id
  ),
  identity_gap_counts as (
    select
      ru.club_id,
      count(*)::int as identity_gaps
    from role_users ru
    left join public.club_member_identities cmi
      on cmi.club_id = ru.club_id
     and cmi.user_id = ru.user_id
    where cmi.user_id is null
    group by ru.club_id
  ),
  roles_without_membership_counts as (
    select
      ru.club_id,
      count(*)::int as roles_without_membership
    from role_users ru
    left join public.club_member_identities cmi
      on cmi.club_id = ru.club_id
     and cmi.user_id = ru.user_id
    left join public.club_members cm
      on cm.club_id = ru.club_id
     and cm.member_no = cmi.member_no
    where cm.member_no is null
    group by ru.club_id
  ),
  duplicate_identities_counts as (
    select
      d.club_id,
      sum(d.extra_rows)::int as duplicate_identities
    from (
      select
        cmi.club_id,
        greatest(count(*) - 1, 0) as extra_rows
      from public.club_member_identities cmi
      group by cmi.club_id, cmi.user_id
      having count(*) > 1
      union all
      select
        cmi.club_id,
        greatest(count(*) - 1, 0) as extra_rows
      from public.club_member_identities cmi
      group by cmi.club_id, cmi.member_no
      having count(*) > 1
    ) d
    group by d.club_id
  ),
  members_without_identity_counts as (
    select
      cm.club_id,
      count(*)::int as members_without_identity_link
    from public.club_members cm
    left join public.club_member_identities cmi
      on cmi.club_id = cm.club_id
     and cmi.member_no = cm.member_no
    where cmi.user_id is null
    group by cm.club_id
  )
  select
    c.club_id,
    cm.club_code,
    nm.club_name,
    coalesce(ig.identity_gaps, 0) as identity_gaps,
    coalesce(rwm.roles_without_membership, 0) as roles_without_membership,
    coalesce(di.duplicate_identities, 0) as duplicate_identities,
    coalesce(mwi.members_without_identity_link, 0) as members_without_identity_link,
    case when nullif(trim(coalesce(cm.club_code, '')), '') is null or nullif(trim(coalesce(nm.club_name, '')), '') is null then 1 else 0 end as club_name_or_code_missing,
    (
      coalesce(ig.identity_gaps, 0)
      + coalesce(rwm.roles_without_membership, 0)
      + coalesce(di.duplicate_identities, 0)
      + coalesce(mwi.members_without_identity_link, 0)
      + case when nullif(trim(coalesce(cm.club_code, '')), '') is null or nullif(trim(coalesce(nm.club_name, '')), '') is null then 1 else 0 end
    )::int as total_issues,
    case
      when coalesce(di.duplicate_identities, 0) > 0
        or coalesce(rwm.roles_without_membership, 0) > 0
        then 'red'
      when coalesce(ig.identity_gaps, 0) > 0
        or coalesce(mwi.members_without_identity_link, 0) > 0
        or nullif(trim(coalesce(cm.club_code, '')), '') is null
        or nullif(trim(coalesce(nm.club_name, '')), '') is null
        then 'yellow'
      else 'green'
    end as health_status
  from clubs c
  left join code_map cm on cm.club_id = c.club_id
  left join name_map nm on nm.club_id = c.club_id
  left join identity_gap_counts ig on ig.club_id = c.club_id
  left join roles_without_membership_counts rwm on rwm.club_id = c.club_id
  left join duplicate_identities_counts di on di.club_id = c.club_id
  left join members_without_identity_counts mwi on mwi.club_id = c.club_id
  where auth.uid() is not null
    and (
      public.is_admin_in_any_club()
      or exists (
        select 1
        from public.club_user_roles cur
        where cur.user_id = auth.uid()
          and cur.club_id = c.club_id
      )
    )
  order by
    case
      when (
        coalesce(di.duplicate_identities, 0) > 0
        or coalesce(rwm.roles_without_membership, 0) > 0
      ) then 1
      when (
        coalesce(ig.identity_gaps, 0) > 0
        or coalesce(mwi.members_without_identity_link, 0) > 0
        or nullif(trim(coalesce(cm.club_code, '')), '') is null
        or nullif(trim(coalesce(nm.club_name, '')), '') is null
      ) then 2
      else 3
    end,
    cm.club_code nulls last,
    c.club_id;
$$;

create or replace function public.governance_health_issues(p_club_id uuid default null)
returns table (
  rule_key text,
  club_id uuid,
  club_code text,
  club_name text,
  ref_1 text,
  ref_2 text,
  detail text
)
language sql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
  with code_map as (
    select
      s.setting_value::uuid as club_id,
      upper(trim(replace(s.setting_key, 'club_code_map:', ''))) as club_code
    from public.app_secure_settings s
    where s.setting_key like 'club_code_map:%'
      and upper(trim(replace(s.setting_key, 'club_code_map:', ''))) ~ '^[A-Z]{2}[0-9]{2}$'
      and s.setting_value::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  name_map as (
    select
      replace(s.setting_key, 'club_name:', '')::uuid as club_id,
      nullif(trim(s.setting_value::text), '') as club_name
    from public.app_secure_settings s
    where s.setting_key like 'club_name:%'
      and replace(s.setting_key, 'club_name:', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  clubs as (
    select distinct club_id from public.club_user_roles
    union
    select distinct club_id from public.club_members
    union
    select distinct club_id from public.club_member_identities
    union
    select distinct club_id from code_map
    union
    select distinct club_id from name_map
  ),
  visible_clubs as (
    select c.club_id
    from clubs c
    where auth.uid() is not null
      and (
        public.is_admin_in_any_club()
        or exists (
          select 1
          from public.club_user_roles cur
          where cur.user_id = auth.uid()
            and cur.club_id = c.club_id
        )
      )
      and (p_club_id is null or c.club_id = p_club_id)
  )
  select
    x.rule_key,
    x.club_id,
    cm.club_code,
    nm.club_name,
    x.ref_1,
    x.ref_2,
    x.detail
  from (
    select
      'identity_gaps'::text as rule_key,
      ru.club_id,
      ru.user_id::text as ref_1,
      null::text as ref_2,
      'core role user without club_member_identities row'::text as detail
    from public.club_user_roles ru
    join visible_clubs vc on vc.club_id = ru.club_id
    left join public.club_member_identities cmi
      on cmi.club_id = ru.club_id
     and cmi.user_id = ru.user_id
    where ru.role_key in ('member', 'vorstand', 'admin')
      and cmi.user_id is null

    union all

    select
      'roles_without_membership'::text as rule_key,
      ru.club_id,
      ru.user_id::text as ref_1,
      coalesce(cmi.member_no, '-') as ref_2,
      'role user without valid club_members row'::text as detail
    from public.club_user_roles ru
    join visible_clubs vc on vc.club_id = ru.club_id
    left join public.club_member_identities cmi
      on cmi.club_id = ru.club_id
     and cmi.user_id = ru.user_id
    left join public.club_members cm2
      on cm2.club_id = ru.club_id
     and cm2.member_no = cmi.member_no
    where ru.role_key in ('member', 'vorstand', 'admin')
      and cm2.member_no is null

    union all

    select
      'duplicate_identities'::text as rule_key,
      d.club_id,
      d.ref_1,
      d.ref_2,
      d.detail
    from (
      select
        cmi.club_id,
        cmi.user_id::text as ref_1,
        null::text as ref_2,
        'duplicate club_id+user_id rows in club_member_identities'::text as detail
      from public.club_member_identities cmi
      join visible_clubs vc on vc.club_id = cmi.club_id
      group by cmi.club_id, cmi.user_id
      having count(*) > 1
      union all
      select
        cmi.club_id,
        null::text as ref_1,
        cmi.member_no as ref_2,
        'duplicate club_id+member_no rows in club_member_identities'::text as detail
      from public.club_member_identities cmi
      join visible_clubs vc on vc.club_id = cmi.club_id
      group by cmi.club_id, cmi.member_no
      having count(*) > 1
    ) d

    union all

    select
      'members_without_identity_link'::text as rule_key,
      cm2.club_id,
      cm2.member_no as ref_1,
      null::text as ref_2,
      'club_members row without identity link'::text as detail
    from public.club_members cm2
    join visible_clubs vc on vc.club_id = cm2.club_id
    left join public.club_member_identities cmi
      on cmi.club_id = cm2.club_id
     and cmi.member_no = cm2.member_no
    where cmi.user_id is null

    union all

    select
      'club_name_or_code_missing'::text as rule_key,
      vc.club_id,
      coalesce(cm.club_code, '-') as ref_1,
      coalesce(nm.club_name, '-') as ref_2,
      'club code or club name missing in app_secure_settings'::text as detail
    from visible_clubs vc
    left join code_map cm on cm.club_id = vc.club_id
    left join name_map nm on nm.club_id = vc.club_id
    where nullif(trim(coalesce(cm.club_code, '')), '') is null
       or nullif(trim(coalesce(nm.club_name, '')), '') is null
  ) x
  left join code_map cm on cm.club_id = x.club_id
  left join name_map nm on nm.club_id = x.club_id
  order by x.club_id, x.rule_key, x.ref_1 nulls last, x.ref_2 nulls last;
$$;

revoke all on function public.governance_health_snapshot() from public, anon, authenticated;
grant execute on function public.governance_health_snapshot() to authenticated;
grant execute on function public.governance_health_snapshot() to service_role;

revoke all on function public.governance_health_issues(uuid) from public, anon, authenticated;
grant execute on function public.governance_health_issues(uuid) to authenticated;
grant execute on function public.governance_health_issues(uuid) to service_role;

commit;
