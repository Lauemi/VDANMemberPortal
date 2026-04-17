-- =============================================================
-- Storage Hardening: feed-media Bucket + Policies
-- =============================================================
-- Behebt Advisor-Warnung: public_bucket_allows_listing
--
-- PROBLEM:
--   feed_media_public_read hatte USING (bucket_id = 'feed-media')
--   ohne Einschränkung — erlaubt jedem (inkl. anon) das vollständige
--   Listing aller Objekte in storage.objects für diesen Bucket.
--
-- LÖSUNG:
--   Die SELECT-Policy wird entfernt. Für öffentliche Objekt-URLs
--   wird sie nicht benötigt: der Bucket ist public = true, und
--   /storage/v1/object/public/feed-media/<path> wird vom Storage-API
--   außerhalb von RLS serviert. Listing ist damit nicht mehr möglich.
--
-- KEIN IMPACT auf:
--   - Öffentliche Anzeige über bekannten Pfad (Public-URL, kein RLS)
--   - Authenticated Upload (INSERT-Policy bleibt unverändert)
--   - Authenticated Delete (DELETE-Policy bleibt unverändert)
--   - Authenticated Update (UPDATE-Policy bleibt unverändert)
--
-- Alle Policies idempotent neu gesetzt (DROP IF EXISTS + CREATE).
-- Bucket-Konfiguration erstmals als Repo-Artefakt belegt.
-- =============================================================

begin;

-- -------------------------------------------------------------
-- 1. Bucket dokumentieren (idempotent)
--    public = true bleibt — nötig für /object/public/-URLs
--    file_size_limit = 512 KB, nur webp + jpeg erlaubt
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feed-media',
  'feed-media',
  true,
  524288,
  array['image/webp', 'image/jpeg']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- -------------------------------------------------------------
-- 2. Alle bisherigen feed-media Policies entfernen (idempotent)
-- -------------------------------------------------------------
drop policy if exists "feed_media_public_read"    on storage.objects;
drop policy if exists "feed_media_manager_insert" on storage.objects;
drop policy if exists "feed_media_manager_delete" on storage.objects;
drop policy if exists "feed_media_manager_update" on storage.objects;

-- -------------------------------------------------------------
-- 3. SELECT-Policy: bewusst nicht wiederhergestellt
--
--    Öffentlicher Objekt-Zugriff via Public-URL benötigt keine
--    RLS SELECT-Policy. Der Bucket public = true stellt sicher,
--    dass /storage/v1/object/public/feed-media/<path>
--    direkt vom Storage-API serviert wird.
--
--    Listing (/storage/v1/object/list/feed-media) ist damit nicht
--    mehr möglich — Advisor-Warnung public_bucket_allows_listing
--    ist damit behoben.
-- -------------------------------------------------------------

-- -------------------------------------------------------------
-- 4. INSERT-Policy: Authenticated Upload in posts/-Pfad
--    Nur admin / vorstand (is_admin_or_vorstand())
-- -------------------------------------------------------------
create policy "feed_media_manager_insert"
  on storage.objects
  for insert
  to public
  with check (
    bucket_id = 'feed-media'
    and is_admin_or_vorstand()
    and name like 'posts/%'
  );

-- -------------------------------------------------------------
-- 5. UPDATE-Policy: Authenticated Replace in posts/-Pfad
--    Nur admin / vorstand
-- -------------------------------------------------------------
create policy "feed_media_manager_update"
  on storage.objects
  for update
  to public
  using (
    bucket_id = 'feed-media'
    and is_admin_or_vorstand()
    and name like 'posts/%'
  )
  with check (
    bucket_id = 'feed-media'
    and is_admin_or_vorstand()
    and name like 'posts/%'
  );

-- -------------------------------------------------------------
-- 6. DELETE-Policy: Authenticated Delete in posts/-Pfad
--    Nur admin / vorstand
-- -------------------------------------------------------------
create policy "feed_media_manager_delete"
  on storage.objects
  for delete
  to public
  using (
    bucket_id = 'feed-media'
    and is_admin_or_vorstand()
    and name like 'posts/%'
  );

commit;
