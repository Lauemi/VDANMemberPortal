;(() => {
  function isVdanSiteMode() {
    return String(window.__APP_SITE_MODE || "").trim().toLowerCase() === "vdan";
  }

  function setMsg(text = "") {
    const el = document.getElementById("authCallbackMsg");
    if (el) el.textContent = text;
  }

  function nextTarget(fallback = "/app/") {
    if (isVdanSiteMode()) return "/app/";
    const q = new URLSearchParams(window.location.search || "");
    const raw = String(q.get("next") || "").trim();
    if (raw.startsWith("/")) return raw;
    return fallback;
  }

  function toUrl(path) {
    return String(path || "").trim().startsWith("/") ? path : "/app/";
  }

  function handleError(result) {
    const code = String(result?.error_code || "").trim();
    if (code === "otp_expired") {
      setMsg("Der Link ist abgelaufen oder wurde bereits verwendet. Bitte einen neuen Link anfordern.");
      return;
    }
    setMsg(`Authentifizierung fehlgeschlagen: ${String(result?.error_description || result?.error || "Unbekannter Fehler")}`);
  }

  async function run() {
    const auth = window.VDAN_AUTH;
    if (!auth?.consumeAuthCallbackFromUrl) {
      setMsg("Auth-Modul nicht verfügbar.");
      return;
    }

    setMsg("Token wird verarbeitet ...");
    const result = await auth.consumeAuthCallbackFromUrl({ clearUrl: true }).catch((err) => ({
      ok: false,
      error: "callback_processing_failed",
      error_description: err?.message || "Callback konnte nicht verarbeitet werden.",
    }));

    if (!result) {
      setMsg("Keine Auth-Information im Link gefunden.");
      return;
    }

    if (!result.ok) {
      handleError(result);
      return;
    }

    const accessToken = String(result?.session?.access_token || "").trim();
    if (auth?.ensureProfileBootstrap && accessToken) {
      await auth.ensureProfileBootstrap(accessToken).catch(() => null);
    }

    const type = String(result.type || "").toLowerCase();
    if (type === "recovery") {
      setMsg("Reset bestätigt. Weiter zur Passwortänderung ...");
      const target = encodeURIComponent(nextTarget("/app/"));
      window.location.replace(`/app/passwort-aendern/?next=${target}`);
      return;
    }

    if (type === "email_change" || type === "email_change_current" || type === "email_change_new") {
      setMsg("E-Mail bestätigt. Weiter zu den Einstellungen ...");
      const target = toUrl(nextTarget("/app/einstellungen/"));
      const sep = target.includes("?") ? "&" : "?";
      window.location.replace(`${target}${sep}email_change=ok`);
      return;
    }

    setMsg("Erfolgreich authentifiziert. Weiterleitung ...");
    window.location.replace(toUrl(nextTarget("/app/")));
  }

  document.addEventListener("DOMContentLoaded", run);
})();
