-- =========================================================
-- FCP AI SCHEMA REFERENCE QUERY
-- =========================================================
-- Zweck:
-- - liefert einer KI einen kompakten, strukturierten Schema-Snapshot
-- - hilft bei der Ableitung von:
--   - Source of Truth
--   - Join-Pfaden
--   - global vs club-scoped Daten
--   - securityContext fuer RLS / RPC / Masken
--   - Views / RPCs / Funktionen
--   - SQL-Referenz fuer Masken, Prozesse und Read-/Write-Pfade
--
-- Verwendung:
-- 1) target_schemas setzen
-- 2) optional target_relations und target_terms einschränken
-- 3) Query ausführen
-- 4) die JSON-Antwort als einzige Schema-Referenz in den AI-Prozess geben
--
-- Hinweis:
-- - Diese Query liest nur Metadaten aus pg_catalog / information_schema.
-- - Keine echten Nutzdaten.
-- - Token-sparend, weil sie einen einzigen JSON-Block liefert.
-- =========================================================

with params as (
  select
    array['public']::text[] as target_schemas,
    array[]::text[] as target_relations,
    array[]::text[] as target_terms,
    true as include_views,
    true as include_functions
),
relations_base as (
  select
    n.nspname as schema_name,
    c.relname as relation_name,
    c.oid as relation_oid,
    case c.relkind
      when 'r' then 'table'
      when 'v' then 'view'
      when 'm' then 'materialized_view'
      when 'p' then 'partitioned_table'
      else c.relkind::text
    end as relation_kind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join params p on true
  where n.nspname = any(p.target_schemas)
    and c.relkind in ('r', 'v', 'm', 'p')
    and (
      cardinality(p.target_relations) = 0
      or c.relname = any(p.target_relations)
    )
    and (
      p.include_views
      or c.relkind in ('r', 'p')
    )
),
columns_enriched as (
  select
    rb.schema_name,
    rb.relation_name,
    rb.relation_oid,
    rb.relation_kind,
    c.ordinal_position,
    c.column_name,
    c.data_type,
    c.udt_name,
    c.is_nullable,
    c.column_default,
    pgd.description as column_comment,
    (
      c.column_name in (
        'id',
        'club_id',
        'tenant_id',
        'identity_id',
        'canonical_membership_id',
        'created_at',
        'created_by',
        'updated_at',
        'updated_by',
        'deleted_at',
        'source',
        'external_ref',
        'status'
      )
    ) as is_system_signal
  from relations_base rb
  join information_schema.columns c
    on c.table_schema = rb.schema_name
   and c.table_name = rb.relation_name
  left join pg_attribute a
    on a.attrelid = rb.relation_oid
   and a.attname = c.column_name
  left join pg_description pgd
    on pgd.objoid = rb.relation_oid
   and pgd.objsubid = a.attnum
),
pk_columns as (
  select
    tc.table_schema as schema_name,
    tc.table_name as relation_name,
    jsonb_agg(kcu.column_name order by kcu.ordinal_position) as pk_columns
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on kcu.constraint_schema = tc.constraint_schema
   and kcu.constraint_name = tc.constraint_name
   and kcu.table_schema = tc.table_schema
   and kcu.table_name = tc.table_name
  join params p on true
  where tc.constraint_type = 'PRIMARY KEY'
    and tc.table_schema = any(p.target_schemas)
  group by 1, 2
),
unique_constraints as (
  select
    tc.table_schema as schema_name,
    tc.table_name as relation_name,
    jsonb_agg(
      jsonb_build_object(
        'constraint_name', tc.constraint_name,
        'columns', uq.columns
      )
      order by tc.constraint_name
    ) as unique_constraints
  from information_schema.table_constraints tc
  join lateral (
    select jsonb_agg(kcu.column_name order by kcu.ordinal_position) as columns
    from information_schema.key_column_usage kcu
    where kcu.constraint_schema = tc.constraint_schema
      and kcu.constraint_name = tc.constraint_name
      and kcu.table_schema = tc.table_schema
      and kcu.table_name = tc.table_name
  ) uq on true
  join params p on true
  where tc.constraint_type = 'UNIQUE'
    and tc.table_schema = any(p.target_schemas)
  group by 1, 2
),
foreign_keys as (
  select
    tc.table_schema as from_schema,
    tc.table_name as from_relation,
    kcu.column_name as from_column,
    ccu.table_schema as to_schema,
    ccu.table_name as to_relation,
    ccu.column_name as to_column,
    tc.constraint_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on kcu.constraint_schema = tc.constraint_schema
   and kcu.constraint_name = tc.constraint_name
   and kcu.table_schema = tc.table_schema
   and kcu.table_name = tc.table_name
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_schema = tc.constraint_schema
   and ccu.constraint_name = tc.constraint_name
  join params p on true
  where tc.constraint_type = 'FOREIGN KEY'
    and tc.table_schema = any(p.target_schemas)
),
relation_signals as (
  select
    ce.schema_name,
    ce.relation_name,
    ce.relation_kind,
    bool_or(ce.column_name = 'club_id') as has_club_id,
    bool_or(ce.column_name = 'tenant_id') as has_tenant_id,
    bool_or(ce.column_name = 'identity_id') as has_identity_id,
    bool_or(ce.column_name = 'canonical_membership_id') as has_canonical_membership_id,
    bool_or(ce.column_name = 'created_at') as has_created_at,
    bool_or(ce.column_name = 'created_by') as has_created_by,
    bool_or(ce.column_name = 'updated_at') as has_updated_at,
    bool_or(ce.column_name = 'updated_by') as has_updated_by,
    bool_or(ce.column_name = 'deleted_at') as has_deleted_at,
    bool_or(ce.column_name = 'source') as has_source,
    bool_or(ce.column_name = 'external_ref') as has_external_ref,
    bool_or(ce.column_name = 'status') as has_status
  from columns_enriched ce
  group by 1, 2, 3
),
relation_scope as (
  select
    rs.*,
    case
      when has_tenant_id or has_club_id or has_canonical_membership_id then 'club_scoped'
      when has_identity_id then 'global_user'
      else 'global_or_system'
    end as inferred_scope,
    case
      when relation_name like '%audit%' then 'append_only_or_audit'
      when relation_name like '%history%' then 'append_only_or_history'
      when relation_name like '%view%' and relation_kind = 'view' then 'derived_view'
      when relation_kind in ('view', 'materialized_view') then 'derived_view'
      else 'candidate_source'
    end as truth_role_hint,
    (
      case when relation_kind in ('table', 'partitioned_table') then 20 else 0 end
      + case when has_deleted_at then -2 else 0 end
      + case when relation_name like '%audit%' then -10 else 0 end
      + case when relation_name like '%history%' then -8 else 0 end
      + case when relation_name like '%log%' then -8 else 0 end
      + case when relation_kind in ('view', 'materialized_view') then -6 else 0 end
      + case when has_source then 2 else 0 end
      + case when has_external_ref then 1 else 0 end
      + case when has_status then 1 else 0 end
    ) as source_of_truth_score
  from relation_signals rs
),
relation_security as (
  select
    rsc.*,
    case
      when rsc.inferred_scope = 'global_user' then 'self'
      when rsc.inferred_scope = 'club_scoped' and (
        rsc.relation_name like '%role%'
        or rsc.relation_name like '%admin%'
      ) then 'club_admin'
      when rsc.inferred_scope = 'club_scoped' then 'membership'
      else 'system'
    end as inferred_ownership,
    case
      when rsc.inferred_scope = 'club_scoped' then
        case
          when rsc.has_tenant_id then 'tenant_id'
          when rsc.has_club_id then 'club_id'
          when rsc.has_canonical_membership_id then 'canonical_membership_id'
          else 'tenant_id'
        end
      when rsc.inferred_scope = 'global_user' then
        case
          when rsc.has_identity_id then 'identity_id'
          else 'identity_id'
        end
      else 'none'
    end as inferred_rls_key,
    case
      when rsc.has_canonical_membership_id then 'canonical_membership_id'
      else null
    end as inferred_membership_key,
    case
      when rsc.inferred_scope = 'club_scoped' then true
      else false
    end as requires_tenant_access,
    case
      when rsc.inferred_scope = 'club_scoped' and (
        rsc.relation_name like '%role%'
        or rsc.relation_name like '%admin%'
      ) then true
      else false
    end as requires_role_check,
    case
      when rsc.inferred_scope = 'club_scoped' and (
        rsc.relation_name like '%role%'
        or rsc.relation_name like '%admin%'
      ) then jsonb_build_array('admin', 'vorstand', 'superadmin')
      else '[]'::jsonb
    end as allowed_roles,
    case
      when rsc.truth_role_hint like 'append_only%' then 'append_only'
      when rsc.relation_kind in ('view', 'materialized_view') then 'derived_view'
      else 'standard'
    end as security_mode,
    jsonb_build_object(
      'rlsKey',
      case
        when rsc.inferred_scope = 'club_scoped' then
          case
            when rsc.has_tenant_id then 'tenant_id'
            when rsc.has_club_id then 'club_id'
            when rsc.has_canonical_membership_id then 'canonical_membership_id'
            else 'tenant_id'
          end
        when rsc.inferred_scope = 'global_user' then 'identity_id'
        else 'none'
      end,
      'membershipKey',
      case
        when rsc.has_canonical_membership_id then 'canonical_membership_id'
        else null
      end,
      'requiresTenantAccess',
      case
        when rsc.inferred_scope = 'club_scoped' then true
        else false
      end,
      'requiresRoleCheck',
      case
        when rsc.inferred_scope = 'club_scoped' and (
          rsc.relation_name like '%role%'
          or rsc.relation_name like '%admin%'
        ) then true
        else false
      end,
      'allowedRoles',
      case
        when rsc.inferred_scope = 'club_scoped' and (
          rsc.relation_name like '%role%'
          or rsc.relation_name like '%admin%'
        ) then jsonb_build_array('admin', 'vorstand', 'superadmin')
        else '[]'::jsonb
      end,
      'serverValidatedRecommended', true
    ) as inferred_security,
    jsonb_build_array(
      case when rsc.has_tenant_id then 'tenant_key_present' end,
      case when rsc.has_club_id then 'club_key_present' end,
      case when rsc.has_canonical_membership_id then 'membership_key_present' end,
      case when rsc.has_identity_id then 'identity_key_present' end,
      case when rsc.relation_kind in ('view', 'materialized_view') then 'derived_relation' end,
      case when rsc.truth_role_hint like 'append_only%' then 'append_only_relation' end
    ) - null as security_hints,
    jsonb_build_array(
      case when rsc.inferred_scope = 'club_scoped' and not (rsc.has_tenant_id or rsc.has_club_id or rsc.has_canonical_membership_id) then 'club_scope_without_anchor_key' end,
      case when rsc.inferred_scope = 'global_user' and not rsc.has_identity_id then 'global_scope_without_identity_key' end,
      case when rsc.relation_kind in ('view', 'materialized_view') then 'not_primary_write_target' end,
      case when rsc.truth_role_hint like 'append_only%' then 'append_only_not_primary_truth' end
    ) - null as risk_flags
  from relation_scope rsc
),
relation_payload as (
  select
    rb.schema_name,
    rb.relation_name,
    jsonb_build_object(
      'schema', rb.schema_name,
      'name', rb.relation_name,
      'kind', rb.relation_kind,
      'scope', coalesce(rsec.inferred_scope, 'unknown'),
      'ownership', coalesce(rsec.inferred_ownership, 'unknown'),
      'truthRoleHint', coalesce(rsec.truth_role_hint, 'unknown'),
      'sourceOfTruthScore', coalesce(rsec.source_of_truth_score, 0),
      'inferredSecurity', coalesce(rsec.inferred_security, '{}'::jsonb),
      'securityHints', coalesce(rsec.security_hints, '[]'::jsonb),
      'riskFlags', coalesce(rsec.risk_flags, '[]'::jsonb),
      'securityContext', jsonb_build_object(
        'rlsKey', coalesce(rsec.inferred_rls_key, 'none'),
        'membershipKey', rsec.inferred_membership_key,
        'requiresTenantAccess', coalesce(rsec.requires_tenant_access, false),
        'requiresRoleCheck', coalesce(rsec.requires_role_check, false),
        'allowedRoles', coalesce(rsec.allowed_roles, '[]'::jsonb),
        'serverValidatedRecommended', true,
        'securityMode', coalesce(rsec.security_mode, 'standard')
      ),
      'auditSignals', jsonb_build_object(
        'created_at', coalesce(rsec.has_created_at, false),
        'created_by', coalesce(rsec.has_created_by, false),
        'updated_at', coalesce(rsec.has_updated_at, false),
        'updated_by', coalesce(rsec.has_updated_by, false),
        'deleted_at', coalesce(rsec.has_deleted_at, false),
        'source', coalesce(rsec.has_source, false),
        'external_ref', coalesce(rsec.has_external_ref, false),
        'status', coalesce(rsec.has_status, false)
      ),
      'primaryKey', coalesce(pk.pk_columns, '[]'::jsonb),
      'uniqueConstraints', coalesce(uq.unique_constraints, '[]'::jsonb),
      'columns', (
        select jsonb_agg(
          jsonb_build_object(
            'name', ce.column_name,
            'position', ce.ordinal_position,
            'dataType', ce.data_type,
            'udtName', ce.udt_name,
            'nullable', ce.is_nullable,
            'default', ce.column_default,
            'comment', ce.column_comment,
            'isSystemSignal', ce.is_system_signal,
            'inferredFieldScope',
            case
              when ce.column_name in ('club_id', 'tenant_id', 'canonical_membership_id') then 'club_scoped'
              when ce.column_name in ('identity_id', 'first_name', 'last_name', 'email', 'phone', 'avatar_url') then 'global_user'
              when ce.column_name in ('created_at', 'created_by', 'updated_at', 'updated_by', 'source', 'external_ref', 'status') then 'system_meta'
              else 'domain_field'
            end
          )
          order by ce.ordinal_position
        )
        from columns_enriched ce
        where ce.schema_name = rb.schema_name
          and ce.relation_name = rb.relation_name
      ),
      'joins', (
        select jsonb_agg(
          jsonb_build_object(
            'fromColumn', fk.from_column,
            'toSchema', fk.to_schema,
            'toRelation', fk.to_relation,
            'toColumn', fk.to_column,
            'constraintName', fk.constraint_name
          )
          order by fk.constraint_name, fk.from_column
        )
        from foreign_keys fk
        where fk.from_schema = rb.schema_name
          and fk.from_relation = rb.relation_name
      )
    ) as relation_json
  from relations_base rb
  left join relation_security rsec
    on rsec.schema_name = rb.schema_name
   and rsec.relation_name = rb.relation_name
  left join pk_columns pk
    on pk.schema_name = rb.schema_name
   and pk.relation_name = rb.relation_name
  left join unique_constraints uq
    on uq.schema_name = rb.schema_name
   and uq.relation_name = rb.relation_name
),
functions_base as (
  select
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as identity_arguments,
    pg_get_function_result(p.oid) as result_type,
    l.lanname as language_name,
    p.prokind,
    p.prosecdef as is_security_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  join params prm on true
  where prm.include_functions
    and n.nspname = any(prm.target_schemas)
),
function_payload as (
  select
    jsonb_agg(
      jsonb_build_object(
        'schema', fb.schema_name,
        'name', fb.function_name,
        'scope',
        case
          when fb.function_name like 'self_%' then 'global_user'
          when fb.function_name like 'admin_%' then 'club_override'
          else 'global_or_system'
        end,
        'ownership',
        case
          when fb.function_name like 'self_%' then 'self'
          when fb.function_name like 'admin_%' then 'club_admin'
          else 'system'
        end,
        'identityArguments', fb.identity_arguments,
        'resultType', fb.result_type,
        'language', fb.language_name,
        'securityDefiner', fb.is_security_definer,
        'rpcHint',
        case
          when fb.schema_name = 'public' then true
          else false
        end,
        'inferredSecurity', jsonb_build_object(
          'rlsKey',
          case
            when fb.function_name like 'self_%' then 'identity_id'
            when fb.function_name like 'admin_%' then 'tenant_id'
            else 'none'
          end,
          'membershipKey',
          case
            when fb.function_name like '%membership%' then 'canonical_membership_id'
            else null
          end,
          'requiresTenantAccess',
          case
            when fb.function_name like 'admin_%' then true
            else false
          end,
          'requiresRoleCheck',
          case
            when fb.function_name like 'admin_%' then true
            else false
          end,
          'allowedRoles',
          case
            when fb.function_name like 'admin_%' then jsonb_build_array('admin', 'vorstand', 'superadmin')
            else '[]'::jsonb
          end,
          'serverValidatedRecommended', true
        ),
        'securityHints', jsonb_build_array(
          case when fb.is_security_definer then 'security_definer' end,
          case when fb.function_name like 'self_%' then 'self_service_function' end,
          case when fb.function_name like 'admin_%' then 'admin_function' end
        ) - null,
        'riskFlags', jsonb_build_array(
          case when fb.is_security_definer is false then 'security_definer_not_enabled' end,
          case when fb.function_name like 'admin_%' and fb.schema_name <> 'public' then 'admin_function_outside_public' end
        ) - null,
        'securityContext', jsonb_build_object(
          'rlsKey',
          case
            when fb.function_name like 'self_%' then 'identity_id'
            when fb.function_name like 'admin_%' then 'tenant_id'
            else 'none'
          end,
          'membershipKey',
          case
            when fb.function_name like '%membership%' then 'canonical_membership_id'
            else null
          end,
          'requiresTenantAccess',
          case
            when fb.function_name like 'admin_%' then true
            else false
          end,
          'requiresRoleCheck',
          case
            when fb.function_name like 'admin_%' then true
            else false
          end,
          'allowedRoles',
          case
            when fb.function_name like 'admin_%' then jsonb_build_array('admin', 'vorstand', 'superadmin')
            else '[]'::jsonb
          end,
          'serverValidatedRecommended', true
        ),
        'processHint',
        case
          when fb.function_name like 'self_%' then 'self_service_candidate'
          when fb.function_name like 'admin_%' then 'admin_process_candidate'
          else 'general_function'
        end
      )
      order by fb.schema_name, fb.function_name, fb.identity_arguments
    ) as functions_json
  from functions_base fb
),
join_graph as (
  select jsonb_agg(
    jsonb_build_object(
      'from', fk.from_schema || '.' || fk.from_relation,
      'fromColumn', fk.from_column,
      'to', fk.to_schema || '.' || fk.to_relation,
      'toColumn', fk.to_column,
      'constraintName', fk.constraint_name
    )
    order by fk.from_schema, fk.from_relation, fk.constraint_name, fk.from_column
  ) as edges
  from foreign_keys fk
),
source_of_truth_hints as (
  select jsonb_agg(
    jsonb_build_object(
      'relation', rsec.schema_name || '.' || rsec.relation_name,
      'relationKind', rsec.relation_kind,
      'inferredScope', rsec.inferred_scope,
      'ownership', rsec.inferred_ownership,
      'truthRoleHint', rsec.truth_role_hint,
      'sourceOfTruthScore', rsec.source_of_truth_score,
      'inferredSecurity', rsec.inferred_security,
      'securityHints', rsec.security_hints,
      'riskFlags', rsec.risk_flags
    )
    order by rsec.source_of_truth_score desc, rsec.schema_name, rsec.relation_name
  ) as hints
  from relation_security rsec
),
process_hints as (
  select jsonb_build_object(
    'globalCandidates', (
      select coalesce(jsonb_agg(rsc.schema_name || '.' || rsc.relation_name order by rsc.schema_name, rsc.relation_name), '[]'::jsonb)
      from relation_security rsc
      where rsc.inferred_scope = 'global_user'
    ),
    'clubCandidates', (
      select coalesce(jsonb_agg(rsc.schema_name || '.' || rsc.relation_name order by rsc.schema_name, rsc.relation_name), '[]'::jsonb)
      from relation_security rsc
      where rsc.inferred_scope = 'club_scoped'
    ),
    'auditCandidates', (
      select coalesce(jsonb_agg(rsc.schema_name || '.' || rsc.relation_name order by rsc.schema_name, rsc.relation_name), '[]'::jsonb)
      from relation_security rsc
      where rsc.truth_role_hint like 'append_only%'
    ),
    'securityAuthoringHints', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'relation', rsc.schema_name || '.' || rsc.relation_name,
            'scope', rsc.inferred_scope,
            'ownership', rsc.inferred_ownership,
            'inferredSecurity', rsc.inferred_security,
            'securityHints', rsc.security_hints,
            'riskFlags', rsc.risk_flags,
            'securityContext', jsonb_build_object(
              'rlsKey', rsc.inferred_rls_key,
              'membershipKey', rsc.inferred_membership_key,
              'requiresTenantAccess', rsc.requires_tenant_access,
              'requiresRoleCheck', rsc.requires_role_check,
              'allowedRoles', rsc.allowed_roles,
              'serverValidatedRecommended', true,
              'securityMode', rsc.security_mode
            )
          )
          order by rsc.schema_name, rsc.relation_name
        ),
        '[]'::jsonb
      )
      from relation_security rsc
    )
  ) as hints
)
select jsonb_build_object(
  'context', jsonb_build_object(
    'targetSchemas', (select to_jsonb(target_schemas) from params),
    'targetRelations', (select to_jsonb(target_relations) from params),
    'targetTerms', (select to_jsonb(target_terms) from params),
    'generatedAt', now()
  ),
  'usageGuidance', jsonb_build_object(
    'goal', 'Use this JSON to derive source-of-truth tables, join paths, field scopes, securityContext, view/RPC candidates and the SQL reference for a mask or process.',
    'rules', jsonb_build_array(
      'Prefer base tables with the highest sourceOfTruthScore as source-of-truth candidates.',
      'Use joins from the join graph first; only invent manual joins when no FK edge exists.',
      'Treat relations with tenant_id, club_id or canonical_membership_id as club-scoped candidates.',
      'Treat relations with identity_id but no club/tenant key as global_user candidates.',
      'Treat audit/history/log relations as append-only support structures, not primary truth by default.',
      'Carry inferred securityContext into mask authoring; JSON must not invent club or tenant security on its own.',
      'For rpc and edge-function candidates, require serverValidated = true and derive tenant or membership checks from the relation securityContext.'
    )
  ),
  'relations', (
    select coalesce(jsonb_agg(rp.relation_json order by rp.schema_name, rp.relation_name), '[]'::jsonb)
    from relation_payload rp
  ),
  'joinGraph', coalesce((select edges from join_graph), '[]'::jsonb),
  'sourceOfTruthHints', coalesce((select hints from source_of_truth_hints), '[]'::jsonb),
  'functions', coalesce((select functions_json from function_payload), '[]'::jsonb),
  'processHints', coalesce((select hints from process_hints), '{}'::jsonb)
) as ai_schema_reference;
