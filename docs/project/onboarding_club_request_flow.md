# Onboarding Club Request Flow
Stand: 2026-03-29

## Zweck
Diese Datei ist die technische Begleitspezifikation zum visuellen Flow in [onboarding_club_request_flow.drawio](/Users/michaellauenroth/Downloads/vdan-app-template/docs/project/onboarding_club_request_flow.drawio).

Sie dient als gemeinsame Referenz fuer:
- Produkt- und Prozessverstaendnis
- Implementierung im Frontend und Backend
- Verifikation bei Aenderungen
- einheitliche Arbeit mit mehreren KIs oder Engineers

## Source Of Truth
Fuer den Club-Request-Onboarding-Prozess gelten diese Artefakte gemeinsam:
- Visual Flow: [onboarding_club_request_flow.drawio](/Users/michaellauenroth/Downloads/vdan-app-template/docs/project/onboarding_club_request_flow.drawio)
- Technische Spezifikation: [onboarding_club_request_flow.md](/Users/michaellauenroth/Downloads/vdan-app-template/docs/project/onboarding_club_request_flow.md)
- Runtime-Code: [member-auth.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-auth.js), [club-request-submit/index.ts](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/functions/club-request-submit/index.ts), [club-request-decision/index.ts](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/functions/club-request-decision/index.ts), [member-guard.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-guard.js)

Wenn sich der Prozess aendert, muessen Drawio, diese Spezifikation und die betroffenen Codepfade gemeinsam aktualisiert werden.

## Prozessregeln
- `/registrieren/` ist nur der Split-Einstieg, keine Sammelmaske fuer beide Prozesse.
- `/vereinssignin/` ist der eigenstaendige Join-Flow fuer bestehende Vereine.
- `/verein-anfragen/` ist der eigenstaendige Request-Flow fuer neue Vereine.
- Der Club-Request erfasst `Vereinsname`, `PLZ`, `Ort`, `Anschrift`, verantwortliche Person und Kontaktdaten als eigene Pflichtfelder.
- QR-/Invite-Link transportiert `invite`, `club_id`, `club_code` und `club_name`, damit der Join-Flow ohne manuelles Nachtragen des Vereinskontexts startet.
- Im Join-Flow gibt der Nutzer nur Auth-E-Mail, Vereins-Mitgliedsnummer und Passwort ein; Invite-Token und Vereinskontext werden aus dem Link uebernommen.
- Der Join-Flow bindet einen Auth-User nur dann an ein Mitglied, wenn die Auth-E-Mail mit der im Verein gepflegten Mitglieds-E-Mail uebereinstimmt.
- Nach Mailbestaetigung folgt fuer neue Join-Claims ein expliziter First-Activation-Step auf `/app/zugang-pruefen/`.
- Die First-Activation-Pruefung verlangt Datenbestaetigung, E-Mail-Verifikation und eine verpflichtende SEPA-Bestaetigung im Vereinskontext.
- Die interne FCP-ID eines Mitglieds bleibt stabil; die vereinsseitige Alltagsnummer wird getrennt davon gepflegt.
- Der Club-Code im Format `AA00` ist global eindeutig, wird bei der Vereinsanlage vergeben und ist fuer Vereinsnutzer sichtbar, aber nicht editierbar.
- Legacy-Einstiege ueber `?mode=` oder `invite` duerfen nur weiterleiten, aber nicht wieder die alte Sammelmaskenlogik einfuehren.
- Ein User mit bestehender `admin`-/`vorstand`-Rolle in einem Verein darf keinen weiteren Club-Request ueber denselben Account starten.
- Ein User mit bereits offener Club-Anfrage darf keine zweite Pending-Anfrage parallel erzeugen.
- Solange eine Vereinsanfrage `status = pending` hat, gibt es keinen Portalzugang und keinen Club-Kontext.
- Die Mail-Logik ist Teil des Prozesses und kein optionaler Nachsatz.

## Traceability Matrix
| Step ID | Prozessschritt | Route / Einstieg | Frontend | Backend / Function | Daten / Status | Kommunikation | Erwartetes Ergebnis |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CR-00 | Start auf oeffentlicher FCP-Flaeche | oeffentliche Seiten, Header, Hero | [Site.astro](/Users/michaellauenroth/Downloads/vdan-app-template/src/layouts/Site.astro), [header-login-entry.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/header-login-entry.js) | - | - | - | Nutzer gelangt zu Login oder Club-Request-Einstieg |
| CR-01 | Login-Einstieg mit Links in beide Pfade | `/login/` | [login.astro](/Users/michaellauenroth/Downloads/vdan-app-template/src/pages/login.astro) | - | - | - | Nutzer sieht Login plus Links zu `/vereinssignin/` und `/verein-anfragen/` |
| CR-02 | Split-Einstieg | `/registrieren/` | [registrieren.astro](/Users/michaellauenroth/Downloads/vdan-app-template/src/pages/registrieren.astro) | - | Legacy-Querys werden umgelenkt | - | Nutzer waehlt bewusst zwischen Join-Flow und Club-Request-Flow |
| CR-03 | Legacy-Weiterleitung | `/registrieren/?mode=...`, `?invite=...` | [registrieren.astro](/Users/michaellauenroth/Downloads/vdan-app-template/src/pages/registrieren.astro), [header-login-entry.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/header-login-entry.js) | - | `mode=create_club` -> `/verein-anfragen/`, `mode=join_club` oder `invite` -> `/vereinssignin/` | - | Alte Links bleiben funktionsfaehig, ohne den neuen Split zu verletzen |
| CR-04 | Eigenstaendiger Join-Flow | `/vereinssignin/` | [vereinssignin.astro](/Users/michaellauenroth/Downloads/vdan-app-template/src/pages/vereinssignin.astro), [member-auth.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-auth.js) | Invite-Verify / Invite-Claim / First-Activation | Invite-Kontext aus QR/Link, Mitgliedsnummer, Auth-Daten | Auth-Mail im Join-Fall | Bestehender Vereinsbeitritt bleibt vom Club-Request getrennt und startet ohne manuelles Nachtragen des Vereinskontexts |
| CR-05 | Eigenstaendiger Club-Request-Flow | `/verein-anfragen/` | [verein-anfragen.astro](/Users/michaellauenroth/Downloads/vdan-app-template/src/pages/verein-anfragen.astro), [member-auth.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-auth.js) | `club-request-submit` | Club-Daten inkl. `PLZ` und `Ort`, verantwortliche Person, Rechtstexte | Auth- und Request-Mails | Neue Vereinsanfrage wird fachlich sauber erfasst und kann spaeter vollstaendig ins `club_meta` uebernommen werden |
| CR-05a | Vorab-Guard gegen Mehrfach-Gruendung | `/verein-anfragen/` | [member-auth.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-auth.js) | [club-request-submit/index.ts](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/functions/club-request-submit/index.ts) | bestehende `club_user_roles` / `user_roles` mit `admin` oder `vorstand`; offene Requests | Fehler statt Mail | Bestehende Vereinsadmins/-vorstaende erzeugen keine zweite Gruendung ueber denselben Account |
| CR-06 | Fastlane bei aktiver Session | `/verein-anfragen/` | [member-auth.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-auth.js) | [club-request-submit/index.ts](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/functions/club-request-submit/index.ts), [club-admin-setup/index.ts](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/functions/club-admin-setup/index.ts) | `auto_approve=true`, `status=approved`, `approved_club_id` gesetzt | Mail 3 | Club wird direkt aufgebaut, Rolle `admin` vergeben, Weiterleitung ins Portal |
| CR-07 | Pending-Pfad ohne aktive Session | `/verein-anfragen/` | [member-auth.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-auth.js) | [club-request-submit/index.ts](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/functions/club-request-submit/index.ts) | `registration_mode=club_request_pending`, `onboarding_path=club_request`, `status=pending` | Mail 1 und Mail 2 | Nutzer landet nach Verifikation im Pending-Zustand |
| CR-08 | Auth-Verifikation | `/auth/callback/` bzw. Auth-Session-Aufloesung | [member-auth.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-auth.js) | Supabase Auth | Account bestaetigt | Mail 1 | Verifizierte Identitaet fuer den Request vorhanden |
| CR-09 | Pending-Guard | geschuetzte `/app/`-Routen | [member-guard.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-guard.js) | State aus DB / Session | `status=pending` blockiert Portal | Mail 2 erklaert den Zustand | Nur `/app/anfrage-offen/` bleibt erreichbar |
| CR-10 | Pending-Statusseite | `/app/anfrage-offen/` | [src/pages/app/anfrage-offen/index.astro](/Users/michaellauenroth/Downloads/vdan-app-template/src/pages/app/anfrage-offen/index.astro), [club-request-pending.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/club-request-pending.js) | Request-Status lesen | `pending`, `approved` oder `rejected` | - | Nutzer versteht den aktuellen Bearbeitungsstand |
| CR-11 | Admin prueft Anfrage | Admin-Board | [admin-board.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/admin-board.js) | [club-request-decision/index.ts](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/functions/club-request-decision/index.ts) | Entscheidung ueber pending request | Mail 3 oder Mail 4 | Admin gibt frei oder lehnt ab |
| CR-12 | Freigabe | Admin-Freigabe oder Auto-Approve | [admin-board.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/admin-board.js) | [club-request-decision/index.ts](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/functions/club-request-decision/index.ts), [club-admin-setup/index.ts](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/functions/club-admin-setup/index.ts) | `approved_by`, `approved_at`, `approved_club_id`, Rolle `admin` | Mail 3 | Nutzer kann in den Vereinskontext wechseln |
| CR-13 | Ablehnung | Admin-Ablehnung | [admin-board.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/admin-board.js) | [club-request-decision/index.ts](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/functions/club-request-decision/index.ts) | `status=rejected`, `rejected_by`, `rejected_at`, optional `rejection_reason` | Mail 4 | Pending-Fall endet ohne Portalzugang |

## Mail-Matrix
| Mail | Trigger | Empfaenger | Implementierung | Zweck | Wirkung |
| --- | --- | --- | --- | --- | --- |
| Mail 1: E-Mail bestaetigen | `signUpWithPassword()`, nur ohne aktive Session | `requester_email` | Supabase Auth Flow, angestossen aus [member-auth.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-auth.js) | Auth-Identitaet bestaetigen | Club-Request darf danach sauber weiterlaufen |
| Mail 2: Vereinsanfrage eingegangen | `club-request-submit` mit `auto_approve=false` | `requester_email` | [sendClubRequestPendingMail()](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/functions/_shared/contact-utils.ts) | Eingang bestaetigen, Pending-Sperre erklaeren | Nutzer erwartet Statusseite statt Portalzugang |
| Mail 3: Vereinsanfrage freigegeben | Admin-Freigabe oder Fastlane `auto_approve=true` | `requester_email` | [sendClubRequestDecisionMail()](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/functions/_shared/contact-utils.ts) | Freigabe kommunizieren, Login-/Portal-Link liefern | Nutzer kann den Vereinskontext benutzen |
| Mail 4: Vereinsanfrage abgelehnt | Admin-Ablehnung | `requester_email` | [sendClubRequestDecisionMail()](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/functions/_shared/contact-utils.ts) | Ablehnung transparent machen, optional mit Grund | Kein Portalzugang, Fall fachlich abgeschlossen |

## Pflichtregeln fuer Aenderungen
Wenn eine KI oder ein Engineer diesen Prozess aendert, muss geprueft und aktualisiert werden:
1. Drawio-Flow
2. Diese Spezifikation
3. Betroffene Frontend-Dateien
4. Betroffene Edge Functions
5. Acceptance Checklist

Eine Aenderung gilt nicht als abgeschlossen, wenn nur Code angepasst wurde, aber Flow oder Spezifikation nicht mehr zur Laufzeit passen.

## Acceptance Checklist
### Routing und Einstieg
- `/registrieren/` zeigt nur die Wegwahl und keine Sammelmaske.
- `/vereinssignin/` ist fachlich vom Club-Request getrennt.
- `/verein-anfragen/` ist der alleinige Club-Request-Flow.
- `?mode=create_club`, `?mode=join_club` und `invite` fuehren nur per Redirect in die neuen Pfade.
- Der Club-Code ist in Vereinsmasken und Workspaces nur sichtbar, nicht bearbeitbar.

### Club-Request ohne aktive Session
- Auf `/verein-anfragen/` kann ein neuer Nutzer Auth-Daten und Vereinsdaten eingeben.
- `PLZ` und `Ort` sind eigene Pflichtfelder und werden nicht nur implizit aus Freitexten hergeleitet.
- Der Nutzer hat vorher keine bestehende `admin`-/`vorstand`-Rolle in einem anderen Verein.
- `signUpWithPassword()` wird ausgefuehrt.
- Mail 1 wird fachlich erwartet.
- Danach wird `club-request-submit(auto_approve=false)` ausgefuehrt.
- Request wird mit `status=pending` gespeichert.
- Mail 2 wird fachlich erwartet.
- Nutzer landet auf `/app/anfrage-offen/`.

### Club-Request mit aktiver Session
- Auf `/verein-anfragen/` mit aktiver Session greift die Fastlane.
- Der Nutzer hat vorher keine bestehende `admin`-/`vorstand`-Rolle in einem anderen Verein.
- `club-request-submit(auto_approve=true)` wird ausgefuehrt.
- Club-Aufbau wird ueber `club-admin-setup` angestossen.
- `PLZ` und `Ort` werden aus dem Request bis ins `club_meta` des freigegebenen Vereins uebernommen.
- Rolle `admin` wird vergeben.
- `approved_club_id` ist gesetzt.
- Mail 3 wird fachlich erwartet.
- Nutzer wird ins Portal weitergeleitet.

### Guard gegen Mehrfach-Gruendung
- Ein bereits club-gebundener `admin` oder `vorstand` darf keinen weiteren Club-Request ueber denselben Account starten.
- Eine bereits offene Club-Anfrage desselben Users blockiert eine zweite Anfrage.
- `club-request-submit` antwortet in diesen Faellen mit `409`.
- Der Flow darf dadurch keine zusaetzlichen `user_roles`-/`club_user_roles`-Altlasten mehr aufbauen.

### Pending Guard
- Solange `status=pending` ist, blockiert der Guard alle normalen `/app/`-Routen.
- `/app/anfrage-offen/` bleibt erreichbar.
- Pending-Seite zeigt den Status verstaendlich an.

### Vereinsbeitritt / Invite
- QR-/Link enthaelt `invite`, `club_id`, `club_code` und `club_name`.
- `/registrieren/` und Header-Invite-Einstiege verlieren diesen Kontext nicht beim Redirect nach `/vereinssignin/`.
- Die Join-Seite uebernimmt Invite- und Vereinskontext automatisch.
- Der Nutzer gibt nur Auth-E-Mail, Vereins-Mitgliedsnummer und Passwort ein.
- Der Vereinsbeitritt setzt einen bereits vorhandenen Mitgliedsdatensatz im Zielverein voraus.
- Die im Mitgliedsdatensatz gespeicherte E-Mail ist Pflicht fuer die spaetere Auth-Bindung.
- Der Invite-Claim wird abgewiesen, wenn keine Mitglieds-E-Mail gepflegt ist.
- Der Invite-Claim wird abgewiesen, wenn die Auth-E-Mail nicht mit der gespeicherten Mitglieds-E-Mail uebereinstimmt.
- Nach Mailverifikation folgt fuer neue Join-Claims zwingend `/app/zugang-pruefen/`.
- Die First-Activation-Pruefung verlangt eine explizite SEPA-Bestaetigung, bevor `must_verify_identity` aufgehoben wird.
- Die interne FCP-ID bleibt stabil; die vereinsseitige Mitgliedsnummer darf getrennt gepflegt werden.

### Admin-Entscheidung
- Admin kann eine offene Anfrage freigeben.
- Freigabe setzt `approved_by`, `approved_at`, `approved_club_id`.
- Freigabe loest Mail 3 aus.
- Admin kann eine offene Anfrage ablehnen.
- Ablehnung setzt `rejected_by`, `rejected_at`, optional `rejection_reason`.
- Ablehnung loest Mail 4 aus.

### Regressionen
- Der Join-Flow fuer bestehende Vereine bleibt unveraendert funktionsfaehig.
- Der Join-Flow bindet kein Mitglied an einen falschen Auth-User ueber eine abweichende E-Mail.
- Die Club-Request-Logik fuehrt nicht mehr zur alten Sammelmasken-UX zurueck.
- Login, Header-CTA und Hero-CTA fuehren in die richtigen Pfade.
- Derselbe Account kann nicht mehr still mehrere Admin-Clubs durch wiederholte Club-Requests aufbauen.

### Verifizierter Smoke-Test 2026-03-29
- End-to-end verifiziert auf `localhost` gegen das Remote-Projekt `peujhdrqnbvhllxpfavo`.
- Durchlauf erfolgreich: Verein anfragen -> Freigabe im Admin-Board -> Gruender/Admin im neuen Verein -> Mitglied anlegen -> Invite/QR erzeugen -> Mitglied registriert sich -> E-Mail-Verifikation -> Login im richtigen Vereinskontext mit korrekter Rolle.
- Dabei fachlich mitgeprueft: Club-Code bleibt fix, Gruender wird als echter Vereinsdatensatz angelegt, Invite-Join verlangt vorhandenes Mitglied und passende Mitglieds-E-Mail.
- P0-Ausbau danach umgesetzt: Invite-Link traegt den Vereinskontext vollstaendig, Join-Seite uebernimmt ihn automatisch, und First-Activation auf `/app/zugang-pruefen/` verlangt Datenabgleich plus SEPA-Bestaetigung.

## Empfohlene Arbeitsweise fuer KIs
Wenn eine KI an diesem Bereich arbeitet, sollte sie in dieser Reihenfolge vorgehen:
1. Drawio lesen
2. Diese Spezifikation lesen
3. Traceability Matrix gegen Code pruefen
4. Erst dann implementieren
5. Danach Acceptance Checklist abarbeiten

So wird verhindert, dass der Prozess nur “ungefaehr” bekannt ist oder implizit aus dem Code erraten wird.
