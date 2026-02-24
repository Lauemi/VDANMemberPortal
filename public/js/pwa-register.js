;(() => {
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
    } catch {
      // keep app usable without SW
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateNetBadge();
    registerSw().catch(() => {});
  });

  window.addEventListener("online", updateNetBadge);
  window.addEventListener("offline", updateNetBadge);
})();
