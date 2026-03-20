;(() => {
  const state = {
    events: [],
    plannerConfigs: [],
    plannerSlots: [],
    plannerRegistrations: [],
    myRegistrations: [],
    memberRoleKeys: new Map(),
    migrationAvailable: true,
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

  function setMsg(text = "") {
    const el = document.getElementById("eventPlannerMemberMsg");
    if (el) el.textContent = text;
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
      throw new Error(err?.message || err?.detail || err?.hint || err?.error_description || `Request failed (${res.status})`);
    }
    return res.json().catch(() => ([]));
  }

  function isMissingPlannerSchema(error) {
    return String(error?.message || "").toLowerCase().includes("event_planner");
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function formatRange(startIso, endIso) {
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "-";
    return `${start.toLocaleString("de-DE")} - ${end.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
  }

  function enrichEvent(row, kind) {
    return {
      id: String(row?.id || ""),
      kind,
      title: String(row?.title || "").trim() || "Ohne Titel",
      description: String(row?.description || "").trim(),
      location: String(row?.location || "").trim(),
      starts_at: row?.starts_at || null,
      ends_at: row?.ends_at || null,
      status: String(row?.status || "").trim() || "draft",
      max_participants: row?.max_participants ?? null,
      sourceLabel: kind === "work_event" ? "Arbeitseinsatz" : "Termin",
    };
  }

  function configForEvent(event) {
    return state.plannerConfigs.find((config) => {
      if (event.kind === "club_event") return config.base_club_event_id === event.id;
      return config.base_work_event_id === event.id;
    }) || null;
  }

  function slotsForPlanner(plannerId) {
    return state.plannerSlots
      .filter((slot) => slot.planner_config_id === plannerId)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }

  function registrationsForPlanner(plannerId) {
    return state.plannerRegistrations.filter((row) => row.planner_config_id === plannerId);
  }

  function activeCount(rows) {
    return rows.filter((row) => ["pending", "approved"].includes(String(row.status || "").toLowerCase())).length;
  }

  function memberRoleEntryKey(clubId, userId) {
    return `${String(clubId || "").trim()}:${String(userId || "").trim()}`;
  }

  function memberIsManagerInClub(clubId, userId) {
    return ["admin", "vorstand"].includes(state.memberRoleKeys.get(memberRoleEntryKey(clubId, userId)) || "");
  }

  function effectiveActiveCount(rows, slot = null, clubId = "") {
    return (Array.isArray(rows) ? rows : []).filter((row) => {
      if (!["pending", "approved"].includes(String(row.status || "").toLowerCase())) return false;
      if (!slot || slot.leaders_count_towards_capacity) return true;
      return !memberIsManagerInClub(clubId, row.auth_uid);
    }).length;
  }

  function myRegistrationForPlanner(plannerId, slotId = null) {
    return state.myRegistrations.find((row) => row.planner_config_id === plannerId && String(row.slot_id || "") === String(slotId || "")) || null;
  }

  async function loadData() {
    try {
      const nowIso = new Date().toISOString();
      const [clubEvents, workEvents, configs, slots, registrations] = await Promise.all([
        sb(`/rest/v1/club_events?select=id,title,description,location,starts_at,ends_at,status&status=eq.published&ends_at=gte.${encodeURIComponent(nowIso)}&order=starts_at.asc`, { method: "GET" }, true),
        sb(`/rest/v1/work_events?select=id,title,description,location,starts_at,ends_at,status,max_participants&status=eq.published&ends_at=gte.${encodeURIComponent(nowIso)}&order=starts_at.asc`, { method: "GET" }, true),
        sb("/rest/v1/event_planner_configs?select=id,club_id,base_kind,base_club_event_id,base_work_event_id,approval_mode,planning_mode,required_people,repeat_rule,max_participants_enabled,leaders_count_towards_capacity&order=created_at.asc", { method: "GET" }, true),
        sb("/rest/v1/event_planner_slots?select=id,planner_config_id,title,description,starts_at,ends_at,required_people,sort_order,leaders_count_towards_capacity&order=starts_at.asc", { method: "GET" }, true),
        sb("/rest/v1/event_planner_registrations?select=id,planner_config_id,slot_id,auth_uid,status,note_member&order=created_at.desc", { method: "GET" }, true),
      ]);

      state.events = [
        ...(Array.isArray(clubEvents) ? clubEvents.map((row) => enrichEvent(row, "club_event")) : []),
        ...(Array.isArray(workEvents) ? workEvents.map((row) => enrichEvent(row, "work_event")) : []),
      ].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
      state.plannerConfigs = Array.isArray(configs) ? configs : [];
      state.plannerSlots = Array.isArray(slots) ? slots : [];
      state.plannerRegistrations = Array.isArray(registrations) ? registrations : [];
      state.myRegistrations = state.plannerRegistrations.filter((row) => row.auth_uid === currentUserId());
      const roleUserIds = [...new Set(state.plannerRegistrations.map((row) => String(row.auth_uid || "").trim()).filter(Boolean))];
      if (roleUserIds.length) {
        const inList = roleUserIds.map((id) => `"${id}"`).join(",");
        const roleRows = await sb(`/rest/v1/club_user_roles?select=club_id,user_id,role_key&user_id=in.(${inList})`, { method: "GET" }, true).catch(() => []);
        state.memberRoleKeys = new Map((Array.isArray(roleRows) ? roleRows : []).map((row) => [
          memberRoleEntryKey(row.club_id, row.user_id),
          String(row.role_key || "").trim().toLowerCase(),
        ]));
      } else {
        state.memberRoleKeys = new Map();
      }
      state.migrationAvailable = true;
    } catch (error) {
      if (!isMissingPlannerSchema(error)) throw error;
      state.migrationAvailable = false;
      state.events = [];
      state.plannerConfigs = [];
      state.plannerSlots = [];
      state.plannerRegistrations = [];
      state.myRegistrations = [];
      state.memberRoleKeys = new Map();
      setMsg("Phase-2-Migration für Eventplaner ist in dieser Umgebung noch nicht aktiv.");
    }
  }

  async function registerForPlanner(plannerId, slotId = null) {
    return sb("/rest/v1/rpc/event_planner_register", {
      method: "POST",
      body: JSON.stringify({
        p_planner_config_id: plannerId,
        p_slot_id: slotId,
        p_note_member: null,
      }),
    }, true);
  }

  async function unregisterFromPlanner(registrationId) {
    return sb("/rest/v1/rpc/event_planner_unregister", {
      method: "POST",
      body: JSON.stringify({
        p_registration_id: registrationId,
      }),
    }, true);
  }

  function render() {
    const root = document.getElementById("eventPlannerMemberList");
    if (!root) return;

    if (!state.migrationAvailable) {
      root.innerHTML = `<div class="card"><div class="card__body"><p class="small">Die Planungsdatenbank ist hier noch nicht bereit.</p></div></div>`;
      return;
    }

    const planableEvents = state.events.filter((event) => !!configForEvent(event));
    if (!planableEvents.length) {
      root.innerHTML = `<div class="card"><div class="card__body"><p class="small">Aktuell sind keine planbaren Events freigeschaltet.</p></div></div>`;
      return;
    }

    root.innerHTML = planableEvents.map((event) => {
      const config = configForEvent(event);
      const registrations = registrationsForPlanner(config.id);
      const simpleCapacity = config.max_participants_enabled ? (Number(config.required_people || event.max_participants || 0) || null) : null;
      const simpleTaken = effectiveActiveCount(registrations.filter((row) => !row.slot_id), config, config.club_id);
      const mySimpleRegistration = myRegistrationForPlanner(config.id, null);

      const slotMarkup = config.planning_mode === "structured"
        ? slotsForPlanner(config.id).map((slot) => {
            const slotRegs = registrations.filter((row) => row.slot_id === slot.id);
            const mySlotRegistration = myRegistrationForPlanner(config.id, slot.id);
            const freeText = `${effectiveActiveCount(slotRegs, slot, config.club_id)} / ${slot.required_people}`;
            return `
              <div class="event-planner-member-slot">
                <div>
                  <strong>${escapeHtml(slot.title)}</strong>
                  <p class="small">${escapeHtml(formatRange(slot.starts_at, slot.ends_at))}</p>
                  <p class="small">${escapeHtml(slot.description || "Ohne Zusatzhinweis")}</p>
                  <p class="small">Plaetze: ${escapeHtml(freeText)}</p>
                </div>
                <div class="admin-actions admin-actions--toolbar">
                  ${
                    mySlotRegistration
                      ? `<button type="button" class="feed-btn feed-btn--ghost" data-unregister-registration="${escapeHtml(mySlotRegistration.id)}">Abmelden</button>`
                      : `<button type="button" class="feed-btn" data-register-planner="${escapeHtml(config.id)}" data-register-slot="${escapeHtml(slot.id)}">Anmelden</button>`
                  }
                </div>
              </div>
            `;
          }).join("")
        : `
          <div class="event-planner-member-slot">
            <div>
              <strong>Gesamtanmeldung</strong>
              <p class="small">${simpleCapacity ? `${simpleTaken} / ${simpleCapacity}` : `${simpleTaken} angemeldet`}</p>
            </div>
            <div class="admin-actions admin-actions--toolbar">
              ${
                mySimpleRegistration
                  ? `<button type="button" class="feed-btn feed-btn--ghost" data-unregister-registration="${escapeHtml(mySimpleRegistration.id)}">Abmelden</button>`
                  : `<button type="button" class="feed-btn" data-register-planner="${escapeHtml(config.id)}">Anmelden</button>`
              }
            </div>
          </div>
        `;

      return `
        <article class="card">
          <div class="card__body event-planner-member-card">
            <div class="event-planner-day-card__meta">
              <strong>${escapeHtml(event.title)}</strong>
              <span class="event-planner-pill">${escapeHtml(event.sourceLabel)}</span>
              <span class="event-planner-pill event-planner-pill--muted">${escapeHtml(config.approval_mode === "auto" ? "Auto-Freigabe" : "Manuelle Freigabe")}</span>
            </div>
            <p class="small">${escapeHtml(formatRange(event.starts_at, event.ends_at))}</p>
            <p class="small">${escapeHtml(event.location || "Ohne Ort")}</p>
            ${event.description ? `<p class="small">${escapeHtml(event.description)}</p>` : ""}
            <div class="event-planner-member-slots">${slotMarkup}</div>
          </div>
        </article>
      `;
    }).join("");
  }

  async function reload(message = "") {
    await loadData();
    render();
    if (message) setMsg(message);
  }

  async function init() {
    try {
      if (!session()?.user) {
        setMsg("Bitte einloggen, um planbare Events zu sehen.");
        return;
      }
      await loadData();
      render();
      if (state.migrationAvailable) setMsg("Planbare Events bereit.");

      document.body.addEventListener("click", async (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        const registerButton = target.closest("[data-register-planner]");
        if (registerButton) {
          const plannerId = String(registerButton.getAttribute("data-register-planner") || "");
          const slotId = String(registerButton.getAttribute("data-register-slot") || "") || null;
          try {
            await registerForPlanner(plannerId, slotId);
            await reload("Anmeldung gespeichert.");
            document.dispatchEvent(new CustomEvent("vdan:notifications-refresh"));
          } catch (error) {
            console.error("[event-planner-member-register]", error);
            setMsg(`Anmeldung fehlgeschlagen: ${error?.message || error}`);
          }
          return;
        }

        const unregisterButton = target.closest("[data-unregister-registration]");
        if (unregisterButton) {
          const registrationId = String(unregisterButton.getAttribute("data-unregister-registration") || "");
          try {
            await unregisterFromPlanner(registrationId);
            await reload("Anmeldung entfernt.");
            document.dispatchEvent(new CustomEvent("vdan:notifications-refresh"));
          } catch (error) {
            console.error("[event-planner-member-unregister]", error);
            setMsg(`Abmeldung fehlgeschlagen: ${error?.message || error}`);
          }
        }
      });
    } catch (error) {
      console.error("[event-planner-member]", error);
      setMsg(`Mitgliederansicht konnte nicht geladen werden: ${error?.message || error}`);
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
