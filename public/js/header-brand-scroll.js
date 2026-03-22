;(() => {
  function init() {
    const brand = document.querySelector(".header-brand-fcp");
    if (!brand) return;

    let rafId = 0;
    const maxScroll = 180;
    const maxLogoProgress = 0.561;

    const applyLogoProgress = () => {
      rafId = 0;
      const progress = Math.max(0, Math.min(window.scrollY / maxScroll, maxLogoProgress));
      brand.style.setProperty("--header-logo-progress", progress.toFixed(3));
    };

    const requestUpdate = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(applyLogoProgress);
    };

    applyLogoProgress();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
