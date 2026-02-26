;(() => {
  const OFFLINE_NS = "work_member";
  const VIEW_KEY = "app:viewMode:arbeitseinsaetze:v1";
  const FILTER_KEY = "app:viewFilter:arbeitseinsaetze:v1";
  let featureFlags = { work_qr_enabled: false };
  let listenersBound = false;
  const state = {
    ansicht: "zeile",
    search: "",
    upcomingAll: [],
    mineAll: [],
    upcomingRows: [],
    mineRows: [],
  };

  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  function currentUserId() {
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
      const e = new Error(err?.message || err?.hint || err?.error_description || `Request failed (${res.status})`);
      e.status = res.status;
      throw e;
    }
    return res.json().catch(() => ({}));
  }

  async function sbGetCached(cacheKey, path, withAuth = false, fallback = []) {
    try {
      const out = await sb(path, { method: "GET" }, withAuth);
      await window.VDAN_OFFLINE_SYNC?.cacheSet?.(OFFLINE_NS, cacheKey, out);
      return out;
    } catch (err) {
      const cached = await window.VDAN_OFFLINE_SYNC?.cacheGet?.(OFFLINE_NS, cacheKey, fallback);
      if (cached !== null && cached !== undefined) return cached;
      throw err;
    }
  }

  async function queueAction(type, payload) {
    await window.VDAN_OFFLINE_SYNC?.enqueue?.(OFFLINE_NS, { type, payload });
  }

  function setMsg(text = "") {
    const el = document.getElementById("workMemberMsg");
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function asLocalDate(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("de-DE");
  }

  function statusLabel(status) {
    const map = {
      registered: "Angemeldet",
      checked_in: "Eingecheckt",
      submitted: "Warte auf Freigabe",
      approved: "Freigegeben",
      rejected: "Abgelehnt",
      no_show: "Nicht erschienen",
    };
    return map[status] || status;
  }

  function escAttr(str) {
    return escapeHtml(String(str || "")).replace(/"/g, "&quot;");
  }

  function loadView() {
    try {
      return String(localStorage.getItem(VIEW_KEY) || "zeile") === "karte" ? "karte" : "zeile";
    } catch {
      return "zeile";
    }
  }

  function saveView(view) {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // ignore
    }
  }

  function loadFilter() {
    try {
      return JSON.parse(localStorage.getItem(FILTER_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function saveFilter(payload) {
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(payload || {}));
    } catch {
      // ignore
    }
  }

  function isCheckinWindowOpen(evt) {
    const now = Date.now();
    const start = new Date(evt.starts_at).getTime();
    const end = new Date(evt.ends_at).getTime();
    return now >= (start - 2 * 60 * 60 * 1000) && now <= (end + 2 * 60 * 60 * 1000);
  }

  function isRegisterWindowOpen(evt) {
    const now = Date.now();
    const start = new Date(evt.starts_at).getTime();
    const end = new Date(evt.ends_at).getTime();
    return now >= (start - 10 * 60 * 1000) && now <= end;
  }

  async function listUpcomingEvents() {
    const nowIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const rows = await sbGetCached(
      "upcoming_events",
      `/rest/v1/work_events?select=id,title,description,location,starts_at,ends_at,max_participants,status,public_token&status=eq.published&starts_at=gte.${encodeURIComponent(nowIso)}&order=starts_at.asc`,
      true,
      []
    );
    return Array.isArray(rows) ? rows : [];
  }

  async function listMyParticipations() {
    const uid = currentUserId();
    if (!uid) return [];
    const rows = await sbGetCached(
      "my_participations",
      `/rest/v1/work_participations?select=id,event_id,status,minutes_reported,minutes_approved,checkin_at,checkout_at,note_member,note_admin,created_at,updated_by,work_events(title,starts_at,ends_at,location,status)&auth_uid=eq.${encodeURIComponent(uid)}&order=created_at.desc`,
      true,
      []
    );
    return Array.isArray(rows) ? rows : [];
  }

  function parseTimeMs(value) {
    if (!value) return 0;
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }

  function isActiveParticipation(row) {
    return !!row && !row.checkout_at && row.status !== "rejected" && row.status !== "no_show";
  }

  function sortMyParticipations(rows) {
    return [...rows].sort((a, b) => {
      const aActive = isActiveParticipation(a) ? 1 : 0;
      const bActive = isActiveParticipation(b) ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;

      const aRecent = Math.max(
        parseTimeMs(a.checkout_at),
        parseTimeMs(a.checkin_at),
        parseTimeMs(a.updated_at),
        parseTimeMs(a.created_at)
      );
      const bRecent = Math.max(
        parseTimeMs(b.checkout_at),
        parseTimeMs(b.checkin_at),
        parseTimeMs(b.updated_at),
        parseTimeMs(b.created_at)
      );
      return bRecent - aRecent;
    });
  }

  async function registerForEvent(eventId) {
    try {
      return await sb("/rest/v1/rpc/work_register", {
        method: "POST",
        body: JSON.stringify({ p_event_id: eventId }),
      }, true);
    } catch (err) {
      if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
        await queueAction("work_register", { p_event_id: eventId });
        return { queued: true };
      }
      throw err;
    }
  }

  async function checkinByToken(token) {
    try {
      return await sb("/rest/v1/rpc/work_checkin", {
        method: "POST",
        body: JSON.stringify({ p_public_token: token }),
      }, true);
    } catch (err) {
      if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
        await queueAction("work_checkin", { p_public_token: token });
        return { queued: true };
      }
      throw err;
    }
  }

  async function checkoutEvent(eventId) {
    try {
      return await sb("/rest/v1/rpc/work_checkout", {
        method: "POST",
        body: JSON.stringify({ p_event_id: eventId }),
      }, true);
    } catch (err) {
      if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
        await queueAction("work_checkout", { p_event_id: eventId });
        return { queued: true };
      }
      throw err;
    }
  }

  async function updateOwnParticipation(rowId, payload) {
    try {
      await sb(`/rest/v1/work_participations?id=eq.${encodeURIComponent(rowId)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }, true);
    } catch (err) {
      if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
        await queueAction("work_patch_participation", { id: rowId, payload });
        return;
      }
      throw err;
    }
  }

  async function loadFeatureFlags() {
    try {
      const data = await sb("/rest/v1/rpc/portal_bootstrap", {
        method: "POST",
        body: JSON.stringify({}),
      }, true);
      const flags = data?.flags && typeof data.flags === "object" ? data.flags : {};
      await window.VDAN_OFFLINE_SYNC?.cacheSet?.(OFFLINE_NS, "flags", flags);
      return flags;
    } catch {
      try {
        const rows = await sb("/rest/v1/feature_flags?select=key,enabled", { method: "GET" }, true);
        const flags = {};
        (Array.isArray(rows) ? rows : []).forEach((r) => {
          if (r?.key) flags[r.key] = Boolean(r.enabled);
        });
        await window.VDAN_OFFLINE_SYNC?.cacheSet?.(OFFLINE_NS, "flags", flags);
        return flags;
      } catch {
        return await window.VDAN_OFFLINE_SYNC?.cacheGet?.(OFFLINE_NS, "flags", {}) || {};
      }
    }
  }

  async function flushOfflineQueue() {
    if (!window.VDAN_OFFLINE_SYNC?.flush) return;
    await window.VDAN_OFFLINE_SYNC.flush(OFFLINE_NS, async (op) => {
      if (op?.type === "work_register") {
        await sb("/rest/v1/rpc/work_register", { method: "POST", body: JSON.stringify(op.payload || {}) }, true);
        return;
      }
      if (op?.type === "work_checkin") {
        await sb("/rest/v1/rpc/work_checkin", { method: "POST", body: JSON.stringify(op.payload || {}) }, true);
        return;
      }
      if (op?.type === "work_checkout") {
        await sb("/rest/v1/rpc/work_checkout", { method: "POST", body: JSON.stringify(op.payload || {}) }, true);
        return;
      }
      if (op?.type === "work_patch_participation") {
        await sb(`/rest/v1/work_participations?id=eq.${encodeURIComponent(op?.payload?.id || "")}`, {
          method: "PATCH",
          body: JSON.stringify(op?.payload?.payload || {}),
        }, true);
      }
    });
  }

  function renderUpcoming(events, mineByEventId) {
    const cardsRoot = document.getElementById("workMemberUpcomingCards");
    const tableBody = document.getElementById("workMemberUpcomingTableBody");
    if (!cardsRoot || !tableBody) return;
    cardsRoot.innerHTML = "";
    tableBody.innerHTML = "";

    if (!events.length) {
      cardsRoot.innerHTML = `<p class="small">Keine veröffentlichten Einsätze gefunden.</p>`;
      tableBody.innerHTML = `<p class="small" style="padding:12px;">Keine veröffentlichten Einsätze gefunden.</p>`;
      return;
    }

    events.forEach((evt) => {
      const mine = mineByEventId.get(evt.id);
      const canRegister = isRegisterWindowOpen(evt);
      const canCheckin = isCheckinWindowOpen(evt);
      const alreadyStarted = Boolean(mine?.checkin_at);
      const rowId = `upcoming:${evt.id}`;
      const article = document.createElement("article");
      article.className = "card work-card";
      article.setAttribute("data-open-detail", rowId);
      article.innerHTML = `
        <div class="card__body">
          <h3>${escapeHtml(evt.title)}</h3>
          <p class="small">${escapeHtml(asLocalDate(evt.starts_at))} - ${escapeHtml(asLocalDate(evt.ends_at))}</p>
          <p class="small">${escapeHtml(evt.location || "Ort folgt")}</p>
          ${evt.description ? `<p class="small">${escapeHtml(evt.description)}</p>` : ""}
          <p class="small">Status: <strong>${escapeHtml(mine ? statusLabel(mine.status) : "Noch nicht angemeldet")}</strong></p>
          ${mine?.checkin_at ? `<p class="small">Start erfasst: ${escapeHtml(asLocalDate(mine.checkin_at))}</p>` : ""}
          ${mine?.checkout_at ? `<p class="small">Ende erfasst: ${escapeHtml(asLocalDate(mine.checkout_at))}</p>` : ""}
          <p class="small">${canRegister ? "Anmeldung jetzt möglich." : "Anmeldung erst 10 Minuten vor Beginn möglich."}</p>
          <div class="work-actions">
            <button class="feed-btn" type="button" data-register="${evt.id}" data-register-token="${evt.public_token || ""}" ${alreadyStarted ? "disabled" : ""}>${mine ? "Anmelden (Start)" : "Anmelden (Start)"}</button>
            <button class="feed-btn feed-btn--ghost" type="button" data-checkout="${evt.id}" ${mine?.checkin_at && !mine?.checkout_at ? "" : "disabled"}>Gehen (Ende)</button>
            ${featureFlags.work_qr_enabled
              ? `<button class="feed-btn feed-btn--ghost" type="button" data-checkin="${evt.public_token}" ${canCheckin ? "" : "disabled"}>Check-in</button>`
              : ""}
          </div>
        </div>
      `;
      cardsRoot.appendChild(article);

      const row = document.createElement("button");
      row.type = "button";
      row.className = "catch-table__row";
      row.setAttribute("data-open-detail", rowId);
      row.style.gridTemplateColumns = "1.5fr 1fr 1fr 1fr";
      row.innerHTML = `
        <span>${escapeHtml(evt.title || "-")}</span>
        <span>${escapeHtml(asLocalDate(evt.starts_at))}</span>
        <span>${escapeHtml(evt.location || "-")}</span>
        <span>${escapeHtml(mine ? statusLabel(mine.status) : "Noch nicht angemeldet")}</span>
      `;
      tableBody.appendChild(row);
    });
  }

  function renderMine(rows) {
    const cardsRoot = document.getElementById("workMemberMineCards");
    const tableBody = document.getElementById("workMemberMineTableBody");
    if (!cardsRoot || !tableBody) return;
    cardsRoot.innerHTML = "";
    tableBody.innerHTML = "";

    if (!rows.length) {
      cardsRoot.innerHTML = `<p class="small">Noch keine Teilnahmen vorhanden.</p>`;
      tableBody.innerHTML = `<p class="small" style="padding:12px;">Noch keine Teilnahmen vorhanden.</p>`;
      return;
    }

    const sortedRows = sortMyParticipations(rows);

    sortedRows.forEach((row) => {
      const event = row.work_events || {};
      const startVal = row.checkin_at ? String(row.checkin_at).slice(0, 16) : "";
      const endVal = row.checkout_at ? String(row.checkout_at).slice(0, 16) : "";
      const el = document.createElement("article");
      el.className = "card work-card";
      const rowId = `mine:${row.id}`;
      el.setAttribute("data-open-detail", rowId);
      el.innerHTML = `
        <div class="card__body">
          <h3>${escapeHtml(event.title || "Einsatz")}</h3>
          <p class="small">${escapeHtml(asLocalDate(event.starts_at || row.created_at))}</p>
          <p class="small">Status: <strong>${escapeHtml(statusLabel(row.status))}</strong></p>
          <p class="small">Von: ${row.checkin_at ? escapeHtml(asLocalDate(row.checkin_at)) : "-"} | Bis: ${row.checkout_at ? escapeHtml(asLocalDate(row.checkout_at)) : "-"}</p>
          <p class="small">Gemeldet: ${row.minutes_reported ?? "-"} min | Freigegeben: ${row.minutes_approved ?? "-"} min</p>
          <label><span>Startzeit (Korrektur)</span><input type="datetime-local" value="${escapeHtml(startVal)}" data-checkin="${row.id}" /></label>
          <label><span>Endzeit (Korrektur)</span><input type="datetime-local" value="${escapeHtml(endVal)}" data-checkout="${row.id}" /></label>
          <label>
            <span>Notiz / Korrekturhinweis</span>
            <textarea rows="2" data-note="${row.id}">${escapeHtml(row.note_member || "")}</textarea>
          </label>
          <div class="work-actions">
            <button class="feed-btn feed-btn--ghost" type="button" data-save="${row.id}">Korrektur senden</button>
            <button class="feed-btn" type="button" data-checkout-row="${event.id}" ${row.checkin_at && !row.checkout_at ? "" : "disabled"}>Gehen (Ende)</button>
          </div>
        </div>
      `;
      cardsRoot.appendChild(el);

      const tableRow = document.createElement("button");
      tableRow.type = "button";
      tableRow.className = "catch-table__row";
      tableRow.setAttribute("data-open-detail", rowId);
      tableRow.style.gridTemplateColumns = "1.5fr 1fr 1fr 1fr";
      tableRow.innerHTML = `
        <span>${escapeHtml(event.title || "Einsatz")}</span>
        <span>${row.checkin_at ? escapeHtml(asLocalDate(row.checkin_at)) : "-"}</span>
        <span>${row.checkout_at ? escapeHtml(asLocalDate(row.checkout_at)) : "-"}</span>
        <span>${escapeHtml(statusLabel(row.status))}</span>
      `;
      tableBody.appendChild(tableRow);
    });
  }

  function applyView() {
    const cardView = state.ansicht === "karte";
    const ids = [
      "workMemberUpcomingCards",
      "workMemberMineCards",
    ];
    const tableIds = [
      "workMemberUpcomingTableWrap",
      "workMemberMineTableWrap",
    ];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      el?.classList.toggle("hidden", !cardView);
      el?.toggleAttribute("hidden", !cardView);
    });
    tableIds.forEach((id) => {
      const el = document.getElementById(id);
      el?.classList.toggle("hidden", cardView);
      el?.toggleAttribute("hidden", cardView);
    });
    document.getElementById("workMemberViewZeileBtn")?.classList.toggle("feed-btn--ghost", cardView);
    document.getElementById("workMemberViewKarteBtn")?.classList.toggle("feed-btn--ghost", !cardView);
  }

  function applyFilters() {
    const search = String(document.getElementById("workMemberSearch")?.value || "").trim().toLowerCase();
    state.search = search;
    saveFilter({ search });

    const eventToMine = new Map(state.mineAll.map((m) => [m.event_id, m]));
    state.upcomingRows = state.upcomingAll.filter((evt) => {
      if (!search) return true;
      const mine = eventToMine.get(evt.id);
      const hay = `${evt.title || ""} ${evt.location || ""} ${mine ? statusLabel(mine.status) : ""}`.toLowerCase();
      return hay.includes(search);
    });
    state.mineRows = state.mineAll.filter((row) => {
      if (!search) return true;
      const ev = row.work_events || {};
      const hay = `${ev.title || ""} ${ev.location || ""} ${statusLabel(row.status)}`.toLowerCase();
      return hay.includes(search);
    });
  }

  function renderDetail(rowKey) {
    const [scope, id] = String(rowKey || "").split(":");
    const box = document.getElementById("workMemberDetailBody");
    const dlg = document.getElementById("workMemberDetailDialog");
    if (!box || !dlg || !scope || !id) return;
    if (scope === "upcoming") {
      const evt = state.upcomingAll.find((r) => String(r.id) === id);
      if (!evt) return;
      const mine = state.mineAll.find((m) => String(m.event_id) === id);
      box.innerHTML = `
        <p><strong>Titel:</strong> ${escapeHtml(evt.title || "-")}</p>
        <p><strong>Start:</strong> ${escapeHtml(asLocalDate(evt.starts_at))}</p>
        <p><strong>Ende:</strong> ${escapeHtml(asLocalDate(evt.ends_at))}</p>
        <p><strong>Ort:</strong> ${escapeHtml(evt.location || "-")}</p>
        <p><strong>Status:</strong> ${escapeHtml(mine ? statusLabel(mine.status) : "Noch nicht angemeldet")}</p>
        <p><strong>Beschreibung:</strong> ${escapeHtml(evt.description || "-")}</p>
      `;
      dlg.showModal?.();
      return;
    }
    const row = state.mineAll.find((r) => String(r.id) === id);
    if (!row) return;
    const ev = row.work_events || {};
    box.innerHTML = `
      <p><strong>Titel:</strong> ${escapeHtml(ev.title || "Einsatz")}</p>
      <p><strong>Status:</strong> ${escapeHtml(statusLabel(row.status))}</p>
      <p><strong>Von:</strong> ${row.checkin_at ? escapeHtml(asLocalDate(row.checkin_at)) : "-"}</p>
      <p><strong>Bis:</strong> ${row.checkout_at ? escapeHtml(asLocalDate(row.checkout_at)) : "-"}</p>
      <p><strong>Gemeldet:</strong> ${escapeHtml(String(row.minutes_reported ?? "-"))} min</p>
      <p><strong>Freigegeben:</strong> ${escapeHtml(String(row.minutes_approved ?? "-"))} min</p>
      <p><strong>Notiz:</strong> ${escapeHtml(row.note_member || "-")}</p>
    `;
    dlg.showModal?.();
  }

  function renderAll() {
    applyFilters();
    const byEvent = new Map(state.mineAll.map((m) => [m.event_id, m]));
    renderUpcoming(state.upcomingRows, byEvent);
    renderMine(state.mineRows);
    applyView();
  }

  async function refresh() {
    const [events, mine] = await Promise.all([listUpcomingEvents(), listMyParticipations()]);
    state.upcomingAll = Array.isArray(events) ? events : [];
    state.mineAll = Array.isArray(mine) ? mine : [];
    renderAll();
  }

  function readTokenFromUrl() {
    const url = new URL(window.location.href);
    return String(url.searchParams.get("token") || "").trim();
  }

  async function init() {
    const { url, key } = cfg();
    if (!url || !key) {
      setMsg("Supabase-Konfiguration fehlt.");
      return;
    }

    featureFlags = { work_qr_enabled: false, ...(await loadFeatureFlags()) };
    const checkinBlock = document.getElementById("workCheckinBlock");
    if (checkinBlock) {
      const showQr = Boolean(featureFlags.work_qr_enabled);
      checkinBlock.classList.toggle("hidden", !showQr);
      checkinBlock.toggleAttribute("hidden", !showQr);
    }

    if (!listenersBound) {
      listenersBound = true;

      document.getElementById("workCheckinBtn")?.addEventListener("click", async () => {
      if (!featureFlags.work_qr_enabled) return;
      const tokenInput = document.getElementById("workCheckinToken");
      const token = String(tokenInput?.value || "").trim();
      if (!token) {
        setMsg("Bitte Check-in Token eingeben.");
        return;
      }
      try {
        setMsg("Check-in läuft...");
        const out = await checkinByToken(token);
        if (out?.queued) setMsg("Offline gespeichert. Check-in wird bei Empfang übertragen.");
        else setMsg("Check-in erfolgreich.");
        await refresh();
      } catch (err) {
        setMsg(err?.message || "Check-in fehlgeschlagen");
      }
      });

      const upcomingWrap = document.getElementById("workMemberUpcomingCards");
      const upcomingTable = document.getElementById("workMemberUpcomingTableBody");
      [upcomingWrap, upcomingTable].forEach((el) => el?.addEventListener("click", async (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;

      const registerId = target.getAttribute("data-register");
      if (registerId) {
        const registerToken = String(target.getAttribute("data-register-token") || "").trim();
        try {
          setMsg("Anmeldung (Startzeit) läuft...");
          const row = await registerForEvent(registerId);
          if (row?.queued) {
            setMsg("Offline gespeichert. Anmeldung/Start wird bei Empfang übertragen.");
            await refresh();
            return;
          }
          if (!row?.checkin_at && registerToken) {
            const checkinRes = await checkinByToken(registerToken);
            if (checkinRes?.queued) {
              setMsg("Offline gespeichert. Check-in wird bei Empfang übertragen.");
              await refresh();
              return;
            }
          }
          if (row?.checkin_at || registerToken) {
            setMsg("Startzeit erfasst.");
          } else {
            setMsg("Startzeit konnte nicht automatisch gesetzt werden. Bitte DB-Migration 10 prüfen.");
          }
          await refresh();
        } catch (err) {
          setMsg(err?.message || "Anmeldung fehlgeschlagen");
        }
        return;
      }

      const checkoutId = target.getAttribute("data-checkout");
      if (checkoutId) {
        try {
          setMsg("Endzeit wird erfasst...");
          const out = await checkoutEvent(checkoutId);
          if (out?.queued) setMsg("Offline gespeichert. Endzeit wird bei Empfang übertragen.");
          else setMsg("Endzeit erfasst. Status: Warte auf Freigabe.");
          await refresh();
        } catch (err) {
          if (String(err?.message || "").toLowerCase().includes("work_checkout")) {
            setMsg("Ende-Funktion fehlt im Backend. Bitte SQL-Migration 10 ausführen.");
            return;
          }
          setMsg(err?.message || "Ende erfassen fehlgeschlagen");
        }
        return;
      }

      const checkinToken = target.getAttribute("data-checkin");
      if (checkinToken) {
        if (!featureFlags.work_qr_enabled) return;
        try {
          setMsg("Check-in läuft...");
          const out = await checkinByToken(checkinToken);
          if (out?.queued) setMsg("Offline gespeichert. Check-in wird bei Empfang übertragen.");
          else setMsg("Check-in erfolgreich.");
          await refresh();
        } catch (err) {
          setMsg(err?.message || "Check-in fehlgeschlagen");
        }
      }
      }));

      const mineWrap = document.getElementById("workMemberMineCards");
      const mineTable = document.getElementById("workMemberMineTableBody");
      [mineWrap, mineTable].forEach((el) => el?.addEventListener("click", async (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
      const rowId = target.getAttribute("data-save");
      const rowCheckoutEventId = target.getAttribute("data-checkout-row");
      if (rowCheckoutEventId) {
        try {
          setMsg("Endzeit wird erfasst...");
          const out = await checkoutEvent(rowCheckoutEventId);
          if (out?.queued) setMsg("Offline gespeichert. Endzeit wird bei Empfang übertragen.");
          else setMsg("Endzeit erfasst. Status: Warte auf Freigabe.");
          await refresh();
        } catch (err) {
          if (String(err?.message || "").toLowerCase().includes("work_checkout")) {
            setMsg("Ende-Funktion fehlt im Backend. Bitte SQL-Migration 10 ausführen.");
            return;
          }
          setMsg(err?.message || "Ende erfassen fehlgeschlagen");
        }
        return;
      }
      if (!rowId) return;

      const note = String(document.querySelector(`[data-note="${rowId}"]`)?.value || "").trim();
      const inRaw = String(document.querySelector(`[data-checkin="${rowId}"]`)?.value || "").trim();
      const outRaw = String(document.querySelector(`[data-checkout="${rowId}"]`)?.value || "").trim();
      const toIso = (val) => {
        if (!val) return null;
        const d = new Date(val);
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
      };

      try {
        setMsg("Korrektur wird gespeichert...");
        await updateOwnParticipation(rowId, {
          note_member: note || null,
          checkin_at: toIso(inRaw),
          checkout_at: toIso(outRaw),
        });
        if (!navigator.onLine) setMsg("Offline gespeichert. Korrektur wird bei Empfang übertragen.");
        else setMsg("Korrektur gesendet. Freigabe durch Vorstand/Admin erforderlich.");
        await refresh();
      } catch (err) {
        setMsg(err?.message || "Speichern fehlgeschlagen");
      }
      }));

      document.addEventListener("click", (e) => {
        const target = e.target;
        const open = target?.closest?.("[data-open-detail]");
        if (open) {
          if (target?.closest?.("[data-register],[data-checkout],[data-checkin],[data-save],[data-checkout-row]")) return;
          renderDetail(String(open.getAttribute("data-open-detail") || ""));
          return;
        }
        if (target?.closest?.("#workMemberViewZeileBtn")) {
          state.ansicht = "zeile";
          saveView(state.ansicht);
          applyView();
          return;
        }
        if (target?.closest?.("#workMemberViewKarteBtn")) {
          state.ansicht = "karte";
          saveView(state.ansicht);
          applyView();
        }
      });

      document.getElementById("workMemberSearch")?.addEventListener("input", renderAll);
    }

    const queryToken = readTokenFromUrl();
    if (queryToken) {
      const tokenInput = document.getElementById("workCheckinToken");
      if (tokenInput) tokenInput.value = queryToken;
    }

    await flushOfflineQueue().catch(() => {});
    await refresh().catch((err) => setMsg(err?.message || "Laden fehlgeschlagen"));
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", init);
  window.addEventListener("online", () => {
    flushOfflineQueue().then(() => refresh()).catch(() => {});
  });
})();
    state.ansicht = loadView();
    const filter = loadFilter();
    const searchEl = document.getElementById("workMemberSearch");
    if (searchEl && filter?.search) searchEl.value = String(filter.search);
