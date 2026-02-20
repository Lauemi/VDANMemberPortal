;(() => {
  const TABLE = "app_notes";

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
      throw new Error(j?.message || j?.hint || j?.error_description || `Request failed (${res.status})`);
    }
    return res.json().catch(() => ({}));
  }

  async function listNotes(){
    // PostgREST: /rest/v1/{table}?select=*
    const rows = await sb(`/rest/v1/${TABLE}?select=id,created_at,text&order=created_at.desc`, { method:"GET" });
    return Array.isArray(rows) ? rows : [];
  }

  async function addNote(text){
    const rows = await sb(`/rest/v1/${TABLE}`, {
      method:"POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([{ text }]),
    });
    return rows?.[0];
  }

  async function deleteNote(id){
    await sb(`/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, { method:"DELETE" });
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
          <div style="white-space:pre-wrap;margin:8px 0 10px">${escapeHtml(r.text)}</div>
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

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("noteForm");
    const txt = document.getElementById("noteText");
    const msg = document.getElementById("noteMsg");

    refresh();

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
})();
