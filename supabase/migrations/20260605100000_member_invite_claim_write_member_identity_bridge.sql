-- Schreib-Luecke schliessen (Option A): Claim fuellt zusaetzlich club_member_identities
-- (= Registry-Bruecke). Vorher schrieb der Claim nur club_members.auth_user_id + profiles +
-- club_user_roles, aber NICHT club_member_identities -> admin_member_registry zeigte
-- has_login=false + eine Geister-Zeile ('ohne_mitgliedsnummer') fuer den Rollen-User.
-- Read/Write-Zentralisierung-Juwel: Write jetzt vollstaendig, alle cmi-Leser konsistent.
-- Graph-IDs (identity/tenant/canonical) weiter domaenenkorrekt aus club_members (real oder NULL).
-- Deployed via Supabase-MCP 2026-06-05, repo-wahr.

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

  -- NEU: Registry-Bruecke. Macht das geclaimte Mitglied in admin_member_registry als
  -- eingeloggt sichtbar (profile_user_id/has_login) und verhindert die Geister-Zeile.
  insert into public.club_member_identities as cmi
    (club_id, member_no, user_id, identity_id, tenant_id, canonical_membership_id, source)
  values
    (v_inv.club_id, v_mem.member_no, v_uid, v_mem.identity_id, v_mem.tenant_id, v_mem.canonical_membership_id, 'invite_claim')
  on conflict (club_id, member_no) do update
    set user_id = excluded.user_id,
        identity_id = coalesce(excluded.identity_id, cmi.identity_id),
        tenant_id = coalesce(excluded.tenant_id, cmi.tenant_id),
        canonical_membership_id = coalesce(excluded.canonical_membership_id, cmi.canonical_membership_id),
        source = 'invite_claim',
        updated_at = now(),
        version = cmi.version + 1;

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

-- Backfill: bereits geclaimte Mitglieder ohne cmi-Zeile nachziehen (idempotent, beide Unique-Constraints abgesichert).
insert into public.club_member_identities
  (club_id, member_no, user_id, identity_id, tenant_id, canonical_membership_id, source)
select cm.club_id, cm.member_no, cm.auth_user_id,
       cm.identity_id, cm.tenant_id, cm.canonical_membership_id, 'invite_claim_backfill'
from public.club_members cm
where cm.auth_user_id is not null
  and not exists (select 1 from public.club_member_identities x
                  where x.club_id=cm.club_id and x.member_no=cm.member_no)
  and not exists (select 1 from public.club_member_identities y
                  where y.club_id=cm.club_id and y.user_id=cm.auth_user_id);

notify pgrst, 'reload schema';
