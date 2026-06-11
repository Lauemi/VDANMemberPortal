-- =============================================================
-- P4 Mitgliederabrechnung — Block 1: Datenmodell-Fundament
-- =============================================================
-- Scope: P4 = Verein → Mitglied (Beitragsabrechnung)
--   KEIN Bezug zu P6/Stripe/club_billing_subscriptions.
--
-- Neue Tabellen:
--   club_billing_positions     — konfigurierbare Beitragsarten pro Verein
--   member_billing_exemptions  — individuelle Befreiungen pro Mitglied
--   club_sepa_config           — Vereins-SEPA-Konfiguration (Gläubiger, Club-IBAN)
--   billing_runs               — Snapshot-Kopf eines Abrechnungslaufs
--   billing_run_items          — Snapshot-Positionen pro Mitglied je Lauf
--
-- Erweiterungen:
--   member_bank_data           — sepa_mandate_ref + sepa_mandate_date ergänzt
--                                (IBAN/BIC/account_holder bereits vorhanden)
--
-- RLS-Strategie:
--   Neue Tabellen: service_role = full, authenticated = admin_or_vorstand_in_club.
--   member_bank_data: bestehende Policy bleibt — nur ADD COLUMN, kein Policy-Eingriff.
-- =============================================================

begin;

-- ------------------------------------------------------------------
-- 1. club_billing_positions — Beitragsarten-Konfiguration pro Verein
-- ------------------------------------------------------------------
-- Lebende Konfiguration (nicht historisch).
-- Snapshot-Wahrheit = billing_run_items.positions_json.
-- P4-exklusiv: kein Bezug zu Stripe, P6 oder card prices.

create table if not exists public.club_billing_positions (
  id               uuid        primary key default gen_random_uuid(),
  club_id          uuid        not null references public.club_core(id) on delete cascade,
  name             text        not null,
  period_from      text        not null,   -- 'MM-DD', z.B. '01-01'
  period_to        text        not null,   -- 'MM-DD', z.B. '12-31'
  amount_default   numeric(10,2) not null check (amount_default >= 0),
  amount_youth     numeric(10,2) check (amount_youth >= 0),   -- NULL = inherit from amount_default
  amount_honorary  numeric(10,2) check (amount_honorary >= 0), -- NULL = inherit; 0 = befreit
  is_active        boolean     not null default true,
  sort_order       integer     not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists club_billing_positions_club_id_idx
  on public.club_billing_positions (club_id);

create index if not exists club_billing_positions_club_active_idx
  on public.club_billing_positions (club_id, is_active);

comment on table public.club_billing_positions is
  'P4: Konfigurierbare Beitragsarten pro Verein (Verein→Mitglied). Lebende Konfiguration — '
  'Snapshot-Wahrheit liegt in billing_run_items. KEIN Bezug zu P6/Stripe.';

alter table public.club_billing_positions enable row level security;

drop policy if exists "cbp_service_role_all"   on public.club_billing_positions;
drop policy if exists "cbp_admin_select"        on public.club_billing_positions;
drop policy if exists "cbp_admin_modify"        on public.club_billing_positions;

create policy "cbp_service_role_all"
  on public.club_billing_positions
  for all to service_role
  using (true) with check (true);

create policy "cbp_admin_select"
  on public.club_billing_positions
  for select to authenticated
  using (public.is_admin_or_vorstand_in_club(club_id));

create policy "cbp_admin_modify"
  on public.club_billing_positions
  for all to authenticated
  using (public.is_admin_or_vorstand_in_club(club_id))
  with check (public.is_admin_or_vorstand_in_club(club_id));

-- ------------------------------------------------------------------
-- 2. member_billing_exemptions — individuelle Befreiungen
-- ------------------------------------------------------------------
-- Ebene 2: Einzelnes Mitglied von einer Position befreit.
-- Ebene 1 (Gruppe) = amount_honorary / amount_youth in club_billing_positions.

create table if not exists public.member_billing_exemptions (
  id                    uuid    primary key default gen_random_uuid(),
  club_id               uuid    not null references public.club_core(id) on delete cascade,
  member_id             uuid    not null references public.club_members(id) on delete cascade,
  billing_position_id   uuid    not null references public.club_billing_positions(id) on delete cascade,
  is_exempt             boolean not null default true,
  reason                text,
  created_at            timestamptz not null default now(),
  unique (member_id, billing_position_id)
);

create index if not exists member_billing_exemptions_club_idx
  on public.member_billing_exemptions (club_id);

create index if not exists member_billing_exemptions_member_idx
  on public.member_billing_exemptions (member_id);

comment on table public.member_billing_exemptions is
  'P4: Individuelle Befreiung eines Mitglieds von einer Beitragsart. '
  'Überschreibt Gruppenpreis (is_youth/honorary). Priorität: Einzelbefreiung > Gruppenpreis > Generell.';

alter table public.member_billing_exemptions enable row level security;

drop policy if exists "mbe_service_role_all" on public.member_billing_exemptions;
drop policy if exists "mbe_admin_select"     on public.member_billing_exemptions;
drop policy if exists "mbe_admin_modify"     on public.member_billing_exemptions;

create policy "mbe_service_role_all"
  on public.member_billing_exemptions
  for all to service_role
  using (true) with check (true);

create policy "mbe_admin_select"
  on public.member_billing_exemptions
  for select to authenticated
  using (public.is_admin_or_vorstand_in_club(club_id));

create policy "mbe_admin_modify"
  on public.member_billing_exemptions
  for all to authenticated
  using (public.is_admin_or_vorstand_in_club(club_id))
  with check (public.is_admin_or_vorstand_in_club(club_id));

-- ------------------------------------------------------------------
-- 3. member_bank_data — sepa_mandate_ref + sepa_mandate_date ergänzen
-- ------------------------------------------------------------------
-- IBAN bereits verschlüsselt (iban_encrypted bytea, pgp_sym_encrypt AES-256).
-- BIC + account_holder bereits vorhanden.
-- sepa_approved bereits in club_members als boolean.
-- Nur Mandatsfelder fehlen noch.

alter table public.member_bank_data
  add column if not exists sepa_mandate_ref  text,
  add column if not exists sepa_mandate_date date;

comment on column public.member_bank_data.sepa_mandate_ref  is
  'Eindeutige SEPA-Mandatsreferenz (Gläubiger-vergeben, z.B. CLUBCODE-MEMBERNO-JAHR).';
comment on column public.member_bank_data.sepa_mandate_date is
  'Datum der Mandatserteilung (Unterschrift des Mitglieds).';

-- Bestehende RLS-Policy bleibt unverändert:
--   member_bank_data_admin_all: ALL für is_admin_or_vorstand_in_club(club_id) OR fcp_is_superadmin()
-- Kein Eingriff notwendig.

-- ------------------------------------------------------------------
-- 4. club_sepa_config — Vereins-SEPA-Konfiguration
-- ------------------------------------------------------------------
-- Folgt dem club_billing_subscriptions-Pattern (separate financial config table).
-- Club-IBAN verschlüsselt (pgp_sym_encrypt AES-256, identisch zu member_bank_data).
-- Gläubiger-ID ist nicht sensibel (öffentliche Bundesbank-Kennung).
-- UNIQUE (club_id): ein Datensatz pro Verein.

create table if not exists public.club_sepa_config (
  id                    uuid    primary key default gen_random_uuid(),
  club_id               uuid    not null unique references public.club_core(id) on delete cascade,
  glaeubiger_id         text,                    -- DE98ZZZ... — Bundesbank, nicht sensibel
  club_iban_encrypted   bytea,                   -- pgp_sym_encrypt AES-256
  club_iban_last4       text,                    -- Anzeigehilfe, nicht sensibel
  club_bic              text,                    -- optional seit 2016
  vorankuendigung_tage  integer not null default 14 check (vorankuendigung_tage in (5, 14)),
  bank_portal_url       text,                    -- Link "Zum Banking-Portal →"
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.club_sepa_config is
  'P4: Vereins-SEPA-Konfiguration (Gläubiger-ID, Club-IBAN, Vorankündigungsfrist). '
  'Club-IBAN verschlüsselt. Folgt club_billing_subscriptions-Pattern. KEIN Bezug zu P6.';

alter table public.club_sepa_config enable row level security;

drop policy if exists "csc_service_role_all"  on public.club_sepa_config;
drop policy if exists "csc_admin_select"      on public.club_sepa_config;
drop policy if exists "csc_admin_modify"      on public.club_sepa_config;

create policy "csc_service_role_all"
  on public.club_sepa_config
  for all to service_role
  using (true) with check (true);

create policy "csc_admin_select"
  on public.club_sepa_config
  for select to authenticated
  using (public.is_admin_or_vorstand_in_club(club_id));

create policy "csc_admin_modify"
  on public.club_sepa_config
  for all to authenticated
  using (public.is_admin_or_vorstand_in_club(club_id))
  with check (public.is_admin_or_vorstand_in_club(club_id));

-- ------------------------------------------------------------------
-- 5. billing_runs — Snapshot-Kopf eines Abrechnungslaufs
-- ------------------------------------------------------------------
-- Unveränderlicher Snapshot ab Zeitpunkt des XML-Exports.
-- Status-Kette: draft → exported → submitted → completed | failed
-- XML-Hash sichert Unveränderlichkeit der generierten Datei.

create table if not exists public.billing_runs (
  id               uuid    primary key default gen_random_uuid(),
  club_id          uuid    not null references public.club_core(id) on delete restrict,
  run_year         integer not null check (run_year >= 2020),
  run_label        text,                              -- z.B. "Jahresbeitrag 2026"
  status           text    not null default 'draft'
                            check (status in ('draft','exported','submitted','completed','failed')),
  total_amount     numeric(10,2) check (total_amount >= 0),
  member_count     integer check (member_count >= 0),
  sepa_xml_hash    text,                              -- SHA-256 der pain.008-Datei
  created_by       uuid,                              -- auth.users (kein RLS-FK, nur Audit)
  created_at       timestamptz not null default now(),
  exported_at      timestamptz,                       -- XML heruntergeladen
  submitted_at     timestamptz,                       -- Kassierer: "im Banking-Portal eingereicht"
  completed_at     timestamptz,                       -- Kassierer: "Lastschrift erfolgreich"
  unique (club_id, run_year, run_label)
);

create index if not exists billing_runs_club_id_idx
  on public.billing_runs (club_id);

create index if not exists billing_runs_club_year_idx
  on public.billing_runs (club_id, run_year);

comment on table public.billing_runs is
  'P4: Snapshot-Kopf eines Mitgliederabrechnungslaufs. '
  'Status-Kette: draft→exported→submitted→completed|failed. '
  'Revisionssicher: sepa_xml_hash sichert die erzeugte pain.008. KEIN Bezug zu P6/Stripe.';

alter table public.billing_runs enable row level security;

drop policy if exists "br_service_role_all" on public.billing_runs;
drop policy if exists "br_admin_select"     on public.billing_runs;
drop policy if exists "br_admin_modify"     on public.billing_runs;

create policy "br_service_role_all"
  on public.billing_runs
  for all to service_role
  using (true) with check (true);

create policy "br_admin_select"
  on public.billing_runs
  for select to authenticated
  using (public.is_admin_or_vorstand_in_club(club_id));

create policy "br_admin_modify"
  on public.billing_runs
  for all to authenticated
  using (public.is_admin_or_vorstand_in_club(club_id))
  with check (public.is_admin_or_vorstand_in_club(club_id));

-- ------------------------------------------------------------------
-- 6. billing_run_items — Snapshot-Positionen pro Mitglied je Lauf
-- ------------------------------------------------------------------
-- Snapshot-Wahrheit: member_name + iban_last4 + positions_json sind
-- unveränderliche Aufzeichnung zum Zeitpunkt des Laufs.
-- member_id ist eine Referenz (soft FK), kein harter CASCADE-Delete.
-- Rücklastschrift pro Mitglied: item_status = 'returned' + return_reason.

create table if not exists public.billing_run_items (
  id                        uuid    primary key default gen_random_uuid(),
  billing_run_id            uuid    not null references public.billing_runs(id) on delete cascade,
  club_id                   uuid    not null references public.club_core(id) on delete restrict,
  member_id                 uuid    not null,           -- Referenz auf club_members.id (soft, kein CASCADE)
  member_name_snapshot      text    not null,           -- "Nachname, Vorname" zum Zeitpunkt des Laufs
  member_no_snapshot        text,                       -- Vereinsmitgliedsnummer
  iban_last4_snapshot       text,                       -- Letzte 4 Stellen IBAN (Anzeigehilfe)
  sepa_mandate_ref_snapshot text,                       -- Mandatsreferenz zum Zeitpunkt des Laufs
  price_tier                text    not null default 'default'
                              check (price_tier in ('default','youth','honorary','exempt')),
  positions_json            jsonb   not null,           -- [{name, amount, position_id, ...}]
  total_amount              numeric(10,2) not null check (total_amount >= 0),
  sepa_included             boolean not null default false, -- false = kein gültiges Mandat
  item_status               text    not null default 'calculated'
                              check (item_status in ('calculated','exported','submitted','returned','failed')),
  return_reason             text,                       -- Rücklastschrift-Grund
  created_at                timestamptz not null default now()
);

create index if not exists billing_run_items_run_id_idx
  on public.billing_run_items (billing_run_id);

create index if not exists billing_run_items_club_idx
  on public.billing_run_items (club_id);

create index if not exists billing_run_items_member_idx
  on public.billing_run_items (member_id);

comment on table public.billing_run_items is
  'P4: Snapshot-Positionen pro Mitglied je Abrechnungslauf. '
  'Revisionssichere Aufzeichnung: name/iban_last4/positions_json sind unveränderlich. '
  'Rücklastschrift: item_status=returned + return_reason. KEIN Bezug zu P6.';

alter table public.billing_run_items enable row level security;

drop policy if exists "bri_service_role_all" on public.billing_run_items;
drop policy if exists "bri_admin_select"     on public.billing_run_items;
drop policy if exists "bri_admin_modify"     on public.billing_run_items;

create policy "bri_service_role_all"
  on public.billing_run_items
  for all to service_role
  using (true) with check (true);

create policy "bri_admin_select"
  on public.billing_run_items
  for select to authenticated
  using (public.is_admin_or_vorstand_in_club(club_id));

create policy "bri_admin_modify"
  on public.billing_run_items
  for all to authenticated
  using (public.is_admin_or_vorstand_in_club(club_id))
  with check (public.is_admin_or_vorstand_in_club(club_id));

commit;
