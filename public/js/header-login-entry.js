;(() => {
  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  function nextTarget() {
    const current = `${window.location.pathname || "/"}${window.location.search || ""}`;
    if (current.startsWith("/login/")) return "/app/";
    return current.startsWith("/") ? current : "/app/";
  }

  function show(el, visible) {
    if (!el) return;
    el.classList.toggle("hidden", !visible);
    if (visible) el.removeAttribute("hidden");
    else el.setAttribute("hidden", "");
  }

  function setLoginMessage(text = "", danger = false) {
    const msg = document.getElementById("headerQuickLoginMsg");
    if (!msg) return;
    msg.textContent = text;
    msg.style.color = danger ? "var(--danger)" : "";
  }

  function closePopover() {
    const toggle = document.getElementById("headerLoginEntryToggle");
    const popover = document.getElementById("headerLoginEntryPopover");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    show(popover, false);
  }

  function updateToggle() {
    const toggle = document.getElementById("headerLoginEntryToggle");
    if (!toggle) return;
    if (session()?.user?.id) {
      toggle.textContent = "Portal";
      toggle.setAttribute("aria-label", "Portal öffnen");
      return;
    }
    toggle.textContent = "Login";
    toggle.setAttribute("aria-label", "Login öffnen");
  }

  async function submitQuickLogin(event) {
    event.preventDefault();
    if (session()?.user?.id) {
      window.location.assign("/app/");
      return;
    }
    const identifier = String(document.getElementById("headerQuickLoginIdentifier")?.value || "").trim();
    const password = String(document.getElementById("headerQuickLoginPassword")?.value || "");
    if (!identifier || !password) {
      setLoginMessage("Bitte Zugangsdaten eingeben.", true);
      return;
    }
    setLoginMessage("Login läuft ...");
    try {
      const auth = window.VDAN_AUTH;
      const sessionData = await auth?.loginWithPassword?.(identifier, password);
      await auth?.ensureProfileBootstrap?.(sessionData?.access_token || "", {
        preferred_member_no: identifier.includes("@") ? "" : identifier,
      });
      await auth?.claimPendingInviteIfPresent?.(sessionData?.access_token || "");
      document.dispatchEvent(new CustomEvent("vdan:session", { detail: { loggedIn: true } }));
      setLoginMessage("Login erfolgreich.");
      window.location.assign(nextTarget());
    } catch (err) {
      setLoginMessage(err?.message || "Login fehlgeschlagen.", true);
    }
  }

  function init() {
    const wrap = document.getElementById("headerLoginEntryWrap");
    const toggle = document.getElementById("headerLoginEntryToggle");
    const popover = document.getElementById("headerLoginEntryPopover");
    const form = document.getElementById("headerQuickLoginForm");
    if (!wrap || !toggle || !popover || !form) return;

    updateToggle();

    toggle.addEventListener("click", () => {
      if (session()?.user?.id) {
        window.location.assign("/app/");
        return;
      }
      const next = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", next ? "true" : "false");
      show(popover, next);
      if (next) {
        document.getElementById("headerQuickLoginIdentifier")?.focus?.();
      }
    });

    form.addEventListener("submit", submitQuickLogin);

    document.addEventListener("click", (event) => {
      if (!wrap.contains(event.target)) closePopover();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closePopover();
    });

    document.addEventListener("vdan:session", () => {
      updateToggle();
      closePopover();
    });
    window.addEventListener("storage", updateToggle);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
