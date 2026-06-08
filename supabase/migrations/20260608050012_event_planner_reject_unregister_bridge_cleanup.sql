-- Symmetrie zur Approve-Bruecke: Ruecknahme einer Helfer-Anmeldung im Eventplaner 2.0.
-- Live angewandt am 2026-06-08 (supabase_migrations.version 20260608050012).
-- Beim Reject (Manager) bzw. Unregister (Mitglied/Manager) einer event_planner_registration
-- mit work_event-Basis wird die durch die Approve-Bruecke erzeugte work_participations-Zeile
-- NUR dann geloescht, wenn sie noch status='registered' ist.
-- checked_in / approved / Stunden / Freigaben bleiben unberuehrt. Minimaler, symmetrischer Eingriff.

CREATE OR REPLACE FUNCTION public.event_planner_registration_reject(p_registration_id uuid, p_note_admin text DEFAULT NULL::text)
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
    raise exception 'Only vorstand/admin can reject planner registrations';
  end if;

  update public.event_planner_registrations
  set status = 'rejected',
      note_admin = coalesce(nullif(trim(coalesce(p_note_admin, '')), ''), note_admin),
      approved_by = null,
      approved_at = null,
      updated_at = now()
  where id = p_registration_id
  returning * into v_row;

  -- Symmetrie zur Approve-Bruecke (2026-06-08): nur die noch nicht angetretene
  -- (status='registered') Teilnahme zuruecknehmen; checked_in/approved/Stunden bleiben unberuehrt.
  select * into v_cfg
  from public.event_planner_configs
  where id = v_row.planner_config_id;

  if v_cfg.id is not null
     and v_cfg.base_kind = 'work_event'
     and v_cfg.base_work_event_id is not null
     and v_row.auth_uid is not null then
    delete from public.work_participations
    where event_id = v_cfg.base_work_event_id
      and auth_uid = v_row.auth_uid
      and status = 'registered';
  end if;

  return v_row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.event_planner_unregister(p_registration_id uuid)
 RETURNS void
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

  if v_row.auth_uid <> auth.uid() and not public.is_admin_or_vorstand_in_club(v_row.club_id) then
    raise exception 'Only the member or a manager may remove this registration';
  end if;

  delete from public.event_planner_registrations
  where id = p_registration_id;

  -- Symmetrie zur Approve-Bruecke (2026-06-08): nur die noch nicht angetretene
  -- (status='registered') Teilnahme zuruecknehmen; checked_in/approved/Stunden bleiben unberuehrt.
  select * into v_cfg
  from public.event_planner_configs
  where id = v_row.planner_config_id;

  if v_cfg.id is not null
     and v_cfg.base_kind = 'work_event'
     and v_cfg.base_work_event_id is not null
     and v_row.auth_uid is not null then
    delete from public.work_participations
    where event_id = v_cfg.base_work_event_id
      and auth_uid = v_row.auth_uid
      and status = 'registered';
  end if;
end;
$function$;
