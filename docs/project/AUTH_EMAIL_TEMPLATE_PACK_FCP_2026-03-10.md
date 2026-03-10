# FCP Auth E-Mail Template Pack (Supabase)
Stand: 2026-03-10

## Global Setup (Supabase Auth > Email)
- From Name: `Fishing-Club-Portal (VDAN)`
- Reply-To: `vdan.ottenheim@freenet.de`
- Brand Logo URL (HTTPS, eigene Domain): `https://www.vdan-ottenheim.com/assets/email/logo-fcp.png`
- Anbieterhinweis im Footer: `Anbieter: VDAN Ottenheim (siehe Impressum)`

## 1) Confirm sign up
Empfohlener Betreff: `Bitte bestätige deine E-Mail-Adresse`

```html
<div style="font-family:Arial,Helvetica,sans-serif;background:#f4f6f8;padding:40px 20px;">
  <table align="center" width="100%" style="max-width:520px;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.08);">
    <tr>
      <td style="background:#0f172a;padding:24px;text-align:center;">
        <img src="https://www.vdan-ottenheim.com/assets/email/logo-fcp.png" alt="Fishing-Club-Portal" style="height:42px;margin-bottom:8px;">
        <div style="color:#fff;font-size:18px;font-weight:600;">Fishing-Club-Portal</div>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 12px 0;font-size:22px;color:#111;">E-Mail-Adresse bestätigen</h2>
        <p style="font-size:15px;line-height:1.6;color:#444;">Willkommen im <strong>Fishing-Club-Portal (FCP)</strong>.</p>
        <p style="font-size:15px;line-height:1.6;color:#444;">Bitte bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="{{ .ConfirmationURL }}" style="background:#2563eb;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">E-Mail bestätigen</a>
        </div>
        <p style="font-size:14px;color:#666;">Falls der Button nicht funktioniert, nutze diesen Link:</p>
        <p style="word-break:break-all;font-size:13px;color:#2563eb;">{{ .ConfirmationURL }}</p>
        <p style="font-size:14px;color:#666;margin-top:24px;">Wenn du kein Konto erstellt hast, kannst du diese Nachricht ignorieren.</p>
      </td>
    </tr>
    <tr>
      <td style="background:#f1f5f9;padding:18px;text-align:center;font-size:12px;color:#666;">
        Fishing-Club-Portal • VDAN Ottenheim<br>
        Anbieter: VDAN Ottenheim (siehe Impressum)<br>
        Technischer Portalbetrieb: Michael Lauenroth
      </td>
    </tr>
  </table>
</div>
```

## 2) Change email address
Empfohlener Betreff: `Bitte bestätige deine neue E-Mail-Adresse`

```html
<div style="font-family:Arial,Helvetica,sans-serif;background:#f4f6f8;padding:40px 20px;">
  <table align="center" width="100%" style="max-width:520px;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.08);">
    <tr>
      <td style="background:#0f172a;padding:24px;text-align:center;">
        <img src="https://www.vdan-ottenheim.com/assets/email/logo-fcp.png" alt="Fishing-Club-Portal" style="height:42px;margin-bottom:8px;">
        <div style="color:#fff;font-size:18px;font-weight:600;">Fishing-Club-Portal</div>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 12px 0;font-size:22px;color:#111;">Neue E-Mail bestätigen</h2>
        <p style="font-size:15px;line-height:1.6;color:#444;">Du möchtest deine Login-E-Mail ändern.</p>
        <p style="font-size:15px;line-height:1.6;color:#444;">Alt: <strong>{{ .Email }}</strong><br>Neu: <strong>{{ .NewEmail }}</strong></p>
        <div style="text-align:center;margin:28px 0;">
          <a href="{{ .ConfirmationURL }}" style="background:#2563eb;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Neue E-Mail bestätigen</a>
        </div>
        <p style="font-size:14px;color:#666;">Falls der Button nicht funktioniert, nutze diesen Link:</p>
        <p style="word-break:break-all;font-size:13px;color:#2563eb;">{{ .ConfirmationURL }}</p>
        <p style="font-size:14px;color:#666;margin-top:24px;">Wenn du diese Änderung nicht angestoßen hast, ändere bitte sofort dein Passwort.</p>
      </td>
    </tr>
    <tr>
      <td style="background:#f1f5f9;padding:18px;text-align:center;font-size:12px;color:#666;">
        Fishing-Club-Portal • VDAN Ottenheim<br>
        Anbieter: VDAN Ottenheim (siehe Impressum)<br>
        Technischer Portalbetrieb: Michael Lauenroth
      </td>
    </tr>
  </table>
</div>
```

## 3) Reset password
Empfohlener Betreff: `Passwort zurücksetzen`

```html
<div style="font-family:Arial,Helvetica,sans-serif;background:#f4f6f8;padding:40px 20px;">
  <table align="center" width="100%" style="max-width:520px;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.08);">
    <tr>
      <td style="background:#0f172a;padding:24px;text-align:center;">
        <img src="https://www.vdan-ottenheim.com/assets/email/logo-fcp.png" alt="Fishing-Club-Portal" style="height:42px;margin-bottom:8px;">
        <div style="color:#fff;font-size:18px;font-weight:600;">Fishing-Club-Portal</div>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 12px 0;font-size:22px;color:#111;">Passwort zurücksetzen</h2>
        <p style="font-size:15px;line-height:1.6;color:#444;">Für dein Konto wurde ein Passwort-Reset angefordert.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="{{ .ConfirmationURL }}" style="background:#2563eb;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Neues Passwort setzen</a>
        </div>
        <p style="font-size:14px;color:#666;">Falls der Button nicht funktioniert, nutze diesen Link:</p>
        <p style="word-break:break-all;font-size:13px;color:#2563eb;">{{ .ConfirmationURL }}</p>
        <p style="font-size:14px;color:#666;margin-top:24px;">Wenn du das nicht warst, kannst du diese E-Mail ignorieren. Dein aktuelles Passwort bleibt dann unverändert.</p>
      </td>
    </tr>
    <tr>
      <td style="background:#f1f5f9;padding:18px;text-align:center;font-size:12px;color:#666;">
        Fishing-Club-Portal • VDAN Ottenheim<br>
        Anbieter: VDAN Ottenheim (siehe Impressum)<br>
        Technischer Portalbetrieb: Michael Lauenroth
      </td>
    </tr>
  </table>
</div>
```

## 4) Magic link
Empfohlener Betreff: `Dein Anmelde-Link`

```html
<div style="font-family:Arial,Helvetica,sans-serif;background:#f4f6f8;padding:40px 20px;">
  <table align="center" width="100%" style="max-width:520px;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.08);">
    <tr>
      <td style="background:#0f172a;padding:24px;text-align:center;">
        <img src="https://www.vdan-ottenheim.com/assets/email/logo-fcp.png" alt="Fishing-Club-Portal" style="height:42px;margin-bottom:8px;">
        <div style="color:#fff;font-size:18px;font-weight:600;">Fishing-Club-Portal</div>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h2 style="margin:0 0 12px 0;font-size:22px;color:#111;">Anmeldung ohne Passwort</h2>
        <p style="font-size:15px;line-height:1.6;color:#444;">Nutze den folgenden Link für die einmalige Anmeldung:</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="{{ .ConfirmationURL }}" style="background:#2563eb;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Jetzt anmelden</a>
        </div>
        <p style="font-size:14px;color:#666;">Falls der Button nicht funktioniert, nutze diesen Link:</p>
        <p style="word-break:break-all;font-size:13px;color:#2563eb;">{{ .ConfirmationURL }}</p>
        <p style="font-size:14px;color:#666;margin-top:24px;">Wenn du diese Anmeldung nicht angefordert hast, ignoriere die E-Mail.</p>
      </td>
    </tr>
    <tr>
      <td style="background:#f1f5f9;padding:18px;text-align:center;font-size:12px;color:#666;">
        Fishing-Club-Portal • VDAN Ottenheim<br>
        Anbieter: VDAN Ottenheim (siehe Impressum)<br>
        Technischer Portalbetrieb: Michael Lauenroth
      </td>
    </tr>
  </table>
</div>
```

## Test-Check pro Template (kurz)
- Link öffnet korrekt euren Callback.
- `type` wird richtig verarbeitet (`signup`, `recovery`, `email_change`, `magiclink`).
- Nach Callback gibt es klare Weiterleitung (kein Leerzustand).
- Mail landet nicht im Spam bei mindestens 2 Providern.
