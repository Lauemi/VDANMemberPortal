-- Korrekturen Zwei-Ebenen-Modell (Deployed via Supabase-MCP 2026-06-03, repo-wahr):
-- (1) Invite-RPCs (by_no + uuid) blocken ohne hinterlegte E-Mail (Mail = Verifikationsanker).
-- (2) member_invite_claim: Multi-Verein additiv — Profil-Kontext nicht mehr überschreiben.

begin;

drop function if exists public.admin_member_invite_create_by_no(text, text);
create or replace function public.admin_member_invite_create_by_no(
  p_club_code text, p_member_no text
)
returns table(ok boolean, message text, token text, first_name text, last_name text, member_email text, expires_at timestamptz)
language plpgsql security definer set search_path = public, auth, extensions, pg_catalog
as $$
declare
  v_club_id uuid; v_member record; v_token text;
  v_expires timestamptz := now() + interval '14 days'; v_cnt int;
begin
  select gim.club_id into v_club_id from public.get_club_identity_map() gim where gim.club_code = p_club_code limit 1;
  if v_club_id is null then
    return query select false, 'Verein nicht gefunden.'::text, null::text,null::text,null::text,null::text,null::timestamptz; return;
  end if;
  if not (public.is_admin_or_vorstand_in_club(v_club_id) or public.fcp_is_superadmin()) then
    return query select false, 'Keine Berechtigung.'::text, null::text,null::text,null::text,null::text,null::timestamptz; return;
  end if;
  select count(*) into v_cnt from public.club_members where club_id = v_club_id and member_no = p_member_no;
  if v_cnt = 0 then
    return query select false, 'Mitglied nicht gefunden.'::text, null::text,null::text,null::text,null::text,null::timestamptz; return;
  elsif v_cnt > 1 then
    return query select false, 'Mitgliedsnummer nicht eindeutig.'::text, null::text,null::text,null::text,null::text,null::timestamptz; return;
  end if;
  select cm.id, cm.first_name, cm.last_name, cm.email, cm.auth_user_id into v_member
  from public.club_members cm where cm.club_id = v_club_id and cm.member_no = p_member_no;
  if v_member.email is null or length(trim(v_member.email)) = 0 then
    return query select false, 'Dieses Mitglied hat keine hinterlegte E-Mail. Bitte zuerst eine E-Mail eintragen, dann einladen.'::text, null::text,null::text,null::text,null::text,null::timestamptz; return;
  end if;
  if v_member.auth_user_id is not null then
    return query select false, 'Dieses Mitglied hat bereits einen Zugang.'::text, null::text,null::text,null::text,null::text,null::timestamptz; return;
  end if;
  update public.club_member_invites set status='revoked' where club_member_id = v_member.id and status='active';
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.club_member_invites (club_id, club_member_id, token, status, created_by, expires_at)
  values (v_club_id, v_member.id, v_token, 'active', auth.uid(), v_expires);
  return query select true, 'Einladung erstellt.'::text, v_token, v_member.first_name, v_member.last_name, v_member.email, v_expires;
end;
$$;
revoke all on function public.admin_member_invite_create_by_no(text, text) from public, anon;
grant execute on function public.admin_member_invite_create_by_no(text, text) to authenticated, service_role;

drop function if exists public.admin_member_invite_create(uuid, uuid);
create or replace function public.admin_member_invite_create(
  p_club_id uuid, p_club_member_id uuid
)
returns table(ok boolean, message text, token text, first_name text, last_name text, member_email text, expires_at timestamptz)
language plpgsql security definer set search_path = public, auth, extensions, pg_catalog
as $$
declare v_member record; v_token text; v_expires timestamptz := now() + interval '14 days';
begin
  if not (public.is_admin_or_vorstand_in_club(p_club_id) or public.fcp_is_superadmin()) then
    return query select false, 'Keine Berechtigung.'::text, null::text,null::text,null::text,null::text,null::timestamptz; return;
  end if;
  select cm.id, cm.first_name, cm.last_name, cm.email, cm.auth_user_id into v_member
  from public.club_members cm where cm.id = p_club_member_id and cm.club_id = p_club_id;
  if not found then
    return query select false, 'Mitglied nicht gefunden.'::text, null::text,null::text,null::text,null::text,null::timestamptz; return;
  end if;
  if v_member.email is null or length(trim(v_member.email)) = 0 then
    return query select false, 'Dieses Mitglied hat keine hinterlegte E-Mail. Bitte zuerst eine E-Mail eintragen, dann einladen.'::text, null::text,null::text,null::text,null::text,null::timestamptz; return;
  end if;
  if v_member.auth_user_id is not null then
    return query select false, 'Dieses Mitglied hat bereits einen Zugang.'::text, null::text,null::text,null::text,null::text,null::timestamptz; return;
  end if;
  update public.club_member_invites set status='revoked' where club_member_id = p_club_member_id and status='active';
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.club_member_invites (club_id, club_member_id, token, status, created_by, expires_at)
  values (p_club_id, p_club_member_id, v_token, 'active', auth.uid(), v_expires);
  return query select true, 'Einladung erstellt.'::text, v_token, v_member.first_name, v_member.last_name, v_member.email, v_expires;
end;
$$;
revoke all on function public.admin_member_invite_create(uuid, uuid) from public, anon;
grant execute on function public.admin_member_invite_create(uuid, uuid) to authenticated, service_role;

drop function if exists public.member_invite_claim(text);
create or replace function public.member_invite_claim(p_token text)
returns table(ok boolean, message text, club_id uuid, club_member_id uuid)
language plpgsql security definer set search_path = public, auth, extensions, pg_catalog
as $$
declare
  v_inv record; v_mem record; v_uid uuid := auth.uid();
  v_has_prof boolean; v_card_id text; v_card_key text;
begin
  if v_uid is null then
    return query select false, 'Bitte zuerst einloggen.'::text, null::uuid, null::uuid; return;
  end if;
  select * into v_inv from public.club_member_invites where token = p_token;
  if not found then
    return query select false, 'Einladung ungültig.'::text, null::uuid, null::uuid; return;
  end if;
  if v_inv.status <> 'active' then
    return query select false, 'Diese Einladung wurde bereits verwendet oder zurückgezogen.'::text, null::uuid, null::uuid; return;
  end if;
  if v_inv.expires_at < now() then
    update public.club_member_invites set status='expired' where id = v_inv.id;
    return query select false, 'Diese Einladung ist abgelaufen.'::text, null::uuid, null::uuid; return;
  end if;
  select * into v_mem from public.club_members where id = v_inv.club_member_id;
  if not found then
    return query select false, 'Mitglied nicht gefunden.'::text, null::uuid, null::uuid; return;
  end if;
  if v_mem.auth_user_id is not null and v_mem.auth_user_id <> v_uid then
    return query select false, 'Diese Mitgliedschaft ist bereits aktiviert.'::text, null::uuid, null::uuid; return;
  end if;

  update public.club_members set auth_user_id = v_uid where id = v_inv.club_member_id;

  insert into public.club_user_roles (user_id, club_id, role_key, canonical_membership_id, source, version)
  select v_uid, a.club_id, a.role_key, a.club_member_id, 'invite_claim', 1
  from public.club_member_role_assignments a
  where a.club_member_id = v_inv.club_member_id
  on conflict (user_id, club_id, role_key) do update
    set source='invite_claim', version = club_user_roles.version + 1;

  select exists(select 1 from public.profiles where id = v_uid) into v_has_prof;
  if not v_has_prof then
    v_card_id  := upper(left(replace(v_uid::text,'-',''),16));
    v_card_key := upper(encode(gen_random_bytes(16),'hex'));
    insert into public.profiles
      (id, club_id, tenant_id, canonical_membership_id, member_no, first_name, last_name, email, member_card_id, member_card_key)
    values
      (v_uid, v_inv.club_id, v_inv.club_id, v_inv.club_member_id, v_mem.member_no,
       v_mem.first_name, v_mem.last_name, v_mem.email, v_card_id, v_card_key);
  else
    update public.profiles set
      club_id = coalesce(club_id, v_inv.club_id),
      tenant_id = coalesce(tenant_id, v_inv.club_id),
      canonical_membership_id = coalesce(canonical_membership_id, v_inv.club_member_id),
      member_no = case when member_no is null or member_no like 'AUTO-%' then v_mem.member_no else member_no end,
      first_name = coalesce(first_name, v_mem.first_name),
      last_name  = coalesce(last_name, v_mem.last_name),
      updated_at = now()
    where id = v_uid;
  end if;

  update public.club_member_invites set status='claimed', claimed_at=now(), claimed_user_id=v_uid where id = v_inv.id;
  return query select true, 'Zugang aktiviert.'::text, v_inv.club_id, v_inv.club_member_id;
end;
$$;
revoke all on function public.member_invite_claim(text) from public, anon;
grant execute on function public.member_invite_claim(text) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
