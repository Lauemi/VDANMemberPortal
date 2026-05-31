import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Billing-Einheiten aus billing_units (bereits als 50er-Stufe übergeben)
// Preis: billing_units * 2 EUR/Jahr
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabaseAuth = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const { registration_request_id, billing_units, customer_email } = body;

  if (!registration_request_id) {
    return new Response(
      JSON.stringify({ error: "missing_registration_request_id" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const billingUnits = parseInt(String(billing_units || "50"), 10);
  if (!billingUnits || billingUnits < 50 || billingUnits > 500) {
    return new Response(
      JSON.stringify({ error: "invalid_billing_units", billing_units }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Verify registration request exists and belongs to this user
  const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: regRequest, error: reqError } = await supabase
    .from("club_registration_requests")
    .select("id, status, contact_email")
    .eq("id", registration_request_id)
    .maybeSingle();

  if (reqError || !regRequest) {
    return new Response(
      JSON.stringify({ error: "registration_request_not_found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
  const priceId = Deno.env.get("STRIPE_FCP_PRICE_ID")!;
  const successUrl = Deno.env.get("CHECKOUT_SUCCESS_URL")!;
  const cancelUrl = Deno.env.get("CHECKOUT_CANCEL_URL")!;

  const emailForCheckout = customer_email || regRequest.contact_email || user.email || "";

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      "mode": "subscription",
      "locale": "de",
      "customer_email": emailForCheckout,
      "billing_address_collection": "required",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": String(billingUnits),
      "metadata[registration_request_id]": registration_request_id,
      "metadata[billing_units]": String(billingUnits),
      "metadata[is_new_registration]": "true",
      "subscription_data[description]": `FCP-Vereinslizenz – ${billingUnits} Abrechnungseinheiten à 2 € netto/Jahr`,
      // Pflicht-/Transparenzinfos direkt am Bezahl-Button (§19 UStG, Vertragspartner, Laufzeit)
      "custom_text[submit][message]":
        `Jahreslizenz für Vereine/Organisationen: ${billingUnits} Einheiten × 2 € = ${billingUnits * 2} € pro Jahr. `
        + `Laufzeit 12 Monate, Verlängerung um je 1 Jahr, jährlich kündbar. `
        + `Gemäß § 19 UStG wird keine Umsatzsteuer berechnet. `
        + `Vertragspartner: Michael Lauenroth (Einzelunternehmen).`,
      "success_url": successUrl,
      "cancel_url": cancelUrl,
    }),
  });

  if (!stripeRes.ok) {
    const errText = await stripeRes.text();
    console.error("STRIPE_ERROR:", stripeRes.status, errText);
    return new Response(
      JSON.stringify({ error: "stripe_failed", detail: errText }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const session = await stripeRes.json();

  // Registrierungsanfrage auf billing_pending setzen
  await supabase
    .from("club_registration_requests")
    .update({
      status: "billing_pending",
      stripe_checkout_session_id: session.id,
    })
    .eq("id", registration_request_id);

  return new Response(
    JSON.stringify({ checkout_url: session.url }),
    { headers: { "Content-Type": "application/json" } }
  );
});
