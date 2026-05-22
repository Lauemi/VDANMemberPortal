-- Migration: billing upgrade tracking
-- Fügt Felder für Mid-Year-Upgrade-Nachverfolgung hinzu.
-- Additive only — keine bestehenden Spalten oder Daten verändert.
--
-- last_upgrade_at: Zeitstempel des letzten manuellen Mid-Year-Upgrades
-- upgrade_count:   Zähler wie oft der Verein im laufenden Vertrag upgegrenzt hat
--                  (Audit-Zweck, kein Blocking)

ALTER TABLE public.club_billing_subscriptions
  ADD COLUMN IF NOT EXISTS last_upgrade_at timestamptz,
  ADD COLUMN IF NOT EXISTS upgrade_count    integer NOT NULL DEFAULT 0;
