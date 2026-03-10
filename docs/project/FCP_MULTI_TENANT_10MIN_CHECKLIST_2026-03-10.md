# FCP 10-Minuten Multi-Tenant Checkliste
Stand: 2026-03-10
Zweck: Schnelltest, ob FCP im Soft-Access und Multi-Club-Basisbetrieb korrekt isoliert läuft.

## Test-Setup (einmalig)
- Verein A: `Testverein Nord`
- Verein B: `Testverein Rhein`
- User A1 (Member), A-Admin (Admin)
- User B1 (Member), B-Admin (Admin)
- Testobjekt: 1 Event + 1 Feed-Post in Verein A

## Ablauf (Pass/Fail)
1. FCP-Zugangsschutz aktiv
   - Erwartung: Ohne Access keine FCP-Seiten.
   - Ergebnis: `pass / fail`

2. Access + normaler Login
   - Erwartung: Nach Access normaler Loginfluss (`/login` -> `/app`).
   - Ergebnis: `pass / fail`

3. Invite/Claim A1
   - Erwartung: Registrierung über Invite klappt, `club_id` von Verein A gesetzt.
   - Ergebnis: `pass / fail`

4. Invite/Claim B1
   - Erwartung: Registrierung über Invite klappt, `club_id` von Verein B gesetzt.
   - Ergebnis: `pass / fail`

5. Club-Isolation Daten
   - Schritt: A-Admin erstellt Event/Post in Verein A.
   - Erwartung: B1/B-Admin sehen Event/Post aus A nicht.
   - Ergebnis: `pass / fail`

6. Rollenprüfung
   - Schritt: A-Admin versucht Event-Update (erlaubt), A1 versucht Event-Update (verboten).
   - Erwartung: Nur Admin/Vorstand im richtigen Club darf.
   - Ergebnis: `pass / fail`

7. Profile-Bootstrap
   - Erwartung: Nach Login kein `club_id = null` für aktive Rollenuser.
   - Ergebnis: `pass / fail`

8. VDAN-Unberührtheit
   - Erwartung: VDAN-Livepfad unverändert erreichbar/funktional.
   - Ergebnis: `pass / fail`

## SQL-Kurzchecks (Supabase SQL Editor)
```sql
-- A) Rollenuser ohne Profil-Clubbindung (muss 0 sein)
select count(*) as role_users_without_profile_club
from public.profiles p
where p.club_id is null
  and exists (select 1 from public.user_roles ur where ur.user_id = p.id);

-- B) Multi-tenant Baseline-Indikator
with
smell_policies as (
  select count(*) as c
  from pg_policies p
  where p.schemaname = 'public'
    and exists (
      select 1
      from information_schema.columns c
      where c.table_schema = p.schemaname
        and c.table_name = p.tablename
        and c.column_name = 'club_id'
    )
    and (coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')) ilike '%is_admin_or_vorstand()%'
    and (coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')) not ilike '%is_same_club(%'
    and (coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')) not ilike '%is_admin_or_vorstand_in_club(%'
),
null_binding as (
  select count(*) as c
  from public.profiles p
  where p.club_id is null
    and exists (select 1 from public.user_roles ur where ur.user_id = p.id)
),
fallback_flag as (
  select case when public.legacy_single_club_fallback_enabled() then 1 else 0 end as c
)
select
  case
    when (select c from smell_policies) = 0
     and (select c from null_binding) = 0
     and (select c from fallback_flag) = 0
    then 'multi-tenant-ready-db-baseline'
    else 'not-ready-requires-hardening'
  end as readiness_status,
  (select c from smell_policies) as policy_smells,
  (select c from null_binding) as role_users_without_profile_club,
  (select c from fallback_flag) as legacy_fallback_enabled_flag;
```

## Freigabe
`GO` für erweiterten FCP-Testbetrieb nur wenn:
- alle 8 Checks `pass`,
- SQL-Baseline weiterhin grün,
- keine VDAN-Regression beobachtet.

## Protokoll
- Datum:
- Ausgeführt von:
- Ergebnis:
- Offene Punkte:
