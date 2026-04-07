begin;

-- =========================================================
-- C.1
-- BASE BACKFILL
-- fills:
-- - tenant_nodes
-- - club_core
-- - identity_core
-- - profiles_platform
-- - canonical_memberships
-- and then attaches:
-- - profiles
-- - club_members
-- - club_member_identities
--
-- additive only
-- no deletes
-- no drops
-- no trigger logic
-- =========================================================


-- =========================================================
-- 1) tenant_nodes aus bestehender Club-Welt
-- nimmt alle vorhandenen club_ids aus relevanten Alt-Tabellen
-- =========================================================
with legacy_clubs as (
  select club_id from public.profiles where club_id is not null
  union
  select club_id from public.club_members where club_id is not null
  union
  select club_id from public.club_member_identities where club_id is not null
  union
  select club_id from public.club_user_roles where club_id is not null
  union
  select club_id from public.club_events where club_id is not null
  union
  select club_id from public.documents where club_id is not null
  union
  select club_id from public.catch_entries where club_id is not null
  union
  select club_id from public.fishing_trips where club_id is not null
  union
  select club_id from public.club_billing_subscriptions where club_id is not null
  union
  select club_id from public.club_billing_webhook_events where club_id is not null
)
insert into public.tenant_nodes (
  tenant_type,
  tenant_key,
  legacy_club_id,
  status,
  module_key,
  domain_key,
  source
)
select
  'club',
  'club:' || lc.club_id::text,
  lc.club_id,
  'active',
  'FCP',
  'tenant',
  'backfill_c1'
from legacy_clubs lc
where not exists (
  select 1
  from public.tenant_nodes tn
  where tn.legacy_club_id = lc.club_id
);


-- =========================================================
-- 2) club_core zu tenant_nodes anlegen
-- noch bewusst minimal, weil evtl. keine saubere club master table existiert
-- =========================================================
insert into public.club_core (
  tenant_id,
  legacy_club_id,
  club_code,
  display_name,
  status,
  module_key,
  domain_key,
  source
)
select
  tn.tenant_id,
  tn.legacy_club_id,
  tn.club_code_snapshot,
  null,
  'active',
  'FCP',
  'club',
  'backfill_c1'
from public.tenant_nodes tn
where tn.legacy_club_id is not null
  and not exists (
    select 1
    from public.club_core cc
    where cc.tenant_id = tn.tenant_id
  );


-- =========================================================
-- 3) identity_core aus profiles erzeugen
-- Mapping über profiles.id -> auth.users.id
-- nur wenn Profile-ID wirklich User-ID ist
-- =========================================================
insert into public.identity_core (
  auth_user_id,
  ppuid,
  identity_type,
  status,
  module_key,
  domain_key,
  source
)
select
  p.id as auth_user_id,
  null,
  'human',
  'active',
  'FCP',
  'identity',
  'backfill_c1'
from public.profiles p
where not exists (
  select 1
  from public.identity_core ic
  where ic.auth_user_id = p.id
);


-- =========================================================
-- 4) profiles_platform aus profiles erzeugen
-- =========================================================
insert into public.profiles_platform (
  identity_id,
  display_name,
  first_name,
  last_name,
  email,
  profile_status,
  module_key,
  domain_key,
  source
)
select
  ic.identity_id,
  coalesce(
    nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
    p.email
  ) as display_name,
  p.first_name,
  p.last_name,
  p.email,
  'active',
  'FCP',
  'profile',
  'backfill_c1'
from public.profiles p
join public.identity_core ic
  on ic.auth_user_id = p.id
where not exists (
  select 1
  from public.profiles_platform pp
  where pp.identity_id = ic.identity_id
);


-- =========================================================
-- 5) profiles an neue Wahrheit anbinden
-- =========================================================
update public.profiles p
set
  identity_id = ic.identity_id,
  tenant_id = (
    select tn.tenant_id
    from public.tenant_nodes tn
    where tn.legacy_club_id = p.club_id
    limit 1
  ),
  source = coalesce(p.source, 'backfill_c1'),
  external_ref = coalesce(p.external_ref, 'profiles:' || p.id::text)
from public.identity_core ic
where ic.auth_user_id = p.id
  and (
    p.identity_id is distinct from ic.identity_id
    or p.tenant_id is distinct from (
      select tn.tenant_id
      from public.tenant_nodes tn
      where tn.legacy_club_id = p.club_id
      limit 1
    )
    or p.source is null
    or p.external_ref is null
  );


-- =========================================================
-- 6) club_member_identities an neue Wahrheit anbinden
-- hier ist user_id der wichtigste Join auf identity_core.auth_user_id
-- =========================================================
update public.club_member_identities cmi
set
  identity_id = ic.identity_id,
  tenant_id = (
    select tn.tenant_id
    from public.tenant_nodes tn
    where tn.legacy_club_id = cmi.club_id
    limit 1
  ),
  source = coalesce(cmi.source, 'backfill_c1'),
  external_ref = coalesce(
    cmi.external_ref,
    'club_member_identity:' || cmi.club_id::text || ':' || cmi.user_id::text
  )
from public.identity_core ic
where ic.auth_user_id = cmi.user_id
  and (
    cmi.identity_id is distinct from ic.identity_id
    or cmi.tenant_id is distinct from (
      select tn.tenant_id
      from public.tenant_nodes tn
      where tn.legacy_club_id = cmi.club_id
      limit 1
    )
    or cmi.source is null
    or cmi.external_ref is null
  );


-- =========================================================
-- 7) canonical_memberships erzeugen
-- aus club_member_identities
-- 1 identity + 1 tenant = 1 membership
-- =========================================================
insert into public.canonical_memberships (
  identity_id,
  tenant_id,
  legacy_club_id,
  membership_no,
  membership_type,
  status,
  joined_at,
  source,
  external_ref,
  module_key,
  domain_key
)
select
  cmi.identity_id,
  cmi.tenant_id,
  cmi.club_id,
  cmi.member_no,
  null,
  'active',
  null,
  'backfill_c1',
  'canonical_membership:' || cmi.club_id::text || ':' || cmi.user_id::text,
  'FCP',
  'membership'
from public.club_member_identities cmi
where cmi.identity_id is not null
  and cmi.tenant_id is not null
on conflict (identity_id, tenant_id) do update
set
  legacy_club_id = excluded.legacy_club_id,
  membership_no = coalesce(public.canonical_memberships.membership_no, excluded.membership_no),
  updated_at = now(),
  source = 'backfill_c1_refresh';


-- =========================================================
-- 8) club_member_identities an canonical_memberships anbinden
-- =========================================================
update public.club_member_identities cmi
set
  canonical_membership_id = cm.id
from public.canonical_memberships cm
where cm.identity_id = cmi.identity_id
  and cm.tenant_id = cmi.tenant_id
  and cmi.canonical_membership_id is distinct from cm.id;


-- =========================================================
-- 9) club_members an canonical_memberships anbinden
-- Join über club_id + member_no
-- falls member_no leer/unsauber ist, bleibt Feld bewusst leer
-- =========================================================
update public.club_members cm_old
set
  tenant_id = tn.tenant_id,
  canonical_membership_id = (
    select cm.id
    from public.canonical_memberships cm
    where cm.tenant_id = tn.tenant_id
      and cm.membership_no is not distinct from cm_old.member_no
    limit 1
  ),
  source = coalesce(cm_old.source, 'backfill_c1'),
  external_ref = coalesce(
    cm_old.external_ref,
    'club_member:' || cm_old.club_id::text || ':' || cm_old.member_no::text
  )
from public.tenant_nodes tn
where tn.legacy_club_id = cm_old.club_id
  and nullif(trim(cm_old.member_no), '') is not null
  and (
    cm_old.tenant_id is distinct from tn.tenant_id
    or cm_old.canonical_membership_id is distinct from (
      select cm.id
      from public.canonical_memberships cm
      where cm.tenant_id = tn.tenant_id
        and cm.membership_no is not distinct from cm_old.member_no
      limit 1
    )
    or cm_old.source is null
    or cm_old.external_ref is null
  );


-- =========================================================
-- 10) club_user_roles tenant/identity/membership backfill
-- Join über user_id + club_id
-- =========================================================
update public.club_user_roles cur
set
  identity_id = ic.identity_id,
  tenant_id = (
    select tn.tenant_id
    from public.tenant_nodes tn
    where tn.legacy_club_id = cur.club_id
    limit 1
  ),
  canonical_membership_id = (
    select cm.id
    from public.canonical_memberships cm
    where cm.identity_id = ic.identity_id
      and cm.tenant_id = (
        select tn.tenant_id
        from public.tenant_nodes tn
        where tn.legacy_club_id = cur.club_id
        limit 1
      )
    limit 1
  ),
  source = coalesce(cur.source, 'backfill_c1'),
  external_ref = coalesce(
    cur.external_ref,
    'club_user_role:' || cur.club_id::text || ':' || cur.user_id::text || ':' || cur.role_key
  )
from public.identity_core ic
where ic.auth_user_id = cur.user_id
  and (
    cur.identity_id is distinct from ic.identity_id
    or cur.tenant_id is distinct from (
      select tn.tenant_id
      from public.tenant_nodes tn
      where tn.legacy_club_id = cur.club_id
      limit 1
    )
    or cur.canonical_membership_id is distinct from (
      select cm.id
      from public.canonical_memberships cm
      where cm.identity_id = ic.identity_id
        and cm.tenant_id = (
          select tn.tenant_id
          from public.tenant_nodes tn
          where tn.legacy_club_id = cur.club_id
          limit 1
        )
      limit 1
    )
    or cur.source is null
    or cur.external_ref is null
  );


-- =========================================================
-- 11) user_roles tenant/identity/membership backfill
-- Join über user_id + club_id
-- =========================================================
update public.user_roles ur
set
  identity_id = ic.identity_id,
  tenant_id = (
    select tn.tenant_id
    from public.tenant_nodes tn
    where tn.legacy_club_id = ur.club_id
    limit 1
  ),
  canonical_membership_id = (
    select cm.id
    from public.canonical_memberships cm
    where cm.identity_id = ic.identity_id
      and cm.tenant_id = (
        select tn.tenant_id
        from public.tenant_nodes tn
        where tn.legacy_club_id = ur.club_id
        limit 1
      )
    limit 1
  ),
  source = coalesce(ur.source, 'backfill_c1'),
  external_ref = coalesce(
    ur.external_ref,
    'user_role:' || ur.club_id::text || ':' || ur.user_id::text || ':' || ur.role::text
  )
from public.identity_core ic
where ic.auth_user_id = ur.user_id
  and (
    ur.identity_id is distinct from ic.identity_id
    or ur.tenant_id is distinct from (
      select tn.tenant_id
      from public.tenant_nodes tn
      where tn.legacy_club_id = ur.club_id
      limit 1
    )
    or ur.canonical_membership_id is distinct from (
      select cm.id
      from public.canonical_memberships cm
      where cm.identity_id = ic.identity_id
        and cm.tenant_id = (
          select tn.tenant_id
          from public.tenant_nodes tn
          where tn.legacy_club_id = ur.club_id
          limit 1
        )
      limit 1
    )
    or ur.source is null
    or ur.external_ref is null
  );


commit;
