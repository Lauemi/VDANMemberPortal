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
    if (Array.isArray(column?.options)) {
      const option = column.options.find((entry) => String(entry?.value ?? "") === String(raw ?? ""));
      if (option?.label != null && String(option.label).trim() !== "") {
        return esc(option.label);
      }
    }
    if (column?.key === "status") {
      const normalized = String(raw ?? "").trim().toLowerCase();
      if (normalized === "active" || normalized === "aktiv") return "Aktiv";
      if (normalized === "inactive" || normalized === "inaktiv" || normalized === "passiv" || normalized === "passive") return "Inaktiv";
      if (normalized === "pending" || normalized === "offen" || normalized === "invited") return "Offen";
      if (normalized === "blocked") return "Gesperrt";
    }
    if (column?.key === "role") {
      const normalized = String(raw ?? "").trim().toLowerCase();
      if (normalized === "member") return "Mitglied";
      if (normalized === "admin") return "Admin";
      if (normalized === "vorstand") return "Vorstand";
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

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
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

    const tableId = String(config?.tableId || "default").trim() || "default";
    const layoutVersion = String(config?.layoutVersion || "v1").trim() || "v1";
    const storageKey = `fcp-inline-table-layout-v2::${tableId}::${layoutVersion}`;
    const filterFields = Array.isArray(config?.filterFields) ? config.filterFields : [];
    const initialRows = Array.isArray(config?.rows) ? config.rows : [];
    const configuredViewMode = String(config?.viewMode || "table").trim().toLowerCase() || "table";
    const allowCards = configuredViewMode === "cards" || configuredViewMode === "both" || configuredViewMode === "table" || !configuredViewMode;
    const initialViewMode = configuredViewMode === "cards" ? "cards" : "table";
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
      hiddenColumns: new Set(),
      columnTogglePanelOpen: false,
      layoutDirty: false,
      feedback: null,
      rdFiltersOpen: false,
      rdInlineFilters: {},
    };

    const configuredDefaultOrder = Array.isArray(config?.defaultColumnOrder)
      ? config.defaultColumnOrder.map((entry) => String(entry || "").trim()).filter(Boolean)
      : [];
    if (configuredDefaultOrder.length) {
      const allowed = new Set(initialColumns);
      const ordered = configuredDefaultOrder.filter((key) => allowed.has(key));
      const missing = initialColumns.filter((key) => !ordered.includes(key));
      state.columnOrder = [...ordered, ...missing];
    }

    if (Array.isArray(config?.defaultHiddenColumns)) {
      const allowed = new Set(initialColumns);
      state.hiddenColumns = new Set(
        config.defaultHiddenColumns
          .map((entry) => String(entry || "").trim())
          .filter((key) => allowed.has(key))
      );
    }

    if (config?.defaultColumnWidths && typeof config.defaultColumnWidths === "object") {
      state.columnWidths = {
        ...state.columnWidths,
        ...Object.fromEntries(
          Object.entries(config.defaultColumnWidths).map(([key, value]) => {
            const column = columns.find((entry) => entry.key === key);
            return [key, sanitizeWidthValue(value, column)];
          })
        ),
      };
    }
    let dragColumnKey = "";
    let lastTableScrollLeft = 0;
    let feedbackTimer = 0;
    let resizeObserver = null;
    let lastObservedContainerWidth = 0;
    const ownerDocument = root.ownerDocument || document;

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

    function deriveRedesignFilterDefs() {
      if (config?.redesignFilterDefs && typeof config.redesignFilterDefs === "object") {
        return config.redesignFilterDefs;
      }
      return Object.fromEntries(
        filterFields.map((field) => {
          if (field?.type === "select" && Array.isArray(field.options)) {
            const noopValue = String(field.noopValue ?? "all").trim().toLowerCase();
            return [field.key, {
              type: "select",
              options: field.options.map((option, index) => {
                const value = String(option?.value ?? "");
                return {
                  value: index === 0 && value.trim().toLowerCase() === noopValue ? "" : value,
                  label: String(option?.label ?? option?.value ?? ""),
                };
              }),
            }];
          }
          return [field.key, { type: "text" }];
        })
      );
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
        const sanitizedPersistedWidths = Object.fromEntries(
          Object.entries(persisted.columnWidths).map(([key, value]) => {
            const column = columns.find((entry) => entry.key === key);
            return [key, sanitizeWidthValue(value, column)];
          })
        );
        state.columnWidths = { ...state.columnWidths, ...sanitizedPersistedWidths };
      }
      if (!config?.sortKey && persisted?.sortKey && initialColumns.includes(persisted.sortKey)) {
        state.sortKey = persisted.sortKey;
        state.sortDir = persisted?.sortDir === "desc" ? "desc" : "asc";
      }
      if (Array.isArray(persisted?.hiddenColumns)) {
        const validHidden = persisted.hiddenColumns.filter((key) => initialColumns.includes(key));
        state.hiddenColumns = new Set(validHidden);
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
          hiddenColumns: [...state.hiddenColumns],
        }));
      } catch {
        // noop
      }
    }

    function supportsCardsMode() {
      return config?.allowCards !== false && allowCards;
    }

    if (root._fcpApi && typeof root._fcpApi.destroy === "function") {
      try {
        root._fcpApi.destroy();
      } catch {
        // noop
      }
    }

    function orderedColumns() {
      const map = new Map(columns.map((column) => [column.key, column]));
      const actionKeys = new Set(columns.filter((col) => col.type === "actions").map((col) => col.key));
      const withWidth = (column) => ({ ...column, width: state.columnWidths[column.key] || column.width || "minmax(120px, 1fr)" });
      const data = state.columnOrder
        .filter((key) => !state.hiddenColumns.has(key) && !actionKeys.has(key))
        .map((key) => map.get(key))
        .filter(Boolean)
        .map(withWidth);
      // In redesign mode the floating rd-row-actions overlay replaces action columns
      if (config?.redesign !== false) return data;
      const actionCols = columns.filter((col) => col.type === "actions").map(withWidth);
      return [...data, ...actionCols];
    }

    function resolveRedesignTheme() {
      const explicit = String(config?.redesignTheme || "").trim().toLowerCase();
      if (explicit === "light" || explicit === "dark") return explicit;
      const rootTheme = String(root?.dataset?.rdTheme || "").trim().toLowerCase();
      if (rootTheme === "light" || rootTheme === "dark") return rootTheme;
      const appTheme = String(document.body?.dataset?.appTheme || "").trim().toLowerCase();
      return appTheme === "fcp_tactical" ? "dark" : "light";
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

    function rdRowStatus(row) {
      const statusKey = String(config?.statusKey || "status").trim();
      const raw = String(row?.[statusKey] ?? "").trim().toLowerCase();
      if (!raw) return "";
      if (raw === "active" || raw === "aktiv") return "active";
      if (raw === "pending" || raw === "offen") return "pending";
      if (raw === "inactive" || raw === "inaktiv") return "inactive";
      return raw;
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
      // Redesign inline column filters
      if (config?.redesign !== false) {
        const rdFilters = Object.entries(state.rdInlineFilters).filter(([, v]) => String(v ?? "").trim() !== "");
        if (rdFilters.length) {
          filtered = filtered.filter((row) => rdFilters.every(([key, filterValue]) => {
            const col = activeColumns.find((c) => c.key === key);
            if (!col) return true;
            const value = readValue(col, row);
            const normalizedNeedle = normalizeText(filterValue);
            if (Array.isArray(value)) return value.some((item) => normalizeText(item?.label || item?.name || item).includes(normalizedNeedle));
            return normalizeText(value).includes(normalizedNeedle);
          }));
        }
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

    function responsiveContainer() {
      return root.closest("[data-inline-width-anchor], [data-panel-content], .admin-card__content, .panel-body, .card, .card-body, .workscreen, .workscreen-main, main")
        || root.parentElement
        || root;
    }

    function viewportAvailableWidth() {
      if (typeof window === "undefined") return 0;
      const rect = root.getBoundingClientRect?.() || { left: 0, right: 0 };
      const gutter = 24;
      const left = Number.isFinite(rect.left) ? Math.max(0, rect.left) : 0;
      const available = window.innerWidth - left - gutter;
      return Math.max(0, Math.floor(available));
    }

    function measureContainerWidth() {
      const container = responsiveContainer();
      const containerWidth = container.getBoundingClientRect?.().width || container.clientWidth || 0;
      const rootWidth = root.getBoundingClientRect?.().width || root.clientWidth || 0;
      const viewportWidth = viewportAvailableWidth();
      const candidates = [containerWidth, rootWidth, viewportWidth].filter((value) => Number.isFinite(value) && value > 0);
      if (!candidates.length) return 0;
      return Math.max(0, Math.floor(Math.min(...candidates) - 4));
    }

    function responsiveMode(containerWidth = measureContainerWidth()) {
      if (containerWidth <= 720) return "mobile";
      if (containerWidth <= 1180) return "tablet";
      return "desktop";
    }

    function effectiveViewMode(containerWidth = measureContainerWidth()) {
      if (supportsCardsMode() && responsiveMode(containerWidth) === "mobile") return "cards";
      return state.viewMode === "cards" && supportsCardsMode() ? "cards" : "table";
    }

    function widthLimits(column = {}, mode = responsiveMode()) {
      const numericOrMeta = column.type === "numeric" || column.type === "actions";
      const baseMin = numericOrMeta ? 84 : 108;
      const softMin = column.type === "primary" ? 160 : column.type === "meta" ? 100 : baseMin;
      const capByMode = mode === "mobile"
        ? (column.type === "primary" ? 360 : numericOrMeta ? 220 : 280)
        : mode === "tablet"
          ? (column.type === "primary" ? 520 : numericOrMeta ? 260 : 360)
          : (column.type === "primary" ? 720 : numericOrMeta ? 320 : 480);
      return { baseMin, softMin, cap: capByMode };
    }

    function sanitizeWidthValue(width, column = {}, mode = responsiveMode()) {
      const raw = String(width || "").trim();
      if (!raw) return "";
      const limits = widthLimits(column, mode);
      const minMatch = raw.match(/minmax\((\d+(?:\.\d+)?)px\s*,\s*(\d+(?:\.\d+)?)fr\)/i);
      if (minMatch) {
        const min = clamp(parseFloat(minMatch[1]), limits.baseMin, limits.cap);
        const fr = clamp(parseFloat(minMatch[2]), 0.6, 2.2);
        return `minmax(${Math.round(min)}px, ${fr}fr)`;
      }
      const pxMatch = raw.match(/^(\d+(?:\.\d+)?)px$/i);
      if (pxMatch) {
        return `${Math.round(clamp(parseFloat(pxMatch[1]), limits.baseMin, limits.cap))}px`;
      }
      return raw;
    }

    function preferredColumnWidth(column = {}) {
      const mode = responsiveMode();
      const width = String(state.columnWidths[column.key] || column.width || "").trim();
      const numericOrMeta = column.type === "numeric" || column.type === "actions";
      const { baseMin, softMin, cap } = widthLimits(column, mode);
      const minMatch = width.match(/minmax\((\d+(?:\.\d+)?)px/i);
      const pxMatch = width.match(/^(\d+(?:\.\d+)?)px$/i);
      const frMatch = width.match(/(\d+(?:\.\d+)?)fr/i);
      const labelLen = String(column.label || "").trim().length;
      const contentHint = clamp(labelLen * 8 + 36, softMin, cap);
      const preferred = pxMatch
        ? clamp(parseFloat(pxMatch[1]), baseMin, cap)
        : minMatch
          ? clamp(Math.max(parseFloat(minMatch[1]) * 1.12, contentHint), baseMin, cap)
          : contentHint;
      const min = minMatch
        ? clamp(parseFloat(minMatch[1]), baseMin, Math.min(preferred, cap))
        : clamp(Math.min(contentHint, preferred * 0.72), baseMin, preferred);
      const flex = frMatch ? parseFloat(frMatch[1]) : (column.type === "primary" ? 1.35 : numericOrMeta ? 0.78 : 1);
      return {
        min: Math.round(min),
        preferred: Math.round(Math.max(min, preferred)),
        flex: Number.isFinite(flex) && flex > 0 ? flex : 1,
      };
    }

    function usesManualWidth(column = {}) {
      const raw = String(state.columnWidths[column.key] || column.width || "").trim();
      if (!raw) return false;
      if (/^\s*minmax\(\s*120px\s*,\s*1fr\s*\)\s*$/i.test(raw)) return false;
      return /px/i.test(raw) || /minmax\(/i.test(raw);
    }

    function gridTemplateMeta() {
      const containerWidth = measureContainerWidth();
      const active = orderedColumns();
      if (!active.length) return { template: "", layout: responsiveMode(containerWidth), overflow: false };
      const specs = active.map(preferredColumnWidth);
      const hasManualWidths = active.some((column) => usesManualWidth(column));
      const sumMin = specs.reduce((sum, spec) => sum + spec.min, 0);
      const sumPreferred = specs.reduce((sum, spec) => sum + spec.preferred, 0);
      const mode = responsiveMode(containerWidth);
      if (!containerWidth) {
        return {
          template: specs.map((spec) => `${spec.preferred}px`).join(" "),
          layout: mode,
          overflow: false,
        };
      }
      if (containerWidth >= sumPreferred) {
        return {
          template: hasManualWidths
            ? specs.map((spec) => `${spec.preferred}px`).join(" ")
            : specs.map((spec) => `minmax(${spec.min}px, ${spec.flex}fr)`).join(" "),
          layout: mode,
          overflow: false,
        };
      }
      if (hasManualWidths) {
        return {
          template: specs.map((spec) => `${spec.preferred}px`).join(" "),
          layout: mode,
          overflow: true,
        };
      }
      if (containerWidth >= sumMin) {
        const ratio = (containerWidth - sumMin) / Math.max(1, (sumPreferred - sumMin));
        return {
          template: specs.map((spec) => `${Math.round(spec.min + (spec.preferred - spec.min) * ratio)}px`).join(" "),
          layout: mode,
          overflow: false,
        };
      }
      return {
        template: specs.map((spec) => `${spec.min}px`).join(" "),
        layout: mode,
        overflow: true,
      };
    }

    function gridTemplate() {
      return gridTemplateMeta().template;
    }

    function ensureResponsiveObserver() {
      if (resizeObserver || typeof ResizeObserver !== "function") return;
      resizeObserver = new ResizeObserver((entries = []) => {
        const nextWidth = measureContainerWidth();
        if (Math.abs(nextWidth - lastObservedContainerWidth) < 2) return;
        lastObservedContainerWidth = nextWidth;
        render();
      });
      const container = responsiveContainer();
      lastObservedContainerWidth = measureContainerWidth();
      resizeObserver.observe(container);
      if (container !== root) {
        resizeObserver.observe(root);
      }
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
      const canHide = column.type !== "actions";
      const hasRdFilter = config?.redesign !== false && Boolean(state.rdInlineFilters[column.key]);
      const sortIcon = !column.sortable ? "" : (isActiveSort ? (state.sortDir === "asc" ? "↑" : "↓") : "↕");
      return `
        <div
          class="data-table__headcell ${isNumeric ? "data-table__headcell--numeric" : ""} ${isActiveSort ? "is-active" : ""} ${hasRdFilter ? "rd-has-filter" : ""}"
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
          <div class="headcell-right">
            ${config?.redesign !== false ? `<button type="button" class="rd-col-menu-btn" data-col-menu-key="${esc(column.key)}" aria-label="Spalten-Aktionen">⋯</button>` : ""}
            ${canHide ? `<button type="button" class="col-hide-btn" data-col-hide="${esc(column.key)}" aria-label="Spalte ausblenden" title="Spalte ausblenden">👁</button>` : ""}
            ${column.persistWidth === false ? "" : `<span class="column-resizer" data-resize-key="${esc(column.key)}" aria-hidden="true"></span>`}
          </div>
        </div>
      `;
    }

    function filterRowHtml(gt) {
      const activeColumns = orderedColumns();
      const filterDefs = deriveRedesignFilterDefs();
      const cells = activeColumns.map((col) => {
        const def = filterDefs[col.key];
        const curVal = state.rdInlineFilters[col.key] || "";
        if (def?.type === "select") {
          const opts = (def.options || []).map((o) =>
            `<option value="${esc(o.value)}" ${o.value === curVal ? "selected" : ""}>${esc(o.label)}</option>`
          ).join("");
          return `<div class="rd-filter-cell"><select data-rd-filter-key="${esc(col.key)}">${opts}</select></div>`;
        }
        return `<div class="rd-filter-cell"><input type="text" data-rd-filter-key="${esc(col.key)}" value="${esc(curVal)}" placeholder="Filter …" /></div>`;
      }).join("");
      return `<div class="rd-filter-row" style="grid-template-columns:${esc(gt)}">${cells}</div>`;
    }

    function editorRowHtml(mode, rowLike, rowId = "", gt = "") {
      const target = mode === "create" ? state.draftCreate : state.draftEdit;
      const resolvedGt = gt || gridTemplate();
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
        <div class="data-table__row data-table__row--editor" data-editor-row="${esc(rowId || mode)}" style="grid-template-columns:${esc(resolvedGt)}">
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

    function cardTitleValue(row) {
      const explicitKey = String(config?.primaryColumnKey || config?.cardTitleKey || "").trim();
      if (explicitKey) {
        const explicitColumn = columns.find((column) => column.key === explicitKey);
        if (explicitColumn) return renderDisplayValue(explicitColumn, row);
      }
      const firstName = String(row?.first_name ?? "").trim();
      const lastName = String(row?.last_name ?? "").trim();
      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
      if (fullName) return esc(fullName);
      const preferred = columns.find((column) => column.type === "primary")
        || columns.find((column) => ["name", "title", "label", "display_name", "last_name"].includes(String(column.key || "")))
        || columns.find((column) => !/_id$/i.test(String(column.key || "")) && column.key !== "club_id")
        || columns[0];
      return preferred ? renderDisplayValue(preferred, row) : esc(rowKey(row));
    }

    function cardHtml(row) {
      const key = rowKey(row);
      const explicitKey = String(config?.primaryColumnKey || config?.cardTitleKey || "").trim();
      const titleColumn = explicitKey
        ? columns.find((column) => column.key === explicitKey)
        : columns.find((column) => column.type === "primary") || columns.find((column) => column.key === "last_name") || columns[0];
      const metaColumns = columns.filter((column) => {
        if (column.type === "actions") return false;
        if (titleColumn && column.key === titleColumn.key) return false;
        if (!explicitKey && (column.key === "first_name" || column.key === "club_id")) return false;
        return true;
      });
      return `
        <article class="inline-card ${state.openEditorRowId === key ? "is-selected" : ""}" data-card-row-id="${esc(key)}">
          <div class="inline-card__head">
            <strong>${cardTitleValue(row)}</strong>
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
      const gt = gridTemplate();
      const gtMeta = gridTemplateMeta();
      const rows = filteredRows();
      const activeCount = rows.length;
      const totalCount = state.rows.length;
      const activeColumns = orderedColumns();
      const showToolbar = config?.showToolbar !== false;
      const showSearch = config?.showSearch !== false;
      const showCreateButton = config?.showCreateButton !== false;
      const showViewSwitch = config?.showViewSwitch !== false && supportsCardsMode();
      const currentView = effectiveViewMode();
      const showResetButton = config?.showResetButton !== false;
      const showMetaBar = config?.showMetaBar === true;
      const showFilterPanel = filterFields.length > 0 && state.filterPanelOpen !== false;
      const isRedesign = config?.redesign !== false;
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
      root.setAttribute("data-inline-layout", gtMeta.layout);
      root.setAttribute("data-inline-overflow", gtMeta.overflow ? "true" : "false");
      root.setAttribute("data-inline-view", currentView);
      root.setAttribute("data-rd-theme", resolveRedesignTheme());
      root.classList.toggle("is-redesign", isRedesign);

      const activeEl = document.activeElement;
      const focusState = activeEl && root.contains(activeEl)
        ? {
            id: String(activeEl.id || "").trim(),
            filterKey: String(activeEl.getAttribute?.("data-filter-key") || "").trim(),
            rdFilterKey: String(activeEl.getAttribute?.("data-rd-filter-key") || "").trim(),
            editorMode: String(activeEl.getAttribute?.("data-editor-mode") || "").trim(),
            editorKey: String(activeEl.getAttribute?.("data-editor-key") || "").trim(),
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
              <button type="button" class="${currentView === "table" ? "is-active" : ""}" data-view-mode="table" ${!supportsCardsMode() ? "disabled" : ""}>Tabelle</button>
              <button type="button" class="${currentView === "cards" ? "is-active" : ""}" data-view-mode="cards" ${!supportsCardsMode() ? "disabled" : ""}>Cards</button>
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
              ${config?.showColumnToggle !== false ? `<button type="button" class="feed-btn feed-btn--ghost${state.columnTogglePanelOpen ? " is-active" : ""}" data-inline-column-toggle="true" aria-label="Spalten ein-/ausblenden">⊞ Spalten</button>` : ""}
              ${config.showFilterButton ? `<button type="button" class="icon-utility${isRedesign && state.rdFiltersOpen ? " is-active" : ""}" data-inline-filter-toggle="true" aria-label="Filter">☰</button>` : ""}
              ${showResetButton ? `<button type="button" class="icon-utility" data-inline-reset="true" aria-label="Reset">↺</button>` : ""}
            </div>
          </div>
          ` : ""}
          ${config?.showColumnToggle !== false && state.columnTogglePanelOpen ? `
          <div class="column-toggle-panel">
            ${columns.filter((column) => column.type !== "actions").map((column) => `
              <label class="column-toggle-item">
                <input type="checkbox" data-column-toggle-key="${esc(column.key)}" ${!state.hiddenColumns.has(column.key) ? "checked" : ""} />
                <span>${esc(column.label)}</span>
              </label>
            `).join("")}
          </div>
          ` : ""}
          ${showFilterPanel && !isRedesign ? `
          <div class="filter-panel">
            ${filterFields.map((field) => filterControlHtml(field)).join("")}
          </div>
          ` : ""}
          ${showMetaBar ? `<div class="table-meta-bar">
            <span>${esc(config.metaLabel || "Datensätze")}: ${esc(activeCount)} / ${esc(totalCount)}</span>
            <span>${esc(config.metaHint || "")}</span>
          </div>` : ""}
          ${currentView === "table" ? `
            <div class="data-table-wrap">
              <div class="data-table">
                <div class="data-table__head" style="grid-template-columns:${esc(gt)}">
                  ${activeColumns.map((column) => headerCellHtml(column)).join("")}
                </div>
                ${isRedesign && state.rdFiltersOpen ? filterRowHtml(gt) : ""}
                ${state.createOpen ? editorRowHtml("create", state.draftCreate, "create", gt) : ""}
                ${!rows.length ? emptyStateHtml : ""}
                ${rows.map((row) => {
                  const key = rowKey(row);
                  const status = isRedesign ? rdRowStatus(row) : "";
                  return `
                    <div class="data-table__row ${state.openEditorRowId === key ? "is-selected" : ""}" data-row-id="${esc(key)}" style="grid-template-columns:${esc(gt)}"${status ? ` data-rd-status="${esc(status)}"` : ""}>
                      ${activeColumns.map((column) => dataCellHtml(column, row)).join("")}
                      ${isRedesign ? `<div class="rd-row-actions">
                        <button type="button" data-rd-row-action="edit" data-rd-row-id="${esc(key)}" aria-label="Bearbeiten">✎</button>
                        <button type="button" data-rd-row-action="menu" data-rd-row-id="${esc(key)}" aria-label="Mehr">⋯</button>
                      </div>` : ""}
                    </div>
                    ${state.openEditorRowId === key ? editorRowHtml("edit", row, key, gt) : ""}
                  `;
                }).join("")}
              </div>
            </div>
          ` : `
            <div class="cards-view">
              ${state.createOpen ? `<div class="inline-card inline-card--create">${editorRowHtml("create", state.draftCreate, "create", gt)}</div>` : ""}
              ${!rows.length ? emptyStateHtml : ""}
              ${rows.map((row) => cardHtml(row)).join("")}
            </div>
          `}
        </div>
      `;

      const nextWrap = root.querySelector(".data-table-wrap");
      if (currentView === "table" && nextWrap && lastTableScrollLeft > 0) {
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
        if (!nextFocus && focusState.rdFilterKey) {
          nextFocus = root.querySelector(`[data-rd-filter-key="${CSS.escape(focusState.rdFilterKey)}"]`);
        }
        if (!nextFocus && focusState.editorMode && focusState.editorKey) {
          nextFocus = root.querySelector(`[data-editor-mode="${CSS.escape(focusState.editorMode)}"][data-editor-key="${CSS.escape(focusState.editorKey)}"]`);
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
      if (target?.getAttribute?.("data-rd-filter-key")) {
        const key = String(target.getAttribute("data-rd-filter-key") || "");
        if (key) {
          state.rdInlineFilters[key] = String(target.value || "");
          render();
          return;
        }
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
          render();
        } else {
          setDraftValue(mode, key, target.value);
        }
      }
    });

    root.addEventListener("change", (event) => {
      if (event.target?.getAttribute?.("data-rd-filter-key")) {
        const key = String(event.target.getAttribute("data-rd-filter-key") || "");
        if (key) {
          state.rdInlineFilters[key] = String(event.target.value || "");
          render();
          return;
        }
      }

      const toggleKey = event.target?.getAttribute?.("data-column-toggle-key");
      if (toggleKey) {
        const key = String(toggleKey || "");
        if (key) {
          if (event.target.checked) {
            state.hiddenColumns.delete(key);
          } else {
            state.hiddenColumns.add(key);
          }
          persistLayout();
          render();
          config?.onLayoutChange?.({ columnOrder: state.columnOrder.slice(), columnWidths: { ...state.columnWidths }, hiddenColumns: [...state.hiddenColumns] });
        }
        return;
      }

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
      const utilityActionsLocal = Array.isArray(config?.utilityActions) ? config.utilityActions : [];
      const isRedesign = config?.redesign !== false;
      const insideColumnToggleSurface = target?.closest?.(".column-toggle-panel, [data-inline-column-toggle]");
      const insideUtilitySurface = target?.closest?.("[data-inline-utility-menu], [data-utility-action]");
      let closedFloatingUi = false;

      if (state.columnTogglePanelOpen && !insideColumnToggleSurface) {
        state.columnTogglePanelOpen = false;
        closedFloatingUi = true;
      }
      if (state.openUtilityMenuKey && !insideUtilitySurface) {
        state.openUtilityMenuKey = "";
        closedFloatingUi = true;
      }

      if (target?.closest?.("[data-inline-create-toggle]")) {
        event.preventDefault();
        event.stopPropagation();
        if (String(config?.rowInteractionMode || "").trim() === "dialog" && typeof config?.onCreateOpen === "function") {
          config.onCreateOpen?.({ open: true });
          return;
        }
        openCreateRow();
        return;
      }

      if (target?.closest?.("[data-inline-reset]")) {
        event.preventDefault();
        event.stopPropagation();
        state.search = "";
        state.filterPanelOpen = true;
        state.createOpen = false;
        state.openUtilityMenuKey = "";
        state.openEditorRowId = "";
        state.rdFiltersOpen = false;
        state.rdInlineFilters = {};
        state.draftCreate = typeof config?.getCreateDefaults === "function" ? cloneRow(config.getCreateDefaults()) : {};
        render();
        config?.onReset?.();
        return;
      }

      if (target?.closest?.("[data-inline-column-toggle]")) {
        event.preventDefault();
        event.stopPropagation();
        state.columnTogglePanelOpen = !state.columnTogglePanelOpen;
        render();
        return;
      }

      const hideBtn = target?.closest?.("[data-col-hide]");
      if (hideBtn) {
        event.preventDefault();
        event.stopPropagation();
        const key = String(hideBtn.getAttribute("data-col-hide") || "");
        if (key) {
          state.hiddenColumns.add(key);
          delete state.rdInlineFilters[key];
          persistLayout();
          render();
          config?.onLayoutChange?.({ columnOrder: state.columnOrder.slice(), columnWidths: { ...state.columnWidths }, hiddenColumns: [...state.hiddenColumns] });
        }
        return;
      }

      if (target?.closest?.("[data-inline-filter-toggle]")) {
        event.preventDefault();
        event.stopPropagation();
        if (isRedesign) {
          state.rdFiltersOpen = !state.rdFiltersOpen;
          render();
        } else if (filterFields.length) {
          state.filterPanelOpen = state.filterPanelOpen === false;
          render();
        }
        return;
      }

      // Redesign column menu
      const colMenuBtn = target?.closest?.("[data-col-menu-key]");
      if (colMenuBtn && isRedesign) {
        event.preventDefault();
        event.stopPropagation();
        const key = String(colMenuBtn.getAttribute("data-col-menu-key") || "");
        if (key) {
          const col = columns.find((c) => c.key === key);
          window.RdPopover?.openColumnMenu(colMenuBtn, key, col?.label || key, {
            sortAsc: () => {
              state.sortKey = key;
              state.sortDir = "asc";
              persistLayout();
              render();
              config?.onSortChange?.({ sortKey: state.sortKey, sortDir: state.sortDir });
            },
            sortDesc: () => {
              state.sortKey = key;
              state.sortDir = "desc";
              persistLayout();
              render();
              config?.onSortChange?.({ sortKey: state.sortKey, sortDir: state.sortDir });
            },
            hide: () => {
              state.hiddenColumns.add(key);
              delete state.rdInlineFilters[key];
              persistLayout();
              render();
              config?.onLayoutChange?.({ columnOrder: state.columnOrder.slice(), columnWidths: { ...state.columnWidths }, hiddenColumns: [...state.hiddenColumns] });
            },
            resetWidth: () => {
              const original = columns.find((c) => c.key === key);
              state.columnWidths[key] = original?.width || "minmax(120px, 1fr)";
              persistLayout();
              render();
            },
          });
        }
        return;
      }

      // Redesign row actions overlay
      const rdRowActionBtn = target?.closest?.("[data-rd-row-action]");
      if (rdRowActionBtn && isRedesign) {
        event.preventDefault();
        event.stopPropagation();
        const act = String(rdRowActionBtn.getAttribute("data-rd-row-action") || "");
        const rowId = String(rdRowActionBtn.getAttribute("data-rd-row-id") || "");
        const row = state.rows.find((entry) => rowKey(entry) === rowId);
        if (row) {
          if (act === "edit") {
            if (String(config?.rowInteractionMode || "").trim() === "dialog") {
              config?.onRowClick?.(row, { type: "row-action-edit" });
            } else {
              openEditor(row);
            }
          } else if (act === "menu") {
            window.RdPopover?.openRowMenu(rdRowActionBtn, rowId, {
              onEdit: () => {
                if (String(config?.rowInteractionMode || "").trim() === "dialog") {
                  config?.onRowClick?.(row, { type: "row-action-edit" });
                } else {
                  openEditor(row);
                }
              },
              onDuplicate: config?.onDuplicate ? () => config.onDuplicate(row) : null,
              onDelete: config?.onDelete ? () => config.onDelete(row) : null,
            });
          }
        }
        return;
      }

      const utilityMenuItem = target?.closest?.("[data-utility-menu-item]");
      if (utilityMenuItem) {
        event.preventDefault();
        event.stopPropagation();
        const actionKey = String(utilityMenuItem.getAttribute("data-utility-parent") || "");
        const itemKey = String(utilityMenuItem.getAttribute("data-utility-menu-item") || "");
        state.openUtilityMenuKey = "";
        render();
        if (actionKey && itemKey) {
          await config?.onUtilityAction?.({ actionKey, itemKey, visibleColumns: state.columnOrder.filter((key) => !state.hiddenColumns.has(key)) });
        }
        return;
      }

      const utilityBtn = target?.closest?.("[data-utility-action]");
      if (utilityBtn) {
        event.preventDefault();
        event.stopPropagation();
        const key = String(utilityBtn.getAttribute("data-utility-action") || "");
        if (key) {
          const utilityAction = utilityActionsLocal.find((entry) => String(entry?.key || "").trim() === key) || null;
          if (String(utilityAction?.kind || "") === "menu") {
            state.openUtilityMenuKey = state.openUtilityMenuKey === key ? "" : key;
            render();
          } else {
            state.openUtilityMenuKey = "";
            await config?.onUtilityAction?.({ actionKey: key, itemKey: "", visibleColumns: state.columnOrder.filter((key) => !state.hiddenColumns.has(key)) });
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
        event.preventDefault();
        event.stopPropagation();
        const requested = String(viewBtn.getAttribute("data-view-mode") || "table");
        state.viewMode = requested === "cards" && supportsCardsMode() ? "cards" : "table";
        persistLayout();
        render();
        config?.onViewModeChange?.({ viewMode: state.viewMode, effectiveViewMode: effectiveViewMode() });
        return;
      }

      if (sortBtn) {
        event.preventDefault();
        event.stopPropagation();
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
        event.preventDefault();
        event.stopPropagation();
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
        event.preventDefault();
        event.stopPropagation();
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
        event.preventDefault();
        event.stopPropagation();
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
        if (closedFloatingUi) {
          render();
        }
        return;
      }

      if (closedFloatingUi) {
        render();
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

    root.addEventListener("contextmenu", (event) => {
      const isRedesign = config?.redesign !== false;
      if (isRedesign) {
        const rowEl = event.target?.closest?.("[data-row-id]");
        if (rowEl) {
          event.preventDefault();
          const rowId = String(rowEl.getAttribute("data-row-id") || "");
          const row = state.rows.find((entry) => rowKey(entry) === rowId);
          if (row) {
            window.RdPopover?.openRowContextMenu(event.clientX, event.clientY, rowId, {
              onEdit: () => {
                if (String(config?.rowInteractionMode || "").trim() === "dialog") {
                  config?.onRowClick?.(row, { type: "row-action-edit" });
                } else {
                  openEditor(row);
                }
              },
              onDuplicate: config?.onDuplicate ? () => config.onDuplicate(row) : null,
              onDelete: config?.onDelete ? () => config.onDelete(row) : null,
            });
          }
          return;
        }
      }
      const head = event.target?.closest?.("[data-head-key]");
      if (!head) return;
      const key = String(head.getAttribute("data-head-key") || "");
      const col = columns.find((entry) => entry.key === key);
      if (!col || col.type === "actions") return;
      event.preventDefault();
      state.hiddenColumns.add(key);
      persistLayout();
      render();
      config?.onLayoutChange?.({ columnOrder: state.columnOrder.slice(), columnWidths: { ...state.columnWidths }, hiddenColumns: [...state.hiddenColumns] });
    });

    function handleDocumentPointerDown(event) {
      if (!root.isConnected) return;
      const target = event.target;
      if (root.contains(target)) return;
      let changed = false;
      if (state.columnTogglePanelOpen) {
        state.columnTogglePanelOpen = false;
        changed = true;
      }
      if (state.openUtilityMenuKey) {
        state.openUtilityMenuKey = "";
        changed = true;
      }
      if (changed) render();
    }

    function handleDocumentKeydown(event) {
      if (event.key !== "Escape") return;
      let changed = false;
      if (state.columnTogglePanelOpen) {
        state.columnTogglePanelOpen = false;
        changed = true;
      }
      if (state.openUtilityMenuKey) {
        state.openUtilityMenuKey = "";
        changed = true;
      }
      window.RdPopover?.close?.();
      if (changed) render();
    }

    ownerDocument.addEventListener("pointerdown", handleDocumentPointerDown, true);
    ownerDocument.addEventListener("keydown", handleDocumentKeydown);

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
        const limits = widthLimits(column, responsiveMode());
        const nextWidth = clamp(Math.round(startWidth + (moveEvent.clientX - startX)), limits.baseMin, limits.cap);
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

    ensureResponsiveObserver();
    render();

    const api = {
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
          hiddenColumns: [...state.hiddenColumns],
          visibleColumns: state.columnOrder.filter((key) => !state.hiddenColumns.has(key)),
        };
      },
      getColumns() {
        return columns.slice();
      },
      destroy() {
        ownerDocument.removeEventListener("pointerdown", handleDocumentPointerDown, true);
        ownerDocument.removeEventListener("keydown", handleDocumentKeydown);
        if (resizeObserver) {
          try {
            resizeObserver.disconnect();
          } catch {
            // noop
          }
          resizeObserver = null;
        }
        if (feedbackTimer) {
          window.clearTimeout(feedbackTimer);
          feedbackTimer = 0;
        }
        if (root._fcpApi === api) {
          delete root._fcpApi;
        }
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
      setRedesign(enabled) {
        config.redesign = !!enabled;
        if (!enabled) {
          state.rdFiltersOpen = false;
          state.rdInlineFilters = {};
        }
        render();
      },
      render,
    };

    root._fcpApi = api;
    return api;
  }

  window.FCPInlineDataTable = {
    createStandardV2,
  };
})();
