# 78 Rollout Runbook (Livebetrieb)

## Ziel
- Freie Mitgliedsgewässer sauber von offiziellen Vereinsgewässern trennen.
- GoFishing auf beide Quellen vorbereiten.
- Keine automatische Übernahme in `water_bodies`.

## Reihenfolge (wichtig)
1. DB-Migration ausführen: `docs/supabase/78_member_waters_and_mapping_live_safe.sql`
2. DB-Hotfix ausführen: `docs/supabase/79_water_source_mapping_status_hotfix.sql`
3. User-Scope Patch ausführen: `docs/supabase/80_member_waters_user_scope_no_club.sql`
4. Prüfen, ob neue RPCs vorhanden sind.
5. Erst danach Frontend deployen (GoFishing mit `water_mode=member`).

## Preflight
```sql
select now() as ts;
select count(*) as water_bodies_count from public.water_bodies;
select count(*) as trips_count from public.fishing_trips;
select count(*) as catches_count from public.catch_entries;
```

## Post-Deploy Checks
```sql
-- Tabellen vorhanden
select to_regclass('public.member_waters') as member_waters;
select to_regclass('public.member_water_mappings') as member_water_mappings;

-- neue Spalten
select column_name
from information_schema.columns
where table_schema='public'
  and table_name='fishing_trips'
  and column_name in ('member_water_id','water_source','water_name_raw','mapping_status');

select column_name
from information_schema.columns
where table_schema='public'
  and table_name='catch_entries'
  and column_name in ('member_water_id','water_source','water_name_raw','mapping_status');

-- RPCs vorhanden
select proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and proname in ('member_water_upsert','catch_trip_quick_no_catch_member','member_water_match_candidates');
```

## Smoke-Test (manuell)
1. GoFishing öffnen.
2. `Gewässerquelle = Vereinsgewässer`, Session speichern -> muss wie bisher laufen.
3. `Gewässerquelle = Freies Gewässer`, Namen eintragen, Session speichern.
4. In DB prüfen:
   - Eintrag in `member_waters`
   - `fishing_trips.water_source='member'`
   - `catch_entries.water_source='member'` (bei Fängen)
5. Prüfen, dass `water_bodies` unverändert bleibt (keine neuen Freitext-Zeilen).

## Rollback-Strategie
- Frontend sofort zurückrollen (wenn nötig), DB kann additive bestehen bleiben.
- Keine destruktiven DDLs in 78 enthalten.
- Falls Member-Modus temporär deaktiviert werden soll: im Frontend `Gewässerquelle` auf `official` fixieren.
