-- ZWECK
-- Fuehrenden Read-Vertrag fuer die oeffentliche QFM-Maske "Verein anfragen"
-- dokumentieren. Der produktive Screen liest Gate-/Statusdaten ueber
-- public.club_request_gate_state() und kombiniert sie bei Bedarf mit einem
-- lokalen Pending-Draft. Dieser SQL-Vertrag beschreibt die fachlich erwartete
-- Record-Struktur fuer bereits gespeicherte Vereinsanfragen des aktuellen
-- Requesters.
--
-- ERWARTETE SPALTEN
-- club_name
-- zip
-- city
-- club_size
-- street
-- house_number
-- responsible_name
-- responsible_role
-- responsible_email
-- club_mail_confirmed
-- legal_confirmed
--
-- VERWENDET IN QFM:
-- QFM_CLUB_REQUEST_ENTRY :: club_request_entry :: request_form
--
-- JSON-PFAD:
-- docs/masks/templates/Onboarding/QFM_clubEntryBillingSignIn.json
--
-- HINWEIS:
-- Wenn fuer den aktuellen Benutzer noch keine Vereinsanfrage existiert, ist ein
-- leeres Ergebnis fachlich korrekt. Die Maske startet dann leer bzw. nutzt nur
-- einen explizit erlaubten Resume-Draft.

select
  crr.club_name,
  coalesce(crr.request_payload ->> 'zip', '') as zip,
  coalesce(crr.request_payload ->> 'city', crr.request_payload ->> 'club_location', '') as city,
  crr.club_size,
  coalesce(crr.request_payload ->> 'street', '') as street,
  coalesce(crr.request_payload ->> 'house_number', '') as house_number,
  crr.responsible_name,
  coalesce(crr.request_payload ->> 'responsible_role', '') as responsible_role,
  crr.responsible_email,
  coalesce(crr.club_mail_confirmed, false) as club_mail_confirmed,
  coalesce((crr.request_payload ->> 'legal_confirmed')::boolean, false) as legal_confirmed
from public.club_registration_requests as crr
where crr.requester_user_id = auth.uid()
order by crr.created_at desc
limit 1;
