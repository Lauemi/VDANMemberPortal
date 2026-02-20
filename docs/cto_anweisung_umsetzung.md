# CTO Anweisung – Umsetzung im Projekt (mit bestehender VDAN-Logik)

## Umgesetzt
- Kachel `Arbeitseinsätze` (Member) und Kachel `Arbeitseinsatz Cockpit` (Vorstand/Admin)
- Menüeinträge für Member und zusätzliche Cockpit-Einträge für Vorstand/Admin
- Self-Check-in per QR + Token-Flow
- Freigabeprozess mit Status-Workflow inkl. `approved` als zählender Status
- Cockpit-Teilnehmertabelle mit Bearbeiten/Freigeben/Ablehnen

## Beibehaltene Projektlogik (bewusst)
- Rollenmodell bleibt `public.user_roles.role` mit:
  - `member`
  - `vorstand`
  - `admin`
- CTO-Begriff `board` wird auf `vorstand` gemappt.
- `work_register` bleibt im Projekt auf:
  - `status = 'checked_in'`
  - `checkin_at = now()`
  (kein separates `registered` als Zwischenstufe beim Start-Button)

## Datenbankstruktur (relevant)
- `public.work_events`
  - `id`, `club_id`, `title`, `description`, `location`, `starts_at`, `ends_at`, `max_participants`, `status`, `public_token`, `created_by`, `created_at`, `updated_at`, `updated_by`
- `public.work_participations`
  - `id`, `event_id`, `auth_uid`, `status`, `minutes_reported`, `minutes_approved`, `checkin_at`, `checkout_at`, `approved_by`, `approved_at`, `note_member`, `note_admin`, `created_at`, `updated_at`, `updated_by`
- `public.work_checkins`
  - `id`, `event_id`, `auth_uid`, `checkin_at`, `method`
- `public.profiles`
  - `id`, `email`, `display_name`, `created_at`, `updated_at`
- `public.user_roles`
  - `user_id`, `role`, `created_at`

## RPCs/Helper (Soll-Set)
- `public.work_event_create(...)`
- `public.work_event_publish(...)`
- `public.work_register(...)`
- `public.work_checkin(...)`
- `public.work_checkout(...)`
- `public.work_participation_admin_update(...)`
- `public.work_approve(...)`
- `public.work_reject(...)`
- `public.is_admin_or_vorstand()`
- `public.is_board_or_admin()` (Alias für CTO-Wording)

## Neue Alignment-Migration
- `docs/supabase/11_cto_alignment_keep_logic.sql`
  - fügt `is_board_or_admin()` hinzu
  - härtet `enforce_work_participation_update()` für SQL-Editor/Service-Kontext
  - stellt sicher, dass `work_reject(...)` vorhanden ist

## CTO-Erweiterungen (QR hidden + member_no)
- `docs/supabase/12_cto_qr_hidden_and_member_no.sql`
  - `profiles.member_no` (+ `club_id`) inklusive unique Index je Club
  - `feature_flags` + Default `work_qr_enabled=false`
  - `portal_bootstrap()` liefert `flags` und `roles`
  - optionales `work_event_token_rotate(...)`
- `docs/supabase/13_demo_users_seed_template.sql`
  - Template für 3 Demo-User (vorstand/member/admin) inkl. `member_no`
- `docs/supabase/14_preflight_checks.sql`
  - SQL-Checks für Flag, Rollen, member_no, RPC-Präsenz
