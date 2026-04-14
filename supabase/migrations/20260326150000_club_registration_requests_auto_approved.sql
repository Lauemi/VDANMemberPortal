begin;
alter table public.club_registration_requests
  add column if not exists auto_approved boolean not null default false;
create index if not exists idx_club_registration_requests_auto_approved
  on public.club_registration_requests (auto_approved, created_at desc);
commit;
