-- 107 Legal / AVV acceptance audit
-- Date: 2026-03-20
-- Run AFTER:
--   supabase/migrations/20260319143000_legal_documents_and_avv_acceptance.sql
--
-- Purpose:
-- - Verify legal document + acceptance objects exist
-- - Verify active versions are unique and aligned with app_secure_settings
-- - Verify RPCs exist and point to the new legal tables
-- - Detect ambiguous, duplicate, or structurally invalid acceptance rows
-- - Surface AVV-specific gaps before productive rollout
--
-- Usage:
-- - Read-only audit queries for Supabase SQL editor
-- - Each query can be run independently

-- -------------------------------------------------------------------
-- A) Object existence
-- -------------------------------------------------------------------
select to_regclass('public.legal_documents') as legal_documents;
select to_regclass('public.legal_acceptance_events') as legal_acceptance_events;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('legal_acceptance_state', 'accept_current_legal')
order by p.proname, args;

-- -------------------------------------------------------------------
-- B) Table structure sanity
-- -------------------------------------------------------------------
select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('legal_documents', 'legal_acceptance_events')
order by table_name, ordinal_position;

select
  t.relname as table_name,
  c.conname as constraint_name,
  pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname in ('legal_documents', 'legal_acceptance_events')
order by t.relname, c.conname;

-- -------------------------------------------------------------------
-- C) Indexes and RLS policies
-- -------------------------------------------------------------------
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('legal_documents', 'legal_acceptance_events')
order by tablename, indexname;

select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('legal_documents', 'legal_acceptance_events')
order by tablename, policyname;

-- -------------------------------------------------------------------
-- D) Active document state
-- -------------------------------------------------------------------
select
  d.document_key,
  d.applies_to,
  d.version,
  d.title,
  d.document_url,
  d.snapshot_path,
  d.snapshot_sha256,
  d.is_active,
  d.published_at
from public.legal_documents d
order by d.document_key, d.version;

-- Expected: exactly one active row per document_key
select
  d.document_key,
  count(*) filter (where d.is_active) as active_rows
from public.legal_documents d
group by d.document_key
order by d.document_key;

-- Unexpected duplicates by natural key
select
  d.document_key,
  d.version,
  count(*) as n
from public.legal_documents d
group by d.document_key, d.version
having count(*) > 1
order by d.document_key, d.version;

-- Missing/blank critical metadata
select
  d.document_key,
  d.version,
  case when nullif(trim(coalesce(d.document_url, '')), '') is null then 'MISSING_DOCUMENT_URL' end as url_issue,
  case when nullif(trim(coalesce(d.snapshot_path, '')), '') is null then 'MISSING_SNAPSHOT_PATH' end as snapshot_path_issue,
  case when nullif(trim(coalesce(d.snapshot_sha256, '')), '') is null then 'MISSING_SNAPSHOT_SHA256' end as snapshot_hash_issue
from public.legal_documents d
where nullif(trim(coalesce(d.document_url, '')), '') is null
   or nullif(trim(coalesce(d.snapshot_path, '')), '') is null
   or nullif(trim(coalesce(d.snapshot_sha256, '')), '') is null
order by d.document_key, d.version;

-- -------------------------------------------------------------------
-- E) app_secure_settings drift
-- -------------------------------------------------------------------
with active_docs as (
  select document_key, version
  from public.legal_documents
  where is_active
),
settings as (
  select setting_key, setting_value
  from public.app_secure_settings
  where setting_key in ('terms_version', 'privacy_version', 'avv_version')
)
select
  a.document_key,
  a.version as active_version,
  s.setting_value as configured_version,
  case
    when s.setting_value is null then 'MISSING_SETTING'
    when s.setting_value <> a.version then 'MISMATCH'
    else 'OK'
  end as status
from active_docs a
left join settings s
  on s.setting_key = a.document_key || '_version'
order by a.document_key;

-- -------------------------------------------------------------------
-- F) RPC definition sanity: new tables must be referenced
-- -------------------------------------------------------------------
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  case when pg_get_functiondef(p.oid) ilike '%public.legal_documents%' then true else false end as uses_legal_documents,
  case when pg_get_functiondef(p.oid) ilike '%public.legal_acceptance_events%' then true else false end as uses_legal_acceptance_events,
  case when pg_get_functiondef(p.oid) ilike '%public.user_policy_acceptances%' then true else false end as still_uses_legacy_user_policy_acceptances
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('legal_acceptance_state', 'accept_current_legal')
order by p.proname, args;

-- -------------------------------------------------------------------
-- G) Acceptance event high-level counts
-- -------------------------------------------------------------------
select
  e.document_key,
  e.accepted_scope,
  count(*) as rows_total,
  count(*) filter (where e.document_sha256 is null or trim(e.document_sha256) = '') as rows_missing_hash,
  count(*) filter (where e.accepted_text is null or trim(e.accepted_text) = '') as rows_missing_acceptance_text
from public.legal_acceptance_events e
group by e.document_key, e.accepted_scope
order by e.document_key, e.accepted_scope;

-- -------------------------------------------------------------------
-- H) Structural anomaly checks
-- -------------------------------------------------------------------
-- Should be empty: user-scope rows with club_id or club-scope rows without club_id
select
  e.id,
  e.document_key,
  e.accepted_scope,
  e.club_id,
  e.accepted_by_user_id,
  e.accepted_at
from public.legal_acceptance_events e
where (e.accepted_scope = 'user' and e.club_id is not null)
   or (e.accepted_scope = 'club' and e.club_id is null)
order by e.accepted_at desc;

-- Should be empty: document/apply-scope mismatch
select
  e.id,
  e.document_key,
  e.accepted_scope,
  d.applies_to as document_applies_to,
  e.document_version,
  e.accepted_at
from public.legal_acceptance_events e
join public.legal_documents d
  on d.document_key = e.document_key
 and d.version = e.document_version
where d.applies_to <> e.accepted_scope
order by e.accepted_at desc;

-- Should be empty: event version not found in legal_documents
select
  e.id,
  e.document_key,
  e.document_version,
  e.accepted_scope,
  e.accepted_at
from public.legal_acceptance_events e
left join public.legal_documents d
  on d.document_key = e.document_key
 and d.version = e.document_version
where d.id is null
order by e.accepted_at desc;

-- Should be empty: event hash differs from stored document hash
select
  e.id,
  e.document_key,
  e.document_version,
  e.document_sha256 as event_hash,
  d.snapshot_sha256 as document_hash,
  e.accepted_at
from public.legal_acceptance_events e
join public.legal_documents d
  on d.document_key = e.document_key
 and d.version = e.document_version
where coalesce(e.document_sha256, '') <> coalesce(d.snapshot_sha256, '')
order by e.accepted_at desc;

-- -------------------------------------------------------------------
-- I) Duplicate acceptance detection
-- -------------------------------------------------------------------
-- User-scope duplicates per user/doc/version
select
  e.accepted_by_user_id,
  e.document_key,
  e.document_version,
  count(*) as n
from public.legal_acceptance_events e
where e.accepted_scope = 'user'
group by e.accepted_by_user_id, e.document_key, e.document_version
having count(*) > 1
order by n desc, e.document_key, e.document_version;

-- Club-scope duplicates per signer/club/doc/version
select
  e.accepted_by_user_id,
  e.club_id,
  e.document_key,
  e.document_version,
  count(*) as n
from public.legal_acceptance_events e
where e.accepted_scope = 'club'
group by e.accepted_by_user_id, e.club_id, e.document_key, e.document_version
having count(*) > 1
order by n desc, e.document_key, e.document_version;

-- Optional business smell:
-- multiple AVV acceptances for the same club/version by different signers.
-- This is not necessarily wrong, but worth reviewing.
select
  e.club_id,
  e.document_version,
  count(*) as signer_rows,
  count(distinct e.accepted_by_user_id) as distinct_signers
from public.legal_acceptance_events e
where e.document_key = 'avv'
  and e.accepted_scope = 'club'
group by e.club_id, e.document_version
having count(*) > 1
order by signer_rows desc, e.club_id;

-- -------------------------------------------------------------------
-- J) AVV-specific completeness checks
-- -------------------------------------------------------------------
-- Should be empty: AVV rows missing signer / authority metadata
select
  e.id,
  e.club_id,
  e.document_version,
  e.signer_name,
  e.signer_function,
  e.signer_email,
  e.authority_confirmed,
  e.accepted_at
from public.legal_acceptance_events e
where e.document_key = 'avv'
  and (
    nullif(trim(coalesce(e.signer_name, '')), '') is null
    or nullif(trim(coalesce(e.signer_function, '')), '') is null
    or nullif(trim(coalesce(e.signer_email, '')), '') is null
    or e.authority_confirmed is not true
  )
order by e.accepted_at desc;

-- Should be empty: AVV accepted by users who are not admin/vorstand in that club
-- Uses current role state; useful smell check after rollout.
select
  e.id,
  e.club_id,
  e.accepted_by_user_id,
  e.document_version,
  e.accepted_at
from public.legal_acceptance_events e
where e.document_key = 'avv'
  and e.accepted_scope = 'club'
  and not exists (
    select 1
    from public.club_user_roles cur
    where cur.user_id = e.accepted_by_user_id
      and cur.club_id = e.club_id
      and cur.role_key in ('admin', 'vorstand')
  )
order by e.accepted_at desc;

-- Clubs with admin/vorstand but without current AVV acceptance
with active_avv as (
  select version
  from public.legal_documents
  where document_key = 'avv'
    and is_active
  limit 1
),
manager_clubs as (
  select distinct cur.club_id
  from public.club_user_roles cur
  where cur.role_key in ('admin', 'vorstand')
),
accepted as (
  select distinct e.club_id
  from public.legal_acceptance_events e
  join active_avv a on a.version = e.document_version
  where e.document_key = 'avv'
    and e.accepted_scope = 'club'
)
select
  mc.club_id
from manager_clubs mc
left join accepted a on a.club_id = mc.club_id
where a.club_id is null
order by mc.club_id;

-- -------------------------------------------------------------------
-- K) Drift check vs legacy legal system
-- -------------------------------------------------------------------
select to_regclass('public.user_policy_acceptances') as legacy_user_policy_acceptances;

-- Optional follow-up ONLY if the table above exists:
-- select
--   a.policy_key,
--   a.policy_version,
--   count(*) as rows_total
-- from public.user_policy_acceptances a
-- group by a.policy_key, a.policy_version
-- order by a.policy_key, a.policy_version;

-- -------------------------------------------------------------------
-- L) High-level health summary
-- -------------------------------------------------------------------
with
active_doc_counts as (
  select count(*) filter (where active_rows = 1) as ok_keys,
         count(*) filter (where active_rows <> 1) as bad_keys
  from (
    select document_key, count(*) filter (where is_active) as active_rows
    from public.legal_documents
    group by document_key
  ) x
),
settings_drift as (
  select count(*) as mismatches
  from (
    with active_docs as (
      select document_key, version
      from public.legal_documents
      where is_active
    ),
    settings as (
      select setting_key, setting_value
      from public.app_secure_settings
      where setting_key in ('terms_version', 'privacy_version', 'avv_version')
    )
    select a.document_key
    from active_docs a
    left join settings s
      on s.setting_key = a.document_key || '_version'
    where s.setting_value is distinct from a.version
  ) q
),
scope_issues as (
  select count(*) as c
  from public.legal_acceptance_events e
  where (e.accepted_scope = 'user' and e.club_id is not null)
     or (e.accepted_scope = 'club' and e.club_id is null)
),
hash_issues as (
  select count(*) as c
  from public.legal_acceptance_events e
  join public.legal_documents d
    on d.document_key = e.document_key
   and d.version = e.document_version
  where coalesce(e.document_sha256, '') <> coalesce(d.snapshot_sha256, '')
),
avv_metadata_issues as (
  select count(*) as c
  from public.legal_acceptance_events e
  where e.document_key = 'avv'
    and (
      nullif(trim(coalesce(e.signer_name, '')), '') is null
      or nullif(trim(coalesce(e.signer_function, '')), '') is null
      or nullif(trim(coalesce(e.signer_email, '')), '') is null
      or e.authority_confirmed is not true
    )
)
select
  case
    when (select bad_keys from active_doc_counts) = 0
     and (select mismatches from settings_drift) = 0
     and (select c from scope_issues) = 0
     and (select c from hash_issues) = 0
     and (select c from avv_metadata_issues) = 0
    then 'legal-avv-audit-green'
    else 'legal-avv-audit-review-required'
  end as audit_status,
  (select bad_keys from active_doc_counts) as active_document_key_issues,
  (select mismatches from settings_drift) as settings_version_mismatches,
  (select c from scope_issues) as scope_issues,
  (select c from hash_issues) as hash_issues,
  (select c from avv_metadata_issues) as avv_metadata_issues;
