// Sanity checks before you push: npm test
const fs = require("fs");
const path = require("path");
const pub = path.join(__dirname, "..", "public");
let failed = 0;
const fail = (m) => { console.error("FAIL " + m); failed++; };

for (const f of ["modules.json", "papers.json"]) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(pub, "data", f), "utf8"));
    if (!Array.isArray(d)) fail(f + " must be an array");
    const ids = d.map((x) => x.id);
    if (new Set(ids).size !== ids.length) fail(f + " has duplicate ids");
  } catch (e) { fail(f + ": " + e.message); }
}
const html = fs.readFileSync(path.join(pub, "index.html"), "utf8");
for (const m of html.matchAll(/(?:href|src)="((?!https?:|#|data:)[^"]+)"/g)) {
  if (!fs.existsSync(path.join(pub, m[1].split("?")[0]))) fail("index.html references missing file: " + m[1]);
}
const sw = fs.readFileSync(path.join(pub, "sw.js"), "utf8");
for (const m of sw.matchAll(/"((?:[\w-]+\/)*[\w.-]+\.\w+)"/g)) {
  if (!fs.existsSync(path.join(pub, m[1]))) fail("sw.js precaches missing file: " + m[1]);
}
console.log(failed ? failed + " check(s) failed" : "All checks passed");
process.exit(failed ? 1 : 0);
