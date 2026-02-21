;(() => {
  const KEY = "vdan_cookie_consent_v1";
  const DEFAULTS = {
    essential: true,
    external_media: false,
    updated_at: null,
  };

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return {
        essential: true,
        external_media: Boolean(parsed.external_media),
        updated_at: parsed.updated_at || null,
      };
    } catch {
      return null;
    }
  }

  function write(next) {
    const payload = {
      essential: true,
      external_media: Boolean(next?.external_media),
      updated_at: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
    return payload;
  }

  function hasConsent(category) {
    const c = read();
    if (!c) return false;
    if (category === "essential") return true;
    return Boolean(c[category]);
  }

  function applyDeferredEmbeds() {
    const all = document.querySelectorAll("[data-consent-src][data-consent-category]");
    all.forEach((el) => {
      const category = String(el.getAttribute("data-consent-category") || "").trim();
      const src = String(el.getAttribute("data-consent-src") || "").trim();
      const placeholder = el.previousElementSibling?.hasAttribute("data-consent-placeholder")
        ? el.previousElementSibling
        : null;
      if (!category || !src || !hasConsent(category)) {
        if (placeholder) placeholder.removeAttribute("hidden");
        return;
      }
      if (!el.getAttribute("src")) el.setAttribute("src", src);
      if (placeholder) placeholder.setAttribute("hidden", "");
    });
  }

  function notifyChanged() {
    document.dispatchEvent(new CustomEvent("vdan:consent-changed", {
      detail: {
        consent: read() || DEFAULTS,
      },
    }));
  }

  function apply() {
    const consent = read() || DEFAULTS;
    document.documentElement.setAttribute("data-consent-external-media", consent.external_media ? "1" : "0");
    applyDeferredEmbeds();
    notifyChanged();
  }

  function close(root) {
    root?.remove();
  }

  function renderSettingsDialog() {
    if (document.getElementById("consentSettingsModal")) return;
    const current = read() || DEFAULTS;
    const modal = document.createElement("div");
    modal.id = "consentSettingsModal";
    modal.className = "consent-modal hidden";
    modal.setAttribute("hidden", "");
    modal.innerHTML = `
      <div class="consent-modal__backdrop" data-consent-close></div>
      <div class="consent-modal__panel" role="dialog" aria-modal="true" aria-labelledby="consentSettingsTitle">
        <h2 id="consentSettingsTitle">Datenschutz-Einstellungen</h2>
        <p class="small">Du kannst festlegen, welche optionalen Funktionen geladen werden.</p>
        <div class="consent-item">
          <div>
            <strong>Technisch erforderlich</strong>
            <p class="small">Login-Status, Sicherheit und Grundfunktionen der Website.</p>
          </div>
          <label><input type="checkbox" checked disabled /> Aktiv</label>
        </div>
        <div class="consent-item">
          <div>
            <strong>Externe Medien & Karten</strong>
            <p class="small">Google Maps Embed, Leaflet/OSM-Kartenkacheln und externe QR-Bilddienste.</p>
          </div>
          <label><input id="consentExternalMedia" type="checkbox" ${current.external_media ? "checked" : ""} /> Aktivieren</label>
        </div>
        <div class="consent-actions">
          <button type="button" class="feed-btn feed-btn--ghost" data-consent-close>Abbrechen</button>
          <button type="button" class="feed-btn" id="consentSaveBtn">Speichern</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const hide = () => {
      modal.classList.add("hidden");
      modal.setAttribute("hidden", "");
    };
    const show = () => {
      modal.classList.remove("hidden");
      modal.removeAttribute("hidden");
    };

    modal.querySelectorAll("[data-consent-close]").forEach((el) => {
      el.addEventListener("click", hide);
    });

    const saveBtn = modal.querySelector("#consentSaveBtn");
    saveBtn?.addEventListener("click", () => {
      const ext = Boolean(modal.querySelector("#consentExternalMedia")?.checked);
      write({ external_media: ext });
      apply();
      hide();
    });

    window.VDAN_CONSENT.openSettings = show;
  }

  function renderBanner() {
    if (read()) return;
    if (document.getElementById("consentBanner")) return;
    const root = document.createElement("div");
    root.id = "consentBanner";
    root.className = "consent-banner";
    root.innerHTML = `
      <div class="consent-banner__text">
        <strong>Datenschutz-Hinweis</strong>
        <p class="small">
          Wir verwenden technisch notwendige Speicherfunktionen. Externe Karten-/Mediendienste werden nur mit deiner Einwilligung geladen.
          Details in <a href="/datenschutz.html/">Datenschutz</a>.
        </p>
      </div>
      <div class="consent-banner__actions">
        <button type="button" class="feed-btn feed-btn--ghost" id="consentOnlyEssentialBtn">Nur notwendige</button>
        <button type="button" class="feed-btn feed-btn--ghost" id="consentSettingsBtn">Einstellungen</button>
        <button type="button" class="feed-btn" id="consentAcceptAllBtn">Alle akzeptieren</button>
      </div>
    `;
    document.body.appendChild(root);

    const onlyEssential = root.querySelector("#consentOnlyEssentialBtn");
    const settings = root.querySelector("#consentSettingsBtn");
    const acceptAll = root.querySelector("#consentAcceptAllBtn");

    onlyEssential?.addEventListener("click", () => {
      write({ external_media: false });
      apply();
      close(root);
    });
    acceptAll?.addEventListener("click", () => {
      write({ external_media: true });
      apply();
      close(root);
    });
    settings?.addEventListener("click", () => {
      window.VDAN_CONSENT.openSettings();
    });
  }

  function bindSettingsButtons() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-open-consent-settings]");
      if (!btn) return;
      e.preventDefault();
      window.VDAN_CONSENT.openSettings();
    });
  }

  window.VDAN_CONSENT = {
    get() {
      return read() || { ...DEFAULTS };
    },
    has(category) {
      if (category === "essential") return true;
      return hasConsent(category);
    },
    set(consent) {
      const next = write(consent || {});
      apply();
      return next;
    },
    openSettings() {},
  };

  function init() {
    renderSettingsDialog();
    bindSettingsButtons();
    apply();
    renderBanner();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
