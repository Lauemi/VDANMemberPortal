;(() => {
  let turnstileToken = "";

  window.onTurnstileDone = (token) => {
    turnstileToken = String(token || "");
  };

  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
    };
  }

  function msg(text = "", isError = false) {
    const el = document.getElementById("contactFormMsg");
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? "#fecaca" : "";
  }

  async function submit(e) {
    e.preventDefault();
    msg("");
    const form = e.currentTarget;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const first = String(document.getElementById("fname")?.value || "").trim();
      const last = String(document.getElementById("lname")?.value || "").trim();
      const email = String(document.getElementById("email")?.value || "").trim();
      const subject = String(document.getElementById("subject")?.value || "").trim();
      const message = String(document.getElementById("message")?.value || "").trim();
      const hp = String(document.getElementById("hpCompany")?.value || "").trim();

      if (first.length < 2 || last.length < 2) throw new Error("Bitte Vor- und Nachname korrekt ausfüllen.");
      if (!email || !subject || message.length < 30) throw new Error("Bitte Pflichtfelder ausfüllen (Nachricht mind. 30 Zeichen).");
      const turnstileRequired = String(form.getAttribute("data-turnstile-required") || "false") === "true";
      if (turnstileRequired && !turnstileToken) throw new Error("Bitte Captcha bestätigen.");

      const { url } = cfg();
      if (!url) throw new Error("Backend-Konfiguration fehlt.");

      const res = await fetch(`${url}/functions/v1/contact-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${first} ${last}`,
          email,
          subject,
          message,
          hp_company: hp,
          turnstile_token: turnstileToken || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Anfrage fehlgeschlagen (${res.status})`);
      }

      msg("Anfrage gesendet. Bitte bestätige jetzt den Link in deiner E-Mail.");
      form.reset();
      turnstileToken = "";
      if (window.turnstile && typeof window.turnstile.reset === "function") {
        window.turnstile.reset();
      }
    } catch (err) {
      msg(err?.message || "Senden fehlgeschlagen.", true);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("contact");
    if (!form) return;
    form.addEventListener("submit", submit);
  });
})();
