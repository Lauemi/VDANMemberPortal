begin;

create table if not exists public.club_registration_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  requester_email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  club_name text not null check (char_length(trim(club_name)) >= 2),
  club_address text not null check (char_length(trim(club_address)) >= 5),
  responsible_name text not null check (char_length(trim(responsible_name)) >= 2),
  responsible_email text not null check (position('@' in responsible_email) > 1),
  club_size text not null,
  club_mail_confirmed boolean not null default false,
  approved_club_id uuid,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rejected_by uuid references auth.users(id) on delete set null,
  rejected_at timestamptz,
  rejection_reason text,
  request_payload jsonb not null default '{}'::jsonb,
  decision_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_club_registration_requests_pending_user
  on public.club_registration_requests (requester_user_id)
  where status = 'pending';

create index if not exists idx_club_registration_requests_status_created
  on public.club_registration_requests (status, created_at desc);

create index if not exists idx_club_registration_requests_requester
  on public.club_registration_requests (requester_user_id, created_at desc);

drop trigger if exists trg_club_registration_requests_touch on public.club_registration_requests;
create trigger trg_club_registration_requests_touch
before update on public.club_registration_requests
for each row execute function public.touch_updated_at();

alter table public.club_registration_requests enable row level security;

drop policy if exists "club_registration_requests_select_own_or_admin" on public.club_registration_requests;
create policy "club_registration_requests_select_own_or_admin"
on public.club_registration_requests
for select
to authenticated
using (
  requester_user_id = auth.uid()
  or public.is_admin_in_any_club()
);

create or replace function public.club_request_gate_state()
returns table(
  request_id uuid,
  status text,
  club_name text,
  responsible_name text,
  responsible_email text,
  approved_club_id uuid,
  rejection_reason text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, auth, pg_catalog
as $$
  select
    r.id,
    r.status,
    r.club_name,
    r.responsible_name,
    r.responsible_email,
    r.approved_club_id,
    r.rejection_reason,
    r.created_at,
    r.updated_at
  from public.club_registration_requests r
  where r.requester_user_id = auth.uid()
  order by r.created_at desc
  limit 1
$$;

grant execute on function public.club_request_gate_state() to authenticated;

create or replace function public.create_club_request_from_signup()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_mode text := lower(trim(coalesce(new.raw_user_meta_data ->> 'registration_mode', '')));
  v_existing_pending uuid;
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;

  if v_mode <> 'club_request_pending' then
    return new;
  end if;

  select r.id
    into v_existing_pending
  from public.club_registration_requests r
  where r.requester_user_id = new.id
    and r.status = 'pending'
  limit 1;

  if v_existing_pending is not null then
    return new;
  end if;

  insert into public.club_registration_requests (
    requester_user_id,
    requester_email,
    status,
    club_name,
    club_address,
    responsible_name,
    responsible_email,
    club_size,
    club_mail_confirmed,
    request_payload
  )
  values (
    new.id,
    lower(trim(coalesce(new.email, ''))),
    'pending',
    trim(coalesce(new.raw_user_meta_data ->> 'club_name', '')),
    trim(coalesce(new.raw_user_meta_data ->> 'club_address', '')),
    trim(coalesce(new.raw_user_meta_data ->> 'responsible_name', '')),
    lower(trim(coalesce(new.raw_user_meta_data ->> 'responsible_email', ''))),
    trim(coalesce(new.raw_user_meta_data ->> 'club_size', '')),
    coalesce((new.raw_user_meta_data ->> 'club_mail_confirmed')::boolean, false),
    jsonb_build_object(
      'registration_mode', v_mode,
      'onboarding_path', trim(coalesce(new.raw_user_meta_data ->> 'onboarding_path', '')),
      'billing_status', trim(coalesce(new.raw_user_meta_data ->> 'billing_status', '')),
      'club_name', trim(coalesce(new.raw_user_meta_data ->> 'club_name', '')),
      'club_address', trim(coalesce(new.raw_user_meta_data ->> 'club_address', '')),
      'responsible_name', trim(coalesce(new.raw_user_meta_data ->> 'responsible_name', '')),
      'responsible_email', lower(trim(coalesce(new.raw_user_meta_data ->> 'responsible_email', ''))),
      'club_size', trim(coalesce(new.raw_user_meta_data ->> 'club_size', '')),
      'club_mail_confirmed', coalesce((new.raw_user_meta_data ->> 'club_mail_confirmed')::boolean, false)
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_auth_create_club_request on auth.users;
create trigger trg_auth_create_club_request
after insert on auth.users
for each row
execute function public.create_club_request_from_signup();

commit;
