;(() => {
  let reloadingForSw = false;

  function updateNetBadge() {
    const el = document.getElementById("netStatusBadge");
    if (!el) return;
    const offline = !navigator.onLine;
    el.classList.toggle("hidden", !offline);
    el.toggleAttribute("hidden", !offline);
  }

  async function registerSw() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      reg.update().catch(() => {});
      if (reg.waiting) {
        reg.waiting.postMessage("SKIP_WAITING");
      }
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            reg.waiting?.postMessage("SKIP_WAITING");
          }
        });
      });
    } catch {
      // keep app usable without SW
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateNetBadge();
    registerSw().catch(() => {});
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadingForSw) return;
      reloadingForSw = true;
      const u = new URL(window.location.href);
      u.searchParams.set("vdan_sw", String(Date.now()));
      window.location.replace(u.toString());
    });
  }

  window.addEventListener("online", updateNetBadge);
  window.addEventListener("offline", updateNetBadge);
})();
