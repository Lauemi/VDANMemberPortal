# DSGVO-Check – VDAN Fishing-Club-Portal

Stand: 26.02.2026
Verantwortlicher Projektkontext: VDAN, technischer Ansprechpartner Michael Lauenroth.
Hinweis: Technischer Vorab-Check, ersetzt keine anwaltliche Datenschutzberatung.

## 1) Ergebnis (Kurzampel)

1. Gruen: Rollen-/Rechtekonzept mit RLS ist breit vorhanden.
2. Gruen: Kontaktprozess mit Anti-Spam und serverseitiger Pruefung ist dokumentiert.
3. Gruen: Sensible Felder im Membership-Prozess sind verschluesselt (pgcrypto + Key in `app_secure_settings`).
4. Gelb: Vollstaendige Verzeichnisse von Verarbeitungstaetigkeiten (VVT) und Loeschkonzept als formale Doku fehlen im Repo.
5. Gelb: Auftragsverarbeitungsvertraege und Drittlandtransfer-Nachweise muessen organisatorisch abgelegt sein.
6. Rot (strukturell): Durchgaengige Mandantentrennung (`tenant_id`) noch nicht systemweit umgesetzt (Single-Tenant aktuell).

## 2) Gepruefte technische Punkte

1. Authentifizierung und Zugriffsschutz in Login-Bereichen vorhanden.
2. RLS-Policies fuer zentrale Tabellen und Funktionen vorhanden.
3. Security-Invoker fuer kritische Views gesetzt (`v_admin_online_users`, `v_my_responsibilities`, `export_members`).
4. Push-Subscriptions mit eigener Tabelle/RLS vorhanden.
5. Membership-Verschluesselung ueber `membership_encryption_key` aktivierbar.

## 3) DSGVO-Relevante Restaufgaben vor "final produktiv"

1. VVT finalisieren:
   Zweck, Datenkategorien, Rechtsgrundlage, Empfaenger, Speicherdauer je Prozess.
2. Loesch- und Retention-Konzept schriftlich finalisieren:
   Fristen je Datenart (Kontaktanfragen, Logs, Mitgliederdaten, Bewerbungen).
3. TOM-Dokument vereinheitlichen:
   Zugriff, Verschluesselung, Protokollierung, Backup/Restore, Incident-Ablauf.
4. Betroffenenrechte-Runbook:
   Auskunft, Berichtigung, Loeschung, Export, Widerspruch mit Fristen und Zustaendigkeiten.
5. Externe Dienstleister:
   AVV/SCC/Datentransferstatus dokumentiert und nachweisbar ablegen.

## 4) Konkreter Freigabe-Gate (DSGVO)

Release "rechtlich belastbar" erst wenn:

1. Nutzungsbedingungen veroeffentlicht.
2. Datenschutzerklaerung inhaltlich mit Ist-Funktionen synchron.
3. VVT + Loeschkonzept + TOM als interne Freigabedokumente vorhanden.
4. AVV/SCC-Nachweise fuer eingesetzte Drittanbieter abgelegt.
5. Prozess fuer Datenschutzanfragen benannt (Verantwortlicher + Vertretung + SLA).

## 5) Empfehlung

1. Technisch ist der Stand fuer Testbetrieb gut.
2. Fuer Dauerbetrieb mit geringer juristischer Angriffsfläche:
   juristische Endpruefung (Datenschutz + Vereinsrecht + Telemedien) vor breitem Rollout einplanen.

