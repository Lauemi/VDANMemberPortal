/**
 * Static regression tests for stripe-webhook-handler
 * MINAAA-27: club_id must be persisted in club_billing_webhook_events
 *
 * These are source-code analysis tests (no live network calls).
 * They fail if the implementation regresses.
 */

import { readFileSync } from "node:fs";
import { strictEqual, match } from "node:assert";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(
  join(__dirname, "../supabase/functions/stripe-webhook-handler/index.ts"),
  "utf8"
);

describe("stripe-webhook-handler regressions", () => {
  it("MINAAA-27: club_id is extracted from event metadata before insert", () => {
    // Must extract club_id from metadata
    match(src, /metadata.*club_id/);
  });

  it("MINAAA-27: club_id is included in club_billing_webhook_events insert", () => {
    // The insert block must contain a club_id field
    match(src, /club_billing_webhook_events[\s\S]{0,400}club_id\s*:/);
  });

  it("MINAAA-27: club_id extraction uses nullish coalescing (defaults to null)", () => {
    // Must not crash if metadata is absent — use ?? null
    match(src, /\?\?\s*null/);
  });

  it("signature verification is present and uses HMAC-SHA256", () => {
    match(src, /verifyStripeSignature/);
    match(src, /SHA-256/);
  });

  it("idempotency guard checks stripe_event_id before processing", () => {
    match(src, /stripe_event_id.*event\.id/s);
    match(src, /already_processed/);
  });
});
