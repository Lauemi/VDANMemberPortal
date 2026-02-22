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
    { value: "nur_mitglieder", label: "Nur Mitglieder" },
  ];

  let canManage = false;
  const forcedCategory = String(window.__VDAN_FEED_CATEGORY || "").trim().toLowerCase() || "";
  const isForcedCategory = Boolean(forcedCategory);

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
    const categoryFilter = isForcedCategory ? `&category=eq.${encodeURIComponent(forcedCategory)}` : "";
    const rows = await sb(`/rest/v1/${TABLE}?select=id,author_id,updated_by,title,body,category,created_at,updated_at,${MEDIA_TABLE}(id,sort_order,storage_bucket,storage_path,width,height)${categoryFilter}&order=created_at.desc`, { method: "GET" }, true);
    return Array.isArray(rows) ? rows : [];
  }

  function weekRangeIso() {
    const now = new Date();
    const day = (now.getDay() + 6) % 7;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - day);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return { nowIso: now.toISOString(), weekStartIso: weekStart.toISOString(), weekEndIso: weekEnd.toISOString() };
  }

  async function listWeekCalendarItems() {
    const { nowIso, weekEndIso } = weekRangeIso();
    const [terms, works] = await Promise.all([
      sb(`/rest/v1/club_events?select=id,title,description,location,starts_at,ends_at,status&status=eq.published&starts_at=lte.${encodeURIComponent(weekEndIso)}&ends_at=gte.${encodeURIComponent(nowIso)}&order=starts_at.asc`, { method: "GET" }),
      sb(`/rest/v1/work_events?select=id,title,description,location,starts_at,ends_at,status&status=eq.published&starts_at=lte.${encodeURIComponent(weekEndIso)}&ends_at=gte.${encodeURIComponent(nowIso)}&order=starts_at.asc`, { method: "GET" }),
    ]);

    const t = (Array.isArray(terms) ? terms : []).map((row) => ({ ...row, source: "termin", sourceLabel: "Termin" }));
    const w = (Array.isArray(works) ? works : []).map((row) => ({ ...row, source: "arbeitseinsatz", sourceLabel: "Arbeitseinsatz" }));
    return [...t, ...w].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }

  async function createPost(payload) {
    const uid = currentUserId();
    if (!uid) throw new Error("Nicht eingeloggt");

    const rows = await sb(`/rest/v1/${TABLE}`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([{ ...payload, author_id: uid, updated_by: uid }]),
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
    const uid = currentUserId();
    const rows = await sb(`/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...payload, updated_by: uid || null }),
    }, true);

    return rows?.[0];
  }

  async function deletePost(id) {
    await sb(`/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    }, true);
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

  async function canvasToBlob(canvas, mime, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
  }

  async function transcodeImage(file) {
    const bitmap = await imageToBitmap(file);
    let width = Math.max(1, Math.round(bitmap.width * Math.min(1, MAX_LONG_EDGE / Math.max(bitmap.width, bitmap.height))));
    let height = Math.max(1, Math.round(bitmap.height * Math.min(1, MAX_LONG_EDGE / Math.max(bitmap.width, bitmap.height))));
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });

    let bestBlob = null;
    let bestWidth = width;
    let bestHeight = height;
    let bestMime = "image/webp";

    for (let pass = 0; pass < 5; pass += 1) {
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);

      let quality = 0.9;
      let mime = "image/webp";
      let blob = await canvasToBlob(canvas, mime, quality);
      if (!blob) {
        mime = "image/jpeg";
        blob = await canvasToBlob(canvas, mime, quality);
      }

      while (blob && blob.size > MAX_FILE_BYTES && quality > 0.35) {
        quality -= 0.07;
        blob = await canvasToBlob(canvas, mime, quality);
        if (!blob && mime === "image/webp") {
          mime = "image/jpeg";
          blob = await canvasToBlob(canvas, mime, quality);
        }
      }

      if (blob && (!bestBlob || blob.size < bestBlob.size)) {
        bestBlob = blob;
        bestWidth = width;
        bestHeight = height;
        bestMime = mime;
      }

      if (blob && blob.size <= MAX_FILE_BYTES) {
        return { blob, width, height, bytes: blob.size, mime };
      }

      width = Math.max(640, Math.round(width * 0.82));
      height = Math.max(360, Math.round(height * 0.82));
    }

    if (!bestBlob) throw new Error("Bildverarbeitung fehlgeschlagen");
    if (bestBlob.size > MAX_FILE_BYTES) {
      throw new Error(`Bild ${file.name} ist zu groß. Bitte enger zuschneiden.`);
    }

    return { blob: bestBlob, width: bestWidth, height: bestHeight, bytes: bestBlob.size, mime: bestMime };
  }

  async function uploadMedia(postId, files) {
    if (!files.length) return [];

    const uid = currentUserId();
    if (!uid) throw new Error("Nicht eingeloggt");

    const { url, key } = cfg();
    const mediaRows = [];

    for (let i = 0; i < files.length; i += 1) {
      const processed = await transcodeImage(files[i]);
      const ext = processed.mime === "image/jpeg" ? "jpg" : "webp";
      const path = `posts/${postId}/${Date.now()}-${i + 1}.${ext}`;
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

  function buildComposer(initial = {}, submitLabel = "Speichern", withMedia = false, fixedCategory = "") {
    const hasFixedCategory = Boolean(fixedCategory);
    const normalizedCategory = hasFixedCategory ? fixedCategory : (initial.category || "info");
    const wrap = document.createElement("div");
    wrap.className = "feed-composer";
    wrap.innerHTML = `
      <label>
        <span>Überschrift</span>
        <input type="text" name="title" maxlength="160" value="${escapeHtml(initial.title || "")}" required />
      </label>
      <label>
        <span>Kategorie</span>
        ${hasFixedCategory
          ? `
            <input type="hidden" name="category" value="${escapeHtml(normalizedCategory)}" />
            <input type="text" value="${escapeHtml(categoryLabel(normalizedCategory))}" disabled />
          `
          : `
            <select name="category">
              ${CATEGORY_OPTIONS.map((o) => `<option value="${o.value}" ${normalizedCategory === o.value ? "selected" : ""}>${o.label}</option>`).join("")}
            </select>
          `}
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

  function setFormSaving(form, isSaving, savingLabel = "Speichern...") {
    if (!form) return;
    if (isSaving) {
      form.dataset.saving = "1";
    } else {
      delete form.dataset.saving;
    }
    const submitBtn = form.querySelector('button[type="submit"]');
    const cancelBtn = form.querySelector("[data-cancel]");
    if (submitBtn) {
      if (!submitBtn.dataset.defaultLabel) submitBtn.dataset.defaultLabel = submitBtn.textContent || "Speichern";
      submitBtn.disabled = Boolean(isSaving);
      submitBtn.textContent = isSaving ? savingLabel : submitBtn.dataset.defaultLabel;
    }
    if (cancelBtn) cancelBtn.disabled = Boolean(isSaving);
  }

  async function refresh() {
    const list = document.getElementById("feedList");
    if (!list) return;
    list.innerHTML = "";

    try {
      const weekItems = isForcedCategory ? [] : await listWeekCalendarItems().catch(() => []);
      if (weekItems.length) {
        const section = document.createElement("article");
        section.className = "feed-post";
        section.innerHTML = `
          <header class="feed-post__head">
            <h3>Diese Woche: Termine & Arbeitseinsätze</h3>
            <div class="feed-post__meta">
              <a class="feed-btn feed-btn--ghost" href="/termine.html/">Alle Termine</a>
            </div>
          </header>
          <div class="feed-calendar-list">
            ${weekItems.map((row) => `
              <div class="feed-calendar-item">
                <span class="feed-chip">${escapeHtml(row.sourceLabel)}</span>
                <strong>${escapeHtml(row.title)}</strong>
                <span class="small">${escapeHtml(formatDate(row.starts_at))} - ${escapeHtml(formatDate(row.ends_at))}</span>
                <span class="small">${escapeHtml(row.location || "Ort offen")}</span>
              </div>
            `).join("")}
          </div>
        `;
        list.appendChild(section);
      }

      const posts = await listPosts();
      if (!posts.length) {
        const empty = document.createElement("article");
        empty.className = "feed-post";
        empty.innerHTML = `<h3>Noch keine Beiträge</h3><p class="small">Mit "Neuer Post" den ersten Beitrag erstellen.</p>`;
        list.appendChild(empty);
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
              ${canManage ? '<button class="feed-btn feed-btn--ghost" type="button" data-delete>Löschen</button>' : ""}
            </div>
          </header>
          ${mediaHtml}
          <p class="feed-post__body">${escapeHtml(post.body).replace(/\n/g, "<br>")}</p>
          <div class="feed-edit-slot"></div>
        `;

        if (canManage) {
          article.querySelector("[data-edit]")?.addEventListener("click", () => mountEditComposer(article, post));
          article.querySelector("[data-delete]")?.addEventListener("click", async () => {
            if (!window.confirm("Post wirklich löschen?")) return;
            setMessage("Löscht...");
            try {
              await deletePost(post.id);
              setMessage("Post gelöscht.");
              await refresh();
            } catch (err) {
              setMessage(err?.message || "Löschen fehlgeschlagen");
            }
          });
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
    const initial = isForcedCategory ? { category: forcedCategory } : {};
    form.appendChild(buildComposer(initial, "Post veröffentlichen", true, isForcedCategory ? forcedCategory : ""));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (form.dataset.saving === "1") return;
      setMessage("Speichert...");
      setFormSaving(form, true, "Speichert...");
      try {
        const payload = payloadFromComposer(form);
        const files = mediaFilesFromComposer(form);

        const post = await createPost(payload);
        if (!post?.id) throw new Error("Post konnte nicht erstellt werden");

        let mediaError = null;
        if (files.length) {
          try {
            const mediaRows = await uploadMedia(post.id, files);
            await createPostMediaRows(mediaRows);
          } catch (err) {
            mediaError = err;
          }
        }

        host.innerHTML = "";
        await refresh();
        if (mediaError) {
          setMessage(`Beitrag veröffentlicht, aber Bild-Upload fehlgeschlagen: ${mediaError?.message || "Unbekannter Fehler"}`);
        } else {
          setMessage("Beitrag veröffentlicht.");
        }
      } catch (err) {
        setMessage(err?.message || "Speichern fehlgeschlagen");
      } finally {
        setFormSaving(form, false);
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
    form.appendChild(buildComposer(post, "Änderungen speichern", false, isForcedCategory ? forcedCategory : ""));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (form.dataset.saving === "1") return;
      setMessage("Aktualisiert...");
      setFormSaving(form, true, "Speichert...");
      try {
        const payload = payloadFromComposer(form);
        await updatePost(post.id, payload);
        setMessage("Beitrag aktualisiert.");
        await refresh();
      } catch (err) {
        setMessage(err?.message || "Update fehlgeschlagen");
      } finally {
        setFormSaving(form, false);
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
