;(() => {
  const LS_KEY = "vdan_admin_locations_v1";
  const DEFAULT_CENTER = { lat: 48.3419, lon: 7.8181 }; // Ottenheim area
  const LEAFLET_VER = "1.9.4";
  const WEATHER_BASE = "https://api.open-meteo.com/v1/forecast";
  const RAINVIEWER_META = "https://api.rainviewer.com/public/weather-maps.json";

  const state = {
    map: null,
    marker: null,
    radarLayer: null,
    radarFrames: [],
    radarHost: "https://tilecache.rainviewer.com",
    radarIndex: -1,
    radarOpacity: 0.55,
    center: { ...DEFAULT_CENTER },
    savedLocations: [],
  };

  function setMsg(text = "") {
    const el = document.getElementById("adminApiMsg");
    if (el) el.textContent = text;
  }

  function fmt(v, unit = "") {
    if (v === null || v === undefined || Number.isNaN(Number(v))) return "-";
    const n = Number(v);
    return `${n.toFixed(1)}${unit}`;
  }

  function esc(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function persistSaved() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state.savedLocations));
    } catch {
      // ignore
    }
  }

  function moonLabel(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return "Unbekannt";
    if (v < 0.03 || v > 0.97) return "Neumond";
    if (v < 0.22) return "Zunehmende Sichel";
    if (v < 0.28) return "Erstes Viertel";
    if (v < 0.47) return "Zunehmender Mond";
    if (v < 0.53) return "Vollmond";
    if (v < 0.72) return "Abnehmender Mond";
    if (v < 0.78) return "Letztes Viertel";
    return "Abnehmende Sichel";
  }

  function moonSymbol(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return "🌑";
    if (v < 0.03 || v > 0.97) return "🌑";
    if (v < 0.22) return "🌒";
    if (v < 0.28) return "🌓";
    if (v < 0.47) return "🌔";
    if (v < 0.53) return "🌕";
    if (v < 0.72) return "🌖";
    if (v < 0.78) return "🌗";
    return "🌘";
  }

  function weatherIconForCode(code) {
    const c = Number(code);
    if (c === 0) return "☀";
    if ([1, 2].includes(c)) return "⛅";
    if (c === 3) return "☁";
    if ([45, 48].includes(c)) return "🌫";
    if ([51, 53, 55, 56, 57].includes(c)) return "🌦";
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(c)) return "🌧";
    if ([71, 73, 75, 77, 85, 86].includes(c)) return "❄";
    if ([95, 96, 99].includes(c)) return "⛈";
    return "🌤";
  }

  function weatherLabelForCode(code) {
    const c = Number(code);
    if (c === 0) return "Klar";
    if (c === 1) return "Heiter";
    if (c === 2) return "Teilweise bewölkt";
    if (c === 3) return "Bedeckt";
    if ([45, 48].includes(c)) return "Nebel";
    if ([51, 53, 55, 56, 57].includes(c)) return "Niesel";
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(c)) return "Regen";
    if ([71, 73, 75, 77, 85, 86].includes(c)) return "Schnee";
    if ([95, 96, 99].includes(c)) return "Gewitter";
    return "Wetter";
  }

  function moonPhaseNow() {
    // Simple astronomical approximation (0=new moon, 0.5=full moon)
    const lunarCycleSeconds = 2551443; // 29.530588853 days
    const knownNewMoonUtcMs = Date.UTC(1970, 0, 7, 20, 35, 0);
    const nowSeconds = (Date.now() - knownNewMoonUtcMs) / 1000;
    const normalized = ((nowSeconds % lunarCycleSeconds) + lunarCycleSeconds) % lunarCycleSeconds;
    return normalized / lunarCycleSeconds;
  }

  function toLocalIsoDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function addLocalDays(baseDate, days) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + days);
    return d;
  }

  function weekdayDateLabel(isoDate) {
    const d = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return isoDate;
    const wd = d.toLocaleDateString("de-DE", { weekday: "short" });
    const dt = d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
    return `${wd}, ${dt}`;
  }

  function pressureTrendArrow(current, previous) {
    if (!Number.isFinite(current) || !Number.isFinite(previous)) return "→";
    const delta = current - previous;
    if (delta > 0.7) return "↑";
    if (delta < -0.7) return "↓";
    return "→";
  }

  function pressureTrendClass(arrow) {
    if (arrow === "↑") return "is-up";
    if (arrow === "↓") return "is-down";
    return "is-flat";
  }

  function aggregateDailyPressure(hourly) {
    const times = Array.isArray(hourly?.time) ? hourly.time : [];
    const values = Array.isArray(hourly?.pressure_msl) ? hourly.pressure_msl : [];
    const byDate = new Map();
    const len = Math.min(times.length, values.length);
    for (let i = 0; i < len; i += 1) {
      const ts = String(times[i] || "");
      const date = ts.slice(0, 10);
      const val = Number(values[i]);
      if (!date || !Number.isFinite(val)) continue;
      const cur = byDate.get(date) || { sum: 0, count: 0 };
      cur.sum += val;
      cur.count += 1;
      byDate.set(date, cur);
    }
    const avgByDate = new Map();
    byDate.forEach((v, k) => {
      if (v.count > 0) avgByDate.set(k, v.sum / v.count);
    });
    return avgByDate;
  }

  function buildPressureSeries(avgByDate) {
    const result = [];
    const today = new Date();
    for (let offset = -2; offset <= 5; offset += 1) {
      const d = addLocalDays(today, offset);
      const date = toLocalIsoDate(d);
      const prevDate = toLocalIsoDate(addLocalDays(d, -1));
      const value = Number(avgByDate.get(date));
      const prevValue = Number(avgByDate.get(prevDate));
      result.push({
        date,
        offset,
        value: Number.isFinite(value) ? value : null,
        arrow: pressureTrendArrow(value, prevValue),
      });
    }
    return result;
  }

  function renderPressureSeries(series) {
    const root = document.getElementById("adminApiPressureSeries");
    if (!root) return;
    if (!Array.isArray(series) || !series.length) {
      root.textContent = "-";
      return;
    }
    root.innerHTML = series.map((row) => {
      const todayTag = row.offset === 0 ? " (Heute)" : "";
      const pressureText = Number.isFinite(row.value) ? `${row.value.toFixed(1)} hPa` : "-";
      return `
        <div class="admin-api-pressure-row">
          <span>${esc(weekdayDateLabel(row.date))}${todayTag}</span>
          <span><strong>${esc(pressureText)}</strong> <span class="admin-api-trend ${pressureTrendClass(row.arrow)}">${row.arrow}</span></span>
        </div>
      `;
    }).join("");
  }

  function renderWeatherForecast(daily) {
    const root = document.getElementById("adminApiWeatherForecast");
    if (!root) return;
    const times = Array.isArray(daily?.time) ? daily.time : [];
    const codes = Array.isArray(daily?.weather_code) ? daily.weather_code : [];
    const maxs = Array.isArray(daily?.temperature_2m_max) ? daily.temperature_2m_max : [];
    const mins = Array.isArray(daily?.temperature_2m_min) ? daily.temperature_2m_min : [];
    const rains = Array.isArray(daily?.precipitation_probability_max) ? daily.precipitation_probability_max : [];
    const len = Math.min(times.length, codes.length, maxs.length, mins.length, rains.length);
    if (!len) {
      root.innerHTML = `<p class="small">Keine 7-Tage-Daten verfügbar.</p>`;
      return;
    }
    root.innerHTML = Array.from({ length: len }).map((_, i) => {
      const day = String(times[i] || "");
      const label = weekdayDateLabel(day);
      const icon = weatherIconForCode(codes[i]);
      const kind = weatherLabelForCode(codes[i]);
      const max = Number(maxs[i]);
      const min = Number(mins[i]);
      const rain = Number(rains[i]);
      return `
        <article class="admin-api-forecast-row">
          <div class="admin-api-forecast-day">
            <span class="admin-api-weather-icon" aria-hidden="true">${icon}</span>
            <div>
              <p><strong>${esc(label)}</strong></p>
              <p class="small">${esc(kind)}</p>
            </div>
          </div>
          <div class="admin-api-forecast-values">
            <span>Max ${Number.isFinite(max) ? `${max.toFixed(1)}°C` : "-"}</span>
            <span>Min ${Number.isFinite(min) ? `${min.toFixed(1)}°C` : "-"}</span>
            <span>Regen ${Number.isFinite(rain) ? `${Math.round(rain)}%` : "-"}</span>
          </div>
        </article>
      `;
    }).join("");
  }

  function updateWeatherUi(current, moonPhase, pressureSeries, daily) {
    const tempEl = document.getElementById("adminApiTemp");
    const pressureEl = document.getElementById("adminApiPressure");
    const rainEl = document.getElementById("adminApiRain");
    const moonLabelEl = document.getElementById("adminApiMoonLabel");
    const moonRawEl = document.getElementById("adminApiMoonRaw");
    const moonVisualEl = document.getElementById("adminApiMoonVisual");

    if (tempEl) tempEl.textContent = fmt(current?.temperature_2m, " °C");
    if (pressureEl) pressureEl.textContent = fmt(current?.pressure_msl, " hPa");
    if (rainEl) rainEl.textContent = fmt(current?.precipitation, " mm");
    if (moonLabelEl) moonLabelEl.textContent = moonLabel(moonPhase);
    if (moonRawEl) moonRawEl.textContent = Number.isFinite(Number(moonPhase)) ? String(Number(moonPhase).toFixed(3)) : "-";
    if (moonVisualEl) moonVisualEl.textContent = moonSymbol(moonPhase);
    renderPressureSeries(pressureSeries);
    renderWeatherForecast(daily);
  }

  async function fetchWeather(lat, lon) {
    const moon = moonPhaseNow();
    const makeUrl = (withTimezone = true) => {
      const url = new URL(WEATHER_BASE);
      url.searchParams.set("latitude", String(lat));
      url.searchParams.set("longitude", String(lon));
      url.searchParams.set("current", "temperature_2m,pressure_msl,precipitation");
      url.searchParams.set("hourly", "pressure_msl");
      url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
      url.searchParams.set("past_days", "2");
      url.searchParams.set("forecast_days", "7");
      if (withTimezone) url.searchParams.set("timezone", "auto");
      return url;
    };

    const firstRes = await fetch(makeUrl(true).toString());
    if (firstRes.ok) {
      const data = await firstRes.json().catch(() => ({}));
      const avgByDate = aggregateDailyPressure(data?.hourly || {});
      updateWeatherUi(data?.current || {}, moon, buildPressureSeries(avgByDate), data?.daily || {});
      return;
    }

    // Fallback without timezone in case provider rejects auto timezone for some regions.
    const secondRes = await fetch(makeUrl(false).toString());
    if (!secondRes.ok) {
      const txt = await secondRes.text().catch(() => "");
      throw new Error(`Wetterdaten nicht erreichbar (${secondRes.status}) ${txt}`.trim());
    }
    const data = await secondRes.json().catch(() => ({}));
    const avgByDate = aggregateDailyPressure(data?.hourly || {});
    updateWeatherUi(data?.current || {}, moon, buildPressureSeries(avgByDate), data?.daily || {});
  }

  async function loadLeaflet() {
    if (window.L) return window.L;
    await new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = `https://unpkg.com/leaflet@${LEAFLET_VER}/dist/leaflet.css`;
      css.crossOrigin = "";
      document.head.appendChild(css);

      const s = document.createElement("script");
      s.src = `https://unpkg.com/leaflet@${LEAFLET_VER}/dist/leaflet.js`;
      s.defer = true;
      s.crossOrigin = "";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Kartenbibliothek konnte nicht geladen werden."));
      document.head.appendChild(s);
    });
    return window.L;
  }

  function renderSavedLocations() {
    const root = document.getElementById("adminApiLocations");
    if (!root) return;
    if (!state.savedLocations.length) {
      root.innerHTML = `<p class="small">Noch keine gespeicherten Standorte.</p>`;
      return;
    }
    root.innerHTML = state.savedLocations.map((loc) => `
      <article class="admin-api-location">
        <div>
          <p><strong>${esc(loc.name)}</strong></p>
          <p class="small">${Number(loc.lat).toFixed(5)}, ${Number(loc.lon).toFixed(5)}</p>
        </div>
        <div class="admin-api-location__actions">
          <button type="button" class="feed-btn feed-btn--ghost" data-action="goto" data-id="${esc(loc.id)}">Anzeigen</button>
          <button type="button" class="feed-btn feed-btn--ghost" data-action="delete" data-id="${esc(loc.id)}">Löschen</button>
        </div>
      </article>
    `).join("");
  }

  function setCenter(lat, lon) {
    state.center = { lat: Number(lat), lon: Number(lon) };
    if (state.map) state.map.setView([state.center.lat, state.center.lon], 10);
    if (state.marker) state.marker.setLatLng([state.center.lat, state.center.lon]);
  }

  async function fetchRadarMeta() {
    const res = await fetch(RAINVIEWER_META);
    if (!res.ok) throw new Error(`Radar-Metadaten nicht erreichbar (${res.status})`);
    return res.json();
  }

  function frameTsToText(ts) {
    const n = Number(ts || 0);
    if (!Number.isFinite(n) || n <= 0) return "-";
    const d = new Date(n * 1000);
    return d.toLocaleString("de-DE");
  }

  function renderRadarFrameSelect() {
    const select = document.getElementById("adminApiRadarFrame");
    const label = document.getElementById("adminApiRadarFrameLabel");
    if (!select) return;
    if (!state.radarFrames.length) {
      select.innerHTML = '<option value="">Keine Frames</option>';
      if (label) label.textContent = "-";
      return;
    }
    select.innerHTML = state.radarFrames.map((f, idx) => {
      const text = frameTsToText(f?.time);
      const selected = idx === state.radarIndex ? "selected" : "";
      return `<option value="${idx}" ${selected}>${esc(text)}</option>`;
    }).join("");
    const active = state.radarFrames[state.radarIndex];
    if (label) label.textContent = frameTsToText(active?.time);
  }

  function applyRadarFrame() {
    const statusEl = document.getElementById("adminApiRadarStatus");
    if (!state.map || !state.radarFrames.length || state.radarIndex < 0) {
      if (statusEl) statusEl.textContent = "Radar nicht verfügbar";
      return;
    }
    const active = state.radarFrames[state.radarIndex];
    const path = String(active?.path || "").trim();
    if (!path) {
      if (statusEl) statusEl.textContent = "Radar nicht verfügbar";
      return;
    }
    const tileUrl = `${state.radarHost}${path}/256/{z}/{x}/{y}/2/1_1.png`;
    if (state.radarLayer) state.map.removeLayer(state.radarLayer);
    state.radarLayer = window.L.tileLayer(tileUrl, {
      opacity: state.radarOpacity,
      attribution: "&copy; RainViewer",
    });
    state.radarLayer.addTo(state.map);
    if (statusEl) statusEl.textContent = "Radar aktiv";
    renderRadarFrameSelect();
  }

  async function updateRadarLayer() {
    const statusEl = document.getElementById("adminApiRadarStatus");
    try {
      const data = await fetchRadarMeta();
      state.radarHost = String(data?.host || "https://tilecache.rainviewer.com");
      const past = Array.isArray(data?.radar?.past) ? data.radar.past : [];
      const nowcast = Array.isArray(data?.radar?.nowcast) ? data.radar.nowcast : [];
      state.radarFrames = [...past, ...nowcast].filter((f) => String(f?.path || "").trim());
      if (!state.radarFrames.length) throw new Error("Keine Radar-Kacheln verfügbar.");
      state.radarIndex = state.radarFrames.length - 1;
      applyRadarFrame();
    } catch (err) {
      if (statusEl) statusEl.textContent = "Radar nicht verfügbar";
      setMsg(err?.message || "Radar konnte nicht geladen werden.");
    }
  }

  async function ensureMap() {
    const mapRoot = document.getElementById("adminApiMap");
    if (!mapRoot) return;
    const L = await loadLeaflet();
    state.map = L.map(mapRoot, { zoomControl: true }).setView([state.center.lat, state.center.lon], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap-Mitwirkende",
    }).addTo(state.map);
    state.marker = L.marker([state.center.lat, state.center.lon]).addTo(state.map);

    state.map.on("moveend", () => {
      const c = state.map.getCenter();
      state.center = { lat: c.lat, lon: c.lng };
      if (state.marker) state.marker.setLatLng([c.lat, c.lng]);
    });
  }

  async function updateAllData() {
    await fetchWeather(state.center.lat, state.center.lon).catch((err) => {
      setMsg(err?.message || "Wetterdaten konnten nicht geladen werden.");
    });
    if (state.map) {
      await updateRadarLayer();
    }
  }

  async function useCurrentLocation() {
    if (!("geolocation" in navigator)) throw new Error("Geolocation wird auf diesem Gerät nicht unterstützt.");
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
      });
    });
    const lat = Number(pos?.coords?.latitude);
    const lon = Number(pos?.coords?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("Standort konnte nicht bestimmt werden.");
    setCenter(lat, lon);
    await updateAllData();
  }

  function bindEvents() {
    document.getElementById("adminApiLocateBtn")?.addEventListener("click", async () => {
      setMsg("Ermittle Standort...");
      try {
        await useCurrentLocation();
        setMsg("Standort übernommen.");
      } catch (err) {
        setMsg(err?.message || "Standort konnte nicht ermittelt werden.");
      }
    });

    document.getElementById("adminApiCenterBtn")?.addEventListener("click", async () => {
      if (!state.map) return;
      const c = state.map.getCenter();
      setCenter(c.lat, c.lng);
      setMsg("Kartenmitte übernommen.");
      await updateAllData();
    });

    document.getElementById("adminApiSaveBtn")?.addEventListener("click", () => {
      const input = document.getElementById("adminApiLocationName");
      const name = String(input?.value || "").trim();
      if (!name) {
        setMsg("Bitte einen Namen für den Standort eingeben.");
        return;
      }
      const row = {
        id: `loc:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        name,
        lat: state.center.lat,
        lon: state.center.lon,
      };
      state.savedLocations.unshift(row);
      state.savedLocations = state.savedLocations.slice(0, 30);
      persistSaved();
      renderSavedLocations();
      if (input) input.value = "";
      setMsg("Standort gespeichert.");
    });

    document.getElementById("adminApiRadarRefresh")?.addEventListener("click", async () => {
      if (!state.map) return;
      await updateRadarLayer();
    });

    document.getElementById("adminApiRadarOpacity")?.addEventListener("input", (e) => {
      const n = Number(e?.target?.value);
      if (!Number.isFinite(n)) return;
      state.radarOpacity = Math.min(0.9, Math.max(0.2, n / 100));
      if (state.radarLayer?.setOpacity) state.radarLayer.setOpacity(state.radarOpacity);
    });

    document.getElementById("adminApiRadarFrame")?.addEventListener("change", (e) => {
      const idx = Number(e?.target?.value);
      if (!Number.isFinite(idx)) return;
      state.radarIndex = Math.max(0, Math.min(state.radarFrames.length - 1, idx));
      applyRadarFrame();
    });

    document.getElementById("adminApiRadarPrev")?.addEventListener("click", () => {
      if (!state.radarFrames.length) return;
      state.radarIndex = Math.max(0, state.radarIndex - 1);
      applyRadarFrame();
    });

    document.getElementById("adminApiRadarNext")?.addEventListener("click", () => {
      if (!state.radarFrames.length) return;
      state.radarIndex = Math.min(state.radarFrames.length - 1, state.radarIndex + 1);
      applyRadarFrame();
    });

    document.getElementById("adminApiWeatherToggle")?.addEventListener("click", () => {
      const btn = document.getElementById("adminApiWeatherToggle");
      const panel = document.getElementById("adminApiWeatherForecast");
      if (!btn || !panel) return;
      const expanded = btn.getAttribute("aria-expanded") === "true";
      const next = !expanded;
      btn.setAttribute("aria-expanded", next ? "true" : "false");
      btn.textContent = next ? "Wettervorschau (7 Tage) ausblenden" : "Wettervorschau (7 Tage) anzeigen";
      panel.hidden = !next;
    });

    document.getElementById("adminApiLocations")?.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action][data-id]");
      if (!btn) return;
      const action = String(btn.getAttribute("data-action") || "");
      const id = String(btn.getAttribute("data-id") || "");
      const loc = state.savedLocations.find((x) => x.id === id);
      if (!loc) return;
      if (action === "goto") {
        setCenter(loc.lat, loc.lon);
        await updateAllData();
        setMsg(`Standort "${loc.name}" geladen.`);
        return;
      }
      if (action === "delete") {
        state.savedLocations = state.savedLocations.filter((x) => x.id !== id);
        persistSaved();
        renderSavedLocations();
        setMsg("Standort gelöscht.");
      }
    });
  }

  async function init() {
    state.savedLocations = loadSaved();
    renderSavedLocations();
    bindEvents();
    try {
      await ensureMap();
      await updateAllData();
      setMsg("Bereit.");
    } catch (err) {
      setMsg(err?.message || "Admin-API-Ansicht konnte nicht initialisiert werden.");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
