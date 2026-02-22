;(() => {
  const MANAGER_ROLES = new Set(["admin", "vorstand"]);
  let scanTimer = null;
  let scanStream = null;
  let detector = null;
  let currentVerified = null;
  let verdictTimer = null;
  let restartingAfterVerdict = false;
  let scanReadyAt = 0;
  let lastPayloadSig = "";
  let lastPayloadHits = 0;

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

  function forceHideVerdict() {
    const overlay = document.getElementById("scanVerdictOverlay");
    if (!overlay) return;
    overlay.hidden = true;
    overlay.style.display = "none";
  }

  function setInlineStatus(text = "", state = "neutral") {
    const el = document.getElementById("scanInlineStatus");
    if (!el) return;
    el.textContent = text;
    el.classList.remove("is-valid", "is-invalid");
    if (state === "valid") el.classList.add("is-valid");
    if (state === "invalid") el.classList.add("is-invalid");
  }

  function showScanVerdict(valid, payload = null) {
    const overlay = document.getElementById("scanVerdictOverlay");
    const icon = document.getElementById("scanVerdictIcon");
    const title = document.getElementById("scanVerdictTitle");
    const meta = document.getElementById("scanVerdictMeta");
    if (!overlay || !icon || !title || !meta) return;

    if (verdictTimer) {
      clearTimeout(verdictTimer);
      verdictTimer = null;
    }

    const isValid = Boolean(valid);
    overlay.style.display = "";
    overlay.classList.toggle("is-invalid", !isValid);
    icon.textContent = isValid ? "✓" : "✕";
    title.textContent = isValid ? "GÜLTIG" : "UNGÜLTIG";
    meta.textContent = payload?.display_name
      ? `${String(payload.display_name)}${payload?.member_no ? ` · ${String(payload.member_no)}` : ""}`
      : (isValid ? "Ausweis verifiziert" : "Ausweis nicht gültig");
    overlay.hidden = false;
    setInlineStatus(isValid ? "Gültig" : "Ungültig", isValid ? "valid" : "invalid");

    verdictTimer = window.setTimeout(() => {
      forceHideVerdict();
      verdictTimer = null;
      if (!restartingAfterVerdict) {
        restartingAfterVerdict = true;
        startScanner()
          .catch(() => {})
          .finally(() => {
            restartingAfterVerdict = false;
          });
      }
    }, 10000);
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

  function renderController(profile) {
    const nameEl = document.getElementById("verifyControllerName");
    const idEl = document.getElementById("verifyControllerId");
    if (!nameEl || !idEl) return;
    const displayName = String(profile?.display_name || "").trim() || String(session()?.user?.email || "").trim() || "Kontrolleur";
    const controlId = String(profile?.member_no || "").trim() || `UID-${String(uid() || "").slice(0, 8)}`;
    nameEl.textContent = displayName;
    idEl.textContent = controlId;
  }

  async function loadControllerProfile() {
    if (!uid()) return null;
    const rows = await sb(`/rest/v1/profiles?select=display_name,member_no&id=eq.${encodeURIComponent(uid())}&limit=1`, { method: "GET" }, true);
    return Array.isArray(rows) ? (rows[0] || null) : null;
  }

  function renderResult(payload) {
    const root = document.getElementById("cardVerifyResult");
    if (!root) return;
    if (!payload || payload.ok !== true) {
      currentVerified = null;
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
      if (result?.ok) {
        showScanVerdict(Boolean(result?.valid), result);
      } else {
        showScanVerdict(false, result);
      }
      setMsg(result?.ok ? "" : "Ausweis nicht gefunden.");
    } catch (err) {
      setMsg(err?.message || "Prüfung fehlgeschlagen.");
      renderResult({ ok: false });
      showScanVerdict(false, null);
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
    forceHideVerdict();
    stopScanner();
    if (!window.isSecureContext) {
      setMsg("Kamera nur in sicherem Kontext (HTTPS) verfuegbar.");
      setInlineStatus("HTTPS erforderlich", "invalid");
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMsg("Browser unterstuetzt keine Kamera-API (getUserMedia).");
      setInlineStatus("Kamera-API fehlt", "invalid");
      return;
    }
    if (!("BarcodeDetector" in window)) {
      setMsg("QR-Scan im Browser nicht unterstützt. Bitte manuell prüfen.");
      return;
    }

    detector = detector || new window.BarcodeDetector({ formats: ["qr_code"] });
    try {
      scanStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      video.srcObject = scanStream;
      video.muted = true;
      video.setAttribute("muted", "");
      video.setAttribute("autoplay", "");
      video.setAttribute("playsinline", "");
      await video.play();
      setMsg("Scanner aktiv…");
      setInlineStatus("Bereit für Scan", "neutral");
      scanReadyAt = Date.now() + 2000;
      lastPayloadSig = "";
      lastPayloadHits = 0;

      scanTimer = window.setInterval(async () => {
        if (!video.videoWidth || !video.videoHeight) return;
        const codes = await detector.detect(video).catch(() => []);
        const val = codes?.[0]?.rawValue;
        if (!val) return;
        if (Date.now() < scanReadyAt) return;
        const parsed = parseQrPayload(val);
        if (!parsed) return;
        const sig = `${parsed.card}::${parsed.key}`;
        if (sig !== lastPayloadSig) {
          lastPayloadSig = sig;
          lastPayloadHits = 1;
          return;
        }
        lastPayloadHits += 1;
        if (lastPayloadHits < 2) return;
        stopScanner();
        lastPayloadSig = "";
        lastPayloadHits = 0;
        await verify(parsed.card, parsed.key);
      }, 450);
    } catch (err) {
      const reason = String(err?.message || "");
      if (reason.toLowerCase().includes("permission") || reason.toLowerCase().includes("notallowed")) {
        setMsg("Kein Kamerazugriff. Browser-Berechtigung fuer Kamera erlauben.");
      } else if (reason.toLowerCase().includes("notfound")) {
        setMsg("Keine Kamera gefunden.");
      } else {
        setMsg(reason || "Kamera konnte nicht gestartet werden.");
      }
      setInlineStatus("Scanner nicht verfügbar", "invalid");
    }
  }

  function bindUi() {
    document.getElementById("cardVerifyScanStart")?.addEventListener("click", startScanner);
    document.getElementById("cardVerifyScanStop")?.addEventListener("click", stopScanner);
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

    const profile = await loadControllerProfile().catch(() => null);
    renderController(profile);
    bindUi();
    forceHideVerdict();
    if (window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    // Open scanner directly for quick gate workflow.
    await startScanner();
  }

  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("beforeunload", stopScanner);
})();
