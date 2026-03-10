function envText(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

const metaEnv = (import.meta as ImportMeta & { env: Record<string, unknown> }).env;

const appName = envText(metaEnv.PUBLIC_APP_NAME, "Fishing-Club-Portal");
const appBrand = envText(metaEnv.PUBLIC_APP_BRAND, "FCP");
const appThemeRaw = envText(metaEnv.PUBLIC_APP_THEME, "");
const siteModeRaw = envText(metaEnv.PUBLIC_SITE_MODE, "");
const siteMode = siteModeRaw.toLowerCase() === "fcp"
  ? "fcp"
  : siteModeRaw.toLowerCase() === "vdan"
    ? "vdan"
    : appThemeRaw === "fcp_tactical"
      ? "fcp"
      : appBrand.toLowerCase().includes("fcp")
        ? "fcp"
        : "vdan";
const appTheme = appThemeRaw || (siteMode === "fcp" ? "fcp_tactical" : "vdan_default");
const superAdminUserIds = envText(metaEnv.PUBLIC_SUPERADMIN_USER_IDS, "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const APP = {
  name: appName,
  brand: appBrand,
  theme: appTheme,
  supportEmail: envText(metaEnv.PUBLIC_SUPPORT_EMAIL, "m.lauenroth@lauemi.de"),
  guestLoginMessage: envText(metaEnv.PUBLIC_APP_GUEST_LOGIN_MESSAGE, "Bitte logge dich ein."),
  guestLoginCtaLabel: envText(metaEnv.PUBLIC_APP_GUEST_LOGIN_CTA_LABEL, "Zum Login"),
  siteMode,
  superAdminUserIds,
};
