import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getBillingUnits(count: number): number {
  return Math.max(50, Math.ceil(count / 50) * 50);
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabaseAuth = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { club_id } = await req.json();
  if (!club_id) {
    return new Response("Missing club_id", { status: 400 });
  }

  // Permission check
  // fcp_is_superadmin() takes no parameters — uses auth.uid() internally
  const { data: isSuperadmin } = await supabase.rpc("fcp_is_superadmin");

  if (!isSuperadmin) {
    // is_admin_or_vorstand_in_club parameter name is p_club_id
    const { data: isAdmin } = await supabase
      .rpc("is_admin_or_vorstand_in_club", { p_club_id: club_id });
    if (!isAdmin) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  // member_count aus DB
  const { count, error: countError } = await supabase
    .from("club_members")
    .select("*", { count: "exact", head: true })
    .eq("club_id", club_id)
    .eq("status", "active");

  if (countError) {
    return new Response("Failed to count members", { status: 500 });
  }

  const memberCount = count ?? 0;
  const billingUnits = getBillingUnits(memberCount);
  if (memberCount === 0) {
    return new Response(
      JSON.stringify({ error: "no_active_members", club_id, member_count: memberCount }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Stripe Checkout Session
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
  const priceId = Deno.env.get("STRIPE_FCP_PRICE_ID")!;
  const successUrl = Deno.env.get("CHECKOUT_SUCCESS_URL")!;
  const cancelUrl = Deno.env.get("CHECKOUT_CANCEL_URL")!;

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      "mode": "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": String(billingUnits),
      "metadata[club_id]": club_id,
      "metadata[member_count]": String(memberCount),
      "success_url": successUrl,
      "cancel_url": cancelUrl,
    }),
  });

  if (!stripeRes.ok) {
    const errText = await stripeRes.text();
    console.error("STRIPE_ERROR_STATUS:", stripeRes.status);
    console.error("STRIPE_ERROR_BODY:", errText);
    return new Response(
      JSON.stringify({ error: "stripe_failed", detail: errText }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const session = await stripeRes.json();

  // billing_state = 'checkout_open' — 'active' comes only via webhook
  await supabase.from("club_billing_subscriptions").upsert({
    club_id,
    billing_state: "checkout_open",
    stripe_price_id: priceId,
    member_count_at_billing: memberCount,
    billing_units: billingUnits,
  }, { onConflict: "club_id" });

  return new Response(
    JSON.stringify({ checkout_url: session.url }),
    { headers: { "Content-Type": "application/json" } }
  );
});
