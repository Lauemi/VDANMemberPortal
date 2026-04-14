begin;
create or replace function public.governance_health_ci_gate(p_fail_on_yellow boolean default false)
returns table (
  passed boolean,
  red_clubs integer,
  yellow_clubs integer,
  green_clubs integer,
  total_clubs integer,
  total_issues integer,
  fail_reason text,
  evaluated_at timestamptz
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
  ),
  health as (
    select
      c.club_id,
      coalesce(ig.identity_gaps, 0) as identity_gaps,
      coalesce(rwm.roles_without_membership, 0) as roles_without_membership,
      coalesce(di.duplicate_identities, 0) as duplicate_identities,
      coalesce(mwi.members_without_identity_link, 0) as members_without_identity_link,
      case when nullif(trim(coalesce(cm.club_code, '')), '') is null or nullif(trim(coalesce(nm.club_name, '')), '') is null then 1 else 0 end as club_name_or_code_missing,
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
  ),
  agg as (
    select
      count(*) filter (where health_status = 'red')::int as red_clubs,
      count(*) filter (where health_status = 'yellow')::int as yellow_clubs,
      count(*) filter (where health_status = 'green')::int as green_clubs,
      count(*)::int as total_clubs,
      sum(identity_gaps + roles_without_membership + duplicate_identities + members_without_identity_link + club_name_or_code_missing)::int as total_issues
    from health
  )
  select
    case
      when a.red_clubs > 0 then false
      when p_fail_on_yellow and a.yellow_clubs > 0 then false
      else true
    end as passed,
    a.red_clubs,
    a.yellow_clubs,
    a.green_clubs,
    a.total_clubs,
    coalesce(a.total_issues, 0) as total_issues,
    case
      when a.red_clubs > 0 then 'RED_CLUBS_PRESENT'
      when p_fail_on_yellow and a.yellow_clubs > 0 then 'YELLOW_CLUBS_PRESENT'
      else null
    end as fail_reason,
    now() as evaluated_at
  from agg a;
$$;
revoke all on function public.governance_health_ci_gate(boolean) from public, anon, authenticated;
grant execute on function public.governance_health_ci_gate(boolean) to service_role;
grant execute on function public.governance_health_ci_gate(boolean) to postgres;
commit;
