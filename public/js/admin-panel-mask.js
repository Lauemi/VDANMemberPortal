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

  function maskIdToModuleId(maskId) {
    // "ADM_NATUR_GEWAESSER" → "natur_gewaesser"
    return String(maskId || "").replace(/^ADM_/i, "").toLowerCase() || null;
  }

  function checkIsSuperadminLocal() {
    try {
      const ids = String(document.body?.getAttribute("data-superadmin-user-ids") || "")
        .split(",").map((s) => s.trim()).filter(Boolean);
      if (!ids.length) return false;
      const session = window.VDAN_AUTH?.loadSession?.();
      const uid = String(session?.user?.id || "");
      return uid ? ids.includes(uid) : false;
    } catch {
      return false;
    }
  }

  function filterTabsByVisibility(items, maskId) {
    try {
      const tabVis = JSON.parse(localStorage.getItem("vdan_portal_tab_visibility_v1") || "null");
      if (!tabVis || typeof tabVis !== "object") return items;
      const moduleId = maskIdToModuleId(maskId);
      if (!moduleId || !tabVis[moduleId]) return items;
      const isSuperadmin = checkIsSuperadminLocal();
      return items.filter((item) => {
        const cfg = tabVis[moduleId]?.[item.id];
        if (!cfg) return true;
        if (cfg.visible === false) return false;
        if (cfg.deprecated && !isSuperadmin) return false;
        if (cfg.superadmin_only && !isSuperadmin) return false;
        return true;
      });
    } catch {
      return items;
    }
  }

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
      this._updateBreadcrumb(section.label || section.title || "");
      /* Nav sofort aktiv markieren — nur is-active toggeln, kein innerHTML-Reset.
         renderNav() würde den gesamten Nav-DOM abreißen und neu aufbauen, was das
         sichtbare Nav-Zucken verursacht. Hier reicht ein gezieltes classList-Toggle. */
      this.refs.nav?.querySelectorAll(".admin-nav-btn").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.sectionId === sectionId);
      });
      /* Content dimmen statt sofort leeren — renderContent() tauscht den DOM
         atomar aus sobald Daten da sind. innerHTML = "" hier würde den Flash erzeugen. */
      if (this.refs.content) {
        this.refs.content.classList.add("adm-content--loading");
      }
      await this.hydrateActiveSection();
    }

    /* ── Dynamische Breadcrumb-Erweiterung ───────────────────────── */
    _updateBreadcrumb(sectionLabel) {
      const crumbNav = document.querySelector(".adm-topbar__crumbs");
      if (!crumbNav) return;

      /* Altes dynamisches Segment entfernen */
      const old = crumbNav.querySelector(".adm-topbar__crumb--section");
      if (old) {
        const oldSep = old.previousElementSibling;
        if (oldSep?.classList.contains("adm-topbar__sep")) oldSep.remove();
        old.remove();
      }

      if (!sectionLabel) return;

      /* Nicht einfügen, wenn der letzte statische Crumb denselben Text hat
         (SSR-Breadcrumb enthält bereits den Sektionsnamen → kein Duplikat). */
      const lastStaticCrumb = crumbNav.querySelector(".adm-topbar__crumb--active");
      if (lastStaticCrumb && lastStaticCrumb.textContent.trim() === sectionLabel.trim()) return;

      const sep = document.createElement("span");
      sep.className = "adm-topbar__sep";
      sep.setAttribute("aria-hidden", "true");
      sep.textContent = "›";

      const crumb = document.createElement("span");
      crumb.className = "adm-topbar__crumb adm-topbar__crumb--section";
      crumb.textContent = sectionLabel;

      crumbNav.append(sep, crumb);
    }

    async hydrateVisiblePanels() {
      await this.hydrateActiveSection();
    }

    async hydrateActiveSection() {
      const section = this.getActiveSection();
      if (!section) return;
      for (const panel of section.panels || []) {
        // Skip panels already loaded — prevents redundant Supabase requests on
        // tab switches. Post-action reloads (domain adapters, contract hub) call
        // loadPanel() directly and bypass this guard intentionally.
        if (panel._loaded) continue;
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
        // Mark as successfully loaded so hydrateActiveSection can skip this
        // panel on subsequent tab switches. Explicit loadPanel() calls
        // (post-action reloads in domain adapters / contract hub) always run
        // regardless, because they bypass hydrateActiveSection entirely.
        panel._loaded = true;
      } catch (error) {
        panel.state = {
          ...(panel.state || {}),
          error: normalizeErrorMessage(error, this.config.texts.loadError),
        };
        // Do NOT set panel._loaded on error — allow retry on next activation.
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
        this.refs.nav.setAttribute("data-nav-mode", "top-grid");
        this.refs.content = createElement("div", { className: "admin-board__content" });
        this.refs.status = createElement("div", { className: "qfp-mask-status", attrs: { "aria-live": "polite" } });
        this.root.append(this.refs.shell);
        this.refs.shell.append(this.refs.nav, this.refs.content);
        this.root.append(this.refs.status);

        /* ── Mobile Nav: Hamburger in Topbar injizieren (einmalig) ─────── */
        /* Wir setzen unseren Button IN die .adm-topbar__burger-Div (rechts),
           CSS versteckt den originalen #burgerToggle auf Mobile ADM-Seiten.
           Ergebnis: nur EIN Toggle-Button statt zweier hamburger-artiger Icons. */
        const topbar = document.querySelector("#admTopbar");
        if (topbar && !topbar.querySelector(".adm-nav-mob-burger")) {
          const burger = createElement("button", {
            className: "adm-nav-mob-burger",
            attrs: { type: "button", "aria-label": "Navigation öffnen/schließen" },
            text: "☰",
            onClick: (e) => {
              e.stopPropagation();
              this.refs.shell.classList.toggle("adm-nav-open");
            },
          });
          const burgerDiv = topbar.querySelector(".adm-topbar__burger");
          if (burgerDiv) {
            burgerDiv.prepend(burger);
          } else {
            const brand = topbar.querySelector(".adm-topbar__brand");
            if (brand) brand.insertAdjacentElement("afterend", burger);
            else topbar.prepend(burger);
          }
          /* Klasse am Body: scoped CSS-Hide für #burgerToggle NUR auf ADM-Seiten */
          document.body.classList.add("has-adm-nav");
        }

        /* ── Mobile Nav: Klick auf Backdrop (admin-board außerhalb Nav) schließt ── */
        this.refs.shell.addEventListener("click", (e) => {
          if (
            this.refs.shell.classList.contains("adm-nav-open") &&
            !this.refs.nav.contains(e.target)
          ) {
            this.refs.shell.classList.remove("adm-nav-open");
          }
        });
      }

      this.refs.shell.classList.toggle("fcp-adm-shell--hosted", Boolean(this.root.closest(".card__body")));
      this.renderNav();
      this.renderContent();
      this.renderStatus();
      // Dialog-Host stellt ensureDialog bereit (via installOn auf Prototype)
      if (typeof this.ensureDialog === "function") this.ensureDialog();
    }

    renderNav() {
      this.refs.nav.innerHTML = "";

      /* Schließen-Button (Desktop: display:none — nur Mobile via CSS sichtbar) */
      this.refs.nav.append(
        createElement("button", {
          className: "adm-nav-close-btn",
          attrs: { type: "button", "aria-label": "Navigation schließen" },
          text: "Menü schließen  ✕",
          onClick: () => this.refs.shell.classList.remove("adm-nav-open"),
        })
      );

      const navItems = filterTabsByVisibility(
        Array.isArray(this.config.workspaceNav?.items) ? this.config.workspaceNav.items : [],
        this.config.maskId || ""
      );
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
            onClick: () => {
              /* Mobile Nav beim Sektionswechsel schließen */
              this.refs.shell.classList.remove("adm-nav-open");
              this.activateSection(item.targetSectionId);
            },
          })
        );
      });

      /* ── Mobile (≤600px): Öffentliche Links ins Drawer-Footer ──────────
         body.has-adm-nav versteckt #burgerToggle auf Mobile — damit werden
         publicMenuLinks (Datenschutz, Impressum etc.) unerreichbar.
         Workaround: Links aus dem DOM-#burgerPopover lesen und als
         .adm-nav-public-link am Drawer-Ende anhängen.
         CSS steuert die Sichtbarkeit: nur ≤600px sichtbar. */
      const burgerPopover = document.querySelector("#burgerPopover");
      const pubLinks = burgerPopover ? Array.from(burgerPopover.querySelectorAll("a[href]")) : [];
      if (pubLinks.length) {
        this.refs.nav.append(createElement("hr", { className: "adm-nav-public-sep" }));
        pubLinks.forEach((a) => {
          this.refs.nav.append(
            createElement("a", {
              className: "adm-nav-public-link",
              text: a.textContent.trim(),
              attrs: { href: a.href },
              onClick: () => this.refs.shell.classList.remove("adm-nav-open"),
            })
          );
        });
      }
    }

    renderContent() {
      this.refs.content.innerHTML = "";
      this.refs.content.classList.remove("adm-content--loading");
      const activeSection = this.getActiveSection();
      if (!activeSection) {
        this.refs.content.append(createElement("section", { className: "admin-section is-active" }));
        return;
      }

      const sectionNode = createElement("section", {
        className: "admin-section is-active",
        attrs: { "data-section-id": activeSection.id },
      });

      /* Gap-Panels überspringen — kein DB-Backend, nur Entwickler-Platzhalter */
      const livePanels = (activeSection.panels || []).filter((panel) => {
        const state = resolvePanelSurfaceState(panel);
        return !state || state.key !== "gap";
      });

      if (!livePanels.length) {
        sectionNode.append(
          createElement("p", {
            className: "adm-section-empty",
            text: "Dieser Bereich ist noch in Vorbereitung.",
          })
        );
        this.refs.content.append(sectionNode);
        return;
      }

      if (activeSection.sectionLayout === "tabs") {
        /* ── Tab-Layout: Strip + one visible panel at a time ─────────── */
        const strip = createElement("nav", { className: "adm-section-tabs" });
        livePanels.forEach((panel, idx) => {
          const btn = createElement("button", {
            className: "adm-section-tab" + (idx === 0 ? " is-active" : ""),
            text: panel.title || panel.id,
            attrs: { type: "button", "data-tab-target": panel.id },
          });
          btn.addEventListener("click", () => {
            strip.querySelectorAll(".adm-section-tab").forEach((b) => b.classList.remove("is-active"));
            btn.classList.add("is-active");
            sectionNode.querySelectorAll("[data-tab-panel]").forEach((p) => {
              p.hidden = p.dataset.tabPanel !== panel.id;
            });
            /* Nav-Submenu aktiven Tab markieren */
            const navEl = this.refs.nav;
            if (navEl) {
              navEl.querySelectorAll(".adm-nav-subitem").forEach((s) => s.classList.remove("is-active"));
              const target = navEl.querySelector(`.adm-nav-subitem[data-tab-id="${panel.id}"]`);
              if (target) target.classList.add("is-active");
            }
          });
          strip.append(btn);
        });
        sectionNode.append(strip);
        livePanels.forEach((panel, idx) => {
          const wrap = createElement("div", {
            attrs: { "data-tab-panel": panel.id },
          });
          if (idx !== 0) wrap.hidden = true;
          wrap.append(this.renderPanel(activeSection, panel));
          sectionNode.append(wrap);
        });
        /* Nav-Submenu einmalig nach dem Rendern injizieren */
        requestAnimationFrame(() => this._injectTabSubnav(activeSection, livePanels));
      } else {
        /* ── Stack-Layout (default) ───────────────────────────────────── */
        livePanels.forEach((panel) => {
          sectionNode.append(this.renderPanel(activeSection, panel));
        });
      }

      this.refs.content.append(sectionNode);
    }

    /* ── Tab-Submenu: Sub-Items unter dem aktiven Nav-Button ─────────── */
    _injectTabSubnav(section, panels) {
      const navEl = this.refs.nav;
      if (!navEl) return;

      /* Alte Sub-Items entfernen */
      navEl.querySelectorAll(".adm-nav-subitem-wrap").forEach((el) => el.remove());

      /* Aktiven Nav-Button finden */
      const activeBtn = navEl.querySelector(".admin-nav-btn.is-active");
      if (!activeBtn) return;

      const wrap = createElement("div", { className: "adm-nav-subitem-wrap" });
      panels.forEach((panel, idx) => {
        const sub = createElement("button", {
          className: "adm-nav-subitem" + (idx === 0 ? " is-active" : ""),
          text: panel.title || panel.id,
          attrs: { type: "button", "data-tab-id": panel.id },
        });
        sub.addEventListener("click", () => {
          /* Korrespondierenden Tab-Strip-Button klicken */
          const tabBtn = this.refs.content?.querySelector(
            `.adm-section-tab[data-tab-target="${panel.id}"]`
          );
          if (tabBtn) tabBtn.click();
        });
        wrap.append(sub);
      });

      activeBtn.insertAdjacentElement("afterend", wrap);
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
      const panelTitle = String(panel?.title || panel?.id || "").trim();
      const sectionTitle = String(section?.title || "").trim();
      const shouldRenderPanelTitle = panelTitle && panelTitle !== sectionTitle;
      if (shouldRenderPanelTitle) {
        titleWrap.append(createElement("h3", { text: panelTitle }));
        header.append(titleWrap);
      }
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
        case "accordion":
          return typeof renderers.renderAccordionContent === "function"
            ? renderers.renderAccordionContent(this, section, panel, emptyText)
            : createElement("p", { className: "small", text: emptyText });
        case "catch-matrix":
          return typeof window.FcpCatchMatrix?.renderPanel === "function"
            ? window.FcpCatchMatrix.renderPanel(this, section, panel, emptyText)
            : createElement("p", { className: "small", text: emptyText });
        case "catch-entry":
          return typeof window.FcpCatchEntry?.renderPanel === "function"
            ? window.FcpCatchEntry.renderPanel(this, section, panel, emptyText)
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
