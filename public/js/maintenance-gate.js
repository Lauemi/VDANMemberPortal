;(() => {
  const KEY = "vdan_maintenance_ok";
  const PASSWORD = "VDAN";

  function render() {
    const wrap = document.createElement("div");
    wrap.className = "maintenance-gate";
    wrap.innerHTML = `
      <div class="maintenance-gate__box">
        <h2>Seite in Bearbeitung</h2>
        <p class="small">Aktuell wird die Seite überarbeitet. Bitte Passwort eingeben.</p>
        <form class="maintenance-gate__form">
          <input type="password" placeholder="Passwort" autocomplete="off" />
          <button type="submit" class="feed-btn">Öffnen</button>
        </form>
        <p class="small maintenance-gate__hint">Passwort: VDAN</p>
        <p class="small maintenance-gate__error" aria-live="polite"></p>
      </div>
    `;

    const form = wrap.querySelector("form");
    const input = wrap.querySelector("input");
    const error = wrap.querySelector(".maintenance-gate__error");
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const value = String(input?.value || "").trim();
      if (value === PASSWORD) {
        try {
          sessionStorage.setItem(KEY, "1");
        } catch {}
        wrap.remove();
        return;
      }
      if (error) error.textContent = "Passwort ist falsch.";
      if (input) input.value = "";
    });

    document.body.appendChild(wrap);
    input?.focus();
  }

  function init() {
    try {
      if (sessionStorage.getItem(KEY) === "1") return;
    } catch {}
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
