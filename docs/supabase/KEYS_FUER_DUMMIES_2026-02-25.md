# Keys für Dummies (VDAN)

Stand: 2026-02-25

Ziel: Du siehst auf einen Blick, **welcher Key was macht**, **wo er hingehört**, **woher**Security-Baseline Check (aktueller Stand)**  
mit deinem Hinweis: `Staging/Prod-Trennung` ist bewusst später geplant.

1. `Identität & Zugriffskontrolle`: **teilweise erfüllt**  
- Erfüllt: Auth + Rollenmodell + serverseitige RLS-Prüfungen in vielen Bereichen.  
- Offen: konsistente End-to-End-Prüfung aller neuen Module/Functions.

2. `Tenant-Isolation`: **nicht erfüllt**  
- Erfüllt: aktuell Single-Tenant stabil.  
- Offen: keine durchgängige `tenant_id`-Erzwingung auf allen Tabellen/Policies.

3. `Rollen- und Rechte-Durchsetzung`: **teilweise erfüllt**  
- Erfüllt: Admin/Vorstand-Checks, RLS-Policies vorhanden.  
- Offen: systemweite Review für kritische Aktionen (Delete/Role/Finance) als finaler Audit.

4. `Structural Ownership Separation`: **teilweise erfüllt**  
- Erfüllt: klare technische Trennung Code vs. Daten in der Struktur.  
- Offen: formal dokumentierter Betreiber-/Owner-Layer im Betriebskonzept.

5. `Tenant Settings & Routing`: **teilweise erfüllt (Single-Tenant-Modus)**  
- Erfüllt: User-/Portal-Settings vorhanden.  
- Offen: echtes tenant-basiertes Routing/Resolver + tenant-spezifische settings.

6. `Datenschutz & Datenminimierung`: **teilweise erfüllt**  
- Erfüllt: Verschlüsselungspfad für sensible Daten, Exportpfade vorhanden.  
- Offen: dokumentierte Löschfristen/Retention und vollständige Datenminimierungsprüfung.

7. `Cookies & Tracking`: **teilweise erfüllt**  
- Erfüllt: Consent-Mechanik vorhanden.  
- Offen: finaler Nachweis Drittanbieter/Tracking-Matrix vollständig.

8. `Caching & CDN-Sicherheit`: **teilweise erfüllt**  
- Erfüllt: PWA/Caching kontrolliert verbessert.  
- Offen: formale Prüfung „keine personenbezogenen Daten im Shared Cache“.

9. `Externe Dienste & API-Kontrolle`: **teilweise erfüllt**  
- Erfüllt: Secrets nicht im Client, Provider-Nutzung vorhanden.  
- Offen: dokumentierte Fallbacks/Rate-Limits für alle externen Dienste komplettieren.

10. `Deployment & Umgebungstrennung`: **geplant / aktuell ausgenommen**  
- Von dir bewusst nach dem großen Update vorgesehen.

11. `Backup & Recovery`: **offen (nicht verifiziert)**  
- Braucht expliziten Restore-Test + dokumentierten Prozess.

12. `Auditierbarkeit`: **teilweise erfüllt**  
- Erfüllt: mehrere Audit-/Tracking-Tabellen/Felder vorhanden.  
- Offen: vollständige Audit-Matrix pro kritischer Aktion.

13. `Finanzmodul`: **teilweise erfüllt / abhängig von Aktivierung**  
- Erfüllt: Ansatz mit Risiko-Begrenzung und ohne unnötige Live-Banking-Komplexität.  
- Offen: finale Haftungs-/Prozessdoku bei produktiver Aktivierung.

**Kurzfazit:**  
- Für euren aktuellen Single-Tenant-Produktstand: **brauchbar, aber nicht baseline-vollständig**.  
- Größte Lücke ist klar: **echte Tenant-Isolation** + **operativer Nachweis (Backup/Restore/Audit-Matrix)**. du ihn bekommst** und **wie lang/format er sein muss**.

Wichtig: `PUBLIC_*` ist für Browser sichtbar. Alles ohne `PUBLIC_` ist geheim.

## SQL-Dateien, die du am Ende ausführen musst (Reihenfolge)

1. `docs/supabase/43_user_settings_portal_quick.sql`
2. `docs/supabase/45_membership_security_patch.sql`
3. `docs/supabase/46_push_subscriptions.sql`
4. `docs/supabase/47_security_invoker_views_patch.sql`

Hinweis:
- `docs/supabase/44_set_encryption_key_example.sql` ist nur ein Beispiel und wird **nicht** direkt mit echtem Secret genutzt.
- Die echte Membership-Verschlüsselung setzt ihr über `45_membership_security_patch.sql` + Eintrag in `public.app_secure_settings`.

---

## 1) Supabase Basis-Keys

### `PUBLIC_SUPABASE_URL`
- Zweck: URL deiner Supabase Instanz für Frontend-API-Aufrufe.
- Sichtbarkeit: öffentlich (ok).
- Wo setzen: GitHub/Vercel/Netlify Frontend Env oder `.env` lokal.
- Wo finden: Supabase Dashboard -> Project Settings -> API -> `Project URL`.
- Format: `https://<project-ref>.supabase.co`
- Länge: keine feste Mindestlänge.

### `PUBLIC_SUPABASE_ANON_KEY`
- Zweck: öffentlicher API Key für Frontend (RLS schützt Daten).
- Sichtbarkeit: öffentlich (ok).
- Wo setzen: Frontend Env (`.env`, GitHub Deploy Env).
- Wo finden: Supabase Dashboard -> Project Settings -> API -> `anon public`.
- Format: JWT-ähnlicher langer String.
- Länge: vorgegeben von Supabase.

### `SUPABASE_SERVICE_ROLE_KEY`
- Zweck: Server/Function-Adminzugriff (umgeht RLS). Nur Backend!
- Sichtbarkeit: **geheim**.
- Wo setzen: Supabase Edge Function Secrets (oder sicherer Backend Secret Store), **nicht** Frontend.
- Wo finden: Supabase Dashboard -> Project Settings -> API -> `service_role`.
- Format: JWT-ähnlicher langer String.
- Länge: vorgegeben von Supabase.

---

## 2) Push-Notification Keys (PWA)

### `PUBLIC_VAPID_PUBLIC_KEY`
- Zweck: Browser-Push-Subscription im Frontend.
- Sichtbarkeit: öffentlich (ok).
- Wo setzen: Frontend Env.
- Woher: aus deinem VAPID Keypair (Public Teil).
- Format: Base64URL String.
- Länge: typischerweise ~87 Zeichen.

### `VAPID_PUBLIC_KEY`
- Zweck: Public Teil für den Push-Versand auf Server-Seite.
- Sichtbarkeit: kann öffentlich sein, wird aber meist als Secret mitverwaltet.
- Wo setzen: Supabase Function Secret.
- Woher: gleiches Keypair wie `PUBLIC_VAPID_PUBLIC_KEY`.
- Format/Länge: wie oben.

### `VAPID_PRIVATE_KEY`
- Zweck: Signiert Push-Nachrichten (kritisch).
- Sichtbarkeit: **geheim**.
- Wo setzen: Supabase Function Secret.
- Woher: VAPID Keypair erzeugen (z. B. Web Push CLI/Tooling).
- Format: Base64URL String.
- Länge: typischerweise ~43 Zeichen.

### `VAPID_SUBJECT`
- Zweck: Absender-Kontakt für WebPush-Standard.
- Sichtbarkeit: unkritisch, aber serverseitig führen.
- Wo setzen: Supabase Function Secret.
- Woher: selbst festlegen.
- Format: `mailto:admin@deinedomain.de` oder `https://deinedomain.de`

### `PUSH_NOTIFY_TOKEN` (optional)
- Zweck: technischer Schutz für Deploy/CI Trigger der Push-Function.
- Sichtbarkeit: **geheim**.
- Wo setzen: Supabase Function Secret + ggf. GitHub Action Secret.
- Woher: selbst erzeugen (zufällig).
- Mindestlänge: mindestens 32 Zeichen empfohlen.

---

## 3) Membership/Antrag Verschlüsselung

### `membership_encryption_key` (DB-Wert in `app_secure_settings`)
- Zweck: verschlüsselt sensible Daten (z. B. IBAN) im Membership-Prozess.
- Sichtbarkeit: **geheim**.
- Wo setzen: per SQL in Supabase DB Tabelle `public.app_secure_settings` (nicht Frontend).
- Woher: selbst erzeugen (stark zufällig).
- Mindestlänge: **mindestens 16**, empfohlen **32+** Zeichen.
- Wichtig: Kein Klartext wie IBAN/Passwort-Muster verwenden.

---

## 4) Weitere Projekt-Keys

### `PUBLIC_TURNSTILE_SITE_KEY`
- Zweck: Client-Seite von Cloudflare Turnstile (Spam/Bot Schutz).
- Sichtbarkeit: öffentlich (ok).
- Wo setzen: Frontend Env.
- Wo finden: Cloudflare Turnstile Dashboard -> Site Key.
- Format: String von Cloudflare.

### `TURNSTILE_SECRET_KEY` (falls verwendet)
- Zweck: Server-Validierung des Turnstile Tokens.
- Sichtbarkeit: **geheim**.
- Wo setzen: Supabase Function Secret / Backend Secret Store.
- Wo finden: Cloudflare Turnstile Dashboard -> Secret Key.

### `PUBLIC_MEMBER_CARD_VERIFY_PUBKEY`
- Zweck: öffentlicher Schlüssel zur Ausweis-/Token-Prüfung im Client.
- Sichtbarkeit: öffentlich (ok).
- Wo setzen: Frontend Env.
- Woher: aus deinem Signatur-Keypair (Public Key als PEM).
- Format: PEM, z. B. `-----BEGIN PUBLIC KEY----- ...`.

---

## 5) Wo gehört was hin? (Kurz)

### Frontend (`.env`, Hosting Env)
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_VAPID_PUBLIC_KEY`
- `PUBLIC_TURNSTILE_SITE_KEY`
- `PUBLIC_MEMBER_CARD_VERIFY_PUBKEY`

### Supabase Function Secrets
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `PUSH_NOTIFY_TOKEN` (optional)
- ggf. `TURNSTILE_SECRET_KEY`

### Supabase Datenbank (SQL)
- `membership_encryption_key` in `public.app_secure_settings`

### GitHub Secrets (nur falls CI/CD es braucht)
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- ggf. `PUSH_NOTIFY_TOKEN`
- ggf. Deploy-spezifische Env-Werte

---

## 6) Sicherheitsregeln (wichtig)

1. Niemals `SERVICE_ROLE`, `VAPID_PRIVATE_KEY`, `membership_encryption_key` in Git committen.
2. `.env` nur lokal, nie ins Repo.
3. Beispiel-Dateien (`.env.example`, SQL Beispiele) ohne echte Secrets halten.
4. Bei Leak: Key sofort rotieren (neu erzeugen, alt ungültig machen).

---

## 7) Schnelltest nach Setzen der Keys

1. Login + Einstellungen öffnen -> keine Konfigurationsfehler.
2. Push aktivieren -> Subscription wird gespeichert.
3. Membership Testantrag -> kein Encryption-Fehler.
4. Scanner auf HTTPS -> Kamera startet.

---

## 8) Typische Fehler und Ursache

### Fehler: `PUBLIC_TURNSTILE_SITE_KEY fehlt`
- Ursache: Frontend Env nicht gesetzt.

### Fehler: `Encryption key missing`
- Ursache: `membership_encryption_key` nicht in DB gesetzt oder zu kurz.

### Fehler: Push kommt nicht an
- Ursache: `PUBLIC_VAPID_PUBLIC_KEY` passt nicht zu Server `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` oder keine Subscription.

### Fehler: `permission denied to set parameter app.settings.encryption_key`
- Ursache: DB-Parameter in Supabase nicht erlaubt -> stattdessen `app_secure_settings` verwenden (ist bei euch bereits vorgesehen).

Vorlage SQL/Secrets: docs/supabase/48_keys_setup_template.sql

---

## 9) Copy/Paste Befehle (idiotensicher)

### 9.1 Eigene Secrets generieren (lokal im Terminal)

```bash
# A) membership_encryption_key (DB)
openssl rand -hex 32

# B) optional PUSH_NOTIFY_TOKEN (Function Secret)
openssl rand -hex 32
```

### 9.2 VAPID Keypair erzeugen (für Push)

```bash
npx web-push generate-vapid-keys
```

Ergebnis:
- `publicKey` -> für `VAPID_PUBLIC_KEY` und `PUBLIC_VAPID_PUBLIC_KEY`
- `privateKey` -> für `VAPID_PRIVATE_KEY`

### 9.3 DB-Key setzen (Supabase SQL Editor)

```sql
insert into public.app_secure_settings (setting_key, setting_value)
values ('membership_encryption_key', 'HIER_DEIN_OPENSSL_HEX_32')
on conflict (setting_key) do update
set setting_value = excluded.setting_value,
    updated_at = now();
```

Prüfen:

```sql
select setting_key, length(setting_value) as len, updated_at
from public.app_secure_settings
where setting_key = 'membership_encryption_key';
```

### 9.4 Supabase Function Secrets setzen (Terminal)

```bash
npx supabase secrets set \
  SUPABASE_URL="https://PROJECT_REF.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="SERVICE_ROLE_KEY_AUS_SUPABASE_DASHBOARD" \
  VAPID_PUBLIC_KEY="VAPID_PUBLIC_KEY_AUS_WEB_PUSH" \
  VAPID_PRIVATE_KEY="VAPID_PRIVATE_KEY_AUS_WEB_PUSH" \
  VAPID_SUBJECT="mailto:admin@deine-domain.de" \
  PUSH_NOTIFY_TOKEN="OPTIONAL_OPENSSL_HEX_32" \
  --project-ref "PROJECT_REF"
```

### 9.5 Frontend ENV setzen (Hosting oder `.env`)

```env
PUBLIC_SUPABASE_URL="https://PROJECT_REF.supabase.co"
PUBLIC_SUPABASE_ANON_KEY="ANON_KEY_AUS_SUPABASE_DASHBOARD"
PUBLIC_VAPID_PUBLIC_KEY="VAPID_PUBLIC_KEY_AUS_WEB_PUSH"
PUBLIC_TURNSTILE_SITE_KEY="SITE_KEY_AUS_CLOUDFLARE"
PUBLIC_MEMBER_CARD_VERIFY_PUBKEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

### 9.6 Wo kommt welcher Wert her?

- `SUPABASE_URL`: Supabase Dashboard -> API -> Project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Dashboard -> API -> service_role
- `PUBLIC_SUPABASE_ANON_KEY`: Supabase Dashboard -> API -> anon
- `PUBLIC_TURNSTILE_SITE_KEY`: Cloudflare Turnstile -> Site Key
- `PUBLIC_MEMBER_CARD_VERIFY_PUBKEY`: euer bestehender Public-Key (PEM)

### 9.7 Schnellcheck nach allem

1. `/app/einstellungen/` lädt ohne Key-Fehler.
2. Membership-Testantrag wirft keinen Encryption-Fehler.
3. Push aktivieren möglich.
4. Push-Testversand liefert `ok=true`.

---

## 10) Key-Format Beispiele (so soll es aussehen)

### `membership_encryption_key` (DB, eigener Secret)
- Gültig (Beispiel): `8f2c7d1b9a4e6f308c1d2e3f4a5b6c7d`
- Ebenfalls gültig: `Yt4mN8qP2sK7vB5xR1wC9zL6hD3fJ0pQ`
- Ungültig: `12345678` (zu kurz)

### `SUPABASE_URL`
- Gültig (Beispiel): `https://abcxyzcompany.supabase.co`
- Ungültig: `abcxyzcompany.supabase.co` (ohne `https://`)

### `SUPABASE_SERVICE_ROLE_KEY`
- Gültig: langer JWT-String aus Supabase Dashboard (3 Teile mit Punkten)
- Beispiel-Form: `eyJhbGciOi...<lang>...XVCJ9`
- Ungültig: selbst erfundener kurzer String

### `PUBLIC_SUPABASE_ANON_KEY`
- Gültig: langer JWT-String aus Supabase Dashboard
- Beispiel-Form: `eyJhbGciOi...<lang>...XVCJ9`

### `VAPID_PUBLIC_KEY`
- Gültig (Beispiel-Form): `BOrxY3k...sehr-lang...9wQ`
- Typ: Base64URL-ähnlich, meist ~87 Zeichen
- Muss aus `npx web-push generate-vapid-keys` kommen

### `VAPID_PRIVATE_KEY`
- Gültig (Beispiel-Form): `z9vK2m...lang...QpE`
- Typ: Base64URL-ähnlich, meist ~43 Zeichen
- Muss zum Public Key passen (gleiches VAPID-Keypair)

### `PUBLIC_VAPID_PUBLIC_KEY`
- Muss exakt gleich sein wie `VAPID_PUBLIC_KEY`

### `VAPID_SUBJECT`
- Gültig (Beispiel): `mailto:admin@deine-domain.de`
- Alternativ: `https://deine-domain.de`

### `PUSH_NOTIFY_TOKEN` (optional)
- Gültig (Beispiel): `b3c9f2e1a6d4c8b7f0e2a9d5c1b4e8f7`
- Empfehlung: mindestens 32 Zeichen, zufällig

### `PUBLIC_TURNSTILE_SITE_KEY`
- Gültig: Schlüssel aus Cloudflare Turnstile Dashboard
- Beispiel-Form: `0x4AAAAAAABBBBCCCCDDDD`

### `PUBLIC_MEMBER_CARD_VERIFY_PUBKEY`
- Gültig: PEM Public Key Block
- Beispiel:
```text
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...
-----END PUBLIC KEY-----
```
