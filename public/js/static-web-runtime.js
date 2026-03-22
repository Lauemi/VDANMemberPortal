;(() => {
  const MENU_LINKS = {
    fcp: [
      { href: "/", label: "Start" },
      { href: "/kontakt.html/", label: "Kontakt" },
      { href: "/datenschutz.html/", label: "Datenschutz" },
      { href: "/nutzungsbedingungen.html/", label: "Nutzungsbedingungen" },
      { href: "/impressum.html/", label: "Impressum" },
    ],
    vdan: [
      { href: "/", label: "Start" },
      { href: "/termine.html/", label: "Termine" },
      { href: "/vdan-jugend.html/", label: "Jugend" },
      { href: "/mitglied-werden.html/", label: "Mitglied werden" },
      { href: "/fischereipruefung.html/", label: "Fischereiprüfung" },
      { href: "/anglerheim-ottenheim.html/", label: "Anglerheim" },
      { href: "/downloads.html/", label: "Downloads" },
      { href: "/vereinsshop.html/", label: "Vereinsshop" },
      { href: "/kontakt.html/", label: "Kontakt" },
      { href: "/datenschutz.html/", label: "Datenschutz" },
      { href: "/impressum.html/", label: "Impressum" },
    ],
  };

  function cfg() {
    const body = document.body;
    return {
      url: String(body?.getAttribute("data-supabase-url") || "").trim().replace(/\/+$/, ""),
      key: String(body?.getAttribute("data-supabase-key") || "").trim(),
      route: normalizeRoute(String(body?.getAttribute("data-static-web-route") || window.location.pathname || "").trim()),
      siteMode: String(body?.getAttribute("data-site-mode") || "").trim().toLowerCase() === "vdan" ? "vdan" : "fcp",
    };
  }

  function normalizeRoute(pathname) {
    const raw = String(pathname || "").trim();
    if (!raw) return "/";
    return (raw
      .split("?")[0]
      .split("#")[0]
      .replace(/\/index$/, "/")
      .replace(/\.html$/i, "")
      .replace(/\/+$/, "") || "/");
  }

  function isLocalDev() {
    const host = String(window.location.hostname || "").trim().toLowerCase();
    return host === "127.0.0.1" || host === "localhost";
  }

  async function loadConfig() {
    const { url, siteMode } = cfg();
    if (!url || isLocalDev()) return null;
    const params = new URLSearchParams({ action: "get", scope: siteMode });
    const res = await fetch(`${url}/functions/v1/admin-web-config?${params.toString()}`, {
      method: "GET",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return null;
    return data;
  }

  function setMetaRobots(content) {
    let meta = document.querySelector('meta[name="robots"]');
    if (!(meta instanceof HTMLMetaElement)) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", content);
  }

  function toggleBlock(id, active) {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = !active;
    el.classList.toggle("hidden", !active);
  }

  function renderMenu(scope) {
    const popover = document.getElementById("burgerPopover");
    if (!popover) return;
    const links = MENU_LINKS[scope] || MENU_LINKS.fcp;
    popover.setAttribute("data-runtime-menu-scope", scope);
    popover.innerHTML = links
      .map((link) => `<a href="${link.href}">${link.label}</a>`)
      .join("");
  }

  function applyBrand(brand) {
    const safeBrand = String(brand || "").trim().toLowerCase() === "vdan" ? "vdan" : "fcp";
    const theme = safeBrand === "vdan" ? "vdan_default" : "fcp_brand";
    document.body?.setAttribute("data-app-theme", theme);
    document.body?.setAttribute("data-static-web-brand", safeBrand);
    document.body?.setAttribute("data-static-web-runtime-source", "remote");
    toggleBlock("headerBrandFcp", safeBrand === "fcp");
    toggleBlock("headerBrandVdan", safeBrand === "vdan");
    toggleBlock("siteFooterTextFcp", safeBrand === "fcp");
    toggleBlock("siteFooterTextVdan", safeBrand === "vdan");
    toggleBlock("siteFooterLinksVdan", safeBrand === "vdan");
    renderMenu(safeBrand);
  }

  function renderUnavailable(route, siteMode) {
    const main = document.querySelector("main.main");
    if (!main) return;
    setMetaRobots("noindex,nofollow");
    document.body?.setAttribute("data-static-web-runtime-source", "remote-hidden");
    main.innerHTML = `
      <div class="container">
        <section class="card" style="max-width:840px;margin:0 auto;">
          <div class="card__body">
            <h1>Diese Seite ist derzeit nicht freigegeben.</h1>
            <p>
              Die statische Seite <strong>${route}</strong> ist für das Ziel <strong>${String(siteMode || "").toUpperCase()}</strong>
              aktuell per <strong>Runtime-Ausblendung</strong> auf nicht sichtbar gesetzt.
            </p>
            <p class="small">
              Hinweis: Das ist eine clientseitige Sichtbarkeitssteuerung über die Runtime-Config, keine serverseitige Veröffentlichungsgrenze.
            </p>
          </div>
        </section>
      </div>
    `;
  }

  async function init() {
    if (String(window.location.pathname || "").startsWith("/app/")) return;
    const data = await loadConfig().catch(() => null);
    const matrix = data?.static_web_matrix && typeof data.static_web_matrix === "object" ? data.static_web_matrix : null;
    if (!matrix) return;
    const { route, siteMode } = cfg();
    const row = matrix[route] && typeof matrix[route] === "object" ? matrix[route][siteMode] : null;
    if (!row || typeof row !== "object") return;
    const visible = row.visible !== false;
    const brand = String(row.brand || siteMode).trim().toLowerCase() === "vdan" ? "vdan" : "fcp";
    if (!visible) {
      renderUnavailable(route, siteMode);
      return;
    }
    applyBrand(brand);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
