;(() => {
  const RUNTIME_KEY = "vdan_component_runtime_v1";

  function applyButtonVars(buttons) {
    if (!buttons || typeof buttons !== "object") return;
    const root = document.documentElement;
    const set = (name, value) => {
      const v = String(value || "").trim();
      if (!v) return;
      root.style.setProperty(name, v);
    };
    set("--lib-btn-height", buttons.height);
    set("--lib-btn-pad-x", buttons.padding_x);
    set("--lib-btn-radius", buttons.radius);
    set("--lib-btn-font-size", buttons.font_size);
    set("--lib-btn-font-weight", buttons.font_weight);
  }

  function loadAndApply() {
    try {
      const raw = localStorage.getItem(RUNTIME_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      applyButtonVars(parsed?.buttons);
    } catch {
      // ignore invalid payload
    }
  }

  loadAndApply();
})();
