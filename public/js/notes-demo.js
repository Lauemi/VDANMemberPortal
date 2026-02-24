;(() => {
  const TABLE = "app_notes";
  const OFFLINE_NS = "notes";
  let notesMem = [];

  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/,""),
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

  async function listNotes(){
    try {
      const rows = await sb(`/rest/v1/${TABLE}?select=id,created_at,text&order=created_at.desc`, { method:"GET" });
      const list = Array.isArray(rows) ? rows : [];
      notesMem = list;
      await saveLocalNotes();
      return list;
    } catch {
      return notesMem;
    }
  }

  async function addNote(text){
    try {
      const rows = await sb(`/rest/v1/${TABLE}`, {
        method:"POST",
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

  async function deleteNote(id){
    try {
      await sb(`/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, { method:"DELETE" });
    } catch (err) {
      if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
        await queueAction("delete_note", { id });
        return;
      }
      throw err;
    }
  }

  function render(rows){
    const root = document.getElementById("notesList");
    if (!root) return;
    root.innerHTML = "";
    if (!rows.length){
      root.innerHTML = `<p class="small">Noch keine Notes.</p>`;
      return;
    }
    rows.forEach((r) => {
      const el = document.createElement("div");
      el.className = "card";
      el.innerHTML = `
        <div class="card__body">
          <div class="small" style="opacity:.75">${new Date(r.created_at).toLocaleString()}</div>
          <div style="white-space:pre-wrap;margin:8px 0 10px">${escapeHtml(r.text)}${r._offline_pending ? " ⏳" : ""}</div>
          <button data-del="${r.id}">Löschen</button>
        </div>
      `;
      root.appendChild(el);
    });
    root.querySelectorAll("button[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del");
        if (!id) return;
        btn.disabled = true;
        try {
          await deleteNote(id);
          notesMem = notesMem.filter((n) => String(n.id) !== String(id));
          await saveLocalNotes();
          await refresh();
        } catch (e) {
          alert(e?.message || "Delete failed");
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }

  async function refresh(){
    const msg = document.getElementById("noteMsg");
    try {
      const rows = await listNotes();
      render(rows);
      if (msg) msg.textContent = "";
    } catch (e) {
      if (msg) msg.textContent = e?.message || "Fehler";
    }
  }

  async function flushOfflineQueue() {
    if (!window.VDAN_OFFLINE_SYNC?.flush) return;
    await window.VDAN_OFFLINE_SYNC.flush(OFFLINE_NS, async (op) => {
      const p = op?.payload || {};
      if (op?.type === "add_note") {
        const rows = await sb(`/rest/v1/${TABLE}`, {
          method:"POST",
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
        await sb(`/rest/v1/${TABLE}?id=eq.${encodeURIComponent(String(p.id || ""))}`, { method:"DELETE" });
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("noteForm");
    const txt = document.getElementById("noteText");
    const msg = document.getElementById("noteMsg");

    loadLocalNotes().then(() => flushOfflineQueue()).then(() => refresh());

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
