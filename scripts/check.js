// Sanity checks before you push: npm test
const fs = require("fs");
const path = require("path");
const pub = path.join(__dirname, "..", "public");
let failed = 0;
const fail = (m) => { console.error("FAIL " + m); failed++; };

for (const f of ["modules.json", "papers.json", "topics.json"]) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(pub, "data", f), "utf8"));
    if (!Array.isArray(d)) fail(f + " must be an array");
    const ids = d.map((x) => x.id);
    if (new Set(ids).size !== ids.length) fail(f + " has duplicate ids");
  } catch (e) { fail(f + ": " + e.message); }
}
// every topic reference (e.g. "B1-Q1(a)") must point at a real paper, question and part
try {
  const rd = (f) => JSON.parse(fs.readFileSync(path.join(pub, "data", f), "utf8"));
  const papers = rd("papers.json"), topics = rd("topics.json");
  const refSeen = {};
  topics.forEach((m) => m.topics.forEach((t) => t.refs.forEach((r) => {
    const x = r.match(/^([A-Za-z]\d-\d{2}-\d{2})-Q(\d+)(?:\(([a-z]+)\))?(?:\(([ivx]+)\))?$/i);
    const q = x && (papers.find((p) => p.id.toLowerCase() === x[1].toLowerCase()) || { questions: [] }).questions.find((k) => k.number === Number(x[2]));
    if (!q) return fail("topics.json " + m.id + " / " + t.topic + ": bad ref " + r);
    const key = x[3] && (x[3] + (x[4] || "")).toLowerCase(), norm = (p) => String(p.label).toLowerCase().replace(/[\s()]/g, "");
    if (key && !q.parts.some((p) => norm(p) === key || (!x[4] && /^[a-z]\s*\(/i.test(String(p.label)) && norm(p).startsWith(key)))) fail("topics.json " + r + ": no part " + key);
    refSeen[r.toLowerCase()] = (refSeen[r.toLowerCase()] || 0) + 1;
    if (refSeen[r.toLowerCase()] > 1) fail("topics.json " + r + ": listed under more than one topic");
  })));
  // every "link" on a home-page topic card must name a topic that exists in topics.json
  rd("modules.json").forEach((m) => m.priority1.concat(m.priority2).forEach((r) => {
    const t = topics.find((x) => x.id === m.id);
    if (r.link && !(t && t.topics.some((k) => k.topic === r.link))) fail("modules.json " + m.id + " / " + r.topic + ": link '" + r.link + "' not in topics.json");
  }));
} catch (e) { fail("topic refs: " + e.message); }
// every paper needs its PDF and page scans, and every {{fig:NAME}} its cropped image
try {
  JSON.parse(fs.readFileSync(path.join(pub, "data", "papers.json"), "utf8")).forEach((p) => {
    if (!fs.existsSync(path.join(pub, "papers", "pdf", p.id + ".pdf"))) fail("missing PDF for " + p.id);
    for (let n = 1; n <= p.pages; n++) if (!fs.existsSync(path.join(pub, "papers", "pages", p.id + "-" + n + ".jpg"))) fail("missing page scan " + p.id + "-" + n);
    for (const m of JSON.stringify(p).matchAll(/\{\{fig:([\w-]+)\}\}/g)) if (!fs.existsSync(path.join(pub, "papers", "fig", m[1] + ".jpg"))) fail("missing figure " + m[1]);
  });
} catch (e) { fail("papers: " + e.message); }
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
