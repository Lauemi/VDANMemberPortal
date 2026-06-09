begin;

-- Pflichtstunden-Übersicht je Mitglied (Soll / Ist / Delta)
-- Soll:  Club-Default aus app_secure_settings — kein per-Member-Sollwert
-- Ist:   Summe approved minutes aus work_participations für das Quota-Jahr
--        (abgeleitet aus work_events.starts_at, da quota_year kein Pflichtfeld ist)
-- Delta: Soll - Ist (positiv = noch offen, negativ = Überschuss)
-- Ausnahmen: youth_exempt (role LIKE '%jugend%') + honorary_exempt (role LIKE '%ehren%')

create or replace function public.admin_member_work_hours_overview(
  p_club_id    uuid,
  p_quota_year integer default null
)
returns table (
  member_no      text,
  club_member_no text,
  first_name     text,
  last_name      text,
  role           text,
  is_exempt      boolean,
  soll_minutes   integer,
  ist_minutes    integer,
  delta_minutes  integer
)
language plpgsql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
declare
  v_year     integer;
  v_config   jsonb;
  v_soll_min integer;
begin
  if p_club_id is null then
    raise exception 'club_id_required';
  end if;

  if not (
    public.is_admin_or_vorstand_in_club(p_club_id)
    or public.is_admin_in_any_club()
  ) then
    raise exception 'forbidden_club_scope';
  end if;

  v_year     := coalesce(p_quota_year, extract(year from now())::integer);
  v_config   := public.get_work_hours_config(p_club_id);
  v_soll_min := coalesce((v_config->>'default_hours')::integer, 0) * 60;

  return query
  with member_ist as (
    select
      cmi.member_no,
      coalesce(
        sum(case when wp.status = 'approved' then coalesce(wp.minutes_approved, 0) else 0 end),
        0
      )::integer as ist_minutes
    from public.club_member_identities cmi
    join public.work_participations wp
      on wp.auth_uid = cmi.user_id
     and wp.club_id  = p_club_id
    join public.work_events we
      on we.id = wp.event_id
     and extract(year from we.starts_at)::integer = v_year
    where cmi.club_id = p_club_id
    group by cmi.member_no
  ),
  member_base as (
    select
      cm.member_no,
      coalesce(nullif(trim(cm.club_member_no), ''), cm.member_no) as club_member_no,
      cm.first_name,
      cm.last_name,
      coalesce(nullif(trim(cm.role), ''), 'member') as role,
      (
        (coalesce((v_config->>'youth_exempt')::boolean, false)
          and lower(coalesce(cm.role, '')) like '%jugend%')
        or
        (coalesce((v_config->>'honorary_exempt')::boolean, false)
          and lower(coalesce(cm.role, '')) like '%ehren%')
      ) as is_exempt
    from public.club_members cm
    where cm.club_id = p_club_id
      and cm.status  = 'active'
  )
  select
    mb.member_no,
    mb.club_member_no,
    mb.first_name,
    mb.last_name,
    mb.role,
    mb.is_exempt,
    case when mb.is_exempt then 0 else v_soll_min end,
    coalesce(mi.ist_minutes, 0),
    case when mb.is_exempt
      then 0 - coalesce(mi.ist_minutes, 0)
      else v_soll_min - coalesce(mi.ist_minutes, 0)
    end
  from member_base mb
  left join member_ist mi on mi.member_no = mb.member_no
  order by mb.club_member_no, mb.member_no;
end;
$$;

grant execute on function public.admin_member_work_hours_overview(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
commit;
