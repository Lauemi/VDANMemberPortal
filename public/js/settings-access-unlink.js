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

  function setMsg(text = "", danger = false) {
    const el = document.getElementById("settingsAccessDangerMsg");
    if (!el) return;
    el.textContent = text;
    el.style.color = danger ? "var(--danger)" : "";
  }

  async function readErrorPayload(res) {
    const contentType = String(res.headers?.get?.("content-type") || "").toLowerCase();
    if (contentType.includes("application/json")) {
      const json = await res.json().catch(() => ({}));
      return String(json?.error || json?.message || json?.error_description || "").trim();
    }
    return String(await res.text().catch(() => "")).trim();
  }

  async function callRpc(name, payload = {}) {
    const { url, key } = cfg();
    const token = String(session()?.access_token || "").trim();
    if (!url || !key || !token) throw new Error("Bitte zuerst einloggen.");

    const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload || {}),
    });

    if (!res.ok) {
      throw new Error((await readErrorPayload(res)) || `Request failed (${res.status})`);
    }
    return res.json().catch(() => []);
  }

  function bind() {
    const btn = document.getElementById("settingsAccessUnlinkBtn");
    if (!btn || btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";

    btn.addEventListener("click", async () => {
      const confirmed = window.confirm(
        "Portalzugang wirklich vom Verein entkoppeln? Die Vereinsdaten bleiben beim Verein erhalten."
      );
      if (!confirmed) return;

      btn.disabled = true;
      setMsg("Portalzugang wird entkoppelt ...");
      try {
        await callRpc("self_portal_access_unlink", {});
        setMsg("Portalzugang entkoppelt. Weiterleitung ...");
        window.location.assign("/app/zugang-pruefen/?state=unlinked");
      } catch (err) {
        btn.disabled = false;
        setMsg(err?.message || "Portalzugang konnte nicht entkoppelt werden.", true);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", bind);
})();
