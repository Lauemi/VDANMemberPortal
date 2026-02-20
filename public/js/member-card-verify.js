;(() => {
  const MANAGER_ROLES = new Set(["admin", "vorstand"]);
  let scanTimer = null;
  let scanStream = null;
  let detector = null;
  let currentVerified = null;

  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  function uid() {
    return session()?.user?.id || null;
  }

  function setMsg(text = "") {
    const el = document.getElementById("memberCardVerifyMsg");
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  async function sb(path, init = {}, withAuth = false) {
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    if (withAuth && session()?.access_token) headers.set("Authorization", `Bearer ${session().access_token}`);
    const res = await fetch(`${url}${path}`, { ...init, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || err?.hint || err?.error_description || `Request failed (${res.status})`);
    }
    return res.json().catch(() => ({}));
  }

  async function loadRoles() {
    if (!uid()) return [];
    const rows = await sb(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(uid())}`, { method: "GET" }, true);
    return Array.isArray(rows) ? rows.map((r) => String(r.role || "").toLowerCase()) : [];
  }

  function renderResult(payload) {
    const root = document.getElementById("cardVerifyResult");
    if (!root) return;
    if (!payload || payload.ok !== true) {
      currentVerified = null;
      const rotateBtn = document.getElementById("cardRotateBtn");
      if (rotateBtn) rotateBtn.disabled = true;
      root.innerHTML = `
        <div class="card__body">
          <h3>Nicht gültig</h3>
          <p class="small">Ausweis konnte nicht verifiziert werden (ID/Schlüssel falsch oder nicht vorhanden).</p>
        </div>
      `;
      return;
    }

    const valid = Boolean(payload.valid);
    currentVerified = payload;
    const rotateBtn = document.getElementById("cardRotateBtn");
    if (rotateBtn) rotateBtn.disabled = false;
    root.style.borderColor = valid ? "rgba(56,184,98,.52)" : "rgba(196,64,64,.52)";
    root.innerHTML = `
      <div class="card__body">
        <h3>${valid ? "Ausweis gültig" : "Ausweis ungültig"}</h3>
        <p class="small">Name: <strong>${escapeHtml(payload.display_name || "-")}</strong></p>
        <p class="small">Mitgliedsnummer: <strong>${escapeHtml(payload.member_no || "-")}</strong></p>
        <p class="small">Ausweis-ID: <strong>${escapeHtml(payload.member_card_id || "-")}</strong></p>
        <p class="small">Rolle: <strong>${escapeHtml(payload.role || "member")}</strong></p>
        <p class="small">Angelberechtigung: <strong>${escapeHtml(payload.fishing_card_type || "-")}</strong></p>
        <p class="small">Gültigkeit: <strong>${escapeHtml(String(payload.member_card_valid_from || "-"))}</strong> bis <strong>${escapeHtml(String(payload.member_card_valid_until || "-"))}</strong></p>
      </div>
    `;
  }

  function parseQrPayload(raw) {
    const txt = String(raw || "").trim();
    if (!txt) return null;
    try {
      const url = new URL(txt);
      const card = String(url.searchParams.get("card") || "").trim();
      const key = String(url.searchParams.get("key") || "").trim();
      if (card && key) return { card, key };
    } catch {}
    return null;
  }

  async function verify(card, key) {
    if (!card || !key) {
      setMsg("Ausweis-ID und Schlüssel sind erforderlich.");
      return;
    }
    setMsg("Prüfe Ausweis…");
    try {
      const result = await sb("/rest/v1/rpc/member_card_verify", {
        method: "POST",
        body: JSON.stringify({ p_card_id: card, p_key: key }),
      }, true);
      renderResult(result);
      setMsg(result?.ok ? "" : "Ausweis nicht gefunden.");
    } catch (err) {
      setMsg(err?.message || "Prüfung fehlgeschlagen.");
      renderResult({ ok: false });
    }
  }

  async function rotateKey() {
    if (!currentVerified?.ok) {
      setMsg("Erst Ausweis verifizieren.");
      return;
    }
    const cardId = String(currentVerified.member_card_id || "").trim();
    const keyInput = document.getElementById("cardVerifyKey");
    const oldKey = String(keyInput?.value || "").trim();
    if (!cardId || !oldKey) {
      setMsg("Ausweis-ID/Schlüssel fehlen.");
      return;
    }
    if (!window.confirm("Schlüssel jetzt rotieren? Der alte QR/Schlüssel wird sofort ungültig.")) return;
    setMsg("Schlüssel wird rotiert…");
    try {
      const out = await sb("/rest/v1/rpc/member_card_rotate_key", {
        method: "POST",
        body: JSON.stringify({ p_card_id: cardId, p_key: oldKey }),
      }, true);
      if (!out?.ok) {
        setMsg("Rotation fehlgeschlagen.");
        return;
      }
      if (keyInput) keyInput.value = String(out.member_card_key || "");
      setMsg("Schlüssel rotiert. Bitte neuen QR/Schlüssel verwenden.");
      await verify(cardId, String(out.member_card_key || ""));
    } catch (err) {
      setMsg(err?.message || "Rotation fehlgeschlagen.");
    }
  }

  function stopScanner() {
    if (scanTimer) {
      clearInterval(scanTimer);
      scanTimer = null;
    }
    if (scanStream) {
      scanStream.getTracks().forEach((t) => t.stop());
      scanStream = null;
    }
    const video = document.getElementById("cardVerifyVideo");
    if (video) video.srcObject = null;
  }

  async function startScanner() {
    const video = document.getElementById("cardVerifyVideo");
    if (!video) return;
    stopScanner();
    if (!("BarcodeDetector" in window)) {
      setMsg("QR-Scan im Browser nicht unterstützt. Bitte manuell prüfen.");
      return;
    }

    detector = detector || new window.BarcodeDetector({ formats: ["qr_code"] });
    try {
      scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      video.srcObject = scanStream;
      await video.play();
      setMsg("Scanner aktiv…");

      scanTimer = window.setInterval(async () => {
        if (!video.videoWidth || !video.videoHeight) return;
        const codes = await detector.detect(video).catch(() => []);
        const val = codes?.[0]?.rawValue;
        if (!val) return;
        const parsed = parseQrPayload(val);
        if (!parsed) return;
        stopScanner();
        const idEl = document.getElementById("cardVerifyId");
        const keyEl = document.getElementById("cardVerifyKey");
        if (idEl) idEl.value = parsed.card;
        if (keyEl) keyEl.value = parsed.key;
        await verify(parsed.card, parsed.key);
      }, 450);
    } catch (err) {
      setMsg(err?.message || "Kamera konnte nicht gestartet werden.");
    }
  }

  function bindUi() {
    document.getElementById("cardVerifyBtn")?.addEventListener("click", async () => {
      const card = String(document.getElementById("cardVerifyId")?.value || "").trim();
      const key = String(document.getElementById("cardVerifyKey")?.value || "").trim();
      await verify(card, key);
    });

    document.getElementById("cardVerifyScanStart")?.addEventListener("click", startScanner);
    document.getElementById("cardVerifyScanStop")?.addEventListener("click", stopScanner);
    document.getElementById("cardRotateBtn")?.addEventListener("click", rotateKey);
  }

  async function init() {
    const { url, key } = cfg();
    if (!url || !key) {
      setMsg("Supabase-Konfiguration fehlt.");
      return;
    }
    const roles = await loadRoles().catch(() => []);
    const isManager = roles.some((r) => MANAGER_ROLES.has(r));
    if (!isManager) {
      setMsg("Kein Zugriff: nur Vorstand/Admin.");
      return;
    }

    bindUi();
    const q = new URLSearchParams(window.location.search);
    const card = String(q.get("card") || "").trim();
    const mkey = String(q.get("key") || "").trim();
    if (card && mkey) {
      const idEl = document.getElementById("cardVerifyId");
      const keyEl = document.getElementById("cardVerifyKey");
      if (idEl) idEl.value = card;
      if (keyEl) keyEl.value = mkey;
      await verify(card, mkey);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("beforeunload", stopScanner);
})();
