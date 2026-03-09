# Template-Klassenstruktur (Ist-Zustand)

Quelle: `src/layouts/Site.astro` + `public/css/main.css`

## Kurzantwort auf deine Frage

Nein: Die Gesamtseite ist aktuell **nicht** als globales CSS-Grid mit `header / content / footer` aufgebaut.

- `header` ist `position: sticky`
- `main` ist ein normaler Blockbereich mit Innenabstand
- `footer` ist normal im Dokumentfluss
- zusätzliche Overlays liegen außerhalb des Main-Contents (Portal Quick, Drawer, Dialog)

## Seiten-Grundstruktur (DOM)

```html
<body data-app-theme="...">
  <header class="header">
    <div class="container">
      <nav class="nav">
        <a class="logo">...</a>
        <div class="nav-actions">
          <div class="burger-menu">
            <button class="burger-toggle">...</button>
            <div class="burger-popover">...</div>
          </div>
        </div>
      </nav>
    </div>
  </header>

  <button id="portalQuickToggle" class="portal-quick-toggle">...</button>
  <aside id="portalRail" class="portal-rail">...</aside>
  <div id="portalQuickDrawer" class="portal-quick-drawer">
    <section id="portalQuickPanel" class="portal-quick-panel">...</section>
  </div>

  <section id="goFishingDialog" class="catch-dialog catch-dialog--panel ...">...</section>

  <main class="main">
    <div class="container">...</div>
  </main>

  <footer class="site-footer">
    <div class="container site-footer__inner">...</div>
  </footer>
</body>
```

## Relevante Layout-Klassen

- Shell/Container
  - `.header`
  - `.main`
  - `.site-footer`
  - `.container`
  - `.container--admin-wide`
- Navigation
  - `.nav`
  - `.logo`
  - `.nav-actions`
  - `.burger-menu`
  - `.burger-toggle`
  - `.burger-popover`
- Portal Quick / Overlay
  - `.portal-quick-toggle`
  - `.portal-rail`
  - `.portal-quick-drawer`
  - `.portal-quick-panel`
  - `.portal-quick-list`
- Content-Bausteine (häufig genutzt)
  - `.card`
  - `.card__body`
  - `.feed-btn`
  - `.feed-btn--ghost`
  - `.grid`
  - `.small`

## Wenn du Header / Content / Footer als echtes Grid willst

Dann könnten wir die Shell so umstellen:

```css
body {
  min-height: 100dvh;
  display: grid;
  grid-template-rows: auto 1fr auto;
}
```

Hinweis: Overlay-Elemente (`portal-quick`, Dialoge) bleiben dabei weiterhin als feste Ebenen (`position: fixed`) über dem Grid.
