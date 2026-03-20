;(() => {
  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  function nextTarget() {
    const q = new URLSearchParams(window.location.search || "");
    const n = String(q.get("next") || "/app/").trim();
    return n.startsWith("/") ? n : "/app/";
  }

  async function sb(path, init = {}) {
    const { url, key } = cfg();
    const session = window.VDAN_AUTH?.loadSession?.();
    const token = String(session?.access_token || "").trim();
    if (!url || !key || !token) throw new Error("Keine aktive Session.");
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Content-Type", "application/json");
    const res = await fetch(`${url}${path}`, { ...init, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(String(data?.message || data?.error || `request_failed_${res.status}`));
    return data;
  }

  async function loadState() {
    const rows = await sb("/rest/v1/rpc/legal_acceptance_state", { method: "POST", body: "{}" });
    if (!Array.isArray(rows) || !rows[0]) throw new Error("status_unavailable");
    return rows[0];
  }

  async function acceptCurrent() {
    const ua = String(navigator.userAgent || "").slice(0, 255);
    const session = window.VDAN_AUTH?.loadSession?.();
    const signerEmail = String(session?.user?.email || "").trim();
    const avvCheck = document.getElementById("legalAcceptAvvCheck");
    const authorityCheck = document.getElementById("legalAcceptAuthorityCheck");
    const signerNameInput = document.getElementById("legalSignerName");
    const signerFunctionInput = document.getElementById("legalSignerFunction");
    const rows = await sb("/rest/v1/rpc/accept_current_legal", {
      method: "POST",
      body: JSON.stringify({
        p_terms: true,
        p_privacy: true,
        p_avv: Boolean(avvCheck?.checked),
        p_user_agent: ua,
        p_authority_confirmed: Boolean(authorityCheck?.checked),
        p_signer_name: String(signerNameInput?.value || "").trim(),
        p_signer_function: String(signerFunctionInput?.value || "").trim(),
        p_signer_email: signerEmail,
      }),
    });
    if (!Array.isArray(rows) || !rows[0]?.ok) throw new Error("acceptance_failed");
    return rows[0];
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const msg = document.getElementById("legalAcceptMsg");
    const info = document.getElementById("legalVersionInfo");
    const check = document.getElementById("legalAcceptCheck");
    const btn = document.getElementById("legalAcceptBtn");
    const avvSection = document.getElementById("legalAvvSection");
    const avvCheck = document.getElementById("legalAcceptAvvCheck");
    const authorityCheck = document.getElementById("legalAcceptAuthorityCheck");
    const signerNameInput = document.getElementById("legalSignerName");
    const signerFunctionInput = document.getElementById("legalSignerFunction");
    const target = nextTarget();
    let avvRequired = false;

    try {
      const state = await loadState();
      const termsV = String(state?.terms_version || "-");
      const privacyV = String(state?.privacy_version || "-");
      const avvV = String(state?.avv_version || "-");
      avvRequired = Boolean(state?.avv_required && !state?.avv_accepted);
      if (info) {
        info.textContent = avvRequired
          ? `Aktuelle Versionen: Nutzungsbedingungen ${termsV}, Datenschutz ${privacyV}, AVV ${avvV}.`
          : `Aktuelle Versionen: Nutzungsbedingungen ${termsV}, Datenschutz ${privacyV}.`;
      }
      if (avvSection) avvSection.style.display = avvRequired ? "block" : "none";
      if (!state?.needs_acceptance) {
        window.location.replace(target);
        return;
      }
    } catch (err) {
      if (msg) msg.textContent = String(err?.message || "Status konnte nicht geladen werden.");
      return;
    }

    if (!btn) return;
    btn.addEventListener("click", async () => {
      if (!check?.checked) {
        if (msg) msg.textContent = "Bitte bestätige die Bedingungen per Checkbox.";
        return;
      }
      if (avvRequired) {
        if (!avvCheck?.checked) {
          if (msg) msg.textContent = "Bitte bestätige zusätzlich den AVV.";
          return;
        }
        if (!authorityCheck?.checked) {
          if (msg) msg.textContent = "Bitte bestätige deine Vertretungs- oder Bevollmächtigungsrolle für den AVV.";
          return;
        }
        if (!String(signerNameInput?.value || "").trim()) {
          if (msg) msg.textContent = "Bitte trage deinen Vor- und Nachnamen für die AVV-Bestätigung ein.";
          return;
        }
        if (!String(signerFunctionInput?.value || "").trim()) {
          if (msg) msg.textContent = "Bitte trage deine Funktion im Verein für die AVV-Bestätigung ein.";
          return;
        }
      }
      if (msg) msg.textContent = "Speichere …";
      try {
        await acceptCurrent();
        if (msg) msg.textContent = "Bestätigung gespeichert. Weiterleitung …";
        window.location.assign(target);
      } catch (err) {
        if (msg) msg.textContent = String(err?.message || "Speichern fehlgeschlagen.");
      }
    });
  });
})();
