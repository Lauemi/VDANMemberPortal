;(() => {
  let reloadingForSw = false;
  const UPDATE_NOTIFY_KEY = "vdan_notify_app_update_v1";

  function updateNotifyEnabled() {
    try {
      return String(localStorage.getItem(UPDATE_NOTIFY_KEY) || "1").trim() !== "0";
    } catch {
      return true;
    }
  }

  async function notifyUpdateAvailable(reg) {
    if (!updateNotifyEnabled()) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    try {
      if (reg?.showNotification) {
        await reg.showNotification("VDAN APP", {
          body: "Neue Version verfügbar. Die App wird aktualisiert.",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: "vdan-app-update",
          renotify: true,
        });
        return;
      }
      new Notification("VDAN APP", {
        body: "Neue Version verfügbar. Die App wird aktualisiert.",
        icon: "/icon-192.png",
        tag: "vdan-app-update",
      });
    } catch {
      // ignore notification issues
    }
  }

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
        notifyUpdateAvailable(reg).catch(() => {});
        reg.waiting.postMessage("SKIP_WAITING");
      }
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            notifyUpdateAvailable(reg).catch(() => {});
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
