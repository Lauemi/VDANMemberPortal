;(() => {
  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  function setMsg(text = "") {
    const el = document.getElementById("downloadsMsg");
    if (el) el.textContent = text;
  }

  function esc(v) {
    return String(v || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function resolveUrl(row, conf) {
    if (row.public_url) {
      const raw = String(row.public_url).trim();
      if (!raw || raw === "/Downloads/" || raw === "/Downloads") return "/downloads.html/";
      return raw;
    }
    if (row.storage_bucket && row.storage_path && conf.url) {
      const p = String(row.storage_path).replace(/^\/+/, "");
      return `${conf.url}/storage/v1/object/public/${encodeURIComponent(row.storage_bucket)}/${p}`;
    }
    return "";
  }

  function render(rows, conf) {
    const root = document.getElementById("documentsList");
    const menu = document.getElementById("document-menu");
    if (!root || !menu) return;

    root.innerHTML = "";
    menu.innerHTML = "";

    const grouped = new Map();
    rows.forEach((r) => {
      const c = String(r.category || "Sonstiges").trim() || "Sonstiges";
      if (!grouped.has(c)) grouped.set(c, []);
      grouped.get(c).push(r);
    });

    [...grouped.entries()].forEach(([category, items], idx) => {
      const anchor = `doc-cat-${idx + 1}`;
      const navItem = document.createElement("li");
      navItem.innerHTML = `<a href="#${anchor}">${esc(category)}</a>`;
      menu.appendChild(navItem);

      const section = document.createElement("section");
      section.className = "section-one-center";
      section.id = anchor;
      section.innerHTML = `<h4>${esc(category)}</h4>`;

      const list = document.createElement("div");
      list.className = "documents-grid";

      items.forEach((row) => {
        const href = resolveUrl(row, conf);
        const card = document.createElement("article");
        card.className = "documents-card";
        card.innerHTML = `
          <h5>${esc(row.title || "Dokument")}</h5>
          ${row.description ? `<p>${esc(row.description)}</p>` : ""}
          ${href ? `<a class="documents-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">Dokument öffnen</a>` : `<p class="documents-missing">Kein Link hinterlegt</p>`}
        `;
        list.appendChild(card);
      });

      section.appendChild(list);
      section.insertAdjacentHTML("beforeend", '<h5><a href="#top">&#8593; Seitenanfang</a></h5>');
      root.appendChild(section);
    });
  }

  async function loadDocuments() {
    const conf = cfg();
    if (!conf.url || !conf.key) {
      setMsg("Konfiguration fehlt (Supabase URL/Key).");
      return;
    }

    try {
      setMsg("Lade Dokumente…");
      const url = `${conf.url}/rest/v1/documents?select=title,category,description,public_url,storage_bucket,storage_path,sort_order&is_active=eq.true&order=category.asc,sort_order.asc,title.asc`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          apikey: conf.key,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error(`Dokumente konnten nicht geladen werden (${res.status})`);
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        setMsg("Keine Dokumente vorhanden.");
        return;
      }
      render(rows, conf);
      setMsg("");
    } catch (err) {
      setMsg(err?.message || "Fehler beim Laden der Dokumente.");
    }
  }

  document.addEventListener("DOMContentLoaded", loadDocuments);
})();
