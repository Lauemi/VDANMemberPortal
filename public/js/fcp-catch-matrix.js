"use strict";

// FCP Catch Matrix — Fangstatistik-Matrixansicht (Fischart x Gewaesser)
// Verwendung: renderMode "catch-matrix" in ADM_natur_gewaesser.json
// Datenformat: flat rows { fish_species_id, fish_species_name, water_body_id, water_body_name, total_quantity }
// Einstiegspunkt: window.FcpCatchMatrix.renderPanel(mask, section, panel, emptyText)

;(() => {
  function renderPanel(mask, section, panel, emptyText) {
    const content = panel.loadedContent || panel.content || {};
    const contentRows = Array.isArray(content.rows) ? content.rows : null;
    const panelRows = Array.isArray(panel.rows) ? panel.rows : [];
    const rawRows = contentRows && contentRows.length ? contentRows : panelRows;

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

    const totalSpecies = speciesOrder.length;

    // Filter bar
    const filterBar = document.createElement("div");
    filterBar.className = "fcp-cm-filter-bar";

    const filterInput = document.createElement("input");
    filterInput.type = "search";
    filterInput.placeholder = "Fischart suchen …";
    filterInput.className = "fcp-cm-filter-input";
    filterInput.setAttribute("aria-label", "Fischarten filtern");

    const filterCount = document.createElement("span");
    filterCount.className = "fcp-cm-filter-count";
    filterCount.textContent = totalSpecies + " Fischarten";

    filterBar.appendChild(filterInput);
    filterBar.appendChild(filterCount);
    wrap.appendChild(filterBar);

    // Table
    const tableWrap = document.createElement("div");
    tableWrap.className = "fcp-cm-table-scroll";

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
      tr.dataset.fsname = fsName.toLowerCase();

      const rowHeader = document.createElement("th");
      rowHeader.className = "fcp-cm-species-header";
      rowHeader.setAttribute("scope", "row");
      rowHeader.setAttribute("title", fsName);
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
    tableWrap.appendChild(table);
    wrap.appendChild(tableWrap);

    // Summary line
    const totalQty = rawRows.reduce((s, r) => s + (Number(r.total_quantity) || 0), 0);
    const summary = document.createElement("p");
    summary.className = "fcp-catch-matrix-summary";
    summary.textContent =
      totalSpecies + " Fischart" + (totalSpecies !== 1 ? "en" : "") +
      " · " + waterOrder.length + " Gewässer · " +
      totalQty + " Fische gesamt";
    wrap.appendChild(summary);

    // Filter logic
    filterInput.addEventListener("input", () => {
      const q = filterInput.value.trim().toLowerCase();
      let visible = 0;
      tbody.querySelectorAll("tr").forEach((tr) => {
        const match = !q || tr.dataset.fsname.includes(q);
        tr.classList.toggle("fcp-cm-row--hidden", !match);
        if (match) visible++;
      });
      filterCount.textContent = q
        ? visible + " von " + totalSpecies + " Fischarten"
        : totalSpecies + " Fischarten";
    });

    return wrap;
  }

  // Inject styles once
  if (!document.getElementById("fcp-catch-matrix-styles")) {
    const s = document.createElement("style");
    s.id = "fcp-catch-matrix-styles";
    s.textContent = [
      // Wrap + scroll
      ".fcp-catch-matrix-wrap{overflow-x:auto;padding-bottom:.5rem}",
      ".fcp-cm-table-scroll{overflow-x:auto}",

      // Filter bar
      ".fcp-cm-filter-bar{display:flex;align-items:center;gap:.625rem;margin-bottom:.75rem}",
      ".fcp-cm-filter-input{flex:0 0 auto;width:13rem;padding:.3125rem .625rem;font-size:.75rem;border:1px solid var(--rd-line,rgba(108,112,91,.14));border-radius:5px;background:#fff;color:var(--rd-ink,#2a2d24);outline:none;transition:border-color .15s}",
      ".fcp-cm-filter-input:focus{border-color:var(--rd-gold,#d46a20)}",
      ".fcp-cm-filter-count{font-size:.6875rem;color:var(--rd-muted,#7a7c68)}",

      // Table base
      ".fcp-catch-matrix-table{border-collapse:collapse;font-size:.75rem;color:var(--rd-ink,#2a2d24);min-width:max-content}",

      // Corner cell
      ".fcp-cm-corner{background:transparent;border:none;min-width:11rem;max-width:11rem}",

      // Water column headers (vertical labels)
      ".fcp-cm-water-header{background:var(--rd-gold-softer,rgba(212,106,32,.06));border:1px solid var(--rd-line,rgba(108,112,91,.14));vertical-align:bottom;padding:.5rem .25rem .375rem;text-align:center;max-width:2.75rem}",
      ".fcp-cm-water-label{display:block;writing-mode:vertical-rl;transform:rotate(180deg);color:var(--rd-ink-2,#4a4e40);font-weight:600;font-size:.6875rem;letter-spacing:.02em;white-space:nowrap;min-height:4.5rem}",

      // Species row header — capped width with ellipsis
      ".fcp-cm-species-header{background:#faf9f5;border:1px solid var(--rd-line,rgba(108,112,91,.14));padding:.375rem .75rem;text-align:left;color:var(--rd-ink,#2a2d24);font-weight:500;font-size:.75rem;min-width:9rem;max-width:11rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",

      // Value cells
      ".fcp-cm-cell{border:1px solid var(--rd-line,rgba(108,112,91,.14));padding:.375rem .5rem;text-align:center;font-variant-numeric:tabular-nums;font-size:.8125rem;background:#fff}",
      ".fcp-cm-cell--has-value{background:rgba(22,101,52,.07);color:#166534;font-weight:600}",
      ".fcp-cm-cell--zero{background:#fff;color:rgba(108,112,91,.4)}",

      // Filter: hidden rows
      ".fcp-cm-row--hidden{display:none}",

      // Summary + empty
      ".fcp-catch-matrix-summary{margin-top:.75rem;font-size:.6875rem;color:var(--rd-muted,#7a7c68);letter-spacing:.02em}",
      ".fcp-catch-matrix-empty{color:var(--rd-muted,#7a7c68)}",
    ].join("");
    document.head.appendChild(s);
  }

  window.FcpCatchMatrix = { renderPanel };
})();
