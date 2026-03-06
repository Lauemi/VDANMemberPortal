;(() => {
  const DIALOG_SELECTOR = "dialog.catch-dialog, .catch-dialog[data-guard-sheet=\"1\"]";
  const BODY_CLASS = "vdan-dialog-open";
  const DRAFT_PREFIX = "vdan_dialog_draft_v1";
  const SHEET_ID = "vdanDraftDecisionSheet";
  let sheetRoot = null;
  let sheetResolver = null;

  function keyFor(dialog) {
    const id = String(dialog?.id || "global").trim() || "global";
    return `${DRAFT_PREFIX}:${window.location.pathname}:${id}`;
  }

  function getForm(dialog) {
    return dialog?.querySelector?.("form") || null;
  }

  function isNativeDialog(el) {
    return typeof HTMLDialogElement !== "undefined" && el instanceof HTMLDialogElement;
  }

  function isOpen(el) {
    if (!el) return false;
    if (isNativeDialog(el)) return Boolean(el.open);
    return !el.hasAttribute("hidden");
  }

  function shouldSkipField(el) {
    if (!el) return true;
    if (el.disabled) return true;
    const tag = String(el.tagName || "").toLowerCase();
    if (!tag) return true;
    if (!["input", "textarea", "select"].includes(tag)) return true;
    const type = String(el.type || "").toLowerCase();
    return ["submit", "button", "reset", "file", "image"].includes(type);
  }

  function fieldKey(el) {
    return String(el.name || el.id || "").trim();
  }

  function serializeForm(form) {
    const out = {};
    const fields = form ? [...form.querySelectorAll("input, textarea, select")] : [];
    fields.forEach((el) => {
      if (shouldSkipField(el)) return;
      const key = fieldKey(el);
      if (!key) return;

      if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
        out[key] = Boolean(el.checked);
        return;
      }

      if (el instanceof HTMLSelectElement && el.multiple) {
        out[key] = [...el.selectedOptions].map((o) => o.value);
        return;
      }

      out[key] = String(el.value ?? "");
    });
    return out;
  }

  function restoreForm(form, data) {
    if (!form || !data || typeof data !== "object") return;
    const fields = [...form.querySelectorAll("input, textarea, select")];
    fields.forEach((el) => {
      if (shouldSkipField(el)) return;
      const key = fieldKey(el);
      if (!key || !(key in data)) return;
      const value = data[key];

      if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
        el.checked = Boolean(value);
      } else if (el instanceof HTMLSelectElement && el.multiple && Array.isArray(value)) {
        [...el.options].forEach((opt) => {
          opt.selected = value.includes(opt.value);
        });
      } else {
        el.value = String(value ?? "");
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  function readDraft(dialog) {
    try {
      const raw = localStorage.getItem(keyFor(dialog));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function writeDraft(dialog) {
    const form = getForm(dialog);
    if (!form) return;
    try {
      const payload = {
        saved_at: new Date().toISOString(),
        values: serializeForm(form),
      };
      localStorage.setItem(keyFor(dialog), JSON.stringify(payload));
    } catch {
      // ignore storage failures
    }
  }

  function clearDraft(dialog) {
    try {
      localStorage.removeItem(keyFor(dialog));
    } catch {
      // ignore storage failures
    }
  }

  function isDirty(form) {
    if (!form) return false;
    const fields = [...form.querySelectorAll("input, textarea, select")];
    return fields.some((el) => {
      if (shouldSkipField(el)) return false;

      if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
        return el.checked !== el.defaultChecked;
      }

      if (el instanceof HTMLSelectElement && el.multiple) {
        return [...el.options].some((opt) => opt.selected !== opt.defaultSelected);
      }

      return String(el.value ?? "") !== String(el.defaultValue ?? "");
    });
  }

  function ensureSheet() {
    if (sheetRoot) return sheetRoot;
    if (!document.getElementById("vdan-dialog-guard-style")) {
      const style = document.createElement("style");
      style.id = "vdan-dialog-guard-style";
      style.textContent = `
        #${SHEET_ID}[hidden]{display:none !important}
        #${SHEET_ID}{
          position:fixed; inset:0; z-index:4000;
          display:grid; place-items:end center;
          background:rgba(8,12,20,.42); backdrop-filter:blur(3px);
          padding:16px;
        }
        #${SHEET_ID} .sheet{
          width:min(100%, 460px);
          border:1px solid rgba(220,228,241,.24);
          border-radius:14px;
          background:linear-gradient(180deg, rgba(23,31,47,.98), rgba(14,20,32,.98));
          box-shadow:0 16px 32px rgba(0,0,0,.4);
          padding:14px;
          color:#e8eaf0;
          display:grid;
          gap:10px;
        }
        #${SHEET_ID} .actions{
          display:grid;
          grid-template-columns:1fr;
          gap:8px;
        }
        #${SHEET_ID} button{
          min-height:44px;
          border-radius:10px;
          border:1px solid rgba(220,228,241,.24);
          background:rgba(255,255,255,.04);
          color:#e8eaf0;
          font:inherit;
          cursor:pointer;
        }
      `;
      document.head.appendChild(style);
    }
    const root = document.createElement("div");
    root.id = SHEET_ID;
    root.hidden = true;
    root.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Ungespeicherte Eingaben">
        <h3 style="margin:0;">Ungespeicherte Eingaben</h3>
        <p class="small" style="margin:0;">Was soll mit deinem Entwurf passieren?</p>
        <div class="actions">
          <button type="button" data-action="keep">Entwurf behalten</button>
          <button type="button" data-action="discard">Verwerfen</button>
          <button type="button" data-action="continue">Weiter bearbeiten</button>
        </div>
      </div>
    `;
    root.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target === root) {
        resolveSheet("continue");
        return;
      }
      const action = target.getAttribute("data-action");
      if (!action) return;
      resolveSheet(action);
    });
    document.body.appendChild(root);
    sheetRoot = root;
    return sheetRoot;
  }

  function resolveSheet(action) {
    const resolver = sheetResolver;
    sheetResolver = null;
    if (sheetRoot) sheetRoot.hidden = true;
    if (resolver) resolver(action);
    applyScrollLock();
  }

  function hideSheet() {
    if (!sheetRoot) return;
    sheetRoot.hidden = true;
    if (sheetResolver) {
      const resolver = sheetResolver;
      sheetResolver = null;
      resolver("continue");
    }
  }

  function askCloseAction() {
    const root = ensureSheet();
    root.hidden = false;
    applyScrollLock();
    const preferred = root.querySelector('[data-action="keep"]');
    if (preferred instanceof HTMLElement) preferred.focus();
    return new Promise((resolve) => {
      sheetResolver = resolve;
    });
  }

  function applyScrollLock() {
    const hasOpenDialog = [...document.querySelectorAll(DIALOG_SELECTOR)].some((el) => isOpen(el));
    const hasSheet = Boolean(sheetRoot && !sheetRoot.hidden);
    const hasOpen = hasOpenDialog || hasSheet;
    document.documentElement.classList.toggle(BODY_CLASS, hasOpen);
    document.body.classList.toggle(BODY_CLASS, hasOpen);
  }

  function restoreDraftIfPresent(dialog) {
    const form = getForm(dialog);
    if (!form) return;
    const draft = readDraft(dialog);
    if (!draft?.values) return;
    restoreForm(form, draft.values);
  }

  function shouldBypassDraftGuard(dialog) {
    if (!(dialog instanceof HTMLElement)) return false;
    return dialog.dataset.guardNoDraft === "1" || dialog.id === "goFishingDialog";
  }

  async function requestClose(dialog) {
    if (shouldBypassDraftGuard(dialog)) {
      clearDraft(dialog);
      if (isNativeDialog(dialog)) {
        dialog.close();
      } else {
        dialog.setAttribute("hidden", "");
        dialog.classList.add("hidden");
        dialog.setAttribute("aria-hidden", "true");
      }
      return true;
    }
    const form = getForm(dialog);
    const dirty = isDirty(form);
    if (dirty) {
      const action = await askCloseAction();
      if (action === "continue") return false;
      if (action === "keep") {
        writeDraft(dialog);
      } else {
        clearDraft(dialog);
        form?.reset?.();
      }
    } else {
      clearDraft(dialog);
    }
    if (isNativeDialog(dialog)) {
      dialog.close();
    } else {
      dialog.setAttribute("hidden", "");
      dialog.classList.add("hidden");
      dialog.setAttribute("aria-hidden", "true");
    }
    return true;
  }

  function bindDialog(dialog) {
    if (!(dialog instanceof HTMLElement) || dialog.dataset.uxGuardBound === "1") return;
    dialog.dataset.uxGuardBound = "1";

    if (isNativeDialog(dialog)) {
      dialog.addEventListener("cancel", (e) => {
        e.preventDefault();
        void requestClose(dialog);
      });
      dialog.addEventListener("close", () => {
        hideSheet();
        applyScrollLock();
      });
    }

    dialog.addEventListener("click", (e) => {
      if (e.target !== dialog) return;
      void requestClose(dialog);
    });
  }

  function bindAll() {
    document.querySelectorAll(DIALOG_SELECTOR).forEach(bindDialog);
  }

  const mo = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      if (!(m.target instanceof HTMLElement)) return;
      if (!m.target.matches(DIALOG_SELECTOR)) return;
      if ((m.attributeName === "open" || m.attributeName === "hidden") && isOpen(m.target)) {
        restoreDraftIfPresent(m.target);
      }
    });
    applyScrollLock();
  });

  function init() {
    bindAll();
    mo.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["open", "hidden"],
    });
    applyScrollLock();
  }

  window.VDAN_DIALOG_GUARD = {
    requestClose,
    clearDraft,
    writeDraft,
    restoreDraft: restoreDraftIfPresent,
  };

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", bindAll);
})();
