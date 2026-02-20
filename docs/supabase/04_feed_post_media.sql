-- VDAN Template — feed post media (max 2 images per post)
-- Run this after:
-- 00_baseline.sql
-- 02_feed_posts.sql

begin;

-- 1) Storage bucket for feed images (public read)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feed-media', 'feed-media', true, 524288, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- 2) Media metadata table
create table if not exists public.feed_post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  sort_order smallint not null check (sort_order between 1 and 2),
  storage_bucket text not null default 'feed-media',
  storage_path text not null unique,
  photo_bytes integer not null check (photo_bytes > 0),
  width integer,
  height integer,
  mime_type text not null default 'image/webp',
  uploaded_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 years'),
  created_by uuid not null references auth.users(id) on delete cascade,
  unique (post_id, sort_order)
);

create index if not exists idx_feed_post_media_post on public.feed_post_media(post_id);
create index if not exists idx_feed_post_media_expires on public.feed_post_media(expires_at);

alter table public.feed_post_media enable row level security;

grant select on public.feed_post_media to anon, authenticated;
grant insert, update, delete on public.feed_post_media to authenticated;

-- 3) Enforce max. 2 images per post
create or replace function public.enforce_feed_media_limit()
returns trigger language plpgsql as $$
declare
  media_count integer;
begin
  select count(*) into media_count
  from public.feed_post_media m
  where m.post_id = new.post_id
    and (tg_op <> 'UPDATE' or m.id <> new.id);

  if media_count >= 2 then
    raise exception 'Maximal 2 Bilder pro Feed-Post erlaubt.';
  end if;

  return new;
end $$;

drop trigger if exists trg_feed_media_limit on public.feed_post_media;
create trigger trg_feed_media_limit
before insert or update on public.feed_post_media
for each row execute function public.enforce_feed_media_limit();

-- 4) RLS: read all, write only admin/vorstand

drop policy if exists "feed_media_select_all" on public.feed_post_media;
create policy "feed_media_select_all"
on public.feed_post_media for select
using (true);

drop policy if exists "feed_media_insert_manager" on public.feed_post_media;
create policy "feed_media_insert_manager"
on public.feed_post_media for insert
with check (public.is_admin_or_vorstand() and auth.uid() = created_by);

drop policy if exists "feed_media_update_manager" on public.feed_post_media;
create policy "feed_media_update_manager"
on public.feed_post_media for update
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

drop policy if exists "feed_media_delete_manager" on public.feed_post_media;
create policy "feed_media_delete_manager"
on public.feed_post_media for delete
using (public.is_admin_or_vorstand());

-- 5) Storage policies

drop policy if exists "feed_media_public_read" on storage.objects;
create policy "feed_media_public_read"
on storage.objects for select
using (bucket_id = 'feed-media');

drop policy if exists "feed_media_manager_insert" on storage.objects;
create policy "feed_media_manager_insert"
on storage.objects for insert
with check (
  bucket_id = 'feed-media'
  and public.is_admin_or_vorstand()
  and name like 'posts/%'
);

drop policy if exists "feed_media_manager_update" on storage.objects;
create policy "feed_media_manager_update"
on storage.objects for update
using (
  bucket_id = 'feed-media'
  and public.is_admin_or_vorstand()
  and name like 'posts/%'
)
with check (
  bucket_id = 'feed-media'
  and public.is_admin_or_vorstand()
  and name like 'posts/%'
);

drop policy if exists "feed_media_manager_delete" on storage.objects;
create policy "feed_media_manager_delete"
on storage.objects for delete
using (
  bucket_id = 'feed-media'
  and public.is_admin_or_vorstand()
  and name like 'posts/%'
);

commit;
