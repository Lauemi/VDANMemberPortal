-- VDAN Template — web push subscriptions for app update notifications
-- Run after user/role baseline

begin;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  enabled boolean not null default true,
  notify_app_update boolean not null default true,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);
create index if not exists idx_push_subscriptions_enabled on public.push_subscriptions(enabled, notify_app_update);

drop trigger if exists trg_push_subscriptions_touch on public.push_subscriptions;
create trigger trg_push_subscriptions_touch
before update on public.push_subscriptions
for each row execute function public.touch_updated_at();

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_own_select" on public.push_subscriptions;
create policy "push_subscriptions_own_select"
on public.push_subscriptions for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "push_subscriptions_own_insert" on public.push_subscriptions;
create policy "push_subscriptions_own_insert"
on public.push_subscriptions for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_own_update" on public.push_subscriptions;
create policy "push_subscriptions_own_update"
on public.push_subscriptions for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_own_delete" on public.push_subscriptions;
create policy "push_subscriptions_own_delete"
on public.push_subscriptions for delete
to authenticated
using (auth.uid() = user_id or public.is_admin());

grant select, insert, update, delete on public.push_subscriptions to authenticated;

commit;
