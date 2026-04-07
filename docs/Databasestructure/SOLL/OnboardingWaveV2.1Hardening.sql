begin;

-- =========================================================
-- V2.1 HARDENING
-- minimal hardening only
-- no redesign
-- =========================================================


-- =========================================================
-- 1) tenant_id is leading context
-- club_core_id must belong to same tenant if both are set
-- implemented via composite FK helper
-- =========================================================

-- helper unique for composite reference
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'uq_club_core_id_tenant'
      and conrelid = 'public.club_core'::regclass
  ) then
    alter table public.club_core
      add constraint uq_club_core_id_tenant unique (id, tenant_id);
  end if;
end
$$;

-- add helper columns for composite FK safety on import_jobs
alter table public.import_jobs
  add column if not exists club_core_tenant_id uuid null;

-- keep helper column aligned manually for now; no trigger yet
update public.import_jobs ij
set club_core_tenant_id = cc.tenant_id
from public.club_core cc
where ij.club_core_id = cc.id
  and ij.club_core_tenant_id is distinct from cc.tenant_id;

-- if club_core_id is set, helper tenant must match same club_core tenant
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_import_jobs_club_core_same_tenant'
      and conrelid = 'public.import_jobs'::regclass
  ) then
    alter table public.import_jobs
      add constraint fk_import_jobs_club_core_same_tenant
      foreign key (club_core_id, club_core_tenant_id)
      references public.club_core (id, tenant_id);
  end if;
end
$$;

-- sanity rule:
-- if club_core_id is set, tenant_id should also be present
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_import_jobs_club_core_requires_tenant'
      and conrelid = 'public.import_jobs'::regclass
  ) then
    alter table public.import_jobs
      add constraint ck_import_jobs_club_core_requires_tenant
      check (
        club_core_id is null
        or tenant_id is not null
      );
  end if;
end
$$;

-- stronger rule:
-- helper tenant must equal leading tenant when both are set
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_import_jobs_tenant_alignment'
      and conrelid = 'public.import_jobs'::regclass
  ) then
    alter table public.import_jobs
      add constraint ck_import_jobs_tenant_alignment
      check (
        club_core_id is null
        or (
          tenant_id is not null
          and club_core_tenant_id is not null
          and club_core_tenant_id = tenant_id
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_import_jobs_club_core_helper_nullability'
      and conrelid = 'public.import_jobs'::regclass
  ) then
    alter table public.import_jobs
      add constraint ck_import_jobs_club_core_helper_nullability
      check (
        (club_core_id is null and club_core_tenant_id is null)
        or (club_core_id is not null and club_core_tenant_id is not null)
      );
  end if;
end
$$;


-- same hardening for mapping templates
alter table public.import_mapping_templates
  add column if not exists club_core_tenant_id uuid null;

update public.import_mapping_templates imt
set club_core_tenant_id = cc.tenant_id
from public.club_core cc
where imt.club_core_id = cc.id
  and imt.club_core_tenant_id is distinct from cc.tenant_id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_import_mapping_templates_club_core_same_tenant'
      and conrelid = 'public.import_mapping_templates'::regclass
  ) then
    alter table public.import_mapping_templates
      add constraint fk_import_mapping_templates_club_core_same_tenant
      foreign key (club_core_id, club_core_tenant_id)
      references public.club_core (id, tenant_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_import_mapping_templates_club_core_requires_tenant'
      and conrelid = 'public.import_mapping_templates'::regclass
  ) then
    alter table public.import_mapping_templates
      add constraint ck_import_mapping_templates_club_core_requires_tenant
      check (
        club_core_id is null
        or tenant_id is not null
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_import_mapping_templates_tenant_alignment'
      and conrelid = 'public.import_mapping_templates'::regclass
  ) then
    alter table public.import_mapping_templates
      add constraint ck_import_mapping_templates_tenant_alignment
      check (
        club_core_id is null
        or (
          tenant_id is not null
          and club_core_tenant_id is not null
          and club_core_tenant_id = tenant_id
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_import_mapping_templates_club_core_helper_nullability'
      and conrelid = 'public.import_mapping_templates'::regclass
  ) then
    alter table public.import_mapping_templates
      add constraint ck_import_mapping_templates_club_core_helper_nullability
      check (
        (club_core_id is null and club_core_tenant_id is null)
        or (club_core_id is not null and club_core_tenant_id is not null)
      );
  end if;
end
$$;


-- =========================================================
-- 2) owner vs initiator semantics as durable comments
-- =========================================================
comment on column public.import_jobs.initiated_by is
  'Technical actor/user who started the import job. Used for audit and execution trace.';
comment on column public.import_jobs.owner_identity_id is
  'Business owner/responsible identity for the import context. May differ from initiated_by.';
comment on column public.import_jobs.club_core_tenant_id is
  'Helper tenant reference derived from club_core_id to enforce tenant-context alignment without triggers.';
comment on column public.import_mapping_templates.club_core_tenant_id is
  'Helper tenant reference derived from club_core_id to enforce tenant-context alignment without triggers.';


-- =========================================================
-- 3) nullable unique hardening
-- existing unique constraints with nullable tenant_id can allow duplicates
-- add partial unique indexes for tenant and global scope
-- =========================================================

-- import_jobs:
-- tenant-scoped uniqueness when tenant_id is present
create unique index if not exists uq_import_jobs_file_hash_per_tenant_nn
  on public.import_jobs (tenant_id, job_type, file_sha256, job_mode)
  where tenant_id is not null
    and file_sha256 is not null;

-- global/pre-tenant uniqueness when tenant_id is null
create unique index if not exists uq_import_jobs_file_hash_global_nulltenant
  on public.import_jobs (job_type, file_sha256, job_mode, target_domain)
  where tenant_id is null
    and file_sha256 is not null;

-- import_mapping_templates:
-- tenant-scoped uniqueness when tenant_id is present
create unique index if not exists uq_import_mapping_templates_nn
  on public.import_mapping_templates (tenant_id, template_key, version)
  where tenant_id is not null;

-- global/pre-tenant uniqueness when tenant_id is null
create unique index if not exists uq_import_mapping_templates_global_nulltenant
  on public.import_mapping_templates (template_key, version, job_type)
  where tenant_id is null;


commit;
