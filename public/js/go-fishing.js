;(() => {
  const SESSION_KEY_PREFIX = "vdan_go_fishing_session_v1";
  const QUEUE_KEY_PREFIX = "vdan_go_fishing_queue_v1";

  let waters = [];
  let memberWaters = [];
  let topOfficialWaterIds = [];
  let fishSpecies = [];
  let sessionState = null;

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
    const live = session()?.user?.id;
    if (live) return String(live);
    try {
      const raw = localStorage.getItem("vdan_member_session_v1");
      const parsed = raw ? JSON.parse(raw) : null;
      return String(parsed?.user?.id || "").trim() || null;
    } catch {
      return null;
    }
  }

  function esc(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function readJsonSafe(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function writeJsonSafe(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }

  function sessionKey() {
    return `${SESSION_KEY_PREFIX}:${uid() || "anon"}`;
  }

  function queueKey() {
    return `${QUEUE_KEY_PREFIX}:${uid() || "anon"}`;
  }

  function setMsg(msg) {
    const el = document.getElementById("goFishingMsg");
    if (el) el.textContent = String(msg || "");
  }

  function fingerprintState() {
    const targets = normalizeTargets(sessionState?.targets)
      .map((t) => ({ fish_species_id: String(t.fish_species_id), count: Math.max(0, Math.trunc(Number(t.count || 0))) }))
      .sort((a, b) => String(a.fish_species_id).localeCompare(String(b.fish_species_id)));
    return JSON.stringify({
      water_mode: String(sessionState?.water_mode || "official"),
      water_body_id: String(sessionState?.water_body_id || ""),
      member_water_name: String(sessionState?.member_water_name || "").trim(),
      member_water_location: String(sessionState?.member_water_location || "").trim(),
      targets,
    });
  }

  function syncFormDefaults() {
    const form = document.getElementById("goFishingDialogForm");
    if (!(form instanceof HTMLFormElement)) return;
    const fields = [...form.querySelectorAll("input, textarea, select")];
    fields.forEach((el) => {
      if (el instanceof HTMLInputElement) {
        if (el.type === "checkbox" || el.type === "radio") {
          el.defaultChecked = el.checked;
        } else {
          el.defaultValue = String(el.value ?? "");
        }
        return;
      }
      if (el instanceof HTMLTextAreaElement) {
        el.defaultValue = String(el.value ?? "");
        return;
      }
      if (el instanceof HTMLSelectElement) {
        [...el.options].forEach((opt) => {
          opt.defaultSelected = opt.selected;
        });
      }
    });
  }

  function syncDraftSignal(asBaseline = false) {
    const hidden = document.getElementById("goFishingDraftState");
    if (!(hidden instanceof HTMLInputElement)) return;
    hidden.value = fingerprintState();
    if (asBaseline) syncFormDefaults();
  }

  function startLabelFromIso(iso) {
    const d = iso ? new Date(iso) : new Date();
    return d.toLocaleString("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function tripDateFromIso(iso) {
    const d = iso ? new Date(iso) : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function sb(path, init = {}, withAuth = false) {
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    if (withAuth && session()?.access_token) headers.set("Authorization", `Bearer ${session().access_token}`);
    return fetch(`${url}${path}`, { ...init, headers }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const e = new Error(err?.message || err?.hint || err?.error_description || `Request failed (${res.status})`);
        e.status = res.status;
        throw e;
      }
      return res.json().catch(() => []);
    });
  }

  function isNetworkError(err) {
    const msg = String(err?.message || "").toLowerCase();
    return msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("load failed");
  }

  function normalizeTargets(input) {
    const list = Array.isArray(input) ? input : [];
    const out = [];
    list.forEach((t) => {
      const fish_species_id = String(t?.fish_species_id || "").trim();
      const name = String(t?.name || "").trim();
      const count = Math.max(0, Number(t?.count || 0) || 0);
      if (!fish_species_id || !name) return;
      if (out.some((x) => x.fish_species_id === fish_species_id)) return;
      out.push({ fish_species_id, name, count });
    });
    return out;
  }

  function normalizeWaterMode(input) {
    return String(input || "").trim() === "member" ? "member" : "official";
  }

  function loadState() {
    const raw = readJsonSafe(sessionKey(), null);
    if (!raw || typeof raw !== "object") {
      sessionState = null;
      return;
    }
    sessionState = {
      active: Boolean(raw.active),
      started_at: String(raw.started_at || ""),
      water_mode: normalizeWaterMode(raw.water_mode),
      water_body_id: String(raw.water_body_id || ""),
      member_water_name: String(raw.member_water_name || ""),
      member_water_location: String(raw.member_water_location || ""),
      targets: normalizeTargets(raw.targets),
    };
  }

  function saveState() {
    if (!sessionState) return;
    writeJsonSafe(sessionKey(), sessionState);
  }

  function ensureSession() {
    if (sessionState?.active && sessionState.started_at) return;
    sessionState = {
      active: true,
      started_at: new Date().toISOString(),
      water_mode: "official",
      water_body_id: "",
      member_water_name: "",
      member_water_location: "",
      targets: [],
    };
    saveState();
  }

  function loadQueue() {
    return readJsonSafe(queueKey(), []);
  }

  function saveQueue(items) {
    writeJsonSafe(queueKey(), Array.isArray(items) ? items : []);
  }

  function renderStartLabel() {
    const el = document.getElementById("goFishingSessionStartLabel");
    if (!el) return;
    if (!sessionState?.started_at) {
      el.textContent = "Sessionstart wird gesetzt...";
      return;
    }
    el.textContent = `Start: ${startLabelFromIso(sessionState.started_at)}`;
  }

  function renderWaterOptions() {
    const sel = document.getElementById("goFishingWater");
    if (!sel) return;
    const q = String(document.getElementById("goFishingWaterSearch")?.value || "").trim().toLowerCase();
    const selected = String(sessionState?.water_body_id || "");
    const filtered = waters.filter((w) => String(w.name || "").toLowerCase().includes(q));
    let html = `<option value="">Bitte wählen</option>` + filtered.map((w) => `<option value="${w.id}">${esc(w.name)}</option>`).join("");
    if (selected && !filtered.some((w) => String(w.id) === selected)) {
      const w = waters.find((x) => String(x.id) === selected);
      if (w) html += `<option value="${w.id}">${esc(w.name)}</option>`;
    }
    sel.innerHTML = html;
    if (selected) sel.value = selected;
  }

  function renderWaterQuickChips() {
    const root = document.getElementById("goFishingWaterFavorites");
    const title = document.getElementById("goFishingWaterQuickTitle");
    if (!root) return;
    const mode = normalizeWaterMode(sessionState?.water_mode);
    if (mode === "member") {
      if (title) title.textContent = "Meine freien Gewässer";
      const list = memberWaters.slice(0, 3);
      root.innerHTML = list.map((w) => {
        const suffix = String(w.location_text || "").trim();
        const label = suffix ? `${w.name} • ${suffix}` : String(w.name || "");
        return `<button type="button" class="fangliste-water-chip" data-gofishing-member-water-quick="${esc(w.id)}">${esc(label)}</button>`;
      }).join("");
      if (!list.length) root.innerHTML = `<p class="small">Noch keine freien Gewässer genutzt.</p>`;
      return;
    }

    if (title) title.textContent = "Meistgenutzte Vereinsgewässer";
    const list = topOfficialWaterIds
      .map((id) => waters.find((w) => String(w.id) === String(id)))
      .filter(Boolean)
      .slice(0, 3);
    root.innerHTML = list.map((w) => `<button type="button" class="fangliste-water-chip" data-gofishing-water-quick="${esc(w.id)}">${esc(w.name)}</button>`).join("");
    if (!list.length) root.innerHTML = `<p class="small">Noch keine Vereinsgewässer genutzt.</p>`;
  }

  function renderWaterMode() {
    const mode = normalizeWaterMode(sessionState?.water_mode);
    const modeSel = document.getElementById("goFishingWaterMode");
    const officialSearchWrap = document.getElementById("goFishingWaterSearch")?.closest("label");
    const officialSelectWrap = document.getElementById("goFishingWater")?.closest("label");
    const quickWrap = document.getElementById("goFishingWaterFavorites")?.closest(".fangliste-water-favorites");
    const memberNameWrap = document.getElementById("goFishingMemberWaterNameWrap");
    const memberLocationWrap = document.getElementById("goFishingMemberWaterLocationWrap");
    if (modeSel) modeSel.value = mode;
    const memberMode = mode === "member";
    [officialSearchWrap, officialSelectWrap].forEach((el) => {
      if (!el) return;
      el.hidden = memberMode;
      el.classList.toggle("hidden", memberMode);
    });
    if (quickWrap) {
      quickWrap.hidden = false;
      quickWrap.classList.remove("hidden");
    }
    [memberNameWrap, memberLocationWrap].forEach((el) => {
      if (!el) return;
      el.hidden = !memberMode;
      el.classList.toggle("hidden", !memberMode);
    });
    const waterSel = document.getElementById("goFishingWater");
    const waterSearch = document.getElementById("goFishingWaterSearch");
    if (waterSel instanceof HTMLSelectElement) {
      waterSel.required = !memberMode;
      waterSel.disabled = memberMode;
    }
    if (waterSearch instanceof HTMLInputElement) waterSearch.disabled = memberMode;
    const nameInput = document.getElementById("goFishingMemberWaterName");
    if (nameInput instanceof HTMLInputElement) {
      nameInput.required = memberMode;
      nameInput.disabled = !memberMode;
      nameInput.value = String(sessionState?.member_water_name || "");
    }
    const locationInput = document.getElementById("goFishingMemberWaterLocation");
    if (locationInput instanceof HTMLInputElement) {
      locationInput.disabled = !memberMode;
      locationInput.value = String(sessionState?.member_water_location || "");
    }
    renderWaterQuickChips();
  }

  function renderFishOptions() {
    const sel = document.getElementById("goFishingFishSelect");
    if (!sel) return;
    sel.innerHTML = `<option value="">Bitte wählen</option>` + fishSpecies.map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join("");
  }

  function renderTargets() {
    const root = document.getElementById("goFishingTargetList");
    if (!root) return;
    const list = normalizeTargets(sessionState?.targets);
    if (!list.length) {
      root.innerHTML = `<p class="small">Noch keine Zielfische hinzugefügt.</p>`;
      return;
    }
    root.innerHTML = list.map((t) => `
      <div class="portal-gofishing-target">
        <p class="portal-gofishing-target__name">${esc(t.name)}</p>
        <button type="button" class="feed-btn feed-btn--ghost" data-gofishing-action="dec" data-fish-id="${esc(t.fish_species_id)}">-</button>
        <span class="portal-gofishing-target__count">${Number(t.count || 0)}</span>
        <button type="button" class="feed-btn" data-gofishing-action="inc" data-fish-id="${esc(t.fish_species_id)}">+</button>
      </div>
    `).join("");
  }

  async function loadMasterData() {
    const userId = String(uid() || "").trim();
    const [waterRows, fishRows, memberRows, tripRows] = await Promise.all([
      sb("/rest/v1/water_bodies?select=id,name,is_active&is_active=eq.true&order=name.asc", { method: "GET" }, true).catch(() => []),
      sb("/rest/v1/fish_species?select=id,name,is_active&is_active=eq.true&order=name.asc", { method: "GET" }, true).catch(() => []),
      sb(`/rest/v1/member_waters?select=id,name,location_text,usage_count,status&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&order=usage_count.desc,updated_at.desc&limit=50`, { method: "GET" }, true).catch(() => []),
      sb(`/rest/v1/fishing_trips?select=water_source,water_body_id&user_id=eq.${encodeURIComponent(userId)}&water_source=eq.official&order=created_at.desc&limit=2000`, { method: "GET" }, true).catch(() => []),
    ]);
    waters = Array.isArray(waterRows) ? waterRows : [];
    fishSpecies = Array.isArray(fishRows) ? fishRows : [];
    memberWaters = (Array.isArray(memberRows) ? memberRows : []).map((r) => ({
      id: String(r.id || ""),
      name: String(r.name || "").trim(),
      location_text: String(r.location_text || "").trim(),
      usage_count: Number(r.usage_count || 0) || 0,
    })).filter((r) => r.id && r.name);
    const counts = new Map();
    (Array.isArray(tripRows) ? tripRows : []).forEach((t) => {
      const id = String(t?.water_body_id || "").trim();
      if (!id) return;
      counts.set(id, (counts.get(id) || 0) + 1);
    });
    topOfficialWaterIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
      .map(([id]) => id)
      .slice(0, 3);
  }

  function addSelectedFishTarget() {
    ensureSession();
    const sel = document.getElementById("goFishingFishSelect");
    const fishId = String(sel?.value || "").trim();
    if (!fishId) return;
    const fish = fishSpecies.find((f) => String(f.id) === fishId);
    if (!fish) return;
    if (!sessionState?.targets) sessionState.targets = [];
    const existing = sessionState.targets.find((t) => t.fish_species_id === fishId);
    if (existing) existing.count = Math.max(0, Math.trunc(Number(existing.count || 0))) + 1;
    else sessionState.targets.push({ fish_species_id: fishId, name: String(fish.name || "Fisch"), count: 1 });
    sessionState.targets = normalizeTargets(sessionState.targets);
    saveState();
    renderTargets();
    syncDraftSignal(false);
  }

  function updateTargetCount(fishId, delta) {
    ensureSession();
    const id = String(fishId || "").trim();
    if (!id || !sessionState?.targets) return;
    const t = sessionState.targets.find((x) => x.fish_species_id === id);
    if (!t) return;
    const next = Math.trunc(Number(t.count || 0)) + Math.trunc(Number(delta || 0));
    t.count = Math.max(0, next);
    sessionState.targets = normalizeTargets(sessionState.targets);
    saveState();
    renderTargets();
    syncDraftSignal(false);
  }

  function finalizePayloadFromState() {
    const endedAt = new Date().toISOString();
    const startedAt = String(sessionState?.started_at || new Date().toISOString());
    const tripDate = tripDateFromIso(startedAt);
    const waterMode = normalizeWaterMode(sessionState?.water_mode);
    const waterBodyId = String(sessionState?.water_body_id || "").trim();
    const memberWaterName = String(sessionState?.member_water_name || "").trim();
    const memberWaterLocation = String(sessionState?.member_water_location || "").trim();
    const targets = normalizeTargets(sessionState?.targets);
    const catches = targets.filter((t) => Number(t.count || 0) > 0);
    const durationMin = Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000));
    return { startedAt, endedAt, durationMin, tripDate, waterMode, waterBodyId, memberWaterName, memberWaterLocation, catches };
  }

  function parseReturnRow(payload) {
    if (!payload) return null;
    if (Array.isArray(payload)) return payload[0] || null;
    if (typeof payload === "object") return payload;
    return null;
  }

  async function persistCompletedSession(payload) {
    const userId = String(uid() || "").trim();
    if (!userId || !payload.tripDate) throw new Error("Bitte Gewässer und Datum prüfen.");
    const isMemberMode = payload.waterMode === "member";
    if (!isMemberMode && !payload.waterBodyId) throw new Error("Bitte Vereinsgewässer wählen.");
    if (isMemberMode && !payload.memberWaterName) throw new Error("Bitte freies Gewässer benennen.");

    if (!payload.catches.length && !isMemberMode) {
      try {
        await sb("/rest/v1/rpc/catch_trip_quick_no_catch", {
          method: "POST",
          body: JSON.stringify({ p_trip_date: payload.tripDate, p_water_body_id: payload.waterBodyId, p_note: null }),
        }, true);
        return;
      } catch {
        await sb("/rest/v1/rpc/rpc_quick_no_catch", {
          method: "POST",
          body: JSON.stringify({ trip_date: payload.tripDate, water_id: payload.waterBodyId }),
        }, true);
        return;
      }
    }

    if (!payload.catches.length && isMemberMode) {
      await sb("/rest/v1/rpc/catch_trip_quick_no_catch_member", {
        method: "POST",
        body: JSON.stringify({
          p_trip_date: payload.tripDate,
          p_member_water_name: payload.memberWaterName,
          p_location_text: payload.memberWaterLocation || null,
          p_note: null,
        }),
      }, true);
      return;
    }

    let memberWaterId = null;
    if (isMemberMode) {
      const memberWater = await sb("/rest/v1/rpc/member_water_upsert", {
        method: "POST",
        body: JSON.stringify({
          p_name: payload.memberWaterName,
          p_location_text: payload.memberWaterLocation || null,
          p_description: null,
          p_latitude: null,
          p_longitude: null,
          p_used_on: payload.tripDate,
        }),
      }, true);
      memberWaterId = String(parseReturnRow(memberWater)?.id || "").trim();
      if (!memberWaterId) throw new Error("Freies Gewässer konnte nicht gespeichert werden.");
    }

    const tripPayload = await sb("/rest/v1/fishing_trips", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: userId,
        trip_date: payload.tripDate,
        water_body_id: isMemberMode ? null : payload.waterBodyId,
        member_water_id: isMemberMode ? memberWaterId : null,
        water_source: isMemberMode ? "member" : "official",
        water_name_raw: isMemberMode ? payload.memberWaterName : null,
        mapping_status: isMemberMode ? "unmapped" : "mapped",
        entry_type: "catch",
        note: `GoFishing Session • Dauer: ${payload.durationMin} min`,
      }),
    }, true);
    const tripRow = parseReturnRow(tripPayload);
    const tripId = String(tripRow?.id || "").trim();
    if (!tripId) throw new Error("Session konnte nicht gespeichert werden.");

    for (const c of payload.catches) {
      await sb("/rest/v1/catch_entries", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          fishing_trip_id: tripId,
          user_id: userId,
          water_body_id: isMemberMode ? null : payload.waterBodyId,
          member_water_id: isMemberMode ? memberWaterId : null,
          water_source: isMemberMode ? "member" : "official",
          water_name_raw: isMemberMode ? payload.memberWaterName : null,
          mapping_status: isMemberMode ? "unmapped" : "mapped",
          fish_species_id: c.fish_species_id,
          caught_on: payload.tripDate,
          quantity: Math.max(1, Number(c.count || 1)),
          length_cm: null,
          weight_g: null,
          note: null,
        }),
      }, true);
    }
  }

  async function flushQueue() {
    const queue = loadQueue();
    if (!queue.length || !navigator.onLine) return;
    const next = [];
    for (const item of queue) {
      try {
        await persistCompletedSession(item.payload);
      } catch (err) {
        next.push(item);
        if (isNetworkError(err)) break;
      }
    }
    saveQueue(next);
  }

  async function endSession() {
    try {
      const payload = finalizePayloadFromState();
      if (payload.waterMode !== "member" && !payload.waterBodyId) throw new Error("Bitte Vereinsgewässer wählen.");
      if (payload.waterMode === "member" && !payload.memberWaterName) throw new Error("Bitte freies Gewässer benennen.");
      setMsg("Session wird gespeichert...");
      try {
        await persistCompletedSession(payload);
        setMsg("Session beendet und Fangliste aktualisiert.");
      } catch (err) {
        if (!navigator.onLine || isNetworkError(err)) {
          const queue = loadQueue();
          queue.push({ id: `${Date.now()}:${Math.random().toString(36).slice(2, 8)}`, payload });
          saveQueue(queue);
          setMsg("Offline gespeichert. Synchronisierung erfolgt automatisch.");
        } else {
          throw err;
        }
      }
      sessionState = {
        active: true,
        started_at: new Date().toISOString(),
        water_mode: payload.waterMode,
        water_body_id: payload.waterBodyId,
        member_water_name: payload.memberWaterName,
        member_water_location: payload.memberWaterLocation,
        targets: [],
      };
      saveState();
      renderStartLabel();
      renderTargets();
      syncDraftSignal(true);
    } catch (err) {
      setMsg(err?.message || "Session konnte nicht beendet werden.");
    }
  }

  function syncWaterFromSelect() {
    ensureSession();
    if (!sessionState) return;
    sessionState.water_body_id = String(document.getElementById("goFishingWater")?.value || "").trim();
    saveState();
    syncDraftSignal(false);
  }

  function syncWaterModeFromSelect() {
    ensureSession();
    if (!sessionState) return;
    sessionState.water_mode = normalizeWaterMode(document.getElementById("goFishingWaterMode")?.value);
    saveState();
    renderWaterMode();
    syncDraftSignal(false);
  }

  function syncMemberWaterInputs() {
    ensureSession();
    if (!sessionState) return;
    sessionState.member_water_name = String(document.getElementById("goFishingMemberWaterName")?.value || "");
    sessionState.member_water_location = String(document.getElementById("goFishingMemberWaterLocation")?.value || "");
    saveState();
    syncDraftSignal(false);
  }

  async function onOpen() {
    if (!uid()) return;
    loadState();
    ensureSession();
    sessionState.targets = normalizeTargets(sessionState.targets);
    sessionState.water_mode = normalizeWaterMode(sessionState.water_mode);
    saveState();
    renderStartLabel();
    await loadMasterData();
    sessionState.water_body_id = waters.some((w) => String(w.id) === String(sessionState.water_body_id || ""))
      ? String(sessionState.water_body_id)
      : "";
    saveState();
    renderWaterOptions();
    renderWaterMode();
    renderFishOptions();
    renderTargets();
    setMsg("");
    syncDraftSignal(true);
    flushQueue().catch(() => {});
  }

  function bindEvents() {
    document.addEventListener("vdan:open-gofishing", () => {
      void onOpen();
    });
    document.getElementById("goFishingWaterSearch")?.addEventListener("input", renderWaterOptions);
    document.getElementById("goFishingWaterMode")?.addEventListener("change", syncWaterModeFromSelect);
    document.getElementById("goFishingWater")?.addEventListener("change", syncWaterFromSelect);
    document.getElementById("goFishingMemberWaterName")?.addEventListener("input", syncMemberWaterInputs);
    document.getElementById("goFishingMemberWaterLocation")?.addEventListener("input", syncMemberWaterInputs);
    document.getElementById("goFishingAddFishBtn")?.addEventListener("click", addSelectedFishTarget);
    document.getElementById("goFishingEndBtn")?.addEventListener("click", () => {
      void endSession();
    });
    document.getElementById("goFishingTargetList")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-gofishing-action][data-fish-id]");
      if (!btn) return;
      const action = String(btn.getAttribute("data-gofishing-action") || "");
      const fishId = String(btn.getAttribute("data-fish-id") || "");
      if (!fishId) return;
      if (action === "inc") updateTargetCount(fishId, 1);
      if (action === "dec") updateTargetCount(fishId, -1);
    });
    document.getElementById("goFishingWaterFavorites")?.addEventListener("click", (e) => {
      const officialBtn = e.target.closest("[data-gofishing-water-quick]");
      if (officialBtn) {
        const id = String(officialBtn.getAttribute("data-gofishing-water-quick") || "").trim();
        if (!id) return;
        sessionState.water_mode = "official";
        sessionState.water_body_id = id;
        saveState();
        renderWaterOptions();
        renderWaterMode();
        syncDraftSignal(false);
        return;
      }

      const memberBtn = e.target.closest("[data-gofishing-member-water-quick]");
      if (!memberBtn) return;
      const id = String(memberBtn.getAttribute("data-gofishing-member-water-quick") || "").trim();
      const row = memberWaters.find((x) => String(x.id) === id);
      if (!row) return;
      sessionState.water_mode = "member";
      sessionState.member_water_name = String(row.name || "");
      sessionState.member_water_location = String(row.location_text || "");
      saveState();
      renderWaterMode();
      syncDraftSignal(false);
    });
    window.addEventListener("online", () => {
      flushQueue().catch(() => {});
    });
  }

  function init() {
    bindEvents();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
