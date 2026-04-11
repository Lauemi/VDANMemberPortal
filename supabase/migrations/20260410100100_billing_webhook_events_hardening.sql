-- Migration: club_billing_webhook_events hardening
-- Additive only — existing columns (id, provider, event_id, event_type, club_id,
-- processed_at, payload) are not touched.
-- Adds stripe_event_id and received_at required by stripe-webhook-handler function.

ALTER TABLE public.club_billing_webhook_events
  ADD COLUMN IF NOT EXISTS stripe_event_id text,
  ADD COLUMN IF NOT EXISTS event_type      text,
  ADD COLUMN IF NOT EXISTS payload         jsonb,
  ADD COLUMN IF NOT EXISTS received_at     timestamptz DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS
  club_billing_webhook_events_stripe_event_id_unique
  ON public.club_billing_webhook_events (stripe_event_id);
