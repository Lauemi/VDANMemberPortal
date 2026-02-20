;(() => {
  function onReady(fn){ if (document.readyState !== "loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }

  onReady(() => {
    const { VDAN_AUTH } = window;
    if (!VDAN_AUTH?.loadSession) return;

    const session = VDAN_AUTH.loadSession();
    if (!session) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login/?next=${next}`);
    }
  });
})();
