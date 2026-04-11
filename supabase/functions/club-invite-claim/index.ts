declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type InviteRecord = {
  version: 1;
  status: "active" | "exhausted" | "revoked";
  club_id: string;
  club_code: string;
  club_name: string;
  created_at: string;
  created_by: string;
  expires_at: string;
  max_uses: number;
  used_count: number;
  used_user_ids: string[];
};

function cors(req: Request) {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vdan-access-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function txt(value: unknown) {
  return String(value ?? "").trim();
}

async function sbServiceFetch(path: string, init: RequestInit = {}) {
  const base = Deno.env.get("SUPABASE_URL") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!base || !service) throw new Error("missing_supabase_service_env");

  const headers = new Headers(init.headers || {});
  headers.set("apikey", service);
  headers.set("Authorization", `Bearer ${service}`);
  headers.set("Content-Type", "application/json");

  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`supabase_request_failed_${res.status}:${body}`);
  }
  return res;
}

async function upsertSetting(settingKey: string, settingValue: string) {
  await sbServiceFetch("/rest/v1/app_secure_settings", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ setting_key: settingKey, setting_value: settingValue }]),
  });
}

async function sha256Hex(value: string) {
  const enc = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getAuthUser(req: Request, supabaseUrl: string, serviceKey: string) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!authHeader) return null;
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: serviceKey,
      Authorization: authHeader,
    },
  });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null);
  return user?.id ? user : null;
}

async function loadInviteRecord(token: string) {
  const tokenHash = await sha256Hex(token);
  const settingKey = `club_invite_token:${tokenHash}`;
  const res = await sbServiceFetch(
    `/rest/v1/app_secure_settings?select=setting_key,setting_value&setting_key=eq.${encodeURIComponent(settingKey)}&limit=1`,
    { method: "GET" },
  );
  const rows = await res.json().catch(() => []);
  const raw = Array.isArray(rows) && rows.length ? txt(rows[0]?.setting_value) : "";
  if (!raw) return { tokenHash, settingKey, record: null };
  return {
    tokenHash,
    settingKey,
    record: JSON.parse(raw) as InviteRecord,
  };
}

function validateInviteRecord(record: InviteRecord | null) {
  if (!record) throw new Error("invite_invalid");
  if (record.status !== "active") throw new Error("invite_inactive");
  const expires = new Date(record.expires_at).getTime();
  if (!Number.isFinite(expires) || Date.now() > expires) throw new Error("invite_expired");
  const maxUses = Math.max(1, Number(record.max_uses || 1));
  const used = Math.max(0, Number(record.used_count || 0));
  if (used >= maxUses) throw new Error("invite_exhausted");
}

async function ensureProfile(user: Record<string, unknown>, clubId: string, memberNo: string, firstName: string, lastName: string) {
  const userId = txt(user.id);
  const email = txt((user as { email?: string })?.email).toLowerCase();
  const profileRes = await sbServiceFetch(
    `/rest/v1/profiles?select=id,club_id,member_no,display_name&limit=1&id=eq.${encodeURIComponent(userId)}`,
    { method: "GET" },
  );
  const rows = await profileRes.json().catch(() => []);
  const existing = Array.isArray(rows) && rows.length ? rows[0] : null;
  const displayName = [firstName, lastName].map(txt).filter(Boolean).join(" ") || txt(existing?.display_name) || email || userId;

  if (!existing?.id) {
    await sbServiceFetch("/rest/v1/profiles", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify([{
        id: userId,
        display_name: displayName,
        email: email || null,
        club_id: clubId,
        member_no: memberNo,
        must_verify_identity: true,
        identity_verified_at: null,
      }]),
    });
    return;
  }

  await sbServiceFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      display_name: displayName,
      // Keep existing single-profile fields stable; multi-club membership is represented in role/membership tables.
      club_id: txt(existing.club_id) || clubId,
      member_no: txt(existing.member_no) || memberNo,
      must_verify_identity: true,
      identity_verified_at: null,
    }),
  });
}

type ClubMemberRecord = {
  member_no: string;
  club_member_no?: string | null;
};

async function resolveClubMemberRecord(clubId: string, inputMemberNo: string): Promise<ClubMemberRecord | null> {
  const desiredInput = txt(inputMemberNo).toUpperCase();
  if (!desiredInput) return null;

  const directRows = await loadJson(
    `/rest/v1/club_members?select=member_no,club_member_no&club_id=eq.${encodeURIComponent(clubId)}&member_no=eq.${encodeURIComponent(desiredInput)}&limit=1`,
  );
  const directRow = Array.isArray(directRows) && directRows.length ? directRows[0] : null;
  if (txt(directRow?.member_no)) {
    return {
      member_no: txt(directRow?.member_no).toUpperCase(),
      club_member_no: txt(directRow?.club_member_no).toUpperCase() || null,
    };
  }

  const externalRows = await loadJson(
    `/rest/v1/club_members?select=member_no,club_member_no&club_id=eq.${encodeURIComponent(clubId)}&club_member_no=eq.${encodeURIComponent(desiredInput)}&limit=1`,
  );
  const externalRow = Array.isArray(externalRows) && externalRows.length ? externalRows[0] : null;
  if (txt(externalRow?.member_no)) {
    return {
      member_no: txt(externalRow?.member_no).toUpperCase(),
      club_member_no: txt(externalRow?.club_member_no).toUpperCase() || null,
    };
  }

  const memberRows = await loadJson(
    `/rest/v1/members?select=membership_number,club_member_no&club_id=eq.${encodeURIComponent(clubId)}&or=(membership_number.eq.${encodeURIComponent(desiredInput)},club_member_no.eq.${encodeURIComponent(desiredInput)})&limit=1`,
  );
  const memberRow = Array.isArray(memberRows) && memberRows.length ? memberRows[0] : null;
  if (txt(memberRow?.membership_number)) {
    return {
      member_no: txt(memberRow?.membership_number).toUpperCase(),
      club_member_no: txt(memberRow?.club_member_no).toUpperCase() || null,
    };
  }

  return null;
}

async function ensureClubMemberRecord(
  clubId: string,
  _clubCode: string,
  inputMemberNo: string,
  _firstName: string,
  _lastName: string,
) {
  const desiredInput = txt(inputMemberNo).toUpperCase();
  if (!desiredInput) throw new Error("member_no_required");
  const memberRecord = await resolveClubMemberRecord(clubId, desiredInput);
  if (!memberRecord?.member_no) throw new Error("member_no_not_found_in_club");
  return memberRecord.member_no;
}

async function ensureMemberEmailMatch(clubId: string, memberNo: string, actorEmailRaw: string) {
  const actorEmail = txt(actorEmailRaw).toLowerCase();
  if (!actorEmail) throw new Error("auth_email_required");

  const rows = await loadJson(
    `/rest/v1/members?select=email,club_member_no,membership_number&club_id=eq.${encodeURIComponent(clubId)}&or=(membership_number.eq.${encodeURIComponent(memberNo)},club_member_no.eq.${encodeURIComponent(memberNo)})&limit=1`,
  );
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  const memberEmail = txt(row?.email).toLowerCase();
  if (!memberEmail) throw new Error("member_email_missing");
  if (memberEmail !== actorEmail) throw new Error("member_email_mismatch");
}

async function ensureClubMemberIdentity(userId: string, clubId: string, memberNo: string) {
  const memberNoUp = txt(memberNo).toUpperCase();
  if (!memberNoUp) throw new Error("member_no_required");

  const byMemberRes = await sbServiceFetch(
    `/rest/v1/club_member_identities?select=user_id&club_id=eq.${encodeURIComponent(clubId)}&member_no=eq.${encodeURIComponent(memberNoUp)}&limit=1`,
    { method: "GET" },
  );
  const byMemberRows = await byMemberRes.json().catch(() => []);
  const assignedUserId = txt(Array.isArray(byMemberRows) && byMemberRows.length ? byMemberRows[0]?.user_id : "");
  if (assignedUserId && assignedUserId !== userId) {
    throw new Error("member_no_assigned_other_user");
  }

  const byUserRes = await sbServiceFetch(
    `/rest/v1/club_member_identities?select=member_no&club_id=eq.${encodeURIComponent(clubId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    { method: "GET" },
  );
  const byUserRows = await byUserRes.json().catch(() => []);
  const currentMemberNo = txt(Array.isArray(byUserRows) && byUserRows.length ? byUserRows[0]?.member_no : "").toUpperCase();

  if (!currentMemberNo) {
    await sbServiceFetch("/rest/v1/club_member_identities", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{ club_id: clubId, user_id: userId, member_no: memberNoUp }]),
    });
    return;
  }

  if (currentMemberNo === memberNoUp) return;

  await sbServiceFetch(
    `/rest/v1/club_member_identities?club_id=eq.${encodeURIComponent(clubId)}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ member_no: memberNoUp }),
    },
  );
}

async function ensureMemberRole(userId: string, clubId: string) {
  const res = await sbServiceFetch(
    `/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&club_id=eq.${encodeURIComponent(clubId)}&role=eq.member&limit=1`,
    { method: "GET" },
  );
  const rows = await res.json().catch(() => []);
  if (!(Array.isArray(rows) && rows.length)) {
    await sbServiceFetch("/rest/v1/user_roles", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify([{ user_id: userId, club_id: clubId, role: "member" }]),
    });
  }

  await sbServiceFetch("/rest/v1/club_user_roles", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ user_id: userId, club_id: clubId, role_key: "member" }]),
  });
}

async function loadJson(path: string) {
  const res = await sbServiceFetch(path, { method: "GET" });
  return await res.json().catch(() => []);
}

async function callRpc<T = unknown>(fn: string, payload: Record<string, unknown>) {
  const res = await sbServiceFetch(`/rest/v1/rpc/${fn}`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
  return await res.json().catch(() => null) as T;
}

async function queueNotificationEmail(params: {
  templateKey: string;
  recipientEmail: string;
  clubId: string;
  payload: Record<string, unknown>;
}) {
  await callRpc("queue_notification_email", {
    p_template_key: params.templateKey,
    p_recipient_email: params.recipientEmail,
    p_club_id: params.clubId,
    p_payload: params.payload,
  });
}

async function loadClubCardSetting(clubId: string) {
  const rows = await loadJson(
    `/rest/v1/app_secure_settings?select=setting_value&setting_key=eq.${encodeURIComponent(`club_cards:${clubId}`)}&limit=1`,
  );
  return txt(Array.isArray(rows) && rows.length ? rows[0]?.setting_value : "");
}

async function resolveMembershipKind(clubId: string, memberNo: string) {
  const rows = await loadJson(
    `/rest/v1/club_members?select=membership_kind&club_id=eq.${encodeURIComponent(clubId)}&member_no=eq.${encodeURIComponent(memberNo)}&limit=1`,
  );
  return txt(Array.isArray(rows) && rows.length ? rows[0]?.membership_kind : "");
}

function resolveInviteClaimGroupKey(membershipKind: string) {
  const value = txt(membershipKind).toLowerCase();
  return value.includes("honor") || value.includes("ehren") ? "honorary" : "standard";
}

Deno.serve(async (req: Request) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) throw new Error("missing_supabase_service_env");

    const actor = await getAuthUser(req, supabaseUrl, serviceKey);
    if (!actor?.id) throw new Error("unauthorized");

    const body = await req.json().catch(() => ({}));
    const inviteToken = txt((body as { invite_token?: string })?.invite_token);
    const memberNo = txt((body as { member_no?: string })?.member_no).toUpperCase();
    const firstName = txt((body as { first_name?: string })?.first_name);
    const lastName = txt((body as { last_name?: string })?.last_name);

    if (!inviteToken) throw new Error("invite_token_required");
    const loaded = await loadInviteRecord(inviteToken);
    validateInviteRecord(loaded.record);

    const userId = txt(actor.id);
    const actorEmail = txt((actor as { email?: string })?.email).toLowerCase();
    const record = loaded.record!;
    const assignedMemberNo = await ensureClubMemberRecord(
      record.club_id,
      record.club_code,
      memberNo,
      firstName,
      lastName,
    );
    await ensureMemberEmailMatch(record.club_id, assignedMemberNo, txt((actor as { email?: string })?.email));
    const usedUsers = Array.isArray(record.used_user_ids) ? record.used_user_ids.map(txt).filter(Boolean) : [];
    const alreadyUsedByActor = usedUsers.includes(userId);

    await ensureClubMemberIdentity(userId, record.club_id, assignedMemberNo);
    await ensureProfile(actor, record.club_id, assignedMemberNo, firstName, lastName);
    await ensureMemberRole(userId, record.club_id);

    try {
      const cardsRaw = await loadClubCardSetting(record.club_id);
      if (cardsRaw) {
        const normalized = await callRpc<unknown[]>("normalize_club_cards", { raw_value: cardsRaw });
        const cards = Array.isArray(normalized) ? normalized : [];
        const membershipKind = await resolveMembershipKind(record.club_id, assignedMemberNo);
        const groupKey = resolveInviteClaimGroupKey(membershipKind);
        const defaults = cards.filter((card) => {
          const row = card && typeof card === "object" ? card as Record<string, unknown> : {};
          const groupRules = row.group_rules && typeof row.group_rules === "object"
            ? row.group_rules as Record<string, unknown>
            : {};
          const groupRule = groupRules[groupKey] && typeof groupRules[groupKey] === "object"
            ? groupRules[groupKey] as Record<string, unknown>
            : {};
          return row.is_active !== false && groupRule.is_default === true;
        });

        if (defaults.length === 1) {
          await callRpc("admin_member_assign_card", {
            p_club_id: record.club_id,
            p_member_no: assignedMemberNo,
            p_fishing_card_type: txt((defaults[0] as Record<string, unknown>)?.title),
          });
        }
      }
    } catch {
      // Card auto-assign after claim is best-effort only.
    }

    if (!alreadyUsedByActor) {
      const nextUsers = [...new Set([...usedUsers, userId])];
      const nextUsedCount = Math.max(Number(record.used_count || 0), nextUsers.length);
      const maxUses = Math.max(1, Number(record.max_uses || 1));
      const nextStatus = nextUsedCount >= maxUses ? "exhausted" : "active";
      const nextRecord: InviteRecord = {
        ...record,
        used_user_ids: nextUsers,
        used_count: nextUsedCount,
        status: nextStatus,
      };
      await upsertSetting(loaded.settingKey, JSON.stringify(nextRecord));
    }

    if (actorEmail) {
      try {
        await queueNotificationEmail({
          templateKey: "claim_success",
          recipientEmail: actorEmail,
          clubId: record.club_id,
          payload: {
            club_name: record.club_name,
            club_code: record.club_code,
            member_no: assignedMemberNo,
            subject: `Mitgliedschaft bestaetigt: ${record.club_name}`,
            html: `
              <h2>Mitgliedschaft bestaetigt</h2>
              <p>Deine Zuordnung fuer den Verein <strong>${record.club_name}</strong> wurde erfolgreich bestaetigt.</p>
              <p>Mitgliedsnummer: <strong>${assignedMemberNo}</strong></p>
              <p>Du kannst das Portal jetzt als Mitglied nutzen.</p>
            `,
          },
        });
      } catch {
        // Claim flow itself must stay available even if queueing fails.
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      club_id: record.club_id,
      club_code: record.club_code,
      club_name: record.club_name,
      member_no: assignedMemberNo,
      role_assigned: "member",
    }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unexpected_error";
    const status = message === "unauthorized" ? 401 : 400;
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
