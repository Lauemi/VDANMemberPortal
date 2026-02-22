-- VDAN Template — feed media: allow jpeg fallback for clients without webp encode support
-- Run this after:
-- 04_feed_post_media.sql

begin;

update storage.buckets
set allowed_mime_types = array['image/webp', 'image/jpeg']
where id = 'feed-media';

commit;

-- Verification
-- select id, allowed_mime_types from storage.buckets where id='feed-media';
