-- VDAN/FCP - Admin RPC for auth last sign-in timestamps
-- Run after: 00_baseline.sql, 02_feed_posts.sql

begin;

create or replace function public.admin_user_last_signins()
returns table(
  user_id uuid,
  email text,
  auth_created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
begin
  -- App call: enforce admin role via JWT user.
  -- SQL editor call (postgres/supabase_admin): allow for operational debugging.
  if auth.uid() is not null then
    if not public.is_admin() then
      raise exception 'Only admin can read auth last sign-in data';
    end if;
  else
    if current_user not in ('postgres', 'supabase_admin') then
      raise exception 'Only admin can read auth last sign-in data';
    end if;
  end if;

  return query
  select
    u.id as user_id,
    u.email::text as email,
    u.created_at as auth_created_at,
    u.last_sign_in_at
  from auth.users u
  order by u.last_sign_in_at desc nulls last, u.created_at asc;
end;
$$;

grant execute on function public.admin_user_last_signins() to authenticated;

commit;
