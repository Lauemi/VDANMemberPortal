Security ist verpflichtend.

- alle Queries club-scoped
- RLS aktiv
- Invite abgesichert
- Stripe nur Webhook
- Rollen serverseitig
- Logging vorhanden

Fail-safe:
- im Zweifel verweigern

## Operative Security-Baseline

### 1. Ownership und Club-Scoping

- Jede Mutation muss einen expliziten Club-Bezug haben oder bewusst global sein.
- Club-bezogene Mutationen duerfen nur mit serverseitig gepruefter Rolle ausgefuehrt werden.
- `club_id` darf nie nur aus dem Frontend uebernommen werden, ohne serverseitige Gegenpruefung.
- Helfer wie `is_admin_in_club()` und `is_admin_or_vorstand_in_club()` sind verbindlich fuer Manager-Operationen.

### 2. RLS und Zugriff

- Relevante Tabellen muessen RLS aktiviert haben.
- `profiles` duerfen nur fuer den eigenen User oder administrative Spezialfaelle lesbar/bearbeitbar sein.
- `club_member_identities` darf nur fuer Self oder Admin im Club lesbar sein.
- `club_user_roles`, `club_roles`, `club_module_usecases` und fachliche Club-Daten muessen club-scoped geschuetzt bleiben.
- Keine globale Manager-Policy ohne Club-Kontext.

### 3. Invite-Schutz

- Invite-Tokens werden nie im Klartext persistiert, sondern als SHA-256-Hash in `app_secure_settings`.
- Invite-Records muessen mindestens enthalten:
  - `status`
  - `club_id`
  - `expires_at`
  - `max_uses`
  - `used_count`
  - `used_user_ids`
- Invite-Validierung ist read-only.
- Invite-Verbrauch ist eine eigene, geschuetzte Mutation.
- Wiederholte Claims desselben Users duerfen den Zaehler nicht erneut erhoehen.

### 4. Replay- und Double-Submit-Schutz

- `club-invite-claim` muss idempotent bleiben.
- Vor jeder Neuanlage wird geprueft:
  - existiert bereits `club_member_identities` fuer `(club_id, user_id)`?
  - existiert bereits `club_member_identities` fuer `(club_id, member_no)`?
  - existiert bereits die Rollenvergabe?
- Stripe-Webhooks muessen eventbasiert dedupliziert werden.
- Frontend darf Wiederholungen ausloesen, Backend muss diese sicher abfangen.

### 5. Audit-Log-Mindestumfang

Mindestens zu protokollieren:
- Invite erstellt
- Invite widerrufen
- Invite erfolgreich eingelost
- Club angelegt
- Club-Setup abgeschlossen
- Billing-Checkout gestartet
- Billing aktiviert
- Billing suspendiert
- Membership blockiert oder reaktiviert
- CSV-Import gestartet und beendet

### 6. Rate Limiting

Rate Limiting ist Pflicht fuer:
- Invite-Validierung
- Invite-Claim
- Login-nahe Bootstrap-Endpunkte
- Billing-bezogene Admin-Endpunkte
- CSV-Import

### 7. Session-Verhalten bei Club-Suspendierung

- Eine aktive Session bleibt technisch moeglich, aber club-bezogene Schreib- und Kernleserechte muessen sofort restriktiv werden.
- Der User darf nicht weiterarbeiten, als waere der Club aktiv.
- UI zeigt klar `SUSPENDED`, Backend bleibt Quelle der Wahrheit.

### 8. Billing-Webhook-Verifikation

- Stripe-Signaturpruefung ist Pflicht.
- Nur whitelisted Eventtypen duerfen Status aendern.
- Jeder Webhook muss eindeutig einem Club zuordenbar sein.
- Ohne verifizierte Clubzuordnung kein Zustandswechsel.
- Doppelte oder verspätete Events muessen folgenlos oder kontrolliert verarbeitbar sein.
