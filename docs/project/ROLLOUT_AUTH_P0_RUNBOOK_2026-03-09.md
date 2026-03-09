# Rollout Runbook Auth P0 (minimale Ausfallzeit)

Stand: 2026-03-09  
Ziel: Heute Abend Live stabilisieren, mit Pilot/Testverein steuern und in Minuten rueckrollbar bleiben.

## 1) Betriebsprinzip fuer heute
- Login bleibt: `Mitgliedsnummer + Passwort`.
- `auth.users.email` wird als technischer Login-Identifier stabil auf `member_<nr>@members.vdan.local` gehalten.
- Kontakt-E-Mail darf gepflegt werden, aber Login darf dadurch nicht brechen.
- Produktiv wird nur in kleinem Fenster umgestellt, mit sofortigem Restore-Pfad.

## 2) Vorbereitungen (vor Live-Fenster)
1. App deploy mit `PUBLIC_AUTH_EMAIL_CHANGE_ENABLED=false`.
2. SQL ausfuehren: `docs/supabase/90_auth_rollout_stabilization.sql`.
3. Pilotmenge festlegen:
   - nur Testverein (`club_code`) oder
   - konkrete Mitgliederliste (`member_no[]`).

## 3) Pilot-Check (ohne Aenderung)
```sql
select *
from public.admin_auth_email_repair_preview(
  p_club_code := 'VD01',
  p_member_nos := null,
  p_limit := 200
)
where needs_change = true;
```

Erwartung: Liste zeigt nur User, deren `auth.users.email` nicht dem Mitgliedsnummer-Muster entspricht.

## 4) Pilot anwenden (kontrolliert)
```sql
select *
from public.admin_auth_email_repair_apply(
  p_club_code := 'VD01',
  p_member_nos := null,
  p_limit := 200,
  p_apply := true,
  p_update_profile_email := false,
  p_note := 'pilot_testverein_vd01_2026-03-09'
);
```

Wichtig:
- `p_update_profile_email := false` belassen (Kontakt-E-Mail in `profiles` nicht ueberschreiben).
- Rueckmeldung enthaelt `batch_id` implizit in den Resultzeilen. Diese ID notieren.

## 5) Smoke-Test direkt nach Pilot
1. Login Testuser (Mitgliedsnummer + Passwort).
2. Login Superadmin.
3. Einstellungen speichern (Name/Adresse) muss gehen.
4. E-Mail im Account aendern darf Login nicht mehr zerstoeren (Auth-E-Mail-Update ist aus).

Wenn gruen: gleiche Prozedur fuer weitere Zielgruppe/ganzen Verein.

## 6) Sofort-Rollback (wenn etwas schiefgeht)
Mit notierter `batch_id`:
```sql
select *
from public.admin_auth_email_repair_restore(
  p_batch_id := 'REPLACE_WITH_BATCH_UUID',
  p_restore_profile_email := false,
  p_note := 'rollback_live_issue_2026-03-09'
);
```

Danach erneut Login Smoke-Test.

## 7) Live-Fenster-Checkliste (kompakt)
1. Wartungsfenster starten.
2. Preview-Query ausfuehren.
3. Apply auf Pilot/Testverein.
4. Smoke-Test 4 Punkte.
5. Entweder erweitern oder sofort rollbacken.
6. Wartungsfenster beenden.

## 8) Notfall: Superadmin sofort entsperren
Falls Superadmin-Login gebrochen ist, direkt ruecksetzen:
```sql
update auth.users
set email = 'member_598@members.vdan.local', updated_at = now()
where id = 'c7137e8c-ee7d-4b59-9e2f-1e0262d67d0d';
```

## 9) Nachlauf
- Alle `batch_id` im Journal dokumentieren.
- Erst nach stabiler Phase optional Auth-E-Mail-Change wieder freigeben (`PUBLIC_AUTH_EMAIL_CHANGE_ENABLED=true`) und nur mit separatem Testplan.
