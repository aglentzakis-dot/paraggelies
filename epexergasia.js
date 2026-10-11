/*
  Παραγγελίες — κατάλογος και ρυθμιζόμενο μενού του πελάτη
  © 2026 Ανδρέας Μ. Γλεντζάκης (Andreas M. Glentzakis). Με την επιφύλαξη παντός δικαιώματος. All rights reserved.
  Απαγορεύεται η αντιγραφή, τροποποίηση και διάθεση, εν όλω ή εν μέρει, χωρίς προηγούμενη γραπτή άδεια του κατόχου.
*/
(function () {
"use strict";
const K = window.Kat, A = window.App, esc = K.esc;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const ed = { path: [], marked: new Set(), view: "menu", q: "", hint: true };
const S = () => A.S();
const EMOJIS = ["🥚", "🐓", "🍯", "🐝", "🫒", "🍞", "🥖", "🥐", "🥧", "🍪", "🎂", "🧀", "🥛", "💧", "🍷", "🍅", "🥬", "🥔", "🧅", "🍊", "🍋", "🍎", "🍇", "🍓", "🌿", "🌸", "☕", "🍗", "🥩", "🐟", "🧺", "📦", "⭐", "🎁"];
const TILE_COLORS = ["", "#FFF4D6", "#FDE2C8", "#F9D5D3", "#E3F1DF", "#DCEBF7", "#ECE3F5", "#F1F1EC", "#17324D", "#0B6E4F", "#7A3E1D", "#8C1C13", "#C2185B", "#E07A00"];

/* ---------- δομή μενού ---------- */
function curList() {
  let L = S().menu;
  const ok = [];
  for (const id of ed.path) { const n = L.find(x => x.id === id && x.t === "c"); if (!n) break; ok.push(id); L = n.kids || (n.kids = []); }
  ed.path = ok;
  return L;
}
const curCat = () => ed.path.length ? K.findNode(S().menu, ed.path[ed.path.length - 1]).node : null;
const newId = () => "n" + K.uid(5);
function removeNodes(ids, list) {
  list = list || S().menu;
  for (let i = list.length - 1; i >= 0; i--) {
    const n = list[i];
    if (ids.has(n.id)) list.splice(i, 1);
    else if (n.kids) removeNodes(ids, n.kids);
  }
}
function removeProductEverywhere(pid, list) {
  list = list || S().menu;
  for (let i = list.length - 1; i >= 0; i--) { const n = list[i]; if (n.t === "p" && n.pid === pid) list.splice(i, 1); else if (n.kids) removeProductEverywhere(pid, n.kids); }
}
function productInMenu(pid, list) { for (const n of list || S().menu) { if (n.t === "p" && n.pid === pid) return true; if (n.kids && productInMenu(pid, n.kids)) return true; } return false; }
const liveProducts = () => Object.values(S().products).filter(p => !p.del);
const activeCount = () => liveProducts().filter(p => !p.draft).length;
/* ενεργοποίηση ενδεικτικών: ελέγχει το όριο της δωρεάν έκδοσης */
function canActivate(n) { if (A.isPro() || activeCount() + n <= A.FREE_PRODUCTS) return true; A.proGate("products"); return false; }
function activate(ids) {
  const st = S(), L = ids.map(id => st.products[id]).filter(p => p && p.draft);
  const noPrice = L.filter(p => !(p.price > 0)), ok = L.filter(p => p.price > 0);
  if (!ok.length) { A.toast(noPrice.length ? "Βάλε πρώτα τιμή: " + noPrice.slice(0, 3).map(p => "«" + p.name + "»").join(", ") : "Δεν υπάρχει κάτι για ενεργοποίηση.", 4000); return; }
  let n = ok.length; if (!A.isPro()) { const room = Math.max(0, A.FREE_PRODUCTS - activeCount()); if (room < n) { n = room; } }
  ok.slice(0, n).forEach(p => delete p.draft);
  A.save({ catalog: true }); A.render();
  if (n < ok.length) { A.proGate("products"); return; }
  A.toast((n === 1 ? "✓ Ενεργοποιήθηκε 1 προϊόν" : "✓ Ενεργοποιήθηκαν " + n + " προϊόντα") + (noPrice.length ? " · " + noPrice.length + " χωρίς τιμή περιμένουν" : "") + ". " + (n === 1 ? "Το βλέπουν" : "Τα βλέπουν") + " πλέον οι πελάτες.", 4000);
}

/* ---------- προβολή ---------- */
A.menuView = function (m) {
  const st = S();
  const seg = `<div class="seg"><button type="button" class="${ed.view === "menu" ? "on" : ""}" data-ev="menu">🧩 Μενού πελάτη</button><button type="button" class="${ed.view === "list" ? "on" : ""}" data-ev="list">📋 Προϊόντα και τιμές</button></div>`;
  if (ed.view === "list") { m.innerHTML = seg + listHTML(); bindListDrag(m); return; }
  const L = curList();
  for (const id of [...ed.marked]) if (!L.some(n => n.id === id)) ed.marked.delete(id);
  const path = ed.path.map(id => K.findNode(st.menu, id).node);
  const crumbs = `<div class="crumbs"><button type="button" data-crumb="-1">🏠 Αρχική</button>${path.slice(0, -1).map((n, i) => `<span class="sep">›</span><button type="button" data-crumb="${i}">${esc(n.name || "Χωρίς όνομα")}</button>`).join("")}${path.length ? `<span class="sep">›</span>` : ""}</div>
  ${path.length ? `<div style="display:flex;align-items:center;gap:8px;margin:2px 2px 12px;border-bottom:3px solid var(--accent);padding-bottom:8px"><h2 style="margin:0;font-size:24px;flex:1;min-width:0">${path[path.length - 1].emoji ? esc(path[path.length - 1].emoji) + " " : ""}${esc(path[path.length - 1].name || "Χωρίς όνομα")}</h2><button type="button" class="btn soft sm" data-ea="catEdit">✏️ Ρυθμίσεις</button></div>` : ""}`;
  const empty = !st.menu.length;
  m.innerHTML = seg + crumbs +
    (ed.hint && L.length ? `<div class="note" style="margin:0 0 10px"><b>Πάτα ένα προϊόν</b> για να αλλάξεις όνομα και τιμή. <b>Πάτα μια κατηγορία</b> για να μπεις μέσα της. Πάτα <b>✓</b> για να μαρκάρεις κουμπιά (ένα ή πολλά). Κράτα πατημένο ένα κουμπί και σύρε το για να αλλάξεις σειρά. <a href="#" data-ea="hintOff">Εντάξει</a></div>` : "") +
    (empty ? presetsHTML() : "") +
    (() => { const nd = liveProducts().filter(p => p.draft).length; return nd ? `<div class="warnbox" style="display:flex;gap:10px;align-items:center;margin-bottom:10px"><div style="flex:1">📝 <b>${nd === 1 ? "1 ενδεικτικό προϊόν" : nd + " ενδεικτικά προϊόντα"}</b> ${nd === 1 ? "δεν φαίνεται" : "δεν φαίνονται"} ακόμα στους πελάτες (αχνά κουμπιά).</div><button type="button" class="btn sm amber" data-ev="list">Έλεγχος και ενεργοποίηση</button></div>` : ""; })() +
    (() => { if (ed.path.length) return ""; const lo = st.menu.filter(n => n.t === "p").length; return lo && st.menu.some(n => n.t === "c") ? `<div class="warnbox" style="display:flex;gap:10px;align-items:center;margin-bottom:10px"><div style="flex:1">Έχεις <b>${lo} ${lo === 1 ? "προϊόν" : "προϊόντα"} χύμα</b> στην αρχική, ανάμεσα στις κατηγορίες. Ο πελάτης τα βλέπει μπερδεμένα.</div><button type="button" class="btn sm amber" data-ea="tidy">🧹 Τακτοποίηση</button></div>` : ""; })() +
    `<div class="grid" id="edGrid" style="--c1:${esc(st.shop.c1)};--c2:${esc(st.shop.c2)};--on1:${K.contrast(st.shop.c1)};--on2:${K.contrast(st.shop.c2)}">${K.tilesHTML(L, { edit: true, marked: ed.marked, prod: id => st.products[id] })}</div>
    <div class="card" style="margin:6px 0 12px;padding:12px"><div class="note" style="margin:0 0 8px">Προσθήκη ${ed.path.length ? "μέσα στο <b>«" + esc(curCat().name) + "»</b>" : "στην <b>αρχική</b>"}:</div>
     <div class="row"><button type="button" class="btn amber grow" data-ea="addProd">🛒 ＋ Προϊόν με τιμή</button><button type="button" class="btn grow" data-ea="addCat">📁 ＋ ${ed.path.length ? "Υποκατηγορία" : "Κατηγορία"}</button></div>
     <div class="row" style="margin-top:8px"><button type="button" class="btn soft sm grow" data-ea="presets">📋 Επαγγέλματα</button><button type="button" class="btn soft sm grow" data-ea="add">Άλλα…</button><button type="button" class="btn ghost sm" data-ea="preview">👁 Προεπισκόπηση</button></div></div>
    ${L.length ? `<p class="note">Σύνολο ${liveProducts().length} προϊόντα${A.isPro() ? "" : " · δωρεάν έως " + A.FREE_PRODUCTS}.</p>` : ""}`;
  actbar();
  bindDrag($("#edGrid"));
};
function actbar() {
  const old = $("#actbar"); if (old) old.remove();
  if (!ed.marked.size || ed.view !== "menu") { document.body.classList.remove("editing"); return; }
  document.body.classList.add("editing");
  const one = ed.marked.size === 1;
  document.body.insertAdjacentHTML("beforeend", `<div class="actbar" id="actbar"><span class="cnt">${ed.marked.size} μαρκ.</span>
   <button type="button" data-ea="mvL" aria-label="Πιο μπροστά">◀ Μπροστά</button><button type="button" data-ea="mvR" aria-label="Πιο πίσω">Πίσω ▶</button>
   <button type="button" data-ea="size">↔ Μέγεθος</button><button type="button" data-ea="color">🎨 Χρώμα</button>
   ${one ? `<button type="button" data-ea="rename">✏️ Όνομα</button>` : ""}
   <button type="button" data-ea="moveTo">📁 Μετακίνηση</button><button type="button" data-ea="all">Όλα</button>
   <button type="button" class="red" data-ea="del">🗑 Διαγραφή</button><button type="button" data-ea="unmark">✕</button></div>`);
}
function tagsHTML(p) {
  const st = S(), t = [];
  if (p.draft) t.push(["📝 Ενδεικτικό", "#fff4d6", "#7a5a00"]);
  const av = K.avail(p, st.orders);
  if (av !== Infinity) t.push([av <= 0 ? "📦 Τελείωσε" : "📦 Απόθεμα " + K.num(av), av <= 0 ? "#fde8e6" : "#e3f1df", av <= 0 ? "#b3261e" : "#1f5c2e"]);
  if (!K.inSeason(p)) t.push(["🍂 Εκτός εποχής", "#f1f1ec", "#5d6670"]);
  if (+p.min > 0) t.push(["ελάχ. " + K.num(p.min), "#e8eef5", "#17324D"]);
  if (+p.whole > 0) t.push(["χονδρική " + K.money(p.whole), "#e8eef5", "#17324D"]);
  if ((p.tiers || []).length) t.push(["έκπτωση ποσότητας", "#e8eef5", "#17324D"]);
  if (p.only) t.push(["🔒 Μόνο για " + (p.onlyFor || []).length + ((p.onlyFor || []).length === 1 ? " πελάτη" : " πελάτες"), "#ece3f5", "#4a2a6b"]);
  return t.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:3px">${t.map(([x, b, c]) => `<span style="font-size:11.5px;font-weight:700;background:${b};color:${c};border-radius:8px;padding:2px 7px">${x}</span>`).join("")}</div>` : "";
}
function listHTML() {
  const st = S(), q = K.norm(ed.q);
  const L = liveProducts().filter(p => !q || K.norm(p.name).includes(q));
  const want = new Set(L.map(p => p.id)), used = new Set();
  const prow = p => `<div class="prow" data-prow="${p.id}" style="flex-wrap:wrap;gap:6px 10px;padding:10px 0">
     <div style="flex:1 1 100%;display:flex;align-items:center;gap:8px"><span class="pdrag" data-pdrag="${p.id}" aria-label="Κράτα και σύρε για μετακίνηση" title="Κράτα και σύρε">⠿</span><div class="pt" data-pedit="${p.id}" style="flex:1;min-width:0;display:flex;align-items:center;gap:8px"><span style="font-size:22px">${esc(p.emoji || "📦")}</span><div style="flex:1;min-width:0"><b style="font-size:16.5px;display:block">${esc(p.name)}</b><span>ανά ${esc(p.unit)}${+p.step && +p.step !== 1 ? " · βήμα " + K.num(p.step) : ""}${p.hidden ? " · κρυφό" : ""}${p.code ? " · " + esc(p.code) : ""}</span>${tagsHTML(p)}</div><span style="font-size:15px;color:var(--brand)" aria-hidden="true">✏️</span></div><button type="button" data-pmove="${p.id}" aria-label="Μετακίνηση σε άλλη κατηγορία" title="Σε άλλη κατηγορία" style="border:0;background:#e8eef5;color:var(--brand);border-radius:10px;width:40px;height:36px;font-size:15px;cursor:pointer;flex:none">📁</button><button type="button" data-pdel="${p.id}" aria-label="Διαγραφή" style="border:0;background:#fde8e6;color:var(--bad);border-radius:10px;width:40px;height:36px;font-size:15px;cursor:pointer;flex:none">🗑</button></div>
     <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--mute);font-weight:700">Τιμή €<input class="pp" inputmode="decimal" data-pprice="${p.id}" value="${(+p.price || 0).toFixed(2).replace(".", ",")}" aria-label="Τιμή"></label>
     <span style="flex:1"></span>
     ${p.draft ? `<button type="button" class="btn sm amber" data-pact="${p.id}" style="padding:8px 12px">✓ Ενεργοποίηση</button>` : `<div style="display:flex;align-items:center;gap:6px"><label class="tog g av" title="Διαθέσιμο" style="flex:none"><input type="checkbox" data-pavail="${p.id}"${p.soldout ? "" : " checked"}><span></span></label><small style="font-size:12px;font-weight:700;width:76px;color:${p.soldout ? "var(--bad)" : "var(--ok)"}">${p.soldout ? "Εξαντλήθηκε" : "Διαθέσιμο"}</small></div>`}
     </div>`;
  /* ομάδες όπως στο μενού: «Κατηγορία › Υποκατηγορία» */
  const groups = [];
  const walk = (nodes, trail) => {
    const here = [];
    for (const n of nodes || []) {
      if (n.t === "p") { if (want.has(n.pid) && !used.has(n.pid)) { used.add(n.pid); here.push(st.products[n.pid]); } }
    }
    if (here.length || (trail.length && !(nodes || []).some(n => n.t === "c"))) groups.push({ title: (trail.length > 1 ? "↳ " + (trail[trail.length - 1].emoji ? trail[trail.length - 1].emoji + " " : "") + trail[trail.length - 1].name : trail.map(x => (x.emoji ? x.emoji + " " : "") + x.name).join(" › ")) || (st.menu.some(n => n.t === "c") ? "⚠️ Χύμα στην αρχική, χωρίς κατηγορία" : "🏠 Αρχική του μενού"), depth: trail.length, items: here, cat: trail.length ? trail[trail.length - 1].id : "", loose: !trail.length && st.menu.some(n => n.t === "c") });
    else if (trail.length) groups.push({ title: (trail.length > 1 ? "↳ " : "") + (trail[trail.length - 1].emoji ? trail[trail.length - 1].emoji + " " : "") + trail[trail.length - 1].name, depth: trail.length, items: [], cat: trail[trail.length - 1].id, hdr: 1 });
    for (const n of nodes || []) if (n.t === "c") walk(n.kids, trail.concat(n));
  };
  walk(st.menu, []);
  const rest = L.filter(p => !used.has(p.id));
  if (rest.length) groups.push({ title: "⚠️ Δεν είναι στο μενού", depth: 0, items: rest, warn: 1 });
  const head = `<div class="row" style="margin-bottom:10px"><input class="t grow" id="edQ" placeholder="🔍 Αναζήτηση προϊόντος" value="${esc(ed.q)}"></div>
  <div class="row" style="margin-bottom:10px"><button type="button" class="btn amber grow" data-ea="newProd">🛒 ＋ Νέο προϊόν</button><button type="button" class="btn grow" data-ea="newCat">📁 ＋ Νέα κατηγορία</button></div>
  <div class="row" style="margin-bottom:10px"><button type="button" class="btn soft grow" data-ea="presets">📋 Επαγγέλματα</button><button type="button" class="btn soft grow" data-xl="open">📊 Excel</button></div>
  ${(() => { const u = S().undoImport; return u && Date.now() - u.at < 2 * 864e5 ? `<div class="okbox" style="display:flex;gap:10px;align-items:center;margin:0 0 10px"><div style="flex:1">${esc(u.label || "Αλλαγή ολόκληρου του καταλόγου")} · ${new Date(u.at).toLocaleString("el-GR", { weekday: "long", hour: "2-digit", minute: "2-digit" })}</div><button type="button" class="btn sm soft" data-xl="undo">↩️ Αναίρεση</button></div>` : ""; })()}
`;
  if (q) for (const g of groups) if (!g.items.length) g.skip = 1;
  const nSub = id => { const f = K.findNode(st.menu, id); return f ? (f.node.kids || []).filter(n => n.t === "c").length : 0; };
  const nd = liveProducts().filter(p => p.draft).length;
  const dbox = nd ? `<div class="warnbox" style="display:flex;gap:10px;align-items:center;margin-bottom:10px"><div style="flex:1">📝 <b>${nd === 1 ? "1 ενδεικτικό προϊόν" : nd + " ενδεικτικά προϊόντα"}</b> από έτοιμο κατάλογο. Δεν τα βλέπουν οι πελάτες. Διόρθωσε τιμές, σβήσε όσα δεν χρειάζεσαι και ενεργοποίησέ τα.</div><button type="button" class="btn sm amber" data-pactall="*">✓ Όλα</button></div>` : "";
  return head + dbox + (L.length > 1 && !q ? `<p class="note" style="margin:0 2px 10px">Κράτα το <b>⠿</b> και σύρε για να αλλάξεις σειρά ή να πας ένα προϊόν σε άλλη κατηγορία· ή πάτα <b>📁</b>. Με τα <b>▲▼</b> αλλάζεις σειρά στις κατηγορίες. Πάτα τον <b>τίτλο</b> μιας κατηγορίας για να την μετονομάσεις ή να τη διαγράψεις.</p>` : "") + (groups.length ? groups.filter(g => !g.skip).map(g => `<div class="card pgrp${g.hdr ? " phdr" : ""}" data-gcat="${g.warn ? "!" : g.cat}" style="padding:${g.hdr ? "8px 14px" : "10px 14px"};${g.hdr ? "background:color-mix(in srgb,var(--accent) 14%,#fff);margin-bottom:6px;" : ""}${g.depth > 1 ? "margin-left:" + Math.min(3, g.depth - 1) * 10 + "px;" : ""}border-left:5px solid ${g.warn ? "#e3a008" : "var(--accent)"}"><div style="display:flex;align-items:center;gap:8px;margin:2px 0 6px">${g.cat ? (() => { const f = K.findNode(st.menu, g.cat), sib = f ? f.list.filter(n => n.t === "c") : [], i = f ? sib.indexOf(f.node) : -1; return `<div class="cmv"><button type="button" data-cmv="${g.cat}" data-dir="-1" aria-label="Κατηγορία πιο πάνω"${i <= 0 ? " disabled" : ""}>▲</button><button type="button" data-cmv="${g.cat}" data-dir="1" aria-label="Κατηγορία πιο κάτω"${i < 0 || i >= sib.length - 1 ? " disabled" : ""}>▼</button></div>`; })() : ""}<h3${g.cat ? ` data-gedit="${g.cat}" role="button" title="Αλλαγή ονόματος ή διαγραφή"` : ""} style="margin:0;flex:1;min-width:0;font-size:${g.depth > 1 ? 15.5 : 17}px;${g.cat ? "cursor:pointer" : ""}">${esc(g.title)} <span class="note gcnt" style="font-weight:400">· ${g.hdr ? nSub(g.cat) + " υποκατ." : g.items.length}</span>${g.cat ? ` <span style="font-size:13px;color:var(--brand)">✏️</span>` : ""}</h3>${g.items.some(p => p.draft) ? `<button type="button" class="btn sm soft" data-pactall="${g.warn ? "!" : g.cat || "~"}" style="padding:7px 10px">✓ Όλα (${g.items.filter(p => p.draft).length})</button>` : ""}${g.warn ? "" : g.loose ? `<button type="button" class="btn sm amber" data-ea="tidy" style="padding:7px 11px">🧹 Τακτοποίηση</button>` : `<button type="button" class="btn sm amber" data-addin="${g.cat}" style="padding:7px 11px">＋ Προσθήκη</button>`}</div>${g.loose ? `<p class="note" style="margin:0 0 4px">Αυτά φαίνονται στον πελάτη ανάμεσα στις κατηγορίες. Σύρε τα με το ⠿ μέσα σε κατηγορία ή πάτα «Τακτοποίηση».</p>` : ""}${g.hdr ? "" : `<div class="pitems">`}${(g.warn ? g.items.sort((a, b) => a.name.localeCompare(b.name, "el")) : g.items).map(prow).join("")}${g.hdr ? "" : "</div>"}</div>`).join("") : `<div class="card"><p class="note">Κανένα προϊόν ακόμα.</p></div>`)
    + (liveProducts().length ? `<button type="button" class="btn soft wide" data-ea="emptyAll" style="margin:14px 0 4px;color:var(--bad);border:1px solid #f1b3ad">🗑 Άδειασμα όλου του καταλόγου</button>` : "")
    + (L.length ? `<p class="note">Πράσινος διακόπτης = <b>διαθέσιμο</b>. Κλείσ' τον όταν τελειώσει ένα προϊόν: ο πελάτης το βλέπει «Εξαντλήθηκε» και δεν μπορεί να το παραγγείλει. Η τιμή αλλάζει μόλις φύγεις από το πλαίσιο.</p>` : "");
}
/* ---------- τακτοποίηση: προϊόντα χύμα στην αρχική ---------- */
function tidySheet() {
  const st = S(), loose = st.menu.filter(n => n.t === "p" && st.products[n.pid]);
  if (!loose.length) { A.toast("Δεν υπάρχει τίποτα χύμα στην αρχική."); return; }
  const cats = []; const walk = (L, d) => { for (const n of L) if (n.t === "c") { cats.push({ id: n.id, label: "— ".repeat(d) + (n.emoji ? n.emoji + " " : "") + n.name }); walk(n.kids || [], d + 1); } }; walk(st.menu, 0);
  const byName = {}; for (const n of loose) { const k = K.norm(st.products[n.pid].name); (byName[k] = byName[k] || []).push(n); }
  const same = Object.values(byName).filter(L => L.length > 1);
  const guess = n => { const pn = K.norm(st.products[n.pid].name); const c = cats.find(c => { const cn = K.norm(c.label.replace(/^(— )+/, "")).replace(/^[^a-zα-ω0-9]+/, ""); return cn.length > 2 && (pn.includes(cn) || cn.includes(pn.split(" ")[0])); }); return c ? c.id : ""; };
  const opts = sel => `<option value="">— μένει στην αρχική —</option>${cats.map(c => `<option value="${c.id}"${c.id === sel ? " selected" : ""}>${esc(c.label)}</option>`).join("")}<option value="+">＋ Νέα κατηγορία «Διάφορα»</option>`;
  A.sheet("🧹 Τακτοποίηση αρχικής", `
   ${same.length ? `<div class="card"><h3 style="margin-top:0">Ίδιο προϊόν σε πολλές συσκευασίες</h3><p class="note" style="margin-top:0">Γίνεται ένα κουμπί που ανοίγει και δείχνει τις συσκευασίες του. Ο πελάτης βλέπει πιο καθαρά.</p>
    ${same.map((L, i) => { const p = st.products[L[0].pid]; return `<label class="ck"><input type="checkbox" data-tsame="${i}" checked><span><b>${esc(p.name)}</b> · ${L.map(n => esc(st.products[n.pid].unit) + " " + K.money(st.products[n.pid].price)).join(" · ")}</span></label>`; }).join("")}</div>` : ""}
   <div class="card"><h3 style="margin-top:0">Σε ποια κατηγορία πάει το καθένα</h3>
    <div class="row" style="margin-bottom:8px;align-items:center"><span class="note" style="margin:0">Όλα μαζί σε:</span><select class="t grow" id="tAll">${opts("")}</select></div>
    ${loose.map(n => { const p = st.products[n.pid]; return `<div class="prow" style="flex-wrap:wrap;gap:4px 10px"><div class="pt" style="flex:1 1 160px"><b>${esc(p.emoji || "📦")} ${esc(p.name)}</b><span>${K.money(p.price)} / ${esc(p.unit)}</span></div><select class="t" data-tnode="${n.id}" style="flex:1 1 150px">${opts(guess(n))}</select></div>`; }).join("")}</div>
   <label class="ck"><input type="checkbox" id="tCatsFirst" checked><span>Πρώτα οι κατηγορίες, μετά ό,τι μείνει χύμα</span></label>`,
   `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-ea="tidyGo">Τακτοποίηση</button>`,
   el => { el._same = same; const a = el.querySelector("#tAll"); a.addEventListener("change", () => { if (a.value !== "") el.querySelectorAll("[data-tnode]").forEach(x => x.value = a.value); }); });
}
function tidyGo() {
  const st = S(), b = $("#shB"), same = b._same || [];
  let misc = null; const miscCat = () => { if (!misc) { misc = st.menu.find(n => n.t === "c" && K.norm(n.name) === "διαφορα") || null; if (!misc) { misc = { id: newId(), t: "c", name: "Διάφορα", emoji: "🧺", size: "m", kids: [] }; st.menu.push(misc); } } return misc; };
  const dest = {}; b.querySelectorAll("[data-tnode]").forEach(x => dest[x.dataset.tnode] = x.value);
  let moved = 0, grouped = 0;
  /* ίδιο όνομα → ένα κουμπί με συσκευασίες */
  b.querySelectorAll("[data-tsame]").forEach(cb => { if (!cb.checked) return; const L = same[+cb.dataset.tsame]; if (!L) return;
    const p0 = st.products[L[0].pid]; const cat = { id: newId(), t: "c", name: p0.name, emoji: p0.emoji || "", size: L[0].size || "m", color: L[0].color || "", kids: [] };
    const at = st.menu.indexOf(L[0]); const d = dest[L[0].id];
    for (const n of L) { const i = st.menu.indexOf(n); if (i >= 0) st.menu.splice(i, 1); n.size = "m"; n.color = ""; delete n.name; cat.kids.push(n); delete dest[n.id]; }
    if (d) { const target = d === "+" ? miscCat() : K.findNode(st.menu, d).node; target.kids = target.kids || []; target.kids.push(cat); moved++; } else st.menu.splice(Math.max(0, Math.min(at, st.menu.length)), 0, cat);
    grouped++; });
  for (const [id, d] of Object.entries(dest)) { if (!d) continue; const i = st.menu.findIndex(n => n.id === id); if (i < 0) continue; const n = st.menu.splice(i, 1)[0]; const target = d === "+" ? miscCat() : (K.findNode(st.menu, d) || {}).node; if (!target) { st.menu.splice(i, 0, n); continue; } (target.kids = target.kids || []).push(n); moved++; }
  if ($("#tCatsFirst").checked) { const c = st.menu.filter(n => n.t === "c"), r = st.menu.filter(n => n.t !== "c"); st.menu.splice(0, st.menu.length, ...c, ...r); }
  A.save({ catalog: true }); A.closeSheet(); A.render();
  A.toast("✓ Τακτοποιήθηκε" + (grouped ? " · " + grouped + " ενώθηκαν σε ένα κουμπί" : "") + (moved ? " · " + moved + " μπήκαν σε κατηγορία" : ""), 3500);
}
/* ---------- «Προϊόντα και τιμές»: σύρσιμο με το δάχτυλο και μετακίνηση σε άλλη κατηγορία ---------- */
const listOf = cat => cat ? ((K.findNode(S().menu, cat) || {}).node || {}).kids : S().menu;
function catName(cat) { return cat ? (K.findNode(S().menu, cat) || { node: {} }).node.name || "" : "Αρχική"; }
function moveProd(pid, from, to, beforePid, afterPid) {
  const st = S(); if (!pid || !st.products[pid] || to === "!") return;
  const dest = listOf(to); if (!dest) return;
  let node = null;
  if (from && from !== "!") { const src = listOf(from); const i = src ? src.findIndex(n => n.t === "p" && n.pid === pid) : -1; if (i >= 0) node = src.splice(i, 1)[0]; }
  else if (from === "") { const i = st.menu.findIndex(n => n.t === "p" && n.pid === pid); if (i >= 0) node = st.menu.splice(i, 1)[0]; }
  const dup = dest.findIndex(n => n.t === "p" && n.pid === pid); if (dup >= 0) { const d = dest.splice(dup, 1)[0]; node = node || d; }
  node = node || { id: newId(), t: "p", pid, size: "m" };
  let at = -1;
  if (beforePid) at = dest.findIndex(n => n.t === "p" && n.pid === beforePid);
  if (at < 0 && afterPid) { const j = dest.findIndex(n => n.t === "p" && n.pid === afterPid); if (j >= 0) at = j + 1; }
  if (at < 0) { let last = -1; dest.forEach((n, i) => { if (n.t === "p") last = i; }); at = last >= 0 ? last + 1 : dest.length; }
  dest.splice(at, 0, node);
  A.save({ catalog: true }); A.render();
  if (from !== to) A.toast("✓ " + st.products[pid].name + " → «" + catName(to) + "»");
}
function catMove(id, dir) {
  const f = K.findNode(S().menu, id); if (!f) return;
  const L = f.list, i = L.indexOf(f.node); let j = i + dir;
  while (j >= 0 && j < L.length && L[j].t !== "c") j += dir;
  if (j < 0 || j >= L.length) return;
  L.splice(i, 1); L.splice(j, 0, f.node);
  A.save({ catalog: true });
  const before = document.querySelector(`[data-gcat="${id}"]`), y = before ? before.getBoundingClientRect().top : 0;
  A.render();
  const after = document.querySelector(`[data-gcat="${id}"]`);
  if (after) { window.scrollBy(0, after.getBoundingClientRect().top - y); after.animate([{ boxShadow: "0 0 0 3px var(--accent)" }, { boxShadow: "0 0 0 0 transparent" }], { duration: 900 }); }
}
/* διαθέσιμο ⇄ εξαντλήθηκε· όταν εξαντλείται, ρωτά αν θα εξαφανιστεί από τον κατάλογο των πελατών */
function setAvail(p, on) {
  p.soldout = !on;
  if (on) { if (p.hidden && p.hidBySo) { p.hidden = false; delete p.hidBySo; A.toast("✓ " + p.name + ": διαθέσιμο και ξαναφαίνεται στους πελάτες"); } else A.toast(p.name + ": διαθέσιμο"); A.save({ catalog: true }); A.render(); return; }
  A.save({ catalog: true }); A.render();
  if (p.hidden) { A.toast(p.name + ": εξαντλήθηκε"); return; }
  A._soP = p.id;
  A.sheet("«" + p.name + "» εξαντλήθηκε", `<div class="card"><p style="margin-top:0;font-weight:700">Τι να βλέπουν οι πελάτες σου;</p>
    <div class="card list" style="margin:0"><div class="it" data-soq="show"><div class="ic">👁</div><div class="t"><b>Να φαίνεται με «Εξαντλήθηκε»</b><span>Το βλέπουν γκρίζο και δεν μπορούν να το παραγγείλουν. Καλό όταν θα ξαναέρθει σύντομα.</span></div></div>
    <div class="it" data-soq="hide"><div class="ic">🙈</div><div class="t"><b>Να εξαφανιστεί από τον κατάλογο</b><span>Δεν το βλέπουν καθόλου. Μόλις το ξανακάνεις διαθέσιμο, εμφανίζεται πάλι μόνο του.</span></div></div></div></div>`);
}
function pmoveSheet(pid, from) {
  const p = S().products[pid]; if (!p) return;
  A._pmv = { pid, from };
  const opts = []; const walk = (L, depth) => { for (const n of L) if (n.t === "c") { opts.push({ id: n.id, label: (n.emoji ? n.emoji + " " : "") + n.name, depth }); walk(n.kids || [], depth + 1); } };
  walk(S().menu, 0);
  A.sheet("«" + p.name + "» σε…", `<div class="card list">${opts.map(o => `<div class="it" data-pmvto="${o.id}" style="padding-left:${10 + o.depth * 18}px${o.id === from ? ";opacity:.45" : ""}"><div class="ic">${o.depth ? "↳" : "📁"}</div><div class="t"><b>${esc(o.label)}</b>${o.id === from ? "<span>είναι ήδη εδώ</span>" : ""}</div></div>`).join("")}
   <div class="it" data-pmvto=""><div class="ic">🏠</div><div class="t"><b>Αρχική του μενού</b><span>Χωρίς κατηγορία</span></div></div></div>`);
}
function bindListDrag(root) { root.querySelectorAll("[data-pdrag]").forEach(h => h.addEventListener("pointerdown", e => listDrag(e, h))); }
function listDrag(e, h) {
  if (e.button > 0) return;
  e.preventDefault();
  const row = h.closest(".prow"), pid = row.dataset.prow, from = row.closest("[data-gcat]").dataset.gcat;
  const r = row.getBoundingClientRect(), dy = e.clientY - r.top;
  const ghost = row.cloneNode(true); ghost.classList.add("pghost");
  Object.assign(ghost.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px" });
  document.body.appendChild(ghost); row.classList.add("pdragging");
  try { navigator.vibrate && navigator.vibrate(15); } catch {}
  let lx = e.clientX, ly = e.clientY, done = false;
  const anim = el => { const b0 = el.getBoundingClientRect(); return () => { const b1 = el.getBoundingClientRect(), d = b0.top - b1.top; if (d) { el.animate([{ transform: `translateY(${d}px)` }, { transform: "none" }], { duration: 140, easing: "ease-out" }); } }; };
  const place = () => {
    const el = document.elementFromPoint(lx, ly); if (!el) return;
    if (el.closest('[data-gcat="!"]') && from !== "!") return;
    const tr = el.closest(".prow[data-prow]");
    const sibs = () => [...document.querySelectorAll(".pitems .prow")].filter(x => x !== row).map(anim);
    if (tr && tr !== row) {
      const b = tr.getBoundingClientRect(), after = ly > b.top + b.height / 2;
      const ref = after ? tr.nextElementSibling : tr;
      if (ref === row || (after && tr.nextElementSibling === row)) return;
      const fl = sibs(); tr.parentNode.insertBefore(row, ref); fl.forEach(f => f());
      return;
    }
    const g = el.closest(".pgrp[data-gcat]");
    if (g && g.dataset.gcat !== "!") { const box = g.querySelector(".pitems"); if (box && !box.contains(row)) { const fl = sibs(); const b = box.getBoundingClientRect(); if (ly < b.top + 10) box.insertBefore(row, box.firstChild); else box.appendChild(row); fl.forEach(f => f()); } }
  };
  const tick = setInterval(() => { if (ly < 90) { window.scrollBy(0, -14); place(); } else if (ly > innerHeight - 110) { window.scrollBy(0, 14); place(); } }, 30);
  const move = ev => { lx = ev.clientX; ly = ev.clientY; ghost.style.top = (ly - dy) + "px"; place(); };
  const end = () => {
    if (done) return; done = true; clearInterval(tick);
    window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end);
    ghost.remove(); row.classList.remove("pdragging");
    const g = row.closest("[data-gcat]"), to = g ? g.dataset.gcat : from;
    const nx = row.nextElementSibling, pv = row.previousElementSibling;
    if (to === "!") { A.render(); return; }
    moveProd(pid, from, to, nx && nx.dataset.prow, pv && pv.dataset.prow);
  };
  window.addEventListener("pointermove", move); window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end);
}
/* ---------- έτοιμοι κατάλογοι ανά επάγγελμα (protypa.js) ---------- */
const PRESETS = window.PROTYPA || {};
/* ένα στοιχείο είναι υποκατηγορία όταν το τρίτο του μέλος είναι λίστα: [όνομα, εικονίδιο, [ ... ]] */
const isSub = it => Array.isArray(it) && Array.isArray(it[2]);
const countIn = items => items.reduce((a, it) => a + (isSub(it) ? countIn(it[2]) : 1), 0);
const subCount = items => items.reduce((a, it) => a + (isSub(it) ? 1 + subCount(it[2]) : 0), 0);
const prodCount = P => countIn(P.c);
function presetGrid() {
  const groups = {};
  for (const [k, v] of Object.entries(PRESETS)) (groups[v.g] = groups[v.g] || []).push([k, v]);
  return Object.entries(groups).map(([g, L]) => `<h3 style="margin:12px 2px 6px;font-size:15px">${esc(g)}</h3><div class="grid">${L.map(([k, v]) =>
    `<button type="button" class="tile cat sz-s" data-preset="${k}" style="--tc:#FFF4D6;color:#1b1b1b"><span class="em">${v.e}</span><span class="nm">${esc(v.n)}</span></button>`).join("")}</div>`).join("");
}
function presetsHTML() {
  return `<div class="card"><h3>Διάλεξε το επάγγελμά σου</h3><p class="note" style="margin-top:0">Μπαίνει έτοιμο μενού με κατηγορίες και προϊόντα. Μετά αλλάζεις ό,τι θέλεις: ονόματα, τιμές, σειρά, μεγέθη. Οι τιμές είναι ενδεικτικές.</p>${presetGrid()}
   <p class="note">Ή πάτα «＋ Κουμπί» για να φτιάξεις τα δικά σου από την αρχή.</p>
   <button type="button" class="btn soft wide" data-xl="open">📊 Ή γράψε τον κατάλογό σου σε Excel και ανέβασέ τον</button></div>`;
}
function presetPicker() {
  const here = ed.path.length ? K.findNode(S().menu, ed.path[ed.path.length - 1]).node.name : "";
  A.sheet("📋 Έτοιμο μενού από επάγγελμα", `<p class="note" style="margin-top:0">${here ? "Οι κατηγορίες του επαγγέλματος μπαίνουν ως υποκατηγορίες μέσα στο «" + esc(here) + "»." : "Οι κατηγορίες του επαγγέλματος προστίθενται στην αρχική του μενού σου, δίπλα σε όσα ήδη έχεις. Αν θέλεις να μπουν μέσα σε μια κατηγορία, μπες πρώτα σε εκείνη."}</p>${presetGrid()}`);
}
function presetSheet(k) {
  const P = PRESETS[k]; if (!P) return;
  A.sheet(P.e + " " + P.n, `<p class="note" style="margin-top:0">${esc(P.d || "")}</p>
   ${P.w ? `<div class="warnbox">⚖️ ${esc(P.w)}</div>` : ""}
   ${P.c.map(([cn, ce, items]) => `<div class="card"><h3>${ce} ${esc(cn)}</h3>${presetItemsHTML(items, 0)}</div>`).join("")}
   <div class="okbox">📝 Μπαίνουν ως <b>ενδεικτικά</b>: δεν τα βλέπουν οι πελάτες μέχρι να ελέγξεις τιμές και να πατήσεις «Ενεργοποίηση». Όσα δεν χρειάζεσαι, τα σβήνεις.</div>
   <p class="note">${prodCount(P)} προϊόντα σε ${P.c.length} κατηγορίες${subCount(P.c) - P.c.length > 0 ? " και " + (subCount(P.c) - P.c.length) + " υποκατηγορίες" : ""}. Τιμές και ΦΠΑ είναι ενδεικτικά· έλεγξέ τα και με τον λογιστή σου.${!A.isPro() ? " Η δωρεάν έκδοση (μετά τη δοκιμή) έχει έως " + A.FREE_PRODUCTS + " ενεργά προϊόντα." : ""}</p>
   ${Object.values(S().products).some(p => !p.del) ? `<button type="button" class="btn soft wide" data-preset-swap="${k}" style="margin-top:4px">🔄 Αντικατάσταση: σβήσε τον τωρινό κατάλογο και βάλε αυτόν</button><p class="note">Η αντικατάσταση σβήνει τα τωρινά προϊόντα και κατηγορίες (οι παλιές παραγγελίες μένουν). Μπορείς να την αναιρέσεις από το «Προϊόντα και τιμές».</p>` : ""}`,
   `<button type="button" class="btn soft" data-ea="presetBack">← Επαγγέλματα</button><button type="button" class="btn amber" data-preset-go="${k}">＋ Πρόσθεσέ τα</button>`);
}
function presetItemsHTML(items, d) {
  return items.map(it => isSub(it) ? `<details${d ? "" : " open"} style="margin:6px 0 2px ${d * 10}px"><summary style="cursor:pointer;font-weight:800">${it[1]} ${esc(it[0])} <span class="note" style="font-weight:400">· ${countIn(it[2])}</span></summary>${presetItemsHTML(it[2], d + 1)}</details>`
    : `<div class="qrow"><div class="qn"><b>${esc(it[0])}</b><span>ανά ${esc(it[1])}</span></div><b>${K.money(it[2])}</b></div>`).join("");
}
function applyPreset(k) {
  const st = S(), P = PRESETS[k]; if (!P) return;
  const target = ed.view === "menu" && ed.path.length ? curList() : st.menu;
  let count = 0;
  const build = (cn, ce, items) => {
    const cat = { id: newId(), t: "c", name: cn, emoji: ce, size: "m", kids: [] };
    for (const it of items) {
      if (isSub(it)) { const sub = build(it[0], it[1], it[2]); if (sub.kids.length) cat.kids.push(sub); continue; }
      const [n, u, pr, step, o] = it, id = "p" + K.uid(5), op = o || {};
      st.products[id] = { id, name: n, unit: u, price: pr, step: step || 1, vat: op.v != null ? op.v : 13, perish: !op.np, emoji: ce, hist: [[Date.now(), pr]], created: Date.now(), draft: true };
      if (op.d) st.products[id].desc = op.d;
      cat.kids.push({ id: newId(), t: "p", pid: id, size: "m" });
      count++;
    }
    return cat;
  };
  for (const [cn, ce, items] of P.c) { const cat = build(cn, ce, items); if (cat.kids.length) target.push(cat); }
  ed.view = "list"; ed.marked.clear(); ed.q = "";
  A.save({ catalog: true }); A.closeSheet(); A.render(); window.scrollTo(0, 0);
  A.toast("✓ Μπήκαν " + count + " ενδεικτικά προϊόντα. Δεν τα βλέπουν οι πελάτες μέχρι να ελέγξεις τιμές και να πατήσεις «Ενεργοποίηση».", 6000);
}

/* ---------- σύρσιμο με το δάχτυλο για αλλαγή σειράς ---------- */
let suppressClick = 0;
function bindDrag(grid) {
  if (!grid) return;
  let timer = null, drag = null, sx = 0, sy = 0, scrollT = null, lockUntil = 0, lastX = 0, lastY = 0;
  const tiles = () => [...grid.querySelectorAll(".tile")];
  /* ομαλή μετακίνηση των υπόλοιπων κουμπιών (τεχνική «πρώτα-τελευταία») */
  const flip = change => {
    const before = new Map(tiles().map(t => [t, t.getBoundingClientRect()]));
    change();
    for (const t of tiles()) {
      if (t === drag.el) continue;
      const o = before.get(t); if (!o) continue;
      const n = t.getBoundingClientRect(), dx = o.left - n.left, dy = o.top - n.top;
      if (!dx && !dy) continue;
      t.style.transition = "none"; t.style.transform = `translate(${dx}px,${dy}px)`;
      requestAnimationFrame(() => requestAnimationFrame(() => { t.style.transition = "transform .18s ease"; t.style.transform = ""; }));
    }
  };
  const start = (tile, x, y) => {
    const r = tile.getBoundingClientRect();
    drag = { id: tile.dataset.node, el: tile, moved: false, dx: x - r.left, dy: y - r.top };
    const g = tile.cloneNode(true); g.classList.add("ghost-tile"); g.classList.remove("marked");
    g.style.width = r.width + "px"; g.style.height = r.height + "px";
    drag.ghost = g; document.body.appendChild(g);
    tile.classList.add("dragging");
    move(x, y);
    try { navigator.vibrate && navigator.vibrate(25); } catch {}
  };
  const reorderAt = (x, y) => {
    if (Date.now() < lockUntil) return;
    drag.ghost.style.display = "none";
    const under = document.elementFromPoint(x, y);
    drag.ghost.style.display = "";
    const t = under && under.closest("#edGrid .tile");
    if (!t || t === drag.el) return;
    const r = t.getBoundingClientRect();
    const wide = r.width > grid.clientWidth * 0.8;
    const after = wide ? y > r.top + r.height / 2 : x > r.left + r.width / 2;
    const ref = after ? t.nextElementSibling : t;
    if (ref === drag.el || (ref && ref.previousElementSibling === drag.el && !after)) return;
    if (!after && t.previousElementSibling === drag.el) return;
    if (after && t.nextElementSibling === drag.el) return;
    flip(() => grid.insertBefore(drag.el, ref));
    drag.moved = true; lockUntil = Date.now() + 160;
  };
  const move = (x, y) => {
    lastX = x; lastY = y;
    drag.ghost.style.left = (x - drag.dx) + "px"; drag.ghost.style.top = (y - drag.dy) + "px";
    reorderAt(x, y);
    clearInterval(scrollT);
    const edge = 70, H = window.innerHeight;
    if (y < edge) scrollT = setInterval(() => { window.scrollBy(0, -10); reorderAt(lastX, lastY); }, 16);
    else if (y > H - edge - 60) scrollT = setInterval(() => { window.scrollBy(0, 10); reorderAt(lastX, lastY); }, 16);
  };
  const end = () => {
    clearTimeout(timer); clearInterval(scrollT);
    if (!drag) return;
    const d = drag; drag = null;
    /* το κουμπί «προσγειώνεται» στη νέα του θέση */
    const r = d.el.getBoundingClientRect();
    d.ghost.style.transition = "left .15s ease, top .15s ease, transform .15s ease, opacity .15s";
    d.ghost.style.left = r.left + "px"; d.ghost.style.top = r.top + "px"; d.ghost.style.transform = "scale(1)";
    setTimeout(() => {
      d.ghost.remove(); d.el.classList.remove("dragging");
      if (d.moved) {
        const L = curList();
        const order = [...grid.querySelectorAll(".tile")].map(t => t.dataset.node);
        const group = ed.marked.has(d.id) && ed.marked.size > 1 ? L.filter(n => ed.marked.has(n.id) && n.id !== d.id).map(n => n.id) : [];
        let ids = order.filter(id => !group.includes(id));
        const at = ids.indexOf(d.id); ids.splice(at + 1, 0, ...group);
        const byId = new Map(L.map(n => [n.id, n]));
        const sorted = ids.map(id => byId.get(id)).filter(Boolean);
        for (const n of L) if (!sorted.includes(n)) sorted.push(n);
        L.splice(0, L.length, ...sorted);
        A.save({ catalog: true });
      }
      suppressClick = Date.now();
      A.render();
    }, 160);
  };
  const tileOf = e => { const t = e.target.closest(".tile"); return t && !e.target.closest(".mk") ? t : null; };
  grid.addEventListener("touchstart", e => {
    const t = tileOf(e); if (!t || e.touches.length > 1) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    timer = setTimeout(() => start(t, sx, sy), 350);
  }, { passive: true });
  grid.addEventListener("touchmove", e => {
    const p = e.touches[0];
    if (drag) { e.preventDefault(); move(p.clientX, p.clientY); return; }
    if (Math.abs(p.clientX - sx) > 10 || Math.abs(p.clientY - sy) > 10) clearTimeout(timer);
  }, { passive: false });
  grid.addEventListener("touchend", e => { if (drag) e.preventDefault(); end(); });
  grid.addEventListener("touchcancel", end);
  grid.addEventListener("contextmenu", e => { if (e.target.closest(".tile")) e.preventDefault(); });
  grid.addEventListener("mousedown", e => {
    const t = tileOf(e); if (!t || e.button !== 0) return;
    sx = e.clientX; sy = e.clientY;
    timer = setTimeout(() => start(t, sx, sy), 300);
    const mm = ev => { if (drag) move(ev.clientX, ev.clientY); else if (Math.abs(ev.clientX - sx) > 8 || Math.abs(ev.clientY - sy) > 8) clearTimeout(timer); };
    const mu = () => { document.removeEventListener("mousemove", mm); document.removeEventListener("mouseup", mu); end(); };
    document.addEventListener("mousemove", mm); document.addEventListener("mouseup", mu);
  });
}

/* ---------- φόρμες ---------- */
function emojiPicker(cur) { return `<div class="emojis" id="emPick"><button type="button" data-em="" class="${!cur ? "on" : ""}" style="font-size:13px">κανένα</button>${EMOJIS.map(e => `<button type="button" data-em="${e}" class="${e === cur ? "on" : ""}">${e}</button>`).join("")}</div>`; }
function colorPicker(cur) { return `<div class="colors" id="colPick">${TILE_COLORS.map(c => `<button type="button" data-tc="${c}" class="${c === (cur || "") ? "on" : ""}" style="background:${c || "linear-gradient(135deg,#fff 45%,#d33 46%,#d33 54%,#fff 55%)"}" aria-label="${c || "προεπιλογή"}"></button>`).join("")}</div>`; }
function sizePicker(cur) { return `<div class="chips" id="szPick" style="flex-wrap:wrap">${Object.entries(K.SIZES).map(([k, v]) => `<button type="button" class="chip${k === (cur || "m") ? " on" : ""}" data-sz="${k}">${v}</button>`).join("")}</div>`; }
function pickBind(el) {
  el.querySelectorAll("#emPick,#colPick,#szPick").forEach(g => g.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    g.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
    if (g.id === "emPick") { const i = el.querySelector("#emFree"); if (i) i.value = b.dataset.em; }
  }));
}
const picked = id => { const b = document.querySelector("#" + id + " button.on"); return b ? (b.dataset.em ?? b.dataset.tc ?? b.dataset.sz) : ""; };

function catOptsHTML(sel, top) { const o = []; const w = (L, d) => { for (const n of L) if (n.t === "c") { o.push(`<option value="${n.id}"${n.id === sel ? " selected" : ""}>${"— ".repeat(d)}${esc((n.emoji ? n.emoji + " " : "") + (n.name || "Χωρίς όνομα"))}</option>`); w(n.kids || [], d + 1); } }; w(S().menu, 0); return `<option value=""${sel === "" ? " selected" : ""}>${top}</option>` + o.join(""); }
function subtreeCount(node) { let cats = 0; const pids = new Set(); const w = L => { for (const n of L || []) { if (n.t === "c") { cats++; w(n.kids); } else if (n.t === "p") pids.add(n.pid); } }; w(node.kids); return { cats, prods: pids.size, pids }; }
function catSheet(node, parentId) {
  const isNew = !node;
  node = node || { name: "", emoji: "", color: "", size: "m" };
  A.sheet(isNew ? (ed.path.length ? "Νέα υποκατηγορία" : "Νέα κατηγορία") : "📁 «" + (node.name || "Κατηγορία") + "»", `
   ${isNew ? `<div class="card"><label class="f" for="cPar">Πού μπαίνει</label><select class="t" id="cPar">${catOptsHTML(parentId != null ? parentId : ed.view === "menu" && curCat() ? curCat().id : "", "🏠 Στην αρχική (κύρια κατηγορία)")}</select><p class="note" style="margin-bottom:0">Αν διαλέξεις μια κατηγορία, η νέα γίνεται υποκατηγορία της.</p></div>` : ""}
   <div class="card"><label class="f" for="cName">Όνομα ${isNew ? "κατηγορίας" : "κουμπιού"}</label><input class="t" id="cName" value="${esc(node.name)}" maxlength="40" placeholder="π.χ. Αυγά">
    <label class="f">Εικονίδιο</label>${emojiPicker(node.emoji)}<input class="t" id="emFree" value="${esc(node.emoji || "")}" maxlength="4" placeholder="ή γράψε δικό σου" style="margin-top:6px;width:150px">
    <label class="f">Μέγεθος κουμπιού</label>${sizePicker(node.size)}
    <label class="f">Χρώμα κουμπιού</label>${colorPicker(node.color)}</div>
   ${!isNew ? (() => { const c = subtreeCount(node); return `<div class="card"><h3 style="margin-top:0">Διαγραφή</h3>
    <button type="button" class="btn red wide" data-ea="catDelAll">🗑 Διαγραφή της κατηγορίας${c.prods || c.cats ? " με όλα όσα έχει μέσα" : ""}</button>
    <p class="note">${c.prods || c.cats ? "Σβήνονται " + (c.cats ? c.cats + (c.cats === 1 ? " υποκατηγορία και " : " υποκατηγορίες και ") : "") + c.prods + (c.prods === 1 ? " προϊόν" : " προϊόντα") + ". " : ""}Πριν τη διαγραφή κρατιέται αντίγραφο και μπορείς να την αναιρέσεις. Οι παλιές παραγγελίες δεν αλλάζουν.</p>
    ${c.prods || c.cats ? `<details><summary class="note" style="cursor:pointer">Θέλω να κρατήσω τα προϊόντα</summary><button type="button" class="btn soft wide" data-ea="catDel" style="margin-top:6px">Σβήσε μόνο τον φάκελο</button><p class="note">Ό,τι έχει μέσα ανεβαίνει ένα επίπεδο πάνω.</p></details>` : ""}</div>`; })() : ""}`,
   `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-ea="catSave">Αποθήκευση</button>`,
   el => { pickBind(el); el.dataset.node = isNew ? "" : node.id; });
}
function catSave() {
  const name = $("#cName").value.trim(); if (!name) { A.toast("Γράψε όνομα."); return; }
  const id = $("#shB").dataset.node;
  const v = { name, emoji: $("#emFree").value.trim(), size: picked("szPick") || "m", color: picked("colPick") };
  if (id) Object.assign(K.findNode(S().menu, id).node, v);
  else { const par = $("#cPar") ? $("#cPar").value : null; const L = par == null ? curList() : par ? (K.findNode(S().menu, par).node.kids = K.findNode(S().menu, par).node.kids || []) : S().menu;
    const nc = Object.assign({ id: newId(), t: "c", kids: [] }, v); if (L === S().menu) { let lc = -1; L.forEach((n, i) => { if (n.t === "c") lc = i; }); L.splice(lc + 1, 0, nc); } else L.push(nc);
    if (ed.view === "list") A.toast("✓ Νέα κατηγορία «" + name + "». Πάτα «＋ Προσθήκη» μέσα της.", 3500); }
  A.save({ catalog: true }); A.closeSheet(); A.render();
}

/* επιπλέον ρυθμίσεις προϊόντος: απόθεμα, ελάχιστη ποσότητα, εποχή, κωδικός, χονδρική, κλιμακωτές τιμές, αποκλειστικό */
function moreHTML(x) {
  const st = S(), av = x.id ? K.avail(x, st.orders) : Infinity, stOn = x.stock != null && x.stock !== "";
  const tiers = (x.tiers || []).concat([[], [], []]).slice(0, 3);
  const custs = Object.values(st.customers || {}).sort((a, b) => (a.name || "").localeCompare(b.name || "", "el"));
  const sea = Array.isArray(x.season) ? x.season : [];
  const any = stOn || +x.min > 0 || x.code || (sea.length && sea.length < 12) || +x.whole > 0 || (x.tiers || []).length || x.only;
  return `<details class="card"${any ? " open" : ""}><summary style="cursor:pointer;font-weight:800">⚙️ Απόθεμα, ελάχιστη ποσότητα, εποχή, κωδικός, χονδρική, εκπτώσεις</summary>
    <h3 style="margin:12px 0 4px">📦 Απόθεμα</h3>
    <label class="ck"><input type="checkbox" id="pStOn"${stOn ? " checked" : ""}><span>Μετράω απόθεμα: όταν τελειώσει, ο πελάτης δεν μπορεί να το παραγγείλει</span></label>
    <div id="pStBox" style="${stOn ? "" : "display:none"}"><label class="f" for="pStock">Διαθέσιμη ποσότητα τώρα (${esc(x.unit || "τεμ.")})</label><input class="t" id="pStock" inputmode="decimal" value="${stOn ? K.num(Math.max(0, av)) : ""}" data-was="${stOn ? K.num(Math.max(0, av)) : ""}" placeholder="π.χ. 120">
     <p class="note" style="margin:4px 0 0">Αφαιρείται μόνο του με κάθε παραγγελία και επιστρέφει αν την ακυρώσεις. Όταν ξαναγεμίσεις, γράψε εδώ τη νέα ποσότητα.</p></div>
    <h3 style="margin:14px 0 4px">🧾 Παραγγελία</h3>
    <div class="two"><div><label class="f" for="pMin">Ελάχιστη ποσότητα</label><input class="t" id="pMin" inputmode="decimal" value="${+x.min > 0 ? K.num(x.min) : ""}" placeholder="καμία"></div>
     <div><label class="f" for="pCode">Κωδικός προϊόντος</label><input class="t" id="pCode" value="${esc(x.code || "")}" maxlength="30" placeholder="π.χ. ΑΥΓ-12"></div></div>
    <label class="f">Εποχικό: μήνες που το έχεις (κανένας = όλο τον χρόνο)</label>
    <div class="chips" id="pSea" style="flex-wrap:wrap">${K.MONTHS.map((m, i) => `<button type="button" class="chip${sea.includes(i + 1) && sea.length < 12 ? " on" : ""}" data-mo="${i + 1}">${m}</button>`).join("")}</div>
    <h3 style="margin:14px 0 4px">💶 Τιμές για πελάτες</h3>
    <label class="f" for="pWh">Τιμή χονδρικής (για πελάτες «χονδρικής»)</label><input class="t" id="pWh" inputmode="decimal" value="${+x.whole > 0 ? K.num(x.whole) : ""}" placeholder="ίδια με τη λιανική">
    <label class="f">Έκπτωση ποσότητας</label>
    ${tiers.map((t, i) => `<div class="two" style="margin-top:4px"><div><input class="t" data-tq="${i}" inputmode="decimal" value="${t[0] ? K.num(t[0]) : ""}" placeholder="από ποσότητα"></div><div><input class="t" data-tp="${i}" inputmode="decimal" value="${t[1] ? K.num(t[1]) : ""}" placeholder="τιμή μονάδας €"></div></div>`).join("")}
    <p class="note" style="margin:4px 0 0">Π.χ. από 10 → 4,00 €. Ο πελάτης βλέπει την έκπτωση και πληρώνει τη χαμηλότερη τιμή που του αναλογεί.</p>
    <label class="ck" style="margin-top:10px"><input type="checkbox" id="pOnly"${x.only ? " checked" : ""}><span>Μόνο για επιλεγμένους πελάτες (δεν φαίνεται στον κοινό σύνδεσμο)</span></label>
    <div id="pOnlyBox" style="${x.only ? "" : "display:none"}">${custs.length ? custs.map(c => `<label class="ck"><input type="checkbox" data-onlyc="${esc(c.key)}"${(x.onlyFor || []).includes(c.key) ? " checked" : ""}><span>${esc(c.name || c.phone)}</span></label>`).join("") : `<p class="note">Δεν έχεις πελάτες ακόμα.</p>`}<p class="note" style="margin:4px 0 0">Οι επιλεγμένοι το βλέπουν στον προσωπικό τους σύνδεσμο (Πελάτες › πελάτης › «📤 Στείλε του τον κατάλογο»).</p></div>
  </details>`;
}
function prodSheet(pid, nodeId) {
  const st = S(), p = pid ? st.products[pid] : null;
  if (!p && activeCount() >= A.FREE_PRODUCTS && !A.proGate("products")) return;
  const x = p || { name: "", unit: "τεμ.", price: "", step: 1, vat: 13, perish: true, emoji: (curCat() || {}).emoji || "" };
  const node = nodeId ? K.findNode(st.menu, nodeId).node : null;
  const unitKnown = K.UNITS.includes(x.unit);
  A.sheet(p ? "Προϊόν" : "Νέο προϊόν", `
   ${!p ? (() => { const def = A._addTo != null ? A._addTo : ed.view === "menu" ? (curCat() ? curCat().id : "") : ((S().menu.find(n => n.t === "c") || {}).id || ""); return `<div class="card"><label class="f" for="pCat">Κατηγορία</label><select class="t" id="pCat">${catOptsHTML(def, "🏠 Χωρίς κατηγορία (στην αρχική)")}<option value="+">＋ Νέα κατηγορία…</option></select><input class="t" id="pCatNew" maxlength="40" placeholder="Όνομα νέας κατηγορίας, π.χ. Αυγά" style="margin-top:6px;display:none"></div>`; })() : ""}
   ${p && p.draft ? `<div class="warnbox" style="margin-top:0"><b>📝 Ενδεικτικό προϊόν από έτοιμο κατάλογο.</b> Δεν το βλέπουν οι πελάτες. Έλεγξε όνομα και τιμή και άναψε το «Ενεργό».<label class="ck" style="margin-top:6px"><input type="checkbox" id="pAct"><span>Ενεργό: να το βλέπουν οι πελάτες</span></label></div>` : ""}
   <div class="card"><label class="f" for="pN">Όνομα προϊόντος</label><input class="t" id="pN" value="${esc(x.name)}" maxlength="60" placeholder="π.χ. Αυγά ελευθέρας βοσκής">
    <div class="two"><div><label class="f" for="pP">💶 Τιμή (€)</label><input class="t" id="pP" inputmode="decimal" value="${x.price !== "" ? K.num(x.price) : ""}" placeholder="0,00" style="font-size:22px;font-weight:800;border-color:var(--accent)"></div>
     <div><label class="f" for="pU">Μονάδα</label><select class="t" id="pU">${K.UNITS.map(u => `<option${u === x.unit ? " selected" : ""}>${u}</option>`).join("")}<option value="*"${unitKnown ? "" : " selected"}>Άλλη…</option></select></div></div>
    <input class="t" id="pU2" value="${unitKnown ? "" : esc(x.unit)}" placeholder="Γράψε μονάδα" maxlength="20" style="margin-top:6px;${unitKnown ? "display:none" : ""}">
    <div class="two"><div><label class="f" for="pS">Βήμα ποσότητας (κάθε «+»)</label><input class="t" id="pS" inputmode="decimal" list="pSl" value="${K.num(+x.step || 1)}"><datalist id="pSl">${[1, 0.5, 0.25, 0.1, 2, 5, 6, 10, 12].map(v => `<option value="${K.num(v)}">`).join("")}</datalist></div>
     <div><label class="f" for="pSP">Τιμή ανά βήμα (€)</label><input class="t" id="pSP" inputmode="decimal" value="${x.price !== "" ? ((+x.price || 0) * (+x.step || 1)).toFixed(2).replace(".", ",") : ""}" placeholder="0,00"></div></div>
    <p class="note" id="pSN" style="margin:4px 0 0"></p>
    <div class="two"><div style="display:none"></div>
     <div><label class="f" for="pV">ΦΠΑ</label><select class="t" id="pV">${[13, 24, 6, 0].map(v => `<option value="${v}"${+x.vat === v ? " selected" : ""}>${v}%</option>`).join("")}</select></div></div>
    <label class="f" for="pD">Σύντομη περιγραφή</label><input class="t" id="pD" value="${esc(x.desc || "")}" maxlength="80" placeholder="π.χ. από κότες που βόσκουν ελεύθερες">
    <label class="f">Φωτογραφία</label><div class="row"><div id="pPhPrev">${x.photo ? `<img src="${esc(x.photo)}" style="width:64px;height:64px;border-radius:12px;object-fit:cover">` : `<span class="note">Χωρίς φωτογραφία</span>`}</div><label class="btn soft sm">📷 Επιλογή<input type="file" accept="image/*" id="pPh" hidden></label>${x.photo ? `<button type="button" class="btn soft sm" data-ea="phDel">Αφαίρεση</button>` : ""}</div>
    <p class="note">Μόνο δικές σου φωτογραφίες ή με άδεια χρήσης.</p>
    <label class="f">Εικονίδιο (αν δεν υπάρχει φωτογραφία)</label>${emojiPicker(x.emoji)}<input class="t" id="emFree" value="${esc(x.emoji || "")}" maxlength="4" style="margin-top:6px;width:150px">
    <label class="f" for="pK">Άλλες λέξεις που γράφουν οι πελάτες (για τα μηνύματα Viber)</label><input class="t" id="pK" value="${esc(x.keys || "")}" maxlength="100" placeholder="π.χ. αυγουλάκια, φρέσκα"></div>
   <div class="card"><div class="sw"><span id="pAvL" style="font-weight:800;color:${x.soldout ? "var(--bad)" : "var(--ok)"}">${x.soldout ? "❌ Εξαντλήθηκε" : "✅ Διαθέσιμο"}</span><label class="tog g av"><input type="checkbox" id="pAv"${x.soldout ? "" : " checked"}><span></span></label></div>
    <div id="pSoQ" class="warnbox" style="display:none;margin:6px 0"><b>Τι να βλέπουν οι πελάτες;</b><div class="row" style="margin-top:6px"><button type="button" class="btn sm soft grow" data-soq="show">👁 «Εξαντλήθηκε»</button><button type="button" class="btn sm amber grow" data-soq="hide">🙈 Να εξαφανιστεί</button></div></div>
    <div class="sw"><span>Κρυφό (δεν φαίνεται στον πελάτη)</span><label class="tog"><input type="checkbox" id="pHi"${x.hidden ? " checked" : ""}><span></span></label></div>
    <div class="sw"><span>Τρόφιμο που αλλοιώνεται γρήγορα</span><label class="tog g"><input type="checkbox" id="pPe"${x.perish !== false ? " checked" : ""}><span></span></label></div>
    <p class="note">Για τα ευπαθή τρόφιμα ο πελάτης ενημερώνεται ότι δεν ισχύει το δικαίωμα υπαναχώρησης.</p></div>
   ${moreHTML(x)}
   ${node ? `<div class="card"><h3>Το κουμπί στο μενού</h3><label class="f" for="nName">Όνομα στο κουμπί (κενό = όνομα προϊόντος)</label><input class="t" id="nName" value="${esc(node.name || "")}" maxlength="40">
    <label class="f">Μέγεθος</label>${sizePicker(node.size)}<label class="f">Χρώμα</label>${colorPicker(node.color)}</div>` : ""}
   ${p && node ? `<div class="card"><h3>📦 Μεγέθη ή παραλλαγές</h3><p class="note" style="margin-top:0">Θέλεις και άλλο προϊόν μέσα σε αυτό; π.χ. «Μέλι» σε 500 γρ. και 1 κιλό, ή «Αυγά» σε δωδεκάδα και θήκη 30. Το κουμπί γίνεται κατηγορία «${esc(x.name)}» και μέσα της μπαίνουν τα μεγέθη, το καθένα με δική του τιμή.</p><button type="button" class="btn amber wide" data-ea="toVariants">＋ Πρόσθεσε μέγεθος ή παραλλαγή</button></div>` : ""}
   ${p ? `<button type="button" class="btn red wide" data-ea="prodDel">Διαγραφή προϊόντος</button>${(p.hist || []).length > 1 ? `<details class="card" style="margin-top:12px"><summary style="cursor:pointer;font-weight:700">Ιστορικό τιμών</summary>${p.hist.slice().reverse().map(([t, v]) => `<div class="note">${new Date(t).toLocaleString("el-GR")} · ${K.money(v)}</div>`).join("")}</details>` : ""}` : ""}
   <div id="pErr"></div>`,
   `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-ea="prodSave">Αποθήκευση</button>`,
   el => {
     pickBind(el); el.dataset.pid = pid || ""; el.dataset.hidBySo = x.hidBySo ? "1" : ""; el.dataset.node = nodeId || "";
     el.querySelector("#pU").addEventListener("change", e => { el.querySelector("#pU2").style.display = e.target.value === "*" ? "" : "none"; syncStep("u"); });
     const syncStep = from => { const P = el.querySelector("#pP"), St = el.querySelector("#pS"), SP = el.querySelector("#pSP"), N = el.querySelector("#pSN");
       const pr = K.parseNum(P.value), st = K.parseNum(St.value), sp = K.parseNum(SP.value);
       if (from === "sp" && isFinite(sp) && isFinite(st) && st > 0) P.value = (sp / st).toFixed(2).replace(".", ",");
       else if (isFinite(pr) && isFinite(st) && st > 0 && from !== "sp") SP.value = (pr * st).toFixed(2).replace(".", ",");
       const pr2 = K.parseNum(P.value), unit = el.querySelector("#pU").value === "*" ? el.querySelector("#pU2").value : el.querySelector("#pU").value;
       N.textContent = isFinite(pr2) && isFinite(st) && st > 0 ? "Κάθε «+» του πελάτη προσθέτει " + K.num(st) + " " + unit + " = " + K.money(pr2 * st) + " (τιμή μονάδας " + K.money(pr2) + " / " + unit + ")" : ""; };
     el.querySelector("#pP").addEventListener("input", () => syncStep("p"));
     el.querySelector("#pS").addEventListener("input", () => syncStep("s"));
     el.querySelector("#pSP").addEventListener("input", () => syncStep("sp"));
     syncStep("p");
     el.querySelector("#pPh").addEventListener("change", async e => { const f = e.target.files[0]; if (!f) return; try { const d = await K.shrinkImage(f, 200, 0.72); el.dataset.photo = d; el.querySelector("#pPhPrev").innerHTML = `<img src="${d}" style="width:64px;height:64px;border-radius:12px;object-fit:cover">`; } catch { A.toast("Η εικόνα δεν άνοιξε."); } });
   });
}
function prodSave() {
  const st = S(), b = $("#shB");
  const name = $("#pN").value.trim(), price = K.parseNum($("#pP").value);
  const err = m => { $("#pErr").innerHTML = `<div class="errbox">${esc(m)}</div>`; };
  if (!name) return err("Γράψε όνομα προϊόντος.");
  if (!isFinite(price) || price < 0 || price > 100000) return err("Γράψε σωστή τιμή.");
  const unit = $("#pU").value === "*" ? ($("#pU2").value.trim() || "τεμ.") : $("#pU").value;
  let pid = b.dataset.pid, p = pid && st.products[pid];
  const now = Date.now();
  const wantAct = !!($("#pAct") && $("#pAct").checked);
  if (wantAct) { if (!(price > 0)) return err("Βάλε τιμή πριν το ενεργοποιήσεις."); if (!canActivate(1)) return; }
  if (!p) { pid = "p" + K.uid(5); p = st.products[pid] = { id: pid, hist: [], created: now }; }
  const old = p.price;
  Object.assign(p, { name, unit, price: K.round2(price), step: (() => { const v = K.parseNum($("#pS").value); return isFinite(v) && v > 0 ? Math.round(v * 1000) / 1000 : 1; })(), vat: +$("#pV").value, desc: $("#pD").value.trim(), emoji: $("#emFree").value.trim(), keys: $("#pK").value.trim(), soldout: !$("#pAv").checked, hidden: $("#pHi").checked, perish: $("#pPe").checked });
  if (p.hidden && b.dataset.hidBySo === "1") p.hidBySo = true; else delete p.hidBySo;
  /* επιπλέον ρυθμίσεις */
  const num = id => { const e = $(id); if (!e) return NaN; return K.parseNum(e.value); };
  if ($("#pStOn")) {
    if ($("#pStOn").checked) { const v = num("#pStock"), was = $("#pStock").dataset.was;
      if (isFinite(v) && v >= 0 && (p.stock == null || p.stock === "" || $("#pStock").value.trim() !== was)) { p.stock = Math.round(v * 1000) / 1000; p.stockAt = now; } }
    else { delete p.stock; delete p.stockAt; }
    const mn = num("#pMin"); if (isFinite(mn) && mn > 0) p.min = mn; else delete p.min;
    const code = $("#pCode").value.trim(); if (code) p.code = code; else delete p.code;
    const mo = [...document.querySelectorAll("#pSea [data-mo].on")].map(x => +x.dataset.mo); if (mo.length && mo.length < 12) p.season = mo; else delete p.season;
    const wh = num("#pWh"); if (isFinite(wh) && wh > 0) p.whole = K.round2(wh); else delete p.whole;
    const tiers = []; for (let i = 0; i < 3; i++) { const q = num(`[data-tq="${i}"]`), pr = num(`[data-tp="${i}"]`); if (isFinite(q) && q > 0 && isFinite(pr) && pr > 0) tiers.push([q, K.round2(pr)]); }
    if (tiers.length) p.tiers = tiers.sort((a, c) => a[0] - c[0]); else delete p.tiers;
    if ($("#pOnly").checked) { p.only = true; p.onlyFor = [...document.querySelectorAll("[data-onlyc]:checked")].map(x => x.dataset.onlyc); } else { delete p.only; delete p.onlyFor; }
  }
  if (wantAct) delete p.draft;
  if (b.dataset.photo) p.photo = b.dataset.photo;
  if (b.dataset.phDel) p.photo = "";
  if (old !== p.price) p.hist.push([now, p.price]);
  if (b.dataset.node) {
    const n = K.findNode(st.menu, b.dataset.node).node;
    const nn = $("#nName").value.trim();
    n.name = nn && nn !== p.name ? nn : ""; n.size = picked("szPick") || "m"; n.color = picked("colPick");
  } else if (!productInMenu(pid)) {
    const pc = $("#pCat");
    if (pc) {
      let dest;
      if (pc.value === "+") { const nm = ($("#pCatNew").value || "").trim() || "Διάφορα"; const nc = { id: newId(), t: "c", name: nm, emoji: p.emoji || "", size: "m", kids: [] }; let lc = -1; st.menu.forEach((n, i) => { if (n.t === "c") lc = i; }); st.menu.splice(lc + 1, 0, nc); dest = nc.kids; }
      else if (pc.value) { const f = K.findNode(st.menu, pc.value); dest = f ? (f.node.kids = f.node.kids || []) : st.menu; }
      else dest = st.menu;
      dest.push({ id: newId(), t: "p", pid, size: "m" });
    } else {
    const tgt = A._addTo != null ? (A._addTo ? (K.findNode(st.menu, A._addTo) || {}).node : null) : null;
    ((tgt && tgt.kids) || (A._addTo === "" ? st.menu : null) || (ed.view === "menu" ? curList() : st.menu)).push({ id: newId(), t: "p", pid, size: "m" });
    }
    A._addTo = null;
  }
  A.save({ catalog: true }); A.closeSheet(); A.render(); A.toast("✓ Αποθηκεύτηκε");
}
function setPrice(pid, v) {
  const p = S().products[pid]; const x = K.parseNum(v);
  if (!p || !isFinite(x) || x < 0) { A.toast("Λάθος τιμή."); A.render(); return; }
  const n = K.round2(x); if (n === p.price) return;
  p.price = n; (p.hist || (p.hist = [])).push([Date.now(), n]);
  A.save({ catalog: true }); A.toast("✓ " + p.name + ": " + K.money(n));
}
function addSheet() {
  const here = curList(), inHere = new Set(here.filter(n => n.t === "p").map(n => n.pid));
  const others = liveProducts().filter(p => !inHere.has(p.id));
  A.sheet("Νέο κουμπί", `<div class="card list">
   <div class="it" data-ea="addCat"><div class="ic">📁</div><div class="t"><b>${ed.path.length ? "Υποκατηγορία μέσα στο «" + esc(curCat().name) + "»" : "Κατηγορία"}</b><span>Κουμπί που ανοίγει και έχει μέσα άλλα κουμπιά. Μπορείς να βάλεις υποκατηγορίες μέσα σε υποκατηγορίες, όσα επίπεδα θέλεις.</span></div></div>
   <div class="it" data-ea="addProd"><div class="ic">🛒</div><div class="t"><b>Νέο προϊόν</b><span>Με τιμή, μονάδα και κουμπιά − και +</span></div></div>
   <div class="it" data-xl="open"><div class="ic">📊</div><div class="t"><b>Όλος ο κατάλογος από Excel</b><span>Κατέβασε πρότυπο, γράψε κατηγορίες, προϊόντα και τιμές, ανέβασέ το</span></div></div>
   <div class="it" data-ea="presets"><div class="ic">📋</div><div class="t"><b>Έτοιμο μενού από επάγγελμα</b><span>${Object.keys(PRESETS).length} επαγγέλματα: αυγά, γάλα, τυριά, ψάρια, φούρνος, νερά…</span></div></div></div>
   ${others.length ? `<div class="card list"><h3>Υπάρχον προϊόν και εδώ</h3>${others.map(p => `<div class="it" data-addex="${p.id}"><div class="ic">${esc(p.emoji || "📦")}</div><div class="t"><b>${esc(p.name)}</b><span>${K.money(p.price)} / ${esc(p.unit)}${productInMenu(p.id) ? "" : " · δεν είναι στο μενού"}</span></div></div>`).join("")}</div>` : ""}`);
}
function moveToSheet() {
  const ids = new Set(ed.marked), opts = [];
  const walk = (L, depth, trail) => { for (const n of L) if (n.t === "c" && !ids.has(n.id)) { opts.push({ id: n.id, label: "— ".repeat(depth) + (n.emoji ? n.emoji + " " : "") + n.name, trail: trail.concat(n.id) }); walk(n.kids || [], depth + 1, trail.concat(n.id)); } };
  walk(S().menu, 0, []);
  A.sheet("Μετακίνηση σε…", `<div class="card list"><div class="it" data-mvto=""><div class="ic">🏠</div><div class="t"><b>Αρχική</b></div></div>${opts.map(o => `<div class="it" data-mvto="${o.id}"><div class="ic">📁</div><div class="t"><b>${esc(o.label)}</b></div></div>`).join("")}</div>`);
}
function moveTo(targetId) {
  const st = S(), L = curList();
  const moving = L.filter(n => ed.marked.has(n.id));
  const dest = targetId ? K.findNode(st.menu, targetId).node.kids : st.menu;
  if (dest === L) { A.closeSheet(); return; }
  for (let i = L.length - 1; i >= 0; i--) if (ed.marked.has(L[i].id)) L.splice(i, 1);
  dest.push(...moving);
  ed.marked.clear(); A.save({ catalog: true }); A.closeSheet(); A.render(); A.toast("✓ Μετακινήθηκαν " + moving.length);
}
function shift(dir) {
  const L = curList(), idx = L.map((n, i) => ed.marked.has(n.id) ? i : -1).filter(i => i >= 0);
  if (dir < 0) { if (idx[0] === 0) return; for (const i of idx) [L[i - 1], L[i]] = [L[i], L[i - 1]]; }
  else { if (idx[idx.length - 1] === L.length - 1) return; for (const i of idx.reverse()) [L[i + 1], L[i]] = [L[i], L[i + 1]]; }
  A.save({ catalog: true }); A.render();
}
function delMarked() {
  const L = curList(), sel = L.filter(n => ed.marked.has(n.id));
  const cats = sel.filter(n => n.t === "c"), prods = sel.filter(n => n.t === "p");
  const pids = new Set(prods.map(n => n.pid)); let subc = 0;
  for (const c of cats) { const x = subtreeCount(c); subc += x.cats; x.pids.forEach(p => pids.add(p)); }
  const parts = [];
  if (cats.length) parts.push("• " + cats.length + (cats.length === 1 ? " κατηγορία" : " κατηγορίες") + (subc ? " με " + subc + (subc === 1 ? " υποκατηγορία" : " υποκατηγορίες") : ""));
  if (pids.size) parts.push("• " + pids.size + (pids.size === 1 ? " προϊόν" : " προϊόντα"));
  if (!confirm("Είσαι σίγουρος; Θα διαγραφούν οριστικά μαζί με όλα όσα έχουν μέσα:\n" + parts.join("\n") + "\n\nΚρατιέται αντίγραφο για αναίρεση. Οι παλιές παραγγελίες δεν αλλάζουν.")) return;
  snapshot("Διαγραφή " + sel.length + (sel.length === 1 ? " κουμπιού" : " κουμπιών"));
  for (let i = L.length - 1; i >= 0; i--) if (ed.marked.has(L[i].id)) L.splice(i, 1);
  let gone = 0; for (const pid of pids) if (!productInMenu(pid)) { delete S().products[pid]; gone++; }
  ed.marked.clear(); A.save({ catalog: true }); A.render(); A.toast("🗑 Διαγράφηκαν" + (gone ? " · " + gone + (gone === 1 ? " προϊόν" : " προϊόντα") : "") + ". Αναίρεση: Προϊόντα και τιμές.", 5000);
}
/* πριν από κάθε μεγάλη διαγραφή: αντίγραφο για αναίρεση και αντίγραφο ασφαλείας */
function snapshot(label) {
  const st = S();
  st.undoImport = { at: Date.now(), label, menu: JSON.parse(JSON.stringify(st.menu)), products: JSON.parse(JSON.stringify(st.products)) };
  try { A.backupNow && A.backupNow(); } catch {}
}
function sizeSheet() {
  A.sheet("Μέγεθος κουμπιών", `<div class="card">${sizePicker(ed.marked.size === 1 ? (curList().find(n => ed.marked.has(n.id)) || {}).size : "m")}
   <p class="note">Μικρό: τρία στη σειρά · Μεσαίο: δύο στη σειρά · Μεγάλο: όλο το πλάτος με μεγάλη εικόνα · Φαρδύ: όλο το πλάτος σε μία γραμμή.</p>
   <label class="ck"><input type="checkbox" id="szAll"><span>Σε όλα τα κουμπιά αυτού του επιπέδου</span></label></div>`,
   `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-ea="sizeGo">Εφαρμογή</button>`, el => pickBind(el));
}
function colorSheet() {
  A.sheet("Χρώμα κουμπιών", `<div class="card">${colorPicker("")}<p class="note">Το πρώτο είναι το προεπιλεγμένο (κατηγορίες με το κύριο χρώμα σου, προϊόντα λευκά).</p></div>`,
   `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-ea="colorGo">Εφαρμογή</button>`, el => pickBind(el));
}
function renameSheet() {
  const n = curList().find(x => ed.marked.has(x.id)); if (!n) return;
  if (n.t === "c") return catSheet(n);
  prodSheet(n.pid, n.id);
}

/* κουμπί «πίσω»: μαρκαρίσματα → κατηγορία πάνω → από «Προϊόντα» στο μενού */
A.menuList = function () { ed.view = "list"; ed.path = []; ed.marked.clear(); A.render(); window.scrollTo(0, 0); };
A.menuBack = function () {
  if (ed.marked.size) { ed.marked.clear(); A.render(); return true; }
  if (ed.path.length) { ed.path.pop(); window.scrollTo(0, 0); A.render(); return true; }
  if (ed.view === "list") { ed.view = "menu"; A.render(); return true; }
  return false;
};

/* ---------- πατήματα ---------- */
const EA = {
  hintOff: () => { ed.hint = false; A.render(); },
  presets: presetPicker,
  presetBack: presetPicker,
  add: addSheet,
  addCat: () => catSheet(null),
  addProd: () => { A._addTo = null; prodSheet(null, null); },
  newProd: () => { A._addTo = null; prodSheet(null, null); },
  newCat: () => catSheet(null),
  catEdit: () => catSheet(curCat()),
  catSave,
  catDel: () => {
    const id = $("#shB").dataset.node, f = K.findNode(S().menu, id); if (!f) return;
    if (!confirm("Να σβηστεί μόνο ο φάκελος «" + f.node.name + "»; Ό,τι έχει μέσα ανεβαίνει ένα επίπεδο πάνω.")) return;
    snapshot("Διαγραφή φακέλου «" + f.node.name + "»");
    const i = f.list.indexOf(f.node); f.list.splice(i, 1, ...(f.node.kids || []));
    ed.path = ed.path.slice(0, ed.path.indexOf(id) < 0 ? ed.path.length : ed.path.indexOf(id));
    A.save({ catalog: true }); A.closeSheet(); A.render();
  },
  tidy: tidySheet, tidyGo,
  catDelAll: () => {
    const id = $("#shB").dataset.node, f = K.findNode(S().menu, id); if (!f) return;
    const c = subtreeCount(f.node);
    if (!confirm("Είσαι σίγουρος; Θα διαγραφεί η κατηγορία «" + f.node.name + "»" + (c.prods || c.cats ? " και θα χαθούν όλα όσα έχει μέσα:" + (c.cats ? "\n• " + c.cats + (c.cats === 1 ? " υποκατηγορία" : " υποκατηγορίες") : "") + "\n• " + c.prods + (c.prods === 1 ? " προϊόν" : " προϊόντα") : "") + "\n\nΚρατιέται αντίγραφο για αναίρεση. Οι παλιές παραγγελίες δεν αλλάζουν.")) return;
    snapshot("Διαγραφή «" + f.node.name + "»");
    f.list.splice(f.list.indexOf(f.node), 1);
    let gone = 0; for (const pid of c.pids) if (!productInMenu(pid)) { delete S().products[pid]; gone++; }
    if (ed.path.includes(id)) ed.path = ed.path.slice(0, ed.path.indexOf(id));
    A.save({ catalog: true }); A.closeSheet(); A.render(); A.toast("🗑 Διαγράφηκε: " + f.node.name + (gone ? " και " + gone + (gone === 1 ? " προϊόν" : " προϊόντα") : "") + ". Αναίρεση: Προϊόντα και τιμές.", 5000);
  },
  emptyAll: () => {
    const st = S(), np = Object.values(st.products).filter(p => !p.del).length, nc = (function w(L) { let n = 0; for (const x of L) if (x.t === "c") n += 1 + w(x.kids || []); return n; })(st.menu);
    if (!np && !nc) { A.toast("Ο κατάλογος είναι ήδη άδειος."); return; }
    if (!confirm("Είσαι σίγουρος; Θα αδειάσει ΟΛΟΣ ο κατάλογος:\n• " + nc + " κατηγορίες\n• " + np + " προϊόντα\n\nΚρατιέται αντίγραφο για αναίρεση και γράφεται αντίγραφο ασφαλείας. Οι παραγγελίες, οι πελάτες και το ταμείο δεν αλλάζουν.")) return;
    snapshot("Άδειασμα καταλόγου");
    st.menu.splice(0); for (const k of Object.keys(st.products)) delete st.products[k]; ed.path = []; ed.marked.clear(); ed.view = "menu";
    A.save({ catalog: true }); A.closeSheet && A.closeSheet(); A.render(); window.scrollTo(0, 0);
    A.toast("✓ Ο κατάλογος άδειασε. Διάλεξε επάγγελμα ή φτιάξε τον δικό σου. Αναίρεση: Προϊόντα και τιμές.", 6000);
  },
  prodSave,
  toVariants: () => {
    const b = $("#shB"), st = S(), f = K.findNode(st.menu, b.dataset.node); if (!f) return;
    const n = f.node, p = st.products[n.pid]; if (!p) return;
    const cat = { id: newId(), t: "c", name: p.name, emoji: n.emoji || p.emoji || "", size: n.size || "m", color: n.color || "", kids: [] };
    f.list.splice(f.list.indexOf(n), 1, cat);
    n.size = "m"; n.color = ""; n.name = p.unit ? p.name + " · " + p.unit : ""; cat.kids.push(n);
    const path = K.pathTo(st.menu, cat.id); ed.path = path.map(x => x.id); ed.view = "menu"; ed.marked.clear();
    A.save({ catalog: true }); A.closeSheet(); A.render();
    setTimeout(() => { prodSheet(null, null); const i = $("#pN"); if (i) { i.value = p.name + " "; i.focus(); } A.toast("Γράψε το νέο μέγεθος και την τιμή του", 3500); }, 120);
  },
  prodDel: () => {
    const pid = $("#shB").dataset.pid, p = S().products[pid]; if (!p) return;
    if (!confirm("Οριστική διαγραφή του «" + p.name + "» από τον κατάλογο και το μενού; Οι παλιές παραγγελίες δεν αλλάζουν.")) return;
    delete S().products[pid]; removeProductEverywhere(pid); A.save({ catalog: true }); A.closeSheet(); A.render();
  },
  phDel: () => { $("#shB").dataset.phDel = "1"; delete $("#shB").dataset.photo; $("#pPhPrev").innerHTML = `<span class="note">Χωρίς φωτογραφία</span>`; },
  preview: async () => { const ok = A.shopOk(); if (!ok.ok) { A.toast("Για την προεπισκόπηση συμπλήρωσε πρώτα: " + ok.miss.join(", "), 4000); A.ACT.shop(); return; } A.openPreview(await A.makeLink()); },
  mvL: () => shift(-1), mvR: () => shift(1),
  size: sizeSheet, color: colorSheet, rename: renameSheet, moveTo: moveToSheet, del: delMarked,
  all: () => { curList().forEach(n => ed.marked.add(n.id)); A.render(); },
  unmark: () => { ed.marked.clear(); A.render(); },
  sizeGo: () => { const z = picked("szPick") || "m", all = $("#szAll").checked; curList().forEach(n => { if (all || ed.marked.has(n.id)) n.size = z; }); A.save({ catalog: true }); A.closeSheet(); A.render(); },
  colorGo: () => { const c = picked("colPick"); curList().forEach(n => { if (ed.marked.has(n.id)) n.color = c; }); A.save({ catalog: true }); A.closeSheet(); A.render(); }
};
document.addEventListener("click", e => {
  const t = e.target;
  if (Date.now() - suppressClick < 350 && t.closest("#edGrid")) { e.preventDefault(); e.stopPropagation(); return; }
  const ev = t.closest("[data-ev]"); if (ev) { ed.view = ev.dataset.ev; ed.marked.clear(); A.render(); return; }
  const cr = t.closest("[data-crumb]"); if (cr) { ed.path = ed.path.slice(0, +cr.dataset.crumb + 1); ed.marked.clear(); A.render(); return; }
  const pr = t.closest("[data-preset]"); if (pr) { presetSheet(pr.dataset.preset); return; }
  const pg = t.closest("[data-preset-go]"); if (pg) { applyPreset(pg.dataset.presetGo); return; }
  const ps = t.closest("[data-preset-swap]"); if (ps) { const st = S(), P = PRESETS[ps.dataset.presetSwap]; if (!P) return;
    if (!confirm("Να σβηστεί ο τωρινός κατάλογος και να μπει ο «" + P.n + "»; Οι παλιές παραγγελίες δεν αλλάζουν και μπορείς να το αναιρέσεις.")) return;
    snapshot("Αντικατάσταση με «" + P.n + "»");
    st.menu.splice(0); for (const k of Object.keys(st.products)) delete st.products[k]; ed.path = [];
    applyPreset(ps.dataset.presetSwap); return; }
  const mk = t.closest("#edGrid [data-mk]"); if (mk) { e.stopPropagation(); const id = mk.dataset.mk; ed.marked.has(id) ? ed.marked.delete(id) : ed.marked.add(id); A.render(); return; }
  const tile = t.closest("#edGrid .tile");
  if (tile) {
    const id = tile.dataset.node;
    if (ed.marked.size) { ed.marked.has(id) ? ed.marked.delete(id) : ed.marked.add(id); A.render(); return; }
    const n = curList().find(x => x.id === id); if (!n) return;
    if (n.t === "c") { ed.path.push(n.id); window.scrollTo(0, 0); A.render(); } else prodSheet(n.pid, n.id);
    return;
  }
  const pa = t.closest("[data-pact]"); if (pa) { activate([pa.dataset.pact]); return; }
  const paa = t.closest("[data-pactall]"); if (paa) { const v = paa.dataset.pactall, st = S();
    let ids; if (v === "*") ids = liveProducts().filter(p => p.draft).map(p => p.id);
    else { const box = paa.closest(".pgrp"); ids = box ? [...box.querySelectorAll("[data-prow]")].map(r => r.dataset.prow) : []; }
    const n = ids.filter(id => st.products[id] && st.products[id].draft).length;
    if (n && confirm(n === 1 ? "Να ενεργοποιηθεί 1 προϊόν; Θα το βλέπουν οι πελάτες με την τιμή που έχει τώρα." : "Να ενεργοποιηθούν " + n + " προϊόντα; Θα τα βλέπουν οι πελάτες με τις τιμές που έχουν τώρα.")) activate(ids); return; }
  const mo = t.closest("#pSea [data-mo]"); if (mo) { mo.classList.toggle("on"); return; }
  const sq = t.closest("[data-soq]"); if (sq) {
    if ($("#pSoQ") && $("#pSoQ").contains(sq)) { const hi = $("#pHi"); if (sq.dataset.soq === "hide") { hi.checked = true; $("#shB").dataset.hidBySo = "1"; } $("#pSoQ").style.display = "none"; A.toast(sq.dataset.soq === "hide" ? "Θα εξαφανιστεί μόλις πατήσεις Αποθήκευση" : "Θα φαίνεται «Εξαντλήθηκε»"); return; }
    const p = S().products[A._soP]; A.closeSheet(); if (p && sq.dataset.soq === "hide") { p.hidden = true; p.hidBySo = true; A.save({ catalog: true }); A.render(); A.toast("🙈 " + p.name + ": δεν φαίνεται πια στους πελάτες"); } else if (p) A.toast(p.name + ": φαίνεται «Εξαντλήθηκε»"); return; }
  const cm = t.closest("[data-cmv]"); if (cm) { catMove(cm.dataset.cmv, +cm.dataset.dir); return; }
  const ge = t.closest("[data-gedit]"); if (ge) { const f = K.findNode(S().menu, ge.dataset.gedit); if (f) catSheet(f.node); return; }
  const pm = t.closest("[data-pmove]"); if (pm) { pmoveSheet(pm.dataset.pmove, (pm.closest("[data-gcat]") || {}).dataset ? pm.closest("[data-gcat]").dataset.gcat : "!"); return; }
  const pmt = t.closest("[data-pmvto]"); if (pmt) { const m = A._pmv || {}; A.closeSheet(); moveProd(m.pid, m.from, pmt.dataset.pmvto, null, null); return; }
  const pe = t.closest("[data-pedit]"); if (pe) { prodSheet(pe.dataset.pedit, null); return; }
  const ai = t.closest("[data-addin]"); if (ai) { const id = ai.dataset.addin, f = id ? K.findNode(S().menu, id) : null, nm = f ? f.node.name : "Αρχική";
    A.sheet("＋ Μέσα στο «" + nm + "»", `<div class="bigopts"><button type="button" class="bigopt" data-addto="${esc(id)}"><span class="e">🛒</span><span class="t"><b>Νέο προϊόν</b><small>Με τιμή, μονάδα και κουμπιά − και +</small></span><span class="g">›</span></button>
      <button type="button" class="bigopt" data-addsub="${esc(id)}"><span class="e">📁</span><span class="t"><b>Νέος υποφάκελος</b><small>Υποκατηγορία μέσα στο «${esc(nm)}», π.χ. «Χάρτινα» μέσα στα «Ποτήρια»</small></span><span class="g">›</span></button></div>`); return; }
  const as = t.closest("[data-addsub]"); if (as) { catSheet(null, as.dataset.addsub); return; }
  const at = t.closest("[data-addto]"); if (at) { A._addTo = at.dataset.addto; prodSheet(null, null); const nm = at.dataset.addto ? (K.findNode(S().menu, at.dataset.addto) || {}).node : null; if (nm) setTimeout(() => { const h = $("#shT"); if (h) h.textContent = "Νέο προϊόν στο «" + nm.name + "»"; }, 0); return; }
  const pd = t.closest("[data-pdel]"); if (pd) { const p = S().products[pd.dataset.pdel]; if (p && confirm("Διαγραφή του «" + p.name + "» από τον κατάλογο; Οι παλιές παραγγελίες δεν αλλάζουν.")) { delete S().products[p.id]; removeProductEverywhere(p.id); A.save({ catalog: true }); A.render(); A.toast("Διαγράφηκε: " + p.name); } return; }
  const ax = t.closest("[data-addex]"); if (ax) { curList().push({ id: newId(), t: "p", pid: ax.dataset.addex, size: "m" }); A.save({ catalog: true }); A.closeSheet(); A.render(); return; }
  const mv = t.closest("[data-mvto]"); if (mv) { moveTo(mv.dataset.mvto); return; }
  const a = t.closest("[data-ea]"); if (a && EA[a.dataset.ea]) { e.preventDefault(); EA[a.dataset.ea](a); }
}, true);
document.addEventListener("change", e => {
  const t = e.target;
  if (t.id === "pStOn") { const b = $("#pStBox"); if (b) b.style.display = t.checked ? "" : "none"; if (t.checked) { const i = $("#pStock"); i && i.focus(); } return; }
  if (t.id === "pOnly") { const b = $("#pOnlyBox"); if (b) b.style.display = t.checked ? "" : "none"; return; }
  if (t.id === "pCat") { const i = $("#pCatNew"); if (i) { i.style.display = t.value === "+" ? "" : "none"; if (t.value === "+") i.focus(); } return; }
  if (t.id === "pAv") { const l = $("#pAvL"); if (l) { l.textContent = t.checked ? "✅ Διαθέσιμο" : "❌ Εξαντλήθηκε"; l.style.color = t.checked ? "var(--ok)" : "var(--bad)"; }
    const q = $("#pSoQ"), hi = $("#pHi"), b = $("#shB");
    if (!t.checked && hi && !hi.checked && q) q.style.display = "";
    if (t.checked) { if (q) q.style.display = "none"; if (hi && hi.checked && b.dataset.hidBySo === "1") { hi.checked = false; b.dataset.hidBySo = ""; } } }
  if (t.matches("[data-pavail]")) { const p = S().products[t.dataset.pavail]; if (p) setAvail(p, t.checked); }
  if (t.matches("[data-pprice]")) setPrice(t.dataset.pprice, t.value);
});
document.addEventListener("input", e => { if (e.target.id === "edQ") { ed.q = e.target.value; const p = e.target.selectionStart; A.render(); const i = $("#edQ"); i.focus(); i.setSelectionRange(p, p); } });
})();
