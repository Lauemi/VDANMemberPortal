-- =============================================================
-- P4 Mitgliederabrechnung — Block 4: Kassierer-Übersicht RPC
-- =============================================================
-- Scope: P4 = Verein → Mitglied (Kassierer-Vorschau)
--   KEIN Bezug zu P6/Stripe/club_billing_subscriptions.
--
-- Architektur-Entscheidung:
--   Dieser RPC ist eine LIVE-VORSCHAU — kein Snapshot, kein billing_run.
--   billing_runs/billing_run_items werden erst bei Block 5 "Lauf erzeugen" befüllt.
--   Preisstufen-Priorität: Einzelbefreiung > Jugend/Ehren > Generell (Spec §4.2).
--
-- Preisstufen-Logik:
--   1. member_billing_exemptions.is_exempt = true → exempt (0 €)
--   2. cm.is_youth = true OR role LIKE '%jugend%'  → amount_youth (COALESCE amount_default)
--   3. role LIKE '%ehren%'                         → amount_honorary (COALESCE amount_default)
--   4. sonst                                        → amount_default
--
-- SEPA-Status (nur Anzeige, kein Export):
--   vollständig        = sepa_approved + mandat_ref + iban vorhanden
--   mandat_genehmigt   = sepa_approved + bankdaten vorhanden
--   genehmigt_keine_iban = sepa_approved, aber kein member_bank_data-Eintrag
--   bankdaten_kein_mandat = bankdaten vorhanden, aber sepa_approved = false
--   kein_sepa          = kein Mandat, keine Bankdaten
-- =============================================================

begin;

create or replace function public.admin_get_billing_preview(
  p_club_id  uuid,
  p_run_year integer default extract(year from now())::integer
)
returns table (
  member_id        uuid,
  club_member_no   text,
  last_name        text,
  first_name       text,
  price_tier       text,
  total_amount     numeric,
  sepa_status      text,
  iban_last4       text,
  sepa_mandate_ref text,
  positions_json   jsonb
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin_or_vorstand_in_club(p_club_id) then
    raise exception 'Zugriff verweigert';
  end if;

  return query
  with
  -- Nur aktive Beitragsarten dieses Vereins
  active_pos as (
    select id, name, amount_default, amount_youth, amount_honorary
    from public.club_billing_positions
    where club_id = p_club_id and is_active = true
  ),
  -- Individuelle Befreiungen (is_exempt = true) aus Block 1
  exemptions as (
    select member_id, billing_position_id
    from public.member_billing_exemptions
    where club_id = p_club_id and is_exempt = true
  ),
  -- Bankdaten (nur anzeigen, keine Entschlüsselung)
  bank as (
    select
      mbd.member_id,
      mbd.iban_last4,
      mbd.sepa_mandate_ref
    from public.member_bank_data mbd
    where mbd.club_id = p_club_id
  ),
  -- Pro Mitglied × Position: Preisstufe und Betrag berechnen
  member_pos as (
    select
      cm.id                   as member_id,
      cm.club_member_no,
      cm.last_name,
      cm.first_name,
      cm.sepa_approved,
      ap.id                   as position_id,
      ap.name                 as position_name,
      -- Preisstufe (Priorität: Einzelbefreiung > Jugend/Ehren > Standard)
      case
        when e.member_id is not null
          then 'exempt'
        when cm.is_youth or lower(coalesce(cm.role, '')) like '%jugend%'
          then 'youth'
        when lower(coalesce(cm.role, '')) like '%ehren%'
          then 'honorary'
        else 'default'
      end as pos_tier,
      -- Betrag nach Preisstufe
      case
        when e.member_id is not null
          then 0::numeric
        when cm.is_youth or lower(coalesce(cm.role, '')) like '%jugend%'
          then coalesce(ap.amount_youth, ap.amount_default)
        when lower(coalesce(cm.role, '')) like '%ehren%'
          then coalesce(ap.amount_honorary, ap.amount_default)
        else ap.amount_default
      end as pos_amount
    from public.club_members cm
    cross join active_pos ap
    left join exemptions e
      on e.member_id = cm.id and e.billing_position_id = ap.id
    where cm.club_id = p_club_id
      and cm.status = 'active'
  ),
  -- Pro Mitglied: Summe + Positionen-JSON aggregieren
  member_totals as (
    select
      mp.member_id,
      mp.club_member_no,
      mp.last_name,
      mp.first_name,
      mp.sepa_approved,
      -- Übergreifende Preisstufe: wenn alle exempt → exempt, sonst höchste Stufe
      case
        when count(*) = count(*) filter (where mp.pos_tier = 'exempt') then 'exempt'
        when bool_or(mp.pos_tier = 'youth')    then 'youth'
        when bool_or(mp.pos_tier = 'honorary') then 'honorary'
        else 'default'
      end as price_tier,
      sum(mp.pos_amount)::numeric(10,2) as total_amount,
      jsonb_agg(
        jsonb_build_object(
          'label',       mp.position_name || ' (' || to_char(mp.pos_amount, 'FM999990.00') || ' €)',
          'name',        mp.position_name,
          'amount',      mp.pos_amount,
          'tier',        mp.pos_tier,
          'position_id', mp.position_id
        )
        order by mp.position_name
      ) as positions_json
    from member_pos mp
    group by mp.member_id, mp.club_member_no, mp.last_name, mp.first_name, mp.sepa_approved
  )
  select
    mt.member_id,
    mt.club_member_no,
    mt.last_name,
    mt.first_name,
    mt.price_tier,
    mt.total_amount,
    -- SEPA-Status (nur Anzeige, kein Export)
    case
      when mt.sepa_approved
           and b.sepa_mandate_ref is not null
           and b.iban_last4 is not null
        then 'vollständig'
      when mt.sepa_approved
           and b.member_id is not null
        then 'mandat_genehmigt'
      when mt.sepa_approved
        then 'genehmigt_keine_iban'
      when b.member_id is not null
        then 'bankdaten_kein_mandat'
      else 'kein_sepa'
    end as sepa_status,
    b.iban_last4,
    b.sepa_mandate_ref,
    mt.positions_json
  from member_totals mt
  left join bank b on b.member_id = mt.member_id
  order by mt.total_amount desc nulls last, mt.last_name, mt.first_name;
end;
$$;

revoke all on function public.admin_get_billing_preview(uuid, integer) from public;
grant execute on function public.admin_get_billing_preview(uuid, integer) to authenticated;
grant execute on function public.admin_get_billing_preview(uuid, integer) to service_role;

comment on function public.admin_get_billing_preview(uuid, integer) is
  'P4: Live-Vorschau der Mitgliederabrechnung pro aktivem Mitglied. '
  'Kein billing_run — reine Berechnung auf club_billing_positions + Befreiungen. '
  'Preisstufe: Einzelbefreiung > Jugend/Ehren > Standard. '
  'SEPA-Status: nur Anzeige, kein Export. KEIN Bezug zu P6/Stripe.';

commit;
