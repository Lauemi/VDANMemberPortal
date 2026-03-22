export type AppMaskBrand = "vdan_default" | "fcp_tactical" | "fcp_brand";

export type AppMaskBrandEntry = {
  route: string;
  label: string;
  note: string;
  default_brand: AppMaskBrand;
};

export const APP_MASK_BRAND_PAGES: AppMaskBrandEntry[] = [
  { route: "/app/", label: "App Start", note: "Portal-Start nach Login.", default_brand: "fcp_tactical" },
  { route: "/app/admin-panel/", label: "Admin Board", note: "Steuerzentrale fuer Governance und Web-Konfiguration.", default_brand: "fcp_tactical" },
  { route: "/app/arbeitseinsaetze/", label: "Termine / Events", note: "Gemeinsame Termin- und Einsatzansicht.", default_brand: "fcp_tactical" },
  { route: "/app/arbeitseinsaetze/cockpit", label: "Arbeitseinsaetze Cockpit", note: "Cockpit fuer Orga und Steuerung.", default_brand: "fcp_tactical" },
  { route: "/app/ausweis/", label: "Ausweis", note: "Digitaler Mitgliedsausweis.", default_brand: "fcp_tactical" },
  { route: "/app/ausweis/verifizieren", label: "Ausweis verifizieren", note: "Pruefmaske fuer den Ausweis.", default_brand: "fcp_tactical" },
  { route: "/app/bewerbungen/", label: "Bewerbungen", note: "Mitgliedsantraege pruefen.", default_brand: "fcp_tactical" },
  { route: "/app/component-library/", label: "Component Library", note: "Interne Komponentenbibliothek.", default_brand: "fcp_tactical" },
  { route: "/app/dokumente/", label: "Dokumente", note: "Dokumentenverwaltung.", default_brand: "fcp_tactical" },
  { route: "/app/einstellungen/", label: "Einstellungen", note: "Persoenliche und Portal-Einstellungen.", default_brand: "fcp_tactical" },
  { route: "/app/eventplaner/", label: "Eventplaner", note: "Planung und Verwaltung von Events.", default_brand: "fcp_tactical" },
  { route: "/app/eventplaner/mitmachen/", label: "Eventplaner Mitmachen", note: "Mitgliederansicht fuer Beteiligung.", default_brand: "fcp_tactical" },
  { route: "/app/feedback/", label: "Feedback", note: "Fehler- und Feedback-Meldungen.", default_brand: "fcp_tactical" },
  { route: "/app/feedback/cockpit", label: "Feedback Cockpit", note: "Admin-Cockpit fuer Rueckmeldungen.", default_brand: "fcp_tactical" },
  { route: "/app/fangliste/", label: "Fangliste", note: "Digitale Fangliste.", default_brand: "fcp_tactical" },
  { route: "/app/fangliste/cockpit", label: "Fangliste Cockpit", note: "Cockpit fuer Auswertung und Pflege.", default_brand: "fcp_tactical" },
  { route: "/app/gewaesserkarte/", label: "Gewaesserkarte", note: "Kartendarstellung fuer das Portal.", default_brand: "fcp_tactical" },
  { route: "/app/kontrollboard/", label: "Kontrollboard", note: "Kontroll- und Rollout-Board.", default_brand: "fcp_tactical" },
  { route: "/app/lizenzen/", label: "Wetter & Karten API", note: "Lizenz- und API-Ansicht.", default_brand: "fcp_tactical" },
  { route: "/app/mitglieder/", label: "Mitglieder", note: "Mitgliederansicht und Rollen.", default_brand: "fcp_tactical" },
  { route: "/app/mitgliederverwaltung/", label: "Mitgliederverwaltung", note: "Vereinsbezogene Mitgliederverwaltung.", default_brand: "fcp_tactical" },
  { route: "/app/notes/", label: "Notes", note: "Interne Demo-/Notizseite.", default_brand: "fcp_tactical" },
  { route: "/app/passwort-aendern/", label: "Passwort aendern", note: "Passwort-Flow fuer Mitglieder.", default_brand: "fcp_tactical" },
  { route: "/app/rechtliches-bestaetigen/", label: "Rechtliches bestaetigen", note: "Rechtstexte im Portal bestaetigen.", default_brand: "fcp_tactical" },
  { route: "/app/sitzungen/", label: "Sitzungen", note: "Sitzungsmodul.", default_brand: "fcp_tactical" },
  { route: "/app/template-studio/", label: "Template Studio", note: "Interne Studio-Maske.", default_brand: "fcp_tactical" },
  { route: "/app/termine/cockpit", label: "Termine Cockpit", note: "Cockpit fuer Terminsteuerung.", default_brand: "fcp_tactical" },
  { route: "/app/ui-neumorph-demo/", label: "UI Demo", note: "Interne UI-Demo.", default_brand: "fcp_tactical" },
  { route: "/app/vereine/", label: "Vereine", note: "Vereinssetup und Onboarding.", default_brand: "fcp_tactical" },
  { route: "/app/zugang-pruefen/", label: "Zugang pruefen", note: "Pflichtpruefung fuer Kontodaten.", default_brand: "fcp_tactical" },
  { route: "/app/zustaendigkeiten/", label: "Zustaendigkeiten", note: "Persoenliche Aufgaben und Leitungen.", default_brand: "fcp_tactical" },
];
