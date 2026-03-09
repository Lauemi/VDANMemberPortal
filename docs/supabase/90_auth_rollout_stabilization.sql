-- VDAN/FCP - Auth rollout stabilization (pilot-safe, rollback-ready)
-- Date: 2026-03-09
-- Goal:
--   Keep member-number login stable while allowing controlled pilot rollout.
--   Provide admin tools for preview/apply/restore of login-email mapping.
--
-- IMPORTANT:
--   This migration does NOT auto-change users.
--   Changes happen only via explicit admin RPC calls.

begin;

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------------
-- 0) Rollout switches (documented in DB, no runtime side effects by itself)
-- ------------------------------------------------------------------
insert into public.app_secure_settings (setting_key, setting_value)
values
  ('auth_login_mode', 'member_no_password'),
  ('auth_email_change_enabled', 'false'),
  ('auth_rollout_mode', 'pilot')
on conflict (setting_key) do update
set setting_value = excluded.setting_value,
    updated_at = now();

-- ------------------------------------------------------------------
-- 1) Backup/audit tables for reversible auth-email repairs
-- ------------------------------------------------------------------
create table if not exists public.auth_email_repair_batches (
  batch_id uuid primary key,
  created_at timestamptz not null default now(),
  created_by uuid null,
  note text null
);

create table if not exists public.auth_email_repair_items (
  id bigserial primary key,
  batch_id uuid not null references public.auth_email_repair_batches(batch_id) on delete cascade,
  user_id uuid not null,
  club_code text null,
  member_no text not null,
  old_auth_email text null,
  new_auth_email text not null,
  old_profile_email text null,
  changed boolean not null default false,
  changed_at timestamptz not null default now()
);

create index if not exists idx_auth_email_repair_items_batch on public.auth_email_repair_items(batch_id);
create index if not exists idx_auth_email_repair_items_user on public.auth_email_repair_items(user_id);

alter table public.auth_email_repair_batches enable row level security;
alter table public.auth_email_repair_items enable row level security;

revoke all on public.auth_email_repair_batches from public, anon, authenticated;
revoke all on public.auth_email_repair_items from public, anon, authenticated;

-- ------------------------------------------------------------------
-- 2) Deterministic login-email mapping from member number
-- ------------------------------------------------------------------
drop function if exists public.member_no_login_email(text);

create or replace function public.member_no_login_email(p_member_no text)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select lower(
    'member_' ||
    regexp_replace(trim(coalesce(p_member_no, '')), '[^a-zA-Z0-9._-]', '_', 'g') ||
    '@members.vdan.local'
  );
$$;

-- ------------------------------------------------------------------
-- 3) Preview: who would change?
-- ------------------------------------------------------------------
drop function if exists public.admin_auth_email_repair_preview(text, text[], integer);

create or replace function public.admin_auth_email_repair_preview(
  p_club_code text default null,
  p_member_nos text[] default null,
  p_limit integer default 200
)
returns table(
  user_id uuid,
  club_code text,
  member_no text,
  auth_email text,
  profile_email text,
  login_email text,
  needs_change boolean
)
language plpgsql
security definer
stable
set search_path = public, auth, pg_catalog
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 5000));
  v_club_code text := nullif(trim(coalesce(p_club_code, '')), '');
begin
  if auth.uid() is not null and not public.is_admin_or_vorstand() then
    raise exception 'Only admin/vorstand can preview auth email repairs';
  end if;

  return query
  with candidates as (
    select
      p.id as user_id,
      cm.club_code,
      p.member_no,
      u.email as auth_email,
      p.email as profile_email,
      public.member_no_login_email(p.member_no) as login_email
    from public.profiles p
    join auth.users u
      on u.id = p.id
    left join public.club_members cm
      on cm.member_no = p.member_no
     and (p.club_id is null or cm.club_id = p.club_id)
    where nullif(trim(coalesce(p.member_no, '')), '') is not null
      and (
        coalesce(array_length(p_member_nos, 1), 0) = 0
        or p.member_no = any(p_member_nos)
      )
      and (
        v_club_code is null
        or upper(coalesce(cm.club_code, '')) = upper(v_club_code)
      )
  )
  select
    c.user_id,
    c.club_code,
    c.member_no,
    c.auth_email,
    c.profile_email,
    c.login_email,
    c.auth_email is distinct from c.login_email as needs_change
  from candidates c
  order by c.club_code nulls last, c.member_no
  limit v_limit;
end;
$$;

grant execute on function public.admin_auth_email_repair_preview(text, text[], integer) to authenticated;

-- ------------------------------------------------------------------
-- 4) Apply repair (explicit, batch-tracked, optionally profile email)
-- ------------------------------------------------------------------
drop function if exists public.admin_auth_email_repair_apply(text, text[], integer, boolean, boolean, text);

create or replace function public.admin_auth_email_repair_apply(
  p_club_code text default null,
  p_member_nos text[] default null,
  p_limit integer default 200,
  p_apply boolean default false,
  p_update_profile_email boolean default false,
  p_note text default null
)
returns table(
  batch_id uuid,
  user_id uuid,
  club_code text,
  member_no text,
  old_auth_email text,
  new_auth_email text,
  old_profile_email text,
  changed boolean
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_batch_id uuid;
  r record;
begin
  if auth.uid() is not null and not public.is_admin_or_vorstand() then
    raise exception 'Only admin/vorstand can apply auth email repairs';
  end if;

  if not coalesce(p_apply, false) then
    return query
    select
      null::uuid as batch_id,
      p.user_id,
      p.club_code,
      p.member_no,
      p.auth_email as old_auth_email,
      p.login_email as new_auth_email,
      p.profile_email as old_profile_email,
      false as changed
    from public.admin_auth_email_repair_preview(p_club_code, p_member_nos, p_limit) p
    where p.needs_change;
    return;
  end if;

  v_batch_id := gen_random_uuid();

  insert into public.auth_email_repair_batches(batch_id, created_by, note)
  values (
    v_batch_id,
    auth.uid(),
    coalesce(nullif(trim(coalesce(p_note, '')), ''), 'auth email repair apply')
  );

  for r in
    select *
    from public.admin_auth_email_repair_preview(p_club_code, p_member_nos, p_limit)
    where needs_change
  loop
    update auth.users u
    set email = r.login_email,
        updated_at = now()
    where u.id = r.user_id
      and u.email is distinct from r.login_email;

    if coalesce(p_update_profile_email, false) then
      update public.profiles p
      set email = r.login_email,
          updated_at = now()
      where p.id = r.user_id
        and p.email is distinct from r.login_email;
    end if;

    insert into public.auth_email_repair_items(
      batch_id,
      user_id,
      club_code,
      member_no,
      old_auth_email,
      new_auth_email,
      old_profile_email,
      changed
    )
    values (
      v_batch_id,
      r.user_id,
      r.club_code,
      r.member_no,
      r.auth_email,
      r.login_email,
      r.profile_email,
      true
    );

    batch_id := v_batch_id;
    user_id := r.user_id;
    club_code := r.club_code;
    member_no := r.member_no;
    old_auth_email := r.auth_email;
    new_auth_email := r.login_email;
    old_profile_email := r.profile_email;
    changed := true;
    return next;
  end loop;
end;
$$;

grant execute on function public.admin_auth_email_repair_apply(text, text[], integer, boolean, boolean, text) to authenticated;

-- ------------------------------------------------------------------
-- 5) Restore from batch (rollback helper)
-- ------------------------------------------------------------------
drop function if exists public.admin_auth_email_repair_restore(uuid, boolean, text);

create or replace function public.admin_auth_email_repair_restore(
  p_batch_id uuid,
  p_restore_profile_email boolean default false,
  p_note text default null
)
returns table(
  restore_batch_id uuid,
  user_id uuid,
  member_no text,
  restored_auth_email text,
  restored_profile_email text,
  changed boolean
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_restore_batch uuid;
  r record;
begin
  if p_batch_id is null then
    raise exception 'p_batch_id is required';
  end if;

  if auth.uid() is not null and not public.is_admin_or_vorstand() then
    raise exception 'Only admin/vorstand can restore auth email repairs';
  end if;

  v_restore_batch := gen_random_uuid();

  insert into public.auth_email_repair_batches(batch_id, created_by, note)
  values (
    v_restore_batch,
    auth.uid(),
    coalesce(nullif(trim(coalesce(p_note, '')), ''), 'auth email repair restore')
  );

  for r in
    select i.*
    from public.auth_email_repair_items i
    where i.batch_id = p_batch_id
      and i.changed = true
    order by i.id asc
  loop
    if nullif(trim(coalesce(r.old_auth_email, '')), '') is not null then
      update auth.users u
      set email = r.old_auth_email,
          updated_at = now()
      where u.id = r.user_id
        and u.email is distinct from r.old_auth_email;
    end if;

    if coalesce(p_restore_profile_email, false)
       and nullif(trim(coalesce(r.old_profile_email, '')), '') is not null then
      update public.profiles p
      set email = r.old_profile_email,
          updated_at = now()
      where p.id = r.user_id
        and p.email is distinct from r.old_profile_email;
    end if;

    insert into public.auth_email_repair_items(
      batch_id,
      user_id,
      club_code,
      member_no,
      old_auth_email,
      new_auth_email,
      old_profile_email,
      changed
    )
    values (
      v_restore_batch,
      r.user_id,
      r.club_code,
      r.member_no,
      r.new_auth_email,
      coalesce(r.old_auth_email, r.new_auth_email),
      r.old_profile_email,
      true
    );

    restore_batch_id := v_restore_batch;
    user_id := r.user_id;
    member_no := r.member_no;
    restored_auth_email := coalesce(r.old_auth_email, '');
    restored_profile_email := case when coalesce(p_restore_profile_email, false) then coalesce(r.old_profile_email, '') else '' end;
    changed := true;
    return next;
  end loop;
end;
$$;

grant execute on function public.admin_auth_email_repair_restore(uuid, boolean, text) to authenticated;

commit;
