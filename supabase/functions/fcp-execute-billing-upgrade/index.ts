/**
 * fcp-execute-billing-upgrade
 *
 * Führt ein Mid-Year-Stufen-Upgrade durch:
 *   1. Aktuelle Mitgliederzahl live zählen
 *   2. Benötigte Billing-Units berechnen (50er-Stufen)
 *   3. Wenn neue Stufe > gebuchte Stufe: Stripe-Subscription-Quantity updaten
 *      mit proration_behavior = create_prorations
 *      → Stripe erstellt automatisch eine Differenzrechnung
 *   4. DB aktualisieren: billing_units, member_count_at_billing, last_upgrade_at
 *
 * Nur aufrufbar wenn billing_state = 'active'.
 * Idempotent: gibt { already_correct: true } zurück wenn kein Upgrade nötig.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getBillingUnits } from "../_shared/billing-config.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabaseAuth = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser();
  if (authError || !user) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ── Input ─────────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}));
  const club_id = String(body?.club_id || "").trim();
  if (!club_id) return json({ error: "club_id_required" }, 400);

  // ── Permission ────────────────────────────────────────────────────────────
  const { data: isSuperadmin } = await supabase.rpc("fcp_is_superadmin");
  if (!isSuperadmin) {
    const { data: isAdmin } = await supabase.rpc("is_admin_or_vorstand_in_club", {
      p_club_id: club_id,
    });
    if (!isAdmin) return json({ error: "forbidden" }, 403);
  }

  // ── Aktuelle Subscription laden ───────────────────────────────────────────
  const { data: sub, error: subError } = await supabase
    .from("club_billing_subscriptions")
    .select("billing_units, billing_state, stripe_subscription_id, member_count_at_billing, upgrade_count")
    .eq("club_id", club_id)
    .maybeSingle();

  if (subError || !sub) return json({ error: "subscription_not_found" }, 404);

  if (sub.billing_state !== "active") {
    return json({ error: "subscription_not_active", billing_state: sub.billing_state }, 400);
  }

  if (!sub.stripe_subscription_id) {
    return json({ error: "no_stripe_subscription_id" }, 400);
  }

  // ── Aktive Mitglieder live zählen ─────────────────────────────────────────
  const { count, error: countError } = await supabase
    .from("club_members")
    .select("*", { count: "exact", head: true })
    .eq("club_id", club_id)
    .eq("status", "active");

  if (countError) return json({ error: "member_count_failed" }, 500);

  const memberCount = count ?? 0;
  const newBillingUnits = getBillingUnits(memberCount);
  const currentBillingUnits = sub.billing_units ?? 0;

  // ── Idempotenz: schon korrekt? ────────────────────────────────────────────
  if (newBillingUnits <= currentBillingUnits) {
    return json({
      already_correct: true,
      billing_units: currentBillingUnits,
      member_count: memberCount,
    });
  }

  // ── Stripe: Subscription-Item-ID holen ───────────────────────────────────
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;

  const stripeSubRes = await fetch(
    `https://api.stripe.com/v1/subscriptions/${sub.stripe_subscription_id}`,
    { headers: { Authorization: `Bearer ${stripeKey}` } }
  );

  if (!stripeSubRes.ok) {
    const detail = await stripeSubRes.text().catch(() => "");
    console.error("STRIPE_FETCH_SUB_ERROR", stripeSubRes.status, detail);
    return json({ error: "stripe_fetch_failed", detail }, 500);
  }

  const stripeSub = await stripeSubRes.json();
  const itemId: string | undefined = stripeSub.items?.data?.[0]?.id;

  if (!itemId) {
    return json({ error: "stripe_subscription_item_not_found" }, 500);
  }

  // ── Stripe: Quantity updaten mit Proration ────────────────────────────────
  // proration_behavior = create_prorations:
  //   Stripe erstellt sofort eine anteilige Invoice über die Differenz
  //   (gebuchte neue Monate * (neue_rate - alte_rate)).
  //   Die Subscription läuft weiter, Renewal-Datum bleibt unverändert.
  const updateBody = new URLSearchParams({
    "items[0][id]": itemId,
    "items[0][quantity]": String(newBillingUnits),
    "proration_behavior": "create_prorations",
  });

  const updateRes = await fetch(
    `https://api.stripe.com/v1/subscriptions/${sub.stripe_subscription_id}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: updateBody,
    }
  );

  if (!updateRes.ok) {
    const detail = await updateRes.text().catch(() => "");
    console.error("STRIPE_UPDATE_SUB_ERROR", updateRes.status, detail);
    return json({ error: "stripe_update_failed", detail }, 500);
  }

  const updatedSub = await updateRes.json();

  // ── DB: billing_units + Upgrade-Tracking aktualisieren ───────────────────
  const upgradeCount = (sub.upgrade_count ?? 0) + 1;

  const { error: dbError } = await supabase
    .from("club_billing_subscriptions")
    .update({
      billing_units: newBillingUnits,
      member_count_at_billing: memberCount,
      last_event_type: "mid_year_upgrade",
      last_upgrade_at: new Date().toISOString(),
      upgrade_count: upgradeCount,
    })
    .eq("club_id", club_id);

  if (dbError) {
    // Stripe-Update war erfolgreich — DB-Fehler loggen aber nicht als Fehler zurückgeben,
    // damit kein doppeltes Upgrade ausgelöst wird.
    console.error("DB_UPDATE_AFTER_STRIPE_UPGRADE_FAILED", dbError);
  }

  return json({
    success: true,
    old_units: currentBillingUnits,
    new_units: newBillingUnits,
    member_count: memberCount,
    upgrade_count: upgradeCount,
    stripe_subscription_id: sub.stripe_subscription_id,
    latest_invoice: updatedSub.latest_invoice ?? null,
  });
});
