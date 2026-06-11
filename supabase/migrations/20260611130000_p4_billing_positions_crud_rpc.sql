-- =============================================================
-- P4 Mitgliederabrechnung — Block 3: Beitragsarten CRUD RPCs
-- =============================================================
-- Scope: P4 = Verein → Mitglied (Beitragsarten-Verwaltung)
--   KEIN Bezug zu P6/Stripe/club_billing_subscriptions.
--
-- Neue RPCs:
--   admin_get_billing_positions   — Lesen aller Positionen für Verein
--   admin_upsert_billing_position — INSERT (id IS NULL) oder UPDATE
-- =============================================================

begin;

-- ------------------------------------------------------------------
-- 1. admin_get_billing_positions — Lesezugriff für ADM-Tabelle
-- ------------------------------------------------------------------
-- Gibt alle Beitragsarten des Vereins zurück, sortiert nach sort_order/name.
-- SECURITY DEFINER + RLS über is_admin_or_vorstand_in_club geprüft.

create or replace function public.admin_get_billing_positions(
  p_club_id uuid
)
returns table (
  id              uuid,
  name            text,
  period_from     text,
  period_to       text,
  amount_default  numeric,
  amount_youth    numeric,
  amount_honorary numeric,
  is_active       boolean,
  sort_order      integer,
  created_at      timestamptz,
  updated_at      timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select
    id, name, period_from, period_to,
    amount_default, amount_youth, amount_honorary,
    is_active, sort_order, created_at, updated_at
  from public.club_billing_positions
  where club_id = p_club_id
  order by sort_order asc, name asc;
$$;

revoke all on function public.admin_get_billing_positions(uuid) from public;
grant execute on function public.admin_get_billing_positions(uuid) to authenticated;
grant execute on function public.admin_get_billing_positions(uuid) to service_role;

comment on function public.admin_get_billing_positions(uuid) is
  'P4: Gibt alle Beitragsarten (club_billing_positions) eines Vereins zurück. '
  'Aufruf via ADM-Maske ADM_mitgliederabrechnung.json Tab Beitragsarten.';

-- ------------------------------------------------------------------
-- 2. admin_upsert_billing_position — INSERT oder UPDATE
-- ------------------------------------------------------------------
-- INSERT: id IS NULL → neue Position anlegen
-- UPDATE: id IS NOT NULL → bestehende Position überschreiben
--
-- Payload-Parameter entsprechen direkt den column.key-Werten des
-- ADM-JSON (kein p_-Präfix für Felder, um Mapping-Overhead zu vermeiden).
-- p_club_id kommt aus savePayloadDefaults (club context, immer gesetzt).
--
-- Sicherheitscheck: is_admin_or_vorstand_in_club(p_club_id).
-- Ownership-Check bei UPDATE: club_id muss zu p_club_id passen.

create or replace function public.admin_upsert_billing_position(
  p_club_id       uuid,
  id              uuid    default null,
  name            text    default null,
  period_from     text    default null,
  period_to       text    default null,
  amount_default  numeric default null,
  amount_youth    numeric default null,
  amount_honorary numeric default null,
  is_active       boolean default true,
  sort_order      integer default 0
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  -- Zugangsprüfung
  if not public.is_admin_or_vorstand_in_club(p_club_id) then
    raise exception 'Zugriff verweigert';
  end if;

  -- Pflichtfeld-Validierung
  if name is null or trim(name) = '' then
    raise exception 'Name ist erforderlich';
  end if;
  if amount_default is null then
    raise exception 'Standardbetrag ist erforderlich';
  end if;
  if period_from is null or trim(period_from) = '' then
    raise exception 'Zeitraum-Von ist erforderlich';
  end if;
  if period_to is null or trim(period_to) = '' then
    raise exception 'Zeitraum-Bis ist erforderlich';
  end if;

  if admin_upsert_billing_position.id is null then
    -- INSERT: neue Beitragsart anlegen
    insert into public.club_billing_positions (
      club_id, name, period_from, period_to,
      amount_default, amount_youth, amount_honorary,
      is_active, sort_order
    ) values (
      p_club_id,
      trim(admin_upsert_billing_position.name),
      trim(admin_upsert_billing_position.period_from),
      trim(admin_upsert_billing_position.period_to),
      admin_upsert_billing_position.amount_default,
      admin_upsert_billing_position.amount_youth,
      admin_upsert_billing_position.amount_honorary,
      coalesce(admin_upsert_billing_position.is_active, true),
      coalesce(admin_upsert_billing_position.sort_order, 0)
    )
    returning to_jsonb(club_billing_positions.*) into v_result;
  else
    -- UPDATE: Ownership prüfen, dann überschreiben
    if not exists (
      select 1 from public.club_billing_positions cbp
      where cbp.id = admin_upsert_billing_position.id
        and cbp.club_id = p_club_id
    ) then
      raise exception 'Eintrag nicht gefunden oder Zugriff verweigert';
    end if;

    update public.club_billing_positions set
      name            = trim(admin_upsert_billing_position.name),
      period_from     = trim(admin_upsert_billing_position.period_from),
      period_to       = trim(admin_upsert_billing_position.period_to),
      amount_default  = admin_upsert_billing_position.amount_default,
      amount_youth    = admin_upsert_billing_position.amount_youth,
      amount_honorary = admin_upsert_billing_position.amount_honorary,
      is_active       = coalesce(admin_upsert_billing_position.is_active, true),
      sort_order      = coalesce(admin_upsert_billing_position.sort_order, 0),
      updated_at      = now()
    where id = admin_upsert_billing_position.id
      and club_id = p_club_id
    returning to_jsonb(club_billing_positions.*) into v_result;
  end if;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke all on function public.admin_upsert_billing_position(
  uuid, uuid, text, text, text, numeric, numeric, numeric, boolean, integer
) from public;
grant execute on function public.admin_upsert_billing_position(
  uuid, uuid, text, text, text, numeric, numeric, numeric, boolean, integer
) to authenticated;
grant execute on function public.admin_upsert_billing_position(
  uuid, uuid, text, text, text, numeric, numeric, numeric, boolean, integer
) to service_role;

comment on function public.admin_upsert_billing_position(
  uuid, uuid, text, text, text, numeric, numeric, numeric, boolean, integer
) is
  'P4: INSERT (id=NULL) oder UPDATE einer Beitragsart in club_billing_positions. '
  'Payload-Keys entsprechen column.key im ADM-JSON (kein p_-Präfix). '
  'p_club_id kommt aus savePayloadDefaults (club context). KEIN Bezug zu P6.';

commit;
