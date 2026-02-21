;(() => {
  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  function userId() {
    return session()?.user?.id || null;
  }

  async function sb(path, init = {}, withAuth = false) {
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    if (withAuth && session()?.access_token) {
      headers.set("Authorization", `Bearer ${session().access_token}`);
    }
    const res = await fetch(`${url}${path}`, { ...init, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || err?.hint || err?.error_description || `Request failed (${res.status})`);
    }
    return res.json().catch(() => ({}));
  }

  function setMsg(text = "") {
    const el = document.getElementById("memberCardMsg");
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function hasExternalMediaConsent() {
    return Boolean(window.VDAN_CONSENT?.has?.("external_media"));
  }

  function asDate(d) {
    if (!d) return "-";
    const t = new Date(d);
    if (Number.isNaN(t.getTime())) return String(d);
    return t.toLocaleDateString("de-DE");
  }

  function isManagerRole(roles) {
    const list = Array.isArray(roles) ? roles.map((r) => String(r || "").toLowerCase()) : [];
    return list.includes("admin") || list.includes("vorstand");
  }

  async function loadRoles() {
    if (!userId()) return [];
    const rows = await sb(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId())}`, { method: "GET" }, true);
    return Array.isArray(rows) ? rows.map((r) => String(r.role || "").toLowerCase()) : [];
  }

  function parseCardScope(fishingCardType) {
    const t = String(fishingCardType || "").toLocaleLowerCase("de-DE");
    const hasVgw = t.includes("innenwasser") || t.includes("innewasser") || t.includes("vereins");
    const hasR39 = t.includes("rheinlos") || t.includes("rhein");
    return { hasVgw, hasR39 };
  }

  function isAllowed(areaKind, scope) {
    if (areaKind === "vereins_gemeinschaftsgewaesser") return scope.hasVgw;
    if (areaKind === "rheinlos39") return scope.hasR39;
    return false;
  }

  async function listWaters() {
    const rows = await sb("/rest/v1/water_bodies?select=name,area_kind,is_active&is_active=eq.true&order=name.asc", { method: "GET" }, true);
    return Array.isArray(rows) ? rows : [];
  }

  function renderCard(profile, waters) {
    const box = document.getElementById("memberCardBox");
    if (!box) return;
    const isValid = Boolean(profile.member_card_valid);
    const validFrom = profile.member_card_valid_from;
    const validUntil = profile.member_card_valid_until;
    const validityText = isValid
      ? `Gültig vom ${asDate(validFrom)} bis ${asDate(validUntil)}`
      : "Aktuell ungültig";
    const cardId = String(profile.member_card_id || "-");
    const cardKey = String(profile.member_card_key || "-");
    const qrUrl = new URL("/app/ausweis/verifizieren/", window.location.origin);
    qrUrl.searchParams.set("card", cardId);
    qrUrl.searchParams.set("key", cardKey);
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(qrUrl.toString())}`;
    const qrAllowed = hasExternalMediaConsent();
    const scope = parseCardScope(profile.fishing_card_type);
    const waterRows = (Array.isArray(waters) ? waters : []).map((w) => {
      const allowed = isAllowed(w.area_kind, scope);
      const bg = allowed ? "rgba(56, 184, 98, .17)" : "rgba(191, 66, 66, .16)";
      const border = allowed ? "rgba(56, 184, 98, .42)" : "rgba(191, 66, 66, .42)";
      return `
        <li style="display:flex;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid ${border};border-radius:8px;background:${bg};">
          <span>${escapeHtml(w.name || "-")}</span>
          <strong>${allowed ? "Erlaubt" : "Verboten"}</strong>
        </li>
      `;
    }).join("");

    box.style.borderColor = isValid ? "rgba(56, 184, 98, .45)" : "rgba(191, 66, 66, .45)";
    box.innerHTML = `
      <div class="card__body member-card-body">
        <div class="member-card-top">
          <div class="member-card-meta">
            <div><strong>${escapeHtml(profile.display_name || "Mitglied")}</strong></div>
            <div class="small">Mitgliedsnummer: <strong>${escapeHtml(profile.member_no || "-")}</strong></div>
            <div class="small">Ausweis-ID: <strong>${escapeHtml(cardId)}</strong></div>
            <div class="small">Gültigkeitsschlüssel: <strong>${escapeHtml(cardKey)}</strong></div>
            <div class="small">Karte: <strong>${escapeHtml(profile.fishing_card_type || "-")}</strong></div>
            <div class="small">Status: <strong>${isValid ? "Gültig" : "Ungültig"}</strong></div>
            <div class="small">${escapeHtml(validityText)}</div>
          </div>
          <div class="card-qr-flip" data-qr-flip>
            <div class="card-qr-flip__inner">
              <div class="card-qr-flip__face card-qr-flip__face--front">
                <button type="button" class="feed-btn" data-qr-toggle>Kontrolle</button>
              </div>
              <div class="card-qr-flip__face card-qr-flip__face--back">
                ${qrAllowed ? `
                  <img src="${escapeHtml(qrImg)}" width="140" height="140" alt="QR zur Ausweisverifikation" />
                ` : `
                  <div class="external-media-lock" style="max-width:220px;">
                    <p class="small">QR-Anzeige nutzt einen externen Dienst.</p>
                    <button type="button" class="feed-btn feed-btn--ghost" data-open-consent-settings>Freigabe erteilen</button>
                  </div>
                `}
                <button type="button" class="feed-btn feed-btn--ghost" data-qr-toggle style="margin-top:8px;">Zurück</button>
              </div>
            </div>
          </div>
        </div>

        <div class="small member-card-legal">
          Dieser digitale Mitgliedsausweis ist personenbezogen und nur in Verbindung mit einem amtlichen Ausweis gültig.
          Die Berechtigung gilt ausschließlich im angegebenen Zeitraum und kann durch Vorstand/Admin jederzeit digital verifiziert werden.
        </div>

        <details>
          <summary style="cursor:pointer;font-weight:600;">Gewässer-Berechtigung anzeigen</summary>
          <div style="margin-top:8px;">
            <ul style="list-style:none;margin:0;padding:0;display:grid;gap:6px;">
              ${waterRows || `<li class="small">Keine Gewässer gefunden.</li>`}
            </ul>
          </div>
        </details>
      </div>
    `;

    const flip = box.querySelector("[data-qr-flip]");
    const toggles = box.querySelectorAll("[data-qr-toggle]");
    toggles.forEach((btn) => {
      btn.addEventListener("click", () => {
        flip?.classList.toggle("is-revealed");
      });
    });
  }

  async function init() {
    if (!userId()) {
      setMsg("Nicht eingeloggt.");
      return;
    }
    try {
      setMsg("Lade Ausweis…");
      const [rows, waters, roles] = await Promise.all([
        sb(`/rest/v1/profiles?select=display_name,member_no,fishing_card_type,member_card_valid,member_card_valid_from,member_card_valid_until,member_card_id,member_card_key&id=eq.${encodeURIComponent(userId())}&limit=1`, { method: "GET" }, true),
        listWaters(),
        loadRoles(),
      ]);
      const p = Array.isArray(rows) ? rows[0] : null;
      if (!p) {
        setMsg("Kein Profil gefunden.");
        return;
      }
      renderCard(p, waters);
      const verifyLink = document.querySelector('[data-manager-only]');
      if (verifyLink) {
        const show = isManagerRole(roles);
        verifyLink.classList.toggle("hidden", !show);
        verifyLink.toggleAttribute("hidden", !show);
      }
      setMsg("");
    } catch (err) {
      setMsg(err?.message || "Ausweis konnte nicht geladen werden.");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:consent-changed", init);
})();
