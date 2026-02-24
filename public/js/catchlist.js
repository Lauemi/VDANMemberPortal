;(() => {
  const MAX_IMAGE_BYTES = 350 * 1024;
  const MAX_LONG_EDGE = 1280;
  const OFFLINE_SCHEMA_VERSION = 1;

  let waters = [];
  let fishSpecies = [];
  let trips = [];
  let catches = [];
  let activeTripId = null;
  let createMode = "catch";
  let syncInProgress = false;
  let queueMem = [];
  let conflictsMem = [];
  let cacheMem = null;
  const LEGACY_CATCH_CLEAR_MARKER = "vdan_catch_cleanup_v1_done";
  const TOUCH_RPC_DISABLED_KEY = "vdan_rpc_touch_user_disabled_v1";
  const OFFLINE_QUEUE_KEY_PREFIX = "vdan_trip_sync_queue_v1:";
  const OFFLINE_CACHE_KEY_PREFIX = "vdan_trip_cache_v1:";
  const OFFLINE_CONFLICT_KEY_PREFIX = "vdan_trip_sync_conflicts_v1:";

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
    if (live) return live;
    try {
      const raw = localStorage.getItem("vdan_member_session_v1");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const fallback = String(parsed?.user?.id || "").trim();
      return fallback || null;
    } catch {
      return null;
    }
  }

  function queueKey() {
    return `${OFFLINE_QUEUE_KEY_PREFIX}${uid() || "anon"}`;
  }

  function cacheKey() {
    return `${OFFLINE_CACHE_KEY_PREFIX}${uid() || "anon"}`;
  }

  function conflictKey() {
    return `${OFFLINE_CONFLICT_KEY_PREFIX}${uid() || "anon"}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function isLocalId(id) {
    return String(id || "").startsWith("local:");
  }

  function localId(prefix = "item") {
    return `local:${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  }

  function isNetworkError(err) {
    const msg = String(err?.message || err || "").toLowerCase();
    return msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("load failed");
  }

  function isConflictError(err) {
    if (!err) return false;
    if (isNetworkError(err)) return false;
    const status = Number(err.status || 0);
    if (status >= 400 && status < 500) return true;
    const msg = String(err?.message || "").toLowerCase();
    return msg.includes("violates") || msg.includes("constraint") || msg.includes("limit");
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
      // ignore storage errors
    }
  }

  function loadQueue() {
    return Array.isArray(queueMem) ? queueMem : [];
  }

  function saveQueue(items) {
    queueMem = Array.isArray(items) ? items : [];
    persistQueue().catch(() => {});
  }

  function enqueue(action) {
    const items = loadQueue();
    const next = {
      id: localId("queue"),
      created_at: nowIso(),
      attempts: 0,
      ...action,
    };
    items.push(next);
    saveQueue(items);
    return next;
  }

  function pendingCount() {
    return loadQueue().length;
  }

  function loadConflicts() {
    return Array.isArray(conflictsMem) ? conflictsMem : [];
  }

  function saveConflicts(items) {
    conflictsMem = Array.isArray(items) ? items : [];
    persistConflicts().catch(() => {});
  }

  function conflictCount() {
    return loadConflicts().length;
  }

  function pushConflict(item, err) {
    const conflicts = loadConflicts();
    conflicts.push({
      ...item,
      conflict_at: nowIso(),
      conflict_reason: String(err?.message || "sync_conflict"),
      conflict_status: Number(err?.status || 0) || null,
    });
    saveConflicts(conflicts);
  }

  function updatePendingHint() {
    const n = pendingCount();
    const c = conflictCount();
    if (n > 0 && c > 0) {
      setMsg(`${n} Eintrag${n === 1 ? "" : "e"} wartet auf Sync, ${c} Konflikt${c === 1 ? "" : "e"} prüfen.`);
      return;
    }
    if (n > 0) {
      setMsg(`${n} Eintrag${n === 1 ? "" : "e"} wartet auf Synchronisierung.`);
      return;
    }
    if (c > 0) {
      setMsg(`${c} Konflikt${c === 1 ? "" : "e"} in Offline-Sync. Einträge sind mit ⚠ markiert.`);
    }
  }

  function loadOfflineCache() {
    const cached = cacheMem;
    if (!cached || cached.schema !== OFFLINE_SCHEMA_VERSION) return;
    waters = Array.isArray(cached.waters) ? cached.waters : waters;
    fishSpecies = Array.isArray(cached.fishSpecies) ? cached.fishSpecies : fishSpecies;
    trips = Array.isArray(cached.trips) ? cached.trips : trips;
    catches = Array.isArray(cached.catches) ? cached.catches : catches;
  }

  function saveOfflineCache() {
    cacheMem = {
      schema: OFFLINE_SCHEMA_VERSION,
      updated_at: nowIso(),
      waters,
      fishSpecies,
      trips,
      catches,
    };
    persistCache().catch(() => {});
  }

  async function getPersistentJson(key, fallback) {
    const val = await window.VDAN_OFFLINE_STORE?.getJSON?.(key);
    if (val !== null && val !== undefined) return val;
    return readJsonSafe(key, fallback);
  }

  async function setPersistentJson(key, value) {
    if (window.VDAN_OFFLINE_STORE?.setJSON) {
      await window.VDAN_OFFLINE_STORE.setJSON(key, value);
      return;
    }
    writeJsonSafe(key, value);
  }

  async function persistQueue() {
    await setPersistentJson(queueKey(), queueMem);
  }

  async function persistConflicts() {
    await setPersistentJson(conflictKey(), conflictsMem);
  }

  async function persistCache() {
    await setPersistentJson(cacheKey(), cacheMem);
  }

  async function hydratePersistentState() {
    const [q, c, cache] = await Promise.all([
      getPersistentJson(queueKey(), []),
      getPersistentJson(conflictKey(), []),
      getPersistentJson(cacheKey(), null),
    ]);
    queueMem = Array.isArray(q) ? q : [];
    conflictsMem = Array.isArray(c) ? c : [];
    cacheMem = cache && typeof cache === "object" ? cache : null;
  }

  function clearLegacyLocalCatchDataOnce() {
    try {
      if (localStorage.getItem(LEGACY_CATCH_CLEAR_MARKER) === "1") return;

      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k) keys.push(k);
      }

      keys.forEach((k) => {
        if (
          k.startsWith("vdan_catchlist_") ||
          k.startsWith("vdan_fangliste_") ||
          k.startsWith("vdan_local_catches_") ||
          k.startsWith("vdan_trip_draft_") ||
          k.startsWith("vdan_trip_images_v1:")
        ) {
          localStorage.removeItem(k);
        }
      });

      localStorage.setItem(LEGACY_CATCH_CLEAR_MARKER, "1");
    } catch {
      // ignore
    }
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function setMsg(text = "") {
    const el = document.getElementById("tripMsg");
    if (el) el.textContent = text;
  }

  function setStatsMsg(text = "") {
    const el = document.getElementById("tripStatsMsg");
    if (el) el.textContent = text;
  }

  function setCreateMsg(text = "") {
    const el = document.getElementById("tripCreateMsg");
    if (el) el.textContent = text;
  }

  function setDetailMsg(text = "") {
    const el = document.getElementById("tripDetailMsg");
    if (el) el.textContent = text;
  }

  function fmtDate(value) {
    if (!value) return "-";
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("de-DE");
  }

  function fmtTs(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("de-DE");
  }

  function sbHeaders(withAuth = false, extraHeaders = {}) {
    const { key } = cfg();
    const headers = new Headers(extraHeaders);
    headers.set("apikey", key);
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    if (withAuth && session()?.access_token) {
      headers.set("Authorization", `Bearer ${session().access_token}`);
    }
    return headers;
  }

  async function sb(path, init = {}, withAuth = false) {
    const { url, key } = cfg();
    if (!url || !key) throw new Error("Supabase-Konfiguration fehlt.");
    const res = await fetch(`${url}${path}`, {
      ...init,
      headers: sbHeaders(withAuth, init.headers || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const e = new Error(err?.message || err?.hint || err?.error_description || `Request failed (${res.status})`);
      e.status = res.status;
      throw e;
    }
    return res.json().catch(() => ({}));
  }

  function parseReturnRow(payload) {
    if (Array.isArray(payload)) return payload[0] || null;
    if (payload && typeof payload === "object") return payload;
    return null;
  }

  function tripKey(tripDate, waterBodyId) {
    return `${tripDate || ""}|${waterBodyId || ""}`;
  }

  function catchesByTripId() {
    const map = new Map();
    catches.forEach((c) => {
      const k = String(c.fishing_trip_id || "");
      if (!k) return;
      const arr = map.get(k) || [];
      arr.push(c);
      map.set(k, arr);
    });
    return map;
  }

  function catchesByTripKey() {
    const map = new Map();
    catches.forEach((c) => {
      const k = tripKey(c.caught_on, c.water_body_id);
      const arr = map.get(k) || [];
      arr.push(c);
      map.set(k, arr);
    });
    return map;
  }

  function catchesForTrip(trip) {
    const byId = catchesByTripId().get(String(trip?.id || "")) || [];
    if (byId.length) return byId;
    return catchesByTripKey().get(tripKey(trip?.trip_date, trip?.water_body_id)) || [];
  }

  function catchSummaryForTrip(trip, catchList) {
    if (!catchList.length) return trip.entry_type === "no_catch" ? "Kein Fang" : "Fang";
    const qty = catchList.reduce((sum, c) => sum + Number(c.quantity || 0), 0);
    const names = [...new Set(catchList.map((c) => c?.fish_species?.name).filter(Boolean))];
    if (!names.length) return `${qty} Fang`;
    if (names.length === 1) return `${qty}x ${names[0]}`;
    return `${qty} Fänge (${names.slice(0, 2).join(", ")}${names.length > 2 ? ", ..." : ""})`;
  }

  async function fileToImageBitmap(file) {
    if (window.createImageBitmap) return window.createImageBitmap(file);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
      img.src = URL.createObjectURL(file);
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Bild konnte nicht gelesen werden"));
      reader.readAsDataURL(blob);
    });
  }

  async function compressImageToWebp(file) {
    const bitmap = await fileToImageBitmap(file);
    const scale = Math.min(1, MAX_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.drawImage(bitmap, 0, 0, width, height);

    let q = 0.88;
    let blob = await new Promise((res) => canvas.toBlob(res, "image/webp", q));
    while (blob && blob.size > MAX_IMAGE_BYTES && q > 0.42) {
      q -= 0.08;
      blob = await new Promise((res) => canvas.toBlob(res, "image/webp", q));
    }

    if (!blob) throw new Error("Bildverarbeitung fehlgeschlagen");
    if (blob.size > MAX_IMAGE_BYTES) throw new Error("Bild ist zu groß. Bitte anderes Bild wählen.");

    return {
      data_url: await blobToDataUrl(blob),
      bytes: blob.size,
      width,
      height,
      mime: "image/webp",
      updated_at: new Date().toISOString(),
    };
  }

  async function touchUserUsage() {
    try {
      if (localStorage.getItem(TOUCH_RPC_DISABLED_KEY) === "1") return;
    } catch {
      // ignore
    }
    try {
      await sb("/rest/v1/rpc/rpc_touch_user", {
        method: "POST",
        body: JSON.stringify({}),
      }, true);
    } catch (err) {
      if (String(err?.message || "").includes("(404)")) {
        try {
          localStorage.setItem(TOUCH_RPC_DISABLED_KEY, "1");
        } catch {
          // ignore
        }
      }
    }
  }

  async function loadWaters() {
    try {
      const rows = await sb("/rest/v1/water_bodies?select=id,name,area_kind,is_active&is_active=eq.true&order=name.asc", { method: "GET" }, true);
      waters = Array.isArray(rows) ? rows : [];
      saveOfflineCache();
    } catch (err) {
      if (!waters.length) throw err;
    }
    renderWaterOptions();
  }

  async function loadFishSpecies() {
    try {
      const rows = await sb("/rest/v1/fish_species?select=id,name,is_active&is_active=eq.true&order=name.asc", { method: "GET" }, true);
      fishSpecies = Array.isArray(rows) ? rows : [];
      saveOfflineCache();
    } catch (err) {
      if (!fishSpecies.length) throw err;
    }
    renderFishSpeciesOptions();
  }

  function renderWaterOptions() {
    const sel = document.getElementById("tripWater");
    const q = String(document.getElementById("tripWaterSearch")?.value || "").trim().toLowerCase();
    if (!sel) return;

    const filtered = waters.filter((w) => String(w.name || "").toLowerCase().includes(q));
    sel.innerHTML = `<option value="">Bitte wählen</option>` + filtered.map((w) => `<option value="${w.id}">${esc(w.name)}</option>`).join("");
  }

  function renderFishSpeciesOptions() {
    const sel = document.getElementById("tripFishSpecies");
    if (!sel) return;
    sel.innerHTML = `<option value="">Kein Eintrag</option>` + fishSpecies.map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join("");
  }

  function fishSpeciesOptionsHtml(selectedId = "") {
    const selected = String(selectedId || "");
    return [
      `<option value="">Bitte wählen</option>`,
      ...fishSpecies.map((f) => `<option value="${f.id}" ${String(f.id) === selected ? "selected" : ""}>${esc(f.name)}</option>`),
    ].join("");
  }

  function waterOptionsHtml(selectedId = "") {
    const selected = String(selectedId || "");
    return [
      `<option value="">Bitte wählen</option>`,
      ...waters.map((w) => `<option value="${w.id}" ${String(w.id) === selected ? "selected" : ""}>${esc(w.name)}</option>`),
    ].join("");
  }

  function selectedWaterId() {
    return String(document.getElementById("tripWater")?.value || "").trim();
  }

  function selectedDate() {
    return String(document.getElementById("tripDate")?.value || "").trim();
  }

  function selectedFishSpeciesId() {
    return String(document.getElementById("tripFishSpecies")?.value || "").trim();
  }

  function selectedQty() {
    const raw = String(document.getElementById("tripQty")?.value || "").trim();
    if (!raw) return 1;
    const v = Number(raw);
    return Number.isFinite(v) ? v : NaN;
  }

  function selectedLengthCm() {
    const raw = String(document.getElementById("tripLength")?.value || "").trim();
    if (!raw) return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : NaN;
  }

  function selectedWeightG() {
    const raw = String(document.getElementById("tripWeight")?.value || "").trim();
    if (!raw) return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : NaN;
  }

  function selectedNoCatchPayload() {
    return {
      p_trip_date: selectedDate(),
      p_water_body_id: selectedWaterId(),
      p_note: null,
    };
  }

  function selectedCatchPayload(photoDataUrl = null) {
    return {
      user_id: uid(),
      trip_date: selectedDate(),
      water_body_id: selectedWaterId(),
      fish_species_id: selectedFishSpeciesId() || null,
      quantity: selectedQty(),
      length_cm: selectedLengthCm(),
      weight_g: selectedWeightG(),
      photo_data_url: photoDataUrl || null,
    };
  }

  function validateCatchPayload(payload) {
    if (!payload?.user_id || !payload?.trip_date || !payload?.water_body_id) {
      throw new Error("Bitte Datum und Gewässer wählen.");
    }
    if (!payload.fish_species_id) return;
    if (!Number.isFinite(payload.quantity) || payload.quantity < 1) throw new Error("Anzahl muss mindestens 1 sein.");
    if (payload.length_cm !== null && (!Number.isFinite(payload.length_cm) || payload.length_cm < 0)) throw new Error("Länge ist ungültig.");
    if (payload.weight_g !== null && (!Number.isFinite(payload.weight_g) || payload.weight_g < 0)) throw new Error("Gewicht ist ungültig.");
  }

  function waterNameById(id) {
    const w = waters.find((x) => String(x.id) === String(id));
    return String(w?.name || "-");
  }

  function fishNameById(id) {
    const f = fishSpecies.find((x) => String(x.id) === String(id));
    return String(f?.name || "-");
  }

  function addLocalNoCatch(payload, queueId) {
    const localTripId = `local:queued:${queueId}`;
    if (trips.some((t) => String(t.id) === localTripId)) return;
    trips.unshift({
      id: localTripId,
      trip_date: payload.p_trip_date,
      entry_type: "no_catch",
      note: payload.p_note || null,
      created_at: nowIso(),
      water_body_id: payload.p_water_body_id,
      water_bodies: { name: waterNameById(payload.p_water_body_id) },
      photo_data_url: null,
      pending_sync: true,
    });
    saveOfflineCache();
  }

  function addLocalCatch(payload, queueId) {
    const localTripId = `local:queued:${queueId}`;
    if (trips.some((t) => String(t.id) === localTripId)) return;
    trips.unshift({
      id: localTripId,
      trip_date: payload.trip_date,
      entry_type: "catch",
      note: null,
      created_at: nowIso(),
      water_body_id: payload.water_body_id,
      water_bodies: { name: waterNameById(payload.water_body_id) },
      photo_data_url: payload.photo_data_url || null,
      pending_sync: true,
    });

    if (payload.fish_species_id) {
        catches.unshift({
        id: `local:queued:catch:${queueId}`,
        fishing_trip_id: localTripId,
        caught_on: payload.trip_date,
        water_body_id: payload.water_body_id,
        fish_species_id: payload.fish_species_id,
        quantity: payload.quantity,
        length_cm: payload.length_cm,
        weight_g: payload.weight_g,
        note: null,
        created_at: nowIso(),
        fish_species: { name: fishNameById(payload.fish_species_id) },
        pending_sync: true,
      });
    }

    saveOfflineCache();
  }

  async function saveNoCatchOnline(payload) {
    const p_trip_date = payload.p_trip_date;
    const p_water_body_id = payload.p_water_body_id;
    if (!p_trip_date || !p_water_body_id) throw new Error("Bitte Datum und Gewässer wählen.");

    try {
      return await sb("/rest/v1/rpc/catch_trip_quick_no_catch", {
        method: "POST",
        body: JSON.stringify({ p_trip_date, p_water_body_id, p_note: payload.p_note || null }),
      }, true);
    } catch {
      return sb("/rest/v1/rpc/rpc_quick_no_catch", {
        method: "POST",
        body: JSON.stringify({ trip_date: p_trip_date, water_id: p_water_body_id }),
      }, true);
    }
  }

  async function saveCatchOnline(payload) {
    validateCatchPayload(payload);
    const user_id = payload.user_id;
    const trip_date = payload.trip_date;
    const water_body_id = payload.water_body_id;
    if (!user_id || !trip_date || !water_body_id) throw new Error("Bitte Datum und Gewässer wählen.");

    const tripPayload = await sb("/rest/v1/fishing_trips", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ user_id, trip_date, water_body_id, entry_type: "catch" }),
    }, true);

    const tripRow = parseReturnRow(tripPayload);
    const fish_species_id = payload.fish_species_id;

    if (fish_species_id) {
      const quantity = payload.quantity;
      const length_cm = payload.length_cm;
      const weight_g = payload.weight_g;

      if (!Number.isFinite(quantity) || quantity < 1) throw new Error("Anzahl muss mindestens 1 sein.");
      if (length_cm !== null && (!Number.isFinite(length_cm) || length_cm < 0)) throw new Error("Länge ist ungültig.");
      if (weight_g !== null && (!Number.isFinite(weight_g) || weight_g < 0)) throw new Error("Gewicht ist ungültig.");

      await sb("/rest/v1/catch_entries", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          fishing_trip_id: tripRow?.id || null,
          user_id,
          water_body_id,
          fish_species_id,
          caught_on: trip_date,
          quantity,
          length_cm,
          weight_g,
        }),
      }, true);
    }

    if (payload.photo_data_url && tripRow?.id) {
      await sb(`/rest/v1/fishing_trips?id=eq.${encodeURIComponent(tripRow.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          photo_data_url: payload.photo_data_url,
          photo_updated_at: new Date().toISOString(),
        }),
      }, true);
    }
  }

  async function queueNoCatchOffline(payload) {
    const entry = enqueue({ type: "create_no_catch", payload });
    addLocalNoCatch(payload, entry.id);
    renderTripsTable();
    await loadOwnStats();
    updatePendingHint();
  }

  async function queueCatchOffline(payload) {
    const entry = enqueue({ type: "create_catch", payload });
    addLocalCatch(payload, entry.id);
    renderTripsTable();
    await loadOwnStats();
    updatePendingHint();
  }

  async function processQueueItem(item) {
    if (!item?.type) return { ok: true };
    try {
      if (item.type === "create_no_catch") {
        await saveNoCatchOnline(item.payload || {});
        return { ok: true };
      }
      if (item.type === "create_catch") {
        await saveCatchOnline(item.payload || {});
        return { ok: true };
      }
      return { ok: true };
    } catch (err) {
      if (isNetworkError(err)) return { ok: false, retry: true, err };
      if (isConflictError(err)) return { ok: false, conflict: true, err };
      return { ok: false, retry: true, err };
    }
  }

  async function syncPendingQueue() {
    if (syncInProgress) return;
    if (!navigator.onLine) return;
    if (!uid()) return;
    if (!session()?.access_token) {
      const refreshed = await window.VDAN_AUTH?.refreshSession?.().catch(() => null);
      if (refreshed?.access_token) {
        // refreshed successfully; continue with sync
      } else {
        if (loadQueue().length > 0) {
          setMsg("Offline-Einträge gespeichert. Für Synchronisierung bitte erneut einloggen.");
        }
        updatePendingHint();
        return;
      }
    }

    const queue = loadQueue();
    if (!queue.length) return;

    syncInProgress = true;
    setMsg(`Synchronisiere ${queue.length} Offline-Eintrag${queue.length === 1 ? "" : "e"}...`);

    const remaining = [];
    for (let i = 0; i < queue.length; i += 1) {
      const item = queue[i];
      const result = await processQueueItem(item);
      if (result.ok) continue;

      if (result.conflict) {
        pushConflict(item, result.err);
        continue;
      }

      if (result.retry) {
        const retried = { ...item, attempts: Number(item.attempts || 0) + 1 };
        remaining.push(retried);
        const tail = queue.slice(i + 1);
        saveQueue([...remaining, ...tail]);
        syncInProgress = false;
        updatePendingHint();
        return;
      }
    }

    saveQueue(remaining);
    syncInProgress = false;
    await refreshAll();
    if (!remaining.length && conflictCount() === 0) setMsg("Offline-Einträge synchronisiert.");
    else updatePendingHint();
  }

  function applyPendingQueueToState() {
    const queue = loadQueue();
    if (!queue.length) return;
    queue.forEach((item) => {
      const p = item?.payload || {};
      if (item.type === "create_no_catch") {
        const localTripId = `local:queued:${item.id}`;
        const exists = trips.some((t) => String(t.id) === localTripId);
        if (exists) return;
        trips.unshift({
          id: localTripId,
          trip_date: p.p_trip_date,
          entry_type: "no_catch",
          note: p.p_note || null,
          created_at: item.created_at || nowIso(),
          water_body_id: p.p_water_body_id,
          water_bodies: { name: waterNameById(p.p_water_body_id) },
          photo_data_url: null,
          pending_sync: true,
        });
      } else if (item.type === "create_catch") {
        const localTripId = `local:queued:${item.id}`;
        const exists = trips.some((t) => String(t.id) === localTripId);
        if (exists) return;
        trips.unshift({
          id: localTripId,
          trip_date: p.trip_date,
          entry_type: "catch",
          note: null,
          created_at: item.created_at || nowIso(),
          water_body_id: p.water_body_id,
          water_bodies: { name: waterNameById(p.water_body_id) },
          photo_data_url: p.photo_data_url || null,
          pending_sync: true,
        });
        if (p.fish_species_id) {
          catches.unshift({
            id: `local:queued:catch:${item.id}`,
            fishing_trip_id: localTripId,
            caught_on: p.trip_date,
            water_body_id: p.water_body_id,
            fish_species_id: p.fish_species_id,
            quantity: p.quantity,
            length_cm: p.length_cm,
            weight_g: p.weight_g,
            note: null,
            created_at: item.created_at || nowIso(),
            fish_species: { name: fishNameById(p.fish_species_id) },
            pending_sync: true,
          });
        }
      }
    });
  }

  function applyConflictStackToState() {
    const conflicts = loadConflicts();
    if (!conflicts.length) return;
    conflicts.forEach((item) => {
      const p = item?.payload || {};
      const reason = String(item?.conflict_reason || "Konflikt");
      if (item.type === "create_no_catch") {
        const localTripId = `local:conflict:${item.id}`;
        const exists = trips.some((t) => String(t.id) === localTripId);
        if (exists) return;
        trips.unshift({
          id: localTripId,
          trip_date: p.p_trip_date,
          entry_type: "no_catch",
          note: p.p_note || null,
          created_at: item.created_at || nowIso(),
          water_body_id: p.p_water_body_id,
          water_bodies: { name: waterNameById(p.p_water_body_id) },
          photo_data_url: null,
          conflict_sync: true,
          conflict_reason: reason,
        });
      } else if (item.type === "create_catch") {
        const localTripId = `local:conflict:${item.id}`;
        const exists = trips.some((t) => String(t.id) === localTripId);
        if (exists) return;
        trips.unshift({
          id: localTripId,
          trip_date: p.trip_date,
          entry_type: "catch",
          note: null,
          created_at: item.created_at || nowIso(),
          water_body_id: p.water_body_id,
          water_bodies: { name: waterNameById(p.water_body_id) },
          photo_data_url: p.photo_data_url || null,
          conflict_sync: true,
          conflict_reason: reason,
        });
        if (p.fish_species_id) {
          catches.unshift({
            id: `local:conflict:catch:${item.id}`,
            fishing_trip_id: localTripId,
            caught_on: p.trip_date,
            water_body_id: p.water_body_id,
            fish_species_id: p.fish_species_id,
            quantity: p.quantity,
            length_cm: p.length_cm,
            weight_g: p.weight_g,
            note: null,
            created_at: item.created_at || nowIso(),
            fish_species: { name: fishNameById(p.fish_species_id) },
            conflict_sync: true,
          });
        }
      }
    });
  }

  async function loadTripsAndCatches() {
    const user_id = uid();
    if (!user_id) return;

    try {
      const [tripRows, catchRows] = await Promise.all([
        sb(
          `/rest/v1/fishing_trips?select=id,trip_date,entry_type,note,created_at,water_body_id,photo_data_url,photo_updated_at,water_bodies(name)&user_id=eq.${encodeURIComponent(user_id)}&order=trip_date.desc,created_at.desc&limit=500`,
          { method: "GET" },
          true
        ),
        sb(
          `/rest/v1/catch_entries?select=id,fishing_trip_id,caught_on,water_body_id,fish_species_id,quantity,length_cm,weight_g,note,created_at,fish_species(name)&user_id=eq.${encodeURIComponent(user_id)}&order=caught_on.desc,created_at.desc&limit=1000`,
          { method: "GET" },
          true
        ).catch(() => []),
      ]);

      trips = Array.isArray(tripRows) ? tripRows : [];
      catches = Array.isArray(catchRows) ? catchRows : [];
      saveOfflineCache();
    } catch (err) {
      if (!trips.length) loadOfflineCache();
      if (!trips.length && !catches.length) throw err;
    }

    applyPendingQueueToState();
    applyConflictStackToState();
  }

  function renderTripsTable() {
    const root = document.getElementById("tripList");
    if (!root) return;

    const onlyNoCatch = Boolean(document.getElementById("tripOnlyNoCatch")?.checked);
    const rows = onlyNoCatch ? trips.filter((r) => r.entry_type === "no_catch") : trips;

    if (!rows.length) {
      root.innerHTML = `<p class="small">Noch keine Angeltage vorhanden.</p>`;
      return;
    }

    root.innerHTML = `
      <div class="fangliste-table" role="table" aria-label="Meine Angeltage">
        <div class="fangliste-table__head" role="row">
          <span>Tag</span>
          <span>Gewässer</span>
          <span>Fang</span>
        </div>
        ${rows.map((trip) => {
          const list = catchesForTrip(trip);
          const summary = catchSummaryForTrip(trip, list);
          const hasPhoto = Boolean(trip.photo_data_url);
          const pending = Boolean(trip.pending_sync);
          const conflict = Boolean(trip.conflict_sync);
          const statePrefix = conflict ? "⚠ " : (pending ? "⏳ " : "");
          return `
            <button type="button" class="fangliste-table__row" data-trip-id="${trip.id}" role="row">
              <span class="fangliste-table__date">${esc(fmtDate(trip.trip_date))}</span>
              <span class="fangliste-table__water">${esc(trip?.water_bodies?.name || "-")}</span>
              <span class="fangliste-table__catch">${statePrefix}${esc(summary)}${hasPhoto ? " • Bild" : ""}</span>
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  async function loadOwnStats() {
    const root = document.getElementById("tripStatsBox");
    if (!root) return;

    try {
      const user_id = uid();
      if (!user_id) {
        root.innerHTML = "";
        return;
      }

      const tripsTotal = trips.length;
      const noCatchDays = trips.filter((r) => r.entry_type === "no_catch").length;
      const catchesTotal = catches.reduce((sum, r) => sum + Number(r.quantity || 0), 0);

      const lastTripAt = trips[0]?.created_at || null;
      const lastCatchAt = catches[0]?.created_at || null;
      const lastEntryAt = [lastTripAt, lastCatchAt].filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;

      root.innerHTML = `
        <article class="fangliste-item">
          <div class="fangliste-item__body">
            <strong>Angeltage: ${tripsTotal}</strong>
            <p class="small">Kein Fang: ${noCatchDays}</p>
            <p class="small">Fänge gesamt: ${catchesTotal}</p>
            <p class="small">Letzter Eintrag: ${esc(fmtTs(lastEntryAt))}</p>
          </div>
        </article>
      `;
    } catch (err) {
      setStatsMsg(err?.message || "Stats konnten nicht geladen werden.");
      root.innerHTML = "";
    }
  }

  function setCreateMode(mode) {
    createMode = mode === "no_catch" ? "no_catch" : "catch";
    const isNoCatch = createMode === "no_catch";
    const title = document.getElementById("tripCreateTitle");
    const submit = document.getElementById("tripCreateSubmit");
    if (title) title.textContent = isNoCatch ? "Kein Fang erfassen" : "Eintrag erfassen";
    if (submit) submit.textContent = isNoCatch ? "Kein Fang speichern" : "Speichern";
    document.querySelectorAll(".fangliste-catch-only").forEach((el) => {
      el.classList.toggle("hidden", isNoCatch);
      el.toggleAttribute("hidden", isNoCatch);
    });
  }

  function openCreateDialog(mode = "catch") {
    const dlg = document.getElementById("tripCreateDialog");
    const form = document.getElementById("tripCreateForm");
    if (!dlg || !form) return;
    setCreateMode(mode);
    form.reset();
    const d = document.getElementById("tripDate");
    if (d) d.value = todayIso();
    const qty = document.getElementById("tripQty");
    if (qty) qty.value = "1";
    setCreateMsg("");
    renderWaterOptions();
    renderFishSpeciesOptions();
    if (!dlg.open) dlg.showModal();
  }

  function closeCreateDialog() {
    const dlg = document.getElementById("tripCreateDialog");
    if (dlg?.open) dlg.close();
    setCreateMsg("");
  }

  function getTripById(id) {
    return trips.find((t) => String(t.id) === String(id)) || null;
  }

  function openDetailDialog(tripId) {
    const trip = getTripById(tripId);
    if (!trip) return;
    activeTripId = trip.id;

    const body = document.getElementById("tripDetailBody");
    const dlg = document.getElementById("tripDetailDialog");
    if (!body || !dlg) return;

    const list = catchesForTrip(trip);
    const img = String(trip.photo_data_url || "").trim();

    body.innerHTML = `
      <div class="grid cols2">
        <label>
          <span>Datum</span>
          <input id="tripDetailDate" type="date" value="${esc(trip.trip_date || "")}" />
        </label>
        <label>
          <span>Gewässer</span>
          <select id="tripDetailWater">${waterOptionsHtml(trip.water_body_id)}</select>
        </label>
        <label>
          <span>Typ</span>
          <select id="tripDetailType">
            <option value="catch" ${trip.entry_type === "catch" ? "selected" : ""}>Fang</option>
            <option value="no_catch" ${trip.entry_type === "no_catch" ? "selected" : ""}>Kein Fang</option>
          </select>
        </label>
        <p><strong>Angelegt:</strong><br>${esc(fmtTs(trip.created_at))}</p>
      </div>
      <label>
        <span>Notiz (optional)</span>
        <textarea id="tripDetailNote" rows="3">${esc(trip.note || "")}</textarea>
      </label>
      <hr />
      <h4>Fangdetails</h4>
      ${list.length ? `
        <div class="fangliste-detail-list">
          ${list.map((c) => `
            <div class="grid cols2" data-catch-edit-row data-catch-id="${c.id}">
              <label>
                <span>Fischart</span>
                <select data-field="fish_species_id">${fishSpeciesOptionsHtml(c.fish_species_id)}</select>
              </label>
              <label>
                <span>Anzahl</span>
                <input data-field="quantity" type="number" min="1" step="1" value="${Number(c.quantity || 1)}" />
              </label>
              <label>
                <span>Länge (cm)</span>
                <input data-field="length_cm" type="number" min="0" step="0.1" value="${c.length_cm ?? ""}" />
              </label>
              <label>
                <span>Gewicht (g)</span>
                <input data-field="weight_g" type="number" min="0" step="1" value="${c.weight_g ?? ""}" />
              </label>
              <label class="fangliste-full">
                <span>Notiz</span>
                <input data-field="note" type="text" value="${esc(c.note || "")}" />
              </label>
            </div>
          `).join("")}
        </div>
      ` : `<p class="small">Keine Fangdetails vorhanden.</p>`}
      <hr />
      <label>
        <span>Bild (optional)</span>
        <input id="tripDetailPhoto" type="file" accept="image/*" />
        <span class="small">Wird mit "Änderungen speichern" übernommen.</span>
      </label>
      <div class="catch-dialog-photo-wrap">
        ${img ? `<img src="${img}" alt="Fangbild" class="catch-dialog-photo" />` : `<p class="small">Kein Bild hinterlegt.</p>`}
      </div>
    `;

    if (isLocalId(trip.id) && trip.conflict_sync) {
      setDetailMsg(`Konflikt bei Sync: ${trip.conflict_reason || "Bitte später neu erfassen."}`);
    } else if (isLocalId(trip.id)) {
      setDetailMsg("Dieser Eintrag wird noch synchronisiert. Änderungen danach möglich.");
    } else {
      setDetailMsg("");
    }
    if (!dlg.open) dlg.showModal();
  }

  function closeDetailDialog() {
    const dlg = document.getElementById("tripDetailDialog");
    if (dlg?.open) dlg.close();
    activeTripId = null;
    setDetailMsg("");
  }

  async function saveDetailImageIfSelected() {
    if (!activeTripId) return false;
    if (isLocalId(activeTripId)) throw new Error("Bitte erst Synchronisierung abwarten.");
    const file = document.getElementById("tripDetailPhoto")?.files?.[0];
    if (!file) return false;
    setDetailMsg("Bild wird komprimiert...");
    const photo = await compressImageToWebp(file);
    await sb(`/rest/v1/fishing_trips?id=eq.${encodeURIComponent(activeTripId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        photo_data_url: photo.data_url,
        photo_updated_at: new Date().toISOString(),
      }),
    }, true);
    return true;
  }

  async function saveDetailChanges() {
    if (!activeTripId) return;
    if (isLocalId(activeTripId)) throw new Error("Bitte erst Synchronisierung abwarten.");
    const trip = getTripById(activeTripId);
    if (!trip) throw new Error("Eintrag nicht gefunden.");

    const trip_date = String(document.getElementById("tripDetailDate")?.value || "").trim();
    const water_body_id = String(document.getElementById("tripDetailWater")?.value || "").trim();
    const entry_type = String(document.getElementById("tripDetailType")?.value || "catch").trim();
    const note = String(document.getElementById("tripDetailNote")?.value || "").trim();

    if (!trip_date || !water_body_id) throw new Error("Datum und Gewässer sind Pflicht.");
    if (!["catch", "no_catch"].includes(entry_type)) throw new Error("Ungültiger Typ.");

    await sb(`/rest/v1/fishing_trips?id=eq.${encodeURIComponent(activeTripId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        trip_date,
        water_body_id,
        entry_type,
        note: note || null,
      }),
    }, true);

    const rows = [...document.querySelectorAll("[data-catch-edit-row][data-catch-id]")];
    for (const row of rows) {
      const catchId = String(row.getAttribute("data-catch-id") || "").trim();
      if (!catchId) continue;

      const fish_species_id = String(row.querySelector('[data-field="fish_species_id"]')?.value || "").trim();
      const quantityRaw = String(row.querySelector('[data-field="quantity"]')?.value || "").trim();
      const lengthRaw = String(row.querySelector('[data-field="length_cm"]')?.value || "").trim();
      const weightRaw = String(row.querySelector('[data-field="weight_g"]')?.value || "").trim();
      const catchNote = String(row.querySelector('[data-field="note"]')?.value || "").trim();

      const quantity = Number(quantityRaw || "0");
      const length_cm = lengthRaw ? Number(lengthRaw) : null;
      const weight_g = weightRaw ? Number(weightRaw) : null;

      if (!fish_species_id) throw new Error("Fischart darf bei Fangdetails nicht leer sein.");
      if (!Number.isFinite(quantity) || quantity < 1) throw new Error("Anzahl in Fangdetails ist ungültig.");
      if (length_cm !== null && (!Number.isFinite(length_cm) || length_cm < 0)) throw new Error("Länge in Fangdetails ist ungültig.");
      if (weight_g !== null && (!Number.isFinite(weight_g) || weight_g < 0)) throw new Error("Gewicht in Fangdetails ist ungültig.");

      await sb(`/rest/v1/catch_entries?id=eq.${encodeURIComponent(catchId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          fishing_trip_id: activeTripId,
          caught_on: trip_date,
          water_body_id,
          fish_species_id,
          quantity,
          length_cm,
          weight_g,
          note: catchNote || null,
        }),
      }, true);
    }
  }

  async function refreshAll() {
    await loadTripsAndCatches();
    renderTripsTable();
    await loadOwnStats();
    saveOfflineCache();
  }

  async function init() {
    const { url, key } = cfg();
    if (!url || !key) {
      setMsg("Supabase-Konfiguration fehlt.");
      return;
    }
    if (!uid()) {
      setMsg("Bitte einloggen.");
      return;
    }

    await hydratePersistentState();
    loadOfflineCache();
    renderWaterOptions();
    renderFishSpeciesOptions();
    renderTripsTable();
    await loadOwnStats();

    clearLegacyLocalCatchDataOnce();
    await touchUserUsage().catch(() => {});
    await Promise.all([loadWaters(), loadFishSpecies()]);
    await refreshAll().catch(() => {});
    await syncPendingQueue().catch(() => {});
    updatePendingHint();

    document.getElementById("tripOnlyNoCatch")?.addEventListener("change", renderTripsTable);

    document.getElementById("tripOpenCreate")?.addEventListener("click", openCreateDialog);
    document.getElementById("tripCreateClose")?.addEventListener("click", closeCreateDialog);
    document.getElementById("tripDetailClose")?.addEventListener("click", closeDetailDialog);
    document.getElementById("tripDetailSaveChanges")?.addEventListener("click", async () => {
      try {
        setDetailMsg("Speichere Änderungen...");
        await saveDetailChanges();
        const imageUpdated = await saveDetailImageIfSelected();
        await refreshAll();
        openDetailDialog(activeTripId);
        setDetailMsg(imageUpdated ? "Änderungen und Bild gespeichert." : "Änderungen gespeichert.");
      } catch (err) {
        setDetailMsg(err?.message || "Änderungen konnten nicht gespeichert werden.");
      }
    });

    document.getElementById("tripWaterSearch")?.addEventListener("input", renderWaterOptions);

    document.getElementById("tripQuickNoCatch")?.addEventListener("click", () => openCreateDialog("no_catch"));

    document.getElementById("tripCreateForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        setCreateMsg("Speichere...");
        let queued = false;
        if (createMode === "no_catch") {
          const payload = selectedNoCatchPayload();
          try {
            await saveNoCatchOnline(payload);
          } catch (err) {
            if (!navigator.onLine || isNetworkError(err)) {
              await queueNoCatchOffline(payload);
              queued = true;
            } else {
              throw err;
            }
          }
        } else {
          const file = document.getElementById("tripCreatePhoto")?.files?.[0];
          let photoDataUrl = null;
          if (file) {
            setCreateMsg("Bild wird komprimiert...");
            const photo = await compressImageToWebp(file);
            photoDataUrl = photo.data_url;
          }

          const payload = selectedCatchPayload(photoDataUrl);
          try {
            await saveCatchOnline(payload);
          } catch (err) {
            if (!navigator.onLine || isNetworkError(err)) {
              await queueCatchOffline(payload);
              queued = true;
            } else {
              throw err;
            }
          }
        }
        closeCreateDialog();
        if (!queued) {
          await refreshAll();
          setMsg(createMode === "no_catch" ? "Kein Fang gespeichert." : "Angeltag gespeichert.");
          await syncPendingQueue().catch(() => {});
        } else {
          setMsg(createMode === "no_catch"
            ? "Kein Fang offline gespeichert. Wird bei Empfang übertragen."
            : "Angeltag offline gespeichert. Wird bei Empfang übertragen.");
        }
      } catch (err) {
        setCreateMsg(err?.message || "Speichern fehlgeschlagen.");
      }
    });

    document.getElementById("tripList")?.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("[data-trip-id]");
      if (!btn) return;
      const id = btn.getAttribute("data-trip-id");
      if (id) openDetailDialog(id);
    });

    window.addEventListener("online", () => {
      syncPendingQueue().catch(() => {});
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => setMsg(err?.message || "Initialisierung fehlgeschlagen."));
  });
})();
