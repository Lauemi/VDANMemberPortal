## Definition of Done pro Onboarding-Abschnitt

### 1. Konto / Benutzeranlage

Abgeschlossen, wenn:
- Auth-User existiert
- `profiles`-Datensatz existiert
- `member_no` vorhanden oder bewusst serverseitig auto-generiert
- Pflichtbasis fuer Anzeige ist vorhanden

### 2. Invite-Einloesung

Abgeschlossen, wenn:
- Invite final validiert wurde
- `club_member_identities` gesetzt ist
- `user_roles.member` vorhanden ist
- `club_user_roles.member` vorhanden ist
- Invite-Nutzung korrekt verbucht wurde

### 3. Club-Anlage

Abgeschlossen, wenn:
- Club-Code reserviert ist
- Club-Name gespeichert ist
- Kernrollen `member`, `vorstand`, `admin` existieren
- Creator die noetigen Rollen besitzt
- Grundkonfiguration fuer Module angelegt ist

### 4. Stammdaten-Setup

Pflicht:
- Club-Name
- eindeutiger Club-Code
- mindestens eine belastbare Basisbeschreibung des Vereins

Optional:
- weiterfuehrende Metadaten

Abgeschlossen, wenn:
- Pflichtfelder valide gespeichert sind
- keine blocking Validierungsfehler offen sind

### 5. Gewaesser-Setup

Pflicht:
- mindestens ein aktives Gewaesser

Optional:
- weiterfuehrende Details, Klassifikationen, Zusatzdaten

Abgeschlossen, wenn:
- mindestens ein fachlich nutzbares Gewaesser vorhanden ist

### 6. Angelkarten-Setup

Pflicht:
- mindestens eine nutzbare Standardkartenregel oder Default-Karte

Optional:
- differenzierte Matrix fuer mehrere Mitgliedsarten

Abgeschlossen, wenn:
- fuer den Grundbetrieb eine eindeutige Kartenlogik vorhanden ist

### 7. Mitgliederimport

Pflicht:
- Mitgliederbasis vorhanden oder bewusst als initial leer bestaetigt

Optional:
- Vollstaendige Bereinigung aller Importwarnungen vor Billing

Abgeschlossen, wenn:
- Import erfolgreich war oder leerer Start explizit bestaetigt wurde
- Fehlerhafte Zeilen reportet wurden
- keine stillen Dubletten offen sind

### 8. Billing / Aktivierung

Abgeschlossen, wenn:
- Setup-Pflichtpunkte erfuellt sind
- Checkout gestartet werden konnte
- verifizierter Stripe-Webhook den Club aktiviert hat

### 9. Portal produktiv

Abgeschlossen, wenn:
- Club-State `ACTIVE`
- Kernmodule erreichbar
- Rollen greifen korrekt
- kein Cross-Club-Leak vorliegt
- Audit- und Fehlerpfade dokumentiert sind

## Delivery-Checkliste

- Login-State pruefen
- Invite sicher pruefen
- Invite idempotent einloesen
- Club-Setup sauber auf Bestand mappen
- Multi-Club-Auswahl erzwingen
- CSV-Import mit Teilfehlern pruefen
- Stripe nur per Webhook aktivieren
- Session-Verhalten bei Suspendierung pruefen
- RLS fuer relevante Tabellen aktiv und plausibilisiert
- keine globale Manager-Policy ohne Club-Kontext
- UI zeigt Fortschritt, Pflicht, Fehler und Blocking transparent
- Audit-Log-Ereignisse festgelegt
- Re-Checkout und Webhook-Dedupe vorgesehen
