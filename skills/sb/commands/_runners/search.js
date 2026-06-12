#!/usr/bin/env node
// Thin wrapper over `obsidian vault=<name> search query="..."`.
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const os = require("node:os");

const SKILL_LIB = path.join(os.homedir(), ".claude", "skills", "sb", "lib");
const { VAULT_NAME } = require(path.join(SKILL_LIB, "vault.js"));

const query = process.argv.slice(2).join(" ").trim();
if (!query) { console.error("Usage: search.js <query>"); process.exit(2); }

const r = spawnSync("obsidian", [`vault=${VAULT_NAME}`, "search", `query=${query}`, "limit=20"], {
  encoding: "utf8",
});
if (r.error) {
  console.error("obsidian CLI not found. Make sure ~/.local/bin/obsidian exists and is in PATH.");
  process.exit(1);
}
process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
process.exit(r.status || 0);
