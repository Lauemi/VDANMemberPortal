#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const PLAYWRIGHT_IMAGE = "mcr.microsoft.com/playwright:v1.59.1-noble";
const args = process.argv.slice(2);
const playwrightArgs = args.length ? args : ["-c", "playwright.config.ts"];
const forceDocker = String(process.env.FORCE_PLAYWRIGHT_DOCKER || "").trim() === "1";

function run(cmd, cmdArgs, options = {}) {
  return spawnSync(cmd, cmdArgs, {
    stdio: "inherit",
    ...options,
  });
}

function hasDocker() {
  const probe = spawnSync("docker", ["--version"], { stdio: "ignore" });
  return probe.status === 0;
}

function isMissingHostLibError(status) {
  const stderr = String(status.stderr || "");
  const stdout = String(status.stdout || "");
  const combined = `${stdout}\n${stderr}`;
  return /error while loading shared libraries|libatk-1\.0\.so\.0/i.test(combined);
}

function runLocalPlaywright() {
  return spawnSync("npx", ["playwright", "test", ...playwrightArgs], {
    stdio: "pipe",
    encoding: "utf8",
  });
}

function printBufferedOutput(status) {
  if (status.stdout) process.stdout.write(status.stdout);
  if (status.stderr) process.stderr.write(status.stderr);
}

function runInDocker() {
  const uid = process.getuid?.() ?? 1000;
  const gid = process.getgid?.() ?? 1000;
  const workdir = process.cwd();
  const dockerCmd = [
    "run",
    "--rm",
    "--user",
    `${uid}:${gid}`,
    "-v",
    `${workdir}:${workdir}`,
    "-w",
    workdir,
    "-e",
    `PUBLIC_SUPABASE_URL=${process.env.PUBLIC_SUPABASE_URL || "https://smoke.supabase.local"}`,
    "-e",
    `PUBLIC_SUPABASE_ANON_KEY=${process.env.PUBLIC_SUPABASE_ANON_KEY || "smoke-anon-key"}`,
    PLAYWRIGHT_IMAGE,
    "bash",
    "-lc",
    `npm ci --no-audit --no-fund && npx playwright test ${playwrightArgs.map((v) => JSON.stringify(v)).join(" ")}`,
  ];
  return run("docker", dockerCmd);
}

if (forceDocker) {
  if (!hasDocker()) {
    console.error("FORCE_PLAYWRIGHT_DOCKER=1 gesetzt, aber Docker ist nicht verfuegbar.");
    process.exit(1);
  }
  const dockerResult = runInDocker();
  process.exit(dockerResult.status ?? 1);
}

const local = runLocalPlaywright();
printBufferedOutput(local);
if (local.status === 0) {
  process.exit(0);
}

if (!isMissingHostLibError(local)) {
  process.exit(local.status ?? 1);
}

console.warn("Playwright-Hostlibs fehlen lokal (z. B. libatk). Versuche Docker-Fallback...");
if (!hasDocker()) {
  console.error("Docker-Fallback nicht moeglich: Docker ist nicht verfuegbar.");
  process.exit(local.status ?? 1);
}

const dockerResult = runInDocker();
process.exit(dockerResult.status ?? 1);
