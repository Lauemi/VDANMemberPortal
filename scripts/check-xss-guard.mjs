#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DEFAULT_FILES = [
  "public/js/home-feed.js",
  "public/js/work-events-cockpit.js",
  "public/js/work-events-member.js",
  "public/js/members-admin.js",
  "public/js/catchlist.js",
];

const SAFE_HELPER_PATTERN = /(esc\(|escapeHtml\(|htmlEsc\(|attrSafe\()/;
const TEMPLATE_SINK_PATTERN =
  /innerHTML\s*=\s*`([\s\S]*?)`\s*;|insertAdjacentHTML\([^,]+,\s*`([\s\S]*?)`\s*\)/g;

const cliFiles = process.argv.slice(2).filter(Boolean);
const files = (cliFiles.length ? cliFiles : DEFAULT_FILES).map((p) =>
  path.normalize(p)
);

const findings = [];

for (const file of files) {
  if (!fs.existsSync(file)) {
    findings.push({
      file,
      reason: "file-not-found",
      details: "Configured file is missing.",
    });
    continue;
  }

  const source = fs.readFileSync(file, "utf8");
  let match;
  while ((match = TEMPLATE_SINK_PATTERN.exec(source)) !== null) {
    const template = match[1] || match[2] || "";
    if (!template.includes("${")) continue;
    if (SAFE_HELPER_PATTERN.test(template)) continue;

    const offset = match.index;
    const line = source.slice(0, offset).split("\n").length;
    findings.push({
      file,
      reason: "unsafe-template-interpolation",
      details: `Potential unescaped HTML interpolation at line ${line}.`,
    });
  }
}

if (findings.length) {
  console.error("XSS guard failed. Review the findings:");
  for (const item of findings) {
    console.error(`- ${item.file}: ${item.reason} (${item.details})`);
  }
  process.exit(1);
}

console.log(`XSS guard passed for ${files.length} file(s).`);
