-- VDAN Template — contact requests (anti-spam ready)
-- Run this after:
-- 27_member_privacy_lifecycle.sql

begin;

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ip_hash text not null,
  user_agent text,
  email text not null,
  name text not null,
  subject text not null,
  message text not null,
  turnstile_verified boolean not null default false,
  email_verified boolean not null default false,
  status text not null default 'pending' check (status in ('pending','confirmed','sent','rejected')),
  honeypot_triggered boolean not null default false,
  spam_score integer not null default 0,
  rejection_reason text,
  confirm_token_hash text unique,
  confirm_expires_at timestamptz,
  confirmed_at timestamptz
);

create index if not exists idx_contact_requests_created_at on public.contact_requests(created_at desc);
create index if not exists idx_contact_requests_status_created on public.contact_requests(status, created_at desc);
create index if not exists idx_contact_requests_ip_hash_created on public.contact_requests(ip_hash, created_at desc);
create index if not exists idx_contact_requests_email_created on public.contact_requests(email, created_at desc);

drop trigger if exists trg_contact_requests_touch on public.contact_requests;
create trigger trg_contact_requests_touch
before update on public.contact_requests
for each row execute function public.touch_updated_at();

alter table public.contact_requests enable row level security;

drop policy if exists "contact_requests_manager_select" on public.contact_requests;
create policy "contact_requests_manager_select"
on public.contact_requests for select
to authenticated
using (public.is_admin_or_vorstand());

drop policy if exists "contact_requests_admin_all" on public.contact_requests;
create policy "contact_requests_admin_all"
on public.contact_requests for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.contact_requests to authenticated;

commit;
