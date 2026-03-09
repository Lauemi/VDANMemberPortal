;(() => {
  const CONSENT_KEY = "vdan_cookie_consent_v1";
  const CONSENT_CATEGORY = "external_media";
  const SHOP_HOST = "https://vdan-vereisnshop.myspreadshop.de";
  const SHOP_SCRIPT_ID = "vdanSpreadshopClientScript";
  const SHOP_SCRIPT_SRC = `${SHOP_HOST}/shopfiles/shopclient/shopclient.nocache.js`;
  const ROOT_ID = "myShop";
  let shopMounted = false;

  window.spread_shop_config = {
    shopName: "vdan-vereisnshop",
    locale: "de_DE",
    prefix: SHOP_HOST,
    baseId: ROOT_ID,
  };

  function readConsentFallback() {
    try {
      const raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Boolean(parsed?.[CONSENT_CATEGORY]);
    } catch {
      return false;
    }
  }

  function hasConsent() {
    if (window.VDAN_CONSENT?.has) {
      return Boolean(window.VDAN_CONSENT.has(CONSENT_CATEGORY));
    }
    return readConsentFallback();
  }

  function renderBlocked(root) {
    root.innerHTML = `
      <div class="card__body external-media-lock">
        <p class="small"><strong>Shop-Einbettung ist deaktiviert.</strong></p>
        <p class="small">Für die Anzeige des eingebetteten Shops bitte „Externe Medien & Karten“ freigeben.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">
          <button type="button" class="feed-btn feed-btn--ghost" data-open-consent-settings>Datenschutz-Einstellungen</button>
          <a class="feed-btn" href="${SHOP_HOST}" target="_blank" rel="noopener noreferrer">Shop extern öffnen</a>
        </div>
      </div>
    `;
  }

  function renderLoading(root) {
    root.innerHTML = `
      <div class="card__body">
        <p class="small">Shop wird geladen…</p>
      </div>
    `;
  }

  function ensureShopScript() {
    return new Promise((resolve, reject) => {
      if (document.getElementById(SHOP_SCRIPT_ID)) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.id = SHOP_SCRIPT_ID;
      script.src = SHOP_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Spreadshop script could not be loaded"));
      document.head.appendChild(script);
    });
  }

  async function mountShop(root) {
    if (shopMounted) return;
    renderLoading(root);
    try {
      await ensureShopScript();
      shopMounted = true;
    } catch {
      root.innerHTML = `
        <div class="card__body">
          <p class="small">Shop konnte nicht geladen werden.</p>
          <p class="small"><a href="${SHOP_HOST}" target="_blank" rel="noopener noreferrer">Shop extern öffnen</a></p>
        </div>
      `;
    }
  }

  function applyConsentState() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    if (!hasConsent()) {
      shopMounted = false;
      renderBlocked(root);
      return;
    }
    mountShop(root);
  }

  document.addEventListener("vdan:consent-changed", applyConsentState);
  document.addEventListener("DOMContentLoaded", applyConsentState);
})();
