-- member_invite_claim: Claim-Pfad funktional machen.
-- profiles/club_user_roles bekommen NUR domaenenkorrekte Werte.
-- Identitaets-Graph-IDs (tenant_id, canonical_membership_id, identity_id) 1:1 aus club_members
-- (real oder NULL) -- NIE aus club_id/club_member_id geraten. Falsch befuellte nullable
-- FK-Spalten sind schlimmer als NULL. club_id-only profiles sind legitimer Zwischenzustand
-- (vgl. admin_member_cards_overview / member_card_assignments_runtime: Fallback p.tenant_id is null
-- and p.club_id = cm.club_id). Deployed via Supabase-MCP 2026-06-04, repo-wahr.

drop function if exists public.member_invite_claim(text);

create or replace function public.member_invite_claim(p_token text)
returns table(ok boolean, message text, out_club_id uuid, out_club_member_id uuid)
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
  select v_uid, a.club_id, a.role_key, v_mem.canonical_membership_id, 'invite_claim', 1
  from public.club_member_role_assignments a
  where a.club_member_id = v_inv.club_member_id
  on conflict (user_id, club_id, role_key) do update
    set source='invite_claim', version = club_user_roles.version + 1;

  select exists(select 1 from public.profiles p where p.id = v_uid) into v_has_prof;
  if not v_has_prof then
    v_card_id  := upper(left(replace(v_uid::text,'-',''),16));
    v_card_key := upper(encode(gen_random_bytes(16),'hex'));
    insert into public.profiles
      (id, club_id, tenant_id, canonical_membership_id, identity_id,
       member_no, first_name, last_name, email, member_card_id, member_card_key)
    values
      (v_uid, v_inv.club_id, v_mem.tenant_id, v_mem.canonical_membership_id, v_mem.identity_id,
       v_mem.member_no, v_mem.first_name, v_mem.last_name, v_mem.email, v_card_id, v_card_key);
  else
    update public.profiles p set
      club_id   = coalesce(p.club_id, v_inv.club_id),
      tenant_id = coalesce(p.tenant_id, v_mem.tenant_id),
      canonical_membership_id = coalesce(p.canonical_membership_id, v_mem.canonical_membership_id),
      identity_id = coalesce(p.identity_id, v_mem.identity_id),
      member_no = case when p.member_no is null or p.member_no like 'AUTO-%' then v_mem.member_no else p.member_no end,
      first_name = coalesce(p.first_name, v_mem.first_name),
      last_name  = coalesce(p.last_name, v_mem.last_name),
      updated_at = now()
    where p.id = v_uid;
  end if;

  update public.club_member_invites set status='claimed', claimed_at=now(), claimed_user_id=v_uid where id = v_inv.id;
  return query select true, 'Zugang aktiviert.'::text, v_inv.club_id, v_inv.club_member_id;
end;
$$;
revoke all on function public.member_invite_claim(text) from public, anon;
grant execute on function public.member_invite_claim(text) to authenticated, service_role;

notify pgrst, 'reload schema';
