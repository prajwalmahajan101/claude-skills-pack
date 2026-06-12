// Tag alias resolver. Loaded from <vault>/_meta/tag-aliases.json.
const path = require("node:path");
const { paths, readJSON } = require("./vault.js");

function loadAliases() {
  return readJSON(path.join(paths("_").meta, "tag-aliases.json"), {});
}

function resolveAlias(tag, aliases = null) {
  const map = aliases || loadAliases();
  const norm = String(tag).toLowerCase();
  return map[norm] ? String(map[norm]).toLowerCase() : norm;
}

module.exports = { loadAliases, resolveAlias };
