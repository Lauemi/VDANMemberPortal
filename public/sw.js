const SW_VERSION = "v1.0.3";
const STATIC_CACHE = `vdan-static-${SW_VERSION}`;
const PAGE_CACHE = `vdan-pages-${SW_VERSION}`;

const PRECACHE_URLS = [
  "/",
  "/app/",
  "/app/fangliste/",
  "/app/arbeitseinsaetze/",
  "/app/arbeitseinsaetze/cockpit/",
  "/app/zustaendigkeiten/",
  "/app/ausweis/",
  "/app/ausweis/verifizieren/",
  "/login/",
  "/offline/",
  "/css/main.css",
  "/css/consent-manager.css",
  "/js/app-env.js",
  "/js/offline-data-store.js",
  "/js/offline-sync.js",
  "/js/member-auth.js",
  "/js/member-guard.js",
  "/js/ui-session.js",
  "/js/nav-burger.js",
  "/js/account-menu.js",
  "/js/catchlist.js",
  "/js/work-events-member.js",
  "/js/work-events-cockpit.js",
  "/js/responsibilities-my.js",
  "/js/home-feed.js",
  "/js/member-card.js",
  "/js/member-card-verify.js",
  "/js/pwa-register.js",
  "/js/runtime-guard.js",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png"
];

function isApiPath(pathname) {
  return pathname.startsWith("/auth/v1/")
    || pathname.startsWith("/rest/v1/")
    || pathname.startsWith("/storage/v1/")
    || pathname.startsWith("/functions/v1/");
}

function shouldBypassCache(request, url) {
  if (request.method !== "GET") return true;
  if (request.headers.has("authorization")) return true;
  if (isApiPath(url.pathname)) return true;
  return false;
}

function isCacheableResponse(response) {
  if (!response || !response.ok) return false;
  if (response.type !== "basic") return false;
  const cc = String(response.headers.get("Cache-Control") || "").toLowerCase();
  if (cc.includes("no-store")) return false;
  return true;
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.all(PRECACHE_URLS.map(async (url) => {
      try {
        const res = await fetch(url, { cache: "no-cache" });
        if (isCacheableResponse(res)) await cache.put(url, res.clone());
      } catch {
        // ignore per-file precache failures
      }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith("vdan-static-") || k.startsWith("vdan-pages-"))
        .filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event?.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const network = await fetch(request);
    if (isCacheableResponse(network)) await cache.put(request, network.clone());
    return network;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return (await cache.match("/offline/")) || Response.error();
  }
}

async function cacheFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const network = await fetch(request);
  if (isCacheableResponse(network)) await cache.put(request, network.clone());
  return network;
}

async function networkFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const network = await fetch(request);
    if (isCacheableResponse(network)) await cache.put(request, network.clone());
    return network;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("static_asset_unavailable");
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Let the browser handle third-party requests directly.
  if (url.origin !== self.location.origin) return;

  if (shouldBypassCache(request, url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  const isScriptOrStyle =
    request.destination === "script" ||
    request.destination === "style" ||
    url.pathname.startsWith("/js/") ||
    url.pathname.startsWith("/css/");

  if (isScriptOrStyle) {
    event.respondWith(networkFirstStatic(request));
    return;
  }

  const isStaticAsset =
    request.destination === "image" ||
    request.destination === "font" ||
    request.destination === "manifest" ||
    url.pathname.startsWith("/Bilder/");

  if (isStaticAsset) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }

  event.respondWith(networkFirstPage(request));
});
