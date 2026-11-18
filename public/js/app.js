// Frontend logic: loads data from the backend API, then renders the cloud view (modules m1-m8)
// and the FAT view (papers A1, A2, F1, G1, G2). Routing uses the URL hash: #m3, #fat-g1.
import { Api } from "./api.js";

const tabsEl = document.getElementById("tabs");
const bodyEl = document.getElementById("body");
const titleEl = document.getElementById("title");
const backEl = document.getElementById("back");

const topicEl = document.getElementById("topicBtn");
const fatEl = document.getElementById("fatBtn");
const extEl = document.getElementById("extBtn");
const topEl = document.querySelector(".top");
const impEl = document.getElementById("impBtn");
const distrEl = document.getElementById("distrBtn");
const heroEl = document.getElementById("hero");
const tabsRowEl = document.getElementById("tabsRow");
const scrollEl = document.getElementById("scroll");
const themeBtn = document.getElementById("theme");
const q = document.getElementById("q");
const countEl = document.getElementById("count");
const rootEl = document.documentElement;
function setCount(n, term) {
  countEl.hidden = !term;
  countEl.textContent = n + (n === 1 ? " result" : " results");
}

let READY = false;
let MODS = [];
let PAPERS = [];
let TOPICS = [];
let pendingQ = null;
let curT = 0;
let view = "cloud";
let cur = 0;
let curP = 0;
let builtView = "";
let sel = -1;             // J/K: index of the highlighted topic card

/* ---------- helpers ---------- */
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function priorityClass(p) {
  return p === "Very High" ? "vh" : p === "High" ? "hi" : "md";
}
function moduleTitle(id) {
  const m = MODS.find((x) => x.id === id);
  return m ? m.title : id;
}

/* ---------- progress (saved in this browser) ---------- */
let DONE = {};
try { DONE = JSON.parse(localStorage.getItem("dbms-done") || "{}"); } catch (e) {}
let MODE = "view";
try { MODE = localStorage.getItem("dbms-mode") === "study" ? "study" : "view"; } catch (e) {}
document.documentElement.setAttribute("data-mode", MODE);
const isDone = (k) => MODE === "study" && !!DONE[k];
const attr = (s) => esc(s).replace(/"/g, "&quot;");
const topicKey = (mid, r) => "t:" + mid + ":" + r.topic;
function toggleDone(k) {
  if (DONE[k]) delete DONE[k]; else DONE[k] = 1;
  save();
}
function save() { try { localStorage.setItem("dbms-done", JSON.stringify(DONE)); } catch (e) {} }
/* Question ticks are stored per part (q:paper:1:a). The FAT paper page and the topic-wise cards both read/write those same part keys,
   so ticking a whole question there ticks every part here, and ticking every part here ticks the question there. A legacy whole-question key counts as all parts done. */
const partNorm = (p) => String(p.label).toLowerCase().replace(/[\s()]/g, "");
const leafKeys = (id, q, parts) => (q.parts && q.parts.length ? (parts || q.parts).map((p) => "q:" + id + ":" + q.number + ":" + partNorm(p)) : ["q:" + id + ":" + q.number]);
const baseKey = (id, q) => "q:" + id + ":" + q.number;
const leavesDone = (leaves, base) => MODE === "study" && leaves.length > 0 && leaves.every((k) => DONE[k] || DONE[base]);
function toggleLeaves(leaves, base, allLeaves) {
  const on = leaves.every((k) => DONE[k] || DONE[base]);
  if (DONE[base] && allLeaves.length && allLeaves[0] !== base) { allLeaves.forEach((k) => (DONE[k] = 1)); delete DONE[base]; }
  leaves.forEach((k) => { if (on) delete DONE[k]; else DONE[k] = 1; });
  save();
}
function refreshQ() {
  bodyEl.querySelectorAll("[data-leaves]").forEach((b) => {
    const lv = b.getAttribute("data-leaves").split(","), on = leavesDone(lv, b.getAttribute("data-base"));
    b.setAttribute("aria-pressed", String(on));
    const card = b.closest(".q");
    if (card) card.classList.toggle("done", on);
  });
}
function overallCard() {
  let total = 0, done = 0, bars = "";
  MODS.forEach((m) => {
    const all = m.priority1.concat(m.priority2);
    const d = all.filter((r) => isDone(topicKey(m.id, r))).length;
    total += all.length; done += d;
    bars += '<a class="ov-b" href="#' + m.id + '" data-go="' + m.id + '"><span>' + m.id.toUpperCase() + "</span><i><u style=\"width:" + Math.round((d / all.length) * 100) + '%"></u></i></a>';
  });
  const C = 2 * Math.PI * 30, pct = total ? done / total : 0;
  return '<div class="overall"><div class="ring"><svg width="72" height="72" viewBox="0 0 72 72" fill="none" stroke-width="7" stroke-linecap="round"><circle class="t" cx="36" cy="36" r="30"/><circle class="p" cx="36" cy="36" r="30" stroke-dasharray="' + (pct * C).toFixed(1) + " " + C.toFixed(1) + '"/></svg><b>' + Math.round(pct * 100) + '%</b></div><div class="ov-t"><span>Topics done</span><strong>' + done + " / " + total + '</strong></div><div class="ov-m">' + bars + "</div></div>";
}

/* Ticking a topic / question updates just that card and the progress widgets, so the page does not re-render or re-animate. */
function applyDone(btn) {
  const key = btn.getAttribute("data-done"), on = !!DONE[key];
  bodyEl.querySelectorAll("[data-done]").forEach((b) => {
    if (b.getAttribute("data-done") !== key) return;
    b.setAttribute("aria-pressed", String(on));
    const card = b.closest(".tc, .q");
    if (card) card.classList.toggle("done", on);
  });
  if (view !== "cloud" || !MODS[cur]) return;
  const t = document.createElement("div");
  t.innerHTML = overallCard();
  const o = bodyEl.querySelector(".overall");
  if (o) {
    const set = (sel, fn) => { const a = o.querySelectorAll(sel), b = t.querySelectorAll(sel); a.forEach((el, i) => b[i] && fn(el, b[i])); };
    set(".ring circle.p", (a, b) => a.setAttribute("stroke-dasharray", b.getAttribute("stroke-dasharray")));
    set(".ring b", (a, b) => (a.textContent = b.textContent));
    set(".ov-t strong", (a, b) => (a.textContent = b.textContent));
    set(".ov-b u", (a, b) => (a.style.width = b.style.width));
  }
  const m = MODS[cur], all = m.priority1.concat(m.priority2);
  const dn = all.filter((r) => isDone(topicKey(m.id, r))).length;
  const pill = bodyEl.querySelector(".pill.study-only");
  if (pill) pill.textContent = dn + " / " + all.length + " done";
  const bar = bodyEl.querySelector(".bar i");
  if (bar) bar.style.width = Math.round((dn / all.length) * 100) + "%";
}

/* ---------- cloud view ---------- */
function topicTable(rows, plain, mid) {
  let h = '<div class="tg">';
  rows.forEach((r) => {
    const k = topicKey(mid, r);
    h += '<article class="tc' + (isDone(k) ? " done" : "") + '"><button class="chk" type="button" data-done="' + attr(k) + '" aria-pressed="' + isDone(k) + '" aria-label="Mark ' + attr(r.topic) + ' as done"></button>' + (plain ? "" : '<span class="pr ' + priorityClass(r.priority) + '">' + esc(r.priority) + "</span>") + "<h3 class=\"tc-t\">" + (r.link ? '<a class="tc-lk" href="#topic-' + mid + '" data-tl="' + attr(mid + "|" + r.link) + '" title="View questions on this topic">' + esc(r.topic) + "<i>→</i></a>" : esc(r.topic)) + '</h3><p class="tc-i">' + esc(r.importance) + "</p></article>";
  });
  return h + "</div>";
}
function filterTopics(rows, term) {
  if (!term) return rows;
  return rows.filter((r) => (r.topic + " " + r.importance + " " + r.priority).toLowerCase().includes(term));
}
function marksStrip(bare) {
  if (!MODS.some((x) => x.marks)) return "";
  const big = MODS.filter((x) => x.marks >= 20);
  let h = '<div class="marks" aria-label="Marks distribution"><div class="marks-head">Marks distribution</div><div class="marks-grid">';
  MODS.forEach((x, i) => {
    h += '<a class="mk' + (x.marks >= 20 ? " big" : "") + (!bare && i === cur ? " on" : "") + '" href="#' + x.id + '" data-go="' + x.id + '" title="' + esc(x.title) + '"><b>' + x.id.toUpperCase() + "</b><span>" + x.marks + "</span></a>";
  });
  h += "</div>";
  if (big.length && !bare) h += '<p class="marks-note">Modules ' + big.map((x) => x.id.slice(1)).join(", ") + " carry 20 marks, the rest carry 10.</p>";
  return h + "</div>";
}
function renderCloud(term) {
  delete bodyEl.dataset.paper;
  if (!MODS.length) {
    countEl.hidden = true;
    const first = PAPERS.length ? PAPERS[0].id.toLowerCase() : "b1";
    bodyEl.innerHTML = "<h1>Module-wise priorities</h1><p class=\"sub\">Module topics, marks and priorities for this subject will appear here.</p><p class=\"none\">Coming soon. Nothing has been added yet.</p><p class=\"note\"><a class=\"mchip\" href=\"#fat-" + first + "\" data-go=\"fat-" + first + "\">Open the FAT papers</a></p>";
    return;
  }
  const m = MODS[cur];
  const plain = !!m.plain;
  const allT = m.priority1.concat(m.priority2);
  const dn = allT.filter((r) => isDone(topicKey(m.id, r))).length;
  const a = filterTopics(plain ? m.priority1.concat(m.priority2) : m.priority1, term);
  const b = plain ? [] : filterTopics(m.priority2, term);
  let h = marksStrip() + overallCard();
  h += "<h1>" + m.id.toUpperCase() + " – " + esc(m.title) + "</h1>";
  h += '<div class="stat">' + (m.marks ? '<span class="pill marks-pill' + (m.marks >= 20 ? " big" : "") + '">' + m.marks + " marks</span>" : "") + (plain ? '<span class="pill">' + (m.priority1.length + m.priority2.length) + " topics</span>" : '<span class="pill">' + m.priority1.length + ' must prepare</span><span class="pill">' + m.priority2.length + " important</span>") + '<span class="pill study-only">' + dn + " / " + allT.length + ' done</span></div><div class="bar"><i style="width:' + Math.round((dn / allT.length) * 100) + '%"></i></div>';
  if (a.length) h += (plain ? "" : '<span class="chip p1">Priority 1 – Must prepare</span>') + (plain ? '<div style="height:var(--s2)"></div>' : "") + topicTable(a, plain, m.id);
  if (b.length) h += '<span class="chip p2">Priority 2 – Important</span>' + topicTable(b, false, m.id);
  if (!a.length && !b.length) h += '<p class="none">No topics in ' + m.id.toUpperCase() + " match “" + esc(q.value.trim()) + "”.</p>";
  if (m.note) h += '<p class="note">' + esc(m.note) + "</p>";
  setCount(a.length + b.length, term);
  bodyEl.innerHTML = h;
  markTabs(cur);
}

/* ---------- FAT view ---------- */
function questionText(question) {
  return question.parts
    .map((p) => [String(p.text).replace(/\{\{fig:[\w-]+\}\}/g, " "), p.co, p.bl, (p.modules || []).join(" ")].join(" "))
    .join(" ")
    .toLowerCase();
}
function matchQuestion(question, term) {
  const m = term.match(/^q\.?\s*(\d+)$/);
  if (m) return question.number === Number(m[1]);
  if (/^\d+$/.test(term) && question.number === Number(term)) return true;
  return questionText(question).includes(term);
}
const imgSrc = (kind, name) => "papers/" + kind + "/" + name + ".jpg";
const pdfSrc = (id) => "papers/pdf/" + id + ".pdf";
/* Double-click a paper tab to open the original PDF in a new tab. */
function openPdf(id) {
  const w = window.open("about:blank", "_blank");
  const u = pdfSrc(id);
  if (w) w.location.href = u; else window.location.href = u;
}
/* Question text keeps the paper's own line breaks; {{fig:NAME}} drops in the exact diagram cut from the paper. */
function richText(text, label) {
  const segs = String(text).split(/\{\{fig:([\w-]+)\}\}/);
  let h = "", pending = label ? '<span class="pl">' + esc(label) + "</span>" : "";
  segs.forEach((seg, i) => {
    if (i % 2) {
      if (pending) { h += "<p>" + pending + "</p>"; pending = ""; }
      h += '<figure class="fig"><img src="' + imgSrc("fig", seg) + '" alt="Figure from the question paper" loading="lazy" decoding="async"></figure>';
    } else {
      const s = seg.replace(/^\n+|\n+$/g, "");
      s.split(/(?:^|\n)((?:\|[^\n]*(?:\n|$))+)/).forEach((c, k) => {
        if (k % 2) {
          const rows = c.trim().split("\n").map((r) => r.replace(/^\||\|$/g, "").split("|").map((x) => x.trim()));
          h += '<div class="qt-wrap"><table class="qt"><thead><tr>' + rows[0].map((x) => "<th>" + esc(x) + "</th>").join("") + "</tr></thead><tbody>" + rows.slice(1).map((r) => "<tr>" + r.map((x) => "<td>" + esc(x) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
        } else if (c.trim()) { h += "<p>" + pending + esc(c.replace(/^\n+|\n+$/g, "")) + "</p>"; pending = ""; }
      });
    }
  });
  return pending ? "<p>" + pending + "</p>" : h;
}
function paperBtn(pid, label, a, cls) {
  return '<button type="button" class="paper-open' + (cls ? " " + cls : "") + '" data-pv="' + esc(pid) + "|" + a.pg + "|" + a.y + "|" + esc(label) + '" title="Open the original paper at this question">paper</button>';
}
function partHtml(p, chip) {
  let h = '<div class="part">' + richText(p.text, p.label) + '<div class="meta">';
  if (p.co) h += '<span class="tag">' + esc(p.co) + "</span>";
  if (p.bl) h += '<span class="tag">' + esc(p.bl) + "</span>";
  if (p.marks) h += '<span class="tag">' + esc(p.marks) + " marks</span>";
  (p.modules || []).forEach((k) => {
    h += '<a class="mchip" href="#' + k + '" data-go="' + k + '" title="' + esc(moduleTitle(k)) + '">' + k + "</a>";
  });
  if (chip) h += paperBtn(chip.pid, chip.label, chip.a);
  return h + "</div></div>";
}
function renderFat(term) {
  const p = PAPERS[curP];
  if (!p) {
    countEl.hidden = true;
    delete bodyEl.dataset.paper;
    bodyEl.innerHTML = '<h1>FAT question papers</h1><p class="sub">Question papers for this subject will appear here.</p><p class="none">Coming soon. Nothing has been added yet.</p>';
    return;
  }
  bodyEl.dataset.paper = p.id.toLowerCase();
  let h = "";
  let list = "";
  let shown = 0;
  p.questions.forEach((question) => {
    if (term && !matchQuestion(question, term)) return;
    shown++;
    const pid = p.id.toLowerCase(), lv = leafKeys(pid, question), bk = baseKey(pid, question), qd = leavesDone(lv, bk);
    list += '<li class="q' + (qd ? " done" : "") + '" data-qn="' + question.number + '"><button class="qn" type="button" data-leaves="' + lv.join(",") + '" data-base="' + bk + '" data-all="' + lv.join(",") + '" aria-pressed="' + qd + '" aria-label="Mark question ' + question.number + ' as solved">' + question.number + '</button><div class="qb">';
    question.parts.forEach((part, j) => {
      if (j > 0 && !part.and) list += '<div class="or">OR</div>';
      const anchor = part.pg ? part : j === 0 ? question : null;
      list += partHtml(part, anchor ? { pid: p.id, label: "Q" + question.number + (part.label ? "(" + part.label + ")" : ""), a: anchor } : null);
    });
    list += "</div></li>";
  });
  if (shown) h += '<ol class="qs">' + list + "</ol>";
  else h += '<p class="none">No questions in ' + esc(p.id) + " match “" + esc(q.value.trim()) + "”.</p>";
  setCount(shown, term);
  bodyEl.innerHTML = h;
  markTabs(curP);
}

/* ---------- original-paper viewer: opens over the page, scrolled to the question ---------- */
let pvEl = null, pvState = null;
function pvBuild() {
  pvEl = document.createElement("div");
  pvEl.className = "pv"; pvEl.hidden = true;
  pvEl.innerHTML = '<div class="pv-panel" role="dialog" aria-modal="true" aria-label="Original question paper">' +
    '<div class="pv-bar"><span class="pv-title"></span><button type="button" class="pv-btn" data-pvs="-1" aria-label="Previous page">&larr;</button><span class="pv-pg"></span><button type="button" class="pv-btn" data-pvs="1" aria-label="Next page">&rarr;</button><button type="button" class="pv-btn pv-x" aria-label="Close paper">&times;</button></div>' +
    '<div class="pv-scroll"><div class="pv-page"><img alt="Scanned question paper page" decoding="async"><span class="pv-mark"></span></div></div></div>';
  document.body.appendChild(pvEl);
  pvEl.addEventListener("click", (e) => {
    if (e.target === pvEl || e.target.closest(".pv-x")) { pvClose(); return; }
    const s = e.target.closest("[data-pvs]");
    if (s) pvStep(Number(s.getAttribute("data-pvs")));
  });
  pvEl.querySelector("img").addEventListener("load", pvPlace);
}
function pvOpen() { return !!pvEl && !pvEl.hidden; }
function pvShow() {
  const s = pvState, paper = PAPERS.find((p) => p.id === s.pid);
  const img = pvEl.querySelector("img"), mark = pvEl.querySelector(".pv-mark");
  pvEl.querySelector(".pv-title").textContent = s.pid + " · " + s.label;
  pvEl.querySelector(".pv-pg").textContent = "page " + s.pg + " / " + paper.pages;
  pvEl.querySelector('[data-pvs="-1"]').disabled = s.pg <= 1;
  pvEl.querySelector('[data-pvs="1"]').disabled = s.pg >= paper.pages;
  mark.hidden = s.y == null; mark.textContent = s.label.split("(")[0];
  img.src = imgSrc("pages", s.pid + "-" + s.pg);
  if (img.complete && img.naturalHeight) pvPlace();
  else pvEl.querySelector(".pv-scroll").scrollTop = 0;
}
function pvPlace() {
  const s = pvState; if (!s) return;
  const sc = pvEl.querySelector(".pv-scroll"), img = pvEl.querySelector("img");
  if (s.y == null) { sc.scrollTop = 0; return; }
  const y = s.y * img.clientHeight;
  pvEl.querySelector(".pv-mark").style.top = y + "px";
  sc.scrollTop = Math.max(0, y - 80);
}
function openPaper(spec) {
  const a = spec.split("|");
  if (!pvEl) pvBuild();
  pvState = { pid: a[0], pg: Number(a[1]), y: Number(a[2]), label: a[3] };
  pvEl.hidden = false; document.documentElement.classList.add("pv-lock");
  pvShow();
  pvEl.querySelector(".pv-x").focus();
}
function pvStep(d) {
  const paper = PAPERS.find((p) => p.id === pvState.pid), n = pvState.pg + d;
  if (n < 1 || n > paper.pages) return;
  pvState = { pid: pvState.pid, pg: n, y: null, label: pvState.label.split("(")[0] };
  pvShow();
}
function pvClose() { pvEl.hidden = true; document.documentElement.classList.remove("pv-lock"); }

/* ---------- topic-wise view: module -> topics -> the exact problems asked ---------- */
function resolveRef(ref) {
  const m = String(ref).match(/^([A-Za-z]\d-\d{2}-\d{2})-Q(\d+)(?:\(([a-z]+)\))?(?:\(([ivx]+)\))?$/i);
  if (!m) return null;
  const paper = PAPERS.find((p) => p.id.toLowerCase() === m[1].toLowerCase());
  const question = paper && paper.questions.find((x) => x.number === Number(m[2]));
  if (!question) return null;
  let parts = question.parts;
  if (m[3]) {
    const key = (m[3] + (m[4] || "")).toLowerCase(), norm = (p) => String(p.label).toLowerCase().replace(/[\s()]/g, "");
    let hit = parts.filter((p) => norm(p) === key);
    if (!hit.length && !m[4]) hit = parts.filter((p) => /^[a-z]\s*\(/i.test(String(p.label)) && norm(p).startsWith(key));
    if (hit.length) parts = hit;
  }
  return { paper, question, parts, label: "Q" + m[2] + (m[3] ? "(" + m[3].toLowerCase() + ")" : "") + (m[4] ? "(" + m[4].toLowerCase() + ")" : "") };
}
function topicProblems(t) {
  const seen = new Set(), out = [];
  t.refs.forEach((r) => {
    const x = resolveRef(r);
    if (!x || seen.has(r.toLowerCase())) return;
    seen.add(r.toLowerCase());
    out.push(x);
  });
  return out;
}
function problemHtml(x) {
  const id = x.paper.id.toLowerCase();
  const lv = leafKeys(id, x.question, x.parts), allLv = leafKeys(id, x.question), bk = baseKey(id, x.question), qd = leavesDone(lv, bk);
  let h = '<li class="q' + (qd ? " done" : "") + '" data-paper="' + id + '"><button class="qn" type="button" data-leaves="' + lv.join(",") + '" data-base="' + bk + '" data-all="' + allLv.join(",") + '" aria-pressed="' + qd + '" aria-label="Mark question ' + x.question.number + ' as solved">' + x.question.number + '</button><div class="qb"><div class="pb-h"><span class="pb-ref">' + esc(x.paper.id) + " · " + esc(x.label) + '</span>' + paperBtn(x.paper.id, x.label, x.parts[0].pg ? x.parts[0] : x.question, "pb-paper") + '<a class="mchip pb-open" href="#fat-' + id + '" data-go="fat-' + id + '" data-q="' + x.question.number + '">Open</a></div>';
  x.parts.forEach((part, j) => {
    if (j > 0 && !part.and) h += '<div class="or">OR</div>';
    h += partHtml(part);
  });
  return h + "</div></li>";
}
function allProblems(m) {
  const out = [], seen = new Set();
  m.topics.forEach((t) => topicProblems(t).forEach((x) => {
    const k = x.paper.id + ":" + x.question.number + ":" + x.parts.map((p) => p.label).join(",");
    if (!seen.has(k)) { seen.add(k); out.push(x); }
  }));
  const whole = new Set(out.filter((x) => x.parts.length === x.question.parts.length).map((x) => x.paper.id + x.question.number));
  return out
    .filter((x) => x.parts.length === x.question.parts.length || !whole.has(x.paper.id + x.question.number))
    .sort((a, b) => PAPERS.indexOf(a.paper) - PAPERS.indexOf(b.paper) || a.question.number - b.question.number);
}
const SEL = {};
/* A topic card on the home page opens that topic in the topic-wise view ("m2|A* Search"). */
function openTopic(ref) {
  const [mid, name] = ref.split("|");
  const m = TOPICS.find((x) => x.id === mid);
  if (!m) return;
  const i = m.topics.findIndex((t) => t.topic === name);
  if (i !== -1) SEL[mid] = i;
  q.value = "";
  go("topic-" + mid);
}
function selectTopic(v) {
  SEL[TOPICS[curT].id] = v;
  render();
  const t = bodyEl.querySelector(".tchip[aria-selected=true]");
  if (t && t.scrollIntoView) t.scrollIntoView({ block: "nearest", behavior: "auto" });
}
/* Left / Right arrow keys on the topic-wise view: previous / next topic (starts at All). */
function topicStep(dir) {
  const chips = Array.from(bodyEl.querySelectorAll("[data-tsel]"));
  const i = chips.findIndex((c) => c.getAttribute("aria-selected") === "true");
  const n = chips[i + dir];
  if (n) selectTopic(Number(n.dataset.tsel));
}
function renderTopic(term) {
  delete bodyEl.dataset.paper;
  const m = TOPICS[curT];
  if (!m) { countEl.hidden = true; bodyEl.innerHTML = '<h1>Topic-wise</h1><p class="none">No topic-wise data yet.</p>'; return; }
  const mod = MODS.find((x) => x.id === m.id) || { title: "", marks: 0 };
  const all = m.topics.map((t, i) => ({ t, i, probs: topicProblems(t) }));
  const rows = all.filter((e) => !term || (e.t.topic + " " + e.t.refs.join(" ") + " " + e.probs.map((x) => x.parts.map((p) => p.text).join(" ")).join(" ")).toLowerCase().includes(term));
  let h = "<h1>" + m.id.toUpperCase() + " – " + esc(mod.title) + "</h1>";
  const marksPill = mod.marks ? '<span class="pill marks-pill' + (mod.marks >= 20 ? " big" : "") + '">' + mod.marks + " marks</span>" : "";
  if (!rows.length) {
    h += '<div class="stat">' + marksPill + "</div>";
    h += '<p class="none">No topics in ' + m.id.toUpperCase() + " match “" + esc(q.value.trim()) + "”.</p>";
    setCount(0, term); bodyEl.innerHTML = h; markTabs(curT); return;
  }
  const isAll = SEL[m.id] === undefined || SEL[m.id] === -1 || !rows.some((e) => e.i === SEL[m.id]);
  const sel = isAll ? null : rows.find((e) => e.i === SEL[m.id]);
  let probs;
  if (sel) probs = sel.probs;
  else {
    const keep = new Set(rows.map((e) => e.t));
    probs = allProblems({ topics: m.topics.filter((t) => keep.has(t)) });
  }
  const nAll = sel ? allProblems({ topics: rows.map((e) => e.t) }).length : probs.length;
  h += '<div class="stat" role="tablist">' + marksPill + '<button type="button" role="tab" class="tchip all" data-tsel="-1" aria-selected="' + isAll + '">All<i>' + nAll + "</i></button></div>";
  h += '<div class="tchips" role="tablist" aria-label="Topics">';
  rows.forEach((e) => {
    h += '<button type="button" role="tab" class="tchip" data-tsel="' + e.i + '" aria-selected="' + (e === sel) + '">' + esc(e.t.topic) + "<i>" + e.probs.length + "</i></button>";
  });
  h += "</div>";
  h += '<div class="tsel"><h2>' + (sel ? esc(sel.t.topic) : "All topics") + '</h2><span class="pill">' + probs.length + (probs.length === 1 ? " question" : " questions") + "</span></div>";
  h += probs.length ? '<ol class="qs tq">' + probs.map(problemHtml).join("") + "</ol>" : '<p class="none">No questions are mapped to ' + (sel ? "this topic" : "these topics") + " yet.</p>";
  setCount(rows.length, term);
  bodyEl.innerHTML = h;
  markTabs(curT);
}

/* ---------- distr view: marks distribution ---------- */
function renderDistr() {
  let list = "";
  MODS.forEach((x) => { if (x.marks) list += "<p>" + x.id.toUpperCase() + " - " + x.marks + "</p>"; });
  bodyEl.innerHTML = "<h1>Distribution</h1>" + marksStrip(true) + '<div class="imp-list">' + list + "</div>";
}

/* ---------- imp view: two pictures, swipe or arrows ---------- */
const IMP_IMGS = ["img/imp1.jpg", "img/imp2.jpg"];
function renderImp() {
  let slides = "", dots = "";
  IMP_IMGS.forEach((src, n) => {
    slides += '<div class="imp-slide"><img src="' + src + '" alt="Important notes, page ' + (n + 1) + '" draggable="false"></div>';
    dots += '<button type="button" class="imp-dot" data-i="' + n + '" aria-label="Picture ' + (n + 1) + '"></button>';
  });
  bodyEl.innerHTML = "<h1>Important</h1>" +
    '<div class="imp-wrap"><div class="imp-car" tabindex="0" aria-label="Important notes pictures">' + slides + "</div>" +
    '<div class="imp-nav"><button type="button" class="icon-btn imp-prev" aria-label="Previous picture">&#8249;</button>' + dots +
    '<button type="button" class="icon-btn imp-next" aria-label="Next picture">&#8250;</button></div></div>';
  const car = bodyEl.querySelector(".imp-car");
  const ds = bodyEl.querySelectorAll(".imp-dot");
  const step = () => car.clientWidth + 16;
  const idx = () => Math.max(0, Math.min(IMP_IMGS.length - 1, Math.round(car.scrollLeft / step())));
  const sync = () => ds.forEach((d, n) => d.classList.toggle("on", n === idx()));
  const to = (n) => car.scrollTo({ left: Math.max(0, Math.min(IMP_IMGS.length - 1, n)) * step(), behavior: "smooth" });
  car.addEventListener("scroll", sync, { passive: true });
  ds.forEach((d) => { d.onclick = () => to(+d.dataset.i); });
  bodyEl.querySelector(".imp-prev").onclick = () => to(idx() - 1);
  bodyEl.querySelector(".imp-next").onclick = () => to(idx() + 1);
  car.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); to(idx() - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); to(idx() + 1); }
  });
  sync();
}

/* ---------- keyboard: J/K topics, arrows modules ---------- */
function paintSel(scroll) {
  const cards = bodyEl.querySelectorAll(".tg .tc");
  cards.forEach((c, i) => c.classList.toggle("sel", i === sel));
  if (scroll && cards[sel]) cards[sel].scrollIntoView({ block: "center", behavior: STILL ? "auto" : "smooth" });
}
function moveTopic(d) {
  const n = bodyEl.querySelectorAll(".tg .tc").length;
  if (!n) return;
  sel = sel < 0 ? (d > 0 ? 0 : n - 1) : Math.max(0, Math.min(n - 1, sel + d));
  paintSel(true);
}
function moveTab(d) {
  const n = view === "fat" ? PAPERS.length : MODS.length;
  const i = view === "fat" ? curP : cur;
  const j = i + d;
  if (j < 0 || j >= n) return;
  go(view === "fat" ? "fat-" + PAPERS[j].id.toLowerCase() : MODS[j].id);
}
function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const el = document.activeElement || {};
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName || "") || el.isContentEditable) return;
  if (!READY || pvOpen()) return;
  const k = e.key.toLowerCase();
  if (view === "topic" && !e.shiftKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) { e.preventDefault(); topicStep(e.key === "ArrowRight" ? 1 : -1); return; }
  if (view === "cloud" || view === "fat") {
    if (e.key === "ArrowRight") { e.preventDefault(); moveTab(1); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); moveTab(-1); return; }
  }
  if (view === "cloud" && (k === "j" || k === "k")) { e.preventDefault(); moveTopic(k === "j" ? 1 : -1); return; }
}

/* ---------- fluid tabs: sliding active + hover pills ---------- */
const STILL = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let pillAct, pillHov;
const tabList = () => Array.from(tabsEl.querySelectorAll(".tab"));
function placePill(p, t, instant) {
  if (!p || !t) return;
  if (instant) p.style.transition = "none";
  p.style.width = t.offsetWidth + "px";
  p.style.transform = "translateX(" + t.offsetLeft + "px)";
  if (instant) { void p.offsetWidth; p.style.transition = ""; }
}
function markTabs(idx) {
  const tabs = tabList();
  tabs.forEach((t, i) => t.setAttribute("aria-selected", i === idx ? "true" : "false"));
  const t = tabs[idx];
  if (!t || !pillAct) return;
  const first = !pillAct.dataset.ready;
  pillAct.style.setProperty("--pc", t.dataset.paper ? getComputedStyle(t).getPropertyValue("--pc") : "");
  pillAct.classList.toggle("paper", !!t.dataset.paper);
  placePill(pillAct, t, first || STILL);
  pillAct.dataset.ready = "1";
  pillAct.style.opacity = "1";
  if (t.scrollIntoView) t.scrollIntoView({ inline: "center", block: "nearest", behavior: STILL ? "auto" : "smooth" });
}
function initTabFx() {
  tabsEl.addEventListener("pointerover", (e) => {
    const t = e.target.closest ? e.target.closest(".tab") : null;
    if (!t || !pillHov || e.pointerType === "touch") return;
    placePill(pillHov, t, pillHov.style.opacity !== "1");
    pillHov.style.opacity = t.getAttribute("aria-selected") === "true" ? "0" : "1";
  });
  tabsEl.addEventListener("pointerleave", () => { if (pillHov) pillHov.style.opacity = "0"; });
  tabsEl.addEventListener("dblclick", (e) => {
    const t = e.target.closest ? e.target.closest(".tab") : null;
    if (t && view === "fat" && t.dataset.paper) { e.preventDefault(); const p = PAPERS.find((x) => x.id.toLowerCase() === t.dataset.paper); if (p) openPdf(p.id); }
  });
  tabsEl.addEventListener("pointermove", (e) => {
    if (STILL || e.pointerType === "touch") return;
    tabList().forEach((t) => {
      const r = t.getBoundingClientRect();
      const d = Math.abs(e.clientX - (r.left + r.width / 2));
      t.style.setProperty("--k", (1 + 0.08 * Math.max(0, 1 - d / 110)).toFixed(3));
    });
  });
  tabsEl.addEventListener("pointerleave", () => tabList().forEach((t) => t.style.setProperty("--k", "1")));
  window.addEventListener("resize", () => placePill(pillAct, tabList().find((t) => t.getAttribute("aria-selected") === "true"), true));
}

/* ---------- shell: tabs, routing, render ---------- */
function buildTabs() {
  tabsEl.innerHTML = "";
  pillHov = document.createElement("span"); pillHov.className = "tab-pill hov"; pillHov.setAttribute("aria-hidden", "true");
  pillAct = document.createElement("span"); pillAct.className = "tab-pill act"; pillAct.setAttribute("aria-hidden", "true");
  tabsEl.append(pillHov, pillAct);
  const labels = view === "fat" ? PAPERS.map((p) => p.id) : view === "topic" ? TOPICS.map((m) => m.id) : MODS.map((m) => m.id);
  tabsEl.setAttribute("aria-label", view === "fat" ? "Question papers" : "Modules");
  labels.forEach((label) => {
    const t = document.createElement("button");
    t.className = "tab";
    t.type = "button";
    t.setAttribute("role", "tab");
    t.textContent = label;
    if (view === "fat") t.dataset.paper = label.toLowerCase();
    const mod = view === "topic" ? MODS.find((x) => x.id === label) : null;
    if (mod && mod.marks) {
      const sm = document.createElement("small");
      sm.className = "tab-marks" + (mod.marks >= 20 ? " big" : "");
      sm.textContent = mod.marks;
      sm.title = mod.marks + " marks";
      t.appendChild(sm);
    }
    t.onclick = () => go(view === "fat" ? "fat-" + label.toLowerCase() : view === "topic" ? "topic-" + label : label);
    if (view === "fat") t.title = "Double-click to open the original PDF";
    tabsEl.appendChild(t);
  });
}
function render() {
  const term = q.value.trim().toLowerCase();
  const bare = view === "imp" || view === "distr";
  if (!bare && builtView !== view) {
    buildTabs();
    builtView = view;
  }
  titleEl.textContent = view === "fat" ? "fat" : view === "imp" ? "imp" : view === "distr" ? "distr" : view === "topic" ? "topic-wise" : "dbms";
  tabsEl.hidden = !tabList().length;
  heroEl.hidden = view !== "cloud";
  backEl.hidden = view === "cloud";
  /* Off the home page the page-switch buttons stay invisible (but clickable) and fade in as the pointer gets close. */
  topEl.dataset.ghost = view === "cloud" ? "" : "1";
  fatEl.hidden = view === "fat";
  topicEl.hidden = view === "topic";
  impEl.hidden = view === "imp";
  distrEl.hidden = view === "distr";
  if (view === "cloud") [extEl, fatEl, topicEl, impEl, distrEl].forEach((b) => b.style.removeProperty("--near"));
  { const kw = document.getElementById("keysWrap"); kw.hidden = view !== "imp"; document.getElementById("featWrap").hidden = view !== "imp"; if (view !== "imp") { document.getElementById("keysMenu").hidden = true; document.getElementById("keysBtn").setAttribute("aria-expanded", "false"); document.getElementById("featMenu").hidden = true; document.getElementById("featBtn").setAttribute("aria-expanded", "false"); } }
  tabsRowEl.hidden = bare;
  tabsRowEl.dataset.view = view;
  if (bare) {
    countEl.hidden = true;
    q.placeholder = "Search is available on the cloud and fat pages";
    return view === "imp" ? renderImp() : renderDistr();
  }
  q.placeholder = view === "topic" ? "Search topics or questions" : view === "fat" ? "Search by question no. (Q5) or text" : MODS.length ? "Search topics" : "Search is available on the fat page";
  if (view === "fat") renderFat(term);
  else if (view === "topic") renderTopic(term);
  else { renderCloud(term); if (sel >= 0) paintSel(false); }
}
function parse(hash) {
  const h = (hash || "").replace("#", "").toLowerCase();
  if (h === "imp") {
    view = "imp";
  } else if (h === "distr") {
    view = "distr";
  } else if (h.startsWith("topic")) {
    view = "topic";
    const id = h.split("-")[1];
    const i = TOPICS.findIndex((m) => m.id === id);
    curT = i === -1 ? 0 : i;
  } else if (h.startsWith("fat")) {
    view = "fat";
    const id = h.slice(4);
    const i = PAPERS.findIndex((p) => p.id.toLowerCase() === id);
    curP = i === -1 ? 0 : i;
  } else {
    view = "cloud";
    const i = MODS.findIndex((m) => m.id === h);
    cur = i === -1 ? 0 : i;
  }
}
function go(hash) {
  const before = view, beforeCur = cur;
  parse(hash);
  if (before !== view || beforeCur !== cur) sel = -1;
  if (before !== view) q.value = "";
  try {
    if (location.hash !== "#" + hash) location.hash = hash;
  } catch (e) {}
  render();
  scrollEl.scrollTop = 0;
  if (pendingQ && view === "fat") {
    const el = bodyEl.querySelector('.q[data-qn="' + pendingQ + '"]');
    if (el) el.scrollIntoView({ block: "start", behavior: STILL ? "auto" : "smooth" });
  }
  pendingQ = null;
}

/* ---------- theme ---------- */
const SUN = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
function setTheme(t) {
  const root = document.documentElement;
  root.setAttribute("data-theme", t === "light" ? "light" : "dark");
  themeBtn.innerHTML = t === "light" ? MOON : SUN;
  themeBtn.setAttribute("aria-label", t === "light" ? "Switch to dark mode" : "Switch to light mode");
  try {
    localStorage.setItem("cloud-theme2", t);
  } catch (e) {}
}

/* ---------- view / study mode ---------- */
function placeSeg() {
  const seg = document.getElementById("mode"); if (!seg) return;
  const on = seg.querySelector('[aria-pressed="true"]'), pill = seg.querySelector(".seg-pill");
  pill.style.width = on.offsetWidth + "px"; pill.style.transform = "translateX(" + on.offsetLeft + "px)";
}
function setMode(m, first) {
  MODE = m === "study" ? "study" : "view";
  document.documentElement.setAttribute("data-mode", MODE);
  document.querySelectorAll("#mode [data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === MODE)));
  placeSeg();
  try { localStorage.setItem("dbms-mode", MODE); } catch (e) {}
  if (!first && READY) render();
}

/* ---------- start ---------- */
async function init() {
  let saved = "dark";
  try {
    saved = localStorage.getItem("cloud-theme2") || "dark";
  } catch (e) {}
  setTheme(saved === "light" ? "light" : "dark");

  themeBtn.onclick = () => setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light");
  document.querySelectorAll("#mode [data-mode]").forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
  setMode(MODE, true);
  window.addEventListener("resize", placeSeg);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeSeg);
  initTabFx();
  q.addEventListener("input", render);
  document.getElementById("clear").onclick = () => {
    q.value = "";
    render();
    q.focus();
  };
  const keysBtn = document.getElementById("keysBtn"), keysMenu = document.getElementById("keysMenu"), keysWrap = document.getElementById("keysWrap");
  const setKeys = (open) => { keysMenu.hidden = !open; keysBtn.setAttribute("aria-expanded", String(open)); };
  const canHover = () => window.matchMedia("(hover: hover)").matches;
  keysBtn.onclick = (e) => { e.stopPropagation(); setKeys(canHover() ? true : keysMenu.hidden); };
  keysWrap.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") setKeys(true); });
  keysWrap.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") setKeys(false); });
  const featBtn = document.getElementById("featBtn"), featMenu = document.getElementById("featMenu"), featWrap = document.getElementById("featWrap");
  const setFeat = (open) => { featMenu.hidden = !open; featBtn.setAttribute("aria-expanded", String(open)); };
  featBtn.onclick = (e) => { e.stopPropagation(); setFeat(canHover() ? true : featMenu.hidden); };
  featWrap.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") setFeat(true); });
  featWrap.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") setFeat(false); });
  document.addEventListener("click", (e) => { if (!featMenu.hidden && !featWrap.contains(e.target)) setFeat(false); });
  document.addEventListener("click", (e) => { if (!keysMenu.hidden && !keysWrap.contains(e.target)) setKeys(false); });
  fatEl.before(featWrap);
  fatEl.before(keysWrap);
  document.addEventListener("keydown", (e) => {
    if (pvOpen()) {
      if (e.key === "Escape") { e.preventDefault(); pvClose(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); pvStep(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); pvStep(-1); }
      return;
    }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "");
    const plain = !e.metaKey && !e.ctrlKey && !e.altKey;
    if (e.key === "?" && view === "imp" && !typing && plain) { e.preventDefault(); setKeys(keysMenu.hidden); return; }
    if (e.key === "Escape" && !keysMenu.hidden) { e.preventDefault(); setKeys(false); keysBtn.focus(); return; }
    if (e.key === "Escape" && !featMenu.hidden) { e.preventDefault(); setFeat(false); featBtn.focus(); return; }
    if ((e.key === "Escape" || e.key === "Backspace") && !typing && plain && !e.shiftKey) { if (view !== "cloud" && READY) { e.preventDefault(); backEl.onclick(); } return; }
    if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); q.focus(); }
    else if (e.key === "Escape" && document.activeElement === q) { q.value = ""; render(); q.blur(); }
  });
  fatEl.onclick = () => go("fat-" + (PAPERS.length ? PAPERS[0].id.toLowerCase() : "a1-23-24"));
  topicEl.onclick = () => go("topic-" + (TOPICS.length ? TOPICS[0].id : "m1"));
  impEl.onclick = () => go("imp");
  distrEl.onclick = () => go("distr");
  document.addEventListener("keydown", onKey);
  backEl.onclick = () => go((view === "imp" || view === "distr") && MODS[cur] ? MODS[cur].id : view === "topic" && TOPICS[curT] ? TOPICS[curT].id : view === "fat" && MODS[cur] ? MODS[cur].id : "m1");
  bodyEl.addEventListener("click", (e) => {
    const pvb = e.target.closest ? e.target.closest("[data-pv]") : null;
    if (pvb) { openPaper(pvb.getAttribute("data-pv")); return; }
    const qbtn = e.target.closest ? e.target.closest("[data-leaves]") : null;
    if (qbtn) {
      if (MODE !== "study") return;
      toggleLeaves(qbtn.getAttribute("data-leaves").split(","), qbtn.getAttribute("data-base"), qbtn.getAttribute("data-all").split(","));
      refreshQ();
      return;
    }
    const dbtn = e.target.closest ? e.target.closest("[data-done]") : null;
    if (dbtn && MODE !== "study") return;
    if (dbtn) { toggleDone(dbtn.getAttribute("data-done")); applyDone(dbtn); return; }
    const tl = e.target.closest ? e.target.closest("[data-tl]") : null;
    if (tl && view === "cloud") { e.preventDefault(); openTopic(tl.getAttribute("data-tl")); return; }
    const ts = e.target.closest ? e.target.closest("[data-tsel]") : null;
    if (ts && view === "topic") { selectTopic(Number(ts.dataset.tsel)); return; }
    const a = e.target.closest ? e.target.closest("a[data-go]") : null;
    if (a) {
      e.preventDefault();
      pendingQ = a.getAttribute("data-q");
      go(a.getAttribute("data-go"));
    }
  });
  const ghosts = [extEl, fatEl, topicEl, impEl, distrEl, keysBtn, featBtn];
  document.addEventListener("pointermove", (e) => {
    if (!topEl.dataset.ghost || e.pointerType === "touch") return;
    ghosts.forEach((b) => {
      if (b.hidden) return;
      const r = b.getBoundingClientRect();
      const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right), dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
      const n = Math.max(0, 1 - Math.hypot(dx, dy) / 190);
      b.style.setProperty("--near", (n * n * (3 - 2 * n)).toFixed(3));
    });
  });
  document.addEventListener("pointerleave", () => ghosts.forEach((b) => b.style.setProperty("--near", "0")));
  document.addEventListener("pointermove", (e) => {
    const c = e.target.closest ? e.target.closest(".tc, .q, .mk") : null;
    if (c) { const r = c.getBoundingClientRect(); c.style.setProperty("--mx", e.clientX - r.left + "px"); c.style.setProperty("--my", e.clientY - r.top + "px"); }
  });
  window.addEventListener("hashchange", () => {
    if (!READY) return;
    const bc = cur, bv = view;
    parse(location.hash);
    if (bc !== cur || bv !== view) sel = -1;
    render();
  });

  try {
    [MODS, PAPERS, TOPICS] = await Promise.all([Api.modules(), Api.papers(), Api.topics()]);
    READY = true;
  } catch (e) {
    bodyEl.innerHTML = '<p class="none err">Could not load data from the backend. Start it with <code>npm start</code> and open <code>http://localhost:3000</code>.</p>';
    return;
  }
  parse(location.hash);
  render();
}

init();

