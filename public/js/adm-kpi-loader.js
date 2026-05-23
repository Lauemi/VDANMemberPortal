/**
 * adm-kpi-loader.js — Phase B ADM Shell
 * =========================================
 * Lädt KPI-Counts aus Supabase und befüllt:
 *   1. #admKpiStrip — Pill-Leiste im ADM-Workspace
 *   2. .admin-nav-btn — Badge-Zahlen auf Nav-Rail-Buttons
 *
 * Pattern: identisch zu app-dashboard.js (cfg/sb-Muster).
 * Auth: VDAN_AUTH.loadSession().access_token (defer → load-Event).
 * Fail-Verhalten: KPI-Strip bleibt hidden, kein Error sichtbar.
 *
 * Supabase-Count via REST:
 *   Header Prefer: count=exact + Range: 0-0
 *   Count in Content-Range: "0-0/N"
 */
(function () {
  "use strict";

  /* ── Supabase-Config (identisch zu app-dashboard.js) ───────────── */
  function cfg() {
    var body = document.body;
    return {
      url: String(window.__APP_SUPABASE_URL || body?.dataset?.supabaseUrl || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || body?.dataset?.supabaseKey || "").trim(),
    };
  }

  function getToken() {
    try {
      return String(window.VDAN_AUTH?.loadSession?.()?.access_token || "").trim();
    } catch (e) {
      return "";
    }
  }

  /* ── Supabase-Count via REST-API ────────────────────────────────── */
  async function sbCount(table, qs) {
    var c = cfg();
    var token = getToken();
    if (!c.url || !c.key) return 0;

    var url = c.url + "/rest/v1/" + table + "?select=id" + (qs ? "&" + qs : "");
    var headers = {
      apikey: c.key,
      Prefer: "count=exact",
      Range: "0-0",
    };
    if (token) headers.Authorization = "Bearer " + token;

    try {
      var res = await fetch(url, { headers: headers });
      if (!res.ok) return 0;
      /* Content-Range: "0-0/352" → wir extrahieren 352 */
      var cr = res.headers.get("Content-Range") || "";
      var m = cr.match(/\/(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    } catch (e) {
      return 0;
    }
  }

  /* ── KPI-Daten parallel laden ───────────────────────────────────── */
  async function fetchKpis() {
    var results = await Promise.all([
      sbCount("club_members"),
      sbCount("catch_entries"),
      sbCount("membership_applications", "status=eq.pending"),
    ]);
    return {
      mitglieder: results[0],
      faenge: results[1],
      antraege: results[2],
    };
  }

  /* ── KPI-Strip rendern ──────────────────────────────────────────── */
  function renderKpiStrip(kpis) {
    var strip = document.getElementById("admKpiStrip");
    if (!strip) return;

    var pills = [
      { label: "Mitglieder", value: kpis.mitglieder, icon: "◉", alert: false },
      { label: "Fänge", value: kpis.faenge, icon: "✓", alert: false },
    ];

    if (kpis.antraege > 0) {
      pills.push({ label: "Offene Anträge", value: kpis.antraege, icon: "↗", alert: true });
    }

    strip.innerHTML = pills
      .map(function (p) {
        var cls = "adm-kpi-pill" + (p.alert ? " adm-kpi-pill--alert" : "");
        return (
          '<div class="' + cls + '">' +
          '<span class="adm-kpi-pill__icon" aria-hidden="true">' + p.icon + "</span>" +
          '<span class="adm-kpi-pill__value">' + p.value + "</span>" +
          '<span class="adm-kpi-pill__label">' + p.label + "</span>" +
          "</div>"
        );
      })
      .join('<div class="adm-kpi-sep" aria-hidden="true">·</div>');

    strip.removeAttribute("hidden");
  }

  /* ── Nav-Rail Badges ────────────────────────────────────────────── */
  /*
   * Fügt Badge-Spans auf .admin-nav-btn ein basierend auf KPI-Counts.
   * Läuft NACH dem adm-nav-enhancer (setTimeout 10 > enhancer setTimeout 0).
   * MutationObserver re-injiziert Badges nach jedem renderNav()-Reset.
   */
  var _badgeCounts = {};
  var _badgeObserver = null;

  /* Welche Nav-Labels bekommen einen Badge? */
  var BADGE_MAP = {
    "Vereinsverwaltung": "antraege",
    "Mitglieder": "antraege",
  };

  function applyNavBadges() {
    var nav = document.querySelector(".admin-board__nav");
    if (!nav) return;

    /* Alte Badges entfernen */
    var old = nav.querySelectorAll(".adm-nav-badge");
    for (var i = 0; i < old.length; i++) {
      old[i].parentNode.removeChild(old[i]);
    }

    /* Buttons durchlaufen und Badges setzen */
    var buttons = nav.querySelectorAll(".admin-nav-btn");
    for (var j = 0; j < buttons.length; j++) {
      var btn = buttons[j];
      /* Text lesen — Icon-Span und eventuelle alte Badges ausblenden */
      var icSpan = btn.querySelector(".adm-nav__ic");
      var rawText = icSpan
        ? btn.textContent.replace(icSpan.textContent, "").trim()
        : btn.textContent.trim();

      var key = BADGE_MAP[rawText];
      if (!key) continue;

      var count = _badgeCounts[key] || 0;
      if (count <= 0) continue;

      var span = document.createElement("span");
      span.className = "adm-nav-badge";
      span.textContent = count > 99 ? "99+" : String(count);
      span.setAttribute("aria-label", count + " ausstehend");
      btn.appendChild(span);
    }
  }

  function startBadgeObserver() {
    var nav = document.querySelector(".admin-board__nav");
    if (!nav || _badgeObserver) return;

    _badgeObserver = new MutationObserver(function () {
      /* Leicht verzögert → adm-nav-enhancer (setTimeout 0) läuft zuerst */
      setTimeout(applyNavBadges, 10);
    });
    _badgeObserver.observe(nav, { childList: true, subtree: false });

    /* Einmal sofort anwenden */
    setTimeout(applyNavBadges, 10);
  }

  /* ── Hauptlogik ─────────────────────────────────────────────────── */
  async function init() {
    /* Auth-Token muss vorhanden sein (VDAN_AUTH via defer) */
    if (!getToken()) return;

    try {
      var kpis = await fetchKpis();

      /* Global cachen für Badge-Observer */
      _badgeCounts = { antraege: kpis.antraege };

      renderKpiStrip(kpis);
      startBadgeObserver();
    } catch (e) {
      /* Silent fail — Strip bleibt hidden */
    }
  }

  /* ── Einstiegspunkte ────────────────────────────────────────────── */
  /*
   * VDAN_AUTH ist über defer geladen → beim DOMContentLoaded
   * möglicherweise noch nicht bereit. Deshalb load-Event als primärer Trigger.
   * Falls VDAN_AUTH doch schon bereit ist, läuft init() früher durch.
   */
  document.addEventListener("DOMContentLoaded", function () {
    if (getToken()) init();
  });

  window.addEventListener("load", function () {
    /* Falls DOMContentLoaded-Versuch fehlschlug (kein Token) → jetzt retry */
    var strip = document.getElementById("admKpiStrip");
    if (strip && strip.hasAttribute("hidden")) init();
  });
})();
