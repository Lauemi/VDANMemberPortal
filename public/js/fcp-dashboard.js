;(() => {
  const WEATHER_BASE = "https://api.open-meteo.com/v1/forecast";
  const DEFAULT_COORDS = { lat: 48.3419, lon: 7.8181, label: "Ottenheim" };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(Number(value) || 0, min), max);
  }

  function formatTemp(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "-";
    return `${Math.round(number)}°`;
  }

  function formatNumber(value, unit = "", digits = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "-";
    return `${number.toFixed(digits)}${unit}`;
  }

  function formatTime(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "--:--";
    return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }

  function moonPhaseLabel(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return "Mond";
    if (v < 0.03 || v > 0.97) return "Neumond";
    if (v < 0.22) return "Zunehmende Sichel";
    if (v < 0.28) return "Erstes Viertel";
    if (v < 0.47) return "Zunehmender Mond";
    if (v < 0.53) return "Vollmond";
    if (v < 0.72) return "Abnehmender Mond";
    if (v < 0.78) return "Letztes Viertel";
    return "Abnehmende Sichel";
  }

  function moonPhaseNow() {
    const lunarCycleSeconds = 2551443;
    const knownNewMoonUtcMs = Date.UTC(1970, 0, 7, 20, 35, 0);
    const nowSeconds = (Date.now() - knownNewMoonUtcMs) / 1000;
    const normalized = ((nowSeconds % lunarCycleSeconds) + lunarCycleSeconds) % lunarCycleSeconds;
    return normalized / lunarCycleSeconds;
  }

  function weatherLabelForCode(code) {
    const c = Number(code);
    if (c === 0) return "Klar";
    if (c === 1) return "Heiter";
    if (c === 2) return "Leicht bewölkt";
    if (c === 3) return "Bedeckt";
    if ([45, 48].includes(c)) return "Nebel";
    if ([51, 53, 55, 56, 57].includes(c)) return "Niesel";
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(c)) return "Regen";
    if ([71, 73, 75, 77, 85, 86].includes(c)) return "Schnee";
    if ([95, 96, 99].includes(c)) return "Gewitter";
    return "Wetterlage";
  }

  function windDirectionLabel(deg) {
    const dirs = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
    const index = Math.round((((Number(deg) || 0) % 360) / 45)) % 8;
    return dirs[index];
  }

  function sunProgress(sunrise, sunset) {
    const rise = sunrise ? new Date(sunrise) : null;
    const set = sunset ? new Date(sunset) : null;
    if (!rise || !set || Number.isNaN(rise.getTime()) || Number.isNaN(set.getTime())) return 0.5;
    const total = set.getTime() - rise.getTime();
    if (total <= 0) return 0.5;
    return clamp((Date.now() - rise.getTime()) / total, 0, 1);
  }

  function sunArcSvg({ sunrise, sunset, progress, uid }) {
    const x = 24 + progress * 152;
    const y = 86 - Math.sin(progress * Math.PI) * 54;
    return `
      <svg viewBox="0 0 200 96" class="fcp-dashboard-suntrack" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="${uid}-sky" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="rgba(95,111,196,.55)"></stop>
            <stop offset="48%" stop-color="rgba(122,171,233,.32)"></stop>
            <stop offset="100%" stop-color="rgba(230,206,124,.10)"></stop>
          </linearGradient>
        </defs>
        <path d="M24 86 C72 30 128 30 176 86" fill="none" stroke="rgba(220,224,208,.14)" stroke-width="3" stroke-linecap="round"></path>
        <path d="M24 86 C72 30 128 30 176 86" fill="none" stroke="url(#${uid}-sky)" stroke-width="4" stroke-linecap="round" stroke-dasharray="8 10"></path>
        <line x1="24" y1="86" x2="24" y2="18" stroke="rgba(220,224,208,.12)" stroke-width="2"></line>
        <line x1="176" y1="86" x2="176" y2="18" stroke="rgba(220,224,208,.12)" stroke-width="2"></line>
        <circle cx="${x}" cy="${y}" r="12" fill="#ffd46e" stroke="rgba(255,239,197,.55)" stroke-width="3"></circle>
        <text x="24" y="16" fill="rgba(228,231,219,.72)" font-size="10" text-anchor="middle">${esc(formatTime(sunrise))}</text>
        <text x="176" y="16" fill="rgba(228,231,219,.72)" font-size="10" text-anchor="middle">${esc(formatTime(sunset))}</text>
      </svg>
    `;
  }

  function weatherIconSvg(code, { isDay = true, uid = "fcp-weather" } = {}) {
    const c = Number(code);
    if (c === 0) {
      return `
        <svg viewBox="0 0 120 120" class="fcp-dashboard-weather-illustration" aria-hidden="true" focusable="false">
          <defs>
            <radialGradient id="${uid}-sun" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#fff4b4"></stop>
              <stop offset="60%" stop-color="#ffd567"></stop>
              <stop offset="100%" stop-color="#ffb938"></stop>
            </radialGradient>
          </defs>
          <circle cx="60" cy="60" r="24" fill="url(#${uid}-sun)"></circle>
          <g stroke="#ffcf66" stroke-linecap="round" stroke-width="6">
            <path d="M60 14v16"></path>
            <path d="M60 90v16"></path>
            <path d="M14 60h16"></path>
            <path d="M90 60h16"></path>
            <path d="M28 28l12 12"></path>
            <path d="M80 80l12 12"></path>
            <path d="M28 92l12-12"></path>
            <path d="M80 40l12-12"></path>
          </g>
        </svg>
      `;
    }
    if ([1, 2].includes(c)) {
      return `
        <svg viewBox="0 0 120 120" class="fcp-dashboard-weather-illustration" aria-hidden="true" focusable="false">
          <defs>
            <radialGradient id="${uid}-sun" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#fff6be"></stop>
              <stop offset="60%" stop-color="#ffd86e"></stop>
              <stop offset="100%" stop-color="#ffb93f"></stop>
            </radialGradient>
            <linearGradient id="${uid}-cloud" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#fafaf6"></stop>
              <stop offset="100%" stop-color="#cdd4df"></stop>
            </linearGradient>
          </defs>
          <circle cx="46" cy="44" r="22" fill="url(#${uid}-sun)"></circle>
          <g fill="url(#${uid}-cloud)">
            <circle cx="70" cy="60" r="22"></circle>
            <circle cx="48" cy="68" r="16"></circle>
            <circle cx="86" cy="70" r="14"></circle>
            <rect x="34" y="68" width="66" height="20" rx="10"></rect>
          </g>
        </svg>
      `;
    }
    if (c === 3 || [45, 48].includes(c)) {
      return `
        <svg viewBox="0 0 120 120" class="fcp-dashboard-weather-illustration" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="${uid}-cloud" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#eef1f6"></stop>
              <stop offset="100%" stop-color="#aeb8c9"></stop>
            </linearGradient>
          </defs>
          <g fill="url(#${uid}-cloud)">
            <circle cx="42" cy="62" r="18"></circle>
            <circle cx="68" cy="54" r="24"></circle>
            <circle cx="88" cy="68" r="18"></circle>
            <rect x="24" y="66" width="78" height="22" rx="11"></rect>
          </g>
          ${[45, 48].includes(c) ? `<g stroke="rgba(216,228,236,.55)" stroke-linecap="round" stroke-width="4"><path d="M26 96h68"></path><path d="M34 104h50"></path></g>` : ""}
        </svg>
      `;
    }
    if ([61, 63, 65, 66, 67, 80, 81, 82, 51, 53, 55, 56, 57].includes(c)) {
      return `
        <svg viewBox="0 0 120 120" class="fcp-dashboard-weather-illustration" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="${uid}-cloud" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#f0f4fa"></stop>
              <stop offset="100%" stop-color="#b7c2d4"></stop>
            </linearGradient>
            <linearGradient id="${uid}-rain" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#79bef4"></stop>
              <stop offset="100%" stop-color="#3f86d3"></stop>
            </linearGradient>
          </defs>
          <g fill="url(#${uid}-cloud)">
            <circle cx="44" cy="58" r="18"></circle>
            <circle cx="68" cy="50" r="24"></circle>
            <circle cx="88" cy="62" r="18"></circle>
            <rect x="26" y="62" width="76" height="22" rx="11"></rect>
          </g>
          <g stroke="url(#${uid}-rain)" stroke-linecap="round" stroke-width="6">
            <path d="M42 88l-6 14"></path>
            <path d="M62 88l-6 14"></path>
            <path d="M82 88l-6 14"></path>
          </g>
        </svg>
      `;
    }
    if ([71, 73, 75, 77, 85, 86].includes(c)) {
      return `
        <svg viewBox="0 0 120 120" class="fcp-dashboard-weather-illustration" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="${uid}-cloud" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#edf0f5"></stop>
              <stop offset="100%" stop-color="#c1cad8"></stop>
            </linearGradient>
          </defs>
          <g fill="url(#${uid}-cloud)">
            <circle cx="44" cy="58" r="18"></circle>
            <circle cx="68" cy="50" r="24"></circle>
            <circle cx="88" cy="62" r="18"></circle>
            <rect x="26" y="62" width="76" height="22" rx="11"></rect>
          </g>
          <g fill="#dff4ff">
            <circle cx="42" cy="96" r="5"></circle>
            <circle cx="60" cy="102" r="5"></circle>
            <circle cx="80" cy="96" r="5"></circle>
          </g>
        </svg>
      `;
    }
    if ([95, 96, 99].includes(c)) {
      return `
        <svg viewBox="0 0 120 120" class="fcp-dashboard-weather-illustration" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="${uid}-cloud" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#eef0f4"></stop>
              <stop offset="100%" stop-color="#9ea7ba"></stop>
            </linearGradient>
            <linearGradient id="${uid}-bolt" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#fff59d"></stop>
              <stop offset="100%" stop-color="#ffb300"></stop>
            </linearGradient>
          </defs>
          <g fill="url(#${uid}-cloud)">
            <circle cx="44" cy="56" r="18"></circle>
            <circle cx="68" cy="48" r="24"></circle>
            <circle cx="88" cy="60" r="18"></circle>
            <rect x="26" y="60" width="76" height="22" rx="11"></rect>
          </g>
          <path d="M62 84h16l-10 16h12l-22 22 7-18h-14z" fill="url(#${uid}-bolt)"></path>
        </svg>
      `;
    }
    return `
      <svg viewBox="0 0 120 120" class="fcp-dashboard-weather-illustration" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="${uid}-wind" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="${isDay ? "#7ec3ff" : "#87aaf7"}"></stop>
            <stop offset="100%" stop-color="rgba(234,242,248,.82)"></stop>
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#${uid}-wind)" stroke-linecap="round" stroke-width="6">
          <path d="M18 46h56c11 0 16-6 16-12 0-7-5-12-12-12-7 0-12 5-12 12"></path>
          <path d="M14 68h74c8 0 14-5 14-11 0-7-6-12-12-12-6 0-10 4-11 9"></path>
          <path d="M26 88h48c10 0 16 6 16 12s-5 10-10 10-8-3-9-7"></path>
        </g>
      </svg>
    `;
  }

  function createWidgetV1(config = {}) {
    const root = config.root instanceof HTMLElement ? config.root : null;
    if (!root) throw new Error("FCP Dashboard Widget v1 braucht einen root Mount-Punkt.");

    function normalizeSize(value) {
      const raw = String(value || "").trim().toLowerCase();
      if (["hero", "wide", "compact", "micro", "stack"].includes(raw)) return raw;
      if (raw === "2x2") return "hero";
      if (raw === "2x1") return "wide";
      if (raw === "1x1") return "compact";
      return "compact";
    }

    const state = {
      eyebrow: config.eyebrow || "",
      title: config.title || "",
      subtitle: config.subtitle || "",
      bodyHtml: config.bodyHtml || "",
      footerHtml: config.footerHtml || "",
      badge: config.badge || "",
      toneClass: config.toneClass || "",
      size: normalizeSize(config.size || config.sizeClass || "compact"),
      kind: config.kind || "stat",
      role: String(config.role || "context").trim().toLowerCase() || "context",
      clickMode: String(config.clickMode || "none").trim().toLowerCase() || "none",
      deeplink: String(config.deeplink || "").trim(),
      priorityDesktop: config.priorityDesktop ?? "",
      priorityMobile: config.priorityMobile ?? "",
    };

    function render() {
      const isLink = state.clickMode === "deeplink" && state.deeplink;
      root.innerHTML = `
        <article class="fcp-dashboard-widget fcp-dashboard-widget--${esc(state.size)} fcp-dashboard-widget--${esc(state.kind)} fcp-dashboard-widget--${esc(state.role)}${state.toneClass ? ` ${esc(state.toneClass)}` : ""}${isLink ? " is-clickable" : ""}" data-fcp-widget-size="${esc(state.size)}" data-fcp-widget-kind="${esc(state.kind)}" data-dashboard-widget-role="${esc(state.role)}" data-dashboard-widget-priority="${esc(state.priorityDesktop)}" data-dashboard-widget-priority-mobile="${esc(state.priorityMobile)}">
          <div class="fcp-dashboard-widget__surface">
            <header class="fcp-dashboard-widget__header">
              <div class="fcp-dashboard-widget__copy">
                ${state.eyebrow ? `<p class="fcp-dashboard-widget__eyebrow">${esc(state.eyebrow)}</p>` : ""}
                ${state.title ? `<h2 class="fcp-dashboard-widget__title">${esc(state.title)}</h2>` : ""}
                ${state.subtitle ? `<p class="fcp-dashboard-widget__subtitle">${esc(state.subtitle)}</p>` : ""}
              </div>
              ${state.badge ? `<span class="fcp-dashboard-widget__badge">${esc(state.badge)}</span>` : ""}
            </header>
            <div class="fcp-dashboard-widget__body">${state.bodyHtml || ""}</div>
            ${state.footerHtml ? `<footer class="fcp-dashboard-widget__footer">${state.footerHtml}</footer>` : ""}
            ${isLink ? `<a class="fcp-dashboard-widget__link" href="${esc(state.deeplink)}" aria-label="${esc(state.title || "Widget öffnen")}"></a>` : ""}
          </div>
        </article>
      `;
    }

    function setContent(patch = {}) {
      Object.assign(state, patch);
      state.size = normalizeSize(state.size);
      render();
    }

    function setLoading(text = "Lade Widget...") {
      setContent({
        bodyHtml: `<div class="fcp-dashboard-widget__state fcp-dashboard-widget__state--loading"><span class="fcp-dashboard-loader" aria-hidden="true"></span><span>${esc(text)}</span></div>`,
        footerHtml: "",
      });
    }

    function setError(text = "Widget konnte nicht geladen werden.") {
      setContent({
        bodyHtml: `<div class="fcp-dashboard-widget__state fcp-dashboard-widget__state--error">${esc(text)}</div>`,
      });
    }

    render();

    return {
      root,
      setContent,
      setLoading,
      setError,
    };
  }

  async function fetchWeatherBundle(coords = {}) {
    const lat = Number(coords.lat ?? DEFAULT_COORDS.lat);
    const lon = Number(coords.lon ?? DEFAULT_COORDS.lon);
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      timezone: "auto",
      forecast_days: "1",
      current: [
        "temperature_2m",
        "apparent_temperature",
        "pressure_msl",
        "precipitation",
        "weather_code",
        "wind_speed_10m",
        "wind_direction_10m",
        "relative_humidity_2m",
        "is_day",
      ].join(","),
      hourly: [
        "pressure_msl",
        "temperature_2m",
        "weather_code",
        "precipitation_probability",
      ].join(","),
      daily: [
        "sunrise",
        "sunset",
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_probability_max",
      ].join(","),
    });
    const response = await fetch(`${WEATHER_BASE}?${params.toString()}`);
    if (!response.ok) throw new Error(`Wetterdaten konnten nicht geladen werden (${response.status}).`);
    const json = await response.json();
    const current = json?.current || {};
    const daily = json?.daily || {};
    const hourly = json?.hourly || {};
    return {
      coords: { lat, lon, label: String(coords.label || DEFAULT_COORDS.label) },
      current,
      hourly: {
        time: Array.isArray(hourly.time) ? hourly.time : [],
        pressure_msl: Array.isArray(hourly.pressure_msl) ? hourly.pressure_msl : [],
        temperature_2m: Array.isArray(hourly.temperature_2m) ? hourly.temperature_2m : [],
        weather_code: Array.isArray(hourly.weather_code) ? hourly.weather_code : [],
        precipitation_probability: Array.isArray(hourly.precipitation_probability) ? hourly.precipitation_probability : [],
      },
      daily: {
        sunrise: Array.isArray(daily.sunrise) ? daily.sunrise[0] : "",
        sunset: Array.isArray(daily.sunset) ? daily.sunset[0] : "",
        weather_code: Array.isArray(daily.weather_code) ? daily.weather_code[0] : current.weather_code,
        temperature_2m_max: Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max[0] : null,
        temperature_2m_min: Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min[0] : null,
        precipitation_probability_max: Array.isArray(daily.precipitation_probability_max) ? daily.precipitation_probability_max[0] : null,
      },
      fetchedAt: new Date(),
      moonPhase: moonPhaseNow(),
    };
  }

  function buildMetric(label, value, meta = "") {
    return `
      <article class="fcp-dashboard-metric">
        <p class="fcp-dashboard-metric__label">${esc(label)}</p>
        <p class="fcp-dashboard-metric__value">${esc(value)}</p>
        ${meta ? `<p class="fcp-dashboard-metric__meta">${esc(meta)}</p>` : ""}
      </article>
    `;
  }

  function renderWeatherWidget(bundle) {
    const current = bundle?.current || {};
    const daily = bundle?.daily || {};
    const code = Number(current.weather_code ?? daily.weather_code ?? 0);
    const isDay = Number(current.is_day ?? 1) === 1;
    const condition = weatherLabelForCode(code);
    const progress = sunProgress(daily.sunrise, daily.sunset);
    const uid = `weather-${Math.random().toString(36).slice(2, 8)}`;
    return {
      eyebrow: "FCP Dashboard Widget v1",
      title: "Wetter am Wasser",
      subtitle: bundle?.coords?.label || DEFAULT_COORDS.label,
      badge: condition,
      bodyHtml: `
        <div class="fcp-dashboard-weather">
          <div class="fcp-dashboard-weather__hero">
            <div class="fcp-dashboard-weather__copy">
              <p class="fcp-dashboard-weather__temp">${esc(formatTemp(current.temperature_2m))}</p>
              <p class="fcp-dashboard-weather__feels">Gefühlt ${esc(formatTemp(current.apparent_temperature))}</p>
              <p class="fcp-dashboard-weather__range">Heute ${esc(formatTemp(daily.temperature_2m_min))} bis ${esc(formatTemp(daily.temperature_2m_max))}</p>
            </div>
            <div class="fcp-dashboard-weather__icon">${weatherIconSvg(code, { isDay, uid })}</div>
          </div>
          <div class="fcp-dashboard-weather__sun">
            ${sunArcSvg({ sunrise: daily.sunrise, sunset: daily.sunset, progress, uid })}
          </div>
          <div class="fcp-dashboard-weather__metrics">
            ${buildMetric("Luftdruck", formatNumber(current.pressure_msl, " hPa"), "ruhiger Vergleichswert")}
            ${buildMetric("Wind", formatNumber(current.wind_speed_10m, " km/h"), windDirectionLabel(current.wind_direction_10m))}
            ${buildMetric("Regen", formatNumber(daily.precipitation_probability_max, " %"), formatNumber(current.precipitation, " mm", 1))}
            ${buildMetric("Feuchte", formatNumber(current.relative_humidity_2m, " %"), "Luftfeuchte")}
          </div>
        </div>
      `,
      footerHtml: `
        <span>Stand ${esc(bundle.fetchedAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }))}</span>
        <span>${esc(condition)}</span>
      `,
      size: "hero",
      kind: "weather",
    };
  }

  async function createWeatherWidgetV1(config = {}) {
    const widget = createWidgetV1({
      root: config.root,
      title: "Wetter am Wasser",
      subtitle: config.placeLabel || DEFAULT_COORDS.label,
      eyebrow: "FCP Dashboard Widget v1",
      size: config.size || config.sizeClass || "hero",
      kind: "weather",
    });
    widget.setLoading("Wetterdaten werden geladen...");
    try {
      const bundle = await fetchWeatherBundle({
        ...DEFAULT_COORDS,
        ...(config.coords || {}),
        label: config.placeLabel || config?.coords?.label || DEFAULT_COORDS.label,
      });
      widget.setContent(renderWeatherWidget(bundle));
      if (typeof config.onData === "function") config.onData(bundle, widget);
      return { widget, bundle };
    } catch (error) {
      widget.setError(error?.message || "Wetterdaten konnten nicht geladen werden.");
      if (typeof config.onError === "function") config.onError(error, widget);
      throw error;
    }
  }

  window.FCPDashboard = Object.freeze({
    createWidgetV1,
    createWeatherWidgetV1,
    fetchWeatherBundle,
    renderWeatherWidget,
    weatherLabelForCode,
    weatherIconSvg,
    moonPhaseNow,
    moonPhaseLabel,
    defaultCoords: { ...DEFAULT_COORDS },
  });
})();
