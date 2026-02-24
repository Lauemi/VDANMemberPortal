;(() => {
  const Q_PREFIX = "vdan_offline_ops_v1:";
  const C_PREFIX = "vdan_offline_cache_v1:";

  function liveUserId() {
    return window.VDAN_AUTH?.loadSession?.()?.user?.id || null;
  }

  function storedUserId() {
    try {
      const raw = localStorage.getItem("vdan_member_session_v1");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const id = String(parsed?.user?.id || "").trim();
      return id || null;
    } catch {
      return null;
    }
  }

  function uid() {
    return liveUserId() || storedUserId() || "anon";
  }

  function qKey(ns) {
    return `${Q_PREFIX}${uid()}:${ns}`;
  }

  function cKey(ns, key) {
    return `${C_PREFIX}${uid()}:${ns}:${key}`;
  }

  async function readJSON(key, fallback) {
    const val = await window.VDAN_OFFLINE_STORE?.getJSON?.(key);
    if (val !== null && val !== undefined) return val;
    return fallback;
  }

  async function writeJSON(key, value) {
    if (window.VDAN_OFFLINE_STORE?.setJSON) {
      await window.VDAN_OFFLINE_STORE.setJSON(key, value);
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }

  function isNetworkError(err) {
    const msg = String(err?.message || err || "").toLowerCase();
    return msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("load failed");
  }

  function isAuthError(err) {
    const status = Number(err?.status || 0);
    return status === 401 || status === 403;
  }

  async function getQueue(ns) {
    const rows = await readJSON(qKey(ns), []);
    return Array.isArray(rows) ? rows : [];
  }

  async function setQueue(ns, rows) {
    await writeJSON(qKey(ns), Array.isArray(rows) ? rows : []);
  }

  async function enqueue(ns, op) {
    const q = await getQueue(ns);
    q.push({
      id: `op:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      created_at: new Date().toISOString(),
      ...op,
    });
    await setQueue(ns, q);
    return q[q.length - 1];
  }

  async function cacheSet(ns, key, value) {
    await writeJSON(cKey(ns, key), value);
  }

  async function cacheGet(ns, key, fallback = null) {
    const out = await readJSON(cKey(ns, key), fallback);
    return out === undefined ? fallback : out;
  }

  async function flush(ns, executor) {
    if (!navigator.onLine) return { flushed: 0, remaining: (await getQueue(ns)).length };
    if (!window.VDAN_AUTH?.loadSession?.()?.access_token) {
      const refreshed = await window.VDAN_AUTH?.refreshSession?.().catch(() => null);
      if (!refreshed?.access_token) return { flushed: 0, remaining: (await getQueue(ns)).length };
    }

    const q = await getQueue(ns);
    if (!q.length) return { flushed: 0, remaining: 0 };

    const left = [];
    let flushed = 0;
    for (let i = 0; i < q.length; i += 1) {
      const op = q[i];
      try {
        await executor(op);
        flushed += 1;
      } catch (err) {
        if (isNetworkError(err) || isAuthError(err)) {
          left.push(...q.slice(i));
          break;
        }
        left.push(op);
      }
    }
    await setQueue(ns, left);
    return { flushed, remaining: left.length };
  }

  window.VDAN_OFFLINE_SYNC = {
    isNetworkError,
    getQueue,
    setQueue,
    enqueue,
    cacheGet,
    cacheSet,
    flush,
  };
})();

