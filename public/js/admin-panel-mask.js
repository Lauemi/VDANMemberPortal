"use strict";

// ADM Shell — Workspace-Host, Navigation, Section-/Panel-Host, Renderer-Dispatch
// Inhaltsrenderer: window.FcpAdmQfmSharedRenderers
// Dialog/Table-Host: window.FcpTableDialogHost (patcht Prototype via installOn)
// Domain-Adapter: window.VdanDomainAdapterVereinsverwaltung

;(() => {
  const contractHub = window.FcpAdmQfmContractHub || {};
  const sharedContracts = contractHub.shared || {};
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
      // Dialog-Host stellt ensureDialog bereit (via installOn auf Prototype)
      if (typeof this.ensureDialog === "function") this.ensureDialog();
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
            if (typeof this.openInfoDialog === "function") {
              this.openInfoDialog({ title: text, description, trigger: button });
            }
          },
        });
        wrap.append(button);
      }
      return wrap;
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
        const feedback = renderPanelFeedback(panel);
        if (feedback) body.append(feedback);
        const contentWrap = createElement("div", {
          className: "admin-card__content",
          attrs: { "data-panel-content": panel?.id || "" },
        });
        contentWrap.append(this.renderPanelContent(section, panel));
        body.append(contentWrap);
        details.append(body);
        card.append(details);
        return card;
      }

      card.append(header);
      const feedback = renderPanelFeedback(panel);
      if (feedback) card.append(feedback);
      const contentWrap = createElement("div", {
        className: "admin-card__content",
        attrs: { "data-panel-content": panel?.id || "" },
      });
      contentWrap.append(this.renderPanelContent(section, panel));
      card.append(contentWrap);
      return card;
    }

    renderPanelContent(section, panel) {
      const mode = panel.contentRenderer || panel.renderMode || "readonly";
      const renderers = window.FcpAdmQfmSharedRenderers || {};
      const emptyText = this.config.texts.empty;
      switch (mode) {
        case "readonly":
          return typeof renderers.renderReadonlyContent === "function"
            ? renderers.renderReadonlyContent(panel, emptyText)
            : createElement("p", { className: "small", text: emptyText });
        case "mixed":
          return typeof renderers.renderMixedContent === "function"
            ? renderers.renderMixedContent(panel, emptyText)
            : createElement("p", { className: "small", text: emptyText });
        case "form":
          return typeof renderers.renderFormContent === "function"
            ? renderers.renderFormContent(this, section, panel, emptyText)
            : createElement("p", { className: "small", text: emptyText });
        case "table":
          return typeof renderers.renderTableContent === "function"
            ? renderers.renderTableContent(this, section, panel, emptyText)
            : createElement("p", { className: "small", text: emptyText });
        case "actions":
          return typeof renderers.renderActionsContent === "function"
            ? renderers.renderActionsContent(panel, emptyText)
            : createElement("p", { className: "small", text: emptyText });
        default:
          return createElement("p", { className: "small", text: emptyText });
      }
    }

    renderStatus() {
      this.refs.status.innerHTML = "";
      if (this.state.maskStatus === "loading") {
        this.refs.status.hidden = false;
        this.refs.status.append(
          createElement("div", { className: "qfp-status-line is-info", text: "Loading..." })
        );
        return;
      }
      if (!this.state.maskError) {
        this.refs.status.hidden = true;
        return;
      }
      this.refs.status.hidden = false;
      this.refs.status.append(
        createElement("div", { className: "qfp-status-line is-error", text: this.state.maskError })
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
      if (payload.contentRenderer) panel.contentRenderer = payload.contentRenderer;
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

  // ---------------------------------------------------------------------------
  // Shell-Helfer (kein Renderer-Code)
  // ---------------------------------------------------------------------------

  function resolvePanelSurfaceState(panel) {
    if (typeof dialogContracts.resolvePanelSurfaceState === "function") {
      return dialogContracts.resolvePanelSurfaceState(panel);
    }
    return null;
  }

  function renderPanelFeedback(panel) {
    const state = panel?.state || {};
    if (state?.error) {
      return createElement("div", { className: "qfp-inline-error", text: String(state.error || "") });
    }
    if (state?.saveState === "saving") {
      return createElement("div", { className: "qfp-status-line is-info", text: "Saving..." });
    }
    if (state?.message) {
      return createElement("div", { className: "qfp-status-line is-info", text: String(state.message || "") });
    }
    if (state?.dirty) {
      return createElement("div", { className: "qfp-status-line is-info", text: "Unsaved" });
    }
    return null;
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

  function normalizeErrorMessage(error, fallback) {
    if (typeof sharedContracts.normalizeErrorMessage === "function") {
      return sharedContracts.normalizeErrorMessage(error, fallback);
    }
    if (!error) return fallback;
    if (typeof error === "string") return error;
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  }

  // ---------------------------------------------------------------------------
  // Dialog/Table-Host via Prototype-Mixin installieren
  // Voraussetzung: fcp-table-dialog-host.js muss vor dieser Datei geladen sein.
  // ---------------------------------------------------------------------------

  if (typeof window.FcpTableDialogHost?.installOn === "function") {
    window.FcpTableDialogHost.installOn(AdminPanelMask.prototype);
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  window.AdminPanelMask = Object.freeze({
    create: createAdminPanelMask,
    defaults: structuredCloneSafe(DEFAULTS),
  });
})();
