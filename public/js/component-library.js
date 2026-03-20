const STORAGE_KEY = "vdan_component_library_standards_v1";
const RUNTIME_KEY = "vdan_component_runtime_v1";

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function replaceFirstPx(text, numberValue) {
  const clean = String(text || "");
  const px = `${Math.max(0, Math.round(Number(numberValue) || 0))}px`;
  if (/-?\d+(\.\d+)?\s*px/i.test(clean)) {
    return clean.replace(/-?\d+(\.\d+)?\s*px/i, px);
  }
  return px;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getCards() {
  return [...document.querySelectorAll(".lib-component-card[data-component-key]")];
}

function getCardInputs(card) {
  return [...card.querySelectorAll(".lib-edit-input[data-field]")];
}

function isFieldControl(node) {
  return node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement;
}

function getComponentToggle(card) {
  return card.querySelector(".lib-component-enabled");
}

function getFeatureToggles(card) {
  return [...card.querySelectorAll(".lib-feature-toggle[data-feature-name]")];
}

function getCardKey(card) {
  const key = card.getAttribute("data-component-key");
  return key || "";
}

function getCardByKey(key) {
  if (!key) return null;
  const found = document.querySelector(`.lib-component-card[data-component-key="${key}"]`);
  return found instanceof HTMLElement ? found : null;
}

function buildSchemaFromComponents(components) {
  const schemaComponents = {};

  for (const [key, values] of Object.entries(components || {})) {
    const source = values && typeof values === "object" ? values : {};
    const featureNames = splitCsv(source.features);
    const featureEnabledMap =
      source.__features_enabled && typeof source.__features_enabled === "object"
        ? source.__features_enabled
        : {};

    const fields = {};
    for (const [field, fieldValue] of Object.entries(source)) {
      if (field.startsWith("__")) continue;
      fields[field] = fieldValue;
    }

    schemaComponents[key] = {
      id: key,
      category: key.split("--")[0] || "",
      enabled: source.__enabled !== false,
      fields,
      features: featureNames.map((label) => ({
        id: slugify(label),
        label,
        enabled: featureEnabledMap[label] !== false,
      })),
    };
  }

  return {
    version: "1.0",
    generated_at: new Date().toISOString(),
    components: schemaComponents,
  };
}

function serializeCurrent() {
  const components = {};

  for (const card of getCards()) {
    const key = getCardKey(card);
    if (!key) continue;

    components[key] = {};

    for (const input of getCardInputs(card)) {
      if (!isFieldControl(input)) continue;
      const field = input.dataset.field;
      if (!field) continue;
      components[key][field] = input.value;
    }

    const enabledInput = getComponentToggle(card);
    if (enabledInput instanceof HTMLInputElement) {
      components[key].__enabled = Boolean(enabledInput.checked);
    }

    const featureEnabled = {};
    for (const featureToggle of getFeatureToggles(card)) {
      if (!(featureToggle instanceof HTMLInputElement)) continue;
      const featureName = String(featureToggle.dataset.featureName || "").trim();
      if (!featureName) continue;
      featureEnabled[featureName] = Boolean(featureToggle.checked);
    }
    components[key].__features_enabled = featureEnabled;
  }

  return {
    version: "1.0",
    saved_at: new Date().toISOString(),
    components,
    schema: buildSchemaFromComponents(components),
  };
}

function firstPx(text, fallback) {
  const src = String(text || "");
  const match = src.match(/-?\d+(\.\d+)?\s*px/i);
  return match ? match[0].replace(/\s+/g, "") : fallback;
}

function firstNumber(text, fallback) {
  const src = String(text || "");
  const match = src.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : fallback;
}

function parseColorConfig(text) {
  const result = { text: "", bg: "", border: "" };
  for (const token of splitCsv(text)) {
    const [rawKey, rawVal] = token.split(":");
    const key = String(rawKey || "").trim().toLowerCase();
    const value = String(rawVal || "").trim();
    if (!value) continue;
    if (key === "text" || key === "fg") result.text = value;
    if (key === "bg" || key === "background") result.bg = value;
    if (key === "border" || key === "line") result.border = value;
  }
  return result;
}

function extractFontWeight(text, fallback = "600") {
  const src = String(text || "");
  const slash = src.match(/\/\s*(\d{3})/);
  if (slash) return slash[1];
  const any = src.match(/\b([1-9]00)\b/);
  return any ? any[1] : fallback;
}

function extractPaddingX(text, fallback = "16px") {
  const matches = String(text || "").match(/-?\d+(\.\d+)?\s*px/gi) || [];
  if (matches.length >= 2) return matches[1].replace(/\s+/g, "");
  if (matches.length === 1) return matches[0].replace(/\s+/g, "");
  return fallback;
}

function buttonRuntimeFromState(state) {
  let components = {};
  if (state && typeof state === "object" && state.components && typeof state.components === "object") {
    components = state.components;
  }
  const primary = components["buttons--primary-button"] || {};
  const secondary = components["buttons--secondary-button"] || {};
  return {
    buttons: {
      height: firstPx(primary.height || secondary.height, "48px"),
      padding_x: extractPaddingX(primary.padding || secondary.padding, "16px"),
      radius: firstPx(primary.radius || secondary.radius, "12px"),
      font_size: firstPx(primary.font || secondary.font, "16px"),
      font_weight: extractFontWeight(primary.font || secondary.font, "600"),
    },
  };
}

function applyRuntimeToDocument(runtime) {
  const root = document.documentElement;
  const buttons = runtime && runtime.buttons;
  if (!buttons || typeof buttons !== "object") return;
  const set = (k, v) => {
    const text = String(v || "").trim();
    if (!text) return;
    root.style.setProperty(k, text);
  };
  set("--lib-btn-height", buttons.height);
  set("--lib-btn-pad-x", buttons.padding_x);
  set("--lib-btn-radius", buttons.radius);
  set("--lib-btn-font-size", buttons.font_size);
  set("--lib-btn-font-weight", buttons.font_weight);
}

function refreshCardEnabledState(card) {
  const enabledInput = getComponentToggle(card);
  if (!(enabledInput instanceof HTMLInputElement)) return;
  card.classList.toggle("is-disabled", !enabledInput.checked);
}

function refreshAllCardEnabledStates() {
  for (const card of getCards()) {
    refreshCardEnabledState(card);
  }
}

function readCardFields(card) {
  const fields = {};
  for (const input of getCardInputs(card)) {
    if (!isFieldControl(input)) continue;
    const field = String(input.dataset.field || "").trim();
    if (!field) continue;
    fields[field] = input.value;
  }
  return fields;
}

function applyInlineStyles(elements, styles) {
  for (const el of elements) {
    if (!(el instanceof HTMLElement)) continue;
    for (const [prop, value] of Object.entries(styles)) {
      if (!value) continue;
      el.style.setProperty(prop, value);
    }
  }
}

function setupPxControls() {
  const fieldsWithPx = new Set(["height", "padding", "radius", "font", "icon", "touch"]);
  const inputs = [...document.querySelectorAll(".lib-edit-input[data-field]")];
  for (const input of inputs) {
    if (!(input instanceof HTMLInputElement)) continue;
    const field = String(input.dataset.field || "");
    if (!fieldsWithPx.has(field)) continue;
    if (!String(input.value || "").toLowerCase().includes("px")) continue;
    if (input.dataset.pxEnhanced === "true") continue;

    const wrapper = document.createElement("div");
    wrapper.className = "lib-edit-wrap";
    input.parentNode?.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const pxInput = document.createElement("input");
    pxInput.type = "number";
    pxInput.className = "lib-edit-px";
    pxInput.step = "1";
    pxInput.min = "0";
    pxInput.setAttribute("aria-label", `${field} in Pixel`);
    const current = firstNumber(input.value, 0);
    if (Number.isFinite(current)) pxInput.value = String(current);
    wrapper.appendChild(pxInput);

    pxInput.addEventListener("input", () => {
      input.value = replaceFirstPx(input.value, Number(pxInput.value || 0));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    input.addEventListener("input", () => {
      const n = firstNumber(input.value, 0);
      pxInput.value = String(n);
    });

    input.dataset.pxEnhanced = "true";
  }
}

function applyLivePreviewForCard(card) {
  const fields = readCardFields(card);
  const height = firstPx(fields.height, "");
  const radius = firstPx(fields.radius, "");
  const fontSize = firstPx(fields.font, "");
  const fontWeight = extractFontWeight(fields.font, "");
  const paddingX = extractPaddingX(fields.padding, "");
  const padYNum = Math.max(4, Math.round(firstNumber(fields.height, 48) * 0.2));
  const paddingY = `${padYNum}px`;
  const targetList = [".lib-preview-block button", ".lib-preview-block input", ".lib-preview-block select", ".lib-preview-block textarea"];
  const colors = parseColorConfig(fields.colors);

  for (const selector of targetList) {
    const nodes = card.querySelectorAll(selector);
    applyInlineStyles(nodes, {
      height,
      borderRadius: radius,
      fontSize,
      fontWeight,
      paddingLeft: paddingX,
      paddingRight: paddingX,
      color: colors.text,
      background: colors.bg,
      borderColor: colors.border,
    });
  }

  const rowNodes = card.querySelectorAll(".catch-table__row, .lib-mock-list-row");
  applyInlineStyles(rowNodes, {
    minHeight: height,
    borderRadius: radius,
    fontSize,
    paddingTop: paddingY,
    paddingBottom: paddingY,
    paddingLeft: paddingX,
    paddingRight: paddingX,
    color: colors.text,
    background: colors.bg,
    borderColor: colors.border,
  });

  const tableNode = card.querySelector(".catch-table");
  if (tableNode instanceof HTMLElement) {
    if (radius) tableNode.style.borderRadius = radius;
    if (fontSize) tableNode.style.fontSize = fontSize;
    if (colors.bg) tableNode.style.background = colors.bg;
    if (colors.border) tableNode.style.borderColor = colors.border;
    if (colors.text) tableNode.style.color = colors.text;
  }

  const tableHead = card.querySelector(".catch-table__head");
  if (tableHead instanceof HTMLElement) {
    if (colors.border) tableHead.style.borderColor = colors.border;
  }

  const previewCard = card.querySelector(".lib-preview-cards .card");
  if (previewCard instanceof HTMLElement && radius) {
    previewCard.style.borderRadius = radius;
  }
}

function applyLivePreviewForAllCards() {
  for (const card of getCards()) {
    applyLivePreviewForCard(card);
  }
}

function normalizedValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function cardFieldValue(card, field) {
  const input = card.querySelector(`.lib-edit-input[data-field="${field}"]`);
  return input instanceof HTMLInputElement ? input.value : "";
}

function setValidation(card, message, active) {
  const box = card.querySelector("[data-validation]");
  if (!(box instanceof HTMLElement)) return;
  if (!active || !message) {
    box.textContent = "";
    box.toggleAttribute("hidden", true);
    card.classList.remove("has-validation-warning");
    return;
  }
  box.textContent = message;
  box.toggleAttribute("hidden", false);
  card.classList.add("has-validation-warning");
}

function validateTableRowConsistency() {
  const tableCard = getCardByKey("lists--standard-tabelle");
  const rowCard = getCardByKey("lists--table-row");
  if (!(tableCard instanceof HTMLElement) || !(rowCard instanceof HTMLElement)) return;

  const fields = [
    { id: "height", label: "Hoehe" },
    { id: "padding", label: "Padding" },
    { id: "radius", label: "Border-Radius" },
    { id: "font", label: "Font-Size" },
    { id: "colors", label: "Farben" },
  ];

  const mismatches = fields.filter((field) => {
    const tableValue = normalizedValue(cardFieldValue(tableCard, field.id));
    const rowValue = normalizedValue(cardFieldValue(rowCard, field.id));
    return tableValue !== rowValue;
  });

  if (mismatches.length === 0) {
    setValidation(tableCard, "", false);
    setValidation(rowCard, "", false);
    return;
  }

  const labels = mismatches.map((f) => f.label).join(", ");
  const message = `NOGO: Table Row weicht von Standard Tabelle ab bei: ${labels}`;
  setValidation(tableCard, message, true);
  setValidation(rowCard, message, true);
}

function runValidation() {
  validateTableRowConsistency();
}

function applyState(payload) {
  if (!payload || typeof payload !== "object") return;
  const components = payload.components;
  if (!components || typeof components !== "object") return;

  for (const card of getCards()) {
    const key = getCardKey(card);
    if (!key) continue;

    const values = components[key];
    if (!values || typeof values !== "object") continue;

    for (const input of getCardInputs(card)) {
      if (!isFieldControl(input)) continue;
      const field = input.dataset.field;
      if (!field) continue;
      if (typeof values[field] === "string") input.value = values[field];
    }

    const enabledInput = getComponentToggle(card);
    if (enabledInput instanceof HTMLInputElement && typeof values.__enabled === "boolean") {
      enabledInput.checked = values.__enabled;
    }

    const featureEnabledMap =
      values.__features_enabled && typeof values.__features_enabled === "object"
        ? values.__features_enabled
        : null;

    for (const featureToggle of getFeatureToggles(card)) {
      if (!(featureToggle instanceof HTMLInputElement)) continue;
      const name = String(featureToggle.dataset.featureName || "").trim();
      if (!name || !featureEnabledMap) continue;
      if (typeof featureEnabledMap[name] === "boolean") {
        featureToggle.checked = featureEnabledMap[name];
      }
    }
  }

  refreshAllCardEnabledStates();
  applyLivePreviewForAllCards();
  runValidation();
}

function status(text) {
  const el = document.getElementById("libEditorStatus");
  if (el) el.textContent = text;
}

function writeExportArea(text) {
  const area = document.getElementById("libExportArea");
  if (!(area instanceof HTMLTextAreaElement)) return;
  area.value = text;
}

function writeSchemaArea(text) {
  const area = document.getElementById("libSchemaArea");
  if (!(area instanceof HTMLTextAreaElement)) return;
  area.value = text;
}

function refreshSchemaArea() {
  const payload = serializeCurrent();
  writeSchemaArea(JSON.stringify(payload.schema, null, 2));
}

function readExportArea() {
  const area = document.getElementById("libExportArea");
  if (!(area instanceof HTMLTextAreaElement)) return "";
  return String(area.value || "").trim();
}

function saveLocal() {
  const payload = serializeCurrent();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  status(`Lokal gespeichert (${new Date().toLocaleTimeString("de-DE")}).`);
  writeExportArea(JSON.stringify(payload, null, 2));
  writeSchemaArea(JSON.stringify(payload.schema, null, 2));
  return payload;
}

function resetDefaults() {
  for (const card of getCards()) {
    for (const input of getCardInputs(card)) {
      if (!isFieldControl(input)) continue;
      input.value = String(input.dataset.default || "");
    }

    const enabledInput = getComponentToggle(card);
    if (enabledInput instanceof HTMLInputElement) {
      enabledInput.checked = String(enabledInput.dataset.default || "true") !== "false";
    }

    for (const featureToggle of getFeatureToggles(card)) {
      if (!(featureToggle instanceof HTMLInputElement)) continue;
      featureToggle.checked = String(featureToggle.dataset.default || "true") !== "false";
    }
  }

  localStorage.removeItem(STORAGE_KEY);
  refreshAllCardEnabledStates();
  applyLivePreviewForAllCards();
  refreshSchemaArea();
  runValidation();
  status("Auf Standardwerte zurueckgesetzt.");
  writeExportArea("");
}

function serializeComponentCard(card) {
  const key = getCardKey(card);
  const fields = readCardFields(card);
  const enabledInput = getComponentToggle(card);
  const featureStates = {};
  for (const featureToggle of getFeatureToggles(card)) {
    if (!(featureToggle instanceof HTMLInputElement)) continue;
    const name = String(featureToggle.dataset.featureName || "").trim();
    if (!name) continue;
    featureStates[name] = Boolean(featureToggle.checked);
  }
  return {
    version: "1.0",
    copied_at: new Date().toISOString(),
    component: {
      key,
      enabled: enabledInput instanceof HTMLInputElement ? Boolean(enabledInput.checked) : true,
      fields,
      features_enabled: featureStates,
    },
  };
}

function loadLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    applyState(parsed);
    status("Gespeicherte Standards geladen.");
  } catch {
    status("Gespeicherte Standards konnten nicht gelesen werden.");
  }
}

function clearRuntimeOverride() {
  localStorage.removeItem(RUNTIME_KEY);
  const root = document.documentElement;
  root.style.removeProperty("--lib-btn-height");
  root.style.removeProperty("--lib-btn-pad-x");
  root.style.removeProperty("--lib-btn-radius");
  root.style.removeProperty("--lib-btn-font-size");
  root.style.removeProperty("--lib-btn-font-weight");
}

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const saveBtn = target.closest("#libSaveBtn");
  if (saveBtn) {
    saveLocal();
    return;
  }

  const catToggle = target.closest(".lib-cat-toggle");
  if (catToggle instanceof HTMLButtonElement) {
    const selected = catToggle.dataset.category;
    if (!selected) return;
    const toggles = [...document.querySelectorAll(".lib-cat-toggle")];
    const panels = [...document.querySelectorAll(".lib-category-panel")];
    toggles.forEach((btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      const isActive = btn.dataset.category === selected ? btn.getAttribute("aria-expanded") !== "true" : false;
      btn.setAttribute("aria-expanded", isActive ? "true" : "false");
    });
    panels.forEach((panel) => {
      if (!(panel instanceof HTMLElement)) return;
      const isSelectedPanel = panel.id === `panel-${selected}`;
      const selectedBtn = document.querySelector(`.lib-cat-toggle[data-category="${selected}"]`);
      const shouldOpen = isSelectedPanel && selectedBtn instanceof HTMLButtonElement && selectedBtn.getAttribute("aria-expanded") === "true";
      panel.toggleAttribute("hidden", !shouldOpen);
    });
    return;
  }

  const exportBtn = target.closest("#libExportBtn");
  if (exportBtn) {
    const payload = serializeCurrent();
    const text = JSON.stringify(payload, null, 2);
    writeExportArea(text);
    writeSchemaArea(JSON.stringify(payload.schema, null, 2));
    try {
      await navigator.clipboard.writeText(text);
      status("JSON exportiert und in die Zwischenablage kopiert.");
    } catch {
      status("JSON exportiert (Zwischenablage nicht verfügbar).");
    }
    return;
  }

  const importBtn = target.closest("#libImportBtn");
  if (importBtn) {
    const raw = readExportArea();
    if (!raw) {
      status("Bitte JSON in das Feld einfuegen.");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      applyState(parsed);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      writeSchemaArea(JSON.stringify((parsed.schema || buildSchemaFromComponents(parsed.components || {})), null, 2));
      status("JSON importiert und gespeichert.");
    } catch {
      status("Import fehlgeschlagen: JSON ist ungueltig.");
    }
    return;
  }

  const applyBtn = target.closest("#libApplyButtonsBtn");
  if (applyBtn) {
    const current = serializeCurrent();
    const runtime = buttonRuntimeFromState(current);
    localStorage.setItem(RUNTIME_KEY, JSON.stringify(runtime));
    applyRuntimeToDocument(runtime);
    status("Button-Standards appweit angewendet (lokaler Override aktiv).");
    return;
  }

  const clearBtn = target.closest("#libClearButtonsBtn");
  if (clearBtn) {
    clearRuntimeOverride();
    status("Button-Override entfernt. App nutzt wieder Default-Werte.");
    return;
  }

  const resetBtn = target.closest("#libResetBtn");
  if (resetBtn) {
    resetDefaults();
    return;
  }

  const btn = target.closest(".lib-copy-btn");
  if (!(btn instanceof HTMLButtonElement)) return;
  const card = btn.closest(".lib-component-card");
  if (!(card instanceof HTMLElement)) return;
  const payload = serializeComponentCard(card);
  const notes = String(payload.component.fields.notes || "").trim();
  const text = [
    `FIX ${payload.component.key}`,
    "",
    "Notizen:",
    notes || "(keine Notiz)",
    "",
    "Komponenten-JSON:",
    JSON.stringify(payload, null, 2),
  ].join("\n");
  try {
    await navigator.clipboard.writeText(text);
    const prev = btn.textContent;
    btn.textContent = "FIX kopiert";
    window.setTimeout(() => {
      btn.textContent = prev || "FIX";
    }, 1000);
  } catch {
    btn.textContent = "Kopieren fehlgeschlagen";
    window.setTimeout(() => {
      btn.textContent = "FIX";
    }, 1000);
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.matches(".lib-edit-input")) {
    const card = target.closest(".lib-component-card");
    if (card instanceof HTMLElement) applyLivePreviewForCard(card);
    refreshSchemaArea();
    runValidation();
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.matches(".lib-component-enabled")) {
    const card = target.closest(".lib-component-card");
    if (card instanceof HTMLElement) refreshCardEnabledState(card);
    refreshSchemaArea();
    runValidation();
    return;
  }

  if (target.matches(".lib-feature-toggle")) {
    refreshSchemaArea();
    runValidation();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  setupPxControls();
  loadLocal();
  refreshAllCardEnabledStates();
  applyLivePreviewForAllCards();
  refreshSchemaArea();
  runValidation();
  try {
    const runtimeRaw = localStorage.getItem(RUNTIME_KEY);
    if (runtimeRaw) applyRuntimeToDocument(JSON.parse(runtimeRaw));
  } catch {
    // ignore
  }
});
