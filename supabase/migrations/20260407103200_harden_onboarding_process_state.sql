begin;

create extension if not exists pgcrypto with schema extensions;

-- =========================================================
-- HARDEN: public.get_onboarding_process_state
-- =========================================================
-- Vorgänger-SQL-Template: docs/masks/templates/VDAN_get_onboarding_process_state.sql
-- Hardening-Punkte (4):
--   1. invite_state CTE: Placeholder durch echte Validierung gegen app_secure_settings
--      ersetzt. Nutzt SHA-256-Hash des Tokens (identisch zu club-invite-verify Edge Fn).
--      Liefert jetzt korrekt: NONE / ACTIVE / USED / EXPIRED / REVOKED / INVALID
--   2. consent_state CTE: Gegen aktive Policy-Versionen gehärtet.
--      Prüft jetzt legal_acceptance_events + legal_documents.is_active statt
--      nur policy_key-Vorhandensein in user_policy_acceptances.
--   3. actor-Block: first_name ergänzt (aus profile_row CTE, war bereits selektiert).
--   4. next_allowed_step_id: Echter Lookahead statt Kopie von current_step_id.
--      Findet den nächsten Step in Ordnung nach current_step_id,
--      der nicht locked/blocked/failed/skipped ist.
-- =========================================================

create or replace function public.get_onboarding_process_state(
  p_club_id uuid default null,
  p_invite_token text default null,
  p_include_debug boolean default false
)
returns jsonb
language sql
security definer
set search_path = public
as $$
with actor as (
  select
    auth.uid() as auth_user_id
),
auth_guard as (
  select *
  from actor
  where auth_user_id is not null
),
profile_row as (
  select
    p.id as profile_id,
    p.email,
    p.display_name,
    p.first_name,
    p.last_name,
    p.club_id as profile_club_id,
    p.member_no as profile_member_no,
    p.canonical_membership_id,
    p.identity_id
  from public.profiles p
  join auth_guard a
    on p.id = a.auth_user_id
  limit 1
),
identity_links as (
  select
    cmi.club_id,
    cmi.tenant_id,
    cmi.user_id,
    cmi.member_no,
    cmi.identity_id,
    cmi.canonical_membership_id,
    cmi.updated_at
  from public.club_member_identities cmi
  join auth_guard a
    on cmi.user_id = a.auth_user_id
),
membership_rows as (
  select
    cm.club_id,
    cm.tenant_id,
    cm.member_no,
    case
      when upper(coalesce(cm.status, '')) = 'ACTIVE' then 'ACTIVE'
      when upper(coalesce(cm.status, '')) = 'BLOCKED' then 'BLOCKED'
      when upper(coalesce(cm.status, '')) = 'INVITED' then 'INVITED'
      else 'INVITED'
    end as membership_status,
    cm.first_name,
    cm.last_name,
    null::text as email,
    cm.canonical_membership_id,
    cm.identity_id
  from public.club_members cm
  join identity_links il
    on il.club_id = cm.club_id
   and il.member_no = cm.member_no
  union
  select
    cm.club_id,
    cm.tenant_id,
    cm.member_no,
    case
      when upper(coalesce(cm.status, '')) = 'ACTIVE' then 'ACTIVE'
      when upper(coalesce(cm.status, '')) = 'BLOCKED' then 'BLOCKED'
      when upper(coalesce(cm.status, '')) = 'INVITED' then 'INVITED'
      else 'INVITED'
    end as membership_status,
    cm.first_name,
    cm.last_name,
    null::text as email,
    cm.canonical_membership_id,
    cm.identity_id
  from public.club_members cm
  join profile_row pr
    on pr.profile_club_id = cm.club_id
   and pr.profile_member_no = cm.member_no
),
club_candidates as (
  select distinct
    coalesce(mr.club_id, il.club_id) as club_id,
    coalesce(mr.tenant_id, il.tenant_id) as tenant_id,
    coalesce(mr.canonical_membership_id, il.canonical_membership_id) as canonical_membership_id,
    coalesce(mr.membership_status, 'INVITED') as membership_status
  from membership_rows mr
  full outer join identity_links il
    on il.club_id = mr.club_id
   and il.member_no = mr.member_no
  where coalesce(mr.club_id, il.club_id) is not null
),
requested_context as (
  select
    case
      when p_club_id is not null
       and exists (
         select 1
         from club_candidates cc
         where cc.club_id = p_club_id
       )
        then p_club_id
      else null
    end as requested_club_id
),
resolved_context as (
  select
    case
      when (select requested_club_id from requested_context) is not null
        then (select requested_club_id from requested_context)
      when public.current_user_club_id() is not null
        then public.current_user_club_id()
      when (select count(*) from club_candidates) = 1
        then (select club_id from club_candidates limit 1)
      else null
    end as resolved_club_id,
    (select count(*) from club_candidates) as active_club_count
),
selected_context as (
  select
    rc.resolved_club_id,
    cc.tenant_id as resolved_tenant_id,
    cc.canonical_membership_id,
    cc.membership_status
  from resolved_context rc
  left join club_candidates cc
    on cc.club_id = rc.resolved_club_id
),
club_snapshot as (
  select s.*
  from selected_context sc
  left join lateral public.club_onboarding_snapshot(sc.resolved_club_id) s
    on sc.resolved_club_id is not null
),
billing_row as (
  select
    cbs.club_id,
    cbs.billing_state,
    cbs.checkout_state,
    cbs.provider,
    cbs.current_period_end,
    cbs.canceled_at
  from public.club_billing_subscriptions cbs
  join selected_context sc
    on sc.resolved_club_id = cbs.club_id
  limit 1
),
club_names as (
  select
    cc.club_id,
    req.club_name
  from club_candidates cc
  left join lateral public.club_onboarding_requirements(cc.club_id) req
    on true
),
role_context as (
  select
    case
      when sc.resolved_club_id is not null
        then public.current_user_has_role_in_club(sc.resolved_club_id, array['admin', 'vorstand'])
      else false
    end as can_manage_billing
  from selected_context sc
),
-- [HARDENED 1/4] invite_record
-- Lädt den Invite-Datensatz aus app_secure_settings anhand des SHA-256-Hashes des Tokens.
-- Schlüssel-Format: club_invite_token:{encode(extensions.digest(token, 'sha256'), 'hex')}
-- Entspricht exakt der Semantik der club-invite-verify Edge Function.
invite_record as (
  select
    s.setting_value::jsonb as rec
  from public.app_secure_settings s
  where nullif(trim(p_invite_token), '') is not null
    and s.setting_key = 'club_invite_token:' || encode(extensions.digest(nullif(trim(p_invite_token), ''), 'sha256'), 'hex')
  limit 1
),
-- [HARDENED 1/4] invite_state
-- Leitet exakt einen der 6 erlaubten Zustände ab:
-- NONE (kein Token) / ACTIVE / USED (exhausted) / EXPIRED / REVOKED / INVALID (nicht gefunden)
-- Ersetzt den Placeholder, der jeden nicht-leeren Token als ACTIVE behandelt hat.
invite_state as (
  select
    case
      when nullif(trim(p_invite_token), '') is null
        then 'NONE'
      when (select rec from invite_record) is null
        then 'INVALID'
      when ((select rec from invite_record) ->> 'status') = 'revoked'
        then 'REVOKED'
      when ((select rec from invite_record) ->> 'expires_at')::timestamptz < now()
        then 'EXPIRED'
      when ((select rec from invite_record) ->> 'status') = 'exhausted'
        or (
          ((select rec from invite_record) ->> 'used_count')::int
          >= ((select rec from invite_record) ->> 'max_uses')::int
        )
        then 'USED'
      else 'ACTIVE'
    end as invite_status,
    case
      when nullif(trim(p_invite_token), '') is null then false
      when (select rec from invite_record) is null then false
      when ((select rec from invite_record) ->> 'status') = 'revoked' then false
      when ((select rec from invite_record) ->> 'expires_at')::timestamptz < now() then false
      when ((select rec from invite_record) ->> 'status') = 'exhausted'
        or (
          ((select rec from invite_record) ->> 'used_count')::int
          >= ((select rec from invite_record) ->> 'max_uses')::int
        ) then false
      else true
    end as invite_claimable
),
-- [HARDENED 2/4] required_policy_versions
-- Liest die aktuell aktive Version je Policy-Key aus legal_documents.
-- Versionswahrheit kommt aus der DB, nicht aus dem Client.
required_policy_versions as (
  select
    (
      select version
      from public.legal_documents
      where document_key = 'terms'
        and is_active
      limit 1
    ) as terms_version,
    (
      select version
      from public.legal_documents
      where document_key = 'privacy'
        and is_active
      limit 1
    ) as privacy_version
),
-- [HARDENED 2/4] consent_state
-- Prüft legal_acceptance_events gegen die aktive Dokumentversion aus legal_documents.
-- Ersetzt den Vorgänger, der nur das Vorhandensein irgendeiner Acceptance in
-- user_policy_acceptances prüfte – ohne Versionsvalidierung.
-- AVV ist club-scoped (accepted_scope = 'club') und kein Teil von consent_complete
-- im User-Onboarding-Prozess (wird separat durch Vorstand/Admin akzeptiert).
consent_state as (
  select
    exists (
      select 1
      from public.legal_acceptance_events lae
      join auth_guard a on lae.accepted_by_user_id = a.auth_user_id
      where lae.document_key = 'terms'
        and lae.accepted_scope = 'user'
        and lae.document_version = (select terms_version from required_policy_versions)
    ) as has_terms,
    exists (
      select 1
      from public.legal_acceptance_events lae
      join auth_guard a on lae.accepted_by_user_id = a.auth_user_id
      where lae.document_key = 'privacy'
        and lae.accepted_scope = 'user'
        and lae.document_version = (select privacy_version from required_policy_versions)
    ) as has_privacy,
    false as has_avv
),
axes as (
  select
    case
      when (select auth_user_id from auth_guard) is null then 'NEW'
      when (select active_club_count from resolved_context) = 0 then 'NO_CLUB'
      when (select active_club_count from resolved_context) = 1 then 'SINGLE'
      when (select active_club_count from resolved_context) > 1 then 'MULTI'
      else 'AUTH'
    end as user_state,
    (select invite_status from invite_state) as invite_state,
    coalesce((select membership_status from selected_context), 'NONE') as membership_state,
    case
      when (select resolved_club_id from selected_context) is null then 'NONE'
      when upper(coalesce((select billing_state from billing_row), 'none')) = 'ACTIVE' then 'ACTIVE'
      when upper(coalesce((select billing_state from billing_row), 'none')) in ('PAST_DUE', 'CANCELED') then 'SUSPENDED'
      when (select setup_state from club_snapshot limit 1) = 'pending_setup' then 'PENDING_SETUP'
      when lower(coalesce((select billing_state from billing_row), 'none')) in ('none', 'checkout_open') then 'PENDING_PAYMENT'
      else upper(coalesce((select setup_state from club_snapshot limit 1), 'pending_setup'))
    end as club_state,
    upper(coalesce((select billing_state from billing_row), 'none')) as billing_state,
    case
      when (select auth_user_id from auth_guard) is null then 'blocked'
      when coalesce((select membership_status from selected_context), 'NONE') = 'ACTIVE' then 'membership_active'
      when coalesce((select has_terms from consent_state), false)
       and coalesce((select has_privacy from consent_state), false)
        then 'identity_verified_membership_pending'
      when (select canonical_membership_id from selected_context) is not null then 'claim_matched_unverified'
      when (select invite_claimable from invite_state) then 'claim_pending_match'
      else 'auth_present_unclaimed'
    end as claim_state
),
requirements as (
  select
    ((select auth_user_id from auth_guard) is not null) as auth_present,
    (select invite_claimable from invite_state) as invite_claimable,
    ((select canonical_membership_id from selected_context) is not null) as identity_bound,
    (
      coalesce(nullif(trim((select first_name from profile_row)), ''), '') <> ''
      and coalesce(nullif(trim((select last_name from profile_row)), ''), '') <> ''
    ) as profile_complete,
    (
      coalesce((select has_terms from consent_state), false)
      and coalesce((select has_privacy from consent_state), false)
    ) as consent_complete,
    (coalesce((select billing_state from billing_row), 'none') = 'active') as billing_ready,
    (coalesce((select membership_status from selected_context), 'NONE') = 'ACTIVE') as membership_active,
    coalesce((select can_manage_billing from role_context), false) as can_manage_billing,
    (
      (select active_club_count from resolved_context) > 1
      and (select resolved_club_id from selected_context) is null
    ) as needs_club_selection
),
step_rows as (
  select *
  from (
    values
      (
        'auth_presence'::text,
        case when (select auth_present from requirements) then 'completed' else 'active' end,
        true,
        false,
        (select auth_present from requirements),
        null::text
      ),
      (
        'claim_match'::text,
        case
          when (select membership_active from requirements) then 'completed'
          when (select needs_club_selection from requirements) then 'locked'
          when (select invite_state from axes) in ('EXPIRED', 'REVOKED', 'INVALID') then 'blocked'
          when (select invite_claimable from requirements) or (select identity_bound from requirements) then 'active'
          else 'available'
        end,
        true,
        not (select needs_club_selection from requirements),
        (select identity_bound from requirements) or (select membership_active from requirements),
        case
          when (select needs_club_selection from requirements) then 'club_context_selection_required'
          when (select invite_state from axes) in ('EXPIRED', 'REVOKED', 'INVALID') then 'invite_not_claimable'
          else null
        end
      ),
      (
        'identity_binding'::text,
        case
          when (select identity_bound from requirements) then 'completed'
          when (select invite_claimable from requirements) then 'active'
          else 'locked'
        end,
        true,
        ((select invite_claimable from requirements) or (select identity_bound from requirements)),
        (select identity_bound from requirements),
        case
          when not (select invite_claimable from requirements) and not (select identity_bound from requirements)
            then 'claim_required_first'
          else null
        end
      ),
      (
        'profile_completion'::text,
        case
          when (select profile_complete from requirements) then 'completed'
          when (select identity_bound from requirements) then 'active'
          else 'locked'
        end,
        true,
        (select identity_bound from requirements),
        (select profile_complete from requirements),
        case
          when not (select identity_bound from requirements) then 'identity_binding_required_first'
          else null
        end
      ),
      (
        'consent'::text,
        case
          when (select consent_complete from requirements) then 'completed'
          when (select profile_complete from requirements) then 'active'
          else 'locked'
        end,
        true,
        (select profile_complete from requirements),
        (select consent_complete from requirements),
        case
          when not (select profile_complete from requirements) then 'profile_completion_required_first'
          else null
        end
      ),
      (
        'billing_enablement'::text,
        case
          when (select user_state from axes) in ('NO_CLUB', 'AUTH') then 'skipped'
          when not (select can_manage_billing from requirements) then 'skipped'
          when coalesce((select billing_state from axes), 'NONE') = 'ACTIVE' then 'completed'
          when (select club_state from axes) = 'PENDING_PAYMENT' then 'active'
          else 'skipped'
        end,
        (
          ((select user_state from axes) in ('SINGLE', 'MULTI'))
          and (select can_manage_billing from requirements)
        ),
        (
          ((select user_state from axes) in ('SINGLE', 'MULTI'))
          and (select can_manage_billing from requirements)
        ),
        (select billing_ready from requirements),
        null::text
      ),
      (
        'membership_activation'::text,
        case
          when (select membership_active from requirements) then 'completed'
          when (select consent_complete from requirements) then 'active'
          else 'locked'
        end,
        true,
        false,
        (select membership_active from requirements),
        case
          when not (select consent_complete from requirements) then 'consent_required_first'
          else null
        end
      )
  ) as t(id, status, visible, editable, completed, blocked_reason)
),
step_projection as (
  select
    id,
    status,
    visible,
    editable,
    completed,
    blocked_reason,
    true as server_unlock
  from step_rows
),
process_projection as (
  select
    case
      when (select auth_present from requirements) = false then 'blocked'
      when (select needs_club_selection from requirements) then 'blocked'
      when (select membership_active from requirements) then 'completed'
      else 'in_progress'
    end as process_status,
    coalesce(
      (select id from step_projection where blocked_reason = 'club_context_selection_required' limit 1),
      (select id from step_projection where status = 'active' order by
        case id
          when 'auth_presence' then 1
          when 'claim_match' then 2
          when 'identity_binding' then 3
          when 'profile_completion' then 4
          when 'consent' then 5
          when 'billing_enablement' then 6
          when 'membership_activation' then 7
          else 999
        end
       limit 1),
      (select id from step_projection where status = 'available' order by
        case id
          when 'auth_presence' then 1
          when 'claim_match' then 2
          when 'identity_binding' then 3
          when 'profile_completion' then 4
          when 'consent' then 5
          when 'billing_enablement' then 6
          when 'membership_activation' then 7
          else 999
        end
       limit 1),
      (select id from step_projection where status = 'completed' order by
        case id
          when 'membership_activation' then 1
          else 999
        end
       limit 1)
    ) as current_step_id
),
-- [HARDENED 4/4] next_step_lookahead
-- Echter Lookahead: nächster Step in der geordneten Sequenz nach current_step_id,
-- der nicht locked / blocked / failed / skipped ist.
-- Ersetzt den Placeholder (next_allowed_step_id = current_step_id).
next_step_lookahead as (
  select
    (
      select sp.id
      from step_projection sp
      where
        (case sp.id
          when 'auth_presence' then 1
          when 'claim_match' then 2
          when 'identity_binding' then 3
          when 'profile_completion' then 4
          when 'consent' then 5
          when 'billing_enablement' then 6
          when 'membership_activation' then 7
          else 999
        end) > (
          select case pp.current_step_id
            when 'auth_presence' then 1
            when 'claim_match' then 2
            when 'identity_binding' then 3
            when 'profile_completion' then 4
            when 'consent' then 5
            when 'billing_enablement' then 6
            when 'membership_activation' then 7
            else 999
          end
          from process_projection pp
        )
        and sp.status not in ('locked', 'blocked', 'failed', 'skipped')
      order by case sp.id
        when 'auth_presence' then 1
        when 'claim_match' then 2
        when 'identity_binding' then 3
        when 'profile_completion' then 4
        when 'consent' then 5
        when 'billing_enablement' then 6
        when 'membership_activation' then 7
        else 999
      end
      limit 1
    ) as next_allowed_step_id
)
select jsonb_build_object(
  'process', jsonb_build_object(
    'process_id', 'vdan_member_onboarding',
    'status', (select process_status from process_projection),
    'current_step_id', (select current_step_id from process_projection),
    'resume_step_id', (select current_step_id from process_projection),
    -- [HARDENED 4/4] next_allowed_step_id: echter Lookahead, Fallback auf current_step_id
    'next_allowed_step_id', coalesce(
      (select next_allowed_step_id from next_step_lookahead),
      (select current_step_id from process_projection)
    ),
    'blocking_reason_code',
      case
        when (select needs_club_selection from requirements) then 'club_context_selection_required'
        when (select process_status from process_projection) = 'blocked' then 'auth_required'
        else null
      end,
    'blocking_reason_message',
      case
        when (select needs_club_selection from requirements) then 'Mehrere Club-Kontexte vorhanden. Auswahl erforderlich.'
        when (select process_status from process_projection) = 'blocked' then 'Authentifizierung erforderlich.'
        else null
      end,
    'failure_code', null,
    'failure_message', null,
    'retry_allowed', true
  ),
  'actor', jsonb_build_object(
    'auth_user_id', (select auth_user_id from auth_guard),
    'email', (select email from profile_row),
    'profile_id', (select profile_id from profile_row),
    'display_name', (select display_name from profile_row),
    -- [HARDENED 3/4] first_name: war in profile_row selektiert, fehlte im Output
    'first_name', (select first_name from profile_row),
    'profile_complete', (select profile_complete from requirements)
  ),
  'axes', jsonb_build_object(
    'user_state', (select user_state from axes),
    'invite_state', (select invite_state from axes),
    'membership_state', (select membership_state from axes),
    'club_state', (select club_state from axes),
    'billing_state', (select billing_state from axes),
    'claim_state', (select claim_state from axes)
  ),
  'context', jsonb_build_object(
    'resolved_club_id', (select resolved_club_id from selected_context),
    'resolved_tenant_id', (select resolved_tenant_id from selected_context),
    'canonical_membership_id', (select canonical_membership_id from selected_context),
    'active_club_count', (select active_club_count from resolved_context),
    'available_clubs',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'club_id', cc.club_id,
              'tenant_id', cc.tenant_id,
              'club_name', cn.club_name,
              'membership_state', cc.membership_status,
              'selected', cc.club_id = (select resolved_club_id from selected_context)
            )
            order by cc.club_id
          )
          from club_candidates cc
          left join club_names cn
            on cn.club_id = cc.club_id
        ),
        '[]'::jsonb
      )
  ),
  'requirements', jsonb_build_object(
    'auth_present', (select auth_present from requirements),
    'invite_claimable', (select invite_claimable from requirements),
    'identity_bound', (select identity_bound from requirements),
    'profile_complete', (select profile_complete from requirements),
    'consent_complete', (select consent_complete from requirements),
    'billing_ready', (select billing_ready from requirements),
    'membership_active', (select membership_active from requirements),
    'can_manage_billing', (select can_manage_billing from requirements),
    'needs_club_selection', (select needs_club_selection from requirements)
  ),
  'steps',
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', sp.id,
          'status', sp.status,
          'visible', sp.visible,
          'editable', sp.editable,
          'completed', sp.completed,
          'blocked_reason', sp.blocked_reason,
          'server_unlock', sp.server_unlock
        )
        order by
          case sp.id
            when 'auth_presence' then 1
            when 'claim_match' then 2
            when 'identity_binding' then 3
            when 'profile_completion' then 4
            when 'consent' then 5
            when 'billing_enablement' then 6
            when 'membership_activation' then 7
            else 999
          end
      )
      from step_projection sp
    ),
  'debug',
    case
      when p_include_debug then jsonb_build_object(
        'selected_context', (select to_jsonb(sc) from selected_context sc),
        'club_snapshot', (select to_jsonb(cs) from club_snapshot cs limit 1),
        'billing_row', (select to_jsonb(br) from billing_row br limit 1)
      )
      else null
    end
);
$$;

grant execute on function public.get_onboarding_process_state(uuid, text, boolean) to authenticated;

commit;
