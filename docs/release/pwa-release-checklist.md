# PWA Release Checklist

1. `PUBLIC_APP_VERSION` erhöhen (z. B. `2026.02.24-1`).
2. Build lokal prüfen: `npm run build`.
3. Deploy ausführen.
4. Auf `/app/einstellungen/` mit **Auf Update prüfen** testen.
5. Kurztest:
- Login
- Feed
- Arbeitseinsätze
- Scanner
- Offline öffnen, wieder online, Sync prüfen

Hinweis:
- Neuinstallation der App ist bei normalen Updates nicht erforderlich.
- Bei kritischen Cache-Problemen: einmal „Neu laden“ in Einstellungen ausführen.
