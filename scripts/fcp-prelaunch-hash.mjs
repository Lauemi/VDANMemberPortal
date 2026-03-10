#!/usr/bin/env node
import { randomBytes, scryptSync } from "node:crypto";

const password = String(process.argv[2] || "").trim();
if (!password) {
  console.error("Usage: node scripts/fcp-prelaunch-hash.mjs \"<password>\"");
  process.exit(1);
}

const salt = randomBytes(16);
const derived = scryptSync(password, salt, 32);
const hash = `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
const cookieSecret = randomBytes(32).toString("base64url");

console.log("FCP_PRELAUNCH_PASSWORD_HASH=");
console.log(hash);
console.log("");
console.log("FCP_PRELAUNCH_COOKIE_SECRET=");
console.log(cookieSecret);
