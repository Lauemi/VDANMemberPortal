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

  const OFFLINE_TOKEN_401_BACKOFF_MS = 6 * 60 * 60 * 1000;

  function offlineTokenFailKey() {
    return `vdan_member_card_offline_token_fail_until_v1:${userId() || "anon"}`;
  }

  function setOfflineTokenFailBackoff() {
    try {
      sessionStorage.setItem(offlineTokenFailKey(), String(Date.now() + OFFLINE_TOKEN_401_BACKOFF_MS));
    } catch {
      // ignore
    }
  }

  function hasOfflineTokenFailBackoff() {
    try {
      const until = Number(sessionStorage.getItem(offlineTokenFailKey()) || "0");
      return Number.isFinite(until) && until > Date.now();
    } catch {
      return false;
    }
  }

  function clearOfflineTokenFailBackoff() {
    try {
      sessionStorage.removeItem(offlineTokenFailKey());
    } catch {
      // ignore
    }
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

  async function fetchOfflineVerifyToken() {
    const { url, key } = cfg();
    if (!url || !key) return null;
    let active = await window.VDAN_AUTH?.refreshSession?.().catch(() => null);
    if (!active?.access_token) active = session();
    if (!active?.access_token) return null;

    async function requestWith(token) {
      const res = await fetch(`${url}/functions/v1/member-card-offline-token`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      return res;
    }

    let res = await requestWith(active.access_token);
    if (res.status === 401) {
      const refreshed = await window.VDAN_AUTH?.refreshSession?.();
      if (!refreshed?.access_token) return null;
      res = await requestWith(refreshed.access_token);
    }
    if (res.status === 401) {
      setOfflineTokenFailBackoff();
      return null;
    }
    if (!res.ok) return null;
    const out = await res.json().catch(() => null);
    if (!out?.ok || !out?.token) return null;
    clearOfflineTokenFailBackoff();
    return {
      token: String(out.token),
      exp: Number(out.exp || 0) || 0,
    };
  }

  function offlineTokenCacheKey() {
    return `vdan_member_card_offline_token_v1:${userId() || "anon"}`;
  }

  async function loadCachedOfflineToken() {
    const key = offlineTokenCacheKey();
    const row = await window.VDAN_OFFLINE_STORE?.getJSON?.(key);
    if (!row || typeof row !== "object") return null;
    const exp = Number(row.exp || 0);
    const now = Math.floor(Date.now() / 1000);
    if (!exp || exp <= now + 60) return null;
    const token = String(row.token || "").trim();
    return token ? { token, exp } : null;
  }

  async function saveCachedOfflineToken(value) {
    const key = offlineTokenCacheKey();
    await window.VDAN_OFFLINE_STORE?.setJSON?.(key, value);
  }

  async function getOfflineVerifyToken() {
    const cached = await loadCachedOfflineToken();
    if (cached) return cached.token;
    if (hasOfflineTokenFailBackoff()) return null;
    if (!navigator.onLine) return null;
    const fresh = await fetchOfflineVerifyToken();
    if (!fresh?.token) return null;
    await saveCachedOfflineToken(fresh);
    return fresh.token;
  }

  function setMsg(text = "") {
    const el = document.getElementById("memberCardMsg");
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function asDate(d) {
    if (!d) return "-";
    const t = new Date(d);
    if (Number.isNaN(t.getTime())) return String(d);
    return t.toLocaleDateString("de-DE");
  }

  function asDateTime(d) {
    if (!d) return "-";
    const t = new Date(d);
    if (Number.isNaN(t.getTime())) return String(d);
    return t.toLocaleString("de-DE");
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

  async function listWatersAccess() {
    const rows = await sb("/rest/v1/rpc/get_my_water_bodies_access", { method: "POST", body: JSON.stringify({}) }, true);
    return Array.isArray(rows) ? rows : [];
  }

  async function listPermitRules() {
    try {
      const rows = await sb("/rest/v1/rpc/get_my_permit_rules", { method: "POST", body: JSON.stringify({}) }, true);
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  async function loadCardLabel() {
    // Wahrheitsquelle: member_card_assignments via get_my_card_label(),
    // NICHT profiles.fishing_card_type (kann stale sein).
    const rows = await sb("/rest/v1/rpc/get_my_card_label", { method: "POST", body: JSON.stringify({}) }, true);
    return Array.isArray(rows) && rows[0]?.card_label ? String(rows[0].card_label) : null;
  }

  async function renderCard(profile, waters, cardLabel, rules) {
    const box = document.getElementById("memberCardBox");
    if (!box) return;

    const isValid = Boolean(profile.member_card_valid);
    const cardId = String(profile.member_card_id || "-");
    const cardKey = String(profile.member_card_key || "-");
    const checkedAt = profile.member_card_checked_at;
    const checkedBy = String(profile.member_card_checked_by_label || "").trim();
    const displayName = String(profile.display_name || "Mitglied");
    const memberNo = String(profile.member_no || "-");
    const initials = displayName.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "M";

    const qrUrl = new URL("/app/ausweis/verifizieren/", window.location.origin);
    qrUrl.searchParams.set("card", cardId);
    qrUrl.searchParams.set("key", cardKey);
    const offlineToken = await getOfflineVerifyToken().catch(() => null);
    if (offlineToken) qrUrl.searchParams.set("ot", offlineToken);
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrUrl.toString())}`;

    // Regeln indexiert: water_body_id → [{text, sort_order}] und card_type_id → [{...}]
    const rulesList = Array.isArray(rules) ? rules : [];
    const rulesByWater = {};
    const rulesByCard = {};
    rulesList.forEach((r) => {
      if (r.water_body_id) {
        const key = String(r.water_body_id);
        if (!rulesByWater[key]) rulesByWater[key] = [];
        rulesByWater[key].push(r);
      } else {
        const key = String(r.card_type_id || "");
        if (!rulesByCard[key]) rulesByCard[key] = [];
        rulesByCard[key].push(r);
      }
    });

    const waterItems = (Array.isArray(waters) ? waters : []).map((w) => {
      const allowed = Boolean(w.is_allowed);
      const bg = allowed ? "rgba(56,184,98,.13)" : "rgba(191,66,66,.13)";
      const border = allowed ? "rgba(56,184,98,.35)" : "rgba(191,66,66,.35)";
      const color = allowed ? "#3ab862" : "#bf4242";
      const waterRules = (rulesByWater[String(w.water_body_id || w.id || "")] || [])
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const rulesHtml = waterRules.length
        ? `<ul style="margin:6px 0 0;padding:0 0 0 14px;list-style:disc;font-size:.78rem;color:var(--rd-ink-2,#4a4e40);display:grid;gap:2px;">${
            waterRules.map((r) => `<li>${escapeHtml(r.rule_text)}</li>`).join("")
          }</ul>`
        : "";
      return `<li style="display:grid;gap:4px;padding:8px 12px;border:1px solid ${border};border-radius:8px;background:${bg};">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <span>${escapeHtml(w.name || "-")}</span>
          <strong style="color:${color};font-size:.76rem;">${allowed ? "✓ Erlaubt" : "✗ Verboten"}</strong>
        </div>
        ${rulesHtml}
      </li>`;
    }).join("");

    // Reset container
    box.removeAttribute("style");
    box.className = "mc-card-shell";

    box.innerHTML = `
      <div class="mc-card ${isValid ? "mc-card--valid" : "mc-card--invalid"}">
        <div class="mc-card__header">
          <div class="mc-card__header-brand">
            <span class="mc-card__logo-text">FCP</span>
            <span class="mc-card__type">${escapeHtml(cardLabel || "Mitglied")}</span>
          </div>
          <div class="mc-card__validity ${isValid ? "mc-card__validity--valid" : "mc-card__validity--invalid"}">
            ${isValid ? "✓ Gültig" : "✗ Ungültig"}
          </div>
        </div>

        <div class="mc-card__body">
          <div class="mc-card__identity">
            <div class="mc-card__avatar">${escapeHtml(initials)}</div>
            <div class="mc-card__identity-text">
              <div class="mc-card__name">${escapeHtml(displayName)}</div>
              <div class="mc-card__member-no">Mitgl.-Nr. ${escapeHtml(memberNo)}</div>
              <div class="mc-card__validity-range">${asDate(profile.member_card_valid_from)} – ${asDate(profile.member_card_valid_until)}</div>
            </div>
          </div>
          <div class="mc-card__qr">
            <img class="mc-card__qr-img" src="${escapeHtml(qrImg)}" width="80" height="80" alt="QR zur Ausweisverifikation" loading="lazy" />
            <span class="mc-card__qr-label">Scan zur Kontrolle</span>
          </div>
        </div>

        <div class="mc-card__footer">
          <span>ID: ${escapeHtml(cardId)}</span>
          ${checkedAt ? `<span>Kontrolliert: ${escapeHtml(asDate(checkedAt))}${checkedBy ? " · " + escapeHtml(checkedBy) : ""}</span>` : ""}
        </div>
      </div>

      ${waters.length > 0 ? `
      <details class="mc-waters">
        <summary>Gewässer-Berechtigung (${escapeHtml(String(waters.length))})</summary>
        <ul style="list-style:none;margin:0;padding:0 12px 12px;display:grid;gap:6px;">
          ${waterItems || `<li class="small" style="padding:8px;">Keine Gewässer gefunden.</li>`}
        </ul>
      </details>` : ""}

      ${rulesList.length > 0 ? (() => {
        // Karten mit Regeln zusammenstellen (allgemein + gewässerspezifisch)
        const cardMap = {};
        rulesList.forEach((r) => {
          const cid = String(r.card_type_id || "");
          if (!cardMap[cid]) cardMap[cid] = { title: r.card_title || "Karte", general: [], specific: {} };
          if (r.water_body_id) {
            const wkey = String(r.water_body_id);
            if (!cardMap[cid].specific[wkey]) cardMap[cid].specific[wkey] = { name: r.water_name || wkey, rules: [] };
            cardMap[cid].specific[wkey].rules.push(r);
          } else {
            cardMap[cid].general.push(r);
          }
        });
        const cardBlocks = Object.values(cardMap).map((card) => {
          let counter = 0;
          const generalItems = card.general
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map((r) => { counter++; return `<li>${escapeHtml(String(counter))}. ${escapeHtml(r.rule_text)}</li>`; })
            .join("");
          const specificBlocks = Object.values(card.specific).map((ws) => {
            const items = ws.rules
              .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
              .map((r) => { counter++; return `<li>${escapeHtml(String(counter))}. ${escapeHtml(r.rule_text)}</li>`; })
              .join("");
            return `<p class="mc-rules__water-label">${escapeHtml(ws.name)}</p><ul class="mc-rules__list">${items}</ul>`;
          }).join("");
          return `<div class="mc-rules__card">
            <p class="mc-rules__card-title">${escapeHtml(card.title)}</p>
            ${generalItems ? `<ul class="mc-rules__list">${generalItems}</ul>` : ""}
            ${specificBlocks}
          </div>`;
        }).join("");
        return `<details class="mc-waters mc-rules">
          <summary>Regelwerk (${escapeHtml(String(rulesList.length))} Regel${rulesList.length !== 1 ? "n" : ""})</summary>
          <div style="padding:0 12px 12px;">${cardBlocks}</div>
        </details>`;
      })() : ""}

      <p class="mc-legal">
        Dieser digitale Mitgliedsausweis ist personenbezogen und nur in Verbindung mit einem amtlichen Ausweis gültig.
        Die Berechtigung gilt ausschließlich im angegebenen Zeitraum.
      </p>
    `;

  }

  async function init() {
    if (!userId()) {
      setMsg("Nicht eingeloggt.");
      return;
    }
    try {
      setMsg("Lade Ausweis…");
      const [rows, waters, cardLabel, roles, rules] = await Promise.all([
        sb(`/rest/v1/profiles?select=display_name,member_no,member_card_valid,member_card_valid_from,member_card_valid_until,member_card_id,member_card_key,member_card_checked_at,member_card_checked_by_label&id=eq.${encodeURIComponent(userId())}&limit=1`, { method: "GET" }, true),
        listWatersAccess(),
        loadCardLabel(),
        loadRoles(),
        listPermitRules(),
      ]);
      const p = Array.isArray(rows) ? rows[0] : null;
      if (!p) {
        setMsg("Kein Profil gefunden.");
        return;
      }
      await renderCard(p, waters, cardLabel, rules);
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
})();
