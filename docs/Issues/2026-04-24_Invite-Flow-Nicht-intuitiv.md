# Invite-Flow ist technisch funktionsfähig, aber für eingeladene Nutzer nicht intuitiv genug

## Kontext

Dieses Issue betrifft den Invite-Flow im Repository `Lauemi/VDANMemberPortal`.

Fachlicher Kontext laut aktuellem Stand:

- **FCP** steht für das Fishing Club Portal. Es ist die zentrale Plattformlogik für Vereinsverwaltung, Mitgliederzugang, Authentifizierung, Rollen, Prozesse und produktbezogene Portalabläufe.
- **VDAN** ist der konkrete Vereins-/Verbandskontext mit eigener öffentlicher Präsenz, eigenem Deploy und eigener Domainlogik, nutzt aber weiterhin die zentrale FCP-Plattformlogik.
- Der Invite-Flow dient dazu, eingeladene Personen kontrolliert in den passenden Vereins-/Verbandskontext zu führen und den Beitritt bzw. die Zuordnung zum Verein/Verband auszulösen.

Wichtig: Der VDAN-Kontext darf für eingeladene Nutzer nicht wie ein anonymer generischer Signup wirken. Die Person muss sofort verstehen, wer sie eingeladen hat, welchem Verein/Verband sie beitritt und warum sie die angezeigten Felder ausfüllen soll.

## Ist-Zustand

Technisch bestätigt laut aktuellem Teststand:

- Der Invite-Link konnte geöffnet werden.
- Die eingeladene Person hat die erwarteten Felder gesehen.
- Der Invite-Flow scheint grundsätzlich zu funktionieren.

UX-seitig problematisch beobachtet:

- Die eingeladene Person hatte keine klare Orientierung, warum sie auf dieser Maske ist.
- Es war nicht ausreichend klar, wozu die angezeigten Felder ausgefüllt werden sollen.
- Der Vereins-/VDAN-Kontext war für die eingeladene Person nicht ausreichend selbsterklärend.
- Mobil wurde der Button `Verein beitreten` nicht wahrgenommen, weil er erst nach Scrollen sichtbar wurde.

Damit liegt das Problem nicht primär in einem kaputten technischen Flow, sondern in fehlender Nutzerführung, unzureichender Einordnung und zu geringer Sichtbarkeit der Hauptaktion auf mobilen Geräten.

## Problem

Der Invite-Flow erfüllt seine technische Aufgabe, führt eingeladene Nutzer aber nicht sicher genug durch den Prozess.

Eine eingeladene Person kommt typischerweise nicht mit Systemwissen in den Flow. Sie weiß nicht automatisch:

- was FCP ist,
- warum VDAN/FCP beteiligt ist,
- wer sie eingeladen hat,
- ob der Link vertrauenswürdig ist,
- was mit ihren Eingaben passiert,
- welcher nächste Schritt erwartet wird.

Wenn diese Orientierung fehlt, wirkt der Flow wie eine isolierte Formularmaske. Das reduziert Vertrauen, Verständnis und Abschlusswahrscheinlichkeit.

## Beobachtete Symptome

- Keine sofort erkennbare Einordnung oberhalb der Felder.
- Unklarer Zweck der Maske für eingeladene Nutzer.
- Fehlender oder zu schwacher Vereins-/VDAN-Kontext.
- Unklare Nutzerführung vom Invite-Link zur Hauptaktion.
- Haupt-CTA `Verein beitreten` mobil nicht ohne Scrollen sichtbar.
- Abschlussaktion hängt mobil zu stark von Scrollverhalten ab.
- Eingeladene Person sieht Felder, versteht aber nicht ausreichend, warum sie diese ausfüllen soll.
- Der Flow erklärt zu wenig den Unterschied zwischen technischer Plattform und Vereinskontext.

## Warum das problematisch ist

### Verständnis

Ein Invite-Flow muss ohne Vorkenntnisse funktionieren. Eingeladene Personen dürfen nicht erst aus dem Umfeld erklärt bekommen müssen, was sie tun sollen.

### Vertrauen

Gerade bei Vereins-/Mitgliedsdaten muss sofort erkennbar sein, in welchem Kontext die Dateneingabe erfolgt. Eine anonyme Formularwirkung senkt Vertrauen.

### Conversion / Abschluss

Wenn der nächste Schritt nicht sichtbar oder nicht verstanden wird, steigt die Wahrscheinlichkeit, dass eingeladene Nutzer abbrechen oder Rückfragen stellen.

### Mobile Nutzbarkeit

Wenn die Hauptaktion auf mobilen Geräten erst nach Scrollen sichtbar ist, kann der Flow trotz technischer Funktion praktisch scheitern. Mobile Nutzung muss als Primärfall betrachtet werden.

## Besonderheiten VDAN / Vereinskontext

Der VDAN-Invite ist nicht wie ein generischer Plattform-Signup zu behandeln.

VDAN hat eine besondere Rolle:

- VDAN ist der konkrete Vereins-/Verbandskontext.
- VDAN besitzt eine eigene öffentliche Präsenz und eine eigene Außenwirkung.
- Die technische Prozesslogik bleibt Teil der FCP-Plattform.
- Die eingeladene Person erlebt den Vorgang aber nicht als technische Plattformintegration, sondern als Einladung in einen konkreten Vereins-/Verbandskontext.

Daraus folgt:

- Der Flow muss den Verein/Verband sichtbar machen.
- Die Maske muss erklären, warum FCP/VDAN in diesem Prozess auftaucht.
- Der Nutzer muss verstehen, dass er nicht „irgendein Konto“ anlegt, sondern einer konkreten Vereins-/Verbandsstruktur beitritt bzw. dort zugeordnet wird.
- Invite, Claim, Auth und Verifikation dürfen technisch zentral bleiben, müssen aber für den Nutzer klar in den VDAN-Kontext übersetzt werden.

## Verbesserungsvorschläge

Priorität 1 – Orientierung oberhalb der Felder:

- Klare Headline einführen, z. B. `Einladung zum VDAN-Mitgliederportal` oder kontextabhängig `Einladung zu [Verein/Verband]`.
- Direkt darunter 1–2 kurze Sätze, die erklären:
  - wer eingeladen hat,
  - welchem Verein/Verband die Person beitritt,
  - warum die Angaben benötigt werden,
  - was nach dem Absenden passiert.

Priorität 2 – Mobile CTA-Sichtbarkeit:

- Prüfen, ob der Button `Verein beitreten` mobil ohne Scrollen sichtbar oder deutlich früher erreichbar gemacht werden kann.
- Alternativ eine klare visuelle Führung zur Hauptaktion einbauen.
- CTA-Bereich mobil so gewichten, dass der Nutzer nicht zufällig am Abschluss vorbeigeht.

Priorität 3 – Vertrauensaufbau durch Vereinskontext:

- Sichtbaren VDAN-/Vereinsbezug oberhalb oder im Kopfbereich der Maske darstellen.
- Keine anonyme Formularwirkung erzeugen.
- Optional: kurzer Hinweis, dass die technische Abwicklung über das Fishing Club Portal erfolgt.

Priorität 4 – Flow-Verständlichkeit:

- Felder nicht isoliert anzeigen, sondern als Teil eines nachvollziehbaren Beitritts-/Bestätigungsprozesses rahmen.
- Prüfen, ob Zwischentexte, Microcopy oder Abschnittstitel nötig sind.
- Klare Abschlusslogik kommunizieren: Was passiert nach `Verein beitreten`?

Priorität 5 – Sichtprüfung integrieren:

- Ergebnisse der Claude-Cowork-Sichtprüfung als separaten Befundblock ergänzen.
- Befunde trennen nach:
  - visuelle Befunde,
  - mobile Befunde,
  - CTA-/Scroll-Befunde.

## Akzeptanzkriterien

Das Issue gilt als gelöst, wenn:

- Eine eingeladene Person direkt oberhalb der Felder versteht, in welchem Kontext sie sich befindet.
- Der Verein-/VDAN-Bezug auf der Invite-Maske klar sichtbar ist.
- Die Maske erklärt, warum die Person Angaben machen soll.
- Der nächste Schritt eindeutig erkennbar ist.
- Der Button `Verein beitreten` mobil sichtbar, früher erreichbar oder durch klare Führung zuverlässig auffindbar ist.
- Die Hauptaktion nicht mehr zufällig durch Scrolltiefe übersehen wird.
- Die Seite nicht wie ein anonymer Signup wirkt.
- Der Flow weiterhin die zentrale FCP-Logik nutzt und nicht in eine VDAN-Sonderlogik abdriftet.
- Die Umsetzung ohne blindes Redesign erfolgt und sich auf Orientierung, Führung, Vertrauen und CTA-Sichtbarkeit konzentriert.

## Noch zu integrieren: Claude-Cowork-Sichtprüfung

Die geplante Sichtprüfung der Maske durch Claude Cowork soll nachgereicht und strukturiert ergänzt werden.

Erwartete Ergänzungsstruktur:

### Visuelle Befunde

- Wird nach Sichtprüfung ergänzt.

### Mobile-Befunde

- Wird nach Sichtprüfung ergänzt.

### CTA-/Scroll-Befunde

- Wird nach Sichtprüfung ergänzt.

## Offene Fragen / zu prüfen

- Welcher konkrete Repo-Pfad enthält die Invite-Maske bzw. den Invite-Entry?
- Welche Route ist der reale Einstiegspunkt für den Invite-Link?
- Wird der einladende Verein/Verband technisch bereits im Payload oder Invite-Kontext mitgeliefert?
- Kann die Maske dynamisch Vereinsname, Logo oder Kontext anzeigen?
- Ist der CTA mobil aktuell unterhalb des initial sichtbaren Bereichs auf typischen Smartphonegrößen?
- Gibt es bereits bestehende FCP-/VDAN-Copytexte, die wiederverwendet werden sollen?
- Muss der Flow für VDAN anders formuliert werden als für spätere generische FCP-Vereine?

## Nicht-Ziel

Dieses Issue soll keinen neuen Invite-Flow erfinden.

Nicht Ziel ist:

- komplette technische Neuarchitektur,
- blindes Redesign,
- neue Auth-Logik,
- VDAN-Fork der zentralen FCP-Prozesse,
- rein optische Kosmetik ohne bessere Nutzerführung.

Ziel ist eine verständlichere, mobil bessere und vertrauenswürdigere Invite-Maske bei weiterhin zentraler FCP-Prozesslogik.
