-- Member-Claim STEP 2: member_invite_claim
-- Token → bindet auth_user_id, propagiert vorhandene Rollen-Zuweisungen (keine neuen),
-- verknüpft Profil mit echtem club_member (canonical_membership_id — den profile-bootstrap NIE setzt).
-- single-use, Overwrite-Schutz, Ablauf. Deployed via Supabase-MCP 2026-06-03, repo-wahr gespiegelt.

begin;

drop function if exists public.member_invite_claim(text);

create or replace function public.member_invite_claim(p_token text)
returns table(ok boolean, message text, club_id uuid, club_member_id uuid)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_catalog
as $$
declare
  v_inv      record;
  v_mem      record;
  v_uid      uuid := auth.uid();
  v_has_prof boolean;
  v_card_id  text;
  v_card_key text;
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

  -- 1) Identität binden
  update public.club_members set auth_user_id = v_uid where id = v_inv.club_member_id;

  -- 2) Vorhandene Rollen-Zuweisungen aktivieren (KEINE neuen Rechte)
  insert into public.club_user_roles (user_id, club_id, role_key, canonical_membership_id, source, version)
  select v_uid, a.club_id, a.role_key, a.club_member_id, 'invite_claim', 1
  from public.club_member_role_assignments a
  where a.club_member_id = v_inv.club_member_id
  on conflict (user_id, club_id, role_key) do update
    set source='invite_claim', version = club_user_roles.version + 1;

  -- 3) Profil verknüpfen — echte canonical_membership_id (fixt den fehlenden Link)
  select exists(select 1 from public.profiles where id = v_uid) into v_has_prof;
  if not v_has_prof then
    v_card_id  := upper(left(replace(v_uid::text,'-',''),16));
    v_card_key := upper(encode(gen_random_bytes(16),'hex'));
    insert into public.profiles
      (id, club_id, tenant_id, canonical_membership_id, member_no,
       first_name, last_name, email, member_card_id, member_card_key)
    values
      (v_uid, v_inv.club_id, v_inv.club_id, v_inv.club_member_id, v_mem.member_no,
       v_mem.first_name, v_mem.last_name, v_mem.email, v_card_id, v_card_key);
  else
    update public.profiles set
      club_id = v_inv.club_id,
      tenant_id = coalesce(tenant_id, v_inv.club_id),
      canonical_membership_id = v_inv.club_member_id,
      member_no = v_mem.member_no,
      first_name = coalesce(first_name, v_mem.first_name),
      last_name  = coalesce(last_name, v_mem.last_name),
      updated_at = now()
    where id = v_uid;
  end if;

  -- 4) Token entwerten (single-use)
  update public.club_member_invites
    set status='claimed', claimed_at=now(), claimed_user_id=v_uid
    where id = v_inv.id;

  return query select true, 'Zugang aktiviert.'::text, v_inv.club_id, v_inv.club_member_id;
end;
$$;

revoke all on function public.member_invite_claim(text) from public, anon;
grant execute on function public.member_invite_claim(text) to authenticated;
grant execute on function public.member_invite_claim(text) to service_role;

notify pgrst, 'reload schema';

commit;
