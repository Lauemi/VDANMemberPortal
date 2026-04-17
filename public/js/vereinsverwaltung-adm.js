"use strict";

;(() => {
  const TEMPLATE_URL = "/import-templates/Vereinsverwaltung_Importvorlage.xlsx";
  const MAPPING_URL = "/import-templates/VDAN_Importvorlage_DB_Mapping.md";

  // Export-Struktur: nur Felder die tatsächlich in admin_member_registry.expectedColumns stehen.
  // Keine Ghost-Felder (source, house_number, country, club_join_date, membership_kind, current_membership_since, notes
  // sind NICHT in expectedColumns → werden nie befüllt → dürfen nicht exportiert werden).
  // Trennzeichen: Semikolon – passend für deutschen Excel-Standard.
  const HEADER_EXPORT = [
    ["member_number", "Mitgliedsnummer"],
    ["status", "Status"],
    ["first_name", "Vorname"],
    ["last_name", "Nachname"],
    ["email", "E-Mail"],
    ["phone", "Telefon"],
    ["birthdate", "Geburtsdatum"],
    ["street", "Adresse"],
    ["postal_code", "PLZ"],
    ["city", "Ort"],
    ["sepa_approved", "SEPA genehmigt"],
  ];

  // Import-Alias-Map: dieselben Felder wie HEADER_EXPORT, plus deutschen Varianten.
  const HEADER_ALIASES = {
    member_number: "member_number",
    mitgliedsnummer: "member_number",
    mitglieds_nr: "member_number",
    mitgliedsnummer_nummerisch: "member_number",
    club_member_no: "member_number",
    status: "status",
    first_name: "first_name",
    vorname: "first_name",
    last_name: "last_name",
    nachname: "last_name",
    email: "email",
    e_mail: "email",
    telefon: "phone",
    phone: "phone",
    birthdate: "birthdate",
    geburtsdatum: "birthdate",
    geburtstag: "birthdate",
    street: "street",
    strasse: "street",
    adresse: "street",
    stra_e: "street",
    postal_code: "postal_code",
    plz: "postal_code",
    zip: "postal_code",
    city: "city",
    ort: "city",
    sepa_approved: "sepa_approved",
    sepa: "sepa_approved",
    sepa_genehmigt: "sepa_approved",
    sepa_freigabe: "sepa_approved",
    sepa_ok: "sepa_approved",
  };

  // Werttransformationen für Export: Felder, bei denen der CSV-Wert vom Rohwert der DB-Zeile abweicht.
  // Alle anderen Felder werden via text(row?.[col.key]) exportiert.
  // Diese Map ersetzt TABLE_COL_TO_EXPORT_KEY + die separaten data-Objekte in den Export-Funktionen.
  const EXPORT_VALUE_TRANSFORMS = {
    club_member_no: (row) => stripClubPrefix(row?.club_member_no || row?.member_number),
    zip: (row) => text(row?.zip),
    sepa_approved: (row) => text(String(row?.sepa_approved ?? "")),
  };

  function getExportValue(col, row) {
    const transform = EXPORT_VALUE_TRANSFORMS[col.key];
    if (transform) return transform(row);
    return text(row?.[col.key] ?? "");
  }

  const dialogState = {
    open: false,
    busy: false,
    clubId: "",
    rows: [],
    file: null,
    delimiter: ";",
    previewRows: [],
    presentFields: [],
    errors: [],
  };

  function cfg() {
    const body = document.body;
    return {
      url: String(window.__APP_SUPABASE_URL || body?.getAttribute("data-supabase-url") || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || body?.getAttribute("data-supabase-key") || "").trim(),
    };
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  async function sb(path, init = {}, withAuth = false) {
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    const token = session()?.access_token || "";
    if (withAuth && token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${url}${path}`, { ...init, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      throw new Error(String(data?.error || data?.message || `request_failed_${res.status}`));
    }
    return data;
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function text(value) {
    return String(value ?? "").trim();
  }

  function normalizeHeader(value) {
    return text(value)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function stripClubPrefix(value) {
    return text(value).replace(/^[A-Z]+\d+-/i, "");
  }

  function normalizeStatus(value) {
    const raw = text(value).toLowerCase();
    if (["aktiv", "active"].includes(raw)) return "active";
    if (["passiv", "passive", "inactive"].includes(raw)) return "passive";
    if (raw === "pending") return "pending";
    return raw || "active";
  }

  // Normalisiert sepa_approved für Lesezwecke (Preview-Anzeige, Export).
  // sepa_approved ist kein frei toggelbares Boolean: false ist im DB-Schema nicht gültig
  // (members.sepa_approved_check erlaubt nur null und true).
  // Diese Funktion wird NICHT für den Import-Write-Pfad verwendet.
  // Leerstring bleibt leer (Feld nicht vorhanden / kein Wert).
  function normalizeSepaApproved(value) {
    const raw = text(String(value ?? "")).toLowerCase();
    if (raw === "") return "";
    if (["true", "ja", "1", "yes", "approved"].includes(raw)) return "true";
    return "false";
  }

  function normalizeDate(value) {
    const raw = text(value);
    if (!raw) return { value: "", valid: true };
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { value: raw, valid: true };
    const de = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (de) {
      const iso = `${de[3]}-${String(de[2]).padStart(2, "0")}-${String(de[1]).padStart(2, "0")}`;
      return { value: iso, valid: true };
    }
    return { value: "", valid: false };
  }

  function toCsvCell(value) {
    const raw = String(value ?? "");
    if (!/[",;\n\r]/.test(raw)) return raw;
    return `"${raw.replaceAll('"', '""')}"`;
  }

  function downloadBlob(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function parseCsv(raw, delimiter) {
    const input = String(raw || "");
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < input.length; i += 1) {
      const char = input[i];
      const next = input[i + 1];
      if (quoted) {
        if (char === '"' && next === '"') {
          cell += '"';
          i += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          cell += char;
        }
        continue;
      }
      if (char === '"') {
        quoted = true;
        continue;
      }
      if (char === delimiter) {
        row.push(cell);
        cell = "";
        continue;
      }
      if (char === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        continue;
      }
      if (char === "\r") continue;
      cell += char;
    }
    if (cell !== "" || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows.filter((entry) => entry.some((value) => text(value)));
  }

  function currentClubId(rows = []) {
    const params = new URLSearchParams(window.location.search || "");
    const fromUrl = text(params.get("club_id"));
    if (fromUrl) return fromUrl;
    return text(rows.find((row) => text(row?.club_id))?.club_id);
  }

  // Vergleicht importierbare Felder. presentFields (Set<string> | null) begrenzt den Vergleich
  // auf die tatsächlich im CSV vorhandenen Felder – für Teilmengenimport.
  // Ohne presentFields (null) werden alle Felder verglichen (Vollimport).
  // sepa_approved ist bewusst NICHT Teil des Vergleichs: es ist ein Approval-Flag,
  // kein frei schreibbares Feld – false ist per DB-Constraint verboten,
  // und der Import-Pfad schreibt es nicht.
  function rowChanged(existing, mapped, presentFields = null) {
    if (!existing) return true;
    const has = (field) => !presentFields || presentFields.has(field);
    return (
      (has("status") && normalizeStatus(text(existing.status)) !== normalizeStatus(text(mapped.status || "")))
      || (has("first_name") && text(existing.first_name) !== text(mapped.first_name || ""))
      || (has("last_name") && text(existing.last_name) !== text(mapped.last_name || ""))
      || (has("email") && text(existing.email).toLowerCase() !== text(mapped.email || "").toLowerCase())
      || (has("phone") && text(existing.phone) !== text(mapped.phone || ""))
      || (has("birthdate") && normalizeDate(text(existing.birthdate)).value !== normalizeDate(text(mapped.birthdate || "")).value)
      || (has("street") && text(existing.street) !== text(mapped.street || ""))
      || (has("postal_code") && text(existing.zip) !== text(mapped.postal_code || ""))
      || (has("city") && text(existing.city) !== text(mapped.city || ""))
    );
  }

  // action-Werte: "create" | "update" | "noop" | "invalid"
  // create  = neue Mitgliedsnummer, wird angelegt
  // update  = bekannte Mitgliedsnummer, mindestens ein Feld geändert
  // noop    = bekannte Mitgliedsnummer, kein Feld geändert – wird nicht an Server gesendet
  // invalid = Mitgliedsnummer fehlt – Zeile wird übersprungen
  //
  // Teilmengenimport: enthält das CSV nur eine Teilmenge der Felder, werden fehlende
  // Felder für Update-Zeilen aus dem bestehenden DB-Datensatz aufgefüllt.
  // Dadurch überschreibt ein View-Export-Reimport keine nicht-exportierten Felder.
  function buildPreviewRows(fileText, rows = [], delimiter = ";") {
    const parsed = parseCsv(fileText, delimiter);
    if (!parsed.length) {
      return { previewRows: [], errors: ["CSV ist leer."], headerWarnings: [], presentFields: [] };
    }

    const [headerRow, ...bodyRows] = parsed;
    const canonicalHeaders = headerRow.map((header) => HEADER_ALIASES[normalizeHeader(header)] || "");
    const unknownHeaders = headerRow.filter((_, index) => !canonicalHeaders[index]).map((header) => text(header));

    // Welche kanonischen Felder sind im CSV-Header vorhanden?
    const presentFields = new Set(canonicalHeaders.filter(Boolean));

    const existingNumbers = new Set(rows.map((row) => stripClubPrefix(row?.club_member_no || row?.member_number)).filter(Boolean));
    const existingByNumber = new Map(
      rows
        .map((row) => [stripClubPrefix(row?.club_member_no || row?.member_number), row])
        .filter(([key]) => Boolean(key))
    );
    const seenNumbers = new Set();

    const previewRows = bodyRows.map((values, index) => {
      const source = {};
      headerRow.forEach((header, cellIndex) => {
        source[text(header)] = text(values[cellIndex]);
      });
      const mapped = {};
      canonicalHeaders.forEach((key, cellIndex) => {
        if (!key) return;
        mapped[key] = text(values[cellIndex]);
      });

      const memberNumber = stripClubPrefix(mapped.member_number);
      const isExisting = Boolean(memberNumber) && existingNumbers.has(memberNumber);
      const existingRow = isExisting ? existingByNumber.get(memberNumber) : null;

      // Für Update-Zeilen fehlende Felder aus dem bestehenden Datensatz auffüllen,
      // damit kein unbeabsichtigtes Überschreiben mit Leerstrings passiert.
      if (isExisting && existingRow) {
        if (!presentFields.has("status") && text(existingRow.status)) mapped.status = text(existingRow.status);
        if (!presentFields.has("first_name") && text(existingRow.first_name)) mapped.first_name = text(existingRow.first_name);
        if (!presentFields.has("last_name") && text(existingRow.last_name)) mapped.last_name = text(existingRow.last_name);
        if (!presentFields.has("email") && text(existingRow.email)) mapped.email = text(existingRow.email);
        if (!presentFields.has("phone") && text(existingRow.phone)) mapped.phone = text(existingRow.phone);
        if (!presentFields.has("birthdate") && text(existingRow.birthdate)) mapped.birthdate = text(existingRow.birthdate);
        if (!presentFields.has("street") && text(existingRow.street)) mapped.street = text(existingRow.street);
        if (!presentFields.has("postal_code") && text(existingRow.zip)) mapped.postal_code = text(existingRow.zip);
        if (!presentFields.has("city") && text(existingRow.city)) mapped.city = text(existingRow.city);
        if (!presentFields.has("sepa_approved") && existingRow.sepa_approved !== undefined) mapped.sepa_approved = String(existingRow.sepa_approved);
      }

      const birthdateInfo = normalizeDate(mapped.birthdate);
      const warnings = [];

      if (!memberNumber) warnings.push("Mitgliedsnummer fehlt – Zeile ungültig.");
      if (memberNumber && seenNumbers.has(memberNumber)) warnings.push("Mitgliedsnummer doppelt in Datei.");
      if (memberNumber) seenNumbers.add(memberNumber);
      if (!birthdateInfo.valid) warnings.push("Ungültiges Datum – Geburtstagsfeld wird geleert.");
      if (unknownHeaders.length) warnings.push(`Unbekannte Spalten werden ignoriert: ${unknownHeaders.join(", ")}`);

      let action;
      if (!memberNumber) {
        action = "invalid";
      } else if (isExisting) {
        action = rowChanged(existingRow, mapped, presentFields) ? "update" : "noop";
      } else {
        action = "create";
      }

      return {
        row_index: index,
        source,
        member_number: memberNumber,
        status: normalizeStatus(mapped.status),
        first_name: text(mapped.first_name),
        last_name: text(mapped.last_name),
        email: text(mapped.email).toLowerCase(),
        phone: text(mapped.phone),
        birthdate: birthdateInfo.value,
        street: text(mapped.street),
        postal_code: text(mapped.postal_code),
        city: text(mapped.city),
        sepa_approved: normalizeSepaApproved(text(mapped.sepa_approved || "")),
        warnings,
        row_status: warnings.length ? "warning" : "ok",
        action,
        excluded: false,
      };
    });

    return {
      previewRows,
      errors: [],
      headerWarnings: unknownHeaders.length ? [`Unbekannte Spalten: ${unknownHeaders.join(", ")}`] : [],
      presentFields: [...presentFields],
    };
  }

  // Export: alle exportierbaren Spalten laut Column-Metadaten (exportable: true).
  // Fällt auf HEADER_EXPORT zurück, wenn keine Column-Metadaten übergeben wurden.
  // Trennzeichen: Semikolon – identisch mit Import-Standard.
  function exportMembers(rows, columns) {
    const exportCols = Array.isArray(columns) && columns.length
      ? columns.filter((col) => col.exportable)
      : HEADER_EXPORT.map(([key, label]) => ({ key, exportKey: key, exportLabel: label, exportable: true }));
    const lines = [exportCols.map((col) => toCsvCell(col.exportLabel || col.label)).join(";")];
    rows.forEach((row) => {
      lines.push(exportCols.map((col) => toCsvCell(getExportValue(col, row))).join(";"));
    });
    downloadBlob("vereinsverwaltung_export_mitglieder.csv", lines.join("\n"), "text/csv;charset=utf-8");
  }

  // View Export: exportiert nur die aktuell im Table sichtbaren Spalten.
  // club_member_no (alwaysExport: true) wird immer mitgeführt – Pflichtschlüssel für Reimport.
  // visibleColumns = Array von Table-Spalten-Keys (aus FCPInlineDataTable.getState().visibleColumns).
  // columns = Array von Column-Metadaten (aus detail.columns, trägt exportable/alwaysExport).
  function exportMembersView(rows, visibleColumns, columns) {
    const visibleSet = new Set(Array.isArray(visibleColumns) ? visibleColumns : []);
    const exportCols = Array.isArray(columns) && columns.length
      ? columns.filter((col) => col.exportable && (col.alwaysExport || visibleSet.has(col.key)))
      : HEADER_EXPORT.filter(([key]) => {
          if (key === "member_number") return true;
          return visibleSet.has(key);
        }).map(([key, label]) => ({ key, exportKey: key, exportLabel: label, exportable: true }));
    const lines = [exportCols.map((col) => toCsvCell(col.exportLabel || col.label)).join(";")];
    rows.forEach((row) => {
      lines.push(exportCols.map((col) => toCsvCell(getExportValue(col, row))).join(";"));
    });
    downloadBlob("vereinsverwaltung_view_export.csv", lines.join("\n"), "text/csv;charset=utf-8");
  }

  function ensureDialog() {
    let dialog = document.getElementById("vereinsverwaltungImportDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "vereinsverwaltungImportDialog";
    dialog.className = "catch-dialog vv-import-dialog";
    dialog.innerHTML = `
      <form method="dialog" class="catch-dialog__form vv-import-dialog__form">
        <h3>CSV Import</h3>
        <div class="catch-dialog__body vv-import-dialog__body"></div>
        <div class="catch-dialog__actions">
          <button type="button" class="feed-btn feed-btn--ghost" data-vv-template-download="true">Vorlage</button>
          <button type="button" class="feed-btn feed-btn--ghost" data-vv-mapping-download="true">Mapping</button>
          <button type="button" class="feed-btn feed-btn--ghost" data-vv-preview="true">Preview laden</button>
          <button type="button" class="feed-btn" data-vv-confirm="true">Import übernehmen</button>
          <button type="submit" class="feed-btn feed-btn--ghost">Schließen</button>
        </div>
      </form>
    `;
    document.body.append(dialog);

    dialog.addEventListener("close", () => {
      dialogState.open = false;
      dialogState.busy = false;
    });

    dialog.addEventListener("change", async (event) => {
      const target = event.target;
      if (target?.matches?.("[data-vv-file]")) {
        dialogState.file = target.files?.[0] || null;
      }
      if (target?.matches?.("[data-vv-delimiter]")) {
        dialogState.delimiter = text(target.value) || ";";
      }
      if (target?.matches?.("[data-vv-exclude]")) {
        const rowIndex = Number(target.getAttribute("data-vv-exclude") ?? -1);
        if (rowIndex >= 0 && dialogState.previewRows[rowIndex]) {
          dialogState.previewRows[rowIndex].excluded = !target.checked;
          renderDialog(dialog);
        }
        return;
      }
      if (target?.matches?.("[data-vv-cell]")) {
        const rowIndex = Number(target.getAttribute("data-vv-row") || -1);
        const key = text(target.getAttribute("data-vv-cell"));
        if (key === "member_number") return; // readonly – Identifikationsschlüssel, nie ändern
        if (rowIndex >= 0 && key && dialogState.previewRows[rowIndex]) {
          dialogState.previewRows[rowIndex][key] = text(target.value);
          // Action neu berechnen: noop kann zu update werden, update zu noop.
          // Respektiert presentFields – kein Vergleich über nicht-importierte Felder.
          dialogState.previewRows[rowIndex].action = recalcRowAction(dialogState.previewRows[rowIndex]);
          renderDialog(dialog);
        }
      }
    });

    dialog.addEventListener("click", async (event) => {
      const target = event.target;
      if (target?.closest?.("[data-vv-template-download]")) {
        window.location.href = TEMPLATE_URL;
        return;
      }
      if (target?.closest?.("[data-vv-mapping-download]")) {
        window.location.href = MAPPING_URL;
        return;
      }
      if (target?.closest?.("[data-vv-preview]")) {
        await rebuildPreview(dialog);
        return;
      }
      if (target?.closest?.("[data-vv-select-all]")) {
        dialogState.previewRows.forEach((row) => { row.excluded = false; });
        renderDialog(dialog);
        return;
      }
      if (target?.closest?.("[data-vv-deselect-all]")) {
        dialogState.previewRows.forEach((row) => { row.excluded = true; });
        renderDialog(dialog);
        return;
      }
      if (target?.closest?.("[data-vv-confirm]")) {
        await confirmImport(dialog);
      }
    });

    return dialog;
  }

  // Berechnet die Action einer previewRow neu gegen den bestehenden DB-Datensatz.
  // Wird nach jeder Feldbearbeitung in der Preview aufgerufen.
  // Respektiert presentFields: nur die im Import vorhandenen Felder fließen in den Vergleich ein.
  function recalcRowAction(previewRow) {
    const memberNumber = text(previewRow.member_number);
    if (!memberNumber) return "invalid";
    const existingRow = dialogState.rows.find(
      (row) => stripClubPrefix(row?.club_member_no || row?.member_number) === memberNumber
    );
    if (!existingRow) return "create";
    const presentFields = dialogState.presentFields.length > 0 ? new Set(dialogState.presentFields) : null;
    return rowChanged(existingRow, previewRow, presentFields) ? "update" : "noop";
  }

  function actionBadge(action) {
    const map = {
      create: "neu",
      update: "ändern",
      noop: "unverändert",
      invalid: "ungültig",
    };
    return map[action] || esc(action);
  }

  function renderDialog(dialog) {
    const body = dialog.querySelector(".vv-import-dialog__body");
    if (!body) return;

    const isPartial = dialogState.presentFields.length > 0 && dialogState.presentFields.length < HEADER_EXPORT.length;
    const counts = { create: 0, update: 0, noop: 0, invalid: 0, excluded: 0 };
    dialogState.previewRows.forEach((row) => {
      if (row.excluded) { counts.excluded += 1; return; }
      if (counts[row.action] !== undefined) counts[row.action] += 1;
    });
    const summaryParts = [];
    if (counts.create) summaryParts.push(`${counts.create} neu`);
    if (counts.update) summaryParts.push(`${counts.update} ändern`);
    if (counts.noop) summaryParts.push(`${counts.noop} unverändert`);
    if (counts.invalid) summaryParts.push(`${counts.invalid} ungültig`);
    if (counts.excluded) summaryParts.push(`${counts.excluded} ausgeschlossen`);

    // Bearbeitbare Spalten: genau die Felder, die im Import-CSV vorhanden waren.
    // Bei Vollimport alle Felder, bei Teilmengenimport nur die importierten.
    // Wenn noch kein Preview geladen: alle Felder als Fallback (wird trotzdem keine Zeile zeigen).
    // member_number ist immer readonly – Identifikationsschlüssel.
    // sepa_approved ist immer readonly – Approval-Flag, nicht schreibbar via Import.
    const presentFieldSet = new Set(dialogState.presentFields);
    const NON_EDITABLE_IN_PREVIEW = new Set(["member_number", "sepa_approved"]);
    const editableFields = (dialogState.previewRows.length > 0 && presentFieldSet.size > 0)
      ? HEADER_EXPORT.filter(([key]) => !NON_EDITABLE_IN_PREVIEW.has(key) && presentFieldSet.has(key))
      : HEADER_EXPORT.filter(([key]) => !NON_EDITABLE_IN_PREVIEW.has(key));
    const totalCols = 4 + editableFields.length + 1;

    const previewRows = dialogState.previewRows.map((row, index) => {
      const isExcluded = row.excluded;
      const editableCells = editableFields.map(([key, label]) => `
        <td><input
          data-vv-row="${index}"
          data-vv-cell="${esc(key)}"
          value="${esc(String(row[key] ?? ""))}"
          aria-label="${esc(label)}"
          ${isExcluded ? "disabled" : ""}
        /></td>
      `).join("");
      return `
        <tr class="vv-import-row vv-import-row--${esc(row.action)}${isExcluded ? " vv-import-row--excluded" : ""}">
          <td><label><input type="checkbox" data-vv-exclude="${index}" ${!isExcluded ? "checked" : ""} /></label></td>
          <td>${index + 1}</td>
          <td><span class="vv-import-action vv-import-action--${esc(row.action)}">${actionBadge(row.action)}</span></td>
          <td><input value="${esc(row.member_number)}" readonly aria-label="Mitgliedsnummer" ${isExcluded ? "disabled" : ""} /></td>
          ${editableCells}
          <td class="small">${esc(row.warnings.join(" · ") || "-")}</td>
        </tr>
      `;
    }).join("");

    body.innerHTML = `
      <div class="vv-import-grid">
        <label class="ui-field">
          <span>Datei</span>
          <input type="file" accept=".csv,text/csv" data-vv-file="true" />
        </label>
        <label class="ui-field">
          <span>Trennzeichen</span>
          <select data-vv-delimiter="true">
            <option value=";" ${dialogState.delimiter === ";" ? "selected" : ""}>Semikolon (Standard)</option>
            <option value="," ${dialogState.delimiter === "," ? "selected" : ""}>Komma</option>
            <option value="tab" ${dialogState.delimiter === "tab" ? "selected" : ""}>Tab</option>
          </select>
        </label>
      </div>
      <p class="small">Export-Dateien aus diesem System verwenden Semikolon. Vorlage kann deutsch oder technisch beschriftet sein.</p>
      ${isPartial ? `<p class="small vv-import-partial-hint">Teilmengenimport – nur die im CSV vorhandenen Felder werden bearbeitet und aktualisiert. Fehlende Felder bleiben unverändert.</p>` : ""}
      ${dialogState.errors.length ? `<div class="qfp-inline-error">${esc(dialogState.errors.join(" · "))}</div>` : ""}
      ${summaryParts.length ? `<div class="vv-import-summary small">${summaryParts.join(" · ")}</div>` : ""}
      ${dialogState.previewRows.length ? `
      <div class="vv-import-bulk-actions">
        <button type="button" class="feed-btn feed-btn--ghost" data-vv-select-all="true">Alle freigeben</button>
        <button type="button" class="feed-btn feed-btn--ghost" data-vv-deselect-all="true">Alle ausschließen</button>
      </div>
      ` : ""}
      <div class="work-part-table-wrap vv-import-preview-wrap">
        <table class="work-part-table vv-import-preview-table">
          <thead>
            <tr>
              <th>☑</th>
              <th>#</th>
              <th>Aktion</th>
              <th>Mitglieds-Nr.</th>
              ${editableFields.map(([, label]) => `<th>${esc(label)}</th>`).join("")}
              <th>Hinweise</th>
            </tr>
          </thead>
          <tbody>
            ${previewRows || `<tr><td colspan="${totalCols}" class="small">Noch keine Preview geladen.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  async function rebuildPreview(dialog) {
    if (!(dialogState.file instanceof File)) {
      dialogState.errors = ["Bitte zuerst eine CSV-Datei wählen."];
      renderDialog(dialog);
      return;
    }
    const delimiter = dialogState.delimiter === "tab" ? "\t" : dialogState.delimiter;
    const fileText = await dialogState.file.text();
    const result = buildPreviewRows(fileText, dialogState.rows, delimiter);
    dialogState.previewRows = result.previewRows;
    dialogState.presentFields = result.presentFields || [];
    dialogState.errors = result.errors.concat(result.headerWarnings || []);
    renderDialog(dialog);
  }

  async function confirmImport(dialog) {
    const importable = (dialogState.previewRows || []).filter(
      (row) => (row.action === "create" || row.action === "update") && !row.excluded
    );
    if (!importable.length) {
      dialogState.errors = ["Keine importierbaren Zeilen vorhanden (create oder update)."];
      renderDialog(dialog);
      return;
    }
    dialogState.busy = true;
    try {
      // sepa_approved wird bewusst nicht gesendet: Approval-Flag, per DB-Constraint nur null/true erlaubt.
      const rowsPayload = importable.map((row) => ({
        member_number: row.member_number || null,
        first_name: row.first_name || null,
        last_name: row.last_name || null,
        email: row.email || null,
        status: row.status || "active",
        phone: row.phone || null,
        birthdate: row.birthdate || null,
        street: row.street || null,
        zip: row.postal_code || null,
        city: row.city || null,
      }));
      await sb("/rest/v1/rpc/import_csv_confirmed", {
        method: "POST",
        body: JSON.stringify({ p_club_id: dialogState.clubId, p_rows: rowsPayload }),
      }, true);
      dialogState.open = false;
      dialog.close();
      dialogState.onMessage?.("CSV-Import bestätigt.");
      await dialogState.reload?.();
    } catch (error) {
      dialogState.errors = [error instanceof Error ? error.message : "CSV-Import fehlgeschlagen."];
      renderDialog(dialog);
    } finally {
      dialogState.busy = false;
    }
  }

  async function handleMembersUtilityAction(detail = {}) {
    const actionKey = text(detail.actionKey);
    const itemKey = text(detail.itemKey);
    if (actionKey !== "members_more") return;
    if (itemKey === "export") {
      const cols = Array.isArray(detail.columns) ? detail.columns : [];
      exportMembers(Array.isArray(detail.rows) ? detail.rows : [], cols);
      detail.onMessage?.("Export erstellt.");
      return;
    }
    if (itemKey === "export_view") {
      const visibleCols = Array.isArray(detail.visibleColumns) ? detail.visibleColumns : [];
      const cols = Array.isArray(detail.columns) ? detail.columns : [];
      exportMembersView(Array.isArray(detail.rows) ? detail.rows : [], visibleCols, cols);
      detail.onMessage?.("View Export erstellt.");
      return;
    }
    if (itemKey === "import") {
      const dialog = ensureDialog();
      dialogState.clubId = currentClubId(detail.rows || []);
      dialogState.rows = Array.isArray(detail.rows) ? detail.rows.slice() : [];
      dialogState.previewRows = [];
      dialogState.presentFields = [];
      dialogState.errors = [];
      dialogState.file = null;
      dialogState.delimiter = ";";
      dialogState.onMessage = typeof detail.onMessage === "function" ? detail.onMessage : null;
      dialogState.reload = typeof detail.reload === "function" ? detail.reload : null;
      renderDialog(dialog);
      dialog.showModal();
    }
  }

  window.VereinsverwaltungAdmTools = Object.freeze({
    handleMembersUtilityAction,
  });
})();
