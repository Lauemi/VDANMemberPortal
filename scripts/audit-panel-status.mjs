#!/usr/bin/env node
// audit-panel-status.mjs
// Prüft pro Panel den Ist-Zustand aus ADM_clubSettings.json gegen den definierten Soll-Zustand.
// Liest über fcp-mask-reader.mjs – keine Browser, keine API-Calls, keine neuen Dependencies.
//
// Ausführen: node scripts/audit-panel-status.mjs

import { readMaskJsonFile } from "./fcp-mask-reader.mjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MASK_PATH = path.resolve(__dirname, "../docs/masks/templates/Onboarding/ADM_clubSettings.json");

// Soll-Zustand pro Panel-ID.
// loadKind / saveKind sind optional – wenn nicht angegeben, wird nur panelState geprüft.
const EXPECTED = {
  club_settings_request_audit:               { panelState: "live",    loadKind: "rpc" },
  club_settings_onboarding_snapshot:         { panelState: "live",    loadKind: "edge_function" },
  club_settings_club_master_data:            { panelState: "live",    loadKind: "edge_function", saveKind: "edge_function" },
  club_settings_members_registry:            { panelState: "live",    loadKind: "rpc" },
  club_settings_waters_table:                { panelState: "live",    loadKind: "edge_function" },
  club_settings_cards_table:                 { panelState: "partial", loadKind: "rpc" },
  club_settings_invite_create:               { panelState: "partial", loadKind: "local_only", saveKind: "edge_function" },
  club_settings_process_context:             { panelState: "preview" },
  club_settings_route_contract:              { panelState: "preview" },
  club_settings_club_approvals_inline_preview: { panelState: "preview" },
  club_settings_roles_backend_contract:      { panelState: "gap" },
  club_settings_rules_table:                 { panelState: "gap" },
  club_settings_work_helpers_table:          { panelState: "gap" },
  club_settings_approvals_table:             { panelState: "gap" },
  club_settings_settings_qfm:                { panelState: "gap" },
};

// Leitet panelState aus dem normalisierten Panel ab – identisch zu resolvePanelSurfaceState im Runtime.
function derivePanelState(panel) {
  const explicit = panel.meta?.panelState;
  if (explicit) return explicit;
  const loadKind = panel.loadBinding?.kind || "local_only";
  const sourceOfTruth = panel.meta?.sourceOfTruth || "json";
  if (loadKind === "local_only") {
    return (sourceOfTruth === "sql" || sourceOfTruth === "edge") ? "preview" : "gap";
  }
  return "live";
}

function collectPanels(config) {
  const panels = [];
  for (const section of config.sections || []) {
    for (const panel of section.panels || []) {
      panels.push(panel);
    }
  }
  return panels;
}

function pad(str, len) {
  return str + " ".repeat(Math.max(0, len - str.length));
}

async function main() {
  let config;
  try {
    config = await readMaskJsonFile(MASK_PATH);
  } catch (err) {
    console.error(`Fehler beim Lesen der Masken-Datei: ${err.message}`);
    process.exit(1);
  }

  const panels = collectPanels(config);
  const panelMap = Object.fromEntries(panels.map((p) => [p.id, p]));

  let pass = 0;
  let fail = 0;
  const failLines = [];

  for (const [panelId, expected] of Object.entries(EXPECTED)) {
    const panel = panelMap[panelId];
    if (!panel) {
      fail++;
      const line = `❌ FAIL  ${pad(panelId, 44)} Panel nicht gefunden in Masken-Datei`;
      console.log(line);
      failLines.push(line);
      continue;
    }

    const actualState = derivePanelState(panel);
    const actualLoadKind = panel.loadBinding?.kind || null;
    const actualSaveKind = panel.saveBinding?.kind || null;

    const checks = [];
    if (expected.panelState && actualState !== expected.panelState) {
      checks.push(`panelState erwartet: ${expected.panelState} | ist: ${actualState}`);
    }
    if (expected.loadKind && actualLoadKind !== expected.loadKind) {
      checks.push(`loadKind erwartet: ${expected.loadKind} | ist: ${actualLoadKind}`);
    }
    if (expected.saveKind && actualSaveKind !== expected.saveKind) {
      checks.push(`saveKind erwartet: ${expected.saveKind} | ist: ${actualSaveKind}`);
    }

    if (checks.length === 0) {
      pass++;
      const kindInfo = [actualState, actualLoadKind, expected.saveKind ? actualSaveKind : null]
        .filter(Boolean).join(" / ");
      console.log(`✅ PASS  ${pad(panelId, 44)} ${kindInfo}`);
    } else {
      fail++;
      const line = `❌ FAIL  ${pad(panelId, 44)} ${checks.join("; ")}`;
      console.log(line);
      failLines.push(line);
    }
  }

  const total = pass + fail;
  console.log(`\n--- SUMMARY ---`);
  console.log(`${pass}/${total} Panels im Soll-Zustand`);
  if (fail > 0) {
    console.log(`${fail} Abweichung${fail === 1 ? "" : "en"}`);
  }

  if (fail > 0) process.exit(1);
}

main();
