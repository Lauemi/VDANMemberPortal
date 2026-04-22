/* ═══════════════════════════════════════════════════════════════════════════
   FCP Redesign – Popover Utility + toggleRedesign
   Verantwortlich nur für:
     · window.RdPopover   – Popover-Positionierung und -Inhalt
     · toggleRedesign()   – Redesign-Schalter, delegiert an root._fcpApi
   Alle Render-Logik (Status, Filter-Zeile, Menü-Buttons, Row-Actions)
   lebt in fcp-inline-data-table-v2.js.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  // ── Popover-Management ───────────────────────────────────────────────────
  let currentPopover = null;
  const THEME_VARS = [
    "--rd-bg",
    "--rd-surface",
    "--rd-surface-2",
    "--rd-surface-hi",
    "--rd-line",
    "--rd-line-strong",
    "--rd-line-focus",
    "--rd-ink",
    "--rd-ink-2",
    "--rd-muted",
    "--rd-muted-soft",
    "--rd-gold",
    "--rd-gold-hi",
    "--rd-gold-lo",
    "--rd-gold-soft",
    "--rd-gold-softer",
    "--rd-ok",
    "--rd-ok-soft",
    "--rd-warn",
    "--rd-warn-soft",
    "--rd-off",
    "--rd-off-soft",
    "--rd-danger",
    "--rd-danger-soft",
  ];

  function closePopover() {
    if (currentPopover) {
      currentPopover.remove();
      currentPopover = null;
    }
  }

  function applyThemeVars(pop, sourceRoot) {
    if (!sourceRoot) return;
    pop.classList.add("rd-popover--redesign");
    pop.dataset.rdTheme = String(sourceRoot.getAttribute("data-rd-theme") || "").trim().toLowerCase();
    const computed = window.getComputedStyle(sourceRoot);
    THEME_VARS.forEach((name) => {
      const value = computed.getPropertyValue(name);
      if (value) pop.style.setProperty(name, value.trim());
    });
  }

  function buildPopover(items, sourceRoot) {
    const pop = document.createElement("div");
    pop.className = "rd-popover";
    pop.setAttribute("role", "menu");
    applyThemeVars(pop, sourceRoot);
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
      b.setAttribute("role", "menuitem");
      if (item.danger) b.classList.add("is-danger");
      if (item.disabled) b.disabled = true;
      b.innerHTML = `<span style="width:14px;display:inline-flex;justify-content:center;">${item.icon || ""}</span><span>${item.label}</span>`;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        closePopover();
        try { item.onSelect?.(); } catch (err) { console.error(err); }
      });
      pop.appendChild(b);
    });
    return pop;
  }

  function buildColumnMenuItems(label, callbacks) {
    return [
      { hint: `Spalte: ${label}` },
      { icon: "↑", label: "Aufsteigend sortieren", onSelect: callbacks.sortAsc },
      { icon: "↓", label: "Absteigend sortieren", onSelect: callbacks.sortDesc },
      "---",
      { icon: "⊘", label: "Spalte ausblenden", onSelect: callbacks.hide },
      { icon: "↔", label: "Breite zurücksetzen", onSelect: callbacks.resetWidth },
    ];
  }

  function positionPopover(pop, anchor, align = "left") {
    document.body.appendChild(pop);
    const rect = anchor.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    const gutter = 12;
    const anchorGap = 4;
    let left = align === "right" ? rect.right - popRect.width : rect.left;
    let top = rect.bottom + anchorGap;
    let verticalOrigin = "top";
    let horizontalOrigin = align === "right" ? "right" : "left";

    if (top + popRect.height > window.innerHeight - gutter) {
      top = rect.top - popRect.height - anchorGap;
      verticalOrigin = "bottom";
    }

    if (left < gutter) {
      left = gutter;
      horizontalOrigin = "left";
    } else if (left + popRect.width > window.innerWidth - gutter) {
      left = window.innerWidth - popRect.width - gutter;
      horizontalOrigin = "right";
    }

    pop.dataset.align = align;
    pop.style.transformOrigin = `${horizontalOrigin} ${verticalOrigin}`;
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }

  function positionPopoverAtPoint(pop, x, y) {
    document.body.appendChild(pop);
    const popRect = pop.getBoundingClientRect();
    const gutter = 12;
    const pointGap = 2;
    let left = x + pointGap;
    let top = y + pointGap;
    let verticalOrigin = "top";
    let horizontalOrigin = "left";

    if (left + popRect.width > window.innerWidth - gutter) {
      left = x - popRect.width - pointGap;
      horizontalOrigin = "right";
    }
    if (top + popRect.height > window.innerHeight - gutter) {
      top = y - popRect.height - pointGap;
      verticalOrigin = "bottom";
    }

    if (left < gutter) {
      left = gutter;
      horizontalOrigin = "left";
    }
    if (top < gutter) {
      top = gutter;
      verticalOrigin = "top";
    }

    pop.style.transformOrigin = `${horizontalOrigin} ${verticalOrigin}`;
    pop.style.left = Math.max(gutter, left) + "px";
    pop.style.top = Math.max(gutter, top) + "px";
  }

  document.addEventListener("click", (e) => {
    if (!currentPopover) return;
    if (currentPopover.contains(e.target)) return;
    closePopover();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePopover();
  });

  // ── Öffentliche Popover-API ──────────────────────────────────────────────
  window.RdPopover = {
    close: closePopover,

    open(anchor, items, align = "left") {
      closePopover();
      const pop = buildPopover(items, anchor?.closest?.(".is-redesign") || null);
      positionPopover(pop, anchor, align);
      currentPopover = pop;
    },

    openAtPoint(x, y, items, sourceRoot = null) {
      closePopover();
      const pop = buildPopover(items, sourceRoot);
      positionPopoverAtPoint(pop, x, y);
      currentPopover = pop;
    },

    openColumnMenu(anchor, key, label, callbacks) {
      this.open(anchor, buildColumnMenuItems(label, callbacks), "left");
    },

    openColumnMenuAtPoint(x, y, key, label, callbacks, sourceRoot = null) {
      this.openAtPoint(x, y, buildColumnMenuItems(label, callbacks), sourceRoot);
    },

    openRowMenu(anchor, rowId, callbacks) {
      const items = [
        { icon: "✎", label: "Bearbeiten", onSelect: callbacks.onEdit },
      ];
      if (callbacks.onDuplicate) {
        items.push({ icon: "⎘", label: "Duplizieren", onSelect: callbacks.onDuplicate });
      }
      if (callbacks.onDelete) {
        items.push("---");
        items.push({ icon: "🗑", label: "Löschen", danger: true, onSelect: () => {
          if (!confirm("Zeile wirklich löschen?")) return;
          callbacks.onDelete();
        }});
      }
      this.open(anchor, items, "right");
    },

    openRowContextMenu(x, y, rowId, callbacks, sourceRoot = null) {
      const items = [
        { icon: "✎", label: "Bearbeiten", onSelect: callbacks.onEdit },
      ];
      if (callbacks.onDuplicate) {
        items.push({ icon: "⎘", label: "Duplizieren", onSelect: callbacks.onDuplicate });
      }
      if (callbacks.onDelete) {
        items.push("---");
        items.push({ icon: "🗑", label: "Löschen", danger: true, onSelect: () => {
          if (!confirm("Zeile wirklich löschen?")) return;
          callbacks.onDelete();
        }});
      }
      this.openAtPoint(x, y, items, sourceRoot);
    },
  };

  // ── Öffentliche Toggle-Funktion, vom HTML-Schalter aufgerufen ───────────
  window.toggleRedesign = function (enabled) {
    const root = document.querySelector(".fcp-table-root");
    document.documentElement.toggleAttribute("data-rd-on", !!enabled);
    if (!enabled) closePopover();
    if (root?._fcpApi?.setRedesign) {
      root._fcpApi.setRedesign(!!enabled);
    } else {
      root?.classList.toggle("is-redesign", !!enabled);
    }
  };
})();
