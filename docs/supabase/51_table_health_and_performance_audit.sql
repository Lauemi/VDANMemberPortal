-- 51_table_health_and_performance_audit.sql
-- Zweck:
--   1) Tabellenleichen-Kandidaten finden
--   2) Performance-Risiken sichtbar machen
--
-- Hinweise:
-- - Werte in pg_stat_* gelten seit letztem Stats-Reset/Restart.
-- - Vor Bewertung in Staging einmal Last erzeugen oder in Prod auf realen Daten prüfen.
-- - Für große Tabellen immer EXPLAIN (ANALYZE, BUFFERS) nachziehen.

-- =========================================================
-- A) Tabellen-Health-Overview
-- =========================================================
with table_stats as (
  select
    n.nspname as schema_name,
    c.relname as table_name,
    c.oid as relid,
    pg_total_relation_size(c.oid) as total_bytes,
    coalesce(s.n_live_tup, 0) as live_tup,
    coalesce(s.n_dead_tup, 0) as dead_tup,
    coalesce(s.seq_scan, 0) as seq_scan,
    coalesce(s.idx_scan, 0) as idx_scan,
    coalesce(s.n_tup_ins, 0) as tup_ins,
    coalesce(s.n_tup_upd, 0) as tup_upd,
    coalesce(s.n_tup_del, 0) as tup_del,
    s.last_vacuum,
    s.last_autovacuum,
    s.last_analyze,
    s.last_autoanalyze
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_stat_user_tables s on s.relid = c.oid
  where c.relkind = 'r'
    and n.nspname = 'public'
)
select
  schema_name,
  table_name,
  round(total_bytes::numeric / 1024 / 1024, 2) as size_mb,
  live_tup,
  dead_tup,
  case
    when live_tup + dead_tup = 0 then 0
    else round((dead_tup::numeric / (live_tup + dead_tup)) * 100, 2)
  end as dead_pct,
  seq_scan,
  idx_scan,
  case
    when seq_scan + idx_scan = 0 then null
    else round((idx_scan::numeric / (seq_scan + idx_scan)) * 100, 2)
  end as idx_scan_pct,
  tup_ins,
  tup_upd,
  tup_del,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
from table_stats
order by total_bytes desc;

-- =========================================================
-- B) Tabellenleichen-Kandidaten
-- Kriterien (anpassbar):
--   - keine Reads (seq_scan+idx_scan=0)
--   - keine Writes (ins/upd/del=0)
--   - hat aber Daten ODER ist größer als 1 MB
-- =========================================================
with table_stats as (
  select
    n.nspname as schema_name,
    c.relname as table_name,
    c.oid as relid,
    pg_total_relation_size(c.oid) as total_bytes,
    coalesce(s.n_live_tup, 0) as live_tup,
    coalesce(s.seq_scan, 0) as seq_scan,
    coalesce(s.idx_scan, 0) as idx_scan,
    coalesce(s.n_tup_ins, 0) as tup_ins,
    coalesce(s.n_tup_upd, 0) as tup_upd,
    coalesce(s.n_tup_del, 0) as tup_del
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_stat_user_tables s on s.relid = c.oid
  where c.relkind = 'r'
    and n.nspname = 'public'
)
select
  schema_name,
  table_name,
  round(total_bytes::numeric / 1024 / 1024, 2) as size_mb,
  live_tup,
  seq_scan,
  idx_scan,
  tup_ins,
  tup_upd,
  tup_del
from table_stats
where (seq_scan + idx_scan) = 0
  and (tup_ins + tup_upd + tup_del) = 0
  and (live_tup > 0 or total_bytes > 1024 * 1024)
order by total_bytes desc;

-- =========================================================
-- C) Große Tabellen mit hohem Seq-Scan Anteil (Performance-Risiko)
-- =========================================================
with table_stats as (
  select
    n.nspname as schema_name,
    c.relname as table_name,
    c.oid as relid,
    pg_total_relation_size(c.oid) as total_bytes,
    coalesce(s.seq_scan, 0) as seq_scan,
    coalesce(s.idx_scan, 0) as idx_scan
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_stat_user_tables s on s.relid = c.oid
  where c.relkind = 'r'
    and n.nspname = 'public'
)
select
  schema_name,
  table_name,
  round(total_bytes::numeric / 1024 / 1024, 2) as size_mb,
  seq_scan,
  idx_scan,
  case
    when seq_scan + idx_scan = 0 then null
    else round((seq_scan::numeric / (seq_scan + idx_scan)) * 100, 2)
  end as seq_scan_pct
from table_stats
where total_bytes > 10 * 1024 * 1024
  and seq_scan > idx_scan
order by seq_scan_pct desc nulls last, total_bytes desc;

-- =========================================================
-- D) Dead-Tuple Hotspots (Autovacuum/Write-Pattern Problem)
-- =========================================================
select
  schemaname as schema_name,
  relname as table_name,
  n_live_tup,
  n_dead_tup,
  case
    when n_live_tup + n_dead_tup = 0 then 0
    else round((n_dead_tup::numeric / (n_live_tup + n_dead_tup)) * 100, 2)
  end as dead_pct,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
from pg_stat_user_tables
where schemaname = 'public'
  and n_live_tup > 1000
order by dead_pct desc, n_dead_tup desc;

-- =========================================================
-- E) Unused Index Kandidaten (vorsichtig prüfen, nicht blind droppen)
-- =========================================================
select
  s.schemaname as schema_name,
  s.relname as table_name,
  s.indexrelname as index_name,
  s.idx_scan,
  round(pg_relation_size(s.indexrelid)::numeric / 1024 / 1024, 2) as index_size_mb,
  i.indisunique as is_unique,
  i.indisprimary as is_primary
from pg_stat_user_indexes s
join pg_index i on i.indexrelid = s.indexrelid
where s.schemaname = 'public'
  and s.idx_scan = 0
  and not i.indisprimary
order by pg_relation_size(s.indexrelid) desc;

-- =========================================================
-- F) Foreign Keys ohne unterstützenden Index (häufiges Performance-Problem)
-- =========================================================
with fk as (
  select
    c.oid as constraint_oid,
    n.nspname as schema_name,
    t.relname as table_name,
    c.conname as fk_name,
    c.conrelid,
    c.conkey
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where c.contype = 'f'
    and n.nspname = 'public'
),
idx as (
  select
    i.indrelid,
    i.indkey,
    i.indexrelid
  from pg_index i
)
select
  fk.schema_name,
  fk.table_name,
  fk.fk_name,
  pg_get_constraintdef(fk.constraint_oid) as fk_def
from fk
where not exists (
  select 1
  from idx
  where idx.indrelid = fk.conrelid
    -- Prüft, ob FK-Spalten Präfix des Index sind
    and idx.indkey::int2[] [1:array_length(fk.conkey, 1)] = fk.conkey
)
order by fk.table_name, fk.fk_name;

-- =========================================================
-- G) (Optional) Top langsame Statements über pg_stat_statements
-- Nur ausführen, wenn Extension aktiv und Rechte vorhanden.
-- =========================================================
-- select
--   calls,
--   round(total_exec_time::numeric, 2) as total_ms,
--   round(mean_exec_time::numeric, 2) as mean_ms,
--   rows,
--   left(query, 200) as query_sample
-- from pg_stat_statements
-- order by total_exec_time desc
-- limit 30;

-- =========================================================
-- H) Handlungsleitfaden kurz
-- 1) Tabellenleiche-Kandidaten -> erst fachlich prüfen, dann archivieren/droppen.
-- 2) FK ohne Index -> gezielt Index anlegen.
-- 3) Hoher seq_scan auf großen Tabellen -> konkrete Queries mit EXPLAIN prüfen.
-- 4) Hoher dead_pct -> Write-Pattern + Vacuum-Settings prüfen.
-- 5) Ungenutzte Indizes -> über längeren Zeitraum beobachten, dann gezielt entfernen.
-- =========================================================
