;(() => {
  function setNavState(loggedIn){
    document.querySelectorAll("[data-member-only]").forEach((el) => {
      el.classList.toggle("hidden", !loggedIn);
      el.toggleAttribute("hidden", !loggedIn);
    });
    document.querySelectorAll("[data-guest-only]").forEach((el) => {
      el.classList.toggle("hidden", loggedIn);
      el.toggleAttribute("hidden", loggedIn);
    });
  }

  function init(){
    const loggedIn = Boolean(window.VDAN_AUTH?.loadSession?.());
    setNavState(loggedIn);
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", (e) => setNavState(Boolean(e.detail?.loggedIn)));
})();
