;(() => {
  const FLAG = "vdan_runtime_recover_count_v1";
  const MAX_RECOVERY = 2;
  let recovering = false;

  function count() {
    try {
      return Number(sessionStorage.getItem(FLAG) || "0") || 0;
    } catch {
      return 0;
    }
  }

  function inc() {
    const next = count() + 1;
    try {
      sessionStorage.setItem(FLAG, String(next));
    } catch {
      // ignore
    }
    return next;
  }

  async function clearRuntimeCaches() {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
      }
    } catch {
      // ignore
    }
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
      }
    } catch {
      // ignore
    }
  }

  async function recoverAndReload(reason) {
    if (recovering) return;
    recovering = true;
    const n = inc();
    if (n > MAX_RECOVERY) return;
    console.warn("[runtime-guard] recovering after script load failure:", reason);
    await clearRuntimeCaches();
    const u = new URL(window.location.href);
    u.searchParams.set("vdan_refresh", String(Date.now()));
    window.location.replace(u.toString());
  }

  window.addEventListener("error", (event) => {
    const t = event?.target;
    if (!(t instanceof HTMLScriptElement)) return;
    const src = String(t.src || "");
    if (!src) return;
    let u;
    try {
      u = new URL(src, window.location.href);
    } catch {
      return;
    }
    if (u.origin !== window.location.origin) return;
    if (!u.pathname.startsWith("/js/")) return;
    recoverAndReload(`${u.pathname} failed`);
  }, true);
})();

