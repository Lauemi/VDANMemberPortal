"use strict";

// Mitglied-Einladen-Dialog (Member-Claim STEP 4).
// Geöffnet aus der Mitgliederverwaltung über die Row-Action "invite".
// Erzeugt einen mitglied-gebundenen Invite-Token und bietet 4 Kanäle:
// Mail (Resend) · QR · Kopieren · WhatsApp.

;(() => {
  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }
  function session() { return window.VDAN_AUTH?.loadSession?.() || null; }

  async function rpc(name, payload = {}) {
    const { url, key } = cfg();
    const headers = new Headers({ apikey: key, "Content-Type": "application/json" });
    const token = session()?.access_token;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST", headers, body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.message || e?.hint || `HTTP ${res.status}`);
    }
    return res.json().catch(() => ({}));
  }

  async function callEdge(fnName, payload) {
    const { url, key } = cfg();
    const headers = new Headers({ apikey: key, "Content-Type": "application/json" });
    const token = session()?.access_token;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${url}/functions/v1/${fnName}`, {
      method: "POST", headers, body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
      throw new Error(json?.error || json?.message || `HTTP ${res.status}`);
    }
    return json;
  }

  function el(tag, opts = {}) {
    const n = document.createElement(tag);
    if (opts.className) n.className = opts.className;
    if (opts.text != null) n.textContent = String(opts.text);
    if (opts.html != null) n.innerHTML = opts.html;
    Object.entries(opts.attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      n.setAttribute(k, v === true ? "" : String(v));
    });
    if (typeof opts.onClick === "function") n.addEventListener("click", opts.onClick);
    return n;
  }

  function field(row, ...keys) {
    for (const k of keys) {
      const v = row?.[k];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  }

  async function open(row, ctx = {}) {
    const clubCode = field(row, "club_code");
    const memberNo = field(row, "member_no");
    const firstName = field(row, "first_name");
    const lastName = field(row, "last_name");
    const name = [lastName, firstName].filter(Boolean).join(", ") || memberNo || "Mitglied";

    const overlay = el("div", { className: "mi-overlay" });
    const dialog = el("div", { className: "mi-dialog" });
    dialog.append(el("h3", { className: "mi-title", text: `Einladen: ${name}` }));
    const statusEl = el("p", { className: "mi-status", text: "Erzeuge Einladung …" });
    dialog.append(statusEl);
    const body = el("div", { className: "mi-body" });
    dialog.append(body);
    const btnClose = el("button", { className: "feed-btn feed-btn--ghost", text: "Schließen", onClick: () => overlay.remove() });
    dialog.append(el("div", { className: "mi-foot" })).append(btnClose);
    overlay.append(dialog);
    document.body.append(overlay);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

    if (!clubCode || !memberNo) {
      statusEl.textContent = "Diesem Mitglied fehlen Vereins-/Nummern-Daten — Einladung nicht möglich.";
      return;
    }

    let result;
    try {
      const raw = await rpc("admin_member_invite_create_by_no", { p_club_code: clubCode, p_member_no: memberNo });
      result = Array.isArray(raw) ? raw[0] : raw;
    } catch (e) {
      statusEl.textContent = `Fehler: ${e?.message || e}`;
      return;
    }
    if (!result?.ok) {
      statusEl.textContent = result?.message || "Einladung konnte nicht erstellt werden.";
      return;
    }

    const token = String(result.token || "");
    const memberEmail = String(result.member_email || "").trim();
    const inviteUrl = `${window.location.origin}/auth/invite-confirm?token=${encodeURIComponent(token)}`;
    const waText = `Hallo ${firstName || name}, du wurdest eingeladen, deinen Zugang zum Vereinsportal zu aktivieren:\n${inviteUrl}`;
    const expires = result.expires_at ? new Date(result.expires_at).toLocaleDateString("de-DE") : "";

    statusEl.textContent = expires ? `Einladung erstellt — gültig bis ${expires}.` : "Einladung erstellt.";

    // Kanal: Mail
    const mailRow = el("div", { className: "mi-channel" });
    const btnMail = el("button", {
      className: "feed-btn",
      text: memberEmail ? `Per Mail an ${memberEmail}` : "Per Mail (keine Adresse hinterlegt)",
      attrs: { disabled: memberEmail ? null : true },
      onClick: async () => {
        btnMail.disabled = true;
        btnMail.textContent = "Sende …";
        try {
          await callEdge("member-invite-send", { token });
          btnMail.textContent = "✓ Mail gesendet";
        } catch (e) {
          btnMail.textContent = "Mail-Fehler";
          statusEl.textContent = `Mail-Versand fehlgeschlagen: ${e?.message || e}`;
          btnMail.disabled = false;
        }
      },
    });
    mailRow.append(btnMail);
    body.append(mailRow);

    // Kanal: WhatsApp
    const waRow = el("div", { className: "mi-channel" });
    waRow.append(el("a", {
      className: "feed-btn mi-wa",
      text: "Per WhatsApp teilen",
      attrs: { href: `https://wa.me/?text=${encodeURIComponent(waText)}`, target: "_blank", rel: "noopener" },
    }));
    body.append(waRow);

    // Kanal: Kopieren
    const copyRow = el("div", { className: "mi-channel" });
    const btnCopy = el("button", {
      className: "feed-btn feed-btn--ghost", text: "Link kopieren",
      onClick: async () => {
        try { await navigator.clipboard.writeText(inviteUrl); btnCopy.textContent = "✓ Kopiert"; }
        catch { btnCopy.textContent = "Kopieren nicht möglich"; }
      },
    });
    copyRow.append(btnCopy);
    body.append(copyRow);

    // Kanal: QR
    const qrRow = el("div", { className: "mi-channel mi-qr" });
    qrRow.append(el("span", { className: "mi-qr-label", text: "QR-Code (zum Scannen):" }));
    qrRow.append(el("img", {
      className: "mi-qr-img",
      attrs: {
        src: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(inviteUrl)}`,
        width: 180, height: 180, alt: "Einladungs-QR-Code", loading: "lazy",
      },
    }));
    body.append(qrRow);
  }

  window.FcpMemberInviteDialog = Object.freeze({ open });
})();
