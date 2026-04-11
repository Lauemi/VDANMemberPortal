-- ZWECK
-- Kartenarten-Konfiguration fuer ClubSettings mit abgeleiteten Gruppenregeln beschreiben.
--
-- ERWARTETE SPALTEN
-- title
-- kind
-- standard_default
-- standard_price
-- youth_default
-- youth_price
-- honorary_default
-- honorary_price
--
-- VERWENDET IN ADM:
-- club_settings_cards_config_table
--
-- JSON-PFAD:
-- docs/masks/templates/Onboarding/ADM_clubSettings.json
--
-- HINWEIS:
-- Produktiver Read laeuft ueber die Edge Function `club-onboarding-workspace`
-- und nutzt dort `record.workspace.cards` als rowsPath.

select
  title,
  kind,
  standard_default,
  standard_price,
  youth_default,
  youth_price,
  honorary_default,
  honorary_price
from (
  values
    (
      null::text,
      null::text,
      null::boolean,
      null::numeric,
      null::boolean,
      null::numeric,
      null::boolean,
      null::numeric
    )
) as expected_rows(
  title,
  kind,
  standard_default,
  standard_price,
  youth_default,
  youth_price,
  honorary_default,
  honorary_price
);
