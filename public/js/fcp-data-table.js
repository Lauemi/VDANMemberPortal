;(() => {
  const COMPONENT_NAME = "FCP Data Table v1";
  const STANDARD_WRAP_CLASS = "fangliste-table-wrap";
  const STANDARD_TABLE_CLASS = "data-table--fangliste";
  const STANDARD_HEAD_CLASS = "data-table__head--fangliste";
  const STANDARD_ROW_CLASS = "data-table__row--fangliste";

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function normalizeText(value) {
    return String(value ?? "").trim().toLowerCase();
  }

  function cloneFilters(columns, input) {
    const next = {};
    columns.forEach((column) => {
      next[column.key] = String(input?.[column.key] ?? "");
    });
    return next;
  }

  function readValue(column, row) {
    if (typeof column.value === "function") return column.value(row);
    return row?.[column.key];
  }

  function readFilterValue(column, row) {
    if (typeof column.filterValue === "function") return column.filterValue(row);
    return readValue(column, row);
  }

  function readSortValue(column, row) {
    if (typeof column.sortValue === "function") return column.sortValue(row);
    return readValue(column, row);
  }

  function compareValues(a, b, column) {
    if (column.sortType === "number") {
      const av = Number(a);
      const bv = Number(b);
      const aValid = Number.isFinite(av);
      const bValid = Number.isFinite(bv);
      if (aValid && bValid) return av - bv;
      if (aValid) return -1;
      if (bValid) return 1;
      return 0;
    }
    return String(a ?? "").localeCompare(String(b ?? ""), "de", { numeric: true, sensitivity: "base" });
  }

  function joinClasses(...values) {
    return values.filter(Boolean).join(" ");
  }

  function isNumericColumn(column) {
    return column?.numeric === true
      || column?.sortType === "number"
      || column?.type === "numeric"
      || column?.type === "actions";
  }

  function defaultAlign(column) {
    if (column?.key === "actions" || column?.type === "actions") return "right";
    return isNumericColumn(column) ? "right" : "left";
  }

  function normalizeColumns(columns) {
    return columns.map((column) => {
      const normalized = { ...column };
      normalized.sortable = column?.sortable !== false;
      normalized.filterable = column?.filterable !== false;
      normalized.align = column?.align || defaultAlign(column);
      normalized.emptyValue = column?.emptyValue ?? "-";
      normalized.numeric = normalized.align === "right" || isNumericColumn(normalized);
      if (normalized.key === "actions" || normalized.type === "actions") {
        normalized.sortable = false;
        normalized.filterable = false;
        normalized.align = "right";
        normalized.numeric = true;
      }
      return normalized;
    });
  }

  function inferRowKey(config) {
    if (typeof config?.rowKey === "function") return config.rowKey;

    const rowKeyField = String(config?.rowKeyField || "").trim();
    if (rowKeyField) return (row) => row?.[rowKeyField];

    const candidates = ["id", "uuid", "row_id", "source_id"];
    return (row) => {
      for (const candidate of candidates) {
        const value = row?.[candidate];
        if (value !== undefined && value !== null && String(value).trim()) return value;
      }
      return row?.id;
    };
  }

  function ensureRowKey(config, rows = []) {
    if (typeof config?.rowKey === "function" || String(config?.rowKeyField || "").trim()) return;
    if (!rows.length) return;
    const sample = rows.find(Boolean);
    if (!sample) return;
    const inferred = ["id", "uuid", "row_id", "source_id"].some((key) => sample?.[key] !== undefined && sample?.[key] !== null);
    if (!inferred) {
      console.warn(`${COMPONENT_NAME}: Kein stabiler rowKey erkannt. Bitte rowKey oder rowKeyField aus der SQL mitgeben.`);
    }
  }

  function createStandardV1(config = {}) {
    const normalizedColumns = normalizeColumns(Array.isArray(config?.columns) ? config.columns : []);
    const rowInteractionMode = String(config?.rowInteractionMode || "dialog").trim() || "dialog";
    const selectionMode = String(config?.selectionMode || (rowInteractionMode === "none" ? "none" : "single")).trim();
    const rowKey = inferRowKey(config);
    const nextConfig = {
      ...config,
      columns: normalizedColumns,
      rowKey,
      rowInteractionMode,
      selectionMode,
      wrapClassName: joinClasses(STANDARD_WRAP_CLASS, config?.wrapClassName),
      tableClassName: joinClasses(STANDARD_TABLE_CLASS, config?.tableClassName),
      headClassName: joinClasses(STANDARD_HEAD_CLASS, config?.headClassName),
      rowClassName: joinClasses(STANDARD_ROW_CLASS, config?.rowClassName),
    };
    const instance = createV1(nextConfig);
    const originalSetRows = instance.setRows;
    instance.setRows = (rows) => {
      ensureRowKey(config, Array.isArray(rows) ? rows : []);
      return originalSetRows(rows);
    };
    return instance;
  }

  function createV1(config) {
    const root = config?.root;
    if (!(root instanceof HTMLElement)) {
      throw new Error("FCP Data Table v1 benötigt ein gültiges root-Element.");
    }

    const columns = Array.isArray(config?.columns) ? config.columns.filter((column) => column?.key && column?.label) : [];
    if (!columns.length) {
      throw new Error("FCP Data Table v1 benötigt mindestens eine Spalte.");
    }

    const filterPanel = config?.filterPanel instanceof HTMLElement ? config.filterPanel : null;
    const rowKey = typeof config?.rowKey === "function" ? config.rowKey : (row) => row?.id;
    const gridTemplateColumns = String(config?.gridTemplateColumns || "").trim();
    const initialSortKey = columns.some((column) => column.key === config?.initialState?.sortKey)
      ? config.initialState.sortKey
      : columns[0].key;
    const state = {
      sortKey: initialSortKey,
      sortDir: String(config?.initialState?.sortDir || "asc").toLowerCase() === "desc" ? "desc" : "asc",
      filters: cloneFilters(columns, config?.initialState?.filters || {}),
      selectedRowId: String(config?.initialState?.selectedRowId || "").trim() || null,
      viewMode: String(config?.viewMode || config?.initialState?.viewMode || "table").trim() || "table",
    };

    let rows = [];
    let lastRenderedRows = [];

    function emitStateChange(reason) {
      config?.onStateChange?.({
        reason,
        sortKey: state.sortKey,
        sortDir: state.sortDir,
        filters: { ...state.filters },
        activeFilterCount: activeFilterCount(),
        selectedRowId: state.selectedRowId,
        viewMode: state.viewMode,
      });
    }

    function activeFilterCount() {
      return Object.values(state.filters).filter((value) => normalizeText(value)).length;
    }

    function headerHtml(column) {
      const isActiveSort = state.sortKey === column.key;
      const hasFilter = normalizeText(state.filters[column.key]);
      const ariaSort = isActiveSort ? (state.sortDir === "asc" ? "ascending" : "descending") : "none";
      const classes = [
        "data-table__headcell",
        (column.numeric || column.align === "right") ? "data-table__headcell--numeric" : "",
        isActiveSort ? "is-active" : "",
        hasFilter ? "has-filter" : "",
      ].filter(Boolean).join(" ");
      const sortIcon = isActiveSort ? (state.sortDir === "asc" ? "↑" : "↓") : "";
      const sortable = column.sortable !== false;
      return `
        <span class="${classes}" role="columnheader" aria-sort="${ariaSort}">
          <button type="button" class="data-table__sort ${isActiveSort ? "is-active" : ""}" ${sortable ? `data-fcp-sort-key="${esc(column.key)}"` : ""} aria-label="${esc(column.label)} sortieren" ${sortable ? "" : "disabled"}>
            <span class="data-table__sort-label">${esc(column.label)}</span>
            <span class="data-table__sort-icon" aria-hidden="true">${sortIcon}</span>
          </button>
        </span>
      `;
    }

    function rowHtml(row) {
      const key = rowKey(row);
      const rowClasses = [
        "data-table__row",
        config?.rowClassName || "",
        state.selectedRowId && String(key) === state.selectedRowId ? "is-selected" : "",
      ].filter(Boolean).join(" ");
      const rowStyle = gridTemplateColumns ? ` style="grid-template-columns:${esc(gridTemplateColumns)}"` : "";
      const cells = columns.map((column) => {
        const value = readValue(column, row);
        const cellClasses = [
          "data-table__cell",
          column.cellClass || "",
        ].filter(Boolean).join(" ");
        const rendered = value ?? column.emptyValue ?? "-";
        if (typeof column.renderHtml === "function") {
          return `<span class="${cellClasses}" data-label="${esc(column.label)}">${column.renderHtml(row, rendered)}</span>`;
        }
        return `<span class="${cellClasses}" data-label="${esc(column.label)}">${esc(rendered)}</span>`;
      }).join("");
      const interactiveAttrs = config?.onRowClick
        ? ` tabindex="0" aria-label="${esc(`Zeile ${key}`)}"`
        : "";
      return `<div class="${rowClasses}" role="row" data-fcp-row-id="${esc(key)}"${interactiveAttrs}${rowStyle}>${cells}</div>`;
    }

    function filteredRows() {
      let nextRows = rows.slice();

      nextRows = nextRows.filter((row) => columns.every((column) => {
        if (column.filterable === false) return true;
        const needle = normalizeText(state.filters[column.key]);
        if (!needle) return true;
        return normalizeText(readFilterValue(column, row)).includes(needle);
      }));

      const sortColumn = columns.find((column) => column.key === state.sortKey) || columns[0];
      const direction = state.sortDir === "desc" ? -1 : 1;
      nextRows.sort((a, b) => compareValues(readSortValue(sortColumn, a), readSortValue(sortColumn, b), sortColumn) * direction);
      return nextRows;
    }

    function renderFilterPanel() {
      if (!filterPanel) return;
      filterPanel.innerHTML = columns
        .filter((column) => column.filterable !== false)
        .map((column) => `
        <label class="ui-field">
          <span>${esc(column.label)}</span>
          <input
            type="text"
            data-fcp-col-filter="${esc(column.key)}"
            placeholder="${esc(column.placeholder || "")}"
            value="${esc(state.filters[column.key] || "")}"
          />
        </label>
      `).join("");
      filterPanel.dataset.fcpComponent = COMPONENT_NAME;
      filterPanel.dataset.fcpComponentId = String(config?.componentId || "").trim();
    }

    function render() {
      lastRenderedRows = filteredRows();
      root.dataset.fcpComponent = COMPONENT_NAME;
      root.dataset.fcpComponentId = String(config?.componentId || "").trim();
      root.innerHTML = `
        <div class="${esc(config?.wrapClassName || "")}">
          <div class="data-table ${esc(config?.tableClassName || "")}" role="table" aria-label="${esc(config?.ariaLabel || COMPONENT_NAME)}">
            <div class="data-table__head ${esc(config?.headClassName || "")}" role="row"${gridTemplateColumns ? ` style="grid-template-columns:${esc(gridTemplateColumns)}"` : ""}>
              ${columns.map(headerHtml).join("")}
            </div>
            ${lastRenderedRows.map(rowHtml).join("")}
          </div>
        </div>
      `;

      if (!lastRenderedRows.length) {
        root.innerHTML = config?.emptyStateHtml || `<p class="small">Keine Einträge vorhanden.</p>`;
      }

      renderFilterPanel();
      config?.onRender?.({
        rows: lastRenderedRows.slice(),
        state: {
          sortKey: state.sortKey,
          sortDir: state.sortDir,
          filters: { ...state.filters },
          activeFilterCount: activeFilterCount(),
          selectedRowId: state.selectedRowId,
          viewMode: state.viewMode,
        },
      });
    }

    function setRows(nextRows) {
      rows = Array.isArray(nextRows) ? nextRows.slice() : [];
      render();
    }

    function setState(nextState, options = {}) {
      const sortKey = String(nextState?.sortKey || state.sortKey);
      if (columns.some((column) => column.key === sortKey)) {
        state.sortKey = sortKey;
      }
      state.sortDir = String(nextState?.sortDir || state.sortDir).toLowerCase() === "desc" ? "desc" : "asc";
      state.filters = cloneFilters(columns, nextState?.filters || state.filters);
      state.selectedRowId = String(nextState?.selectedRowId || state.selectedRowId || "").trim() || null;
      state.viewMode = String(nextState?.viewMode || state.viewMode || "table").trim() || "table";
      if (options.render !== false) render();
      if (!options.silent) emitStateChange(options.reason || "state");
    }

    function resetFilters(options = {}) {
      state.filters = cloneFilters(columns, {});
      if (options.render !== false) render();
      config?.onReset?.({
        filters: { ...state.filters },
        activeFilterCount: activeFilterCount(),
      });
      if (!options.silent) emitStateChange(options.reason || "filters-reset");
    }

    function focusFilter(key) {
      if (!filterPanel) return;
      const input = filterPanel.querySelector(`[data-fcp-col-filter="${CSS.escape(String(key || ""))}"]`);
      if (!(input instanceof HTMLInputElement)) return;
      window.requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      });
    }

    root.addEventListener("click", (event) => {
      const sortBtn = event.target?.closest?.("[data-fcp-sort-key]");
      if (sortBtn) {
        const key = String(sortBtn.getAttribute("data-fcp-sort-key") || "").trim();
        if (!key) return;
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        } else {
          state.sortKey = key;
          state.sortDir = "asc";
        }
        render();
        config?.onSortChange?.({
          sortKey: state.sortKey,
          sortDir: state.sortDir,
        });
        emitStateChange("sort");
        return;
      }

      const actionBtn = event.target?.closest?.("[data-fcp-action]");
      if (actionBtn) {
        const rowEl = actionBtn.closest("[data-fcp-row-id]");
        const rowId = String(rowEl?.getAttribute?.("data-fcp-row-id") || "").trim();
        const action = String(actionBtn.getAttribute("data-fcp-action") || "").trim();
        const row = lastRenderedRows.find((entry) => String(rowKey(entry)) === rowId);
        if (!row || !action) return;
        event.preventDefault();
        event.stopPropagation();
        config?.onRowAction?.({ action, row, event });
        return;
      }

      const rowEl = event.target?.closest?.("[data-fcp-row-id]");
      if (!rowEl) return;
      const rowId = String(rowEl.getAttribute("data-fcp-row-id") || "").trim();
      const row = lastRenderedRows.find((entry) => String(rowKey(entry)) === rowId);
      if (!row) return;
      state.selectedRowId = rowId;
      config?.onSelectionChange?.({
        selectionMode: String(config?.selectionMode || "none"),
        selectedRowId: state.selectedRowId,
      });
      config?.onRowClick?.(row, event);
      emitStateChange("row-click");
    });

    root.addEventListener("keydown", (event) => {
      if (event.defaultPrevented) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      const rowEl = event.target?.closest?.("[data-fcp-row-id]");
      if (!rowEl) return;
      if (event.target?.closest?.("[data-fcp-action]")) return;
      const rowId = String(rowEl.getAttribute("data-fcp-row-id") || "").trim();
      const row = lastRenderedRows.find((entry) => String(rowKey(entry)) === rowId);
      if (!row) return;
      event.preventDefault();
      state.selectedRowId = rowId;
      config?.onSelectionChange?.({
        selectionMode: String(config?.selectionMode || "none"),
        selectedRowId: state.selectedRowId,
      });
      config?.onRowClick?.(row, event);
      emitStateChange("row-keydown");
    });

    filterPanel?.addEventListener("input", (event) => {
      const key = String(event.target?.getAttribute?.("data-fcp-col-filter") || "").trim();
      if (!key || !(key in state.filters)) return;
      state.filters[key] = String(event.target.value || "");
      config?.onFilterInput?.(key, state.filters[key]);
      render();
      config?.onFilterChange?.({
        key,
        value: state.filters[key],
        filters: { ...state.filters },
        activeFilterCount: activeFilterCount(),
      });
      emitStateChange("filter");
    });

    return {
      componentName: COMPONENT_NAME,
      getState() {
        return {
          sortKey: state.sortKey,
          sortDir: state.sortDir,
          filters: { ...state.filters },
          activeFilterCount: activeFilterCount(),
          selectedRowId: state.selectedRowId,
          viewMode: state.viewMode,
        };
      },
      getActiveFilterCount: activeFilterCount,
      getRows() {
        return lastRenderedRows.slice();
      },
      setRows,
      setState,
      resetFilters,
      render,
      focusFilter,
    };
  }

  window.FCPDataTable = Object.freeze({
    createV1,
    createStandardV1,
  });
})();
