import fs from "node:fs";
import path from "node:path";
import { getFcpComponentDefinitions } from "../src/lib/fcp-component-definitions.mjs";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "docs", "fcp-components");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const definitions = getFcpComponentDefinitions();
const generatedAt = new Date().toISOString();

ensureDir(OUT_DIR);

writeJson(path.join(OUT_DIR, "index.json"), {
  generated_at: generatedAt,
  component_count: definitions.length,
  components: definitions,
});

definitions.forEach((definition) => {
  writeJson(path.join(OUT_DIR, `${definition.id}.json`), {
    generated_at: generatedAt,
    component: definition,
  });
});

console.log(`Wrote ${definitions.length} FCP component definitions to ${path.relative(ROOT, OUT_DIR)}`);
