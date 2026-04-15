"use strict";

// Table/Dialog Host
// Zustaendig fuer: mountTableRuntime, emitTableRendererSnapshot,
//                  ensureDialog, ensureConfirmDialog, ensureInfoDialog,
//                  openInfoDialog, confirmAction, saveDialog, openTableDialog
//
// Wird als Prototype-Mixin in AdminPanelMask eingebunden:
//   FcpTableDialogHost.installOn(AdminPanelMask.prototype)
//
// Kein Domain-Code. Nur Dialog-Infrastruktur und Table-Runtime-Mount.

;(() => {
  const contractHub = window.FcpAdmQfmContractHub || {};
  const fieldContracts = contractHub.field || {};
  const tableContracts = contractHub.table || {};

  // ---------------------------------------------------------------------------
  // DOM-Helfer (lokal)
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
  // Dialog-Feld-Helfer
  // ---------------------------------------------------------------------------

  function createDialogReadonlyField(field) {
    return typeof fieldContracts.renderReadonlyFieldNode === "function"
      ? fieldContracts.renderReadonlyFieldNode(field, { createElement })
      : createElement("div");
  }

  function createDialogEditorField(field) {
    return typeof fieldContracts.renderFieldNode === "function"
      ? fieldContracts.renderFieldNode(field, {
          createElement,
          surface: "dialog",
          fieldClassName: "qfp-form-field",
          dataFieldAttr: "data-dialog-field",
        })
      : createElement("div");
  }

  function collectDialogDraft(root, fields) {
    return typeof fieldContracts.collectFieldPayload === "function"
      ? fieldContracts.collectFieldPayload(root, fields, {
          surface: "dialog",
          selectorAttr: "data-dialog-field",
          emptyAsNull: true,
        })
      : {};
  }

  // ---------------------------------------------------------------------------
  // mountTableRuntime
  // ---------------------------------------------------------------------------

  function mountTableRuntime(componentType, root, options) {
    const runtime = componentType === "inline-data-table"
      ? window.FCPInlineDataTable
      : window.FCPDataTable;
    const factory = componentType === "inline-data-table"
      ? runtime?.createStandardV2
      : runtime?.createStandardV1;

    if (typeof factory !== "function") {
      root.append(createElement("p", { className: "small", text: "Table runtime nicht geladen." }));
      return;
    }

    const { pattern, section, panel, columns, rows, tableConfig, onMessage } = options;
    const runtimeOptions = typeof tableContracts.buildTableRuntimeOptions === "function"
      ? tableContracts.buildTableRuntimeOptions(panel, columns, rows, {
          pattern,
          section,
          onMessage,
          confirmAction: typeof pattern?.confirmAction === "function"
            ? pattern.confirmAction.bind(pattern)
            : null,
          openTableDialog: typeof pattern?.openTableDialog === "function"
            ? pattern.openTableDialog.bind(pattern)
            : null,
        })
      : null;
    const resolvedRows = runtimeOptions?.rows || rows;
    const isStandardTable = componentType === "data-table";
    let renderRoot = root;
    let filterPanel = null;

    if (isStandardTable) {
      renderRoot = createElement("div", { className: "qfp-data-table-root" });
      filterPanel = createElement("div", { className: "filter-panel" });
    }

    const tableRuntimeProps = {
      root: renderRoot,
      columns: runtimeOptions?.columns || columns,
      rows: resolvedRows,
      tableId: runtimeOptions?.runtime?.tableId || tableConfig?.tableId || panel.id,
      rowKeyField: runtimeOptions?.runtime?.rowKeyField || tableConfig?.rowKeyField || undefined,
      gridTemplateColumns: runtimeOptions?.runtime?.gridTemplateColumns || tableConfig?.gridTemplateColumns || undefined,
      rowInteractionMode: runtimeOptions?.runtime?.rowInteractionMode || tableConfig?.rowInteractionMode || undefined,
      selectionMode: runtimeOptions?.runtime?.selectionMode || tableConfig?.selectionMode || undefined,
      viewMode: runtimeOptions?.runtime?.viewMode || tableConfig?.viewMode || undefined,
      sortKey: runtimeOptions?.runtime?.sortKey || tableConfig?.sortKey || undefined,
      sortDir: runtimeOptions?.runtime?.sortDir || tableConfig?.sortDir || undefined,
      filterFields: runtimeOptions?.runtime?.filterFields || (Array.isArray(tableConfig?.filterFields) ? tableConfig.filterFields : []),
      showToolbar: runtimeOptions?.runtime?.showToolbar,
      showCreateButton: runtimeOptions?.runtime?.showCreateButton,
      showResetButton: runtimeOptions?.runtime?.showResetButton,
      createLabel: runtimeOptions?.runtime?.createLabel,
      filterPanel,
      rowActions: runtimeOptions?.runtime?.rowActions || [],
      utilityActions: runtimeOptions?.runtime?.utilityActions || [],
      onUtilityAction: runtimeOptions?.runtime?.onUtilityAction,
      onRowClick: runtimeOptions?.runtime?.onRowClick,
      onRowAction: runtimeOptions?.runtime?.onRowAction,
      onCreateSubmit: runtimeOptions?.runtime?.onCreateSubmit,
      onEditSubmit: runtimeOptions?.runtime?.onEditSubmit,
      onDuplicate: runtimeOptions?.runtime?.onDuplicate,
      onDelete: runtimeOptions?.runtime?.onDelete,
    };

    window.requestAnimationFrame(() => {
      if (!root.isConnected) return;
      root.innerHTML = "";
      try {
        if (isStandardTable) {
          if (Array.isArray(tableRuntimeProps.filterFields) && tableRuntimeProps.filterFields.length) {
            root.append(filterPanel);
          }
          root.append(renderRoot);
        }
        const instance = factory(tableRuntimeProps);
        if (isStandardTable && instance && typeof instance.setRows === "function") {
          instance.setRows(Array.isArray(resolvedRows) ? resolvedRows : []);
        }
        emitTableRendererSnapshot(root, {
          componentType,
          factoryName: componentType === "inline-data-table" ? "FCPInlineDataTable.createStandardV2" : "FCPDataTable.createStandardV1",
          panelId: panel?.id || "",
          sectionId: section?.id || "",
          maskId: pattern?.config?.maskId || "",
          runtimeProps: tableRuntimeProps,
        });
      } catch (error) {
        root.innerHTML = "";
        const msg = (error instanceof Error && error.message) ? error.message : "Table runtime Fehler.";
        root.append(createElement("p", { className: "small", text: msg }));
      }
    });
  }

  // ---------------------------------------------------------------------------
  // emitTableRendererSnapshot
  // ---------------------------------------------------------------------------

  function emitTableRendererSnapshot(root, meta = {}) {
    if (!(root instanceof HTMLElement) || typeof window === "undefined") return;
    const normalizedHtml = String(root.innerHTML || "").replace(/\s+/g, " ").trim();
    const snapshot = {
      maskId: String(meta.maskId || "").trim(),
      sectionId: String(meta.sectionId || "").trim(),
      panelId: String(meta.panelId || "").trim(),
      componentType: String(meta.componentType || "").trim() || null,
      factoryName: String(meta.factoryName || "").trim() || null,
      rootClassName: root.className || "",
      expectedUi: {
        showToolbar: meta.runtimeProps?.showToolbar === true,
        showResetButton: meta.runtimeProps?.showResetButton === true,
        utilityActionKeys: Array.isArray(meta.runtimeProps?.utilityActions)
          ? meta.runtimeProps.utilityActions.map((entry) => String(entry?.key || "").trim()).filter(Boolean)
          : [],
        filterFieldCount: Array.isArray(meta.runtimeProps?.filterFields) ? meta.runtimeProps.filterFields.length : 0,
        viewMode: meta.runtimeProps?.viewMode || null,
      },
      dom: {
        hasToolbar: Boolean(root.querySelector(".data-table-shell__toolbar")),
        hasToolbarRight: Boolean(root.querySelector(".toolbar-right")),
        hasSearch: Boolean(root.querySelector("input[type='search']")),
        hasCreateButton: Boolean(root.querySelector("[data-inline-create-toggle], [data-fcp-create]")),
        hasResetButton: Boolean(root.querySelector("[data-inline-reset], [data-fcp-reset]")),
        hasUtilityButton: Boolean(root.querySelector("[data-utility-action], [data-fcp-utility-action]")),
        hasUtilityMenu: Boolean(root.querySelector(".data-table-utility-menu")),
        utilityMenuItemCount: root.querySelectorAll("[data-utility-menu-item], [data-fcp-utility-menu-item]").length,
        hasViewToggle: Boolean(root.querySelector(".view-toggle")),
        hasFilterPanel: Boolean(root.querySelector(".filter-panel")),
        hasTableHead: Boolean(root.querySelector(".data-table__head")),
        htmlSnippet: normalizedHtml.slice(0, 4000),
      },
      updatedAt: new Date().toISOString(),
    };
    root.dataset.fcpRenderer = snapshot.factoryName || "";
    root.dataset.fcpComponentType = snapshot.componentType || "";
    root.dataset.fcpToolbarPresent = snapshot.dom.hasToolbar ? "true" : "false";
    try {
      window.dispatchEvent(new CustomEvent("fcp-mask:renderer-mounted", { detail: snapshot }));
    } catch {
      // ignore
    }
  }

  // ---------------------------------------------------------------------------
  // Dialog-Mixin — wird via installOn auf AdminPanelMask.prototype gemountet
  // Jede Methode referenziert `this` (die Mask-Instanz).
  // ---------------------------------------------------------------------------

  function ensureDialog() {
    if (this.refs.dialog) return;
    const dialog = createElement("dialog", {
      className: "catch-dialog",
      attrs: {
        id: `${String(this.config.maskId || "adm-mask").replace(/[^a-z0-9_-]/gi, "-")}--table-dialog`,
      },
    });
    const form = createElement("form", {
      className: "catch-dialog__form",
      attrs: { method: "dialog" },
    });
    const title = createElement("h3", { text: "Details" });
    const body = createElement("div", { className: "catch-dialog__body qfp-readonly-grid" });
    const actions = createElement("div", { className: "catch-dialog__actions" });
    const closeAction = createElement("button", {
      className: "feed-btn feed-btn--ghost",
      text: "Schliessen",
      attrs: { type: "submit" },
    });
    const saveAction = createElement("button", {
      className: "feed-btn",
      text: "Speichern",
      attrs: { type: "button", hidden: "hidden" },
      onClick: async () => {
        await this.saveDialog();
      },
    });
    actions.append(closeAction, saveAction);
    form.append(title, body, actions);
    dialog.append(form);
    document.body.append(dialog);
    this.refs.dialog = dialog;
    this.refs.dialogForm = form;
    this.refs.dialogTitle = title;
    this.refs.dialogBody = body;
    this.refs.dialogCloseAction = closeAction;
    this.refs.dialogSaveAction = saveAction;
    dialog.addEventListener("close", () => {
      this.state.dialogContext = null;
    });
  }

  function ensureConfirmDialog() {
    if (this.refs.confirmDialog) return;
    const dialog = createElement("dialog", {
      className: "catch-dialog catch-dialog--panel",
      attrs: {
        id: `${String(this.config.maskId || "adm-mask").replace(/[^a-z0-9_-]/gi, "-")}--confirm-dialog`,
        "data-guard-no-draft": "1",
      },
    });
    const form = createElement("form", {
      className: "catch-dialog__form",
      attrs: { method: "dialog" },
    });
    const title = createElement("h3", { text: "Bitte bestaetigen" });
    const body = createElement("div", { className: "catch-dialog__body" });
    const actions = createElement("div", { className: "catch-dialog__actions" });
    const cancelAction = createElement("button", {
      className: "feed-btn feed-btn--ghost",
      text: "Abbrechen",
      attrs: { type: "submit", value: "cancel" },
    });
    const confirmActionBtn = createElement("button", {
      className: "feed-btn",
      text: "Bestaetigen",
      attrs: { type: "submit", value: "confirm" },
    });
    actions.append(cancelAction, confirmActionBtn);
    form.append(title, body, actions);
    dialog.append(form);
    document.body.append(dialog);
    this.refs.confirmDialog = dialog;
    this.refs.confirmDialogTitle = title;
    this.refs.confirmDialogBody = body;
    this.refs.confirmDialogCancel = cancelAction;
    this.refs.confirmDialogConfirm = confirmActionBtn;
  }

  function ensureInfoDialog() {
    if (this.refs.infoDialog) return;
    const dialog = createElement("dialog", {
      className: "catch-dialog catch-dialog--panel qfp-info-dialog",
      attrs: {
        id: `${String(this.config.maskId || "adm-mask").replace(/[^a-z0-9_-]/gi, "-")}--info-dialog`,
        role: "dialog",
        "aria-modal": "true",
      },
    });
    const shell = createElement("form", {
      className: "catch-dialog__form qfp-info-dialog__shell",
      attrs: { method: "dialog" },
    });
    const header = createElement("div", { className: "qfp-info-dialog__header" });
    const title = createElement("h3", { text: "Hinweis" });
    const closeAction = createElement("button", {
      className: "feed-btn feed-btn--ghost qfp-info-dialog__close",
      text: "X",
      attrs: { type: "submit", value: "close", "aria-label": "Hilfe schliessen" },
      onClick: (event) => {
        event.preventDefault();
        if (dialog.open) dialog.close();
      },
    });
    const body = createElement("div", { className: "catch-dialog__body qfp-info-dialog__body" });
    header.append(title, closeAction);
    shell.append(header, body);
    dialog.append(shell);
    document.body.append(dialog);
    this.refs.infoDialog = dialog;
    this.refs.infoDialogTitle = title;
    this.refs.infoDialogBody = body;
    this.refs.infoDialogClose = closeAction;
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog && dialog.open) dialog.close();
    });
    dialog.addEventListener("cancel", () => {
      this.infoDialogTrigger = this.infoDialogTrigger || document.activeElement;
    });
    dialog.addEventListener("close", () => {
      const trigger = this.infoDialogTrigger;
      this.infoDialogTrigger = null;
      if (trigger && typeof trigger.focus === "function") {
        trigger.focus();
      }
    });
  }

  function openInfoDialog({ title, description, trigger } = {}) {
    const text = String(description || "").trim();
    if (!text) return;
    this.ensureInfoDialog();
    const dialog = this.refs.infoDialog;
    const titleNode = this.refs.infoDialogTitle;
    const body = this.refs.infoDialogBody;
    const closeAction = this.refs.infoDialogClose;
    if (!dialog || !titleNode || !body || !closeAction) return;
    this.infoDialogTrigger = trigger || null;
    titleNode.textContent = String(title || "Hinweis");
    body.innerHTML = "";
    body.append(createElement("p", { className: "small", text }));
    if (!dialog.open) dialog.showModal();
    closeAction.focus();
  }

  function confirmAction({ title, message, confirmLabel, confirmVariant } = {}) {
    this.ensureConfirmDialog();
    const dialog = this.refs.confirmDialog;
    const titleNode = this.refs.confirmDialogTitle;
    const body = this.refs.confirmDialogBody;
    const confirmButton = this.refs.confirmDialogConfirm;
    if (!dialog || !titleNode || !body || !confirmButton) {
      return Promise.resolve(window.confirm(String(message || "Aktion bestaetigen?")));
    }

    titleNode.textContent = String(title || "Bitte bestaetigen");
    body.innerHTML = "";
    body.append(createElement("p", {
      className: "small",
      text: String(message || "Aktion bestaetigen?"),
    }));
    confirmButton.textContent = String(confirmLabel || "Bestaetigen");
    confirmButton.className = confirmVariant === "danger"
      ? "feed-btn feed-btn--danger"
      : "feed-btn";

    return new Promise((resolve) => {
      const handleClose = () => {
        dialog.removeEventListener("close", handleClose);
        resolve(dialog.returnValue === "confirm");
      };
      dialog.addEventListener("close", handleClose);
      if (!dialog.open) dialog.showModal();
    });
  }

  async function saveDialog() {
    const context = this.state.dialogContext;
    if (!context?.sectionId || !context?.panelId || !Array.isArray(context.fields)) return;
    const draft = collectDialogDraft(this.refs.dialogBody, context.fields);
    const payload = typeof tableContracts.buildTableRowSavePayload === "function"
      ? tableContracts.buildTableRowSavePayload(context.row, draft)
      : { ...(context.row || {}), ...(draft || {}) };
    const result = await this.savePanel(context.sectionId, context.panelId, payload);
    if (result?.ok && this.refs.dialog?.open) {
      this.refs.dialog.close();
    }
  }

  function openTableDialog({ section, panel, row, mode = "detail", fields = [], writable = false } = {}) {
    this.ensureDialog();
    const dialog = this.refs.dialog;
    const title = this.refs.dialogTitle;
    const body = this.refs.dialogBody;
    const saveAction = this.refs.dialogSaveAction;
    if (!dialog || !title || !body || !panel) return;

    title.textContent = panel.title || panel.id || "Details";
    body.innerHTML = "";

    const dialogFields = Array.isArray(fields) && fields.length
      ? fields
      : (typeof tableContracts.buildTableDialogFields === "function"
          ? tableContracts.buildTableDialogFields(panel, row)
          : []);
    const editable = writable && dialogFields.some((field) => field?.editable !== false);

    body.className = editable ? "catch-dialog__body qfp-form-grid" : "catch-dialog__body qfp-readonly-grid";
    dialogFields.forEach((field) => {
      body.append(editable ? createDialogEditorField(field) : createDialogReadonlyField(field));
    });

    if (!dialogFields.length) {
      body.append(createElement("p", {
        className: "small",
        text: "Keine Felder verfuegbar.",
      }));
    }

    body.dataset.panelId = panel.id || "";
    body.dataset.sectionId = section?.id || "";
    body.dataset.mode = mode;
    if (saveAction) {
      saveAction.hidden = !editable;
    }
    this.state.dialogContext = {
      sectionId: section?.id || "",
      panelId: panel.id || "",
      row: row || null,
      fields: dialogFields,
      writable: editable,
    };

    if (!dialog.open) dialog.showModal();
  }

  // ---------------------------------------------------------------------------
  // installOn — patcht AdminPanelMask.prototype mit allen Dialog-Methoden
  // ---------------------------------------------------------------------------

  function installOn(proto) {
    proto.ensureDialog = ensureDialog;
    proto.ensureConfirmDialog = ensureConfirmDialog;
    proto.ensureInfoDialog = ensureInfoDialog;
    proto.openInfoDialog = openInfoDialog;
    proto.confirmAction = confirmAction;
    proto.saveDialog = saveDialog;
    proto.openTableDialog = openTableDialog;
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  window.FcpTableDialogHost = Object.freeze({
    installOn,
    mountTableRuntime,
  });
})();
