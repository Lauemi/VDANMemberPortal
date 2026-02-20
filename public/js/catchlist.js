;(() => {
  const STORE_KEY = "vdan_catch_ui_entries_v1";
  const KEY_VG = "vereins_gemeinschaftsgewaesser";
  const KEY_R39 = "rheinlos39";

  const MAX_IMAGE_BYTES = 350 * 1024;
  const MAX_LONG_EDGE = 1280;

  // UI-only master data preview. Angelweiher intentionally exists in both keys.
  const WATER_BODIES = [
    { id: "vgw-1", name: "Vogel-Baggersee", area_kind: KEY_VG },
    { id: "vgw-2", name: "Rhein", area_kind: KEY_VG },
    { id: "vgw-3", name: "Druckwasser-Kanal", area_kind: KEY_VG },
    { id: "vgw-4", name: "Schutterentlastungskanal", area_kind: KEY_VG },
    { id: "vgw-5", name: "Absatzbecken", area_kind: KEY_VG },
    { id: "vgw-6", name: "Angelweiher", area_kind: KEY_VG },
    { id: "vgw-7", name: "Altes Baggerloch", area_kind: KEY_VG },
    { id: "vgw-8", name: "Eisweiher", area_kind: KEY_VG },
    { id: "vgw-9", name: "Elzkanal", area_kind: KEY_VG },
    { id: "vgw-10", name: "Kehl", area_kind: KEY_VG },
    { id: "vgw-11", name: "Krottenloch", area_kind: KEY_VG },
    { id: "vgw-12", name: "Mühlbach", area_kind: KEY_VG },
    { id: "vgw-13", name: "Oberer und Unterer Holzplatz", area_kind: KEY_VG },
    { id: "vgw-14", name: "Sandkehl", area_kind: KEY_VG },
    { id: "vgw-15", name: "Unterer Bann", area_kind: KEY_VG },
    { id: "r39-angelweiher", name: "Angelweiher", area_kind: KEY_R39 },
  ];

  const FISH_SPECIES = [
    { id: "aal", name: "Aal" },
    { id: "barsch", name: "Barsch" },
    { id: "brasse", name: "Brasse" },
    { id: "hecht", name: "Hecht" },
    { id: "karpfen", name: "Karpfen" },
    { id: "rotauge", name: "Rotauge" },
    { id: "schleie", name: "Schleie" },
    { id: "wels", name: "Wels" },
    { id: "zander", name: "Zander" },
  ];

  const AREA_LABEL = {
    [KEY_VG]: "Vereins/Gemeinschaftsgewässer",
    [KEY_R39]: "Rheinlos 39",
  };

  const ACTIVE_AREA_KEYS = [KEY_VG, KEY_R39];

  let activeDialogEntryId = null;
  let dialogEditMode = false;
  let createDialog = null;

  function setMsg(text = "") {
    const el = document.getElementById("catchMsg");
    if (el) el.textContent = text;
  }

  function setDialogMsg(text = "") {
    const el = document.getElementById("catchDialogMsg");
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function areaLabel(kind) {
    return AREA_LABEL[kind] || kind;
  }

  function combinedAreaLabel(keys) {
    const sorted = [...new Set(keys)].sort();
    if (sorted.includes(KEY_VG) && sorted.includes(KEY_R39)) return "V/G + Rheinlos39";
    return sorted.map(areaLabel).join(" + ");
  }

  function normalizeName(name) {
    return String(name).trim().toLocaleLowerCase("de-DE");
  }

  function availableWaters() {
    const allowed = WATER_BODIES.filter((w) => ACTIVE_AREA_KEYS.includes(w.area_kind));
    const map = new Map();

    for (const w of allowed) {
      const key = normalizeName(w.name);
      const hit = map.get(key);
      if (!hit) {
        map.set(key, {
          id: w.id,
          name: w.name,
          area_kind: w.area_kind,
          area_keys: [w.area_kind],
        });
      } else {
        hit.area_keys.push(w.area_kind);
        if (w.area_kind === KEY_VG) {
          hit.id = w.id;
          hit.area_kind = KEY_VG;
        }
      }
    }

    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "de-DE"));
  }

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveEntries(rows) {
    localStorage.setItem(STORE_KEY, JSON.stringify(rows));
  }

  function loadSelects() {
    const waterSel = document.getElementById("catchWater");
    const speciesSel = document.getElementById("catchSpecies");
    if (!waterSel || !speciesSel) return;

    const rows = availableWaters();

    waterSel.innerHTML = `<option value="">Bitte wählen</option>` +
      rows.map((w) => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join("");

    speciesSel.innerHTML = `<option value="">Bitte wählen</option>` +
      FISH_SPECIES.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
  }

  function readPayload() {
    const caught_on = String(document.getElementById("catchDate")?.value || "").trim();
    const water_body_id = String(document.getElementById("catchWater")?.value || "").trim();
    const fish_species_id = String(document.getElementById("catchSpecies")?.value || "").trim();
    const quantity = Number(document.getElementById("catchQty")?.value || 0);
    const length_raw = String(document.getElementById("catchLen")?.value || "").trim();
    const weight_raw = String(document.getElementById("catchWeight")?.value || "").trim();
    const note = String(document.getElementById("catchNote")?.value || "").trim();

    if (!caught_on || !water_body_id || !fish_species_id || !Number.isFinite(quantity) || quantity < 1) {
      throw new Error("Bitte Datum, Gewässer, Fischart und Anzahl ausfüllen.");
    }

    const water = availableWaters().find((w) => w.id === water_body_id);
    const fish = FISH_SPECIES.find((f) => f.id === fish_species_id);

    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      caught_on,
      water_body_id,
      water_name: water?.name || "-",
      area_kind: water?.area_kind || "-",
      area_keys: water?.area_keys || [],
      fish_species_id,
      fish_name: fish?.name || "-",
      quantity,
      length_cm: length_raw ? Number(length_raw) : null,
      weight_g: weight_raw ? Number(weight_raw) : null,
      note: note || null,
      photo: null,
      created_at: new Date().toISOString(),
    };
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

    const dataUrl = await blobToDataUrl(blob);
    return {
      data_url: dataUrl,
      bytes: blob.size,
      width,
      height,
      mime: "image/webp",
      updated_at: new Date().toISOString(),
    };
  }

  function renderEntries(rows) {
    const root = document.getElementById("catchList");
    if (!root) return;
    root.innerHTML = "";

    if (!rows.length) {
      root.innerHTML = `<p class="small">Noch keine UI-Einträge vorhanden.</p>`;
      return;
    }

    const table = document.createElement("div");
    table.className = "catch-table";
    table.innerHTML = `
      <div class="catch-table__head" role="row">
        <span>Datum</span>
        <span>Gewässer / Fischart</span>
        <span>Anzahl</span>
      </div>
    `;

    rows.forEach((r) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "catch-row";
      el.dataset.entryId = r.id;
      el.innerHTML = `
        <span class="catch-row__date">${escapeHtml(String(r.caught_on))}</span>
        <span class="catch-row__meta">
          <strong class="catch-row__water">${escapeHtml(r.water_name)}</strong>
          <small class="catch-row__fish">${escapeHtml(r.fish_name)}</small>
        </span>
        <span class="catch-row__qty">${Number(r.quantity)}</span>
      `;
      el.addEventListener("click", () => openDialog(r.id));
      table.appendChild(el);
    });

    root.appendChild(table);
  }

  function renderDialogBody(entry) {
    const body = document.getElementById("catchDialogBody");
    if (!body) return;

    const waterOptions = availableWaters()
      .map((w) => `<option value="${w.id}" ${w.id === entry.water_body_id ? "selected" : ""}>${escapeHtml(w.name)}</option>`)
      .join("");

    const fishOptions = FISH_SPECIES
      .map((f) => `<option value="${f.id}" ${f.id === entry.fish_species_id ? "selected" : ""}>${escapeHtml(f.name)}</option>`)
      .join("");

    body.innerHTML = `
      <div class="grid cols2">
        <label>
          <span>Datum</span>
          <input id="dlgDate" type="date" value="${escapeHtml(String(entry.caught_on))}" disabled />
        </label>
        <label>
          <span>Gewässer</span>
          <select id="dlgWater" disabled>${waterOptions}</select>
        </label>
        <label>
          <span>Fischart</span>
          <select id="dlgSpecies" disabled>${fishOptions}</select>
        </label>
        <label>
          <span>Anzahl</span>
          <input id="dlgQty" type="number" min="1" max="200" value="${Number(entry.quantity)}" disabled />
        </label>
        <label>
          <span>Länge (cm)</span>
          <input id="dlgLen" type="number" min="0" step="0.1" value="${entry.length_cm ?? ""}" disabled />
        </label>
        <label>
          <span>Gewicht (g)</span>
          <input id="dlgWeight" type="number" min="0" step="1" value="${entry.weight_g ?? ""}" disabled />
        </label>
        <label style="grid-column:1/-1">
          <span>Notiz</span>
          <textarea id="dlgNote" rows="3" disabled>${escapeHtml(entry.note || "")}</textarea>
        </label>
        <label style="grid-column:1/-1">
          <span>Bild (WebP, automatisch komprimiert, max ~350 KB)</span>
          <input id="dlgPhoto" type="file" accept="image/*" disabled />
        </label>
      </div>
      <div class="catch-dialog-photo-wrap">
        ${entry.photo?.data_url ? `<img id="dlgPhotoPreview" class="catch-dialog-photo" src="${entry.photo.data_url}" alt="Fangbild" />` : `<p id="dlgPhotoPreview" class="small">Kein Bild hinterlegt.</p>`}
      </div>
    `;
  }

  function setDialogEditable(editable) {
    dialogEditMode = editable;
    const ids = ["dlgDate", "dlgWater", "dlgSpecies", "dlgQty", "dlgLen", "dlgWeight", "dlgNote", "dlgPhoto"];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = !editable;
    });

    const saveBtn = document.getElementById("catchSaveBtn");
    if (saveBtn) saveBtn.disabled = !editable;

    const editBtn = document.getElementById("catchEditToggle");
    if (editBtn) editBtn.textContent = editable ? "Ansicht" : "Bearbeiten";
  }

  function readDialogPayload(prev) {
    const waterId = String(document.getElementById("dlgWater")?.value || "").trim();
    const fishId = String(document.getElementById("dlgSpecies")?.value || "").trim();
    const water = availableWaters().find((w) => w.id === waterId);
    const fish = FISH_SPECIES.find((f) => f.id === fishId);

    return {
      ...prev,
      caught_on: String(document.getElementById("dlgDate")?.value || prev.caught_on),
      water_body_id: waterId || prev.water_body_id,
      water_name: water?.name || prev.water_name,
      area_kind: water?.area_kind || prev.area_kind,
      area_keys: water?.area_keys || prev.area_keys,
      fish_species_id: fishId || prev.fish_species_id,
      fish_name: fish?.name || prev.fish_name,
      quantity: Number(document.getElementById("dlgQty")?.value || prev.quantity),
      length_cm: String(document.getElementById("dlgLen")?.value || "").trim() ? Number(document.getElementById("dlgLen").value) : null,
      weight_g: String(document.getElementById("dlgWeight")?.value || "").trim() ? Number(document.getElementById("dlgWeight").value) : null,
      note: String(document.getElementById("dlgNote")?.value || "").trim() || null,
    };
  }

  function openDialog(entryId) {
    const dialog = document.getElementById("catchDialog");
    if (!dialog) return;

    const entry = loadEntries().find((r) => r.id === entryId);
    if (!entry) return;

    activeDialogEntryId = entryId;
    renderDialogBody(entry);
    setDialogEditable(false);
    setDialogMsg("");

    if (!dialog.open) dialog.showModal();
  }

  function closeDialog() {
    const dialog = document.getElementById("catchDialog");
    if (dialog?.open) dialog.close();
    activeDialogEntryId = null;
    setDialogMsg("");
  }

  async function saveDialog() {
    if (!activeDialogEntryId) return;
    const rows = loadEntries();
    const idx = rows.findIndex((r) => r.id === activeDialogEntryId);
    if (idx < 0) return;

    let next = readDialogPayload(rows[idx]);
    const fileInput = document.getElementById("dlgPhoto");
    const file = fileInput?.files?.[0];

    if (file) {
      setDialogMsg("Bild wird komprimiert...");
      const photo = await compressImageToWebp(file);
      next = { ...next, photo };
    }

    rows[idx] = next;
    saveEntries(rows);
    setDialogMsg("Eintrag aktualisiert.");
    refresh();
    openDialog(activeDialogEntryId);
    setDialogEditable(false);
  }

  function deleteDialogEntry() {
    if (!activeDialogEntryId) return;
    const rows = loadEntries().filter((r) => r.id !== activeDialogEntryId);
    saveEntries(rows);
    refresh();
    closeDialog();
    setMsg("Eintrag gelöscht.");
  }

  function refresh() {
    const rows = loadEntries().sort((a, b) => String(b.caught_on).localeCompare(String(a.caught_on)));
    renderEntries(rows);
  }

  function bindDialogActions() {
    document.getElementById("catchCloseBtn")?.addEventListener("click", closeDialog);

    document.getElementById("catchEditToggle")?.addEventListener("click", () => {
      setDialogEditable(!dialogEditMode);
      setDialogMsg("");
    });

    document.getElementById("catchSaveBtn")?.addEventListener("click", async () => {
      try {
        await saveDialog();
      } catch (err) {
        setDialogMsg(err?.message || "Speichern fehlgeschlagen");
      }
    });

    document.getElementById("catchDeleteBtn")?.addEventListener("click", () => {
      deleteDialogEntry();
    });
  }

  function openCreateDialog() {
    if (!createDialog) return;
    setMsg("");
    const form = document.getElementById("catchForm");
    form?.reset();
    const dateInput = document.getElementById("catchDate");
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    const qtyInput = document.getElementById("catchQty");
    if (qtyInput) qtyInput.value = "1";
    if (!createDialog.open) createDialog.showModal();
  }

  function closeCreateDialog() {
    if (createDialog?.open) createDialog.close();
  }

  function init() {
    const form = document.getElementById("catchForm");
    const clearBtn = document.getElementById("catchClearAll");
    createDialog = document.getElementById("catchCreateDialog");
    if (!form || !createDialog) return;

    loadSelects();
    refresh();
    bindDialogActions();

    document.getElementById("openCatchCreateTop")?.addEventListener("click", openCreateDialog);
    document.getElementById("openCatchCreateFab")?.addEventListener("click", openCreateDialog);
    document.getElementById("catchCreateCloseBtn")?.addEventListener("click", closeCreateDialog);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        const payload = readPayload();
        const rows = loadEntries();
        rows.push(payload);
        saveEntries(rows);
        closeCreateDialog();
        form.reset();
        setMsg("UI-Eintrag gespeichert (noch keine DB). ");
        refresh();
      } catch (err) {
        setMsg(err?.message || "Speichern fehlgeschlagen");
      }
    });

    clearBtn?.addEventListener("click", () => {
      saveEntries([]);
      setMsg("Alle UI-Einträge gelöscht.");
      refresh();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
