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
  let jsQrLoader = null;
  let qrCanvas = null;
  let qrCtx = null;
  let verifyKeyPromise = null;

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

  function isLikelyIos() {
    const ua = String(navigator.userAgent || "").toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
  }

  function ensureQrCanvas() {
    if (!qrCanvas) {
      qrCanvas = document.createElement("canvas");
      qrCtx = qrCanvas.getContext("2d", { willReadFrequently: true });
    }
    return qrCtx ? { canvas: qrCanvas, ctx: qrCtx } : null;
  }

  async function ensureJsQr() {
    if (typeof window.jsQR === "function") return window.jsQR;
    if (!jsQrLoader) {
      jsQrLoader = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
        s.async = true;
        s.onload = () => resolve(window.jsQR);
        s.onerror = () => reject(new Error("jsQR konnte nicht geladen werden."));
        document.head.appendChild(s);
      });
    }
    const fn = await jsQrLoader;
    if (typeof fn !== "function") throw new Error("jsQR nicht verfuegbar.");
    return fn;
  }

  function readQrByJsQr(video, jsQR) {
    const surface = ensureQrCanvas();
    if (!surface) return null;
    const { canvas, ctx } = surface;
    const w = Number(video.videoWidth || 0);
    const h = Number(video.videoHeight || 0);
    if (!w || !h) return null;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    const image = ctx.getImageData(0, 0, w, h);
    const out = jsQR(image.data, w, h, { inversionAttempts: "dontInvert" });
    return out?.data ? String(out.data) : null;
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
    const cacheKey = `scanner_roles_v1:${uid()}`;
    try {
      const rows = await sb(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(uid())}`, { method: "GET" }, true);
      const roles = Array.isArray(rows) ? rows.map((r) => String(r.role || "").toLowerCase()) : [];
      await window.VDAN_OFFLINE_STORE?.setJSON?.(cacheKey, roles);
      return roles;
    } catch {
      const cached = await window.VDAN_OFFLINE_STORE?.getJSON?.(cacheKey);
      return Array.isArray(cached) ? cached.map((r) => String(r || "").toLowerCase()) : [];
    }
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
      const ot = String(url.searchParams.get("ot") || "").trim();
      if (card && key) return { card, key, ot: ot || null };
      if (ot) return { card: "", key: "", ot };
    } catch {}
    return null;
  }

  function base64UrlToBytes(input) {
    const padded = String(input || "").replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(String(input || "").length / 4) * 4, "=");
    const raw = atob(padded);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
  }

  function pemToSpkiBytes(pem) {
    const clean = String(pem || "")
      .replace(/-----BEGIN PUBLIC KEY-----/g, "")
      .replace(/-----END PUBLIC KEY-----/g, "")
      .replace(/\s+/g, "");
    return base64UrlToBytes(clean.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""));
  }

  async function getVerifyKey() {
    const pem = String(window.__APP_MEMBER_CARD_VERIFY_PUBKEY || "").trim();
    if (!pem) return null;
    if (!verifyKeyPromise) {
      verifyKeyPromise = crypto.subtle.importKey(
        "spki",
        pemToSpkiBytes(pem),
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"],
      ).catch(() => null);
    }
    return await verifyKeyPromise;
  }

  function decodeJwtPart(part) {
    const raw = new TextDecoder().decode(base64UrlToBytes(part));
    return JSON.parse(raw);
  }

  function isoDateOnlyToMs(value, endOfDay = false) {
    if (!value) return null;
    const tail = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
    const ms = new Date(`${value}${tail}`).getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  async function verifyOfflineToken(token) {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) throw new Error("Tokenformat ungültig.");
    const [h, p, s] = parts;
    const header = decodeJwtPart(h);
    const payload = decodeJwtPart(p);
    if (String(header?.alg || "") !== "ES256") throw new Error("Token-Algorithmus ungültig.");
    if (String(payload?.aud || "") !== "member-card-offline-verify") throw new Error("Token-Audience ungültig.");
    const exp = Number(payload?.exp || 0);
    const nowSec = Math.floor(Date.now() / 1000);
    if (!exp || exp <= nowSec) throw new Error("Token abgelaufen.");

    const key = await getVerifyKey();
    if (!key) throw new Error("Offline-Verifikationsschlüssel fehlt.");
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      base64UrlToBytes(s),
      new TextEncoder().encode(`${h}.${p}`),
    );
    if (!ok) throw new Error("Token-Signatur ungültig.");

    const validFromMs = isoDateOnlyToMs(payload?.member_card_valid_from, false);
    const validUntilMs = isoDateOnlyToMs(payload?.member_card_valid_until, true);
    const nowMs = Date.now();
    const inValidity = (!validFromMs || nowMs >= validFromMs) && (!validUntilMs || nowMs <= validUntilMs);
    const valid = Boolean(payload?.member_card_valid) && inValidity;
    return {
      ok: true,
      valid,
      display_name: payload?.display_name || "-",
      member_no: payload?.member_no || "-",
      member_card_id: payload?.card_id || "-",
      fishing_card_type: payload?.fishing_card_type || "-",
      role: payload?.role || "member",
      member_card_valid_from: payload?.member_card_valid_from || null,
      member_card_valid_until: payload?.member_card_valid_until || null,
      source: "offline_token",
    };
  }

  async function verify(card, key, offlineToken = null) {
    if (!navigator.onLine) {
      if (!offlineToken) {
        setMsg("Offline: keine verifizierbaren Tokendaten im QR.");
        setInlineStatus("Offline: keine Verifikation", "invalid");
        renderResult({ ok: false });
        showScanVerdict(false, null);
        return;
      }
      try {
        const result = await verifyOfflineToken(offlineToken);
        renderResult(result);
        showScanVerdict(Boolean(result?.valid), result);
        setMsg(result.valid ? "Offline verifiziert." : "Offline geprüft: ungültig.");
      } catch (err) {
        setMsg(err?.message || "Offline-Verifikation fehlgeschlagen.");
        setInlineStatus("Offline: ungültig", "invalid");
        renderResult({ ok: false });
        showScanVerdict(false, null);
      }
      return;
    }

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
      setMsg("Kamera nur über HTTPS oder localhost verfügbar. Auf Android im Browser bitte die https:// Adresse öffnen.");
      setInlineStatus("HTTPS erforderlich", "invalid");
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMsg("Browser unterstuetzt keine Kamera-API (getUserMedia).");
      setInlineStatus("Kamera-API fehlt", "invalid");
      return;
    }
    const hasBarcodeDetector = "BarcodeDetector" in window;
    if (hasBarcodeDetector) {
      detector = detector || new window.BarcodeDetector({ formats: ["qr_code"] });
    } else {
      await ensureJsQr();
    }
    try {
      const constraints = [
        { video: { facingMode: { exact: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: true, audio: false },
      ];
      let lastErr = null;
      for (const c of constraints) {
        try {
          scanStream = await navigator.mediaDevices.getUserMedia(c);
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!scanStream) throw lastErr || new Error("Kamera konnte nicht gestartet werden.");
      video.srcObject = scanStream;
      video.muted = true;
      video.setAttribute("muted", "");
      video.setAttribute("autoplay", "");
      video.setAttribute("playsinline", "");
      await video.play();
      setMsg(hasBarcodeDetector ? "Scanner aktiv…" : "Scanner aktiv (iOS-Fallback)...");
      setInlineStatus("Bereit für Scan", "neutral");
      scanReadyAt = Date.now() + 2000;
      lastPayloadSig = "";
      lastPayloadHits = 0;

      scanTimer = window.setInterval(async () => {
        if (!video.videoWidth || !video.videoHeight) return;
        let val = null;
        if (detector) {
          const codes = await detector.detect(video).catch(() => []);
          val = codes?.[0]?.rawValue || null;
        } else if (typeof window.jsQR === "function") {
          val = readQrByJsQr(video, window.jsQR);
        }
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
        await verify(parsed.card, parsed.key, parsed.ot || null);
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
