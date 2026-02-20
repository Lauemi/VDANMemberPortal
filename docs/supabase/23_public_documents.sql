-- VDAN Template — public documents index for downloads page
-- Run this after existing core migrations

begin;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  description text,
  public_url text,
  storage_bucket text,
  storage_path text,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_source_check check (
    (public_url is not null and length(trim(public_url)) > 0)
    or (
      storage_bucket is not null and length(trim(storage_bucket)) > 0
      and storage_path is not null and length(trim(storage_path)) > 0
    )
  )
);

create index if not exists idx_documents_category_sort on public.documents(category, sort_order, title);
create index if not exists idx_documents_active on public.documents(is_active);

alter table public.documents enable row level security;

drop trigger if exists trg_documents_touch on public.documents;
create trigger trg_documents_touch
before update on public.documents
for each row execute function public.touch_updated_at();

drop policy if exists "documents_select_public" on public.documents;
create policy "documents_select_public"
on public.documents for select
using (true);

drop policy if exists "documents_write_manager" on public.documents;
create policy "documents_write_manager"
on public.documents for all
using (public.is_admin_or_vorstand())
with check (public.is_admin_or_vorstand());

grant select on public.documents to anon, authenticated;
grant insert, update, delete on public.documents to authenticated;

insert into public.documents (title, category, description, public_url, sort_order, is_active)
values
  ('Aufnahmeantrag', 'Aufnahmeanträge', 'Antrag für Erwachsene', '/Downloads/Aufnahmeantrag.pdf', 10, true),
  ('Aufnahmeantrag Jugend', 'Aufnahmeanträge', 'Antrag für Jugendliche', '/Downloads/Aufnahmeantrag_Jugend.pdf', 20, true),
  ('Änderungsformular persönliche Daten', 'Änderungsformulare', 'Änderungen zu Adresse/Kontakt/Bankdaten', '/Downloads/Aenderungsformular_Persoenliche_Daten.pdf', 10, true),
  ('Einwilligung Datenschutz', 'Datenschutz', 'Datenschutzrechtliche Einwilligungserklärung', '/Downloads/Datenschutzrechtliche_Einwilligungserklaerung_01.pdf', 10, true),
  ('Satzung', 'Satzung', 'Aktuelle Vereinssatzung', '/Downloads/Satzung.pdf', 10, true),
  ('Fangliste Innenwasser', 'Fanglisten/Stundennachweise', 'Fangliste Innenwasser', '/Downloads/Fangliste_Innenwasser.pdf', 10, true),
  ('Fangliste Rheinlos', 'Fanglisten/Stundennachweise', 'Fangliste Rheinlos', '/Downloads/Fangliste_Rheinlos.pdf', 20, true),
  ('Stundennachweis', 'Fanglisten/Stundennachweise', 'Stundennachweis', '/Downloads/Stundennachweis_01.pdf', 30, true)
on conflict do nothing;

commit;
