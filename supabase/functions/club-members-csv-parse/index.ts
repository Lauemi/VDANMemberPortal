declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
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

function normalizeDelimiter(value: string) {
  const raw = txt(value);
  if (raw === "tab" || raw === "\\t") return "\t";
  return raw || ",";
}

async function sbServiceFetch(path: string, init: RequestInit = {}) {
  const base = Deno.env.get("SUPABASE_URL") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!base || !service) throw new Error("missing_supabase_service_env");

  const headers = new Headers(init.headers || {});
  headers.set("apikey", service);
  headers.set("Authorization", `Bearer ${service}`);

  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`supabase_request_failed_${res.status}:${body}`);
  }
  return res;
}

async function getAuthUser(req: Request, supabaseUrl: string, serviceKey: string) {
  const bearerHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!bearerHeader) return null;

  const requestApiKey = txt(req.headers.get("apikey") || req.headers.get("Apikey") || "");
  const apiKeys = [
    requestApiKey,
    serviceKey,
    Deno.env.get("SUPABASE_ANON_KEY") || "",
    Deno.env.get("PUBLIC_SUPABASE_ANON_KEY") || "",
  ].map((v) => txt(v)).filter(Boolean);

  for (const apiKey of apiKeys) {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: { apikey: apiKey, Authorization: bearerHeader },
    }).catch(() => null);
    if (!res?.ok) continue;
    const user = await res.json().catch(() => null);
    if (user?.id) return user;
  }
  return null;
}

async function isAllowed(userId: string, clubId: string): Promise<boolean> {
  const superadminIds = txt(
    Deno.env.get("PUBLIC_SUPERADMIN_USER_IDS") || Deno.env.get("SUPERADMIN_USER_IDS") || "",
  ).split(",").map((v) => txt(v)).filter(Boolean);
  if (superadminIds.includes(txt(userId))) return true;

  const [aclRows, legacyClubRows, legacyGlobalRows] = await Promise.all([
    sbServiceFetch(
      `/rest/v1/club_user_roles?select=role_key&user_id=eq.${encodeURIComponent(userId)}&club_id=eq.${encodeURIComponent(clubId)}&role_key=in.(admin,vorstand)&limit=1`,
      { method: "GET" },
    ).then((r) => r.json()).catch(() => []),
    sbServiceFetch(
      `/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&club_id=eq.${encodeURIComponent(clubId)}&role=in.(admin,vorstand)&limit=1`,
      { method: "GET" },
    ).then((r) => r.json()).catch(() => []),
    sbServiceFetch(
      `/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&role=eq.admin&limit=1`,
      { method: "GET" },
    ).then((r) => r.json()).catch(() => []),
  ]);

  return (
    (Array.isArray(aclRows) && aclRows.length > 0) ||
    (Array.isArray(legacyClubRows) && legacyClubRows.length > 0) ||
    (Array.isArray(legacyGlobalRows) && legacyGlobalRows.length > 0)
  );
}

function parseCsvLine(line: string, delimiter: string) {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  out.push(current);
  return out.map((value) => value.trim());
}

function parseCsvText(raw: string, delimiter: string) {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  return lines.map((line) => parseCsvLine(line, delimiter));
}

function slugHeader(value: string) {
  return txt(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function suggestPreviewValues(sourceValues: Record<string, string>) {
  const entries = Object.entries(sourceValues);
  const byKey = new Map(entries.map(([key, value]) => [slugHeader(key), value]));
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = txt(byKey.get(key));
      if (value) return value;
    }
    return "";
  };
  return {
    member_no:   pick("member_no", "mitgliedsnummer", "mitglied_nr", "nr", "number"),
    first_name:  pick("first_name", "vorname"),
    last_name:   pick("last_name", "nachname"),
    status:      pick("status") || "active",
    club_member_no: pick("club_member_no", "vereinsnummer", "vereins_nr"),
    fishing_card_type: pick("fishing_card_type", "karten_typ", "kartentyp"),
    email:       pick("email", "e_mail", "e_mail_adresse", "mail"),
    phone:       pick("phone", "telefon", "tel", "telefonnummer"),
    birthdate:   pick("birthdate", "geburtsdatum", "geburtstag", "geb_datum"),
    street:      pick("street", "strasse", "stra_e", "adresse"),
    zip:         pick("zip", "postal_code", "postleitzahl", "plz"),
    city:        pick("city", "ort", "wohnort", "stadt"),
  };
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

    const form = await req.formData();
    const clubId = txt(form.get("club_id"));
    if (!clubId) throw new Error("club_id_required");
    if (!(await isAllowed(txt(actor.id), clubId))) throw new Error("forbidden_club_manager_only");

    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("csv_file_required");

    const delimiter = normalizeDelimiter(txt(form.get("delimiter")));
    const hasHeader = txt(form.get("has_header")).toLowerCase() !== "false";
    const csvText = await file.text();
    const rows = parseCsvText(csvText, delimiter);
    if (!rows.length) throw new Error("csv_empty");

    const headersRow = hasHeader ? rows[0] : rows[0].map((_, index) => `column_${index + 1}`);
    const dataRows = hasHeader ? rows.slice(1) : rows;

    const parsedRows = dataRows.map((row, index) => {
      const sourceValues = headersRow.reduce<Record<string, string>>((acc, key, keyIndex) => {
        acc[txt(key) || `column_${keyIndex + 1}`] = txt(row[keyIndex]);
        return acc;
      }, {});
      const previewValues = suggestPreviewValues(sourceValues);
      const issues: string[] = [];
      if (!txt(previewValues.member_no)) issues.push("member_no fehlt im Mapping-Hinweis");
      if (!txt(previewValues.first_name)) issues.push("first_name fehlt im Mapping-Hinweis");
      if (!txt(previewValues.last_name)) issues.push("last_name fehlt im Mapping-Hinweis");
      return {
        row_no: index + 1,
        row_status: issues.length ? "review" : "ready",
        source_values: sourceValues,
        preview_values: previewValues,
        issues,
      };
    });

    return new Response(
      JSON.stringify({
        ok: true,
        headers: headersRow,
        preview: parsedRows,
        note: "CSV serverseitig geparst. Vorschau prüfen und Import bestätigen.",
      }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unexpected_error";
    const status = message === "unauthorized" ? 401 : message.startsWith("forbidden") ? 403 : 400;
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }
});
