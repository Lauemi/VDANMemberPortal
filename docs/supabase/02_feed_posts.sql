-- VDAN Template — feed posts + role extension (service role)
-- Run this after 00_baseline.sql

begin;

-- 1) Extend role model to include 'vorstand'
alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles
  add constraint user_roles_role_check
  check (role in ('member','admin','vorstand'));

-- 2) Helper: admin or vorstand
create or replace function public.is_admin_or_vorstand()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin','vorstand')
  );
$$;

-- 3) Let users read their own roles (admins still manage all)
drop policy if exists "roles_select_own" on public.user_roles;
create policy "roles_select_own"
on public.user_roles for select
using (auth.uid() = user_id or public.is_admin());

-- 4) Feed table
create table if not exists public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('info','termin','jugend','arbeitseinsatz')),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_feed_posts_created_at_desc on public.feed_posts(created_at desc);

alter table public.feed_posts enable row level security;

drop trigger if exists trg_feed_posts_touch on public.feed_posts;
create trigger trg_feed_posts_touch
before update on public.feed_posts
for each row execute function public.touch_updated_at();

-- public read for homepage feed
grant select on public.feed_posts to anon, authenticated;
-- writes only for logged-in users; RLS limits to admin/vorstand
grant insert, update, delete on public.feed_posts to authenticated;

-- RLS policies
drop policy if exists "feed_select_all" on public.feed_posts;
create policy "feed_select_all"
on public.feed_posts for select
using (true);

drop policy if exists "feed_insert_manager" on public.feed_posts;
create policy "feed_insert_manager"
on public.feed_posts for insert
with check (public.is_admin_or_vorstand() and auth.uid() = author_id);

drop policy if exists "feed_update_manager" on public.feed_posts;
create policy "feed_update_manager"
on public.feed_posts for update
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

drop policy if exists "feed_delete_manager" on public.feed_posts;
create policy "feed_delete_manager"
on public.feed_posts for delete
using (public.is_admin_or_vorstand());

commit;
