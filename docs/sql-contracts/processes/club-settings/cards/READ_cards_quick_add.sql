-- ZWECK
-- QuickOnboarding-Formular fuer die zentrale Kartenart mit Gruppenregeln beschreiben.
--
-- ERWARTETE SPALTEN
-- title
-- kind
-- is_active
-- standard_is_default
-- standard_price
-- youth_is_default
-- youth_price
-- honorary_is_default
-- honorary_price
--
-- VERWENDET IN ADM:
-- club_settings_cards_quick_add
--
-- JSON-PFAD:
-- docs/masks/templates/Onboarding/ADM_clubSettings.json
--
-- HINWEIS:
-- Produktiver Read laeuft ueber die Edge Function `club-onboarding-workspace`.
-- Das Panel liest die Felder aus `record.workspace.cards_draft.*`.

select
  null::text as title,
  null::text as kind,
  null::boolean as is_active,
  null::boolean as standard_is_default,
  null::numeric as standard_price,
  null::boolean as youth_is_default,
  null::numeric as youth_price,
  null::boolean as honorary_is_default,
  null::numeric as honorary_price;
