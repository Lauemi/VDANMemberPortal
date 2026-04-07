-- ZWECK
-- Vergleichsflaeche fuer Freigaben und Helfer im Vereinskontext dokumentieren.
--
-- ERWARTETE SPALTEN
-- context_label
-- entry_title
-- member_label
-- status
-- approval_mode
-- updated_at
--
-- VERWENDET IN ADM:
-- club_settings_club_approvals_inline_preview
--
-- JSON-PFAD:
-- docs/masks/templates/Onboarding/ADM_clubSettings.json
--
-- HINWEIS:
-- Kombinierter Live-Read-Vertrag fehlt noch. Platzhalter beschreibt nur den Ziel-Output.

select
  null::text as context_label,
  null::text as entry_title,
  null::text as member_label,
  null::text as status,
  null::text as approval_mode,
  null::timestamptz as updated_at
where false;

