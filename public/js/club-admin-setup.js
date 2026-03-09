;(() => {
  function cfg() {
    const body = document.body;
    const bodyUrl = String(body?.getAttribute("data-supabase-url") || "").trim();
    const bodyKey = String(body?.getAttribute("data-supabase-key") || "").trim();
    return {
      url: String(window.__APP_SUPABASE_URL || bodyUrl).trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || bodyKey).trim(),
    };
  }

  function hasRuntimeConfig() {
    const { url, key } = cfg();
    if (!url || !key) return false;
    if (/YOUR-|YOUR_|example/i.test(url)) return false;
    if (/YOUR-|YOUR_|example/i.test(key)) return false;
    if (!/^https?:\/\//i.test(url)) return false;
    return true;
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  function setMsg(text = "", danger = false) {
    const el = document.getElementById("clubSetupMsg");
    if (!el) return;
    el.textContent = text;
    el.style.color = danger ? "var(--danger)" : "";
  }

  function setResult(data) {
    const el = document.getElementById("clubSetupResult");
    if (!el) return;
    el.textContent = data ? JSON.stringify(data, null, 2) : "";
  }

  async function copyText(value) {
    const text = String(value || "").trim();
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {
      // fallback below
    }
    window.prompt("Bitte kopieren:", text);
  }

  function setInviteResult(data) {
    const panel = document.getElementById("clubInvitePanel");
    const qr = document.getElementById("clubInviteQr");
    const tokenInput = document.getElementById("clubInviteToken");
    const urlInput = document.getElementById("clubInviteUrl");
    const expiresEl = document.getElementById("clubInviteExpires");
    const openLink = document.getElementById("clubInviteOpenUrl");
    const copyTokenBtn = document.getElementById("clubInviteCopyToken");
    const copyUrlBtn = document.getElementById("clubInviteCopyUrl");

    if (!panel || !qr || !tokenInput || !urlInput || !expiresEl || !openLink || !copyTokenBtn || !copyUrlBtn) return;

    const inviteToken = String(data?.invite_token || "").trim();
    const inviteUrl = String(data?.invite_register_url || "").trim();
    const inviteQr = String(data?.invite_qr_url || "").trim();
    const expiresRaw = String(data?.invite_expires_at || "").trim();
    const expires = expiresRaw ? new Date(expiresRaw).toLocaleString("de-DE") : "-";

    panel.classList.remove("hidden");
    panel.removeAttribute("hidden");
    qr.setAttribute("src", inviteQr);
    tokenInput.value = inviteToken;
    urlInput.value = inviteUrl;
    expiresEl.textContent = `Gültig bis: ${expires}`;
    openLink.setAttribute("href", inviteUrl || "#");

    copyTokenBtn.onclick = async () => copyText(inviteToken);
    copyUrlBtn.onclick = async () => copyText(inviteUrl);
  }

  function lines(raw) {
    return String(raw || "")
      .split(/\r?\n/)
      .map((x) => String(x || "").trim())
      .filter(Boolean);
  }

  function uniq(values) {
    return [...new Set(values.filter(Boolean).map((v) => String(v).trim()).filter(Boolean))];
  }

  async function callFn(functionName, payload) {
    const { url, key } = cfg();
    const s = session();
    const token = s?.access_token || "";
    if (!url || !key) throw new Error("supabase_config_missing");
    if (!token) throw new Error("login_required");

    const res = await fetch(`${url}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      if (res.status === 401) throw new Error("unauthorized");
      if (res.status === 403) throw new Error("forbidden");
      throw new Error(String(data?.error || `${functionName}_failed_${res.status}`));
    }
    return data;
  }

  async function submitSetup() {
    setMsg("Vereins-Setup läuft ...");
    setResult(null);
    const panel = document.getElementById("clubInvitePanel");
    if (panel) {
      panel.classList.add("hidden");
      panel.setAttribute("hidden", "");
    }

    try {
      const clubName = String(document.getElementById("clubSetupName")?.value || "").trim();
      const defaultCardInput = String(document.getElementById("clubSetupCardDefault")?.value || "").trim();
      const moreCards = lines(document.getElementById("clubSetupCards")?.value || "");
      const waters = lines(document.getElementById("clubSetupWaters")?.value || "");
      const makePublicActive = Boolean(document.getElementById("clubSetupSetPublic")?.checked);
      const assignCreator = Boolean(document.getElementById("clubSetupAssignCreator")?.checked);
      const defaultCard = defaultCardInput || moreCards[0] || "FCP Standard";
      const cardList = uniq([defaultCard, ...moreCards]);

      if (!clubName) throw new Error("club_name_required");

      const payload = {
        club_name: clubName,
        default_fishing_card: defaultCard,
        fishing_cards: cardList,
        waters,
        make_public_active: makePublicActive,
        assign_creator_roles: assignCreator,
      };

      const data = await callFn("club-admin-setup", payload);

      setMsg("Verein erfolgreich angelegt.");
      const codeInput = document.getElementById("clubSetupCode");
      if (codeInput && data?.club_code) codeInput.value = String(data.club_code);
      setResult(data);
      setInviteResult(data);
    } catch (err) {
      const code = err instanceof Error ? err.message : "unexpected_error";
      const msg =
        code === "supabase_config_missing"
          ? "Supabase-Konfiguration fehlt."
          : code === "login_required"
            ? "Bitte zuerst einloggen."
            : code === "unauthorized"
              ? "Nicht autorisiert (401)."
              : code === "forbidden"
                ? "Keine Berechtigung (403). Nur Admin erlaubt."
                : `Fehler: ${code}`;
      setMsg(msg, true);
    }
  }

  async function submitInviteCreate() {
    setMsg("Invite-Link wird erzeugt ...");
    setResult(null);
    try {
      const clubCode = String(document.getElementById("clubInviteCreateCode")?.value || "").trim().toUpperCase();
      const maxUses = Number(document.getElementById("clubInviteCreateMaxUses")?.value || 25);
      const expiresInDays = Number(document.getElementById("clubInviteCreateDays")?.value || 14);
      if (!clubCode) throw new Error("club_code_required");
      if (!/^[A-Z]{2}[0-9]{2}$/.test(clubCode)) throw new Error("club_code_invalid");

      const data = await callFn("club-invite-create", {
        club_code: clubCode,
        max_uses: maxUses,
        expires_in_days: expiresInDays,
      });

      setMsg("Invite-Link erfolgreich erzeugt.");
      setResult(data);
      setInviteResult(data);
    } catch (err) {
      const code = err instanceof Error ? err.message : "unexpected_error";
      const msg =
        code === "supabase_config_missing"
          ? "Supabase-Konfiguration fehlt."
          : code === "login_required"
            ? "Bitte zuerst einloggen."
            : code === "club_code_required"
              ? "Bitte Club-Code eingeben."
              : code === "club_code_invalid"
                ? "Club-Code muss Format AA00 haben."
                : code === "club_not_found"
                  ? "Verein nicht gefunden."
                  : code === "forbidden"
                    ? "Keine Berechtigung (403)."
                    : code === "unauthorized"
                      ? "Nicht autorisiert (401)."
                      : `Fehler: ${code}`;
      setMsg(msg, true);
    }
  }

  function boot() {
    const btn = document.getElementById("clubSetupSubmit");
    const inviteBtn = document.getElementById("clubInviteCreateBtn");
    if (!btn && !inviteBtn) return;
    if (!hasRuntimeConfig()) {
      if (btn) btn.disabled = true;
      if (inviteBtn) inviteBtn.disabled = true;
      setMsg("Preflight: Supabase Runtime-Config fehlt/Platzhalter. Vereinsanlage ist bis zur Token-Umstellung gesperrt.", true);
      setResult({
        mode: "readiness",
        ok: false,
        reason: "missing_runtime_config",
        required: ["PUBLIC_SUPABASE_URL", "PUBLIC_SUPABASE_ANON_KEY"],
      });
      return;
    }
    if (btn) btn.addEventListener("click", submitSetup);
    if (inviteBtn) inviteBtn.addEventListener("click", submitInviteCreate);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
