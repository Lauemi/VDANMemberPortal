-- VDAN Template — CTO alignment (keep existing project logic)
-- Run this after:
-- 10_work_time_and_audit.sql
--
-- Purpose:
-- - Align naming to CTO wording without breaking current app logic.
-- - Keep existing role model: user_roles.role in ('member','vorstand','admin').
-- - Keep existing member start flow: work_register sets checked_in + checkin_at.

begin;

-- =========================
-- 1) Role helper alias
-- =========================
-- CTO wording uses "board/admin". In this project "board" maps to "vorstand".
create or replace function public.is_board_or_admin()
returns boolean
language sql
stable
as $$
  select public.is_admin_or_vorstand();
$$;

-- =========================
-- 2) Participation guard hardening
-- =========================
-- Allow SQL editor/service-context updates where auth.uid() is null.
create or replace function public.enforce_work_participation_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin_or_vorstand() then
    return new;
  end if;

  if old.auth_uid <> auth.uid() then
    raise exception 'Not allowed';
  end if;

  if old.status in ('approved', 'rejected', 'no_show') then
    raise exception 'Finalized participations can only be changed by vorstand/admin';
  end if;

  if new.event_id <> old.event_id
     or new.auth_uid <> old.auth_uid
     or new.status <> old.status
     or coalesce(new.minutes_approved, -1) <> coalesce(old.minutes_approved, -1)
     or coalesce(new.approved_by, '00000000-0000-0000-0000-000000000000'::uuid) <> coalesce(old.approved_by, '00000000-0000-0000-0000-000000000000'::uuid)
     or coalesce(new.approved_at, 'epoch'::timestamptz) <> coalesce(old.approved_at, 'epoch'::timestamptz)
     or coalesce(new.note_admin, '') <> coalesce(old.note_admin, '')
  then
    raise exception 'Members may only edit own time and note';
  end if;

  if coalesce(new.checkin_at, 'epoch'::timestamptz) <> coalesce(old.checkin_at, 'epoch'::timestamptz)
     or coalesce(new.checkout_at, 'epoch'::timestamptz) <> coalesce(old.checkout_at, 'epoch'::timestamptz)
     or coalesce(new.note_member, '') <> coalesce(old.note_member, '')
  then
    new.status := 'submitted';
  end if;

  return new;
end;
$$;

-- =========================
-- 3) Ensure complete RPC set for cockpit workflow
-- =========================
create or replace function public.work_reject(p_participation_id uuid, p_note_admin text default null)
returns public.work_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.work_participations;
begin
  if not public.is_admin_or_vorstand() then
    raise exception 'Only vorstand/admin can reject';
  end if;

  update public.work_participations
  set status = 'rejected',
      note_admin = nullif(trim(coalesce(p_note_admin, '')), ''),
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
  where id = p_participation_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Participation not found';
  end if;

  return v_row;
end;
$$;

grant execute on function public.work_reject(uuid, text) to authenticated;
grant execute on function public.is_board_or_admin() to authenticated;

commit;
