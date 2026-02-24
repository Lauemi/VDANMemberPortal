;(() => {
  const body = document.body;
  if (!body) return;
  window.__APP_SUPABASE_URL = String(body.dataset.supabaseUrl || "").trim();
  window.__APP_SUPABASE_KEY = String(body.dataset.supabaseKey || "").trim();
  window.__APP_MEMBER_CARD_VERIFY_PUBKEY = String(body.dataset.memberCardVerifyPubkey || "").trim();
})();
