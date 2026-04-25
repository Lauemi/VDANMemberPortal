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

---

# Claude-Cowork Sichtprüfung – 2026-04-24

> Quelle: Claude-Cowork Sichtprüfung der Invite-Maske.  
> Einordnung: echte visuelle/UX-seitige Cowork-Analyse, ergänzend zum ursprünglichen Produkt-Issue.  
> Abgrenzung: Diese Analyse beschreibt Wahrnehmung, Nutzerführung, mobile Sichtbarkeit und QFM-/Inline-Data-Table-Designabgleich. Technische Tiefenprüfung, Codepfade, CSS-Regeln und konkrete Implementierungsdetails bleiben separater Paperclip-/Executor-Scope.

## 1. Kurzfazit

Die Invite-Maske liefert technisch alle nötigen Informationen, versagt aber als Orientierungsmaske für externe Nutzer ohne Systemkenntnis. Die Headline `VDAN Ottenheim beitreten` erscheint direkt im Formular-Container ohne jede erklärende Rahmung – sie benennt das Ziel, erklärt aber weder Herkunft noch Zweck der Einladung. Die Subzeile `Mit Einladung fortfahren` ist zu abstrakt, um echte Orientierung zu geben. Der Formularaufbau ist technisch korrekt, aber nicht als geführter Beitrittsprozess inszeniert: Die Felder erscheinen ohne erzählerischen Rahmen und ohne Verständlichmachung ihrer Bedeutung. Der Abschnittstitel `Dein Zugang` ist visuell schwach und fachlich nicht selbsterklärend. Der CTA `Jetzt beitreten` ist auf Desktop akzeptabel positioniert, auf Mobile aber erst nach erheblichem Scrollen erreichbar und wird zusätzlich durch das Home-Icon-Widget überlagert. Gemessen an der Qualität des Portal-Containerdesigns und der Inline-Data-Table-Logik fällt die Invite-Maske gestalterisch merklich zurück.

## 2. Was optisch bereits gut ist

- **Farbgebung und Container:** Der helle Leinwand-Container auf dunkelgrünem Hintergrund entspricht der Portal-Grundoptik und wirkt ruhig. Der Gesamtkontrast ist gut.
- **Feldgrößen Desktop:** Die Eingabefelder auf Desktop sind breit, gut klickbar und nicht zu gedrängt. Die abgerundeten Ecken passen zum System.
- **Vereinsname in Headline:** `VDAN Ottenheim` erscheint direkt in der h1 – der Verein ist zumindest namentlich sichtbar.
- **Bestätigungsbox `Du trittst dem Verein VDAN Ottenheim bei.`:** Das visuelle Abheben dieser Info durch eine leicht dunklere Box ist eine gute Idee – sie hebt Kontext aus der Formularmasse heraus.
- **CTA-Button auf Desktop:** `Jetzt beitreten` ist in Portal-Grün gehalten, gut proportioniert und visuell deutlich als Aktion erkennbar.
- **Einladungs-Token im DOM verborgen:** Der technische Token ist sichtbar gesetzt (pre-filled), ohne den Nutzer damit zu belasten. Das ist sauber gelöst.
- **Checkbox-Zeile:** Nutzungsbedingungen und Datenschutz sind deutlich verlinkt, kein Dark Pattern erkennbar.

## 3. Warum die Maske nicht intuitiv genug ist

- **Kein einleitender Kontext vor dem Formular:** Die Maske beginnt sofort mit Feldern. Wer eingeladen hat, warum dieser Link existiert, was hier passiert – all das fehlt. Ein externer Nutzer landet auf einem Formular ohne Briefing.
- **Headline benennt Ziel, erklärt nicht Situation:** `VDAN Ottenheim beitreten` klingt wie eine Aufforderung, nicht wie eine Einladungsbestätigung. Es fehlt: `Du wurdest eingeladen von [Einladender/Vorstand].`
- **Subzeile `Mit Einladung fortfahren` ist zu technisch-abstrakt:** Diese Zeile liest sich wie ein System-State, nicht wie eine menschliche Ansprache. Sie gibt keine Antwort auf `warum bin ich hier?`.
- **Abschnittstitel `Dein Zugang` ist visuell kaum wahrnehmbar:** Er ist in einem sehr hellen, kaum kontrastierenden Ton gehalten und geht optisch fast unter. Als Strukturierungselement erfüllt er seine Aufgabe nicht.
- **Kein erklärender Text vor den Eingabefeldern:** Warum soll ich eine E-Mail und ein Passwort eingeben? Ist das ein neuer Account? Wofür? Diese Fragen bleiben unbeantwortet. Der Nutzer ist allein mit leeren Feldern.
- **Die zwei Abschnitte (Zugang / Vereinsbeitritt) sind nicht als Prozessschritte kommuniziert:** Dass zuerst ein Account angelegt und dann der Vereinsbeitritt vollzogen wird, ist dem Layout nicht abzulesen. Es wirkt wie eine unzusammenhängende Feldsammlung.
- **Die Bestätigungsbox `Du trittst dem Verein VDAN Ottenheim bei.` erscheint zu spät:** Sie kommt erst nach der Passwort-Eingabe. Der Kontext des Beitritts sollte ganz oben stehen, nicht mittendrin.
- **Kein Hinweis auf FCP als technische Plattform:** Ein externer Nutzer, der über einen VDAN-Link kommt, sieht ein FCP-Logo. Das erzeugt Dissonanz: `Warte – ich trete VDAN bei, aber die Seite gehört FCP?` Dieser Widerspruch wird nicht aufgelöst.
- **Fehlende Microcopy beim Mitgliedsnummer-Feld:** Es ist unklar, ob die Mitgliedsnummer Pflicht ist, woher man sie bezieht oder ob sie optional ist. Kein Hilfstext, kein Placeholder mit Beispiel.

## 4. QFM- und Inline-Data-Table-Designabgleich

### Was zur bestehenden Portal-/QFM-Optik passt

- Der Leinwand-Container mit abgerundeten Ecken ist konsistent mit dem Portalgefühl.
- Die Farbpalette (warmes Beige/Leinwand, dunkles Grün, weiße Felder) ist stimmig.
- Der CTA-Button ist in der Portal-Farbe gehalten und wirkt nicht fremdartig.
- Die Feldform (große, runde Inputs) ist typkonsistent mit anderen Portal-Masken.

### Was im Vergleich zur Inline-Data-Table-Optik schwächer wirkt

- Die Inline-Data-Table hat eine ausgeprägte **Hierarchielogik**: klare Sektions-Header, deutliche Inhaltsgruppierung, saubere Trennung zwischen Informationsebenen. Die Invite-Maske arbeitet mit einem schwachen, visuell kaum sichtbaren Abschnittstitel (`Dein Zugang`) und einer optisch untergeordneten Box als einzigem Kontext-Element. Das ist deutlich flacher.
- Die Inline-Data-Table erzeugt **visuelle Ruhe durch Weißraum und klare Containergrenzen**. Die Invite-Maske hat eine Lücke zwischen dem Zugangs-Abschnitt und der Beitritts-Box, die nicht wie bewusster Weißraum wirkt, sondern wie ein Layout-Unfall.
- Die Inline-Data-Table hat eine **klare Aktionslogik**: Aktionen sind eindeutig platziert, priorisiert und in sauberem Verhältnis zum Inhalt. Die Invite-Maske hat den CTA am Ende einer langen Feldliste ohne visuelle Führung dorthin.
- Die **Feld-/Inhaltsgruppierung** der Inline-Data-Table ist explizit: Jede Gruppe hat einen klaren Zweck und eine sichtbare Abgrenzung. Auf der Invite-Maske sind E-Mail + Passwort + Passwort-wiederholen + Mitgliedsnummer + Checkbox + Button eine einzige visuelle Masse ohne erkennbare Binnenstruktur.

### Welche Designqualität aus der Inline-Data-Table als Referenz übernommen werden sollte

- Die konsequente **Abschnitts-Hierarchie**: Section-Header mit Gewicht, Sub-Labels mit Zurückhaltung.
- Die **Containerlogik für Informations-Chunks**: Kontext-Information in einer eigenen Karte oben, Eingaben in einem klar abgegrenzten Formularblock, Aktion als eigenständiges Element unten.
- Die **visuelle Klarheit der Aktion**: In der Inline-Data-Table weiß der Nutzer immer, was die Hauptaktion des aktuellen Kontexts ist. Das fehlt der Invite-Maske komplett.

## 5. Mobile Befunde

- **Was man ohne Scrollen sieht (Mobile, 375px):** Die große Headline `VDAN Ottenheim beitreten` (dreizellig wegen Zeilenumbrüchen), die Subzeile, den Abschnittstitel `Dein Zugang` und das E-Mail-Feld. Der Nutzer sieht sofort ein Formular, aber weder Kontext noch Ziel noch CTA.
- **Der Headline-Zeilenumbruch auf Mobile wirkt ungesteuert:** `VDAN / Ottenheim / beitreten` über drei Zeilen erzeugt einen Wucht-Eindruck, der nicht der Situation entspricht. Es fehlt eine mobile-optimierte Formulierung oder ein Breakpoint.
- **Die Bestätigungs-Box `Du trittst dem Verein VDAN Ottenheim bei.` ist auf Mobile abgeschnitten:** Der Text bricht mitten im Satz ab und ist erst nach Scrollen vollständig lesbar.
- **Der CTA `Jetzt beitreten` ist auf Mobile erst nach ca. 3–4 Scroll-Schritten erreichbar** – das wurde bereits im Issue dokumentiert und ist visuell bestätigt. Der Nutzer sieht am Anfang keinerlei Hinweis, dass es überhaupt einen Button gibt.
- **Das schwebende Home-Icon-Widget überlagert auf Mobile den unteren Bereich**, einschließlich partiell des CTA-Buttons. Das Timing, wann dieses Widget erscheint, ist unkritisch, aber die Überlagerung des CTA ist ein klares UX-Problem.
- **Kein visueller Scroll-Anker oder Fortschrittsindikator:** Auf Mobile fehlt jeder Hinweis, dass unterhalb des sichtbaren Bereichs noch etwas Wichtiges folgt.
- **Einhändige Bedienbarkeit eingeschränkt:** Die Felder sind einzeln gut tippbar, aber der Abschluss-Button liegt weit außerhalb des einhändig erreichbaren Bereichs (Daumenzone unten Mitte), was die Abschlusswahrscheinlichkeit senkt.
- **Die Abschnittstrenner und Leerräume zwischen Zugang und Beitrittsbereich wirken auf Mobile wie ein technischer Fehler** (zu viel ungenutzter Raum), nicht wie bewusste Führung.

## 6. CTA-Befunde

- **Name des CTAs korrekt:** `Jetzt beitreten` ist präziser als ein generisches `Absenden` – das ist gut.
- **Optik des Buttons ist akzeptabel:** Dunkelgrün, lesbar, nicht zu klein auf Desktop.
- **Fehlende Ankündigung:** Bevor der Nutzer den Button sieht, hat er keine Vorstellung, was das Absenden des Formulars auslöst. Es fehlt Microcopy wie: `Nach dem Absenden wirst du als Mitglied im Portal angelegt und erhältst eine Bestätigungs-E-Mail.`
- **Kein visueller Funnel zum CTA:** Auf Desktop ist der Abstand zwischen Checkbox und Button zu offen – es gibt keine Führungsrichtung, die den Blick nach unten zieht.
- **Auf Mobile ist der CTA im initialen Viewport komplett unsichtbar** und es gibt keinerlei visuellen Fingerzeig (kein `Weiter →`, kein Fortschrittsbalken, kein sichtbares Ende des Formulars).
- **Das Home-Widget überlagert mobil partiell den CTA** – ein Nutzer, der endlich nach unten gescrollt hat, findet den Button möglicherweise halb verdeckt.
- **Checkbox direkt über CTA ohne Abstand:** Die AGB-Checkbox klebt optisch fast am Button. Das lässt den CTA-Bereich unruhig wirken und verwässert die Hauptaktion visuell.
- **Kein Fehler- oder Erfolgszustand sichtbar:** Es ist unklar, was passiert, wenn der Button gedrückt wird – kein Hinweis auf Ladevorgang, Weiterleitung oder Fehlerfall. Das senkt das Vertrauen.

## 7. Logo-/Header-Befunde

- **Das FCP-Logo ist auf Desktop zu dominant für eine Invite-Maske:** Das Logo mit Wels-Illustration nimmt visuell viel Platz ein und überragt die Formular-Card. Für einen eingeladenen Nutzer, der nicht weiß, was FCP ist, erzeugt das Verwirrung statt Vertrauen.
- **Das Logo-Tier läuft auf Mobile über den Formular-Container:** Im mobilen Screenshot ist der Fisch-Kopf der Logo-Grafik teilweise über dem Formular sichtbar. Das wirkt unfertig und lenkt ab.
- **Die Klickfläche des Logos ist groß:** Da das Logo ein Link zur Startseite ist und die gesamte Logo-Region (inkl. Fisch-Illustration) klickbar wirkt, besteht die reale Gefahr, dass ein mobiler Nutzer beim Tippen in Richtung Headline oder oberes Formular versehentlich den Flow verlässt.
- **Der BETA-Badge sitzt direkt neben/unter dem Logo** und lenkt zusätzlich von der Aufgabe ab. Für einen externen Nutzer, der dem Flow vertrauen soll, ist ein prominenter `BETA`-Hinweis ein Vertrauenskiller – er signalisiert Unfertigheit.
- **Login-Button im Header ist auf Mobile prominent:** Der orangefarbene `Login`-Button im Header ist auf Mobile deutlich sichtbarer als der eigentliche CTA `Jetzt beitreten` – eine falsche Aktionshierarchie für diesen spezifischen Flow.
- **Der Header konkurriert mit der Maske um Aufmerksamkeit:** Für einen eingeladenen Nutzer ist der Header (Logo, BETA, Login, Menü) irrelevant. Er braucht maximale Fokussierung auf die Beitrittsaufgabe. Der Header stört diese Fokussierung ohne Gegenwert.

## 8. Empfehlungen aus der Cowork-Sichtprüfung

### P1 – Muss

- **Einladungskontext vor den Feldern einführen:** Eine kurze, warme Einleitung direkt unter der Headline (2–3 Sätze): wer eingeladen hat (sofern technisch verfügbar), was diese Maske tut, was nach dem Absenden passiert. Ohne diesen Text ist die Maske kein Invite-Flow, sondern ein anonymes Formular.
- **Bestätigungsbox `Du trittst dem Verein VDAN Ottenheim bei.` nach oben verschieben:** Sie gehört als erste sichtbare Information unter die Headline, nicht nach dem Passwort-Block. Kontext vor Eingabe, nicht nach.
- **Mobile CTA-Problem lösen:** Entweder den CTA mobil sticky am unteren Viewport verankern (nach Checkbox-Akzeptanz aktivierbar), oder zumindest einen visuellen Hinweis einbauen, dass unten eine Hauptaktion wartet. Das Formular darf auf Mobile nicht im leeren Raum enden.
- **BETA-Badge aus dem Invite-Flow-Header entfernen oder stark reduzieren:** Für externe eingeladene Nutzer ist dieser Hinweis vertrauenssenkend. Er kann für eingeloggte Portal-Nutzer sichtbar bleiben.

### P2 – Sollte

- **Abschnittstitel `Dein Zugang` visuell stärken oder semantisch klären:** Entweder mit deutlich mehr Kontrast und Gewicht versehen, oder in lesbare Microcopy umwandeln: `Lege deinen Zugang zum VDAN-Mitgliederportal an.`
- **Microcopy für Mitgliedsnummer-Feld ergänzen:** Hinweistext: optional/Pflicht, Herkunft, Beispielformat. Ohne diese Information ist das Feld für viele Nutzer eine Blockade.
- **Abstand zwischen Checkbox und CTA-Button klar trennen** und dem CTA-Bereich etwas mehr visuelles Gewicht geben (z. B. dezente Trennlinie oder etwas mehr Whitespace).
- **Mobile Headline-Zeilenumbruch kontrollieren:** `VDAN Ottenheim beitreten` sollte auf Mobile sauber in zwei Zeilen umbrechen, nicht in drei.
- **FCP/VDAN-Kontext kurz erklären:** Ein Satz: `Die technische Abwicklung erfolgt über die Fishing-Club-Portal-Plattform (FCP).` – dieser Satz löst die Logodisonanz auf.

### P3 – Kann

- **Bestätigungs-Microcopy unter dem CTA:** `Nach dem Beitreten erhältst du eine Bestätigungs-E-Mail.` – minimaler Vertrauensaufbau, großer psychologischer Effekt.
- **Home-Widget mobil auf Invite-Maske deaktivieren oder zurücksetzen:** Das schwebende Haus-Icon hat auf dieser Maske keine sinnvolle Funktion und überlagert den CTA.
- **Zweistufige Führung optisch stärker abbilden:** Wenn das Formular konzeptionell aus `Konto anlegen` und `Verein beitreten` besteht, kann das auch visuell als Mini-Prozess sichtbar gemacht werden – nicht als technischer Stepper, sondern als einfache Sektionsgliederung mit klaren Titeln und kurzem Erklärtext je Abschnitt.
- **Login-Button im Header auf der Invite-Maske ausblenden oder deemphasizen:** Er signalisiert eine falsche Aktion für Nutzer, die gerade eingeladen wurden und noch kein Konto haben.

## 9. Ergänzende Akzeptanzkriterien aus der Sichtprüfung

- Ein externer Nutzer versteht ohne Scrollen und ohne Vorkenntnisse, warum er auf dieser Seite ist.
- Der Vereinsname und -kontext sind als erste sichtbare Information präsent, nicht erst nach dem Passwort-Block.
- Auf dem initialen mobilen Viewport (375px) ist entweder der CTA sichtbar oder ein klarer visueller Hinweis auf ihn vorhanden.
- Der BETA-Badge ist auf der Invite-Maske für externe Nutzer nicht prominent sichtbar.
- Das Mitgliedsnummer-Feld hat einen erklärenden Hilfstext (Pflicht/Optional, Herkunft).
- Der CTA-Bereich ist visuell von der Checkbox getrennt und erhält ausreichend Eigengewicht.
- Die Maske erklärt in 1–2 Sätzen, was nach dem Absenden passiert.
- Das Home-Icon-Widget überlagert den CTA-Button auf Mobile nicht.
