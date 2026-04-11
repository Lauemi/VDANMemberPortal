import { sendResponsibleNotificationMail } from "../_shared/contact-utils.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type SetupBody = {
  club_name: string;
  club_code?: string;
  default_fishing_card: string;
  default_card?: string;
  fishing_cards?: string[];
  waters?: string[];
  make_public_active?: boolean;
  assign_creator_roles?: boolean;
  street?: string;
  zip?: string;
  city?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  responsible_name?: string;
  responsible_email?: string;
  club_size?: string;
  creator_user_id?: string;
  creator_email?: string;
  creator_display_name?: string;
  request_id?: string;
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
  const reqHeaders = req.headers.get("access-control-request-headers") || "authorization, x-client-info, apikey, content-type";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  };
}

function txt(value: unknown) {
  return String(value ?? "").trim();
}

function upper(value: unknown) {
  return txt(value).toUpperCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function toList(input: unknown) {
  const arr = Array.isArray(input) ? input : [];
  const uniq = new Set<string>();
  for (const raw of arr) {
    const v = txt(raw);
    if (v) uniq.add(v);
  }
  return [...uniq];
}

function firstListValue(input: unknown) {
  const list = toList(input);
  return list.length ? list[0] : "";
}

function toCardObjects(input: unknown) {
  return toList(input).map((title) => ({
    id: txt(title).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "jahreskarte",
    title,
    kind: "annual",
    is_active: true,
    group_rules: {
      standard: { label: "Standard", is_default: true, price: null },
      youth: { label: "Jugend", is_default: true, price: null },
      honorary: { label: "Ehrenmitglied", is_default: true, price: null },
    },
  }));
}

function objectOrEmpty(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
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

async function callRpc<T>(fn: string, payload: Record<string, unknown>) {
  const res = await sbServiceFetch(`/rest/v1/rpc/${fn}`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
  return await res.json().catch(() => null) as T;
}

async function upsertOnboardingStateDirect(
  clubId: string,
  actorUserId: string,
  payload: {
    club_data_complete: boolean;
    waters_complete: boolean;
    cards_complete: boolean;
    members_mode: "pending" | "imported" | "confirmed_empty";
    notes?: Record<string, unknown>;
  },
) {
  await sbServiceFetch("/rest/v1/club_onboarding_state?on_conflict=club_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{
      club_id: clubId,
      created_by: actorUserId || null,
      updated_by: actorUserId || null,
      club_data_complete: Boolean(payload.club_data_complete),
      waters_complete: Boolean(payload.waters_complete),
      cards_complete: Boolean(payload.cards_complete),
      members_mode: payload.members_mode,
      notes: payload.notes || {},
      setup_state: "pending_setup",
    }]),
  });

  await sbServiceFetch("/rest/v1/club_onboarding_audit", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify([{
      club_id: clubId,
      event_key: "onboarding.progress_updated",
      actor_user_id: actorUserId || null,
      payload: {
        club_data_complete: Boolean(payload.club_data_complete),
        waters_complete: Boolean(payload.waters_complete),
        cards_complete: Boolean(payload.cards_complete),
        members_mode: payload.members_mode,
        notes: payload.notes || {},
        source: "club-admin-setup.service",
      },
    }]),
  });

  const stateRes = await sbServiceFetch(
    `/rest/v1/club_onboarding_state?select=*&club_id=eq.${encodeURIComponent(clubId)}&limit=1`,
    { method: "GET" },
  );
  const stateRows = await stateRes.json().catch(() => []);
  return Array.isArray(stateRows) ? stateRows[0] || null : null;
}

async function getAuthUser(req: Request, supabaseUrl: string, serviceKey: string) {
  const bearerHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const customToken = String(req.headers.get("x-vdan-access-token") || "").trim();
  const authHeader = customToken ? `Bearer ${customToken}` : bearerHeader;
  if (!authHeader) return null;
  const requestApiKey = String(
    req.headers.get("apikey")
    || req.headers.get("Apikey")
    || "",
  ).trim();
  const apiKeys = [
    requestApiKey,
    serviceKey,
    Deno.env.get("SUPABASE_ANON_KEY") || "",
    Deno.env.get("PUBLIC_SUPABASE_ANON_KEY") || "",
  ].map((value) => String(value || "").trim()).filter(Boolean);

  for (const apiKey of apiKeys) {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: apiKey,
        Authorization: authHeader,
      },
    }).catch(() => null);
    if (!res?.ok) continue;
    const user = await res.json().catch(() => null);
    if (user?.id) return user;
  }
  return null;
}

function configuredSuperadminIds() {
  return String(
    Deno.env.get("PUBLIC_SUPERADMIN_USER_IDS")
    || Deno.env.get("SUPERADMIN_USER_IDS")
    || "",
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function isAdmin(userId: string) {
  if (configuredSuperadminIds().includes(String(userId || "").trim())) return true;
  const res = await sbServiceFetch(
    `/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&role=eq.admin&limit=1`,
    { method: "GET" },
  );
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

async function loadApprovedOwnRequest(requestId: string, actorId: string) {
  if (!requestId || !actorId) return null;
  const res = await sbServiceFetch(
    `/rest/v1/club_registration_requests?select=*&id=eq.${encodeURIComponent(requestId)}&requester_user_id=eq.${encodeURIComponent(actorId)}&status=eq.approved&limit=1`,
    { method: "GET" },
  );
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function ensureClubCodeFree(clubCode: string) {
  const byMapRes = await sbServiceFetch(
    `/rest/v1/app_secure_settings?select=setting_key&setting_key=eq.${encodeURIComponent(`club_code_map:${clubCode}`)}&limit=1`,
    { method: "GET" },
  );
  const byMap = await byMapRes.json().catch(() => []);
  if (Array.isArray(byMap) && byMap.length > 0) throw new Error("club_code_exists");

  const byMembersRes = await sbServiceFetch(
    `/rest/v1/club_members?select=club_code&club_code=eq.${encodeURIComponent(clubCode)}&limit=1`,
    { method: "GET" },
  );
  const byMembers = await byMembersRes.json().catch(() => []);
  if (Array.isArray(byMembers) && byMembers.length > 0) throw new Error("club_code_exists");
}

function clubCodeFromIndex(index: number) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const letterBlock = Math.floor(index / 100);
  const d = index % 100;
  const a = Math.floor(letterBlock / 26);
  const b = letterBlock % 26;
  return `${letters[a]}${letters[b]}${String(d).padStart(2, "0")}`;
}

async function listUsedClubCodes() {
  const used = new Set<string>();

  const mapRes = await sbServiceFetch(
    "/rest/v1/app_secure_settings?select=setting_key&setting_key=like.club_code_map:*",
    { method: "GET" },
  );
  const mapRows = await mapRes.json().catch(() => []);
  for (const row of Array.isArray(mapRows) ? mapRows : []) {
    const key = txt(row?.setting_key);
    if (!key.startsWith("club_code_map:")) continue;
    const code = upper(key.slice("club_code_map:".length));
    if (/^[A-Z]{2}[0-9]{2}$/.test(code)) used.add(code);
  }

  const membersRes = await sbServiceFetch("/rest/v1/club_members?select=club_code", { method: "GET" });
  const membersRows = await membersRes.json().catch(() => []);
  for (const row of Array.isArray(membersRows) ? membersRows : []) {
    const code = upper(row?.club_code);
    if (/^[A-Z]{2}[0-9]{2}$/.test(code)) used.add(code);
  }

  return used;
}

async function nextFreeClubCode() {
  const used = await listUsedClubCodes();
  for (let i = 0; i < 26 * 26 * 100; i += 1) {
    const code = clubCodeFromIndex(i);
    if (!used.has(code)) return code;
  }
  throw new Error("club_code_space_exhausted");
}

async function upsertSetting(settingKey: string, settingValue: string) {
  await sbServiceFetch("/rest/v1/app_secure_settings", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ setting_key: settingKey, setting_value: settingValue }]),
  });
}

async function readSetting(settingKey: string) {
  const res = await sbServiceFetch(
    `/rest/v1/app_secure_settings?select=setting_value&setting_key=eq.${encodeURIComponent(settingKey)}&limit=1`,
    { method: "GET" },
  );
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length ? txt(rows[0]?.setting_value) : "";
}

async function allowResponsibleNotification(actorId: string, responsibleEmail: string) {
  const normalizedEmail = txt(responsibleEmail).toLowerCase();
  if (!normalizedEmail) return { ok: false, reason: "responsible_email_missing" };
  if (!isValidEmail(normalizedEmail)) return { ok: false, reason: "responsible_email_invalid" };

  const emailHash = await sha256Hex(normalizedEmail);
  const settingKey = `club_responsible_notify_rate:${actorId}:${emailHash}`;
  const lastSentRaw = await readSetting(settingKey);
  const lastSentTs = Date.parse(lastSentRaw || "");
  if (Number.isFinite(lastSentTs) && (Date.now() - lastSentTs) < 10 * 60 * 1000) {
    return { ok: false, reason: "responsible_notification_rate_limited" };
  }

  return {
    ok: true,
    async commit() {
      await upsertSetting(settingKey, new Date().toISOString());
    },
  };
}

async function insertMissingWaters(clubId: string, waters: string[]) {
  const clean = toList(waters);
  if (!clean.length) return;

  const existingRes = await sbServiceFetch(
    `/rest/v1/water_bodies?select=name&club_id=eq.${encodeURIComponent(clubId)}`,
    { method: "GET" },
  );
  const existingRows = await existingRes.json().catch(() => []);
  const existing = new Set((Array.isArray(existingRows) ? existingRows : []).map((r) => txt(r?.name)));

  const payload = clean
    .filter((name) => !existing.has(name))
    .map((name) => ({
      club_id: clubId,
      name,
      area_kind: "vereins_gemeinschaftsgewaesser",
      is_active: true,
    }));

  if (!payload.length) return;

  await sbServiceFetch("/rest/v1/water_bodies", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(payload),
  });
}

function deriveNames(displayName: string, email: string) {
  const raw = txt(displayName) || txt(email).split("@")[0];
  const parts = raw.split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "Admin", lastName: "Mitglied" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "Mitglied" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.slice(-1).join(" "),
  };
}

async function ensureCoreClubRoles(clubId: string) {
  const payload = [
    { club_id: clubId, role_key: "member", label: "Mitglied", is_core: true, is_active: true },
    { club_id: clubId, role_key: "vorstand", label: "Vorstand", is_core: true, is_active: true },
    { club_id: clubId, role_key: "admin", label: "Admin", is_core: true, is_active: true },
  ];
  await sbServiceFetch("/rest/v1/club_roles?on_conflict=club_id,role_key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(payload),
  });
}

async function loadActiveUsecases() {
  const modulesRes = await sbServiceFetch("/rest/v1/module_catalog?select=module_key,is_active", { method: "GET" });
  const moduleRows = await modulesRes.json().catch(() => []);
  const activeModules = new Set(
    (Array.isArray(moduleRows) ? moduleRows : [])
      .filter((r) => Boolean(r?.is_active))
      .map((r) => txt(r?.module_key)),
  );

  const usecasesRes = await sbServiceFetch("/rest/v1/module_usecases?select=module_key,usecase_key,is_active", { method: "GET" });
  const usecaseRows = await usecasesRes.json().catch(() => []);
  return (Array.isArray(usecaseRows) ? usecaseRows : [])
    .filter((r) => Boolean(r?.is_active) && activeModules.has(txt(r?.module_key)))
    .map((r) => ({ module_key: txt(r?.module_key), usecase_key: txt(r?.usecase_key) }))
    .filter((r) => r.module_key && r.usecase_key);
}

async function ensureClubModuleUsecases(clubId: string) {
  const active = await loadActiveUsecases();
  if (!active.length) return;
  const payload = active.map((r) => ({
    club_id: clubId,
    module_key: r.module_key,
    usecase_key: r.usecase_key,
    is_enabled: true,
  }));
  await sbServiceFetch("/rest/v1/club_module_usecases?on_conflict=club_id,module_key,usecase_key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(payload),
  });
}

async function ensureDefaultUsecaseAcl(clubId: string) {
  const defaults: Array<{
    role_key: "member" | "vorstand" | "admin";
    usecase_key: string;
    can_view: boolean;
    can_read: boolean;
    can_write: boolean;
    can_update: boolean;
    can_delete: boolean;
  }> = [
    { role_key: "member", usecase_key: "fangliste", can_view: true, can_read: true, can_write: false, can_update: false, can_delete: false },
    { role_key: "member", usecase_key: "go_fishing", can_view: true, can_read: true, can_write: false, can_update: false, can_delete: false },
    { role_key: "member", usecase_key: "fangliste_cockpit", can_view: false, can_read: false, can_write: false, can_update: false, can_delete: false },
    { role_key: "member", usecase_key: "arbeitseinsaetze", can_view: true, can_read: true, can_write: false, can_update: false, can_delete: false },
    { role_key: "member", usecase_key: "arbeitseinsaetze_cockpit", can_view: false, can_read: false, can_write: false, can_update: false, can_delete: false },
    { role_key: "member", usecase_key: "eventplaner", can_view: false, can_read: false, can_write: false, can_update: false, can_delete: false },
    { role_key: "member", usecase_key: "eventplaner_mitmachen", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: false },
    { role_key: "member", usecase_key: "feed", can_view: true, can_read: true, can_write: false, can_update: false, can_delete: false },
    { role_key: "member", usecase_key: "mitglieder", can_view: false, can_read: false, can_write: false, can_update: false, can_delete: false },
    { role_key: "member", usecase_key: "mitglieder_registry", can_view: false, can_read: false, can_write: false, can_update: false, can_delete: false },
    { role_key: "member", usecase_key: "dokumente", can_view: false, can_read: false, can_write: false, can_update: false, can_delete: false },
    { role_key: "member", usecase_key: "sitzungen", can_view: false, can_read: false, can_write: false, can_update: false, can_delete: false },
    { role_key: "member", usecase_key: "einstellungen", can_view: true, can_read: true, can_write: false, can_update: false, can_delete: false },

    { role_key: "vorstand", usecase_key: "fangliste", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: false },
    { role_key: "vorstand", usecase_key: "go_fishing", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: false },
    { role_key: "vorstand", usecase_key: "fangliste_cockpit", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: false },
    { role_key: "vorstand", usecase_key: "arbeitseinsaetze", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: false },
    { role_key: "vorstand", usecase_key: "arbeitseinsaetze_cockpit", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: false },
    { role_key: "vorstand", usecase_key: "eventplaner", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: false },
    { role_key: "vorstand", usecase_key: "eventplaner_mitmachen", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: false },
    { role_key: "vorstand", usecase_key: "feed", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: false },
    { role_key: "vorstand", usecase_key: "mitglieder", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: false },
    { role_key: "vorstand", usecase_key: "mitglieder_registry", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: false },
    { role_key: "vorstand", usecase_key: "dokumente", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: false },
    { role_key: "vorstand", usecase_key: "sitzungen", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: false },
    { role_key: "vorstand", usecase_key: "einstellungen", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: false },

    { role_key: "admin", usecase_key: "fangliste", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: true },
    { role_key: "admin", usecase_key: "go_fishing", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: true },
    { role_key: "admin", usecase_key: "fangliste_cockpit", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: true },
    { role_key: "admin", usecase_key: "arbeitseinsaetze", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: true },
    { role_key: "admin", usecase_key: "arbeitseinsaetze_cockpit", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: true },
    { role_key: "admin", usecase_key: "eventplaner", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: true },
    { role_key: "admin", usecase_key: "eventplaner_mitmachen", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: true },
    { role_key: "admin", usecase_key: "feed", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: true },
    { role_key: "admin", usecase_key: "mitglieder", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: true },
    { role_key: "admin", usecase_key: "mitglieder_registry", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: true },
    { role_key: "admin", usecase_key: "dokumente", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: true },
    { role_key: "admin", usecase_key: "sitzungen", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: true },
    { role_key: "admin", usecase_key: "einstellungen", can_view: true, can_read: true, can_write: true, can_update: true, can_delete: true },
  ];

  const active = await loadActiveUsecases();
  if (!active.length) return;
  const activeKeys = new Set(active.map((r) => r.usecase_key));
  const payload = defaults
    .filter((d) => activeKeys.has(d.usecase_key))
    .map((d) => ({
      club_id: clubId,
      role_key: d.role_key,
      module_key: d.usecase_key,
      can_view: d.can_view,
      can_read: d.can_read,
      can_write: d.can_write,
      can_update: d.can_update,
      can_delete: d.can_delete,
    }));
  if (!payload.length) return;

  await sbServiceFetch("/rest/v1/club_role_permissions?on_conflict=club_id,role_key,module_key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(payload),
  });
}

async function ensureCreatorRoles(userId: string, clubId: string) {
  const existingRes = await sbServiceFetch(
    `/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&club_id=eq.${encodeURIComponent(clubId)}`,
    { method: "GET" },
  );
  const existingRows = await existingRes.json().catch(() => []);
  const existing = new Set((Array.isArray(existingRows) ? existingRows : []).map((r) => txt(r?.role).toLowerCase()));

  const want = ["admin"];
  const missing = want.filter((role) => !existing.has(role));
  if (!missing.length) return;

  const payload = missing.map((role) => ({ user_id: userId, club_id: clubId, role }));
  await sbServiceFetch("/rest/v1/user_roles", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(payload),
  });

  // Keep ACL role mapping in sync for new club setup.
  await sbServiceFetch("/rest/v1/club_user_roles", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(missing.map((role) => ({ user_id: userId, club_id: clubId, role_key: role }))),
  });
}

async function ensureCreatorMemberBinding(
  identity: { email?: string; display_name?: string },
  userId: string,
  clubId: string,
  clubCode: string,
  defaultFishingCard: string,
) {
  const existingIdentityRes = await sbServiceFetch(
    `/rest/v1/club_member_identities?select=member_no&club_id=eq.${encodeURIComponent(clubId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    { method: "GET" },
  );
  const existingIdentityRows = await existingIdentityRes.json().catch(() => []);
  const existingIdentity = Array.isArray(existingIdentityRows) && existingIdentityRows.length ? existingIdentityRows[0] : null;
  const existingMemberNo = txt(existingIdentity?.member_no);
  if (existingMemberNo) return existingMemberNo;

  const profileRes = await sbServiceFetch(
    `/rest/v1/profiles?select=member_no&limit=1&id=eq.${encodeURIComponent(userId)}`,
    { method: "GET" },
  );
  const profileRows = await profileRes.json().catch(() => []);
  const profileRow = Array.isArray(profileRows) && profileRows.length ? profileRows[0] : null;
  const profileMemberNo = txt(profileRow?.member_no);

  let usableMemberNo = "";
  if (profileMemberNo) {
    const memberRes = await sbServiceFetch(
      `/rest/v1/club_members?select=member_no&club_id=eq.${encodeURIComponent(clubId)}&member_no=eq.${encodeURIComponent(profileMemberNo)}&limit=1`,
      { method: "GET" },
    );
    const memberRows = await memberRes.json().catch(() => []);
    usableMemberNo = Array.isArray(memberRows) && memberRows.length ? txt(memberRows[0]?.member_no) : "";
  }

  if (!usableMemberNo) {
    const names = deriveNames(txt(identity?.display_name), txt(identity?.email));
    const createdRows = await callRpc<Array<Record<string, unknown>>>("admin_member_registry_create", {
      p_club_id: clubId,
      p_club_code: clubCode,
      p_member_no: null,
      p_first_name: names.firstName,
      p_last_name: names.lastName,
      p_status: "active",
      p_fishing_card_type: defaultFishingCard,
      p_email: txt(identity?.email).toLowerCase() || null,
    });
    const createdRow = Array.isArray(createdRows) && createdRows.length ? createdRows[0] : null;
    usableMemberNo = txt(createdRow?.member_no);
  }

  if (!usableMemberNo) throw new Error("creator_member_binding_failed");

  await sbServiceFetch("/rest/v1/club_member_identities", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{
      club_id: clubId,
      user_id: userId,
      member_no: usableMemberNo,
    }]),
  });

  return usableMemberNo;
}

function autoMemberNo(clubId: string, userId: string) {
  const clubPart = clubId.replace(/-/g, "").slice(0, 4).toUpperCase() || "CLUB";
  const userPart = userId.replace(/-/g, "").slice(0, 8).toUpperCase() || "USER";
  return `MID-${clubPart}-${userPart}`;
}

function memberCardIdFromUserId(userId: string) {
  const userPart = userId.replace(/-/g, "").slice(0, 10).toUpperCase() || "USER";
  return `MC-${userPart}`;
}

function generateMemberCardKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function generateInviteToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const enc = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function ensureCreatorProfileBinding(
  identity: { email?: string; display_name?: string },
  userId: string,
  clubId: string,
  defaultFishingCard: string,
  preferredMemberNo = "",
) {
  const profileRes = await sbServiceFetch(
    `/rest/v1/profiles?select=id,club_id,member_no,display_name,email,member_card_id,member_card_key,member_card_valid,member_card_valid_from,member_card_valid_until,fishing_card_type&limit=1&id=eq.${encodeURIComponent(userId)}`,
    { method: "GET" },
  );
  const profileRows = await profileRes.json().catch(() => []);
  const row = Array.isArray(profileRows) && profileRows.length ? profileRows[0] : null;

  const nextClubId = clubId;
  const nextMemberNo = txt(preferredMemberNo) || txt(row?.member_no) || autoMemberNo(clubId, userId);
  const nextDisplayName = txt(row?.display_name) || txt(identity?.display_name) || txt(identity?.email) || userId;
  const nextEmail = txt(row?.email) || txt(identity?.email) || null;
  const nextMemberCardId = txt(row?.member_card_id) || memberCardIdFromUserId(userId);
  const nextMemberCardKey = txt(row?.member_card_key) || generateMemberCardKey();
  const nextFishingCardType = txt(row?.fishing_card_type) || txt(defaultFishingCard) || "-";
  const today = new Date().toISOString().slice(0, 10);
  const nextValidFrom = String(row?.member_card_valid_from || "").trim() || today;
  const nextValidUntil = String(row?.member_card_valid_until || "").trim()
    || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const nextMemberCardValid = typeof row?.member_card_valid === "boolean" ? Boolean(row.member_card_valid) : true;

  if (!row?.id) {
    await sbServiceFetch("/rest/v1/profiles", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify([{
        id: userId,
        display_name: nextDisplayName,
        email: nextEmail,
        club_id: nextClubId,
        member_no: nextMemberNo,
        member_card_id: nextMemberCardId,
        member_card_key: nextMemberCardKey,
        member_card_valid: nextMemberCardValid,
        member_card_valid_from: nextValidFrom,
        member_card_valid_until: nextValidUntil,
        fishing_card_type: nextFishingCardType,
      }]),
    });
    return;
  }

  const needsClubPatch = txt(row?.club_id) !== nextClubId;
  const needsMemberPatch = txt(row?.member_no) !== nextMemberNo;
  const needsDisplayNamePatch = txt(row?.display_name) !== nextDisplayName && Boolean(nextDisplayName);
  const needsEmailPatch = txt(row?.email) !== txt(nextEmail) && Boolean(nextEmail);
  const needsCardIdPatch = txt(row?.member_card_id) !== nextMemberCardId;
  const needsCardKeyPatch = txt(row?.member_card_key) !== nextMemberCardKey;
  const needsCardValidPatch = typeof row?.member_card_valid !== "boolean";
  const needsCardValidFromPatch = String(row?.member_card_valid_from || "").trim() !== nextValidFrom;
  const needsCardValidUntilPatch = String(row?.member_card_valid_until || "").trim() !== nextValidUntil;
  const needsFishingCardPatch = txt(row?.fishing_card_type) !== nextFishingCardType;
  if (
    !needsClubPatch
    && !needsMemberPatch
    && !needsDisplayNamePatch
    && !needsEmailPatch
    && !needsCardIdPatch
    && !needsCardKeyPatch
    && !needsCardValidPatch
    && !needsCardValidFromPatch
    && !needsCardValidUntilPatch
    && !needsFishingCardPatch
  ) return;

  await sbServiceFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      club_id: nextClubId,
      member_no: nextMemberNo,
      ...(needsDisplayNamePatch ? { display_name: nextDisplayName } : {}),
      ...(needsEmailPatch ? { email: nextEmail } : {}),
      ...(needsCardIdPatch ? { member_card_id: nextMemberCardId } : {}),
      ...(needsCardKeyPatch ? { member_card_key: nextMemberCardKey } : {}),
      ...(needsCardValidPatch ? { member_card_valid: nextMemberCardValid } : {}),
      ...(needsCardValidFromPatch ? { member_card_valid_from: nextValidFrom } : {}),
      ...(needsCardValidUntilPatch ? { member_card_valid_until: nextValidUntil } : {}),
      ...(needsFishingCardPatch ? { fishing_card_type: nextFishingCardType } : {}),
    }),
  });
}

Deno.serve(async (req: Request) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ ok: false, error: "missing_supabase_service_env" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const actor = await getAuthUser(req, supabaseUrl, serviceKey);
    if (!actor?.id) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => null)) as SetupBody | null;
    const requestId = txt(body?.request_id);
    const actorIsAdmin = await isAdmin(String(actor.id));
    const approvedOwnRequest = actorIsAdmin ? null : await loadApprovedOwnRequest(requestId, String(actor.id));
    if (!actorIsAdmin && !approvedOwnRequest) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden_admin_only" }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const clubName = txt(body?.club_name);
    let clubCode = upper(body?.club_code);
    const defaultCard = txt(body?.default_fishing_card) || txt(body?.default_card) || firstListValue(body?.fishing_cards) || "FCP Standard";
    const cards = toList([defaultCard, ...(Array.isArray(body?.fishing_cards) ? body!.fishing_cards! : [])]);
    const waters = toList(body?.waters);
    const makePublicActive = Boolean(body?.make_public_active);
    const assignCreatorRoles = body?.assign_creator_roles !== false;
    const approvedRequestPayload = objectOrEmpty(approvedOwnRequest?.request_payload);
    const street = txt(body?.street) || txt(approvedOwnRequest?.club_address);
    const zip = txt(body?.zip) || txt(approvedRequestPayload?.zip);
    const city = txt(body?.city) || txt(approvedRequestPayload?.city) || txt(approvedRequestPayload?.club_location);
    const contactName = txt(body?.contact_name) || txt(approvedOwnRequest?.responsible_name);
    const contactEmail = (txt(body?.contact_email) || txt(approvedOwnRequest?.responsible_email)).toLowerCase();
    const contactPhone = txt(body?.contact_phone);
    const responsibleName = txt(body?.responsible_name) || txt(approvedOwnRequest?.responsible_name);
    const responsibleEmail = (txt(body?.responsible_email) || txt(approvedOwnRequest?.responsible_email)).toLowerCase();
    const clubSize = txt(body?.club_size) || txt(approvedOwnRequest?.club_size);
    const creatorUserId = txt(body?.creator_user_id) || txt(approvedOwnRequest?.requester_user_id) || String(actor.id);
    const creatorEmail = (txt(body?.creator_email) || txt(approvedOwnRequest?.requester_email) || txt((actor as { email?: string })?.email)).toLowerCase();
    const creatorDisplayName = txt(body?.creator_display_name) || txt((actor as { user_metadata?: { first_name?: string } })?.user_metadata?.first_name) || creatorEmail || creatorUserId;

    if (!clubName) throw new Error("club_name_required");
    if (!defaultCard) throw new Error("default_fishing_card_required");
    if (contactEmail && !isValidEmail(contactEmail)) throw new Error("contact_email_invalid");
    if (responsibleEmail && !isValidEmail(responsibleEmail)) throw new Error("responsible_email_invalid");

    if (clubCode) {
      if (!/^[A-Z]{2}[0-9]{2}$/.test(clubCode)) throw new Error("club_code_invalid");
      await ensureClubCodeFree(clubCode);
    } else {
      clubCode = await nextFreeClubCode();
    }

    const clubId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const inviteToken = generateInviteToken();
    const inviteTokenHash = await sha256Hex(inviteToken);
    const inviteExpiresAt = new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)).toISOString();

    const meta = {
      club_id: clubId,
      club_name: clubName,
      club_code: clubCode,
      default_fishing_card: defaultCard,
      fishing_cards: cards,
      created_at: createdAt,
      created_by: creatorUserId,
      street,
      zip,
      city,
      contact_name: contactName || responsibleName,
      contact_email: contactEmail || responsibleEmail,
      contact_phone: contactPhone,
      responsible_name: responsibleName,
      responsible_email: responsibleEmail,
      responsible_status: responsibleEmail ? "notification_pending" : "missing",
      club_size: clubSize,
      version: 1,
    };

    await upsertSetting(`club_meta:${clubId}`, JSON.stringify(meta));
    await upsertSetting(`club_name:${clubId}`, clubName);
    await upsertSetting(`club_code_map:${clubCode}`, clubId);
    await callRpc("admin_upsert_club_cards", {
      p_club_id: clubId,
      p_cards: toCardObjects(cards),
    });
    const inviteRecord: InviteRecord = {
      version: 1,
      status: "active",
      club_id: clubId,
      club_code: clubCode,
      club_name: clubName,
      created_at: createdAt,
      created_by: creatorUserId,
      expires_at: inviteExpiresAt,
      max_uses: 25,
      used_count: 0,
      used_user_ids: [],
    };
    await upsertSetting(`club_invite_token:${inviteTokenHash}`, JSON.stringify(inviteRecord));
    await upsertSetting(`club_invite_active:${clubId}`, inviteTokenHash);

    if (makePublicActive) {
      await upsertSetting("public_active_club_id", clubId);
    }

    await insertMissingWaters(clubId, waters);
    await ensureCoreClubRoles(clubId);
    await ensureClubModuleUsecases(clubId);
    await ensureDefaultUsecaseAcl(clubId);

    if (assignCreatorRoles) {
    await ensureCreatorRoles(creatorUserId, clubId);
    }
    const creatorMemberNo = await ensureCreatorMemberBinding(
      { email: creatorEmail, display_name: creatorDisplayName },
      creatorUserId,
      clubId,
      clubCode,
      defaultCard,
    );
    await ensureCreatorProfileBinding(
      { email: creatorEmail, display_name: creatorDisplayName },
      creatorUserId,
      clubId,
      defaultCard,
      creatorMemberNo,
    );

    const onboardingState = await upsertOnboardingStateDirect(clubId, creatorUserId, {
      club_data_complete: true,
      waters_complete: waters.length > 0,
      cards_complete: cards.length > 0,
      members_mode: "pending",
      notes: {
        source: "club-admin-setup",
        created_at: createdAt,
        initial_waters_count: waters.length,
        initial_cards_count: cards.length,
      },
    });
    const onboardingSnapshot = await callRpc<Array<Record<string, unknown>>>("club_onboarding_snapshot", { p_club_id: clubId });

    const reqOrigin = txt(req.headers.get("origin"));
    const registerQuery = new URLSearchParams({
      invite: inviteToken,
      club_id: clubId,
      club_code: clubCode,
      club_name: clubName,
    });
    const registerUrl = reqOrigin
      ? `${reqOrigin.replace(/\/+$/, "")}/registrieren/?${registerQuery.toString()}`
      : `/registrieren/?${registerQuery.toString()}`;
    const inviteQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(registerUrl)}`;

    let responsibleNotification: { ok: boolean; reason?: string } | null = null;
    if (responsibleEmail) {
      const notifyGate = await allowResponsibleNotification(String(actor.id), responsibleEmail);
      if (!notifyGate.ok) {
        responsibleNotification = { ok: false, reason: notifyGate.reason };
      } else {
        responsibleNotification = await sendResponsibleNotificationMail({
          to: responsibleEmail,
          responsibleName: responsibleName || contactName || "verantwortliche Person",
          clubName,
          creatorEmail: creatorEmail,
          registerUrl,
        });
        if (responsibleNotification.ok) {
          await notifyGate.commit();
          meta.responsible_status = "notified";
          Object.assign(meta, { responsible_notified_at: new Date().toISOString() });
          await upsertSetting(`club_meta:${clubId}`, JSON.stringify(meta));
        } else {
          meta.responsible_status = "notification_failed";
          await upsertSetting(`club_meta:${clubId}`, JSON.stringify(meta));
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        club_id: clubId,
        club_code: clubCode,
        club_name: clubName,
        default_fishing_card: defaultCard,
        fishing_cards: cards,
        waters_created: waters,
        public_active_set: makePublicActive,
        creator_roles_assigned: assignCreatorRoles,
        creator_user_id: creatorUserId,
        onboarding_state: onboardingState,
        onboarding_snapshot: Array.isArray(onboardingSnapshot) ? onboardingSnapshot[0] || null : onboardingSnapshot,
        invite_token: inviteToken,
        invite_expires_at: inviteExpiresAt,
        invite_register_url: registerUrl,
        invite_qr_url: inviteQrUrl,
        responsible_notification: responsibleNotification,
      }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "unexpected_error" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
