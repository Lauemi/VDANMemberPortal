# FCP UI/UX Audit Input

Stand: 2026-03-22
Zweck: Arbeitsdokument fuer UX-/Flow-Audit

## Nutzungshinweis

Dieses Dokument ist kein Doku-Text und kein Marketing-Text.

Es ist ein Arbeitsdokument fuer:

- Flow-Verstaendnis
- UI-Bewertung
- DOM-/CSS-Pruefung
- Erkennen echter UX-Probleme

Bitte:

- keine Romane
- keine Schoenschreibung
- keine Theorie ohne Bezug zur Maske

Sondern:

> So ist es.
> So fuehlt es sich an.
> Das sind die Bausteine.

---

## FLOW: [Name des Flows]

### Ziel

[Was soll der Nutzer in diesem Flow erreichen?]

### Rolle / Kontext

- Rolle:
- eingeloggt:
- Site-Mode:
- App-Theme:
- Startseite / URL:

### Ausgangssituation

- User ist:
- befindet sich auf:
- kommt von:
- hat welche Voraussetzungen:

### Erwartetes Verhalten (Soll)

1. [Schritt 1]
2. [Schritt 2]
3. [Schritt 3]
4. [Ergebnis]

### Tatsächliches Verhalten (Ist)

1. [Was passiert wirklich?]
2. [Welche Zwischenzustände gibt es?]
3. [Wo entstehen Umwege, Unklarheiten oder Brüche?]
4. [Was ist das reale Ergebnis?]

### Bekannte Probleme (aus Entwicklersicht)

- [z. B. zu viele Zustände in einer Maske]
- [z. B. UI wirkt überladen]
- [z. B. Reihenfolge falsch]
- [z. B. Desktop/Mobile nicht sauber getrennt]

### Screenshots

1. Startzustand
   Pfad/Datei:
   Kurzkommentar:
2. Nach erstem Klick
   Pfad/Datei:
   Kurzkommentar:
3. Eingabemaske
   Pfad/Datei:
   Kurzkommentar:
4. Zustand nach Speichern / Fehler / Erfolg
   Pfad/Datei:
   Kurzkommentar:

Hinweise:

- Desktop und Mobile getrennt auffuehren, wenn unterschiedlich
- Screenshots benennen und nummerieren
- Realzustand zeigen, nichts “schoen” machen

### Verwendete Komponenten

- Component:
- Component:
- Component:
- Component:

### Besonderheiten der Komponenten

- feste Hoehen:
- globale Spacing-Regeln:
- Design-System-Abhaengigkeiten:
- Sonderlogik / Conditional Rendering:

### Relevanter DOM-Ausschnitt

```html
<!-- Nur der relevante Ausschnitt der betroffenen Maske -->
<div class="example-flow-wrapper">
  <div class="example-input-group">
    <input />
  </div>
  <button class="example-button">Speichern</button>
</div>
```

### Relevante CSS-Regeln

```css
/* Nur die relevanten Layout-/Spacing-/Sizing-Regeln */
.example-button {
  height: 48px;
  padding: 0 16px;
}

.example-input-group input {
  height: 48px;
}

.example-flow-wrapper {
  display: grid;
  gap: 16px;
}
```

Fokus:

- Hoehen
- Abstaende
- Grid / Flex
- Containerbreiten
- mobile vs. desktop

### UI/UX Systemregeln aktuell

- Mindesthoehe:
- Grid-System:
- Touch-First ja/nein:
- Buttons & Inputs gleiche Hoehe:
- Zielgeraet / Bedienlogik:

### Bekannte Konflikte

- [z. B. Desktop wirkt zu aufgeblasen]
- [z. B. Inputs zu gross]
- [z. B. zu viel Weissraum]
- [z. B. mobile Regel stoert Desktop]

### Einschaetzung Entwickler

- Wo fuehlt es sich falsch an?
- Was ist technisch erzwungen?
- Wo ist es nur ein Kompromiss?
- Wo ist es eigentlich falsch, funktioniert aber noch?

### Nutzerfeedback

- Nutzer:
- Beobachtung:
- Irritation:
- Abbruch / Unsicherheit:

### Konkrete Fragen an den UX-/Flow-Audit

- [Ist der Einstieg falsch aufgebaut?]
- [Soll die Funktion eine eigene Maske bekommen?]
- [Sind die Komponenten zu gross fuer Desktop?]
- [Wie muessen Mobile und Desktop getrennt werden?]

---

## Weitere Flows

Die Struktur oben pro relevantem Flow wiederholen, zum Beispiel:

- Vereinsanlage
- Login / Portal-Einstieg
- Registrierung mit Invite
- Mitgliederverwaltung / Vereinsdaten
- Adminboard Runtime / Branding
- Onboarding-Workspace

---

## FLOW: Onboarding / Registrierung

### Ziel

Neuer Nutzer soll entweder:

- einem bestehenden Verein per Invite beitreten
- oder perspektivisch einen neuen Verein anlegen

### Rolle / Kontext

- Rolle: Gast / neuer Nutzer, teilweise auch Superadmin im Testkontext
- eingeloggt: nein oder Superadmin-Sonderfall
- Site-Mode: FCP
- App-Theme: aktuell oeffentliche FCP-Flaechen eher `fcp_brand`
- Startseite / URL: `/registrieren/`

### Ausgangssituation

- User kommt aus Login, Invite-Link, Header-CTA oder direkter Navigation
- die Strecke ist als ein einziger mehrphasiger Block aufgebaut
- Auth, Moduswahl, Vereinsbeitritt, Vereinsanlage und Rechtstexte liegen in einer Maske

### Erwartetes Verhalten (Soll)

1. Einstieg sofort klar
2. User versteht direkt, ob er:
   - beitritt
   - oder Verein anlegt
3. Nur relevante Felder sind sichtbar
4. Der Abschluss fuehlt sich wie ein klarer naechster Schritt an

### Tatsächliches Verhalten (Ist)

1. Die Maske beginnt mit einem grossen Onboarding-Block mit `COMING SOON`.
2. Danach folgen vier grosse Abschnitte direkt untereinander.
3. Join- und Create-Flow leben in derselben Gesamtmaske.
4. Der Create-Flow wirkt sichtbar, aber zugleich gesperrt und “nicht oeffentlich”.
5. Billing-Hinweis erscheint schon in dieser fruehen Phase.
6. Rechtliches und Aktionsleiste folgen erst ganz unten.

### Bekannte Probleme (aus Entwicklersicht)

- zu viele Zustände in einer einzigen Maske
- Join und Create konkurrieren visuell miteinander
- große vertikale Strecke
- Desktop wirkt aufgeblasen
- Hinweise, Vorschau, Billing und Security mischen sich zu früh in denselben Fluss
- Superadmin-Testfall und normaler Kundenfluss liegen sehr nah beieinander

### Screenshots

1. Startzustand
   Pfad/Datei: `/Users/michaellauenroth/Library/Mobile Documents/com~apple~CloudDocs/Registrieren • Fishing-Club-Portal · BETA.pdf`
   Kurzkommentar: großer einteiliger Formular-Flow
2. Nach Auswahl `Neuen Verein anlegen`
   Pfad/Datei: `/Users/michaellauenroth/Library/Mobile Documents/com~apple~CloudDocs/Registrieren • Fishing-Club-Portal · BETA.pdf`
   Kurzkommentar: zusätzlicher großer gesperrter Block
3. Eingabemaske
   Pfad/Datei: `/Users/michaellauenroth/Library/Mobile Documents/com~apple~CloudDocs/Registrieren • Fishing-Club-Portal · BETA.pdf`
   Kurzkommentar: viele Felder, Hinweise und Status in einem Durchlauf
4. Zustand nach Speichern / Fehler / Erfolg
   Pfad/Datei: noch ergänzen
   Kurzkommentar: noch gezielt dokumentieren

### Verwendete Komponenten

- globale `card`
- globale Formular-`label`/`input`/`textarea`/`select`
- `feed-btn`
- eigene Register-Section-Komponenten über CSS-Klassen:
  - `register-step`
  - `register-grid`
  - `register-mode-card`
  - `register-billing-preview`

### Besonderheiten der Komponenten

- große Step-Container mit `padding: 18px`
- große Rundungen `border-radius: 22px`
- Step-Index-Box mit `44px x 44px`
- Formularlayout meist 2-spaltig mit `gap: 14px`
- Gesamtflow mit vielen gestapelten Karten/Containern
- Ghost-Buttons und Primärbuttons stehen direkt nebeneinander

### Relevanter DOM-Ausschnitt

```html
<section class="card register-flow-card" style="max-width:920px;margin:0 auto;">
  <div class="card__body register-flow">
    <div class="register-flow__intro">...</div>
    <div class="register-flow__baseline small">...</div>
    <form id="registerForm" class="register-flow__form">
      <section class="register-step register-step--auth">...</section>
      <section class="register-step register-step--mode">...</section>
      <section id="registerJoinSection" class="register-step">...</section>
      <section id="registerCreateSection" class="register-step hidden" hidden>...</section>
      <section class="register-step register-step--legal">...</section>
      <div class="register-flow__actions">...</div>
    </form>
  </div>
</section>
```

### Relevante CSS-Regeln

```css
.register-flow {
  display: grid;
  gap: 18px;
}

.register-flow__form {
  display: grid;
  gap: 16px;
}

.register-step {
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 22px;
}

.register-grid,
.register-mode-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.register-mode-card {
  padding: 16px 18px;
  border-radius: 18px;
}

input:not([type="checkbox"]):not([type="radio"]),
textarea,
select,
.feed-btn {
  min-height: var(--control-height) / var(--lib-btn-height);
}
```

### UI/UX Systemregeln aktuell

- Controls haben globale Mindesthöhe
- Buttons und Inputs sind visuell auf dieselbe Systemlogik gebracht
- großzügige Container-Abstände
- mobile Anpassung kippt erst unter `760px` auf eine Spalte
- Touch-first wirkt deutlich mit in den Größen

### Bekannte Konflikte

- Desktop wirkt zu groß und zu lang
- Abstände addieren sich: Card -> Step -> Grid -> Label -> Input
- `COMING SOON`, Security-Baseline, Preview-Hinweis, Billing-Hinweis und Legal erzeugen kognitive Last
- der Flow fühlt sich eher wie eine technische Sammelmaske als wie eine geführte Strecke an

### Einschaetzung Entwickler

- Der eigentliche UX-Konflikt ist weniger “falsches Theme” als “zu viele Ebenen in einer einzigen Maske”.
- Die Größen und Abstände sind für mobile/touch robust, wirken auf Desktop aber schnell zu aufgeblasen.
- Besonders problematisch ist, dass der Nutzer gleichzeitig Auth, Moduswahl, Vereinsprozess und rechtlichen Abschluss sieht.
- Der Create-Club-Teil ist sichtbar genug, um Aufmerksamkeit zu ziehen, aber nicht frei genug, um als echter Flow zu funktionieren.

### Nutzerfeedback

- Noch strukturiert ergänzen
- Bisherige Beobachtung aus Tests:
  - Einstieg nicht sofort klar
  - die Strecke wirkt vorbereitet statt geführt
  - Billing / Vorschau / Locked-State wirken früh und schwer
- Referenzmaske:
  - `/Users/michaellauenroth/Library/Mobile Documents/com~apple~CloudDocs/Registrieren • Fishing-Club-Portal · BETA.pdf`

### Konkrete Fragen an den UX-/Flow-Audit

- Soll Join und Create komplett getrennt werden?
- Sollte `Neuen Verein anlegen` eine eigene Strecke bekommen?
- Ist die Reihenfolge Auth -> Modus -> Vereinsprozess -> Rechtliches richtig?
- Sind Abstände, Step-Größen und Card-Paddings für Desktop zu groß?
- Muss Desktop optisch dichter werden als Mobile?

---

## FLOW: Auth / Login

### Ziel

Bestehender Nutzer soll sich schnell und ohne Reibung ins Portal einloggen.

### Rolle / Kontext

- Rolle: Mitglied / Admin / Vereinsnutzer
- eingeloggt: nein
- Site-Mode:
  - FCP: `fcp`
  - VDAN: `vdan`
- App-Theme:
  - Fallback laut Deploy
- Startseite / URL: `/login/`

### Ausgangssituation

- User kommt direkt auf `/login/`
- je nach Site-Mode wird der Text unterschiedlich dargestellt
- VDAN zeigt zusätzliche Legacy-Hinweise

### Erwartetes Verhalten (Soll)

1. Login-Feld sehen
2. Passwort eingeben
3. Klick auf Login
4. Weiterleitung ins Ziel

### Tatsächliches Verhalten (Ist)

1. Eine einzelne Login-Card mit relativ einfacher Struktur wird angezeigt.
2. Bei VDAN kommt ein deutlicher Warn-/Legacy-Hinweisblock vor dem eigentlichen Flow.
3. Das Formular enthält Identifier, Passwort und eine Aktionszeile.
4. Zusätzlich werden Links zu Passwort-Reset, Registrierung und Mitglied werden angezeigt.

### Bekannte Probleme (aus Entwicklersicht)

- die Login-Strecke ist technisch einfacher als Registrierung, aber textlich je nach Mode nicht ganz ruhig
- VDAN enthält viel Übergangs-/Migrationskommunikation direkt im Login
- Button-/Input-Größen folgen dem globalen System und können auf Desktop relativ groß wirken

### Screenshots

1. Startzustand
   Pfad/Datei: noch ergänzen
   Kurzkommentar: einfache Login-Card
2. Zustand mit Fehlermeldung
   Pfad/Datei: noch ergänzen
   Kurzkommentar: noch ergänzen
3. Zustand nach erfolgreichem Login
   Pfad/Datei: noch ergänzen
   Kurzkommentar: Weiterleitung, kein eigener Success-Screen

### Verwendete Komponenten

- globale `card`
- Standard-`label` / `input`
- `button.primary`
- `feed-btn feed-btn--ghost`
- kleine Textlinks unterhalb des Formulars

### Besonderheiten der Komponenten

- Card auf `max-width: 520px`
- Formular ist simpel, aber alle Controls nutzen globale Mindesthöhen
- Primärbutton und Ghostbutton stehen direkt in einer flexiblen Zeile
- Textblöcke unterhalb konkurrieren leicht mit der primären Login-Aktion

### Relevanter DOM-Ausschnitt

```html
<section class="card" style="max-width:520px;margin:0 auto;">
  <div class="card__body">
    <h1>Login</h1>
    <form id="loginForm" data-next-target="/">
      <label>...</label>
      <label>...</label>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button class="primary" type="submit">Einloggen</button>
        <button class="feed-btn feed-btn--ghost" type="button" disabled>Coming soon</button>
        <span id="loginMsg" class="small"></span>
      </div>
    </form>
  </div>
</section>
```

### Relevante CSS-Regeln

```css
input:not([type="checkbox"]):not([type="radio"]),
button,
textarea,
select {
  min-height: var(--control-height);
}

button.primary,
.feed-btn {
  min-height: var(--lib-btn-height);
  padding: 0 var(--lib-btn-pad-x);
}

label {
  display: grid;
  gap: var(--space-1);
}
```

### UI/UX Systemregeln aktuell

- Controls folgen globalem Mindesthöhen-System
- Buttons und Inputs sollen systemisch konsistent sein
- kleine Card, aber relativ großzügige Komponentenlogik
- FCP und VDAN teilen sich im Kern dieselbe Login-Maske

### Bekannte Konflikte

- VDAN-Migrationshinweise können den eigentlichen Login visuell dominieren
- “Coming soon”-Button in der Aktionszeile kann unnötig Aufmerksamkeit ziehen
- die Login-Aktion selbst ist klarer als die Registrierung, aber nicht maximal reduziert

### Einschaetzung Entwickler

- Login ist funktional deutlich ruhiger als Registrierung.
- Das Hauptthema ist hier weniger der Flow als die Textlast und die Größe des generischen Control-Systems.
- Für ein wirklich präzises UX-Tuning müsste geprüft werden, ob:
  - Textblöcke reduziert werden
  - Legacy-Hinweise ausgelagert werden
  - Aktionszeile klarer priorisiert wird

### Nutzerfeedback

- Noch ergänzen
- erwartbare Frage:
  - was ist die primäre Aktion
  - warum steht dort `Coming soon`
  - warum so viel Kontexttext vor/nach dem Login

### Konkrete Fragen an den UX-/Flow-Audit

- Ist die Login-Maske auf Desktop zu groß oder noch passend?
- Soll der `Coming soon`-Button raus?
- Sollen VDAN-Migrationshinweise aus dem primären Loginbereich ausgelagert werden?
- Ist die globale Mindesthöhe für Controls auf Desktop zu stark?

---

## FLOW: Vereins-Setup / Vereins-Board

### Ziel

Admin oder Superadmin soll einen Verein anlegen, auswählen, fortsetzen und Vereinsdaten pflegen können.

### Rolle / Kontext

- Rolle: Admin / Superadmin
- eingeloggt: ja
- Site-Mode: FCP
- App-Theme: Portal-/App-Kontext
- Startseite / URL: `/app/vereine/` bzw. angrenzender Setup-Kontext

### Ausgangssituation

- User befindet sich bereits im geschützten Bereich
- Vereinsanlage, Setup-Fortschritt, technische Stati und Folgeaktionen liegen nahe beieinander

### Erwartetes Verhalten (Soll)

1. Verein wählen oder neu anlegen
2. klaren nächsten Schritt sehen
3. Vereinsdaten pflegen
4. Setup nachvollziehbar abschließen

### Tatsächliches Verhalten (Ist)

1. Der Bereich zeigt nicht nur Produktfluss, sondern auch viel Systemzustand.
2. Setup, Stati, Invite, Reload und Folgeaktionen konkurrieren.
3. Die Oberfläche wirkt eher wie ein Mischbereich aus Produkt, Admin und Debug.

### Bekannte Probleme (aus Entwicklersicht)

- unklare Hauptaktion
- Systemsprache und Produktsprache liegen zu nah beieinander
- zu viele Dinge sind gleichzeitig wichtig
- Statusdarstellung ist nicht stark priorisiert

### Screenshots

1. Startzustand / Vereins-Setup
   Pfad/Datei: `/Users/michaellauenroth/Library/Mobile Documents/com~apple~CloudDocs/Vereins-Setup • Fishing-Club-Portal · BETA.pdf`
   Kurzkommentar: Setup-Maske mit mehreren Verantwortlichkeiten gleichzeitig sichtbar
2. Weitere Zustände
   Pfad/Datei: noch ergänzen
   Kurzkommentar: noch gezielt dokumentieren

### Verwendete Komponenten

- Board-/Card-Container
- Vereinsdaten- / Status- / Folgeaktionsblöcke
- Setup-Status und Invite-/Reload-Aktionen
- technische Zustandsanzeigen im gleichen Screen

### Besonderheiten der Komponenten

- Produkt- und Systeminformationen erscheinen im selben Bereich
- hoher Informationsmix
- Fokus auf nächste Aktion ist visuell nicht durchgehend klar

### Nutzerfeedback

- Referenzmaske:
  - `/Users/michaellauenroth/Library/Mobile Documents/com~apple~CloudDocs/Vereins-Setup • Fishing-Club-Portal · BETA.pdf`

### Konkrete Fragen an den UX-/Flow-Audit

- Muss Vereins-Setup klarer in Produkt-Flow und Debug-/Systemsicht getrennt werden?
- Welche Aktion ist die sichtbare Hauptaktion?
- Wie viel Statussprache darf in der primären Produktoberfläche sichtbar sein?

---

## Abschluss

Wenn dieses Dokument befuellt ist, soll danach beantwortbar sein:

- Was fuehlt sich im Flow falsch an?
- Was ist ein Layoutproblem, was ein Flowproblem?
- Welche Komponente stoert?
- Was muss getrennt werden?
- Was muss vereinfacht werden?
- Was ist nur Theme und was ist echte UX?
