# Staging Hardening Runbook

Stand: 2026-03-02  
Ziel: Staging-DB sauber aufsetzen mit Multi-Tenant-Basis, RLS-Hardening und Offline-Write-Schutz.

## 1) Ausfuehrungsreihenfolge

1. `docs/supabase/60_staging_full_setup_schema.sql`
2. `docs/supabase/61_staging_multitenant_hardening.sql`
3. Optional: Seed-Skripte nur fuer Testdaten
   - `docs/supabase/06_seed_catch_masterdata.sql`
   - `docs/supabase/03_seed_feed_posts.sql`
   - `docs/supabase/13_demo_users_seed_template.sql` (UUIDs vorher anpassen)

## 2) Was 61 konkret macht

- Fuegt `clubs` + `memberships` als tenant authority hinzu.
- Schliesst RLS-Luecke auf `club_members`.
- Erzwingt `club_id` (+ FK + NOT NULL) auf Kern-Tabellen:
  - `feed_posts`
  - `club_events`
  - `work_events`
  - `catch_entries`
  - `fishing_trips`
  - `documents`
  - `app_notes`
- Haertet RLS auf club-scope fuer Kernmodule.
- Fuegt Offline-Schutz hinzu:
  - `client_request_id` (idempotente Retries)
  - `row_version` + Trigger (optimistic conflict basis)

## 3) Nachkontrollen (Pflicht)

1. Club-Backfill:
```sql
select 'feed_posts' as t, count(*) as rows_all, count(*) filter (where club_id is null) as rows_null from public.feed_posts
union all
select 'club_events', count(*), count(*) filter (where club_id is null) from public.club_events
union all
select 'work_events', count(*), count(*) filter (where club_id is null) from public.work_events
union all
select 'catch_entries', count(*), count(*) filter (where club_id is null) from public.catch_entries
union all
select 'fishing_trips', count(*), count(*) filter (where club_id is null) from public.fishing_trips
union all
select 'documents', count(*), count(*) filter (where club_id is null) from public.documents
union all
select 'app_notes', count(*), count(*) filter (where club_id is null) from public.app_notes;
```

2. Memberships vorhanden:
```sql
select club_id, role, count(*) from public.memberships group by club_id, role order by club_id, role;
```

3. RLS aktiv:
```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('club_members','feed_posts','club_events','work_events','catch_entries','fishing_trips','documents','app_notes','memberships');
```

## 4) Wichtiger Hinweis

Dieses Hardening ist bewusst fuer Staging aggressiv.  
Danach zwingend Smoke-Test fuer:
- Feed lesen/schreiben
- Termine/Arbeitseinsatz
- Fangliste
- Dokumente
- Notizen

Wenn ein Flow auf `anon`-Lesen angewiesen ist, muss fuer Multi-Tenant spaeter ein domain-/club-kontextsicheres Public-Pattern eingefuehrt werden.
