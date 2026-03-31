;(() => {
  function isVdanSiteMode() {
    return String(window.__APP_SITE_MODE || "").trim().toLowerCase() === "vdan";
  }

  function update() {
    const cta = document.getElementById("headerAuthCta");
    if (!cta) return;
    const session = window.VDAN_AUTH?.loadSession?.() || null;
    if (session?.user?.id) {
      cta.textContent = "Portal";
      cta.setAttribute("href", "/app/");
      cta.setAttribute("aria-label", "Portal öffnen");
      return;
    }

    const current = `${window.location.pathname || "/"}${window.location.search || ""}`;
    const next = isVdanSiteMode() ? "/app/" : (current.startsWith("/login/") ? "/app/" : current);
    cta.textContent = "Login";
    cta.setAttribute("href", `/login/?next=${encodeURIComponent(next)}`);
    cta.setAttribute("aria-label", "Anmelden");
  }

  function init() {
    update();
    window.addEventListener("storage", update);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
