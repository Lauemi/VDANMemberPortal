/**
 * FCP Billing-Konfiguration — zentrale Quelle der Wahrheit
 *
 * Preismodell (Stand: 2026-05-10-v1, AGB §5):
 *   2,00 EUR netto pro aktivem Mitglied pro Jahr
 *   Abrechnung jährlich im Voraus
 *
 * Billing-Units-Logik:
 *   Stripe rechnet in ganzen Units ab. Eine Unit = 1 Mitglied.
 *   Mindestabnahme: FCP_BILLING_MIN_UNITS (aktuell 50 = 100 € netto/Jahr Minimum)
 *   Rundung:        auf FCP_BILLING_STEP_UNITS (aktuell 50) aufgerundet
 *
 *   Beispiele:
 *     1–50  Mitglieder →  50 Units (100,00 € netto)
 *    51–100 Mitglieder → 100 Units (200,00 € netto)
 *   101–150 Mitglieder → 150 Units (300,00 € netto)
 *
 * ⚠️  Review-Punkt für Michael vor erstem echtem Checkout:
 *   - Sind 50 Units Minimum und 50er-Schritte noch das gewollte Modell?
 *   - Entspricht STRIPE_FCP_PRICE_ID dem 2,00 €/Unit/Jahr-Price in Stripe?
 */

/** Mindestanzahl abzurechnender Einheiten */
export const FCP_BILLING_MIN_UNITS = 50;

/** Abrechnungsschritte (Rundung nach oben) */
export const FCP_BILLING_STEP_UNITS = 50;

/**
 * Berechnet die abzurechnenden Billing-Units aus der Mitgliederzahl.
 * Rundet auf den nächsten Vielfachen von FCP_BILLING_STEP_UNITS auf,
 * mindestens FCP_BILLING_MIN_UNITS.
 */
export function getBillingUnits(memberCount: number): number {
  return Math.max(
    FCP_BILLING_MIN_UNITS,
    Math.ceil(memberCount / FCP_BILLING_STEP_UNITS) * FCP_BILLING_STEP_UNITS,
  );
}
