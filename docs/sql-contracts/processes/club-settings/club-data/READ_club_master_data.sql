-- ZWECK
-- Vereinsstammdaten fuer den ClubSettings-Workspace referenzieren.
--
-- ERWARTETE SPALTEN
-- club_name
-- street
-- zip
-- city
-- contact_name
-- contact_email
-- contact_phone
--
-- VERWENDET IN ADM:
-- club_settings_club_master_data
--
-- JSON-PFAD:
-- docs/masks/templates/Onboarding/ADM_clubSettings.json
--
-- HINWEIS:
-- Produktiver Read/Write laeuft ueber Edge `club-onboarding-workspace`.
-- Die Referenz orientiert sich am erwarteten `record.workspace.club_data`-Block.

select
  club_name,
  street,
  zip,
  city,
  contact_name,
  contact_email,
  contact_phone
from public.club_core
where id = :club_id::uuid;

