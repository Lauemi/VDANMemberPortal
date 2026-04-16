"use strict";

// Domain Adapter: Vereinsverwaltung
// Zustaendig fuer alle Member-Registry- und Gewaesser-CRUD-Operationen.
// Wird von fcp-adm-qfm-contract-hub.js ueber buildTableRuntimeOptions aufgerufen.
// NICHT in neutrale Renderer (FCPInlineDataTable, FCPDataTable) oder den Contract-Hub-Core einmischen.

;(() => {
  // ---------------------------------------------------------------------------
  // HTTP-Helfer (bewusst lokal, nicht geteilt mit Contract Hub)
  // ---------------------------------------------------------------------------

  function authSession() {
    try {
      if (window.VDAN_AUTH?.loadSession) return window.VDAN_AUTH.loadSession();
    } catch {
      // noop
    }
    return null;
  }

  async function authToken(forceRefresh = false) {
    let current = String(authSession()?.access_token || "").trim();
    if (current && !forceRefresh) return current;
    try {
      if (window.VDAN_AUTH?.refreshSession) {
        const refreshed = await window.VDAN_AUTH.refreshSession();
        current = String(refreshed?.access_token || authSession()?.access_token || "").trim();
      }
    } catch {
      // noop
    }
    return current;
  }

  async function rpcPost(path, payload, withAuth = false) {
    const baseUrl = String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, "");
    const apiKey = String(window.__APP_SUPABASE_KEY || "").trim();
    if (!baseUrl) throw new Error("Supabase-URL fehlt.");
    if (!apiKey) throw new Error("Supabase-API-Key fehlt.");
    const headers = new Headers({
      "Content-Type": "application/json",
      Accept: "application/json",
    });
    headers.set("apikey", apiKey);
    if (withAuth) {
      const token = await authToken();
      if (!token) throw new Error("Keine aktive Sitzung gefunden.");
      headers.set("Authorization", `Bearer ${token}`);
    }
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload || {}),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || `RPC fehlgeschlagen (${response.status})`);
    }
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async function edgePost(functionName, payload) {
    const baseUrl = String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, "");
    const apiKey = String(window.__APP_SUPABASE_KEY || "").trim();
    if (!baseUrl) throw new Error("Supabase-URL fehlt.");
    if (!apiKey) throw new Error("Supabase-API-Key fehlt.");
    const requestBody = JSON.stringify(payload || {});

    async function runRequest({ forceRefresh = false, useCustomTokenHeader = false } = {}) {
      const token = await authToken(forceRefresh);
      if (!token) throw new Error("Keine aktive Sitzung gefunden.");
      const headers = new Headers({
        apikey: apiKey,
        "Content-Type": "application/json",
        Authorization: useCustomTokenHeader ? `Bearer ${apiKey}` : `Bearer ${token}`,
      });
      if (useCustomTokenHeader) headers.set("x-vdan-access-token", token);
      const response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
        method: "POST",
        headers,
        body: requestBody,
      });
      const data = await response.json().catch(() => ({}));
      return { response, data };
    }

    let { response, data } = await runRequest({ forceRefresh: false, useCustomTokenHeader: false });
    if (response.status === 401) {
      ({ response, data } = await runRequest({ forceRefresh: true, useCustomTokenHeader: false }));
    }
    if (response.status === 401) {
      ({ response, data } = await runRequest({ forceRefresh: true, useCustomTokenHeader: true }));
    }
    if (!response.ok || data?.ok === false) {
      throw new Error(String(data?.error || data?.message || `Edge Function fehlgeschlagen (${response.status})`));
    }
    return data;
  }

  async function authJson(path, { method = "GET", body = null } = {}) {
    const baseUrl = String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, "");
    const apiKey = String(window.__APP_SUPABASE_KEY || "").trim();
    if (!baseUrl) throw new Error("Supabase-URL fehlt.");
    if (!apiKey) throw new Error("Supabase-API-Key fehlt.");

    async function runRequest({ forceRefresh = false } = {}) {
      const token = await authToken(forceRefresh);
      if (!token) throw new Error("Keine aktive Sitzung gefunden.");
      const headers = new Headers({
        apikey: apiKey,
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      });
      if (body != null) headers.set("Content-Type", "application/json");
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : undefined,
      });
      const data = await response.json().catch(() => ({}));
      return { response, data };
    }

    let { response, data } = await runRequest({ forceRefresh: false });
    if (response.status === 401) {
      ({ response, data } = await runRequest({ forceRefresh: true }));
    }
    if (!response.ok) {
      throw new Error(String(data?.error || data?.message || `Request fehlgeschlagen (${response.status})`));
    }
    return data;
  }

  // ---------------------------------------------------------------------------
  // Statische Domain-Helfer (keine Runtime-Abhaengigkeiten)
  // ---------------------------------------------------------------------------

  function normalizedCardAssignments(value, fallbackLabel = "") {
    if (Array.isArray(value)) {
      const next = value
        .map((entry) => {
          if (entry && typeof entry === "object") {
            return String(entry.id || entry.value || entry.key || "").trim().toLowerCase();
          }
          return String(entry || "").trim().toLowerCase();
        })
        .filter(Boolean);
      return [...new Set(next)].filter((entry) => entry === "innenwasser" || entry === "rheinlos39");
    }
    const legacy = String(value || fallbackLabel || "").toLowerCase();
    const next = [];
    if (legacy.includes("innenwasser") || legacy.includes("innewasser")) next.push("innenwasser");
    if (legacy.includes("rheinlos") || legacy.includes("rhein")) next.push("rheinlos39");
    return [...new Set(next)];
  }

  function canonicalFishingCardType(cardAssignments) {
    const ids = normalizedCardAssignments(cardAssignments);
    const hasInnen = ids.includes("innenwasser");
    const hasRhein = ids.includes("rheinlos39");
    if (hasInnen && hasRhein) return "Innenwasser + Rheinlos";
    if (hasInnen) return "Innenwasser";
    if (hasRhein) return "Rheinlos";
    return "-";
  }

  async function assignMemberCards(clubId, memberNo, draft, row) {
    const cardIds = normalizedCardAssignments(
      draft?.card_assignments,
      draft?.fishing_card_type || row?.fishing_card_type || ""
    );
    if (!clubId) throw new Error("club_id fehlt fuer die Kartenzuordnung.");
    if (!memberNo) throw new Error("member_no fehlt fuer die Kartenzuordnung.");
    await rpcPost("/rest/v1/rpc/admin_member_assign_cards", {
      p_club_id: clubId,
      p_member_no: memberNo,
      p_card_ids: cardIds,
    }, true);
    return canonicalFishingCardType(cardIds);
  }

  // ---------------------------------------------------------------------------
  // Club-Kontext-Aufloesung
  // ---------------------------------------------------------------------------

  function resolveRuntimeClubContext(rows) {
    let clubContextPromise = null;
    return async function () {
      if (clubContextPromise) return clubContextPromise;
      clubContextPromise = (async () => {
        let requestedClubId = "";
        try {
          const params = new URLSearchParams(window.location.search || "");
          requestedClubId = String(params.get("club_id") || "").trim();
        } catch {
          requestedClubId = "";
        }

        const session = authSession();
        const userId = String(session?.user?.id || "").trim();
        const baseContext = { club_id: "", club_code: "" };
        if (!userId) return baseContext;

        const [profileRows, aclRows, legacyRows, identityRows] = await Promise.all([
          authJson(`/rest/v1/profiles?select=club_id&id=eq.${encodeURIComponent(userId)}&limit=1`, { method: "GET" }).catch(() => []),
          authJson(`/rest/v1/club_user_roles?select=club_id,role_key&user_id=eq.${encodeURIComponent(userId)}`, { method: "GET" }).catch(() => []),
          authJson(`/rest/v1/user_roles?select=club_id,role&user_id=eq.${encodeURIComponent(userId)}`, { method: "GET" }).catch(() => []),
          authJson("/rest/v1/rpc/get_club_identity_map", { method: "POST", body: {} }).catch(() => []),
        ]);

        const managedClubIds = new Set();
        (Array.isArray(aclRows) ? aclRows : []).forEach((entry) => {
          const clubId = String(entry?.club_id || "").trim();
          const roleKey = String(entry?.role_key || "").trim().toLowerCase();
          if (clubId && ["admin", "vorstand", "superadmin"].includes(roleKey)) managedClubIds.add(clubId);
        });
        (Array.isArray(legacyRows) ? legacyRows : []).forEach((entry) => {
          const clubId = String(entry?.club_id || "").trim();
          const roleKey = String(entry?.role || "").trim().toLowerCase();
          if (clubId && ["admin", "vorstand", "superadmin"].includes(roleKey)) managedClubIds.add(clubId);
        });

        const profile = Array.isArray(profileRows) && profileRows.length ? profileRows[0] : {};
        let clubId = requestedClubId || String(profile?.club_id || "").trim();
        if (!clubId && managedClubIds.size === 1) clubId = [...managedClubIds][0] || "";
        if (!clubId && managedClubIds.size > 1) {
          clubId = [...managedClubIds].sort((a, b) => a.localeCompare(b, "de"))[0] || "";
        }

        const identity = (Array.isArray(identityRows) ? identityRows : [])
          .find((entry) => String(entry?.club_id || "").trim() === clubId) || {};
        return {
          club_id: clubId,
          club_code: String(identity?.club_code || "").trim(),
        };
      })();
      return clubContextPromise;
    };
  }

  // ---------------------------------------------------------------------------
  // Handler-Factory: gibt context-gebundene CRUD-Funktionen zurueck
  // ---------------------------------------------------------------------------

  function createHandlers({ rows, pattern, section, panelId, message }) {
    const normalizedRows = () => (Array.isArray(rows) ? rows : []);

    function currentClubId(row, draft) {
      return String(
        draft?.club_id
        || row?.club_id
        || normalizedRows().find((entry) => String(entry?.club_id || "").trim())?.club_id
        || new URLSearchParams(window.location.search || "").get("club_id")
        || ""
      ).trim();
    }

    function currentClubCode(row, draft) {
      return String(
        draft?.club_code
        || row?.club_code
        || normalizedRows().find((entry) => String(entry?.club_code || "").trim())?.club_code
        || ""
      ).trim();
    }

    const resolveClubContext = resolveRuntimeClubContext(rows);

    async function currentClubIdAsync(row, draft) {
      const direct = currentClubId(row, draft);
      if (direct) return direct;
      const context = await resolveClubContext().catch(() => ({ club_id: "" }));
      return String(context?.club_id || "").trim();
    }

    async function createMemberRegistryRow(draft) {
      const clubId = currentClubId(null, draft);
      const clubCode = currentClubCode(null, draft);
      if (!clubId) throw new Error("club_id fehlt fuer das Anlegen.");
      if (!clubCode) throw new Error("club_code fehlt fuer das Anlegen.");
      const legacyFishingCardType = canonicalFishingCardType(draft?.card_assignments || draft?.fishing_card_type);
      const createdRows = await rpcPost("/rest/v1/rpc/admin_member_registry_create", {
        p_club_id: clubId,
        p_club_code: clubCode,
        p_club_member_no: String(draft?.club_member_no || "").trim().toUpperCase() || null,
        p_first_name: String(draft?.first_name || "").trim() || null,
        p_last_name: String(draft?.last_name || "").trim() || null,
        p_role: String(draft?.role || "member").trim().toLowerCase() || "member",
        p_status: String(draft?.status || "Aktiv").trim() || null,
        p_fishing_card_type: legacyFishingCardType === "-" ? null : legacyFishingCardType,
        p_street: String(draft?.street || "").trim() || null,
        p_email: String(draft?.email || "").trim().toLowerCase() || null,
        p_zip: String(draft?.zip || "").trim() || null,
        p_city: String(draft?.city || "").trim() || null,
        p_phone: String(draft?.phone || "").trim() || null,
        p_mobile: String(draft?.mobile || "").trim() || null,
        p_birthdate: String(draft?.birthdate || "").trim() || null,
        p_guardian_member_no: String(draft?.guardian_member_no || "").trim() || null,
        p_sepa_approved: (String(draft?.sepa_approved || "false") === "true" || draft?.sepa_approved === true) ? true : null,
        p_iban: String(draft?.iban || "").trim() || null,
      }, true);
      const createdMemberNo = String(
        (Array.isArray(createdRows) && createdRows[0]?.member_no)
        || draft?.member_no
        || ""
      ).trim();
      if (createdMemberNo) {
        await assignMemberCards(clubId, createdMemberNo, draft, null);
      }
      if (typeof pattern?.loadPanel === "function") {
        await pattern.loadPanel(section.id, panelId).catch(() => null);
      }
      message("Mitglied gespeichert.");
      return true;
    }

    async function updateMemberRegistryRow(row, draft) {
      const memberNo = String(row?.member_no || draft?.member_no || "").trim();
      const clubId = currentClubId(row, draft);
      if (!memberNo) throw new Error("member_no fehlt fuer das Speichern.");
      if (!clubId) throw new Error("club_id fehlt fuer das Speichern.");
      const legacyFishingCardType = canonicalFishingCardType(
        draft?.card_assignments || draft?.fishing_card_type || row?.fishing_card_type
      );
      await rpcPost("/rest/v1/rpc/admin_member_registry_update", {
        p_member_no: memberNo,
        p_club_member_no: String(draft?.club_member_no || "").trim().toUpperCase() || null,
        p_first_name: String(draft?.first_name || "").trim() || null,
        p_last_name: String(draft?.last_name || "").trim() || null,
        p_role: String(draft?.role || "member").trim().toLowerCase() || "member",
        p_status: String(draft?.status || "").trim() || null,
        p_fishing_card_type: legacyFishingCardType === "-" ? null : legacyFishingCardType,
        p_street: String(draft?.street || "").trim() || null,
        p_email: String(draft?.email || "").trim().toLowerCase() || null,
        p_zip: String(draft?.zip || "").trim() || null,
        p_city: String(draft?.city || "").trim() || null,
        p_phone: String(draft?.phone || "").trim() || null,
        p_mobile: String(draft?.mobile || "").trim() || null,
        p_birthdate: String(draft?.birthdate || "").trim() || null,
        p_guardian_member_no: String(draft?.guardian_member_no || "").trim() || null,
        p_sepa_approved: (String(draft?.sepa_approved || "false") === "true" || draft?.sepa_approved === true) ? true : null,
        p_iban: String(draft?.iban || "").trim() || null,
      }, true);
      await assignMemberCards(clubId, memberNo, draft, row);
      if (typeof pattern?.loadPanel === "function") {
        await pattern.loadPanel(section.id, panelId).catch(() => null);
      }
      message("Änderungen gespeichert.");
      return true;
    }

    async function deleteMemberRegistryRow(row) {
      const clubId = currentClubId(row, null);
      const memberNo = String(row?.member_no || "").trim();
      if (!clubId) throw new Error("club_id fehlt fuer das Loeschen.");
      if (!memberNo) throw new Error("member_no fehlt fuer das Loeschen.");
      await rpcPost("/rest/v1/rpc/admin_member_registry_delete", {
        p_club_id: clubId,
        p_member_no: memberNo,
      }, true);
      if (typeof pattern?.loadPanel === "function") {
        await pattern.loadPanel(section.id, panelId).catch(() => null);
      }
      return true;
    }

    async function saveWaterRow(row, draft) {
      const clubId = await currentClubIdAsync(row, draft);
      const waterId = String(draft?.water_id || row?.water_id || row?.id || "").trim();
      const name = String(draft?.name ?? row?.name ?? "").trim();
      if (!clubId) throw new Error("club_id fehlt fuer das Gewaesser.");
      if (!waterId) throw new Error("water_id fehlt fuer das Gewaesser.");
      if (!name) throw new Error("Name fehlt fuer das Gewaesser.");
      await edgePost("club-onboarding-workspace", {
        action: "update_water",
        club_id: clubId,
        water_id: waterId,
        name,
        water_type: String(draft?.water_type ?? row?.water_type ?? "").trim(),
        water_status: String(draft?.water_status ?? row?.water_status ?? "active").trim() || "active",
        is_youth_allowed: Boolean(draft?.is_youth_allowed ?? row?.is_youth_allowed),
        requires_board_approval: Boolean(draft?.requires_board_approval ?? row?.requires_board_approval),
        water_cards: normalizedCardAssignments(draft?.water_cards ?? row?.water_cards),
      });
      if (typeof pattern?.loadPanel === "function") {
        await pattern.loadPanel(section.id, panelId).catch(() => null);
      }
      message("Gewaesser gespeichert.");
      return true;
    }

    async function deleteWaterRow(row) {
      const clubId = await currentClubIdAsync(row, null);
      const waterId = String(row?.water_id || row?.id || "").trim();
      if (!clubId) throw new Error("club_id fehlt fuer das Loeschen.");
      if (!waterId) throw new Error("water_id fehlt fuer das Loeschen.");
      await edgePost("club-onboarding-workspace", {
        action: "delete_water",
        club_id: clubId,
        water_id: waterId,
      });
      if (typeof pattern?.loadPanel === "function") {
        await pattern.loadPanel(section.id, panelId).catch(() => null);
      }
      message("Gewaesser geloescht.");
      return true;
    }

    return {
      createMemberRegistryRow,
      updateMemberRegistryRow,
      deleteMemberRegistryRow,
      saveWaterRow,
      deleteWaterRow,
    };
  }

  // ---------------------------------------------------------------------------
  // renderFormResultCard — Panel-spezifischer Ergebnisblock fuer invite_create
  // Wird von fcp-adm-qfm-shared-renderers.js ueber Hook aufgerufen.
  // Gibt null zurueck wenn das Panel nicht invite_create ist oder keine Daten vorliegen.
  // ---------------------------------------------------------------------------

  function renderFormResultCard(panel, fields, { createElement, pattern } = {}) {
    if (panel?.id !== "club_settings_invite_create") return null;
    if (typeof createElement !== "function") return null;

    function findFieldValue(fieldName) {
      const match = (fields || []).find((field) => String(field?.name || "").trim() === String(fieldName || "").trim());
      return match?.value;
    }

    async function copyInviteLink(linkValue) {
      const text = String(linkValue || "").trim();
      if (!text) return false;
      if (navigator?.clipboard?.writeText) {
        return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
      }
      return false;
    }

    const qrUrl = String(findFieldValue("invite_qr_url") || "").trim();
    const inviteUrl = String(findFieldValue("invite_register_url") || "").trim();
    const expiresAt = String(findFieldValue("invite_expires_at") || "").trim();
    if (!qrUrl && !inviteUrl && !expiresAt) return null;

    const card = createElement("section", { className: "qfp-form-group qfp-invite-result-card" });
    const body = createElement("div", { className: "qfp-form-group__grid qfp-form-group__grid--ungrouped" });

    if (qrUrl) {
      const qrWrap = createElement("div", { className: "qfp-form-field is-full" });
      qrWrap.append(createElement("span", { className: "qfp-field-label", text: "QR-Code" }));
      qrWrap.append(createElement("img", {
        className: "qfp-invite-result-card__qr",
        attrs: { src: qrUrl, alt: "Einladungs-QR-Code", loading: "lazy" },
      }));
      body.append(qrWrap);
    }

    if (inviteUrl) {
      const linkWrap = createElement("div", { className: "qfp-form-field is-full" });
      linkWrap.append(createElement("span", { className: "qfp-field-label", text: "Invite-Link" }));
      linkWrap.append(createElement("input", {
        attrs: { type: "text", value: inviteUrl, readonly: "readonly" },
      }));
      linkWrap.append(createElement("button", {
        className: "feed-btn",
        text: "Invite-Link kopieren",
        attrs: { type: "button" },
        onClick: async () => {
          const copied = await copyInviteLink(inviteUrl);
          if (copied) {
            pattern?.setMessage?.("Invite-Link in die Zwischenablage kopiert.");
          } else {
            pattern?.setMessage?.("Invite-Link konnte nicht kopiert werden.");
          }
        },
      }));
      body.append(linkWrap);
    }

    if (expiresAt) {
      const expiresWrap = createElement("div", { className: "qfp-form-field is-full" });
      expiresWrap.append(createElement("span", { className: "qfp-field-label", text: "Gueltig bis" }));
      expiresWrap.append(createElement("input", {
        attrs: { type: "text", value: expiresAt, readonly: "readonly" },
      }));
      body.append(expiresWrap);
    }

    card.append(body);
    return card;
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  window.VdanDomainAdapterVereinsverwaltung = Object.freeze({
    normalizedCardAssignments,
    canonicalFishingCardType,
    createHandlers,
    renderFormResultCard,
  });
})();
