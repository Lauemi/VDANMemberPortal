declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type Action =
  | "get"
  | "save_club_data"
  | "save_cards"
  | "save_work_hours"
  | "create_water"
  | "update_water"
  | "delete_water"
  | "toggle_water"
  | "create_member";

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

function toList(input: unknown) {
  const arr = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  for (const raw of arr) {
    const value = txt(raw);
    if (value) seen.add(value);
  }
  return [...seen];
}

function slugify(value: unknown) {
  return txt(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type CardGroupKey = "standard" | "youth" | "honorary";
type CardKind = "annual" | "daily" | "weekly" | "monthly";
type CardGroupRule = {
  label: string;
  is_default: boolean;
  price: number | null;
};

type ClubCardRecord = {
  id: string;
  title: string;
  kind: CardKind;
  is_active: boolean;
  group_rules: Record<CardGroupKey, CardGroupRule>;
  standard_default: boolean;
  youth_default: boolean;
  honorary_default: boolean;
  standard_price: number | null;
  youth_price: number | null;
  honorary_price: number | null;
};

type WorkHoursConfig = {
  configured?: boolean;
  enabled: boolean;
  default_hours: number;
  youth_exempt: boolean;
  honorary_exempt: boolean;
  note: string;
};

type MemberDraftState = {
  first_name: string;
  last_name: string;
  status: string;
  is_youth: boolean;
  membership_kind: string;
  city: string;
  phone: string;
  birthdate: string;
  fishing_card_type: string;
  auto_assign_skipped: boolean;
  auto_assign_skip_reason: string | null;
  auto_assign_hint: string;
};

type CardDraftState = {
  title: string;
  kind: CardKind;
  is_active: boolean;
  group_rules: Record<CardGroupKey, CardGroupRule>;
};

function parseJsonArray(raw: string) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function validCardKind(input: unknown): CardKind {
  const kindRaw = txt(input) || "annual";
  return (["annual", "daily", "weekly", "monthly"].includes(kindRaw) ? kindRaw : "annual") as CardKind;
}

function parseNullableNumber(value: unknown) {
  const raw = txt(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function defaultGroupRule(groupKey: CardGroupKey): CardGroupRule {
  const labels: Record<CardGroupKey, string> = {
    standard: "Mitglied",
    youth: "Jugend",
    honorary: "Ehren",
  };
  return {
    label: labels[groupKey],
    is_default: true,
    price: null,
  };
}

function normalizeGroupRule(groupKey: CardGroupKey, raw: unknown, fallbackDefault = true): CardGroupRule {
  const source = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const fallback = defaultGroupRule(groupKey);
  return {
    label: txt(source.label) || fallback.label,
    is_default: source.is_default === undefined ? fallbackDefault : asBool(source.is_default),
    price: parseNullableNumber(source.price),
  };
}

function buildGroupRules(raw: unknown, fallbackDefault = true): Record<CardGroupKey, CardGroupRule> {
  const source = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  return {
    standard: normalizeGroupRule("standard", source.standard, fallbackDefault),
    youth: normalizeGroupRule("youth", source.youth, fallbackDefault),
    honorary: normalizeGroupRule("honorary", source.honorary, fallbackDefault),
  };
}

function finalizeCardRecord(base: {
  id: string;
  title: string;
  kind: CardKind;
  is_active: boolean;
  group_rules: Record<CardGroupKey, CardGroupRule>;
}): ClubCardRecord {
  return {
    ...base,
    standard_default: base.group_rules.standard.is_default,
    youth_default: base.group_rules.youth.is_default,
    honorary_default: base.group_rules.honorary.is_default,
    standard_price: base.group_rules.standard.price,
    youth_price: base.group_rules.youth.price,
    honorary_price: base.group_rules.honorary.price,
  };
}

function toNormalizedCardRecords(input: unknown): ClubCardRecord[] {
  const arr = Array.isArray(input) ? input : [];
  const used = new Set<string>();
  const out: ClubCardRecord[] = [];

  for (let index = 0; index < arr.length; index += 1) {
    const raw = arr[index];
    const isObject = raw && typeof raw === "object" && !Array.isArray(raw);
    const title = txt(isObject ? (raw as Record<string, unknown>).title : raw);
    if (!title) continue;
    const objectRaw = isObject ? raw as Record<string, unknown> : {};
    const kind = validCardKind(objectRaw.kind);
    const base = txt(objectRaw.id) || slugify(title) || `card-${index + 1}`;
    let id = base;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(id);

    const groupRules = isObject && objectRaw.group_rules && typeof objectRaw.group_rules === "object"
      ? buildGroupRules(objectRaw.group_rules, false)
      : buildGroupRules({}, true);

    out.push(finalizeCardRecord({
      id,
      title,
      kind,
      is_active: isObject ? objectRaw.is_active !== false && !String(objectRaw.is_active).toLowerCase().includes("false") : true,
      group_rules: groupRules,
    }));
  }

  return out;
}

async function normalizeCardsFromSettingValue(raw: string) {
  const normalized = await callRpc("normalize_club_cards", { raw_value: raw }).catch(() => null);
  return toNormalizedCardRecords(normalized ?? parseJsonArray(raw));
}

function defaultWorkHoursConfig(input: unknown): WorkHoursConfig {
  const raw = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  return {
    configured: asBool(raw.configured),
    enabled: asBool(raw.enabled),
    default_hours: Number.isFinite(Number(raw.default_hours)) ? Number(raw.default_hours) : 0,
    youth_exempt: asBool(raw.youth_exempt),
    honorary_exempt: asBool(raw.honorary_exempt),
    note: txt(raw.note),
  };
}

function toStoredCardPayload(cards: ClubCardRecord[]) {
  return cards.map((card) => ({
    id: card.id,
    title: card.title,
    kind: card.kind,
    is_active: Boolean(card.is_active),
    group_rules: card.group_rules,
  }));
}

function mergeCardsById(currentCards: ClubCardRecord[], incomingCards: ClubCardRecord[]) {
  const merged = new Map<string, ClubCardRecord>();
  currentCards.forEach((card) => {
    merged.set(card.id.toLowerCase(), card);
  });
  incomingCards.forEach((card) => {
    merged.set(card.id.toLowerCase(), card);
  });
  return [...merged.values()];
}

function inferMemberGroupKey(body: Record<string, unknown>) {
  const membershipKind = txt(body.membership_kind).toLowerCase();
  if (membershipKind === "honorary") return "honorary";
  if (asBool(body.is_youth)) return "youth";
  return "standard";
}

function resolveDefaultCardTitle(cards: ClubCardRecord[], memberGroupKey: string) {
  const groupKey = (["standard", "youth", "honorary"].includes(memberGroupKey) ? memberGroupKey : "standard") as CardGroupKey;
  const matches = cards.filter((card) =>
    card.is_active !== false && card.group_rules?.[groupKey]?.is_default === true
  );
  return {
    title: matches.length === 1 ? matches[0].title : null,
    matchCount: matches.length,
    skipped: matches.length !== 1,
    reason: matches.length === 0
      ? "no_default_for_group"
      : matches.length > 1
        ? "multiple_defaults_for_group"
        : null,
  };
}

function asBool(value: unknown) {
  if (typeof value === "boolean") return value;
  const raw = txt(value).toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "ja";
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

async function getAuthUser(req: Request, supabaseUrl: string, serviceKey: string) {
  const bearerHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const customToken = txt(req.headers.get("x-vdan-access-token"));
  const authHeader = customToken ? `Bearer ${customToken}` : bearerHeader;
  const debug: Record<string, unknown> = {
    hasAuthorizationHeader: Boolean(bearerHeader),
    hasCustomToken: Boolean(customToken),
    bearerHeaderPrefix: bearerHeader ? `${bearerHeader.slice(0, 24)}...` : "",
    customTokenPrefix: customToken ? `${customToken.slice(0, 24)}...` : "",
    customTokenSegments: customToken ? customToken.split(".").length : 0,
    authHeaderPrefix: authHeader ? `${authHeader.slice(0, 32)}...` : "",
  };
  if (!supabaseUrl || !authHeader) return { user: null, debug };
  const requestApiKey = txt(req.headers.get("apikey") || req.headers.get("Apikey") || "");
  debug.requestApiKeyPrefix = requestApiKey ? `${requestApiKey.slice(0, 16)}...` : "";
  const apiKeys = [
    requestApiKey,
    serviceKey,
    Deno.env.get("SUPABASE_ANON_KEY") || "",
    Deno.env.get("PUBLIC_SUPABASE_ANON_KEY") || "",
  ].map((value) => txt(value)).filter(Boolean);
  const attempts: Array<Record<string, unknown>> = [];

  for (const apiKey of apiKeys) {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: apiKey,
        Authorization: authHeader,
      },
    }).catch(() => null);
    if (!res) {
      attempts.push({ apiKeyPrefix: `${apiKey.slice(0, 16)}...`, ok: false, status: "fetch_failed" });
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      attempts.push({ apiKeyPrefix: `${apiKey.slice(0, 16)}...`, ok: false, status: res.status, body });
      continue;
    }
    const user = await res.json().catch(() => null);
    attempts.push({ apiKeyPrefix: `${apiKey.slice(0, 16)}...`, ok: true, status: res.status, userId: user?.id || "" });
    if (user?.id) {
      debug.attempts = attempts;
      return { user, debug };
    }
  }
  debug.attempts = attempts;
  return { user: null, debug };
}

async function loadJson(path: string) {
  const res = await sbServiceFetch(path, { method: "GET" });
  return await res.json().catch(() => []);
}

async function callRpc(fn: string, payload: Record<string, unknown>) {
  const res = await sbServiceFetch(`/rest/v1/rpc/${fn}`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
  return await res.json().catch(() => null);
}

async function callUserScopedRpc(req: Request, supabaseUrl: string, fn: string, payload: Record<string, unknown>) {
  const customToken = txt(req.headers.get("x-vdan-access-token"));
  const bearerHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const authHeader = customToken ? `Bearer ${customToken}` : bearerHeader;
  const anonKey = txt(
    Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("PUBLIC_SUPABASE_ANON_KEY") || "",
  );
  if (!authHeader) throw new Error("unauthorized");
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: anonKey || txt(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""),
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`supabase_request_failed_${res.status}:${body}`);
  }
  return await res.json().catch(() => null);
}

async function isAllowed(userId: string, clubId: string) {
  const configuredSuperadminIds = String(
    Deno.env.get("PUBLIC_SUPERADMIN_USER_IDS")
    || Deno.env.get("SUPERADMIN_USER_IDS")
    || "",
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (configuredSuperadminIds.includes(String(userId || "").trim())) return true;
  const [aclRows, legacyClubRows, legacyGlobalAdminRows] = await Promise.all([
    loadJson(`/rest/v1/club_user_roles?select=role_key&user_id=eq.${encodeURIComponent(userId)}&club_id=eq.${encodeURIComponent(clubId)}`),
    loadJson(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&club_id=eq.${encodeURIComponent(clubId)}&role=in.(admin,vorstand)&limit=1`),
    loadJson(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&role=eq.admin&limit=1`),
  ]);
  const manager = (Array.isArray(aclRows) ? aclRows : []).some((row) => ["admin", "vorstand"].includes(txt(row?.role_key).toLowerCase()));
  const legacyManager = Array.isArray(legacyClubRows) && legacyClubRows.length > 0;
  const globalAdmin = Array.isArray(legacyGlobalAdminRows) && legacyGlobalAdminRows.length > 0;
  return manager || legacyManager || globalAdmin;
}

async function readSetting(settingKey: string) {
  const rows = await loadJson(`/rest/v1/app_secure_settings?select=setting_value&setting_key=eq.${encodeURIComponent(settingKey)}&limit=1`);
  const value = Array.isArray(rows) && rows.length ? rows[0]?.setting_value : null;
  return txt(value);
}

async function upsertSetting(settingKey: string, settingValue: string) {
  await sbServiceFetch("/rest/v1/app_secure_settings", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ setting_key: settingKey, setting_value: settingValue }]),
  });
}

async function findClubCode(clubId: string) {
  const rows = await loadJson(`/rest/v1/app_secure_settings?select=setting_key,setting_value&setting_key=like.club_code_map:*&setting_value=eq.${encodeURIComponent(clubId)}&limit=1`);
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  return upper(txt(row?.setting_key).replace("club_code_map:", ""));
}

function parseJsonObject(raw: string) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function defaultMemberDraft(input: Partial<MemberDraftState> = {}): MemberDraftState {
  return {
    first_name: "",
    last_name: "",
    status: "active",
    is_youth: false,
    membership_kind: "standard",
    city: "",
    phone: "",
    birthdate: "",
    fishing_card_type: "-",
    auto_assign_skipped: false,
    auto_assign_skip_reason: null,
    auto_assign_hint: "",
    ...input,
  };
}

function defaultCardsDraft(input: Partial<CardDraftState> = {}): CardDraftState {
  const groupRules = buildGroupRules(input.group_rules || {}, true);
  return {
    title: txt(input.title),
    kind: validCardKind(input.kind),
    is_active: input.is_active === undefined ? true : asBool(input.is_active),
    group_rules: groupRules,
  };
}

function autoAssignHint(reason: string | null) {
  if (reason === "multiple_defaults_for_group") {
    return "Mehrere Standardkarten vorhanden – bitte Kartenart manuell waehlen.";
  }
  if (reason === "no_default_for_group") {
    return "Keine Standardkarte fuer diese Gruppe vorhanden – bitte Kartenart manuell waehlen.";
  }
  return "";
}

async function loadWorkspace(clubId: string, drafts: { member_draft?: Partial<MemberDraftState> } = {}) {
  const [clubName, clubCode, clubMetaRaw, cardsRaw, waterMetaRaw, waterCardAssignmentsRaw, workHoursRaw, waters, members] = await Promise.all([
    readSetting(`club_name:${clubId}`),
    findClubCode(clubId),
    readSetting(`club_meta:${clubId}`),
    readSetting(`club_cards:${clubId}`),
    readSetting(`club_water_meta:${clubId}`),
    readSetting(`club_water_card_assignments:${clubId}`),
    callRpc<Record<string, unknown>>("get_work_hours_config", { p_club_id: clubId }).catch(() => ({ enabled: false })),
    loadJson(`/rest/v1/water_bodies?select=id,name,area_kind,is_active&club_id=eq.${encodeURIComponent(clubId)}&order=name.asc`),
    loadJson(`/rest/v1/club_members?select=member_no,first_name,last_name,status,fishing_card_type&club_id=eq.${encodeURIComponent(clubId)}&order=member_no.asc`),
  ]);

  const meta = parseJsonObject(clubMetaRaw);
  const cards = await normalizeCardsFromSettingValue(cardsRaw);
  const cardIdByLegacyName = new Map(cards.map((card) => [card.title, card.id]));
  const waterMeta = parseJsonObject(waterMetaRaw);
  const waterCardAssignments = parseJsonObject(waterCardAssignmentsRaw);
  const workHoursConfig = defaultWorkHoursConfig(workHoursRaw);

  return {
    club_data: {
      club_name: clubName,
      club_code: clubCode,
      street: txt(meta.street),
      zip: txt(meta.zip),
      city: txt(meta.city),
      contact_name: txt(meta.contact_name),
      contact_email: txt(meta.contact_email),
      contact_phone: txt(meta.contact_phone),
    },
    waters: (Array.isArray(waters) ? waters : []).map((row) => {
      const waterId = txt(row?.id);
      const metaRow = waterId ? parseJsonObject(JSON.stringify(waterMeta[waterId] || {})) : {};
      const rawAssignments = Array.isArray(waterCardAssignments[waterId]) ? waterCardAssignments[waterId] : [];
      const waterCards = toList(rawAssignments)
        .map((entry) => cardIdByLegacyName.get(entry) || entry)
        .filter((entry) => cards.some((card) => card.id === entry));
      return {
        ...row,
        water_status: txt(metaRow.water_status || (row?.is_active ? "active" : "inactive")) || "active",
        water_type: txt(metaRow.water_type),
        is_youth_allowed: asBool(metaRow.is_youth_allowed),
        requires_board_approval: asBool(metaRow.requires_board_approval),
        water_cards: waterCards,
      };
    }),
    cards,
    cards_draft: defaultCardsDraft(),
    work_hours_config: workHoursConfig,
    members: Array.isArray(members) ? members : [],
    member_draft: defaultMemberDraft(drafts.member_draft || {}),
  };
}

Deno.serve(async (req: Request) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) throw new Error("missing_supabase_service_env");

    const { user: actor, debug: authDebug } = await getAuthUser(req, supabaseUrl, serviceKey);
    if (!actor?.id) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized", debug: authDebug }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = txt(body.action) as Action;
    const clubId = txt(body.club_id);
    if (!clubId) throw new Error("club_id_required");
    if (!(await isAllowed(String(actor.id), clubId))) throw new Error("forbidden_club_scope");

    if (action === "save_club_data") {
      const clubName = txt(body.club_name);
      if (!clubName) throw new Error("club_name_required");
      const existingClubCode = await findClubCode(clubId);
      const submittedClubCode = upper(body.club_code);
      if (submittedClubCode && existingClubCode && submittedClubCode !== existingClubCode) {
        throw new Error("club_code_readonly");
      }
      const clubMeta = {
        club_id: clubId,
        club_name: clubName,
        club_code: existingClubCode,
        street: txt(body.street),
        zip: txt(body.zip),
        city: txt(body.city),
        contact_name: txt(body.contact_name),
        contact_email: txt(body.contact_email),
        contact_phone: txt(body.contact_phone),
      };
      await upsertSetting(`club_name:${clubId}`, clubName);
      await upsertSetting(`club_meta:${clubId}`, JSON.stringify(clubMeta));
    } else if (action === "save_cards") {
      const currentCards = await normalizeCardsFromSettingValue(await readSetting(`club_cards:${clubId}`));
      const incomingCards = Array.isArray(body.cards)
        ? toNormalizedCardRecords(body.cards)
        : toNormalizedCardRecords([{
            id: txt(body.id) || slugify(body.title) || `card-${currentCards.length + 1}`,
            title: body.title,
            kind: body.kind,
            is_active: body.is_active !== false,
            group_rules: {
              standard: {
                label: "Mitglied",
                is_default: asBool(body.standard_is_default ?? true),
                price: parseNullableNumber(body.standard_price),
              },
              youth: {
                label: "Jugend",
                is_default: asBool(body.youth_is_default ?? true),
                price: parseNullableNumber(body.youth_price),
              },
              honorary: {
                label: "Ehren",
                is_default: asBool(body.honorary_is_default ?? true),
                price: parseNullableNumber(body.honorary_price),
              },
            },
          }]);
      const cards = mergeCardsById(currentCards, incomingCards);
      if (!cards.length) throw new Error("cards_required");
      await upsertSetting(`club_cards:${clubId}`, JSON.stringify(toStoredCardPayload(cards)));
      await callUserScopedRpc(req, supabaseUrl, "upsert_club_onboarding_progress", {
        p_club_id: clubId,
        p_cards_complete: true,
      });
    } else if (action === "save_work_hours") {
      await upsertSetting(`club_work_hours_config:${clubId}`, JSON.stringify({
        enabled: asBool(body.enabled),
        default_hours: Number.isFinite(Number(body.default_hours)) ? Number(body.default_hours) : 0,
        youth_exempt: asBool(body.youth_exempt),
        honorary_exempt: asBool(body.honorary_exempt),
        note: txt(body.note) || null,
        configured_at: new Date().toISOString(),
        configured: true,
      }));
      await callUserScopedRpc(req, supabaseUrl, "upsert_club_onboarding_progress", {
        p_club_id: clubId,
        p_notes: {
          work_hours_configured: true,
        },
      });
    } else if (action === "create_water") {
      const name = txt(body.name);
      if (!name) throw new Error("water_name_required");
      const waterRes = await sbServiceFetch("/rest/v1/water_bodies", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify([{
          club_id: clubId,
          name,
          area_kind: txt(body.area_kind) || "vereins_gemeinschaftsgewaesser",
          is_active: txt(body.water_status).toLowerCase() !== "inactive",
        }]),
      });
      const createdRows = await waterRes.json().catch(() => []);
      const createdWaterId = txt(Array.isArray(createdRows) && createdRows.length ? createdRows[0]?.id : "");
      if (createdWaterId) {
        const waterMeta = parseJsonObject(await readSetting(`club_water_meta:${clubId}`));
        waterMeta[createdWaterId] = {
          water_status: txt(body.water_status) || "active",
          water_type: txt(body.water_type),
          is_youth_allowed: asBool(body.is_youth_allowed),
          requires_board_approval: asBool(body.requires_board_approval),
        };
        await upsertSetting(`club_water_meta:${clubId}`, JSON.stringify(waterMeta));

        const waterAssignments = parseJsonObject(await readSetting(`club_water_card_assignments:${clubId}`));
        waterAssignments[createdWaterId] = toList(body.water_cards);
        await upsertSetting(`club_water_card_assignments:${clubId}`, JSON.stringify(waterAssignments));
      }
    } else if (action === "update_water") {
      const waterId = txt(body.water_id);
      if (!waterId) throw new Error("water_id_required");
      const name = txt(body.name);
      if (!name) throw new Error("water_name_required");
      await sbServiceFetch(`/rest/v1/water_bodies?id=eq.${encodeURIComponent(waterId)}&club_id=eq.${encodeURIComponent(clubId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          name,
          area_kind: txt(body.area_kind) || "vereins_gemeinschaftsgewaesser",
          is_active: txt(body.water_status).toLowerCase() !== "inactive",
        }),
      });
      const waterMeta = parseJsonObject(await readSetting(`club_water_meta:${clubId}`));
      waterMeta[waterId] = {
        water_status: txt(body.water_status) || "active",
        water_type: txt(body.water_type),
        is_youth_allowed: asBool(body.is_youth_allowed),
        requires_board_approval: asBool(body.requires_board_approval),
      };
      await upsertSetting(`club_water_meta:${clubId}`, JSON.stringify(waterMeta));

      const waterAssignments = parseJsonObject(await readSetting(`club_water_card_assignments:${clubId}`));
      waterAssignments[waterId] = toList(body.water_cards);
      await upsertSetting(`club_water_card_assignments:${clubId}`, JSON.stringify(waterAssignments));
    } else if (action === "delete_water") {
      const waterId = txt(body.water_id);
      if (!waterId) throw new Error("water_id_required");
      await sbServiceFetch(`/rest/v1/water_bodies?id=eq.${encodeURIComponent(waterId)}&club_id=eq.${encodeURIComponent(clubId)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      const waterMeta = parseJsonObject(await readSetting(`club_water_meta:${clubId}`));
      delete waterMeta[waterId];
      await upsertSetting(`club_water_meta:${clubId}`, JSON.stringify(waterMeta));

      const waterAssignments = parseJsonObject(await readSetting(`club_water_card_assignments:${clubId}`));
      delete waterAssignments[waterId];
      await upsertSetting(`club_water_card_assignments:${clubId}`, JSON.stringify(waterAssignments));
    } else if (action === "toggle_water") {
      const waterId = txt(body.water_id);
      if (!waterId) throw new Error("water_id_required");
      await sbServiceFetch(`/rest/v1/water_bodies?id=eq.${encodeURIComponent(waterId)}&club_id=eq.${encodeURIComponent(clubId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ is_active: Boolean(body.is_active) }),
      });
    } else if (action === "create_member") {
      const clubCode = await findClubCode(clubId);
      if (!clubCode) throw new Error("club_code_missing");
      const memberGroupKey = inferMemberGroupKey(body);
      const cards = await normalizeCardsFromSettingValue(await readSetting(`club_cards:${clubId}`));
      const autoAssign = resolveDefaultCardTitle(cards, memberGroupKey);
      await callRpc("admin_member_registry_create", {
        p_club_id: clubId,
        p_club_code: clubCode,
        p_first_name: txt(body.first_name),
        p_last_name: txt(body.last_name),
        p_status: txt(body.status) || "active",
        p_fishing_card_type: autoAssign.title || txt(body.fishing_card_type) || "-",
        p_street: txt(body.street),
        p_zip: txt(body.zip),
        p_city: txt(body.city),
        p_phone: txt(body.phone),
        p_mobile: txt(body.mobile),
        p_birthdate: txt(body.birthdate) || null,
      });
      await callUserScopedRpc(req, supabaseUrl, "upsert_club_onboarding_progress", {
        p_club_id: clubId,
        p_members_mode: "imported",
      });

      const workspace = await loadWorkspace(clubId, {
        member_draft: {
          first_name: txt(body.first_name),
          last_name: txt(body.last_name),
          status: txt(body.status) || "active",
          is_youth: asBool(body.is_youth),
          membership_kind: txt(body.membership_kind) || "standard",
          city: txt(body.city),
          phone: txt(body.phone),
          birthdate: txt(body.birthdate),
          fishing_card_type: autoAssign.title || txt(body.fishing_card_type) || "-",
          auto_assign_skipped: autoAssign.skipped,
          auto_assign_skip_reason: autoAssign.reason,
          auto_assign_hint: autoAssignHint(autoAssign.reason),
        },
      });
      return new Response(JSON.stringify({ ok: true, workspace }), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    } else if (action !== "get") {
      throw new Error("action_invalid");
    }

    const workspace = await loadWorkspace(clubId);
    return new Response(JSON.stringify({ ok: true, workspace }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unexpected_error";
    const status = message === "unauthorized"
      ? 401
      : message === "forbidden_club_scope"
        ? 403
        : 500;
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
