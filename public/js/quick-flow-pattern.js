"use strict";

/*
  Quick Flow Pattern
  ------------------
  Generic main-content mask renderer for FCP.

  Purpose:
  - one stable mask shell
  - optional section navigation
  - exactly one active section
  - section-internal panel system
  - content slots independent from outer panel rendering
  - built-in load/save/update/permission hooks

  This is intentionally plain JavaScript and DOM-first so it can be wired into
  Astro pages, static previews, or later specialized render adapters.
*/

(function attachQuickFlowPattern(globalScope) {
  const contractHub = globalScope.FcpAdmQfmContractHub || {};
  const fieldContracts = contractHub.field || {};
  const sharedContracts = contractHub.shared || {};
  const tableContracts = contractHub.table || {};

  const DEFAULTS = {
    maskFamily: "QFM",
    maskType: "sectioned",
    activeSectionId: null,
    collapsiblePanels: true,
    allowMultipleOpenPanels: false,
    autoLoadOnInit: true,
    autoLoadSectionOnActivate: true,
    autoLoadPanelOnOpen: false,
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
      saveSuccess: "Aenderungen erfolgreich gespeichert.",
      forbidden: "Aktion nicht erlaubt.",
      empty: "Keine Daten vorhanden.",
    },
  };

  function createQuickFlowPattern(config) {
    return new QuickFlowPattern(config);
  }

  class QuickFlowPattern {
    constructor(config) {
      if (!config || !config.root) {
        throw new Error("QuickFlowPattern requires a root element");
      }

      this.config = mergeDeep(structuredCloneSafe(DEFAULTS), config || {});
      this.root = resolveElement(this.config.root);
      if (!this.root) {
        throw new Error("QuickFlowPattern root element not found");
      }

      this.state = {
        maskStatus: "idle",
        maskError: null,
        activeSectionId: this.config.activeSectionId || firstSectionId(this.config.sections),
        sections: normalizeSections(this.config.sections || []),
        loading: new Set(),
        saving: new Set(),
        requestTokens: {
          mask: 0,
          sections: {},
          panels: {},
        },
      };

      this.refs = {
        shell: null,
        header: null,
        nav: null,
        content: null,
        status: null,
      };
    }

    async init() {
      this.render();

      if (this.config.autoLoadOnInit) {
        await this.loadMask();
      }

      return this;
    }

    destroy() {
      this.root.innerHTML = "";
      this.refs = {
        shell: null,
        header: null,
        nav: null,
        content: null,
        status: null,
      };
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
      const requestToken = ++this.state.requestTokens.mask;
      this.state.maskStatus = "loading";
      this.state.maskError = null;
      this.renderStatus();

      try {
        if (typeof this.config.load === "function") {
          const result = await this.config.load(this.createContext());
          if (!this.isLatestMaskRequest(requestToken)) return;
          if (result) {
            this.applyMaskPayload(result);
          }
        }

        const activeSection = this.getActiveSection();
        if (activeSection && this.config.autoLoadSectionOnActivate) {
          await this.loadSection(activeSection.id);
          if (!this.isLatestMaskRequest(requestToken)) return;
        }

        this.state.maskStatus = "ready";
        this.render();
      } catch (error) {
        if (!this.isLatestMaskRequest(requestToken)) return;
        this.state.maskStatus = "error";
        this.state.maskError = normalizeErrorMessage(error, this.config.texts.loadError);
        this.renderStatus();
      }
    }

    async activateSection(sectionId) {
      if (!sectionId || sectionId === this.state.activeSectionId) return;

      const nextSection = this.findSection(sectionId);
      if (!nextSection) return;
      if (!this.can("view", nextSection.permissions)) return;

      this.state.activeSectionId = sectionId;
      this.render();

      if (this.config.autoLoadSectionOnActivate) {
        await this.loadSection(sectionId);
      }
    }

    async loadSection(sectionId) {
      const section = this.findSection(sectionId);
      if (!section) return;

      const key = `section:${sectionId}`;
      const requestToken = this.nextSectionRequestToken(sectionId);
      if (this.state.loading.has(key)) return;

      this.state.loading.add(key);
      section.meta = { ...section.meta, loadState: "loading", error: null };
      this.render();

      try {
        if (typeof section.load === "function") {
          const result = await section.load(this.createContext({ section }));
          if (!this.isLatestSectionRequest(sectionId, requestToken)) return;
          if (result) {
            this.applySectionPayload(sectionId, result);
          }
        }

        if (!this.isLatestSectionRequest(sectionId, requestToken)) return;
        section.meta = { ...section.meta, loadState: "ready", error: null };
        this.render();
      } catch (error) {
        if (!this.isLatestSectionRequest(sectionId, requestToken)) return;
        section.meta = {
          ...section.meta,
          loadState: "error",
          error: normalizeErrorMessage(error, this.config.texts.loadError),
        };
        this.render();
      } finally {
        this.state.loading.delete(key);
      }
    }

    async togglePanel(sectionId, panelId) {
      const section = this.findSection(sectionId);
      if (!section) return;
      const panel = findPanel(section, panelId);
      if (!panel) return;
      if (!this.can("view", panel.permissions || section.permissions)) return;

      const shouldOpen = !panel.open;
      if (this.config.collapsiblePanels) {
        if (shouldOpen && !this.config.allowMultipleOpenPanels) {
          section.panels.forEach((candidate) => {
            candidate.open = candidate.id === panelId;
          });
        } else {
          panel.open = shouldOpen;
        }
      } else {
        panel.open = true;
      }

      this.render();

      if (panel.open && this.config.autoLoadPanelOnOpen) {
        await this.loadPanel(sectionId, panelId);
      }
    }

    async loadPanel(sectionId, panelId) {
      const section = this.findSection(sectionId);
      const panel = section ? findPanel(section, panelId) : null;
      if (!section || !panel) return;

      const key = `panel:${sectionId}:${panelId}`;
      const requestToken = this.nextPanelRequestToken(sectionId, panelId);
      if (this.state.loading.has(key)) return;

      this.state.loading.add(key);
      panel.state = { ...panel.state, loadState: "loading", error: null };
      this.render();

      try {
        if (typeof panel.load === "function") {
          const result = await panel.load(this.createContext({ section, panel }));
          if (!this.isLatestPanelRequest(sectionId, panelId, requestToken)) return;
          if (result) {
            this.applyPanelPayload(sectionId, panelId, result);
          }
        }

        if (!this.isLatestPanelRequest(sectionId, panelId, requestToken)) return;
        panel.state = { ...panel.state, loadState: "ready", error: null };
        this.render();
      } catch (error) {
        if (!this.isLatestPanelRequest(sectionId, panelId, requestToken)) return;
        panel.state = {
          ...panel.state,
          loadState: "error",
          error: normalizeErrorMessage(error, this.config.texts.loadError),
        };
        this.render();
      } finally {
        this.state.loading.delete(key);
      }
    }

    async savePanel(sectionId, panelId, payload) {
      const section = this.findSection(sectionId);
      const panel = section ? findPanel(section, panelId) : null;
      if (!section || !panel) return { ok: false, error: "panel_not_found" };
      if (!this.can("write", panel.permissions || section.permissions)) {
        return { ok: false, error: this.config.texts.forbidden };
      }
      if (panel.flowType === "auth_critical") {
        return { ok: false, error: "Auth-kritische Flows duerfen nicht ueber normales form-save laufen." };
      }

      const key = `panel:${sectionId}:${panelId}`;
      if (this.state.saving.has(key)) return { ok: false, error: "save_in_progress" };

      this.state.saving.add(key);
      panel.state = {
        ...panel.state,
        saveState: "saving",
        error: null,
        message: null,
      };
      this.render();

      try {
        const saveBinding = this.resolveSaveBinding(section, panel);
        const saveHandler = saveBinding.handler;
        if (typeof saveHandler !== "function") {
          throw new Error("No save handler configured");
        }

        const result = await saveHandler(
          payload,
          this.createContext({ section, panel, payload })
        );

        if (result) {
          this.applyPanelPayload(sectionId, panelId, result);
        }

        panel.loadedContent = structuredCloneSafe(this.getPanelContent(panel));
        panel.draftContent = structuredCloneSafe(panel.loadedContent);
        panel.state = {
          ...panel.state,
          dirty: false,
          saveState: "saved",
          error: null,
          message: this.config.texts.saveSuccess,
        };
        this.render();
        return { ok: true, result };
      } catch (error) {
        panel.state = {
          ...panel.state,
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

    updatePanelData(sectionId, panelId, patch) {
      const panel = this.findPanel(sectionId, panelId);
      if (!panel) return;

      panel.draftContent = mergeDeep(
        structuredCloneSafe(this.getPanelContent(panel) || {}),
        patch || {}
      );
      panel.state = {
        ...panel.state,
        dirty: true,
        saveState: panel.state?.saveState === "saved" ? "dirty" : panel.state?.saveState,
      };
      this.render();
    }

    can(action, permissions) {
      const merged = normalizePermissions(permissions || {});
      const activeRoles = this.getCurrentRoles();

      if (merged.roles.length && !merged.roles.some((role) => activeRoles.includes(role))) {
        return false;
      }

      if (typeof this.config.can === "function") {
        return Boolean(this.config.can(action, merged, this.createContext()));
      }

      switch (action) {
        case "view":
          return merged.view !== false;
        case "write":
        case "update":
        case "save":
          return merged.write === true || merged.update === true;
        case "delete":
          return merged.delete === true;
        default:
          return true;
      }
    }

    canFieldAccess(field, mode) {
      const scope = field.scope || "global_user";
      const scopes = this.getCurrentScopes();

      if (mode === "readonly") return true;

      switch (scope) {
        case "global_user":
          return scopes.globalUser === true;
        case "auth_system":
          return scopes.authSystem === true;
        case "club_readonly":
          return false;
        case "club_override":
          return scopes.clubOverride === true;
        case "billing_snapshot":
          return false;
        case "consent_append_only":
          return scopes.consentAppendOnly === true;
        default:
          return true;
      }
    }

    render() {
      if (!this.refs.shell) {
        this.root.innerHTML = "";
        this.refs.shell = createElement("div", {
          className: "qfp-shell",
          attrs: {
            "data-mask-family": String(this.config.maskFamily || "QFM"),
            "data-mask-type": String(this.config.maskType || "sectioned"),
            "data-qfp-variant": this.config.shellVariant ? String(this.config.shellVariant) : undefined,
          },
        });
        this.refs.header = createElement("div", { className: "qfp-mask-header" });
        this.refs.nav = createElement("nav", {
          className: "qfp-mask-nav",
          attrs: { "aria-label": this.config.navLabel || "Mask sections" },
        });
        this.refs.content = createElement("div", { className: "qfp-mask-content" });
        this.refs.status = createElement("div", { className: "qfp-mask-status", attrs: { "aria-live": "polite" } });

        this.refs.shell.append(
          this.refs.header,
          this.refs.nav,
          this.refs.content,
          this.refs.status
        );
        this.root.append(this.refs.shell);
      }

      this.renderHeader();
      this.renderNav();
      this.renderContent();
      this.renderStatus();
    }

    renderHeader() {
      const meta = this.config.header || {};
      this.refs.header.innerHTML = "";

      const wrapper = createElement("section", { className: "qfp-card qfp-card--header" });
      if (meta.kicker) {
        wrapper.append(createElement("div", { className: "qfp-kicker", text: meta.kicker }));
      }
      if (meta.title) {
        wrapper.append(createElement("h2", { className: "qfp-title", text: meta.title }));
      }
      if (meta.description) {
        wrapper.append(createElement("p", { className: "qfp-description", text: meta.description }));
      }

      this.refs.header.append(wrapper);
    }

    renderNav() {
      this.refs.nav.innerHTML = "";

      const needsNav = this.config.maskType === "sectioned" && this.state.sections.length > 1;
      this.refs.nav.hidden = !needsNav;
      if (!needsNav) return;

      const list = createElement("div", { className: "qfp-nav-list" });
      this.state.sections.forEach((section) => {
        if (!this.can("view", section.permissions)) return;

        const active = section.id === this.state.activeSectionId;
        const button = createElement("button", {
          className: `qfp-nav-item${active ? " is-active" : ""}`,
          text: section.label || section.title || section.id,
          attrs: {
            type: "button",
            "data-section-id": section.id,
            "aria-pressed": String(active),
            "aria-current": active ? "page" : undefined,
          },
          onClick: () => this.activateSection(section.id),
        });
        list.append(button);
      });

      this.refs.nav.append(list);
    }

    renderContent() {
      this.refs.content.innerHTML = "";

      const activeSection = this.getActiveSection();
      if (!activeSection) {
        this.refs.content.append(
          createElement("section", {
            className: "qfp-card qfp-card--empty",
            text: this.config.texts.empty,
          })
        );
        return;
      }

      const sectionNode = this.renderSection(activeSection);
      this.refs.content.append(sectionNode);
    }

    renderSection(section) {
      const node = createElement("section", {
        className: "qfp-section",
        attrs: { "data-section-id": section.id },
      });

      const header = createElement("div", { className: "qfp-card qfp-card--section-header" });
      if (section.kicker) {
        header.append(createElement("div", { className: "qfp-kicker", text: section.kicker }));
      }
      header.append(createElement("h3", { className: "qfp-section-title", text: section.title || section.label || section.id }));
      if (section.description) {
        header.append(createElement("p", { className: "qfp-description", text: section.description }));
      }
      node.append(header);

      const panelList = createElement("div", { className: "qfp-panel-list" });
      (section.panels || []).forEach((panel) => {
        if (!this.can("view", panel.permissions || section.permissions)) return;
        panelList.append(this.renderPanel(section, panel));
      });

      node.append(panelList);
      return node;
    }

    renderPanel(section, panel) {
      const open = panel.open === true;
      const panelNode = createElement("article", {
        className: `qfp-card qfp-card--panel${open ? " is-open" : ""}`,
        attrs: { "data-panel-id": panel.id },
      });

      const toggle = createElement("button", {
        className: "qfp-panel-toggle",
        attrs: {
          type: "button",
          "aria-expanded": String(open),
          "data-panel-id": panel.id,
        },
        onClick: () => this.togglePanel(section.id, panel.id),
      });

      const left = createElement("div", { className: "qfp-panel-toggle-main" });
      if (panel.icon) {
        left.append(createElement("span", { className: "qfp-panel-icon", text: panel.icon }));
      }
      const titleWrap = createElement("div", { className: "qfp-panel-title-wrap" });
      titleWrap.append(createElement("div", { className: "qfp-panel-title", text: panel.title || panel.id }));
      if (panel.meta?.label || panel.metaText) {
        titleWrap.append(
          createElement("div", {
            className: "qfp-panel-meta",
            text: panel.meta?.label || panel.metaText,
          })
        );
      }
      left.append(titleWrap);

      const right = createElement("div", { className: "qfp-panel-toggle-side" });
      if (panel.state?.badge || panel.badge) {
        right.append(
          createElement("span", {
            className: "qfp-panel-badge",
            text: panel.state?.badge || panel.badge,
          })
        );
      }
      if (panel.state?.saveState === "saving") {
        right.append(createElement("span", { className: "qfp-panel-state", text: "Saving..." }));
      } else if (panel.state?.dirty) {
        right.append(createElement("span", { className: "qfp-panel-state", text: "Unsaved" }));
      } else if (panel.state?.message) {
        right.append(createElement("span", { className: "qfp-panel-state", text: panel.state.message }));
      }
      right.append(createElement("span", { className: "qfp-panel-chevron", text: open ? "-" : "+" }));

      toggle.append(left, right);
      panelNode.append(toggle);

      const body = createElement("div", {
        className: "qfp-panel-body",
        attrs: { hidden: open ? undefined : "hidden" },
      });

      if (panel.state?.error) {
        body.append(createElement("div", { className: "qfp-inline-error", text: panel.state.error }));
      }

      body.append(this.renderContentSlot(section, panel));
      panelNode.append(body);

      return panelNode;
    }

    renderContentSlot(section, panel) {
      const slot = createElement("div", { className: "qfp-content-slot" });
      const mode = panel.contentRenderer || panel.renderMode || "readonly";

      switch (mode) {
        case "form":
          slot.append(renderFormContent(this, section, panel));
          break;
        case "table":
          slot.append(renderTableContent(this, section, panel));
          break;
        case "actions":
          slot.append(renderActionsContent(this, section, panel));
          break;
        case "stats":
        case "statistics":
          slot.append(renderStatisticsContent(this, section, panel));
          break;
        case "mixed":
          slot.append(renderMixedContent(this, section, panel));
          break;
        case "custom":
          slot.append(renderCustomContent(this, section, panel));
          break;
        case "readonly":
        default:
          slot.append(renderReadonlyContent(this, section, panel));
          break;
      }

      return slot;
    }

    renderStatus() {
      this.refs.status.innerHTML = "";

      const items = [];
      if (this.state.maskStatus === "loading") {
        items.push({ kind: "info", text: "Loading..." });
      }
      if (this.state.maskError) {
        items.push({ kind: "error", text: this.state.maskError });
      }

      if (!items.length) {
        this.refs.status.hidden = true;
        return;
      }

      this.refs.status.hidden = false;
      items.forEach((item) => {
        this.refs.status.append(
          createElement("div", {
            className: `qfp-status-line is-${item.kind}`,
            text: item.text,
          })
        );
      });
    }

    createContext(extra) {
      return {
        root: this.root,
        config: this.config,
        state: this.state,
        pattern: this,
        can: this.can.bind(this),
        activateSection: this.activateSection.bind(this),
        loadSection: this.loadSection.bind(this),
        loadPanel: this.loadPanel.bind(this),
        savePanel: this.savePanel.bind(this),
        updatePanelData: this.updatePanelData.bind(this),
        getCurrentRoles: this.getCurrentRoles.bind(this),
        getCurrentScopes: this.getCurrentScopes.bind(this),
        canFieldAccess: this.canFieldAccess.bind(this),
        ...extra,
      };
    }

    applyMaskPayload(payload) {
      if (payload.header) {
        this.config.header = { ...(this.config.header || {}), ...payload.header };
      }
      if (Array.isArray(payload.sections)) {
        this.state.sections = normalizeSections(payload.sections).filter((section) =>
          this.can("view", section.permissions)
        );
        if (!this.findSection(this.state.activeSectionId)) {
          this.state.activeSectionId = firstSectionId(this.state.sections);
        }
      }
    }

    applySectionPayload(sectionId, payload) {
      const section = this.findSection(sectionId);
      if (!section || !payload) return;

      if (payload.title) section.title = payload.title;
      if (payload.description) section.description = payload.description;
      if (payload.meta) section.meta = { ...(section.meta || {}), ...payload.meta };
      if (Array.isArray(payload.panels)) {
        section.panels = normalizePanels(payload.panels).filter((panel) =>
          this.can("view", panel.permissions || section.permissions)
        );
      }
    }

    applyPanelPayload(sectionId, panelId, payload) {
      const panel = this.findPanel(sectionId, panelId);
      if (!panel || !payload) return;

      if (payload.title) panel.title = payload.title;
      if (payload.meta) panel.meta = { ...(panel.meta || {}), ...payload.meta };
      if (payload.state) panel.state = { ...(panel.state || {}), ...payload.state };
      if (payload.content) {
        panel.loadedContent = structuredCloneSafe(payload.content);
        panel.draftContent = structuredCloneSafe(payload.content);
      }
      if (payload.renderMode) panel.renderMode = payload.renderMode;
      if (payload.componentType) panel.componentType = payload.componentType;
      if (payload.actions) panel.actions = payload.actions;
      if (payload.columns) panel.columns = payload.columns;
      if (payload.rows) panel.rows = payload.rows;
      if (payload.tableConfig) panel.tableConfig = payload.tableConfig;
    }

    getCurrentRoles() {
      if (typeof this.config.getRoles === "function") {
        const roles = this.config.getRoles(this.createContext());
        return Array.isArray(roles) ? roles.slice() : [];
      }
      return Array.isArray(this.config.currentRoles) ? this.config.currentRoles.slice() : [];
    }

    getCurrentScopes() {
      if (typeof this.config.getScopes === "function") {
        return {
          ...DEFAULTS.currentScopes,
          ...(this.config.getScopes(this.createContext()) || {}),
        };
      }
      return {
        ...DEFAULTS.currentScopes,
        ...(this.config.currentScopes || {}),
      };
    }

    getPanelContent(panel) {
      return panel.state?.dirty ? panel.draftContent : panel.loadedContent;
    }

    revertPanelDraft(sectionId, panelId) {
      const panel = this.findPanel(sectionId, panelId);
      if (!panel) return;
      panel.draftContent = structuredCloneSafe(panel.loadedContent);
      panel.state = {
        ...panel.state,
        dirty: false,
        message: null,
        error: null,
        saveState: panel.state?.saveState === "error" ? "idle" : panel.state?.saveState,
      };
      this.render();
    }

    resolveSaveBinding(section, panel) {
      const binding = panel.saveBinding || section.saveBinding || this.config.saveBinding;
      const handler = panel.save || section.save || this.config.save;

      if (!binding || !binding.kind) {
        throw new Error(`Panel ${panel.id} has no saveBinding.`);
      }
      if (!["rpc", "edge_function", "auth_action", "local_only"].includes(binding.kind)) {
        throw new Error(`Panel ${panel.id} uses unsupported saveBinding kind.`);
      }
      if (binding.kind !== "local_only" && typeof handler !== "function") {
        throw new Error(`Panel ${panel.id} saveBinding requires a handler.`);
      }

      return { ...binding, handler };
    }

    nextSectionRequestToken(sectionId) {
      const next = (this.state.requestTokens.sections[sectionId] || 0) + 1;
      this.state.requestTokens.sections[sectionId] = next;
      return next;
    }

    nextPanelRequestToken(sectionId, panelId) {
      const key = `${sectionId}:${panelId}`;
      const next = (this.state.requestTokens.panels[key] || 0) + 1;
      this.state.requestTokens.panels[key] = next;
      return next;
    }

    isLatestMaskRequest(token) {
      return this.state.requestTokens.mask === token;
    }

    isLatestSectionRequest(sectionId, token) {
      return this.state.requestTokens.sections[sectionId] === token;
    }

    isLatestPanelRequest(sectionId, panelId, token) {
      return this.state.requestTokens.panels[`${sectionId}:${panelId}`] === token;
    }

    getActiveSection() {
      return this.findSection(this.state.activeSectionId);
    }

    findSection(sectionId) {
      return this.state.sections.find((section) => section.id === sectionId) || null;
    }

    findPanel(sectionId, panelId) {
      const section = this.findSection(sectionId);
      return section ? findPanel(section, panelId) : null;
    }
  }

  function renderReadonlyContent(pattern, section, panel) {
    const wrapper = createElement("div", { className: "qfp-readonly-grid" });
    const content = pattern.getPanelContent(panel) || {};
    const rows = Array.isArray(content.rows) ? content.rows : [];

    if (!rows.length) {
      wrapper.append(createElement("div", { className: "qfp-empty", text: pattern.config.texts.empty }));
      return wrapper;
    }

    rows.forEach((row) => {
      const item = createElement("div", {
        className: `qfp-readonly-item${row.span === "full" ? " is-full" : ""}`,
      });
      item.append(
        createElement("div", { className: "qfp-field-label", text: row.label || "-" }),
        createElement("div", { className: "qfp-field-value", text: valueToText(row.value) })
      );
      wrapper.append(item);
    });

    if (Array.isArray(panel.actions) && panel.actions.length) {
      wrapper.append(renderActionBar(pattern, section, panel, panel.actions));
    }

    return wrapper;
  }

  function renderFormContent(pattern, section, panel) {
    const content = pattern.getPanelContent(panel) || {};
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

    const fields = Array.isArray(content.fields) ? content.fields : [];
    if (!fields.length) {
      form.append(createElement("div", { className: "qfp-empty", text: pattern.config.texts.empty }));
      return form;
    }

    const grouped = groupFormFields(fields);
    grouped.forEach((group, groupIndex) => {
      const visibleFields = group.fields.filter((field) => field?.hidden !== true);
      if (!visibleFields.length) return;
      const groupWrap = createElement("section", { className: "qfp-form-section" });
      const groupTitle = resolveGroupTitle(group.key);
      const groupHint = resolveGroupHint(group.key);
      const head = createElement("div", { className: "qfp-form-section__head" });
      head.append(
        createElement("span", { className: "qfp-form-section__index", text: String(groupIndex + 1) }),
        createElement("div", {
          className: "qfp-form-section__title",
          text: groupTitle,
        })
      );
      if (groupHint) {
        head.append(createElement("div", { className: "qfp-form-section__hint", text: groupHint }));
      }
      groupWrap.append(head);

      const groupGrid = createElement("div", { className: "qfp-form-section__grid" });
      visibleFields.forEach((field) => {
        const canWrite = pattern.can("write", panel.permissions || section.permissions) && pattern.canFieldAccess(field, "write");
        const node = typeof fieldContracts.renderFieldNode === "function"
          ? fieldContracts.renderFieldNode({
              ...field,
              disabled: field.disabled || !canWrite,
            }, {
              createElement,
              surface: "form",
              fieldClassName: "qfp-form-field",
            })
          : null;
        if (node) groupGrid.append(node);
      });
      groupWrap.append(groupGrid);
      form.append(groupWrap);
    });

    if (panel.id === "club_settings_invite_create") {
      form.append(renderInviteCreateResultCard(fields));
    }

    form.append(
      renderActionBar(
        pattern,
        section,
        panel,
        panel.actions || [
          { id: "cancel", label: "Cancel", variant: "ghost", action: "cancel" },
          { id: "save", label: "Save", variant: "primary", action: "submit" },
        ]
      )
    );

    return form;
  }

  function renderTableContent(pattern, section, panel) {
    const wrapper = createElement("div", { className: "qfp-table-wrap" });
    const columns = Array.isArray(panel.columns) ? panel.columns : [];
    const rows = Array.isArray(panel.rows) ? panel.rows : [];
    const componentType = normalizeTableComponentType(panel.componentType);
    const tableConfig = panel.tableConfig || {};

    if (Array.isArray(panel.actions) && panel.actions.length) {
      wrapper.append(renderActionBar(pattern, section, panel, panel.actions));
    }

    if (!columns.length) {
      wrapper.append(createElement("div", { className: "qfp-empty", text: pattern.config.texts.empty }));
      return wrapper;
    }

    if (componentType === "data-table" || componentType === "inline-data-table") {
      const mount = createElement("div", {
        className: componentType === "inline-data-table" ? "qfp-inline-data-table-root" : "qfp-data-table-root",
      });
      wrapper.append(mount);
      mountTableRuntime(componentType, mount, {
        panel,
        columns,
        rows,
        tableConfig,
      });
      return wrapper;
    }

    const table = createElement("table", { className: "qfp-table" });
    const thead = createElement("thead");
    const headRow = createElement("tr");
    columns.forEach((column) => {
      headRow.append(createElement("th", { text: column.label || column.key || "-" }));
    });
    thead.append(headRow);

    const tbody = createElement("tbody");
    rows.forEach((row) => {
      const tr = createElement("tr");
      columns.forEach((column) => {
        tr.append(createElement("td", { text: valueToText(row[column.key]) }));
      });
      tbody.append(tr);
    });

    table.append(thead, tbody);
    wrapper.append(table);
    return wrapper;
  }

  function renderActionsContent(pattern, section, panel) {
    const wrapper = createElement("div", { className: "qfp-actions-wrap" });
    const content = pattern.getPanelContent(panel) || {};
    if (content.description) {
      wrapper.append(createElement("p", { className: "qfp-description", text: content.description }));
    }
    wrapper.append(renderActionBar(pattern, section, panel, panel.actions || []));
    return wrapper;
  }

  function renderStatisticsContent(pattern, section, panel) {
    const wrapper = createElement("div", { className: "qfp-stats-grid" });
    const content = pattern.getPanelContent(panel) || {};
    const stats = Array.isArray(content.stats) ? content.stats : [];

    if (!stats.length) {
      wrapper.append(createElement("div", { className: "qfp-empty", text: pattern.config.texts.empty }));
      return wrapper;
    }

    stats.forEach((entry) => {
      const card = createElement("div", { className: "qfp-stat-card" });
      card.append(
        createElement("div", { className: "qfp-field-label", text: entry.label || "-" }),
        createElement("div", { className: "qfp-stat-value", text: valueToText(entry.value) })
      );
      if (entry.meta) {
        card.append(createElement("div", { className: "qfp-field-help", text: entry.meta }));
      }
      wrapper.append(card);
    });

    return wrapper;
  }

  function renderMixedContent(pattern, section, panel) {
    const wrapper = createElement("div", { className: "qfp-mixed-stack" });
    const content = pattern.getPanelContent(panel) || {};
    const blocks = Array.isArray(content.blocks) ? content.blocks : [];

    if (!blocks.length) {
      wrapper.append(createElement("div", { className: "qfp-empty", text: pattern.config.texts.empty }));
      return wrapper;
    }

    blocks.forEach((block) => {
      const surrogatePanel = {
        ...panel,
        renderMode: block.renderMode || "readonly",
        componentType: block.componentType || null,
        content: block.content || {},
        actions: block.actions || [],
        columns: block.columns || [],
        rows: block.rows || [],
        tableConfig: block.tableConfig || null,
      };
      const blockNode = createElement("div", { className: "qfp-mixed-block" });
      if (block.title) {
        blockNode.append(createElement("h4", { className: "qfp-subtitle", text: block.title }));
      }
      blockNode.append(pattern.renderContentSlot(section, surrogatePanel));
      wrapper.append(blockNode);
    });

    return wrapper;
  }

  function renderCustomContent(pattern, section, panel) {
    if (typeof panel.render === "function") {
      const rendered = panel.render(pattern.createContext({ section, panel }));
      if (rendered instanceof Node) return rendered;
      if (typeof rendered === "string") {
        return createElement("pre", { className: "qfp-custom-text", text: rendered });
      }
    }
    return createElement("div", { className: "qfp-empty", text: pattern.config.texts.empty });
  }

  function renderActionBar(pattern, section, panel, actions) {
    const bar = createElement("div", { className: "qfp-action-bar" });

    actions.forEach((action) => {
      const allowed = pattern.can(action.permissionAction || "view", action.permissions || panel.permissions || section.permissions);
      if (!allowed) return;

      const button = createElement("button", {
        className: `qfp-btn qfp-btn--${action.variant || "ghost"}`,
        text: action.label || action.id || "Action",
        attrs: {
          type: action.action === "submit" ? "submit" : "button",
          disabled: action.disabled ? "disabled" : undefined,
        },
        onClick: async (event) => {
          if (action.action === "submit") return;
          event.preventDefault();
          if (action.action === "cancel") {
            pattern.revertPanelDraft(section.id, panel.id);
            return;
          }
          if (typeof action.onClick === "function") {
            await action.onClick(pattern.createContext({ section, panel, action, event }));
          }
        },
      });
      bar.append(button);
    });

    return bar;
  }

  function normalizeSections(sections) {
    return (sections || []).map((section, index) => ({
      id: section.id || `section-${index + 1}`,
      label: section.label || section.title || `Section ${index + 1}`,
      kicker: section.kicker || "",
      title: section.title || section.label || `Section ${index + 1}`,
      description: section.description || "",
      permissions: normalizePermissions(section.permissions || {}),
      meta: {
        loadState: "idle",
        ...(section.meta || {}),
      },
      panels: normalizePanels(section.panels || []),
      load: section.load,
      save: section.save,
      saveBinding: section.saveBinding || null,
    }));
  }

  function normalizePanels(panels) {
    return (panels || []).map((panel, index) => ({
      id: panel.id || `panel-${index + 1}`,
      icon: panel.icon || "",
      title: panel.title || panel.label || `Panel ${index + 1}`,
      meta: panel.meta || {},
      badge: panel.badge || null,
      renderMode: panel.renderMode || "readonly",
      componentType: panel.componentType || null,
      permissions: normalizePermissions(panel.permissions || {}),
      open: Boolean(panel.open),
      state: {
        loadState: "idle",
        saveState: "idle",
        dirty: false,
        ...(panel.state || {}),
      },
      flowType: panel.flowType || "standard",
      loadedContent: structuredCloneSafe(panel.content || {}),
      draftContent: structuredCloneSafe(panel.content || {}),
      actions: panel.actions || [],
      rows: panel.rows || [],
      columns: panel.columns || [],
      tableConfig: panel.tableConfig || null,
      load: panel.load,
      save: panel.save,
      saveBinding: panel.saveBinding || null,
      render: panel.render,
    }));
  }

  function groupFormFields(fields) {
    const groups = [];
    const groupMap = new Map();
    fields.forEach((field, index) => {
      const rawKey = String(field.group || "main").trim() || "main";
      if (!groupMap.has(rawKey)) {
        const bucket = { key: rawKey, fields: [] };
        groupMap.set(rawKey, bucket);
        groups.push(bucket);
      }
      const normalized = {
        ...field,
        __order: Number.isFinite(field.order) ? field.order : index,
      };
      groupMap.get(rawKey).fields.push(normalized);
    });
    groups.forEach((group) => {
      group.fields.sort((a, b) => a.__order - b.__order);
    });
    return groups;
  }

  function resolveGroupTitle(key = "") {
    const map = {
      club: "Stufe A · Vereinsdaten",
      contact: "Stufe A · Verantwortliche Person",
      confirmations: "Stufe A · Bestaetigungen",
      auth: "Stufe B · Zugang",
      main: "Stufe A · Angaben",
    };
    if (map[key]) return map[key];
    return `Stufe A · ${humanizeKey(key)}`;
  }

  function resolveGroupHint(key = "") {
    const map = {
      club: "Basisdaten des anfragenden Vereins.",
      contact: "Ansprechperson fuer Rueckfragen und Freigabe.",
      confirmations: "Zwei kurze Bestaetigungen vor dem Absenden.",
      auth: "Zugang erst nachgelagert, wenn zum Absenden eine Session fehlt.",
      main: "",
    };
    return map[key] || "";
  }

  async function copyTextToClipboard(value) {
    const text = String(value || "").trim();
    if (!text) return false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // noop
    }
    try {
      window.prompt("Bitte kopieren:", text);
      return true;
    } catch {
      return false;
    }
  }

  function fieldValueByName(fields = [], name = "") {
    const target = String(name || "").trim();
    const match = (fields || []).find((field) => String(field?.name || "").trim() === target);
    return match?.value ?? "";
  }

  function renderInviteCreateResultCard(fields = []) {
    const inviteUrl = String(fieldValueByName(fields, "invite_register_url") || "").trim();
    const inviteQrUrl = String(fieldValueByName(fields, "invite_qr_url") || "").trim();
    const inviteExpiresAt = String(fieldValueByName(fields, "invite_expires_at") || "").trim();
    const formattedExpiry = inviteExpiresAt
      ? new Date(inviteExpiresAt).toLocaleString("de-DE")
      : "-";

    const card = createElement("section", { className: "qfp-form-section qfp-invite-result-card" });
    const head = createElement("div", { className: "qfp-form-section__head" });
    head.append(
      createElement("span", { className: "qfp-form-section__index", text: "R" }),
      createElement("div", {
        className: "qfp-form-section__title",
        text: "Einladung",
      })
    );
    head.append(createElement("div", {
      className: "qfp-form-section__hint",
      text: inviteUrl || inviteQrUrl ? "QR und Link für den Versand an Mitglieder." : "Nach dem Speichern erscheinen QR und Invite-Link hier.",
    }));
    card.append(head);

    const groupGrid = createElement("div", { className: "qfp-form-section__grid" });
    if (inviteQrUrl) {
      const qrWrap = createElement("label", { className: "qfp-form-field is-full is-readonly" });
      qrWrap.append(
        createElement("span", { className: "qfp-field-label", text: "QR-Code" }),
        createElement("img", {
          className: "qfp-invite-result-card__qr",
          attrs: {
            src: inviteQrUrl,
            alt: "QR-Code für Einladungslink",
            loading: "lazy",
          },
        })
      );
      groupGrid.append(qrWrap);
    }

    const expiryWrap = createElement("label", { className: "qfp-form-field is-full is-readonly" });
    expiryWrap.append(
      createElement("span", { className: "qfp-field-label", text: "Gültig bis" }),
      createElement("input", {
        attrs: {
          type: "text",
          value: formattedExpiry,
          disabled: "disabled",
        },
      })
    );
    groupGrid.append(expiryWrap);
    card.append(groupGrid);

    const actions = createElement("div", { className: "qfp-action-bar" });
    const copyButton = createElement("button", {
      className: "qfp-btn qfp-btn--ghost",
      text: "Invite-Link kopieren",
      attrs: {
        type: "button",
        disabled: inviteUrl ? undefined : "disabled",
      },
      onClick: async () => {
        const ok = await copyTextToClipboard(inviteUrl);
        if (ok) {
          copyButton.textContent = "Link kopiert";
          window.setTimeout(() => {
            copyButton.textContent = "Invite-Link kopieren";
          }, 1200);
        }
      },
    });
    actions.append(copyButton);
    card.append(actions);

    return card;
  }

  function humanizeKey(key = "") {
    return String(key)
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function normalizePermissions(input) {
    return {
      view: input.view !== false,
      write: input.write === true,
      update: input.update === true,
      delete: input.delete === true,
      roles: Array.isArray(input.roles) ? input.roles.slice() : [],
    };
  }

  function firstSectionId(sections) {
    return Array.isArray(sections) && sections.length ? sections[0].id : null;
  }

  function findPanel(section, panelId) {
    return (section.panels || []).find((panel) => panel.id === panelId) || null;
  }

  function resolveElement(input) {
    if (!input) return null;
    if (input instanceof Element) return input;
    if (typeof input === "string") return document.querySelector(input);
    return null;
  }

  function createElement(tagName, options) {
    const node = document.createElement(tagName);
    const opts = options || {};

    if (opts.className) node.className = opts.className;
    if (opts.text != null) node.textContent = String(opts.text);

    Object.entries(opts.attrs || {}).forEach(([key, value]) => {
      if (value == null || value === false) return;
      node.setAttribute(key, value === true ? "" : String(value));
    });

    if (typeof opts.onClick === "function") {
      node.addEventListener("click", opts.onClick);
    }
    if (typeof opts.onSubmit === "function") {
      node.addEventListener("submit", opts.onSubmit);
    }

    return node;
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
    if (typeof value === "function") return value;
    if (typeof Element !== "undefined" && value instanceof Element) return value;
    if (typeof Node !== "undefined" && value instanceof Node) return value;
    if (Array.isArray(value)) {
      return value.map((entry) => structuredCloneSafe(entry));
    }
    if (isPlainObject(value)) {
      const output = {};
      Object.keys(value).forEach((key) => {
        output[key] = structuredCloneSafe(value[key]);
      });
      return output;
    }
    if (typeof globalScope.structuredClone === "function") {
      return globalScope.structuredClone(value);
    }
    return value;
  }

  function valueToText(value) {
    if (value == null || value === "") return "-";
    if (typeof value === "boolean") return value ? "Ja" : "Nein";
    return String(value);
  }

  function normalizeTableComponentType(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    if (raw === "data-table" || raw === "DataTablePanel") return "data-table";
    if (raw === "inline-data-table" || raw === "InlineDataTablePanel") return "inline-data-table";
    return null;
  }

  function mountTableRuntime(componentType, root, options) {
    const runtime = componentType === "inline-data-table"
      ? globalScope.FCPInlineDataTable
      : globalScope.FCPDataTable;
    const factory = componentType === "inline-data-table"
      ? runtime?.createStandardV2
      : runtime?.createStandardV1;

    if (typeof factory !== "function") {
      root.append(createElement("div", { className: "qfp-empty", text: "Table runtime nicht geladen." }));
      return;
    }

    const { panel, columns, rows, tableConfig } = options;
    const mountConfig = {
      root,
      columns,
      rows,
      tableId: tableConfig?.tableId || panel.id,
      rowKeyField: tableConfig?.rowKeyField || undefined,
      gridTemplateColumns: tableConfig?.gridTemplateColumns || undefined,
      rowInteractionMode: tableConfig?.rowInteractionMode || undefined,
      selectionMode: tableConfig?.selectionMode || undefined,
      viewMode: tableConfig?.viewMode || undefined,
      sortKey: tableConfig?.sortKey || undefined,
      sortDir: tableConfig?.sortDir || undefined,
      layoutVersion: tableConfig?.layoutVersion || undefined,
      defaultColumnOrder: Array.isArray(tableConfig?.defaultColumnOrder) ? tableConfig.defaultColumnOrder : undefined,
      defaultHiddenColumns: Array.isArray(tableConfig?.defaultHiddenColumns) ? tableConfig.defaultHiddenColumns : undefined,
      defaultColumnWidths: tableConfig?.defaultColumnWidths && typeof tableConfig.defaultColumnWidths === "object"
        ? tableConfig.defaultColumnWidths
        : undefined,
      title: tableConfig?.title || panel?.title || undefined,
      description: tableConfig?.description || panel?.description || undefined,
      searchPlaceholder: tableConfig?.searchPlaceholder || undefined,
      filterFields: Array.isArray(tableConfig?.filterFields) ? tableConfig.filterFields : [],
      showViewSwitch: tableConfig?.showViewSwitch !== false,
      showFilterButton: tableConfig?.showFilterButton === true,
      showMetaBar: tableConfig?.showMetaBar === true,
      metaLabel: tableConfig?.metaLabel || undefined,
      metaHint: tableConfig?.metaHint || undefined,
      primaryColumnKey: tableConfig?.primaryColumnKey || undefined,
      redesignTheme: tableConfig?.redesignTheme || undefined,
      redesign: tableConfig?.redesign !== false,
    };

    const mountVersion = Number(root.dataset.fcpMountVersion || "0") + 1;
    root.dataset.fcpMountVersion = String(mountVersion);

    globalScope.requestAnimationFrame(() => {
      if (!root.isConnected) return;
      if (String(root.dataset.fcpMountVersion || "") !== String(mountVersion)) return;
      try {
        if (root._fcpApi && typeof root._fcpApi.destroy === "function") {
          try {
            root._fcpApi.destroy({ reason: "quickflow-remount", mountVersion });
          } catch {
            // noop
          }
        }
        root.innerHTML = "";
        const instance = factory(mountConfig);
        if (componentType === "data-table" && typeof instance?.setRows === "function") {
          instance.setRows(rows);
        }
      } catch (error) {
        root.innerHTML = "";
        root.append(
          createElement("div", {
            className: "qfp-inline-error",
            text: error instanceof Error ? error.message : String(error),
          })
        );
      }
    });
  }

  function normalizeErrorMessage(error, fallback) {
    if (!error) return fallback;
    if (typeof error === "string") return error;
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  }

  globalScope.QuickFlowPattern = Object.freeze({
    create: createQuickFlowPattern,
    defaults: structuredCloneSafe(DEFAULTS),
  });
})(typeof window !== "undefined" ? window : globalThis);
