;(() => {
  const DEFAULT_COORDS = window.FCPDashboard?.defaultCoords || { lat: 48.3419, lon: 7.8181, label: "Ottenheim" };

  function cfg() {
    const body = document.body;
    const bodyUrl = body?.dataset?.supabaseUrl || "";
    const bodyKey = body?.dataset?.supabaseKey || "";
    return {
      url: String(window.__APP_SUPABASE_URL || bodyUrl).trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || bodyKey).trim(),
    };
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  async function readSession() {
    const auth = window.VDAN_AUTH;
    let active = auth?.loadSession?.() || null;
    if (!active && navigator.onLine && auth?.refreshSession) {
      active = await auth.refreshSession().catch(() => null);
    }
    return active;
  }

  function userId(activeSession = session()) {
    return String(activeSession?.user?.id || "").trim();
  }

  async function sb(path, init = {}, withAuth = false) {
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    if (withAuth && session()?.access_token) headers.set("Authorization", `Bearer ${session().access_token}`);
    const response = await fetch(`${url}${path}`, { ...init, headers });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const error = new Error(err?.message || err?.detail || err?.hint || err?.error_description || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return response.json().catch(() => []);
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
  }

  function format(value, unit = "", digits = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "-";
    return `${number.toFixed(digits)}${unit}`;
  }

  function formatTemp(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "-";
    return `${Math.round(number)}°`;
  }

  function formatDate(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  }

  function formatDateLong(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
  }

  function formatTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "--:--";
    return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }

  function greetingLabel(date = new Date()) {
    const hour = date.getHours();
    if (hour < 12) return "Guten Morgen";
    if (hour < 18) return "Guten Tag";
    return "Guten Abend";
  }

  function nameFromSession(activeSession = session()) {
    const user = activeSession?.user || {};
    const meta = user.user_metadata || {};
    const fullFromParts = [meta.first_name, meta.last_name]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(" ");
    return String(meta.display_name || meta.full_name || fullFromParts || meta.name || "").trim();
  }

  async function loadProfileName(activeSession = session()) {
    const uid = userId(activeSession);
    if (!uid) return "";
    try {
      const accountRows = await sb("/rest/v1/rpc/self_member_profile_get", { method: "POST", body: "{}" }, true).catch(() => []);
      const accountRow = Array.isArray(accountRows) ? accountRows[0] : null;
      const accountFullName = [accountRow?.first_name, accountRow?.last_name]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .join(" ");
      const accountName = String(accountFullName || accountRow?.display_name || accountRow?.email || "").trim();
      if (accountName) return accountName;

      const rows = await sb(`/rest/v1/profiles?select=display_name,first_name,last_name,email&id=eq.${encodeURIComponent(uid)}&limit=1`, { method: "GET" }, true);
      const row = Array.isArray(rows) ? rows[0] : null;
      const fullName = [row?.first_name, row?.last_name]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .join(" ");
      return String(row?.display_name || fullName || row?.email || "").trim();
    } catch {
      return "";
    }
  }

  function applyDashboardGreeting(name) {
    const title = document.querySelector(".app-dashboard__layout-title");
    if (!(title instanceof HTMLElement)) return;
    const cleanName = String(name || "").trim();
    title.textContent = cleanName ? `${greetingLabel()} ${cleanName}` : greetingLabel();
  }

  function nameFromDom() {
    const candidates = [
      document.querySelector(".portal-quick-account-name"),
      document.getElementById("accountLabel"),
      document.getElementById("headerLoginEntryToggle"),
    ];
    for (const node of candidates) {
      const text = String(node?.textContent || "").trim();
      if (!text) continue;
      if (["Portal", "Login", "Nicht eingeloggt", "Account"].includes(text)) continue;
      return text;
    }
    return "";
  }

  function scheduleDashboardGreetingNameFallback() {
    const delays = [0, 300, 900, 1800, 3200];
    delays.forEach((delay) => {
      window.setTimeout(() => {
        const domName = nameFromDom();
        if (domName) applyDashboardGreeting(domName);
      }, delay);
    });
  }

  async function refreshDashboardGreeting() {
    const activeSession = await readSession().catch(() => null);
    applyDashboardGreeting(nameFromSession(activeSession));
    const profileName = await loadProfileName(activeSession).catch(() => "");
    if (profileName) applyDashboardGreeting(profileName);
    else {
      const domName = nameFromDom();
      if (domName) applyDashboardGreeting(domName);
    }
  }

  function statusClass(label) {
    const key = String(label || "").trim().toLowerCase();
    if (["gut", "stabil", "mild", "kühl"].includes(key)) return "is-good";
    if (["beobachten", "wechselhaft", "neutral"].includes(key)) return "is-watch";
    if (["schwach", "fallend", "heiß"].includes(key)) return "is-risk";
    return "";
  }

  function windDirectionLabel(deg) {
    const dirs = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
    const index = Math.round((((Number(deg) || 0) % 360) / 45)) % 8;
    return dirs[index];
  }

  function resolveCoords() {
    try {
      const raw = localStorage.getItem("vdan_admin_locations_v1");
      if (!raw) return DEFAULT_COORDS;
      const parsed = JSON.parse(raw);
      const first = Array.isArray(parsed) ? parsed[0] : null;
      const lat = Number(first?.lat);
      const lon = Number(first?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return DEFAULT_COORDS;
      return {
        lat,
        lon,
        label: String(first?.label || first?.name || DEFAULT_COORDS.label).trim() || DEFAULT_COORDS.label,
      };
    } catch {
      return DEFAULT_COORDS;
    }
  }

  function pressureTrend(bundle) {
    const values = Array.isArray(bundle?.hourly?.pressure_msl) ? bundle.hourly.pressure_msl.map(Number).filter(Number.isFinite) : [];
    if (values.length < 2) return { delta: 0, label: "stabil" };
    const slice = values.slice(0, Math.min(values.length, 6));
    const delta = slice[slice.length - 1] - slice[0];
    if (delta > 1.4) return { delta, label: "leicht steigend" };
    if (delta > 0.4) return { delta, label: "stabil" };
    if (delta < -1.8) return { delta, label: "fallend" };
    if (delta < -0.4) return { delta, label: "leicht fallend" };
    return { delta, label: "stabil" };
  }

  function scoreFishingWindow(bundle) {
    const pressure = pressureTrend(bundle);
    const wind = Number(bundle?.current?.wind_speed_10m);
    const rain = Number(bundle?.daily?.precipitation_probability_max);
    const temp = Number(bundle?.current?.temperature_2m);
    const reasons = [];
    let score = 50;

    if (pressure.label === "stabil" || pressure.label === "leicht steigend") {
      score += 14;
      reasons.push("stabiler Luftdruck");
    } else if (pressure.label === "fallend") {
      score -= 14;
      reasons.push("fallender Druck");
    } else {
      score -= 6;
      reasons.push("leichter Druckabfall");
    }

    if (Number.isFinite(wind)) {
      if (wind <= 18) {
        score += 12;
        reasons.push("leichter Wind");
      } else if (wind <= 28) {
        score += 2;
        reasons.push("mittlerer Wind");
      } else {
        score -= 12;
        reasons.push("starker Wind");
      }
    }

    if (Number.isFinite(rain)) {
      if (rain <= 35) {
        score += 6;
        reasons.push("geringe Regenchance");
      } else if (rain >= 75) {
        score -= 10;
        reasons.push("hohe Regenwahrscheinlichkeit");
      }
    }

    if (Number.isFinite(temp)) {
      if (temp >= 8 && temp <= 21) {
        score += 8;
        reasons.push("moderate Temperatur");
      } else if (temp < 3 || temp > 28) {
        score -= 8;
        reasons.push("extreme Temperatur");
      }
    }

    const result = Math.max(0, Math.min(100, Math.round(score)));
    const label = result >= 65 ? "Gut" : result >= 35 ? "Beobachten" : "Schwach";
    return {
      score: result,
      label,
      reasons: reasons.slice(0, 2),
      trendText: reasons.join(" · ") || "keine klare Tendenz",
    };
  }

  function temperatureLabel(temp) {
    const value = Number(temp);
    if (!Number.isFinite(value)) return "neutral";
    if (value <= 6) return "kühl";
    if (value <= 22) return "mild";
    return "heiß";
  }

  async function loadResponsibilitiesSummary() {
    const rows = await sb("/rest/v1/v_my_responsibilities?select=responsibility_type,source_id,title,status,due_date,created_at&order=due_date.asc.nullslast,created_at.desc", { method: "GET" }, true);
    const list = Array.isArray(rows) ? rows : [];
    const closedStates = new Set(["done", "erledigt", "archived", "closed", "abgeschlossen"]);
    const openRows = list.filter((row) => !closedStates.has(String(row?.status || "").toLowerCase()));
    return {
      totalOpen: openRows.length,
      tasksOpen: openRows.filter((row) => String(row?.responsibility_type || "") === "meeting_task").length,
      next: openRows[0] || null,
      rows: openRows.slice(0, 2),
    };
  }

  async function loadUpcomingEventsSummary() {
    const nowIso = new Date().toISOString();
    const [terms, works] = await Promise.all([
      sb(`/rest/v1/club_events?select=id,title,location,starts_at,ends_at,status&status=eq.published&starts_at=gte.${encodeURIComponent(nowIso)}&order=starts_at.asc&limit=3`, { method: "GET" }),
      sb(`/rest/v1/work_events?select=id,title,location,starts_at,ends_at,status&status=eq.published&starts_at=gte.${encodeURIComponent(nowIso)}&order=starts_at.asc&limit=3`, { method: "GET" }),
    ]);
    const normalized = [
      ...(Array.isArray(terms) ? terms : []).map((row) => ({ ...row, kind: "Termin" })),
      ...(Array.isArray(works) ? works : []).map((row) => ({ ...row, kind: "Arbeitseinsatz" })),
    ].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    return {
      totalUpcoming: normalized.length,
      todayCount: normalized.filter((row) => new Date(row.starts_at).toDateString() === new Date().toDateString()).length,
      next: normalized[0] || null,
      rows: normalized.slice(0, 2),
    };
  }

  async function loadCatchSummary() {
    const userId = session()?.user?.id;
    if (!userId) {
      return { tripsTotal: 0, noCatchDays: 0, catchesTotal: 0, lastEntryAt: null, tripsMonth: 0, lastCatch: null };
    }
    const [trips, catches] = await Promise.all([
      sb(`/rest/v1/fishing_trips?select=id,trip_date,entry_type,created_at,water_bodies(name)&user_id=eq.${encodeURIComponent(userId)}&order=trip_date.desc,created_at.desc&limit=500`, { method: "GET" }, true),
      sb(`/rest/v1/catch_entries?select=id,fishing_trip_id,caught_on,created_at,water_body_id,quantity,fish_species(name)&user_id=eq.${encodeURIComponent(userId)}&order=caught_on.desc,created_at.desc&limit=1000`, { method: "GET" }, true),
    ]);
    const tripRows = Array.isArray(trips) ? trips : [];
    const catchRows = Array.isArray(catches) ? catches : [];
    const tripMap = new Map(tripRows.map((row) => [String(row?.id || ""), row]));
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthlyTrips = tripRows.filter((row) => String(row?.trip_date || "").startsWith(currentMonth));
    const lastTripAt = tripRows[0]?.created_at || null;
    const lastCatchAt = catchRows[0]?.created_at || null;
    const lastEntryAt = [lastTripAt, lastCatchAt].filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;
    const lastCatchRow = catchRows.find((row) => String(row?.fish_species?.name || "").trim()) || null;
    const sourceTrip = lastCatchRow ? tripMap.get(String(lastCatchRow.fishing_trip_id || "")) : null;

    return {
      tripsTotal: tripRows.length,
      tripsMonth: monthlyTrips.length,
      noCatchDays: tripRows.filter((row) => row?.entry_type === "no_catch").length,
      catchesTotal: catchRows.reduce((sum, row) => sum + Number(row?.quantity || 0), 0),
      lastEntryAt,
      lastCatch: lastCatchRow ? {
        species: String(lastCatchRow?.fish_species?.name || "").trim() || "Fang",
        caughtOn: lastCatchRow?.caught_on || lastCatchRow?.created_at || null,
        water: String(sourceTrip?.water_bodies?.name || "-"),
      } : null,
    };
  }

  function pressureArrow(label) {
    const key = String(label || "").toLowerCase();
    if (key.includes("steigend")) return "↑";
    if (key.includes("fallend")) return "↓";
    return "→";
  }

  function renderMiniStatCard(label, value, badge, tone = "", badgeHtml = "") {
    return `
      <article class="fcp-decision-widget__mini">
        <p class="fcp-decision-widget__mini-label">${esc(label)}</p>
        <p class="fcp-decision-widget__mini-value">${esc(value)}</p>
        ${badgeHtml || `<span class="fcp-dashboard-status-pill ${esc(statusClass(tone))}">${esc(badge)}</span>`}
      </article>
    `;
  }

  function weatherToneClass(code, temp) {
    const c = Number(code);
    const t = Number(temp);
    if ([95, 96, 99].includes(c)) return "is-storm";
    if ([71, 73, 75, 77, 85, 86].includes(c)) return "is-snow";
    if (Number.isFinite(t) && t <= 0 && [0, 1, 2, 3, 45, 48].includes(c)) return "is-frost";
    if ([61, 63, 65, 66, 67, 80, 81, 82, 51, 53, 55, 56, 57].includes(c)) return "is-rainy";
    if ([3, 45, 48].includes(c)) return "is-muted";
    if ([1, 2].includes(c)) return "is-bright";
    if (c === 0) return "is-clear";
    return Number.isFinite(t) && t <= 0 ? "is-frost" : "is-muted";
  }

  function hourlyOutlook(bundle, count = 5) {
    const hourly = bundle?.hourly || {};
    const times = Array.isArray(hourly.time) ? hourly.time : [];
    const temps = Array.isArray(hourly.temperature_2m) ? hourly.temperature_2m : [];
    const codes = Array.isArray(hourly.weather_code) ? hourly.weather_code : [];
    const now = Date.now();
    const startIndex = Math.max(0, times.findIndex((value) => {
      const ts = new Date(value).getTime();
      return Number.isFinite(ts) && ts >= now - 30 * 60 * 1000;
    }));

    return times.slice(startIndex, startIndex + count).map((time, index) => ({
      time,
      temp: temps[startIndex + index],
      code: codes[startIndex + index],
    })).filter((item) => item.time);
  }

  function forecastGlyph(code) {
    const c = Number(code);
    if ([61, 63, 65, 66, 67, 80, 81, 82, 51, 53, 55, 56, 57].includes(c)) return "🌧";
    if ([95, 96, 99].includes(c)) return "⛈";
    if ([71, 73, 75, 77, 85, 86].includes(c)) return "❄";
    if ([1, 2].includes(c)) return "⛅";
    if (c === 0) return "☀";
    return "☁";
  }

  function renderForecastStep(step, index) {
    return `
      <span class="fcp-decision-widget__forecast-pill">
        <span class="fcp-decision-widget__forecast-time">${esc(index === 0 ? "Jetzt" : formatTime(step.time))}</span>
        <span class="fcp-decision-widget__forecast-symbol" aria-hidden="true">${esc(forecastGlyph(step.code))}</span>
        <span class="fcp-decision-widget__forecast-temp">${esc(format(step.temp, "°"))}</span>
      </span>
    `;
  }

  function renderDecisionSceneIcon(code, isDay) {
    const uid = `decision-scene-${Math.random().toString(36).slice(2, 8)}`;
    return `
      <div class="fcp-decision-widget__scene-icon" aria-hidden="true">
        ${window.FCPDashboard.weatherIconSvg(code, { isDay, uid })}
      </div>
    `;
  }

  function renderDecisionBackdrop(code) {
    const c = Number(code);
    if ([61, 63, 65, 66, 67, 80, 81, 82, 51, 53, 55, 56, 57, 95, 96, 99].includes(c)) {
      return `
        <div class="fcp-decision-widget__backdrop fcp-decision-widget__backdrop--rainy" aria-hidden="true">
          <span class="fcp-decision-widget__mist fcp-decision-widget__mist--one"></span>
          <span class="fcp-decision-widget__mist fcp-decision-widget__mist--two"></span>
          <span class="fcp-decision-widget__drop fcp-decision-widget__drop--one"></span>
          <span class="fcp-decision-widget__drop fcp-decision-widget__drop--two"></span>
          <span class="fcp-decision-widget__drop fcp-decision-widget__drop--three"></span>
        </div>
      `;
    }
    if ([1, 2].includes(c) || c === 0) {
      return `
        <div class="fcp-decision-widget__backdrop fcp-decision-widget__backdrop--bright" aria-hidden="true">
          <span class="fcp-decision-widget__sun-glow"></span>
          <span class="fcp-decision-widget__mist fcp-decision-widget__mist--one"></span>
        </div>
      `;
    }
    return `
      <div class="fcp-decision-widget__backdrop fcp-decision-widget__backdrop--muted" aria-hidden="true">
        <span class="fcp-decision-widget__mist fcp-decision-widget__mist--one"></span>
      </div>
    `;
  }

  function renderDecisionHero(bundle) {
    const current = bundle?.current || {};
    const daily = bundle?.daily || {};
    const decision = scoreFishingWindow(bundle);
    const pressure = pressureTrend(bundle);
    const forecast = hourlyOutlook(bundle, 5);
    const rainHigh = Number(daily.precipitation_probability_max) >= 75;
    const weatherCode = current.weather_code ?? daily.weather_code ?? 0;
    const weatherTone = weatherToneClass(weatherCode, current.temperature_2m ?? daily.temperature_2m_min);
    const isDay = Number(current.is_day ?? 1) === 1;
    return {
      eyebrow: "ANGELFENSTER HEUTE",
      title: "",
      subtitle: "",
      role: "decision",
      kind: "decision",
      size: "hero",
      toneClass: weatherTone,
      bodyHtml: `
        <div class="fcp-decision-widget">
          <div class="fcp-decision-widget__main">
            <p class="fcp-decision-widget__score">${esc(format(decision.score, " %"))} <span>→</span></p>
            <p class="fcp-decision-widget__verdict">${esc(decision.label)}</p>
          </div>
          <div class="fcp-decision-widget__side">
            <div class="fcp-decision-widget__weather-panel ${weatherTone}">
              <div class="fcp-decision-widget__scene">
                ${renderDecisionSceneIcon(weatherCode, isDay)}
                <div class="fcp-decision-widget__scene-copy">
                  <p class="fcp-decision-widget__scene-label">${esc(window.FCPDashboard.weatherLabelForCode(weatherCode))}</p>
                  <p class="fcp-decision-widget__scene-summary">${esc(decision.trendText)}</p>
                </div>
              </div>
              <div class="fcp-decision-widget__chips">
                <span class="fcp-decision-widget__chip"><strong>${esc(pressureArrow(pressure.label))}</strong> Druck</span>
                <span class="fcp-decision-widget__chip"><strong>${esc(windDirectionLabel(current.wind_direction_10m))}</strong> Wind</span>
                <span class="fcp-decision-widget__chip"><strong>${esc(rainHigh ? "hoch" : "ruhig")}</strong> Regen</span>
              </div>
              <div class="fcp-decision-widget__forecast">
                ${forecast.map((step, index) => renderForecastStep(step, index)).join("")}
              </div>
            </div>
          </div>
        </div>
      `,
      footerHtml: "",
    };
  }

  function renderContextStat(title, value, badge, meta, badgeHtml = "") {
    return `
      <div class="fcp-dashboard-stat fcp-dashboard-stat--v2">
        <p class="fcp-dashboard-stat__value">${esc(value)}</p>
        ${badgeHtml || `<span class="fcp-dashboard-status-pill ${esc(statusClass(badge))}">${esc(badge)}</span>`}
        <p class="fcp-dashboard-stat__meta">${esc(meta)}</p>
      </div>
    `;
  }

  function renderTasksBody(summary) {
    const rows = Array.isArray(summary?.rows) ? summary.rows : [];
    const total = Number(summary?.totalOpen || 0);
    return `
      <div class="fcp-action-widget">
        <div class="fcp-action-widget__topline">
          <span class="fcp-action-widget__icon">✓</span>
          <p class="fcp-action-widget__value">${esc(format(total))}</p>
        </div>
        <div class="fcp-action-widget__copy">
          <p class="fcp-action-widget__headline">${total === 1 ? "Offene Aufgabe" : "Offene Aufgaben"}</p>
          <p class="fcp-action-widget__meta">${rows[0]?.title ? `${esc(rows[0].title)}` : "Keine offenen Aufgaben"}</p>
        </div>
      </div>
    `;
  }

  function renderEventsBody(summary) {
    const todayCount = Number(summary?.todayCount || 0);
    return `
      <div class="fcp-action-widget">
        <div class="fcp-action-widget__topline">
          <span class="fcp-action-widget__icon">⌁</span>
          <p class="fcp-action-widget__value">${esc(format(todayCount))}</p>
        </div>
        <div class="fcp-action-widget__copy">
          <p class="fcp-action-widget__headline">${todayCount === 1 ? "Termin heute" : "Termine heute"}</p>
          <p class="fcp-action-widget__meta">${summary?.next?.title ? `${esc(summary.next.title)} · ${esc(formatTime(summary.next.starts_at))}` : "Keine anstehenden Termine"}</p>
        </div>
      </div>
    `;
  }

  function renderCatchRatioBody(summary) {
    const trips = Number(summary?.tripsTotal || 0);
    const noCatch = Number(summary?.noCatchDays || 0);
    const ratio = trips > 0 ? Math.round(((trips - noCatch) / trips) * 100) : 0;
    return `
      <div class="fcp-dashboard-ring">
        <div class="fcp-dashboard-ring__dial" style="--ring-progress:${ratio};">
          <span>${esc(format(ratio, " %"))}</span>
        </div>
        <p class="fcp-dashboard-ring__label">Fangquote</p>
        <p class="fcp-dashboard-ring__meta">${esc(format(trips - noCatch))} Fangtage · ${esc(format(noCatch))} Kein-Fang</p>
      </div>
    `;
  }

  function renderTripDaysBody(summary) {
    const monthLabel = new Date().toLocaleDateString("de-DE", { month: "long" });
    return `
      <div class="fcp-dashboard-stat fcp-dashboard-stat--identity">
        <p class="fcp-dashboard-stat__value">${esc(format(summary?.tripsMonth || 0))}</p>
        <p class="fcp-dashboard-stat__headline">Angeltage</p>
        <p class="fcp-dashboard-stat__meta">im ${esc(monthLabel)}</p>
      </div>
    `;
  }

  function renderLastCatchBody(summary) {
    if (!summary?.lastCatch) {
      return `<div class="fcp-dashboard-lastcatch"><p class="fcp-dashboard-lastcatch__headline">Letzter Fang</p><p class="fcp-dashboard-lastcatch__empty">Noch kein Fang erfasst</p></div>`;
    }
    return `
      <div class="fcp-dashboard-lastcatch">
        <p class="fcp-dashboard-lastcatch__headline">Letzter Fang</p>
        <p class="fcp-dashboard-lastcatch__species">${esc(summary.lastCatch.species)}</p>
        <p class="fcp-dashboard-lastcatch__meta">${esc(formatDateLong(summary.lastCatch.caughtOn))} · ${esc(summary.lastCatch.water)}</p>
      </div>
    `;
  }

  function renderCalendarBody(eventsSummary) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const eventDays = new Set((eventsSummary?.rows || []).map((row) => {
      const d = new Date(row?.starts_at);
      return Number.isNaN(d.getTime()) ? -1 : d.getDate();
    }));
    const cells = [];
    for (let i = 0; i < offset; i += 1) cells.push(`<span class="fcp-dashboard-calendar__cell is-empty"></span>`);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const classes = [
        "fcp-dashboard-calendar__cell",
        day === now.getDate() ? "is-today" : "",
        eventDays.has(day) ? "has-event" : "",
      ].filter(Boolean).join(" ");
      cells.push(`<span class="${classes}">${day}</span>`);
    }
    return `
      <div class="fcp-dashboard-calendar">
        <p class="fcp-dashboard-calendar__month">${esc(now.toLocaleDateString("de-DE", { month: "long", year: "numeric" }))}</p>
        <div class="fcp-dashboard-calendar__grid">${cells.join("")}</div>
      </div>
    `;
  }

  function renderCompassBody(bundle) {
    const direction = Number(bundle?.current?.wind_direction_10m);
    return `
      <div class="fcp-dashboard-compass">
        <div class="fcp-dashboard-compass__dial" style="--wind-rotation:${Number.isFinite(direction) ? direction : 0}deg;">
          <span class="fcp-dashboard-compass__north">N</span>
          <span class="fcp-dashboard-compass__east">O</span>
          <span class="fcp-dashboard-compass__south">S</span>
          <span class="fcp-dashboard-compass__west">W</span>
          <span class="fcp-dashboard-compass__needle"></span>
        </div>
        <p class="fcp-dashboard-compass__label">${esc(windDirectionLabel(direction))} · ${esc(format(direction, "°"))}</p>
      </div>
    `;
  }

  function renderSunBody(bundle) {
    const sunrise = bundle?.daily?.sunrise || "";
    const sunset = bundle?.daily?.sunset || "";
    const progress = (() => {
      const rise = sunrise ? new Date(sunrise) : null;
      const set = sunset ? new Date(sunset) : null;
      if (!rise || !set || Number.isNaN(rise.getTime()) || Number.isNaN(set.getTime())) return 0.5;
      const total = set.getTime() - rise.getTime();
      if (total <= 0) return 0.5;
      return Math.max(0, Math.min(1, (Date.now() - rise.getTime()) / total));
    })();
    const x = 18 + progress * 124;
    const y = 74 - Math.sin(progress * Math.PI) * 34;
    return `
      <div class="fcp-dashboard-sunmini">
        <p class="fcp-dashboard-sunmini__meta">Auf- / Untergang</p>
        <svg viewBox="0 0 160 84" aria-hidden="true" focusable="false">
          <path d="M18 72 C54 28 106 28 142 72" fill="none" stroke="rgba(244,168,37,.78)" stroke-width="3" stroke-linecap="round"></path>
          <circle cx="${x}" cy="${y}" r="5" fill="#f4a825"></circle>
        </svg>
      </div>
    `;
  }

  function ctaLink(href, label) {
    return `<a class="fcp-dashboard-cta" href="${esc(href)}">${esc(label)}</a>`;
  }

  function initWidget(rootId, config) {
    const root = document.getElementById(rootId);
    if (!(root instanceof HTMLElement) || !window.FCPDashboard) return null;
    return window.FCPDashboard.createWidgetV1({ root, ...config });
  }

  async function init() {
    if (!window.FCPDashboard) return;
    refreshDashboardGreeting().catch(() => {});
    scheduleDashboardGreetingNameFallback();
    const decisionWidget = initWidget("portalDecisionWidget", { eyebrow: "FCP Dashboard Widget v1", title: "", subtitle: "", size: "hero", role: "decision", kind: "decision", priorityDesktop: 1, priorityMobile: 1 });
    const pressureWidget = initWidget("portalPressureWidget", { eyebrow: "Luftdruck", title: "", subtitle: "", size: "compact", role: "context", kind: "stat", priorityDesktop: 2, priorityMobile: 6 });
    const windWidget = initWidget("portalWindWidget", { eyebrow: "Wind", title: "", subtitle: "", size: "compact", role: "context", kind: "stat", priorityDesktop: 3, priorityMobile: 7 });
    const tempWidget = initWidget("portalTempWidget", { eyebrow: "Temperatur", title: "", subtitle: "", size: "compact", role: "context", kind: "stat", priorityDesktop: 4, priorityMobile: 8 });
    const tasksWidget = initWidget("portalTasksWidget", { eyebrow: "Aufgaben offen", size: "wide", role: "action", kind: "list", clickMode: "deeplink", deeplink: "/app/zustaendigkeiten/", priorityDesktop: 5, priorityMobile: 2 });
    const eventsWidget = initWidget("portalEventsWidget", { eyebrow: "Nächste Termine", size: "wide", role: "action", kind: "list", clickMode: "deeplink", deeplink: "/app/eventplaner/", priorityDesktop: 6, priorityMobile: 3 });
    const catchRatioWidget = initWidget("portalCatchRatioWidget", { eyebrow: "Fang / Kein Fang", size: "compact", role: "identity", kind: "chart", clickMode: "deeplink", deeplink: "/app/fangliste/", priorityDesktop: 7, priorityMobile: 4 });
    const tripDaysWidget = initWidget("portalTripDaysWidget", { eyebrow: "Angeltage", size: "compact", role: "identity", kind: "stat", clickMode: "deeplink", deeplink: "/app/fangliste/", priorityDesktop: 8, priorityMobile: 5 });
    const lastCatchWidget = initWidget("portalLastCatchWidget", { eyebrow: "Letzter Fang", size: "compact", role: "identity", kind: "stat", clickMode: "deeplink", deeplink: "/app/fangliste/", priorityDesktop: 9, priorityMobile: 9 });
    const calendarWidget = initWidget("portalCalendarWidget", { eyebrow: "Mini-Kalender", size: "compact", role: "context", kind: "calendar", clickMode: "deeplink", deeplink: "/app/eventplaner/", priorityDesktop: 10, priorityMobile: 10 });
    const compassWidget = initWidget("portalCompassWidget", { eyebrow: "Kompass", size: "compact", role: "context", kind: "compass", priorityDesktop: 11, priorityMobile: 11 });
    const sunWidget = initWidget("portalSunWidget", { eyebrow: "Sonnenverlauf", size: "compact", role: "context", kind: "chart", priorityDesktop: 12, priorityMobile: 12 });

    [
      decisionWidget, pressureWidget, windWidget, tempWidget, tasksWidget, eventsWidget,
      catchRatioWidget, tripDaysWidget, lastCatchWidget, calendarWidget, compassWidget, sunWidget,
    ].filter(Boolean).forEach((widget) => widget.setLoading("Widget wird geladen..."));

    const coords = resolveCoords();
    const weatherPromise = window.FCPDashboard.fetchWeatherBundle(coords).catch(() => null);
    const responsibilitiesPromise = loadResponsibilitiesSummary().catch(() => ({ totalOpen: 0, tasksOpen: 0, next: null, rows: [] }));
    const eventsPromise = loadUpcomingEventsSummary().catch(() => ({ totalUpcoming: 0, todayCount: 0, next: null, rows: [] }));
    const catchPromise = loadCatchSummary().catch(() => ({ tripsTotal: 0, tripsMonth: 0, noCatchDays: 0, catchesTotal: 0, lastEntryAt: null, lastCatch: null }));

    const [bundle, responsibilities, eventsSummary, catchSummary] = await Promise.all([
      weatherPromise,
      responsibilitiesPromise,
      eventsPromise,
      catchPromise,
    ]);

    if (decisionWidget) {
      if (bundle) {
        decisionWidget.setContent(renderDecisionHero(bundle));
      } else {
        decisionWidget.setError("Wetterdaten nicht verfügbar");
      }
    }

    if (pressureWidget) {
      if (bundle) {
        const pressure = pressureTrend(bundle);
        pressureWidget.setContent({
          eyebrow: "Luftdruck",
          title: "",
          subtitle: "",
          size: "compact",
          role: "context",
          kind: "stat",
          bodyHtml: renderContextStat("Luftdruck", format(bundle.current?.pressure_msl, " hPa"), "", "Drucklage heute", `<span class="fcp-dashboard-status-pill is-trend" aria-label="${esc(pressure.label)}">${pressureArrow(pressure.label)}</span>`),
        });
      } else pressureWidget.setError("Keine Druckdaten");
    }

    if (windWidget) {
      if (bundle) {
        const dir = windDirectionLabel(bundle.current?.wind_direction_10m);
        windWidget.setContent({
          eyebrow: "Wind",
          size: "compact",
          role: "context",
          kind: "stat",
          bodyHtml: renderContextStat("Wind", format(bundle.current?.wind_speed_10m, " km/h"), dir, "Richtung am Wasser"),
        });
      } else windWidget.setError("Keine Winddaten");
    }

    if (tempWidget) {
      if (bundle) {
        const label = temperatureLabel(bundle.current?.temperature_2m);
        tempWidget.setContent({
          eyebrow: "Temperatur",
          size: "compact",
          role: "context",
          kind: "stat",
          bodyHtml: renderContextStat("Temperatur", formatTemp(bundle.current?.temperature_2m), label, "Tagesgefühl"),
        });
      } else tempWidget.setError("Keine Temperaturdaten");
    }

    if (tasksWidget) {
      tasksWidget.setContent({
        eyebrow: "Aufgaben offen",
        size: "wide",
        role: "action",
        kind: "list",
        bodyHtml: renderTasksBody(responsibilities),
        footerHtml: `<span>${responsibilities.next?.due_date ? `${esc(formatDateLong(responsibilities.next.due_date))}` : "Keine offenen Aufgaben"}</span>${ctaLink("/app/zustaendigkeiten/", "Anzeigen")}`,
      });
    }

    if (eventsWidget) {
      eventsWidget.setContent({
        eyebrow: "Nächste Termine",
        size: "wide",
        role: "action",
        kind: "list",
        bodyHtml: renderEventsBody(eventsSummary),
        footerHtml: `<span>${eventsSummary.next?.starts_at ? `${esc(formatDateLong(eventsSummary.next.starts_at))}` : "Keine Termine geplant"}</span>${ctaLink("/app/eventplaner/", "Kalender")}`,
      });
    }

    if (catchRatioWidget) {
      catchRatioWidget.setContent({
        eyebrow: "Fang / Kein Fang",
        size: "compact",
        role: "identity",
        kind: "chart",
        bodyHtml: renderCatchRatioBody(catchSummary),
      });
    }

    if (tripDaysWidget) {
      tripDaysWidget.setContent({
        eyebrow: "Angeltage",
        size: "compact",
        role: "identity",
        kind: "stat",
        bodyHtml: renderTripDaysBody(catchSummary),
      });
    }

    if (lastCatchWidget) {
      lastCatchWidget.setContent({
        eyebrow: "Letzter Fang",
        size: "compact",
        role: "identity",
        kind: "stat",
        bodyHtml: renderLastCatchBody(catchSummary),
      });
    }

    if (calendarWidget) {
      calendarWidget.setContent({
        eyebrow: "Mini-Kalender",
        size: "compact",
        role: "context",
        kind: "calendar",
        bodyHtml: renderCalendarBody(eventsSummary),
        footerHtml: ctaLink("/app/eventplaner/", "Kalender"),
      });
    }

    if (compassWidget) {
      if (bundle) {
        compassWidget.setContent({
          eyebrow: "Kompass",
          size: "compact",
          role: "context",
          kind: "compass",
          bodyHtml: renderCompassBody(bundle),
        });
      } else compassWidget.setError("Keine Richtungsdaten");
    }

    if (sunWidget) {
      if (bundle) {
        sunWidget.setContent({
          eyebrow: "Sonnenverlauf",
          size: "compact",
          role: "context",
          kind: "chart",
          bodyHtml: renderSunBody(bundle),
          footerHtml: `<span>${esc(formatTime(bundle.daily?.sunrise))} / ${esc(formatTime(bundle.daily?.sunset))}</span>`,
        });
      } else sunWidget.setError("Keine Solardaten");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  document.addEventListener("vdan:session", () => {
    refreshDashboardGreeting().catch(() => {});
  });
})();
