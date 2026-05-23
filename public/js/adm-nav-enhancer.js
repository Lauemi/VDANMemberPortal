/**
 * adm-nav-enhancer.js — Phase B ADM Shell
 * =========================================
 * Post-Render-Enhancement der ADM Nav-Rail.
 * Fügt Icons und Gruppen-Labels ein NACHDEM der ADM-Renderer
 * die .admin-nav-btn Elemente erzeugt hat.
 *
 * PHILOSOPHIE:
 *   Kein Renderer-Code wird angefasst. Kein JSON.
 *   Der Renderer erstellt die Buttons — wir lesen sie und erweitern
 *   sie visuell. MutationObserver beobachtet die Nav dauerhaft,
 *   weil renderNav() bei jedem Sektionswechsel die Nav neu aufbaut
 *   (innerHTML = ""). Der Observer bleibt aktiv und re-enhanced nach
 *   jedem Re-Render.
 *
 * Anbindung: Site.astro lädt dieses Script nur auf /app/* Routen
 * (isAppPath) zusammen mit app-shell-redesign.css.
 */
(function () {
  "use strict";

  /* ── Icon-Mapping: Sektionsname → Unicode-Icon ─────────────────── */
  var ICON = {
    /* ADM-Renderer (Mitgliederverwaltung etc.) */
    "Overview":                           "◫",
    "Vereinsdaten":                       "⌂",
    "Einladungen":                        "↗",
    "Vereinsverwaltung":                  "◉",
    "Rollen / Rechte":                    "◈",
    "Gewaesser":                          "≈",
    "Gewässer":                           "≈",
    "Regelwerke":                         "▤",
    "Ausweise":                           "⬚",
    "Arbeitseinsaetze":                   "⏵",
    "Arbeitseinsätze":                    "⏵",
    "Fangfreigaben":                      "✓",
    "Einstellungen":                      "⚙",
    "Kartenmodell":                       "◧",
    "Mitglieder":                         "◉",
    /* Eventplaner (hardcoded nav, v1 + v2) */
    "Kalender":                           "▦",
    "Events verwalten":                   "◈",
    "Helferanmeldungen / Freigaben":      "✓",
    "DB-Architektur":                     "▤",
    /* Admin-Panel (System-Superadmin) */
    "Dashboard":                          "◫",
    "Vereinsanfragen":                    "↗",
    "Clubs":                              "⌂",
    "Analytics":                          "≈",
    "Bugs":                               "⬚",
    "Finanzen":                           "◧",
    "DSGVO":                              "◑",
    "Security":                           "◈",
    "Module":                             "▤",
    "Modul Web":                          "⏵",
  };

  /* ── Gruppen-Mapping: Sektionsname → Gruppen-Label ─────────────── */
  var GROUP = {
    /* ADM-Renderer */
    "Overview":                           "ClubSettings",
    "Vereinsdaten":                       "ClubSettings",
    "Einladungen":                        "ClubSettings",
    "Vereinsverwaltung":                  "ClubSettings",
    "Rollen / Rechte":                    "ClubSettings",
    "Gewaesser":                          "ClubSettings",
    "Gewässer":                           "ClubSettings",
    "Regelwerke":                         "Operativ",
    "Ausweise":                           "Operativ",
    "Arbeitseinsaetze":                   "Operativ",
    "Arbeitseinsätze":                    "Operativ",
    "Fangfreigaben":                      "Operativ",
    "Einstellungen":                      "System",
    "Kartenmodell":                       "ClubSettings",
    /* Admin-Panel — eigene Gruppen */
    "Dashboard":                          "Übersicht",
    "Vereinsanfragen":                    "Clubs",
    "Clubs":                              "Clubs",
    "Analytics":                          "System",
    "Bugs":                               "System",
    "Finanzen":                           "System",
    "DSGVO":                              "System",
    "Security":                           "System",
    "Module":                             "System",
    "Modul Web":                          "System",
    /* Eventplaner — keine Gruppen (zu wenige Items) */
  };

  /* ── Re-Entrancy-Guard ──────────────────────────────────────────── */
  /* Verhindert, dass eigene DOM-Mutationen (insertBefore, innerHTML)
     den Observer rekursiv triggern. */
  var _busy = false;

  /* ── Enhancement ────────────────────────────────────────────────── */
  function enhance() {
    if (_busy) return;

    var nav = document.querySelector(".admin-board__nav");
    if (!nav) return;

    var buttons = nav.querySelectorAll(".admin-nav-btn");
    if (!buttons.length) return;

    /* Bereits enhanced? Erster Button hat schon .adm-nav__ic → skip.
       Dieser Check schlägt nach einem renderNav()-Reset fehl (keine
       Spans mehr → Re-Enhancement läuft durch). */
    if (buttons[0].querySelector(".adm-nav__ic")) return;

    _busy = true;

    /* Alte Gruppen-Labels entfernen (von vorherigem Render) */
    var oldGroups = nav.querySelectorAll(".adm-nav__group");
    for (var g = 0; g < oldGroups.length; g++) {
      oldGroups[g].parentNode.removeChild(oldGroups[g]);
    }

    var currentGroup = null;

    /* Buttons erneut abfragen (nach Gruppen-Label-Entfernung) */
    var freshButtons = nav.querySelectorAll(".admin-nav-btn");
    for (var i = 0; i < freshButtons.length; i++) {
      var btn = freshButtons[i];
      var text = btn.textContent.trim();
      var icon = ICON[text] || null;
      var group = GROUP[text] || null;

      /* Gruppen-Label vor erstem Item der Gruppe einfügen */
      if (group && group !== currentGroup) {
        currentGroup = group;
        var label = document.createElement("div");
        label.className = "adm-nav__group";
        label.setAttribute("aria-hidden", "true");
        label.textContent = group;
        nav.insertBefore(label, btn);
      }

      /* Icon vor dem Text einfügen */
      if (icon) {
        var ic = document.createElement("span");
        ic.className = "adm-nav__ic";
        ic.setAttribute("aria-hidden", "true");
        ic.textContent = icon;
        btn.innerHTML = "";
        btn.appendChild(ic);
        btn.appendChild(document.createTextNode(text));
      }
    }

    _busy = false;
  }

  /* ── Observer-Start ─────────────────────────────────────────────── */
  function startObserving() {
    /* Sofortversuch */
    enhance();

    /* Observer bleibt dauerhaft aktiv — renderNav() baut Nav neu auf
       (innerHTML = "") bei jedem Sektionswechsel. Ohne dauerhaften
       Observer würden Icons und Gruppen-Labels nach dem ersten Klick
       verschwinden. debounce via setTimeout(0) bündelt Batch-Mutationen
       zu einem einzigen enhance()-Aufruf. */
    var _timer = null;

    var observer = new MutationObserver(function () {
      if (_busy) return;
      clearTimeout(_timer);
      _timer = setTimeout(enhance, 0);
    });

    /* Beobachte body mit subtree — fängt sowohl die initiale Nav-
       Erstellung als auch spätere renderNav()-Re-Renders ab. */
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserving);
  } else {
    startObserving();
  }
})();
