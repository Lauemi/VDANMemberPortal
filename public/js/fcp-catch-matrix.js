"use strict";

// FCP Catch Matrix — Fangstatistik-Matrixansicht (Fischart x Gewaesser)
// Verwendung: renderMode "catch-matrix" in ADM_natur_gewaesser.json
// Datenformat: flat rows { fish_species_id, fish_species_name, water_body_id, water_body_name, total_quantity }
// Einstiegspunkt: window.FcpCatchMatrix.renderPanel(mask, section, panel, emptyText)

;(() => {
  function renderPanel(mask, section, panel, emptyText) {
    const content = panel.loadedContent || panel.content || {};
    const rawRows = Array.isArray(content.rows)
      ? content.rows
      : Array.isArray(panel.rows)
        ? panel.rows
        : [];

    const wrap = document.createElement("div");
    wrap.className = "fcp-catch-matrix-wrap";

    if (!rawRows.length) {
      const msg = panel.state?.error || emptyText || "Keine Fangdaten verfügbar.";
      const empty = document.createElement("p");
      empty.className = "small fcp-catch-matrix-empty";
      empty.textContent = msg;
      wrap.appendChild(empty);
      return wrap;
    }

    // Build pivot
    const waterOrder = [];
    const waterMap = new Map(); // id -> name (insertion-ordered)
    const speciesOrder = [];
    const speciesMap = new Map(); // id -> name
    const matrix = {}; // "fsId:wbId" -> total_quantity

    rawRows.forEach((row) => {
      const wbId = row.water_body_id;
      const fsId = row.fish_species_id;
      if (!waterMap.has(wbId)) {
        waterMap.set(wbId, row.water_body_name || "-");
        waterOrder.push(wbId);
      }
      if (!speciesMap.has(fsId)) {
        speciesMap.set(fsId, row.fish_species_name || "-");
        speciesOrder.push(fsId);
      }
      matrix[`${fsId}:${wbId}`] = Number(row.total_quantity) || 0;
    });

    const table = document.createElement("table");
    table.className = "fcp-catch-matrix-table";
    table.setAttribute("role", "grid");

    // Header row — corner + one th per Gewässer (vertical label)
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const corner = document.createElement("th");
    corner.className = "fcp-cm-corner";
    corner.setAttribute("scope", "col");
    headerRow.appendChild(corner);

    waterOrder.forEach((wbId) => {
      const wbName = waterMap.get(wbId);
      const th = document.createElement("th");
      th.className = "fcp-cm-water-header";
      th.setAttribute("scope", "col");
      th.setAttribute("title", wbName);
      const span = document.createElement("span");
      span.className = "fcp-cm-water-label";
      span.textContent = wbName;
      th.appendChild(span);
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body — one row per fish species
    const tbody = document.createElement("tbody");
    speciesOrder.forEach((fsId) => {
      const fsName = speciesMap.get(fsId);
      const tr = document.createElement("tr");

      const rowHeader = document.createElement("th");
      rowHeader.className = "fcp-cm-species-header";
      rowHeader.setAttribute("scope", "row");
      rowHeader.textContent = fsName;
      tr.appendChild(rowHeader);

      waterOrder.forEach((wbId) => {
        const qty = matrix[`${fsId}:${wbId}`] ?? 0;
        const td = document.createElement("td");
        td.className = qty > 0 ? "fcp-cm-cell fcp-cm-cell--has-value" : "fcp-cm-cell fcp-cm-cell--zero";
        td.textContent = qty > 0 ? String(qty) : "—";
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrap.appendChild(table);

    // Summary line
    const totalQty = rawRows.reduce((s, r) => s + (Number(r.total_quantity) || 0), 0);
    const summary = document.createElement("p");
    summary.className = "fcp-catch-matrix-summary";
    summary.textContent =
      speciesOrder.length + " Fischart" + (speciesOrder.length !== 1 ? "en" : "") +
      " · " + waterOrder.length + " Gewässer · " +
      totalQty + " Fische gesamt";
    wrap.appendChild(summary);

    return wrap;
  }

  // Inject styles once
  if (!document.getElementById("fcp-catch-matrix-styles")) {
    const s = document.createElement("style");
    s.id = "fcp-catch-matrix-styles";
    s.textContent = [
      ".fcp-catch-matrix-wrap{overflow-x:auto;padding-bottom:.5rem}",
      ".fcp-catch-matrix-table{border-collapse:collapse;font-size:.75rem;color:#e2e8f0;min-width:max-content}",
      ".fcp-cm-corner{background:transparent;border:none;min-width:9rem}",
      ".fcp-cm-water-header{background:#1e293b;border:1px solid #334155;vertical-align:bottom;padding:.5rem .25rem .375rem;text-align:center;max-width:2.75rem}",
      ".fcp-cm-water-label{display:block;writing-mode:vertical-rl;transform:rotate(180deg);color:#94a3b8;font-weight:600;font-size:.6875rem;letter-spacing:.02em;white-space:nowrap;min-height:4.5rem}",
      ".fcp-cm-species-header{background:#1e293b;border:1px solid #334155;padding:.375rem .75rem;text-align:left;color:#cbd5e1;font-weight:500;font-size:.75rem;white-space:nowrap}",
      ".fcp-cm-cell{border:1px solid #334155;padding:.375rem .5rem;text-align:center;font-variant-numeric:tabular-nums;font-size:.8125rem}",
      ".fcp-cm-cell--has-value{background:#0c2a1c;color:#4ade80;font-weight:600}",
      ".fcp-cm-cell--zero{background:#0f172a;color:#334155}",
      ".fcp-catch-matrix-summary{margin-top:.75rem;font-size:.6875rem;color:#64748b;letter-spacing:.02em}",
      ".fcp-catch-matrix-empty{color:#64748b}",
    ].join("");
    document.head.appendChild(s);
  }

  window.FcpCatchMatrix = { renderPanel };
})();
