;(() => {
  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  async function sb(path, init = {}, withAuth = false) {
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    if (withAuth && session()?.access_token) headers.set("Authorization", `Bearer ${session().access_token}`);
    const res = await fetch(`${url}${path}`, { ...init, headers });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res.json().catch(() => ({}));
  }

  function setMsg(text = "", isError = false) {
    const el = document.getElementById("clubRequestPendingMsg");
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? "var(--danger)" : "";
  }

  async function loadGate() {
    const rows = await sb("/rest/v1/rpc/club_request_gate_state", {
      method: "POST",
      body: "{}",
    }, true);
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  }

  function render(state) {
    const title = document.getElementById("clubRequestPendingTitle");
    const lead = document.getElementById("clubRequestPendingLead");
    const box = document.getElementById("clubRequestPendingBox");
    if (!title || !lead || !box) return;

    const status = String(state?.status || "").trim().toLowerCase();
    const clubName = String(state?.club_name || "dein Verein").trim();
    const responsibleEmail = String(state?.responsible_email || "").trim();
    const rejectionReason = String(state?.rejection_reason || "").trim();

    if (status === "approved") {
      title.textContent = "Anfrage freigegeben";
      lead.textContent = "Dein Verein wurde freigeschaltet. Du wirst jetzt ins Portal weitergeleitet.";
      box.textContent = `${clubName} ist freigegeben.`;
      window.setTimeout(() => window.location.replace("/app/"), 800);
      return;
    }

    if (status === "rejected") {
      title.textContent = "Anfrage derzeit nicht freigegeben";
      lead.textContent = "Dein Benutzerkonto bleibt bestehen, aber der Verein wurde noch nicht fuer das Portal zugelassen.";
      box.textContent = rejectionReason
        ? `${clubName}: ${rejectionReason}`
        : `${clubName} wurde derzeit nicht freigegeben.`;
      return;
    }

    title.textContent = "Dein Verein wurde erfolgreich angefragt.";
    lead.textContent = "Solange die Anfrage den Status pending hat, bleibt der Portalzugang gesperrt. Du siehst bis zur Entscheidung nur diese Statusseite.";
    box.textContent = responsibleEmail
      ? `${clubName} wird gerade geprüft. Updates gehen an ${responsibleEmail}.`
      : `${clubName} wird gerade geprüft. Bis zur Freigabe bleibt nur die Statusseite verfügbar.`;
  }

  async function refresh() {
    setMsg("Lade Status...");
    const gate = await loadGate();
    render(gate);
    setMsg(gate ? "Status aktualisiert." : "Noch keine Vereinsanfrage gefunden.", !gate);
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("clubRequestPendingReload")?.addEventListener("click", () => {
      refresh().catch((err) => setMsg(err?.message || "Status konnte nicht geladen werden.", true));
    });
    refresh().catch((err) => setMsg(err?.message || "Status konnte nicht geladen werden.", true));
  });
})();



