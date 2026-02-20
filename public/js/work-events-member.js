;(() => {
  let featureFlags = { work_qr_enabled: false };

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
      throw new Error(err?.message || err?.hint || err?.error_description || `Request failed (${res.status})`);
    }
    return res.json().catch(() => ({}));
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
    const rows = await sb(
      `/rest/v1/work_events?select=id,title,description,location,starts_at,ends_at,max_participants,status,public_token&status=eq.published&starts_at=gte.${encodeURIComponent(nowIso)}&order=starts_at.asc`,
      { method: "GET" },
      true
    );
    return Array.isArray(rows) ? rows : [];
  }

  async function listMyParticipations() {
    const uid = currentUserId();
    if (!uid) return [];
    const rows = await sb(
      `/rest/v1/work_participations?select=id,event_id,status,minutes_reported,minutes_approved,checkin_at,checkout_at,note_member,note_admin,created_at,updated_by,work_events(title,starts_at,ends_at,location,status)&auth_uid=eq.${encodeURIComponent(uid)}&order=created_at.desc`,
      { method: "GET" },
      true
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
    return sb("/rest/v1/rpc/work_register", {
      method: "POST",
      body: JSON.stringify({ p_event_id: eventId }),
    }, true);
  }

  async function checkinByToken(token) {
    return sb("/rest/v1/rpc/work_checkin", {
      method: "POST",
      body: JSON.stringify({ p_public_token: token }),
    }, true);
  }

  async function checkoutEvent(eventId) {
    return sb("/rest/v1/rpc/work_checkout", {
      method: "POST",
      body: JSON.stringify({ p_event_id: eventId }),
    }, true);
  }

  async function updateOwnParticipation(rowId, payload) {
    await sb(`/rest/v1/work_participations?id=eq.${encodeURIComponent(rowId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }, true);
  }

  async function loadFeatureFlags() {
    try {
      const data = await sb("/rest/v1/rpc/portal_bootstrap", {
        method: "POST",
        body: JSON.stringify({}),
      }, true);
      return data?.flags && typeof data.flags === "object" ? data.flags : {};
    } catch {
      try {
        const rows = await sb("/rest/v1/feature_flags?select=key,enabled", { method: "GET" }, true);
        const flags = {};
        (Array.isArray(rows) ? rows : []).forEach((r) => {
          if (r?.key) flags[r.key] = Boolean(r.enabled);
        });
        return flags;
      } catch {
        return {};
      }
    }
  }

  function renderUpcoming(events, mineByEventId) {
    const root = document.getElementById("workMemberUpcoming");
    if (!root) return;
    root.innerHTML = "";

    if (!events.length) {
      root.innerHTML = `<p class="small">Keine veröffentlichten Einsätze gefunden.</p>`;
      return;
    }

    events.forEach((evt) => {
      const mine = mineByEventId.get(evt.id);
      const canRegister = isRegisterWindowOpen(evt);
      const canCheckin = isCheckinWindowOpen(evt);
      const alreadyStarted = Boolean(mine?.checkin_at);
      const article = document.createElement("article");
      article.className = "card work-card";
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
      root.appendChild(article);
    });
  }

  function renderMine(rows) {
    const root = document.getElementById("workMemberMine");
    if (!root) return;
    root.innerHTML = "";

    if (!rows.length) {
      root.innerHTML = `<p class="small">Noch keine Teilnahmen vorhanden.</p>`;
      return;
    }

    const sortedRows = sortMyParticipations(rows);

    sortedRows.forEach((row) => {
      const event = row.work_events || {};
      const startVal = row.checkin_at ? String(row.checkin_at).slice(0, 16) : "";
      const endVal = row.checkout_at ? String(row.checkout_at).slice(0, 16) : "";
      const el = document.createElement("article");
      el.className = "card work-card";
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
      root.appendChild(el);
    });
  }

  async function refresh() {
    const [events, mine] = await Promise.all([listUpcomingEvents(), listMyParticipations()]);
    const byEvent = new Map(mine.map((m) => [m.event_id, m]));
    renderUpcoming(events, byEvent);
    renderMine(mine);
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
        await checkinByToken(token);
        setMsg("Check-in erfolgreich.");
        await refresh();
      } catch (err) {
        setMsg(err?.message || "Check-in fehlgeschlagen");
      }
    });

    document.getElementById("workMemberUpcoming")?.addEventListener("click", async (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      const registerId = target.getAttribute("data-register");
      if (registerId) {
        const registerToken = String(target.getAttribute("data-register-token") || "").trim();
        try {
          setMsg("Anmeldung (Startzeit) läuft...");
          const row = await registerForEvent(registerId);
          if (!row?.checkin_at && registerToken) {
            await checkinByToken(registerToken);
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
          await checkoutEvent(checkoutId);
          setMsg("Endzeit erfasst. Status: Warte auf Freigabe.");
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
          await checkinByToken(checkinToken);
          setMsg("Check-in erfolgreich.");
          await refresh();
        } catch (err) {
          setMsg(err?.message || "Check-in fehlgeschlagen");
        }
      }
    });

    document.getElementById("workMemberMine")?.addEventListener("click", async (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const rowId = target.getAttribute("data-save");
      const rowCheckoutEventId = target.getAttribute("data-checkout-row");
      if (rowCheckoutEventId) {
        try {
          setMsg("Endzeit wird erfasst...");
          await checkoutEvent(rowCheckoutEventId);
          setMsg("Endzeit erfasst. Status: Warte auf Freigabe.");
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
        setMsg("Korrektur gesendet. Freigabe durch Vorstand/Admin erforderlich.");
        await refresh();
      } catch (err) {
        setMsg(err?.message || "Speichern fehlgeschlagen");
      }
    });

    const queryToken = readTokenFromUrl();
    if (queryToken) {
      const tokenInput = document.getElementById("workCheckinToken");
      if (tokenInput) tokenInput.value = queryToken;
    }

    await refresh().catch((err) => setMsg(err?.message || "Laden fehlgeschlagen"));
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", init);
})();
