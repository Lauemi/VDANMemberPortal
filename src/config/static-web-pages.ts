import type { SiteMode } from "./site-mode";

export type StaticPageBrand = "vdan" | "fcp";

export type StaticPageTargetConfig = {
  visible: boolean;
  brand: StaticPageBrand;
};

export type StaticWebPageEntry = {
  route: string;
  label: string;
  note: string;
  targets: Record<SiteMode, StaticPageTargetConfig>;
};

function normalizeRouteInput(route: string) {
  const raw = String(route || "").trim();
  if (!raw) return "/";
  const noQuery = raw.split("?")[0].split("#")[0] || "/";
  const normalized = noQuery
    .replace(/\/index$/, "/")
    .replace(/\.html$/i, "")
    .replace(/\/+$/, "") || "/";
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

export function normalizeStaticWebRoute(route: string) {
  return normalizeRouteInput(route);
}

export const STATIC_WEB_PAGES: StaticWebPageEntry[] = [
  {
    route: "/",
    label: "Startseite",
    note: "FCP = Brand-Landingpage. VDAN = Vereinsstartseite mit Feed.",
    targets: {
      fcp: { visible: true, brand: "fcp" },
      vdan: { visible: true, brand: "vdan" },
    },
  },
  {
    route: "/login",
    label: "Login",
    note: "Gemeinsamer Einstieg, Brand folgt dem Deploy-Ziel.",
    targets: {
      fcp: { visible: true, brand: "fcp" },
      vdan: { visible: true, brand: "vdan" },
    },
  },
  {
    route: "/registrieren",
    label: "Registrieren",
    note: "Gemeinsamer Einstieg, Brand folgt dem Deploy-Ziel.",
    targets: {
      fcp: { visible: true, brand: "fcp" },
      vdan: { visible: true, brand: "vdan" },
    },
  },
  {
    route: "/vereinssignin",
    label: "VereinsSignIn",
    note: "Getrennter Einstieg fuer bestehende Vereine und Invite-Flow.",
    targets: {
      fcp: { visible: true, brand: "fcp" },
      vdan: { visible: true, brand: "vdan" },
    },
  },
  {
    route: "/verein-anfragen",
    label: "Verein anfragen",
    note: "Getrennter Einstieg fuer neue Vereine mit Pending- und Freigabeprozess.",
    targets: {
      fcp: { visible: true, brand: "fcp" },
      vdan: { visible: true, brand: "vdan" },
    },
  },
  {
    route: "/passwort-vergessen",
    label: "Passwort vergessen",
    note: "Gemeinsame Utility-Seite, Brand folgt dem Deploy-Ziel.",
    targets: {
      fcp: { visible: true, brand: "fcp" },
      vdan: { visible: true, brand: "vdan" },
    },
  },
  {
    route: "/offline",
    label: "Offline",
    note: "Gemeinsame Utility-Seite, Brand folgt dem Deploy-Ziel.",
    targets: {
      fcp: { visible: true, brand: "fcp" },
      vdan: { visible: true, brand: "vdan" },
    },
  },
  {
    route: "/kontakt",
    label: "Kontakt",
    note: "Gemeinsame Kontaktseite, Brand folgt dem Deploy-Ziel.",
    targets: {
      fcp: { visible: true, brand: "fcp" },
      vdan: { visible: true, brand: "vdan" },
    },
  },
  {
    route: "/datenschutz",
    label: "Datenschutz",
    note: "Gemeinsame Rechtsseite mit zielabhängigem Inhalt.",
    targets: {
      fcp: { visible: true, brand: "fcp" },
      vdan: { visible: true, brand: "vdan" },
    },
  },
  {
    route: "/nutzungsbedingungen",
    label: "Nutzungsbedingungen",
    note: "Gemeinsame Rechtsseite mit zielabhängigem Inhalt.",
    targets: {
      fcp: { visible: true, brand: "fcp" },
      vdan: { visible: true, brand: "vdan" },
    },
  },
  {
    route: "/impressum",
    label: "Impressum",
    note: "Gemeinsame Rechtsseite mit zielabhängigem Inhalt.",
    targets: {
      fcp: { visible: true, brand: "fcp" },
      vdan: { visible: true, brand: "vdan" },
    },
  },
  {
    route: "/avv",
    label: "AVV",
    note: "Auf FCP voll, auf VDAN nur als Platzhalterhinweis sichtbar.",
    targets: {
      fcp: { visible: true, brand: "fcp" },
      vdan: { visible: true, brand: "vdan" },
    },
  },
  {
    route: "/docs",
    label: "Docs",
    note: "Interne Hilfsseite, aktuell auf beiden Zielen sichtbar.",
    targets: {
      fcp: { visible: true, brand: "fcp" },
      vdan: { visible: true, brand: "vdan" },
    },
  },
  {
    route: "/anglerheim-ottenheim",
    label: "Anglerheim Ottenheim",
    note: "VDAN-Spezialseite.",
    targets: {
      fcp: { visible: false, brand: "vdan" },
      vdan: { visible: true, brand: "vdan" },
    },
  },
  {
    route: "/downloads",
    label: "Downloads",
    note: "VDAN-Spezialseite.",
    targets: {
      fcp: { visible: false, brand: "vdan" },
      vdan: { visible: true, brand: "vdan" },
    },
  },
  {
    route: "/fischereipruefung",
    label: "Fischereiprüfung",
    note: "VDAN-Spezialseite.",
    targets: {
      fcp: { visible: false, brand: "vdan" },
      vdan: { visible: true, brand: "vdan" },
    },
  },
  {
    route: "/mitglied-werden",
    label: "Mitglied werden",
    note: "VDAN-Spezialseite.",
    targets: {
      fcp: { visible: false, brand: "vdan" },
      vdan: { visible: true, brand: "vdan" },
    },
  },
  {
    route: "/termine",
    label: "Termine",
    note: "VDAN-Spezialseite.",
    targets: {
      fcp: { visible: false, brand: "vdan" },
      vdan: { visible: true, brand: "vdan" },
    },
  },
  {
    route: "/vdan-jugend",
    label: "VDAN Jugend",
    note: "VDAN-Spezialseite.",
    targets: {
      fcp: { visible: false, brand: "vdan" },
      vdan: { visible: true, brand: "vdan" },
    },
  },
  {
    route: "/veranstaltungen",
    label: "Veranstaltungen",
    note: "VDAN-Spezialseite.",
    targets: {
      fcp: { visible: false, brand: "vdan" },
      vdan: { visible: true, brand: "vdan" },
    },
  },
  {
    route: "/vereinsshop",
    label: "Vereinsshop",
    note: "VDAN-Spezialseite.",
    targets: {
      fcp: { visible: false, brand: "vdan" },
      vdan: { visible: true, brand: "vdan" },
    },
  },
];

export const STATIC_WEB_ENV_HINTS = {
  fcp: {
    site_mode: "PUBLIC_SITE_MODE=fcp",
    app_brand: "PUBLIC_APP_BRAND=FCP",
    app_name: "PUBLIC_APP_NAME=Fishing-Club-Portal",
    app_theme: "PUBLIC_APP_THEME=fcp_brand oder fcp_tactical",
  },
  vdan: {
    site_mode: "PUBLIC_SITE_MODE=vdan",
    app_brand: "PUBLIC_APP_BRAND=VDAN",
    app_name: "PUBLIC_APP_NAME=VDAN Ottenheim",
    app_theme: "PUBLIC_APP_THEME=vdan_default",
  },
} as const;

export function getStaticWebPageEntry(route: string) {
  const normalized = normalizeRouteInput(route);
  return STATIC_WEB_PAGES.find((entry) => normalizeRouteInput(entry.route) === normalized) || null;
}

export function getStaticWebTargetConfig(route: string, siteMode: SiteMode) {
  const entry = getStaticWebPageEntry(route);
  return entry?.targets?.[siteMode] || null;
}
