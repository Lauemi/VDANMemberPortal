;(() => {
  const MANAGER_ROLES = new Set(["admin", "vorstand"]);
  const SECTION_ATTR = "data-club-admin-section";
  const PANEL_ATTR = "data-club-admin-panel";

  const state = {
    onboardingClubOptions: [],
    onboardingSelectedClubId: "",
    onboardingSnapshot: null,
    onboardingBilling: null,
    onboardingLocks: null,
    onboardingWorkspace: null,
    csvImportDraft: null,
  };

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

  function currentUserId() {
    return session()?.user?.id || "";
  }

  function superadminIds() {
    return new Set(
      String(document.body?.getAttribute("data-superadmin-user-ids") || "")
        .split(",")
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    );
  }

  function isSuperadminContext() {
    const uid = currentUserId();
    return Boolean(uid && superadminIds().has(uid));
  }

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    }[c]));
  }

  async function sb(path, init = {}, withAuth = false) {
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    const token = session()?.access_token;
    if (withAuth && token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${url}${path}`, { ...init, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = new Error(err?.message || err?.detail || err?.hint || err?.error_description || `Request failed (${res.status})`);
      error.status = res.status;
      throw error;
    }
    return res.json().catch(() => []);
  }

  function setMsg(text = "", danger = false) {
    const el = document.getElementById("clubSetupMsg");
    if (!el) return;
    el.textContent = text;
    el.style.color = danger ? "var(--danger)" : "";
  }

  function setOnboardingMsg(text = "", danger = false) {
    const el = document.getElementById("clubOnboardingMsg");
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
    if (inviteQr) qr.setAttribute("src", inviteQr);
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

  async function callMultipartFn(functionName, formData) {
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
      },
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      if (res.status === 401) throw new Error("unauthorized");
      if (res.status === 403) throw new Error("forbidden");
      throw new Error(String(data?.error || `${functionName}_failed_${res.status}`));
    }
    return data;
  }

  async function callWorkspace(action, payload = {}) {
    return await callFn("club-onboarding-workspace", {
      action,
      club_id: state.onboardingSelectedClubId,
      ...payload,
    });
  }

  function normalizeClubOption(clubId, meta = {}) {
    const code = String(meta.code || "").trim().toUpperCase();
    const name = String(meta.name || "").trim() || code || `Verein ${clubId.slice(0, 8)}`;
    return {
      id: String(clubId || "").trim(),
      code,
      name,
    };
  }

  async function loadOnboardingClubOptions() {
    const uid = currentUserId();
    if (!uid) {
      state.onboardingClubOptions = [];
      state.onboardingSelectedClubId = "";
      renderOnboardingClubSelect();
      return;
    }

    const [profileRows, aclRows, legacyRows, identityRows] = await Promise.all([
      sb(`/rest/v1/profiles?select=id,club_id&id=eq.${encodeURIComponent(uid)}&limit=1`, { method: "GET" }, true).catch(() => []),
      sb(`/rest/v1/club_user_roles?select=club_id,role_key&user_id=eq.${encodeURIComponent(uid)}`, { method: "GET" }, true).catch(() => []),
      sb(`/rest/v1/user_roles?select=club_id,role&user_id=eq.${encodeURIComponent(uid)}`, { method: "GET" }, true).catch(() => []),
      sb("/rest/v1/rpc/get_club_identity_map", { method: "POST", body: "{}" }, true).catch(() => []),
    ]);

    const clubIds = new Set();
    (Array.isArray(aclRows) ? aclRows : []).forEach((row) => {
      const role = String(row?.role_key || "").trim().toLowerCase();
      const clubId = String(row?.club_id || "").trim();
      if (clubId && MANAGER_ROLES.has(role)) clubIds.add(clubId);
    });
    (Array.isArray(legacyRows) ? legacyRows : []).forEach((row) => {
      const role = String(row?.role || "").trim().toLowerCase();
      const clubId = String(row?.club_id || "").trim();
      if (clubId && MANAGER_ROLES.has(role)) clubIds.add(clubId);
    });

    const identityByClub = new Map();
    (Array.isArray(identityRows) ? identityRows : []).forEach((row) => {
      const clubId = String(row?.club_id || "").trim();
      if (!clubId) return;
      identityByClub.set(clubId, {
        code: String(row?.club_code || "").trim(),
        name: String(row?.club_name || "").trim(),
      });
    });

    state.onboardingClubOptions = [...clubIds]
      .map((clubId) => normalizeClubOption(clubId, identityByClub.get(clubId) || {}))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "de"));

    const profileClubId = String(profileRows?.[0]?.club_id || "").trim();
    const hasSelected = state.onboardingClubOptions.some((club) => club.id === state.onboardingSelectedClubId);
    if (!hasSelected) {
      state.onboardingSelectedClubId =
        state.onboardingClubOptions.find((club) => club.id === profileClubId)?.id
        || state.onboardingClubOptions[0]?.id
        || "";
    }

    renderOnboardingClubSelect();
  }

  function renderOnboardingClubSelect() {
    const select = document.getElementById("clubOnboardingClubSelect");
    if (!select) return;
    const options = state.onboardingClubOptions;
    select.innerHTML = options.length
      ? options.map((club) => {
          const selected = club.id === state.onboardingSelectedClubId ? " selected" : "";
          const label = club.code ? `${club.code} • ${club.name}` : club.name;
          return `<option value="${esc(club.id)}"${selected}>${esc(label)}</option>`;
        }).join("")
      : `<option value="">Keine verwaltbaren Vereine gefunden</option>`;
    select.disabled = options.length === 0;
  }

  function switchSection(section) {
    const buttons = Array.from(document.querySelectorAll(`[${SECTION_ATTR}]`));
    const available = buttons
      .filter((button) => !button.disabled)
      .map((button) => String(button.getAttribute(SECTION_ATTR) || "").trim())
      .filter(Boolean);
    const next = available.includes(section) ? section : available[0] || "overview";
    buttons.forEach((button) => {
      button.classList.toggle("is-active", button.getAttribute(SECTION_ATTR) === next);
    });
    document.querySelectorAll(`[${PANEL_ATTR}]`).forEach((panel) => {
      panel.classList.toggle("is-active", panel.getAttribute(PANEL_ATTR) === next);
    });
  }

  function toneForValue(value, goodValues = [], warnValues = []) {
    const normalized = String(value || "").trim().toLowerCase();
    if (goodValues.includes(normalized)) return "good";
    if (warnValues.includes(normalized)) return "warn";
    return "bad";
  }

  function pill(label, tone) {
    return `<span class="onboarding-state-pill" data-tone="${esc(tone)}">${esc(label)}</span>`;
  }

  function billingStateLabel(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "active") return "Lizenz aktiv";
    if (normalized === "checkout_open") return "Checkout offen";
    if (normalized === "past_due") return "Zahlung offen";
    if (normalized === "canceled") return "Beendet";
    if (normalized === "suspended") return "Gesperrt";
    return "Nicht gestartet";
  }

  function billingStateTone(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "active") return "good";
    if (["checkout_open", "past_due"].includes(normalized)) return "warn";
    return "bad";
  }

  function delimiterValue(raw) {
    return raw === "tab" ? "\t" : String(raw || ",");
  }

  function clubDataReady(snapshot) {
    return Boolean(
      snapshot
      && snapshot.club_data_complete
      && snapshot.has_club_name
      && snapshot.has_club_code
      && snapshot.has_core_roles
      && snapshot.has_module_usecases,
    );
  }

  function billingActive(snapshot, billing) {
    const stateValue = String(billing?.billing_state || snapshot?.billing_state || "").trim().toLowerCase();
    return stateValue === "active";
  }

  function buildStageLocks(snapshot, billing) {
    const superadmin = isSuperadminContext();
    const clubReady = clubDataReady(snapshot);
    const billingOk = billingActive(snapshot, billing);
    const downstreamUnlocked = superadmin || billingOk;

    return {
      superadmin,
      clubReady,
      billingOk,
      downstreamUnlocked,
      sections: {
        overview: { locked: false },
        "club-data": { locked: false },
        billing: { locked: !clubReady },
        waters: { locked: !downstreamUnlocked },
        cards: { locked: !downstreamUnlocked },
        members: { locked: !downstreamUnlocked },
        create: { locked: false },
        invite: { locked: false },
      },
    };
  }

  function updateOnboardingKpis(snapshot, billing) {
    const setupEl = document.getElementById("clubOnboardingSetupState");
    const billingEl = document.getElementById("clubOnboardingBillingState");
    const portalEl = document.getElementById("clubOnboardingPortalState");
    const readyEl = document.getElementById("clubOnboardingReadyState");
    if (!setupEl || !billingEl || !portalEl || !readyEl) return;

    setupEl.innerHTML = pill(
      String(snapshot?.setup_state || "-"),
      toneForValue(snapshot?.setup_state, ["complete"], ["pending_payment"]),
    );
    billingEl.innerHTML = pill(
      String(billing?.billing_state || snapshot?.billing_state || "-"),
      toneForValue(billing?.billing_state || snapshot?.billing_state, ["active"], ["checkout_open", "past_due"]),
    );
    portalEl.innerHTML = pill(
      String(snapshot?.portal_state || "-"),
      toneForValue(snapshot?.portal_state, ["active"], ["draft"]),
    );
    readyEl.innerHTML = pill(Boolean(snapshot?.setup_ready) ? "ja" : "nein", Boolean(snapshot?.setup_ready) ? "good" : "warn");
  }

  function nextStepFromSnapshot(snapshot, billing) {
    const locks = buildStageLocks(snapshot, billing);
    if (!snapshot) {
      return {
        title: "-",
        detail: "Kein Verein gewählt.",
      };
    }
    if (!locks.clubReady) {
      return {
        title: "Vereinsdaten abschließen",
        detail: "Stammdaten, Rollen oder Module sind noch nicht vollständig freigegeben.",
      };
    }
    if (!locks.downstreamUnlocked) {
      return {
        title: "FCP-Lizenz abschließen",
        detail: "Erst eine aktive FCP-Vereinslizenz schaltet Gewässer, Angelkarten und Mitglieder frei.",
      };
    }
    if (!snapshot.waters_complete || !snapshot.has_water_bodies) {
      return {
        title: "Gewässer pflegen",
        detail: "Nach der Billing-Freigabe fehlt noch die operative Gewässer-Basis.",
      };
    }
    if (!snapshot.cards_complete || !snapshot.has_default_card) {
      return {
        title: "Angelkarten pflegen",
        detail: "Gewässer sind frei. Als Nächstes braucht der Club eine belastbare Kartenbasis.",
      };
    }
    if (!["imported", "confirmed_empty"].includes(String(snapshot.members_mode || "pending"))) {
      return {
        title: "Mitglieder festlegen",
        detail: "Mitglieder müssen importiert oder bewusst leer bestätigt werden.",
      };
    }
    if (locks.superadmin && !locks.billingOk) {
      return {
        title: "Admin-Link übergeben",
        detail: "Superadmin-Bypass ist aktiv. Der Vereins-Admin soll anschließend sein Billing selbst abschließen.",
      };
    }
    return {
      title: "Setup freigegeben",
      detail: "Der operative Ablauf ist vollständig vorbereitet.",
    };
  }

  function snapshotChecks(snapshot) {
    const membersMode = String(snapshot?.members_mode || "pending").trim();
    return [
      {
        key: "club_data_complete",
        label: "Vereinsdaten fachlich abgeschlossen",
        ok: Boolean(snapshot?.club_data_complete),
        detail: Boolean(snapshot?.club_data_complete) ? "Manuelle Freigabe gesetzt." : "Noch nicht als komplett markiert.",
      },
      {
        key: "waters_complete",
        label: "Gewässer-Basis fachlich abgeschlossen",
        ok: Boolean(snapshot?.waters_complete),
        detail: Boolean(snapshot?.waters_complete) ? "Manuelle Freigabe gesetzt." : "Noch nicht als komplett markiert.",
      },
      {
        key: "cards_complete",
        label: "Karten-Basis fachlich abgeschlossen",
        ok: Boolean(snapshot?.cards_complete),
        detail: Boolean(snapshot?.cards_complete) ? "Manuelle Freigabe gesetzt." : "Noch nicht als komplett markiert.",
      },
      {
        key: "members_mode",
        label: "Mitgliedergrundlage geklärt",
        ok: membersMode === "imported" || membersMode === "confirmed_empty",
        detail: membersMode === "imported"
          ? "Mitglieder als importiert markiert."
          : membersMode === "confirmed_empty"
            ? "Bewusst leer bestätigt."
            : "Mitgliederbasis noch offen.",
      },
      {
        key: "has_club_name",
        label: "Vereinsname vorhanden",
        ok: Boolean(snapshot?.has_club_name),
        detail: Boolean(snapshot?.has_club_name) ? "Name in app_secure_settings gefunden." : "club_name fehlt.",
      },
      {
        key: "has_club_code",
        label: "Club-Code vorhanden",
        ok: Boolean(snapshot?.has_club_code),
        detail: Boolean(snapshot?.has_club_code) ? "Code-Mapping gefunden." : "club_code_map fehlt.",
      },
      {
        key: "has_core_roles",
        label: "Kernrollen vorhanden",
        ok: Boolean(snapshot?.has_core_roles),
        detail: Boolean(snapshot?.has_core_roles) ? "member/vorstand/admin sind vorhanden." : "Kernrollenbasis fehlt.",
      },
      {
        key: "has_module_usecases",
        label: "Module / Usecases aktiviert",
        ok: Boolean(snapshot?.has_module_usecases),
        detail: Boolean(snapshot?.has_module_usecases) ? "Mindestens ein Usecase ist aktiviert." : "Noch keine aktiven Usecases.",
      },
      {
        key: "has_water_bodies",
        label: "Mindestens ein aktives Gewässer",
        ok: Boolean(snapshot?.has_water_bodies),
        detail: Boolean(snapshot?.has_water_bodies) ? "Gewässerbasis vorhanden." : "Aktives Gewässer fehlt.",
      },
      {
        key: "has_default_card",
        label: "Default-Karte vorhanden",
        ok: Boolean(snapshot?.has_default_card),
        detail: Boolean(snapshot?.has_default_card) ? "Kartenbasis gefunden." : "Default-Kartenlogik fehlt.",
      },
      {
        key: "member_directory_count",
        label: "Mitgliederverzeichnis verfüllt",
        ok: Number(snapshot?.member_directory_count || 0) > 0 || membersMode === "confirmed_empty",
        detail: Number(snapshot?.member_directory_count || 0) > 0
          ? `${Number(snapshot?.member_directory_count || 0)} Datensätze gefunden.`
          : membersMode === "confirmed_empty"
            ? "Leerbestand ist bewusst bestätigt."
            : "Noch keine Mitgliederbasis vorhanden.",
      },
    ];
  }

  function renderOnboardingLists(snapshot) {
    const blockersEl = document.getElementById("clubOnboardingBlockers");
    const satisfiedEl = document.getElementById("clubOnboardingSatisfied");
    if (!blockersEl || !satisfiedEl) return;

    const checks = snapshotChecks(snapshot);
    const blockers = checks.filter((item) => !item.ok);
    const satisfied = checks.filter((item) => item.ok);

    blockersEl.innerHTML = blockers.length
      ? blockers.map((item) => `<li><strong>${esc(item.label)}</strong><br />${esc(item.detail)}</li>`).join("")
      : `<li><strong>Keine offenen Guards.</strong><br />Setup ist aus Serversicht bereit für Billing.</li>`;

    satisfiedEl.innerHTML = satisfied.length
      ? satisfied.map((item) => `<li><strong>${esc(item.label)}</strong><br />${esc(item.detail)}</li>`).join("")
      : `<li>Noch keine Guards erfüllt.</li>`;
  }

  function renderSnapshotTable(snapshot, billing) {
    const tbody = document.getElementById("clubOnboardingSnapshotTable");
    if (!tbody) return;

    const rows = [
      {
        area: "Serverstatus",
        status: pill(String(snapshot?.setup_ready ? "bereit" : "blockiert"), snapshot?.setup_ready ? "good" : "warn"),
        hint: snapshot?.setup_ready
          ? "Pflichtpunkte für Billing sind erfüllt."
          : "Mindestens ein Pflichtpunkt oder Fach-Guard ist noch offen.",
      },
      {
        area: "Mitgliederbasis",
        status: `${esc(snapshot?.members_mode || "-")} / ${esc(snapshot?.member_directory_count ?? 0)} Mitglieder / ${esc(snapshot?.member_identity_count ?? 0)} Identities`,
        hint: `Manager-Zuordnungen: ${esc(snapshot?.manager_count ?? 0)}`,
      },
      {
        area: "Requirements",
        status: [
          Boolean(snapshot?.has_club_name) ? "Name" : null,
          Boolean(snapshot?.has_club_code) ? "Code" : null,
          Boolean(snapshot?.has_core_roles) ? "Rollen" : null,
          Boolean(snapshot?.has_module_usecases) ? "Module" : null,
          Boolean(snapshot?.has_water_bodies) ? "Gewässer" : null,
          Boolean(snapshot?.has_default_card) ? "Karten" : null,
        ].filter(Boolean).join(", ") || "-",
        hint: "Abgeleitet aus Bestand und Secure Settings.",
      },
      {
        area: "Billing",
        status: billing
          ? `${esc(billing.billing_state || "-")} / ${esc(billing.checkout_state || "-")}`
          : esc(snapshot?.billing_state || "-"),
        hint: billing?.stripe_subscription_id
          ? `Subscription: ${String(billing.stripe_subscription_id).slice(0, 18)}...`
          : "Noch keine Subscription im Snapshot hinterlegt.",
      },
      {
        area: "Zeiten",
        status: snapshot?.setup_completed_at
          ? `Setup abgeschlossen am ${new Date(snapshot.setup_completed_at).toLocaleString("de-DE")}`
          : "Noch kein Setup-Abschlussstempel",
        hint: billing?.updated_at
          ? `Billing zuletzt aktualisiert am ${new Date(billing.updated_at).toLocaleString("de-DE")}`
          : "Billing noch ohne Zeitstempel.",
      },
    ];

    tbody.innerHTML = rows.map((row) => `
      <tr>
        <td>${esc(row.area)}</td>
        <td>${row.status}</td>
        <td class="small">${esc(row.hint)}</td>
      </tr>
    `).join("");
  }

  function renderOverviewMeta(snapshot, billing) {
    const locks = buildStageLocks(snapshot, billing);
    const club = state.onboardingClubOptions.find((entry) => entry.id === state.onboardingSelectedClubId) || null;
    const clubLabel = document.getElementById("clubOverviewClubLabel");
    const clubMeta = document.getElementById("clubOverviewClubMeta");
    const setupMeta = document.getElementById("clubOverviewSetupMeta");
    const billingMeta = document.getElementById("clubOverviewBillingMeta");
    const portalMeta = document.getElementById("clubOverviewPortalMeta");
    const readyMeta = document.getElementById("clubOverviewReadyMeta");
    const nextStep = document.getElementById("clubOverviewNextStep");
    const nextStepMeta = document.getElementById("clubOverviewNextStepMeta");
    if (!clubLabel || !clubMeta || !setupMeta || !billingMeta || !portalMeta || !readyMeta || !nextStep || !nextStepMeta) return;

    clubLabel.textContent = club ? (club.code || club.name) : "-";
    clubMeta.textContent = club
      ? `${club.name}${state.onboardingSelectedClubId ? ` • ${state.onboardingSelectedClubId}` : ""}`
      : "Kein Verein gewählt.";
    setupMeta.textContent = snapshot?.setup_completed_at
      ? `Setup abgeschlossen am ${new Date(snapshot.setup_completed_at).toLocaleString("de-DE")}`
      : "Vereinsdaten noch nicht vollständig freigegeben.";
    billingMeta.textContent = billing?.updated_at
      ? `FCP-Lizenz zuletzt aktualisiert am ${new Date(billing.updated_at).toLocaleString("de-DE")}`
      : "Noch keine verifizierten Billing-Metadaten vorhanden.";
    portalMeta.textContent = String(snapshot?.portal_state || "draft").toLowerCase() === "active"
      ? "Portal ist freigeschaltet."
      : "Portal bleibt bis zur Aktivierung der FCP-Vereinslizenz im Entwurfs- oder Suspend-Status.";
    readyMeta.textContent = locks.downstreamUnlocked
      ? (locks.superadmin && !locks.billingOk ? "Superadmin-Bypass aktiv. Restbereiche sind trotz offener FCP-Vereinslizenz benutzbar." : "Restbereiche sind operativ freigeschaltet.")
      : "Gewässer, Angelkarten und Mitglieder bleiben bis nach aktiver FCP-Vereinslizenz gesperrt.";
    const next = nextStepFromSnapshot(snapshot, billing);
    nextStep.textContent = next.title;
    nextStepMeta.textContent = next.detail;
  }

  function renderModuleCards(snapshot) {
    const membersMode = String(snapshot?.members_mode || "pending").trim();
    const moduleConfigs = [
      {
        statusId: "clubModuleStateClubData",
        hintId: "clubModuleHintClubData",
        ok: Boolean(snapshot?.club_data_complete) && Boolean(snapshot?.has_club_name) && Boolean(snapshot?.has_club_code) && Boolean(snapshot?.has_core_roles) && Boolean(snapshot?.has_module_usecases),
        hint: [
          Boolean(snapshot?.club_data_complete) ? "Manuelle Freigabe gesetzt." : "Freigabemarker fehlt.",
          Boolean(snapshot?.has_club_name) ? "Club-Name vorhanden." : "Club-Name fehlt.",
          Boolean(snapshot?.has_club_code) ? "Club-Code vorhanden." : "Club-Code fehlt.",
          Boolean(snapshot?.has_core_roles) ? "Kernrollen vorhanden." : "Kernrollen fehlen.",
          Boolean(snapshot?.has_module_usecases) ? "Usecases aktiviert." : "Usecases fehlen.",
        ].join(" "),
      },
      {
        statusId: "clubModuleStateWaters",
        hintId: "clubModuleHintWaters",
        ok: Boolean(snapshot?.waters_complete) && Boolean(snapshot?.has_water_bodies),
        hint: [
          Boolean(snapshot?.waters_complete) ? "Manuelle Freigabe gesetzt." : "Freigabemarker fehlt.",
          Boolean(snapshot?.has_water_bodies) ? "Mindestens ein aktives Gewässer vorhanden." : "Aktives Gewässer fehlt.",
        ].join(" "),
      },
      {
        statusId: "clubModuleStateCards",
        hintId: "clubModuleHintCards",
        ok: Boolean(snapshot?.cards_complete) && Boolean(snapshot?.has_default_card),
        hint: [
          Boolean(snapshot?.cards_complete) ? "Manuelle Freigabe gesetzt." : "Freigabemarker fehlt.",
          Boolean(snapshot?.has_default_card) ? "Default-Karte vorhanden." : "Default-Karte fehlt.",
        ].join(" "),
      },
      {
        statusId: "clubModuleStateMembers",
        hintId: "clubModuleHintMembers",
        ok: (membersMode === "imported" || membersMode === "confirmed_empty")
          && (Number(snapshot?.member_directory_count || 0) > 0 || membersMode === "confirmed_empty"),
        hint: membersMode === "imported"
          ? `${Number(snapshot?.member_directory_count || 0)} Mitgliederdatensätze und ${Number(snapshot?.member_identity_count || 0)} Identitäten gefunden.`
          : membersMode === "confirmed_empty"
            ? "Leerbestand bewusst bestätigt."
            : "Mitgliedergrundlage noch offen.",
      },
    ];

    moduleConfigs.forEach((config) => {
      const statusEl = document.getElementById(config.statusId);
      const hintEl = document.getElementById(config.hintId);
      if (statusEl) statusEl.innerHTML = pill(config.ok ? "grün" : "offen", config.ok ? "good" : "warn");
      if (hintEl) hintEl.textContent = config.hint;
    });
  }

  function fillValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = String(value || "");
  }

  function renderWorkspace(workspace) {
    state.onboardingWorkspace = workspace || null;
    const clubData = workspace?.club_data || {};
    fillValue("clubDataName", clubData.club_name);
    fillValue("clubDataCode", clubData.club_code);
    fillValue("clubDataStreet", clubData.street);
    fillValue("clubDataZip", clubData.zip);
    fillValue("clubDataCity", clubData.city);
    fillValue("clubDataContactName", clubData.contact_name);
    fillValue("clubDataContactEmail", clubData.contact_email);
    fillValue("clubDataContactPhone", clubData.contact_phone);

    const watersTable = document.getElementById("clubWatersTable");
    if (watersTable) {
      const waters = Array.isArray(workspace?.waters) ? workspace.waters : [];
      watersTable.innerHTML = waters.length
        ? waters.map((row) => `
          <tr>
            <td>${esc(row?.name || "-")}</td>
            <td>${esc(row?.area_kind || "-")}</td>
            <td>${row?.is_active ? "aktiv" : "inaktiv"}</td>
            <td><button type="button" class="feed-btn feed-btn--ghost" data-water-toggle="${esc(row?.id || "")}" data-next-active="${row?.is_active ? "0" : "1"}">${row?.is_active ? "deaktivieren" : "aktivieren"}</button></td>
          </tr>
        `).join("")
        : `<tr><td colspan="4" class="small">Noch keine Gewässer vorhanden.</td></tr>`;
    }

    const cardsTable = document.getElementById("clubCardsTable");
    if (cardsTable) {
      const cards = Array.isArray(workspace?.cards) ? workspace.cards : [];
      cardsTable.innerHTML = cards.length
        ? cards.map((row, index) => `
          <tr>
            <td>${esc(row?.name || "-")}</td>
            <td><input type="radio" name="clubCardDefault" value="${index}" ${row?.is_default ? "checked" : ""} /></td>
            <td class="small">${row?.is_default ? "Default-Karte für den Club" : "normale Karte"}</td>
          </tr>
        `).join("")
        : `<tr><td colspan="3" class="small">Noch keine Karten vorhanden.</td></tr>`;
    }

    const membersTable = document.getElementById("clubMembersTable");
    if (membersTable) {
      const members = Array.isArray(workspace?.members) ? workspace.members : [];
      membersTable.innerHTML = members.length
        ? members.map((row) => `
          <tr>
            <td>${esc(row?.member_no || "-")}</td>
            <td>${esc(`${row?.first_name || ""} ${row?.last_name || ""}`.trim() || "-")}</td>
            <td>${esc(row?.status || "-")}</td>
            <td>${esc(row?.fishing_card_type || "-")}</td>
            <td>${esc(row?.city || "-")}</td>
          </tr>
        `).join("")
        : `<tr><td colspan="5" class="small">Noch keine Mitglieder vorhanden.</td></tr>`;
    }
  }

  function renderBillingPanel(snapshot, billing) {
    const locks = buildStageLocks(snapshot, billing);
    const summary = document.getElementById("clubBillingSummary");
    const facts = document.getElementById("clubBillingFacts");
    const note = document.getElementById("clubBillingStageNote");
    const licenseState = document.getElementById("clubBillingLicenseState");
    const checkoutMeta = document.getElementById("clubBillingCheckoutMeta");
    const checkoutBtn = document.getElementById("clubBillingCheckoutBtn");
    if (!summary || !facts) return;

    if (!snapshot) {
      summary.textContent = "Kein Verein gewählt.";
      facts.innerHTML = "<li>Keine Daten geladen.</li>";
      if (note) note.textContent = "Kein Verein gewählt.";
      if (licenseState) licenseState.innerHTML = pill("Nicht gestartet", "bad");
      if (checkoutMeta) checkoutMeta.textContent = "Bitte zuerst einen Verein wählen.";
      if (checkoutBtn) checkoutBtn.disabled = true;
      return;
    }

    const billingState = String(billing?.billing_state || snapshot?.billing_state || "none").trim();
    const billingStateLower = billingState.toLowerCase();
    const checkoutState = String(billing?.checkout_state || "none").trim();
    summary.textContent = locks.clubReady
      ? `Vereinsdaten sind freigegeben. Die FCP-Vereinslizenz steht aktuell auf ${billingState}.`
      : "Die FCP-Vereinslizenz ist noch blockiert, weil die Vereinsdaten nicht vollständig freigegeben sind.";

    if (note) {
      note.dataset.tone = locks.clubReady ? (locks.superadmin ? "info" : "good") : "warn";
      note.textContent = !locks.clubReady
        ? "Die FCP-Vereinslizenz bleibt gesperrt, bis Vereinsdaten, Rollen und Module vollständig sind."
        : locks.superadmin
          ? "Superadmin-Bypass aktiv: Du siehst und testest den normalen Flow, aber die FCP-Vereinslizenz blockiert dich nicht."
          : locks.billingOk
            ? "Die FCP-Vereinslizenz ist aktiv. Gewässer, Angelkarten und Mitglieder sind freigeschaltet."
            : "Die FCP-Vereinslizenz ist der Freigabeschritt für Gewässer, Angelkarten und Mitglieder.";
    }

    const items = [
      `Setup-State: ${snapshot.setup_state || "-"}`,
      `Billing-State: ${billingState || "-"}`,
      `Checkout-State: ${checkoutState || "-"}`,
      billing?.current_period_end ? `Abrechnungsperiode bis ${new Date(billing.current_period_end).toLocaleString("de-DE")}` : "Noch kein period_end vorhanden.",
      billing?.canceled_at ? `Beendet am ${new Date(billing.canceled_at).toLocaleString("de-DE")}` : "Keine Beendigung hinterlegt.",
      "FCP-Billing betrifft nur die Vereinslizenz, nicht die Angelkartenpreise des Vereins.",
    ];
    facts.innerHTML = items.map((item) => `<li>${esc(item)}</li>`).join("");

    if (licenseState) {
      licenseState.innerHTML = pill(billingStateLabel(billingState), billingStateTone(billingState));
    }

    if (checkoutBtn) {
      checkoutBtn.disabled = !locks.clubReady || billingStateLower === "active";
      checkoutBtn.textContent = billingStateLower === "checkout_open"
        ? "Checkout öffnen"
        : billingStateLower === "active"
          ? "Lizenz aktiv"
          : "Lizenz aktivieren";
    }

    if (checkoutMeta) {
      checkoutMeta.textContent = !locks.clubReady
        ? "Erst Vereinsdaten abschließen, dann kann die FCP-Vereinslizenz aktiviert werden."
        : billingStateLower === "active"
          ? "Die FCP-Vereinslizenz ist aktiv. Gewässer, Karten und Mitglieder sind freigeschaltet."
          : billingStateLower === "checkout_open"
            ? "Ein Stripe-Checkout wurde bereits vorbereitet. Du kannst den Checkout erneut öffnen."
            : "Der Checkout nutzt den bestehenden Stripe-Pfad für die FCP-Vereinslizenz des Vereins.";
    }
  }

  async function startBillingCheckout() {
    const clubId = String(state.onboardingSelectedClubId || "").trim();
    if (!clubId) {
      setOnboardingMsg("Bitte zuerst einen Verein wählen.", true);
      return;
    }

    setOnboardingMsg("Stripe-Checkout wird vorbereitet ...");
    const data = await callFn("fcp-create-checkout-session", { club_id: clubId });
    const checkoutUrl = String(data?.checkout_url || "").trim();
    if (!checkoutUrl) throw new Error("checkout_url_missing");
    window.location.assign(checkoutUrl);
  }

  function renderCsvImportDraft() {
    const stateEl = document.getElementById("clubMembersCsvState");
    const metaEl = document.getElementById("clubMembersCsvMeta");
    const confirmBtn = document.getElementById("clubMembersCsvConfirmBtn");
    if (!stateEl || !metaEl) return;

    const draft = state.csvImportDraft;
    if (!draft?.file) {
      stateEl.innerHTML = pill("CSV noch nicht hochgeladen", "warn");
      metaEl.textContent = "CSV hochladen → serverseitiger Parse → Vorschau prüfen → Import bestätigen.";
      if (confirmBtn) confirmBtn.disabled = true;
      return;
    }

    const hasRows = Array.isArray(draft.preview_rows) && draft.preview_rows.length > 0;
    stateEl.innerHTML = hasRows ? pill("CSV geparst – bereit zur Bestätigung", "good") : pill("CSV hochgeladen – Parse ausstehend", "warn");
    metaEl.textContent = `${draft.file.name} · ${draft.file.size} Bytes · Delimiter ${draft.delimiter === "\t" ? "Tab" : draft.delimiter}${hasRows ? ` · ${draft.preview_rows.length} Zeilen erkannt` : ""}.`;
    if (confirmBtn) confirmBtn.disabled = !hasRows;
  }

  function renderCsvPreviewRows(rows = [], note = "") {
    const tbody = document.getElementById("clubMembersCsvPreviewTable");
    if (!tbody) return;
    if (!Array.isArray(rows) || !rows.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="small">${esc(note || "Preview folgt, sobald der serverseitige Parse-Schritt angeschlossen ist.")}</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((row) => {
      const source = row?.source_values && typeof row.source_values === "object"
        ? Object.entries(row.source_values).map(([key, value]) => `${key}: ${value ?? "-"}`).join(" · ")
        : "-";
      const preview = row?.preview_values && typeof row.preview_values === "object"
        ? Object.entries(row.preview_values).map(([key, value]) => `${key}: ${value ?? "-"}`).join(" · ")
        : "-";
      const issues = Array.isArray(row?.issues) && row.issues.length ? row.issues.join(" · ") : "Keine";
      return `
        <tr>
          <td>${esc(row?.row_no ?? "-")}</td>
          <td>${esc(row?.row_status || "sample")}</td>
          <td class="small">${esc(preview || source)}</td>
          <td class="small">${esc(issues)}</td>
        </tr>
      `;
    }).join("");
  }

  function prepareCsvImportDraft() {
    const fileInput = document.getElementById("clubMembersCsvFile");
    const delimiterInput = document.getElementById("clubMembersCsvDelimiter");
    const file = fileInput?.files?.[0] || null;
    if (!file) {
      setOnboardingMsg("Bitte zuerst eine CSV-Datei auswählen.", true);
      return;
    }

    state.csvImportDraft = {
      club_id: String(state.onboardingSelectedClubId || "").trim(),
      file,
      delimiter: delimiterValue(delimiterInput?.value || ","),
      has_header: true,
    };
    renderCsvImportDraft();
    setOnboardingMsg("CSV-Rahmen vorbereitet.", false);
  }

  async function startCsvImportServerParse() {
    const fileInput = document.getElementById("clubMembersCsvFile");
    const delimiterInput = document.getElementById("clubMembersCsvDelimiter");
    const file = fileInput?.files?.[0] || null;
    const clubId = String(state.onboardingSelectedClubId || "").trim();
    if (!clubId) {
      setOnboardingMsg("Bitte zuerst einen Verein wählen.", true);
      return;
    }
    if (!file) {
      setOnboardingMsg("Bitte zuerst eine CSV-Datei auswählen.", true);
      return;
    }

    prepareCsvImportDraft();
    const formData = new FormData();
    formData.set("club_id", clubId);
    formData.set("delimiter", delimiterValue(delimiterInput?.value || ","));
    formData.set("has_header", "true");
    formData.set("file", file, file.name);

    setOnboardingMsg("CSV wird serverseitig vorbereitet ...");
    const data = await callMultipartFn("club-members-csv-parse", formData);
    state.csvImportDraft = {
      ...(state.csvImportDraft || {}),
      preview_rows: Array.isArray(data?.preview) ? data.preview : [],
    };
    renderCsvImportDraft();
    renderCsvPreviewRows(
      Array.isArray(data?.preview) ? data.preview : [],
      String(data?.note || "CSV geparst. Vorschau prüfen und Import bestätigen."),
    );
    setOnboardingMsg("CSV geparst. Vorschau prüfen, dann Import bestätigen.");
  }

  async function confirmCsvImportDraft() {
    const clubId = String(state.csvImportDraft?.club_id || state.onboardingSelectedClubId || "").trim();
    const previewRows = Array.isArray(state.csvImportDraft?.preview_rows) ? state.csvImportDraft.preview_rows : [];
    if (!clubId || !previewRows.length) {
      setOnboardingMsg("Bitte zuerst eine CSV hochladen und parsen.", true);
      return;
    }
    const p_rows = previewRows.map((row) => {
      const pv = row?.preview_values || {};
      return {
        member_no:  String(pv.member_no  || "").trim() || null,
        first_name: String(pv.first_name || "").trim() || null,
        last_name:  String(pv.last_name  || "").trim() || null,
        status:     String(pv.status     || "active").trim(),
        email:      String(pv.email      || "").trim() || null,
        phone:      String(pv.phone      || "").trim() || null,
        birthdate:  String(pv.birthdate  || "").trim() || null,
        street:     String(pv.street     || "").trim() || null,
        zip:        String(pv.zip        || "").trim() || null,
        city:       String(pv.city       || "").trim() || null,
      };
    });
    setOnboardingMsg("CSV-Import wird bestätigt ...");
    await sb("/rest/v1/rpc/import_csv_confirmed", {
      method: "POST",
      body: JSON.stringify({ p_club_id: clubId, p_rows }),
    }, true);
    setOnboardingMsg("CSV-Import bestätigt.");
    await loadOnboardingStatus({ clubId: state.onboardingSelectedClubId });
  }

  function applySnapshotToControls(snapshot) {
    const clubData = document.getElementById("clubOnboardingClubData");
    const waters = document.getElementById("clubOnboardingWaters");
    const cards = document.getElementById("clubOnboardingCards");
    const membersMode = document.getElementById("clubOnboardingMembersMode");
    const note = document.getElementById("clubOnboardingNote");
    if (clubData) clubData.checked = Boolean(snapshot?.club_data_complete);
    if (waters) waters.checked = Boolean(snapshot?.waters_complete);
    if (cards) cards.checked = Boolean(snapshot?.cards_complete);
    if (membersMode) membersMode.value = String(snapshot?.members_mode || "pending");
    if (note) note.value = "";
  }

  function setLocked(ids = [], locked = false) {
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = Boolean(locked);
    });
  }

  function applySectionLocks(snapshot, billing) {
    const locks = buildStageLocks(snapshot, billing);
    state.onboardingLocks = locks;

    document.querySelectorAll(`[${SECTION_ATTR}]`).forEach((button) => {
      const key = String(button.getAttribute(SECTION_ATTR) || "").trim();
      const locked = Boolean(locks.sections[key]?.locked);
      button.disabled = locked;
      button.classList.toggle("is-disabled", locked);
      button.setAttribute("aria-disabled", locked ? "true" : "false");
    });

    const clubDataNote = document.getElementById("clubDataStageNote");
    if (clubDataNote) {
      clubDataNote.dataset.tone = locks.clubReady ? "good" : "warn";
      clubDataNote.textContent = locks.clubReady
        ? "Vereinsdaten sind freigegeben. Der nächste geführte Schritt ist Billing."
        : "Hier pflegst du den ersten Pflichtschritt. Erst danach wird Billing freigeschaltet.";
    }

    const downstreamMessage = locks.superadmin
      ? "Superadmin-Bypass aktiv: Bereich ist zum vollständigen Testen freigeschaltet, auch wenn Billing noch offen ist."
      : "Dieser Bereich bleibt ausgegraut, bis Billing aktiv ist.";

    const waterNote = document.getElementById("clubWatersStageNote");
    if (waterNote) {
      waterNote.dataset.tone = locks.sections.waters.locked ? "warn" : (locks.superadmin && !locks.billingOk ? "info" : "good");
      waterNote.textContent = locks.sections.waters.locked
        ? "Gewässer bleiben bis nach Billing gesperrt."
        : downstreamMessage;
    }

    const cardsNote = document.getElementById("clubCardsStageNote");
    if (cardsNote) {
      cardsNote.dataset.tone = locks.sections.cards.locked ? "warn" : (locks.superadmin && !locks.billingOk ? "info" : "good");
      cardsNote.textContent = locks.sections.cards.locked
        ? "Angelkarten bleiben bis nach Billing gesperrt."
        : downstreamMessage;
    }

    const membersNote = document.getElementById("clubMembersStageNote");
    if (membersNote) {
      membersNote.dataset.tone = locks.sections.members.locked ? "warn" : (locks.superadmin && !locks.billingOk ? "info" : "good");
      membersNote.textContent = locks.sections.members.locked
        ? "Mitglieder bleiben bis nach Billing gesperrt."
        : downstreamMessage;
    }

    [["clubWatersCard", "clubOnboardingWaters"], ["clubCardsCard", "clubOnboardingCards"], ["clubMembersCard", "clubOnboardingMembersMode"]].forEach(([cardId, controlId]) => {
      const card = document.getElementById(cardId);
      const locked = cardId === "clubWatersCard"
        ? locks.sections.waters.locked
        : cardId === "clubCardsCard"
          ? locks.sections.cards.locked
          : locks.sections.members.locked;
      if (card) card.classList.toggle("is-locked", locked);
      setLocked([controlId], locked);
    });

    setLocked(["clubWaterCreateName", "clubWaterCreateBtn", "clubWatersSaveBtn"], locks.sections.waters.locked);
    setLocked(["clubCardCreateName", "clubCardCreateBtn", "clubCardsSaveBtn"], locks.sections.cards.locked);
    setLocked([
      "clubMemberFirstName",
      "clubMemberLastName",
      "clubMemberStatus",
      "clubMemberCardType",
      "clubMemberCity",
      "clubMemberPhone",
      "clubMemberCreateBtn",
      "clubMembersSaveBtn",
    ], locks.sections.members.locked);

    if (locks.sections.billing.locked && document.querySelector(`[${PANEL_ATTR}].is-active`)?.getAttribute(PANEL_ATTR) === "billing") {
      switchSection("club-data");
    }
    if (locks.sections.waters.locked && document.querySelector(`[${PANEL_ATTR}].is-active`)?.getAttribute(PANEL_ATTR) === "waters") {
      switchSection(locks.sections.billing.locked ? "club-data" : "billing");
    }
    if (locks.sections.cards.locked && document.querySelector(`[${PANEL_ATTR}].is-active`)?.getAttribute(PANEL_ATTR) === "cards") {
      switchSection(locks.sections.billing.locked ? "club-data" : "billing");
    }
    if (locks.sections.members.locked && document.querySelector(`[${PANEL_ATTR}].is-active`)?.getAttribute(PANEL_ATTR) === "members") {
      switchSection(locks.sections.billing.locked ? "club-data" : "billing");
    }
  }

  function renderOnboarding(snapshot, billing) {
    state.onboardingSnapshot = snapshot || null;
    state.onboardingBilling = billing || null;
    updateOnboardingKpis(snapshot, billing);
    renderOverviewMeta(snapshot, billing);
    renderOnboardingLists(snapshot);
    renderSnapshotTable(snapshot, billing);
    renderModuleCards(snapshot);
    renderBillingPanel(snapshot, billing);
    applySnapshotToControls(snapshot);
    applySectionLocks(snapshot, billing);
    renderCsvImportDraft();
  }

  async function loadWorkspace() {
    const clubId = String(state.onboardingSelectedClubId || "").trim();
    if (!clubId) {
      renderWorkspace(null);
      return;
    }
    const data = await callWorkspace("get");
    renderWorkspace(data?.workspace || null);
  }

  async function loadOnboardingStatus(options = {}) {
    const clubId = String(options.clubId || state.onboardingSelectedClubId || "").trim();
    if (!clubId) {
      renderOnboarding(null, null);
      setOnboardingMsg("Bitte zuerst einen Verein wählen.", true);
      return;
    }

    setOnboardingMsg("Onboarding-Status wird geladen ...");
    const data = await callFn("club-onboarding-status", { club_id: clubId });
    state.onboardingSelectedClubId = clubId;
    renderOnboarding(data?.snapshot || null, data?.billing || null);
    await loadWorkspace();
    setOnboardingMsg("Status geladen.");
  }

  async function saveOnboardingProgress() {
    const clubId = String(state.onboardingSelectedClubId || "").trim();
    if (!clubId) {
      setOnboardingMsg("Bitte zuerst einen Verein wählen.", true);
      return;
    }

    const noteValue = String(document.getElementById("clubOnboardingNote")?.value || "").trim();
    const payload = {
      club_id: clubId,
      club_data_complete: Boolean(document.getElementById("clubOnboardingClubData")?.checked),
      waters_complete: Boolean(document.getElementById("clubOnboardingWaters")?.checked),
      cards_complete: Boolean(document.getElementById("clubOnboardingCards")?.checked),
      members_mode: String(document.getElementById("clubOnboardingMembersMode")?.value || "pending").trim(),
      notes: noteValue ? { source: "club_onboarding_dashboard", note: noteValue } : null,
    };

    setOnboardingMsg("Onboarding-Progress wird gespeichert ...");
    const data = await callFn("club-onboarding-progress", payload);
    renderOnboarding(data?.snapshot || null, state.onboardingBilling);
    setResult(data);
    setOnboardingMsg("Onboarding-Progress gespeichert.");
  }

  async function handleOnboardingClubChange() {
    const select = document.getElementById("clubOnboardingClubSelect");
    const clubId = String(select?.value || "").trim();
    state.onboardingSelectedClubId = clubId;
    await loadOnboardingStatus({ clubId });
  }

  function collectCardNames() {
    const cards = Array.isArray(state.onboardingWorkspace?.cards) ? state.onboardingWorkspace.cards : [];
    const radios = Array.from(document.querySelectorAll('input[name="clubCardDefault"]'));
    const selectedIndex = Number(radios.find((radio) => radio.checked)?.value || 0);
    const names = cards.map((row) => String(row?.name || "").trim()).filter(Boolean);
    if (!names.length) return [];
    const next = names.slice();
    if (selectedIndex > 0 && selectedIndex < next.length) {
      const [picked] = next.splice(selectedIndex, 1);
      next.unshift(picked);
    }
    return next;
  }

  async function saveClubDataMask() {
    setOnboardingMsg("Vereinsdaten werden gespeichert ...");
    await callWorkspace("save_club_data", {
      club_name: document.getElementById("clubDataName")?.value || "",
      street: document.getElementById("clubDataStreet")?.value || "",
      zip: document.getElementById("clubDataZip")?.value || "",
      city: document.getElementById("clubDataCity")?.value || "",
      contact_name: document.getElementById("clubDataContactName")?.value || "",
      contact_email: document.getElementById("clubDataContactEmail")?.value || "",
      contact_phone: document.getElementById("clubDataContactPhone")?.value || "",
    });
    await loadOnboardingStatus({ clubId: state.onboardingSelectedClubId });
    setOnboardingMsg("Vereinsdaten gespeichert.");
  }

  async function createWater() {
    const name = String(document.getElementById("clubWaterCreateName")?.value || "").trim();
    if (!name) {
      setOnboardingMsg("Bitte zuerst einen Gewässernamen eingeben.", true);
      return;
    }
    setOnboardingMsg("Gewässer wird angelegt ...");
    await callWorkspace("create_water", { name });
    document.getElementById("clubWaterCreateName").value = "";
    await loadOnboardingStatus({ clubId: state.onboardingSelectedClubId });
    setOnboardingMsg("Gewässer angelegt.");
  }

  async function toggleWater(button) {
    const waterId = String(button?.getAttribute("data-water-toggle") || "").trim();
    const nextActive = String(button?.getAttribute("data-next-active") || "") === "1";
    if (!waterId) return;
    setOnboardingMsg("Gewässerstatus wird gespeichert ...");
    await callWorkspace("toggle_water", { water_id: waterId, is_active: nextActive });
    await loadOnboardingStatus({ clubId: state.onboardingSelectedClubId });
    setOnboardingMsg("Gewässerstatus aktualisiert.");
  }

  async function createCard() {
    const input = document.getElementById("clubCardCreateName");
    const name = String(input?.value || "").trim();
    if (!name) {
      setOnboardingMsg("Bitte zuerst einen Kartennamen eingeben.", true);
      return;
    }
    const existing = Array.isArray(state.onboardingWorkspace?.cards) ? state.onboardingWorkspace.cards.map((row) => String(row?.name || "").trim()).filter(Boolean) : [];
    const next = [...new Set([...existing, name])];
    setOnboardingMsg("Kartenliste wird gespeichert ...");
    await callWorkspace("save_cards", { cards: next });
    if (input) input.value = "";
    await loadOnboardingStatus({ clubId: state.onboardingSelectedClubId });
    setOnboardingMsg("Karte ergänzt.");
  }

  async function saveCardsMask() {
    const names = collectCardNames();
    if (!names.length) {
      setOnboardingMsg("Bitte mindestens eine Karte anlegen.", true);
      return;
    }
    setOnboardingMsg("Kartenbasis wird gespeichert ...");
    await callWorkspace("save_cards", { cards: names });
    await loadOnboardingStatus({ clubId: state.onboardingSelectedClubId });
    setOnboardingMsg("Kartenbasis gespeichert.");
  }

  async function createMember() {
    const firstName = String(document.getElementById("clubMemberFirstName")?.value || "").trim();
    const lastName = String(document.getElementById("clubMemberLastName")?.value || "").trim();
    if (!firstName || !lastName) {
      setOnboardingMsg("Vorname und Nachname sind Pflicht.", true);
      return;
    }
    setOnboardingMsg("Mitglied wird angelegt ...");
    await callWorkspace("create_member", {
      first_name: firstName,
      last_name: lastName,
      status: document.getElementById("clubMemberStatus")?.value || "active",
      fishing_card_type: document.getElementById("clubMemberCardType")?.value || "",
      city: document.getElementById("clubMemberCity")?.value || "",
      phone: document.getElementById("clubMemberPhone")?.value || "",
    });
    ["clubMemberFirstName", "clubMemberLastName", "clubMemberCardType", "clubMemberCity", "clubMemberPhone"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    await loadOnboardingStatus({ clubId: state.onboardingSelectedClubId });
    setOnboardingMsg("Mitglied angelegt.");
  }

  async function handleSetupCreated(data) {
    const clubId = String(data?.club_id || "").trim();
    await loadOnboardingClubOptions();
    if (clubId && state.onboardingClubOptions.some((club) => club.id === clubId)) {
      state.onboardingSelectedClubId = clubId;
      renderOnboardingClubSelect();
      await loadOnboardingStatus({ clubId });
      return;
    }
    if (state.onboardingSelectedClubId) {
      renderOnboardingClubSelect();
      await loadOnboardingStatus({ clubId: state.onboardingSelectedClubId });
    }
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
      await handleSetupCreated(data);
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

  function disableForMissingConfig() {
    [
      "clubSetupSubmit",
      "clubInviteCreateBtn",
      "clubOnboardingRefresh",
      "clubOnboardingSave",
      "clubDataSaveBtn",
      "clubWatersSaveBtn",
      "clubCardsSaveBtn",
      "clubMembersSaveBtn",
      "clubOnboardingClubSelect",
      "clubOnboardingClubData",
      "clubOnboardingWaters",
      "clubOnboardingCards",
      "clubOnboardingMembersMode",
      "clubOnboardingNote",
      "clubWaterCreateBtn",
      "clubCardCreateBtn",
      "clubMemberCreateBtn",
      "clubBillingCheckoutBtn",
      "clubMembersCsvFile",
      "clubMembersCsvDelimiter",
      "clubMembersCsvPrepareBtn",
      "clubMembersCsvConfirmBtn",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });

    setMsg("Preflight: Supabase Runtime-Config fehlt/Platzhalter. Vereinsanlage ist bis zur Token-Umstellung gesperrt.", true);
    setOnboardingMsg("Preflight: Ohne Runtime-Config kann der Onboarding-Status nicht geladen werden.", true);
    setResult({
      mode: "readiness",
      ok: false,
      reason: "missing_runtime_config",
      required: ["PUBLIC_SUPABASE_URL", "PUBLIC_SUPABASE_ANON_KEY"],
    });
  }

  async function bootOnboarding() {
    try {
      await loadOnboardingClubOptions();
      if (state.onboardingSelectedClubId) {
        await loadOnboardingStatus({ clubId: state.onboardingSelectedClubId });
      } else {
        setOnboardingMsg("Keine verwaltbaren Vereine im aktuellen Kontext gefunden.", true);
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : "unexpected_error";
      setOnboardingMsg(`Onboarding konnte nicht geladen werden: ${code}`, true);
    }
  }

  function boot() {
    const btn = document.getElementById("clubSetupSubmit");
    const inviteBtn = document.getElementById("clubInviteCreateBtn");
    const refreshBtn = document.getElementById("clubOnboardingRefresh");
    const saveBtn = document.getElementById("clubOnboardingSave");
    const clubDataSaveBtn = document.getElementById("clubDataSaveBtn");
    const watersSaveBtn = document.getElementById("clubWatersSaveBtn");
    const cardsSaveBtn = document.getElementById("clubCardsSaveBtn");
    const membersSaveBtn = document.getElementById("clubMembersSaveBtn");
    const waterCreateBtn = document.getElementById("clubWaterCreateBtn");
    const cardCreateBtn = document.getElementById("clubCardCreateBtn");
    const memberCreateBtn = document.getElementById("clubMemberCreateBtn");
    const billingCheckoutBtn = document.getElementById("clubBillingCheckoutBtn");
    const csvPrepareBtn = document.getElementById("clubMembersCsvPrepareBtn");
    const csvConfirmBtn = document.getElementById("clubMembersCsvConfirmBtn");
    const clubSelect = document.getElementById("clubOnboardingClubSelect");
    if (!btn && !inviteBtn && !refreshBtn && !saveBtn) return;

    if (!hasRuntimeConfig()) {
      disableForMissingConfig();
      return;
    }

    document.querySelectorAll(`[${SECTION_ATTR}]`).forEach((button) => {
      button.addEventListener("click", () => switchSection(String(button.getAttribute(SECTION_ATTR) || "")));
    });
    switchSection("overview");

    if (btn) btn.addEventListener("click", submitSetup);
    if (inviteBtn) inviteBtn.addEventListener("click", submitInviteCreate);
    if (refreshBtn) refreshBtn.addEventListener("click", () => loadOnboardingStatus({ clubId: state.onboardingSelectedClubId }).catch((err) => {
      const code = err instanceof Error ? err.message : "unexpected_error";
      setOnboardingMsg(`Status konnte nicht geladen werden: ${code}`, true);
    }));
    if (saveBtn) saveBtn.addEventListener("click", () => saveOnboardingProgress().catch((err) => {
      const code = err instanceof Error ? err.message : "unexpected_error";
      setOnboardingMsg(`Progress konnte nicht gespeichert werden: ${code}`, true);
    }));
    if (clubDataSaveBtn) clubDataSaveBtn.addEventListener("click", () => saveClubDataMask().then(() => saveOnboardingProgress()).catch((err) => {
      const code = err instanceof Error ? err.message : "unexpected_error";
      setOnboardingMsg(`Vereinsdaten konnten nicht gespeichert werden: ${code}`, true);
    }));
    if (watersSaveBtn) watersSaveBtn.addEventListener("click", () => saveOnboardingProgress().catch((err) => {
      const code = err instanceof Error ? err.message : "unexpected_error";
      setOnboardingMsg(`Gewässer-Fortschritt konnte nicht gespeichert werden: ${code}`, true);
    }));
    if (cardsSaveBtn) cardsSaveBtn.addEventListener("click", () => saveCardsMask().then(() => saveOnboardingProgress()).catch((err) => {
      const code = err instanceof Error ? err.message : "unexpected_error";
      setOnboardingMsg(`Karten-Fortschritt konnte nicht gespeichert werden: ${code}`, true);
    }));
    if (membersSaveBtn) membersSaveBtn.addEventListener("click", () => saveOnboardingProgress().catch((err) => {
      const code = err instanceof Error ? err.message : "unexpected_error";
      setOnboardingMsg(`Mitglieder-Fortschritt konnte nicht gespeichert werden: ${code}`, true);
    }));
    if (waterCreateBtn) waterCreateBtn.addEventListener("click", () => createWater().catch((err) => {
      const code = err instanceof Error ? err.message : "unexpected_error";
      setOnboardingMsg(`Gewässer konnte nicht angelegt werden: ${code}`, true);
    }));
    if (cardCreateBtn) cardCreateBtn.addEventListener("click", () => createCard().catch((err) => {
      const code = err instanceof Error ? err.message : "unexpected_error";
      setOnboardingMsg(`Karte konnte nicht angelegt werden: ${code}`, true);
    }));
    if (memberCreateBtn) memberCreateBtn.addEventListener("click", () => createMember().catch((err) => {
      const code = err instanceof Error ? err.message : "unexpected_error";
      setOnboardingMsg(`Mitglied konnte nicht angelegt werden: ${code}`, true);
    }));
    if (billingCheckoutBtn) billingCheckoutBtn.addEventListener("click", () => startBillingCheckout().catch((err) => {
      const code = err instanceof Error ? err.message : "unexpected_error";
      const msg = code === "no_active_members"
        ? "Für den Checkout braucht der Verein mindestens ein aktives Mitglied."
        : code === "checkout_url_missing"
          ? "Checkout konnte nicht geöffnet werden."
          : `Checkout konnte nicht gestartet werden: ${code}`;
      setOnboardingMsg(msg, true);
    }));
    if (csvPrepareBtn) csvPrepareBtn.addEventListener("click", () => startCsvImportServerParse().catch((err) => {
      const code = err instanceof Error ? err.message : "unexpected_error";
      setOnboardingMsg(`CSV konnte nicht vorbereitet werden: ${code}`, true);
    }));
    if (csvConfirmBtn) csvConfirmBtn.addEventListener("click", () => confirmCsvImportDraft().catch((err) => {
      const code = err instanceof Error ? err.message : "unexpected_error";
      setOnboardingMsg(`CSV-Import konnte nicht bestätigt werden: ${code}`, true);
    }));
    if (clubSelect) clubSelect.addEventListener("change", () => handleOnboardingClubChange().catch((err) => {
      const code = err instanceof Error ? err.message : "unexpected_error";
      setOnboardingMsg(`Club-Wechsel fehlgeschlagen: ${code}`, true);
    }));
    document.addEventListener("click", (event) => {
      const button = event.target?.closest?.("[data-water-toggle]");
      if (!button) return;
      toggleWater(button).catch((err) => {
        const code = err instanceof Error ? err.message : "unexpected_error";
        setOnboardingMsg(`Gewässerstatus konnte nicht gespeichert werden: ${code}`, true);
      });
    });

    bootOnboarding();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
