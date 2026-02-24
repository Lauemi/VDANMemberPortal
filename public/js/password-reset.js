;(() => {
  function setMsg(text = "") {
    const el = document.getElementById("forgotPasswordMsg");
    if (el) el.textContent = text;
  }

  function isEnabled(form) {
    return String(form?.dataset?.enabled || "0") === "1";
  }

  function resetRedirectUrl() {
    return `${window.location.origin}/login/`;
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
