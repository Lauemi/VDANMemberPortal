-- VDAN Template — public membership applications with manager approval workflow
-- Run this after:
-- 25_member_card_rotate.sql
--
-- IMPORTANT:
-- Set a strong encryption key in DB settings before productive use, e.g.:
--   alter database postgres set app.settings.encryption_key = '<min-16-char-secret>';

begin;

create extension if not exists pgcrypto with schema extensions;

create sequence if not exists public.membership_number_seq start 1000;

create table if not exists public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  first_name text not null,
  last_name text not null,
  birthdate date not null,
  street text not null,
  zip text not null,
  city text not null,
  is_local boolean not null default false,
  known_member text,
  fishing_card_type text not null,
  iban_last4 text not null check (iban_last4 ~ '^[0-9]{4}$'),
  sepa_approved boolean not null default true check (sepa_approved = true),
  internal_questionnaire jsonb,
  decision_by uuid references auth.users(id),
  decision_at timestamptz,
  rejection_reason text
);

create table if not exists public.membership_application_bank_data (
  application_id uuid primary key references public.membership_applications(id) on delete cascade,
  iban_encrypted bytea not null,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'inactive')),
  membership_number text unique,
  first_name text not null,
  last_name text not null,
  birthdate date not null,
  street text not null,
  zip text not null,
  city text not null,
  is_local boolean not null default false,
  known_member text,
  fishing_card_type text not null,
  sepa_approved boolean not null default true check (sepa_approved = true),
  source_application_id uuid unique references public.membership_applications(id)
);

create table if not exists public.member_bank_data (
  member_id uuid primary key references public.members(id) on delete cascade,
  source_application_id uuid references public.membership_applications(id),
  iban_encrypted bytea not null,
  iban_last4 text not null check (iban_last4 ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.membership_application_audit (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.membership_applications(id) on delete cascade,
  action text not null check (action in ('submitted', 'questionnaire_updated', 'approved', 'rejected')),
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_membership_applications_status_created
on public.membership_applications(status, created_at desc);

create index if not exists idx_membership_applications_decision_by
on public.membership_applications(decision_by, decision_at desc);

create index if not exists idx_members_status_membership_number
on public.members(status, membership_number);

create index if not exists idx_membership_application_audit_app
on public.membership_application_audit(application_id, created_at desc);

drop trigger if exists trg_membership_applications_touch on public.membership_applications;
create trigger trg_membership_applications_touch
before update on public.membership_applications
for each row execute function public.touch_updated_at();

drop trigger if exists trg_members_touch on public.members;
create trigger trg_members_touch
before update on public.members
for each row execute function public.touch_updated_at();

alter table public.membership_applications enable row level security;
alter table public.membership_application_bank_data enable row level security;
alter table public.members enable row level security;
alter table public.member_bank_data enable row level security;
alter table public.membership_application_audit enable row level security;

drop policy if exists "membership_applications_anon_insert" on public.membership_applications;
create policy "membership_applications_anon_insert"
on public.membership_applications for insert
to anon
with check (
  status = 'pending'
  and decision_by is null
  and decision_at is null
  and internal_questionnaire is null
  and rejection_reason is null
  and sepa_approved = true
);

drop policy if exists "membership_applications_manager_select" on public.membership_applications;
create policy "membership_applications_manager_select"
on public.membership_applications for select
to authenticated
using (public.is_admin_or_vorstand());

drop policy if exists "membership_applications_admin_all" on public.membership_applications;
create policy "membership_applications_admin_all"
on public.membership_applications for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "membership_application_bank_data_admin_all" on public.membership_application_bank_data;
create policy "membership_application_bank_data_admin_all"
on public.membership_application_bank_data for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "members_manager_select" on public.members;
create policy "members_manager_select"
on public.members for select
to authenticated
using (public.is_admin_or_vorstand());

drop policy if exists "members_admin_all" on public.members;
create policy "members_admin_all"
on public.members for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "member_bank_data_admin_all" on public.member_bank_data;
create policy "member_bank_data_admin_all"
on public.member_bank_data for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "membership_application_audit_manager_select" on public.membership_application_audit;
create policy "membership_application_audit_manager_select"
on public.membership_application_audit for select
to authenticated
using (public.is_admin_or_vorstand());

drop policy if exists "membership_application_audit_admin_all" on public.membership_application_audit;
create policy "membership_application_audit_admin_all"
on public.membership_application_audit for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.membership_get_encryption_key()
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_key text;
begin
  v_key := nullif(trim(current_setting('app.settings.encryption_key', true)), '');
  if v_key is null or length(v_key) < 16 then
    raise exception 'Encryption key missing. Set app.settings.encryption_key (min. 16 chars).';
  end if;
  return v_key;
end;
$$;

create or replace function public.membership_normalize_iban(p_iban text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(p_iban, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create or replace function public.membership_iban_last4(p_iban text)
returns text
language plpgsql
immutable
as $$
declare
  v_norm text := public.membership_normalize_iban(p_iban);
  v_digits text;
begin
  if length(v_norm) < 8 then
    raise exception 'IBAN appears invalid';
  end if;
  v_digits := regexp_replace(v_norm, '[^0-9]', '', 'g');
  if length(v_digits) < 4 then
    raise exception 'IBAN appears invalid';
  end if;
  return right(v_digits, 4);
end;
$$;

create or replace function public.submit_membership_application(
  p_first_name text,
  p_last_name text,
  p_birthdate date,
  p_street text,
  p_zip text,
  p_city text,
  p_is_local boolean,
  p_iban text,
  p_sepa_approved boolean,
  p_fishing_card_type text,
  p_known_member text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_app_id uuid;
  v_key text;
  v_iban_norm text;
  v_iban_last4 text;
begin
  if coalesce(p_sepa_approved, false) is distinct from true then
    raise exception 'SEPA approval is required';
  end if;

  v_key := public.membership_get_encryption_key();
  v_iban_norm := public.membership_normalize_iban(p_iban);
  v_iban_last4 := public.membership_iban_last4(v_iban_norm);

  insert into public.membership_applications (
    first_name,
    last_name,
    birthdate,
    street,
    zip,
    city,
    is_local,
    known_member,
    fishing_card_type,
    iban_last4,
    sepa_approved,
    status
  ) values (
    trim(p_first_name),
    trim(p_last_name),
    p_birthdate,
    trim(p_street),
    trim(p_zip),
    trim(p_city),
    coalesce(p_is_local, false),
    nullif(trim(p_known_member), ''),
    trim(p_fishing_card_type),
    v_iban_last4,
    true,
    'pending'
  )
  returning id into v_app_id;

  insert into public.membership_application_bank_data (application_id, iban_encrypted)
  values (
    v_app_id,
    extensions.pgp_sym_encrypt(v_iban_norm, v_key, 'cipher-algo=aes256')
  );

  insert into public.membership_application_audit (application_id, action, actor_id, payload)
  values (
    v_app_id,
    'submitted',
    auth.uid(),
    jsonb_build_object('is_local', coalesce(p_is_local, false), 'fishing_card_type', trim(p_fishing_card_type))
  );

  return v_app_id;
end;
$$;

create or replace function public.membership_set_internal_questionnaire(
  p_application_id uuid,
  p_internal_questionnaire jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can edit questionnaire';
  end if;

  if p_internal_questionnaire is null or jsonb_typeof(p_internal_questionnaire) <> 'object' then
    raise exception 'internal_questionnaire must be a JSON object';
  end if;

  update public.membership_applications
  set internal_questionnaire = p_internal_questionnaire,
      updated_at = now()
  where id = p_application_id
    and status = 'pending';

  if not found then
    raise exception 'Application not found or not pending';
  end if;

  insert into public.membership_application_audit (application_id, action, actor_id, payload)
  values (
    p_application_id,
    'questionnaire_updated',
    auth.uid(),
    jsonb_build_object('keys', (select jsonb_agg(key) from jsonb_object_keys(p_internal_questionnaire) as key))
  );
end;
$$;

create or replace function public.approve_membership(
  p_application_id uuid,
  p_membership_number text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_app public.membership_applications;
  v_member_id uuid;
  v_membership_number text;
  v_iban bytea;
  v_questionnaire_keys int;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can approve';
  end if;

  select *
  into v_app
  from public.membership_applications
  where id = p_application_id
    and status = 'pending'
  for update;

  if v_app.id is null then
    raise exception 'Application not found or already processed';
  end if;

  if v_app.internal_questionnaire is null or jsonb_typeof(v_app.internal_questionnaire) <> 'object' then
    raise exception 'Internal questionnaire is required before approval';
  end if;

  select count(*) into v_questionnaire_keys
  from jsonb_object_keys(v_app.internal_questionnaire);

  if coalesce(v_questionnaire_keys, 0) = 0 then
    raise exception 'Internal questionnaire must not be empty';
  end if;

  v_membership_number := nullif(trim(p_membership_number), '');
  if v_membership_number is null then
    v_membership_number := 'M' || lpad(nextval('public.membership_number_seq')::text, 6, '0');
  end if;

  select b.iban_encrypted
  into v_iban
  from public.membership_application_bank_data b
  where b.application_id = v_app.id;

  if v_iban is null then
    raise exception 'Encrypted IBAN missing for application';
  end if;

  insert into public.members (
    membership_number,
    first_name,
    last_name,
    birthdate,
    street,
    zip,
    city,
    is_local,
    known_member,
    fishing_card_type,
    sepa_approved,
    status,
    source_application_id
  ) values (
    v_membership_number,
    v_app.first_name,
    v_app.last_name,
    v_app.birthdate,
    v_app.street,
    v_app.zip,
    v_app.city,
    v_app.is_local,
    v_app.known_member,
    v_app.fishing_card_type,
    v_app.sepa_approved,
    'active',
    v_app.id
  )
  returning id into v_member_id;

  insert into public.member_bank_data (
    member_id,
    source_application_id,
    iban_encrypted,
    iban_last4
  ) values (
    v_member_id,
    v_app.id,
    v_iban,
    v_app.iban_last4
  );

  update public.membership_applications
  set status = 'approved',
      decision_by = auth.uid(),
      decision_at = now(),
      updated_at = now(),
      rejection_reason = null
  where id = v_app.id;

  insert into public.membership_application_audit (application_id, action, actor_id, payload)
  values (
    v_app.id,
    'approved',
    auth.uid(),
    jsonb_build_object('member_id', v_member_id, 'membership_number', v_membership_number)
  );

  return v_member_id;
end;
$$;

create or replace function public.reject_membership(
  p_application_id uuid,
  p_rejection_reason text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_app public.membership_applications;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can reject';
  end if;

  select *
  into v_app
  from public.membership_applications
  where id = p_application_id
    and status = 'pending'
  for update;

  if v_app.id is null then
    raise exception 'Application not found or already processed';
  end if;

  update public.membership_applications
  set status = 'rejected',
      decision_by = auth.uid(),
      decision_at = now(),
      updated_at = now(),
      rejection_reason = nullif(trim(p_rejection_reason), '')
  where id = v_app.id;

  insert into public.membership_application_audit (application_id, action, actor_id, payload)
  values (
    v_app.id,
    'rejected',
    auth.uid(),
    jsonb_build_object('reason', nullif(trim(p_rejection_reason), ''))
  );
end;
$$;

create or replace view public.export_members
with (security_invoker = true)
as
select
  m.membership_number,
  m.first_name,
  m.last_name,
  m.birthdate,
  m.street,
  m.zip,
  m.city,
  m.fishing_card_type,
  m.is_local,
  m.created_at
from public.members m
where m.status = 'active';

grant select on public.membership_applications to authenticated;
grant select on public.membership_application_audit to authenticated;
grant select on public.members to authenticated;
grant select on public.export_members to authenticated;

revoke execute on function public.membership_get_encryption_key() from public, anon, authenticated;
revoke execute on function public.membership_normalize_iban(text) from public, anon, authenticated;
revoke execute on function public.membership_iban_last4(text) from public, anon, authenticated;
revoke execute on function public.submit_membership_application(
  text, text, date, text, text, text, boolean, text, boolean, text, text
) from public;
revoke execute on function public.membership_set_internal_questionnaire(uuid, jsonb) from public, anon;
revoke execute on function public.approve_membership(uuid, text) from public, anon;
revoke execute on function public.reject_membership(uuid, text) from public, anon;

grant execute on function public.submit_membership_application(
  text, text, date, text, text, text, boolean, text, boolean, text, text
) to anon, authenticated;

grant execute on function public.membership_set_internal_questionnaire(uuid, jsonb) to authenticated;
grant execute on function public.approve_membership(uuid, text) to authenticated;
grant execute on function public.reject_membership(uuid, text) to authenticated;

commit;
