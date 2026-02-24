;(() => {
  const DB_NAME = "vdan_offline_v1";
  const DB_VERSION = 1;
  const STORE = "kv";

  let dbPromise = null;

  function hasIndexedDb() {
    return typeof indexedDB !== "undefined";
  }

  function openDb() {
    if (!hasIndexedDb()) return Promise.resolve(null);
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });

    return dbPromise;
  }

  async function withStore(mode, run) {
    const db = await openDb();
    if (!db) return null;
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const out = run(store);
      tx.oncomplete = () => resolve(out?.result ?? out ?? null);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    });
  }

  async function getJSON(key) {
    if (!key) return null;
    const res = await withStore("readonly", (store) => store.get(key));
    if (res && typeof res === "object" && Object.prototype.hasOwnProperty.call(res, "value")) {
      return res.value;
    }
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function setJSON(key, value) {
    if (!key) return;
    const ok = await withStore("readwrite", (store) => store.put({ key, value, updated_at: new Date().toISOString() }));
    if (ok == null) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // ignore
      }
    }
  }

  async function removeKey(key) {
    if (!key) return;
    const ok = await withStore("readwrite", (store) => store.delete(key));
    if (ok == null) {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
  }

  async function getAllKeys() {
    const db = await openDb();
    if (!db) return [];
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result.map(String) : []);
      req.onerror = () => resolve([]);
    });
  }

  async function clearByPrefix(prefix) {
    const keys = await getAllKeys();
    const matches = keys.filter((k) => k.startsWith(prefix));
    await Promise.all(matches.map((k) => removeKey(k)));
  }

  async function clearUserData(userId) {
    const uid = String(userId || "").trim();
    if (!uid) return;

    const idbPrefixes = [
      `vdan_trip_sync_queue_v1:${uid}`,
      `vdan_trip_cache_v1:${uid}`,
      `vdan_trip_sync_conflicts_v1:${uid}`,
    ];
    await Promise.all(idbPrefixes.map((p) => clearByPrefix(p)));

    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k) keys.push(k);
      }
      keys.forEach((k) => {
        if (
          k.startsWith(`vdan_trip_sync_queue_v1:${uid}`) ||
          k.startsWith(`vdan_trip_cache_v1:${uid}`) ||
          k.startsWith(`vdan_trip_sync_conflicts_v1:${uid}`) ||
          k.startsWith("vdan_catchlist_") ||
          k.startsWith("vdan_fangliste_") ||
          k.startsWith("vdan_local_catches_") ||
          k.startsWith("vdan_trip_draft_") ||
          k.startsWith("vdan_trip_images_v1:")
        ) {
          localStorage.removeItem(k);
        }
      });
    } catch {
      // ignore
    }
  }

  window.VDAN_OFFLINE_STORE = {
    getJSON,
    setJSON,
    removeKey,
    clearByPrefix,
    clearUserData,
  };
})();
