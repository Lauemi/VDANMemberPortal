;(() => {
  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  function setMsg(text = "", danger = false) {
    const el = document.getElementById("identityMsg");
    if (!el) return;
    el.textContent = text;
    el.style.color = danger ? "var(--danger)" : "";
  }

  function setValue(id, value = "") {
    const el = document.getElementById(id);
    if (el) el.value = String(value || "").trim() || "-";
  }

  function setHidden(id, hidden) {
    const el = typeof id === "string" ? document.getElementById(id) : id;
    if (!el) return;
    el.style.display = hidden ? "none" : "";
    el.toggleAttribute("hidden", hidden);
  }

  async function readErrorPayload(res) {
    const contentType = String(res.headers?.get?.("content-type") || "").toLowerCase();
    if (contentType.includes("application/json")) {
      const j = await res.json().catch(() => ({}));
      return String(j?.error_description || j?.error || j?.message || j?.msg || "").trim();
    }
    return String(await res.text().catch(() => "")).trim();
  }

  async function sb(path, init = {}, withAuth = false) {
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    if (withAuth && session()?.access_token) headers.set("Authorization", `Bearer ${session().access_token}`);

    const res = await fetch(`${url}${path}`, { ...init, headers });
    if (!res.ok) {
      const detail = await readErrorPayload(res);
      throw new Error(detail || `Request failed (${res.status})`);
    }
    return res.json().catch(() => []);
  }

  async function getAuthUser() {
    const token = String(session()?.access_token || "").trim();
    if (!token) return null;
    const { url, key } = cfg();
    const res = await fetch(`${url}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    return res.json().catch(() => null);
  }

  function nextTarget(defaultTarget = "/app/") {
    const q = new URLSearchParams(window.location.search || "");
    const raw = String(q.get("next") || "").trim();
    if (raw.startsWith("/")) return raw;
    return defaultTarget;
  }

  function isPreviewRequest() {
    const q = new URLSearchParams(window.location.search || "");
    return String(q.get("preview") || "").trim() === "1";
  }

  function isConfirmedAt(user) {
    const confirmed = String(user?.email_confirmed_at || user?.confirmed_at || "").trim();
    return Boolean(confirmed);
  }

  function isLegacyLocalEmail(email) {
    const value = String(email || "").trim().toLowerCase();
    return value.endsWith(".local");
  }

  function normalizeMemberNo(value) {
    return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  }

  function renderEmailStatus(user) {
    const statusEl = document.getElementById("identityEmailStatus");
    if (!statusEl) return false;
    const ok = isConfirmedAt(user);
    statusEl.textContent = ok
      ? "E-Mail bestätigt."
      : "E-Mail noch nicht bestätigt. Bitte Verifizierungs-Mail abschließen.";
    statusEl.style.color = ok ? "" : "var(--danger)";
    return ok;
  }

  async function sendEmailVerification() {
    const nextEmail = String(document.getElementById("identityNewEmail")?.value || "").trim().toLowerCase();
    if (!nextEmail || !nextEmail.includes("@")) throw new Error("Bitte eine gültige E-Mail eingeben.");

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/app/zugang-pruefen/")}`;

    await sb("/auth/v1/user", {
      method: "PUT",
      body: JSON.stringify({
        email: nextEmail,
        email_redirect_to: redirectTo,
      }),
    }, true);
  }

  async function syncProfileEmailFromAuth(authEmail) {
    const email = String(authEmail || "").trim().toLowerCase();
    const uid = String(session()?.user?.id || "").trim();
    if (!email || !uid) return;
    await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(uid)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ email }),
    }, true);
  }

  async function loadGateState() {
    const rows = await sb("/rest/v1/rpc/identity_dialog_gate_state", {
      method: "POST",
      body: "{}",
    }, true);
    if (Array.isArray(rows) && rows[0]) return rows[0];
    return null;
  }

  async function loadPortalAccessState() {
    const rows = await sb("/rest/v1/rpc/self_portal_access_state", {
      method: "POST",
      body: "{}",
    }, true);
    if (Array.isArray(rows) && rows[0]) return rows[0];
    return null;
  }

  async function renderUnlinkedState() {
    setHidden("identityUnlinkedBox", false);
    setHidden("identitySummary", true);
    setHidden("identityEmailForm", true);
    setHidden("legacyLoginBox", true);
    setHidden("authOnlyBox", true);
    setHidden("identityCompleteBtn", true);
    setHidden("identityEmailStatus", true);

    const confirmCheck = document.getElementById("identityConfirmCheck");
    const sepaCheck = document.getElementById("identitySepaCheck");
    if (confirmCheck?.parentElement) confirmCheck.parentElement.style.display = "none";
    if (sepaCheck?.parentElement) sepaCheck.parentElement.style.display = "none";

    const modeHint = document.getElementById("identityModeHint");
    if (modeHint) {
      modeHint.textContent = "Dein Portalzugang ist aktuell keinem Vereinskontext zugeordnet.";
    }

    const logoutBtn = document.getElementById("identityLogoutBtn");
    if (logoutBtn && !logoutBtn.dataset.bound) {
      logoutBtn.dataset.bound = "1";
      logoutBtn.addEventListener("click", async () => {
        await window.VDAN_AUTH?.logout?.().catch(() => null);
        window.location.assign("/");
      });
    }

    setMsg("Portalzugang entkoppelt. Für eine spätere Rückkehr brauchst du einen neuen Claim-/Invite-Pfad.");
  }

  async function completeVerification({ sepaApproved = false } = {}) {
    const rows = await sb("/rest/v1/rpc/self_identity_verification_complete", {
      method: "POST",
      body: JSON.stringify({ p_confirmed: true, p_sepa_approved: Boolean(sepaApproved) }),
    }, true);
    return Array.isArray(rows) ? rows[0] : null;
  }

  async function init() {
    if (!session()?.access_token) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login/?next=${next}`);
      return;
    }

    setMsg("Lade Status ...");

    const portalState = await loadPortalAccessState().catch(() => null);
    if (String(portalState?.state_key || "").trim().toLowerCase() === "unlinked") {
      await renderUnlinkedState();
      return;
    }

    setMsg("Lade Prüfstatus ...");

    const gate = await loadGateState();
    if (!gate) {
      setMsg("Prüfstatus konnte nicht geladen werden.", true);
      return;
    }

    const previewMode = isPreviewRequest();
    const forceMode = Boolean(gate.force_enabled && gate.must_verify_identity);
    const previewAllowed = Boolean(gate.dialog_enabled && gate.preview_enabled && previewMode);

    if (!forceMode && !previewAllowed) {
      window.location.replace(nextTarget("/app/"));
      return;
    }

    const modeHint = document.getElementById("identityModeHint");
    if (modeHint) {
      modeHint.textContent = forceMode
        ? "Stop: Kontrolliere deine Daten, um deinen Zugang zu verifizieren."
        : "Preview-Modus aktiv: Du siehst die Prüfmaske vor der verpflichtenden Aktivierung.";
    }

    setValue("identityAccessName", gate.access_name);
    setValue("identityMemberNo", gate.member_no);
    setValue("identityClubCode", gate.club_code);
    setValue("identityFirstName", gate.first_name);
    setValue("identityLastName", gate.last_name);
    setValue("identityProfileEmail", gate.profile_email);

    const authUser = await getAuthUser();
    setValue("identityAuthEmail", authUser?.email || gate.profile_email || "");
    const authEmail = String(authUser?.email || gate.profile_email || "").trim().toLowerCase();
    const legacyLoginMode = isLegacyLocalEmail(authEmail);
    const expectedMemberNo = normalizeMemberNo(gate.member_no);

    const legacyLoginBox = document.getElementById("legacyLoginBox");
    const authOnlyBox = document.getElementById("authOnlyBox");
    if (legacyLoginBox) legacyLoginBox.style.display = legacyLoginMode ? "" : "none";
    if (authOnlyBox) authOnlyBox.style.display = legacyLoginMode ? "none" : "";
    if (!legacyLoginMode) setValue("identityAuthLoginOnly", authUser?.email || gate.profile_email || "");

    if (!String(document.getElementById("identityNewEmail")?.value || "").trim()) {
      const input = document.getElementById("identityNewEmail");
      if (input) input.value = String(authUser?.email || gate.profile_email || "").trim();
    }

    let emailConfirmed = renderEmailStatus(authUser);
    if (legacyLoginMode) {
      setMsg("Legacy-Konto erkannt (.local). Für den Mailwechsel bitte in Supabase 'Secure email change' deaktivieren, dann Verifizierungs-Mail erneut senden.", true);
    } else {
      setMsg(forceMode
        ? "Bitte Daten prüfen und E-Mail-Verifizierung abschließen."
        : "Preview geladen. Du kannst den kompletten Ablauf testen.");
    }

    const refreshBtn = document.getElementById("identityRefreshBtn");
    if (refreshBtn && !refreshBtn.dataset.bound) {
      refreshBtn.dataset.bound = "1";
      refreshBtn.addEventListener("click", async () => {
        const user = await getAuthUser();
        emailConfirmed = renderEmailStatus(user);
        if (emailConfirmed) {
          await syncProfileEmailFromAuth(user?.email).catch(() => null);
        }
        setValue("identityAuthEmail", user?.email || gate.profile_email || "");
        setMsg(emailConfirmed ? "E-Mail-Status aktualisiert: bestätigt." : "E-Mail noch nicht bestätigt.", !emailConfirmed);
      });
    }

    const sendEmailBtn = document.getElementById("identitySendEmailBtn");
    if (sendEmailBtn && !sendEmailBtn.dataset.bound) {
      sendEmailBtn.dataset.bound = "1";
      sendEmailBtn.addEventListener("click", async () => {
        try {
          setMsg("Sende Verifizierungs-Mail ...");
          await sendEmailVerification();
          setMsg("Verifizierungs-Mail gesendet. Bitte bestätigen und danach Status aktualisieren.");
        } catch (err) {
          const raw = String(err?.message || "").trim();
          const hint = isLegacyLocalEmail(authEmail) &&
            /sending email change email|email change/i.test(raw)
            ? "Legacy-Mailwechsel blockiert: Deaktiviere in Supabase Auth > Email den Schalter 'Secure email change' und sende dann erneut."
            : "";
          setMsg(hint || raw || "E-Mail konnte nicht aktualisiert werden.", true);
        }
      });
    }

    const completeBtn = document.getElementById("identityCompleteBtn");
    if (completeBtn && !completeBtn.dataset.bound) {
      completeBtn.dataset.bound = "1";
      completeBtn.addEventListener("click", async () => {
        const checked = Boolean(document.getElementById("identityConfirmCheck")?.checked);
        const sepaChecked = Boolean(document.getElementById("identitySepaCheck")?.checked);
        if (!checked) {
          setMsg("Bitte bestätige zuerst die Prüfung per Checkbox.", true);
          return;
        }
        if (!sepaChecked) {
          setMsg("Bitte bestätige die SEPA-Freigabe für die Erstaktivierung.", true);
          return;
        }
        if (legacyLoginMode) {
          const enteredMemberNo = normalizeMemberNo(document.getElementById("identityMemberNoConfirm")?.value || "");
          if (!enteredMemberNo) {
            setMsg("Bitte Mitgliedsnummer zur Bestätigung eintragen.", true);
            return;
          }
          if (expectedMemberNo && enteredMemberNo !== expectedMemberNo) {
            setMsg("Mitgliedsnummer stimmt nicht mit deinem Konto überein.", true);
            return;
          }
        }
        if (!emailConfirmed) {
          setMsg("E-Mail ist noch nicht bestätigt. Bitte zuerst Verifizierung abschließen.", true);
          return;
        }
        try {
          const user = await getAuthUser();
          if (!isConfirmedAt(user)) {
            setMsg("E-Mail ist noch nicht bestätigt. Bitte zuerst Verifizierung abschließen.", true);
            return;
          }
          await syncProfileEmailFromAuth(user?.email).catch(() => null);
          setMsg("Schließe Prüfung ab ...");
          await completeVerification({ sepaApproved: true });
          setMsg("Prüfung abgeschlossen. Weiterleitung ...");
          window.setTimeout(() => {
            window.location.replace(nextTarget("/app/"));
          }, 140);
        } catch (err) {
          setMsg(err?.message || "Prüfung konnte nicht abgeschlossen werden.", true);
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => {
      setMsg(err?.message || "Prüfmaske konnte nicht geladen werden.", true);
    });
  });
})();
