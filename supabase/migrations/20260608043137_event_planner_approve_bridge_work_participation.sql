-- Bruecke: Freigabe einer Helfer-Anmeldung im Eventplaner 2.0 -> Teilnahme-/Stundenlogik.
-- Live angewandt am 2026-06-08 (supabase_migrations.version 20260608043137).
-- Beim Approve einer event_planner_registration mit work_event-Basis wird eine
-- work_participations-Zeile (status 'registered') am Basis-Arbeitseinsatz erzeugt.
-- Idempotent (ON CONFLICT DO NOTHING); bestehende, fortgeschrittene Teilnahme bleibt unveraendert.
-- club_id wird durch den vorhandenen Trigger ensure_row_club_id gesetzt.

CREATE OR REPLACE FUNCTION public.event_planner_registration_approve(p_registration_id uuid, p_note_admin text DEFAULT NULL::text)
 RETURNS event_planner_registrations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
declare
  v_row public.event_planner_registrations;
  v_cfg public.event_planner_configs;
begin
  select * into v_row
  from public.event_planner_registrations
  where id = p_registration_id;

  if v_row.id is null then
    raise exception 'Planner registration not found';
  end if;

  if not public.is_admin_or_vorstand_in_club(v_row.club_id) then
    raise exception 'Only vorstand/admin can approve planner registrations';
  end if;

  update public.event_planner_registrations
  set status = 'approved',
      note_admin = coalesce(nullif(trim(coalesce(p_note_admin, '')), ''), note_admin),
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
  where id = p_registration_id
  returning * into v_row;

  -- Bruecke (2026-06-08): freigegebene Helfer-Anmeldung -> Teilnahme-/Stundenlogik
  -- am Basis-Arbeitseinsatz. Nur work_event-Basis; idempotent; eine bereits
  -- fortgeschrittene Teilnahme (checked_in/approved/...) bleibt unveraendert.
  -- club_id wird durch Trigger ensure_row_club_id aus event_id/auth_uid gesetzt.
  select * into v_cfg
  from public.event_planner_configs
  where id = v_row.planner_config_id;

  if v_cfg.id is not null
     and v_cfg.base_kind = 'work_event'
     and v_cfg.base_work_event_id is not null
     and v_row.auth_uid is not null then
    insert into public.work_participations (event_id, auth_uid, status)
    values (v_cfg.base_work_event_id, v_row.auth_uid, 'registered')
    on conflict (event_id, auth_uid) do nothing;
  end if;

  return v_row;
end;
$function$;
