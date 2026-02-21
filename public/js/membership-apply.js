;(() => {
  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  async function sb(path, init = {}) {
    const { url, key } = cfg();
    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");
    const res = await fetch(`${url}${path}`, { ...init, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || err?.hint || err?.error_description || `Request failed (${res.status})`);
    }
    return res.json().catch(() => ({}));
  }

  function setMsg(text = "", isError = false) {
    const el = document.getElementById("membershipApplyMsg");
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? "#fecaca" : "";
  }

  function v(id) {
    return String(document.getElementById(id)?.value || "").trim();
  }

  async function submit(e) {
    e.preventDefault();
    setMsg("");

    const form = e.currentTarget;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const sepaApproved = Boolean(document.getElementById("applySepaApproved")?.checked);
      if (!sepaApproved) throw new Error("SEPA-Freigabe ist erforderlich.");

      const payload = {
        p_first_name: v("applyFirstName"),
        p_last_name: v("applyLastName"),
        p_birthdate: v("applyBirthdate"),
        p_street: v("applyStreet"),
        p_zip: v("applyZip"),
        p_city: v("applyCity"),
        p_is_local: Boolean(document.getElementById("applyIsLocal")?.checked),
        p_iban: v("applyIban"),
        p_sepa_approved: sepaApproved,
        p_fishing_card_type: v("applyFishingCardType"),
        p_known_member: v("applyKnownMember") || null,
      };

      const result = await sb("/rest/v1/rpc/submit_membership_application", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const appId = typeof result === "string" ? result : (result?.id || result);
      setMsg(`Bewerbung erfolgreich gesendet. Vorgangs-ID: ${appId || "-"}`);
      form.reset();
    } catch (err) {
      setMsg(err?.message || "Bewerbung konnte nicht gesendet werden.", true);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("membershipApplyForm");
    if (!form) return;
    form.addEventListener("submit", submit);
  });
})();
