;(() => {
  const MANAGER_ROLES = new Set(["admin", "vorstand"]);
  let isManager = false;
  let createDialog = null;
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

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function asLocalDate(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("de-DE");
  }

  function statusLabel(status) {
    const map = {
      draft: "Entwurf",
      published: "Veröffentlicht",
      cancelled: "Abgesagt",
      archived: "Archiviert",
      registered: "Angemeldet",
      checked_in: "Eingecheckt",
      submitted: "Warte auf Freigabe",
      approved: "Freigegeben",
      rejected: "Abgelehnt",
      no_show: "Nicht erschienen",
    };
    return map[status] || status;
  }

  function setMsg(text = "") {
    const el = document.getElementById("workCockpitMsg");
    if (el) el.textContent = text;
  }

  async function loadRoles() {
    const uid = currentUserId();
    if (!uid) return [];
    const rows = await sb(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(uid)}`, { method: "GET" }, true);
    return Array.isArray(rows) ? rows.map((r) => String(r.role || "").toLowerCase()) : [];
  }

  async function listEvents() {
    const rows = await sb(
      "/rest/v1/work_events?select=id,title,description,location,starts_at,ends_at,max_participants,status,public_token,created_at&order=starts_at.desc",
      { method: "GET" },
      true
    );
    return Array.isArray(rows) ? rows : [];
  }

  async function listParticipations(eventId) {
    const rows = await sb(
      `/rest/v1/work_participations?select=id,event_id,auth_uid,status,minutes_reported,minutes_approved,checkin_at,checkout_at,note_member,note_admin,updated_by,approved_by,approved_at,created_at&event_id=eq.${encodeURIComponent(eventId)}&order=created_at.desc`,
      { method: "GET" },
      true
    );
    return Array.isArray(rows) ? rows : [];
  }

  async function loadProfileMap(userIds) {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return new Map();
    const inList = ids.map((id) => `"${id}"`).join(",");
    let rows = [];
    try {
      rows = await sb(`/rest/v1/profiles?select=id,display_name,email,member_no&id=in.(${inList})`, { method: "GET" }, true);
    } catch (err) {
      setMsg("Anzeigenamen konnten nicht geladen werden (Profiles-Policy/Migration prüfen).");
      rows = [];
    }
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach((r) => {
      const label = String(r.display_name || r.email || r.id || "").trim();
      if (r.id) map.set(r.id, { label: label || r.id, memberNo: String(r.member_no || "").trim() });
    });
    return map;
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

  async function createEvent(payload) {
    return sb("/rest/v1/rpc/work_event_create", {
      method: "POST",
      body: JSON.stringify(payload),
    }, true);
  }

  async function publishEvent(eventId) {
    return sb("/rest/v1/rpc/work_event_publish", {
      method: "POST",
      body: JSON.stringify({ p_event_id: eventId }),
    }, true);
  }

  async function patchEventStatus(eventId, status) {
    await sb(`/rest/v1/work_events?id=eq.${encodeURIComponent(eventId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }, true);
  }

  async function approveParticipation(id, minutesApproved) {
    return sb("/rest/v1/rpc/work_approve", {
      method: "POST",
      body: JSON.stringify({
        p_participation_id: id,
        p_minutes_approved: Number.isFinite(minutesApproved) ? minutesApproved : 0,
      }),
    }, true);
  }

  async function rejectParticipation(id, noteAdmin) {
    return sb("/rest/v1/rpc/work_reject", {
      method: "POST",
      body: JSON.stringify({
        p_participation_id: id,
        p_note_admin: noteAdmin || null,
      }),
    }, true);
  }

  async function adminUpdateParticipationTime(id, checkinAt, checkoutAt, noteAdmin) {
    return sb("/rest/v1/rpc/work_participation_admin_update", {
      method: "POST",
      body: JSON.stringify({
        p_participation_id: id,
        p_checkin_at: checkinAt || null,
        p_checkout_at: checkoutAt || null,
        p_note_admin: noteAdmin || null,
      }),
    }, true);
  }

  function toIsoFromLocalInput(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  function defaultCreateTimes() {
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(8, 0, 0, 0);

    const end = new Date(start);
    end.setHours(end.getHours() + 3);

    const fmt = (d) => {
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    return { start: fmt(start), end: fmt(end) };
  }

  function openCreateDialog() {
    const form = document.getElementById("workCreateForm");
    form?.reset();
    const defaults = defaultCreateTimes();
    const starts = document.getElementById("workStartsAt");
    const ends = document.getElementById("workEndsAt");
    if (starts) starts.value = defaults.start;
    if (ends) ends.value = defaults.end;
    if (!createDialog?.open) createDialog?.showModal();
  }

  function closeCreateDialog() {
    if (createDialog?.open) createDialog.close();
  }

  function eventCheckinUrl(token) {
    return `${window.location.origin}/app/arbeitseinsaetze/?token=${encodeURIComponent(token)}`;
  }

  function eventQrUrl(token) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(eventCheckinUrl(token))}`;
  }

  function computeMinutes(checkinAt, checkoutAt) {
    if (!checkinAt || !checkoutAt) return null;
    const start = new Date(checkinAt).getTime();
    const end = new Date(checkoutAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    return Math.floor((end - start) / 60000);
  }

  async function renderParticipations(eventId, host) {
    host.innerHTML = `<p class="small">Lädt Teilnehmer…</p>`;
    const rows = await listParticipations(eventId);
    if (!rows.length) {
      host.innerHTML = `<p class="small">Noch keine Teilnahmen.</p>`;
      return;
    }

    const profileMap = await loadProfileMap([
      ...rows.map((r) => r.auth_uid),
      ...rows.map((r) => r.updated_by),
      ...rows.map((r) => r.approved_by),
    ]);
    const profileOf = (id) => profileMap.get(id) || { label: id || "-", memberNo: "" };
    const displayUser = (id) => profileOf(id).label;

    const isPresent = (r) => r.checkin_at && !r.checkout_at && r.status !== "rejected" && r.status !== "no_show";
    const stateRank = (r) => (isPresent(r) ? 0 : r.checkout_at ? 1 : 2);
    const sortedRows = [...rows].sort((a, b) => {
      const rankDiff = stateRank(a) - stateRank(b);
      if (rankDiff !== 0) return rankDiff;
      const aTime = new Date(a.checkin_at || a.created_at || 0).getTime();
      const bTime = new Date(b.checkin_at || b.created_at || 0).getTime();
      return bTime - aTime;
    });

    const open = sortedRows.filter((r) => isPresent(r)).length;
    const gone = sortedRows.filter((r) => r.checkout_at).length;
    const pending = rows.filter((r) => r.status === "submitted" || r.status === "checked_in" || r.status === "registered").length;

    const toLocalInput = (iso) => {
      if (!iso) return "";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const tableRows = sortedRows
      .map((row) => {
        const checkinLocal = toLocalInput(row.checkin_at);
        const checkoutLocal = toLocalInput(row.checkout_at);
        const rowStateClass = isPresent(row) ? "work-part-row--present" : row.checkout_at ? "work-part-row--gone" : "work-part-row--neutral";
        const approvedMark = row.status === "approved"
          ? `<span class="work-approved-check" title="Freigegeben" aria-label="Freigegeben">OK</span>`
          : "";
        const minutesCalculated = computeMinutes(row.checkin_at, row.checkout_at);
        const minutesLabel = minutesCalculated == null ? "-" : `${minutesCalculated} min`;
        const minutesVal = row.minutes_approved ?? minutesCalculated ?? row.minutes_reported ?? 0;
        return `
        <tr class="work-part-row ${rowStateClass}">
          <td>
            <div class="work-name-line">
              <strong>${escapeHtml(displayUser(row.auth_uid))}</strong>
              ${approvedMark}
            </div>
            ${profileOf(row.auth_uid).memberNo ? `<div class="small">Mitgliedsnummer: ${escapeHtml(profileOf(row.auth_uid).memberNo)}</div>` : ""}
            <div class="small">${escapeHtml(statusLabel(row.status))}</div>
          </td>
          <td>${row.checkin_at ? escapeHtml(asLocalDate(row.checkin_at)) : "-"}</td>
          <td>${row.checkout_at ? escapeHtml(asLocalDate(row.checkout_at)) : "-"}</td>
          <td><strong data-min-computed="${row.id}">${minutesLabel}</strong></td>
          <td>
            <div class="work-part-actions">
              <button class="feed-btn feed-btn--ghost" type="button" data-edit-toggle="${row.id}">Bearbeiten</button>
              <button class="feed-btn feed-btn--ghost hidden" type="button" data-save-time="${row.id}">Speichern</button>
              <button class="feed-btn" type="button" data-approve="${row.id}">Freigeben</button>
              <button class="feed-btn feed-btn--ghost" type="button" data-reject="${row.id}">Ablehnen</button>
            </div>
            <div class="work-edit-panel hidden" data-edit-panel="${row.id}">
              <label class="small">Von
                <input type="datetime-local" value="${escapeHtml(checkinLocal)}" data-edit-in="${row.id}" />
              </label>
              <label class="small">Bis
                <input type="datetime-local" value="${escapeHtml(checkoutLocal)}" data-edit-out="${row.id}" />
              </label>
              <div class="small">Neu berechnet: <strong data-min-preview="${row.id}">${minutesLabel}</strong></div>
            </div>
            <div class="small">
              Gemeldet: ${row.minutes_reported ?? "-"} | Freigegeben: ${row.minutes_approved ?? "-"} | Minutenvorgabe: ${minutesVal}
              ${row.updated_by ? `| bearbeitet: ${escapeHtml(displayUser(row.updated_by))}` : ""}
            </div>
          </td>
        </tr>
      `;
      })
      .join("");

    host.innerHTML = `
      <div class="work-part-summary">
        <span class="feed-chip">Da: ${open}</span>
        <span class="feed-chip">Gegangen: ${gone}</span>
        <span class="feed-chip">Zu prüfen: ${pending}</span>
      </div>
      <div class="work-part-table-wrap">
        <table class="work-part-table">
          <thead>
            <tr>
              <th>Teilnehmer</th>
              <th>Von</th>
              <th>Bis</th>
              <th>Berechnet</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `;
  }

  async function refresh() {
    const activeRoot = document.getElementById("workCockpitEventsActive");
    const historyRoot = document.getElementById("workCockpitEventsHistory");
    if (!activeRoot || !historyRoot) return;
    const rows = await listEvents();
    activeRoot.innerHTML = "";
    historyRoot.innerHTML = "";

    if (!rows.length) {
      activeRoot.innerHTML = `<p class="small">Noch keine Einsätze vorhanden.</p>`;
      historyRoot.innerHTML = `<p class="small">Noch keine History vorhanden.</p>`;
      return;
    }

    const now = Date.now();
    const activeRows = rows.filter((r) => new Date(r.ends_at).getTime() >= now && r.status !== "archived");
    const historyRows = rows.filter((r) => new Date(r.ends_at).getTime() < now || r.status === "archived");

    const renderInto = (list, root) => {
      if (!list.length) {
        root.innerHTML = `<p class="small">Keine Einträge.</p>`;
        return;
      }
      list.forEach((row) => {
        const item = document.createElement("article");
        item.className = "card work-card";
        item.innerHTML = `
          <div class="card__body">
            <h3>${escapeHtml(row.title)}</h3>
            <p class="small">${escapeHtml(asLocalDate(row.starts_at))} - ${escapeHtml(asLocalDate(row.ends_at))}</p>
            <p class="small">${escapeHtml(row.location || "Ort offen")} | Status: <strong>${escapeHtml(statusLabel(row.status))}</strong></p>
            ${row.description ? `<p class="small">${escapeHtml(row.description)}</p>` : ""}
            <div class="work-actions">
              <button class="feed-btn" type="button" data-publish="${row.id}" ${row.status === "draft" ? "" : "disabled"}>Veröffentlichen</button>
              <button class="feed-btn feed-btn--ghost" type="button" data-cancel="${row.id}" ${row.status === "published" ? "" : "disabled"}>Absagen</button>
              <button class="feed-btn feed-btn--ghost" type="button" data-archive="${row.id}" ${row.status !== "archived" ? "" : "disabled"}>Archivieren</button>
              <button class="feed-btn feed-btn--ghost" type="button" data-participants="${row.id}">Teilnehmer</button>
            </div>
            ${featureFlags.work_qr_enabled ? `
            <div class="work-qr-box">
              <img loading="lazy" src="${eventQrUrl(row.public_token)}" alt="QR für Check-in ${escapeHtml(row.title)}" />
              <div class="small">
                <a href="${eventCheckinUrl(row.public_token)}" target="_blank" rel="noreferrer">Check-in Link öffnen</a><br />
                Token: <code>${escapeHtml(row.public_token)}</code>
              </div>
            </div>` : ""}
            <div class="work-participants" id="parts-${row.id}"></div>
          </div>
        `;
        root.appendChild(item);
      });
    };

    renderInto(activeRows, activeRoot);
    renderInto(historyRows, historyRoot);
  }

  async function init() {
    const { url, key } = cfg();
    createDialog = document.getElementById("workCreateDialog");

    if (!url || !key) {
      setMsg("Supabase-Konfiguration fehlt.");
      return;
    }

    featureFlags = { work_qr_enabled: false, ...(await loadFeatureFlags()) };

    const roles = await loadRoles().catch(() => []);
    isManager = roles.some((r) => MANAGER_ROLES.has(r));
    if (!isManager) {
      setMsg("Kein Zugriff: nur Vorstand/Admin.");
      const activeRoot = document.getElementById("workCockpitEventsActive");
      const historyRoot = document.getElementById("workCockpitEventsHistory");
      if (activeRoot) activeRoot.innerHTML = "";
      if (historyRoot) historyRoot.innerHTML = "";
      return;
    }

    document.getElementById("workCreateOpenTop")?.addEventListener("click", openCreateDialog);
    document.getElementById("workCreateOpenFab")?.addEventListener("click", openCreateDialog);
    document.getElementById("workCreateClose")?.addEventListener("click", closeCreateDialog);

    document.getElementById("workCreateForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        setMsg("Einsatz wird erstellt...");
        const startsAt = toIsoFromLocalInput(String(document.getElementById("workStartsAt")?.value || ""));
        const endsAt = toIsoFromLocalInput(String(document.getElementById("workEndsAt")?.value || ""));
        const maxRaw = String(document.getElementById("workMax")?.value || "").trim();
        const maxParticipants = maxRaw ? Number(maxRaw) : null;

        await createEvent({
          p_title: String(document.getElementById("workTitle")?.value || "").trim(),
          p_description: String(document.getElementById("workDescription")?.value || "").trim() || null,
          p_location: String(document.getElementById("workLocation")?.value || "").trim() || null,
          p_starts_at: startsAt,
          p_ends_at: endsAt,
          p_max_participants: Number.isFinite(maxParticipants) ? maxParticipants : null,
        });
        closeCreateDialog();
        setMsg("Einsatz erstellt.");
        await refresh();
      } catch (err) {
        setMsg(err?.message || "Erstellen fehlgeschlagen");
      }
    });

    const onCockpitClick = async (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      const publishId = target.getAttribute("data-publish");
      if (publishId) {
        try {
          setMsg("Veröffentlichung läuft...");
          await publishEvent(publishId);
          setMsg("Einsatz veröffentlicht.");
          await refresh();
        } catch (err) {
          setMsg(err?.message || "Veröffentlichen fehlgeschlagen");
        }
        return;
      }

      const cancelId = target.getAttribute("data-cancel");
      if (cancelId) {
        try {
          setMsg("Absage wird gespeichert...");
          await patchEventStatus(cancelId, "cancelled");
          setMsg("Einsatz abgesagt.");
          await refresh();
        } catch (err) {
          setMsg(err?.message || "Absage fehlgeschlagen");
        }
        return;
      }

      const archiveId = target.getAttribute("data-archive");
      if (archiveId) {
        try {
          setMsg("Archiviert...");
          await patchEventStatus(archiveId, "archived");
          setMsg("Einsatz archiviert.");
          await refresh();
        } catch (err) {
          setMsg(err?.message || "Archivieren fehlgeschlagen");
        }
        return;
      }

      const participantsId = target.getAttribute("data-participants");
      if (participantsId) {
        const host = document.getElementById(`parts-${participantsId}`);
        if (!host) return;
        if (host.dataset.open === "1") {
          host.dataset.open = "0";
          host.innerHTML = "";
          return;
        }
        host.dataset.open = "1";
        try {
          await renderParticipations(participantsId, host);
        } catch (err) {
          host.innerHTML = `<p class="small">${escapeHtml(err?.message || "Teilnehmer konnten nicht geladen werden")}</p>`;
        }
        return;
      }

      const approveId = target.getAttribute("data-approve");
      if (approveId) {
        const minutesEl = document.querySelector(`[data-min="${approveId}"]`);
        const minutes = Number(minutesEl?.value || 0);
        try {
          setMsg("Freigabe läuft...");
          await approveParticipation(approveId, minutes);
          setMsg("Teilnahme freigegeben.");
          await refresh();
        } catch (err) {
          setMsg(err?.message || "Freigabe fehlgeschlagen");
        }
        return;
      }

      const rejectId = target.getAttribute("data-reject");
      if (rejectId) {
        const note = window.prompt("Grund für Ablehnung (optional):", "") || "";
        try {
          setMsg("Ablehnung läuft...");
          await rejectParticipation(rejectId, note.trim());
          setMsg("Teilnahme abgelehnt.");
          await refresh();
        } catch (err) {
          setMsg(err?.message || "Ablehnung fehlgeschlagen");
        }
        return;
      }

      const saveTimeId = target.getAttribute("data-save-time");
      if (saveTimeId) {
        const inVal = String(document.querySelector(`[data-edit-in="${saveTimeId}"]`)?.value || "").trim();
        const outVal = String(document.querySelector(`[data-edit-out="${saveTimeId}"]`)?.value || "").trim();
        const toIso = (val) => {
          if (!val) return null;
          const d = new Date(val);
          return Number.isNaN(d.getTime()) ? null : d.toISOString();
        };
        try {
          setMsg("Zeitkorrektur wird gespeichert...");
          await adminUpdateParticipationTime(saveTimeId, toIso(inVal), toIso(outVal), null);
          setMsg("Zeitkorrektur gespeichert.");
          await refresh();
        } catch (err) {
          setMsg(err?.message || "Zeitkorrektur fehlgeschlagen");
        }
        return;
      }

      const editToggleId = target.getAttribute("data-edit-toggle");
      if (editToggleId) {
        const panel = document.querySelector(`[data-edit-panel="${editToggleId}"]`);
        const saveBtn = document.querySelector(`[data-save-time="${editToggleId}"]`);
        if (panel) panel.classList.toggle("hidden");
        if (saveBtn) saveBtn.classList.toggle("hidden");
      }
    };

    document.getElementById("workCockpitEventsActive")?.addEventListener("click", onCockpitClick);
    document.getElementById("workCockpitEventsHistory")?.addEventListener("click", onCockpitClick);
    const onEditInput = (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const rowId = target.getAttribute("data-edit-in") || target.getAttribute("data-edit-out");
      if (!rowId) return;
      const inVal = String(document.querySelector(`[data-edit-in="${rowId}"]`)?.value || "").trim();
      const outVal = String(document.querySelector(`[data-edit-out="${rowId}"]`)?.value || "").trim();
      const minutes = computeMinutes(inVal, outVal);
      const text = minutes == null ? "-" : `${minutes} min`;
      const preview = document.querySelector(`[data-min-preview="${rowId}"]`);
      const computed = document.querySelector(`[data-min-computed="${rowId}"]`);
      if (preview) preview.textContent = text;
      if (computed) computed.textContent = text;
    };
    document.getElementById("workCockpitEventsActive")?.addEventListener("input", onEditInput);
    document.getElementById("workCockpitEventsHistory")?.addEventListener("input", onEditInput);

    await refresh().catch((err) => setMsg(err?.message || "Laden fehlgeschlagen"));
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", init);
})();
