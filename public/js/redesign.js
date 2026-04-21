/* ═══════════════════════════════════════════════════════════════════════════
   FCP Inline Data Table · Redesign Augment Layer
   Läuft nach jedem Re-Render der Komponente, patched das DOM für:
     · Status-Zustände in Zeilen-Data-Attribut (für Pastell-Pills)
     · ⋯-Menü-Button pro Spaltenkopf mit Popover
     · Row-Hover-Actions (⋯-Button) + Rechtsklick-Kontextmenü
     · Inline-Filter-Zeile unter dem Spaltenkopf
     · Filter-Toggle-Button bekommt is-active Klasse wenn offen
   Aktivierung: toggleRedesign(true/false) im HTML.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const root = document.querySelector(".fcp-table-root");
  if (!root) return;

  // ── State (nur für Redesign-Layer) ───────────────────────────────────────
  const rdState = {
    active: false,
    filtersOpen: false,
    inlineFilters: {}, // { colKey: value }
    filterDefs: {
      status: { type: "select", options: [
        { value: "", label: "Alle" },
        { value: "active", label: "Aktiv" },
        { value: "pending", label: "Offen" },
        { value: "inactive", label: "Inaktiv" },
      ]},
      fishing_card_type: { type: "select", options: [
        { value: "", label: "Alle" },
        { value: "jahreskarte", label: "Jahreskarte" },
        { value: "jugendkarte", label: "Jugendkarte" },
        { value: "seniorenkarte", label: "Seniorenkarte" },
        { value: "tageskarte", label: "Tageskarte" },
      ]},
      // Alle anderen Spalten bekommen automatisch ein Text-Filter
    },
  };

  // ── Öffentliche Toggle-Funktion, vom HTML-Schalter aufgerufen ───────────
  window.toggleRedesign = function (enabled) {
    rdState.active = !!enabled;
    root.classList.toggle("is-redesign", !!enabled);
    document.documentElement.toggleAttribute("data-rd-on", !!enabled);
    if (!enabled) {
      // Alle Redesign-Injektionen entfernen
      root.querySelectorAll(".rd-col-menu-btn, .rd-row-actions, .rd-filter-row").forEach((n) => n.remove());
      observer?.disconnect();
      closePopover();
      return;
    }
    augment();
    // Observer erst nach dem ersten Augment verbinden
    if (observer) {
      try { observer.observe(root, { childList: true, subtree: true }); } catch {}
    }
  };

  // ── Popover-Management ───────────────────────────────────────────────────
  let currentPopover = null;
  function closePopover() {
    if (currentPopover) {
      currentPopover.remove();
      currentPopover = null;
    }
  }
  function openPopover(anchor, items, align = "right") {
    closePopover();
    const pop = document.createElement("div");
    pop.className = "rd-popover";
    items.forEach((item) => {
      if (item === "---") {
        pop.appendChild(document.createElement("hr"));
        return;
      }
      if (item.hint) {
        const h = document.createElement("div");
        h.className = "rd-popover-hint";
        h.textContent = item.hint;
        pop.appendChild(h);
        return;
      }
      const b = document.createElement("button");
      b.type = "button";
      if (item.danger) b.classList.add("is-danger");
      b.innerHTML = `<span style="width:14px;display:inline-flex;justify-content:center;">${item.icon || ""}</span><span>${item.label}</span>`;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        closePopover();
        try { item.onSelect?.(); } catch (err) { console.error(err); }
      });
      pop.appendChild(b);
    });
    document.body.appendChild(pop);
    currentPopover = pop;
    // Position
    const rect = anchor.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    let left = align === "right" ? rect.right - popRect.width : rect.left;
    let top = rect.bottom + 4;
    // flip wenn unten kein Platz
    if (top + popRect.height > window.innerHeight - 8) {
      top = rect.top - popRect.height - 4;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - popRect.width - 8));
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }
  function openPopoverAtPoint(x, y, items) {
    closePopover();
    const pop = document.createElement("div");
    pop.className = "rd-popover";
    items.forEach((item) => {
      if (item === "---") { pop.appendChild(document.createElement("hr")); return; }
      const b = document.createElement("button");
      b.type = "button";
      if (item.danger) b.classList.add("is-danger");
      b.innerHTML = `<span style="width:14px;display:inline-flex;justify-content:center;">${item.icon || ""}</span><span>${item.label}</span>`;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        closePopover();
        try { item.onSelect?.(); } catch (err) { console.error(err); }
      });
      pop.appendChild(b);
    });
    document.body.appendChild(pop);
    currentPopover = pop;
    const popRect = pop.getBoundingClientRect();
    let left = x, top = y;
    if (left + popRect.width > window.innerWidth - 8) left = window.innerWidth - popRect.width - 8;
    if (top + popRect.height > window.innerHeight - 8) top = y - popRect.height;
    pop.style.left = Math.max(8, left) + "px";
    pop.style.top = Math.max(8, top) + "px";
  }
  document.addEventListener("click", (e) => {
    if (!currentPopover) return;
    if (currentPopover.contains(e.target)) return;
    closePopover();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePopover();
  });

  // ── Klick-Helfer: simulate click auf bestehende Original-Buttons ─────────
  function clickOrigin(selector) {
    const btn = root.querySelector(selector);
    if (btn) btn.click();
  }

  // ── Spalten-⋯-Menü pro Headcell ──────────────────────────────────────────
  function injectColumnMenus() {
    root.querySelectorAll(".data-table__headcell").forEach((cell) => {
      const key = cell.getAttribute("data-head-key");
      if (!key) return;
      // bereits vorhanden?
      if (cell.querySelector(".rd-col-menu-btn")) return;
      const right = cell.querySelector(".headcell-right");
      if (!right) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rd-col-menu-btn";
      btn.setAttribute("aria-label", "Spalten-Aktionen");
      btn.innerHTML = "⋯";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const label = cell.querySelector(".data-table__sort-label")?.textContent?.trim() || key;
        openPopover(btn, [
          { hint: `Spalte: ${label}` },
          { icon: "↑", label: "Aufsteigend sortieren", onSelect: () => {
            const sortBtn = cell.querySelector(`[data-sort-key="${key}"]`);
            if (!sortBtn) return;
            // twice-click für asc? Wir setzen durch state der Komponente — das ist per Original-Click umschaltbar.
            // Hier: wenn nicht aktiv → asc; wenn aktiv asc → asc bleibt; wenn desc → klicken bis asc.
            if (!sortBtn.classList.contains("is-active")) sortBtn.click();
            else if (cell.querySelector(".data-table__sort-icon")?.textContent?.includes("↓")) sortBtn.click();
          }},
          { icon: "↓", label: "Absteigend sortieren", onSelect: () => {
            const sortBtn = cell.querySelector(`[data-sort-key="${key}"]`);
            if (!sortBtn) return;
            const iconText = cell.querySelector(".data-table__sort-icon")?.textContent || "";
            if (!sortBtn.classList.contains("is-active")) { sortBtn.click(); sortBtn.click(); }
            else if (iconText.includes("↑")) sortBtn.click();
          }},
          "---",
          { icon: "⊘", label: "Spalte ausblenden", onSelect: () => {
            const hide = cell.querySelector(".col-hide-btn");
            hide?.click();
          }},
          { icon: "↔", label: "Breite zurücksetzen", onSelect: () => {
            cell.style.removeProperty("width");
          }},
        ], "right");
      });
      // vor den (versteckten) Eye-Button stellen
      right.insertBefore(btn, right.firstChild);
    });
  }

  // ── Filter-Toggle-Tracking ───────────────────────────────────────────────
  function wireFilterToggle() {
    const btn = root.querySelector("[data-inline-filter-toggle]");
    if (!btn) return;
    btn.classList.toggle("is-active", rdState.filtersOpen);
    if (btn.dataset.rdWired === "1") return;
    btn.dataset.rdWired = "1";
    // Wir wollen NICHT das Original-Filter-Panel (das verstecken wir per CSS),
    // sondern unsere Inline-Filter-Zeile.
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      rdState.filtersOpen = !rdState.filtersOpen;
      btn.classList.toggle("is-active", rdState.filtersOpen);
      renderInlineFilters();
    }, true); // capture, um den Original-Handler zu schlagen
  }

  function renderInlineFilters() {
    // Alte entfernen
    root.querySelectorAll(".rd-filter-row").forEach((n) => n.remove());
    if (!rdState.filtersOpen) { applyInlineFilters(); return; }

    const head = root.querySelector(".data-table__head");
    if (!head) return;

    const row = document.createElement("div");
    row.className = "rd-filter-row";
    row.style.gridTemplateColumns = head.style.gridTemplateColumns || "";

    const cells = head.querySelectorAll(".data-table__headcell");
    cells.forEach((cell) => {
      const key = cell.getAttribute("data-head-key");
      const fcell = document.createElement("div");
      fcell.className = "rd-filter-cell";
      const def = rdState.filterDefs[key];
      const curVal = rdState.inlineFilters[key] || "";
      if (def?.type === "select") {
        const sel = document.createElement("select");
        def.options.forEach((o) => {
          const opt = document.createElement("option");
          opt.value = o.value;
          opt.textContent = o.label;
          if (o.value === curVal) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener("change", () => {
          rdState.inlineFilters[key] = sel.value;
          applyInlineFilters();
        });
        fcell.appendChild(sel);
      } else {
        const inp = document.createElement("input");
        inp.type = "text";
        inp.placeholder = "Filter …";
        inp.value = curVal;
        inp.addEventListener("input", () => {
          rdState.inlineFilters[key] = inp.value;
          applyInlineFilters();
        });
        fcell.appendChild(inp);
      }
      row.appendChild(fcell);
    });

    head.insertAdjacentElement("afterend", row);
    applyInlineFilters();
  }

  function applyInlineFilters() {
    const rows = root.querySelectorAll(".data-table__row");
    const active = Object.entries(rdState.inlineFilters).filter(([k, v]) => v != null && String(v).trim() !== "");
    // Markiere aktive Filter-Spalten
    root.querySelectorAll(".data-table__headcell").forEach((c) => {
      const k = c.getAttribute("data-head-key");
      c.classList.toggle("rd-has-filter", active.some(([ak]) => ak === k));
    });
    rows.forEach((row) => {
      let matches = true;
      for (const [key, needle] of active) {
        const cell = row.querySelector(`[data-label]`);
        // finde passende Zelle über data-label — aber wir kennen nur den Key.
        // Mapping key→label aus der Head-Zeile
        const head = root.querySelector(`.data-table__headcell[data-head-key="${CSS.escape(key)}"]`);
        const label = head?.querySelector(".data-table__sort-label")?.textContent?.trim();
        let val = "";
        if (label) {
          const c = row.querySelector(`[data-label="${CSS.escape(label)}"]`);
          val = c?.textContent?.toLowerCase() || "";
        }
        const n = String(needle).toLowerCase();
        // exact für Select-Optionen die einen leeren Status bedeuten
        if (key === "status" || key === "fishing_card_type") {
          // wir matchen den Text
          const map = { active: "aktiv", pending: "offen", inactive: "inaktiv" };
          const expected = map[needle] || needle;
          if (!val.includes(expected.toLowerCase())) { matches = false; break; }
        } else {
          if (!val.includes(n)) { matches = false; break; }
        }
      }
      row.style.display = matches ? "" : "none";
    });
    // Zähler aktualisieren
    const meta = root.querySelector(".table-meta-bar span:first-child");
    if (meta) {
      const visible = [...rows].filter((r) => r.style.display !== "none").length;
      const total = rows.length;
      meta.textContent = `Mitglieder: ${visible} / ${total}`;
    }
  }

  // ── Status-Zustand in Zeilen-Data-Attribut spiegeln ──────────────────────
  function markStatus() {
    root.querySelectorAll(".data-table__row").forEach((row) => {
      const statusCell = row.querySelector('[data-label="Status"]');
      const text = statusCell?.textContent?.trim().toLowerCase() || "";
      let s = "inactive";
      if (text.includes("aktiv") && !text.includes("inaktiv")) s = "active";
      else if (text.includes("offen")) s = "pending";
      else if (text.includes("inaktiv")) s = "inactive";
      row.setAttribute("data-rd-status", s);
    });
  }

  // ── Row-Hover-Actions + Rechtsklick-Kontextmenü ─────────────────────────
  function injectRowActions() {
    root.querySelectorAll(".data-table__row").forEach((row) => {
      if (row.querySelector(".rd-row-actions")) return;
      const rowId = row.getAttribute("data-row-id");
      if (!rowId) return;
      const wrap = document.createElement("div");
      wrap.className = "rd-row-actions";
      wrap.innerHTML = `
        <button type="button" data-rd-row-action="edit" title="Bearbeiten" aria-label="Bearbeiten">✎</button>
        <button type="button" data-rd-row-action="menu" title="Mehr" aria-label="Mehr">⋯</button>
      `;
      wrap.addEventListener("click", (e) => {
        e.stopPropagation();
        const btn = e.target.closest("[data-rd-row-action]");
        if (!btn) return;
        const act = btn.getAttribute("data-rd-row-action");
        if (act === "edit") {
          // Original-Zeilenklick auslösen (öffnet Inline-Edit)
          row.click();
        } else if (act === "menu") {
          openRowMenu(btn, rowId, row);
        }
      });
      row.appendChild(wrap);

      // Rechtsklick
      if (!row.dataset.rdCtxWired) {
        row.dataset.rdCtxWired = "1";
        row.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          openRowContextMenu(e.clientX, e.clientY, rowId, row);
        });
      }
    });
  }

  function buildRowMenuItems(rowId, row) {
    return [
      { icon: "✎", label: "Bearbeiten", onSelect: () => row.click() },
      { icon: "⎘", label: "Duplizieren", onSelect: () => {
        // Trigger Duplizieren über Komponente — falls API verfügbar
        try { window._rdApi?.duplicate?.(rowId); } catch {}
        // Fallback: rufe onDuplicate direkt über globale Referenz
        const dup = window._rdCallbacks?.onDuplicate;
        if (dup) {
          const data = window._rdGetRow?.(rowId);
          if (data) dup(data);
        }
      }},
      "---",
      { icon: "🗑", label: "Löschen", danger: true, onSelect: () => {
        if (!confirm("Zeile wirklich löschen?")) return;
        const del = window._rdCallbacks?.onDelete;
        if (del) {
          const data = window._rdGetRow?.(rowId);
          if (data) del(data);
        }
      }},
    ];
  }
  function openRowMenu(anchor, rowId, row) {
    openPopover(anchor, buildRowMenuItems(rowId, row), "right");
  }
  function openRowContextMenu(x, y, rowId, row) {
    openPopoverAtPoint(x, y, buildRowMenuItems(rowId, row));
  }

  // ── Orchestrator: nach jedem Render der Komponente laufen ────────────────
  let augmenting = false;
  let augmentScheduled = false;
  let observer = null;
  function augment() {
    if (!rdState.active) return;
    if (augmenting) return;
    augmenting = true;
    augmentScheduled = false;
    observer?.disconnect();
    try {
      markStatus();
      injectColumnMenus();
      injectRowActions();
      wireFilterToggle();
      renderInlineFilters();
    } catch (err) {
      console.error("[redesign] augment error:", err);
    } finally {
      // Observer erst nach dem nächsten Paint wieder verbinden
      requestAnimationFrame(() => {
        augmenting = false;
        if (rdState.active && observer) {
          try { observer.observe(root, { childList: true, subtree: true }); } catch {}
        }
      });
    }
  }

  // Beobachte Änderungen am Root — Komponente rendert bei jeder Aktion neu
  // DEBOUNCED: sammelt Mutationen über 50ms, läuft dann einmal
  let debounceTimer = null;
  observer = new MutationObserver(() => {
    if (!rdState.active) return;
    if (augmenting) return;
    if (augmentScheduled) return;
    augmentScheduled = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => augment(), 50);
  });
  // Observer wird NICHT beim Start verbunden — erst wenn Redesign aktiviert wird

  // Initial: nichts tun — Redesign wird über toggleRedesign gestartet
})();
