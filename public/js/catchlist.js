;(() => {
  const MAX_IMAGE_BYTES = 350 * 1024;
  const MAX_LONG_EDGE = 1280;
  const MIN_LONG_EDGE = 320;
  const OFFLINE_SCHEMA_VERSION = 1;
  const VIEW_KEY = "app:viewMode:fangliste:v1";
  const TABLE_KEY_PREFIX = "app:viewSettings:fangliste:user:v1";
  const WATER_FAVORITES_KEY_PREFIX = "app:waterFavorites:fangliste:user:v1";
  const TRIP_COLUMNS_DEFAULT = [
    { key: "trip_date", label: "Tag", visible: true },
    { key: "water", label: "Gewässer", visible: true },
    { key: "summary", label: "Fang", visible: true },
    { key: "status", label: "Status", visible: false },
  ];

  let waters = [];
  let fishSpecies = [];
  let trips = [];
  let catches = [];
  let activeTripId = null;
  let createMode = "catch";
  let currentView = "zeile";
  let tripSearch = "";
  let tripSort = { key: "trip_date", dir: "desc" };
  let tripFilters = {
    trip_date: "",
    water: "",
    summary: "",
  };
  let tripStatusFilters = new Set();
  let didAutoRecoverEmptyView = false;
  let syncInProgress = false;
  let queueMem = [];
  let conflictsMem = [];
  let cacheMem = null;
  let favoriteWaterIds = [];
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

  function shouldDisableTouchRpc(err) {
    const status = Number(err?.status || 0);
    if (status === 400 || status === 401 || status === 403 || status === 404) return true;
    const msg = String(err?.message || "").toLowerCase();
    return msg.includes("bad request") || msg.includes("(400)") || msg.includes("(401)") || msg.includes("(403)") || msg.includes("(404)");
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

  function waterFavoritesKey() {
    return `${WATER_FAVORITES_KEY_PREFIX}:${uid() || "anon"}`;
  }

  function normalizeFavoriteWaterIds(input) {
    const allowed = new Set((Array.isArray(waters) ? waters : []).map((w) => String(w.id || "")));
    const items = Array.isArray(input) ? input : [];
    const out = [];
    items.forEach((idRaw) => {
      const id = String(idRaw || "").trim();
      if (!id || !allowed.has(id) || out.includes(id)) return;
      out.push(id);
    });
    return out.slice(0, 10);
  }

  function loadWaterFavorites() {
    const stored = readJsonSafe(waterFavoritesKey(), []);
    favoriteWaterIds = Array.isArray(stored) ? stored.map((x) => String(x || "").trim()).filter(Boolean) : [];
  }

  function saveWaterFavorites() {
    writeJsonSafe(waterFavoritesKey(), favoriteWaterIds);
  }

  function syncWaterFavoriteToggle() {
    const btn = document.getElementById("tripWaterFavoriteToggle");
    if (!btn) return;
    const selected = selectedWaterId();
    if (!selected) {
      btn.disabled = true;
      btn.textContent = "Als Favorit merken";
      return;
    }
    btn.disabled = false;
    const isFav = favoriteWaterIds.includes(selected);
    btn.textContent = isFav ? "Favorit entfernen" : "Als Favorit merken";
  }

  function renderWaterFavoriteChips() {
    const root = document.getElementById("tripWaterFavorites");
    if (!root) return;
    const chips = favoriteWaterIds
      .map((id) => {
        const w = waters.find((x) => String(x.id) === id);
        if (!w) return null;
        return `<button type="button" class="fangliste-water-chip" data-water-fav-id="${id}" title="${esc(w.name)}">${esc(w.name)}</button>`;
      })
      .filter(Boolean);
    root.innerHTML = chips.join("");
  }

  function selectWaterByFavorite(idRaw) {
    const id = String(idRaw || "").trim();
    if (!id) return;
    const search = document.getElementById("tripWaterSearch");
    if (search) search.value = "";
    renderWaterOptions();
    const sel = document.getElementById("tripWater");
    if (sel) sel.value = id;
    syncWaterFavoriteToggle();
  }

  function toggleSelectedWaterFavorite() {
    const selected = selectedWaterId();
    if (!selected) return;
    const idx = favoriteWaterIds.indexOf(selected);
    if (idx >= 0) favoriteWaterIds.splice(idx, 1);
    else favoriteWaterIds.push(selected);
    favoriteWaterIds = normalizeFavoriteWaterIds(favoriteWaterIds);
    saveWaterFavorites();
    renderWaterFavoriteChips();
    syncWaterFavoriteToggle();
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

  function loadViewMode() {
    try {
      const v = String(localStorage.getItem(VIEW_KEY) || "zeile").toLowerCase();
      return v === "karte" ? "karte" : "zeile";
    } catch {
      return "zeile";
    }
  }

  function saveViewMode(mode) {
    try {
      localStorage.setItem(VIEW_KEY, mode);
    } catch {
      // ignore
    }
  }

  function syncViewButtons() {
    const zeileBtn = document.getElementById("tripViewZeileBtn");
    const karteBtn = document.getElementById("tripViewKarteBtn");
    if (!zeileBtn || !karteBtn) return;
    const cardActive = currentView === "karte";
    zeileBtn.classList.toggle("feed-btn--ghost", cardActive);
    karteBtn.classList.toggle("feed-btn--ghost", !cardActive);
  }

  function tableKey() {
    return `${TABLE_KEY_PREFIX}:${uid() || "anon"}`;
  }

  function loadTablePrefs() {
    try {
      const raw = JSON.parse(localStorage.getItem(tableKey()) || "{}") || {};
      const sortKey = String(raw.sortKey || "trip_date");
      const sortDir = String(raw.sortDir || "desc") === "asc" ? "asc" : "desc";
      if (TRIP_COLUMNS_DEFAULT.some((c) => c.key === sortKey)) tripSort.key = sortKey;
      tripSort.dir = sortDir;
      const f = raw.filter && typeof raw.filter === "object" ? raw.filter : {};
      tripFilters = {
        trip_date: String(f.trip_date || ""),
        water: String(f.water || ""),
        summary: String(f.summary || ""),
      };
      const statuses = Array.isArray(raw.statusFilter) ? raw.statusFilter : [];
      tripStatusFilters = new Set(statuses.map((s) => normalizeStatusKey(s)).filter(Boolean));
      tripSearch = String(raw.search || "");
    } catch {
      tripStatusFilters = new Set();
    }
  }

  function saveTablePrefs() {
    try {
      const payload = {
        sortKey: tripSort.key,
        sortDir: tripSort.dir,
        filter: tripFilters,
        statusFilter: [...tripStatusFilters],
        search: tripSearch,
      };
      localStorage.setItem(tableKey(), JSON.stringify(payload));
    } catch {
      // ignore
    }
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
      const e = new Error(err?.message || err?.detail || err?.hint || err?.error_description || `Request failed (${res.status})`);
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

  function tripStatusText(trip) {
    if (trip.conflict_sync) return "Kritisch";
    if (trip.pending_sync) return "Prüfen";
    return "Aktiv";
  }

  function tripDisplayRow(trip) {
    const list = catchesForTrip(trip);
    const summary = catchSummaryForTrip(trip, list);
    const hasPhoto = Boolean(trip.photo_data_url);
    const pending = Boolean(trip.pending_sync);
    const conflict = Boolean(trip.conflict_sync);
    const statePrefix = conflict ? "⚠ " : (pending ? "⏳ " : "");
    return {
      id: trip.id,
      trip,
      trip_date: String(trip.trip_date || ""),
      trip_date_label: fmtDate(trip.trip_date),
      water: String(trip?.water_bodies?.name || "-"),
      summary: `${statePrefix}${summary}${hasPhoto ? " • Bild" : ""}`,
      status: tripStatusText(trip),
    };
  }

  function tripValue(r, key) {
    if (key === "trip_date") return String(r.trip_date || "");
    if (key === "water") return String(r.water || "");
    if (key === "summary") return String(r.summary || "");
    if (key === "status") return String(r.status || "");
    return "";
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
    let longEdge = Math.max(bitmap.width, bitmap.height);
    let scale = Math.min(1, MAX_LONG_EDGE / longEdge);
    let width = Math.max(1, Math.round(bitmap.width * scale));
    let height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Bildverarbeitung fehlgeschlagen");

    let bestBlob = null;
    let bestMime = "image/webp";
    async function encodeAtCurrentSize() {
      const mimes = ["image/webp", "image/jpeg"];
      let localBest = null;
      let localBestMime = "image/webp";
      for (const mime of mimes) {
        let q = 0.9;
        let blob = await new Promise((res) => canvas.toBlob(res, mime, q));
        while (blob && blob.size > MAX_IMAGE_BYTES && q > 0.22) {
          q -= 0.08;
          blob = await new Promise((res) => canvas.toBlob(res, mime, q));
        }
        if (blob && (!localBest || blob.size < localBest.size)) {
          localBest = blob;
          localBestMime = mime;
        }
        if (blob && blob.size <= MAX_IMAGE_BYTES) {
          return { blob, mime };
        }
      }
      return { blob: localBest, mime: localBestMime };
    }

    while (true) {
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);

      const { blob, mime } = await encodeAtCurrentSize();
      if (blob && (!bestBlob || blob.size < bestBlob.size)) {
        bestBlob = blob;
        bestMime = mime;
      }
      if (blob && blob.size <= MAX_IMAGE_BYTES) {
        return {
          data_url: await blobToDataUrl(blob),
          bytes: blob.size,
          width,
          height,
          mime,
          updated_at: new Date().toISOString(),
        };
      }

      longEdge = Math.max(width, height);
      if (longEdge <= MIN_LONG_EDGE) break;
      const nextLongEdge = Math.max(MIN_LONG_EDGE, Math.floor(longEdge * 0.82));
      const downscale = nextLongEdge / longEdge;
      width = Math.max(1, Math.round(width * downscale));
      height = Math.max(1, Math.round(height * downscale));
    }

    if (!bestBlob) throw new Error("Bildverarbeitung fehlgeschlagen");
    if (bestBlob.size > MAX_IMAGE_BYTES) {
      throw new Error("Bild ist zu groß. Bitte enger zuschneiden.");
    }
    return {
      data_url: await blobToDataUrl(bestBlob),
      bytes: bestBlob.size,
      width,
      height,
      mime: bestMime,
      updated_at: new Date().toISOString(),
    };
  }

  function queueIdFromLocalTripId(tripId) {
    const raw = String(tripId || "");
    if (!raw.startsWith("local:queued:")) return null;
    return raw.slice("local:queued:".length) || null;
  }

  function removeLocalQueuedByTripId(tripId) {
    const qid = queueIdFromLocalTripId(tripId);
    trips = trips.filter((t) => String(t.id) !== String(tripId));
    catches = catches.filter((c) => String(c.fishing_trip_id) !== String(tripId));
    if (qid) {
      const q = loadQueue().filter((item) => String(item.id) !== qid);
      saveQueue(q);
    }
    saveOfflineCache();
    updatePendingHint();
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
      if (shouldDisableTouchRpc(err)) {
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
    favoriteWaterIds = normalizeFavoriteWaterIds(favoriteWaterIds);
    saveWaterFavorites();
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

    const selected = String(sel.value || "").trim();
    const filtered = waters.filter((w) => String(w.name || "").toLowerCase().includes(q));
    let html = `<option value="">Bitte wählen</option>` + filtered.map((w) => `<option value="${w.id}">${esc(w.name)}</option>`).join("");
    if (selected && !filtered.some((w) => String(w.id) === selected)) {
      const selectedWater = waters.find((w) => String(w.id) === selected);
      if (selectedWater) {
        html += `<option value="${selectedWater.id}">${esc(selectedWater.name)}</option>`;
      }
    }
    sel.innerHTML = html;
    if (selected) sel.value = selected;
    syncWaterFavoriteToggle();
    renderWaterFavoriteChips();
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
      body: JSON.stringify({
        user_id,
        trip_date,
        water_body_id,
        entry_type: "catch",
        water_source: "official",
        mapping_status: "mapped",
        water_name_raw: null,
      }),
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
          water_source: "official",
          mapping_status: "mapped",
          water_name_raw: null,
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
    renderTrips();
    await loadOwnStats();
    updatePendingHint();
  }

  async function queueCatchOffline(payload) {
    const entry = enqueue({ type: "create_catch", payload });
    addLocalCatch(payload, entry.id);
    renderTrips();
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
      let tripRows = [];
      let catchRows = [];
      try {
        [tripRows, catchRows] = await Promise.all([
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
      } catch {
        // Fallback for projects where relation embedding is unavailable/broken.
        [tripRows, catchRows] = await Promise.all([
          sb(
            `/rest/v1/fishing_trips?select=id,trip_date,entry_type,note,created_at,water_body_id,photo_data_url,photo_updated_at&user_id=eq.${encodeURIComponent(user_id)}&order=trip_date.desc,created_at.desc&limit=500`,
            { method: "GET" },
            true
          ),
          sb(
            `/rest/v1/catch_entries?select=id,fishing_trip_id,caught_on,water_body_id,fish_species_id,quantity,length_cm,weight_g,note,created_at&user_id=eq.${encodeURIComponent(user_id)}&order=caught_on.desc,created_at.desc&limit=1000`,
            { method: "GET" },
            true
          ).catch(() => []),
        ]);
      }

      trips = (Array.isArray(tripRows) ? tripRows : []).map((t) => {
        if (t?.water_bodies?.name || !t?.water_body_id) return t;
        return { ...t, water_bodies: { name: waterNameById(t.water_body_id) } };
      });
      catches = (Array.isArray(catchRows) ? catchRows : []).map((c) => {
        if (c?.fish_species?.name || !c?.fish_species_id) return c;
        return { ...c, fish_species: { name: fishNameById(c.fish_species_id) } };
      });
      saveOfflineCache();
    } catch (err) {
      if (!trips.length) loadOfflineCache();
      if (!trips.length && !catches.length) throw err;
    }

    applyPendingQueueToState();
    applyConflictStackToState();
  }

  function filteredTrips() {
    const onlyNoCatch = Boolean(document.getElementById("tripOnlyNoCatch")?.checked);
    return onlyNoCatch ? trips.filter((r) => r.entry_type === "no_catch") : trips;
  }

  function matchTripFilter(row, key, needle) {
    if (!needle) return true;
    const lowNeedle = String(needle).trim().toLowerCase();
    if (!lowNeedle) return true;
    if (key === "trip_date") {
      return (
        String(row.trip_date || "").toLowerCase().includes(lowNeedle)
        || String(row.trip_date_label || "").toLowerCase().includes(lowNeedle)
      );
    }
    return String(tripValue(row, key) || "").toLowerCase().includes(lowNeedle);
  }

  function filteredTripRows() {
    let rows = filteredTrips().map((trip) => tripDisplayRow(trip));
    const q = String(tripSearch || "").trim().toLowerCase();
    if (q) {
      rows = rows.filter((row) => (
        String(row.trip_date_label || "").toLowerCase().includes(q)
        || String(row.trip_date || "").toLowerCase().includes(q)
        || String(row.water || "").toLowerCase().includes(q)
        || String(row.summary || "").toLowerCase().includes(q)
        || String(row.status || "").toLowerCase().includes(q)
      ));
    }

    rows = rows.filter((row) => Object.entries(tripFilters).every(([key, value]) => matchTripFilter(row, key, value)));
    if (tripStatusFilters.size) {
      rows = rows.filter((row) => tripStatusFilters.has(normalizeStatusKey(row.status)));
    }

    const dir = tripSort.dir === "desc" ? -1 : 1;
    rows = rows.slice().sort((a, b) => {
      const av = String(tripValue(a, tripSort.key) || "").toLowerCase();
      const bv = String(tripValue(b, tripSort.key) || "").toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return rows;
  }

  function activeFilterCount() {
    let count = 0;
    if (String(tripSearch || "").trim()) count += 1;
    if (String(tripFilters.trip_date || "").trim()) count += 1;
    if (String(tripFilters.water || "").trim()) count += 1;
    if (String(tripFilters.summary || "").trim()) count += 1;
    if (tripStatusFilters.size) count += 1;
    if (Boolean(document.getElementById("tripOnlyNoCatch")?.checked)) count += 1;
    return count;
  }

  function syncFilterMeta() {
    const meta = document.getElementById("tripActiveFilterCount");
    if (!meta) return;
    const count = activeFilterCount();
    meta.textContent = `${count} Filter aktiv`;
    meta.classList.toggle("hidden", count === 0);
  }

  function normalizeStatusKey(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "pruefen") return "prüfen";
    return normalized;
  }

  function statusChipClass(status) {
    const normalized = normalizeStatusKey(status);
    if (normalized === "aktiv") return "ui-chip ui-chip--success";
    if (normalized === "prüfen" || normalized === "pruefen") return "ui-chip ui-chip--warning";
    if (normalized === "kritisch") return "ui-chip ui-chip--danger";
    return "ui-chip";
  }

  function sortIconFor(key) {
    if (tripSort.key !== key) return "↕";
    return tripSort.dir === "asc" ? "↑" : "↓";
  }

  function filterHasValue(key) {
    if (key === "status") return tripStatusFilters.size > 0;
    return Boolean(String(tripFilters[key] || "").trim());
  }

  function renderTripsTableView(rows) {
    return `
      <div class="fangliste-table-wrap">
        <table class="fangliste-table" aria-label="Meine Angeltage">
          <thead>
            <tr>
              <th>
                <span class="fangliste-th-label">Tag</span>
                <span class="fangliste-th-actions">
                  <button type="button" class="fangliste-th-icon ${tripSort.key === "trip_date" ? "is-active" : ""}" data-trip-sort-key="trip_date" aria-label="Tag sortieren">${sortIconFor("trip_date")}</button>
                  <button type="button" class="fangliste-th-icon ${filterHasValue("trip_date") ? "has-filter" : ""}" data-trip-filter-trigger="trip_date" aria-label="Tag filtern">⏷</button>
                </span>
                <div class="fangliste-col-filter" data-trip-col-filter-popover="trip_date">
                  <label>
                    <span>Enthält</span>
                    <input type="text" data-trip-col-filter="trip_date" value="${esc(tripFilters.trip_date)}" placeholder="z. B. 04.03.2026" />
                  </label>
                </div>
              </th>
              <th>
                <span class="fangliste-th-label">Gewässer</span>
                <span class="fangliste-th-actions">
                  <button type="button" class="fangliste-th-icon ${tripSort.key === "water" ? "is-active" : ""}" data-trip-sort-key="water" aria-label="Gewässer sortieren">${sortIconFor("water")}</button>
                  <button type="button" class="fangliste-th-icon ${filterHasValue("water") ? "has-filter" : ""}" data-trip-filter-trigger="water" aria-label="Gewässer filtern">⏷</button>
                </span>
                <div class="fangliste-col-filter" data-trip-col-filter-popover="water">
                  <label>
                    <span>Enthält</span>
                    <input type="text" data-trip-col-filter="water" value="${esc(tripFilters.water)}" placeholder="z. B. Mühlbach" />
                  </label>
                </div>
              </th>
              <th>
                <span class="fangliste-th-label">Fang</span>
                <span class="fangliste-th-actions">
                  <button type="button" class="fangliste-th-icon ${tripSort.key === "summary" ? "is-active" : ""}" data-trip-sort-key="summary" aria-label="Fang sortieren">${sortIconFor("summary")}</button>
                  <button type="button" class="fangliste-th-icon ${filterHasValue("summary") ? "has-filter" : ""}" data-trip-filter-trigger="summary" aria-label="Fang filtern">⏷</button>
                </span>
                <div class="fangliste-col-filter" data-trip-col-filter-popover="summary">
                  <label>
                    <span>Enthält</span>
                    <input type="text" data-trip-col-filter="summary" value="${esc(tripFilters.summary)}" placeholder="z. B. Karpfen" />
                  </label>
                </div>
              </th>
              <th>
                <span class="fangliste-th-label">Status</span>
                <span class="fangliste-th-actions">
                  <button type="button" class="fangliste-th-icon ${tripSort.key === "status" ? "is-active" : ""}" data-trip-sort-key="status" aria-label="Status sortieren">${sortIconFor("status")}</button>
                  <button type="button" class="fangliste-th-icon ${filterHasValue("status") ? "has-filter" : ""}" data-trip-filter-trigger="status" aria-label="Status filtern">⏷</button>
                </span>
                <div class="fangliste-col-filter fangliste-col-filter--status" data-trip-col-filter-popover="status">
                  <p>Status auswählen</p>
                  <label><input type="checkbox" value="aktiv" data-trip-status-option ${tripStatusFilters.has("aktiv") ? "checked" : ""} /> Aktiv</label>
                  <label><input type="checkbox" value="prüfen" data-trip-status-option ${tripStatusFilters.has("prüfen") ? "checked" : ""} /> Prüfen</label>
                  <label><input type="checkbox" value="kritisch" data-trip-status-option ${tripStatusFilters.has("kritisch") ? "checked" : ""} /> Kritisch</label>
                  <div class="fangliste-col-filter__actions">
                    <button type="button" class="feed-btn feed-btn--ghost" data-trip-status-clear>Clear</button>
                    <button type="button" class="feed-btn" data-trip-status-apply>Apply</button>
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr data-trip-id="${row.id}" tabindex="0">
                <td class="fangliste-table__cell fangliste-table__cell--trip_date">${esc(row.trip_date_label || "-")}</td>
                <td class="fangliste-table__cell">${esc(row.water || "-")}</td>
                <td class="fangliste-table__cell">${esc(row.summary || "-")}</td>
                <td class="fangliste-table__cell"><span class="${statusChipClass(row.status)}">${esc(row.status || "-")}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderTripsCardView(rows) {
    return `
      <div class="ui-karten-grid">
        ${rows.map((row) => {
          const trip = row.trip;
          return `
            <button type="button" class="ui-karte" data-trip-id="${row.id}">
              <div class="ui-karte__kopf">
                <h3 class="ui-karte__titel">${esc(row.trip_date_label)}</h3>
                <span class="ui-chip">${esc(row.water || "-")}</span>
              </div>
              <p class="small">${esc(row.summary || "-")}</p>
              <p class="small"><span class="${statusChipClass(row.status)}">${esc(row.status || "-")}</span></p>
              ${trip?.entry_type === "no_catch" ? `<span class="ui-chip">Kein Fang</span>` : ""}
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderTrips() {
    const root = document.getElementById("tripList");
    if (!root) return;
    const rows = filteredTripRows();

    // Recovery: if backend data exists but persisted filters hide everything,
    // reset once to avoid a "data is gone" impression.
    if (!rows.length && trips.length > 0 && !didAutoRecoverEmptyView) {
      didAutoRecoverEmptyView = true;
      tripSearch = "";
      tripFilters.trip_date = "";
      tripFilters.water = "";
      tripFilters.summary = "";
      tripStatusFilters = new Set();
      const noCatch = document.getElementById("tripOnlyNoCatch");
      if (noCatch) noCatch.checked = false;
      const search = document.getElementById("tripSearch");
      if (search) search.value = "";
      saveTablePrefs();
      const recoveredRows = filteredTripRows();
      if (recoveredRows.length) {
        root.innerHTML = currentView === "karte" ? renderTripsCardView(recoveredRows) : renderTripsTableView(recoveredRows);
        syncFilterMeta();
        setMsg("Filter wurden zurückgesetzt, um vorhandene Einträge anzuzeigen.");
        return;
      }
    }

    if (!rows.length) {
      root.innerHTML = `<p class="small">Noch keine Angeltage vorhanden.</p>`;
      syncFilterMeta();
      return;
    }

    root.innerHTML = currentView === "karte" ? renderTripsCardView(rows) : renderTripsTableView(rows);
    syncFilterMeta();
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

  function isNativeDialog(el) {
    return typeof HTMLDialogElement !== "undefined" && el instanceof HTMLDialogElement;
  }

  function openDialogOrPanel(el) {
    if (!el) return;
    if (isNativeDialog(el)) {
      if (!el.open) el.showModal();
      return;
    }
    el.removeAttribute("hidden");
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden", "false");
  }

  function closeDialogOrPanel(el) {
    if (!el) return;
    if (isNativeDialog(el)) {
      if (el.open) el.close();
      return;
    }
    el.setAttribute("hidden", "");
    el.classList.add("hidden");
    el.setAttribute("aria-hidden", "true");
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
    openDialogOrPanel(dlg);
    window.VDAN_DIALOG_GUARD?.restoreDraft?.(dlg);
  }

  async function closeCreateDialog(force = false) {
    const dlg = document.getElementById("tripCreateDialog");
    if (dlg && (isNativeDialog(dlg) ? dlg.open : !dlg.hasAttribute("hidden"))) {
      if (!force && window.VDAN_DIALOG_GUARD?.requestClose) {
        const closed = await window.VDAN_DIALOG_GUARD.requestClose(dlg);
        if (!closed) return;
      } else {
        closeDialogOrPanel(dlg);
      }
    }
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
              <div class="fangliste-full">
                <button type="button" class="feed-btn feed-btn--ghost" data-delete-catch-id="${c.id}">Fangeintrag löschen</button>
              </div>
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
    openDialogOrPanel(dlg);
    window.VDAN_DIALOG_GUARD?.restoreDraft?.(dlg);
  }

  async function closeDetailDialog(force = false) {
    const dlg = document.getElementById("tripDetailDialog");
    if (dlg && (isNativeDialog(dlg) ? dlg.open : !dlg.hasAttribute("hidden"))) {
      if (!force && window.VDAN_DIALOG_GUARD?.requestClose) {
        const closed = await window.VDAN_DIALOG_GUARD.requestClose(dlg);
        if (!closed) return;
      } else {
        closeDialogOrPanel(dlg);
      }
    }
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

  async function deleteTripEntry() {
    if (!activeTripId) return;
    if (isLocalId(activeTripId)) {
      removeLocalQueuedByTripId(activeTripId);
      await closeDetailDialog(true);
      renderTrips();
      await loadOwnStats().catch(() => {});
      setMsg("Lokaler Offline-Eintrag gelöscht.");
      return;
    }
    await sb(`/rest/v1/catch_entries?fishing_trip_id=eq.${encodeURIComponent(activeTripId)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }, true).catch(() => {});
    await sb(`/rest/v1/fishing_trips?id=eq.${encodeURIComponent(activeTripId)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }, true);
    await closeDetailDialog(true);
    await refreshAll();
    setMsg("Eintrag gelöscht.");
  }

  async function deleteCatchEntry(catchId) {
    if (!catchId || !activeTripId) return;
    if (isLocalId(catchId) || isLocalId(activeTripId)) {
      catches = catches.filter((c) => String(c.id) !== String(catchId));
      saveOfflineCache();
      openDetailDialog(activeTripId);
      setDetailMsg("Lokaler Fangeintrag gelöscht.");
      return;
    }
    await sb(`/rest/v1/catch_entries?id=eq.${encodeURIComponent(catchId)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }, true);
    await refreshAll();
    openDetailDialog(activeTripId);
    setDetailMsg("Fangeintrag gelöscht.");
  }

  async function refreshAll() {
    await loadTripsAndCatches();
    renderTrips();
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
    currentView = loadViewMode();
    loadTablePrefs();
    loadWaterFavorites();
    const searchEl = document.getElementById("tripSearch");
    if (searchEl) searchEl.value = tripSearch;
    syncViewButtons();
    loadOfflineCache();
    renderWaterOptions();
    renderFishSpeciesOptions();
    renderTrips();
    await loadOwnStats();

    clearLegacyLocalCatchDataOnce();
    await touchUserUsage().catch(() => {});
    await Promise.all([loadWaters(), loadFishSpecies()]);
    await refreshAll().catch(() => {});
    await syncPendingQueue().catch(() => {});
    updatePendingHint();

    document.getElementById("tripOnlyNoCatch")?.addEventListener("change", renderTrips);
    document.getElementById("tripSearch")?.addEventListener("input", (e) => {
      tripSearch = String(e.target?.value || "");
      saveTablePrefs();
      renderTrips();
    });
    document.getElementById("tripResetFiltersBtn")?.addEventListener("click", () => {
      tripSearch = "";
      tripFilters.trip_date = "";
      tripFilters.water = "";
      tripFilters.summary = "";
      tripStatusFilters = new Set();
      const search = document.getElementById("tripSearch");
      if (search) search.value = "";
      const noCatch = document.getElementById("tripOnlyNoCatch");
      if (noCatch) noCatch.checked = false;
      saveTablePrefs();
      renderTrips();
    });
    document.getElementById("tripViewZeileBtn")?.addEventListener("click", () => {
      currentView = "zeile";
      saveViewMode(currentView);
      syncViewButtons();
      renderTrips();
    });
    document.getElementById("tripViewKarteBtn")?.addEventListener("click", () => {
      currentView = "karte";
      saveViewMode(currentView);
      syncViewButtons();
      renderTrips();
    });

    document.getElementById("tripOpenCreate")?.addEventListener("click", openCreateDialog);
    document.getElementById("tripCreateClose")?.addEventListener("click", () => { void closeCreateDialog(false); });
    document.getElementById("tripDetailClose")?.addEventListener("click", () => { void closeDetailDialog(false); });
    document.getElementById("tripDeleteEntryBtn")?.addEventListener("click", async () => {
      const ok = window.confirm("Diesen Angeltag wirklich löschen?");
      if (!ok) return;
      try {
        setDetailMsg("Eintrag wird gelöscht...");
        await deleteTripEntry();
      } catch (err) {
        setDetailMsg(err?.message || "Löschen fehlgeschlagen.");
      }
    });
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
    document.getElementById("tripWater")?.addEventListener("change", syncWaterFavoriteToggle);
    document.getElementById("tripWaterFavoriteToggle")?.addEventListener("click", () => {
      toggleSelectedWaterFavorite();
    });
    document.getElementById("tripWaterFavorites")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-water-fav-id]");
      if (!btn) return;
      const waterId = String(btn.getAttribute("data-water-fav-id") || "").trim();
      if (!waterId) return;
      selectWaterByFavorite(waterId);
    });

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
        await closeCreateDialog(true);
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

    document.getElementById("tripDetailBody")?.addEventListener("click", async (e) => {
      const del = e.target?.closest?.("[data-delete-catch-id]");
      if (!del) return;
      const catchId = String(del.getAttribute("data-delete-catch-id") || "").trim();
      if (!catchId) return;
      const ok = window.confirm("Diesen Fangeintrag wirklich löschen?");
      if (!ok) return;
      try {
        setDetailMsg("Fangeintrag wird gelöscht...");
        await deleteCatchEntry(catchId);
      } catch (err) {
        setDetailMsg(err?.message || "Fangeintrag konnte nicht gelöscht werden.");
      }
    });

    document.addEventListener("input", (e) => {
      const filterKey = e.target?.getAttribute?.("data-trip-col-filter");
      if (!filterKey) return;
      if (!(filterKey in tripFilters)) return;
      tripFilters[filterKey] = String(e.target.value || "");
      saveTablePrefs();
      renderTrips();
    });

    document.addEventListener("click", (e) => {
      const trigger = e.target?.closest?.("[data-trip-filter-trigger]");
      if (trigger) {
        e.stopPropagation();
        const key = String(trigger.getAttribute("data-trip-filter-trigger") || "");
        const popovers = [...document.querySelectorAll("[data-trip-col-filter-popover]")];
        const isOpen = popovers.some((p) => p.classList.contains("open") && p.getAttribute("data-trip-col-filter-popover") === key);
        popovers.forEach((p) => p.classList.remove("open"));
        document.querySelectorAll("[data-trip-filter-trigger]").forEach((b) => b.classList.remove("is-active"));
        if (!isOpen) {
          const panel = document.querySelector(`[data-trip-col-filter-popover="${key}"]`);
          panel?.classList.add("open");
          trigger.classList.add("is-active");
        }
        return;
      }

      const statusApply = e.target?.closest?.("[data-trip-status-apply]");
      if (statusApply) {
        const checks = [...document.querySelectorAll("[data-trip-status-option]")];
        tripStatusFilters = new Set(
          checks
            .filter((c) => c.checked)
            .map((c) => normalizeStatusKey(c.value))
            .filter(Boolean)
        );
        saveTablePrefs();
        renderTrips();
        return;
      }

      const statusClear = e.target?.closest?.("[data-trip-status-clear]");
      if (statusClear) {
        tripStatusFilters = new Set();
        saveTablePrefs();
        renderTrips();
        return;
      }

      if (e.target?.closest?.("[data-trip-col-filter-popover]")) return;

      const sortBtn = e.target?.closest?.("[data-trip-sort-key]");
      if (sortBtn) {
        const key = String(sortBtn.getAttribute("data-trip-sort-key") || "");
        if (!key) return;
        if (tripSort.key === key) tripSort.dir = tripSort.dir === "asc" ? "desc" : "asc";
        else {
          tripSort.key = key;
          tripSort.dir = "asc";
        }
        saveTablePrefs();
        renderTrips();
        return;
      }

      document.querySelectorAll("[data-trip-col-filter-popover]").forEach((p) => p.classList.remove("open"));
      document.querySelectorAll("[data-trip-filter-trigger]").forEach((b) => b.classList.remove("is-active"));
    });

    document.getElementById("tripList")?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const row = e.target?.closest?.("[data-trip-id]");
      if (!row) return;
      e.preventDefault();
      const id = row.getAttribute("data-trip-id");
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
