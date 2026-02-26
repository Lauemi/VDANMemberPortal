;(() => {
  const TABLE = "app_notes";
  const OFFLINE_NS = "notes";
  const VIEW_KEY = "app:viewMode:notes:v1";
  const FILTER_KEY = "app:viewFilter:notes:v1";
  let notesMem = [];
  let filtered = [];
  let view = "zeile";

  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  async function sb(path, init = {}) {
    const { url, key } = cfg();
    const s = session();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    if (s?.access_token) headers.set("Authorization", `Bearer ${s.access_token}`);
    const res = await fetch(`${url}${path}`, { ...init, headers });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      const e = new Error(j?.message || j?.hint || j?.error_description || `Request failed (${res.status})`);
      e.status = res.status;
      throw e;
    }
    return res.json().catch(() => ({}));
  }

  function nowIso() {
    return new Date().toISOString();
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

  async function loadLocalNotes() {
    const rows = await window.VDAN_OFFLINE_SYNC?.cacheGet?.(OFFLINE_NS, "rows", []);
    notesMem = Array.isArray(rows) ? rows : [];
  }

  async function saveLocalNotes() {
    await window.VDAN_OFFLINE_SYNC?.cacheSet?.(OFFLINE_NS, "rows", notesMem);
  }

  async function queueAction(type, payload) {
    await window.VDAN_OFFLINE_SYNC?.enqueue?.(OFFLINE_NS, { type, payload });
  }

  async function listNotes() {
    try {
      const rows = await sb(`/rest/v1/${TABLE}?select=id,created_at,text&order=created_at.desc`, { method: "GET" });
      const list = Array.isArray(rows) ? rows : [];
      notesMem = list;
      await saveLocalNotes();
      return list;
    } catch {
      return notesMem;
    }
  }

  async function addNote(text) {
    try {
      const rows = await sb(`/rest/v1/${TABLE}`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify([{ text }]),
      });
      return rows?.[0];
    } catch (err) {
      if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
        const local = { id: `local:note:${Date.now()}`, created_at: nowIso(), text, _offline_pending: true };
        notesMem = [local, ...notesMem];
        await saveLocalNotes();
        await queueAction("add_note", { text, local_id: local.id });
        return local;
      }
      throw err;
    }
  }

  async function deleteNote(id) {
    try {
      await sb(`/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (err) {
      if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
        await queueAction("delete_note", { id });
        return;
      }
      throw err;
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function applyFilters() {
    const search = String(document.getElementById("noteSearch")?.value || "").trim().toLowerCase();
    saveFilter({ search });
    filtered = notesMem.filter((n) => {
      if (!search) return true;
      return String(n.text || "").toLowerCase().includes(search);
    });
  }

  function renderDetail(id) {
    const note = notesMem.find((n) => String(n.id) === String(id));
    if (!note) return;
    const body = document.getElementById("notesDetailBody");
    const dlg = document.getElementById("notesDetailDialog");
    if (!body || !dlg) return;
    body.innerHTML = `
      <p><strong>Zeit:</strong> ${escapeHtml(new Date(note.created_at).toLocaleString())}</p>
      <p><strong>Text:</strong></p>
      <p>${escapeHtml(note.text)}${note._offline_pending ? " ⏳" : ""}</p>
    `;
    dlg.showModal?.();
  }

  function applyView() {
    const isCard = view === "karte";
    const tableWrap = document.getElementById("notesTableWrap");
    const cardWrap = document.getElementById("notesList");
    tableWrap?.classList.toggle("hidden", isCard);
    tableWrap?.toggleAttribute("hidden", isCard);
    cardWrap?.classList.toggle("hidden", !isCard);
    cardWrap?.toggleAttribute("hidden", !isCard);
    document.getElementById("notesViewZeileBtn")?.classList.toggle("feed-btn--ghost", isCard);
    document.getElementById("notesViewKarteBtn")?.classList.toggle("feed-btn--ghost", !isCard);
  }

  function bindDeleteHandlers(root) {
    root.querySelectorAll("button[data-del]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-del");
        if (!id) return;
        btn.disabled = true;
        try {
          await deleteNote(id);
          notesMem = notesMem.filter((n) => String(n.id) !== String(id));
          await saveLocalNotes();
          await refresh();
        } catch (err) {
          alert(err?.message || "Löschen fehlgeschlagen");
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  function renderRows() {
    applyFilters();

    const table = document.getElementById("notesTable");
    const cards = document.getElementById("notesList");
    if (!table || !cards) return;

    if (!filtered.length) {
      table.innerHTML = `<p class="small" style="padding:12px;">Noch keine Notes.</p>`;
      cards.innerHTML = `<p class="small">Noch keine Notes.</p>`;
      applyView();
      return;
    }

    table.innerHTML = filtered.map((r) => `
      <button type="button" class="catch-table__row" data-open-note="${escapeHtml(r.id)}" style="grid-template-columns:1fr 3fr;">
        <span>${escapeHtml(new Date(r.created_at).toLocaleString())}</span>
        <span>${escapeHtml(String(r.text || "").slice(0, 180))}${String(r.text || "").length > 180 ? "…" : ""}${r._offline_pending ? " ⏳" : ""}</span>
      </button>
    `).join("");

    cards.innerHTML = filtered.map((r) => `
      <button type="button" class="card" data-open-note="${escapeHtml(r.id)}" style="text-align:left;">
        <div class="card__body">
          <div class="small" style="opacity:.75">${escapeHtml(new Date(r.created_at).toLocaleString())}</div>
          <div style="white-space:pre-wrap;margin:8px 0 10px">${escapeHtml(r.text)}${r._offline_pending ? " ⏳" : ""}</div>
          <button class="feed-btn feed-btn--ghost" data-del="${escapeHtml(r.id)}">Löschen</button>
        </div>
      </button>
    `).join("");

    bindDeleteHandlers(cards);
    applyView();
  }

  async function refresh() {
    const msg = document.getElementById("noteMsg");
    try {
      const rows = await listNotes();
      notesMem = Array.isArray(rows) ? rows : [];
      renderRows();
      if (msg) msg.textContent = "";
    } catch (err) {
      if (msg) msg.textContent = err?.message || "Fehler";
    }
  }

  async function flushOfflineQueue() {
    if (!window.VDAN_OFFLINE_SYNC?.flush) return;
    await window.VDAN_OFFLINE_SYNC.flush(OFFLINE_NS, async (op) => {
      const p = op?.payload || {};
      if (op?.type === "add_note") {
        const rows = await sb(`/rest/v1/${TABLE}`, {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify([{ text: String(p.text || "") }]),
        });
        const created = rows?.[0];
        if (p.local_id) {
          notesMem = notesMem.filter((n) => String(n.id) !== String(p.local_id));
          if (created) notesMem.unshift(created);
          await saveLocalNotes();
        }
        return;
      }
      if (op?.type === "delete_note") {
        await sb(`/rest/v1/${TABLE}?id=eq.${encodeURIComponent(String(p.id || ""))}`, { method: "DELETE" });
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("noteForm");
    const txt = document.getElementById("noteText");
    const msg = document.getElementById("noteMsg");
    const filter = loadFilter();
    view = loadView();

    const searchEl = document.getElementById("noteSearch");
    if (searchEl && filter.search) searchEl.value = String(filter.search);

    loadLocalNotes().then(() => flushOfflineQueue()).then(() => refresh());

    document.getElementById("noteSearch")?.addEventListener("input", renderRows);
    document.getElementById("notesViewZeileBtn")?.addEventListener("click", () => {
      view = "zeile";
      saveView(view);
      applyView();
    });
    document.getElementById("notesViewKarteBtn")?.addEventListener("click", () => {
      view = "karte";
      saveView(view);
      applyView();
    });

    document.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const open = target.closest("[data-open-note]");
      if (!open || target.closest("[data-del]")) return;
      renderDetail(String(open.getAttribute("data-open-note") || ""));
    });

    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = String(txt?.value || "").trim();
      if (!v) return;
      if (msg) msg.textContent = "…";
      try {
        await addNote(v);
        if (txt) txt.value = "";
        await refresh();
        if (msg) msg.textContent = "Gespeichert.";
      } catch (err) {
        if (msg) msg.textContent = err?.message || "Fehler";
      }
    });
  });

  window.addEventListener("online", () => {
    flushOfflineQueue().then(() => refresh()).catch(() => {});
  });
})();
