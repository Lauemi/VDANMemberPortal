function envText(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

const metaEnv = (import.meta as ImportMeta & { env: Record<string, unknown> }).env;

const appName = envText(metaEnv.PUBLIC_APP_NAME, "Fishing-Club-Portal");
const appBrand = envText(metaEnv.PUBLIC_APP_BRAND, "FCP");
const appTheme = envText(metaEnv.PUBLIC_APP_THEME, "vdan_default");
const superAdminUserIds = envText(metaEnv.PUBLIC_SUPERADMIN_USER_IDS, "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const APP = {
  name: appName,
  brand: appBrand,
  theme: appTheme,
  supportEmail: envText(metaEnv.PUBLIC_SUPPORT_EMAIL, "m.lauenroth@lauemi.de"),
  superAdminUserIds,
};
