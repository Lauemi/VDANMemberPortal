"use strict";

;(() => {
  function parseConfig(scriptId) {
    const node = document.getElementById(String(scriptId || "").trim());
    if (!node) {
      throw new Error(`Mask config script "${scriptId}" wurde nicht gefunden.`);
    }
    return JSON.parse(node.textContent || "{}");
  }

  async function boot(options = {}) {
    const config = parseConfig(options.configScriptId);
    const onMessage = typeof options.onMessage === "function" ? options.onMessage : () => {};
    const onReady = typeof options.onReady === "function" ? options.onReady : null;
    const processState = options.processState || window.FcpMaskProcessState || null;
    const patternGlobal = String(options.patternGlobal || "").trim();
    const patternOverrides = options.patternOverrides && typeof options.patternOverrides === "object"
      ? options.patternOverrides
      : {};
    const rendererFamily = String(options.rendererFamily || config.maskFamily || "QFM").trim().toUpperCase();

    const createRenderer = rendererFamily === "ADM"
      ? window.AdminPanelMask?.create
      : window.QuickFlowPattern?.create;

    if (typeof createRenderer !== "function") {
      throw new Error(
        rendererFamily === "ADM"
          ? "AdminPanelMask Renderer wurde nicht geladen."
          : "QuickFlowPattern Renderer wurde nicht geladen."
      );
    }
    if (!window.FcpMaskDataResolver || typeof window.FcpMaskDataResolver.create !== "function") {
      throw new Error("FcpMaskDataResolver wurde nicht geladen.");
    }

    const resolver = window.FcpMaskDataResolver.create({
      onMessage,
      processState,
    });
    const hydratedConfig = resolver.enhanceConfig(config);

    const pattern = createRenderer({
      ...hydratedConfig,
      autoLoadPanelOnOpen: true,
      save: async (payload, ctx) => resolver.savePanel(payload, ctx),
      ...patternOverrides,
    });

    if (patternGlobal) {
      window[patternGlobal] = pattern;
    }

    await pattern.init();
    await resolver.hydrateVisiblePanels(pattern);

    if (onReady) {
      await onReady({
        config,
        hydratedConfig,
        pattern,
        resolver,
      });
    }

    return {
      config,
      hydratedConfig,
      pattern,
      resolver,
    };
  }

  window.FcpMaskPageLoader = Object.freeze({
    boot,
  });
})();
