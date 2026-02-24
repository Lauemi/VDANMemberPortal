;(() => {
  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.classList.toggle("hidden", hidden);
    el.toggleAttribute("hidden", hidden);
  }

  function accountNameFromSession(s) {
    const user = s?.user || {};
    const meta = user.user_metadata || {};
    return String(meta.display_name || meta.name || user.email || "Account").trim();
  }

  function bindAccountMenu() {
    const root = document.getElementById("accountMenu");
    const toggle = document.getElementById("accountToggle");
    const popover = document.getElementById("accountPopover");
    const label = document.getElementById("accountLabel");
    const loginLink = document.getElementById("accountLoginLink");
    const appLink = document.getElementById("accountAppLink");
    const settingsLink = document.getElementById("accountSettingsLink");
    const logoutBtn = document.getElementById("accountLogoutBtn");
    const avatar = root?.querySelector(".account-avatar");
    if (!root || !toggle || !popover || !label || !loginLink || !appLink || !logoutBtn || !avatar) return;

    const render = () => {
      const s = session();
      const loggedIn = Boolean(s);
      const name = loggedIn ? accountNameFromSession(s) : "Nicht eingeloggt";
      label.textContent = name;
      avatar.textContent = String(name).charAt(0).toUpperCase();
      setHidden(loginLink, loggedIn);
      setHidden(appLink, !loggedIn);
      if (settingsLink) setHidden(settingsLink, !loggedIn);
      setHidden(logoutBtn, !loggedIn);
    };

    const close = () => setHidden(popover, true);
    const open = () => setHidden(popover, false);

    toggle.addEventListener("click", () => {
      if (popover.hasAttribute("hidden")) open();
      else close();
    });

    document.addEventListener("click", (e) => {
      if (!root.contains(e.target)) close();
    });

    logoutBtn.addEventListener("click", async () => {
      try {
        await window.VDAN_AUTH?.logout?.();
      } finally {
        document.dispatchEvent(new CustomEvent("vdan:session", { detail: { loggedIn: false } }));
        render();
        close();
        window.location.assign("/");
      }
    });

    render();
    document.addEventListener("vdan:session", render);
  }

  document.addEventListener("DOMContentLoaded", bindAccountMenu);
})();
