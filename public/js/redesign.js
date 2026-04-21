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

  function closePopover() {
    if (currentPopover) {
      currentPopover.remove();
      currentPopover = null;
    }
  }

  function buildPopover(items) {
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

  function positionPopover(pop, anchor, align = "right") {
    document.body.appendChild(pop);
    const rect = anchor.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    let left = align === "right" ? rect.right - popRect.width : rect.left;
    let top = rect.bottom + 4;
    if (top + popRect.height > window.innerHeight - 8) top = rect.top - popRect.height - 4;
    left = Math.max(8, Math.min(left, window.innerWidth - popRect.width - 8));
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }

  function positionPopoverAtPoint(pop, x, y) {
    document.body.appendChild(pop);
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

  // ── Öffentliche Popover-API ──────────────────────────────────────────────
  window.RdPopover = {
    close: closePopover,

    open(anchor, items, align = "right") {
      closePopover();
      const pop = buildPopover(items);
      positionPopover(pop, anchor, align);
      currentPopover = pop;
    },

    openAtPoint(x, y, items) {
      closePopover();
      const pop = buildPopover(items);
      positionPopoverAtPoint(pop, x, y);
      currentPopover = pop;
    },

    openColumnMenu(anchor, key, label, callbacks) {
      this.open(anchor, [
        { hint: `Spalte: ${label}` },
        { icon: "↑", label: "Aufsteigend sortieren", onSelect: callbacks.sortAsc },
        { icon: "↓", label: "Absteigend sortieren", onSelect: callbacks.sortDesc },
        "---",
        { icon: "⊘", label: "Spalte ausblenden", onSelect: callbacks.hide },
        { icon: "↔", label: "Breite zurücksetzen", onSelect: callbacks.resetWidth },
      ], "right");
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

    openRowContextMenu(x, y, rowId, callbacks) {
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
      this.openAtPoint(x, y, items);
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
