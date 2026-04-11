-- Migration: club_billing_subscriptions hardening
-- Additive only — no existing columns or data touched.
-- Existing columns (club_id PK, billing_state, stripe_customer_id, stripe_subscription_id,
-- current_period_end) are already present; ADD COLUMN IF NOT EXISTS is a safe no-op for them.

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 2 — Add missing columns
-- ────────────────────────────────────────────────────────────────────────────

-- Already-existing columns are no-ops via IF NOT EXISTS:
ALTER TABLE public.club_billing_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id       text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id   text,
  ADD COLUMN IF NOT EXISTS stripe_price_id          text,
  ADD COLUMN IF NOT EXISTS billing_state            text
    CHECK (billing_state IN ('active','trialing','past_due','canceled','unpaid')),
  ADD COLUMN IF NOT EXISTS member_count_at_billing  integer,
  ADD COLUMN IF NOT EXISTS current_period_start     timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end       timestamptz;

-- club_id is already the primary key — no-op:
ALTER TABLE public.club_billing_subscriptions
  ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubs(id);

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 3 — Unique index for upsert safety (club_id already has PK uniqueness;
--           named index allows deterministic ON CONFLICT targeting)
-- ────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS club_billing_subscriptions_club_id_unique
  ON public.club_billing_subscriptions (club_id);

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 4 — RLS (already enabled in onboarding_foundation; idempotent)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.club_billing_subscriptions ENABLE ROW LEVEL SECURITY;

-- service_role: full access
DROP POLICY IF EXISTS "billing_service_role_all" ON public.club_billing_subscriptions;
CREATE POLICY "billing_service_role_all"
  ON public.club_billing_subscriptions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- authenticated: read own club only
DROP POLICY IF EXISTS "billing_club_admin_select" ON public.club_billing_subscriptions;
CREATE POLICY "billing_club_admin_select"
  ON public.club_billing_subscriptions
  FOR SELECT TO authenticated
  USING (public.is_admin_or_vorstand_in_club(club_id));

-- authenticated: superadmin reads all (uses project-standard fcp_is_superadmin())
DROP POLICY IF EXISTS "billing_superadmin_select" ON public.club_billing_subscriptions;
CREATE POLICY "billing_superadmin_select"
  ON public.club_billing_subscriptions
  FOR SELECT TO authenticated
  USING (public.fcp_is_superadmin());
