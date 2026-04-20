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

  await supabase.from("club_billing_webhook_events").insert({
    event_id: event.id,       // satisfies NOT NULL + unique(provider, event_id)
    stripe_event_id: event.id, // idempotency index compatibility
    event_type: event.type,
    payload: event,
    received_at: new Date().toISOString(),
  });

  // PROCESS
  try {
    switch (event.type) {

      case "checkout.session.completed": {
        const session = event.data.object;
        const club_id = session.metadata?.club_id;
        if (!club_id) break;

        const { count } = await supabase
          .from("club_members")
          .select("*", { count: "exact", head: true })
          .eq("club_id", club_id)
          .eq("status", "active");

        await supabase.from("club_billing_subscriptions").upsert({
          club_id,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          stripe_price_id: Deno.env.get("STRIPE_FCP_PRICE_ID"),
          billing_state: "active",
          member_count_at_billing: count ?? 0,
        }, { onConflict: "club_id" });
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
          })
          .eq("stripe_subscription_id", sub_id);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const sub_id = invoice.subscription;
        if (!sub_id) break;

        await supabase.from("club_billing_subscriptions")
          .update({ billing_state: "past_due" })
          .eq("stripe_subscription_id", sub_id);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await supabase.from("club_billing_subscriptions")
          .update({ billing_state: "canceled" })
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
