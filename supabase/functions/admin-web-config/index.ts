declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

type AdminWebConfigPayload = {
  action?: "get" | "save";
  scope?: string;
  static_web_matrix?: Record<string, unknown>;
  app_mask_matrix?: Record<string, unknown>;
};

type RuntimeConfigRow = {
  id?: string;
  config_value?: unknown;
  version?: number;
};

const ALLOWED_STATIC_WEB_ROUTES = new Set([
  "/",
  "/login",
  "/registrieren",
  "/passwort-vergessen",
  "/offline",
  "/kontakt",
  "/datenschutz",
  "/nutzungsbedingungen",
  "/impressum",
  "/avv",
  "/docs",
  "/anglerheim-ottenheim",
  "/downloads",
  "/fischereipruefung",
  "/mitglied-werden",
  "/termine",
  "/vdan-jugend",
  "/veranstaltungen",
  "/vereinsshop",
]);

const ALLOWED_APP_MASK_ROUTES = new Set([
  "/app/",
  "/app/admin-panel/",
  "/app/arbeitseinsaetze/",
  "/app/arbeitseinsaetze/cockpit",
  "/app/ausweis/",
  "/app/ausweis/verifizieren",
  "/app/bewerbungen/",
  "/app/component-library/",
  "/app/dokumente/",
  "/app/einstellungen/",
  "/app/eventplaner/",
  "/app/eventplaner/mitmachen/",
  "/app/feedback/",
  "/app/feedback/cockpit",
  "/app/fangliste/",
  "/app/fangliste/cockpit",
  "/app/gewaesserkarte/",
  "/app/kontrollboard/",
  "/app/lizenzen/",
  "/app/mitglieder/",
  "/app/mitgliederverwaltung/",
  "/app/notes/",
  "/app/passwort-aendern/",
  "/app/rechtliches-bestaetigen/",
  "/app/sitzungen/",
  "/app/template-studio/",
  "/app/termine/cockpit",
  "/app/ui-neumorph-demo/",
  "/app/vereine/",
  "/app/zugang-pruefen/",
  "/app/zustaendigkeiten/",
]);

const ALLOWED_STATIC_BRANDS = new Set(["fcp", "vdan"]);
const ALLOWED_APP_BRANDS = new Set(["vdan_default", "fcp_tactical", "fcp_brand"]);
const MAX_CONFIG_BYTES = 64 * 1024;

function txt(value: unknown) {
  return String(value ?? "").trim();
}

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

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function safeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeRoute(route: unknown) {
  const raw = txt(route);
  if (!raw) return "/";
  const noQuery = raw.split("?")[0].split("#")[0] || "/";
  const normalized = noQuery
    .replace(/\/index$/, "/")
    .replace(/\.html$/i, "")
    .replace(/\/+$/, "") || "/";
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function assertPayloadSize(label: string, value: unknown) {
  const size = new TextEncoder().encode(JSON.stringify(value ?? {})).length;
  if (size > MAX_CONFIG_BYTES) {
    throw new Error(`${label}_too_large`);
  }
}

function validateStaticWebMatrix(input: unknown) {
  const source = safeObject(input);
  assertPayloadSize("static_web_matrix", source);
  const out: Record<string, unknown> = {};
  for (const [routeRaw, targetConfigRaw] of Object.entries(source)) {
    const route = normalizeRoute(routeRaw);
    if (!ALLOWED_STATIC_WEB_ROUTES.has(route)) throw new Error(`static_web_route_not_allowed:${route}`);
    const targetConfig = safeObject(targetConfigRaw);
    const extraTargets = Object.keys(targetConfig).filter((key) => key !== "fcp" && key !== "vdan");
    if (extraTargets.length) throw new Error(`static_web_target_not_allowed:${extraTargets[0]}`);
    const normalizedTargetConfig: Record<string, unknown> = {};
    for (const target of ["fcp", "vdan"]) {
      const row = safeObject(targetConfig[target]);
      const extraRowKeys = Object.keys(row).filter((key) => key !== "visible" && key !== "brand");
      if (extraRowKeys.length) throw new Error(`static_web_field_not_allowed:${extraRowKeys[0]}`);
      const brand = txt(row.brand).toLowerCase() || target;
      if (!ALLOWED_STATIC_BRANDS.has(brand)) throw new Error(`static_web_brand_invalid:${brand}`);
      normalizedTargetConfig[target] = {
        visible: row.visible !== false,
        brand,
      };
    }
    out[route] = normalizedTargetConfig;
  }
  return out;
}

function validateAppMaskMatrix(input: unknown) {
  const source = safeObject(input);
  assertPayloadSize("app_mask_matrix", source);
  const out: Record<string, unknown> = {};
  for (const [routeRaw, brandRaw] of Object.entries(source)) {
    const route = normalizeRoute(routeRaw);
    if (!ALLOWED_APP_MASK_ROUTES.has(route)) throw new Error(`app_mask_route_not_allowed:${route}`);
    if (typeof brandRaw !== "string") throw new Error(`app_mask_brand_invalid:${route}`);
    const brand = txt(brandRaw).toLowerCase();
    if (!ALLOWED_APP_BRANDS.has(brand)) throw new Error(`app_mask_brand_invalid:${brand}`);
    out[route] = brand;
  }
  return out;
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

async function sbServiceFetchAllow404(path: string, init: RequestInit = {}) {
  const base = Deno.env.get("SUPABASE_URL") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!base || !service) throw new Error("missing_supabase_service_env");

  const headers = new Headers(init.headers || {});
  headers.set("apikey", service);
  headers.set("Authorization", `Bearer ${service}`);
  headers.set("Content-Type", "application/json");

  return await fetch(`${base}${path}`, { ...init, headers });
}

async function getAuthUser(req: Request) {
  const base = Deno.env.get("SUPABASE_URL") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!base || !service || !authHeader) return null;
  const res = await fetch(`${base}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: service,
      Authorization: authHeader,
    },
  });
  if (!res.ok) return null;
  return await res.json().catch(() => null);
}

async function isAdmin(userId: string) {
  const res = await sbServiceFetch(
    `/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&role=eq.admin&limit=1`,
    { method: "GET" },
  );
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

async function readSetting(settingKey: string) {
  const res = await sbServiceFetch(
    `/rest/v1/app_secure_settings?select=setting_value&setting_key=eq.${encodeURIComponent(settingKey)}&limit=1`,
    { method: "GET" },
  );
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length ? txt(rows[0]?.setting_value) : "";
}

async function upsertSetting(settingKey: string, settingValue: string) {
  await sbServiceFetch("/rest/v1/app_secure_settings", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ setting_key: settingKey, setting_value: settingValue }]),
  });
}

function normalizeScope(value: unknown) {
  const raw = txt(value).toLowerCase();
  return raw === "vdan" ? "vdan" : "fcp";
}

function scopedKey(base: string, scope: string) {
  const safeScope = normalizeScope(scope);
  return `${base}:${safeScope}`;
}

function runtimeConfigKey(kind: "static_web_matrix" | "app_mask_matrix") {
  return kind === "static_web_matrix" ? "branding.static_web_matrix" : "branding.app_mask_matrix";
}

function stringifyStable(value: unknown) {
  return JSON.stringify(value ?? {});
}

async function runtimeTableAvailable() {
  const res = await sbServiceFetchAllow404("/rest/v1/app_runtime_configs?select=id&limit=1", { method: "GET" });
  if (res.ok) return true;
  if (res.status === 404) return false;
  const body = await res.text().catch(() => "");
  throw new Error(`runtime_table_probe_failed_${res.status}:${body}`);
}

async function loadRuntimeConfig(scope: string, configKey: string) {
  const res = await sbServiceFetchAllow404(
    `/rest/v1/app_runtime_configs?select=id,config_value,version&scope_type=eq.site_mode&scope_key=eq.${encodeURIComponent(scope)}&config_key=eq.${encodeURIComponent(configKey)}&status=eq.published&is_active=eq.true&order=version.desc&limit=1`,
    { method: "GET" },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`runtime_config_load_failed_${res.status}:${body}`);
  }
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] as RuntimeConfigRow : null;
}

async function saveRuntimeConfig(scope: string, configKey: string, value: Record<string, unknown>, actorId: string) {
  const current = await loadRuntimeConfig(scope, configKey);
  const beforeValue = safeObject(current?.config_value ?? {});
  const afterValue = safeObject(value);
  if (stringifyStable(beforeValue) === stringifyStable(afterValue)) {
    return current;
  }

  const rpcRes = await sbServiceFetchAllow404("/rest/v1/rpc/admin_publish_runtime_config", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      p_scope_key: scope,
      p_config_key: configKey,
      p_config_value: afterValue,
      p_actor_id: actorId,
    }),
  });
  if (rpcRes.status === 404) throw new Error("runtime_publish_rpc_missing");
  if (!rpcRes.ok) {
    const body = await rpcRes.text().catch(() => "");
    throw new Error(`runtime_config_publish_failed_${rpcRes.status}:${body}`);
  }
  return await loadRuntimeConfig(scope, configKey);
}

async function loadConfigForScope(scope: string) {
  const normalizedScope = normalizeScope(scope);
  const useRuntimeTable = await runtimeTableAvailable();

  let staticRaw = "";
  let appMaskRaw = "";
  if (useRuntimeTable) {
    const [runtimeStatic, runtimeAppMask] = await Promise.all([
      loadRuntimeConfig(normalizedScope, runtimeConfigKey("static_web_matrix")),
      loadRuntimeConfig(normalizedScope, runtimeConfigKey("app_mask_matrix")),
    ]);
    staticRaw = stringifyStable(runtimeStatic?.config_value ?? {});
    appMaskRaw = stringifyStable(runtimeAppMask?.config_value ?? {});
  } else {
    [staticRaw, appMaskRaw] = await Promise.all([
      readSetting(scopedKey("admin_web_config:static_web_matrix", normalizedScope)),
      readSetting(scopedKey("admin_web_config:app_mask_matrix", normalizedScope)),
    ]);
  }

  let staticWebMatrix = {};
  let appMaskMatrix = {};
  try {
    staticWebMatrix = safeObject(JSON.parse(staticRaw || "{}"));
  } catch {
    staticWebMatrix = {};
  }
  try {
    appMaskMatrix = safeObject(JSON.parse(appMaskRaw || "{}"));
  } catch {
    appMaskMatrix = {};
  }

  return {
    scope: normalizedScope,
    static_web_matrix: staticWebMatrix,
    app_mask_matrix: appMaskMatrix,
    storage_mode: useRuntimeTable ? "app_runtime_configs" : "app_secure_settings",
  };
}

Deno.serve(async (req: Request) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, headers);

  try {
    const actor = await getAuthUser(req);
    const body = safeObject(await req.json().catch(() => ({}))) as AdminWebConfigPayload;
    const action = txt(body.action) || "get";
    const scope = normalizeScope(body.scope);

    if (action === "get") {
      return json({ ok: true, ...(await loadConfigForScope(scope)) }, 200, headers);
    }

    if (!actor?.id) return json({ ok: false, error: "unauthorized" }, 401, headers);
    if (!(await isAdmin(String(actor.id)))) return json({ ok: false, error: "forbidden_admin_only" }, 403, headers);

    const validatedStaticWebMatrix = validateStaticWebMatrix(body.static_web_matrix);
    const validatedAppMaskMatrix = validateAppMaskMatrix(body.app_mask_matrix);

    if (await runtimeTableAvailable()) {
      await Promise.all([
        saveRuntimeConfig(scope, runtimeConfigKey("static_web_matrix"), validatedStaticWebMatrix, String(actor.id)),
        saveRuntimeConfig(scope, runtimeConfigKey("app_mask_matrix"), validatedAppMaskMatrix, String(actor.id)),
      ]);
    } else {
      await Promise.all([
        upsertSetting(scopedKey("admin_web_config:static_web_matrix", scope), JSON.stringify(validatedStaticWebMatrix)),
        upsertSetting(scopedKey("admin_web_config:app_mask_matrix", scope), JSON.stringify(validatedAppMaskMatrix)),
      ]);
    }

    return json({ ok: true, ...(await loadConfigForScope(scope)) }, 200, headers);
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : "unexpected_error" }, 500, headers);
  }
});
