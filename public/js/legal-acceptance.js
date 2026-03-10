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
    const rows = await sb("/rest/v1/rpc/accept_current_legal", {
      method: "POST",
      body: JSON.stringify({ p_terms: true, p_privacy: true, p_user_agent: ua }),
    });
    if (!Array.isArray(rows) || !rows[0]?.ok) throw new Error("acceptance_failed");
    return rows[0];
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const msg = document.getElementById("legalAcceptMsg");
    const info = document.getElementById("legalVersionInfo");
    const check = document.getElementById("legalAcceptCheck");
    const btn = document.getElementById("legalAcceptBtn");
    const target = nextTarget();

    try {
      const state = await loadState();
      const termsV = String(state?.terms_version || "-");
      const privacyV = String(state?.privacy_version || "-");
      if (info) info.textContent = `Aktuelle Versionen: Nutzungsbedingungen ${termsV}, Datenschutz ${privacyV}.`;
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
