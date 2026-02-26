;(() => {
  const MANAGER_ROLES = new Set(["admin", "vorstand"]);
  const VIEW_KEY = "app:viewMode:bewerbungen:v1";
  const FILTER_KEY = "app:viewFilter:bewerbungen:v1";
  const state = {
    view: "zeile",
    all: [],
    filtered: [],
  };

  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  function uid() {
    return session()?.user?.id || null;
  }

  async function sb(path, init = {}, withAuth = false) {
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    if (withAuth && session()?.access_token) {
      headers.set("Authorization", `Bearer ${session().access_token}`);
    }
    const res = await fetch(`${url}${path}`, { ...init, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || err?.hint || err?.error_description || `Request failed (${res.status})`);
    }
    return res.json().catch(() => ({}));
  }

  function setMsg(text = "", isError = false) {
    const el = document.getElementById("membershipAdminMsg");
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? "#fecaca" : "";
  }

  function esc(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function asDate(input) {
    if (!input) return "-";
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? String(input) : d.toLocaleString("de-DE");
  }

  function statusLabel(row) {
    if (row.status === "approved") return "Genehmigt";
    if (row.status === "rejected") return "Abgelehnt";
    return "Offen";
  }

  function normalizedStatusFilterValue(row) {
    if (row.status === "approved") return "genehmigt";
    if (row.status === "rejected") return "abgelehnt";
    return "offen";
  }

  function loadView() {
    try {
      return String(localStorage.getItem(VIEW_KEY) || "zeile") === "karte" ? "karte" : "zeile";
    } catch {
      return "zeile";
    }
  }

  function saveView(v) {
    try { localStorage.setItem(VIEW_KEY, v); } catch {}
  }

  function loadFilter() {
    try {
      return JSON.parse(localStorage.getItem(FILTER_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function saveFilter(payload) {
    try { localStorage.setItem(FILTER_KEY, JSON.stringify(payload || {})); } catch {}
  }

  async function loadRoles() {
    if (!uid()) return [];
    const rows = await sb(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(uid())}`, { method: "GET" }, true);
    return Array.isArray(rows) ? rows.map((r) => String(r.role || "").toLowerCase()) : [];
  }

  async function listApplications() {
    const rows = await sb("/rest/v1/membership_applications?select=id,created_at,status,first_name,last_name,birthdate,street,zip,city,is_local,known_member,fishing_card_type,iban_last4,sepa_approved,internal_questionnaire,decision_by,decision_at,rejection_reason&order=created_at.desc", { method: "GET" }, true);
    return Array.isArray(rows) ? rows : [];
  }

  async function saveQuestionnaire(id, data) {
    return sb("/rest/v1/rpc/membership_set_internal_questionnaire", {
      method: "POST",
      body: JSON.stringify({
        p_application_id: id,
        p_internal_questionnaire: data,
      }),
    }, true);
  }

  async function approve(id, membershipNumber) {
    return sb("/rest/v1/rpc/approve_membership", {
      method: "POST",
      body: JSON.stringify({
        p_application_id: id,
        p_membership_number: membershipNumber || null,
      }),
    }, true);
  }

  async function reject(id, reason) {
    return sb("/rest/v1/rpc/reject_membership", {
      method: "POST",
      body: JSON.stringify({
        p_application_id: id,
        p_rejection_reason: reason || null,
      }),
    }, true);
  }

  async function exportApprovedMembers() {
    const rows = await sb("/rest/v1/export_members?select=membership_number,first_name,last_name,birthdate,street,zip,city,fishing_card_type,is_local,created_at&order=membership_number.asc", { method: "GET" }, true);
    const data = Array.isArray(rows) ? rows : [];
    if (!data.length) {
      setMsg("Keine genehmigten Mitglieder für Export vorhanden.");
      return;
    }
    const headers = ["membership_number", "first_name", "last_name", "birthdate", "street", "zip", "city", "fishing_card_type", "is_local", "created_at"];
    const csv = [
      headers.join(";"),
      ...data.map((r) => headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(";")),
    ].join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vdan_members_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMsg(`Export erstellt (${data.length} Zeilen).`);
  }

  function parseQuestionnaire(str) {
    const raw = String(str || "").trim();
    if (!raw) throw new Error("Interner Fragebogen fehlt.");
    return JSON.parse(raw);
  }

  function applyFilters() {
    const search = String(document.getElementById("membershipSearch")?.value || "").trim().toLowerCase();
    const status = String(document.getElementById("membershipStatusFilter")?.value || "alle").trim().toLowerCase();
    saveFilter({ search, status });
    state.filtered = state.all.filter((row) => {
      if (status !== "alle" && normalizedStatusFilterValue(row) !== status) return false;
      if (!search) return true;
      const hay = `${row.first_name || ""} ${row.last_name || ""} ${row.city || ""} ${row.zip || ""} ${statusLabel(row)}`.toLowerCase();
      return hay.includes(search);
    });
  }

  function renderDetail(id) {
    const row = state.all.find((r) => String(r.id) === String(id));
    if (!row) return;
    const box = document.getElementById("membershipDetailBody");
    const dlg = document.getElementById("membershipDetailDialog");
    if (!box || !dlg) return;
    box.innerHTML = `
      <p><strong>Name:</strong> ${esc(row.first_name)} ${esc(row.last_name)}</p>
      <p><strong>Status:</strong> ${esc(statusLabel(row))}</p>
      <p><strong>Eingang:</strong> ${esc(asDate(row.created_at))}</p>
      <p><strong>Geburt:</strong> ${esc(row.birthdate || "-")}</p>
      <p><strong>Karte:</strong> ${esc(row.fishing_card_type || "-")}</p>
      <p><strong>Adresse:</strong> ${esc(row.street || "-")}, ${esc(row.zip || "-")} ${esc(row.city || "-")}</p>
      <p><strong>Kennt im Verein:</strong> ${esc(row.known_member || "-")}</p>
      <p><strong>IBAN:</strong> **** **** **** ${esc(row.iban_last4 || "-")}</p>
      <p><strong>Ablehnungsgrund:</strong> ${esc(row.rejection_reason || "-")}</p>
    `;
    dlg.showModal?.();
  }

  function renderRows(rows, isPending) {
    const tableRoot = document.getElementById(isPending ? "membershipPendingTable" : "membershipDoneTable");
    const cardRoot = document.getElementById(isPending ? "membershipPendingList" : "membershipDoneList");
    if (!tableRoot || !cardRoot) return;

    if (!rows.length) {
      const msg = isPending ? "Keine offenen Bewerbungen." : "Keine bearbeiteten Bewerbungen.";
      tableRoot.innerHTML = `<p class="small" style="padding:12px;">${msg}</p>`;
      cardRoot.innerHTML = `<p class="small">${msg}</p>`;
      return;
    }

    tableRoot.innerHTML = rows.map((r) => `
      <button type="button" class="catch-table__row" data-open-id="${esc(r.id)}" style="grid-template-columns:1.2fr 1fr 1fr 1fr;">
        <span>${esc(r.first_name)} ${esc(r.last_name)}</span>
        <span>${esc(asDate(isPending ? r.created_at : r.decision_at))}</span>
        <span>${esc(statusLabel(r))}</span>
        <span>${esc(r.city || "-")}</span>
      </button>
    `).join("");

    cardRoot.innerHTML = rows.map((r) => {
      const q = r.internal_questionnaire ? JSON.stringify(r.internal_questionnaire, null, 2) : "";
      const actions = isPending
        ? `
          <label>Interner Fragebogen (JSON)
            <textarea rows="6" data-q-id="${esc(r.id)}" placeholder='{"gespraech":"ok","empfehlung":"ja"}'>${esc(q)}</textarea>
          </label>
          <label>Mitgliedsnummer (optional)
            <input data-membership-no-id="${esc(r.id)}" placeholder="z. B. 8001" />
          </label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="feed-btn feed-btn--ghost" data-save="${esc(r.id)}">Fragebogen speichern</button>
            <button type="button" class="feed-btn" data-approve="${esc(r.id)}">Genehmigen</button>
            <button type="button" class="feed-btn feed-btn--ghost" data-reject="${esc(r.id)}">Ablehnen</button>
          </div>
        `
        : "";
      return `
        <article class="card" data-open-id="${esc(r.id)}">
          <div class="card__body">
            <h3>${esc(r.first_name)} ${esc(r.last_name)}</h3>
            <p class="small">Status: <strong>${esc(statusLabel(r))}</strong></p>
            <p class="small">${isPending ? "Eingang" : "Entscheidung"}: ${esc(asDate(isPending ? r.created_at : r.decision_at))}</p>
            <p class="small">Adresse: ${esc(r.street || "-")}, ${esc(r.zip || "-")} ${esc(r.city || "-")}</p>
            <p class="small">IBAN: **** **** **** ${esc(r.iban_last4)}</p>
            ${actions}
          </div>
        </article>
      `;
    }).join("");
  }

  function applyView() {
    const isCard = state.view === "karte";
    [
      "membershipPendingTableWrap",
      "membershipDoneTableWrap",
    ].forEach((id) => {
      const el = document.getElementById(id);
      el?.classList.toggle("hidden", isCard);
      el?.toggleAttribute("hidden", isCard);
    });
    [
      "membershipPendingList",
      "membershipDoneList",
    ].forEach((id) => {
      const el = document.getElementById(id);
      el?.classList.toggle("hidden", !isCard);
      el?.toggleAttribute("hidden", !isCard);
    });
    document.getElementById("membershipViewZeileBtn")?.classList.toggle("feed-btn--ghost", isCard);
    document.getElementById("membershipViewKarteBtn")?.classList.toggle("feed-btn--ghost", !isCard);
  }

  function renderAll() {
    applyFilters();
    const pending = state.filtered.filter((r) => r.status === "pending");
    const done = state.filtered.filter((r) => r.status !== "pending");
    renderRows(pending, true);
    renderRows(done, false);
    applyView();
  }

  async function refresh() {
    setMsg("Lade Bewerbungen…");
    state.all = await listApplications();
    renderAll();
    setMsg(`Bewerbungen geladen: ${state.all.length}`);
  }

  async function init() {
    if (!uid()) {
      window.location.replace(`/login/?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    state.view = loadView();
    const filter = loadFilter();
    const searchEl = document.getElementById("membershipSearch");
    const statusEl = document.getElementById("membershipStatusFilter");
    if (searchEl && filter.search) searchEl.value = String(filter.search);
    if (statusEl && ["alle", "offen", "genehmigt", "abgelehnt"].includes(String(filter.status || ""))) {
      statusEl.value = String(filter.status);
    }

    const roles = await loadRoles().catch(() => []);
    const isManager = roles.some((r) => MANAGER_ROLES.has(r));
    if (!isManager) {
      setMsg("Kein Zugriff: nur Vorstand/Admin.", true);
      return;
    }

    document.getElementById("membershipAdminReload")?.addEventListener("click", () => {
      refresh().catch((err) => setMsg(err?.message || "Laden fehlgeschlagen.", true));
    });

    document.getElementById("membershipAdminExport")?.addEventListener("click", () => {
      exportApprovedMembers().catch((err) => setMsg(err?.message || "Export fehlgeschlagen.", true));
    });

    document.getElementById("membershipSearch")?.addEventListener("input", renderAll);
    document.getElementById("membershipStatusFilter")?.addEventListener("change", renderAll);
    document.getElementById("membershipViewZeileBtn")?.addEventListener("click", () => {
      state.view = "zeile";
      saveView(state.view);
      applyView();
    });
    document.getElementById("membershipViewKarteBtn")?.addEventListener("click", () => {
      state.view = "karte";
      saveView(state.view);
      applyView();
    });

    document.addEventListener("click", async (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      const saveId = target.getAttribute("data-save");
      if (saveId) {
        try {
          const qRaw = document.querySelector(`[data-q-id="${saveId}"]`)?.value || "";
          const data = parseQuestionnaire(qRaw);
          await saveQuestionnaire(saveId, data);
          setMsg("Fragebogen gespeichert.");
          await refresh();
        } catch (err) {
          setMsg(err?.message || "Speichern fehlgeschlagen.", true);
        }
        return;
      }

      const approveId = target.getAttribute("data-approve");
      if (approveId) {
        try {
          const qRaw = document.querySelector(`[data-q-id="${approveId}"]`)?.value || "";
          const data = parseQuestionnaire(qRaw);
          await saveQuestionnaire(approveId, data);
          const memberNo = document.querySelector(`[data-membership-no-id="${approveId}"]`)?.value || "";
          await approve(approveId, String(memberNo || "").trim());
          setMsg("Bewerbung genehmigt.");
          await refresh();
        } catch (err) {
          setMsg(err?.message || "Genehmigung fehlgeschlagen.", true);
        }
        return;
      }

      const rejectId = target.getAttribute("data-reject");
      if (rejectId) {
        try {
          const reason = window.prompt("Ablehnungsgrund (optional):", "") || "";
          await reject(rejectId, reason);
          setMsg("Bewerbung abgelehnt.");
          await refresh();
        } catch (err) {
          setMsg(err?.message || "Ablehnung fehlgeschlagen.", true);
        }
        return;
      }

      const openRow = target.closest?.("[data-open-id]");
      if (openRow && !target.closest("button[data-save],button[data-approve],button[data-reject],textarea,input")) {
        renderDetail(String(openRow.getAttribute("data-open-id") || ""));
      }
    });

    await refresh();
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => setMsg(err?.message || "Initialisierung fehlgeschlagen.", true));
  });
})();
