;(() => {
  function setHidden(el, hidden) {
    if (!el) return;
    el.classList.toggle("hidden", hidden);
    el.toggleAttribute("hidden", hidden);
  }

  function init() {
    const root = document.getElementById("burgerMenu");
    const toggle = document.getElementById("burgerToggle");
    const popover = document.getElementById("burgerPopover");
    if (!root || !toggle || !popover) return;

    const close = () => setHidden(popover, true);
    const open = () => setHidden(popover, false);

    toggle.addEventListener("click", () => {
      if (popover.hasAttribute("hidden")) open();
      else close();
    });

    document.addEventListener("click", (e) => {
      if (!root.contains(e.target)) close();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
