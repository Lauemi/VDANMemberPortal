import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

  // Verify Stripe signature (manual HMAC — no Stripe SDK needed)
  const isValid = await verifyStripeSignature(payload, signature, webhookSecret);
  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(payload);

  // LOG FIRST — always, before any processing
  const { data: existing } = await supabase
    .from("club_billing_webhook_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existing) {
    // Already processed — idempotency guard
    return new Response("already_processed", { status: 200 });
  }

  // Extract club_id from metadata when available (checkout.session.completed carries it)
  const club_id_log = (event.data?.object as { metadata?: { club_id?: string } })?.metadata?.club_id ?? null;

  await supabase.from("club_billing_webhook_events").insert({
    event_id: event.id,       // satisfies NOT NULL + unique(provider, event_id)
    stripe_event_id: event.id, // idempotency index compatibility
    event_type: event.type,
    payload: event,
    received_at: new Date().toISOString(),
    club_id: club_id_log,
  });

  // PROCESS
  try {
    switch (event.type) {

      case "checkout.session.completed": {
        const session = event.data.object;
        const club_id = session.metadata?.club_id;
        const registrationRequestId = session.metadata?.registration_request_id;
        const isNewRegistration = session.metadata?.is_new_registration === "true";

        // ── Pfad A: Bestehender Club (Standard-Billing) ─────────────────
        if (club_id && !isNewRegistration) {
          const memberCountAtCheckout = parseInt(session.metadata?.member_count ?? "0", 10);
          await supabase.from("club_billing_subscriptions").upsert({
            club_id,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            stripe_price_id: Deno.env.get("STRIPE_FCP_PRICE_ID"),
            billing_state: "active",
            checkout_state: "completed",
            member_count_at_billing: memberCountAtCheckout,
            last_event_id: event.id,
            last_event_type: event.type,
          }, { onConflict: "club_id" });
          break;
        }

        // ── Pfad B: Neue Selbstregistrierung — vollautomatisch ─────────
        if (isNewRegistration && registrationRequestId) {
          const billingUnits = parseInt(session.metadata?.billing_units ?? "50", 10);
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

          // Registrierungsanfrage holen
          const { data: regRequest } = await supabase
            .from("club_registration_requests")
            .select("*")
            .eq("id", registrationRequestId)
            .maybeSingle();

          if (regRequest) {
            // Stripe-Daten auf Anfrage setzen
            await supabase
              .from("club_registration_requests")
              .update({
                stripe_customer_id: session.customer,
                stripe_subscription_id: session.subscription,
                billing_units: billingUnits,
              })
              .eq("id", registrationRequestId);

            // club-admin-setup direkt aufrufen (service role = voller Zugriff)
            const reqPayload = (regRequest.request_payload || {}) as Record<string, string>;
            const setupRes = await fetch(`${supabaseUrl}/functions/v1/club-admin-setup`, {
              method: "POST",
              headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                request_id: registrationRequestId,
                club_name: regRequest.club_name || "",
                default_fishing_card: "FCP Standard",
                fishing_cards: ["FCP Standard"],
                waters: [],
                make_public_active: false,
                assign_creator_roles: true,
                street: reqPayload.street || regRequest.club_address || "",
                zip: reqPayload.zip || "",
                city: reqPayload.city || reqPayload.club_location || "",
                contact_name: regRequest.responsible_name || "",
                contact_email: regRequest.responsible_email || "",
                responsible_name: regRequest.responsible_name || "",
                responsible_email: regRequest.responsible_email || "",
                club_size: String(billingUnits),
                creator_user_id: regRequest.requester_user_id || "",
                creator_email: regRequest.requester_email || "",
              }),
            });

            const setupData = await setupRes.json().catch(() => ({}));
            const clubId = String(setupData?.club_id || "").trim();

            if (clubId) {
              // Registrierungsanfrage als genehmigt markieren
              await supabase
                .from("club_registration_requests")
                .update({
                  status: "approved",
                  approved_club_id: clubId,
                  auto_approved: true,
                  approved_at: new Date().toISOString(),
                  decision_payload: {
                    decided_at: new Date().toISOString(),
                    action: "approve",
                    club_id: clubId,
                    trigger: "stripe_payment",
                    billing_units: billingUnits,
                  },
                })
                .eq("id", registrationRequestId);

              // Billing-Subscription für neuen Club anlegen
              await supabase.from("club_billing_subscriptions").upsert({
                club_id: clubId,
                stripe_customer_id: session.customer,
                stripe_subscription_id: session.subscription,
                stripe_price_id: Deno.env.get("STRIPE_FCP_PRICE_ID"),
                billing_state: "active",
                checkout_state: "completed",
                billing_units: billingUnits,
                member_count_at_billing: 0,
                last_event_id: event.id,
                last_event_type: event.type,
              }, { onConflict: "club_id" });

              // Webhook-Event mit Club-ID aktualisieren
              await supabase
                .from("club_billing_webhook_events")
                .update({ club_id: clubId })
                .eq("stripe_event_id", event.id);

              console.log("Auto-approved registration:", registrationRequestId, "→ club:", clubId);
            } else {
              console.error("club-admin-setup failed:", setupData);
            }
          }
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;
        const sub_id = invoice.subscription;
        if (!sub_id) break;

        await supabase.from("club_billing_subscriptions")
          .update({
            billing_state: "active",
            current_period_start: new Date(invoice.period_start * 1000).toISOString(),
            current_period_end: new Date(invoice.period_end * 1000).toISOString(),
            last_event_id: event.id,
            last_event_type: event.type,
          })
          .eq("stripe_subscription_id", sub_id);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const sub_id = invoice.subscription;
        if (!sub_id) break;

        await supabase.from("club_billing_subscriptions")
          .update({ billing_state: "past_due", last_event_id: event.id, last_event_type: event.type })
          .eq("stripe_subscription_id", sub_id);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await supabase.from("club_billing_subscriptions")
          .update({ billing_state: "canceled", canceled_at: new Date().toISOString(), last_event_id: event.id, last_event_type: event.type })
          .eq("stripe_subscription_id", sub.id);
        break;
      }

      default:
        // Known unknown — logged, no action needed
        break;
    }
  } catch (err) {
    // Processing error — event is already logged, don't re-throw
    console.error("Processing error:", err);
    return new Response("processing_error", { status: 200 });
    // 200 intentional: Stripe must not retry on processing bugs
  }

  return new Response("ok", { status: 200 });
});

// Manual HMAC-SHA256 Stripe signature verification (no SDK)
async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string
): Promise<boolean> {
  try {
    const parts = Object.fromEntries(
      header.split(",").map((p) => p.split("=") as [string, string])
    );
    const timestamp = parts["t"];
    const signature = parts["v1"];
    const signed = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(signed)
    );
    const computed = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return computed === signature;
  } catch {
    return false;
  }
}
