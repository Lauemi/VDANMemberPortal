"use strict";

// Shared Content Renderers — ADM + QFM
// Zustaendig fuer: renderReadonlyContent, renderMixedContent, renderFormContent,
//                  renderTableContent, renderActionsContent
// Kein Domain-Code. Kein direkter DB-Zugriff.
// Invite-spezifische Ergebniskarte wird ueber window.VdanDomainAdapterVereinsverwaltung.renderFormResultCard delegiert.

;(() => {
  const contractHub = window.FcpAdmQfmContractHub || {};
  const fieldContracts = contractHub.field || {};
  const tableContracts = contractHub.table || {};

  // ---------------------------------------------------------------------------
  // DOM-Helfer (lokal, keine externe Abhaengigkeit)
  // ---------------------------------------------------------------------------

  function createElement(tagName, options = {}) {
    const node = document.createElement(tagName);
    if (options.className) node.className = options.className;
    if (options.text != null) node.textContent = String(options.text);
    Object.entries(options.attrs || {}).forEach(([key, value]) => {
      if (value == null || value === false) return;
      node.setAttribute(key, value === true ? "" : String(value));
    });
    if (typeof options.onClick === "function") {
      node.addEventListener("click", options.onClick);
    }
    if (typeof options.onSubmit === "function") {
      node.addEventListener("submit", options.onSubmit);
    }
    return node;
  }

  function valueToText(value) {
    if (value == null || value === "") return "-";
    if (typeof value === "boolean") return value ? "Ja" : "Nein";
    return String(value);
  }

  function isMeaningfulReadonlyValue(value) {
    if (value == null) return false;
    if (typeof value === "boolean" || typeof value === "number") return true;
    const text = String(value).trim();
    return text !== "" && text !== "-";
  }

  // ---------------------------------------------------------------------------
  // renderReadonlyContent
  // ---------------------------------------------------------------------------

  function renderReadonlyContent(panel, emptyText) {
    const content = panel.loadedContent || panel.content || {};
    const rows = Array.isArray(content.rows) ? content.rows : [];
    const effectiveEmptyText = String(
      panel?.emptyStateText || content?.emptyStateText || panel?.meta?.emptyStateText || emptyText
    ).trim() || emptyText;
    const visibleRows = rows.filter((row) => isMeaningfulReadonlyValue(row?.value));
    const wrap = createElement("div", { className: "qfp-readonly-grid" });
    if (!visibleRows.length) {
      wrap.append(createElement("p", { className: "small", text: effectiveEmptyText }));
      return wrap;
    }
    visibleRows.forEach((row) => {
      const item = createElement("div", {
        className: `qfp-readonly-item${row.span === "full" ? " is-full" : ""}`,
      });
      item.append(
        createElement("div", { className: "qfp-field-label", text: row.label || "-" }),
        createElement("div", { className: "qfp-field-value", text: valueToText(row.value) })
      );
      wrap.append(item);
    });
    return wrap;
  }

  // ---------------------------------------------------------------------------
  // renderMixedContent
  // ---------------------------------------------------------------------------

  function renderMixedContent(panel, emptyText) {
    const content = panel.loadedContent || panel.content || {};
    const blocks = Array.isArray(content.blocks) ? content.blocks : [];
    const wrap = createElement("div", { className: "qfp-mixed-stack" });
    if (!blocks.length) {
      wrap.append(createElement("p", { className: "small", text: emptyText }));
      return wrap;
    }
    blocks.forEach((block) => {
      const blockNode = createElement("div", { className: "qfp-mixed-block" });
      if (block.title) {
        blockNode.append(createElement("h4", { text: block.title }));
      }
      if (block.renderMode === "readonly" && block.content?.rows) {
        const surrogate = { loadedContent: block.content };
        blockNode.append(renderReadonlyContent(surrogate, emptyText));
      } else {
        blockNode.append(createElement("p", { className: "small", text: block.emptyStateText || emptyText }));
      }
      wrap.append(blockNode);
    });
    return wrap;
  }

  // ---------------------------------------------------------------------------
  // renderFormContent
  // ---------------------------------------------------------------------------

  function renderFormContent(pattern, section, panel, emptyText) {
    const content = panel.loadedContent || panel.content || {};
    const fields = Array.isArray(content.fields) ? content.fields : [];
    const visibleFields = fields.filter((field) => field?.hidden !== true);
    const groupDefs = Array.isArray(panel?.meta?.resolver?.groupDefs)
      ? panel.meta.resolver.groupDefs
      : Array.isArray(panel?.meta?.form?.groupDefs)
        ? panel.meta.form.groupDefs
        : [];

    function fieldValueMap() {
      return fields.reduce((acc, field) => {
        acc[String(field?.name || "").trim()] = field?.value;
        return acc;
      }, {});
    }

    function isFieldEnabled(field, values) {
      const enabledKey = String(field?.enabledWhenField || "").trim();
      if (enabledKey && values?.[enabledKey] !== true) return false;
      const disabledKey = String(field?.disabledWhenField || "").trim();
      if (disabledKey && values?.[disabledKey] === true) return false;
      return true;
    }

    function syncDependentFields(form) {
      const values = {};
      fields.forEach((field) => {
        const name = String(field?.name || "").trim();
        if (!name) return;
        const input = form.querySelector(`[name="${CSS.escape(name)}"]`);
        if (!input) return;
        values[name] = input.type === "checkbox" ? Boolean(input.checked) : input.value;
      });
      fields.forEach((field) => {
        const name = String(field?.name || "").trim();
        if (!name) return;
        const input = form.querySelector(`[name="${CSS.escape(name)}"]`);
        if (!input) return;
        const explicitlyDisabled = field.disabled === true || field.readonly === true;
        const enabledByDependency = isFieldEnabled(field, values);
        const disabled = explicitlyDisabled || !enabledByDependency;
        input.disabled = disabled;
        if (typeof input.placeholder === "string") {
          const fallbackField = String(field?.fallbackFromField || "").trim();
          if (disabled && fallbackField && values?.[fallbackField] != null && String(values[fallbackField]).trim() !== "") {
            input.placeholder = String(values[fallbackField]);
          } else {
            input.placeholder = field.placeholder || "";
          }
        }
        if (disabled && !explicitlyDisabled && input.type !== "checkbox") {
          input.value = "";
        }
      });
    }

    function fieldHelpText(field) {
      return String(field?.help || field?.helpText || field?.description || "").trim();
    }

    function createFieldNode(field, initialValues) {
      const disabled = field.disabled === true || field.readonly === true || !isFieldEnabled(field, initialValues);
      return typeof fieldContracts.renderFieldNode === "function"
        ? fieldContracts.renderFieldNode({
            ...field,
            disabled,
            help: fieldHelpText(field),
          }, {
            createElement,
            surface: "form",
            fieldClassName: "qfp-form-field",
          })
        : createElement("div");
    }

    function renderFlatFields(target, initialValues) {
      visibleFields.forEach((field) => {
        target.append(createFieldNode(field, initialValues));
      });
    }

    function renderGroupedFields(target, initialValues) {
      const fieldsByGroup = visibleFields.reduce((acc, field) => {
        const key = String(field?.group || "").trim() || "__ungrouped__";
        if (!acc.has(key)) acc.set(key, []);
        acc.get(key).push(field);
        return acc;
      }, new Map());
      const orderedGroupDefs = groupDefs.length
        ? groupDefs
        : [...fieldsByGroup.keys()].map((groupKey) => ({ key: groupKey, title: groupKey }));
      orderedGroupDefs.forEach((groupDef) => {
        const key = String(groupDef?.key || "").trim();
        const groupFields = fieldsByGroup.get(key) || [];
        if (!groupFields.length) return;
        const details = createElement("details", {
          className: `qfp-form-group${groupDef?.defaultOpen ? " is-open" : ""}`,
          attrs: groupDef?.defaultOpen ? { open: "open" } : {},
        });
        const summary = createElement("summary", { className: "qfp-form-group__summary" });
        const summaryMain = createElement("div", { className: "qfp-form-group__summary-main" });
        summaryMain.append(createElement("span", {
          className: "qfp-form-group__title",
          text: String(groupDef?.title || key || "Gruppe"),
        }));
        if (groupDef?.hint) {
          summaryMain.append(createElement("span", {
            className: "qfp-form-group__hint",
            text: String(groupDef.hint),
          }));
        }
        summary.append(summaryMain);
        details.append(summary);
        const groupGrid = createElement("div", { className: "qfp-form-group__grid" });
        groupFields.forEach((field) => {
          groupGrid.append(createFieldNode(field, initialValues));
        });
        details.append(groupGrid);
        target.append(details);
      });
      const ungroupedFields = fieldsByGroup.get("__ungrouped__") || [];
      if (ungroupedFields.length) {
        const groupGrid = createElement("div", { className: "qfp-form-group__grid qfp-form-group__grid--ungrouped" });
        ungroupedFields.forEach((field) => {
          groupGrid.append(createFieldNode(field, initialValues));
        });
        target.append(groupGrid);
      }
    }

    const form = createElement("form", {
      className: "qfp-form-grid",
      onSubmit: async (event) => {
        event.preventDefault();
        const payload = typeof fieldContracts.collectFieldPayload === "function"
          ? fieldContracts.collectFieldPayload(form, fields, {
              surface: "form",
              selectorAttr: "name",
              emptyAsNull: false,
            })
          : {};
        await pattern.savePanel(section.id, panel.id, payload);
      },
    });

    if (!fields.length) {
      form.append(createElement("div", { className: "qfp-empty", text: emptyText }));
      return form;
    }

    const initialValues = fieldValueMap();
    if (groupDefs.length) {
      renderGroupedFields(form, initialValues);
    } else {
      renderFlatFields(form, initialValues);
    }

    // Domain-spezifischer Ergebnisblock (z.B. Invite-Result-Card) via Domain-Adapter-Hook
    const domainResultCard = typeof window.VdanDomainAdapterVereinsverwaltung?.renderFormResultCard === "function"
      ? window.VdanDomainAdapterVereinsverwaltung.renderFormResultCard(panel, fields, { createElement, pattern })
      : null;
    if (domainResultCard) {
      form.append(domainResultCard);
    }

    const writeableFields = visibleFields.filter((field) => field.readonly !== true && field.disabled !== true);
    if (writeableFields.length) {
      const actionBar = createElement("div", { className: "qfp-action-bar" });
      const primaryAction = Array.isArray(content.actions)
        ? content.actions.find((action) => String(action?.action || "").trim() === "submit")
        : null;
      actionBar.append(
        createElement("button", {
          className: "qfp-btn qfp-btn--primary",
          text: primaryAction?.label || "Speichern",
          attrs: { type: "submit" },
        })
      );
      form.append(actionBar);
    }

    form.addEventListener("input", () => syncDependentFields(form));
    form.addEventListener("change", () => syncDependentFields(form));
    syncDependentFields(form);
    return form;
  }

  // ---------------------------------------------------------------------------
  // renderTableContent
  // ---------------------------------------------------------------------------

  function renderTableContent(pattern, section, panel, emptyText) {
    const content = panel.loadedContent || panel.content || {};
    const contentRows = Array.isArray(content.rows) ? content.rows : null;
    const panelRows = Array.isArray(panel.rows) ? panel.rows : [];
    const rows = contentRows && contentRows.length ? contentRows : panelRows;
    const columns = Array.isArray(panel.columns) ? panel.columns : [];
    const emptyMessage = panel.state?.error || panel.state?.message || emptyText;

    if (!columns.length) {
      return createElement("p", { className: "small", text: emptyMessage });
    }

    const componentType = normalizeTableComponentType(panel.componentType);
    if (componentType === "data-table" || componentType === "inline-data-table") {
      const wrap = createElement("div", { className: "qfp-table-wrap" });
      if (!rows.length && emptyMessage) {
        wrap.append(createElement("div", {
          className: panel.state?.error ? "qfp-inline-error" : "qfp-empty",
          text: emptyMessage,
        }));
      }
      const mount = createElement("div", {
        className: componentType === "inline-data-table" ? "qfp-inline-data-table-root" : "qfp-data-table-root",
      });
      wrap.append(mount);
      // Delegiere an Table/Dialog-Host
      const host = window.FcpTableDialogHost;
      if (typeof host?.mountTableRuntime === "function") {
        host.mountTableRuntime(componentType, mount, {
          pattern,
          section,
          panel,
          columns,
          rows,
          tableConfig: panel.tableConfig || {},
          onMessage: pattern?.config?.onMessage || pattern?.config?.setMessage || null,
        });
      } else {
        mount.append(createElement("p", { className: "small", text: "Table-Host nicht geladen." }));
      }
      return wrap;
    }

    const wrap = createElement("div", { className: "work-part-table-wrap" });
    if (!rows.length && emptyMessage) {
      wrap.append(createElement("div", {
        className: panel.state?.error ? "qfp-inline-error" : "qfp-empty",
        text: emptyMessage,
      }));
    }
    const table = createElement("table", { className: "work-part-table" });
    const thead = createElement("thead");
    const headRow = createElement("tr");
    columns.forEach((column) => headRow.append(createElement("th", { text: column.label || column.key || "-" })));
    thead.append(headRow);
    const tbody = createElement("tbody");
    rows.forEach((row) => {
      const tr = createElement("tr");
      columns.forEach((column) => {
        tr.append(createElement("td", { text: valueToText(row?.[column.key]) }));
      });
      tbody.append(tr);
    });
    table.append(thead, tbody);
    wrap.append(table);
    return wrap;
  }

  function normalizeTableComponentType(value) {
    if (typeof tableContracts.normalizeTableComponentType === "function") {
      return tableContracts.normalizeTableComponentType(value);
    }
    const raw = String(value || "").trim();
    if (!raw) return null;
    if (raw === "data-table" || raw === "DataTablePanel") return "data-table";
    if (raw === "inline-data-table" || raw === "InlineDataTablePanel") return "inline-data-table";
    return null;
  }

  // ---------------------------------------------------------------------------
  // renderActionsContent
  // ---------------------------------------------------------------------------

  function renderActionsContent(panel, emptyText) {
    const actions = Array.isArray(panel.actions) ? panel.actions : [];
    const wrap = createElement("div", { className: "qfp-action-bar" });
    if (!actions.length) {
      wrap.append(createElement("p", { className: "small", text: emptyText }));
      return wrap;
    }
    actions.forEach((action) => {
      wrap.append(createElement("button", {
        className: `feed-btn${action.variant === "ghost" ? " feed-btn--ghost" : ""}`,
        text: action.label || action.id || "Action",
        attrs: { type: "button", disabled: action.disabled ? "disabled" : undefined },
        onClick: typeof action.onClick === "function" ? action.onClick : undefined,
      }));
    });
    return wrap;
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  window.FcpAdmQfmSharedRenderers = Object.freeze({
    renderReadonlyContent,
    renderMixedContent,
    renderFormContent,
    renderTableContent,
    renderActionsContent,
    createElement,
    valueToText,
    isMeaningfulReadonlyValue,
  });
})();
