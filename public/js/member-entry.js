;(() => {
  function getSession() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  function render(entry, loggedIn) {
    entry.innerHTML = loggedIn
      ? '<a class="member-entry__btn" href="/app/">Mitgliederbereich</a><button class="member-entry__btn member-entry__btn--ghost" type="button" data-member-logout>Logout</button>'
      : '<a class="member-entry__btn" href="/login/">Login</a>';

    const logoutBtn = entry.querySelector("[data-member-logout]");
    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", async () => {
      try {
        await window.VDAN_AUTH?.logout?.();
      } finally {
        document.dispatchEvent(new CustomEvent("vdan:session", { detail: { loggedIn: false } }));
        window.location.assign("/");
      }
    });
  }

  function mount() {
    const topNav = document.querySelector(".top-nav");
    if (!topNav || topNav.querySelector(".member-entry")) return;

    const entry = document.createElement("div");
    entry.className = "member-entry";
    topNav.appendChild(entry);

    render(entry, Boolean(getSession()));
    document.addEventListener("vdan:session", (e) => render(entry, Boolean(e.detail?.loggedIn)));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
