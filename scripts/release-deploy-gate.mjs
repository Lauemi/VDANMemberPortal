import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const requiredFiles = [
  "src/config/static-web-pages.ts",
  "src/config/app-mask-brand-pages.ts",
  "src/layouts/Site.astro",
  "public/js/app-brand-runtime.js",
  "public/js/member-auth.js",
  "public/js/member-registry-admin.js",
  "supabase/functions/admin-web-config/index.ts",
  "supabase/functions/club-admin-setup/index.ts",
  "supabase/functions/club-onboarding-workspace/index.ts",
];

const requiredTests = [
  "tests/site-mode-separation.test.js",
  "tests/static-web-separation.test.js",
  "tests/onboarding-security-regressions.test.js",
  "tests/smoke.test.js",
];

const functionDeployAreas = [
  "Onboarding",
  "Club-Setup",
  "Admin-Config / Brand-Overrides",
  "CORS / Request-Handling",
  "serverseitige Runtime-Config",
];

function fail(message) {
  console.error(`\n[deploy-gate] FAIL: ${message}`);
  process.exit(1);
}

function check(condition, message) {
  if (!condition) fail(message);
  console.log(`[deploy-gate] OK: ${message}`);
}

function run(command, args) {
  console.log(`\n[deploy-gate] RUN: ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} exited with code ${result.status ?? "unknown"}`);
  }
}

for (const file of requiredFiles) {
  check(existsSync(file), `${file} vorhanden`);
}

for (const testFile of requiredTests) {
  check(existsSync(testFile), `${testFile} vorhanden`);
}

const staticPages = readFileSync("src/config/static-web-pages.ts", "utf8");
check(staticPages.includes('route: "/vdan-jugend"'), "VDAN-Spezialseiten sind explizit erfasst");
check(staticPages.includes('fcp: { visible: false, brand: "vdan" }'), "VDAN-Spezialseiten bleiben im FCP-Deploy gesperrt");
check(staticPages.includes('note: "FCP = Brand-Landingpage. VDAN = Vereinsstartseite mit Feed."'), "Startseiten-Trennung ist dokumentiert");

const siteLayout = readFileSync("src/layouts/Site.astro", "utf8");
check(siteLayout.includes("Astro.response.status = 404"), "versteckte statische Seiten liefern 404");
check(siteLayout.includes("noindex,nofollow"), "versteckte statische Seiten sind noindex");

const adminConfig = readFileSync("supabase/functions/admin-web-config/index.ts", "utf8");
check(adminConfig.includes("admin_web_config:static_web_matrix"), "statische Web-Konfiguration ist serverseitig separiert");
check(adminConfig.includes("admin_web_config:app_mask_matrix"), "App-Masken-Overrides sind serverseitig separiert");
check(adminConfig.includes("scope"), "Web-Konfiguration arbeitet mit Site-Scope");

const clubSetup = readFileSync("supabase/functions/club-admin-setup/index.ts", "utf8");
check(clubSetup.includes("club_responsible_notify_rate:"), "Vereinsanlage-Mailversand ist rate-limited");
check(clubSetup.includes("responsible_email_invalid"), "Vereinsanlage validiert Verantwortlichen-Mail");

const onboardingWorkspace = readFileSync("supabase/functions/club-onboarding-workspace/index.ts", "utf8");
check(onboardingWorkspace.includes("Access-Control-Max-Age"), "Workspace-Function beantwortet CORS-Preflight robust");

console.log("\n[deploy-gate] INFO: Function-Deploy ist Pflicht bei Aenderungen in diesen Bereichen:");
for (const area of functionDeployAreas) {
  console.log(`[deploy-gate] INFO: - ${area}`);
}

run("npm", ["run", "build"]);
run("node", ["--test", ...requiredTests]);

console.log("\n[deploy-gate] PASS: Lokaler Deploy-Gate ist grün.");
console.log("[deploy-gate] NEXT: Danach remote deployen: admin-web-config, club-admin-setup, club-onboarding-workspace.");
console.log("[deploy-gate] NEXT: Anschliessend npm run check:remote-function-smoke in der Zielumgebung ausfuehren.");
