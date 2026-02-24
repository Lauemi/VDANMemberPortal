-- VDAN Template — user settings (notifications)
-- Run after core member/auth setup.

begin;

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notify_new_post boolean not null default true,
  notify_new_event boolean not null default true,
  notify_new_work_event boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_user_settings_touch on public.user_settings;
create trigger trg_user_settings_touch
before update on public.user_settings
for each row execute function public.touch_updated_at();

alter table public.user_settings enable row level security;

grant select, insert, update on public.user_settings to authenticated;

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own"
on public.user_settings for select
using (auth.uid() = user_id);

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own"
on public.user_settings for insert
with check (auth.uid() = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own"
on public.user_settings for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

commit;
