;(() => {
  function setMsg(text = "") {
    const el = document.getElementById("forgotPasswordMsg");
    if (el) el.textContent = text;
  }

  function isEnabled(form) {
    return String(form?.dataset?.enabled || "0") === "1";
  }

  function resetRedirectUrl() {
    // No query params — Supabase URL-allowlist matching is exact on the path.
    // Adding ?next=... caused the entry "…/auth/callback" to not match,
    // forcing Supabase to fall back to SITE_URL (homepage) and creating
    // an extra redirect hop. auth-callback.js handles the recovery redirect
    // target internally (always /app/passwort-aendern/ in VDAN mode).
    return `${window.location.origin}/auth/callback/`;
  }

  function bind() {
    const form = document.getElementById("forgotPasswordForm");
    if (!form) return;

    if (!isEnabled(form)) {
      setMsg("Feature ist aktuell deaktiviert, bis alle E-Mail-Adressen geprüft sind.");
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!isEnabled(form)) {
        setMsg("Passwort-Reset ist noch nicht freigeschaltet.");
        return;
      }
      const identifier = String(document.getElementById("forgotPasswordIdentifier")?.value || "").trim();
      if (!identifier) {
        setMsg("Bitte Mitgliedsnummer oder E-Mail eingeben.");
        return;
      }
      try {
        setMsg("Sende...");
        await window.VDAN_AUTH?.requestPasswordReset?.(identifier, resetRedirectUrl());
        setMsg("Wenn Daten vorhanden sind, wurde ein Reset-Link versendet.");
      } catch (err) {
        setMsg(err?.message || "Konnte Reset-Link nicht senden.");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", bind);
})();
