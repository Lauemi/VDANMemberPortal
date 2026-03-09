;(() => {
  const body = document.body;
  if (!body) return;
  window.__APP_SUPABASE_URL = String(body.dataset.supabaseUrl || "").trim();
  window.__APP_SUPABASE_KEY = String(body.dataset.supabaseKey || "").trim();
  window.__APP_MEMBER_CARD_VERIFY_PUBKEY = String(body.dataset.memberCardVerifyPubkey || "").trim();
  window.__APP_AUTH_EMAIL_CHANGE_ENABLED = String(body.dataset.authEmailChangeEnabled || "0").trim() === "1";
  window.__APP_OPEN_SELF_REGISTRATION_ENABLED = String(body.dataset.openSelfRegistrationEnabled || "0").trim() === "1";
})();
