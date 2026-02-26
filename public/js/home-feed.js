;(() => {
  const OFFLINE_NS = "home_feed";
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
  let managerProfiles = [];
  let pendingPosts = [];
  const forcedCategory = String(document.querySelector("[data-feed-category]")?.getAttribute("data-feed-category") || "").trim().toLowerCase() || "";
  const isForcedCategory = Boolean(forcedCategory);
  const isYouthFeed = forcedCategory === "jugend";
  const YOUTH_TERM = "jugend";

  function titleHasYouthTerm(title) {
    return String(title || "").toLowerCase().includes(YOUTH_TERM);
  }

  function isYouthItem(row) {
    return Boolean(row?.is_youth) || titleHasYouthTerm(row?.title);
  }

  function filterByFeedCategory(rows) {
    const list = Array.isArray(rows) ? rows : [];
    return list.filter((row) => (isYouthFeed ? isYouthItem(row) : !isYouthItem(row)));
  }

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
      const e = new Error(err?.message || err?.hint || err?.error_description || `Request failed (${res.status})`);
      e.status = res.status;
      throw e;
    }
    return res.json().catch(() => ({}));
  }

  function queueAction(type, payload) {
    return window.VDAN_OFFLINE_SYNC?.enqueue?.(OFFLINE_NS, { type, payload });
  }

  async function loadPendingPosts() {
    const rows = await window.VDAN_OFFLINE_SYNC?.cacheGet?.(OFFLINE_NS, "pending_posts", []);
    pendingPosts = Array.isArray(rows) ? rows : [];
  }

  async function savePendingPosts() {
    await window.VDAN_OFFLINE_SYNC?.cacheSet?.(OFFLINE_NS, "pending_posts", pendingPosts);
  }

  function addPendingPost(payload) {
    const uid = currentUserId();
    const localId = `local:post:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    pendingPosts.unshift({
      id: localId,
      author_id: uid,
      updated_by: uid,
      title: payload.title,
      body: payload.body,
      category: payload.category,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _offline_pending: true,
      feed_post_media: Array.isArray(payload.media_previews)
        ? payload.media_previews.map((m, i) => ({
            id: `local:media:${i + 1}`,
            sort_order: i + 1,
            storage_bucket: "",
            storage_path: "",
            width: m.width || null,
            height: m.height || null,
            data_url: m.data_url || "",
          }))
        : [],
    });
    savePendingPosts().catch(() => {});
    return localId;
  }

  function dataUrlToBlob(dataUrl) {
    const [head, b64] = String(dataUrl || "").split(",");
    const mime = /data:([^;]+);base64/i.exec(head || "")?.[1] || "application/octet-stream";
    const bytes = atob(b64 || "");
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Konnte Bild nicht lesen"));
      reader.readAsDataURL(blob);
    });
  }

  async function buildOfflineMediaPayload(files) {
    const out = [];
    for (let i = 0; i < files.length; i += 1) {
      const processed = await transcodeImage(files[i]);
      out.push({
        data_url: await blobToDataUrl(processed.blob),
        width: processed.width,
        height: processed.height,
        bytes: processed.bytes,
        mime: processed.mime,
      });
    }
    return out;
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

  function ensureImageDialog() {
    let dlg = document.getElementById("feedImageDialog");
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "feedImageDialog";
    dlg.className = "feed-image-dialog";
    dlg.innerHTML = `
      <form method="dialog" class="feed-image-dialog__inner">
        <button type="submit" class="feed-image-dialog__close" aria-label="Schließen">×</button>
        <img id="feedImageDialogImg" class="feed-image-dialog__img" alt="Beitragsbild groß" />
      </form>
    `;
    dlg.addEventListener("click", (e) => {
      const rect = dlg.getBoundingClientRect();
      const inDialog =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inDialog) dlg.close();
    });
    document.body.appendChild(dlg);
    return dlg;
  }

  function openImageDialog(src, alt = "Beitragsbild groß") {
    const dlg = ensureImageDialog();
    const img = document.getElementById("feedImageDialogImg");
    if (!img) return;
    img.src = String(src || "");
    img.alt = String(alt || "Beitragsbild groß");
    if (!dlg.open) dlg.showModal();
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

  async function loadManagerProfiles() {
    const roleRows = await sb("/rest/v1/user_roles?select=user_id,role&role=in.(admin,vorstand)", { method: "GET" }, true);
    const ids = [...new Set((Array.isArray(roleRows) ? roleRows : []).map((r) => String(r.user_id || "").trim()).filter(Boolean))];
    if (!ids.length) return [];
    const inList = ids.map((id) => `"${id}"`).join(",");
    const profileRows = await sb(`/rest/v1/profiles?select=id,display_name,email,member_no&id=in.(${inList})&order=display_name.asc`, { method: "GET" }, true);
    return (Array.isArray(profileRows) ? profileRows : []).map((p) => ({
      id: p.id,
      label: String(p.display_name || p.email || p.member_no || p.id || "").trim(),
    }));
  }

  async function listPosts() {
    const categoryFilter = isForcedCategory ? `&category=eq.${encodeURIComponent(forcedCategory)}` : "";
    const cacheKey = `posts:${isForcedCategory ? forcedCategory : "all"}`;
    try {
      const rows = await sb(`/rest/v1/${TABLE}?select=id,author_id,updated_by,title,body,category,created_at,updated_at,${MEDIA_TABLE}(id,sort_order,storage_bucket,storage_path,width,height)${categoryFilter}&order=created_at.desc`, { method: "GET" }, true);
      const list = Array.isArray(rows) ? rows : [];
      await window.VDAN_OFFLINE_SYNC?.cacheSet?.(OFFLINE_NS, cacheKey, list);
      return [...pendingPosts, ...list];
    } catch (err) {
      const cached = await window.VDAN_OFFLINE_SYNC?.cacheGet?.(OFFLINE_NS, cacheKey, []);
      const list = Array.isArray(cached) ? cached : [];
      return [...pendingPosts, ...list];
    }
  }

  async function listUpcomingTerms() {
    const nowIso = new Date().toISOString();
    const rows = await sb(`/rest/v1/club_events?select=id,title,description,location,starts_at,ends_at,status,is_youth&status=eq.published&ends_at=gte.${encodeURIComponent(nowIso)}&order=starts_at.asc&limit=40`, { method: "GET" });
    return filterByFeedCategory(rows);
  }

  async function listUpcomingWorkEvents() {
    const nowIso = new Date().toISOString();
    const rows = await sb(`/rest/v1/work_events?select=id,title,description,location,starts_at,ends_at,status,is_youth&status=eq.published&ends_at=gte.${encodeURIComponent(nowIso)}&order=starts_at.asc&limit=40`, { method: "GET" });
    return filterByFeedCategory(rows);
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
    const [termsRaw, worksRaw] = await Promise.all([
      sb(`/rest/v1/club_events?select=id,title,description,location,starts_at,ends_at,status,is_youth&status=eq.published&starts_at=lte.${encodeURIComponent(weekEndIso)}&ends_at=gte.${encodeURIComponent(nowIso)}&order=starts_at.asc`, { method: "GET" }),
      sb(`/rest/v1/work_events?select=id,title,description,location,starts_at,ends_at,status,is_youth&status=eq.published&starts_at=lte.${encodeURIComponent(weekEndIso)}&ends_at=gte.${encodeURIComponent(nowIso)}&order=starts_at.asc`, { method: "GET" }),
    ]);

    const terms = filterByFeedCategory(termsRaw);
    const works = filterByFeedCategory(worksRaw);

    const t = terms.map((row) => ({ ...row, source: "termin", sourceLabel: isYouthItem(row) ? "Termin Jugend" : "Termin" }));
    const w = works.map((row) => ({ ...row, source: "arbeitseinsatz", sourceLabel: isYouthItem(row) ? "Arbeitseinsatz Jugend" : "Arbeitseinsatz" }));
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

  async function createTermEvent(payload) {
    try {
      return await sb("/rest/v1/rpc/term_event_create", { method: "POST", body: JSON.stringify(payload) }, true);
    } catch (err) {
      if (Object.prototype.hasOwnProperty.call(payload || {}, "p_is_youth")) {
        const fallback = { ...payload };
        delete fallback.p_is_youth;
        return sb("/rest/v1/rpc/term_event_create", { method: "POST", body: JSON.stringify(fallback) }, true);
      }
      throw err;
    }
  }

  async function publishTermEvent(eventId) {
    return sb("/rest/v1/rpc/term_event_publish", { method: "POST", body: JSON.stringify({ p_event_id: eventId }) }, true);
  }

  async function createWorkEvent(payload) {
    return sb("/rest/v1/rpc/work_event_create", { method: "POST", body: JSON.stringify(payload) }, true);
  }

  async function publishWorkEvent(eventId) {
    return sb("/rest/v1/rpc/work_event_publish", { method: "POST", body: JSON.stringify({ p_event_id: eventId }) }, true);
  }

  async function assignWorkEventLead(eventId, leadUserId) {
    if (!eventId || !leadUserId) return;
    const uid = currentUserId();
    await sb("/rest/v1/work_event_leads", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        work_event_id: eventId,
        user_id: leadUserId,
        assigned_by: uid || null,
      }),
    }, true);
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

  async function uploadOfflineMediaFromQueue(items = [], pathPrefix = "queued") {
    if (!Array.isArray(items) || !items.length) return [];
    const uid = currentUserId();
    if (!uid) throw new Error("Nicht eingeloggt");
    const { url, key } = cfg();
    const token = session()?.access_token;
    if (!token) throw new Error("Keine Session");

    const uploads = [];
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      const blob = dataUrlToBlob(it.data_url);
      const ext = String(it.mime || "").includes("jpeg") ? "jpg" : "webp";
      const path = `posts/${pathPrefix}/${Date.now()}-${i + 1}.${ext}`;
      const encodedPath = path.split("/").map((s) => encodeURIComponent(s)).join("/");
      const res = await fetch(`${url}/storage/v1/object/${MEDIA_BUCKET}/${encodedPath}`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${token}`,
          "Content-Type": blob.type || "image/webp",
          "x-upsert": "false",
        },
        body: blob,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Storage Upload fehlgeschlagen (${res.status})`);
      }
      uploads.push({
        storage_bucket: MEDIA_BUCKET,
        storage_path: path,
        photo_bytes: Number(it.bytes || blob.size || 0),
        width: it.width || null,
        height: it.height || null,
        mime_type: it.mime || blob.type || "image/webp",
      });
    }
    return uploads;
  }

  async function flushOfflineQueue() {
    if (!window.VDAN_OFFLINE_SYNC?.flush) return;
    await window.VDAN_OFFLINE_SYNC.flush(OFFLINE_NS, async (op) => {
      const p = op?.payload || {};
      if (op?.type === "create_term_event") {
        const created = await createTermEvent(p);
        const eventId = created?.id || (Array.isArray(created) ? created[0]?.id : null);
        if (p.publishNow && eventId) await publishTermEvent(eventId);
        return;
      }
      if (op?.type === "create_work_event") {
        const created = await createWorkEvent(p);
        const eventId = created?.id || (Array.isArray(created) ? created[0]?.id : null);
        if (!eventId) throw new Error("Arbeitseinsatz konnte nicht erstellt werden.");
        if (p.leadUserId) await assignWorkEventLead(eventId, p.leadUserId);
        if (p.publishNow) await publishWorkEvent(eventId);
        return;
      }
      if (op?.type === "create_post") {
        const post = await createPost(p.payload || {});
        const media = Array.isArray(p.media) ? p.media : [];
        if (post?.id && media.length) {
          const uploaded = await uploadOfflineMediaFromQueue(media, `queued-${currentUserId() || "anon"}`);
          const uid = currentUserId();
          await createPostMediaRows(uploaded.map((m, i) => ({
            ...m,
            post_id: post.id,
            sort_order: i + 1,
            created_by: uid || post.author_id || post.updated_by,
          })));
        }
        if (p.local_id) {
          pendingPosts = pendingPosts.filter((x) => String(x.id) !== String(p.local_id));
          await savePendingPosts();
        }
        return;
      }
      if (op?.type === "update_post") {
        await updatePost(p.id, p.payload || {});
        return;
      }
      if (op?.type === "delete_post") {
        await deletePost(p.id);
      }
    });
  }

  function categoryLabel(value) {
    const hit = CATEGORY_OPTIONS.find((x) => x.value === value);
    return hit ? hit.label : value;
  }

  function toIsoFromLocalInput(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  function defaultDateTimeLocal(hoursOffset = 24) {
    const d = new Date();
    d.setHours(d.getHours() + hoursOffset);
    d.setMinutes(0, 0, 0);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function imageToBitmap(file) {
    // iOS Safari can expose createImageBitmap but still fail for some camera formats.
    // Fall back to Image decoding when createImageBitmap rejects.
    if (window.createImageBitmap) {
      try {
        return await window.createImageBitmap(file);
      } catch {
        // fallback below
      }
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

  async function uploadMediaFiles(files, onProgress = null, pathPrefix = "pending") {
    if (!files.length) return [];

    const uid = currentUserId();
    if (!uid) throw new Error("Nicht eingeloggt");

    const { url, key } = cfg();
    const uploads = [];

    const totalSteps = Math.max(1, files.length * 2);
    let step = 0;

    for (let i = 0; i < files.length; i += 1) {
      if (typeof onProgress === "function") {
        onProgress({
          percent: Math.min(95, Math.round((step / totalSteps) * 100)),
          text: `Bild ${i + 1}/${files.length}: Verarbeitung...`,
        });
      }
      const processed = await transcodeImage(files[i]);
      step += 1;
      if (typeof onProgress === "function") {
        onProgress({
          percent: Math.min(95, Math.round((step / totalSteps) * 100)),
          text: `Bild ${i + 1}/${files.length}: Upload...`,
        });
      }
      const ext = processed.mime === "image/jpeg" ? "jpg" : "webp";
      const path = `posts/${pathPrefix}/${Date.now()}-${i + 1}.${ext}`;
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

      uploads.push({
        storage_bucket: MEDIA_BUCKET,
        storage_path: path,
        photo_bytes: processed.bytes,
        width: processed.width,
        height: processed.height,
        mime_type: processed.mime,
      });
      step += 1;
      if (typeof onProgress === "function") {
        onProgress({
          percent: Math.min(98, Math.round((step / totalSteps) * 100)),
          text: `Bild ${i + 1}/${files.length}: Hochgeladen`,
        });
      }
    }

    return uploads;
  }

  async function deleteUploadedMedia(items = []) {
    if (!Array.isArray(items) || !items.length) return;
    const { url, key } = cfg();
    const token = session()?.access_token;
    if (!url || !key || !token) return;

    await Promise.all(items.map(async (m) => {
      const path = String(m?.storage_path || "").trim();
      if (!path) return;
      const encodedPath = path.split("/").map((s) => encodeURIComponent(s)).join("/");
      try {
        await fetch(`${url}/storage/v1/object/${MEDIA_BUCKET}/${encodedPath}`, {
          method: "DELETE",
          headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // best effort cleanup
      }
    }));
  }

  function buildComposer(initial = {}, submitLabel = "Speichern", withMedia = false, fixedCategory = "") {
    const hasFixedCategory = Boolean(fixedCategory);
    const normalizedCategory = hasFixedCategory ? fixedCategory : (initial.category || "info");
    const managerOpts = managerProfiles.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.label)}</option>`).join("");
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
      <label data-mode="post">
        <span>Text</span>
        <textarea name="body" rows="6" maxlength="10000" required>${escapeHtml(initial.body || "")}</textarea>
      </label>
      ${withMedia ? `
      <label class="feed-media-picker" data-mode="post">
        <span class="feed-media-picker__title">Bilder (max. 2)</span>
        <span class="feed-media-picker__hint">Tippen zum Auswählen. Bilder werden automatisch verkleinert.</span>
        <input class="feed-media-picker__input" type="file" name="media" accept="image/*" multiple />
      </label>` : ""}
      ${withMedia ? `<div class="feed-media-preview" data-mode="post" data-media-preview hidden></div>` : ""}
      <div class="feed-mode-panel" data-mode="termin" hidden>
        <div class="grid cols2">
          <label class="feed-field--full">
            <span>Jugend-Termin</span>
            <div class="feed-youth-switch">
              <input type="hidden" name="term_is_youth" value="0" />
              <button type="button" class="feed-btn feed-btn--ghost" data-term-youth-toggle>Jugend</button>
              <span class="small">Wenn aktiv, erscheint der Termin nur im Jugend-Feed.</span>
            </div>
          </label>
          <label>
            <span>Ort</span>
            <input type="text" name="term_location" maxlength="160" />
          </label>
          <label>
            <span>Start</span>
            <input type="datetime-local" name="term_starts_at" value="${defaultDateTimeLocal(24)}" />
          </label>
          <label>
            <span>Ende</span>
            <input type="datetime-local" name="term_ends_at" value="${defaultDateTimeLocal(26)}" />
          </label>
          <label class="feed-field--full">
            <span>Beschreibung</span>
            <textarea name="term_description" rows="4"></textarea>
          </label>
          <label class="feed-field--full feed-check">
            <input type="checkbox" name="term_publish_now" checked />
            <span>Direkt veröffentlichen</span>
          </label>
        </div>
      </div>
      <div class="feed-mode-panel" data-mode="arbeitseinsatz" hidden>
        <div class="grid cols2">
          <label class="feed-field--full">
            <span>Jugend-Arbeitseinsatz</span>
            <div class="feed-youth-switch">
              <input type="hidden" name="work_is_youth" value="0" />
              <button type="button" class="feed-btn feed-btn--ghost" data-work-youth-toggle>Jugend</button>
              <span class="small">Wenn aktiv, erscheint der Einsatz nur im Jugend-Feed.</span>
            </div>
          </label>
          <label>
            <span>Ort</span>
            <input type="text" name="work_location" maxlength="160" />
          </label>
          <label>
            <span>Leiter (Admin/Vorstand)</span>
            <select name="work_lead_user_id">
              <option value="">Bitte wählen</option>
              ${managerOpts}
            </select>
          </label>
          <label>
            <span>Start</span>
            <input type="datetime-local" name="work_starts_at" value="${defaultDateTimeLocal(24)}" />
          </label>
          <label>
            <span>Ende</span>
            <input type="datetime-local" name="work_ends_at" value="${defaultDateTimeLocal(27)}" />
          </label>
          <label>
            <span>Max. Teilnehmer (optional)</span>
            <input type="number" name="work_max_participants" min="1" step="1" />
          </label>
          <label class="feed-field--full">
            <span>Beschreibung</span>
            <textarea name="work_description" rows="4"></textarea>
          </label>
          <label class="feed-field--full feed-check">
            <input type="checkbox" name="work_publish_now" checked />
            <span>Direkt veröffentlichen</span>
          </label>
        </div>
      </div>
      <div class="feed-composer__actions">
        <button class="feed-btn" type="submit">${submitLabel}</button>
        <button class="feed-btn feed-btn--ghost" type="button" data-cancel>Abbrechen</button>
      </div>
      <div class="small feed-upload-progress" data-upload-progress-wrap hidden>
        <progress data-upload-progress value="0" max="100"></progress>
        <div data-upload-progress-text></div>
      </div>
    `;
    return wrap;
  }

  function composerCategory(form) {
    return String(form.querySelector('[name="category"]')?.value || "info").trim();
  }

  function syncComposerMode(form) {
    const cat = composerCategory(form);
    const isPostMode = !["termin", "arbeitseinsatz"].includes(cat);

    form.querySelectorAll("[data-mode]").forEach((el) => {
      const mode = String(el.getAttribute("data-mode") || "");
      const show = (mode === "post" && isPostMode) || mode === cat;
      el.toggleAttribute("hidden", !show);
      if (show) el.removeAttribute("hidden");
      else el.setAttribute("hidden", "");
    });

    const bodyEl = form.querySelector('[name="body"]');
    if (bodyEl) {
      if (isPostMode) bodyEl.setAttribute("required", "");
      else bodyEl.removeAttribute("required");
    }

    const leadEl = form.querySelector('[name="work_lead_user_id"]');
    if (leadEl) {
      if (cat === "arbeitseinsatz") leadEl.setAttribute("required", "");
      else leadEl.removeAttribute("required");
    }
  }

  function initWorkYouthToggle(form) {
    const btn = form.querySelector("[data-work-youth-toggle]");
    const hidden = form.querySelector('[name="work_is_youth"]');
    if (!btn || !hidden || btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";

    const paint = () => {
      const active = String(hidden.value) === "1";
      btn.style.background = active ? "#1f7a3b" : "";
      btn.style.borderColor = active ? "#1f7a3b" : "";
      btn.style.color = active ? "#fff" : "";
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    };

    btn.addEventListener("click", () => {
      hidden.value = String(hidden.value) === "1" ? "0" : "1";
      paint();
    });

    if (isYouthFeed) {
      hidden.value = "1";
      btn.disabled = true;
    }

    paint();
  }

  function initTermYouthToggle(form) {
    const btn = form.querySelector("[data-term-youth-toggle]");
    const hidden = form.querySelector('[name="term_is_youth"]');
    if (!btn || !hidden || btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";

    const paint = () => {
      const active = String(hidden.value) === "1";
      btn.style.background = active ? "#1f7a3b" : "";
      btn.style.borderColor = active ? "#1f7a3b" : "";
      btn.style.color = active ? "#fff" : "";
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    };

    btn.addEventListener("click", () => {
      hidden.value = String(hidden.value) === "1" ? "0" : "1";
      paint();
    });

    if (isYouthFeed) {
      hidden.value = "1";
      btn.disabled = true;
    }

    paint();
  }

  function payloadFromComposer(form) {
    const title = String(form.querySelector('[name="title"]')?.value || "").trim();
    const category = String(form.querySelector('[name="category"]')?.value || "info").trim();
    const body = String(form.querySelector('[name="body"]')?.value || "").trim();

    if (!title) throw new Error("Überschrift fehlt");
    if (!body) throw new Error("Text fehlt");
    return { title, category, body };
  }

  function termPayloadFromComposer(form) {
    const title = String(form.querySelector('[name="title"]')?.value || "").trim();
    if (!title) throw new Error("Überschrift fehlt");
    const startsAt = toIsoFromLocalInput(String(form.querySelector('[name="term_starts_at"]')?.value || ""));
    const endsAt = toIsoFromLocalInput(String(form.querySelector('[name="term_ends_at"]')?.value || ""));
    if (!startsAt || !endsAt) throw new Error("Start/Ende sind Pflichtfelder.");
    return {
      p_title: title,
      p_description: String(form.querySelector('[name="term_description"]')?.value || "").trim() || null,
      p_location: String(form.querySelector('[name="term_location"]')?.value || "").trim() || null,
      p_starts_at: startsAt,
      p_ends_at: endsAt,
      p_is_youth: String(form.querySelector('[name="term_is_youth"]')?.value || "0") === "1",
      publishNow: Boolean(form.querySelector('[name="term_publish_now"]')?.checked),
    };
  }

  function workPayloadFromComposer(form) {
    const title = String(form.querySelector('[name="title"]')?.value || "").trim();
    if (!title) throw new Error("Überschrift fehlt");
    const startsAt = toIsoFromLocalInput(String(form.querySelector('[name="work_starts_at"]')?.value || ""));
    const endsAt = toIsoFromLocalInput(String(form.querySelector('[name="work_ends_at"]')?.value || ""));
    if (!startsAt || !endsAt) throw new Error("Start/Ende sind Pflichtfelder.");
    const maxRaw = String(form.querySelector('[name="work_max_participants"]')?.value || "").trim();
    const leadUserId = String(form.querySelector('[name="work_lead_user_id"]')?.value || "").trim();
    if (!leadUserId) throw new Error("Bitte einen Leiter auswählen.");
    return {
      p_title: title,
      p_description: String(form.querySelector('[name="work_description"]')?.value || "").trim() || null,
      p_location: String(form.querySelector('[name="work_location"]')?.value || "").trim() || null,
      p_starts_at: startsAt,
      p_ends_at: endsAt,
      p_max_participants: maxRaw ? Number(maxRaw) : null,
      p_is_youth: String(form.querySelector('[name="work_is_youth"]')?.value || "0") === "1",
      leadUserId,
      publishNow: Boolean(form.querySelector('[name="work_publish_now"]')?.checked),
    };
  }

  function mediaFilesFromComposer(form, maxFiles = MAX_MEDIA_FILES) {
    const input = form.querySelector('[name="media"]');
    const files = Array.from(input?.files || []);
    if (files.length > maxFiles) {
      throw new Error(`Maximal ${maxFiles} Bilder in diesem Schritt erlaubt.`);
    }
    return files;
  }

  function renderUploadedMediaPreview(form, items = []) {
    const box = form?.querySelector("[data-media-preview]");
    if (!box) return;
    if (!Array.isArray(items) || !items.length) {
      box.innerHTML = "";
      box.setAttribute("hidden", "");
      return;
    }
    box.innerHTML = items.map((m, i) => {
      const src = m.data_url || storagePublicUrl(m.storage_bucket || MEDIA_BUCKET, m.storage_path);
      const sizeKb = Math.round((Number(m.photo_bytes || 0) / 1024) * 10) / 10;
      return `
        <figure class="feed-media-preview__item">
          <img class="feed-media-preview__img" src="${src}" alt="Upload Vorschau ${i + 1}" />
          <figcaption class="small">Upload fertig (${sizeKb} KB)</figcaption>
        </figure>
      `;
    }).join("");
    box.removeAttribute("hidden");
  }

  function clearPreparedMedia(form) {
    form._preparedMedia = [];
    form._preparedMediaOffline = [];
    renderUploadedMediaPreview(form, []);
  }

  async function handleComposerMediaSelection(form, maxFiles, prefix) {
    const input = form.querySelector('[name="media"]');
    if (!input) return;

    form.dataset.uploading = "1";
    try {
      const files = Array.from(input.files || []);
      const oldPrepared = Array.isArray(form._preparedMedia) ? form._preparedMedia : [];
      if (!files.length) {
        await deleteUploadedMedia(oldPrepared);
        clearPreparedMedia(form);
        return;
      }

      if (files.length > maxFiles) {
        input.value = "";
        throw new Error(`Maximal ${maxFiles} Bilder erlaubt.`);
      }

       if (!navigator.onLine) {
        await deleteUploadedMedia(oldPrepared);
        clearPreparedMedia(form);
        form._preparedMediaOffline = files;
        setUploadProgress(form, 100, "Offline: Bilder lokal vorgemerkt.", true);
        setFormSaving(form, false);
        return;
      }

      setFormSaving(form, true, "Upload läuft...");
      setUploadProgress(form, 5, "Bilder werden hochgeladen...", true);
      await deleteUploadedMedia(oldPrepared);
      clearPreparedMedia(form);
      const uploaded = await uploadMediaFiles(files, ({ percent, text }) => {
        setUploadProgress(form, percent, text, true);
      }, prefix);
      form._preparedMedia = uploaded;
      renderUploadedMediaPreview(form, uploaded);
      setUploadProgress(form, 100, "Upload abgeschlossen.", true);
      setFormSaving(form, false);
    } finally {
      delete form.dataset.uploading;
    }
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

  function setUploadProgress(form, percent = 0, text = "", show = false) {
    if (!form) return;
    const wrap = form.querySelector("[data-upload-progress-wrap]");
    const bar = form.querySelector("[data-upload-progress]");
    const msg = form.querySelector("[data-upload-progress-text]");
    if (wrap) {
      if (show) wrap.removeAttribute("hidden");
      else wrap.setAttribute("hidden", "");
    }
    if (bar) bar.value = Math.max(0, Math.min(100, Number(percent) || 0));
    if (msg) msg.textContent = String(text || "");
  }

  async function refresh() {
    const list = document.getElementById("feedList");
    if (!list) return;
    list.innerHTML = "";

    try {
      if (!isForcedCategory) {
        const [terms, works] = await Promise.all([
          listUpcomingTerms().catch(() => []),
          listUpcomingWorkEvents().catch(() => []),
        ]);
        const merged = [
          ...(Array.isArray(terms) ? terms : []).map((row) => ({ ...row, sourceLabel: isYouthItem(row) ? "Termin Jugend" : "Termin" })),
          ...(Array.isArray(works) ? works : []).map((row) => ({ ...row, sourceLabel: isYouthItem(row) ? "Arbeitseinsatz Jugend" : "Arbeitseinsatz" })),
        ].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

        if (merged.length) {
          const section = document.createElement("article");
          section.className = "feed-post";
          section.innerHTML = `
            <header class="feed-post__head">
              <h3>Nächste Termine & Arbeitseinsätze</h3>
              <div class="feed-post__meta">
                <a class="feed-btn feed-btn--ghost" href="/termine.html/">Alle Termine</a>
              </div>
            </header>
            <div class="feed-upcoming-slider" data-up-slider-wrap>
              <button type="button" class="feed-upcoming-nav feed-upcoming-nav--prev" data-up-prev aria-label="Vorheriger Eintrag">&#x2039;</button>
              <div class="feed-upcoming-stage" data-up-slider></div>
              <button type="button" class="feed-upcoming-nav feed-upcoming-nav--next" data-up-next aria-label="Nächster Eintrag">&#x203A;</button>
            </div>
          `;

          const slider = section.querySelector("[data-up-slider]");
          const prevBtn = section.querySelector("[data-up-prev]");
          const nextBtn = section.querySelector("[data-up-next]");
          let idx = 0;
          let touchStartX = null;

          const renderUpcoming = () => {
            const row = merged[idx];
            slider.innerHTML = `
              <div class="feed-calendar-item feed-calendar-item--upcoming" style="touch-action:pan-y; user-select:none;">
                <span class="feed-chip">${escapeHtml(row.sourceLabel)} ${idx + 1}/${merged.length}</span>
                <strong>${escapeHtml(row.title)}</strong>
                <span class="small">${escapeHtml(formatDate(row.starts_at))} - ${escapeHtml(formatDate(row.ends_at))}</span>
                <span class="small">${escapeHtml(row.location || "Ort offen")}</span>
                ${row.description ? `<p class="small">${escapeHtml(row.description)}</p>` : ""}
              </div>
            `;
          };

          const move = (dir) => {
            idx = (idx + dir + merged.length) % merged.length;
            renderUpcoming();
          };

          prevBtn?.addEventListener("click", () => move(-1));
          nextBtn?.addEventListener("click", () => move(1));
          slider?.addEventListener("touchstart", (e) => {
            touchStartX = e.touches?.[0]?.clientX ?? null;
          }, { passive: true });
          slider?.addEventListener("touchend", (e) => {
            if (touchStartX == null) return;
            const endX = e.changedTouches?.[0]?.clientX ?? touchStartX;
            const dx = endX - touchStartX;
            if (Math.abs(dx) >= 30) move(dx < 0 ? 1 : -1);
            touchStartX = null;
          }, { passive: true });

          renderUpcoming();
          list.appendChild(section);
        }
      }

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
                  <img class="feed-media__img" loading="lazy" src="${m.data_url || storagePublicUrl(m.storage_bucket, m.storage_path)}" alt="Beitragsbild" />
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
            <time class="feed-post__time" datetime="${escapeHtml(post.created_at)}">${escapeHtml(formatDate(post.created_at))}</time>
            <h3 class="feed-post__title">${escapeHtml(post.title)}</h3>
            <div class="feed-post__meta">
              <span class="feed-chip">${escapeHtml(categoryLabel(post.category))}</span>
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
              if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
                await queueAction("delete_post", { id: post.id });
                pendingPosts = pendingPosts.filter((p) => String(p.id) !== String(post.id));
                await savePendingPosts();
                setMessage("Offline gespeichert. Löschung wird bei Empfang übertragen.");
                await refresh();
                return;
              }
              setMessage(err?.message || "Löschen fehlgeschlagen");
            }
          });
        }

        article.querySelectorAll(".feed-media__img").forEach((imgEl) => {
          imgEl.addEventListener("click", () => openImageDialog(imgEl.src, imgEl.alt || "Beitragsbild groß"));
        });

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
    syncComposerMode(form);
    initWorkYouthToggle(form);
    initTermYouthToggle(form);
    form.querySelector('[name="category"]')?.addEventListener("change", () => syncComposerMode(form));
    form._preparedMedia = [];
    form.querySelector('[name="media"]')?.addEventListener("change", async () => {
      try {
        const prefix = `pending-${currentUserId() || "anon"}-${Date.now()}`;
        await handleComposerMediaSelection(form, MAX_MEDIA_FILES, prefix);
      } catch (err) {
        delete form.dataset.uploading;
        clearPreparedMedia(form);
        const input = form.querySelector('[name="media"]');
        if (input) input.value = "";
        setUploadProgress(form, 0, "", false);
        setFormSaving(form, false);
        setMessage(err?.message || "Bild-Upload fehlgeschlagen");
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (form.dataset.saving === "1") return;
      setMessage("Speichert...");
      setFormSaving(form, true, "Speichert...");
      setUploadProgress(form, 5, "Initialisiere...", true);
      try {
        const category = composerCategory(form);
        if (form.dataset.uploading === "1") throw new Error("Bitte warten, bis der Bild-Upload abgeschlossen ist.");
        if (category === "termin") {
          const payload = termPayloadFromComposer(form);
          try {
            const created = await createTermEvent(payload);
            const eventId = created?.id || (Array.isArray(created) ? created[0]?.id : null);
            if (payload.publishNow && eventId) await publishTermEvent(eventId);
            setUploadProgress(form, 100, "Fertig.", true);
            host.innerHTML = "";
            await refresh();
            setMessage(payload.publishNow ? "Termin erstellt und veröffentlicht." : "Termin erstellt.");
          } catch (err) {
            if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
              await queueAction("create_term_event", payload);
              setUploadProgress(form, 100, "Offline gespeichert.", true);
              host.innerHTML = "";
              setMessage("Termin offline gespeichert. Veröffentlichung/Sync folgt bei Empfang.");
              return;
            }
            throw err;
          }
        } else if (category === "arbeitseinsatz") {
          const payload = workPayloadFromComposer(form);
          try {
            const created = await createWorkEvent(payload);
            const eventId = created?.id || (Array.isArray(created) ? created[0]?.id : null);
            if (!eventId) throw new Error("Arbeitseinsatz konnte nicht erstellt werden.");
            await assignWorkEventLead(eventId, payload.leadUserId);
            if (payload.publishNow) await publishWorkEvent(eventId);
            setUploadProgress(form, 100, "Fertig.", true);
            host.innerHTML = "";
            await refresh();
            setMessage(payload.publishNow ? "Arbeitseinsatz erstellt, Leiter zugewiesen und veröffentlicht." : "Arbeitseinsatz erstellt und Leiter zugewiesen.");
          } catch (err) {
            if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
              await queueAction("create_work_event", payload);
              setUploadProgress(form, 100, "Offline gespeichert.", true);
              host.innerHTML = "";
              setMessage("Arbeitseinsatz offline gespeichert. Sync folgt bei Empfang.");
              return;
            }
            throw err;
          }
        } else {
          const payload = payloadFromComposer(form);
          const files = mediaFilesFromComposer(form);
          const prepared = Array.isArray(form._preparedMedia) ? form._preparedMedia : [];
          const offlineFiles = Array.isArray(form._preparedMediaOffline) ? form._preparedMediaOffline : [];

          try {
            if (files.length && !prepared.length && navigator.onLine) throw new Error("Bitte warten, bis der Bild-Upload abgeschlossen ist.");

            const post = await createPost(payload);
            if (!post?.id) throw new Error("Post konnte nicht erstellt werden");

            if (prepared.length) {
              setUploadProgress(form, 92, "Speichere Bild-Metadaten...", true);
              const uid = currentUserId();
              const mediaRows = prepared.map((m, i) => ({
                ...m,
                post_id: post.id,
                sort_order: i + 1,
                created_by: uid || post.author_id || post.updated_by,
              }));
              await createPostMediaRows(mediaRows);
              setUploadProgress(form, 100, "Beitrag und Bilder gespeichert.", true);
            } else {
              setUploadProgress(form, 100, "Beitrag gespeichert.", true);
            }

            clearPreparedMedia(form);
            host.innerHTML = "";
            await refresh();
            setMessage("Beitrag veröffentlicht.");
          } catch (err) {
            if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
              const offlineMedia = offlineFiles.length ? await buildOfflineMediaPayload(offlineFiles) : [];
              const localId = addPendingPost({
                ...payload,
                media_previews: offlineMedia,
              });
              await queueAction("create_post", {
                local_id: localId,
                payload,
                media: offlineMedia,
              });
              setUploadProgress(form, 100, "Offline gespeichert.", true);
              clearPreparedMedia(form);
              host.innerHTML = "";
              await refresh();
              setMessage("Beitrag offline gespeichert. Wird bei Empfang veröffentlicht.");
              return;
            }
            throw err;
          }
        }
      } catch (err) {
        setMessage(err?.message || "Speichern fehlgeschlagen");
      } finally {
        delete form.dataset.uploading;
        setFormSaving(form, false);
        setTimeout(() => setUploadProgress(form, 0, "", false), 1200);
      }
    });

    form.querySelector("[data-cancel]")?.addEventListener("click", () => {
      deleteUploadedMedia(form._preparedMedia || []);
      clearPreparedMedia(form);
      host.innerHTML = "";
      setMessage("");
    });

    host.appendChild(form);
  }

  function consumeOpenComposerIntent() {
    let shouldOpen = false;
    try {
      const url = new URL(window.location.href);
      shouldOpen = url.searchParams.get("compose") === "1" || url.hash === "#post-erstellen";
      if (shouldOpen) {
        url.searchParams.delete("compose");
        if (url.hash === "#post-erstellen") url.hash = "";
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      }
    } catch {
      // ignore URL parse errors
    }

    try {
      if (sessionStorage.getItem("vdan_open_post_composer") === "1") {
        shouldOpen = true;
        sessionStorage.removeItem("vdan_open_post_composer");
      }
    } catch {
      // ignore storage errors
    }
    return shouldOpen;
  }

  function mountEditComposer(article, post) {
    const slot = article.querySelector(".feed-edit-slot");
    if (!slot) return;
    slot.innerHTML = "";

    const form = document.createElement("form");
    form.className = "feed-form";
    form.appendChild(buildComposer(post, "Änderungen speichern", true, isForcedCategory ? forcedCategory : ""));
    syncComposerMode(form);
    initWorkYouthToggle(form);
    initTermYouthToggle(form);
    form.querySelector('[name="category"]')?.addEventListener("change", () => syncComposerMode(form));
    form._preparedMedia = [];

    const existingMediaCount = Array.isArray(post.feed_post_media) ? post.feed_post_media.length : 0;
    const remainingSlots = Math.max(0, MAX_MEDIA_FILES - existingMediaCount);
    const mediaInput = form.querySelector('[name="media"]');
    if (mediaInput) {
      if (remainingSlots === 0) {
        mediaInput.disabled = true;
        const note = document.createElement("p");
        note.className = "small";
        note.textContent = "Maximal 2 Bilder erreicht. Erst Bilder entfernen, dann neue hinzufügen.";
        mediaInput.closest("label")?.appendChild(note);
      } else {
        const note = document.createElement("p");
        note.className = "small";
        note.textContent = `Du kannst noch ${remainingSlots} Bild(er) hinzufügen.`;
        mediaInput.closest("label")?.appendChild(note);
        mediaInput.addEventListener("change", async () => {
          try {
            const prefix = `pending-edit-${post.id}-${Date.now()}`;
            await handleComposerMediaSelection(form, remainingSlots, prefix);
          } catch (err) {
            delete form.dataset.uploading;
            clearPreparedMedia(form);
            const input = form.querySelector('[name="media"]');
            if (input) input.value = "";
            setUploadProgress(form, 0, "", false);
            setFormSaving(form, false);
            setMessage(err?.message || "Bild-Upload fehlgeschlagen");
          }
        });
      }
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (form.dataset.saving === "1") return;
      setMessage("Aktualisiert...");
      setFormSaving(form, true, "Speichert...");
      setUploadProgress(form, 5, "Initialisiere...", true);
      try {
        const category = composerCategory(form);
        if (form.dataset.uploading === "1") throw new Error("Bitte warten, bis der Bild-Upload abgeschlossen ist.");
        if (["termin", "arbeitseinsatz"].includes(category)) {
          throw new Error("Termine und Arbeitseinsätze bitte über die jeweilige Fachmaske verwalten.");
        }
        const payload = payloadFromComposer(form);
        await updatePost(post.id, payload);
        setUploadProgress(form, 30, "Text gespeichert.", true);

        if (remainingSlots > 0) {
          const files = mediaFilesFromComposer(form, remainingSlots);
          const prepared = Array.isArray(form._preparedMedia) ? form._preparedMedia : [];
          if (files.length && !prepared.length) throw new Error("Bitte warten, bis der Bild-Upload abgeschlossen ist.");
          if (prepared.length) {
            setUploadProgress(form, 95, "Speichere Bild-Metadaten...", true);
            const uid = currentUserId();
            const mediaRows = prepared.map((m, i) => ({
              ...m,
              post_id: post.id,
              sort_order: existingMediaCount + i + 1,
              created_by: uid || post.author_id || post.updated_by,
            }));
            await createPostMediaRows(mediaRows);
          }
        }

        setUploadProgress(form, 100, "Fertig.", true);
        clearPreparedMedia(form);
        setMessage("Beitrag aktualisiert.");
        await refresh();
      } catch (err) {
        if (!navigator.onLine || window.VDAN_OFFLINE_SYNC?.isNetworkError?.(err)) {
          const payload = payloadFromComposer(form);
          await queueAction("update_post", { id: post.id, payload });
          const idx = pendingPosts.findIndex((p) => String(p.id) === String(post.id));
          if (idx >= 0) pendingPosts[idx] = { ...pendingPosts[idx], ...payload, updated_at: new Date().toISOString() };
          await savePendingPosts();
          setMessage("Offline gespeichert. Änderung wird bei Empfang übertragen.");
          await refresh();
          return;
        }
        setMessage(err?.message || "Update fehlgeschlagen");
      } finally {
        delete form.dataset.uploading;
        setFormSaving(form, false);
        setTimeout(() => setUploadProgress(form, 0, "", false), 1200);
      }
    });

    form.querySelector("[data-cancel]")?.addEventListener("click", () => {
      deleteUploadedMedia(form._preparedMedia || []);
      clearPreparedMedia(form);
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
      await loadPendingPosts();
      await flushOfflineQueue().catch(() => {});
      const roles = await loadRoles();
      canManage = roles.some((r) => MANAGER_ROLES.has(r));
      managerProfiles = canManage ? await loadManagerProfiles().catch(() => []) : [];
    } catch {
      canManage = false;
      managerProfiles = [];
    }

    btn.classList.toggle("hidden", !canManage);
    btn.toggleAttribute("hidden", !canManage);
    if (canManage && !btn.dataset.bound) {
      btn.dataset.bound = "1";
      btn.addEventListener("click", mountNewComposer);
    }

    if (canManage && consumeOpenComposerIntent()) mountNewComposer();

    await refresh();
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("vdan:session", init);
  document.addEventListener("vdan:open-post-composer", () => {
    if (!canManage) return;
    mountNewComposer();
  });
  window.addEventListener("online", () => {
    flushOfflineQueue().then(() => refresh()).catch(() => {});
  });
})();
