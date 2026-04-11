"use strict";

;(() => {
  const contractHub = window.FcpAdmQfmContractHub || {};
  const sharedContracts = contractHub.shared || {};
  const tableContracts = contractHub.table || {};
  const dialogContracts = contractHub.dialog || {};

  const DEFAULTS = {
    maskFamily: "ADM",
    maskType: "workspace",
    currentRoles: [],
    currentScopes: {
      globalUser: true,
      authSystem: false,
      clubReadonly: true,
      clubOverride: false,
      billingSnapshot: false,
      consentAppendOnly: false,
    },
    texts: {
      loadError: "Inhalt konnte nicht geladen werden.",
      saveError: "Aenderungen konnten nicht gespeichert werden.",
      saveSuccess: "Aenderungen gespeichert.",
      empty: "Keine Daten vorhanden.",
    },
  };

  function createAdminPanelMask(config) {
    return new AdminPanelMask(config);
  }

  class AdminPanelMask {
    constructor(config) {
      if (!config || !config.root) {
        throw new Error("AdminPanelMask requires a root element");
      }

      this.config = mergeDeep(structuredCloneSafe(DEFAULTS), config || {});
      this.root = resolveElement(this.config.root);
      if (!this.root) {
        throw new Error("AdminPanelMask root element not found");
      }

      this.state = {
        maskStatus: "idle",
        maskError: null,
        activeSectionId: this.config.workspaceNav?.defaultSectionId || firstSectionId(this.config.sections),
        sections: normalizeSections(this.config.sections || []),
        loading: new Set(),
        saving: new Set(),
        dialogContext: null,
      };

      this.refs = {
        shell: null,
        nav: null,
        content: null,
        status: null,
        dialog: null,
        dialogForm: null,
        dialogTitle: null,
        dialogBody: null,
        dialogCloseAction: null,
        dialogSaveAction: null,
        confirmDialog: null,
        confirmDialogTitle: null,
        confirmDialogBody: null,
        confirmDialogCancel: null,
        confirmDialogConfirm: null,
        infoDialog: null,
        infoDialogTitle: null,
        infoDialogBody: null,
        infoDialogClose: null,
      };
      this.infoDialogTrigger = null;
    }

    async init() {
      this.render();
      if (typeof this.config.load === "function") {
        await this.loadMask();
      }
      return this;
    }

    getState() {
      return structuredCloneSafe({
        maskStatus: this.state.maskStatus,
        maskError: this.state.maskError,
        activeSectionId: this.state.activeSectionId,
        sections: this.state.sections,
      });
    }

    async loadMask() {
      this.state.maskStatus = "loading";
      this.state.maskError = null;
      this.renderStatus();

      try {
        const result = await this.config.load(this.createContext());
        if (result) {
          this.applyMaskPayload(result);
        }
        this.state.maskStatus = "ready";
        this.render();
      } catch (error) {
        this.state.maskStatus = "error";
        this.state.maskError = normalizeErrorMessage(error, this.config.texts.loadError);
        this.renderStatus();
      }
    }

    async activateSection(sectionId) {
      if (!sectionId || sectionId === this.state.activeSectionId) return;
      const section = this.findSection(sectionId);
      if (!section) return;
      this.state.activeSectionId = sectionId;
      this.render();
      await this.hydrateActiveSection();
    }

    async hydrateVisiblePanels() {
      await this.hydrateActiveSection();
    }

    async hydrateActiveSection() {
      const section = this.getActiveSection();
      if (!section) return;
      for (const panel of section.panels || []) {
        await this.loadPanel(section.id, panel.id);
      }
      this.render();
    }

    async loadPanel(sectionId, panelId) {
      const section = this.findSection(sectionId);
      const panel = this.findPanel(sectionId, panelId);
      if (!section || !panel || typeof panel.load !== "function") return;

      const key = `${section.id}:${panel.id}`;
      if (this.state.loading.has(key)) return;
      this.state.loading.add(key);
      try {
        const result = await panel.load(this.createContext({ section, panel }));
        if (result) {
          this.applyPanelPayload(section.id, panel.id, result);
        }
      } catch (error) {
        panel.state = {
          ...(panel.state || {}),
          error: normalizeErrorMessage(error, this.config.texts.loadError),
        };
      } finally {
        this.state.loading.delete(key);
      }
    }

    async savePanel(sectionId, panelId, payload) {
      const section = this.findSection(sectionId);
      const panel = this.findPanel(sectionId, panelId);
      if (!section || !panel) return { ok: false, error: "panel_not_found" };
      if (typeof this.config.save !== "function") {
        return { ok: false, error: "save_not_configured" };
      }

      const key = `${section.id}:${panel.id}`;
      if (this.state.saving.has(key)) return { ok: false, error: "save_in_progress" };
      this.state.saving.add(key);
      panel.state = {
        ...(panel.state || {}),
        saveState: "saving",
        error: null,
        message: null,
      };
      this.render();

      try {
        const result = await this.config.save(payload, this.createContext({ section, panel, payload, pattern: this }));
        if (result) {
          this.applyPanelPayload(section.id, panel.id, result);
        } else if (panel.renderMode === "form") {
          const current = panel.loadedContent || panel.content || {};
          panel.loadedContent = {
            ...current,
            fields: (current.fields || []).map((field) => ({
              ...field,
              value: Object.prototype.hasOwnProperty.call(payload || {}, field.name) ? payload[field.name] : field.value,
            })),
          };
        }
        panel.state = {
          ...(panel.state || {}),
          saveState: "saved",
          error: null,
          message: this.config.texts.saveSuccess,
        };
        this.render();
        return { ok: true, result };
      } catch (error) {
        panel.state = {
          ...(panel.state || {}),
          saveState: "error",
          error: normalizeErrorMessage(error, this.config.texts.saveError),
          message: null,
        };
        this.render();
        return { ok: false, error };
      } finally {
        this.state.saving.delete(key);
      }
    }

    render() {
      if (!this.refs.shell) {
        this.root.innerHTML = "";
        this.refs.shell = createElement("div", {
          className: "admin-board fcp-adm-shell",
          attrs: {
            "data-mask-family": String(this.config.maskFamily || "ADM"),
            "data-mask-type": String(this.config.maskType || "workspace"),
          },
        });
        this.refs.nav = createElement("aside", {
          className: "admin-board__nav",
          attrs: { "aria-label": this.config.navLabel || "Workspace Navigation" },
        });
        this.refs.content = createElement("div", { className: "admin-board__content" });
        this.refs.status = createElement("div", { className: "qfp-mask-status", attrs: { "aria-live": "polite" } });
        this.root.append(this.refs.shell);
        this.refs.shell.append(this.refs.nav, this.refs.content);
        this.root.append(this.refs.status);
      }

      this.renderNav();
      this.renderContent();
      this.renderStatus();
      this.ensureDialog();
    }

    ensureDialog() {
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

    ensureConfirmDialog() {
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
      const confirmAction = createElement("button", {
        className: "feed-btn",
        text: "Bestaetigen",
        attrs: { type: "submit", value: "confirm" },
      });
      actions.append(cancelAction, confirmAction);
      form.append(title, body, actions);
      dialog.append(form);
      document.body.append(dialog);
      this.refs.confirmDialog = dialog;
      this.refs.confirmDialogTitle = title;
      this.refs.confirmDialogBody = body;
      this.refs.confirmDialogCancel = cancelAction;
      this.refs.confirmDialogConfirm = confirmAction;
    }

    ensureInfoDialog() {
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
          closeDialog();
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
      const closeDialog = () => {
        if (dialog.open) dialog.close();
      };
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
          closeDialog();
        }
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

    openInfoDialog({ title, description, trigger } = {}) {
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
      body.append(createElement("p", {
        className: "small",
        text,
      }));
      if (!dialog.open) dialog.showModal();
      closeAction.focus();
    }

    renderSectionTitleWithInfo(text, description) {
      const wrap = createElement("div", { className: "qfp-section-heading" });
      wrap.append(createElement("h2", { text: text || "-" }));
      if (String(description || "").trim()) {
        let button = null;
        button = createElement("button", {
          className: "qfp-info-trigger",
          text: "i",
          attrs: {
            type: "button",
            "aria-label": `${text || "Bereich"} Hinweise anzeigen`,
          },
          onClick: () => {
            this.openInfoDialog({
              title: text,
              description,
              trigger: button,
            });
          },
        });
        wrap.append(button);
      }
      return wrap;
    }

    confirmAction({ title, message, confirmLabel, confirmVariant } = {}) {
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
      body.append(
        createElement("p", {
          className: "small",
          text: String(message || "Aktion bestaetigen?"),
        })
      );
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

    async saveDialog() {
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

    openTableDialog({ section, panel, row, mode = "detail", fields = [], writable = false } = {}) {
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

    renderNav() {
      this.refs.nav.innerHTML = "";
      const navItems = Array.isArray(this.config.workspaceNav?.items) ? this.config.workspaceNav.items : [];
      navItems.forEach((item) => {
        const isActive = item.targetSectionId === this.state.activeSectionId;
        this.refs.nav.append(
          createElement("button", {
            className: `admin-nav-btn${isActive ? " is-active" : ""}`,
            text: item.label || item.targetSectionId || item.id,
            attrs: {
              type: "button",
              "data-section-id": item.targetSectionId || "",
            },
            onClick: () => this.activateSection(item.targetSectionId),
          })
        );
      });
    }

    renderContent() {
      this.refs.content.innerHTML = "";
      const activeSection = this.getActiveSection();
      if (!activeSection) {
        this.refs.content.append(createElement("section", { className: "admin-section is-active" }));
        return;
      }

      const sectionNode = createElement("section", {
        className: "admin-section is-active",
        attrs: { "data-section-id": activeSection.id },
      });

      sectionNode.append(this.renderSectionHeader(activeSection));
      (activeSection.panels || []).forEach((panel) => {
        sectionNode.append(this.renderPanel(activeSection, panel));
      });
      this.refs.content.append(sectionNode);
    }

    renderSectionHeader(section) {
      const card = createElement("header", { className: "qfp-section-header-simple" });
      if (section.title) {
        card.append(this.renderSectionTitleWithInfo(section.title, section.description));
      }
      return card;
    }

    renderPanel(section, panel) {
      const accordionConfig = panel?.meta?.accordion && typeof panel.meta.accordion === "object"
        ? panel.meta.accordion
        : null;
      const isAccordion = accordionConfig?.enabled === true;
      const card = createElement("article", {
        className: `admin-card${isAccordion ? " admin-card--accordion" : ""}`,
        attrs: {
          "data-section-id": section?.id || "",
          "data-panel-id": panel?.id || "",
        },
      });
      const panelState = resolvePanelSurfaceState(panel);
      const headerTag = isAccordion ? "summary" : "div";
      const header = createElement(headerTag, {
        className: `admin-card__header${isAccordion ? " admin-card__header--accordion" : ""}`,
      });
      const titleWrap = createElement("div", { className: "admin-card__header-main" });
      titleWrap.append(createElement("h3", { text: panel.title || panel.id }));
      header.append(titleWrap);
      const side = createElement("div", { className: "admin-card__header-side" });
      if (panelState?.label) {
        side.append(
          createElement("span", {
            className: `admin-state-badge is-${panelState.key}`,
            text: panelState.label,
          })
        );
      }
      if (isAccordion) {
        side.append(createElement("span", { className: "admin-card__chevron", text: accordionConfig?.defaultOpen ? "-" : "+" }));
      }
      header.append(side);

      if (isAccordion) {
        const details = createElement("details", {
          className: "admin-card__accordion",
          attrs: accordionConfig?.defaultOpen ? { open: "open" } : {},
        });
        details.addEventListener("toggle", () => {
          const chevron = details.querySelector(".admin-card__chevron");
          if (chevron) chevron.textContent = details.open ? "-" : "+";
        });
        details.append(header);
        const body = createElement("div", {
          className: "admin-card__accordion-body",
          attrs: details.open ? {} : { hidden: "hidden" },
        });
        details.addEventListener("toggle", () => {
          body.hidden = !details.open;
        });
        if (panel.state?.error) {
          body.append(createElement("p", { className: "small", text: panel.state.error }));
        }
        const contentWrap = createElement("div", {
          className: "admin-card__content",
          attrs: {
            "data-panel-content": panel?.id || "",
          },
        });
        contentWrap.append(this.renderPanelContent(section, panel));
        body.append(contentWrap);
        details.append(body);
        card.append(details);
        return card;
      }

      card.append(header);
      if (panel.state?.error) {
        card.append(createElement("p", { className: "small", text: panel.state.error }));
      }
      const contentWrap = createElement("div", {
        className: "admin-card__content",
        attrs: {
          "data-panel-content": panel?.id || "",
        },
      });
      contentWrap.append(this.renderPanelContent(section, panel));
      card.append(contentWrap);
      return card;
    }

    renderPanelContent(section, panel) {
      const mode = panel.renderMode || "readonly";
      switch (mode) {
        case "readonly":
          return renderReadonlyContent(panel, this.config.texts.empty);
        case "mixed":
          return renderMixedContent(panel, this.config.texts.empty);
        case "form":
          return renderFormContent(this, section, panel, this.config.texts.empty);
        case "table":
          return renderTableContent(this, section, panel, this.config.texts.empty);
        case "actions":
          return renderActionsContent(panel, this.config.texts.empty);
        default:
          return createElement("p", { className: "small", text: this.config.texts.empty });
      }
    }

    renderStatus() {
      this.refs.status.innerHTML = "";
      if (!this.state.maskError) {
        this.refs.status.hidden = true;
        return;
      }
      this.refs.status.hidden = false;
      this.refs.status.append(
        createElement("div", {
          className: "qfp-status-line is-error",
          text: this.state.maskError,
        })
      );
    }

    createContext(extra) {
      return {
        config: this.config,
        state: this.state,
        mask: this,
        savePanel: this.savePanel.bind(this),
        ...extra,
      };
    }

    applyMaskPayload(payload) {
      if (Array.isArray(payload.sections)) {
        this.state.sections = normalizeSections(payload.sections);
        if (!this.findSection(this.state.activeSectionId)) {
          this.state.activeSectionId = firstSectionId(this.state.sections);
        }
      }
    }

    applyPanelPayload(sectionId, panelId, payload) {
      const panel = this.findPanel(sectionId, panelId);
      if (!panel || !payload) return;
      if (payload.content) {
        panel.loadedContent = structuredCloneSafe(payload.content);
      }
      if (Array.isArray(payload.rows)) {
        panel.rows = structuredCloneSafe(payload.rows);
      }
      if (payload.state) {
        panel.state = { ...(panel.state || {}), ...payload.state };
      }
      if (payload.renderMode) panel.renderMode = payload.renderMode;
      if (payload.componentType) panel.componentType = payload.componentType;
      if (payload.actions) panel.actions = payload.actions;
      if (payload.columns) panel.columns = payload.columns;
      if (payload.tableConfig) panel.tableConfig = payload.tableConfig;
    }

    getActiveSection() {
      return this.findSection(this.state.activeSectionId);
    }

    findSection(sectionId) {
      return (this.state.sections || []).find((section) => section.id === sectionId) || null;
    }

    findPanel(sectionId, panelId) {
      const section = this.findSection(sectionId);
      return section ? (section.panels || []).find((panel) => panel.id === panelId) || null : null;
    }
  }

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

  function resolvePanelSurfaceState(panel) {
    if (typeof dialogContracts.resolvePanelSurfaceState === "function") {
      return dialogContracts.resolvePanelSurfaceState(panel);
    }
    return null;
  }

  function panelStateLabel(key) {
    switch (key) {
      case "live":
        return "Live";
      case "partial":
        return "Teilweise live";
      case "preview":
        return "Vorschau";
      case "gap":
        return "Vertrag offen";
      default:
        return String(key || "");
    }
  }

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
    function findFieldValue(fieldName) {
      const match = fields.find((field) => String(field?.name || "").trim() === String(fieldName || "").trim());
      return match?.value;
    }
    function copyInviteLink(linkValue) {
      const text = String(linkValue || "").trim();
      if (!text) return Promise.resolve(false);
      if (navigator?.clipboard?.writeText) {
        return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
      }
      return Promise.resolve(false);
    }
    function renderInviteCreateResultCard() {
      if (panel?.id !== "club_settings_invite_create") return null;
      const qrUrl = String(findFieldValue("invite_qr_url") || "").trim();
      const inviteUrl = String(findFieldValue("invite_register_url") || "").trim();
      const expiresAt = String(findFieldValue("invite_expires_at") || "").trim();
      if (!qrUrl && !inviteUrl && !expiresAt) return null;
      const card = createElement("section", { className: "qfp-form-group qfp-invite-result-card" });
      const body = createElement("div", { className: "qfp-form-group__grid qfp-form-group__grid--ungrouped" });
      if (qrUrl) {
        const qrWrap = createElement("div", { className: "qfp-form-field is-full" });
        qrWrap.append(createElement("span", { className: "qfp-field-label", text: "QR-Code" }));
        qrWrap.append(createElement("img", {
          className: "qfp-invite-result-card__qr",
          attrs: { src: qrUrl, alt: "Einladungs-QR-Code", loading: "lazy" },
        }));
        body.append(qrWrap);
      }
      if (inviteUrl) {
        const linkWrap = createElement("div", { className: "qfp-form-field is-full" });
        linkWrap.append(createElement("span", { className: "qfp-field-label", text: "Invite-Link" }));
        linkWrap.append(createElement("input", {
          attrs: { type: "text", value: inviteUrl, readonly: "readonly" },
        }));
        linkWrap.append(createElement("button", {
          className: "feed-btn",
          text: "Invite-Link kopieren",
          attrs: { type: "button" },
          onClick: async () => {
            const copied = await copyInviteLink(inviteUrl);
            if (copied) {
              pattern?.setMessage?.("Invite-Link in die Zwischenablage kopiert.");
            } else {
              pattern?.setMessage?.("Invite-Link konnte nicht kopiert werden.");
            }
          },
        }));
        body.append(linkWrap);
      }
      if (expiresAt) {
        const expiresWrap = createElement("div", { className: "qfp-form-field is-full" });
        expiresWrap.append(createElement("span", { className: "qfp-field-label", text: "Gueltig bis" }));
        expiresWrap.append(createElement("input", {
          attrs: { type: "text", value: expiresAt, readonly: "readonly" },
        }));
        body.append(expiresWrap);
      }
      card.append(body);
      return card;
    }
    function createFieldNode(field, initialValues) {
      const label = createElement("label", {
        className: `qfp-form-field${field.span === "full" ? " is-full" : ""}`,
      });
      label.append(createElement("span", {
        className: "qfp-field-label",
        text: field.label || field.name || "-",
      }));
      const disabled = field.disabled === true || field.readonly === true || !isFieldEnabled(field, initialValues);
      if (field.type === "textarea") {
        label.append(
          createElement("textarea", {
            attrs: {
              name: field.name,
              rows: field.rows || 4,
              placeholder: field.placeholder || undefined,
              disabled: disabled ? "disabled" : undefined,
              required: field.required ? "required" : undefined,
            },
            text: String(field.value ?? ""),
          })
        );
      } else if (field.type === "select") {
        const select = createElement("select", {
          attrs: {
            name: field.name,
            disabled: disabled ? "disabled" : undefined,
            required: field.required ? "required" : undefined,
          },
        });
        (field.options || []).forEach((option) => {
          select.append(
            createElement("option", {
              text: option.label || option.value,
              attrs: {
                value: option.value,
                selected: option.value === field.value ? "selected" : undefined,
              },
            })
          );
        });
        label.append(select);
      } else if (field.type === "toggle") {
        const toggleRow = createElement("div", { className: "qfp-toggle-row" });
        toggleRow.append(
          createElement("input", {
            attrs: {
              type: "checkbox",
              name: field.name,
              checked: field.value ? "checked" : undefined,
              disabled: disabled ? "disabled" : undefined,
              required: field.required ? "required" : undefined,
            },
          }),
          createElement("span", { className: "qfp-toggle-label", text: fieldHelpText(field) })
        );
        label.append(toggleRow);
      } else {
        label.append(
          createElement("input", {
            attrs: {
              type: field.type || "text",
              name: field.name,
              value: field.value ?? "",
              placeholder: field.placeholder || undefined,
              disabled: disabled ? "disabled" : undefined,
              required: field.required ? "required" : undefined,
              autocomplete: field.autocomplete || undefined,
              inputmode: field.inputMode || undefined,
            },
          })
        );
      }
      const helpText = fieldHelpText(field);
      if (helpText && field.type !== "toggle") {
        label.append(createElement("span", { className: "qfp-field-help", text: helpText }));
      }
      return label;
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
        const payload = {};
        fields.forEach((field) => {
          if (field.type === "toggle") {
            payload[field.name] = Boolean(form.querySelector(`[name="${CSS.escape(field.name)}"]`)?.checked);
            return;
          }
          payload[field.name] = form.querySelector(`[name="${CSS.escape(field.name)}"]`)?.value ?? "";
        });
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
    const inviteResultCard = renderInviteCreateResultCard();
    if (inviteResultCard) {
      form.append(inviteResultCard);
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
      mountTableRuntime(componentType, mount, {
        pattern,
        section,
        panel,
        columns,
        rows,
        tableConfig: panel.tableConfig || {},
        onMessage: pattern?.config?.onMessage || pattern?.config?.setMessage || null,
      });
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

  function normalizeSections(sections) {
    return (sections || []).map((section) => ({
      ...section,
      panels: (section.panels || []).map((panel) => ({
        ...panel,
        open: panel.open !== false,
        state: { ...(panel.state || {}) },
        loadedContent: structuredCloneSafe(panel.content || {}),
      })),
    }));
  }

  function firstSectionId(sections) {
    return Array.isArray(sections) && sections.length ? sections[0].id : null;
  }

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

  function resolveElement(input) {
    if (!input) return null;
    if (input instanceof Element) return input;
    if (typeof input === "string") return document.querySelector(input);
    return null;
  }

  function mergeDeep(target, source) {
    if (!isPlainObject(target) || !isPlainObject(source)) return source;
    Object.keys(source).forEach((key) => {
      const sourceValue = source[key];
      const targetValue = target[key];
      if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
        target[key] = mergeDeep({ ...targetValue }, sourceValue);
      } else {
        target[key] = structuredCloneSafe(sourceValue);
      }
    });
    return target;
  }

  function isPlainObject(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
  }

  function structuredCloneSafe(value) {
    if (value == null) return value;
    if (Array.isArray(value)) return value.map((entry) => structuredCloneSafe(entry));
    if (isPlainObject(value)) {
      const output = {};
      Object.keys(value).forEach((key) => {
        output[key] = structuredCloneSafe(value[key]);
      });
      return output;
    }
    return value;
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

  function createDialogReadonlyField(field) {
    const item = createElement("div", {
      className: "qfp-readonly-item",
    });
    item.append(
      createElement("div", { className: "qfp-field-label", text: field?.label || field?.key || "-" }),
      createElement("div", { className: "qfp-field-value", text: valueToText(field?.value) })
    );
    return item;
  }

  function createDialogEditorField(field) {
    const label = createElement("label", { className: "qfp-form-field is-full" });
    const inputName = String(field?.payloadKey || field?.key || "").trim();
    label.append(createElement("span", {
      className: "qfp-field-label",
      text: field?.label || field?.key || "-",
    }));

    if (field?.editorType === "select") {
      const select = createElement("select", {
        attrs: {
          name: inputName,
          "data-dialog-field": inputName,
        },
      });
      (Array.isArray(field?.options) ? field.options : []).forEach((option) => {
        select.append(
          createElement("option", {
            text: option?.label || option?.value || "",
            attrs: {
              value: option?.value ?? "",
              selected: String(option?.value ?? "") === String(field?.value ?? "") ? "selected" : undefined,
            },
          })
        );
      });
      label.append(select);
      return label;
    }

    if (field?.editorType === "checkbox") {
      const toggleRow = createElement("div", { className: "qfp-toggle-row" });
      toggleRow.append(
        createElement("input", {
          attrs: {
            type: "checkbox",
            name: inputName,
            "data-dialog-field": inputName,
            checked: field?.value ? "checked" : undefined,
          },
        }),
        createElement("span", { className: "qfp-toggle-label", text: field?.label || inputName || "" })
      );
      label.append(toggleRow);
      return label;
    }

    const inputType = field?.editorType === "number"
      ? "number"
      : field?.editorType === "date"
        ? "date"
        : "text";
    label.append(
      createElement("input", {
        attrs: {
          type: inputType,
          name: inputName,
          "data-dialog-field": inputName,
          value: field?.value ?? "",
        },
      })
    );
    return label;
  }

  function collectDialogDraft(root, fields) {
    if (!(root instanceof HTMLElement)) return {};
    return (Array.isArray(fields) ? fields : []).reduce((acc, field) => {
      const payloadKey = String(field?.payloadKey || field?.key || "").trim();
      if (!payloadKey || field?.editable === false) return acc;
      const input = root.querySelector(`[data-dialog-field="${CSS.escape(payloadKey)}"]`);
      if (!input) return acc;
      if (input instanceof HTMLInputElement && input.type === "checkbox") {
        acc[payloadKey] = Boolean(input.checked);
        return acc;
      }
      acc[payloadKey] = input.value === "" ? null : input.value;
      return acc;
    }, {});
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
    const tableRuntimeProps = {
      root,
      columns: runtimeOptions?.columns || columns,
      rows: runtimeOptions?.rows || rows,
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
        factory(tableRuntimeProps);
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
        root.append(createElement("p", {
          className: "small",
          text: normalizeErrorMessage(error, "Table runtime Fehler."),
        }));
      }
    });
  }

  function emitTableRendererSnapshot(root, meta = {}) {
    if (!(root instanceof HTMLElement) || typeof window === "undefined") return;
    const normalizedHtml = String(root.innerHTML || "")
      .replace(/\s+/g, " ")
      .trim();
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

  function normalizeErrorMessage(error, fallback) {
    if (typeof sharedContracts.normalizeErrorMessage === "function") {
      return sharedContracts.normalizeErrorMessage(error, fallback);
    }
    if (!error) return fallback;
    if (typeof error === "string") return error;
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  }

  window.AdminPanelMask = Object.freeze({
    create: createAdminPanelMask,
    defaults: structuredCloneSafe(DEFAULTS),
  });
})();
