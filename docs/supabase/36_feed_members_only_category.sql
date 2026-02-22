-- VDAN Template — feed category "nur_mitglieder" with member-only visibility
-- Run this after:
-- 35_meeting_attendees_manager_only.sql

begin;

alter table if exists public.feed_posts
  drop constraint if exists feed_posts_category_check;

alter table if exists public.feed_posts
  add constraint feed_posts_category_check
  check (category in ('info', 'termin', 'jugend', 'arbeitseinsatz', 'nur_mitglieder'));

drop policy if exists "feed_select_all" on public.feed_posts;
drop policy if exists "feed_select_public_or_member_only" on public.feed_posts;
create policy "feed_select_public_or_member_only"
on public.feed_posts for select
using (
  category <> 'nur_mitglieder'
  or auth.uid() is not null
);

commit;

-- Verification
-- select conname from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname='feed_posts' and c.conname='feed_posts_category_check';
-- select polname from pg_policy p join pg_class t on t.oid=p.polrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname='feed_posts' and p.polname='feed_select_public_or_member_only';
