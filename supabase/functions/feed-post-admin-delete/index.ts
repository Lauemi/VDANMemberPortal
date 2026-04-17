import { createClient } from "npm:@supabase/supabase-js@2";

type DeleteBody = {
  post_id?: string;
};

type FeedPostRow = {
  id?: string;
  club_id?: string;
};

type FeedMediaRow = {
  storage_bucket?: string;
  storage_path?: string;
};

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

function cors(req: Request) {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function txt(value: unknown) {
  return String(value ?? "").trim();
}

function isMissingObjectError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("not found")
    || normalized.includes("no such object")
    || normalized.includes("not_exist")
    || normalized.includes("not_exists");
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
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!authHeader) return null;

  const jwt = authHeader.replace(/^[Bb]earer\s+/, "").trim();
  if (!jwt) return null;

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  if (!anonKey) throw new Error("missing_supabase_anon_env");

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data?.user?.id) return null;
  return data.user;
}

async function isManager(userId: string) {
  const res = await sbServiceFetch(
    `/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}`,
    { method: "GET" },
  );
  const rows = await res.json().catch(() => []);
  const roles = (Array.isArray(rows) ? rows : []).map((row) => txt(row?.role).toLowerCase());
  return roles.includes("admin") || roles.includes("vorstand");
}

async function isManagerInClub(userId: string, clubId: string) {
  const res = await sbServiceFetch(
    `/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&club_id=eq.${encodeURIComponent(clubId)}&role=in.(admin,vorstand)&limit=1`,
    { method: "GET" },
  );
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

async function loadPost(postId: string) {
  const res = await sbServiceFetch(
    `/rest/v1/feed_posts?select=id,club_id&id=eq.${encodeURIComponent(postId)}&limit=1`,
    { method: "GET" },
  );
  const rows = await res.json().catch(() => []);
  return (Array.isArray(rows) && rows.length ? rows[0] : null) as FeedPostRow | null;
}

async function loadMedia(postId: string) {
  const res = await sbServiceFetch(
    `/rest/v1/feed_post_media?select=storage_bucket,storage_path&post_id=eq.${encodeURIComponent(postId)}&order=sort_order.asc`,
    { method: "GET" },
  );
  const rows = await res.json().catch(() => []);
  return (Array.isArray(rows) ? rows : []) as FeedMediaRow[];
}

async function deleteStorageObjects(
  storageClient: ReturnType<typeof createClient>,
  rows: FeedMediaRow[],
) {
  const bucketMap = new Map<string, string[]>();

  rows.forEach((row) => {
    const bucket = txt(row?.storage_bucket);
    const path = txt(row?.storage_path);
    if (!bucket || !path) return;
    if (!bucketMap.has(bucket)) bucketMap.set(bucket, []);
    bucketMap.get(bucket)?.push(path);
  });

  for (const [bucket, paths] of bucketMap.entries()) {
    const uniquePaths = [...new Set(paths)];
    if (!uniquePaths.length) continue;

    const { error } = await storageClient.storage.from(bucket).remove(uniquePaths);
    if (error && !isMissingObjectError(txt(error.message))) {
      throw new Error(`storage_delete_failed:${bucket}:${txt(error.message) || "unknown"}`);
    }
  }
}

Deno.serve(async (req: Request) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
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
    if (!(await isManager(txt(actor.id)))) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null) as DeleteBody | null;
    const postId = txt(body?.post_id);
    if (!postId) {
      return new Response(JSON.stringify({ ok: false, error: "post_id_required" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const post = await loadPost(postId);
    if (!post?.id) {
      return new Response(JSON.stringify({ ok: true, deleted: false, reason: "not_found" }), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const clubId = txt(post.club_id);
    if (!clubId) throw new Error("post_club_missing");
    if (!(await isManagerInClub(txt(actor.id), clubId))) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden_club_scope" }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const storageClient = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const seen = new Set<string>();
    for (let pass = 0; pass < 3; pass += 1) {
      const mediaRows = await loadMedia(postId);
      const freshRows = mediaRows.filter((row) => {
        const key = `${txt(row?.storage_bucket)}|${txt(row?.storage_path)}`;
        if (!txt(row?.storage_bucket) || !txt(row?.storage_path) || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (!freshRows.length) break;
      await deleteStorageObjects(storageClient, freshRows);
    }

    await sbServiceFetch(
      `/rest/v1/feed_posts?id=eq.${encodeURIComponent(postId)}&club_id=eq.${encodeURIComponent(clubId)}`,
      {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      },
    );

    return new Response(JSON.stringify({ ok: true, deleted: true, post_id: postId }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "unexpected_error" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
