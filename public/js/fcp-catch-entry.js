"use strict";

// FCP Catch Entry — Nacherfassung (Papierfanglisten digitalisieren)
// renderMode "catch-entry" in ADM_natur_gewaesser.json
// Einstiegspunkt: window.FcpCatchEntry.renderPanel(mask, section, panel, emptyText)

;(() => {
  // ── Supabase fetch utility
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

  function today() { return new Date().toISOString().slice(0, 10); }

  function fmtDate(iso) {
    if (!iso) return "—";
    const [y, m, d] = String(iso).split("-");
    return `${d}.${m}.${y}`;
  }

  // ── Main renderPanel
  function renderPanel(mask, section, panel, emptyText) {
    const wrap = el("div", { cls: "fcp-ce-wrap" });

    let clubId = "";
    let members = [];
    let species = [];
    let waters = [];
    let selectedMember = null;
    let entries = [];
    let captureOpen = false;
    let captureTyp = "catch"; // "catch" | "no_catch"

    // ──────────────────────────────────────────
    // STEP 1 — Member picker zone
    // ──────────────────────────────────────────
    const memberInput = el("input", {
      type: "search", cls: "fcp-ce-member-input",
      placeholder: "Name oder Mitgliedsnummer …", autocomplete: "off",
    });
    const dropdown = el("div", { cls: "fcp-ce-dropdown fcp-ce-hidden" });
    const searchWrap = el("div", { cls: "fcp-ce-search-wrap" }, [memberInput, dropdown]);

    // Empty state: card with step number, instruction, search input
    const stepBody = el("div", { cls: "fcp-ce-step-body" }, [
      el("p", { cls: "fcp-ce-step-desc", text: "Zuerst ein Mitglied auswählen — danach können Fangtage erfasst werden." }),
      searchWrap,
    ]);

    const stepHead = el("div", { cls: "fcp-ce-step-head" }, [
      el("span", { cls: "fcp-ce-step-num", text: "1" }),
      el("span", { cls: "fcp-ce-step-title", text: "Mitglied auswählen" }),
    ]);

    // Selected state: compact inline
    const badgeName = el("span", { cls: "fcp-ce-badge-name" });
    const badgeClear = el("button", {
      cls: "fcp-ce-badge-clear", type: "button", text: "Wechseln",
    });
    const stepSel = el("div", { cls: "fcp-ce-step-sel fcp-ce-hidden" }, [badgeName, badgeClear]);

    const stepZone = el("div", { cls: "fcp-ce-step-zone" }, [stepHead, stepBody, stepSel]);

    // ──────────────────────────────────────────
    // "Neue Zeile" bar — appears when capture closed
    // ──────────────────────────────────────────
    const btnNewRow = el("button", {
      cls: "fcp-ce-btn fcp-ce-btn--primary", type: "button", text: "+ Neue Zeile",
    });
    const newRowBar = el("div", { cls: "fcp-ce-action-bar fcp-ce-hidden" }, [btnNewRow]);

    // ──────────────────────────────────────────
    // CAPTURE ROW — Typ toggle + fields
    // ──────────────────────────────────────────
    const btnTypNoCatch = el("button", {
      cls: "fcp-ce-typ-btn", type: "button", "data-typ": "no_catch", text: "Nutzung",
    });
    const btnTypCatch = el("button", {
      cls: "fcp-ce-typ-btn fcp-ce-typ-btn--active", type: "button", "data-typ": "catch", text: "Fang",
    });
    const typToggle = el("div", { cls: "fcp-ce-typ-toggle" }, [btnTypNoCatch, btnTypCatch]);

    const fDate    = el("input",  { type: "date",   cls: "fcp-ce-field",                           value: today() });
    const fWater   = el("select", { cls: "fcp-ce-field fcp-ce-field--select" });
    const fSpecies = el("select", { cls: "fcp-ce-field fcp-ce-field--select" });
    const fQty     = el("input",  { type: "number", cls: "fcp-ce-field fcp-ce-field--num", min: "1",  placeholder: "Stück" });
    const fWeight  = el("input",  { type: "number", cls: "fcp-ce-field fcp-ce-field--num", min: "0",  placeholder: "g" });
    const btnSave  = el("button", { cls: "fcp-ce-btn fcp-ce-btn--save",  type: "button", text: "Speichern" });
    const btnAbort = el("button", { cls: "fcp-ce-btn fcp-ce-btn--ghost", type: "button", title: "Abbrechen", text: "✕" });
    const capStatus = el("span",  { cls: "fcp-ce-cap-status" });

    // TDs we conditionally hide for Nutzung
    const thFish   = el("th", { cls: "fcp-ce-col-fish",   text: "Fischart" });
    const thQty    = el("th", { cls: "fcp-ce-col-qty",    text: "Stück"    });
    const thWeight = el("th", { cls: "fcp-ce-col-weight", text: "Gewicht"  });
    const tdSpecies = el("td", { cls: "fcp-ce-col-fish"   }, [fSpecies]);
    const tdQty     = el("td", { cls: "fcp-ce-col-qty"    }, [fQty]);
    const tdWeight  = el("td", { cls: "fcp-ce-col-weight" }, [fWeight]);

    const captureRow = el("tr", { cls: "fcp-ce-capture-row fcp-ce-hidden" }, [
      el("td", { cls: "fcp-ce-cap-typ" }, [typToggle]),
      el("td", { cls: "fcp-ce-capture-indicator" }, [
        el("span", { cls: "fcp-ce-capture-arrow", text: "▶" }),
        fDate,
      ]),
      el("td", {}, [fWater]),
      tdSpecies,
      tdQty,
      tdWeight,
      el("td", { cls: "fcp-ce-cap-actions" }, [btnSave, btnAbort, capStatus]),
    ]);

    // ──────────────────────────────────────────
    // TABLE
    // ──────────────────────────────────────────
    const thead = el("thead");
    const thr = el("tr");
    [
      el("th", { text: "Typ" }),
      el("th", { text: "Datum" }),
      el("th", { text: "Gewässer" }),
      thFish,
      thQty,
      thWeight,
      el("th"),
    ].forEach((th) => thr.append(th));
    thead.append(thr);

    const tbody = el("tbody");
    tbody.append(captureRow);

    const table = el("table", { cls: "fcp-ce-table", role: "grid" }, [thead, tbody]);
    const tableWrap = el("div", { cls: "fcp-ce-table-wrap fcp-ce-hidden" }, [table]);

    const hint = el("p", { cls: "fcp-ce-hint", text: "Lade Stammdaten …" });

    wrap.append(stepZone, newRowBar, tableWrap, hint);

    // ──────────────────────────────────────────
    // Typ toggle — show/hide catch-only columns
    // ──────────────────────────────────────────
    function setTyp(newTyp) {
      captureTyp = newTyp;
      const isCatch = newTyp === "catch";
      btnTypNoCatch.classList.toggle("fcp-ce-typ-btn--active", !isCatch);
      btnTypCatch.classList.toggle("fcp-ce-typ-btn--active",    isCatch);
      // Header stays stable — only hide capture-row cells
      [tdSpecies, tdQty, tdWeight].forEach((node) => {
        node.classList.toggle("fcp-ce-col-hidden", !isCatch);
      });
      if (!isCatch) {
        fSpecies.value = "";
        fQty.value = "";
        fWeight.value = "";
      }
    }

    // ──────────────────────────────────────────
    // Populate selects
    // ──────────────────────────────────────────
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

    // ──────────────────────────────────────────
    // Render entry rows (Fang + Nutzung unified)
    // ──────────────────────────────────────────
    function renderEntries() {
      Array.from(tbody.querySelectorAll(".fcp-ce-data-row, .fcp-ce-empty-row")).forEach((r) => r.remove());

      if (!entries.length) {
        const tr = el("tr", { cls: "fcp-ce-empty-row" });
        tr.append(el("td", {
          colspan: "7",
          cls: captureOpen ? "fcp-ce-empty-cell fcp-ce-empty-cell--sub" : "fcp-ce-empty-cell",
          text: captureOpen
            ? "Noch keine früheren Einträge."
            : "Noch keine Einträge für dieses Mitglied.",
        }));
        tbody.append(tr);
        return;
      }

      entries.forEach((e) => {
        const isCatch = e.entry_kind === "catch";
        const tr = el("tr", { cls: "fcp-ce-data-row" });
        tr.append(
          el("td", {}, [
            el("span", {
              cls: isCatch ? "fcp-ce-typ-badge fcp-ce-typ-badge--catch" : "fcp-ce-typ-badge fcp-ce-typ-badge--nocatch",
              text: isCatch ? "Fang" : "Nutzung",
            }),
          ]),
          el("td", { text: fmtDate(e.trip_date) }),
          el("td", { text: e.water_body_name || "—" }),
          el("td", { cls: "fcp-ce-col-fish",   text: isCatch ? (e.fish_species_name || "—") : "" }),
          el("td", { cls: "fcp-ce-col-qty fcp-ce-num",    text: isCatch ? String(e.quantity ?? "—") : "" }),
          el("td", { cls: "fcp-ce-col-weight fcp-ce-num", text: isCatch && e.weight_g ? `${e.weight_g} g` : (isCatch ? "—" : "") }),
          el("td", { cls: "fcp-ce-src", text: e.source === "admin_backfill" ? "Admin" : "" }),
        );
        tbody.append(tr);
      });
    }

    // ──────────────────────────────────────────
    // Capture mode open / close
    // ──────────────────────────────────────────
    function openCapture() {
      fillWater(fWater);
      fillSpecies(fSpecies);
      fDate.value = today();
      fQty.value = "";
      fWeight.value = "";
      fSpecies.value = "";
      capStatus.textContent = "";
      capStatus.className = "fcp-ce-cap-status";
      captureOpen = true;
      setTyp(captureTyp);
      hide(newRowBar);
      show(captureRow);
      show(tableWrap);
      renderEntries();
      setTimeout(() => fDate.focus(), 30);
    }

    function closeCapture() {
      captureOpen = false;
      hide(captureRow);
      show(newRowBar);
      renderEntries();
    }

    // ──────────────────────────────────────────
    // Save — routes to Nutzung or Fang RPC
    // ──────────────────────────────────────────
    async function doSave() {
      if (!selectedMember || !clubId) return;

      const caught_on     = fDate.value;
      const water_body_id = fWater.value || null;

      if (!caught_on) {
        capStatus.textContent = "Datum ist Pflicht.";
        capStatus.className = "fcp-ce-cap-status fcp-ce-cap-status--err";
        return;
      }
      if (!water_body_id) {
        capStatus.textContent = "Gewässer ist Pflicht.";
        capStatus.className = "fcp-ce-cap-status fcp-ce-cap-status--err";
        return;
      }

      if (captureTyp === "catch") {
        const fish_species_id = fSpecies.value;
        const quantity        = parseInt(fQty.value, 10);
        if (!fish_species_id || !(quantity >= 1)) {
          capStatus.textContent = "Bei Fang: Fischart und Stück (≥ 1) sind Pflicht.";
          capStatus.className = "fcp-ce-cap-status fcp-ce-cap-status--err";
          return;
        }
      }

      btnSave.disabled = true;
      capStatus.textContent = "…";
      capStatus.className = "fcp-ce-cap-status";

      try {
        if (captureTyp === "no_catch") {
          await rpc("admin_fishing_trip_no_catch_insert", {
            p_club_id:       clubId,
            p_member_no:     selectedMember.member_no,
            p_trip_date:     caught_on,
            p_water_body_id: water_body_id,
          });
        } else {
          const fish_species_id = fSpecies.value;
          const quantity        = parseInt(fQty.value, 10);
          const weight_g        = fWeight.value ? parseInt(fWeight.value, 10) : null;
          await rpc("admin_catch_entry_insert", {
            p_club_id:         clubId,
            p_member_no:       selectedMember.member_no,
            p_caught_on:       caught_on,
            p_water_body_id:   water_body_id,
            p_fish_species_id: fish_species_id,
            p_quantity:        quantity,
            p_weight_g:        weight_g,
          });
        }

        capStatus.textContent = "✓";
        capStatus.className = "fcp-ce-cap-status fcp-ce-cap-status--ok";
        await loadEntries();
        fDate.value = today();
        fQty.value = "";
        fWeight.value = "";
        fSpecies.value = "";
        setTimeout(() => {
          capStatus.textContent = "";
          fDate.focus();
        }, 600);
      } catch (err) {
        capStatus.textContent = err.message || "Fehler beim Speichern.";
        capStatus.className = "fcp-ce-cap-status fcp-ce-cap-status--err";
      } finally {
        btnSave.disabled = false;
      }
    }

    // ──────────────────────────────────────────
    // Member dropdown
    // ──────────────────────────────────────────
    function matchMembers(q) {
      const lq = q.trim().toLowerCase();
      if (!lq) return members.slice(0, 12);
      return members
        .filter((m) =>
          `${m.first_name} ${m.last_name} ${m.member_no}`.toLowerCase().includes(lq)
        )
        .slice(0, 12);
    }

    function renderDropdown(list) {
      dropdown.innerHTML = "";
      if (!list.length) {
        dropdown.append(el("div", {
          cls: "fcp-ce-dd-item fcp-ce-dd-empty",
          text: "Kein Mitglied gefunden.",
        }));
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

    // ──────────────────────────────────────────
    // Member select / clear
    // ──────────────────────────────────────────
    function selectMember(m) {
      selectedMember = m;
      memberInput.value = "";
      hide(dropdown);

      // Transform step zone → compact done state
      badgeName.textContent = `${m.first_name} ${m.last_name} · Nr. ${m.member_no}`;
      hide(stepBody);
      show(stepSel);
      stepHead.querySelector(".fcp-ce-step-title").textContent = "Mitglied:";
      stepZone.classList.add("fcp-ce-step-zone--done");

      hide(hint);
      loadEntries();
      openCapture();
    }

    function clearMember() {
      selectedMember = null;
      entries = [];
      captureOpen = false;

      // Reset step zone → empty state
      show(stepBody);
      hide(stepSel);
      stepHead.querySelector(".fcp-ce-step-title").textContent = "Mitglied auswählen";
      stepZone.classList.remove("fcp-ce-step-zone--done");

      hide(newRowBar);
      hide(captureRow);
      hide(tableWrap);
      hint.textContent = "Mitglied wählen, um Fangeinträge anzuzeigen.";
      show(hint);
    }

    // ──────────────────────────────────────────
    // Load entries — unified Fang + Nutzung
    // ──────────────────────────────────────────
    async function loadEntries() {
      if (!selectedMember || !clubId) return;
      try {
        const rows = await rpc("admin_trip_log_by_member", {
          p_club_id:   clubId,
          p_member_no: selectedMember.member_no,
        });
        entries = Array.isArray(rows) ? rows : [];
      } catch {
        entries = [];
      }
      renderEntries();
    }

    // ──────────────────────────────────────────
    // Init — load reference data
    // ──────────────────────────────────────────
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
        hint.textContent = "Mitglied suchen und auswählen, um Einträge zu erfassen.";
      } catch (err) {
        hint.textContent = `Fehler beim Laden: ${err.message || "Unbekannter Fehler."}`;
      }
    }

    // ──────────────────────────────────────────
    // Event wiring
    // ──────────────────────────────────────────
    memberInput.addEventListener("input", () => {
      if (!members.length) return;
      renderDropdown(matchMembers(memberInput.value));
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
    btnNewRow.addEventListener("click", openCapture);
    btnAbort.addEventListener("click", closeCapture);
    btnSave.addEventListener("click", doSave);

    btnTypNoCatch.addEventListener("click", () => setTyp("no_catch"));
    btnTypCatch.addEventListener("click",   () => setTyp("catch"));

    // Enter on last visible field triggers save
    fWeight.addEventListener("keydown",  (e) => { if (e.key === "Enter") { e.preventDefault(); doSave(); } });
    fQty.addEventListener("keydown",     (e) => { if (e.key === "Enter") { e.preventDefault(); doSave(); } });
    fWater.addEventListener("keydown",   (e) => { if (e.key === "Enter" && captureTyp === "no_catch") { e.preventDefault(); doSave(); } });
    btnSave.addEventListener("keydown",  (e) => { if (e.key === "Enter") { e.preventDefault(); doSave(); } });

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
      ".fcp-ce-col-hidden{display:none!important}",

      // ── Step 1 zone — empty state
      ".fcp-ce-step-zone{background:var(--rd-gold-softer,rgba(212,106,32,.06));border:1px solid var(--rd-line,rgba(108,112,91,.14));border-radius:8px;padding:1rem 1.25rem;transition:padding .15s,background .15s}",
      ".fcp-ce-step-head{display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem}",
      ".fcp-ce-step-num{width:1.625rem;height:1.625rem;background:var(--rd-gold,#d46a20);color:#fff;font-size:.75rem;font-weight:700;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}",
      ".fcp-ce-step-title{font-size:.875rem;font-weight:600;color:var(--rd-ink,#2a2d24)}",
      ".fcp-ce-step-desc{font-size:.75rem;color:var(--rd-muted,#7a7c68);margin:0 0 .625rem}",
      ".fcp-ce-search-wrap{position:relative}",
      ".fcp-ce-member-input{width:18rem;padding:.375rem .75rem;font-size:.8125rem;border:1px solid var(--rd-line,rgba(108,112,91,.14));border-radius:5px;background:#fff;color:var(--rd-ink,#2a2d24);outline:none;transition:border-color .15s}",
      ".fcp-ce-member-input:focus{border-color:var(--rd-gold,#d46a20);box-shadow:0 0 0 2px rgba(212,106,32,.1)}",

      // ── Step zone — done/selected state
      ".fcp-ce-step-zone--done{background:transparent;padding:.5rem 1rem}",
      ".fcp-ce-step-zone--done .fcp-ce-step-head{margin-bottom:0}",
      ".fcp-ce-step-sel{display:flex;align-items:center;gap:.625rem;padding-left:.125rem}",
      ".fcp-ce-badge-name{font-size:.8125rem;font-weight:500;color:var(--rd-ink,#2a2d24)}",
      ".fcp-ce-badge-clear{background:none;border:1px solid var(--rd-gold-soft,rgba(212,106,32,.12));border-radius:4px;cursor:pointer;color:var(--rd-gold,#d46a20);font-size:.6875rem;font-weight:500;padding:.1875rem .5rem;margin-left:.125rem;transition:background .1s}",
      ".fcp-ce-badge-clear:hover{background:var(--rd-gold-softer,rgba(212,106,32,.06))}",

      // Dropdown
      ".fcp-ce-dropdown{position:absolute;top:calc(100% + 4px);left:0;min-width:22rem;background:#fff;border:1px solid var(--rd-line,rgba(108,112,91,.14));border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.09);z-index:120;max-height:15rem;overflow-y:auto}",
      ".fcp-ce-dd-item{display:flex;justify-content:space-between;align-items:center;padding:.375rem .75rem;cursor:pointer;border-bottom:1px solid var(--rd-line,rgba(108,112,91,.07))}",
      ".fcp-ce-dd-item:last-child{border-bottom:none}",
      ".fcp-ce-dd-item:hover{background:var(--rd-gold-softer,rgba(212,106,32,.06))}",
      ".fcp-ce-dd-empty{color:var(--rd-muted,#7a7c68);font-size:.75rem;cursor:default}",
      ".fcp-ce-dd-name{font-size:.75rem;color:var(--rd-ink,#2a2d24);font-weight:500}",
      ".fcp-ce-dd-no{font-size:.6875rem;color:var(--rd-muted,#7a7c68)}",

      // "Neue Zeile" action bar
      ".fcp-ce-action-bar{display:flex;gap:.5rem}",

      // Buttons
      ".fcp-ce-btn{padding:.3125rem .75rem;font-size:.75rem;border-radius:5px;border:1px solid;cursor:pointer;font-weight:500;line-height:1.4;transition:background .1s,border-color .1s}",
      ".fcp-ce-btn--primary{background:var(--rd-gold,#d46a20);border-color:var(--rd-gold,#d46a20);color:#fff}",
      ".fcp-ce-btn--primary:hover{background:var(--rd-gold-hi,#bf5414);border-color:var(--rd-gold-hi,#bf5414)}",
      ".fcp-ce-btn--save{background:rgba(22,101,52,.09);border-color:rgba(22,101,52,.32);color:#166534;font-weight:600}",
      ".fcp-ce-btn--save:hover{background:rgba(22,101,52,.17)}",
      ".fcp-ce-btn--save:disabled{opacity:.5;cursor:not-allowed}",
      ".fcp-ce-btn--ghost{background:transparent;border-color:var(--rd-line,rgba(108,112,91,.14));color:var(--rd-muted,#7a7c68)}",
      ".fcp-ce-btn--ghost:hover{background:var(--rd-gold-softer,rgba(212,106,32,.06))}",

      // ── Typ toggle
      ".fcp-ce-typ-toggle{display:inline-flex;border:1px solid var(--rd-line,rgba(108,112,91,.18));border-radius:5px;overflow:hidden}",
      ".fcp-ce-typ-btn{padding:.1875rem .5rem;font-size:.6875rem;border:none;background:transparent;cursor:pointer;color:var(--rd-muted,#7a7c68);font-weight:500;white-space:nowrap;transition:background .1s,color .1s}",
      ".fcp-ce-typ-btn[data-typ='catch'].fcp-ce-typ-btn--active{background:rgba(22,101,52,.1);color:#166534}",
      ".fcp-ce-typ-btn[data-typ='no_catch'].fcp-ce-typ-btn--active{background:var(--rd-gold-soft,rgba(212,106,32,.12));color:var(--rd-gold,#d46a20)}",

      // ── Typ badges (in data rows)
      ".fcp-ce-typ-badge{font-size:.625rem;font-weight:600;padding:.1rem .375rem;border-radius:3px;text-transform:uppercase;letter-spacing:.03em;white-space:nowrap}",
      ".fcp-ce-typ-badge--catch{background:rgba(22,101,52,.09);color:#166534}",
      ".fcp-ce-typ-badge--nocatch{background:var(--rd-gold-softer,rgba(212,106,32,.06));color:var(--rd-gold,#d46a20)}",

      // Table
      ".fcp-ce-table-wrap{overflow-x:auto}",
      ".fcp-ce-table{border-collapse:collapse;width:100%;font-size:.75rem;color:var(--rd-ink,#2a2d24)}",
      ".fcp-ce-table thead th{background:#faf9f5;border:1px solid var(--rd-line,rgba(108,112,91,.14));padding:.375rem .75rem;text-align:left;font-weight:600;font-size:.6875rem;color:var(--rd-muted,#7a7c68);text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}",
      ".fcp-ce-table tbody td{border:1px solid var(--rd-line,rgba(108,112,91,.14));padding:.375rem .75rem;background:#fff;vertical-align:middle}",
      ".fcp-ce-num{text-align:right;font-variant-numeric:tabular-nums}",
      ".fcp-ce-src{color:var(--rd-muted,#7a7c68);font-size:.6875rem}",
      ".fcp-ce-data-row:hover td{background:rgba(212,106,32,.03)}",
      ".fcp-ce-empty-cell{text-align:center;color:var(--rd-muted,#7a7c68);font-style:italic;padding:1rem!important}",
      ".fcp-ce-empty-cell--sub{font-size:.6875rem;padding:.5rem!important;color:rgba(122,124,104,.6)}",

      // ── Capture row
      ".fcp-ce-capture-row td{background:rgba(22,101,52,.06);border:1px solid rgba(22,101,52,.2)!important;padding:.3rem .375rem!important;vertical-align:middle}",
      ".fcp-ce-capture-row td:first-child{border-left:3px solid rgba(22,101,52,.5)!important}",
      ".fcp-ce-cap-typ{white-space:nowrap}",
      ".fcp-ce-capture-indicator{display:flex;align-items:center;gap:.375rem}",
      ".fcp-ce-capture-arrow{font-size:.625rem;color:rgba(22,101,52,.7);flex-shrink:0}",

      // Fields inside capture row
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
