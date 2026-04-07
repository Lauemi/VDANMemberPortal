# ADM ClubSettings Security Triage

## Ziel
Dieses Dokument ueberfuehrt das Security-Review in einen nutzbaren Triage-Stand:
- `bestaetigt`
- `bereits entschärft`
- `unklar / muss verifiziert werden`

Es ist kein neuer Contract, sondern ein Sicherheits-Abgleich gegen den aktuellen Repo-Stand.

## Gepruefte Quellen
- Maske:
  - [ADM_clubSettings.json](/Users/michaellauenroth/Downloads/vdan-app-template/docs/masks/templates/Onboarding/ADM_clubSettings.json)
- Edge Functions:
  - [club-onboarding-workspace/index.ts](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/functions/club-onboarding-workspace/index.ts)
  - [club-invite-create/index.ts](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/functions/club-invite-create/index.ts)
  - [club-onboarding-status/index.ts](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/functions/club-onboarding-status/index.ts)
- SQL / Migrations:
  - [20260317103000_onboarding_foundation.sql](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/migrations/20260317103000_onboarding_foundation.sql)
  - [20260326143000_club_registration_requests.sql](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/migrations/20260326143000_club_registration_requests.sql)
  - [20260331103000_member_registry_role_column.sql](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/migrations/20260331103000_member_registry_role_column.sql)

## Kurzurteil
Das Review enthaelt wichtige echte Warnungen, aber nicht alle Punkte treffen den aktuellen Repo-Stand.

Stand heute:
- `club_onboarding_snapshot`: kritisch offen
- `get_onboarding_process_state`: unklar, Vertrag lokal nicht sauber belegbar
- `club_registration_requests`: bereits deutlich besser abgesichert als im Review behauptet
- `club-onboarding-workspace`: serverseitiger Club-Ownership-Check vorhanden
- `club-invite-create`: serverseitiger Club-Ownership-Check vorhanden, `max_uses` serverseitig begrenzt

## 1. Bestaetigt

### 1.1 `public.club_onboarding_snapshot(p_club_id uuid)`
Status:
- `bestaetigt`

Beobachtung:
- Die SQL-Function in [20260317103000_onboarding_foundation.sql](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/migrations/20260317103000_onboarding_foundation.sql) liest direkt auf Basis von `p_club_id`.
- In der Function selbst ist kein Guard wie `public.is_admin_or_vorstand_in_club(p_club_id)` eingebaut.
- Die Function ist `security definer`.

Risiko:
- Wer die Function aufrufen kann und eine fremde `club_id` kennt, koennte Snapshot-Daten eines anderen Vereins lesen.

Sofortmassnahme:
- Die ADM-Maske laedt diesen Snapshot aktuell nicht mehr live.

Empfehlung:
- Guard in der Function selbst einbauen:
  - `public.is_service_role_request()`
  - oder `public.is_admin_or_vorstand_in_club(p_club_id)`
  - oder `public.is_admin_in_any_club()`

### 1.2 Overview-/Prozesskontext in ADM bleibt sicherheitlich vorsichtig zu behandeln
Status:
- `teilweise bestaetigt`

Beobachtung:
- [ADM_clubSettings.json](/Users/michaellauenroth/Downloads/vdan-app-template/docs/masks/templates/Onboarding/ADM_clubSettings.json) verwendet fuer Overview / Prozesskontext weiter `public.get_onboarding_process_state`.
- Die lokale Function-Quelle ist im Repo aktuell nicht direkt belegbar.

Risiko:
- Solange die echte SQL-Definition nicht gegen den Zielstand verifiziert ist, bleibt unklar, ob `p_club_id`, `p_invite_token` und `p_include_debug` ausreichend geschuetzt sind.

Empfehlung:
- Function-Body direkt aus Ziel-DB lesen und gegen Contract abgleichen, bevor dieser Pfad als sicher gilt.

## 2. Bereits entschärft / im Review zu hart formuliert

### 2.1 `public.club_registration_requests`
Status:
- `bereits entschärft`

Beobachtung:
- [20260326143000_club_registration_requests.sql](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/migrations/20260326143000_club_registration_requests.sql) aktiviert RLS.
- Es existiert die Policy:
  - `requester_user_id = auth.uid()`
  - oder `public.is_admin_in_any_club()`
- `public.club_request_gate_state()` filtert explizit auf `requester_user_id = auth.uid()`.

Folge:
- Die Aussage "kein RLS" trifft fuer den aktuellen Repo-Stand nicht zu.

Rest-Risiko:
- Admin-Leserecht bleibt weit.
- Downstream-Nutzung der Daten muss trotzdem sorgfaeltig bleiben.

### 2.2 `club-onboarding-workspace`
Status:
- `bereits entschärft`

Beobachtung:
- [club-onboarding-workspace/index.ts](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/functions/club-onboarding-workspace/index.ts) verlangt:
  - authentifizierten User
  - `club_id` im Payload
  - serverseitigen Check `isAllowed(userId, clubId)`
- `isAllowed()` prueft `club_user_roles` auf `admin` / `vorstand` und legacy `user_roles` auf `admin`.

Folge:
- Die Function vertraut der `club_id` nicht blind.
- Ein manipulierter Payload allein reicht lokal nach aktuellem Code nicht.

Rest-Risiko:
- Der Remote-Deploy muss mit diesem Stand uebereinstimmen.
- Die Function liefert aktuell remote noch `500`, also ist Deploy-/Runtime-Stabilitaet separat offen.

### 2.3 `club-invite-create`
Status:
- `bereits entschärft`

Beobachtung:
- [club-invite-create/index.ts](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/functions/club-invite-create/index.ts) validiert:
  - authentifizierten User
  - `club_id` / `club_code`
  - Club-Manager-Rolle per `hasClubManagerRole()`
- `max_uses` wird serverseitig begrenzt:
  - `Math.max(1, Math.min(500, Math.trunc(maxUsesRaw)))`
- `expires_in_days` wird serverseitig begrenzt:
  - `1..90`

Folge:
- Zwei Review-Punkte sind lokal bereits entschärft:
  - kein blinder `club_id`-Trust
  - keine unbegrenzte `max_uses`

Rest-Risiko:
- Es gibt noch keinen klaren DB-First Invite-Contract mit eigener Tabelle und RLS.
- Das Invite-System lebt aktuell auf `app_secure_settings`.

## 3. Unklar / verifizieren

### 3.1 `public.get_onboarding_process_state`
Status:
- `unklar`

Beobachtung:
- Die ADM-Maske verwendet die Function.
- Im lokalen Repo liegt aktuell kein direkt nutzbarer Migration-Body vor.
- Es gibt nur das Read-Skript [READ_get_onboarding_process_state.sql](/Users/michaellauenroth/Downloads/vdan-app-template/docs/masks/templates/READ_get_onboarding_process_state.sql).

Empfehlung:
- Direkt aus Ziel-DB lesen:
  - Guard fuer `p_club_id`
  - Guard fuer `p_invite_token`
  - Guard fuer `p_include_debug`

### 3.2 `admin_member_registry` Downstream-Schutz
Status:
- `teilweise bestaetigt`

Beobachtung:
- Die SQL-Function selbst prueft Manager-/Admin-Rechte.
- Sie liefert aber sensible Daten:
  - `profile_user_id`
  - `email`
  - `street`
  - `phone`
  - `mobile`
  - `birthdate`
  - `iban_last4`

Empfehlung:
- Abrufe spaeter ueber `admin_dsgvo_log_event` auditieren.
- Keine unnötigen Client-Dumps oder Cross-Context-Caches zulassen.

## 4. Bereits umgesetzte Sofortmassnahmen in der Maske

- Snapshot-Load ueber `club-onboarding-status` ist in der ADM-Maske derzeit deaktiviert.
- Auto-Loads ueber `club-onboarding-workspace` fuer Vereinsdaten / Gewaesser sind derzeit deaktiviert.
- Leere Tabellenzustände zeigen jetzt sauberer an, wenn Club-Kontext oder Daten fehlen.

## 5. Konkrete naechste Schritte

1. `club_onboarding_snapshot` serverseitig haerten.
2. `get_onboarding_process_state` aus Ziel-DB lesen und gegen Contract pruefen.
3. Nach erfolgreicher Verifikation erst dann Overview-/Snapshot-Loads wieder live schalten.
4. Invite-System mittelfristig auf expliziten DB-Contract mit RLS ziehen.
5. `admin_member_registry`-Abrufe spaeter auditierbar machen.
