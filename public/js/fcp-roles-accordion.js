"use strict";

// Rollen/Rechte-Akkordeon — Tab 1 (Rechte-Matrix) + Tab 2 (Mitglieder-Zuweisung)
// Wird von fcp-adm-qfm-shared-renderers.js via renderAccordionContent() aufgerufen.
// Kein MutationObserver, kein DOM-Inject neben den Panels.

;(() => {
  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  async function sb(path, init = {}) {
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    const token = session()?.access_token;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${url}${path}`, { ...init, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || err?.hint || `HTTP ${res.status}`);
    }
    return res.json().catch(() => ({}));
  }

  async function rpc(name, payload = {}) {
    return sb(`/rest/v1/rpc/${name}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  function el(tag, opts = {}) {
    const node = document.createElement(tag);
    if (opts.className) node.className = opts.className;
    if (opts.text != null) node.textContent = String(opts.text);
    if (opts.html != null) node.innerHTML = opts.html;
    Object.entries(opts.attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      node.setAttribute(k, v === true ? "" : String(v));
    });
    if (typeof opts.onClick === "function") node.addEventListener("click", opts.onClick);
    return node;
  }

  function escHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  // ---------------------------------------------------------------------------
  // Hilfsfunktion: Level aus DB-Booleans ableiten
  // ---------------------------------------------------------------------------
  function levelFromBooleans(row) {
    if (!row.can_view) return "none";
    if (row.can_delete) return "full";
    if (row.can_write || row.can_update) return "write";
    return "read";
  }

  // ---------------------------------------------------------------------------
  // Tab 1 — Rechte-Akkordeon
  // ---------------------------------------------------------------------------

  function mountPermissionsAccordion(container, opts) {
    const { rows, accordionConfig, clubId, onMessage } = opts;
    const saveRpc = String(accordionConfig.saveRpc || "").replace(/^public\./, "");
    const subLoadRpc = String(accordionConfig.subLoadRpc || "").replace(/^public\./, "");
    const createRpc = String(accordionConfig.createRpc || "").replace(/^public\./, "");
    const canCreate = accordionConfig.canCreate === true;

    // Dirty-State: { roleKey: { module_key: levelString } }
    const dirty = {};
    let activeRoleKey = null;

    function isDirtyForRole(roleKey) {
      return dirty[roleKey] && Object.keys(dirty[roleKey]).length > 0;
    }

    async function confirmDiscard(message) {
      return new Promise((resolve) => {
        const overlay = el("div", { className: "roles-acc-confirm-overlay" });
        const box = el("div", { className: "roles-acc-confirm-box" });
        box.append(el("p", { text: message }));
        const btnRow = el("div", { className: "roles-acc-confirm-btns" });
        const btnSave = el("button", {
          className: "feed-btn",
          text: "Speichern",
          onClick: () => { overlay.remove(); resolve("save"); },
        });
        const btnDiscard = el("button", {
          className: "feed-btn feed-btn--ghost",
          text: "Verwerfen",
          onClick: () => { overlay.remove(); resolve("discard"); },
        });
        const btnCancel = el("button", {
          className: "feed-btn feed-btn--ghost",
          text: "Abbrechen",
          onClick: () => { overlay.remove(); resolve("cancel"); },
        });
        btnRow.append(btnSave, btnDiscard, btnCancel);
        box.append(btnRow);
        overlay.append(box);
        container.append(overlay);
      });
    }

    async function saveDirtyForRole(roleKey) {
      if (!dirty[roleKey]) return true;
      const entries = Object.entries(dirty[roleKey]);
      let allOk = true;
      for (const [moduleKey, level] of entries) {
        try {
          const result = await rpc(saveRpc, {
            p_club_id: clubId,
            p_role_key: roleKey,
            p_module_key: moduleKey,
            p_level: level,
          });
          const first = Array.isArray(result) ? result[0] : result;
          if (!first?.ok) {
            onMessage(first?.message || "Fehler beim Speichern.");
            allOk = false;
          }
        } catch (e) {
          onMessage(String(e?.message || "Fehler beim Speichern."));
          allOk = false;
        }
      }
      if (allOk) {
        delete dirty[roleKey];
        onMessage("Gespeichert.");
      }
      return allOk;
    }

    async function tryActivateRole(newRoleKey, rowEl, panelEl) {
      if (activeRoleKey && activeRoleKey !== newRoleKey && isDirtyForRole(activeRoleKey)) {
        const action = await confirmDiscard("Ungespeicherte Änderungen. Jetzt speichern?");
        if (action === "cancel") return false;
        if (action === "save") {
          const ok = await saveDirtyForRole(activeRoleKey);
          if (!ok) return false;
        } else {
          delete dirty[activeRoleKey];
        }
      }
      return true;
    }

    function renderPermissionPanel(roleKey, permRows, panelEl) {
      panelEl.innerHTML = "";
      const roleDirty = dirty[roleKey] || {};

      if (!permRows.length) {
        panelEl.append(el("p", { className: "small", text: "Keine Module konfiguriert." }));
        renderSaveBar(roleKey, panelEl);
        return;
      }

      const grid = el("div", { className: "roles-acc-perm-grid" });

      const headerRow = el("div", { className: "roles-acc-perm-head" });
      ["Modul", "Gesperrt", "Lesen", "Bearbeiten", "Bearbeiten + Löschen"].forEach((label) => {
        headerRow.append(el("div", { className: "roles-acc-perm-col", text: label }));
      });
      grid.append(headerRow);

      permRows.forEach((permRow) => {
        const moduleKey = permRow.module_key;
        const currentLevel = roleDirty[moduleKey] !== undefined
          ? roleDirty[moduleKey]
          : levelFromBooleans(permRow);

        const row = el("div", { className: "roles-acc-perm-row" });
        row.append(el("div", {
          className: "roles-acc-perm-module",
          text: permRow.module_label || moduleKey,
        }));

        ["none", "read", "write", "full"].forEach((level) => {
          const cell = el("div", { className: "roles-acc-perm-cell" });
          const radio = el("input", {
            attrs: {
              type: "radio",
              name: `roles-perm-${roleKey}-${moduleKey}`,
              value: level,
              checked: currentLevel === level ? true : null,
            },
          });
          radio.addEventListener("change", () => {
            if (!dirty[roleKey]) dirty[roleKey] = {};
            dirty[roleKey][moduleKey] = level;
            updateSaveBar(roleKey, panelEl);
          });
          cell.append(radio);
          row.append(cell);
        });

        grid.append(row);
      });

      panelEl.append(grid);
      renderSaveBar(roleKey, panelEl);
    }

    function renderSaveBar(roleKey, panelEl) {
      let bar = panelEl.querySelector(".roles-acc-save-bar");
      if (!bar) {
        bar = el("div", { className: "roles-acc-save-bar" });
        panelEl.append(bar);
      }
      updateSaveBar(roleKey, panelEl);
    }

    function updateSaveBar(roleKey, panelEl) {
      const bar = panelEl.querySelector(".roles-acc-save-bar");
      if (!bar) return;
      bar.innerHTML = "";
      if (!isDirtyForRole(roleKey)) return;
      const btnSave = el("button", {
        className: "feed-btn",
        text: "Speichern",
        onClick: async () => {
          await saveDirtyForRole(roleKey);
          // Reload sub-panel
          const subPanel = panelEl.querySelector(".roles-acc-perm-grid");
          if (subPanel) {
            await reloadPermissionsForRole(roleKey, panelEl);
          }
        },
      });
      const btnDiscard = el("button", {
        className: "feed-btn feed-btn--ghost",
        text: "Verwerfen",
        onClick: () => {
          delete dirty[roleKey];
          reloadPermissionsForRole(roleKey, panelEl);
        },
      });
      bar.append(btnSave, btnDiscard);
    }

    async function reloadPermissionsForRole(roleKey, panelEl) {
      panelEl.innerHTML = "";
      panelEl.append(el("p", { className: "small", text: "Lade..." }));
      try {
        const result = await rpc(subLoadRpc, { p_club_id: clubId, p_role_key: roleKey });
        const permRows = Array.isArray(result) ? result : [];
        renderPermissionPanel(roleKey, permRows, panelEl);
      } catch (e) {
        panelEl.innerHTML = "";
        panelEl.append(el("p", { className: "small", text: String(e?.message || "Ladefehler.") }));
      }
    }

    // Render accordion list
    const list = el("div", { className: "roles-acc-list" });

    if (canCreate) {
      const createRow = el("div", { className: "roles-acc-create-row" });
      const keyInput = el("input", {
        className: "roles-acc-input",
        attrs: { type: "text", placeholder: "Schlüssel (z.B. gewaesserwart)" },
      });
      const labelInput = el("input", {
        className: "roles-acc-input",
        attrs: { type: "text", placeholder: "Bezeichnung (z.B. Gewässerwart)" },
      });
      const btnCreate = el("button", {
        className: "feed-btn",
        text: "Rolle anlegen",
        onClick: async () => {
          const key = keyInput.value.trim();
          const label = labelInput.value.trim();
          if (!key || !label) { onMessage("Schlüssel und Bezeichnung erforderlich."); return; }
          try {
            const result = await rpc(createRpc, { p_club_id: clubId, p_role_key: key, p_label: label });
            const first = Array.isArray(result) ? result[0] : result;
            if (first?.ok) {
              onMessage(first.message || "Rolle angelegt.");
              keyInput.value = "";
              labelInput.value = "";
              // Neu laden der Rollenliste via panel.load()
              if (typeof opts.reloadPanel === "function") opts.reloadPanel();
            } else {
              onMessage(first?.message || "Fehler beim Anlegen.");
            }
          } catch (e) {
            onMessage(String(e?.message || "Fehler."));
          }
        },
      });
      createRow.append(keyInput, labelInput, btnCreate);
      list.append(createRow);
    }

    rows.forEach((roleRow) => {
      const roleKey = String(roleRow.role_key || "");
      const roleLabel = String(roleRow.role_label || roleKey);

      const item = el("div", { className: "roles-acc-item" });
      const header = el("div", { className: "roles-acc-header" });
      const headerLeft = el("div", { className: "roles-acc-header-left" });
      headerLeft.append(
        el("span", { className: "roles-acc-label", text: roleLabel }),
        el("span", { className: "roles-acc-badge", text: roleRow.is_core ? "Kern" : "Eigen" })
      );
      if (roleRow.module_count != null) {
        headerLeft.append(el("span", { className: "roles-acc-meta", text: `${roleRow.module_count} Module` }));
      }
      const chevron = el("span", { className: "roles-acc-chevron", text: "›" });
      header.append(headerLeft, chevron);
      item.append(header);

      const panel = el("div", { className: "roles-acc-panel is-hidden" });
      item.append(panel);

      header.addEventListener("click", async () => {
        const isOpen = !panel.classList.contains("is-hidden");
        if (isOpen) {
          if (isDirtyForRole(roleKey)) {
            const action = await confirmDiscard("Ungespeicherte Änderungen verwerfen?");
            if (action === "cancel") return;
            if (action === "save") {
              await saveDirtyForRole(roleKey);
            } else {
              delete dirty[roleKey];
            }
          }
          panel.classList.add("is-hidden");
          item.classList.remove("is-open");
          chevron.textContent = "›";
          if (activeRoleKey === roleKey) activeRoleKey = null;
          return;
        }

        const allowed = await tryActivateRole(roleKey, item, panel);
        if (!allowed) return;

        // Alle anderen schließen
        list.querySelectorAll(".roles-acc-item.is-open").forEach((other) => {
          other.classList.remove("is-open");
          other.querySelector(".roles-acc-chevron").textContent = "›";
          other.querySelector(".roles-acc-panel").classList.add("is-hidden");
        });

        panel.classList.remove("is-hidden");
        item.classList.add("is-open");
        chevron.textContent = "⌄";
        activeRoleKey = roleKey;

        await reloadPermissionsForRole(roleKey, panel);
      });

      list.append(item);
    });

    if (!rows.length) {
      list.append(el("p", { className: "small", text: opts.emptyText || "Keine Rollen." }));
    }

    container.append(list);
  }

  // ---------------------------------------------------------------------------
  // Tab 2 — Mitglieder-Akkordeon + Zuweisungs-Dialog
  // ---------------------------------------------------------------------------

  function mountMembersAccordion(container, opts) {
    const { rows, accordionConfig, clubId, onMessage } = opts;
    const subLoadRpc = String(accordionConfig.subLoadRpc || "").replace(/^public\./, "");
    const assignDialogRpc = String(accordionConfig.assignDialogRpc || "").replace(/^public\./, "");
    const assignRpc = String(accordionConfig.assignRpc || "").replace(/^public\./, "");
    const removeRpc = String(accordionConfig.removeRpc || "").replace(/^public\./, "");

    function renderMemberList(memberRows, roleKey, panelEl) {
      panelEl.innerHTML = "";

      if (!memberRows.length) {
        panelEl.append(el("p", { className: "small", text: "Keine Mitglieder in dieser Rolle." }));
      } else {
        const memberList = el("ul", { className: "roles-acc-member-list" });
        memberRows.forEach((m) => {
          const li = el("li", { className: "roles-acc-member-item" });
          const nameEl = el("span", {
            text: `${m.last_name || ""}, ${m.first_name || ""} (${m.member_no || ""})`,
          });
          if (m.has_login) {
            nameEl.append(el("span", { className: "roles-acc-login-dot", attrs: { title: "Hat Login" } }));
          }
          const btnRemove = el("button", {
            className: "feed-btn feed-btn--ghost feed-btn--sm",
            text: "Entfernen",
            onClick: async () => {
              try {
                const result = await rpc(removeRpc, {
                  p_club_id: clubId,
                  p_club_member_id: m.club_member_id,
                  p_role_key: roleKey,
                });
                const first = Array.isArray(result) ? result[0] : result;
                onMessage(first?.message || "Rolle entzogen.");
                await reloadMembersForRole(roleKey, panelEl);
              } catch (e) {
                onMessage(String(e?.message || "Fehler."));
              }
            },
          });
          li.append(nameEl, btnRemove);
          memberList.append(li);
        });
        panelEl.append(memberList);
      }

      const btnAdd = el("button", {
        className: "feed-btn",
        text: "Mitglied hinzufügen",
        onClick: () => openAssignDialog(roleKey, panelEl),
      });
      panelEl.append(btnAdd);
    }

    async function reloadMembersForRole(roleKey, panelEl) {
      panelEl.innerHTML = "";
      panelEl.append(el("p", { className: "small", text: "Lade..." }));
      try {
        const result = await rpc(subLoadRpc, { p_club_id: clubId, p_role_key: roleKey });
        const memberRows = Array.isArray(result) ? result : [];
        renderMemberList(memberRows, roleKey, panelEl);
        // Zähler-Badge im Header live aktualisieren
        const badge = list.querySelector(`[data-role-count-for="${CSS.escape(roleKey)}"]`);
        if (badge) badge.textContent = `${memberRows.length} Mitgl.`;
      } catch (e) {
        panelEl.innerHTML = "";
        panelEl.append(el("p", { className: "small", text: String(e?.message || "Ladefehler.") }));
      }
    }

    function openAssignDialog(roleKey, panelEl) {
      const overlay = el("div", { className: "roles-acc-dialog-overlay" });
      const dialog = el("div", { className: "roles-acc-dialog" });

      const title = el("h3", { className: "roles-acc-dialog-title", text: "Mitglied zur Rolle zuweisen" });
      const searchInput = el("input", {
        className: "roles-acc-input",
        attrs: { type: "text", placeholder: "Suche nach Nummer, Name oder Vorname" },
      });

      const listWrap = el("div", { className: "roles-acc-dialog-list" });
      listWrap.textContent = "Lade...";

      const btnRow = el("div", { className: "roles-acc-dialog-btns" });
      const btnSave = el("button", {
        className: "feed-btn",
        attrs: { disabled: true },
        text: "Speichern",
      });
      const btnCancel = el("button", {
        className: "feed-btn feed-btn--ghost",
        text: "Abbrechen",
        onClick: () => overlay.remove(),
      });
      btnRow.append(btnSave, btnCancel);
      dialog.append(title, searchInput, listWrap, btnRow);
      overlay.append(dialog);
      container.append(overlay);

      // Persistente Selektion: key = club_member_id, value = {has_role, selected}
      const selection = new Map();
      let allMembers = [];

      async function loadDialog() {
        try {
          const result = await rpc(assignDialogRpc, { p_club_id: clubId, p_role_key: roleKey });
          allMembers = Array.isArray(result) ? result : [];
          allMembers.forEach((m) => {
            selection.set(String(m.club_member_id), {
              member: m,
              selected: m.has_role === true,
              originalHasRole: m.has_role === true,
            });
          });
          renderDialogList("");
        } catch (e) {
          listWrap.textContent = String(e?.message || "Ladefehler.");
        }
      }

      function renderDialogList(searchTerm) {
        listWrap.innerHTML = "";
        const term = searchTerm.toLowerCase().trim();
        const filtered = allMembers.filter((m) => {
          if (!term) return true;
          const no = String(m.member_no || "").toLowerCase();
          const last = String(m.last_name || "").toLowerCase();
          const first = String(m.first_name || "").toLowerCase();
          return no.includes(term) || last.includes(term) || first.includes(term);
        });

        if (!filtered.length) {
          listWrap.append(el("p", { className: "small", text: "Keine Treffer." }));
          return;
        }

        // Bereits zugewiesen (has_role=true) immer oben
        const sorted = [...filtered].sort((a, b) => {
          const sa = selection.get(String(a.club_member_id));
          const sb2 = selection.get(String(b.club_member_id));
          const aIsRole = sa ? sa.originalHasRole : a.has_role;
          const bIsRole = sb2 ? sb2.originalHasRole : b.has_role;
          if (aIsRole && !bIsRole) return -1;
          if (!aIsRole && bIsRole) return 1;
          return String(a.last_name || "").localeCompare(String(b.last_name || ""));
        });

        sorted.forEach((m) => {
          const memberId = String(m.club_member_id);
          const state = selection.get(memberId);
          const isSelected = state ? state.selected : false;

          const row = el("div", { className: `roles-acc-dialog-row${isSelected ? " is-selected" : ""}` });
          const cb = el("input", {
            attrs: {
              type: "checkbox",
              checked: isSelected ? true : null,
            },
          });
          const label = el("label", {
            text: `${m.last_name || ""}, ${m.first_name || ""} (${m.member_no || ""})`,
          });
          if (m.has_login) {
            label.append(el("span", { className: "roles-acc-login-dot", attrs: { title: "Hat Login" } }));
          }
          cb.addEventListener("change", () => {
            const s = selection.get(memberId);
            if (s) s.selected = cb.checked;
            row.classList.toggle("is-selected", cb.checked);
            updateSaveButton();
          });
          row.append(cb, label);
          listWrap.append(row);
        });

        updateSaveButton();
      }

      function updateSaveButton() {
        let hasChanges = false;
        selection.forEach((s) => {
          if (s.selected !== s.originalHasRole) hasChanges = true;
        });
        btnSave.disabled = !hasChanges;
      }

      searchInput.addEventListener("input", () => {
        renderDialogList(searchInput.value);
      });

      btnSave.addEventListener("click", async () => {
        btnSave.disabled = true;
        const toAssign = [];
        const toRemove = [];
        selection.forEach((s, memberId) => {
          if (s.selected && !s.originalHasRole) toAssign.push(memberId);
          if (!s.selected && s.originalHasRole) toRemove.push(memberId);
        });

        let allOk = true;
        for (const memberId of toAssign) {
          try {
            const result = await rpc(assignRpc, {
              p_club_id: clubId,
              p_club_member_id: memberId,
              p_role_key: roleKey,
            });
            const first = Array.isArray(result) ? result[0] : result;
            if (!first?.ok) { onMessage(first?.message || "Fehler."); allOk = false; }
          } catch (e) { onMessage(String(e?.message || "Fehler.")); allOk = false; }
        }
        for (const memberId of toRemove) {
          try {
            const result = await rpc(removeRpc, {
              p_club_id: clubId,
              p_club_member_id: memberId,
              p_role_key: roleKey,
            });
            const first = Array.isArray(result) ? result[0] : result;
            if (!first?.ok) { onMessage(first?.message || "Fehler."); allOk = false; }
          } catch (e) { onMessage(String(e?.message || "Fehler.")); allOk = false; }
        }

        if (allOk) {
          onMessage(`${toAssign.length} zugewiesen, ${toRemove.length} entfernt.`);
          overlay.remove();
          await reloadMembersForRole(roleKey, panelEl);
        } else {
          btnSave.disabled = false;
        }
      });

      loadDialog();
    }

    // Render accordion list
    const list = el("div", { className: "roles-acc-list" });

    rows.forEach((roleRow) => {
      const roleKey = String(roleRow.role_key || "");
      const roleLabel = String(roleRow.role_label || roleKey);

      const item = el("div", { className: "roles-acc-item" });
      const header = el("div", { className: "roles-acc-header" });
      const headerLeft = el("div", { className: "roles-acc-header-left" });
      headerLeft.append(
        el("span", { className: "roles-acc-label", text: roleLabel }),
        el("span", { className: "roles-acc-badge", text: roleRow.is_core ? "Kern" : "Eigen" })
      );
      if (roleRow.member_count != null) {
        headerLeft.append(el("span", {
          className: "roles-acc-meta",
          text: `${roleRow.member_count} Mitgl.`,
          attrs: { "data-role-count-for": roleKey },
        }));
      }
      const chevron = el("span", { className: "roles-acc-chevron", text: "›" });
      header.append(headerLeft, chevron);
      item.append(header);

      const panel = el("div", { className: "roles-acc-panel is-hidden" });
      item.append(panel);

      header.addEventListener("click", async () => {
        const isOpen = !panel.classList.contains("is-hidden");
        if (isOpen) {
          panel.classList.add("is-hidden");
          item.classList.remove("is-open");
          chevron.textContent = "›";
          return;
        }
        // Alle anderen schließen
        list.querySelectorAll(".roles-acc-item.is-open").forEach((other) => {
          other.classList.remove("is-open");
          other.querySelector(".roles-acc-chevron").textContent = "›";
          other.querySelector(".roles-acc-panel").classList.add("is-hidden");
        });
        panel.classList.remove("is-hidden");
        item.classList.add("is-open");
        chevron.textContent = "⌄";
        await reloadMembersForRole(roleKey, panel);
      });

      list.append(item);
    });

    if (!rows.length) {
      list.append(el("p", { className: "small", text: opts.emptyText || "Keine Rollen." }));
    }

    container.append(list);
  }

  // ---------------------------------------------------------------------------
  // Haupt-Mount-Funktion
  // ---------------------------------------------------------------------------

  function mount(container, opts = {}) {
    const { panel, rows, accordionConfig, section } = opts;
    const variant = String(accordionConfig.variant || "permissions");

    // club_id aus dem Pattern (wird von resolveClubContext() gesetzt)
    // club_id wird via panel.state.__accordionClubId transportiert
    // (applyPanelPayload merged state auf die State-Kopie → korrekte Referenz).
    const clubId = String(
      panel?.state?.__accordionClubId ||
      new URLSearchParams(window.location.search).get("club_id") ||
      ""
    ).trim();

    if (!clubId) {
      container.append(
        document.createElement("p")
      );
      container.querySelector("p").className = "small";
      container.querySelector("p").textContent = "Kein Vereinskontext. Bitte Verein wählen.";
      return;
    }

    function onMessage(text) {
      if (typeof opts.pattern?.config?.onMessage === "function") {
        opts.pattern.config.onMessage(text);
      } else if (typeof opts.pattern?.config?.setMessage === "function") {
        opts.pattern.config.setMessage(text);
      }
    }

    function reloadPanel() {
      if (opts.pattern && typeof opts.pattern.loadPanel === "function" && section?.id && panel?.id) {
        opts.pattern.loadPanel(section.id, panel.id).then(() => {
          if (typeof opts.pattern.render === "function") opts.pattern.render();
        }).catch(() => {});
      }
    }

    const mountOpts = { rows, accordionConfig, clubId, onMessage, reloadPanel, emptyText: opts.emptyText };

    if (variant === "members") {
      mountMembersAccordion(container, mountOpts);
    } else {
      mountPermissionsAccordion(container, mountOpts);
    }
  }

  window.FcpRolesAccordion = Object.freeze({ mount });
})();
