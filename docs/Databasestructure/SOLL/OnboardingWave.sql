begin;

create extension if not exists pgcrypto;

-- =========================================================
-- FCP CSV ONBOARDING SYSTEM V1
-- additive only
-- no drops
-- no trigger logic
-- no policies
-- no sync logic
--
-- purpose:
-- - import jobs as first-class technical orchestration objects
-- - file/source traceability
-- - dry run vs execute
-- - mapping templates + versions
-- - row-level validation / conflict / decision model
-- - auditability / replayability
-- - partial success support
-- - explicit attachment to existing domain processes
--
-- important:
-- - this is NOT a second onboarding truth space
-- - canonical business truth stays in existing domain tables
--   such as club_registration_requests, club_onboarding_state,
--   club_onboarding_audit, membership_applications,
--   canonical_memberships and later domain entities
-- =========================================================


-- =========================================================
-- 1) import job header
-- =========================================================
create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid null references public.tenant_nodes(tenant_id),
  club_core_id uuid null references public.club_core(id),

  target_domain text not null
    check (target_domain in (
      'club_onboarding',
      'club_registration',
      'membership_application',
      'member_registry',
      'permits',
      'waters',
      'work_rules',
      'generic_domain'
    )),

  target_entity_type text null,
  target_entity_id uuid null,

  origin_process_type text not null default 'manual_import'
    check (origin_process_type in (
      'manual_import',
      'club_setup_import',
      'member_registry_sync',
      'domain_bulk_import',
      'system_replay'
    )),

  job_type text not null
    check (job_type in (
      'members_csv',
      'permits_csv',
      'waters_csv',
      'work_rules_csv',
      'generic_csv'
    )),

  job_mode text not null default 'dry_run'
    check (job_mode in ('dry_run', 'execute')),

  job_status text not null default 'uploaded'
    check (job_status in (
      'uploaded',
      'parsed',
      'mapped',
      'validated',
      'ready',
      'running',
      'partial_success',
      'completed',
      'failed',
      'cancelled',
      'rolled_back'
    )),

  initiated_by uuid null references auth.users(id),
  owner_identity_id uuid null references public.identity_core(identity_id),

  original_filename text null,
  file_mime_type text null,
  file_size_bytes bigint null,
  file_sha256 text null,

  csv_delimiter text null,
  csv_quote_char text null,
  csv_encoding text null,
  csv_has_header boolean not null default true,
  csv_bom_detected boolean not null default false,

  total_rows integer not null default 0,
  parsed_rows integer not null default 0,
  valid_rows integer not null default 0,
  invalid_rows integer not null default 0,
  warning_rows integer not null default 0,
  imported_rows integer not null default 0,
  skipped_rows integer not null default 0,
  conflict_rows integer not null default 0,

  partial_success_allowed boolean not null default true,
  rollback_supported boolean not null default false,
  rollback_status text null
    check (rollback_status is null or rollback_status in (
      'not_applicable',
      'possible',
      'requested',
      'executed',
      'blocked'
    )),

  source text null default 'csv_onboarding',
  external_ref text null,
  version integer not null default 1,

  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),

  constraint uq_import_jobs_file_hash_per_tenant
    unique (tenant_id, job_type, file_sha256, job_mode),

  constraint ck_import_jobs_target_context
    check (
      tenant_id is not null
      or club_core_id is not null
      or target_entity_id is not null
    )
);

create index if not exists idx_import_jobs_tenant_id
  on public.import_jobs(tenant_id);
create index if not exists idx_import_jobs_status
  on public.import_jobs(job_status);
create index if not exists idx_import_jobs_type
  on public.import_jobs(job_type);
create index if not exists idx_import_jobs_initiated_by
  on public.import_jobs(initiated_by);
create index if not exists idx_import_jobs_created_at
  on public.import_jobs(created_at desc);
create index if not exists idx_import_jobs_target_domain
  on public.import_jobs(target_domain);
create index if not exists idx_import_jobs_target_entity
  on public.import_jobs(target_entity_type, target_entity_id);


-- =========================================================
-- 2) imported source file / immutable source snapshot
-- keeps original source metadata and optional raw content reference
-- =========================================================
create table if not exists public.import_files (
  id uuid primary key default gen_random_uuid(),

  import_job_id uuid not null references public.import_jobs(id) on delete cascade,

  storage_provider text null,
  storage_bucket text null,
  storage_path text null,
  storage_url text null,

  original_filename text not null,
  mime_type text null,
  file_size_bytes bigint null,
  sha256 text not null,

  raw_text_snapshot text null,
  header_snapshot jsonb not null default '[]'::jsonb,

  source text null default 'csv_onboarding',
  external_ref text null,
  version integer not null default 1,

  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),

  constraint uq_import_files_job unique (import_job_id),
  constraint uq_import_files_sha256_per_job unique (import_job_id, sha256)
);

create index if not exists idx_import_files_import_job_id
  on public.import_files(import_job_id);


-- =========================================================
-- 3) mapping templates
-- reusable per tenant / job_type
-- technical import help only, not business truth
-- =========================================================
create table if not exists public.import_mapping_templates (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid null references public.tenant_nodes(tenant_id),
  club_core_id uuid null references public.club_core(id),

  template_key text not null,
  template_name text not null,
  job_type text not null
    check (job_type in (
      'members_csv',
      'permits_csv',
      'waters_csv',
      'work_rules_csv',
      'generic_csv'
    )),

  is_default boolean not null default false,
  is_active boolean not null default true,

  source text null default 'csv_onboarding',
  external_ref text null,
  version integer not null default 1,

  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),

  constraint uq_import_mapping_templates unique (tenant_id, template_key, version)
);

create index if not exists idx_import_mapping_templates_tenant_id
  on public.import_mapping_templates(tenant_id);
create index if not exists idx_import_mapping_templates_job_type
  on public.import_mapping_templates(job_type);


-- =========================================================
-- 4) concrete mapping versions used by import jobs
-- immutable snapshot of field mapping for reproducibility
-- =========================================================
create table if not exists public.import_mapping_versions (
  id uuid primary key default gen_random_uuid(),

  import_job_id uuid not null references public.import_jobs(id) on delete cascade,
  template_id uuid null references public.import_mapping_templates(id),

  mapping_version_no integer not null default 1,
  mapping_status text not null default 'draft'
    check (mapping_status in ('draft', 'validated', 'applied', 'archived')),

  field_mapping_json jsonb not null default '{}'::jsonb,
  normalization_rules_json jsonb not null default '{}'::jsonb,
  parsing_rules_json jsonb not null default '{}'::jsonb,

  source text null default 'csv_onboarding',
  external_ref text null,
  version integer not null default 1,

  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),

  constraint uq_import_mapping_versions unique (import_job_id, mapping_version_no)
);

create index if not exists idx_import_mapping_versions_import_job_id
  on public.import_mapping_versions(import_job_id);


-- =========================================================
-- 5) parsed rows
-- one row per source record
-- row state belongs to import orchestration, not business domain truth
-- =========================================================
create table if not exists public.import_rows (
  id uuid primary key default gen_random_uuid(),

  import_job_id uuid not null references public.import_jobs(id) on delete cascade,
  mapping_version_id uuid null references public.import_mapping_versions(id),

  row_no integer not null,
  row_hash text null,
  idempotency_key text null,

  row_status text not null default 'parsed'
    check (row_status in (
      'parsed',
      'mapped',
      'valid',
      'invalid',
      'warning',
      'conflict',
      'ready',
      'imported',
      'updated',
      'skipped',
      'failed',
      'rolled_back'
    )),

  source_values_json jsonb not null default '{}'::jsonb,
  normalized_values_json jsonb not null default '{}'::jsonb,
  target_preview_json jsonb not null default '{}'::jsonb,

  target_domain text null,
  target_table_family text null,
  target_entity_type text null,
  target_entity_id uuid null,

  source text null default 'csv_onboarding',
  external_ref text null,
  version integer not null default 1,

  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),

  constraint uq_import_rows_job_row_no unique (import_job_id, row_no)
);

create index if not exists idx_import_rows_import_job_id
  on public.import_rows(import_job_id);
create index if not exists idx_import_rows_status
  on public.import_rows(row_status);
create index if not exists idx_import_rows_idempotency_key
  on public.import_rows(idempotency_key);
create index if not exists idx_import_rows_target_entity
  on public.import_rows(target_entity_type, target_entity_id);


-- =========================================================
-- 6) row field mappings / explanations
-- optional detailed mapping trace per row/field
-- =========================================================
create table if not exists public.import_row_field_maps (
  id uuid primary key default gen_random_uuid(),

  import_row_id uuid not null references public.import_rows(id) on delete cascade,

  source_column_name text not null,
  source_column_index integer null,
  target_field_key text not null,

  raw_value text null,
  normalized_value text null,
  mapped_value_json jsonb null,

  mapping_method text null
    check (mapping_method is null or mapping_method in (
      'direct',
      'fuzzy',
      'template',
      'default',
      'manual',
      'derived'
    )),

  confidence_score numeric(5,2) null,

  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id)
);

create index if not exists idx_import_row_field_maps_import_row_id
  on public.import_row_field_maps(import_row_id);


-- =========================================================
-- 7) row issues / validation results
-- separates field validation from business rule validation
-- =========================================================
create table if not exists public.import_row_issues (
  id uuid primary key default gen_random_uuid(),

  import_row_id uuid not null references public.import_rows(id) on delete cascade,

  issue_level text not null
    check (issue_level in ('info', 'warning', 'error', 'conflict')),

  issue_category text not null
    check (issue_category in (
      'field_validation',
      'business_rule',
      'duplicate',
      'mapping',
      'format',
      'encoding',
      'missing_reference',
      'permission',
      'system'
    )),

  issue_code text not null,
  field_key text null,
  message text not null,
  details_json jsonb not null default '{}'::jsonb,

  is_blocking boolean not null default false,
  is_resolved boolean not null default false,
  resolved_at timestamptz null,
  resolved_by uuid null references auth.users(id),

  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id)
);

create index if not exists idx_import_row_issues_import_row_id
  on public.import_row_issues(import_row_id);
create index if not exists idx_import_row_issues_issue_level
  on public.import_row_issues(issue_level);
create index if not exists idx_import_row_issues_is_blocking
  on public.import_row_issues(is_blocking);


-- =========================================================
-- 8) row conflicts / dedupe candidates
-- explicit merge policy handling
-- =========================================================
create table if not exists public.import_row_conflicts (
  id uuid primary key default gen_random_uuid(),

  import_row_id uuid not null references public.import_rows(id) on delete cascade,

  conflict_type text not null
    check (conflict_type in (
      'duplicate_member',
      'duplicate_email',
      'duplicate_membership_no',
      'shared_family_contact',
      'existing_reference',
      'ambiguous_match',
      'custom'
    )),

  target_entity_type text null,
  target_entity_id uuid null,

  confidence_score numeric(5,2) null,
  match_basis_json jsonb not null default '{}'::jsonb,

  resolution_status text not null default 'pending'
    check (resolution_status in (
      'pending',
      'accepted_update',
      'accepted_merge',
      'accepted_skip',
      'accepted_create_new',
      'resolved_manual',
      'rejected'
    )),

  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);

create index if not exists idx_import_row_conflicts_import_row_id
  on public.import_row_conflicts(import_row_id);
create index if not exists idx_import_row_conflicts_resolution_status
  on public.import_row_conflicts(resolution_status);


-- =========================================================
-- 9) explicit admin decisions on rows/conflicts
-- =========================================================
create table if not exists public.import_row_decisions (
  id uuid primary key default gen_random_uuid(),

  import_row_id uuid not null references public.import_rows(id) on delete cascade,
  conflict_id uuid null references public.import_row_conflicts(id) on delete set null,

  decision_type text not null
    check (decision_type in (
      'confirm_create',
      'confirm_update',
      'confirm_merge',
      'skip_row',
      'ignore_warning',
      'manual_override',
      'rollback_row'
    )),

  decision_payload_json jsonb not null default '{}'::jsonb,

  decided_by uuid not null references auth.users(id),
  decided_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id)
);

create index if not exists idx_import_row_decisions_import_row_id
  on public.import_row_decisions(import_row_id);


-- =========================================================
-- 10) import results / write trace
-- tracks what object was created or updated by which row
-- the result log is traceability only; business truth remains in target tables
-- =========================================================
create table if not exists public.import_results (
  id uuid primary key default gen_random_uuid(),

  import_job_id uuid not null references public.import_jobs(id) on delete cascade,
  import_row_id uuid null references public.import_rows(id) on delete set null,

  action_type text not null
    check (action_type in (
      'create',
      'update',
      'merge',
      'skip',
      'noop',
      'rollback'
    )),

  target_entity_type text not null,
  target_entity_id uuid null,

  before_json jsonb null,
  after_json jsonb null,

  is_rollbackable boolean not null default false,
  rollback_group_key text null,

  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id)
);

create index if not exists idx_import_results_import_job_id
  on public.import_results(import_job_id);
create index if not exists idx_import_results_import_row_id
  on public.import_results(import_row_id);
create index if not exists idx_import_results_target_entity
  on public.import_results(target_entity_type, target_entity_id);


-- =========================================================
-- 11) job log / timeline
-- =========================================================
create table if not exists public.import_job_logs (
  id uuid primary key default gen_random_uuid(),

  import_job_id uuid not null references public.import_jobs(id) on delete cascade,

  log_level text not null
    check (log_level in ('debug', 'info', 'warning', 'error')),

  event_type text not null,
  message text not null,
  payload_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id)
);

create index if not exists idx_import_job_logs_import_job_id
  on public.import_job_logs(import_job_id);
create index if not exists idx_import_job_logs_created_at
  on public.import_job_logs(created_at desc);


-- =========================================================
-- 12) optional post-import health check snapshot
-- useful for the "what next?" UX after import
-- =========================================================
create table if not exists public.import_health_checks (
  id uuid primary key default gen_random_uuid(),

  import_job_id uuid not null references public.import_jobs(id) on delete cascade,

  summary_json jsonb not null default '{}'::jsonb,
  open_tasks_json jsonb not null default '[]'::jsonb,
  recommendation_json jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),

  constraint uq_import_health_checks_job unique (import_job_id)
);

create index if not exists idx_import_health_checks_import_job_id
  on public.import_health_checks(import_job_id);


-- =========================================================
-- 13) convenience comments
-- =========================================================
comment on table public.import_jobs is
  'Technical import orchestration job with explicit domain target, dry-run/execute mode and status tracking. Not a separate business truth space.';

comment on table public.import_files is
  'Immutable source file metadata and optional raw snapshot for reproducibility and audit.';

comment on table public.import_mapping_templates is
  'Reusable import mapping templates per tenant and import type. Technical helper layer only.';

comment on table public.import_mapping_versions is
  'Versioned mapping snapshots actually used by a specific import job.';

comment on table public.import_rows is
  'Parsed source rows with normalized values, preview payload and row status. Row state is import orchestration, not domain truth.';

comment on table public.import_row_issues is
  'Field validation, business rule and conflict issues per import row.';

comment on table public.import_row_conflicts is
  'Potential duplicate or merge conflicts per row with explicit resolution status.';

comment on table public.import_row_decisions is
  'Explicit admin decisions on rows/conflicts during validation or confirmation.';

comment on table public.import_results is
  'Write trace showing which target entities were created/updated/merged by an import. Final truth remains in the referenced domain entities.';

comment on table public.import_health_checks is
  'Post-import summary and next-step recommendations for activation UX.';

commit;
