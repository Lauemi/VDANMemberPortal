-- VDAN Template — store fangliste trip photos in DB
-- Run this after:
-- 37_fangliste_multi_entries_and_editable.sql

begin;

alter table if exists public.fishing_trips
  add column if not exists photo_data_url text,
  add column if not exists photo_updated_at timestamptz;

commit;

-- Verification
-- select column_name from information_schema.columns where table_schema='public' and table_name='fishing_trips' and column_name in ('photo_data_url','photo_updated_at');
