# Security Baseline Review

Stand: 2026-03-16

Hinweis:
Diese Prüfung ist eine technische Repo- und Codebasis-Sichtung. Sie ersetzt keine anwaltliche DSGVO-Prüfung und keine produktive Penetration- oder Infrastrukturprüfung.

## Scope

- Supabase-Migrationen zu RLS, Policies, RPC und Least Privilege
- Frontend-Session-Handling, XSS-Oberflächen und Sicherheitsheader
- Rechtliche Artefakte zu Datenschutz, Nutzungsbedingungen und Akzeptanzfluss

## Positiv aufgefallen

- Event-Planer-Härtung ist vorhanden, inklusive RLS-Nachschärfung und Recursion-Fix.
- Notification-Layer ist mit RLS und Execute-Revoke sinnvoll abgesichert.
- Es gibt eine explizite Least-Privilege-Baseline für `anon`.
- Datenschutz- und Nutzungsbedingungen-Seiten sowie ein Legal-Acceptance-Flow sind vorhanden.
- Es existieren bereits Security-/DSGVO-Checklisten und Runtime-Pentest-Notizen.

## Findings

### 1. Hoch: Keine erkennbare CSP- und Security-Header-Baseline im Web-Layer

Betroffene Stellen:
- [astro.config.mjs](/Users/michaellauenroth/Downloads/vdan-app-template/astro.config.mjs)

Bewertung:
- In der aktuellen Astro-Konfiguration ist keine zentrale Header-Schicht für `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` oder `Strict-Transport-Security` erkennbar.
- Gleichzeitig verwendet das Projekt an vielen Stellen DOM-Injektion über `innerHTML`. Ohne CSP steigt der Impact einer XSS-Lücke deutlich.

Risiko:
- XSS-Folgen werden unnötig groß.
- Framing-, Referrer- und Browser-Policy-Schutz ist nicht zentral gehärtet.

Empfehlung:
- Zentrale Header-Baseline im Server-/Hosting-Layer einführen.
- Mindestens CSP, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options`/`frame-ancestors`, `Permissions-Policy` und HSTS definieren.

### 2. Hoch: Auth-Session liegt im `localStorage` und ist damit skriptlesbar

Betroffene Stellen:
- [public/js/member-auth.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/member-auth.js)
- [public/js/ui-session.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/ui-session.js)
- [src/pages/datenschutz.html.astro](/Users/michaellauenroth/Downloads/vdan-app-template/src/pages/datenschutz.html.astro)

Bewertung:
- Die Mitgliedersession wird unter `vdan_member_session_v1` im `localStorage` gehalten.
- Das ist in SPA-Architekturen technisch möglich, erhöht aber die Kritikalität jeder XSS, weil Access Tokens direkt auslesbar sind.

Risiko:
- Jede erfolgreiche Script-Injektion kann Sitzungen übernehmen.

Empfehlung:
- Mittelfristig auf serverseitige Session oder HttpOnly-Cookie-basierte Architektur umstellen.
- Bis dahin CSP-Härtung priorisieren und `innerHTML`-Oberflächen reduzieren.

### 3. Hoch: FCP-Modus zeigt bei Datenschutz und Nutzungsbedingungen nur Platzhalter

Betroffene Stellen:
- [src/pages/datenschutz.html.astro](/Users/michaellauenroth/Downloads/vdan-app-template/src/pages/datenschutz.html.astro)
- [src/pages/nutzungsbedingungen.html.astro](/Users/michaellauenroth/Downloads/vdan-app-template/src/pages/nutzungsbedingungen.html.astro)

Bewertung:
- Im FCP-Modus werden aktuell keine finalen Inhalte ausgeliefert, sondern nur ein Hinweis, dass Texte separat finalisiert werden.
- Für einen echten Live-Betrieb ist das rechtlich und organisatorisch nicht ausreichend.

Risiko:
- Unvollständige Informationspflichten gegenüber Nutzern.
- Schwacher Nachweisstand für DSGVO- und Nutzungsbedingungen-Akzeptanz.

Empfehlung:
- Finaltexte im FCP-Modus produktiv ausspielen oder FCP-Modus bis dahin nicht als rechtsverbindlichen Live-Betrieb verwenden.

### 4. Mittel: Konkrete XSS-Oberfläche durch unescaped `innerHTML` im Portal-Quick-Menü

Betroffene Stelle:
- [public/js/portal-quick.js](/Users/michaellauenroth/Downloads/vdan-app-template/public/js/portal-quick.js)

Bewertung:
- `mod.label`, `mod.id` und `mod.href` werden in `row.innerHTML` ohne sichtbares Escaping eingesetzt.
- Je nach Herkunft der Moduldaten ist das eine echte XSS-Oberfläche oder mindestens ein unnötiger Risikopfad.

Risiko:
- Wenn Modulmetadaten manipulierbar sind, kann HTML/Script in die Navigation gelangen.

Empfehlung:
- `textContent`/`setAttribute` statt `innerHTML` verwenden oder konsequent escapen.

### 5. Mittel: Operative Security-/DSGVO-Baseline ist dokumentiert, aber noch nicht als erfüllt nachgewiesen

Betroffene Stelle:
- [docs/security-dsgvo-checklist.md](/Users/michaellauenroth/Downloads/vdan-app-template/docs/security-dsgvo-checklist.md)

Bewertung:
- Die zentrale Baseline-Liste enthält noch offene Punkte zu:
  - Backup/Restore-Test
  - Incident-Runbook
  - Rechte-Review
  - AVV/DPA/TIA-Nachweise
  - Löschfristen und Betroffenenrechte-Prozess

Risiko:
- Technisch ist schon viel da, organisatorisch fehlt aber der belastbare Nachweis.

Empfehlung:
- Checklist in Release-Gate oder Compliance-Ordner überführen und mit Status belegen.

## Datenbank / RLS / RPC Kurzfazit

Positiv:
- In den Supabase-Migrationen sind RLS, Least-Privilege und Security-Definer-Härtungen klar erkennbar.
- Besonders relevant:
  - [supabase/migrations/20260314113000_event_planner_phase2_hardening.sql](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/migrations/20260314113000_event_planner_phase2_hardening.sql)
  - [supabase/migrations/20260315060000_event_planner_phase2b_rls_recursion_fix.sql](/Users/michaellauenroth/Downloads/vdan-app-template/supabase/migrations/20260315060000_event_planner_phase2b_rls_recursion_fix.sql)
  - [docs/supabase/74_security_dsgvo_baseline.sql](/Users/michaellauenroth/Downloads/vdan-app-template/docs/supabase/74_security_dsgvo_baseline.sql)

Rest-Risiko:
- Viele kritische Operationen laufen über `security definer`-RPCs. Das ist legitim, muss aber nach jeder Änderung regressionsgetestet werden.

## Recht / DSGVO Kurzfazit

Positiv:
- Datenschutz- und Nutzungsbedingungen sind im Repo ausführlich vorhanden.
- Legal-Acceptance-Mechanik existiert.

Lücke:
- FCP-Modus selbst liefert aktuell noch keine finalen Rechtstexte aus.

## Empfohlene Reihenfolge

1. Web-Security-Header und CSP produktiv einführen.
2. `portal-quick.js` und weitere unescaped `innerHTML`-Stellen entschärfen.
3. FCP-Rechtstexte finalisieren und Platzhalter entfernen.
4. Session-Architektur mittelfristig von `localStorage` wegbewegen.
5. Offene DSGVO-/Security-Checklist-Punkte in einen echten Betriebsnachweis überführen.

## Prüfgrenzen

Nicht geprüft in dieser Repo-Sichtung:
- Live-Supabase-Policies gegen reale Tokens
- Hosting-Konfiguration bei IONOS/Vercel
- Edge-Functions im produktiven Deployment
- Externe Verträge, AVV/DPA und organisatorische Nachweisdokumente außerhalb des Repos
