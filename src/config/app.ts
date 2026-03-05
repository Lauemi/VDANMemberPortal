function envText(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

const appName = envText(import.meta.env.PUBLIC_APP_NAME, "Fishing-Club-Portal");
const appBrand = envText(import.meta.env.PUBLIC_APP_BRAND, "FCP");
const appTheme = envText(import.meta.env.PUBLIC_APP_THEME, "fcp_tactical");
const superAdminUserIds = envText(import.meta.env.PUBLIC_SUPERADMIN_USER_IDS, "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const APP = {
  name: appName,
  brand: appBrand,
  theme: appTheme,
  supportEmail: envText(import.meta.env.PUBLIC_SUPPORT_EMAIL, "m.lauenroth@lauemi.de"),
  superAdminUserIds,
};
