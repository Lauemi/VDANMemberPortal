;(() => {
  const MANAGER_ROLES = new Set(["admin", "vorstand"]);
  const SECTION_ATTR = "data-eventplanner-section";
  const PANEL_ATTR = "data-eventplanner-panel";

  const state = {
    currentMonth: startOfMonth(new Date()),
    selectedDate: toDateKey(new Date()),
    clubOptions: [],
    selectedClubId: "",
    profileClubId: "",
    events: [],
    workParticipations: [],
    plannerConfigs: [],
    plannerSlots: [],
    plannerRegistrations: [],
    memberLabels: new Map(),
    memberRoleKeys: new Map(),
    roles: [],
    selectedEventId: "",
    selectedOpenApprovalEventId: "",
    selectedApprovedApprovalEventId: "",
    approvalEditingRows: new Set(),
    migrationAvailable: true,
    createRowActive: false,
    createKind: "club_event",
    sourceDialogEventId: "",
  };
  const holidayCache = new Map();

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

  function selectedClub() {
    return state.clubOptions.find((club) => String(club.id || "") === String(state.selectedClubId || "")) || null;
  }

  function isManagerRole(role) {
    return MANAGER_ROLES.has(String(role || "").toLowerCase());
  }

  function setMsg(text = "") {
    const el = document.getElementById("eventPlannerMsg");
    if (!el) return;
    const nextText = String(text || "").trim();
    el.textContent = nextText;
    const hasText = Boolean(nextText);
    el.hidden = !hasText;
    el.classList.toggle("hidden", !hasText);
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
      const error = new Error(err?.message || err?.detail || err?.hint || err?.error_description || `Request failed (${res.status})`);
      error.status = res.status;
      throw error;
    }
    return res.json().catch(() => ([]));
  }

  function isMissingPlannerSchema(error) {
    const msg = String(error?.message || "").toLowerCase();
    return msg.includes("event_planner");
  }

  async function loadRoles() {
    const uid = currentUserId();
    if (!uid) return [];
    const rows = await sb(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(uid)}`, { method: "GET" }, true);
    return Array.isArray(rows) ? rows.map((row) => String(row.role || "").toLowerCase()) : [];
  }

  async function loadClubOptions() {
    const uid = currentUserId();
    if (!uid) {
      state.clubOptions = [];
      state.selectedClubId = "";
      return;
    }

    const [profileRows, aclRows, identityRows] = await Promise.all([
      sb(`/rest/v1/profiles?select=id,club_id&id=eq.${encodeURIComponent(uid)}&limit=1`, { method: "GET" }, true).catch(() => []),
      sb(`/rest/v1/club_user_roles?select=club_id,role_key&user_id=eq.${encodeURIComponent(uid)}`, { method: "GET" }, true).catch(() => []),
      sb("/rest/v1/rpc/get_club_identity_map", { method: "POST", body: "{}" }, true).catch(() => []),
    ]);

    const managedClubIds = [...new Set((Array.isArray(aclRows) ? aclRows : [])
      .filter((row) => ["admin", "vorstand"].includes(String(row?.role_key || "").trim().toLowerCase()))
      .map((row) => String(row?.club_id || "").trim())
      .filter(Boolean))];

    const identityByClub = new Map();
    (Array.isArray(identityRows) ? identityRows : []).forEach((row) => {
      const clubId = String(row?.club_id || "").trim();
      if (!clubId) return;
      identityByClub.set(clubId, {
        code: String(row?.club_code || "").trim().toUpperCase(),
        name: String(row?.club_name || "").trim(),
      });
    });

    state.clubOptions = managedClubIds.map((clubId) => {
      const meta = identityByClub.get(clubId) || {};
      const code = String(meta.code || "").trim();
      const name = String(meta.name || "").trim() || code || `Verein ${clubId.slice(0, 8)}`;
      return {
        id: clubId,
        code,
        name,
        badge: (code || name).slice(0, 3).toUpperCase(),
      };
    }).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "de"));

    const profileClubId = String(profileRows?.[0]?.club_id || "").trim();
    state.profileClubId = profileClubId;
    state.selectedClubId = state.clubOptions.find((club) => club.id === profileClubId)?.id || state.clubOptions[0]?.id || "";
  }

  async function switchActiveClub(clubId, options = {}) {
    const nextClubId = String(clubId || "").trim();
    const uid = currentUserId();
    if (!uid || !nextClubId) return;

    await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(uid)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ club_id: nextClubId }),
    }, true);

    state.selectedClubId = nextClubId;
    state.profileClubId = nextClubId;
    renderClubSwitch();
    if (!options.silent) setMsg("");
    await loadData();
    if (state.selectedEventId && !planningRows().some((row) => row.id === state.selectedEventId)) {
      state.selectedEventId = "";
    }
    renderAll();
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function toDateKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function startOfMonth(value) {
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(date.getTime())) return new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("de-DE");
  }

  function formatDateTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("de-DE");
  }

  function formatDateTimeCompact(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatRange(startIso, endIso) {
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "-";
    return `${start.toLocaleString("de-DE")} - ${end.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
  }

  function formatTimeRange(startIso, endIso) {
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "-";
    const opts = { hour: "2-digit", minute: "2-digit" };
    return `${start.toLocaleTimeString("de-DE", opts)} - ${end.toLocaleTimeString("de-DE", opts)}`;
  }

  function easterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  function addDays(date, offset) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
  }

  function germanHolidayMap(year) {
    if (holidayCache.has(year)) return holidayCache.get(year);
    const easter = easterSunday(year);
    const entries = [
      [new Date(year, 0, 1), "Neujahr"],
      [addDays(easter, -2), "Karfreitag"],
      [addDays(easter, 1), "Ostermontag"],
      [new Date(year, 4, 1), "Tag der Arbeit"],
      [addDays(easter, 39), "Christi Himmelfahrt"],
      [addDays(easter, 50), "Pfingstmontag"],
      [new Date(year, 9, 3), "Tag der Deutschen Einheit"],
      [new Date(year, 11, 25), "1. Weihnachtstag"],
      [new Date(year, 11, 26), "2. Weihnachtstag"],
    ];
    const map = new Map(entries.map(([date, label]) => [toDateKey(date), label]));
    holidayCache.set(year, map);
    return map;
  }

  function holidayNameForDate(date) {
    const day = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(day.getTime())) return "";
    return germanHolidayMap(day.getFullYear()).get(toDateKey(day)) || "";
  }

  function toLocalInput(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (part) => String(part).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function toIsoFromLocalInput(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  function computeMinutes(checkinAt, checkoutAt) {
    const start = checkinAt ? new Date(checkinAt) : null;
    const end = checkoutAt ? new Date(checkoutAt) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
    return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
  }

  function syncFormDefaults(form) {
    if (!(form instanceof HTMLFormElement)) return;
    form.querySelectorAll("input, textarea, select").forEach((field) => {
      if (field instanceof HTMLInputElement) {
        if (field.type === "checkbox" || field.type === "radio") {
          field.defaultChecked = field.checked;
        } else {
          field.defaultValue = field.value;
        }
        return;
      }
      if (field instanceof HTMLTextAreaElement) {
        field.defaultValue = field.value;
        return;
      }
      if (field instanceof HTMLSelectElement) {
        [...field.options].forEach((option) => {
          option.defaultSelected = option.selected;
        });
      }
    });
  }

  function baseKey(kind, id) {
    return `${String(kind || "").trim()}:${String(id || "").trim()}`;
  }

  function memberLabel(userId) {
    return state.memberLabels.get(String(userId || "").trim()) || "Mitglied";
  }

  function memberRoleKey(userId) {
    return state.memberRoleKeys.get(String(userId || "").trim()) || "";
  }

  function memberIsManager(userId) {
    return ["admin", "vorstand"].includes(memberRoleKey(userId));
  }

  function belongsToSelectedClub(row) {
    const activeClubId = String(state.selectedClubId || "").trim();
    if (!activeClubId) return true;
    return String(row?.club_id || "").trim() === activeClubId;
  }

  function enrichEvent(row, kind) {
    return {
      id: String(row?.id || ""),
      club_id: String(row?.club_id || "").trim(),
      kind,
      title: String(row?.title || "").trim() || "Ohne Titel",
      description: String(row?.description || "").trim(),
      location: String(row?.location || "").trim(),
      starts_at: row?.starts_at || null,
      ends_at: row?.ends_at || null,
      status: String(row?.status || "").trim() || "draft",
      max_participants: row?.max_participants ?? null,
      is_youth: Boolean(row?.is_youth),
      sourceHref: kind === "work_event" ? "/app/arbeitseinsaetze/cockpit/" : "/app/termine/cockpit/",
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

  function registrationsForSlot(slotId) {
    return state.plannerRegistrations.filter((row) => row.slot_id === slotId);
  }

  function workParticipationsForEvent(eventId) {
    return state.workParticipations
      .filter((row) => String(row.event_id || "") === String(eventId || ""))
      .sort((a, b) => {
        const aTime = new Date(a.checkin_at || a.created_at || 0).getTime();
        const bTime = new Date(b.checkin_at || b.created_at || 0).getTime();
        return bTime - aTime;
      });
  }

  function workParticipationIsActive(row) {
    return Boolean(row?.checkin_at) && !row?.checkout_at && !["rejected", "no_show"].includes(String(row?.status || "").toLowerCase());
  }

  function workParticipationIsGone(row) {
    return Boolean(row?.checkout_at);
  }

  function workPendingDecision(row) {
    return ["registered", "checked_in", "submitted"].includes(String(row?.status || "").toLowerCase());
  }

  function workParticipationIsApproved(row) {
    return String(row?.status || "").toLowerCase() === "approved";
  }

  function workApprovalGroups(statusFilter = "pending") {
    return state.events
      .filter((event) => event.kind === "work_event")
      .map((event) => {
        const allRows = workParticipationsForEvent(event.id);
        const rows = allRows.filter((row) => statusFilter === "approved"
          ? workParticipationIsApproved(row)
          : workPendingDecision(row));
        const pending = rows.filter(workPendingDecision).length;
        const active = rows.filter(workParticipationIsActive).length;
        const gone = rows.filter(workParticipationIsGone).length;
        return { key: `work:${event.id}`, event, rows, pending, active, gone, sourceKind: "work" };
      })
      .filter((entry) => entry.rows.length > 0)
      .sort((a, b) => new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime());
  }

  function plannerApprovalGroups(statusFilter = "pending") {
    return state.events
      .map((event) => {
        const config = configForEvent(event);
        if (!config) return null;
        const rows = registrationsForPlanner(config.id).filter((row) => String(row.status || "").toLowerCase() === statusFilter);
        const pending = rows.filter((row) => String(row.status || "").toLowerCase() === "pending").length;
        return {
          key: `planner:${event.id}`,
          event,
          config,
          rows,
          pending,
          active: rows.length,
          gone: 0,
          sourceKind: "planner",
        };
      })
      .filter((entry) => entry && entry.rows.length > 0)
      .sort((a, b) => new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime());
  }

  function approvalGroups(statusFilter = "pending") {
    return [...plannerApprovalGroups(statusFilter), ...workApprovalGroups(statusFilter)]
      .sort((a, b) => new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime());
  }

  function memberNamesForSlot(slotId) {
    const names = registrationsForSlot(slotId)
      .filter((row) => ["pending", "approved"].includes(String(row.status || "").toLowerCase()))
      .map((row) => memberLabel(row.auth_uid))
      .filter(Boolean);
    return names.length ? names.join(", ") : "-";
  }

  function registrationCountsTowardCoverage(slot, registration) {
    if (!slot || slot.leaders_count_towards_capacity) return true;
    return !memberIsManager(registration?.auth_uid);
  }

  function configCountsTowardCoverage(config, registration) {
    if (!config || config.leaders_count_towards_capacity) return true;
    return !memberIsManager(registration?.auth_uid);
  }

  function effectiveActiveRegistrations(rows, slot = null) {
    return (Array.isArray(rows) ? rows : []).filter((row) => (
      ["pending", "approved"].includes(String(row.status || "").toLowerCase())
      && registrationCountsTowardCoverage(slot, row)
    ));
  }

  function plannedHelperStats(event) {
    const config = configForEvent(event);
    if (!config) {
      if (event.kind !== "work_event") return { mode: "none", required: null, taken: 0, pending: 0 };
      const rows = state.workParticipations.filter((row) => row.event_id === event.id);
      return {
        mode: "legacy",
        required: Number.isFinite(Number(event.max_participants)) ? Number(event.max_participants) : null,
        taken: rows.filter((row) => !["rejected", "no_show"].includes(String(row.status || "").toLowerCase())).length,
        pending: rows.filter((row) => ["registered", "checked_in", "submitted"].includes(String(row.status || "").toLowerCase())).length,
      };
    }

    const regs = registrationsForPlanner(config.id);
    const activeRegs = regs.filter((row) => ["pending", "approved"].includes(String(row.status || "").toLowerCase()));
    const pending = regs.filter((row) => String(row.status || "").toLowerCase() === "pending").length;
    if (config.planning_mode === "structured") {
      const required = slotsForPlanner(config.id).reduce((sum, slot) => sum + Number(slot.required_people || 0), 0);
      const taken = slotsForPlanner(config.id).reduce((sum, slot) => (
        sum + effectiveActiveRegistrations(registrationsForSlot(slot.id), slot).length
      ), 0);
      return { mode: "structured", required, taken, pending };
    }

    return {
      mode: "simple",
      required: Number(config.required_people || event.max_participants || 0) || null,
      taken: activeRegs.filter((row) => configCountsTowardCoverage(config, row)).length,
      pending,
    };
  }

  function selectedEvent() {
    return state.events.find((event) => event.id === state.selectedEventId) || null;
  }

  function isUpcomingEvent(event) {
    const start = new Date(event?.starts_at || "");
    if (Number.isNaN(start.getTime())) return false;
    const status = String(event?.status || "").toLowerCase();
    if (["cancelled", "archived"].includes(status)) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return start.getTime() >= today.getTime();
  }

  function managedEvents() {
    return state.events.filter((event) => configForEvent(event));
  }

  function sourcePlanningCandidates() {
    return state.events.filter((event) => !configForEvent(event) && isUpcomingEvent(event));
  }

  function planningRows() {
    return state.events
      .filter((event) => isUpcomingEvent(event) || configForEvent(event))
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }

  async function loadMemberLabels(userIds = []) {
    const uniqueIds = [...new Set((Array.isArray(userIds) ? userIds : []).map((id) => String(id || "").trim()).filter(Boolean))];
    if (!uniqueIds.length) {
      state.memberLabels = new Map();
      state.memberRoleKeys = new Map();
      return;
    }
    const inList = uniqueIds.map((id) => `"${id}"`).join(",");
    const activeClubId = String(state.selectedClubId || "").trim();
    const [rows, roleRows] = await Promise.all([
      sb(`/rest/v1/profiles?select=id,display_name,member_no,email&id=in.(${inList})`, { method: "GET" }, true).catch(() => []),
      activeClubId
        ? sb(`/rest/v1/club_user_roles?select=user_id,role_key&club_id=eq.${encodeURIComponent(activeClubId)}&user_id=in.(${inList})`, { method: "GET" }, true).catch(() => [])
        : Promise.resolve([]),
    ]);
    state.memberLabels = new Map((Array.isArray(rows) ? rows : []).map((row) => [
      String(row.id || "").trim(),
      String(row.display_name || row.member_no || row.email || row.id || "").trim(),
    ]));
    state.memberRoleKeys = new Map((Array.isArray(roleRows) ? roleRows : []).map((row) => [
      String(row.user_id || "").trim(),
      String(row.role_key || "").trim().toLowerCase(),
    ]));
  }

  async function loadData() {
    const activeClubId = String(state.selectedClubId || "").trim();
    const clubFilter = activeClubId ? `&club_id=eq.${encodeURIComponent(activeClubId)}` : "";
    const [clubEvents, workEvents, workParticipations] = await Promise.all([
      sb(`/rest/v1/club_events?select=id,club_id,title,description,location,starts_at,ends_at,status,is_youth&order=starts_at.asc${clubFilter}`, { method: "GET" }, true),
      sb(`/rest/v1/work_events?select=id,club_id,title,description,location,starts_at,ends_at,status,max_participants,is_youth&order=starts_at.asc${clubFilter}`, { method: "GET" }, true),
      sb(`/rest/v1/work_participations?select=id,club_id,event_id,auth_uid,status,minutes_reported,minutes_approved,checkin_at,checkout_at,note_member,note_admin,approved_at,created_at&order=created_at.desc${clubFilter}`, { method: "GET" }, true),
    ]);

    const merged = [
      ...(Array.isArray(clubEvents) ? clubEvents.map((row) => enrichEvent(row, "club_event")) : []),
      ...(Array.isArray(workEvents) ? workEvents.map((row) => enrichEvent(row, "work_event")) : []),
    ].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

    state.events = merged;
    state.workParticipations = Array.isArray(workParticipations) ? workParticipations : [];

    try {
      const [configs, slots, registrations] = await Promise.all([
        sb(`/rest/v1/event_planner_configs?select=id,club_id,base_kind,base_club_event_id,base_work_event_id,approval_mode,planning_mode,required_people,repeat_rule,max_participants_enabled,leaders_count_towards_capacity,created_at&order=created_at.asc${clubFilter}`, { method: "GET" }, true),
        sb(`/rest/v1/event_planner_slots?select=id,club_id,planner_config_id,title,description,starts_at,ends_at,required_people,sort_order,leaders_count_towards_capacity,created_at&order=starts_at.asc${clubFilter}`, { method: "GET" }, true),
        sb(`/rest/v1/event_planner_registrations?select=id,club_id,planner_config_id,slot_id,auth_uid,status,note_member,note_admin,approved_at,created_at&order=created_at.desc${clubFilter}`, { method: "GET" }, true),
      ]);
      state.plannerConfigs = Array.isArray(configs) ? configs : [];
      state.plannerSlots = Array.isArray(slots) ? slots : [];
      state.plannerRegistrations = Array.isArray(registrations) ? registrations : [];
      state.migrationAvailable = true;
    } catch (error) {
      if (!isMissingPlannerSchema(error)) throw error;
      state.plannerConfigs = [];
      state.plannerSlots = [];
      state.plannerRegistrations = [];
      state.migrationAvailable = false;
      setMsg("Phase-2-Migration für Eventplaner noch nicht aktiv. Board zeigt nur die Basisansicht.");
    }

    await loadMemberLabels([
      ...state.plannerRegistrations.filter(belongsToSelectedClub).map((row) => row.auth_uid),
      ...state.workParticipations.filter(belongsToSelectedClub).map((row) => row.auth_uid),
    ]);
    if (state.selectedEventId && !planningRows().some((event) => event.id === state.selectedEventId)) {
      state.selectedEventId = "";
    }
    if (state.selectedOpenApprovalEventId && !approvalGroups("pending").some((entry) => entry.key === state.selectedOpenApprovalEventId)) {
      state.selectedOpenApprovalEventId = "";
    }
    if (state.selectedApprovedApprovalEventId && !approvalGroups("approved").some((entry) => entry.key === state.selectedApprovedApprovalEventId)) {
      state.selectedApprovedApprovalEventId = "";
    }
  }

  async function upsertPlannerConfig(event, payload) {
    return sb("/rest/v1/rpc/event_planner_upsert_for_base", {
      method: "POST",
      body: JSON.stringify({
        p_base_kind: event.kind,
        p_base_id: event.id,
        p_approval_mode: payload.approval_mode,
        p_planning_mode: payload.planning_mode,
        p_required_people: payload.required_people,
        p_repeat_rule: payload.repeat_rule,
        p_max_participants_enabled: Boolean(payload.max_participants_enabled),
        p_leaders_count_towards_capacity: Boolean(payload.leaders_count_towards_capacity),
      }),
    }, true);
  }

  async function createClubEvent(payload) {
    try {
      return await sb("/rest/v1/rpc/term_event_create", { method: "POST", body: JSON.stringify(payload) }, true);
    } catch (error) {
      if (Object.prototype.hasOwnProperty.call(payload || {}, "p_is_youth")) {
        const fallback = { ...payload };
        delete fallback.p_is_youth;
        return sb("/rest/v1/rpc/term_event_create", { method: "POST", body: JSON.stringify(fallback) }, true);
      }
      throw error;
    }
  }

  async function createWorkEvent(payload) {
    return sb("/rest/v1/rpc/work_event_create", { method: "POST", body: JSON.stringify(payload) }, true);
  }

  function createdEventId(result) {
    if (Array.isArray(result)) {
      return String(result[0]?.id || result[0]?.event_id || result[0]?.p_event_id || "").trim();
    }
    return String(result?.id || result?.event_id || result?.p_event_id || "").trim();
  }

  async function findCreatedEventId(kind, title, startsAt) {
    const normalizedTitle = String(title || "").trim().toLowerCase();
    const normalizedStart = String(startsAt || "").trim();
    const collection = kind === "work_event"
      ? await sb("/rest/v1/work_events?select=id,title,starts_at&order=starts_at.desc&limit=20", { method: "GET" }, true).catch(() => [])
      : await sb("/rest/v1/club_events?select=id,title,starts_at&order=starts_at.desc&limit=20", { method: "GET" }, true).catch(() => []);
    const rows = Array.isArray(collection) ? collection : [];
    const hit = rows.find((row) => (
      String(row?.title || "").trim().toLowerCase() === normalizedTitle
      && String(row?.starts_at || "").trim() === normalizedStart
    ));
    return String(hit?.id || "").trim();
  }

  async function upsertSlot(plannerId, slotPayload) {
    return sb("/rest/v1/rpc/event_planner_slot_upsert", {
      method: "POST",
      body: JSON.stringify({
        p_planner_config_id: plannerId,
        p_slot_id: slotPayload.slot_id || null,
        p_title: slotPayload.title,
        p_description: slotPayload.description,
        p_starts_at: slotPayload.starts_at,
        p_ends_at: slotPayload.ends_at,
        p_required_people: slotPayload.required_people,
        p_sort_order: slotPayload.sort_order ?? 100,
        p_leaders_count_towards_capacity: Boolean(slotPayload.leaders_count_towards_capacity),
      }),
    }, true);
  }

  async function deleteSlot(slotId) {
    return sb("/rest/v1/rpc/event_planner_slot_delete", {
      method: "POST",
      body: JSON.stringify({ p_slot_id: slotId }),
    }, true);
  }

  async function approveRegistration(registrationId, noteAdmin = null) {
    return sb("/rest/v1/rpc/event_planner_registration_approve", {
      method: "POST",
      body: JSON.stringify({
        p_registration_id: registrationId,
        p_note_admin: noteAdmin,
      }),
    }, true);
  }

  async function rejectRegistration(registrationId, noteAdmin = null) {
    return sb("/rest/v1/rpc/event_planner_registration_reject", {
      method: "POST",
      body: JSON.stringify({
        p_registration_id: registrationId,
        p_note_admin: noteAdmin,
      }),
    }, true);
  }

  async function approveWorkParticipation(participationId, minutesApproved) {
    return sb("/rest/v1/rpc/work_approve", {
      method: "POST",
      body: JSON.stringify({
        p_participation_id: participationId,
        p_minutes_approved: Number.isFinite(minutesApproved) ? minutesApproved : 0,
      }),
    }, true);
  }

  async function rejectWorkParticipation(participationId, noteAdmin = null) {
    return sb("/rest/v1/rpc/work_reject", {
      method: "POST",
      body: JSON.stringify({
        p_participation_id: participationId,
        p_note_admin: noteAdmin,
      }),
    }, true);
  }

  async function adminUpdateParticipationTime(participationId, checkinAt, checkoutAt, noteAdmin = null) {
    return sb("/rest/v1/rpc/work_participation_admin_update", {
      method: "POST",
      body: JSON.stringify({
        p_participation_id: participationId,
        p_checkin_at: checkinAt || null,
        p_checkout_at: checkoutAt || null,
        p_note_admin: noteAdmin,
      }),
    }, true);
  }

  async function patchBaseEvent(eventId, kind, payload) {
    const path = kind === "work_event"
      ? `/rest/v1/work_events?id=eq.${encodeURIComponent(eventId)}`
      : `/rest/v1/club_events?id=eq.${encodeURIComponent(eventId)}`;
    return sb(path, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    }, true);
  }

  async function deletePlannerConfig(configId) {
    return sb(`/rest/v1/event_planner_configs?id=eq.${encodeURIComponent(configId)}`, {
      method: "DELETE",
    }, true);
  }

  async function deleteBaseEvent(event) {
    const path = event?.kind === "work_event"
      ? `/rest/v1/work_events?id=eq.${encodeURIComponent(event.id)}`
      : `/rest/v1/club_events?id=eq.${encodeURIComponent(event.id)}`;
    return sb(path, { method: "DELETE" }, true);
  }

  function renderKpis() {
    const total = state.events.length;
    const terms = state.events.filter((row) => row.kind === "club_event").length;
    const work = state.events.filter((row) => row.kind === "work_event").length;
    const pending = state.plannerRegistrations.filter((row) => String(row.status || "").toLowerCase() === "pending").length;
    const helpers = state.plannerRegistrations.filter((row) => ["pending", "approved"].includes(String(row.status || "").toLowerCase())).length;

    const mappings = [
      ["eventPlannerKpiTotal", total],
      ["eventPlannerKpiTerms", terms],
      ["eventPlannerKpiWork", work],
      ["eventPlannerKpiPending", pending],
      ["eventPlannerKpiHelpers", helpers],
    ];
    mappings.forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(value);
    });
  }

  function renderClubSwitch() {
    const list = document.getElementById("eventPlannerClubSwitchList");
    const label = document.getElementById("eventPlannerActiveClubLabel");
    if (label) label.textContent = selectedClub()?.name || "-";
    if (!list) return;
    if (!state.clubOptions.length) {
      list.innerHTML = '<span class="small">Kein Vereinskontext verfügbar.</span>';
      return;
    }
    list.innerHTML = state.clubOptions.map((club) => `
      <button
        type="button"
        class="event-planner-club-chip ${club.id === state.selectedClubId ? "is-active" : ""}"
        data-eventplanner-club="${escapeHtml(club.id)}"
        title="${escapeHtml(club.name)}"
        aria-pressed="${club.id === state.selectedClubId ? "true" : "false"}"
      >
        <span class="event-planner-club-chip__badge">${escapeHtml(club.badge)}</span>
        <span class="event-planner-club-chip__label">${escapeHtml(club.code || club.name)}</span>
      </button>
    `).join("");
  }

  function monthMatrix(date) {
    const first = startOfMonth(date);
    const firstDay = new Date(first.getFullYear(), first.getMonth(), 1);
    const offset = (firstDay.getDay() + 6) % 7;
    const cursor = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
    const days = [];
    for (let i = 0; i < 42; i += 1) {
      days.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + i));
    }
    return days;
  }

  function isoWeekNumber(date) {
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayNumber = (target.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNumber + 3);
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const firstThursdayDayNumber = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - firstThursdayDayNumber + 3);
    return 1 + Math.round((target.getTime() - firstThursday.getTime()) / 604800000);
  }

  function dayEvents(dateKey) {
    return state.events
      .filter((event) => toDateKey(event.starts_at) === dateKey)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }

  function calendarEventTypeMeta(event) {
    if (event.kind === "club_event") {
      if (event.is_youth) {
        return { className: "is-youth", label: "Jugend" };
      }
      return { className: "is-adult", label: "Erwachsene" };
    }
    return { className: "is-work", label: "Arbeitseinsatz" };
  }

  function renderCalendarMiniItems(events) {
    if (!events.length) return `<li class="event-planner-calendar__mini-item is-empty">-</li>`;
    return events.slice(0, 2).map((event) => {
      const meta = calendarEventTypeMeta(event);
      return `
        <li class="event-planner-calendar__mini-item ${meta.className}">
          <span class="event-planner-calendar__mini-label">${escapeHtml(meta.label)}</span>
          <span class="event-planner-calendar__mini-title">${escapeHtml(event.title)}</span>
        </li>
      `;
    }).join("");
  }

  function renderDayCardsForKey(dateKey) {
    const rows = dayEvents(dateKey);
    if (!rows.length) {
      return `<div class="event-planner-day-card"><strong>Keine Einträge</strong><p class="small">An diesem Tag liegen aktuell keine Termine oder Arbeitseinsätze vor.</p></div>`;
    }

    return rows.map((event) => {
      const config = configForEvent(event);
      const stats = plannedHelperStats(event);
      const planningLabel = !config
        ? "Noch keine Planungslogik"
        : `${config.planning_mode === "structured" ? "Slots aktiv" : "Einfache Planung"} / ${config.approval_mode === "auto" ? "Auto" : "Manuell"}`;
      const helperText = `${stats.taken}${stats.required ? ` / ${stats.required}` : ""} Helfer${stats.pending ? `, ${stats.pending} offen` : ""}`;
      const typeMeta = calendarEventTypeMeta(event);
      return `
        <article class="event-planner-day-card">
          <div class="event-planner-day-card__meta">
            <strong>${escapeHtml(event.title)}</strong>
            <span class="event-planner-pill ${typeMeta.className === "is-youth" ? "event-planner-pill--youth" : typeMeta.className === "is-adult" ? "event-planner-pill--adult" : "event-planner-pill--work"}">${escapeHtml(typeMeta.label)}</span>
            <span class="event-planner-pill">${escapeHtml(event.sourceLabel)}</span>
            <span class="event-planner-pill event-planner-pill--muted">${escapeHtml(event.status)}</span>
          </div>
          <p class="small">${escapeHtml(formatRange(event.starts_at, event.ends_at))}</p>
          <p class="small">${escapeHtml(event.location || "Ohne Ort")}</p>
          <p class="small">${escapeHtml(planningLabel)}</p>
          <p class="small">${escapeHtml(helperText)}</p>
          <div class="admin-actions admin-actions--toolbar">
            <button type="button" class="feed-btn feed-btn--ghost" data-select-event="${escapeHtml(event.id)}">Planung öffnen</button>
            <a class="feed-btn feed-btn--ghost" href="${escapeHtml(event.sourceHref)}">Basisobjekt</a>
          </div>
        </article>
      `;
    }).join("");
  }

  function openDayDialog() {
    const dialog = document.getElementById("eventPlannerDayDialog");
    const title = document.getElementById("eventPlannerDayDialogTitle");
    const list = document.getElementById("eventPlannerDayDialogList");
    if (!(dialog instanceof HTMLDialogElement) || !list) return;
    if (title) title.textContent = state.selectedDate ? `Tagesdetails: ${formatDate(state.selectedDate)}` : "Tagesdetails";
    list.innerHTML = renderDayCardsForKey(state.selectedDate);
    if (!dialog.open) dialog.showModal();
  }

  function renderCalendar() {
    const label = document.getElementById("eventPlannerMonthLabel");
    if (label) {
      label.textContent = state.currentMonth.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    }

    const grid = document.getElementById("eventPlannerCalendarGrid");
    if (!grid) return;
    const todayKey = toDateKey(new Date());
    const currentMonth = state.currentMonth.getMonth();

    const matrix = monthMatrix(state.currentMonth);
    const weeks = [];
    for (let index = 0; index < matrix.length; index += 7) {
      weeks.push(matrix.slice(index, index + 7));
    }

    grid.innerHTML = weeks.map((week) => {
      const weekNumber = isoWeekNumber(week[0]);
      const cells = week.map((day) => {
        const key = toDateKey(day);
        const events = dayEvents(key);
        const count = events.length;
        const inMonth = day.getMonth() === currentMonth;
        const selected = key === state.selectedDate;
        const isToday = key === todayKey;
        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
        const holidayName = holidayNameForDate(day);
        const classes = [
          "event-planner-calendar__cell",
          inMonth ? "" : "is-outside",
          selected ? "is-selected" : "",
          isToday ? "is-today" : "",
          isWeekend ? "is-weekend" : "",
          holidayName ? "is-holiday" : "",
        ].filter(Boolean).join(" ");
        return `
          <button type="button" class="${classes}" data-date-key="${escapeHtml(key)}">
            <span class="event-planner-calendar__date">${day.getDate()}</span>
            ${holidayName ? `<span class="event-planner-calendar__holiday">${escapeHtml(holidayName)}</span>` : ""}
            <span class="event-planner-calendar__count">${count ? `${count} Eintrag${count === 1 ? "" : "e"}` : "frei"}</span>
            <ul class="event-planner-calendar__mini">${renderCalendarMiniItems(events)}</ul>
          </button>
        `;
      }).join("");

      return `
        <div class="event-planner-calendar__week-number" aria-label="Kalenderwoche ${weekNumber}">KW ${weekNumber}</div>
        ${cells}
      `;
    }).join("");
  }

  function renderSelectedDay() {
    const label = document.getElementById("eventPlannerSelectedDateLabel");
    if (label) {
      label.textContent = state.selectedDate ? `Ausgewählter Tag: ${formatDate(state.selectedDate)}` : "Ausgewählter Tag";
    }

    const list = document.getElementById("eventPlannerSelectedDayList");
    if (!list) return;
    list.innerHTML = renderDayCardsForKey(state.selectedDate);
  }

  function renderManagedTable() {
    const body = document.querySelector("#eventPlannerManagedTable tbody");
    if (!body) return;

    const rows = planningRows();
    if (!rows.length) {
      body.innerHTML = `
        ${renderCreateRows()}
        <tr><td colspan="6" class="small">Aktuell gibt es keine anstehenden Termine oder Arbeitseinsätze für die Planung.</td></tr>
      `;
      return;
    }

    body.innerHTML = `
      ${renderCreateRows()}
      ${rows.map((event) => {
      const config = configForEvent(event);
      const stats = plannedHelperStats(event);
      const helperNeed = stats.required || 0;
      const helperSigned = stats.required ? `${stats.taken}/${helperNeed}` : (stats.taken ? String(stats.taken) : "-");
      const selected = state.selectedEventId === event.id;
      const rowClass = `event-planner-row${selected ? " is-selected" : ""}`;
      const caret = selected ? "▾" : "▸";
      const requiredLabel = helperNeed > 0 ? String(helperNeed) : "-";
      const registeredLabel = stats.pending ? `${helperSigned} (${stats.pending} offen)` : helperSigned;
      const detailRow = selected ? renderManagedDetailRow(event, config) : "";
      return `
        <tr class="${rowClass}" data-event-row="${escapeHtml(event.id)}">
          <td><span class="event-planner-row__caret" aria-hidden="true">${caret}</span>${escapeHtml(formatDate(event.starts_at))}</td>
          <td>${escapeHtml(formatTimeRange(event.starts_at, event.ends_at))}</td>
          <td>
            <strong>${escapeHtml(event.title)}</strong>
            <div class="small">${escapeHtml(event.sourceLabel)}</div>
            <div class="small">${escapeHtml(event.location || "Ohne Ort")}</div>
          </td>
          <td>${escapeHtml(requiredLabel)}</td>
          <td>${escapeHtml(registeredLabel)}</td>
          <td>
            <div class="event-planner-inline-actions event-planner-inline-actions--tight">
              <button type="button" class="feed-btn feed-btn--ghost event-planner-icon-btn" data-select-event="${escapeHtml(event.id)}" aria-pressed="${selected ? "true" : "false"}">Helfer</button>
              <button type="button" class="feed-btn feed-btn--ghost event-planner-trash-btn" data-delete-base-event="${escapeHtml(event.id)}" title="${escapeHtml(event.sourceLabel)} löschen" aria-label="${escapeHtml(event.sourceLabel)} löschen">🗑</button>
            </div>
          </td>
        </tr>
      ${detailRow}
      `;
    }).join("")}
    `;
  }

  function renderManagedDetailRow(event, config) {
    const hasConfig = Boolean(config);
    const slots = hasConfig ? slotsForPlanner(config.id) : [];
    const hasSlots = slots.length > 0;
    const metaLine = hasConfig
      ? `${event.sourceLabel} • ${formatRange(event.starts_at, event.ends_at)} • ${hasSlots ? "Untertabelle aktiv" : "Noch keine Helferzeilen"} • ${config.approval_mode === "auto" ? "Auto-Freigabe" : "Manuelle Freigabe"}`
      : `${event.sourceLabel} • ${formatRange(event.starts_at, event.ends_at)} • Noch keine Planung gespeichert. Die erste Zeile unten startet die Planung direkt.`;
    return `
      <tr class="event-planner-managed-detail-row">
        <td colspan="6">
          <div class="event-planner-managed-detail">
            <div class="event-planner-managed-detail__meta">
              <span class="event-planner-managed-detail__caret">└</span>
              <div>
                <strong id="eventPlannerDetailTitle">Helferplanung</strong>
                <p class="small" id="eventPlannerDetailMeta">${escapeHtml(metaLine)}</p>
              </div>
            </div>
            <div class="work-part-table-wrap event-planner-nested-table-wrap">
              <table class="work-part-table work-part-table--dense event-planner-nested-table" id="eventPlannerSlotsTable">
                <thead>
                  <tr>
                    <th>Aufgabe</th>
                    <th>Datum</th>
                    <th>Von</th>
                    <th>Bis</th>
                    <th>Helfer</th>
                    <th>Hinweis / Mitglieder</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colspan="7" class="small">Lade Helferplanung...</td></tr>
                </tbody>
              </table>
            </div>
            <form id="eventPlannerConfigForm" class="event-planner-inline-meta-form">
              <label>
                <span>Freigabe</span>
                <select id="eventPlannerApprovalMode">
                  <option value="manual">Manuell</option>
                  <option value="auto">Auto</option>
                </select>
              </label>
              <div class="event-planner-inline-meta-field">
                <span>Gesamtbedarf</span>
                <input id="eventPlannerRequiredPeople" type="number" min="1" step="1" placeholder="optional" />
                <label class="event-planner-inline-check event-planner-inline-check--config">
                  <span class="event-planner-inline-check__divider" aria-hidden="true"></span>
                  <span class="event-planner-inline-check__control">
                    <input type="checkbox" id="eventPlannerConfigLeadersCountTowardsCapacity" />
                    <span>Vorstand mitzählen</span>
                  </span>
                </label>
              </div>
              <label>
                <span>Wiederholung</span>
                <div class="event-planner-repeat-checks">
                  <label class="event-planner-check-pill">
                    <input type="checkbox" id="eventPlannerRepeatWeekly" />
                    <span>Woche</span>
                  </label>
                  <label class="event-planner-check-pill">
                    <input type="checkbox" id="eventPlannerRepeatBiweekly" />
                    <span>2 Wochen</span>
                  </label>
                  <label class="event-planner-check-pill">
                    <input type="checkbox" id="eventPlannerRepeatMonthly" />
                    <span>Monat</span>
                  </label>
                </div>
              </label>
              <div class="event-planner-inline-meta-form__actions">
                <button type="submit" class="feed-btn feed-btn--ghost">Optionen speichern</button>
              </div>
            </form>
          </div>
        </td>
      </tr>
    `;
  }

  function renderCreateRows() {
    const disabledAttr = state.createRowActive ? "" : " disabled";
    const hiddenAttr = state.createRowActive ? "" : " hidden";
    const rowClass = `event-planner-create-row${state.createRowActive ? "" : " is-disabled hidden"}`;
    return `
      <tr class="event-planner-create-toggle-row">
        <td colspan="6">
          <div class="event-planner-create-launch">
            <button type="button" class="feed-btn feed-btn--ghost event-planner-create-toggle-btn" data-create-kind="club_event" aria-pressed="${state.createRowActive && state.createKind === "club_event" ? "true" : "false"}">
              ${state.createRowActive && state.createKind === "club_event" ? "Termin schließen" : "+ Neuer Termin"}
            </button>
            <button type="button" class="feed-btn feed-btn--ghost event-planner-create-toggle-btn" data-create-kind="work_event" aria-pressed="${state.createRowActive && state.createKind === "work_event" ? "true" : "false"}">
              ${state.createRowActive && state.createKind === "work_event" ? "Arbeitseinsatz schließen" : "+ Neuer Arbeitseinsatz"}
            </button>
          </div>
        </td>
      </tr>
      <tr class="${rowClass}"${hiddenAttr}>
        <td>
          <div class="event-planner-create-cell">
            <input id="eventPlannerCreateDate" type="date"${disabledAttr} />
          </div>
        </td>
        <td>
          <div class="event-planner-create-cell">
            <div class="event-planner-time-inline">
              <input id="eventPlannerCreateStartTime" type="time" step="900" aria-label="Startzeit"${disabledAttr} />
              <span>–</span>
              <input id="eventPlannerCreateEndTime" type="time" step="900" aria-label="Endzeit"${disabledAttr} />
            </div>
          </div>
        </td>
        <td>
          <div class="event-planner-create-cell">
            <input id="eventPlannerCreateTitle" type="text" maxlength="120" placeholder="Titel eingeben..."${disabledAttr} />
            <label class="event-planner-chip-check event-planner-chip-check--youth${state.createKind === "club_event" ? "" : " hidden"}" id="eventPlannerCreateYouthWrap">
              <input id="eventPlannerCreateYouth" type="checkbox"${disabledAttr}${state.createKind === "club_event" ? "" : " hidden"} />
              <span>Jugend</span>
            </label>
          </div>
        </td>
        <td>
          <div class="event-planner-create-cell event-planner-create-cell--need">
            <input id="eventPlannerCreateRequiredPeople" type="number" min="0" step="1" value="0"${disabledAttr} />
            <label class="event-planner-chip-check">
              <input id="eventPlannerCreateMaxParticipantsEnabled" type="checkbox"${disabledAttr} />
              <span>Max Teilnehmer</span>
            </label>
          </div>
        </td>
        <td class="event-planner-create-row__meta">
          <div class="event-planner-create-cell event-planner-create-cell--meta">
            <div class="event-planner-create-row__stat">0 / 0</div>
            <label class="event-planner-chip-check">
              <input id="eventPlannerCreateLeadersCountTowardsCapacity" type="checkbox"${disabledAttr} />
              <span>Vorstand mitzählen</span>
            </label>
          </div>
        </td>
        <td>
          <div class="event-planner-inline-actions event-planner-inline-actions--tight">
            <button type="button" class="feed-btn event-planner-symbol-btn" id="eventPlannerCreateSubmit"${disabledAttr} aria-label="Speichern" title="Speichern">&#10003;</button>
            <button type="button" class="feed-btn feed-btn--ghost event-planner-symbol-btn" id="eventPlannerCreateReset"${disabledAttr} aria-label="Abbrechen" title="Abbrechen">&#10005;</button>
          </div>
        </td>
      </tr>
    `;
  }

  function renderSourceTable() {
    // Source rows are now integrated into the main planning table.
  }

  function sourceDialogEvent() {
    return state.events.find((event) => event.id === state.sourceDialogEventId) || null;
  }

  function openSourceDialog(eventId) {
    const dialog = document.getElementById("eventPlannerSourceDialog");
    const event = state.events.find((item) => item.id === eventId);
    if (!(dialog instanceof HTMLDialogElement) || !event) return;

    state.sourceDialogEventId = event.id;

    const title = document.getElementById("eventPlannerSourceDialogTitle");
    const meta = document.getElementById("eventPlannerSourceDialogMeta");
    const titleInput = document.getElementById("eventPlannerSourceEditTitle");
    const locationInput = document.getElementById("eventPlannerSourceEditLocation");
    const startInput = document.getElementById("eventPlannerSourceEditStart");
    const endInput = document.getElementById("eventPlannerSourceEditEnd");
    const descriptionInput = document.getElementById("eventPlannerSourceEditDescription");
    const maxWrap = document.getElementById("eventPlannerSourceEditMaxWrap");
    const maxInput = document.getElementById("eventPlannerSourceEditMaxParticipants");
    const youthWrap = document.getElementById("eventPlannerSourceEditYouthWrap");
    const youthInput = document.getElementById("eventPlannerSourceEditYouth");

    if (title) title.textContent = `${event.sourceLabel} bearbeiten`;
    if (meta) meta.textContent = `${event.sourceLabel} • ${formatRange(event.starts_at, event.ends_at)} • Vor der Planung koennen die Basisdaten hier noch angepasst werden.`;
    if (titleInput instanceof HTMLInputElement) titleInput.value = event.title || "";
    if (locationInput instanceof HTMLInputElement) locationInput.value = event.location || "";
    if (startInput instanceof HTMLInputElement) startInput.value = toLocalInput(event.starts_at);
    if (endInput instanceof HTMLInputElement) endInput.value = toLocalInput(event.ends_at);
    if (descriptionInput instanceof HTMLTextAreaElement) descriptionInput.value = event.description || "";

    const isWork = event.kind === "work_event";
    maxWrap?.classList.toggle("hidden", !isWork);
    youthWrap?.classList.toggle("hidden", isWork);
    if (maxInput instanceof HTMLInputElement) {
      maxInput.value = isWork && Number.isFinite(Number(event.max_participants)) ? String(Number(event.max_participants)) : "";
    }
    if (youthInput instanceof HTMLInputElement) youthInput.checked = Boolean(event.is_youth);

    syncFormDefaults(dialog.querySelector("form"));

    if (!dialog.open) dialog.showModal();
  }

  async function saveSourceDialog() {
    const event = sourceDialogEvent();
    if (!event) {
      setMsg("Kein Basisobjekt für den Dialog aktiv.");
      return;
    }

    const title = String(document.getElementById("eventPlannerSourceEditTitle")?.value || "").trim();
    const location = String(document.getElementById("eventPlannerSourceEditLocation")?.value || "").trim() || null;
    const startsAt = toIsoFromLocalInput(String(document.getElementById("eventPlannerSourceEditStart")?.value || "").trim());
    const endsAt = toIsoFromLocalInput(String(document.getElementById("eventPlannerSourceEditEnd")?.value || "").trim());
    const description = String(document.getElementById("eventPlannerSourceEditDescription")?.value || "").trim() || null;

    if (!title || !startsAt || !endsAt) {
      setMsg("Bitte Titel, Start und Ende vollständig ausfuellen.");
      return;
    }
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      setMsg("Das Ende muss nach dem Start liegen.");
      return;
    }

    const payload = {
      title,
      location,
      starts_at: startsAt,
      ends_at: endsAt,
      description,
    };

    if (event.kind === "work_event") {
      const maxParticipants = Number(document.getElementById("eventPlannerSourceEditMaxParticipants")?.value || "0");
      payload.max_participants = Number.isFinite(maxParticipants) && maxParticipants > 0 ? maxParticipants : null;
    } else {
      payload.is_youth = Boolean(document.getElementById("eventPlannerSourceEditYouth")?.checked);
    }

    try {
      await patchBaseEvent(event.id, event.kind, payload);
      await reloadAndRender(`${event.sourceLabel} aktualisiert.`);
      openSourceDialog(event.id);
    } catch (error) {
      console.error("[event-planner-source-save]", error);
      setMsg(`${event.sourceLabel} konnte nicht gespeichert werden: ${error?.message || error}`);
    }
  }

  async function activateSourceFromDialog() {
    const event = sourceDialogEvent();
    if (!event) {
      setMsg("Kein Basisobjekt für die Planung aktiv.");
      return;
    }
    try {
      await saveSourceDialog();
      const refreshedEvent = state.events.find((item) => item.id === event.id) || event;
      await upsertPlannerConfig(refreshedEvent, {
        approval_mode: "manual",
        planning_mode: "simple",
        required_people: null,
        repeat_rule: "",
        max_participants_enabled: false,
        leaders_count_towards_capacity: false,
      });
      state.selectedEventId = refreshedEvent.id;
      document.getElementById("eventPlannerSourceDialog")?.close();
      await reloadAndRender("Planevent aktiviert.");
    } catch (error) {
      console.error("[event-planner-source-dialog-plan]", error);
      setMsg(`Planevent konnte nicht aktiviert werden: ${error?.message || error}`);
    }
  }

  function renderDetailPanel() {
    const event = selectedEvent();
    if (!event) return;
    const config = configForEvent(event);
    const title = document.getElementById("eventPlannerDetailTitle");
    const meta = document.getElementById("eventPlannerDetailMeta");
    if (title) title.textContent = event ? `Helferplanung: ${event.title}` : "Helferplanung";
    if (meta) {
      meta.textContent = event
        ? `${config ? "Planung aktiv" : "Direkteingabe"} • ${event.sourceLabel} • ${formatRange(event.starts_at, event.ends_at)}`
        : "Termin oder Arbeitseinsatz auswählen.";
    }

    const approvalMode = document.getElementById("eventPlannerApprovalMode");
    const requiredPeople = document.getElementById("eventPlannerRequiredPeople");
    const leadersCount = document.getElementById("eventPlannerConfigLeadersCountTowardsCapacity");
    const repeatWeekly = document.getElementById("eventPlannerRepeatWeekly");
    const repeatBiweekly = document.getElementById("eventPlannerRepeatBiweekly");
    const repeatMonthly = document.getElementById("eventPlannerRepeatMonthly");
    const repeatRule = String(config?.repeat_rule || "").toLowerCase();

    if (approvalMode) approvalMode.value = config?.approval_mode || "manual";
    if (requiredPeople) requiredPeople.value = config?.required_people ? String(config.required_people) : "";
    if (leadersCount instanceof HTMLInputElement) leadersCount.checked = Boolean(config?.leaders_count_towards_capacity);
    if (repeatWeekly instanceof HTMLInputElement) repeatWeekly.checked = repeatRule === "weekly";
    if (repeatBiweekly instanceof HTMLInputElement) repeatBiweekly.checked = repeatRule === "biweekly";
    if (repeatMonthly instanceof HTMLInputElement) repeatMonthly.checked = repeatRule === "monthly";

    renderSlotsTable(event, config);
    resetSlotForm(event);
  }

  function renderSlotsTable(event, config) {
    const body = document.querySelector("#eventPlannerSlotsTable tbody");
    if (!body) return;
    if (!event) {
      body.innerHTML = `<tr><td colspan="7" class="small">Noch kein Event ausgewählt.</td></tr>`;
      return;
    }

    const slots = config ? slotsForPlanner(config.id) : [];
    const slotRows = slots.map((slot) => {
      const activeRegs = effectiveActiveRegistrations(registrationsForSlot(slot.id), slot);
      const start = new Date(slot.starts_at);
      const end = new Date(slot.ends_at);
      const memberNames = memberNamesForSlot(slot.id);
      return `
        <tr class="event-planner-slot-row" data-edit-slot="${escapeHtml(slot.id)}">
          <td><span class="event-planner-slot-row__branch" aria-hidden="true">-</span>${escapeHtml(slot.title)}</td>
          <td>${escapeHtml(Number.isNaN(start.getTime()) ? "-" : start.toLocaleDateString("de-DE"))}</td>
          <td>${escapeHtml(Number.isNaN(start.getTime()) ? "-" : start.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }))}</td>
          <td>${escapeHtml(Number.isNaN(end.getTime()) ? "-" : end.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }))}</td>
          <td>${escapeHtml(`${String(activeRegs.length)}/${String(slot.required_people || 0)}`)}</td>
          <td class="event-planner-slot-members">
            <div>${escapeHtml(slot.description || "Kein Hinweis")}</div>
            <div class="small">${escapeHtml(memberNames)}</div>
          </td>
          <td>
            <div class="event-planner-inline-actions">
              <button type="button" class="feed-btn feed-btn--ghost event-planner-symbol-btn" data-edit-slot="${escapeHtml(slot.id)}">Bearbeiten</button>
              <button type="button" class="feed-btn feed-btn--ghost event-planner-symbol-btn" data-delete-slot="${escapeHtml(slot.id)}">Löschen</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    const emptyRow = !slots.length
      ? `<tr><td colspan="7" class="small">Noch keine Helferzeilen vorhanden. Die erste Planung kann direkt unten erfasst werden.</td></tr>`
      : "";

    body.innerHTML = `
      ${emptyRow}
      ${slotRows}
      <tr class="event-planner-slot-entry-row">
        <td>
          <div class="event-planner-slot-entry-stack">
            <input id="eventPlannerSlotTitle" type="text" maxlength="120" placeholder="+ Aufgabe / Tätigkeit" />
          </div>
          <input id="eventPlannerSlotId" type="hidden" />
        </td>
        <td>
          <input id="eventPlannerSlotDate" type="date" />
        </td>
        <td>
          <input id="eventPlannerSlotStartTime" type="time" step="900" />
        </td>
        <td>
          <input id="eventPlannerSlotEndTime" type="time" step="900" />
        </td>
        <td>
          <input id="eventPlannerSlotRequiredPeople" type="number" min="1" step="1" placeholder="1" />
          <label class="event-planner-chip-check event-planner-chip-check--slot">
            <input id="eventPlannerSlotLeadersCountTowardsCapacity" type="checkbox" />
            <span>Vorstand mitzählen</span>
          </label>
        </td>
        <td>
          <input id="eventPlannerSlotDescription" type="text" maxlength="180" placeholder="Optionaler Hinweis" />
        </td>
        <td>
          <div class="event-planner-inline-actions">
            <button type="button" class="feed-btn event-planner-symbol-btn" data-save-slot-inline="true" aria-label="Speichern" title="Speichern">&#10003;</button>
            <button type="button" class="feed-btn feed-btn--ghost event-planner-symbol-btn" data-reset-slot-inline="true" aria-label="Leeren" title="Leeren">&#10005;</button>
          </div>
        </td>
      </tr>
      <tr class="event-planner-slot-add-row">
        <td colspan="7">
          <button type="button" class="feed-btn feed-btn--ghost" data-reset-slot-inline="true">+ nächste Planung</button>
        </td>
      </tr>
    `;
  }

  function renderApprovalTable(tableId, rows, selectedKey, toggleAttr, emptyText) {
    const body = document.querySelector(`${tableId} tbody`);
    if (!body) return;
    if (!state.migrationAvailable) {
      body.innerHTML = `<tr><td colspan="6" class="small">Phase-2-Migration fehlt noch in dieser Umgebung.</td></tr>`;
      return;
    }

    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="6" class="small">${escapeHtml(emptyText)}</td></tr>`;
      return;
    }

    body.innerHTML = rows.map((entry) => {
      const selected = selectedKey === entry.key;
      const detailRow = selected ? renderApprovalDetailRow(entry, toggleAttr) : "";
      return `
        <tr class="event-planner-approval-row${selected ? " is-selected" : ""}" data-approval-event-row="${escapeHtml(entry.key)}" data-approval-section="${escapeHtml(toggleAttr)}">
          <td>
            <strong>${escapeHtml(entry.event.title)}</strong>
            <div class="small">${escapeHtml(entry.event.sourceLabel)}</div>
            <div class="small">${escapeHtml(entry.event.location || "Ohne Ort")}</div>
          </td>
          <td>${escapeHtml(formatRange(entry.event.starts_at, entry.event.ends_at))}</td>
          <td>${escapeHtml(String(entry.pending))}</td>
          <td>${escapeHtml(String(entry.active))}</td>
          <td>${escapeHtml(String(entry.gone))}</td>
          <td><button type="button" class="feed-btn feed-btn--ghost" data-toggle-approval-event="${escapeHtml(entry.key)}" data-approval-section="${escapeHtml(toggleAttr)}" aria-pressed="${selected ? "true" : "false"}">Freigabe</button></td>
        </tr>
        ${detailRow}
      `;
    }).join("");
  }

  function renderApprovalsTable() {
    renderApprovalTable("#eventPlannerOpenApprovalsTable", approvalGroups("pending"), state.selectedOpenApprovalEventId, "open", "Aktuell keine offenen Freigaben.");
    renderApprovalTable("#eventPlannerApprovedApprovalsTable", approvalGroups("approved"), state.selectedApprovedApprovalEventId, "approved", "Aktuell keine freigegebenen Einträge.");
  }

  function renderApprovalDetailRow(entry, sectionKey) {
    const rows = entry.rows;
    const detailRows = rows.map((row) => {
      const active = entry.sourceKind === "work" ? workParticipationIsActive(row) : false;
      const gone = entry.sourceKind === "work" ? workParticipationIsGone(row) : false;
      const rowClass = active ? "is-active" : gone ? "is-gone" : "";
      const statusLabel = active ? "Aktiv" : gone ? "Gegangen" : row.status || "-";
      const minutesValue = Number(row.minutes_approved ?? computeMinutes(row.checkin_at, row.checkout_at) ?? row.minutes_reported ?? 0);
      const rowStatus = String(row.status || "").toLowerCase();
      const isEditing = state.approvalEditingRows.has(String(row.id || ""));
      const checkinLocal = toLocalInput(row.checkin_at);
      const checkoutLocal = toLocalInput(row.checkout_at);
      const approvedMark = (entry.sourceKind === "work" && workParticipationIsApproved(row)) || String(row.status || "").toLowerCase() === "approved"
        ? `<span class="event-planner-approved-check" title="Freigegeben" aria-label="Freigegeben">OK</span>`
        : "";
      const actionButtons = entry.sourceKind === "work"
        ? `
            <button type="button" class="feed-btn event-planner-symbol-btn" data-work-approve="${escapeHtml(row.id)}" data-approval-kind="work" aria-label="${rowStatus === "approved" ? "Änderung speichern" : "Freigeben"}" title="${rowStatus === "approved" ? "Änderung speichern" : "Freigeben"}">&#10003;</button>
            <button type="button" class="feed-btn feed-btn--ghost event-planner-symbol-btn" data-work-edit="${escapeHtml(row.id)}" aria-label="Bearbeiten" title="Bearbeiten">&#9998;</button>
            <button type="button" class="feed-btn feed-btn--ghost event-planner-symbol-btn" data-work-reject="${escapeHtml(row.id)}" data-approval-kind="work" aria-label="Ablehnen" title="Ablehnen">&#8856;</button>
          `
        : `
            <button type="button" class="feed-btn event-planner-symbol-btn" data-work-approve="${escapeHtml(row.id)}" data-approval-kind="planner"${rowStatus === "pending" ? "" : " disabled"} aria-label="Freigeben" title="Freigeben">&#10003;</button>
            <button type="button" class="feed-btn feed-btn--ghost event-planner-symbol-btn" data-work-reject="${escapeHtml(row.id)}" data-approval-kind="planner"${rowStatus === "pending" ? "" : " disabled"} aria-label="Ablehnen" title="Ablehnen">&#8856;</button>
          `;
      return `
        <tr class="event-planner-presence-row ${rowClass}${isEditing ? " is-editing" : ""}" data-approval-row="${escapeHtml(row.id)}">
          <td>
            <div class="event-planner-member-line">
              ${approvedMark}
              <span>${escapeHtml(memberLabel(row.auth_uid))}</span>
            </div>
          </td>
          <td>${escapeHtml(String(statusLabel))}</td>
          <td>
            ${entry.sourceKind === "work"
              ? `
                  <span class="event-planner-approval-time-label">${escapeHtml(row.checkin_at ? formatDateTimeCompact(row.checkin_at) : "-")}</span>
                  <input class="event-planner-approval-time-input" type="datetime-local" value="${escapeHtml(checkinLocal)}" data-work-checkin="${escapeHtml(row.id)}" />
                `
              : escapeHtml(formatDateTimeCompact(row.created_at))}
          </td>
          <td>
            ${entry.sourceKind === "work"
              ? `
                  <span class="event-planner-approval-time-label">${escapeHtml(row.checkout_at ? formatDateTimeCompact(row.checkout_at) : "-")}</span>
                  <input class="event-planner-approval-time-input" type="datetime-local" value="${escapeHtml(checkoutLocal)}" data-work-checkout="${escapeHtml(row.id)}" />
                `
              : "-"}
          </td>
          <td><strong data-work-minutes-display="${escapeHtml(row.id)}">${escapeHtml(String(minutesValue || 0))}</strong></td>
          <td>
            <div class="event-planner-inline-actions event-planner-inline-actions--tight event-planner-inline-actions--icons">
              ${actionButtons}
            </div>
          </td>
        </tr>
      `;
    }).join("");

    return `
      <tr class="event-planner-approval-detail-row">
        <td colspan="6">
          <div class="event-planner-managed-detail">
            <div class="event-planner-managed-detail__meta">
              <span class="event-planner-managed-detail__caret">└</span>
              <div>
                <strong>Mitgliederliste</strong>
                <p class="small">Gruen = aktiv vor Ort, rot = gegangen. Events und Arbeitseinsätze folgen hier demselben Freigabe-Workflow.</p>
              </div>
            </div>
            <div class="work-part-table-wrap event-planner-nested-table-wrap">
              <table class="work-part-table work-part-table--dense event-planner-nested-table">
                <thead>
                  <tr>
                    <th>Mitglied</th>
                    <th>Status</th>
                    <th>Von</th>
                    <th>Bis</th>
                    <th>Minuten</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  ${detailRows || `<tr><td colspan="6" class="small">Keine Teilnahmen vorhanden.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  function resetSlotForm(event) {
    const slotId = document.getElementById("eventPlannerSlotId");
    const title = document.getElementById("eventPlannerSlotTitle");
    const required = document.getElementById("eventPlannerSlotRequiredPeople");
    const slotDate = document.getElementById("eventPlannerSlotDate");
    const startTime = document.getElementById("eventPlannerSlotStartTime");
    const endTime = document.getElementById("eventPlannerSlotEndTime");
    const description = document.getElementById("eventPlannerSlotDescription");
    const leadersCount = document.getElementById("eventPlannerSlotLeadersCountTowardsCapacity");
    const start = event?.starts_at ? new Date(event.starts_at) : null;
    const end = event?.ends_at ? new Date(event.ends_at) : null;
    const pad = (value) => String(value).padStart(2, "0");

    if (slotId) slotId.value = "";
    if (title) title.value = "";
    if (required) required.value = "";
    if (description) description.value = "";
    if (leadersCount instanceof HTMLInputElement) leadersCount.checked = false;
    if (slotDate) slotDate.value = event ? toDateKey(event.starts_at) : "";
    if (startTime) startTime.value = start ? `${pad(start.getHours())}:${pad(start.getMinutes())}` : "";
    if (endTime) endTime.value = end ? `${pad(end.getHours())}:${pad(end.getMinutes())}` : "";
  }

  function fillSlotForm(slot) {
    const slotId = document.getElementById("eventPlannerSlotId");
    const title = document.getElementById("eventPlannerSlotTitle");
    const required = document.getElementById("eventPlannerSlotRequiredPeople");
    const slotDate = document.getElementById("eventPlannerSlotDate");
    const startTime = document.getElementById("eventPlannerSlotStartTime");
    const endTime = document.getElementById("eventPlannerSlotEndTime");
    const description = document.getElementById("eventPlannerSlotDescription");
    const leadersCount = document.getElementById("eventPlannerSlotLeadersCountTowardsCapacity");
    const start = slot?.starts_at ? new Date(slot.starts_at) : null;
    const end = slot?.ends_at ? new Date(slot.ends_at) : null;
    const pad = (value) => String(value).padStart(2, "0");

    if (slotId) slotId.value = slot.id;
    if (title) title.value = slot.title || "";
    if (required) required.value = slot.required_people ? String(slot.required_people) : "";
    if (slotDate) slotDate.value = toDateKey(slot.starts_at);
    if (startTime) startTime.value = start ? `${pad(start.getHours())}:${pad(start.getMinutes())}` : "";
    if (endTime) endTime.value = end ? `${pad(end.getHours())}:${pad(end.getMinutes())}` : "";
    if (description) description.value = slot.description || "";
    if (leadersCount instanceof HTMLInputElement) leadersCount.checked = Boolean(slot.leaders_count_towards_capacity);
  }

  function renderAll() {
    renderClubSwitch();
    renderKpis();
    renderCalendar();
    renderSelectedDay();
    renderManagedTable();
    renderDetailPanel();
    renderApprovalsTable();
  }

  function activateSection(section) {
    document.querySelectorAll(`[${SECTION_ATTR}]`).forEach((button) => {
      button.classList.toggle("is-active", button.getAttribute(SECTION_ATTR) === section);
    });
    document.querySelectorAll(`[${PANEL_ATTR}]`).forEach((panel) => {
      panel.classList.toggle("is-active", panel.getAttribute(PANEL_ATTR) === section);
    });
  }

  async function reloadAndRender(message = "") {
    await loadData();
    renderAll();
    if (message) setMsg(message);
  }

  function resetCreateRow() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const dateEl = document.getElementById("eventPlannerCreateDate");
    const startTimeEl = document.getElementById("eventPlannerCreateStartTime");
    const endTimeEl = document.getElementById("eventPlannerCreateEndTime");
    const titleEl = document.getElementById("eventPlannerCreateTitle");
    const reqEl = document.getElementById("eventPlannerCreateRequiredPeople");
    const youthEl = document.getElementById("eventPlannerCreateYouth");
    const maxParticipantsEnabledEl = document.getElementById("eventPlannerCreateMaxParticipantsEnabled");
    const leadersCountEl = document.getElementById("eventPlannerCreateLeadersCountTowardsCapacity");
    if (dateEl) dateEl.value = `${yyyy}-${mm}-${dd}`;
    if (startTimeEl) startTimeEl.value = "08:00";
    if (endTimeEl) endTimeEl.value = "11:00";
    if (titleEl) titleEl.value = "";
    if (reqEl) reqEl.value = "0";
    if (youthEl instanceof HTMLInputElement) youthEl.checked = false;
    if (maxParticipantsEnabledEl instanceof HTMLInputElement) maxParticipantsEnabledEl.checked = false;
    if (leadersCountEl instanceof HTMLInputElement) leadersCountEl.checked = false;
    syncCreateRowStat();
  }

  function setCreateRowEnabled(enabled) {
    state.createRowActive = Boolean(enabled);
    renderManagedTable();
  }

  function syncCreateRowStat() {
    const required = Number(document.getElementById("eventPlannerCreateRequiredPeople")?.value || "0");
    const stat = document.querySelector(".event-planner-create-row__stat");
    if (stat) stat.textContent = `0 / ${Number.isFinite(required) && required > 0 ? required : 0}`;
  }

  async function onCreateSubmit() {
    if (!state.createRowActive) {
      setMsg("Bitte zuerst über 'Neues Event' die Eingabezeile aktivieren.");
      return;
    }
    const kind = state.createKind || "club_event";
    const audience = document.getElementById("eventPlannerCreateYouth")?.checked ? "youth" : "adult";
    const date = document.getElementById("eventPlannerCreateDate")?.value || "";
    const start = document.getElementById("eventPlannerCreateStartTime")?.value || "";
    const end = document.getElementById("eventPlannerCreateEndTime")?.value || "";
    const title = String(document.getElementById("eventPlannerCreateTitle")?.value || "").trim();
    const required = Number(document.getElementById("eventPlannerCreateRequiredPeople")?.value || "0");
    const maxParticipantsEnabled = Boolean(document.getElementById("eventPlannerCreateMaxParticipantsEnabled")?.checked);
    const leadersCountTowardsCapacity = Boolean(document.getElementById("eventPlannerCreateLeadersCountTowardsCapacity")?.checked);

    if (!date || !start || !end || !title) {
      setMsg("Bitte Datum, Zeit und Titel für das neue Event angeben.");
      return;
    }

    const startsAt = toIsoFromLocalInput(`${date}T${start}`);
    const endsAt = toIsoFromLocalInput(`${date}T${end}`);
    if (!startsAt || !endsAt) {
      setMsg("Bitte gültige Start- und Endzeiten angeben.");
      return;
    }
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      setMsg("Die Endzeit muss nach der Startzeit liegen.");
      return;
    }

    try {
      let result;
      if (kind === "work_event") {
        result = await createWorkEvent({
          p_title: title,
          p_location: null,
          p_starts_at: startsAt,
          p_ends_at: endsAt,
          p_max_participants: maxParticipantsEnabled && Number.isFinite(required) && required > 0 ? required : null,
          p_is_youth: audience === "youth",
        });
      } else {
        result = await createClubEvent({
          p_title: title,
          p_location: null,
          p_starts_at: startsAt,
          p_ends_at: endsAt,
          p_is_youth: audience === "youth",
        });
      }

      let newId = createdEventId(result);
      if (!newId) {
        newId = await findCreatedEventId(kind, title, startsAt);
      }
      if (!newId) throw new Error("Basisobjekt konnte nicht angelegt werden.");

      const baseEvent = {
        id: newId,
        kind,
      };
      await upsertPlannerConfig(baseEvent, {
        approval_mode: "manual",
        planning_mode: "simple",
        required_people: Number.isFinite(required) && required > 0 ? required : null,
        repeat_rule: "",
        max_participants_enabled: maxParticipantsEnabled,
        leaders_count_towards_capacity: leadersCountTowardsCapacity,
      });
      state.selectedEventId = newId;
      await reloadAndRender("Neues Planevent angelegt.");
      resetCreateRow();
      setCreateRowEnabled(false);
      activateSection("events");
    } catch (error) {
      console.error("[event-planner-create]", error);
      setMsg(`Neues Planevent konnte nicht angelegt werden: ${error?.message || error}`);
    }
  }

  async function onConfigSubmit(event) {
    event.preventDefault();
    const selected = selectedEvent();
    if (!selected) {
      setMsg("Bitte zuerst ein Basisobjekt auswählen.");
      return;
    }
    if (!state.migrationAvailable) {
      setMsg("Phase-2-Migration fehlt noch in dieser Umgebung.");
      return;
    }

    const approvalMode = document.getElementById("eventPlannerApprovalMode")?.value || "manual";
    const requiredPeopleRaw = document.getElementById("eventPlannerRequiredPeople")?.value || "";
    const repeatRule = document.getElementById("eventPlannerRepeatWeekly")?.checked
      ? "weekly"
      : document.getElementById("eventPlannerRepeatBiweekly")?.checked
        ? "biweekly"
        : document.getElementById("eventPlannerRepeatMonthly")?.checked
          ? "monthly"
          : "";
    const requiredPeople = requiredPeopleRaw ? Number(requiredPeopleRaw) : null;
    const existingConfig = configForEvent(selected);
    const planningMode = slotsForPlanner(existingConfig?.id || "").length ? "structured" : "simple";
    const leadersCountTowardsCapacity = Boolean(document.getElementById("eventPlannerConfigLeadersCountTowardsCapacity")?.checked);

    try {
      await upsertPlannerConfig(selected, {
        approval_mode: approvalMode,
        planning_mode: planningMode,
        required_people: Number.isFinite(requiredPeople) ? requiredPeople : null,
        repeat_rule: repeatRule,
        max_participants_enabled: Boolean(existingConfig?.max_participants_enabled),
        leaders_count_towards_capacity: leadersCountTowardsCapacity,
      });
      await reloadAndRender("Planungs-Konfiguration gespeichert.");
      activateSection("events");
    } catch (error) {
      console.error("[event-planner-config]", error);
      setMsg(`Planungs-Konfiguration konnte nicht gespeichert werden: ${error?.message || error}`);
    }
  }

  async function saveSlotInline() {
    const selected = selectedEvent();
    let config = selected ? configForEvent(selected) : null;
    if (!selected) {
      setMsg("Bitte zuerst ein Event oder Basisobjekt auswählen.");
      return;
    }
    if (!state.migrationAvailable) {
      setMsg("Phase-2-Migration fehlt noch in dieser Umgebung.");
      return;
    }

    const title = document.getElementById("eventPlannerSlotTitle")?.value || "";
    const requiredPeople = Number(document.getElementById("eventPlannerSlotRequiredPeople")?.value || "");
    const slotDate = document.getElementById("eventPlannerSlotDate")?.value || "";
    const startTime = document.getElementById("eventPlannerSlotStartTime")?.value || "";
    const endTime = document.getElementById("eventPlannerSlotEndTime")?.value || "";
    const startsAt = toIsoFromLocalInput(slotDate && startTime ? `${slotDate}T${startTime}` : "");
    let endsAt = toIsoFromLocalInput(slotDate && endTime ? `${slotDate}T${endTime}` : "");
    const description = document.getElementById("eventPlannerSlotDescription")?.value || "";
    const slotId = document.getElementById("eventPlannerSlotId")?.value || "";
    const leadersCountTowardsCapacity = Boolean(document.getElementById("eventPlannerSlotLeadersCountTowardsCapacity")?.checked);

    if (!title.trim() || !startsAt || !endsAt || !Number.isFinite(requiredPeople) || requiredPeople <= 0) {
      setMsg("Bitte Aufgabe, Datum, Zeitfenster und benötigte Personen vollständig angeben.");
      return;
    }

    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      const endDate = new Date(endsAt);
      if (!Number.isNaN(endDate.getTime())) {
        endDate.setDate(endDate.getDate() + 1);
        endsAt = endDate.toISOString();
      }
    }

    if (!config) {
      await upsertPlannerConfig(selected, {
        approval_mode: "manual",
        planning_mode: "simple",
        required_people: null,
        repeat_rule: "",
        max_participants_enabled: false,
        leaders_count_towards_capacity: false,
      });
      await loadData();
      config = configForEvent(selected);
    }
    if (!config) {
      setMsg("Planungsgrundlage konnte nicht angelegt werden.");
      return;
    }

    const existingSlots = slotsForPlanner(config.id);
    const existingSlot = slotId ? existingSlots.find((slot) => slot.id === slotId) : null;
    const currentStructuredTotal = existingSlots.reduce((sum, slot) => {
      if (existingSlot && slot.id === existingSlot.id) return sum;
      return sum + Number(slot.required_people || 0);
    }, 0);
    const nextStructuredTotal = currentStructuredTotal + requiredPeople;
    const roughPlan = Number(config.required_people || selected.max_participants || 0);

    if (roughPlan > 0 && nextStructuredTotal > roughPlan) {
      const confirmed = window.confirm(
        `Die Feinplanung benötigt dann ${nextStructuredTotal} Helfer, in der Grobplanung stehen aber ${roughPlan}. Trotzdem speichern?`,
      );
      if (!confirmed) {
        setMsg("Speichern abgebrochen. Bitte Grobplanung oder Schichtbedarf prüfen.");
        return;
      }
    }

    try {
      await upsertSlot(config.id, {
        slot_id: slotId || null,
        title,
        description,
        starts_at: startsAt,
        ends_at: endsAt,
        required_people: requiredPeople,
        sort_order: 100,
        leaders_count_towards_capacity: leadersCountTowardsCapacity,
      });
      await reloadAndRender(slotId ? "Slot aktualisiert." : "Slot angelegt.");
      activateSection("events");
    } catch (error) {
      console.error("[event-planner-slot]", error);
      setMsg(`Slot konnte nicht gespeichert werden: ${error?.message || error}`);
    }
  }

  function bindUi() {
    document.querySelectorAll(`[${SECTION_ATTR}]`).forEach((button) => {
      button.addEventListener("click", () => activateSection(button.getAttribute(SECTION_ATTR) || "kalender"));
    });
    document.getElementById("eventPlannerClubSwitchList")?.addEventListener("click", async (event) => {
      const button = event.target instanceof Element ? event.target.closest("[data-eventplanner-club]") : null;
      if (!button) return;
      const clubId = String(button.getAttribute("data-eventplanner-club") || "").trim();
      if (!clubId || clubId === state.selectedClubId) return;
      try {
        await switchActiveClub(clubId);
      } catch (error) {
        console.error("[event-planner-club-switch]", error);
        setMsg(`Vereinswechsel fehlgeschlagen: ${error?.message || error}`);
      }
    });

    document.getElementById("eventPlannerPrevMonth")?.addEventListener("click", () => {
      state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() - 1, 1);
      renderCalendar();
    });

    document.getElementById("eventPlannerNextMonth")?.addEventListener("click", () => {
      state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() + 1, 1);
      renderCalendar();
    });

    document.getElementById("eventPlannerCalendarGrid")?.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("[data-date-key]") : null;
      if (!button) return;
      state.selectedDate = String(button.getAttribute("data-date-key") || "");
      renderCalendar();
      renderSelectedDay();
      openDayDialog();
    });

    document.body.addEventListener("submit", (event) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form) return;
      if (form.id === "eventPlannerConfigForm") onConfigSubmit(event);
    });
    document.getElementById("eventPlannerSourceSave")?.addEventListener("click", saveSourceDialog);
    document.getElementById("eventPlannerSourcePlan")?.addEventListener("click", activateSourceFromDialog);
    document.body.addEventListener("input", (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.id === "eventPlannerCreateRequiredPeople") {
        syncCreateRowStat();
      }
    });

    document.body.addEventListener("click", async (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const createToggle = target.closest("[data-create-kind]");
      if (createToggle) {
        const nextKind = String(createToggle.getAttribute("data-create-kind") || "club_event");
        if (state.createRowActive && state.createKind === nextKind) {
          setCreateRowEnabled(false);
          return;
        }
        state.createKind = nextKind;
        setCreateRowEnabled(true);
        resetCreateRow();
        document.getElementById("eventPlannerCreateTitle")?.focus();
        return;
      }

      const createSubmit = target.closest("#eventPlannerCreateSubmit");
      if (createSubmit) {
        await onCreateSubmit();
        return;
      }

      const createReset = target.closest("#eventPlannerCreateReset");
      if (createReset) {
        setCreateRowEnabled(false);
        return;
      }

      const deleteBaseEventButton = target.closest("[data-delete-base-event]");
      if (deleteBaseEventButton) {
        const eventId = String(deleteBaseEventButton.getAttribute("data-delete-base-event") || "");
        const eventRow = state.events.find((row) => row.id === eventId);
        if (!eventRow) return;
        const label = eventRow.kind === "work_event" ? "Arbeitseinsatz" : "Termin";
        if (!window.confirm(`${label} wirklich löschen?`)) return;
        try {
          const config = configForEvent(eventRow);
          if (config?.id) {
            await deletePlannerConfig(config.id).catch(() => null);
          }
          await deleteBaseEvent(eventRow);
          if (state.selectedEventId === eventId) state.selectedEventId = "";
          await reloadAndRender(`${label} gelöscht.`);
        } catch (error) {
          console.error("[event-planner-delete-base-event]", error);
          setMsg(`${label} konnte nicht gelöscht werden: ${error?.message || error}`);
        }
        return;
      }

      const selectButton = target.closest("[data-select-event]");
      if (selectButton) {
        const nextId = String(selectButton.getAttribute("data-select-event") || "");
        state.selectedEventId = state.selectedEventId === nextId ? "" : nextId;
        renderAll();
        return;
      }

      const eventRow = target.closest("[data-event-row]");
      if (eventRow && !target.closest("button, a, input, textarea, select, label")) {
        const nextId = String(eventRow.getAttribute("data-event-row") || "");
        state.selectedEventId = state.selectedEventId === nextId ? "" : nextId;
        renderAll();
        return;
      }

      const approvalToggle = target.closest("[data-toggle-approval-event]");
      if (approvalToggle) {
        const nextId = String(approvalToggle.getAttribute("data-toggle-approval-event") || "");
        const section = String(approvalToggle.getAttribute("data-approval-section") || "open");
        if (section === "approved") {
          state.selectedApprovedApprovalEventId = state.selectedApprovedApprovalEventId === nextId ? "" : nextId;
        } else {
          state.selectedOpenApprovalEventId = state.selectedOpenApprovalEventId === nextId ? "" : nextId;
        }
        renderApprovalsTable();
        return;
      }

      const approvalRow = target.closest("[data-approval-event-row]");
      if (approvalRow && !target.closest("button, a, input, textarea, select, label")) {
        const nextId = String(approvalRow.getAttribute("data-approval-event-row") || "");
        const section = String(approvalRow.getAttribute("data-approval-section") || "open");
        if (section === "approved") {
          state.selectedApprovedApprovalEventId = state.selectedApprovedApprovalEventId === nextId ? "" : nextId;
        } else {
          state.selectedOpenApprovalEventId = state.selectedOpenApprovalEventId === nextId ? "" : nextId;
        }
        renderApprovalsTable();
        return;
      }

      const editSourceButton = target.closest("[data-edit-source]");
      if (editSourceButton) {
        const eventId = String(editSourceButton.getAttribute("data-edit-source") || "");
        openSourceDialog(eventId);
        return;
      }

      const editSlotButton = target.closest("[data-edit-slot]");
      if (editSlotButton) {
        const slotId = String(editSlotButton.getAttribute("data-edit-slot") || "");
        const slot = state.plannerSlots.find((item) => item.id === slotId);
        if (slot) fillSlotForm(slot);
        return;
      }

      const slotRow = target.closest(".event-planner-slot-row");
      if (slotRow && !target.closest("button, a, input, textarea, select, label")) {
        const slotId = String(slotRow.getAttribute("data-edit-slot") || "");
        const slot = state.plannerSlots.find((item) => item.id === slotId);
        if (slot) fillSlotForm(slot);
        return;
      }

      const saveSlotInlineButton = target.closest("[data-save-slot-inline]");
      if (saveSlotInlineButton) {
        await saveSlotInline();
        return;
      }

      const resetSlotInlineButton = target.closest("[data-reset-slot-inline]");
      if (resetSlotInlineButton) {
        resetSlotForm(selectedEvent());
        return;
      }

      const deleteSlotButton = target.closest("[data-delete-slot]");
      if (deleteSlotButton) {
        const slotId = String(deleteSlotButton.getAttribute("data-delete-slot") || "");
        if (!slotId || !window.confirm("Diesen Slot wirklich löschen?")) return;
        try {
          await deleteSlot(slotId);
          await reloadAndRender("Slot gelöscht.");
        } catch (error) {
          console.error("[event-planner-slot-delete]", error);
          setMsg(`Slot konnte nicht gelöscht werden: ${error?.message || error}`);
        }
        return;
      }

      const workApproveButton = target.closest("[data-work-approve]");
      if (workApproveButton) {
        const participationId = String(workApproveButton.getAttribute("data-work-approve") || "");
        const kind = String(workApproveButton.getAttribute("data-approval-kind") || "work");
        try {
          if (kind === "planner") {
            await approveRegistration(participationId);
            await reloadAndRender("Event-Freigabe erteilt.");
          } else {
            const checkinInput = document.querySelector(`[data-work-checkin="${participationId}"]`);
            const checkoutInput = document.querySelector(`[data-work-checkout="${participationId}"]`);
            const checkinIso = checkinInput instanceof HTMLInputElement ? toIsoFromLocalInput(checkinInput.value) : null;
            const checkoutIso = checkoutInput instanceof HTMLInputElement ? toIsoFromLocalInput(checkoutInput.value) : null;
            const editActive = state.approvalEditingRows.has(participationId);
            if (editActive) {
              if (!checkinIso || !checkoutIso) {
                setMsg("Bitte Von und Bis vollständig angeben.");
                return;
              }
              const editedMinutes = computeMinutes(checkinIso, checkoutIso);
              if (editedMinutes == null) {
                setMsg("Die Endzeit muss nach der Startzeit liegen.");
                return;
              }
              await adminUpdateParticipationTime(participationId, checkinIso, checkoutIso, null);
              await approveWorkParticipation(participationId, editedMinutes);
              state.approvalEditingRows.delete(participationId);
            } else {
              const minutes = computeMinutes(checkinIso, checkoutIso) ?? 0;
              await approveWorkParticipation(participationId, minutes);
            }
            await reloadAndRender("Teilnahme freigegeben.");
          }
        } catch (error) {
          console.error("[event-planner-approve]", error);
          setMsg(`Freigabe fehlgeschlagen: ${error?.message || error}`);
        }
        return;
      }

      const workEditButton = target.closest("[data-work-edit]");
      if (workEditButton) {
        const participationId = String(workEditButton.getAttribute("data-work-edit") || "");
        if (!participationId) return;
        if (state.approvalEditingRows.has(participationId)) state.approvalEditingRows.delete(participationId);
        else state.approvalEditingRows.add(participationId);
        renderApprovalsTable();
        return;
      }

      const workRejectButton = target.closest("[data-work-reject]");
      if (workRejectButton) {
        const participationId = String(workRejectButton.getAttribute("data-work-reject") || "");
        const kind = String(workRejectButton.getAttribute("data-approval-kind") || "work");
        const note = window.prompt("Grund für Ablehnung (optional):", "") || null;
        try {
          if (kind === "planner") {
            await rejectRegistration(participationId, note);
            await reloadAndRender("Event-Freigabe abgelehnt.");
          } else {
            await rejectWorkParticipation(participationId, note);
            await reloadAndRender("Teilnahme abgelehnt.");
          }
        } catch (error) {
          console.error("[event-planner-reject]", error);
          setMsg(`Ablehnung fehlgeschlagen: ${error?.message || error}`);
        }
        return;
      }

      const approveButton = target.closest("[data-approve-registration]");
      if (approveButton) {
        const registrationId = String(approveButton.getAttribute("data-approve-registration") || "");
        try {
          await approveRegistration(registrationId);
          await reloadAndRender("Anmeldung freigegeben.");
        } catch (error) {
          console.error("[event-planner-registration-approve]", error);
          setMsg(`Freigabe fehlgeschlagen: ${error?.message || error}`);
        }
        return;
      }

      const rejectButton = target.closest("[data-reject-registration]");
      if (rejectButton) {
        const registrationId = String(rejectButton.getAttribute("data-reject-registration") || "");
        const note = window.prompt("Optionaler Ablehnungsgrund:", "") || null;
        try {
          await rejectRegistration(registrationId, note);
          await reloadAndRender("Anmeldung abgelehnt.");
        } catch (error) {
          console.error("[event-planner-registration-reject]", error);
          setMsg(`Ablehnung fehlgeschlagen: ${error?.message || error}`);
        }
      }
    });

    document.body.addEventListener("input", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const rowId = String(target.getAttribute("data-work-checkin") || target.getAttribute("data-work-checkout") || "");
      if (!rowId) return;
      const checkinInput = document.querySelector(`[data-work-checkin="${rowId}"]`);
      const checkoutInput = document.querySelector(`[data-work-checkout="${rowId}"]`);
      const display = document.querySelector(`[data-work-minutes-display="${rowId}"]`);
      if (!(checkinInput instanceof HTMLInputElement) || !(checkoutInput instanceof HTMLInputElement) || !(display instanceof HTMLElement)) return;
      const minutes = computeMinutes(toIsoFromLocalInput(checkinInput.value), toIsoFromLocalInput(checkoutInput.value));
      display.textContent = minutes == null ? "-" : String(minutes);
    });

    document.body.addEventListener("keydown", async (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target || event.key !== "Enter") return;
      if (!target.closest(".event-planner-create-row")) return;
      if (target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      await onCreateSubmit();
    });
  }

  async function init() {
    try {
      const user = session()?.user;
      if (!user) {
        setMsg("Bitte einloggen, um den Eventplaner zu nutzen.");
        return;
      }

      state.roles = await loadRoles();
      if (!state.roles.some(isManagerRole)) {
        setMsg("Der Eventplaner ist nur für Vorstand oder Admin freigeschaltet.");
        return;
      }

      await loadClubOptions();
      bindUi();
      renderClubSwitch();
      resetCreateRow();
      setCreateRowEnabled(false);
      if (!state.selectedClubId) {
        setMsg("Kein aktiver Vereinskontext gefunden. Bitte zuerst einen Verein zuweisen.");
        return;
      }
      if (state.profileClubId !== state.selectedClubId) {
        await switchActiveClub(state.selectedClubId, { silent: true });
        return;
      }
      await loadData();
      if (state.selectedEventId && !planningRows().some((row) => row.id === state.selectedEventId)) {
        state.selectedEventId = "";
      }
      renderAll();
      if (state.migrationAvailable) setMsg("");
    } catch (error) {
      console.error("[event-planner-board]", error);
      setMsg(`Eventplaner konnte nicht geladen werden: ${error?.message || error}`);
    }
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
