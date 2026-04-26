# FCP-Grundprinzip: Bedeutungsprüfung vor Umsetzung

**Verbindlich für alle FCP-Agenten ab Inkrafttreten.**
Quelle: [MINA-139](/MINA/issues/MINA-139) | Eltern: [MINA-137](/MINA/issues/MINA-137) | GitHub #15 (VDANMemberPortal)

---

## 1. Hintergrund & Motivation

MINA-95/96/97 zeigten, dass unklare Begriffe zu falschen Implementierungen führen. Beispiel: „Benutzer beitreten" kann in FCP sowohl „einen Invite annehmen und Club-Mitglied werden" als auch „einen FCP-Account erstellen" bedeuten – je nach Kontext unterschiedlich. Agenten, die diesen Unterschied nicht prüfen, bauen falsche Flows.

---

## 2. Risikobegriffe (Kanonische Liste)

Folgende Begriffe sind im FCP-Kontext mehrdeutig und lösen automatisch die Bedeutungsprüfungspflicht aus:

| Begriff | Mögliche Bedeutungen | Haupt-Konfliktzone |
|---------|---------------------|-------------------|
| **beitreten** | (a) Verein beitreten = Club-Membership annehmen; (b) Session/Meeting joinen | Auth vs. Membership |
| **registrieren** | (a) Neuen FCP-Account anlegen; (b) Vorhandenen Account für Verein anmelden | Auth vs. Club-Enrollment |
| **anmelden** | (a) Login (bestehender Account); (b) Registrierung (neuer Account); (c) Vereinsanmeldung | Auth-Flow |
| **claimen** | (a) Invite-Slot übernehmen; (b) Admin-Rolle beanspruchen; (c) Account aus externem System importieren | Invite vs. Admin vs. Migration |
| **aktivieren** | (a) Account via Email-Link aktivieren; (b) Feature aktivieren; (c) Vereinsmitgliedschaft aktivieren | Account vs. Feature vs. Membership |
| **einladen** | (a) Invite-Email senden; (b) Invite-Link generieren; (c) Direkt-Beitritt ohne Email ermöglichen | Invite-Flow |
| **Mitglied** | (a) FCP-User (Plattformebene); (b) Club-Member (VDAN-Mitglied); (c) Externer Vereinsinhaber | Multi-Club-Context |
| **Verein** | (a) FCP-Tenant (technisch); (b) VDAN-Instanz (konkrete Pilot-Instanz); (c) Externer Verein | Multi-Club-Context |
| **Admin** | (a) FCP-SuperAdmin; (b) Club-Admin; (c) Verwalter ohne technische Rechte | Rollen/Rechte |
| **Onboarding** | (a) Technisches Account-Setup; (b) Vereinsaufnahme-Prozess; (c) Wizard-Durchlauf für neue Clubs | Prozess-Ebene |
| **freischalten** | (a) Account-Verifikation; (b) Billing-Aktivierung; (c) Feature-Flag setzen | Auth vs. Billing vs. Feature |

---

## 3. Verbindliches Reaktionsmuster

### 3.1 Pflicht-Klärung (Muss nachgefragt werden)

Ein Agent MUSS nachfragen, wenn MINDESTENS EINE der folgenden Bedingungen zutrifft:

1. **Risikobegriff ohne Kontext**: Der Auftrag enthält einen Begriff aus Liste 2, ohne dass der Kontext die Bedeutung eindeutig festlegt.
2. **Neuer Kontext**: Der Auftrag kommt in einem Ticket/Kontext, in dem der Begriff noch nicht definiert wurde.
3. **Scope-Ambiguität**: Unklar ist, ob es sich um eine FCP-Plattformfunktion oder eine VDAN-spezifische Anpassung handelt.
4. **Cross-Flow-Side-Effects**: Die Umsetzung hätte Auswirkungen auf Auth, Billing, RLS oder Invite-Flow – und der genaue Scope ist nicht benannt.
5. **Rollenkonfusion**: Welche Nutzerrolle (FCP-User, Club-Admin, SuperAdmin) betroffen ist, bleibt offen.

### 3.2 Self-Resolve (Direkte Umsetzung erlaubt)

Ein Agent darf ohne Rückfrage umsetzen, wenn ALLE folgenden Bedingungen erfüllt sind:

1. Der Begriff ist im gegebenen Issue-Kontext nur mit einer einzigen technischen Bedeutung belegt.
2. Der Auftraggeber hat den Begriff explizit präzisiert (z.B. „anmelden = Login, nicht Registrierung").
3. In der Issue-Geschichte oder verlinkten Tickets wurde die Bedeutung bereits verbindlich festgelegt.
4. Nur eine technische Umsetzung ist architektonisch möglich.

**Pflicht bei Self-Resolve:** Die gewählte Interpretation MUSS im Issue-Kommentar dokumentiert werden (siehe Abschnitt 5).

---

## 4. Entscheidungsrahmen (Flussdiagramm)

```
Eingehende Anfrage
        ↓
[1] Enthält die Anfrage einen Risikobegriff aus Liste 2?
        ├── NEIN → Direkte Umsetzung erlaubt
        └── JA ↓
[2] Ist die Bedeutung aus dem Kontext eindeutig ableitbar?
        ├── JA (mit Begründung) → Self-Resolve + Dokumentationspflicht (Abschnitt 5)
        └── NEIN ↓
[3] Eskalationspfad (in dieser Reihenfolge durchlaufen):
        (a) Repo prüfen: Lauemi/VDANMemberPortal + Lauemi/ROSCCX
        (b) MINA-Issues + Kommentare prüfen
        (c) Legal/Datenschutz/Security-Docs prüfen
        (d) Zuständige Fachabteilung fragen (COO)
        (e) CEO fragen
        (f) Michael fragen — mit vollständigem Suchpfad-Nachweis
```

### Rückfrage-Format (Pflicht wenn Michael/CEO gefragt wird)

```
**Bedeutungsklärung erforderlich**

Begriff: „[Begriff]"
Mögliche Bedeutungen:
  (a) [Bedeutung A] → technische Auswirkung: [...]
  (b) [Bedeutung B] → technische Auswirkung: [...]

Bereits geprüft: [Repo / Issues / Docs — was wurde gesucht?]
Gefunden: [Was wurde gefunden? „Nichts" ist auch eine Antwort]
Warum nur Michael/CEO antworten kann: [Begründung]

Entscheidung benötigt: Welche Bedeutung gilt für [Ticket/Kontext]?
```

---

## 5. Dokumentationspflicht bei Self-Resolve

Wenn ein Agent einen Risikobegriff eigenständig auflöst, MUSS er in seinem Issue-Kommentar folgenden Block einfügen:

```markdown
**Bedeutungsprüfung:** „[Begriff]" wird in diesem Kontext als „[gewählte Bedeutung]" interpretiert.
Quelle: [Link zu Ticket / Datei / Kommentar]
Begründung: [Warum diese Interpretation eindeutig ist]
```

Ohne diesen Block gilt ein Self-Resolve als nicht dokumentiert und ist im Review anfechtbar.

---

## 6. Kanonisches FCP-Vokabular (Referenz)

Diese Tabelle definiert die verbindlichen Bezeichnungen für FCP-Kernkonzepte. Synonyme sind im Code, in Kommentaren und in Tickets zu vermeiden.

| FCP-Konzept (kanonisch) | Bedeutung | Synonyme — NICHT verwenden |
|------------------------|-----------|---------------------------|
| **Club beitreten** | User nimmt Invite an, wird Club-Member (Membership-Row in DB) | „registrieren beim Verein", „anmelden im Verein" |
| **FCP-Account erstellen** | Neuen Auth-User anlegen (Supabase Auth + profiles-Row) | „beitreten", „claimen" |
| **Invite senden** | Club sendet Invite-Email/-Link an externe Person | „einschreiben", „aufnehmen", „einladen zum Beitritt" |
| **Claim-Flow** | Externer User übernimmt vorbereiteten Invite-Slot mit bestehendem Account | „aktivieren", „registrieren", „bestätigen" |
| **Mitgliedschaft aktivieren** | Admin-Aktion: bestehende Membership wird von pending auf active gesetzt | „freischalten", „bestätigen" (im Membership-Kontext) |
| **Club aktivieren** | VDAN-Instanz geht produktiv (SuperAdmin-Aktion, Billing-Start) | „freischalten", „starten", „einrichten" |
| **Login** | Bestehender FCP-User authentifiziert sich | „anmelden" (nur wenn Registrierung explizit ausgeschlossen) |
| **Registrierung** | Neuer FCP-User erstellt Account | „anmelden" (nur wenn Login explizit ausgeschlossen) |

---

## 7. Anti-Patterns (Verboten)

| Anti-Pattern | Warum verboten |
|-------------|----------------|
| Begriff 1:1 aus dem Ticket in Code übernehmen ohne Prüfung | Führte zu MINA-95/96/97-Fehlern |
| Stille Annahme ohne Dokumentation | Nicht nachvollziehbar, nicht reviewbar |
| Denselben Begriff im selben Ticket mehrfach nachfragen | Verschwenderisch; Suchpflicht gilt zuerst |
| Rückfrage ohne Suchpfad-Nachweis | Verstößt gegen COO-Eskalationsregel |
| Self-Resolve ohne Kommentar-Dokumentation | Gilt als nicht geprüft |

---

## 8. Inkrafttreten & Pflege

- **Inkrafttreten:** Mit Merge in `main` auf `Lauemi/VDANMemberPortal`
- **Pflegeinstanz:** FCP-COO (inhaltlich), FCP-Sekretariat (Repo-Commit)
- **Änderungen:** Über MINA-Issue + CEO-Freigabe; COO kann Ergänzungen der Risikobegriff-Liste eigenständig delegieren
- **Review-Zyklus:** Bei jedem neuen MINA-Fehler durch Begriffsambiguität → Prüfung ob Aktualisierung notwendig
