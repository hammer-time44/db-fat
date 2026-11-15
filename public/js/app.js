// Frontend logic: loads data from the backend API, then renders the cloud view (modules m1-m8)
// and the FAT view (papers A1, A2, F1, G1, G2). Routing uses the URL hash: #m3, #fat-g1.
import { Api } from "./api.js";

const tabsEl = document.getElementById("tabs");
const bodyEl = document.getElementById("body");
const titleEl = document.getElementById("title");
const backEl = document.getElementById("back");

const impEl = document.getElementById("impBtn");
const distrEl = document.getElementById("distrBtn");
const heroEl = document.getElementById("hero");
const tabsRowEl = document.getElementById("tabsRow");
const scrollEl = document.getElementById("scroll");
const themeBtn = document.getElementById("theme");
const q = document.getElementById("q");
const countEl = document.getElementById("count");
const cmpEl = document.getElementById("cmpBtn");
const rootEl = document.documentElement;
function setCount(n, term) {
  countEl.hidden = !term;
  countEl.textContent = n + (n === 1 ? " result" : " results");
}

let READY = false;
let MODS = [];
let PAPERS = [];
let view = "cloud";
let cur = 0;
let curP = 0;
let builtView = "";
let cmpA = 2, cmpB = 3;   // compare view: module indexes (default M3 vs M4)
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
  try { localStorage.setItem("dbms-done", JSON.stringify(DONE)); } catch (e) {}
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

/* ---------- cloud view ---------- */
function topicTable(rows, plain, mid) {
  let h = '<div class="tg">';
  rows.forEach((r) => {
    const k = topicKey(mid, r);
    h += '<article class="tc' + (isDone(k) ? " done" : "") + '"><button class="chk" type="button" data-done="' + attr(k) + '" aria-pressed="' + isDone(k) + '" aria-label="Mark ' + attr(r.topic) + ' as done"></button>' + (plain ? "" : '<span class="pr ' + priorityClass(r.priority) + '">' + esc(r.priority) + "</span>") + "<h3 class=\"tc-t\">" + esc(r.topic) + '</h3><p class="tc-i">' + esc(r.importance) + "</p></article>";
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
    .map((p) => [p.text, p.co, p.bl, (p.modules || []).join(" ")].join(" "))
    .join(" ")
    .toLowerCase();
}
function matchQuestion(question, term) {
  const m = term.match(/^q\.?\s*(\d+)$/);
  if (m) return question.number === Number(m[1]);
  if (/^\d+$/.test(term) && question.number === Number(term)) return true;
  return questionText(question).includes(term);
}
function partHtml(p) {
  let h = '<div class="part"><p>' + (p.label ? '<span class="pl">' + esc(p.label) + "</span>" : "") + esc(p.text) + '</p><div class="meta">';
  if (p.co) h += '<span class="tag">' + esc(p.co) + "</span>";
  if (p.bl) h += '<span class="tag">' + esc(p.bl) + "</span>";
  if (p.marks) h += '<span class="tag">' + esc(p.marks) + " marks</span>";
  (p.modules || []).forEach((k) => {
    h += '<a class="mchip" href="#' + k + '" data-go="' + k + '" title="' + esc(moduleTitle(k)) + '">' + k + "</a>";
  });
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
    const qk = "q:" + p.id.toLowerCase() + ":" + question.number;
    list += '<li class="q' + (isDone(qk) ? " done" : "") + '"><button class="qn" type="button" data-done="' + qk + '" aria-pressed="' + isDone(qk) + '" aria-label="Mark question ' + question.number + ' as solved">' + question.number + '</button><div class="qb">';
    question.parts.forEach((part, j) => {
      if (j > 0 && !part.and) list += '<div class="or">OR</div>';
      list += partHtml(part);
    });
    list += "</div></li>";
  });
  if (shown) h += '<ol class="qs">' + list + "</ol>";
  else h += '<p class="none">No questions in ' + esc(p.id) + " match “" + esc(q.value.trim()) + "”.</p>";
  setCount(shown, term);
  bodyEl.innerHTML = h;
  markTabs(curP);
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

/* ---------- compare view: two modules side by side ---------- */
function cmpCol(m) {
  const all = m.priority1.concat(m.priority2);
  const vh = all.filter((r) => r.priority === "Very High").length;
  const rows = (list, plain) => list.map((r) => '<li class="cr"><span class="cr-t">' + esc(r.topic) + "</span>" + (plain ? "" : '<span class="pr ' + priorityClass(r.priority) + '">' + esc(r.priority) + "</span>") + '<span class="cr-i">' + esc(r.importance) + "</span></li>").join("");
  return '<section class="cmp-col" aria-label="' + attr(m.id.toUpperCase()) + '">' +
    '<a class="cmp-h" href="#' + m.id + '" data-go="' + m.id + '"><b>' + m.id.toUpperCase() + "</b><span>" + esc(m.title) + "</span></a>" +
    '<div class="stat"><span class="pill marks-pill' + (m.marks >= 20 ? " big" : "") + '">' + (m.marks || "–") + " marks</span><span class=\"pill\">" + all.length + " topics</span>" + (vh ? '<span class="pill">' + vh + " very high</span>" : "") + "</div>" +
    (m.plain ? "" : '<span class="chip p1">Must prepare · ' + m.priority1.length + "</span>") + '<ul class="cl">' + rows(m.plain ? all : m.priority1, m.plain) + "</ul>" +
    (m.plain || !m.priority2.length ? "" : '<span class="chip p2">Important · ' + m.priority2.length + '</span><ul class="cl">' + rows(m.priority2, false) + "</ul>") +
    "</section>";
}
function renderCompare() {
  const opts = (n) => MODS.map((m, i) => '<option value="' + i + '"' + (i === n ? " selected" : "") + ">" + m.id.toUpperCase() + " · " + esc(m.title) + "</option>").join("");
  const a = MODS[cmpA], b = MODS[cmpB];
  bodyEl.innerHTML = "<h1>Compare modules</h1>" +
    '<p class="sub">See where the marks and priority topics sit before you choose what to skip.</p>' +
    '<div class="cmp-pick"><label>Left<select id="cmpSelA">' + opts(cmpA) + '</select></label>' +
    '<button type="button" class="icon-btn" id="cmpSwap" aria-label="Swap sides" title="Swap sides">&#8644;</button>' +
    '<label>Right<select id="cmpSelB">' + opts(cmpB) + "</select></label></div>" +
    (a && b ? '<div class="cmp">' + cmpCol(a) + cmpCol(b) + "</div>" +
      '<p class="note">Combined: ' + ((a.marks || 0) + (b.marks || 0)) + " marks · " + (a.priority1.length + b.priority1.length) + " must-prepare topics.</p>" : "");
  const sa = document.getElementById("cmpSelA"), sb = document.getElementById("cmpSelB");
  const upd = (x, y) => go("compare-" + MODS[x].id + "-" + MODS[y].id);
  sa.onchange = () => upd(+sa.value, cmpB);
  sb.onchange = () => upd(cmpA, +sb.value);
  document.getElementById("cmpSwap").onclick = () => upd(cmpB, cmpA);
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
  if (!READY) return;
  const k = e.key.toLowerCase();
  if (view === "cloud" || view === "fat") {
    if (e.key === "ArrowRight") { e.preventDefault(); moveTab(1); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); moveTab(-1); return; }
  }
  if (view === "cloud" && (k === "j" || k === "k")) { e.preventDefault(); moveTopic(k === "j" ? 1 : -1); return; }
  if (k === "c" && MODS.length > 1) { e.preventDefault(); go(view === "compare" ? MODS[cur].id : "compare-" + MODS[cmpA].id + "-" + MODS[cmpB].id); }
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
  const labels = view === "fat" ? PAPERS.map((p) => p.id) : MODS.map((m) => m.id);
  tabsEl.setAttribute("aria-label", view === "fat" ? "Question papers" : "Modules");
  labels.forEach((label) => {
    const t = document.createElement("button");
    t.className = "tab";
    t.type = "button";
    t.setAttribute("role", "tab");
    t.textContent = label;
    if (view === "fat") t.dataset.paper = label.toLowerCase();
    t.onclick = () => go(view === "fat" ? "fat-" + label.toLowerCase() : label);
    tabsEl.appendChild(t);
  });
}
function render() {
  const term = q.value.trim().toLowerCase();
  const bare = view === "imp" || view === "distr" || view === "compare";
  if (!bare && builtView !== view) {
    buildTabs();
    builtView = view;
  }
  titleEl.textContent = view === "fat" ? "fat" : view === "imp" ? "imp" : view === "distr" ? "distr" : view === "compare" ? "compare" : "dbms";
  tabsEl.hidden = !tabList().length;
  heroEl.hidden = view !== "cloud";
  backEl.hidden = view === "cloud";
  impEl.hidden = view !== "cloud";
  distrEl.hidden = view !== "cloud";
  cmpEl.hidden = view !== "cloud" || MODS.length < 2;
  tabsRowEl.hidden = bare;
  if (bare) {
    countEl.hidden = true;
    q.placeholder = "Search is available on the cloud and fat pages";
    return view === "imp" ? renderImp() : view === "distr" ? renderDistr() : renderCompare();
  }
  q.placeholder = view === "fat" ? "Search by question no. (Q5) or text" : MODS.length ? "Search topics" : "Search is available on the fat page";
  if (view === "fat") renderFat(term);
  else { renderCloud(term); if (sel >= 0) paintSel(false); }
}
function parse(hash) {
  const h = (hash || "").replace("#", "").toLowerCase();
  if (h.startsWith("compare")) {
    view = "compare";
    const [, x, y] = h.split("-");
    const i = MODS.findIndex((m) => m.id === x), j = MODS.findIndex((m) => m.id === y);
    if (i !== -1 && j !== -1) { cmpA = i; cmpB = j; }
    else { cmpA = Math.min(cmpA, MODS.length - 1); cmpB = Math.min(cmpB, MODS.length - 1); }
  } else if (h === "imp") {
    view = "imp";
  } else if (h === "distr") {
    view = "distr";
  } else if (h.startsWith("fat")) {
    view = "fat";
    const id = h.split("-")[1];
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
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || "");
    if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); q.focus(); }
    else if (e.key === "Escape" && document.activeElement === q) { q.value = ""; render(); q.blur(); }
  });
  impEl.onclick = () => go("imp");
  distrEl.onclick = () => go("distr");
  cmpEl.onclick = () => go("compare-" + MODS[cmpA].id + "-" + MODS[cmpB].id);
  document.addEventListener("keydown", onKey);
  backEl.onclick = () => go((view === "imp" || view === "distr" || view === "compare") && MODS[cur] ? MODS[cur].id : "m1");
  bodyEl.addEventListener("click", (e) => {
    const dbtn = e.target.closest ? e.target.closest("[data-done]") : null;
    if (dbtn && MODE !== "study") return;
    if (dbtn) { toggleDone(dbtn.getAttribute("data-done")); render(); return; }
    const a = e.target.closest ? e.target.closest("a[data-go]") : null;
    if (a) {
      e.preventDefault();
      go(a.getAttribute("data-go"));
    }
  });
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
    [MODS, PAPERS] = await Promise.all([Api.modules(), Api.papers()]);
    READY = true;
  } catch (e) {
    bodyEl.innerHTML = '<p class="none err">Could not load data from the backend. Start it with <code>npm start</code> and open <code>http://localhost:3000</code>.</p>';
    return;
  }
  parse(location.hash);
  render();
}

init();

