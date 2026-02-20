#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_PASSWORD = process.env.BULK_DEFAULT_PASSWORD || "VDANAPP1";
const EMAIL_DOMAIN = process.env.BULK_EMAIL_DOMAIN || "members.vdan.local";
const DRY_RUN = process.argv.includes("--dry-run");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const baseHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

function normalizeMemberNo(memberNo) {
  return String(memberNo ?? "").trim();
}

function buildEmail(memberNo) {
  const safe = normalizeMemberNo(memberNo).replace(/[^a-zA-Z0-9._-]/g, "_");
  return `member_${safe}@${EMAIL_DOMAIN}`.toLowerCase();
}

async function requestJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function fetchClubMembers() {
  const url = new URL("/rest/v1/club_members", SUPABASE_URL);
  url.searchParams.set("select", "member_no,first_name,last_name,status,membership_kind,fishing_card_type,is_youth,role");
  url.searchParams.set("order", "member_no.asc");
  const data = await requestJson(url.toString(), {
    headers: {
      ...baseHeaders,
      Range: "0-5000",
    },
  });
  return Array.isArray(data) ? data : [];
}

async function fetchAllAuthUsers() {
  const usersByEmail = new Map();
  let page = 1;
  const perPage = 1000;

  while (true) {
    const url = new URL("/auth/v1/admin/users", SUPABASE_URL);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(perPage));
    const payload = await requestJson(url.toString(), { headers: baseHeaders });
    const users = payload?.users || [];
    for (const u of users) {
      if (u?.email) usersByEmail.set(String(u.email).toLowerCase(), u);
    }
    if (users.length < perPage) break;
    page += 1;
  }

  return usersByEmail;
}

async function createAuthUser(email, member) {
  const url = new URL("/auth/v1/admin/users", SUPABASE_URL);
  const body = {
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      member_no: member.member_no,
      first_name: member.first_name,
      last_name: member.last_name,
      is_youth: !!member.is_youth,
    },
  };
  const created = await requestJson(url.toString(), {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify(body),
  });
  return created?.user || created;
}

async function upsertProfile(profile) {
  const url = new URL("/rest/v1/profiles", SUPABASE_URL);
  await requestJson(url.toString(), {
    method: "POST",
    headers: {
      ...baseHeaders,
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([profile]),
  });
}

async function upsertUserRole(userId, role) {
  const url = new URL("/rest/v1/user_roles", SUPABASE_URL);
  await requestJson(url.toString(), {
    method: "POST",
    headers: {
      ...baseHeaders,
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([{ user_id: userId, role }]),
  });
}

function displayName(firstName, lastName) {
  return `${firstName || ""} ${lastName || ""}`.trim() || null;
}

async function run() {
  const members = await fetchClubMembers();
  if (!members.length) {
    console.log("No rows in public.club_members. Run migration/import first.");
    return;
  }

  const existingUsersByEmail = await fetchAllAuthUsers();
  let created = 0;
  let reused = 0;
  let synced = 0;

  for (const m of members) {
    const memberNo = normalizeMemberNo(m.member_no);
    if (!memberNo) continue;

    const role = ["member", "vorstand", "admin"].includes(m.role) ? m.role : "member";
    const email = buildEmail(memberNo);
    let user = existingUsersByEmail.get(email);

    if (!user) {
      if (DRY_RUN) {
        console.log(`[dry-run] create auth user: ${email}`);
        created += 1;
        continue;
      }
      user = await createAuthUser(email, m);
      existingUsersByEmail.set(email, user);
      created += 1;
    } else {
      reused += 1;
    }

    if (DRY_RUN) {
      console.log(`[dry-run] sync profile+role for: ${email} (${role})`);
      synced += 1;
      continue;
    }

    await upsertProfile({
      id: user.id,
      email,
      display_name: displayName(m.first_name, m.last_name),
      member_no: memberNo,
      first_name: m.first_name || null,
      last_name: m.last_name || null,
      membership_kind: m.membership_kind || null,
      fishing_card_type: m.fishing_card_type || null,
      is_youth: !!m.is_youth,
      must_change_password: true,
    });

    await upsertUserRole(user.id, role);
    synced += 1;
  }

  console.log("");
  console.log("Bulk user sync finished:");
  console.log(`- Members processed: ${members.length}`);
  console.log(`- Auth users created: ${created}`);
  console.log(`- Auth users reused: ${reused}`);
  console.log(`- Profiles/roles synced: ${synced}`);
  if (!DRY_RUN) {
    console.log("");
    console.log(`Default password used for new users: ${DEFAULT_PASSWORD}`);
    console.log("Change it after first login or enforce reset flow.");
  }
}

run().catch((err) => {
  console.error("Bulk sync failed.");
  console.error(err?.message || err);
  if (err?.data) console.error(JSON.stringify(err.data, null, 2));
  process.exit(1);
});
