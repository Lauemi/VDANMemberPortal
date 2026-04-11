-- Migration: add billing_units to club_billing_subscriptions
-- Stores the rounded-up 50-unit block sent to Stripe (distinct from raw member_count_at_billing).

ALTER TABLE public.club_billing_subscriptions
  ADD COLUMN IF NOT EXISTS billing_units integer;
