;(() => {
  const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  function userId() {
    return session()?.user?.id || null;
  }

  async function sb(path, init = {}, withAuth = false) {
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
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

  function setMsg(text = "") {
    const el = document.getElementById("waterMapMsg");
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function normalizeNameKey(name) {
    return String(name || "-")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("de-DE");
  }

  function parseCardScope(fishingCardType) {
    const t = String(fishingCardType || "").toLocaleLowerCase("de-DE");
    const hasVgw = t.includes("innenwasser") || t.includes("innewasser") || t.includes("vereins");
    const hasR39 = t.includes("rheinlos") || t.includes("rhein");
    return { hasVgw, hasR39 };
  }

  function descriptionText(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") return String(value.value || value.text || value.description || "");
    return String(value);
  }

  function isBlockedArea(row) {
    const props = row?.geojson?.properties || {};
    const txt = `${descriptionText(props.description)} ${descriptionText(props.note)} ${descriptionText(props.hint)}`.toLocaleLowerCase("de-DE");
    return txt.includes("gesperrt") || txt.includes("verbot");
  }

  function statusForRow(row, scope, memberCardValid) {
    if (!memberCardValid) return { allowed: false, code: "invalid_card", label: "AUSWEIS UNGUELTIG" };
    if (isBlockedArea(row)) return { allowed: false, code: "blocked", label: "GESCHLOSSEN" };
    if (isAllowed(row.area_kind, scope, memberCardValid)) return { allowed: true, code: "allowed", label: "ERLAUBT" };
    return { allowed: false, code: "not_permitted", label: "NICHT FREIGEGEBEN" };
  }

  function isAllowed(areaKind, scope, memberCardValid) {
    if (!memberCardValid) return false;
    if (areaKind === "vereins_gemeinschaftsgewaesser") return scope.hasVgw;
    if (areaKind === "rheinlos39") return scope.hasR39;
    return false;
  }

  async function ensureLeaflet() {
    if (window.L) return;
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = LEAFLET_CSS;
      document.head.appendChild(l);
    }
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = LEAFLET_JS;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Leaflet konnte nicht geladen werden."));
      document.head.appendChild(s);
    });
  }

  function normalizeGeoJson(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.type === "FeatureCollection") return raw;
    if (raw.type === "Feature") return { type: "FeatureCollection", features: [raw] };
    if (raw.type === "Polygon" || raw.type === "MultiPolygon" || raw.type === "LineString" || raw.type === "MultiLineString" || raw.type === "Point" || raw.type === "MultiPoint") {
      return { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: raw }] };
    }
    return null;
  }

  function renderList(rows, scope, memberCardValid, onSelectWater) {
    const root = document.getElementById("waterMapList");
    if (!root) return;
    root.innerHTML = "";

    const grouped = new Map();
    rows.forEach((r) => {
      const key = normalizeNameKey(r.name);
      const displayName = String(r.name || "-").trim().replace(/\s+/g, " ");
      const st = statusForRow(r, scope, memberCardValid);
      const prev = grouped.get(key) || { name: displayName, allowed: false, blocked: false, invalidCard: false };
      prev.allowed = prev.allowed || st.allowed;
      prev.blocked = prev.blocked || st.code === "blocked";
      prev.invalidCard = prev.invalidCard || st.code === "invalid_card";
      grouped.set(key, prev);
    });

    [...grouped.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, "de-DE")).forEach(([key, r]) => {
      const el = document.createElement("div");
      el.className = "card";
      el.dataset.waterKey = key;
      const border = r.allowed ? "rgba(34, 197, 94, .9)" : (r.blocked ? "rgba(234, 88, 12, .95)" : "rgba(220, 38, 38, .95)");
      const badgeBg = r.allowed ? "#16a34a" : (r.blocked ? "#ea580c" : "#dc2626");
      const badgeText = r.allowed ? "ERLAUBT" : (r.blocked ? "GESCHLOSSEN" : (r.invalidCard ? "AUSWEIS UNGUELTIG" : "NICHT FREIGEGEBEN"));
      el.style.borderColor = border;
      el.style.cursor = "pointer";
      el.innerHTML = `
        <div class="card__body" style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:10px 12px;">
          <span style="font-weight:700;letter-spacing:.01em;">${escapeHtml(r.name || "-")}</span>
          <strong style="font-size:12px;line-height:1;background:${badgeBg};color:#fff;padding:6px 10px;border-radius:999px;">${badgeText}</strong>
        </div>
      `;
      el.addEventListener("click", () => {
        root.querySelectorAll('[data-water-key]').forEach((n) => {
          n.style.boxShadow = "";
          n.style.transform = "";
        });
        el.style.boxShadow = "0 0 0 2px rgba(59, 130, 246, .85), 0 6px 18px rgba(59, 130, 246, .25)";
        el.style.transform = "translateY(-1px)";
        if (typeof onSelectWater === "function") onSelectWater(key);
      });
      root.appendChild(el);
    });
  }

  function addOrUpdateLocationMarker(map, state, lat, lng, accuracyMeters) {
    const L = window.L;
    if (!state.marker) {
      state.marker = L.circleMarker([lat, lng], {
        radius: 7,
        color: "#1d4ed8",
        fillColor: "#3b82f6",
        fillOpacity: 1,
        weight: 3,
      }).addTo(map);
    } else {
      state.marker.setLatLng([lat, lng]);
    }

    if (!state.accuracyCircle) {
      state.accuracyCircle = L.circle([lat, lng], {
        radius: Math.max(accuracyMeters || 0, 5),
        color: "#2563eb",
        fillColor: "#60a5fa",
        fillOpacity: 0.2,
        weight: 2,
      }).addTo(map);
    } else {
      state.accuracyCircle.setLatLng([lat, lng]);
      state.accuracyCircle.setRadius(Math.max(accuracyMeters || 0, 5));
    }
  }

  function locateUser(map, state) {
    if (!("geolocation" in navigator)) {
      setMsg("Geolocation wird von diesem Browser nicht unterstützt.");
      return;
    }
    setMsg("Standort wird ermittelt…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy || 0;
        addOrUpdateLocationMarker(map, state, lat, lng, acc);
        const z = Math.max(map.getZoom(), 15);
        map.setView([lat, lng], z, { animate: true });
        setMsg(`Standort gefunden (Genauigkeit ca. ±${Math.round(acc)} m).`);
      },
      (err) => {
        if (err?.code === 1) setMsg("Standortfreigabe wurde abgelehnt.");
        else if (err?.code === 2) setMsg("Standort ist aktuell nicht verfügbar.");
        else if (err?.code === 3) setMsg("Standortermittlung hat zu lange gedauert.");
        else setMsg("Standort konnte nicht ermittelt werden.");
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  }

  async function init() {
    if (!userId()) {
      setMsg("Nicht eingeloggt.");
      return;
    }
    try {
      setMsg("Lade Karte…");
      const [profileRows, areaRows] = await Promise.all([
        sb(`/rest/v1/profiles?select=fishing_card_type,member_card_valid&id=eq.${encodeURIComponent(userId())}&limit=1`, { method: "GET" }, true),
        sb("/rest/v1/water_areas?select=id,name,area_kind,geojson,is_active&is_active=eq.true&order=name.asc", { method: "GET" }, true),
      ]);

      const profile = Array.isArray(profileRows) ? profileRows[0] : null;
      const rows = (Array.isArray(areaRows) ? areaRows : []).filter((r) => {
        const n = String(r?.name || "").toLocaleLowerCase("de-DE");
        return !n.startsWith("beispiel ");
      });
      if (!profile) {
        setMsg("Profil nicht gefunden.");
        return;
      }

      const scope = parseCardScope(profile.fishing_card_type);
      const memberCardValid = Boolean(profile.member_card_valid);

      await ensureLeaflet();
      const root = document.getElementById("waterMapCanvas");
      if (!root) return;
      root.innerHTML = "";

      const map = window.L.map(root).setView([48.48, 7.9], 11);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      const allLayers = [];
      const layersByWaterKey = new Map();
      rows.forEach((r) => {
        const gj = normalizeGeoJson(r.geojson);
        if (!gj) return;
        const st = statusForRow(r, scope, memberCardValid);
        const allowed = st.allowed;
        const lineColor = allowed ? "#16a34a" : (st.code === "blocked" ? "#ea580c" : "#dc2626");
        const fillColor = allowed ? "#22c55e" : (st.code === "blocked" ? "#f97316" : "#ef4444");
        const dashArray = st.code === "blocked" ? "8 6" : null;
        const fillOpacity = allowed ? 0.28 : (st.code === "blocked" ? 0.42 : 0.36);
        const layer = window.L.geoJSON(gj, {
          style: () => ({
            color: lineColor,
            weight: 4,
            opacity: 1,
            fillColor,
            fillOpacity,
            dashArray,
          }),
          pointToLayer: (_f, latlng) => window.L.circleMarker(latlng, {
            radius: 6,
            color: lineColor,
            fillColor,
            fillOpacity: 0.95,
            weight: 3,
          }),
        }).addTo(map);
        layer.bindPopup(`<strong>${escapeHtml(r.name || "-")}</strong><br/>${st.label}`);
        allLayers.push(layer);
        const key = normalizeNameKey(r.name);
        if (!layersByWaterKey.has(key)) layersByWaterKey.set(key, []);
        layersByWaterKey.get(key).push(layer);
      });

      if (allLayers.length) {
        const group = window.L.featureGroup(allLayers);
        map.fitBounds(group.getBounds(), { padding: [16, 16] });
      }

      function focusWaterByKey(key) {
        const list = layersByWaterKey.get(key);
        if (!list || !list.length) return;
        const mapCanvas = document.getElementById("waterMapCanvas");
        if (mapCanvas) {
          mapCanvas.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        const group = window.L.featureGroup(list);
        const bounds = group.getBounds();
        if (bounds && bounds.isValid()) {
          map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
        }
        const first = list[0];
        if (first && typeof first.openPopup === "function") first.openPopup();
      }

      renderList(rows, scope, memberCardValid, focusWaterByKey);

      const locationState = { marker: null, accuracyCircle: null };
      const locateBtn = document.getElementById("waterLocateBtn");
      if (locateBtn) {
        locateBtn.addEventListener("click", () => locateUser(map, locationState));
      }

      setMsg(memberCardValid ? "" : "Ausweis ist ungültig. Alle Gewässer sind aktuell gesperrt.");
      if (!rows.length) setMsg("Keine Gewässerflächen vorhanden. Bitte Import für water_areas ausführen.");
    } catch (err) {
      setMsg(err?.message || "Karte konnte nicht geladen werden.");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
