;(() => {
  const TABLE = "feed_posts";
  const MEDIA_TABLE = "feed_post_media";
  const MEDIA_BUCKET = "feed-media";
  const MANAGER_ROLES = new Set(["admin", "vorstand"]);
  const MAX_MEDIA_FILES = 2;
  const MAX_LONG_EDGE = 1280;
  const MAX_FILE_BYTES = 400 * 1024;

  const CATEGORY_OPTIONS = [
    { value: "info", label: "Info" },
    { value: "termin", label: "Termin" },
    { value: "jugend", label: "Jugend" },
    { value: "arbeitseinsatz", label: "Arbeitseinsatz" },
  ];

  let canManage = false;

  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  function currentUserId() {
    return session()?.user?.id || null;
  }

  async function sb(path, init = {}, withAuth = false) {
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    if (!(init.body instanceof Blob)) {
      headers.set("Content-Type", "application/json");
    }
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

  function storagePublicUrl(bucket, path) {
    const { url } = cfg();
    const encoded = String(path)
      .split("/")
      .map((s) => encodeURIComponent(s))
      .join("/");
    return `${url}/storage/v1/object/public/${bucket}/${encoded}`;
  }

  function setMessage(text = "") {
    const el = document.getElementById("feedMsg");
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString("de-DE");
    } catch {
      return iso;
    }
  }

  async function loadRoles() {
    const userId = currentUserId();
    if (!userId) return [];

    const rows = await sb(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}`, { method: "GET" }, true);
    return Array.isArray(rows) ? rows.map((r) => String(r.role || "").toLowerCase()) : [];
  }

  async function listPosts() {
    const rows = await sb(`/rest/v1/${TABLE}?select=id,title,body,category,created_at,updated_at,${MEDIA_TABLE}(id,sort_order,storage_bucket,storage_path,width,height)&order=created_at.desc`, { method: "GET" });
    return Array.isArray(rows) ? rows : [];
  }

  async function createPost(payload) {
    const uid = currentUserId();
    if (!uid) throw new Error("Nicht eingeloggt");

    const rows = await sb(`/rest/v1/${TABLE}`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([{ ...payload, author_id: uid }]),
    }, true);

    return rows?.[0];
  }

  async function createPostMediaRows(rows) {
    if (!rows.length) return;
    await sb(`/rest/v1/${MEDIA_TABLE}`, {
      method: "POST",
      body: JSON.stringify(rows),
    }, true);
  }

  async function updatePost(id, payload) {
    const rows = await sb(`/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    }, true);

    return rows?.[0];
  }

  function categoryLabel(value) {
    const hit = CATEGORY_OPTIONS.find((x) => x.value === value);
    return hit ? hit.label : value;
  }

  function imageToBitmap(file) {
    if (window.createImageBitmap) {
      return window.createImageBitmap(file);
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
      img.src = URL.createObjectURL(file);
    });
  }

  async function transcodeImage(file) {
    const bitmap = await imageToBitmap(file);
    const originalW = bitmap.width;
    const originalH = bitmap.height;
    const scale = Math.min(1, MAX_LONG_EDGE / Math.max(originalW, originalH));
    const width = Math.max(1, Math.round(originalW * scale));
    const height = Math.max(1, Math.round(originalH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.drawImage(bitmap, 0, 0, width, height);

    let quality = 0.9;
    let blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));

    while (blob && blob.size > MAX_FILE_BYTES && quality > 0.42) {
      quality -= 0.08;
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    }

    if (!blob) throw new Error("Bildverarbeitung fehlgeschlagen");
    if (blob.size > MAX_FILE_BYTES) {
      throw new Error(`Bild ${file.name} ist trotz Komprimierung größer als 400 KB.`);
    }

    return { blob, width, height, bytes: blob.size, mime: "image/webp" };
  }

  async function uploadMedia(postId, files) {
    if (!files.length) return [];

    const uid = currentUserId();
    if (!uid) throw new Error("Nicht eingeloggt");

    const { url, key } = cfg();
    const mediaRows = [];

    for (let i = 0; i < files.length; i += 1) {
      const processed = await transcodeImage(files[i]);
      const path = `posts/${postId}/${Date.now()}-${i + 1}.webp`;
      const encodedPath = path.split("/").map((s) => encodeURIComponent(s)).join("/");

      const headers = new Headers();
      headers.set("apikey", key);
      headers.set("Authorization", `Bearer ${session().access_token}`);
      headers.set("Content-Type", processed.mime);
      headers.set("x-upsert", "false");

      const res = await fetch(`${url}/storage/v1/object/${MEDIA_BUCKET}/${encodedPath}`, {
        method: "POST",
        headers,
        body: processed.blob,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Storage Upload fehlgeschlagen (${res.status})`);
      }

      mediaRows.push({
        post_id: postId,
        sort_order: i + 1,
        storage_bucket: MEDIA_BUCKET,
        storage_path: path,
        photo_bytes: processed.bytes,
        width: processed.width,
        height: processed.height,
        mime_type: processed.mime,
        created_by: uid,
      });
    }

    return mediaRows;
  }

  function buildComposer(initial = {}, submitLabel = "Speichern", withMedia = false) {
    const wrap = document.createElement("div");
    wrap.className = "feed-composer";
    wrap.innerHTML = `
      <label>
        <span>Überschrift</span>
        <input type="text" name="title" maxlength="160" value="${escapeHtml(initial.title || "")}" required />
      </label>
      <label>
        <span>Kategorie</span>
        <select name="category">
          ${CATEGORY_OPTIONS.map((o) => `<option value="${o.value}" ${initial.category === o.value ? "selected" : ""}>${o.label}</option>`).join("")}
        </select>
      </label>
      <label>
        <span>Text</span>
        <textarea name="body" rows="6" maxlength="10000" required>${escapeHtml(initial.body || "")}</textarea>
      </label>
      ${withMedia ? `
      <label>
        <span>Bilder (max. 2, automatisch verkleinert auf WebP <= 400KB)</span>
        <input type="file" name="media" accept="image/*" multiple />
      </label>` : ""}
      <div class="feed-composer__actions">
        <button class="feed-btn" type="submit">${submitLabel}</button>
        <button class="feed-btn feed-btn--ghost" type="button" data-cancel>Abbrechen</button>
      </div>
    `;
    return wrap;
  }

  function payloadFromComposer(form) {
    const title = String(form.querySelector('[name="title"]')?.value || "").trim();
    const category = String(form.querySelector('[name="category"]')?.value || "info").trim();
    const body = String(form.querySelector('[name="body"]')?.value || "").trim();

    if (!title) throw new Error("Überschrift fehlt");
    if (!body) throw new Error("Text fehlt");
    return { title, category, body };
  }

  function mediaFilesFromComposer(form) {
    const input = form.querySelector('[name="media"]');
    const files = Array.from(input?.files || []);
    if (files.length > MAX_MEDIA_FILES) {
      throw new Error("Maximal 2 Bilder pro Post erlaubt.");
    }
    return files;
  }

  async function refresh() {
    const list = document.getElementById("feedList");
    if (!list) return;
    list.innerHTML = "";

    try {
      const posts = await listPosts();
      if (!posts.length) {
        list.innerHTML = `<article class="feed-post"><h3>Noch keine Beiträge</h3><p class="small">Mit \"Neuer Post\" den ersten Beitrag erstellen.</p></article>`;
        return;
      }

      posts.forEach((post) => {
        const media = Array.isArray(post.feed_post_media)
          ? [...post.feed_post_media].sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
          : [];

        const mediaHtml = media.length
          ? `
            <div class="feed-media feed-media--inline">
              ${media.map((m) => `
                <figure class="feed-media__item">
                  <img class="feed-media__img" loading="lazy" src="${storagePublicUrl(m.storage_bucket, m.storage_path)}" alt="Beitragsbild" />
                </figure>
              `).join("")}
            </div>
          `
          : "";

        const article = document.createElement("article");
        article.className = "feed-post";
        article.dataset.id = post.id;
        article.innerHTML = `
          <header class="feed-post__head">
            <h3>${escapeHtml(post.title)}</h3>
            <div class="feed-post__meta">
              <span class="feed-chip">${escapeHtml(categoryLabel(post.category))}</span>
              <time datetime="${escapeHtml(post.created_at)}">${escapeHtml(formatDate(post.created_at))}</time>
              ${canManage ? '<button class="feed-btn feed-btn--ghost" type="button" data-edit>Bearbeiten</button>' : ""}
            </div>
          </header>
          ${mediaHtml}
          <p class="feed-post__body">${escapeHtml(post.body).replace(/\n/g, "<br>")}</p>
          <div class="feed-edit-slot"></div>
        `;

        if (canManage) {
          article.querySelector("[data-edit]")?.addEventListener("click", () => mountEditComposer(article, post));
        }

        list.appendChild(article);
      });
    } catch (err) {
      setMessage(err?.message || "Feed konnte nicht geladen werden");
    }
  }

  function mountNewComposer() {
    const host = document.getElementById("feedComposerHost");
    if (!host) return;
    host.innerHTML = "";

    const form = document.createElement("form");
    form.className = "feed-form";
    form.appendChild(buildComposer({}, "Post veröffentlichen", true));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setMessage("Speichert...");
      try {
        const payload = payloadFromComposer(form);
        const files = mediaFilesFromComposer(form);

        const post = await createPost(payload);
        if (!post?.id) throw new Error("Post konnte nicht erstellt werden");

        if (files.length) {
          const mediaRows = await uploadMedia(post.id, files);
          await createPostMediaRows(mediaRows);
        }

        host.innerHTML = "";
        setMessage("Beitrag veröffentlicht.");
        await refresh();
      } catch (err) {
        setMessage(err?.message || "Speichern fehlgeschlagen");
      }
    });

    form.querySelector("[data-cancel]")?.addEventListener("click", () => {
      host.innerHTML = "";
      setMessage("");
    });

    host.appendChild(form);
  }

  function mountEditComposer(article, post) {
    const slot = article.querySelector(".feed-edit-slot");
    if (!slot) return;
    slot.innerHTML = "";

    const form = document.createElement("form");
    form.className = "feed-form";
    form.appendChild(buildComposer(post, "Änderungen speichern", false));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setMessage("Aktualisiert...");
      try {
        const payload = payloadFromComposer(form);
        await updatePost(post.id, payload);
        setMessage("Beitrag aktualisiert.");
        await refresh();
      } catch (err) {
        setMessage(err?.message || "Update fehlgeschlagen");
      }
    });

    form.querySelector("[data-cancel]")?.addEventListener("click", () => {
      slot.innerHTML = "";
      setMessage("");
    });

    slot.appendChild(form);
  }

  async function init() {
    const btn = document.getElementById("feedNewPost");
    if (!btn) return;

    const { url, key } = cfg();
    if (!url || !key) {
      setMessage("Supabase-Konfiguration fehlt.");
      await refresh();
      return;
    }

    try {
      const roles = await loadRoles();
      canManage = roles.some((r) => MANAGER_ROLES.has(r));
    } catch {
      canManage = false;
    }

    btn.classList.toggle("hidden", !canManage);
    btn.toggleAttribute("hidden", !canManage);
    if (canManage && !btn.dataset.bound) {
      btn.dataset.bound = "1";
      btn.addEventListener("click", mountNewComposer);
    }

    await refresh();
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", init);
})();
