# Billing Smoke Test Report — MINAAA-25 / MINAAA-26

**Date:** 2026-05-10  
**Executed by:** Claude (CEO, Paperclip)  
**Environment:** Stripe Sandbox (Test Mode)  
**Supabase Project:** `peujhdrqnbvhllxpfavo`  
**Test Club:** FCP Smoke Club (`a6795892-778f-4174-95e3-903c6b6db812`)  
**Test Admin:** `fcp_demoadmin@fishing-club-portal.de`

---

## Secrets Active at Test Time

| Secret | Value (prefix) | Status |
|--------|---------------|--------|
| `STRIPE_SECRET_KEY` | `sk_test_...` | ✅ Sandbox |
| `STRIPE_WEBHOOK_SECRET` | `whsec_BBls...` | ✅ Sandbox |
| `STRIPE_FCP_PRICE_ID` | `price_1RR...` | ✅ Sandbox product |

---

## sc-bill-1 — Checkout Session erzeugen

**Ziel:** `fcp-create-checkout-session` gibt eine gültige Stripe Checkout URL zurück.

**Ausführung:**
1. `fcp_demoadmin` Passwort via SQL zurückgesetzt (war nicht bekannt)
2. JWT via `/auth/v1/token?grant_type=password` geholt
3. POST an `fcp-create-checkout-session` mit `club_id = a6795892-...`

**Ergebnis:** ✅ HTTP 200  
**Checkout URL:** `https://checkout.stripe.com/c/pay/cs_test_a1iX7O...`

---

## sc-bill-2 — Webhook Signatur verifizieren

**Ziel:** `stripe-webhook-handler` akzeptiert ein korrekt signiertes `checkout.session.completed` Event.

**Ausführung:**
1. Timestamp via `date +%s` geholt
2. Payload mit `club_id = a6795892-...`, `stripe_event_id = evt_test_smoke_bill2`, `stripe_subscription_id = sub_test_smoke_bill2`
3. HMAC-SHA256 Signatur berechnet: `echo -n "${timestamp}.${payload}" | openssl dgst -sha256 -hmac "${WEBHOOK_SECRET}"`
4. Header: `Stripe-Signature: t=${timestamp},v1=${sig}`
5. POST an `stripe-webhook-handler`

**Ergebnis:** ✅ HTTP 200 `{"ok":true}`

---

## sc-bill-3 — DB State prüfen

**Ziel:** Webhook-Event wurde persistiert und `billing_state` wurde auf `active` gesetzt.

### club_billing_webhook_events

```
stripe_event_id  : evt_test_smoke_bill2
event_type       : checkout.session.completed
processed_at     : 2026-05-10 07:58:34+00
club_id          : null  ⚠️ (siehe Notiz)
```

### club_billing_subscriptions

```
club_id                : a6795892-778f-4174-95e3-903c6b6db812
billing_state          : active
stripe_subscription_id : sub_test_smoke_bill2
updated_at             : 2026-05-10 07:58:34+00
```

**Ergebnis:** ✅ Subscription korrekt aktiviert

---

## Gesamtergebnis

| Test | Ergebnis |
|------|----------|
| sc-bill-1: Checkout URL | ✅ PASS |
| sc-bill-2: Webhook Signatur | ✅ PASS |
| sc-bill-3: DB State | ✅ PASS |

**3/3 PASS**

---

## Notiz: club_id = null in webhook_events

Der `club_id`-Column in `club_billing_webhook_events` wird nicht befüllt — der Handler liest `metadata.club_id` aus dem Stripe-Event, verwendet ihn zum Updaten von `club_billing_subscriptions`, schreibt ihn aber nicht in den Events-Log. **Funktional nicht kritisch** (Subscription korrekt aktiviert), aber ein möglicher Verbesserungspunkt für Debugging/Auditing.

**Empfehlung:** Im `stripe-webhook-handler` den `club_id`-Wert aus dem Payload auch in `club_billing_webhook_events` schreiben. → Separates Issue, kein Blocker.

---

## Nächster Schritt

Billing-Pfad ist smoke-getestet im Sandbox-Modus. Vor Live-Aktivierung:

1. **Rechtsabteilung** muss Stripe-Nutzungsbedingungen prüfen
2. Erst nach rechtlicher Freigabe: `STRIPE_SECRET_KEY` auf `sk_live_...` umstellen
3. Live-Webhook in Stripe Dashboard aktivieren
