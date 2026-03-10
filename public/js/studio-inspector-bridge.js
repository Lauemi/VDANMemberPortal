;(() => {
  const state = {
    active: false,
    hoverEl: null,
    selectedEl: null,
    lastHoverAt: 0,
    onMove: null,
    onClick: null,
  };

  function ensureStyle() {
    if (document.getElementById("studioInspectorBridgeStyle")) return;
    const style = document.createElement("style");
    style.id = "studioInspectorBridgeStyle";
    style.textContent = `
      .studio-inspector-hover {
        outline: 2px dashed #7ec8ff !important;
        outline-offset: -1px !important;
        box-shadow: 0 0 0 2px rgba(126, 200, 255, .22) inset !important;
      }
      .studio-inspector-selected {
        outline: 3px solid #ffc830 !important;
        outline-offset: -1px !important;
        box-shadow: 0 0 0 3px rgba(255, 200, 48, .25) inset !important;
      }
    `;
    document.head?.appendChild(style);
  }

  function annotateTargets() {
    const selectors = [
      "header",
      "main",
      "footer",
      ".card",
      ".feed-btn",
      ".catch-table",
      ".catch-table__row",
      ".portal-quick-toggle",
      ".burger-toggle",
      "button",
      "a",
      "input",
      "select",
      "textarea",
      '[role="button"]',
      "section",
      "article",
      "nav",
      "aside",
    ];
    const nodes = document.querySelectorAll(selectors.join(","));
    let idx = 0;
    nodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (!node.hasAttribute("data-component-id")) {
        const base =
          String(node.id || "").trim() ||
          [...node.classList].slice(0, 2).join("-") ||
          node.tagName.toLowerCase();
        node.setAttribute("data-component-id", `auto-${base || "node"}-${idx}`);
        idx += 1;
      }
      if (!node.hasAttribute("data-studio-component-id")) {
        node.setAttribute("data-studio-component-id", String(node.getAttribute("data-component-id") || ""));
      }
    });
  }

  function resolveTarget(raw) {
    if (!(raw instanceof Element)) return null;
    const target = raw.closest(
      [
        "[data-studio-component-id]",
        "[data-component-id]",
        "button",
        "a",
        "input",
        "select",
        "textarea",
        '[role="button"]',
        ".catch-table__row",
        ".catch-table",
        ".card",
        ".feed-btn",
        "section",
        "article",
        "header",
        "main",
        "footer",
        "nav",
        "aside",
      ].join(","),
    );
    if (!(target instanceof Element)) return null;
    const tag = target.tagName.toLowerCase();
    if (tag === "html" || tag === "body") return null;
    return target;
  }

  function elementSelector(el) {
    if (!(el instanceof Element)) return "unknown";
    const debugClasses = new Set(["studio-inspector-hover", "studio-inspector-selected", "debug", "temp"]);
    const id = String(el.id || "").trim();
    if (id) return `#${id}`;
    const cls = [...el.classList]
      .filter((name) => !debugClasses.has(name))
      .slice(0, 2)
      .join(".");
    if (cls) return `${el.tagName.toLowerCase()}.${cls}`;
    const explicitId = String(el.getAttribute("data-studio-component-id") || "").trim();
    if (explicitId) return `[data-studio-component-id="${explicitId}"]`;
    return el.tagName.toLowerCase();
  }

  function nodePath(el) {
    if (!(el instanceof Element)) return "-";
    const parts = [];
    let current = el;
    let guard = 0;
    while (current && current.nodeType === Node.ELEMENT_NODE && guard < 10) {
      const tag = current.tagName.toLowerCase();
      const id = String(current.id || "").trim();
      if (id) {
        parts.unshift(`${tag}#${id}`);
        break;
      }
      const parent = current.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const sameTag = [...parent.children].filter((child) => child.tagName === current.tagName);
      const idx = Math.max(1, sameTag.indexOf(current) + 1);
      parts.unshift(`${tag}:nth-of-type(${idx})`);
      current = parent;
      guard += 1;
    }
    return parts.join(" > ") || "-";
  }

  function areaOf(el) {
    if (!(el instanceof Element)) return "Root";
    if (el.closest("header, .header")) return "Header";
    if (el.closest("main, .main")) return "Main";
    if (el.closest("footer, .site-footer")) return "Footer";
    return "Content";
  }

  function titleOf(el) {
    if (!(el instanceof Element)) return "Unbekannt";
    const aria = String(el.getAttribute("aria-label") || "").trim();
    if (aria) return aria;
    const txt = String(el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (txt) return txt;
    return elementSelector(el);
  }

  function payloadFor(el) {
    const rect = el.getBoundingClientRect();
    return {
      mask_path: String(window.location.pathname || "/app/"),
      mask_url: String(window.location.href || ""),
      component_id:
        String(el.getAttribute("data-studio-component-id") || "").trim() ||
        String(el.getAttribute("data-component-id") || "").trim() ||
        "-",
      component_name: titleOf(el),
      component_type: String(el.getAttribute("data-studio-component-type") || "").trim() || el.tagName.toLowerCase(),
      slot: String(el.getAttribute("data-studio-slot") || "").trim() || areaOf(el).toLowerCase(),
      table_id: String(el.getAttribute("data-table-id") || "").trim() || "-",
      selector: elementSelector(el),
      node_path: nodePath(el),
      area: areaOf(el),
      tag: el.tagName.toLowerCase(),
      role: String(el.getAttribute("role") || "").trim() || "-",
      aria_label: String(el.getAttribute("aria-label") || "").trim() || "-",
      data_action: String(el.getAttribute("data-action") || "").trim() || "-",
      text_snippet: String(el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120) || "-",
      rect: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };
  }

  function clearHover() {
    if (state.hoverEl instanceof Element) state.hoverEl.classList.remove("studio-inspector-hover");
    state.hoverEl = null;
  }

  function clearSelection() {
    if (state.selectedEl instanceof Element) state.selectedEl.classList.remove("studio-inspector-selected");
    state.selectedEl = null;
  }

  function send(type, payload) {
    window.parent?.postMessage(
      {
        type,
        source: "studio-inspector-bridge",
        payload,
      },
      "*",
    );
  }

  function onHover(event) {
    if (!state.active) return;
    const now = Date.now();
    if (now - state.lastHoverAt < 40) return;
    state.lastHoverAt = now;
    const resolved = resolveTarget(event.target instanceof Element ? event.target : null);
    if (!(resolved instanceof Element)) return;
    if (state.selectedEl === resolved || state.hoverEl === resolved) return;
    clearHover();
    state.hoverEl = resolved;
    resolved.classList.add("studio-inspector-hover");
    send("STUDIO_COMPONENT_HOVER", payloadFor(resolved));
  }

  function onSelect(event) {
    if (!state.active) return;
    const resolved = resolveTarget(event.target instanceof Element ? event.target : null);
    if (!(resolved instanceof Element)) {
      send("STUDIO_COMPONENT_MISS", { reason: "no_target" });
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    clearHover();
    clearSelection();
    state.selectedEl = resolved;
    resolved.classList.add("studio-inspector-selected");
    send("STUDIO_COMPONENT_SELECTED", payloadFor(resolved));
  }

  function activate() {
    if (state.active) return;
    ensureStyle();
    annotateTargets();
    state.onMove = onHover;
    state.onClick = onSelect;
    document.addEventListener("mousemove", state.onMove, true);
    document.addEventListener("click", state.onClick, true);
    state.active = true;
    send("STUDIO_PICK_READY", { ok: true });
  }

  function deactivate() {
    if (!state.active) return;
    if (state.onMove) document.removeEventListener("mousemove", state.onMove, true);
    if (state.onClick) document.removeEventListener("click", state.onClick, true);
    state.onMove = null;
    state.onClick = null;
    clearHover();
    clearSelection();
    state.active = false;
    send("STUDIO_PICK_READY", { ok: false });
  }

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.type !== "STUDIO_PICK_MODE") return;
    if (data.active) activate();
    else deactivate();
  });
})();
