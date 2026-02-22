;(() => {
  const MAX_IMAGE_BYTES = 350 * 1024;
  const MAX_LONG_EDGE = 1280;

  let waters = [];
  let fishSpecies = [];
  let trips = [];
  let catches = [];
  let activeTripId = null;
  let createMode = "catch";
  const LEGACY_CATCH_CLEAR_MARKER = "vdan_catch_cleanup_v1_done";
  const TOUCH_RPC_DISABLED_KEY = "vdan_rpc_touch_user_disabled_v1";

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
    return session()?.user?.id || null;
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
      throw new Error(err?.message || err?.hint || err?.error_description || `Request failed (${res.status})`);
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
    const rows = await sb("/rest/v1/water_bodies?select=id,name,area_kind,is_active&is_active=eq.true&order=name.asc", { method: "GET" }, true);
    waters = Array.isArray(rows) ? rows : [];
    renderWaterOptions();
  }

  async function loadFishSpecies() {
    const rows = await sb("/rest/v1/fish_species?select=id,name,is_active&is_active=eq.true&order=name.asc", { method: "GET" }, true);
    fishSpecies = Array.isArray(rows) ? rows : [];
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

  async function saveNoCatch() {
    const p_trip_date = selectedDate();
    const p_water_body_id = selectedWaterId();
    if (!p_trip_date || !p_water_body_id) throw new Error("Bitte Datum und Gewässer wählen.");

    try {
      return await sb("/rest/v1/rpc/catch_trip_quick_no_catch", {
        method: "POST",
        body: JSON.stringify({ p_trip_date, p_water_body_id, p_note: null }),
      }, true);
    } catch {
      return sb("/rest/v1/rpc/rpc_quick_no_catch", {
        method: "POST",
        body: JSON.stringify({ trip_date: p_trip_date, water_id: p_water_body_id }),
      }, true);
    }
  }

  async function saveCatchEntry() {
    const user_id = uid();
    const trip_date = selectedDate();
    const water_body_id = selectedWaterId();
    if (!user_id || !trip_date || !water_body_id) throw new Error("Bitte Datum und Gewässer wählen.");

    const tripPayload = await sb("/rest/v1/fishing_trips", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ user_id, trip_date, water_body_id, entry_type: "catch" }),
    }, true);

    const tripRow = parseReturnRow(tripPayload);
    const fish_species_id = selectedFishSpeciesId();

    if (fish_species_id) {
      const quantity = selectedQty();
      const length_cm = selectedLengthCm();
      const weight_g = selectedWeightG();

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

    const file = document.getElementById("tripCreatePhoto")?.files?.[0];
    if (file && tripRow?.id) {
      setCreateMsg("Bild wird komprimiert...");
      const photo = await compressImageToWebp(file);
      await sb(`/rest/v1/fishing_trips?id=eq.${encodeURIComponent(tripRow.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          photo_data_url: photo.data_url,
          photo_updated_at: new Date().toISOString(),
        }),
      }, true);
    }
  }

  async function loadTripsAndCatches() {
    const user_id = uid();
    if (!user_id) return;

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
          return `
            <button type="button" class="fangliste-table__row" data-trip-id="${trip.id}" role="row">
              <span class="fangliste-table__date">${esc(fmtDate(trip.trip_date))}</span>
              <span class="fangliste-table__water">${esc(trip?.water_bodies?.name || "-")}</span>
              <span class="fangliste-table__catch">${esc(summary)}${hasPhoto ? " • Bild" : ""}</span>
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

    setDetailMsg("");
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

    clearLegacyLocalCatchDataOnce();
    await touchUserUsage();
    await Promise.all([loadWaters(), loadFishSpecies()]);
    await refreshAll();

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
        if (createMode === "no_catch") {
          await saveNoCatch();
        } else {
          await saveCatchEntry();
        }
        closeCreateDialog();
        await refreshAll();
        setMsg(createMode === "no_catch" ? "Kein Fang gespeichert." : "Angeltag gespeichert.");
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
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => setMsg(err?.message || "Initialisierung fehlgeschlagen."));
  });
})();
