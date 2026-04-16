"use strict";

;(() => {
  const TEMPLATE_URL = "/import-templates/Vereinsverwaltung_Importvorlage.xlsx";
  const MAPPING_URL = "/import-templates/VDAN_Importvorlage_DB_Mapping.md";
  const PARSE_FN = "club-members-csv-parse";
  const CONFIRM_RPC = "csv_confirm_import";

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
  ];

  // Import-Alias-Map: dieselben Felder wie HEADER_EXPORT, plus deutschen Varianten.
  // Kein Feld hier, das nicht auch in HEADER_EXPORT oder buildImportCsv verarbeitet wird.
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
  };

  const dialogState = {
    open: false,
    busy: false,
    clubId: "",
    rows: [],
    file: null,
    delimiter: ";",
    previewRows: [],
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

  async function callMultipartFn(functionName, formData) {
    const { url, key } = cfg();
    const token = session()?.access_token || "";
    if (!url || !key) throw new Error("supabase_config_missing");
    if (!token) throw new Error("login_required");
    const res = await fetch(`${url}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      throw new Error(String(data?.error || `${functionName}_failed_${res.status}`));
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

  // Vergleicht die importierbaren Felder eines bestehenden DB-Eintrags mit dem
  // gemappten Import-Datensatz. Gibt true zurück wenn mindestens ein Feld abweicht.
  function rowChanged(existing, mapped) {
    if (!existing) return true;
    return (
      normalizeStatus(text(existing.status)) !== normalizeStatus(text(mapped.status || ""))
      || text(existing.first_name) !== text(mapped.first_name || "")
      || text(existing.last_name) !== text(mapped.last_name || "")
      || text(existing.email).toLowerCase() !== text(mapped.email || "").toLowerCase()
      || text(existing.phone) !== text(mapped.phone || "")
      || normalizeDate(text(existing.birthdate)).value !== normalizeDate(text(mapped.birthdate || "")).value
      || text(existing.street) !== text(mapped.street || "")
      || text(existing.zip) !== text(mapped.postal_code || "")
      || text(existing.city) !== text(mapped.city || "")
    );
  }

  // action-Werte: "create" | "update" | "noop" | "invalid"
  // create  = neue Mitgliedsnummer, wird angelegt
  // update  = bekannte Mitgliedsnummer, mindestens ein Feld geändert
  // noop    = bekannte Mitgliedsnummer, kein Feld geändert – wird nicht an Server gesendet
  // invalid = Mitgliedsnummer fehlt – Zeile wird übersprungen
  function buildPreviewRows(fileText, rows = [], delimiter = ";") {
    const parsed = parseCsv(fileText, delimiter);
    if (!parsed.length) {
      return { previewRows: [], errors: ["CSV ist leer."], headerWarnings: [] };
    }

    const [headerRow, ...bodyRows] = parsed;
    const canonicalHeaders = headerRow.map((header) => HEADER_ALIASES[normalizeHeader(header)] || "");
    const unknownHeaders = headerRow.filter((header, index) => !canonicalHeaders[index]).map((header) => text(header));
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

      const warnings = [];
      const memberNumber = stripClubPrefix(mapped.member_number);
      const birthdateInfo = normalizeDate(mapped.birthdate);

      if (!memberNumber) warnings.push("Mitgliedsnummer fehlt – Zeile ungültig.");
      if (memberNumber && seenNumbers.has(memberNumber)) warnings.push("Mitgliedsnummer doppelt in Datei.");
      if (memberNumber) seenNumbers.add(memberNumber);
      if (!birthdateInfo.valid) warnings.push("Ungültiges Datum – Geburtstagsfeld wird geleert.");
      if (unknownHeaders.length) warnings.push(`Unbekannte Spalten werden ignoriert: ${unknownHeaders.join(", ")}`);

      const isExisting = Boolean(memberNumber) && existingNumbers.has(memberNumber);
      let action;
      if (!memberNumber) {
        action = "invalid";
      } else if (isExisting) {
        action = rowChanged(existingByNumber.get(memberNumber), mapped) ? "update" : "noop";
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
        warnings,
        row_status: warnings.length ? "warning" : "ok",
        action,
      };
    });

    return {
      previewRows,
      errors: [],
      headerWarnings: unknownHeaders.length ? [`Unbekannte Spalten: ${unknownHeaders.join(", ")}`] : [],
    };
  }

  // Baut den internen CSV-Datensatz für den Server (club-members-csv-parse).
  // Trenner immer Komma – das ist das Server-Format, unabhängig vom User-Trenner.
  // Nur "create" und "update" Zeilen werden gesendet.
  // "noop" und "invalid" werden bewusst übersprungen.
  function buildImportCsv(previewRows) {
    const headers = [
      "member_no",
      "club_member_no",
      "first_name",
      "last_name",
      "status",
      "email",
      "phone",
      "birthdate",
      "street",
      "zip",
      "city",
    ];
    const lines = [headers.join(",")];
    previewRows
      .filter((row) => row.action === "create" || row.action === "update")
      .forEach((row) => {
        const values = [
          row.member_number,
          row.member_number,
          row.first_name,
          row.last_name,
          row.status,
          row.email,
          row.phone,
          row.birthdate,
          row.street,
          row.postal_code,
          row.city,
        ];
        lines.push(values.map(toCsvCell).join(","));
      });
    return lines.join("\n");
  }

  // Export liest genau die Felder aus HEADER_EXPORT – alle sind in admin_member_registry.expectedColumns.
  // Trennzeichen: Semikolon – identisch mit Import-Standard.
  function exportMembers(rows) {
    const lines = [HEADER_EXPORT.map(([, label]) => toCsvCell(label)).join(";")];
    rows.forEach((row) => {
      const data = {
        member_number: stripClubPrefix(row?.club_member_no || row?.member_number),
        status: text(row?.status),
        first_name: text(row?.first_name),
        last_name: text(row?.last_name),
        email: text(row?.email),
        phone: text(row?.phone),
        birthdate: text(row?.birthdate),
        street: text(row?.street),
        postal_code: text(row?.zip),
        city: text(row?.city),
      };
      lines.push(HEADER_EXPORT.map(([key]) => toCsvCell(data[key] ?? "")).join(";"));
    });
    downloadBlob("vereinsverwaltung_export_mitglieder.csv", lines.join("\n"), "text/csv;charset=utf-8");
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
      if (target?.matches?.("[data-vv-cell]")) {
        const rowIndex = Number(target.getAttribute("data-vv-row") || -1);
        const key = text(target.getAttribute("data-vv-cell"));
        if (rowIndex >= 0 && key && dialogState.previewRows[rowIndex]) {
          dialogState.previewRows[rowIndex][key] = text(target.value);
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
      if (target?.closest?.("[data-vv-confirm]")) {
        await confirmImport(dialog);
      }
    });

    return dialog;
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
    const previewRows = dialogState.previewRows.map((row, index) => `
      <tr class="vv-import-row vv-import-row--${esc(row.action)}">
        <td>${index + 1}</td>
        <td><span class="vv-import-action vv-import-action--${esc(row.action)}">${actionBadge(row.action)}</span></td>
        <td><input data-vv-row="${index}" data-vv-cell="member_number" value="${esc(row.member_number)}" /></td>
        <td><input data-vv-row="${index}" data-vv-cell="first_name" value="${esc(row.first_name)}" /></td>
        <td><input data-vv-row="${index}" data-vv-cell="last_name" value="${esc(row.last_name)}" /></td>
        <td><input data-vv-row="${index}" data-vv-cell="email" value="${esc(row.email)}" /></td>
        <td><input data-vv-row="${index}" data-vv-cell="status" value="${esc(row.status)}" /></td>
        <td>${esc(row.warnings.join(" · ") || "-")}</td>
      </tr>
    `).join("");

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
      ${dialogState.errors.length ? `<div class="qfp-inline-error">${esc(dialogState.errors.join(" · "))}</div>` : ""}
      <div class="work-part-table-wrap vv-import-preview-wrap">
        <table class="work-part-table vv-import-preview-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Aktion</th>
              <th>Mitgliedsnummer</th>
              <th>Vorname</th>
              <th>Nachname</th>
              <th>E-Mail</th>
              <th>Status</th>
              <th>Hinweise</th>
            </tr>
          </thead>
          <tbody>
            ${previewRows || `<tr><td colspan="8" class="small">Noch keine Preview geladen.</td></tr>`}
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
    dialogState.errors = result.errors.concat(result.headerWarnings || []);
    renderDialog(dialog);
  }

  async function confirmImport(dialog) {
    const importable = (dialogState.previewRows || []).filter((row) => row.action === "create" || row.action === "update");
    if (!importable.length) {
      dialogState.errors = ["Keine importierbaren Zeilen vorhanden (create oder update)."];
      renderDialog(dialog);
      return;
    }
    dialogState.busy = true;
    try {
      const csv = buildImportCsv(dialogState.previewRows);
      const formData = new FormData();
      formData.set("club_id", dialogState.clubId);
      formData.set("delimiter", ",");
      formData.set("has_header", "true");
      formData.set("file", new File([csv], "vereinsverwaltung_import.csv", { type: "text/csv" }));
      const parsed = await callMultipartFn(PARSE_FN, formData);
      const jobId = text(parsed?.job_id);
      if (!jobId) throw new Error("csv_job_missing");
      await sb(`/rest/v1/rpc/${CONFIRM_RPC}`, {
        method: "POST",
        body: JSON.stringify({ p_job_id: jobId }),
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
      exportMembers(Array.isArray(detail.rows) ? detail.rows : []);
      detail.onMessage?.("Export erstellt.");
      return;
    }
    if (itemKey === "import") {
      const dialog = ensureDialog();
      dialogState.clubId = currentClubId(detail.rows || []);
      dialogState.rows = Array.isArray(detail.rows) ? detail.rows.slice() : [];
      dialogState.previewRows = [];
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
