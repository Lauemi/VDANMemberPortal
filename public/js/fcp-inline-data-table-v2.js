;(() => {
  const COMPONENT_NAME = "FCP Inline Data Table v2";
  const contractHub = window.FcpAdmQfmContractHub || {};
  const fieldContracts = contractHub.field || {};

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

  function compareValues(a, b) {
    const aNum = Number(a);
    const bNum = Number(b);
    const aFinite = Number.isFinite(aNum);
    const bFinite = Number.isFinite(bNum);
    if (aFinite && bFinite) return aNum - bNum;
    return String(a ?? "").localeCompare(String(b ?? ""), "de", { numeric: true, sensitivity: "base" });
  }

  function cloneRow(input = {}) {
    return JSON.parse(JSON.stringify(input || {}));
  }

  function joinClasses(...values) {
    return values.filter(Boolean).join(" ");
  }

  function defaultEmptyValue(column) {
    return column?.emptyValue ?? "-";
  }

  function readValue(column, row) {
    if (typeof column?.value === "function") return column.value(row);
    return row?.[column.key];
  }

  function renderDisplayValue(column, row) {
    const raw = readValue(column, row);
    if (typeof column?.renderHtml === "function") return column.renderHtml(row, raw);
    if (column?.type === "json-display" && Array.isArray(raw)) {
      return raw.length
        ? raw.map((item) => `<span class="inline-token">${esc(item?.label || item?.name || item)}</span>`).join("")
        : esc(defaultEmptyValue(column));
    }
    if (typeof fieldContracts.formatFieldDisplayValue === "function") {
      return esc(fieldContracts.formatFieldDisplayValue(column, raw));
    }
    return esc(raw ?? defaultEmptyValue(column));
  }

  function normalizeColumns(columns = []) {
    return columns
      .filter((column) => column?.key && column?.label)
      .map((column) => ({
        sortable: column?.sortable !== false,
        filterable: column?.filterable !== false,
        editable: column?.editable !== false,
        align: column?.align || (column?.type === "numeric" || column?.type === "actions" ? "right" : "left"),
        editorType: column?.editorType || "text",
        persistWidth: column?.persistWidth !== false,
        draggable: column?.draggable !== false,
        ...column,
      }));
  }

  function createStandardV2(config = {}) {
    const root = config?.root;
    if (!(root instanceof HTMLElement)) {
      throw new Error(`${COMPONENT_NAME} braucht ein gueltiges root-Element.`);
    }

    const columns = normalizeColumns(config?.columns || []);
    if (!columns.length) {
      throw new Error(`${COMPONENT_NAME} braucht mindestens eine Spalte.`);
    }

    const storageKey = `fcp-inline-table-layout-v2::${String(config?.tableId || "default").trim() || "default"}`;
    const filterFields = Array.isArray(config?.filterFields) ? config.filterFields : [];
    const initialRows = Array.isArray(config?.rows) ? config.rows : [];
    const initialViewMode = String(config?.viewMode || "table").trim() || "table";
    const initialColumns = columns.map((column) => column.key);
    const initialSortKey = String(config?.sortKey || columns.find((column) => column.type !== "actions")?.key || columns[0].key);
    const state = {
      rows: initialRows.slice(),
      search: "",
      filters: Object.fromEntries(filterFields.map((field) => [field.key, field.defaultValue ?? ""])),
      filterPanelOpen: true,
      createOpen: false,
      openUtilityMenuKey: "",
      openEditorRowId: "",
      draftCreate: typeof config?.getCreateDefaults === "function" ? cloneRow(config.getCreateDefaults()) : {},
      draftEdit: {},
      viewMode: initialViewMode,
      sortKey: initialSortKey,
      sortDir: String(config?.sortDir || "asc").toLowerCase() === "desc" ? "desc" : "asc",
      columnOrder: initialColumns.slice(),
      columnWidths: Object.fromEntries(columns.map((column) => [column.key, column.width || "minmax(120px, 1fr)"])),
      layoutDirty: false,
      feedback: null,
    };
    let dragColumnKey = "";
    let lastTableScrollLeft = 0;
    let feedbackTimer = 0;

    function configuredRowActions() {
      const raw = Array.isArray(config?.rowActions) ? config.rowActions : ["edit", "duplicate", "delete"];
      const allowed = new Set(["edit", "duplicate", "delete"]);
      const filtered = raw.map((entry) => String(entry || "").trim().toLowerCase()).filter((entry) => allowed.has(entry));
      return filtered.length ? filtered : ["edit", "duplicate", "delete"];
    }

    function rowActionsHtml() {
      const actions = configuredRowActions();
      return actions.map((action) => {
        if (action === "edit") {
          return `<button type="button" class="feed-btn feed-btn--ghost row-action-btn" data-row-action="edit" aria-label="Bearbeiten">✎</button>`;
        }
        if (action === "duplicate") {
          return `<button type="button" class="feed-btn feed-btn--ghost row-action-btn" data-row-action="duplicate" aria-label="Duplizieren">⧉</button>`;
        }
        if (action === "delete") {
          return `<button type="button" class="feed-btn feed-btn--ghost row-action-btn row-action-btn--danger" data-row-action="delete" aria-label="Löschen">🗑</button>`;
        }
        return "";
      }).join("");
    }

    try {
      const persisted = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (persisted?.viewMode === "cards" || persisted?.viewMode === "table") {
        state.viewMode = persisted.viewMode;
      }
      if (Array.isArray(persisted?.columnOrder)) {
        const allowed = new Set(initialColumns);
        const ordered = persisted.columnOrder.filter((key) => allowed.has(key));
        const missing = initialColumns.filter((key) => !ordered.includes(key));
        state.columnOrder = [...ordered, ...missing];
      }
      if (persisted?.columnWidths && typeof persisted.columnWidths === "object") {
        state.columnWidths = { ...state.columnWidths, ...persisted.columnWidths };
      }
      if (!config?.sortKey && persisted?.sortKey && initialColumns.includes(persisted.sortKey)) {
        state.sortKey = persisted.sortKey;
        state.sortDir = persisted?.sortDir === "desc" ? "desc" : "asc";
      }
    } catch {
      // noop
    }

    function persistLayout() {
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          viewMode: state.viewMode,
          sortKey: state.sortKey,
          sortDir: state.sortDir,
          columnOrder: state.columnOrder,
          columnWidths: state.columnWidths,
        }));
      } catch {
        // noop
      }
    }

    function orderedColumns() {
      const map = new Map(columns.map((column) => [column.key, column]));
      return state.columnOrder
        .map((key) => map.get(key))
        .filter(Boolean)
        .map((column) => ({
          ...column,
          width: state.columnWidths[column.key] || column.width || "minmax(120px, 1fr)",
        }));
    }

    function rowKey(row) {
      if (typeof config?.rowKey === "function") return String(config.rowKey(row) || "");
      const configuredField = String(config?.rowKeyField || "").trim();
      if (configuredField) {
        const configuredValue = row?.[configuredField];
        if (configuredValue != null && String(configuredValue).trim()) {
          return String(configuredValue);
        }
      }
      return String(
        row?.id
        || row?.row_id
        || row?.member_no
        || row?.club_member_no
        || row?.profile_user_id
        || ""
      );
    }

    function setFeedback(type, text) {
      state.feedback = text ? { type: String(type || "info"), text: String(text || "") } : null;
      if (feedbackTimer) window.clearTimeout(feedbackTimer);
      if (state.feedback) {
        feedbackTimer = window.setTimeout(() => {
          state.feedback = null;
          render();
        }, 2400);
      }
    }

    function applyOptimisticEdit(rowId, draft = {}) {
      state.rows = state.rows.map((entry) => {
        if (rowKey(entry) !== rowId) return entry;
        return { ...entry, ...cloneRow(draft) };
      });
    }

    function filteredRows() {
      const needle = normalizeText(state.search);
      const activeColumns = orderedColumns();
      const haystackColumns = activeColumns.filter((column) => column.type !== "actions");
      let filtered = !needle ? state.rows.slice() : state.rows.filter((row) => haystackColumns.some((column) => {
        const value = readValue(column, row);
        if (Array.isArray(value)) return value.some((entry) => normalizeText(entry?.label || entry?.name || entry).includes(needle));
        return normalizeText(value).includes(needle);
      }));
      if (filterFields.length) {
        filtered = filtered.filter((row) => filterFields.every((field) => {
          const current = state.filters[field.key];
          if (field.type === "checkbox") {
            if (!current) return true;
            const raw = typeof field.value === "function" ? field.value(row) : row?.[field.key];
            return Boolean(raw);
          }
          if (field.type === "select") {
            const selected = String(current ?? "").trim().toLowerCase();
            const noopValue = String(field.noopValue ?? "all").trim().toLowerCase();
            if (!selected || selected === noopValue) return true;
            const raw = typeof field.value === "function" ? field.value(row) : row?.[field.key];
            return normalizeText(raw) === selected;
          }
          const value = String(current ?? "").trim().toLowerCase();
          if (!value) return true;
          const raw = typeof field.value === "function" ? field.value(row) : row?.[field.key];
          return normalizeText(raw).includes(value);
        }));
      }
      const sortColumn = activeColumns.find((column) => column.key === state.sortKey) || haystackColumns[0];
      if (!sortColumn) return filtered;
      const direction = state.sortDir === "desc" ? -1 : 1;
      return filtered.slice().sort((left, right) => {
        const a = typeof sortColumn.sortValue === "function" ? sortColumn.sortValue(left) : readValue(sortColumn, left);
        const b = typeof sortColumn.sortValue === "function" ? sortColumn.sortValue(right) : readValue(sortColumn, right);
        return compareValues(a, b) * direction;
      });
    }

    function gridTemplate() {
      return orderedColumns().map((column) => column.width || "minmax(120px, 1fr)").join(" ");
    }

    function isInteractiveTarget(target) {
      return Boolean(target?.closest?.("button, input, select, textarea, label, a"));
    }

    function openCreateRow() {
      if (state.createOpen) return;
      state.createOpen = true;
      state.openEditorRowId = "";
      state.draftCreate = typeof config?.getCreateDefaults === "function" ? cloneRow(config.getCreateDefaults()) : {};
      render();
      config?.onCreateOpen?.({ open: state.createOpen });
    }

    function openEditor(row) {
      const key = rowKey(row);
      state.createOpen = false;
      state.openEditorRowId = state.openEditorRowId === key ? "" : key;
      state.draftEdit = cloneRow(row);
      render();
      if (state.openEditorRowId) config?.onEditOpen?.({ rowId: key, row });
    }

    function setDraftValue(mode, key, value) {
      const target = mode === "create" ? state.draftCreate : state.draftEdit;
      target[key] = value;
      orderedColumns().forEach((column) => {
        if (String(column?.enabledWhenKey || "").trim() === String(key || "").trim() && !value) {
          target[column.key] = "";
          return;
        }
        if (String(column?.disabledWhenKey || "").trim() === String(key || "").trim() && value) {
          target[column.key] = "";
        }
      });
    }

    function isColumnEnabled(column, draft) {
      const enabledKey = String(column?.enabledWhenKey || "").trim();
      if (enabledKey && !draft?.[enabledKey]) return false;
      const disabledKey = String(column?.disabledWhenKey || "").trim();
      if (disabledKey && draft?.[disabledKey]) return false;
      return true;
    }

    function editorControl(column, draft, mode) {
      const current = draft?.[column.key];
      const enabled = isColumnEnabled(column, draft);
      const fallbackKey = String(column?.fallbackFromKey || "").trim();
      const placeholder = !enabled && fallbackKey && draft?.[fallbackKey] != null && String(draft[fallbackKey]).trim() !== ""
        ? String(draft[fallbackKey])
        : String(column.placeholder || "");
      const normalizedField = typeof fieldContracts.normalizeColumnField === "function"
        ? fieldContracts.normalizeColumnField({
            ...column,
            value: current ?? column.defaultValue ?? "",
            editable: column.editable !== false,
            readonly: column.editable === false || column.editorType === "readonly",
            disabled: !enabled,
            placeholder,
          }, draft, { surface: "inline" })
        : null;
      if (normalizedField && typeof fieldContracts.renderFieldControlHtml === "function") {
        return fieldContracts.renderFieldControlHtml(normalizedField, {
          esc,
          mode,
          surface: "inline",
        });
      }
      return `<div class="data-table__editor-readonly">${renderDisplayValue(column, draft)}</div>`;
    }

    function dataCellHtml(column, row) {
      const classes = joinClasses(
        "data-table__cell",
        column.type === "primary" ? "data-table__cell--primary" : "",
        column.type === "numeric" ? "data-table__cell--numeric" : "",
        column.type === "meta" ? "data-table__cell--meta" : "",
        column.type === "actions" ? "data-table__cell--actions" : "",
        column.cellClass || "",
      );

      if (column.type === "actions") {
        return `
          <div class="${classes}" data-label="${esc(column.label)}">
            <div class="row-actions">
              ${rowActionsHtml()}
            </div>
          </div>
        `;
      }

      return `<div class="${classes}" data-label="${esc(column.label)}">${renderDisplayValue(column, row)}</div>`;
    }

    function headerCellHtml(column) {
      const isNumeric = column.type === "numeric" || column.type === "actions";
      const isActiveSort = state.sortKey === column.key;
      const dragEnabled = column.draggable !== false && column.type !== "actions";
      const sortIcon = !column.sortable ? "" : (isActiveSort ? (state.sortDir === "asc" ? "↑" : "↓") : "↕");
      return `
        <div
          class="data-table__headcell ${isNumeric ? "data-table__headcell--numeric" : ""} ${isActiveSort ? "is-active" : ""}"
          data-head-key="${esc(column.key)}"
          draggable="${dragEnabled ? "true" : "false"}"
        >
          <div class="headcell-left">
            ${dragEnabled ? `<button type="button" class="drag-handle" data-drag-handle="${esc(column.key)}" aria-label="Spalte verschieben">⋮⋮</button>` : `<span class="drag-handle drag-handle--placeholder" aria-hidden="true"></span>`}
            <button type="button" class="data-table__sort ${isActiveSort ? "is-active" : ""}" ${column.sortable === false ? "disabled" : `data-sort-key="${esc(column.key)}"`}>
              <span class="data-table__sort-label">${esc(column.label)}</span>
              <span class="data-table__sort-icon" aria-hidden="true">${sortIcon}</span>
            </button>
          </div>
          ${column.persistWidth === false ? "" : `<span class="column-resizer" data-resize-key="${esc(column.key)}" aria-hidden="true"></span>`}
        </div>
      `;
    }

    function editorRowHtml(mode, rowLike, rowId = "") {
      const target = mode === "create" ? state.draftCreate : state.draftEdit;
      const cells = orderedColumns().map((column) => {
        if (column.type === "actions") {
          return `
            <div class="data-table__editor-cell data-table__editor-cell--actions">
              <div class="editor-actions">
                <button type="button" class="feed-btn row-action-btn" data-editor-submit="${esc(mode)}" aria-label="${mode === "create" ? "Anlegen" : "Speichern"}">✔</button>
                <button type="button" class="feed-btn feed-btn--ghost row-action-btn" data-editor-cancel="${esc(mode)}" aria-label="Abbrechen">✖</button>
              </div>
            </div>
          `;
        }
        return `<div class="data-table__editor-cell">${editorControl(column, target, mode)}</div>`;
      }).join("");

      return `
        <div class="data-table__row data-table__row--editor" data-editor-row="${esc(rowId || mode)}" style="grid-template-columns:${esc(gridTemplate())}">
          ${cells}
        </div>
      `;
    }

    function filterControlHtml(field) {
      const current = state.filters[field.key];
      if (field.type === "select") {
        const options = Array.isArray(field.options) ? field.options : [];
        return `
          <label class="ui-field">
            <span>${esc(field.label)}</span>
            <select data-filter-key="${esc(field.key)}">
              ${options.map((option) => `<option value="${esc(option.value)}" ${String(option.value) === String(current ?? "") ? "selected" : ""}>${esc(option.label)}</option>`).join("")}
            </select>
          </label>
        `;
      }
      return `
        <label class="ui-field">
          <span>${esc(field.label)}</span>
          <input type="${esc(field.type === "date" ? "date" : "text")}" data-filter-key="${esc(field.key)}" value="${esc(current ?? "")}" placeholder="${esc(field.placeholder || "")}" />
        </label>
      `;
    }

    function cardHtml(row) {
      const key = rowKey(row);
      const titleColumn = columns.find((column) => column.type === "primary") || columns[0];
      const metaColumns = columns.filter((column) => column.key !== titleColumn.key && column.type !== "actions");
      return `
        <article class="inline-card ${state.openEditorRowId === key ? "is-selected" : ""}" data-card-row-id="${esc(key)}">
          <div class="inline-card__head">
            <strong>${renderDisplayValue(titleColumn, row)}</strong>
            <div class="row-actions">
              ${rowActionsHtml()}
            </div>
          </div>
          <div class="inline-card__body">
            ${metaColumns.map((column) => `
              <div class="inline-card__meta">
                <span>${esc(column.label)}</span>
                <strong>${renderDisplayValue(column, row)}</strong>
              </div>
            `).join("")}
          </div>
          ${state.openEditorRowId === key ? `<div class="inline-card__editor">${editorRowHtml("edit", row, key)}</div>` : ""}
        </article>
      `;
    }

    function render() {
      const rows = filteredRows();
      const activeCount = rows.length;
      const totalCount = state.rows.length;
      const activeColumns = orderedColumns();
      const showToolbar = config?.showToolbar !== false;
      const showSearch = config?.showSearch !== false;
      const showCreateButton = config?.showCreateButton !== false;
      const showViewSwitch = config?.showViewSwitch !== false;
      const showResetButton = config?.showResetButton !== false;
      const showMetaBar = config?.showMetaBar === true;
      const showFilterPanel = filterFields.length > 0 && state.filterPanelOpen !== false;
      const title = String(config?.title || "").trim();
      const description = String(config?.description || "").trim();
      const emptyTitle = String(config?.emptyStateTitle || "Noch keine Datensaetze vorhanden.").trim();
      const emptyDescription = String(config?.emptyStateDescription || `Lege den ersten Eintrag direkt inline ueber "${config.createLabel || "Neuer Datensatz"}" an.`).trim();
      const utilityActions = Array.isArray(config?.utilityActions) ? config.utilityActions : [];
      const emptyStateHtml = `
        <div class="data-table__empty">
          <strong>${esc(emptyTitle)}</strong>
          <span>${esc(emptyDescription)}</span>
        </div>
      `;

      root.setAttribute("data-fcp-component", COMPONENT_NAME);
      root.setAttribute("data-table-id", String(config?.tableId || ""));
      root.setAttribute("data-row-click", "inline");
      root.setAttribute("data-inline-create", state.createOpen ? "true" : "false");
      root.setAttribute("data-inline-edit", state.openEditorRowId ? "true" : "false");

      const activeEl = document.activeElement;
      const focusState = activeEl && root.contains(activeEl)
        ? {
            id: String(activeEl.id || "").trim(),
            filterKey: String(activeEl.getAttribute?.("data-filter-key") || "").trim(),
            selectionStart: typeof activeEl.selectionStart === "number" ? activeEl.selectionStart : null,
            selectionEnd: typeof activeEl.selectionEnd === "number" ? activeEl.selectionEnd : null,
          }
        : null;

      const existingWrap = root.querySelector(".data-table-wrap");
      if (existingWrap) lastTableScrollLeft = existingWrap.scrollLeft || 0;

      root.innerHTML = `
        <div class="data-table-shell data-table-shell--inline-v2">
          ${state.feedback ? `<div class="data-table-feedback is-${esc(state.feedback.type)}">${esc(state.feedback.text)}</div>` : ""}
          ${(title || (showViewSwitch && !showToolbar)) ? `
          <div class="title-row">
            <div>
              ${title ? `<h1>${esc(title)}</h1>` : ""}
              ${description ? `<p>${esc(description)}</p>` : ""}
            </div>
            ${showViewSwitch ? `
            <div class="view-toggle" role="group" aria-label="Ansicht">
              <button type="button" class="${state.viewMode === "table" ? "is-active" : ""}" data-view-mode="table">Tabelle</button>
              <button type="button" class="${state.viewMode === "cards" ? "is-active" : ""}" data-view-mode="cards">Cards</button>
            </div>
            ` : ""}
          </div>
          ` : ""}
          ${showToolbar ? `
          <div class="data-table-shell__toolbar">
            <div class="toolbar-left">
              ${showSearch ? `
              <label class="ui-field">
                <span class="sr-only">Suche</span>
                <input type="search" id="${esc(config.tableId)}-search" placeholder="${esc(config.searchPlaceholder || "Suchen ...")}" value="${esc(state.search)}" />
              </label>
              ` : ""}
            </div>
            <div class="toolbar-right">
              ${showCreateButton ? `<button type="button" class="feed-btn" data-inline-create-toggle="true" ${state.createOpen ? "disabled" : ""}>${esc(config.createLabel || "Neuer Eintrag")}</button>` : ""}
              ${config.quickToggle ? `
              <label class="toolbar-check"><input type="checkbox" data-filter-key="${esc(config.quickToggle.key || "quick_toggle")}" ${state.filters[config.quickToggle.key] ? "checked" : ""} /><span>${esc(config.quickToggle.label || "")}</span></label>
              ` : ""}
              ${utilityActions.map((action) => {
                const kind = String(action?.kind || "button");
                const key = String(action?.key || "").trim();
                const label = String(action?.label || "").trim();
                const icon = String(action?.icon || "").trim();
                const titleAttr = String(action?.title || label || "").trim();
                const classes = kind === "icon" || kind === "menu" ? "icon-utility" : `feed-btn ${action?.variant === "primary" ? "" : "feed-btn--ghost"}`;
                if (kind === "menu") {
                  const items = Array.isArray(action?.items) ? action.items : [];
                  return `
                    <div class="data-table-utility-menu ${state.openUtilityMenuKey === key ? "is-open" : ""}" data-inline-utility-menu="${esc(key)}">
                      <button type="button" class="${classes}" data-utility-action="${esc(key)}" ${titleAttr ? `title="${esc(titleAttr)}" aria-label="${esc(titleAttr)}"` : ""}>${icon ? `<span aria-hidden="true">${esc(icon)}</span>` : ""}${label ? `<span>${esc(label)}</span>` : ""}</button>
                      <div class="data-table-utility-menu__panel" role="menu" aria-label="${esc(titleAttr || key)}">
                        ${items.map((item) => `
                          <button
                            type="button"
                            class="data-table-utility-menu__item"
                            role="menuitem"
                            data-utility-menu-item="${esc(String(item?.key || "").trim())}"
                            data-utility-parent="${esc(key)}"
                          >${esc(String(item?.label || item?.key || "").trim())}</button>
                        `).join("")}
                      </div>
                    </div>
                  `;
                }
                return `<button type="button" class="${classes}" data-utility-action="${esc(key)}" ${titleAttr ? `title="${esc(titleAttr)}" aria-label="${esc(titleAttr)}"` : ""}>${icon ? `<span aria-hidden="true">${esc(icon)}</span>` : ""}${label ? `<span>${esc(label)}</span>` : ""}</button>`;
              }).join("")}
              ${config.showFilterButton ? `<button type="button" class="icon-utility" data-inline-filter-toggle="true" aria-label="Filter">☰</button>` : ""}
              ${showResetButton ? `<button type="button" class="icon-utility" data-inline-reset="true" aria-label="Reset">↺</button>` : ""}
            </div>
          </div>
          ` : ""}
          ${showFilterPanel ? `
          <div class="filter-panel">
            ${filterFields.map((field) => filterControlHtml(field)).join("")}
          </div>
          ` : ""}
          ${showMetaBar ? `<div class="table-meta-bar">
            <span>${esc(config.metaLabel || "Datensätze")}: ${esc(activeCount)} / ${esc(totalCount)}</span>
            <span>${esc(config.metaHint || "")}</span>
          </div>` : ""}
          ${state.viewMode === "table" ? `
            <div class="data-table-wrap">
              <div class="data-table">
                <div class="data-table__head" style="grid-template-columns:${esc(gridTemplate())}">
                  ${activeColumns.map((column) => headerCellHtml(column)).join("")}
                </div>
                ${state.createOpen ? editorRowHtml("create", state.draftCreate, "create") : ""}
                ${!rows.length ? emptyStateHtml : ""}
                ${rows.map((row) => {
                  const key = rowKey(row);
                  return `
                    <div class="data-table__row ${state.openEditorRowId === key ? "is-selected" : ""}" data-row-id="${esc(key)}" style="grid-template-columns:${esc(gridTemplate())}">
                      ${activeColumns.map((column) => dataCellHtml(column, row)).join("")}
                    </div>
                    ${state.openEditorRowId === key ? editorRowHtml("edit", row, key) : ""}
                  `;
                }).join("")}
              </div>
            </div>
          ` : `
            <div class="cards-view">
              ${state.createOpen ? `<div class="inline-card inline-card--create">${editorRowHtml("create", state.draftCreate, "create")}</div>` : ""}
              ${!rows.length ? emptyStateHtml : ""}
              ${rows.map((row) => cardHtml(row)).join("")}
            </div>
          `}
        </div>
      `;

      const nextWrap = root.querySelector(".data-table-wrap");
      if (nextWrap && lastTableScrollLeft > 0) {
        nextWrap.scrollLeft = lastTableScrollLeft;
      }

      if (focusState) {
        let nextFocus = null;
        if (focusState.id) {
          nextFocus = root.querySelector(`#${CSS.escape(focusState.id)}`);
        }
        if (!nextFocus && focusState.filterKey) {
          nextFocus = root.querySelector(`[data-filter-key="${CSS.escape(focusState.filterKey)}"]`);
        }
        if (nextFocus instanceof HTMLElement) {
          nextFocus.focus();
          if (typeof nextFocus.setSelectionRange === "function" && focusState.selectionStart !== null) {
            nextFocus.setSelectionRange(focusState.selectionStart, focusState.selectionEnd ?? focusState.selectionStart);
          }
        }
      }
    }

    root.addEventListener("input", (event) => {
      const target = event.target;
      if (target?.id === `${config.tableId}-search`) {
        state.search = String(target.value || "");
        render();
        return;
      }
      if (target?.getAttribute?.("data-filter-key")) {
        const key = String(target.getAttribute("data-filter-key") || "");
        if (key) {
          state.filters[key] = target.type === "checkbox" ? Boolean(target.checked) : String(target.value || "");
          render();
          config?.onFilterChange?.({ filters: { ...state.filters } });
          return;
        }
      }
      const mode = String(target?.getAttribute?.("data-editor-mode") || "");
      const key = String(target?.getAttribute?.("data-editor-key") || "");
      if (mode && key) {
        if (target.type === "checkbox") {
          setDraftValue(mode, key, Boolean(target.checked));
        } else {
          setDraftValue(mode, key, target.value);
        }
        render();
      }
    });

    root.addEventListener("change", (event) => {
      const multiWrap = event.target?.closest?.(".data-table__multi-select");
      if (multiWrap) {
        const mode = String(multiWrap.getAttribute("data-editor-mode") || "");
        const key = String(multiWrap.getAttribute("data-editor-key") || "");
        if (mode && key) {
          const values = [...multiWrap.querySelectorAll("input[type='checkbox']:checked")].map((input) => String(input.value || ""));
          setDraftValue(mode, key, values);
          render();
        }
      }
    });

    root.addEventListener("click", async (event) => {
      const target = event.target;
      const rowEl = target?.closest?.("[data-row-id], [data-card-row-id]");
      const actionBtn = target?.closest?.("[data-row-action]");
      const sortBtn = target?.closest?.("[data-sort-key]");
      const rowClickOpensEditor = config?.rowClickOpensEditor !== false;
      const utilityActions = Array.isArray(config?.utilityActions) ? config.utilityActions : [];

      if (target?.closest?.("[data-inline-create-toggle]")) {
        if (String(config?.rowInteractionMode || "").trim() === "dialog" && typeof config?.onCreateOpen === "function") {
          config.onCreateOpen?.({ open: true });
          return;
        }
        openCreateRow();
        return;
      }

      if (target?.closest?.("[data-inline-reset]")) {
        state.search = "";
        state.filterPanelOpen = true;
        state.createOpen = false;
        state.openUtilityMenuKey = "";
        state.openEditorRowId = "";
        state.draftCreate = typeof config?.getCreateDefaults === "function" ? cloneRow(config.getCreateDefaults()) : {};
        render();
        config?.onReset?.();
        return;
      }

      if (target?.closest?.("[data-inline-filter-toggle]")) {
        if (filterFields.length) {
          state.filterPanelOpen = state.filterPanelOpen === false;
          render();
        }
        return;
      }

      const utilityMenuItem = target?.closest?.("[data-utility-menu-item]");
      if (utilityMenuItem) {
        const actionKey = String(utilityMenuItem.getAttribute("data-utility-parent") || "");
        const itemKey = String(utilityMenuItem.getAttribute("data-utility-menu-item") || "");
        state.openUtilityMenuKey = "";
        render();
        if (actionKey && itemKey) {
          await config?.onUtilityAction?.({ actionKey, itemKey });
        }
        return;
      }

      const utilityBtn = target?.closest?.("[data-utility-action]");
      if (utilityBtn) {
        const key = String(utilityBtn.getAttribute("data-utility-action") || "");
        if (key) {
          const utilityAction = utilityActions.find((entry) => String(entry?.key || "").trim() === key) || null;
          if (String(utilityAction?.kind || "") === "menu") {
            state.openUtilityMenuKey = state.openUtilityMenuKey === key ? "" : key;
            render();
          } else {
            state.openUtilityMenuKey = "";
            await config?.onUtilityAction?.({ actionKey: key, itemKey: "" });
          }
        }
        return;
      }

      if (state.openUtilityMenuKey && !target?.closest?.("[data-inline-utility-menu]")) {
        state.openUtilityMenuKey = "";
        render();
      }

      const viewBtn = target?.closest?.("[data-view-mode]");
      if (viewBtn) {
        state.viewMode = String(viewBtn.getAttribute("data-view-mode") || "table");
        persistLayout();
        render();
        config?.onViewModeChange?.({ viewMode: state.viewMode });
        return;
      }

      if (sortBtn) {
        const key = String(sortBtn.getAttribute("data-sort-key") || "");
        if (key) {
          if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
          else {
            state.sortKey = key;
            state.sortDir = "asc";
          }
          persistLayout();
          render();
          config?.onSortChange?.({ sortKey: state.sortKey, sortDir: state.sortDir });
        }
        return;
      }

      const submitBtn = target?.closest?.("[data-editor-submit]");
      if (submitBtn) {
        const mode = String(submitBtn.getAttribute("data-editor-submit") || "");
        try {
          if (mode === "create") {
            const created = await config?.onCreateSubmit?.(cloneRow(state.draftCreate));
            if (created) {
              state.createOpen = false;
              state.draftCreate = typeof config?.getCreateDefaults === "function" ? cloneRow(config.getCreateDefaults()) : {};
              setFeedback("success", "Eintrag gespeichert.");
            }
          } else if (mode === "edit" && state.openEditorRowId) {
            const row = state.rows.find((entry) => rowKey(entry) === state.openEditorRowId);
            const saved = await config?.onEditSubmit?.(row, cloneRow(state.draftEdit));
            if (saved) {
              applyOptimisticEdit(state.openEditorRowId, state.draftEdit);
              state.openEditorRowId = "";
              state.draftEdit = {};
              setFeedback("success", "Änderungen gespeichert.");
            }
          }
        } catch (error) {
          const text = error instanceof Error && error.message ? error.message : "Speichern fehlgeschlagen.";
          setFeedback("error", text);
          throw error;
        } finally {
          render();
        }
        return;
      }

      const cancelBtn = target?.closest?.("[data-editor-cancel]");
      if (cancelBtn) {
        const mode = String(cancelBtn.getAttribute("data-editor-cancel") || "");
        if (mode === "create") {
          state.createOpen = false;
          config?.onCreateCancel?.();
        } else {
          state.openEditorRowId = "";
          config?.onEditCancel?.();
        }
        render();
        return;
      }

      if (actionBtn && rowEl) {
        const key = String(rowEl.getAttribute("data-row-id") || rowEl.getAttribute("data-card-row-id") || "");
        const row = state.rows.find((entry) => rowKey(entry) === key);
        const action = String(actionBtn.getAttribute("data-row-action") || "");
        if (row && action) {
          if (action === "edit") {
            if (String(config?.rowInteractionMode || "").trim() === "dialog") {
              config?.onRowClick?.(row, { type: "row-action-edit" });
            } else {
              openEditor(row);
            }
          } else if (action === "duplicate") {
            await config?.onDuplicate?.(row);
          } else if (action === "delete") {
            await config?.onDelete?.(row);
          }
        }
        return;
      }

      if (rowEl && !isInteractiveTarget(target)) {
        const key = String(rowEl.getAttribute("data-row-id") || rowEl.getAttribute("data-card-row-id") || "");
        const row = state.rows.find((entry) => rowKey(entry) === key);
        if (row) {
          if (rowClickOpensEditor) openEditor(row);
          config?.onRowClick?.(row);
        }
      }
    });

    root.addEventListener("dragstart", (event) => {
      const head = event.target?.closest?.("[data-head-key]");
      const key = String(head?.getAttribute?.("data-head-key") || "");
      if (!key) return;
      dragColumnKey = key;
      event.dataTransfer.effectAllowed = "move";
      try {
        event.dataTransfer.setData("text/plain", key);
      } catch {
        // noop
      }
    });

    root.addEventListener("dragover", (event) => {
      const head = event.target?.closest?.("[data-head-key]");
      if (!head) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });

    root.addEventListener("drop", (event) => {
      const head = event.target?.closest?.("[data-head-key]");
      const targetKey = String(head?.getAttribute?.("data-head-key") || "");
      const sourceKey = dragColumnKey || String(event.dataTransfer?.getData("text/plain") || "");
      if (!sourceKey || !targetKey || sourceKey === targetKey) return;
      const next = state.columnOrder.filter((key) => key !== sourceKey);
      const targetIndex = next.indexOf(targetKey);
      next.splice(targetIndex, 0, sourceKey);
      state.columnOrder = next;
      dragColumnKey = "";
      persistLayout();
      render();
      config?.onColumnOrderChange?.({ columnOrder: state.columnOrder.slice() });
      config?.onLayoutChange?.({ columnOrder: state.columnOrder.slice(), columnWidths: { ...state.columnWidths } });
    });

    root.addEventListener("dragend", () => {
      dragColumnKey = "";
    });

    root.addEventListener("mousedown", (event) => {
      const resizer = event.target?.closest?.("[data-resize-key]");
      const resizeKey = String(resizer?.getAttribute?.("data-resize-key") || "");
      if (!resizeKey) return;
      event.preventDefault();
      const wrap = root.querySelector(".data-table-wrap");
      lastTableScrollLeft = wrap?.scrollLeft || 0;
      const startX = event.clientX;
      const column = orderedColumns().find((entry) => entry.key === resizeKey);
      const current = String(state.columnWidths[resizeKey] || column?.width || "160px");
      const startWidth = Number.parseFloat(current) || 160;

      function onMove(moveEvent) {
        const nextWidth = Math.max(72, Math.round(startWidth + (moveEvent.clientX - startX)));
        state.columnWidths[resizeKey] = `${nextWidth}px`;
        lastTableScrollLeft = wrap?.scrollLeft || lastTableScrollLeft;
        render();
      }

      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        persistLayout();
        config?.onColumnResize?.({ key: resizeKey, width: state.columnWidths[resizeKey] });
        config?.onLayoutChange?.({ columnOrder: state.columnOrder.slice(), columnWidths: { ...state.columnWidths } });
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    render();

    return {
      setRows(nextRows = []) {
        state.rows = Array.isArray(nextRows) ? nextRows.slice() : [];
        render();
      },
      setMeta(nextMeta = {}) {
        config.metaLabel = nextMeta.metaLabel || config.metaLabel;
        config.metaHint = nextMeta.metaHint || config.metaHint;
        render();
      },
      getState() {
        return {
          sortKey: state.sortKey,
          sortDir: state.sortDir,
          columnOrder: state.columnOrder.slice(),
          columnWidths: { ...state.columnWidths },
          viewMode: state.viewMode,
        };
      },
      openCreate() {
        if (!state.createOpen) openCreateRow();
      },
      closeCreate() {
        if (state.createOpen) {
          state.createOpen = false;
          render();
        }
      },
      render,
    };
  }

  window.FCPInlineDataTable = {
    createStandardV2,
  };
})();
