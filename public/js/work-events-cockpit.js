;(() => {
  const MANAGER_ROLES = new Set(["admin", "vorstand"]);
  const OFFLINE_NS = "work_cockpit";
  let isManager = false;
  let createDialog = null;
  let featureFlags = { work_qr_enabled: false };
  let memberDirectory = [];

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

  async function invokeWorkEventAdminUpdate(action, eventId, patch = null) {
    const { url, key } = cfg();
    const token = session()?.access_token;
    if (!url || !key || !token) throw new Error("Keine aktive Session.");
    const res = await fetch(`${url}/functions/v1/work-event-admin-update`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        event_id: eventId,
        ...(patch && typeof patch === "object" ? { patch } : {}),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || err?.message || `Admin-Update fehlgeschlagen (${res.status})`);
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
    const rows = await sbGetCached(
      "events",
      "/rest/v1/work_events?select=id,title,description,location,starts_at,ends_at,max_participants,status,public_token,created_at&order=starts_at.desc",
      true,
      []
    );
    return Array.isArray(rows) ? rows : [];
  }

  async function listParticipations(eventId) {
    const rows = await sbGetCached(
      `parts:${eventId}`,
      `/rest/v1/work_participations?select=id,event_id,auth_uid,status,minutes_reported,minutes_approved,checkin_at,checkout_at,note_member,note_admin,updated_by,approved_by,approved_at,created_at&event_id=eq.${encodeURIComponent(eventId)}&order=created_at.desc`,
      true,
      []
    );
    return Array.isArray(rows) ? rows : [];
  }

  async function listMembersLite() {
    if (Array.isArray(memberDirectory) && memberDirectory.length) return memberDirectory;
    const rows = await sbGetCached(
      "members_lite",
      "/rest/v1/profiles?select=id,display_name,member_no&order=display_name.asc.nullslast,member_no.asc.nullslast",
      true,
      []
    );
    memberDirectory = (Array.isArray(rows) ? rows : [])
      .filter((r) => r?.id)
      .map((r) => ({
        id: String(r.id),
        name: String(r.display_name || "").trim() || "Unbenannt",
        memberNo: String(r.member_no || "").trim(),
      }));
    return memberDirectory;
  }

  async function loadLeadMap(eventIds) {
    const ids = [...new Set((Array.isArray(eventIds) ? eventIds : []).filter(Boolean))];
    if (!ids.length) return new Map();
    const inList = ids.map((id) => `"${id}"`).join(",");
    let rows = [];
    try {
      rows = await sb(`/rest/v1/work_event_leads?select=work_event_id,user_id&work_event_id=in.(${inList})`, { method: "GET" }, true);
    } catch (err) {
      const msg = String(err?.message || "").toLowerCase();
      if (msg.includes("work_event_id") && msg.includes("does not exist")) {
        rows = await sb(`/rest/v1/work_event_leads?select=event_id,user_id&event_id=in.(${inList})`, { method: "GET" }, true).catch(() => []);
      } else {
        rows = [];
      }
    }
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach((r) => {
      const eid = String(r?.work_event_id || r?.event_id || "").trim();
      if (!eid || !r?.user_id) return;
      if (!map.has(eid)) map.set(eid, []);
      map.get(eid).push(String(r.user_id));
    });
    return map;
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
      const p = op?.payload || {};
      if (op?.type === "create_event") {
        await sb("/rest/v1/rpc/work_event_create", { method: "POST", body: JSON.stringify(p) }, true);
        return;
      }
      if (op?.type === "publish_event") {
        await sb("/rest/v1/rpc/work_event_publish", { method: "POST", body: JSON.stringify(p) }, true);
        return;
      }
      if (op?.type === "patch_event_status") {
        await sb(`/rest/v1/work_events?id=eq.${encodeURIComponent(p.eventId || "")}`, {
          method: "PATCH",
          body: JSON.stringify({ status: p.status }),
        }, true);
        return;
      }
      if (op?.type === "patch_event_details") {
        await sb(`/rest/v1/work_events?id=eq.${encodeURIComponent(p.eventId || "")}`, {
          method: "PATCH",
          body: JSON.stringify(p.payload || {}),
        }, true);
        return;
      }
      if (op?.type === "delete_event") {
        await sb(`/rest/v1/work_events?id=eq.${encodeURIComponent(p.eventId || "")}`, {
          method: "DELETE",
        }, true);
        return;
      }
      if (op?.type === "approve_participation") {
        await sb("/rest/v1/rpc/work_approve", { method: "POST", body: JSON.stringify(p) }, true);
        return;
      }
      if (op?.type === "reject_participation") {
        await sb("/rest/v1/rpc/work_reject", { method: "POST", body: JSON.stringify(p) }, true);
        return;
      }
      if (op?.type === "admin_update_participation") {
        await sb("/rest/v1/rpc/work_participation_admin_update", { method: "POST", body: JSON.stringify(p) }, true);
        return;
      }
      if (op?.type === "manual_set_presence") {
        await applyManualPresence(
          p.eventId,
          p.userId,
          Boolean(p.present),
          p.participationId || null,
          p.currentStatus || null,
          p.plannedStartIso || null,
          p.plannedEndIso || null,
          true
        );
        return;
      }
      if (op?.type === "manual_addendum") {
        await applyManualAddendum(
          p.eventId,
          p.userId,
          p.fromIso || null,
          p.toIso || null,
          true
        );
        return;
      }
      if (op?.type === "assign_event_lead") {
        await saveEventLead(p.eventId, p.userId || "", true);
        return;
      }
    });
  }

  async function applyManualPresence(
    eventId,
    userId,
    present,
    participationId = null,
    currentStatus = null,
    plannedStartIso = null,
    plannedEndIso = null,
    fromQueue = false
  ) {
    const nowIso = new Date().toISOString();
    const checkinIso = plannedStartIso || nowIso;
    const checkoutIso = plannedEndIso || plannedStartIso || nowIso;
    try {
      if (present) {
        await sb("/rest/v1/work_participations?on_conflict=event_id,auth_uid", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify([{
            event_id: eventId,
            auth_uid: userId,
            status: "submitted",
            checkin_at: checkinIso,
            checkout_at: checkoutIso,
            note_admin: "Manuell aus Mitgliederliste hinzugefügt.",
          }]),
        }, true);
        return { queued: false };
      }

      if (!participationId) return { queued: false };
      await sb(`/rest/v1/work_participations?id=eq.${encodeURIComponent(participationId)}`, {
        method: "DELETE",
      }, true);
      return { queued: false };
    } catch (err) {
      if (!fromQueue && (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err))) {
        await queueAction("manual_set_presence", {
          eventId,
          userId,
          present,
          participationId,
          currentStatus,
          plannedStartIso,
          plannedEndIso,
        });
        return { queued: true };
      }
      throw err;
    }
  }

  async function applyManualAddendum(eventId, userId, fromIso, toIso, fromQueue = false) {
    try {
      await sb("/rest/v1/work_participations?on_conflict=event_id,auth_uid", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify([{
          event_id: eventId,
          auth_uid: userId,
          status: "submitted",
          checkin_at: fromIso || null,
          checkout_at: toIso || null,
          note_admin: "Nachtrag durch Vorstand/Admin.",
        }]),
      }, true);
      return { queued: false };
    } catch (err) {
      if (!fromQueue && (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err))) {
        await queueAction("manual_addendum", { eventId, userId, fromIso, toIso });
        return { queued: true };
      }
      throw err;
    }
  }

  async function saveEventLead(eventId, userId, fromQueue = false) {
    try {
      let deleted = false;
      try {
        await sb(`/rest/v1/work_event_leads?work_event_id=eq.${encodeURIComponent(eventId)}`, { method: "DELETE" }, true);
        deleted = true;
      } catch (err) {
        const msg = String(err?.message || "").toLowerCase();
        if (!(msg.includes("work_event_id") && msg.includes("does not exist"))) {
          throw err;
        }
      }
      if (!deleted) {
        await sb(`/rest/v1/work_event_leads?event_id=eq.${encodeURIComponent(eventId)}`, { method: "DELETE" }, true);
      }
      if (userId) {
        try {
          await sb("/rest/v1/work_event_leads", {
            method: "POST",
            body: JSON.stringify([{ work_event_id: eventId, user_id: userId }]),
          }, true);
        } catch (err) {
          const msg = String(err?.message || "").toLowerCase();
          if (msg.includes("work_event_id") && msg.includes("does not exist")) {
            await sb("/rest/v1/work_event_leads", {
              method: "POST",
              body: JSON.stringify([{ event_id: eventId, user_id: userId }]),
            }, true);
          } else {
            throw err;
          }
        }
      }
      return { queued: false };
    } catch (err) {
      if (!fromQueue && (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err))) {
        await queueAction("assign_event_lead", { eventId, userId });
        return { queued: true };
      }
      throw err;
    }
  }

  async function createEvent(payload) {
    try {
      return await sb("/rest/v1/rpc/work_event_create", {
        method: "POST",
        body: JSON.stringify(payload),
      }, true);
    } catch (err) {
      if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
        await queueAction("create_event", payload);
        return { queued: true };
      }
      throw err;
    }
  }

  async function publishEvent(eventId) {
    try {
      return await sb("/rest/v1/rpc/work_event_publish", {
        method: "POST",
        body: JSON.stringify({ p_event_id: eventId }),
      }, true);
    } catch (err) {
      if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
        await queueAction("publish_event", { p_event_id: eventId });
        return { queued: true };
      }
      throw err;
    }
  }

  async function patchEventStatus(eventId, status) {
    try {
      await sb(`/rest/v1/work_events?id=eq.${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }, true);
      return { queued: false };
    } catch (err) {
      if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
        await queueAction("patch_event_status", { eventId, status });
        return { queued: true };
      }
      throw err;
    }
  }

  async function patchEventDetails(eventId, payload) {
    try {
      await invokeWorkEventAdminUpdate("update", eventId, payload);
      return { queued: false };
    } catch (err) {
      if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
        await queueAction("patch_event_details", { eventId, payload });
        return { queued: true };
      }
      await sb(`/rest/v1/work_events?id=eq.${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }, true);
      return { queued: false };
    }
  }

  async function deleteEvent(eventId) {
    try {
      await invokeWorkEventAdminUpdate("delete", eventId);
      return { queued: false };
    } catch (err) {
      if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
        await queueAction("delete_event", { eventId });
        return { queued: true };
      }
      await sb(`/rest/v1/work_events?id=eq.${encodeURIComponent(eventId)}`, { method: "DELETE" }, true);
      return { queued: false };
    }
  }

  async function approveParticipation(id, minutesApproved) {
    const payload = {
      p_participation_id: id,
      p_minutes_approved: Number.isFinite(minutesApproved) ? minutesApproved : 0,
    };
    try {
      return await sb("/rest/v1/rpc/work_approve", { method: "POST", body: JSON.stringify(payload) }, true);
    } catch (err) {
      if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
        await queueAction("approve_participation", payload);
        return { queued: true };
      }
      throw err;
    }
  }

  async function rejectParticipation(id, noteAdmin) {
    const payload = {
      p_participation_id: id,
      p_note_admin: noteAdmin || null,
    };
    try {
      return await sb("/rest/v1/rpc/work_reject", { method: "POST", body: JSON.stringify(payload) }, true);
    } catch (err) {
      if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
        await queueAction("reject_participation", payload);
        return { queued: true };
      }
      throw err;
    }
  }

  async function adminUpdateParticipationTime(id, checkinAt, checkoutAt, noteAdmin) {
    const payload = {
      p_participation_id: id,
      p_checkin_at: checkinAt || null,
      p_checkout_at: checkoutAt || null,
      p_note_admin: noteAdmin || null,
    };
    try {
      return await sb("/rest/v1/rpc/work_participation_admin_update", {
        method: "POST",
        body: JSON.stringify(payload),
      }, true);
    } catch (err) {
      if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
        await queueAction("admin_update_participation", payload);
        return { queued: true };
      }
      throw err;
    }
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
    const youth = document.getElementById("workIsYouth");
    const youthBtn = document.getElementById("workIsYouthToggle");
    if (youth) youth.value = "0";
    if (youthBtn) {
      youthBtn.style.background = "";
      youthBtn.style.borderColor = "";
      youthBtn.style.color = "";
    }
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

  function hasExternalMediaConsent() {
    return Boolean(window.VDAN_CONSENT?.has?.("external_media"));
  }

  function computeMinutes(checkinAt, checkoutAt) {
    if (!checkinAt || !checkoutAt) return null;
    const start = new Date(checkinAt).getTime();
    const end = new Date(checkoutAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    return Math.floor((end - start) / 60000);
  }

  function toLocalInput(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function memberPresence(p) {
    return Boolean(p && p.status !== "rejected" && p.status !== "no_show");
  }

  function mapLatestParticipationByUser(rows) {
    const byUid = new Map();
    (Array.isArray(rows) ? rows : []).forEach((r) => {
      const uid = String(r?.auth_uid || "").trim();
      if (!uid || byUid.has(uid)) return;
      byUid.set(uid, r);
    });
    return byUid;
  }

  function paintPresenceButton(btn, present, partId, partStatus) {
    if (!(btn instanceof HTMLElement)) return;
    btn.setAttribute("data-present", present ? "1" : "0");
    btn.setAttribute("data-part-id", String(partId || ""));
    btn.setAttribute("data-part-status", String(partStatus || ""));
    btn.classList.toggle("feed-btn--ghost", !present);
    if (present) {
      btn.style.background = "#1f7a3b";
      btn.style.borderColor = "#1f7a3b";
      btn.style.color = "#fff";
    } else {
      btn.style.background = "";
      btn.style.borderColor = "";
      btn.style.color = "";
    }
  }

  function updateParticipantsSummary(host, rows, membersCount) {
    const open = (Array.isArray(rows) ? rows : []).filter((r) => r.checkin_at && !r.checkout_at && r.status !== "rejected" && r.status !== "no_show").length;
    const gone = (Array.isArray(rows) ? rows : []).filter((r) => r.checkout_at).length;
    const pending = (Array.isArray(rows) ? rows : []).filter((r) => r.status === "submitted" || r.status === "checked_in" || r.status === "registered").length;
    const chips = host.querySelectorAll(".work-part-summary .feed-chip");
    if (chips[0]) chips[0].textContent = `Da: ${open}`;
    if (chips[1]) chips[1].textContent = `Gegangen: ${gone}`;
    if (chips[2]) chips[2].textContent = `Zu prüfen: ${pending}`;

    const summary = host.querySelector("details[data-members-list] > summary");
    if (summary) summary.textContent = `Mitgliederliste aufklappen (${open}/${membersCount} aktiv)`;
  }

  async function syncParticipantsPanel(eventId, host) {
    if (!host) return;
    const [rows, members] = await Promise.all([listParticipations(eventId), listMembersLite()]);
    const byUid = mapLatestParticipationByUser(rows);
    const memberRows = host.querySelectorAll(`tr[data-member-row="${eventId}"][data-user-id]`);
    memberRows.forEach((tr) => {
      const uid = String(tr.getAttribute("data-user-id") || "").trim();
      if (!uid) return;
      const p = byUid.get(uid) || null;
      const present = memberPresence(p);
      const buttons = tr.querySelectorAll('[data-toggle-presence="1"]');
      buttons.forEach((btn) => paintPresenceButton(btn, present, p?.id || "", p?.status || ""));
      const presenceBtn = tr.querySelector(".work-member-col--presence [data-toggle-presence='1']");
      if (presenceBtn) presenceBtn.textContent = present ? "Anwesend" : "Nicht da";
    });
    updateParticipantsSummary(host, rows, (Array.isArray(members) ? members : []).length);
  }

  async function renderParticipations(eventId, host, eventMeta = {}) {
    const previousDetails = host.querySelector('details[data-members-list]');
    const previousMembersOpen = host.dataset.membersOpen === "1" || Boolean(previousDetails?.open);
    host.innerHTML = `<p class="small">Lädt Teilnehmer…</p>`;
    const [rows, members] = await Promise.all([listParticipations(eventId), listMembersLite()]);

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
          <td class="work-part-col work-part-col--name">
            <div class="work-name-line">
              <strong>${escapeHtml(displayUser(row.auth_uid))}</strong>
              ${approvedMark}
            </div>
            ${profileOf(row.auth_uid).memberNo ? `<div class="small">Mitgliedsnummer: ${escapeHtml(profileOf(row.auth_uid).memberNo)}</div>` : ""}
            <div class="small">${escapeHtml(statusLabel(row.status))}</div>
          </td>
          <td class="work-part-col work-part-col--from">${row.checkin_at ? escapeHtml(asLocalDate(row.checkin_at)) : "-"}</td>
          <td class="work-part-col work-part-col--to">${row.checkout_at ? escapeHtml(asLocalDate(row.checkout_at)) : "-"}</td>
          <td class="work-part-col work-part-col--calc"><strong data-min-computed="${row.id}">${minutesLabel}</strong></td>
          <td class="work-part-col work-part-col--actions">
            <div class="work-part-actions">
              <label class="small">Freigabe-Minuten
                <input type="number" min="0" step="1" value="${minutesVal}" data-min="${row.id}" style="max-width:110px;" />
              </label>
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

    const byUid = mapLatestParticipationByUser(rows);
    const memberRows = (Array.isArray(members) ? members : [])
      .map((m) => {
        const p = byUid.get(m.id) || null;
        const present = memberPresence(p);
        const activeStyle = present ? "background:#1f7a3b;border-color:#1f7a3b;color:#fff;" : "";
        const searchable = `${m.name} ${m.memberNo}`.toLowerCase();
        return `
          <tr data-member-row="${eventId}" data-user-id="${escapeHtml(m.id)}" data-search="${escapeHtml(searchable)}">
            <td class="work-member-col work-member-col--name">
              <button
                type="button"
                class="feed-btn ${present ? "" : "feed-btn--ghost"}"
                style="${activeStyle}"
                data-toggle-presence="1"
                data-event-id="${eventId}"
                data-user-id="${m.id}"
                data-present="${present ? "1" : "0"}"
                data-part-id="${escapeHtml(String(p?.id || ""))}"
                data-part-status="${escapeHtml(String(p?.status || ""))}"
                data-event-start="${escapeHtml(String(eventMeta.startsAt || ""))}"
                data-event-end="${escapeHtml(String(eventMeta.endsAt || ""))}"
              >${escapeHtml(m.name)}</button>
            </td>
            <td class="work-member-col work-member-col--member-no">${escapeHtml(m.memberNo || "-")}</td>
            <td class="work-member-col work-member-col--presence">
              <button
                type="button"
                class="feed-btn ${present ? "" : "feed-btn--ghost"}"
                style="${activeStyle}"
                data-toggle-presence="1"
                data-event-id="${eventId}"
                data-user-id="${m.id}"
                data-present="${present ? "1" : "0"}"
                data-part-id="${escapeHtml(String(p?.id || ""))}"
                data-part-status="${escapeHtml(String(p?.status || ""))}"
                data-event-start="${escapeHtml(String(eventMeta.startsAt || ""))}"
                data-event-end="${escapeHtml(String(eventMeta.endsAt || ""))}"
              >${present ? "Anwesend" : "Nicht da"}</button>
            </td>
          </tr>
        `;
      })
      .join("");

    const defaultFrom = toLocalInput(eventMeta.startsAt || "");
    const defaultTo = toLocalInput(eventMeta.endsAt || "");
    const leadSelected = String(eventMeta.leadId || "");
    const presentCount = (Array.isArray(members) ? members : []).filter((m) => {
      const p = byUid.get(m.id) || null;
      return memberPresence(p);
    }).length;
    const leadOptions = (Array.isArray(members) ? members : [])
      .map((m) => `<option value="${escapeHtml(m.id)}" ${leadSelected === m.id ? "selected" : ""}>${escapeHtml(m.name)}${m.memberNo ? ` (${escapeHtml(m.memberNo)})` : ""}</option>`)
      .join("");

    const membersOpen = typeof eventMeta.membersOpen === "boolean" ? eventMeta.membersOpen : previousMembersOpen;
    host.innerHTML = `
      <div class="work-part-summary">
        <span class="feed-chip">Da: ${open}</span>
        <span class="feed-chip">Gegangen: ${gone}</span>
        <span class="feed-chip">Zu prüfen: ${pending}</span>
      </div>
      <div class="card" style="margin:10px 0;">
        <div class="card__body" style="display:grid;gap:8px;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <input type="search" class="feed-input" style="min-width:220px;flex:1;" placeholder="Mitglied suchen (Name/Nr.)" data-member-search="${eventId}" />
            <button type="button" class="feed-btn feed-btn--ghost" data-open-addendum="${eventId}">Nachtrag</button>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <label class="small">Zuständigkeit
              <select data-lead-select="${eventId}">
                <option value="">Kein Leiter</option>
                ${leadOptions}
              </select>
            </label>
            <button type="button" class="feed-btn feed-btn--ghost" data-save-lead="${eventId}">Leiter speichern</button>
          </div>
          <div class="hidden" data-addendum-panel="${eventId}">
            <div style="display:grid;gap:8px;grid-template-columns:1fr 1fr;">
              <label class="small" style="grid-column:1/-1;">Mitglied
                <select data-addendum-user="${eventId}">
                  <option value="">Bitte wählen</option>
                  ${leadOptions}
                </select>
              </label>
              <label class="small">Von
                <input type="datetime-local" value="${escapeHtml(defaultFrom)}" data-addendum-from="${eventId}" />
              </label>
              <label class="small">Bis
                <input type="datetime-local" value="${escapeHtml(defaultTo)}" data-addendum-to="${eventId}" />
              </label>
            </div>
            <div style="margin-top:8px;">
              <button type="button" class="feed-btn" data-save-addendum="${eventId}">Nachtrag speichern</button>
            </div>
          </div>
          <details data-members-list ${membersOpen ? "open" : ""}>
            <summary style="cursor:pointer;font-weight:600;">Mitgliederliste aufklappen (${presentCount}/${(Array.isArray(members) ? members : []).length} aktiv)</summary>
            <div class="work-part-table-wrap" style="margin-top:8px;">
              <table class="work-part-table work-member-table">
                <thead>
                  <tr>
                    <th class="work-member-col work-member-col--name">Name</th>
                    <th class="work-member-col work-member-col--member-no">Nr.</th>
                    <th class="work-member-col work-member-col--presence">Anwesenheit</th>
                  </tr>
                </thead>
                <tbody>${memberRows || `<tr><td colspan="3" class="small">Keine Mitglieder gefunden.</td></tr>`}</tbody>
              </table>
            </div>
          </details>
        </div>
      </div>
      <div class="work-part-table-wrap">
        <table class="work-part-table work-part-table--admin">
          <thead>
            <tr>
              <th class="work-part-col work-part-col--name">Teilnehmer</th>
              <th class="work-part-col work-part-col--from">Von</th>
              <th class="work-part-col work-part-col--to">Bis</th>
              <th class="work-part-col work-part-col--calc">Berechnet</th>
              <th class="work-part-col work-part-col--actions">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `;
    const detailsEl = host.querySelector('details[data-members-list]');
    if (detailsEl) {
      host.dataset.membersOpen = detailsEl.open ? "1" : "0";
      detailsEl.addEventListener("toggle", () => {
        host.dataset.membersOpen = detailsEl.open ? "1" : "0";
      });
    }
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
    const leadsByEvent = await loadLeadMap(rows.map((r) => r.id)).catch(() => new Map());
    const leadUserIds = [...new Set([].concat(...[...leadsByEvent.values()]))];
    const leadProfileMap = await loadProfileMap(leadUserIds);

    const renderInto = (list, root) => {
      if (!list.length) {
        root.innerHTML = `<p class="small">Keine Einträge.</p>`;
        return;
      }
      list.forEach((row) => {
        const item = document.createElement("article");
        item.className = "card work-card";
        const leadIds = leadsByEvent.get(row.id) || [];
        const leadId = leadIds[0] || "";
        const leadName = leadId ? (leadProfileMap.get(leadId)?.label || leadId) : "";
        item.innerHTML = `
          <div class="card__body">
            <h3>${escapeHtml(row.title)}</h3>
            <p class="small">${escapeHtml(asLocalDate(row.starts_at))} - ${escapeHtml(asLocalDate(row.ends_at))}</p>
            <p class="small">${escapeHtml(row.location || "Ort offen")} | Status: <strong>${escapeHtml(statusLabel(row.status))}</strong></p>
            ${leadName ? `<p class="small">Zuständig: <strong>${escapeHtml(leadName)}</strong></p>` : `<p class="small">Zuständig: <em>nicht gesetzt</em></p>`}
            ${row.description ? `<p class="small">${escapeHtml(row.description)}</p>` : ""}
            <div class="work-actions">
              <button class="feed-btn" type="button" data-publish="${row.id}" ${row.status === "draft" ? "" : "disabled"}>Veröffentlichen</button>
              <button class="feed-btn feed-btn--ghost" type="button" data-cancel="${row.id}" ${row.status === "published" ? "" : "disabled"}>Absagen</button>
              <button class="feed-btn feed-btn--ghost" type="button" data-archive="${row.id}" ${row.status !== "archived" ? "" : "disabled"}>Archivieren</button>
              <button class="feed-btn feed-btn--ghost" type="button" data-edit-event-toggle="${row.id}">Bearbeiten</button>
              <button class="feed-btn feed-btn--ghost" type="button" data-delete-event="${row.id}">Löschen</button>
              <button class="feed-btn feed-btn--ghost" type="button" data-participants="${row.id}" data-event-title="${escapeHtml(row.title)}" data-event-start="${escapeHtml(String(row.starts_at || ""))}" data-event-end="${escapeHtml(String(row.ends_at || ""))}" data-event-lead="${escapeHtml(leadId)}">Teilnehmer</button>
            </div>
            <div class="hidden" data-edit-event-panel="${row.id}">
              <div class="grid cols2">
                <label><span>Titel</span><input type="text" maxlength="120" value="${escapeHtml(row.title || "")}" data-edit-event-title="${row.id}" /></label>
                <label><span>Ort</span><input type="text" maxlength="160" value="${escapeHtml(row.location || "")}" data-edit-event-location="${row.id}" /></label>
                <label><span>Start</span><input type="datetime-local" value="${escapeHtml(toLocalInput(row.starts_at))}" data-edit-event-start="${row.id}" /></label>
                <label><span>Ende</span><input type="datetime-local" value="${escapeHtml(toLocalInput(row.ends_at))}" data-edit-event-end="${row.id}" /></label>
                <label style="grid-column:1/-1"><span>Beschreibung</span><textarea rows="2" data-edit-event-description="${row.id}">${escapeHtml(row.description || "")}</textarea></label>
              </div>
              <div style="margin-top:8px;">
                <button class="feed-btn" type="button" data-save-event-edit="${row.id}">Änderungen speichern</button>
              </div>
            </div>
            ${featureFlags.work_qr_enabled && hasExternalMediaConsent() ? `
            <div class="work-qr-box">
              <img loading="lazy" src="${eventQrUrl(row.public_token)}" alt="QR für Check-in ${escapeHtml(row.title)}" />
              <div class="small">
                <a href="${eventCheckinUrl(row.public_token)}" target="_blank" rel="noreferrer">Check-in Link öffnen</a><br />
                Token: <code>${escapeHtml(row.public_token)}</code>
              </div>
            </div>` : ""}
            ${featureFlags.work_qr_enabled && !hasExternalMediaConsent() ? `
            <div class="external-media-lock">
              <p class="small">QR-Code wird erst nach Freigabe externer Medien angezeigt.</p>
              <button type="button" class="feed-btn feed-btn--ghost" data-open-consent-settings>Datenschutz-Einstellungen</button>
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
    document.getElementById("workIsYouthToggle")?.addEventListener("click", () => {
      const youth = document.getElementById("workIsYouth");
      const btn = document.getElementById("workIsYouthToggle");
      if (!youth || !btn) return;
      const next = String(youth.value) === "1" ? "0" : "1";
      youth.value = next;
      const active = next === "1";
      btn.style.background = active ? "#1f7a3b" : "";
      btn.style.borderColor = active ? "#1f7a3b" : "";
      btn.style.color = active ? "#fff" : "";
    });

    document.getElementById("workCreateForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        setMsg("Einsatz wird erstellt...");
        const startsAt = toIsoFromLocalInput(String(document.getElementById("workStartsAt")?.value || ""));
        const endsAt = toIsoFromLocalInput(String(document.getElementById("workEndsAt")?.value || ""));
        const maxRaw = String(document.getElementById("workMax")?.value || "").trim();
        const maxParticipants = maxRaw ? Number(maxRaw) : null;

        const out = await createEvent({
          p_title: String(document.getElementById("workTitle")?.value || "").trim(),
          p_description: String(document.getElementById("workDescription")?.value || "").trim() || null,
          p_location: String(document.getElementById("workLocation")?.value || "").trim() || null,
          p_starts_at: startsAt,
          p_ends_at: endsAt,
          p_max_participants: Number.isFinite(maxParticipants) ? maxParticipants : null,
          p_is_youth: String(document.getElementById("workIsYouth")?.value || "0") === "1",
        });
        closeCreateDialog();
        setMsg(out?.queued ? "Offline gespeichert. Einsatz wird bei Empfang übertragen." : "Einsatz erstellt.");
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
          const out = await publishEvent(publishId);
          setMsg(out?.queued ? "Offline gespeichert. Veröffentlichung folgt bei Empfang." : "Einsatz veröffentlicht.");
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
          const out = await patchEventStatus(cancelId, "cancelled");
          setMsg(out?.queued ? "Offline gespeichert. Absage folgt bei Empfang." : "Einsatz abgesagt.");
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
          const out = await patchEventStatus(archiveId, "archived");
          setMsg(out?.queued ? "Offline gespeichert. Archivierung folgt bei Empfang." : "Einsatz archiviert.");
          await refresh();
        } catch (err) {
          setMsg(err?.message || "Archivieren fehlgeschlagen");
        }
        return;
      }

      const editEventToggleId = target.getAttribute("data-edit-event-toggle");
      if (editEventToggleId) {
        document.querySelector(`[data-edit-event-panel="${editEventToggleId}"]`)?.classList.toggle("hidden");
        return;
      }

      const saveEventEditId = target.getAttribute("data-save-event-edit");
      if (saveEventEditId) {
        const payload = {
          title: String(document.querySelector(`[data-edit-event-title="${saveEventEditId}"]`)?.value || "").trim(),
          location: String(document.querySelector(`[data-edit-event-location="${saveEventEditId}"]`)?.value || "").trim() || null,
          starts_at: toIsoFromLocalInput(String(document.querySelector(`[data-edit-event-start="${saveEventEditId}"]`)?.value || "").trim()),
          ends_at: toIsoFromLocalInput(String(document.querySelector(`[data-edit-event-end="${saveEventEditId}"]`)?.value || "").trim()),
          description: String(document.querySelector(`[data-edit-event-description="${saveEventEditId}"]`)?.value || "").trim() || null,
        };
        if (!payload.title || !payload.starts_at || !payload.ends_at) {
          setMsg("Bitte Titel/Start/Ende vollständig ausfüllen.");
          return;
        }
        try {
          setMsg("Änderung wird gespeichert...");
          const out = await patchEventDetails(saveEventEditId, payload);
          setMsg(out?.queued ? "Offline gespeichert. Änderung folgt bei Empfang." : "Einsatz aktualisiert.");
          await refresh();
        } catch (err) {
          setMsg(err?.message || "Aktualisierung fehlgeschlagen");
        }
        return;
      }

      const deleteEventId = target.getAttribute("data-delete-event");
      if (deleteEventId) {
        if (!window.confirm("Arbeitseinsatz wirklich löschen?")) return;
        try {
          setMsg("Löschung wird gespeichert...");
          const out = await deleteEvent(deleteEventId);
          setMsg(out?.queued ? "Offline gespeichert. Löschung folgt bei Empfang." : "Einsatz gelöscht.");
          await refresh();
        } catch (err) {
          setMsg(err?.message || "Löschen fehlgeschlagen");
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
          await renderParticipations(participantsId, host, {
            title: target.getAttribute("data-event-title") || "",
            startsAt: target.getAttribute("data-event-start") || "",
            endsAt: target.getAttribute("data-event-end") || "",
            leadId: target.getAttribute("data-event-lead") || "",
          });
        } catch (err) {
          host.innerHTML = `<p class="small">${escapeHtml(err?.message || "Teilnehmer konnten nicht geladen werden")}</p>`;
        }
        return;
      }

      const togglePresence = target.getAttribute("data-toggle-presence");
      if (togglePresence) {
        const eventId = String(target.getAttribute("data-event-id") || "");
        const userId = String(target.getAttribute("data-user-id") || "");
        const wasPresent = String(target.getAttribute("data-present") || "0") === "1";
        const partId = String(target.getAttribute("data-part-id") || "").trim() || null;
        const partStatus = String(target.getAttribute("data-part-status") || "").trim() || null;
        const plannedStartIso = String(target.getAttribute("data-event-start") || "").trim() || null;
        const plannedEndIso = String(target.getAttribute("data-event-end") || "").trim() || null;
        if (!eventId || !userId) return;
        if (wasPresent) {
          const ok = window.confirm("Mitglied wirklich aus diesem Arbeitseinsatz entfernen?");
          if (!ok) return;
        }
        const row = target.closest("tr");
        const rowButtons = row ? row.querySelectorAll('[data-toggle-presence="1"]') : [];
        rowButtons.forEach((btn) => btn.setAttribute("disabled", "disabled"));
        try {
          const out = await applyManualPresence(
            eventId,
            userId,
            !wasPresent,
            partId,
            partStatus,
            plannedStartIso,
            plannedEndIso,
            false
          );
          const nextPresent = !wasPresent;
          rowButtons.forEach((btn) => paintPresenceButton(btn, nextPresent, partId, partStatus || (nextPresent ? "submitted" : "")));
          const presenceBtn = row ? row.querySelector(".work-member-col--presence [data-toggle-presence='1']") : null;
          if (presenceBtn) presenceBtn.textContent = nextPresent ? "Anwesend" : "Nicht da";
          const host = document.getElementById(`parts-${eventId}`);
          if (host?.dataset.open === "1") {
            await syncParticipantsPanel(eventId, host);
          }
          if (out?.queued) setMsg("Offline gespeichert. Anwesenheit wird bei Empfang synchronisiert.");
        } catch (err) {
          setMsg(err?.message || "Anwesenheit konnte nicht gesetzt werden.");
        } finally {
          rowButtons.forEach((btn) => btn.removeAttribute("disabled"));
        }
        return;
      }

      const openAddendum = target.getAttribute("data-open-addendum");
      if (openAddendum) {
        const panel = document.querySelector(`[data-addendum-panel="${openAddendum}"]`);
        panel?.classList.toggle("hidden");
        return;
      }

      const saveAddendum = target.getAttribute("data-save-addendum");
      if (saveAddendum) {
        const userId = String(document.querySelector(`[data-addendum-user="${saveAddendum}"]`)?.value || "").trim();
        const fromRaw = String(document.querySelector(`[data-addendum-from="${saveAddendum}"]`)?.value || "").trim();
        const toRaw = String(document.querySelector(`[data-addendum-to="${saveAddendum}"]`)?.value || "").trim();
        if (!userId) {
          setMsg("Bitte Mitglied für Nachtrag wählen.");
          return;
        }
        const fromIso = toIsoFromLocalInput(fromRaw);
        const toIso = toIsoFromLocalInput(toRaw);
        if (!fromIso || !toIso) {
          setMsg("Bitte gültige Von-/Bis-Zeit für Nachtrag setzen.");
          return;
        }
        try {
          setMsg("Nachtrag wird gespeichert...");
          const out = await applyManualAddendum(saveAddendum, userId, fromIso, toIso, false);
          setMsg(out?.queued ? "Offline gespeichert. Nachtrag folgt bei Empfang." : "Nachtrag gespeichert.");
          const host = document.getElementById(`parts-${saveAddendum}`);
          if (host?.dataset.open === "1") await renderParticipations(saveAddendum, host, { membersOpen: host.dataset.membersOpen === "1" });
        } catch (err) {
          setMsg(err?.message || "Nachtrag fehlgeschlagen.");
        }
        return;
      }

      const saveLead = target.getAttribute("data-save-lead");
      if (saveLead) {
        const userId = String(document.querySelector(`[data-lead-select="${saveLead}"]`)?.value || "").trim();
        try {
          setMsg("Zuständigkeit wird gespeichert...");
          const out = await saveEventLead(saveLead, userId, false);
          setMsg(out?.queued ? "Offline gespeichert. Zuständigkeit folgt bei Empfang." : "Zuständigkeit gespeichert.");
          await refresh();
        } catch (err) {
          setMsg(err?.message || "Zuständigkeit konnte nicht gespeichert werden.");
        }
        return;
      }

      const approveId = target.getAttribute("data-approve");
      if (approveId) {
        const minutesEl = document.querySelector(`[data-min="${approveId}"]`);
        const minutes = Number(minutesEl?.value || 0);
        try {
          setMsg("Freigabe läuft...");
          const out = await approveParticipation(approveId, minutes);
          setMsg(out?.queued ? "Offline gespeichert. Freigabe folgt bei Empfang." : "Teilnahme freigegeben.");
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
          const out = await rejectParticipation(rejectId, note.trim());
          setMsg(out?.queued ? "Offline gespeichert. Ablehnung folgt bei Empfang." : "Teilnahme abgelehnt.");
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
          const out = await adminUpdateParticipationTime(saveTimeId, toIso(inVal), toIso(outVal), null);
          setMsg(out?.queued ? "Offline gespeichert. Zeitkorrektur folgt bei Empfang." : "Zeitkorrektur gespeichert.");
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
      const searchEventId = target.getAttribute("data-member-search");
      if (searchEventId) {
        const q = String(target.value || "").toLowerCase().trim();
        document.querySelectorAll(`[data-member-row="${searchEventId}"]`).forEach((row) => {
          const hay = String(row.getAttribute("data-search") || "").toLowerCase();
          row.classList.toggle("hidden", Boolean(q) && !hay.includes(q));
        });
        return;
      }
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

    await flushOfflineQueue().catch(() => {});
    await refresh().catch((err) => setMsg(err?.message || "Laden fehlgeschlagen"));
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", init);
  window.addEventListener("online", () => {
    flushOfflineQueue().then(() => refresh()).catch(() => {});
  });
  document.addEventListener("vdan:consent-changed", () => {
    if (!isManager) return;
    refresh().catch((err) => setMsg(err?.message || "Laden fehlgeschlagen"));
  });
})();
