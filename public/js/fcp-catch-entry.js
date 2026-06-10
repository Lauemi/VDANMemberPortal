"use strict";

// FCP Catch Entry — Nacherfassung (Papierfanglisten digitalisieren)
// renderMode "catch-entry" in ADM_natur_gewaesser.json
// Einstiegspunkt: window.FcpCatchEntry.renderPanel(mask, section, panel, emptyText)

;(() => {
  // ── Supabase fetch utility (same pattern as fcp-mask-data-resolver.js)
  async function waitForAuth(ms) {
    const end = Date.now() + (ms || 3000);
    while (Date.now() < end) {
      if (window.VDAN_AUTH?.loadSession) return;
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  async function getToken() {
    await waitForAuth();
    const sess = window.VDAN_AUTH?.loadSession?.();
    const t = String(sess?.access_token || "").trim();
    if (t) return t;
    const ref = await window.VDAN_AUTH?.refreshSession?.().catch(() => null);
    return String(ref?.access_token || "").trim();
  }

  async function sbFetch(path, init) {
    const url = String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, "");
    const key = String(window.__APP_SUPABASE_KEY || "").trim();
    const token = await getToken();
    const headers = new Headers((init || {}).headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${url}${path}`, { ...init, headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(String(body?.message || body?.error || `HTTP ${res.status}`));
    }
    return res.json().catch(() => null);
  }

  function rpc(fn, params) {
    return sbFetch(`/rest/v1/rpc/${fn}`, {
      method: "POST",
      body: JSON.stringify(params || {}),
    });
  }

  async function resolveClubId() {
    const params = new URLSearchParams(window.location.search || "");
    const fromUrl = String(params.get("club_id") || "").trim();
    if (fromUrl) return fromUrl;
    await waitForAuth();
    const sess = window.VDAN_AUTH?.loadSession?.();
    const uid = String(sess?.user?.id || "").trim();
    if (!uid) return "";
    const rows = await sbFetch(
      `/rest/v1/profiles?select=club_id&id=eq.${encodeURIComponent(uid)}&limit=1`
    ).catch(() => []);
    return String((Array.isArray(rows) ? rows[0] : rows)?.club_id || "").trim();
  }

  // ── DOM helper
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === "cls") node.className = v;
        else if (k === "text") node.textContent = v;
        else node.setAttribute(k, v);
      }
    }
    if (children) {
      for (const c of (Array.isArray(children) ? children : [children])) {
        if (c != null) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      }
    }
    return node;
  }

  function hide(n) { n.classList.add("fcp-ce-hidden"); }
  function show(n) { n.classList.remove("fcp-ce-hidden"); }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    const [y, m, d] = String(iso).split("-");
    return `${d}.${m}.${y}`;
  }

  // ── Main renderPanel
  function renderPanel(mask, section, panel, emptyText) {
    const wrap = el("div", { cls: "fcp-ce-wrap" });

    // State
    let clubId = "";
    let members = [];
    let species = [];
    let waters = [];
    let selectedMember = null;
    let entries = [];

    // ── Member bar
    const memberInput = el("input", {
      type: "search", cls: "fcp-ce-member-input",
      placeholder: "Name oder Mitgl.-Nr. …", autocomplete: "off",
    });
    const dropdown = el("div", { cls: "fcp-ce-dropdown fcp-ce-hidden" });
    const searchWrap = el("div", { cls: "fcp-ce-search-wrap" }, [memberInput, dropdown]);

    const badgeName = el("span", { cls: "fcp-ce-badge-name" });
    const badgeClear = el("button", { cls: "fcp-ce-badge-clear", type: "button", title: "Abwählen", text: "✕" });
    const badge = el("div", { cls: "fcp-ce-badge fcp-ce-hidden" }, [badgeName, badgeClear]);

    const memberBar = el("div", { cls: "fcp-ce-member-bar" }, [
      el("span", { cls: "fcp-ce-member-label", text: "Mitglied" }),
      searchWrap,
      badge,
    ]);

    // ── Action bar
    const btnCapture = el("button", { cls: "fcp-ce-btn fcp-ce-btn--primary", type: "button", text: "+ Erfassen" });
    const actionBar = el("div", { cls: "fcp-ce-action-bar fcp-ce-hidden" }, [btnCapture]);

    // ── Table
    const tbody = el("tbody");

    // Capture row elements
    const fDate    = el("input",  { type: "date",   cls: "fcp-ce-field", value: today() });
    const fWater   = el("select", { cls: "fcp-ce-field fcp-ce-field--select" });
    const fSpecies = el("select", { cls: "fcp-ce-field fcp-ce-field--select" });
    const fQty     = el("input",  { type: "number", cls: "fcp-ce-field fcp-ce-field--num", min: "1", placeholder: "Stück" });
    const fWeight  = el("input",  { type: "number", cls: "fcp-ce-field fcp-ce-field--num", min: "0", placeholder: "g" });
    const btnSave  = el("button", { cls: "fcp-ce-btn fcp-ce-btn--save", type: "button", text: "Speichern" });
    const btnAbort = el("button", { cls: "fcp-ce-btn fcp-ce-btn--ghost", type: "button", title: "Abbrechen", text: "✕" });
    const capStatus = el("span",  { cls: "fcp-ce-cap-status" });
    const captureRow = el("tr", { cls: "fcp-ce-capture-row fcp-ce-hidden" }, [
      el("td", {}, [fDate]),
      el("td", {}, [fWater]),
      el("td", {}, [fSpecies]),
      el("td", {}, [fQty]),
      el("td", {}, [fWeight]),
      el("td", { cls: "fcp-ce-cap-actions" }, [btnSave, btnAbort, capStatus]),
    ]);
    tbody.append(captureRow);

    const thead = el("thead");
    const thr = el("tr");
    ["Datum", "Gewässer", "Fischart", "Stück", "Gewicht", ""].forEach((h) => {
      thr.append(el("th", { text: h }));
    });
    thead.append(thr);

    const table = el("table", { cls: "fcp-ce-table", role: "grid" }, [thead, tbody]);
    const tableWrap = el("div", { cls: "fcp-ce-table-wrap fcp-ce-hidden" }, [table]);

    // ── Hint / status line
    const hint = el("p", { cls: "fcp-ce-hint", text: "Lade Stammdaten …" });

    wrap.append(memberBar, actionBar, tableWrap, hint);

    // ── Populate selects
    function fillWater(sel) {
      sel.innerHTML = "";
      sel.append(el("option", { value: "", text: "— Gewässer —" }));
      waters.filter((w) => w.is_active).forEach((w) => {
        sel.append(el("option", { value: w.water_body_id, text: w.name }));
      });
    }

    function fillSpecies(sel) {
      sel.innerHTML = "";
      sel.append(el("option", { value: "", text: "— Fischart —" }));
      species.forEach((s) => {
        sel.append(el("option", { value: s.id, text: s.name }));
      });
    }

    // ── Render entries
    function renderEntries() {
      // Remove old data rows (keep captureRow)
      Array.from(tbody.querySelectorAll(".fcp-ce-data-row, .fcp-ce-empty-row")).forEach((r) => r.remove());

      if (!entries.length) {
        const tr = el("tr", { cls: "fcp-ce-empty-row" });
        tr.append(el("td", { colspan: "6", cls: "fcp-ce-empty-cell", text: "Noch keine Einträge für dieses Mitglied." }));
        tbody.append(tr);
        return;
      }
      entries.forEach((e) => {
        const tr = el("tr", { cls: "fcp-ce-data-row" });
        tr.append(
          el("td", { text: fmtDate(e.caught_on) }),
          el("td", { text: e.water_body_name || "—" }),
          el("td", { text: e.fish_species_name || "—" }),
          el("td", { cls: "fcp-ce-num", text: String(e.quantity) }),
          el("td", { cls: "fcp-ce-num", text: e.weight_g ? `${e.weight_g} g` : "—" }),
          el("td", { cls: "fcp-ce-src", text: e.source === "admin_backfill" ? "Admin" : "" }),
        );
        tbody.append(tr);
      });
    }

    // ── Capture mode
    function openCapture() {
      fillWater(fWater);
      fillSpecies(fSpecies);
      fDate.value = today();
      fQty.value = "";
      fWeight.value = "";
      capStatus.textContent = "";
      capStatus.className = "fcp-ce-cap-status";
      show(captureRow);
      show(tableWrap);
      renderEntries();
      setTimeout(() => fDate.focus(), 30);
    }

    function closeCapture() {
      hide(captureRow);
      renderEntries();
    }

    async function doSave() {
      if (!selectedMember || !clubId) return;
      const caught_on       = fDate.value;
      const water_body_id   = fWater.value || null;
      const fish_species_id = fSpecies.value;
      const quantity        = parseInt(fQty.value, 10);
      const weight_g        = fWeight.value ? parseInt(fWeight.value, 10) : null;

      if (!caught_on || !fish_species_id || !(quantity >= 1)) {
        capStatus.textContent = "Datum, Fischart und Stück sind Pflichtfelder.";
        capStatus.className = "fcp-ce-cap-status fcp-ce-cap-status--err";
        return;
      }

      btnSave.disabled = true;
      capStatus.textContent = "…";
      capStatus.className = "fcp-ce-cap-status";

      try {
        await rpc("admin_catch_entry_insert", {
          p_club_id:         clubId,
          p_member_no:       selectedMember.member_no,
          p_caught_on:       caught_on,
          p_water_body_id:   water_body_id,
          p_fish_species_id: fish_species_id,
          p_quantity:        quantity,
          p_weight_g:        weight_g,
        });
        capStatus.textContent = "✓ gespeichert";
        capStatus.className = "fcp-ce-cap-status fcp-ce-cap-status--ok";
        await loadEntries();
        fDate.value = today();
        fQty.value = "";
        fWeight.value = "";
        setTimeout(() => {
          capStatus.textContent = "";
          fDate.focus();
        }, 1000);
      } catch (err) {
        capStatus.textContent = err.message || "Fehler beim Speichern.";
        capStatus.className = "fcp-ce-cap-status fcp-ce-cap-status--err";
      } finally {
        btnSave.disabled = false;
      }
    }

    // ── Member dropdown
    function matchMembers(q) {
      const lq = q.trim().toLowerCase();
      if (!lq) return members.slice(0, 12);
      return members.filter((m) =>
        `${m.first_name} ${m.last_name} ${m.member_no}`.toLowerCase().includes(lq)
      ).slice(0, 12);
    }

    function renderDropdown(list) {
      dropdown.innerHTML = "";
      if (!list.length) {
        dropdown.append(el("div", { cls: "fcp-ce-dd-item fcp-ce-dd-empty", text: "Kein Mitglied gefunden." }));
      } else {
        list.forEach((m) => {
          const item = el("div", { cls: "fcp-ce-dd-item" });
          item.append(
            el("span", { cls: "fcp-ce-dd-name", text: `${m.first_name} ${m.last_name}` }),
            el("span", { cls: "fcp-ce-dd-no",   text: `Nr. ${m.member_no}` }),
          );
          item.addEventListener("mousedown", (e) => { e.preventDefault(); selectMember(m); });
          dropdown.append(item);
        });
      }
    }

    function selectMember(m) {
      selectedMember = m;
      memberInput.value = "";
      hide(dropdown);
      badgeName.textContent = `${m.first_name} ${m.last_name} · Nr. ${m.member_no}`;
      show(badge);
      show(actionBar);
      hide(hint);
      show(tableWrap);
      hide(captureRow);
      loadEntries();
    }

    function clearMember() {
      selectedMember = null;
      entries = [];
      hide(badge);
      hide(actionBar);
      hide(captureRow);
      hide(tableWrap);
      hint.textContent = "Mitglied wählen, um Fangeinträge anzuzeigen.";
      show(hint);
    }

    // ── Data loading
    async function loadEntries() {
      if (!selectedMember || !clubId) return;
      try {
        const rows = await rpc("admin_catch_entries_by_member", {
          p_club_id:   clubId,
          p_member_no: selectedMember.member_no,
        });
        entries = Array.isArray(rows) ? rows : [];
      } catch {
        entries = [];
      }
      renderEntries();
    }

    async function init() {
      hint.textContent = "Lade Stammdaten …";
      try {
        clubId = await resolveClubId();
        if (!clubId) {
          hint.textContent = "Kein Vereinskontext verfügbar. Bitte als Admin einloggen.";
          return;
        }
        const [mRows, sRows, wRows] = await Promise.all([
          rpc("admin_member_registry", { p_club_id: clubId }).catch(() => []),
          sbFetch("/rest/v1/fish_species?select=id,name&is_active=eq.true&order=name").catch(() => []),
          rpc("admin_water_bodies_with_cards", { p_club_id: clubId }).catch(() => []),
        ]);
        members = Array.isArray(mRows) ? mRows : [];
        species = Array.isArray(sRows) ? sRows : [];
        waters  = Array.isArray(wRows) ? wRows : [];
        hint.textContent = "Mitglied wählen, um Fangeinträge anzuzeigen.";
      } catch (err) {
        hint.textContent = `Fehler beim Laden: ${err.message || "Unbekannter Fehler."}`;
      }
    }

    // ── Event wiring
    memberInput.addEventListener("input", () => {
      const q = memberInput.value;
      if (!q && !members.length) return;
      renderDropdown(matchMembers(q));
      show(dropdown);
    });

    memberInput.addEventListener("focus", () => {
      if (members.length) {
        renderDropdown(matchMembers(memberInput.value));
        show(dropdown);
      }
    });

    memberInput.addEventListener("blur", () => {
      setTimeout(() => hide(dropdown), 160);
    });

    badgeClear.addEventListener("click", clearMember);
    btnCapture.addEventListener("click", openCapture);
    btnAbort.addEventListener("click", closeCapture);
    btnSave.addEventListener("click", doSave);

    fWeight.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); doSave(); }
    });
    btnSave.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); doSave(); }
    });

    init();
    return wrap;
  }

  // ── Inject styles once
  if (!document.getElementById("fcp-catch-entry-styles")) {
    const s = document.createElement("style");
    s.id = "fcp-catch-entry-styles";
    s.textContent = [
      // Layout
      ".fcp-ce-wrap{display:flex;flex-direction:column;gap:.875rem}",
      ".fcp-ce-hidden{display:none!important}",

      // Member bar
      ".fcp-ce-member-bar{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap}",
      ".fcp-ce-member-label{font-size:.75rem;font-weight:600;color:var(--rd-muted,#7a7c68);white-space:nowrap}",
      ".fcp-ce-search-wrap{position:relative}",
      ".fcp-ce-member-input{width:16rem;padding:.3125rem .625rem;font-size:.75rem;border:1px solid var(--rd-line,rgba(108,112,91,.14));border-radius:5px;background:#fff;color:var(--rd-ink,#2a2d24);outline:none;transition:border-color .15s}",
      ".fcp-ce-member-input:focus{border-color:var(--rd-gold,#d46a20)}",

      // Dropdown
      ".fcp-ce-dropdown{position:absolute;top:calc(100% + 4px);left:0;min-width:22rem;background:#fff;border:1px solid var(--rd-line,rgba(108,112,91,.14));border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.09);z-index:120;max-height:15rem;overflow-y:auto}",
      ".fcp-ce-dd-item{display:flex;justify-content:space-between;align-items:center;padding:.375rem .75rem;cursor:pointer;border-bottom:1px solid var(--rd-line,rgba(108,112,91,.07))}",
      ".fcp-ce-dd-item:last-child{border-bottom:none}",
      ".fcp-ce-dd-item:hover{background:var(--rd-gold-softer,rgba(212,106,32,.06))}",
      ".fcp-ce-dd-empty{color:var(--rd-muted,#7a7c68);font-size:.75rem;cursor:default}",
      ".fcp-ce-dd-name{font-size:.75rem;color:var(--rd-ink,#2a2d24);font-weight:500}",
      ".fcp-ce-dd-no{font-size:.6875rem;color:var(--rd-muted,#7a7c68)}",

      // Badge
      ".fcp-ce-badge{display:inline-flex;align-items:center;gap:.375rem;background:var(--rd-gold-softer,rgba(212,106,32,.06));border:1px solid var(--rd-line,rgba(108,112,91,.14));border-radius:5px;padding:.25rem .625rem}",
      ".fcp-ce-badge-name{font-size:.75rem;color:var(--rd-ink,#2a2d24);font-weight:500}",
      ".fcp-ce-badge-clear{background:none;border:none;cursor:pointer;color:var(--rd-muted,#7a7c68);font-size:.8125rem;padding:0 .125rem;line-height:1}",
      ".fcp-ce-badge-clear:hover{color:var(--rd-ink,#2a2d24)}",

      // Action bar
      ".fcp-ce-action-bar{display:flex;gap:.5rem}",

      // Buttons
      ".fcp-ce-btn{padding:.3125rem .75rem;font-size:.75rem;border-radius:5px;border:1px solid;cursor:pointer;font-weight:500;line-height:1.4;transition:background .1s,border-color .1s}",
      ".fcp-ce-btn--primary{background:var(--rd-gold,#d46a20);border-color:var(--rd-gold,#d46a20);color:#fff}",
      ".fcp-ce-btn--primary:hover{background:var(--rd-gold-hi,#bf5414);border-color:var(--rd-gold-hi,#bf5414)}",
      ".fcp-ce-btn--save{background:rgba(22,101,52,.08);border-color:rgba(22,101,52,.28);color:#166534;font-weight:600}",
      ".fcp-ce-btn--save:hover{background:rgba(22,101,52,.16)}",
      ".fcp-ce-btn--save:disabled{opacity:.5;cursor:not-allowed}",
      ".fcp-ce-btn--ghost{background:transparent;border-color:var(--rd-line,rgba(108,112,91,.14));color:var(--rd-muted,#7a7c68)}",
      ".fcp-ce-btn--ghost:hover{background:var(--rd-gold-softer,rgba(212,106,32,.06))}",

      // Table
      ".fcp-ce-table-wrap{overflow-x:auto}",
      ".fcp-ce-table{border-collapse:collapse;width:100%;font-size:.75rem;color:var(--rd-ink,#2a2d24)}",
      ".fcp-ce-table thead th{background:#faf9f5;border:1px solid var(--rd-line,rgba(108,112,91,.14));padding:.375rem .75rem;text-align:left;font-weight:600;font-size:.6875rem;color:var(--rd-muted,#7a7c68);text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}",
      ".fcp-ce-table tbody td{border:1px solid var(--rd-line,rgba(108,112,91,.14));padding:.375rem .75rem;background:#fff;vertical-align:middle}",
      ".fcp-ce-num{text-align:right;font-variant-numeric:tabular-nums}",
      ".fcp-ce-src{color:var(--rd-muted,#7a7c68);font-size:.6875rem}",
      ".fcp-ce-data-row:hover td{background:var(--rd-gold-softer,rgba(212,106,32,.04))}",
      ".fcp-ce-empty-cell{text-align:center;color:var(--rd-muted,#7a7c68);font-style:italic;padding:1rem!important}",

      // Capture row
      ".fcp-ce-capture-row td{background:rgba(22,101,52,.04);border-color:rgba(22,101,52,.18)!important;padding:.3rem .375rem!important}",
      ".fcp-ce-field{padding:.25rem .375rem;font-size:.75rem;border:1px solid var(--rd-line,rgba(108,112,91,.14));border-radius:4px;background:#fff;color:var(--rd-ink,#2a2d24);outline:none;width:100%;box-sizing:border-box;transition:border-color .12s}",
      ".fcp-ce-field:focus{border-color:var(--rd-gold,#d46a20)}",
      ".fcp-ce-field--select{min-width:7.5rem}",
      ".fcp-ce-field--num{width:5rem}",
      ".fcp-ce-cap-actions{white-space:nowrap;display:flex;align-items:center;gap:.375rem}",
      ".fcp-ce-cap-status{font-size:.6875rem;margin-left:.25rem}",
      ".fcp-ce-cap-status--ok{color:#166534}",
      ".fcp-ce-cap-status--err{color:#b91c1c}",

      // Hint
      ".fcp-ce-hint{font-size:.75rem;color:var(--rd-muted,#7a7c68);margin:0}",
    ].join("");
    document.head.appendChild(s);
  }

  window.FcpCatchEntry = { renderPanel };
})();
