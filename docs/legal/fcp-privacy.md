# Datenschutzhinweise – Fishing-Club-Portal

Stand: 19. Maerz 2026

## 1. Verantwortlicher

Verantwortlich fuer die Verarbeitung personenbezogener Daten auf der Plattformebene des Fishing-Club-Portals ist:

Michael Lauenroth  
[Strasse Hausnummer]  
[PLZ Ort]  
Deutschland  
E-Mail: m.lauenroth@lauemi.de

## 2. Rollenmodell: Plattform und Vereine

Das Fishing-Club-Portal ist eine mandantenfaehige Vereinsplattform. Dabei sind zwei Ebenen zu unterscheiden:

- Plattformebene: technische Bereitstellung, Hosting, Betrieb, Sicherheit, Authentifizierung, Mandantentrennung, technische Portalfunktionen
- Vereinsebene: vereinsbezogene Inhalte, Mitgliederdaten, Termine, Dokumente, Vereinskommunikation und vereinsinterne Organisation

Grundsaetzlich gilt:

- Der jeweilige Verein ist Verantwortlicher im Sinne von Art. 4 Nr. 7 DSGVO, soweit er ueber Zwecke und Mittel der vereinsbezogenen Verarbeitung entscheidet.
- Der Plattformbetreiber verarbeitet Daten auf dieser Ebene als Auftragsverarbeiter gemaess Art. 28 DSGVO, soweit die Verarbeitung ausschliesslich zur technischen Bereitstellung der Plattform fuer den Verein erfolgt.
- Fuer eigene plattformbezogene Verarbeitungen des Plattformbetreibers, etwa technische Sicherheitsprotokolle, Hostingsteuerung, Missbrauchserkennung, Abrechnung, Support oder eigene oeffentliche Seiteninhalte, kann der Plattformbetreiber selbst Verantwortlicher sein.

Dieses Rollenmodell sollte vertraglich durch eine Auftragsverarbeitungsvereinbarung zwischen Verein und Plattformbetreiber abgesichert werden.

## 3. Zwecke der Verarbeitung

Personenbezogene Daten werden insbesondere zu folgenden Zwecken verarbeitet:

- Bereitstellung der oeffentlichen Website und des geschuetzten Portals
- Einrichtung und Verwaltung von Nutzerkonten
- Authentifizierung und Zugriffsschutz
- Mandanten- und Rechteverwaltung
- Nutzung von Portalmodulen wie Eventplanung, Termine, Arbeitseinsaetze, Dokumente, Fangliste, Ausweis und Gewaesserfunktionen
- Betrieb von Invite-, Registrierungs- und Onboarding-Prozessen
- technische Sicherheit, Fehleranalyse, Missbrauchsabwehr und Systemstabilitaet
- Erfuellung gesetzlicher Pflichten

## 4. Verarbeitete Datenkategorien

Je nach Nutzung werden insbesondere folgende Kategorien verarbeitet:

- Stammdaten, z. B. Name, E-Mail-Adresse, Mitgliedsnummer, Vereinszuordnung
- Account- und Zugangsdaten
- Rollen- und Berechtigungsinformationen
- Portalinhalte und vereinsbezogene Fachdaten
- Kommunikationsdaten, z. B. Kontaktanfragen
- technische Verbindungs- und Protokolldaten, z. B. IP-Adresse, Zeitstempel, Browser- und Geraeteinformationen

## 5. Rechtsgrundlagen

Die Verarbeitung erfolgt insbesondere auf folgenden Rechtsgrundlagen:

- Art. 6 Abs. 1 lit. b DSGVO, soweit die Verarbeitung zur Bereitstellung des Portals oder fuer vorvertragliche bzw. vertragliche Nutzungsbeziehungen erforderlich ist
- Art. 6 Abs. 1 lit. c DSGVO, soweit rechtliche Verpflichtungen bestehen
- Art. 6 Abs. 1 lit. f DSGVO, soweit berechtigte Interessen an Sicherheit, Stabilitaet, Missbrauchsverhinderung, Protokollierung und Betriebssteuerung bestehen
- Art. 6 Abs. 1 lit. a DSGVO, soweit fuer bestimmte optionale Funktionen eine Einwilligung eingeholt wird

## 6. Hosting, Infrastruktur und Dienstleister

Die Plattform wird technisch gehostet und betrieben unter Einbeziehung von Infrastruktur- und Plattformdienstleistern, insbesondere fuer Hosting, Datenbank, Authentifizierung und Auslieferung von Inhalten.

Nach aktuellem technischem Stand des Repos sind insbesondere relevant:

- IONOS als Hosting-/Infrastrukturumfeld
- Supabase fuer Authentifizierung, Datenbank und Plattformfunktionen

Mit Dienstleistern werden, soweit datenschutzrechtlich erforderlich, Vertraege zur Auftragsverarbeitung abgeschlossen.

## 7. Server-Logs, Sicherheits- und Systemprotokolle

Beim Aufruf der Website und bei Nutzung der Plattform werden technisch erforderliche Daten verarbeitet, um Inhalte auszuliefern, den sicheren Betrieb zu gewaehrleisten und Angriffe oder Fehlfunktionen zu erkennen.

Hierzu koennen insbesondere gehoeren:

- IP-Adresse
- Datum und Uhrzeit des Zugriffs
- angeforderte Ressource
- Browser- und Geraeteinformationen
- Status- und Fehlerdaten
- sicherheitsrelevante Audit- und Protokollinformationen

Externe Monitoring- oder Error-Tracking-Dienste wie Sentry, Bugsnag oder LogRocket sind nach aktuellem Repo-Stand nicht als aktive Dritttools eingebunden.

## 8. Registrierung, Login und Mitgliederportal

Im geschuetzten Portal werden personenbezogene Daten zur Einrichtung und Verwaltung von Nutzerkonten, zur Authentifizierung und zur rollenbasierten Freischaltung im jeweiligen Vereinskontext verarbeitet.

Die Plattform ist mandanten- und rollenbasiert aufgebaut. Zugriffe sollen technisch auf den jeweils zugeordneten Vereinskontext beschraenkt werden.

## 9. Web-Push-Benachrichtigungen

Die Plattform unterstuetzt Web-Push-Benachrichtigungen.

Dabei gilt:

- Push wird nur nach entsprechender Zustimmung bzw. Browserfreigabe aktiviert
- es werden technische Subscription-Daten verarbeitet, um Push-Nachrichten an das jeweilige Endgeraet zustellen zu koennen
- Push kann jederzeit ueber Browser- oder App-Einstellungen deaktiviert werden

Die Rechtsgrundlage fuer optionale Push-Benachrichtigungen ist regelmaessig Art. 6 Abs. 1 lit. a DSGVO.

## 10. Lokale Speichertechniken und technisch notwendige Funktionen

Die Plattform verwendet technisch erforderliche lokale Speichermechanismen, insbesondere `localStorage`, `sessionStorage` und Service-Worker-Funktionen, z. B. fuer:

- Login- und Sitzungssteuerung
- Sicherheits- und Offline-Funktionen
- Speicherung von Datenschutz- und Consent-Einstellungen
- Update- und Push-Funktionen

Diese Mechanismen dienen nicht dem Einsatz klassischer Marketing-Analytics.

## 11. Externe Inhalte und Karten

Einzelne Funktionen binden externe Inhalte oder externe Ressourcen ein. Nach aktuellem technischem Stand betrifft dies insbesondere:

- Google Maps Embed auf einzelnen Seiten
- Leaflet-Ressourcen ueber `unpkg.com`
- OpenStreetMap-Kacheln fuer Kartenfunktionen
- Spreadshirt-Shop bzw. externe Shop-Inhalte

Soweit diese Inhalte nicht technisch zwingend erforderlich sind, werden sie erst nach entsprechender Einwilligung geladen.

Bitte beachten:

- Bei Google Maps kann eine Uebermittlung personenbezogener Daten an Google erfolgen.
- Bei CDN- oder Kartenaufrufen koennen technische Verbindungsdaten an externe Anbieter uebertragen werden.

## 12. Cookies und Einwilligungsmanagement

Die Plattform verwendet technisch erforderliche Cookies bzw. vergleichbare Technologien fuer den sicheren Betrieb.

Ein Consent-Management ist vorhanden. Externe Inhalte werden nach aktuellem Stand consent-basiert geladen.

Nicht technisch erforderliche Tracking- oder Analysewerkzeuge sollten nur auf Grundlage einer vorherigen Einwilligung eingesetzt werden.

## 13. Analytics

Nach aktuellem Stand des Repos werden keine klassischen Web-Analytics-Tools wie Google Analytics, Matomo, Plausible, Umami oder PostHog aktiv eingesetzt.

Sollten kuenftig Analytics eingefuehrt werden, ist der Datenschutztext entsprechend zu aktualisieren und die Einwilligungslogik zu pruefen.

## 14. Newsletter

Nach aktuellem Stand des Repos wird kein Newsletter-System aktiv eingesetzt.

Sollten kuenftig Newsletter-Funktionen eingefuehrt werden, sind Rechtsgrundlagen, Versanddienstleister, Double-Opt-In und Widerrufsmechanismen gesondert zu dokumentieren.

## 15. Empfaenger personenbezogener Daten

Empfaenger personenbezogener Daten koennen insbesondere sein:

- technische Hosting- und Infrastrukturdienstleister
- Plattform- und Datenbankdienstleister
- der jeweils zustaendige Verein innerhalb des zugeordneten Mandantenkontexts
- Behoerden oder sonstige Stellen, soweit eine rechtliche Verpflichtung besteht

## 16. Drittlanduebermittlungen

Soweit externe Anbieter oder technische Dienstleister in Drittstaaten eingebunden sind, erfolgt eine Uebermittlung personenbezogener Daten nur auf Grundlage der Art. 44 ff. DSGVO, insbesondere auf Basis geeigneter Garantien oder eines Angemessenheitsbeschlusses, soweit einschlaegig.

## 17. Speicherdauer

Personenbezogene Daten werden nur so lange gespeichert, wie dies fuer die jeweiligen Zwecke erforderlich ist oder gesetzliche Aufbewahrungsfristen bestehen. Anschliessend werden Daten geloescht, gesperrt oder anonymisiert, soweit keine weitere Rechtsgrundlage besteht.

## 18. Betroffenenrechte

Betroffene Personen haben insbesondere folgende Rechte:

- Auskunft
- Berichtigung
- Loeschung
- Einschraenkung der Verarbeitung
- Widerspruch
- Datenuebertragbarkeit
- Widerruf erteilter Einwilligungen mit Wirkung fuer die Zukunft
- Beschwerde bei einer Datenschutzaufsichtsbehoerde

## 19. Kontakt Datenschutz

Bei Fragen zur Datenschutzlogik der Plattform wenden Sie sich bitte an:

Michael Lauenroth  
m.lauenroth@lauemi.de

## 20. Stand und Aenderungen

Diese Datenschutzhinweise koennen angepasst werden, wenn rechtliche, technische oder organisatorische Aenderungen dies erforderlich machen.
