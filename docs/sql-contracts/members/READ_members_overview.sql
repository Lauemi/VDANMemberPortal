-- ZWECK
-- Mitgliederverzeichnis fuer ClubSettings dokumentieren.
--
-- ERWARTETE SPALTEN
-- club_code
-- club_member_no
-- member_no
-- last_name
-- first_name
-- role
-- status
-- fishing_card_type
-- last_sign_in_at
-- email
-- street
-- zip
-- city
-- phone
-- mobile
-- birthdate
-- guardian_member_no
-- sepa_approved
-- iban_last4
--
-- VERWENDET IN ADM:
-- club_settings_members_registry
--
-- JSON-PFAD:
-- docs/masks/templates/Onboarding/ADM_clubSettings.json
--
-- HINWEIS:
-- Produktiver Read laeuft bereits ueber `public.admin_member_registry(p_club_id)`.

select
  club_code,
  club_member_no,
  member_no,
  last_name,
  first_name,
  role,
  status,
  fishing_card_type,
  last_sign_in_at,
  email,
  street,
  zip,
  city,
  phone,
  mobile,
  birthdate,
  guardian_member_no,
  sepa_approved,
  iban_last4
from public.admin_member_registry(:p_club_id::uuid);

