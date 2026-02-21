;(() => {
  const MANAGER_ROLES = new Set(["admin", "vorstand"]);

  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  function uid() {
    return session()?.user?.id || null;
  }

  async function sb(path, init = {}, withAuth = false) {
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    if (withAuth && session()?.access_token) {
      headers.set("Authorization", `Bearer ${session().access_token}`);
    }
    const res = await fetch(`${url}${path}`, { ...init, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || err?.hint || err?.error_description || `Request failed (${res.status})`);
    }
    return res.json().catch(() => ({}));
  }

  function setMsg(text = "", isError = false) {
    const el = document.getElementById("membershipAdminMsg");
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? "#fecaca" : "";
  }

  function esc(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function asDate(input) {
    if (!input) return "-";
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? String(input) : d.toLocaleString("de-DE");
  }

  async function loadRoles() {
    if (!uid()) return [];
    const rows = await sb(`/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(uid())}`, { method: "GET" }, true);
    return Array.isArray(rows) ? rows.map((r) => String(r.role || "").toLowerCase()) : [];
  }

  async function listApplications() {
    const rows = await sb("/rest/v1/membership_applications?select=id,created_at,status,first_name,last_name,birthdate,street,zip,city,is_local,known_member,fishing_card_type,iban_last4,sepa_approved,internal_questionnaire,decision_by,decision_at,rejection_reason&order=created_at.desc", { method: "GET" }, true);
    return Array.isArray(rows) ? rows : [];
  }

  async function saveQuestionnaire(id, data) {
    return sb("/rest/v1/rpc/membership_set_internal_questionnaire", {
      method: "POST",
      body: JSON.stringify({
        p_application_id: id,
        p_internal_questionnaire: data,
      }),
    }, true);
  }

  async function approve(id, membershipNumber) {
    return sb("/rest/v1/rpc/approve_membership", {
      method: "POST",
      body: JSON.stringify({
        p_application_id: id,
        p_membership_number: membershipNumber || null,
      }),
    }, true);
  }

  async function reject(id, reason) {
    return sb("/rest/v1/rpc/reject_membership", {
      method: "POST",
      body: JSON.stringify({
        p_application_id: id,
        p_rejection_reason: reason || null,
      }),
    }, true);
  }

  async function exportApprovedMembers() {
    const rows = await sb("/rest/v1/export_members?select=membership_number,first_name,last_name,birthdate,street,zip,city,fishing_card_type,is_local,created_at&order=membership_number.asc", { method: "GET" }, true);
    const data = Array.isArray(rows) ? rows : [];
    if (!data.length) {
      setMsg("Keine genehmigten Mitglieder für Export vorhanden.");
      return;
    }
    const headers = ["membership_number", "first_name", "last_name", "birthdate", "street", "zip", "city", "fishing_card_type", "is_local", "created_at"];
    const csv = [
      headers.join(";"),
      ...data.map((r) => headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(";")),
    ].join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vdan_members_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMsg(`Export erstellt (${data.length} Zeilen).`);
  }

  function parseQuestionnaire(str) {
    const raw = String(str || "").trim();
    if (!raw) throw new Error("Interner Fragebogen fehlt.");
    return JSON.parse(raw);
  }

  function renderCards(rows) {
    const pendingRoot = document.getElementById("membershipPendingList");
    const doneRoot = document.getElementById("membershipDoneList");
    if (!pendingRoot || !doneRoot) return;
    pendingRoot.innerHTML = "";
    doneRoot.innerHTML = "";

    const pending = rows.filter((r) => r.status === "pending");
    const done = rows.filter((r) => r.status !== "pending");

    if (!pending.length) pendingRoot.innerHTML = `<p class="small">Keine offenen Bewerbungen.</p>`;
    if (!done.length) doneRoot.innerHTML = `<p class="small">Keine bearbeiteten Bewerbungen.</p>`;

    pending.forEach((r) => {
      const q = r.internal_questionnaire ? JSON.stringify(r.internal_questionnaire, null, 2) : "";
      const el = document.createElement("article");
      el.className = "card";
      el.innerHTML = `
        <div class="card__body">
          <h3>${esc(r.first_name)} ${esc(r.last_name)}</h3>
          <p class="small">Eingang: ${esc(asDate(r.created_at))}</p>
          <p class="small">Geburt: ${esc(r.birthdate)} | Karte: ${esc(r.fishing_card_type)} | Ortsansässig: ${r.is_local ? "Ja" : "Nein"}</p>
          <p class="small">Adresse: ${esc(r.street)}, ${esc(r.zip)} ${esc(r.city)}</p>
          <p class="small">Kennt im Verein: ${esc(r.known_member || "-")}</p>
          <p class="small">IBAN: **** **** **** ${esc(r.iban_last4)}</p>
          <label>Interner Fragebogen (JSON)
            <textarea rows="6" data-q-id="${esc(r.id)}" placeholder='{"gespraech":"ok","empfehlung":"ja"}'>${esc(q)}</textarea>
          </label>
          <label>Mitgliedsnummer (optional)
            <input data-membership-no-id="${esc(r.id)}" placeholder="z. B. 8001" />
          </label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="feed-btn feed-btn--ghost" data-save="${esc(r.id)}">Fragebogen speichern</button>
            <button type="button" class="feed-btn" data-approve="${esc(r.id)}">Genehmigen</button>
            <button type="button" class="feed-btn feed-btn--ghost" data-reject="${esc(r.id)}">Ablehnen</button>
          </div>
        </div>
      `;
      pendingRoot.appendChild(el);
    });

    done.forEach((r) => {
      const status = r.status === "approved" ? "Genehmigt" : "Abgelehnt";
      const el = document.createElement("article");
      el.className = "card";
      el.innerHTML = `
        <div class="card__body">
          <h3>${esc(r.first_name)} ${esc(r.last_name)}</h3>
          <p class="small">Status: <strong>${status}</strong></p>
          <p class="small">Entscheidung: ${esc(asDate(r.decision_at))}</p>
          <p class="small">Ablehnungsgrund: ${esc(r.rejection_reason || "-")}</p>
          <p class="small">IBAN: **** **** **** ${esc(r.iban_last4)}</p>
        </div>
      `;
      doneRoot.appendChild(el);
    });
  }

  async function refresh() {
    setMsg("Lade Bewerbungen…");
    const rows = await listApplications();
    renderCards(rows);
    setMsg(`Bewerbungen geladen: ${rows.length}`);
  }

  async function init() {
    if (!uid()) {
      window.location.replace(`/login/?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    const roles = await loadRoles().catch(() => []);
    const isManager = roles.some((r) => MANAGER_ROLES.has(r));
    if (!isManager) {
      setMsg("Kein Zugriff: nur Vorstand/Admin.", true);
      return;
    }

    document.getElementById("membershipAdminReload")?.addEventListener("click", () => {
      refresh().catch((err) => setMsg(err?.message || "Laden fehlgeschlagen.", true));
    });

    document.getElementById("membershipAdminExport")?.addEventListener("click", () => {
      exportApprovedMembers().catch((err) => setMsg(err?.message || "Export fehlgeschlagen.", true));
    });

    document.addEventListener("click", async (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      const saveId = target.getAttribute("data-save");
      if (saveId) {
        try {
          const qRaw = document.querySelector(`[data-q-id="${saveId}"]`)?.value || "";
          const data = parseQuestionnaire(qRaw);
          await saveQuestionnaire(saveId, data);
          setMsg("Fragebogen gespeichert.");
          await refresh();
        } catch (err) {
          setMsg(err?.message || "Speichern fehlgeschlagen.", true);
        }
        return;
      }

      const approveId = target.getAttribute("data-approve");
      if (approveId) {
        try {
          const qRaw = document.querySelector(`[data-q-id="${approveId}"]`)?.value || "";
          const data = parseQuestionnaire(qRaw);
          await saveQuestionnaire(approveId, data);
          const memberNo = document.querySelector(`[data-membership-no-id="${approveId}"]`)?.value || "";
          await approve(approveId, String(memberNo || "").trim());
          setMsg("Bewerbung genehmigt.");
          await refresh();
        } catch (err) {
          setMsg(err?.message || "Genehmigung fehlgeschlagen.", true);
        }
        return;
      }

      const rejectId = target.getAttribute("data-reject");
      if (rejectId) {
        try {
          const reason = window.prompt("Ablehnungsgrund (optional):", "") || "";
          await reject(rejectId, reason);
          setMsg("Bewerbung abgelehnt.");
          await refresh();
        } catch (err) {
          setMsg(err?.message || "Ablehnung fehlgeschlagen.", true);
        }
      }
    });

    await refresh();
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => setMsg(err?.message || "Initialisierung fehlgeschlagen.", true));
  });
})();
