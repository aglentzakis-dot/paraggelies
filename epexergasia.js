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

/* ---------- προβολή ---------- */
A.menuView = function (m) {
  const st = S();
  const seg = `<div class="seg"><button type="button" class="${ed.view === "menu" ? "on" : ""}" data-ev="menu">🧩 Μενού πελάτη</button><button type="button" class="${ed.view === "list" ? "on" : ""}" data-ev="list">📋 Προϊόντα και τιμές</button></div>`;
  if (ed.view === "list") { m.innerHTML = seg + listHTML(); return; }
  const L = curList();
  for (const id of [...ed.marked]) if (!L.some(n => n.id === id)) ed.marked.delete(id);
  const path = ed.path.map(id => K.findNode(st.menu, id).node);
  const crumbs = `${ed.path.length ? `<div class="note" style="margin:0 2px 4px">📁 Είσαι μέσα σε κατηγορία (επίπεδο ${ed.path.length + 1}). Ό,τι προσθέσεις εδώ μπαίνει μέσα της.</div>` : ""}<div class="crumbs"><button type="button" data-crumb="-1">🏠 Αρχική</button>${path.map((n, i) => `<span class="sep">›</span><button type="button" data-crumb="${i}">${esc(n.name || "Χωρίς όνομα")}</button>`).join("")}${path.length ? `<button type="button" data-ea="catEdit" style="margin-left:auto">✏️ Ρυθμίσεις κατηγορίας</button>` : ""}</div>`;
  const empty = !st.menu.length;
  m.innerHTML = seg + crumbs +
    (ed.hint && L.length ? `<div class="note" style="margin:0 0 10px"><b>Πάτα ένα προϊόν</b> για να αλλάξεις όνομα και τιμή. <b>Πάτα μια κατηγορία</b> για να μπεις μέσα της. Πάτα <b>✓</b> για να μαρκάρεις κουμπιά (ένα ή πολλά). Κράτα πατημένο ένα κουμπί και σύρε το για να αλλάξεις σειρά. Πάτα μια κατηγορία για να μπεις μέσα. <a href="#" data-ea="hintOff">Εντάξει</a></div>` : "") +
    (empty ? presetsHTML() : "") +
    `<div class="grid" id="edGrid" style="--c1:${esc(st.shop.c1)};--c2:${esc(st.shop.c2)};--on1:${K.contrast(st.shop.c1)};--on2:${K.contrast(st.shop.c2)}">${K.tilesHTML(L, { edit: true, marked: ed.marked, prod: id => st.products[id] })}</div>
    <div class="card" style="margin:6px 0 12px;padding:12px"><div class="note" style="margin:0 0 8px">Προσθήκη ${ed.path.length ? "μέσα στο <b>«" + esc(curCat().name) + "»</b>" : "στην <b>αρχική</b>"}:</div>
     <div class="row"><button type="button" class="btn amber grow" data-ea="addProd">🛒 ＋ Προϊόν με τιμή</button><button type="button" class="btn grow" data-ea="addCat">📁 ＋ ${ed.path.length ? "Υποκατηγορία" : "Κατηγορία"}</button></div>
     <div class="row" style="margin-top:8px"><button type="button" class="btn soft sm grow" data-ea="add">Άλλα: υπάρχον προϊόν, έτοιμο μενού…</button><button type="button" class="btn ghost sm" data-ea="preview">👁 Προεπισκόπηση</button></div></div>
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
   <button type="button" class="red" data-ea="del">🗑</button><button type="button" data-ea="unmark">✕</button></div>`);
}
function listHTML() {
  const st = S(), q = K.norm(ed.q);
  const L = liveProducts().filter(p => !q || K.norm(p.name).includes(q));
  const want = new Set(L.map(p => p.id)), used = new Set();
  const prow = p => `<div class="prow">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : `<span class="pe">${esc(p.emoji || "📦")}</span>`}
     <div class="pt" data-pedit="${p.id}"><b>${esc(p.name)}</b><span>ανά ${esc(p.unit)}${p.hidden ? " · κρυφό" : ""}</span></div>
     <input class="pp" inputmode="decimal" data-pprice="${p.id}" value="${(+p.price || 0).toFixed(2).replace(".", ",")}" aria-label="Τιμή">
     <div style="display:flex;flex-direction:column;align-items:center;gap:2px;width:62px"><label class="tog g" title="Διαθέσιμο" style="flex:none"><input type="checkbox" data-pavail="${p.id}"${p.soldout ? "" : " checked"}><span></span></label><small style="font-size:11px;font-weight:700;color:${p.soldout ? "var(--bad)" : "var(--ok)"}">${p.soldout ? "Εξαντλήθηκε" : "Διαθέσιμο"}</small></div></div>`;
  /* ομάδες όπως στο μενού: «Κατηγορία › Υποκατηγορία» */
  const groups = [];
  const walk = (nodes, trail) => {
    const here = [];
    for (const n of nodes || []) {
      if (n.t === "p") { if (want.has(n.pid) && !used.has(n.pid)) { used.add(n.pid); here.push(st.products[n.pid]); } }
    }
    if (here.length) groups.push({ title: trail.map(x => (x.emoji ? x.emoji + " " : "") + x.name).join(" › ") || "🏠 Αρχική του μενού", depth: trail.length, items: here });
    for (const n of nodes || []) if (n.t === "c") walk(n.kids, trail.concat(n));
  };
  walk(st.menu, []);
  const rest = L.filter(p => !used.has(p.id));
  if (rest.length) groups.push({ title: "⚠️ Δεν είναι στο μενού", depth: 0, items: rest, warn: 1 });
  const head = `<div class="row" style="margin-bottom:10px"><input class="t grow" id="edQ" placeholder="🔍 Αναζήτηση προϊόντος" value="${esc(ed.q)}"><button type="button" class="btn amber" data-ea="newProd">＋ Νέο</button></div>
`;
  return head + (groups.length ? groups.map(g => `<div class="card" style="padding:10px 14px;border-left:5px solid ${g.warn ? "#e3a008" : "var(--accent)"}"><h3 style="margin:2px 0 4px;font-size:${g.depth > 1 ? 14.5 : 16}px">${esc(g.title)} <span class="note" style="font-weight:400">· ${g.items.length}</span></h3><div style="display:flex;gap:10px;font-size:11.5px;color:var(--mute);font-weight:700;padding:2px 0 4px;border-bottom:1px solid var(--line)"><span style="flex:1;padding-left:52px">Προϊόν</span><span style="width:84px;text-align:right">Τιμή €</span><span style="width:62px;text-align:center">Διαθέσιμο</span></div>${g.items.sort((a, b) => a.name.localeCompare(b.name, "el")).map(prow).join("")}</div>`).join("") : `<div class="card"><p class="note">Κανένα προϊόν ακόμα.</p></div>`)
    + (L.length ? `<p class="note">Πράσινος διακόπτης = <b>διαθέσιμο</b>. Κλείσ' τον όταν τελειώσει ένα προϊόν: ο πελάτης το βλέπει «Εξαντλήθηκε» και δεν μπορεί να το παραγγείλει. Η τιμή αλλάζει μόλις φύγεις από το πλαίσιο.</p>` : "");
}
/* ---------- έτοιμοι κατάλογοι ανά επάγγελμα (protypa.js) ---------- */
const PRESETS = window.PROTYPA || {};
const prodCount = P => P.c.reduce((a, c) => a + c[2].length, 0);
function presetGrid() {
  const groups = {};
  for (const [k, v] of Object.entries(PRESETS)) (groups[v.g] = groups[v.g] || []).push([k, v]);
  return Object.entries(groups).map(([g, L]) => `<h3 style="margin:12px 2px 6px;font-size:15px">${esc(g)}</h3><div class="grid">${L.map(([k, v]) =>
    `<button type="button" class="tile cat sz-s" data-preset="${k}" style="--tc:#FFF4D6;color:#1b1b1b"><span class="em">${v.e}</span><span class="nm">${esc(v.n)}</span></button>`).join("")}</div>`).join("");
}
function presetsHTML() {
  return `<div class="card"><h3>Διάλεξε το επάγγελμά σου</h3><p class="note" style="margin-top:0">Μπαίνει έτοιμο μενού με κατηγορίες και προϊόντα. Μετά αλλάζεις ό,τι θέλεις: ονόματα, τιμές, σειρά, μεγέθη. Οι τιμές είναι ενδεικτικές.</p>${presetGrid()}
   <p class="note">Ή πάτα «＋ Κουμπί» για να φτιάξεις τα δικά σου από την αρχή.</p></div>`;
}
function presetPicker() {
  const here = ed.path.length ? K.findNode(S().menu, ed.path[ed.path.length - 1]).node.name : "";
  A.sheet("📋 Έτοιμο μενού από επάγγελμα", `<p class="note" style="margin-top:0">${here ? "Οι κατηγορίες του επαγγέλματος μπαίνουν ως υποκατηγορίες μέσα στο «" + esc(here) + "»." : "Οι κατηγορίες του επαγγέλματος προστίθενται στην αρχική του μενού σου, δίπλα σε όσα ήδη έχεις. Αν θέλεις να μπουν μέσα σε μια κατηγορία, μπες πρώτα σε εκείνη."}</p>${presetGrid()}`);
}
function presetSheet(k) {
  const P = PRESETS[k]; if (!P) return;
  A.sheet(P.e + " " + P.n, `<p class="note" style="margin-top:0">${esc(P.d || "")}</p>
   ${P.w ? `<div class="warnbox">⚖️ ${esc(P.w)}</div>` : ""}
   ${P.c.map(([cn, ce, items]) => `<div class="card"><h3>${ce} ${esc(cn)}</h3>${items.map(([n, u, pr]) => `<div class="qrow"><div class="qn"><b>${esc(n)}</b><span>ανά ${esc(u)}</span></div><b>${K.money(pr)}</b></div>`).join("")}</div>`).join("")}
   <p class="note">${prodCount(P)} προϊόντα σε ${P.c.length} κατηγορίες. Τιμές και ΦΠΑ είναι ενδεικτικά· έλεγξέ τα και με τον λογιστή σου.${!A.isPro() && liveProducts().length + prodCount(P) > A.FREE_PRODUCTS ? " Η δωρεάν έκδοση (μετά τη δοκιμή) κρατά έως " + A.FREE_PRODUCTS + " προϊόντα." : ""}</p>`,
   `<button type="button" class="btn soft" data-ea="presetBack">← Επαγγέλματα</button><button type="button" class="btn amber" data-preset-go="${k}">Βάλ' τα στο μενού</button>`);
}
function applyPreset(k) {
  const st = S(), P = PRESETS[k]; if (!P) return;
  let count = liveProducts().length, cut = false;
  const target = ed.view === "menu" && ed.path.length ? curList() : st.menu;
  const lim = A.isPro() ? 1e9 : A.FREE_PRODUCTS;
  for (const [cn, ce, items] of P.c) {
    const cat = { id: newId(), t: "c", name: cn, emoji: ce, size: "m", kids: [] };
    for (const [n, u, pr, step, o] of items) {
      if (count >= lim) { cut = true; break; }
      const id = "p" + K.uid(5), op = o || {};
      st.products[id] = { id, name: n, unit: u, price: pr, step: step || 1, vat: op.v != null ? op.v : 13, perish: !op.np, emoji: ce, hist: [[Date.now(), pr]], created: Date.now() };
      cat.kids.push({ id: newId(), t: "p", pid: id, size: "m" });
      count++;
    }
    if (cat.kids.length) target.push(cat);
  }
  ed.view = "menu"; ed.marked.clear();
  A.save({ catalog: true }); A.closeSheet(); A.render();
  A.toast(cut ? "Μπήκαν έως " + A.FREE_PRODUCTS + " προϊόντα (όριο δωρεάν έκδοσης)." : "✓ Έτοιμο. Έλεγξε τις τιμές στο «Προϊόντα και τιμές».", 4000);
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

function catSheet(node) {
  const isNew = !node;
  node = node || { name: "", emoji: "", color: "", size: "m" };
  A.sheet(isNew ? (ed.path.length ? "Νέα υποκατηγορία" : "Νέα κατηγορία") : "Κατηγορία", `
   <div class="card"><label class="f" for="cName">Όνομα κουμπιού</label><input class="t" id="cName" value="${esc(node.name)}" maxlength="40" placeholder="π.χ. Αυγά">
    <label class="f">Εικονίδιο</label>${emojiPicker(node.emoji)}<input class="t" id="emFree" value="${esc(node.emoji || "")}" maxlength="4" placeholder="ή γράψε δικό σου" style="margin-top:6px;width:150px">
    <label class="f">Μέγεθος κουμπιού</label>${sizePicker(node.size)}
    <label class="f">Χρώμα κουμπιού</label>${colorPicker(node.color)}</div>
   ${!isNew ? `<p class="note">Μέσα: ${(node.kids || []).length} κουμπιά.</p><button type="button" class="btn red wide" data-ea="catDel">Διαγραφή κατηγορίας</button><p class="note">Ό,τι έχει μέσα μετακινείται ένα επίπεδο πάνω· δεν χάνεται.</p>` : ""}`,
   `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-ea="catSave">Αποθήκευση</button>`,
   el => { pickBind(el); el.dataset.node = isNew ? "" : node.id; });
}
function catSave() {
  const name = $("#cName").value.trim(); if (!name) { A.toast("Γράψε όνομα."); return; }
  const id = $("#shB").dataset.node;
  const v = { name, emoji: $("#emFree").value.trim(), size: picked("szPick") || "m", color: picked("colPick") };
  if (id) Object.assign(K.findNode(S().menu, id).node, v);
  else curList().push(Object.assign({ id: newId(), t: "c", kids: [] }, v));
  A.save({ catalog: true }); A.closeSheet(); A.render();
}

function prodSheet(pid, nodeId) {
  const st = S(), p = pid ? st.products[pid] : null;
  if (!p && liveProducts().length >= A.FREE_PRODUCTS && !A.proGate("products")) return;
  const x = p || { name: "", unit: "τεμ.", price: "", step: 1, vat: 13, perish: true, emoji: (curCat() || {}).emoji || "" };
  const node = nodeId ? K.findNode(st.menu, nodeId).node : null;
  const unitKnown = K.UNITS.includes(x.unit);
  A.sheet(p ? "Προϊόν" : "Νέο προϊόν", `
   ${!p && curCat() ? `<div class="note" style="margin:0 2px 8px">Μπαίνει μέσα στο <b>«${esc(curCat().name)}»</b>.</div>` : ""}
   <div class="card"><label class="f" for="pN">Όνομα προϊόντος</label><input class="t" id="pN" value="${esc(x.name)}" maxlength="60" placeholder="π.χ. Αυγά ελευθέρας βοσκής">
    <div class="two"><div><label class="f" for="pP">💶 Τιμή (€)</label><input class="t" id="pP" inputmode="decimal" value="${x.price !== "" ? K.num(x.price) : ""}" placeholder="0,00" style="font-size:22px;font-weight:800;border-color:var(--accent)"></div>
     <div><label class="f" for="pU">Μονάδα</label><select class="t" id="pU">${K.UNITS.map(u => `<option${u === x.unit ? " selected" : ""}>${u}</option>`).join("")}<option value="*"${unitKnown ? "" : " selected"}>Άλλη…</option></select></div></div>
    <input class="t" id="pU2" value="${unitKnown ? "" : esc(x.unit)}" placeholder="Γράψε μονάδα" maxlength="20" style="margin-top:6px;${unitKnown ? "display:none" : ""}">
    <div class="two"><div><label class="f" for="pS">Βήμα ποσότητας</label><select class="t" id="pS">${[1, 0.5, 0.25, 0.1, 2, 5, 6, 10, 12].map(s => `<option value="${s}"${+x.step === s ? " selected" : ""}>${K.num(s)}</option>`).join("")}</select></div>
     <div><label class="f" for="pV">ΦΠΑ</label><select class="t" id="pV">${[13, 24, 6, 0].map(v => `<option value="${v}"${+x.vat === v ? " selected" : ""}>${v}%</option>`).join("")}</select></div></div>
    <label class="f" for="pD">Σύντομη περιγραφή</label><input class="t" id="pD" value="${esc(x.desc || "")}" maxlength="80" placeholder="π.χ. από κότες που βόσκουν ελεύθερες">
    <label class="f">Φωτογραφία</label><div class="row"><div id="pPhPrev">${x.photo ? `<img src="${esc(x.photo)}" style="width:64px;height:64px;border-radius:12px;object-fit:cover">` : `<span class="note">Χωρίς φωτογραφία</span>`}</div><label class="btn soft sm">📷 Επιλογή<input type="file" accept="image/*" id="pPh" hidden></label>${x.photo ? `<button type="button" class="btn soft sm" data-ea="phDel">Αφαίρεση</button>` : ""}</div>
    <p class="note">Μόνο δικές σου φωτογραφίες ή με άδεια χρήσης.</p>
    <label class="f">Εικονίδιο (αν δεν υπάρχει φωτογραφία)</label>${emojiPicker(x.emoji)}<input class="t" id="emFree" value="${esc(x.emoji || "")}" maxlength="4" style="margin-top:6px;width:150px">
    <label class="f" for="pK">Άλλες λέξεις που γράφουν οι πελάτες (για τα μηνύματα Viber)</label><input class="t" id="pK" value="${esc(x.keys || "")}" maxlength="100" placeholder="π.χ. αυγουλάκια, φρέσκα"></div>
   <div class="card"><div class="sw"><span>Εξαντλήθηκε</span><label class="tog"><input type="checkbox" id="pSo"${x.soldout ? " checked" : ""}><span></span></label></div>
    <div class="sw"><span>Κρυφό (δεν φαίνεται στον πελάτη)</span><label class="tog"><input type="checkbox" id="pHi"${x.hidden ? " checked" : ""}><span></span></label></div>
    <div class="sw"><span>Τρόφιμο που αλλοιώνεται γρήγορα</span><label class="tog g"><input type="checkbox" id="pPe"${x.perish !== false ? " checked" : ""}><span></span></label></div>
    <p class="note">Για τα ευπαθή τρόφιμα ο πελάτης ενημερώνεται ότι δεν ισχύει το δικαίωμα υπαναχώρησης.</p></div>
   ${node ? `<div class="card"><h3>Το κουμπί στο μενού</h3><label class="f" for="nName">Όνομα στο κουμπί (κενό = όνομα προϊόντος)</label><input class="t" id="nName" value="${esc(node.name || "")}" maxlength="40">
    <label class="f">Μέγεθος</label>${sizePicker(node.size)}<label class="f">Χρώμα</label>${colorPicker(node.color)}</div>` : ""}
   ${p && node ? `<div class="card"><h3>📦 Μεγέθη ή παραλλαγές</h3><p class="note" style="margin-top:0">Θέλεις και άλλο προϊόν μέσα σε αυτό; π.χ. «Μέλι» σε 500 γρ. και 1 κιλό, ή «Αυγά» σε δωδεκάδα και θήκη 30. Το κουμπί γίνεται κατηγορία «${esc(x.name)}» και μέσα της μπαίνουν τα μεγέθη, το καθένα με δική του τιμή.</p><button type="button" class="btn amber wide" data-ea="toVariants">＋ Πρόσθεσε μέγεθος ή παραλλαγή</button></div>` : ""}
   ${p ? `<button type="button" class="btn red wide" data-ea="prodDel">Διαγραφή προϊόντος</button>${(p.hist || []).length > 1 ? `<details class="card" style="margin-top:12px"><summary style="cursor:pointer;font-weight:700">Ιστορικό τιμών</summary>${p.hist.slice().reverse().map(([t, v]) => `<div class="note">${new Date(t).toLocaleString("el-GR")} · ${K.money(v)}</div>`).join("")}</details>` : ""}` : ""}
   <div id="pErr"></div>`,
   `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-ea="prodSave">Αποθήκευση</button>`,
   el => {
     pickBind(el); el.dataset.pid = pid || ""; el.dataset.node = nodeId || "";
     el.querySelector("#pU").addEventListener("change", e => { el.querySelector("#pU2").style.display = e.target.value === "*" ? "" : "none"; });
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
  if (!p) { pid = "p" + K.uid(5); p = st.products[pid] = { id: pid, hist: [], created: now }; }
  const old = p.price;
  Object.assign(p, { name, unit, price: K.round2(price), step: +$("#pS").value, vat: +$("#pV").value, desc: $("#pD").value.trim(), emoji: $("#emFree").value.trim(), keys: $("#pK").value.trim(), soldout: $("#pSo").checked, hidden: $("#pHi").checked, perish: $("#pPe").checked });
  if (b.dataset.photo) p.photo = b.dataset.photo;
  if (b.dataset.phDel) p.photo = "";
  if (old !== p.price) p.hist.push([now, p.price]);
  if (b.dataset.node) {
    const n = K.findNode(st.menu, b.dataset.node).node;
    const nn = $("#nName").value.trim();
    n.name = nn && nn !== p.name ? nn : ""; n.size = picked("szPick") || "m"; n.color = picked("colPick");
  } else if (!productInMenu(pid)) {
    (ed.view === "menu" ? curList() : st.menu).push({ id: newId(), t: "p", pid, size: "m" });
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
  const msg = (cats.length ? cats.length + " κατηγορίες (ό,τι έχουν μέσα ανεβαίνει ένα επίπεδο)" : "") + (cats.length && prods.length ? " και " : "") + (prods.length ? prods.length + " κουμπιά προϊόντων (τα προϊόντα μένουν στη λίστα «Προϊόντα και τιμές»)" : "");
  if (!confirm("Αφαίρεση από το μενού: " + msg + ";")) return;
  for (let i = L.length - 1; i >= 0; i--) if (ed.marked.has(L[i].id)) { const n = L[i]; L.splice(i, 1, ...(n.t === "c" ? n.kids || [] : [])); }
  ed.marked.clear(); A.save({ catalog: true }); A.render();
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
  addProd: () => prodSheet(null, null),
  newProd: () => prodSheet(null, null),
  catEdit: () => catSheet(curCat()),
  catSave,
  catDel: () => {
    const id = $("#shB").dataset.node, f = K.findNode(S().menu, id); if (!f) return;
    if (!confirm("Διαγραφή της κατηγορίας «" + f.node.name + "»;")) return;
    const i = f.list.indexOf(f.node); f.list.splice(i, 1, ...(f.node.kids || []));
    ed.path = ed.path.slice(0, ed.path.indexOf(id) < 0 ? ed.path.length : ed.path.indexOf(id));
    A.save({ catalog: true }); A.closeSheet(); A.render();
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
  const mk = t.closest("#edGrid [data-mk]"); if (mk) { e.stopPropagation(); const id = mk.dataset.mk; ed.marked.has(id) ? ed.marked.delete(id) : ed.marked.add(id); A.render(); return; }
  const tile = t.closest("#edGrid .tile");
  if (tile) {
    const id = tile.dataset.node;
    if (ed.marked.size) { ed.marked.has(id) ? ed.marked.delete(id) : ed.marked.add(id); A.render(); return; }
    const n = curList().find(x => x.id === id); if (!n) return;
    if (n.t === "c") { ed.path.push(n.id); window.scrollTo(0, 0); A.render(); } else prodSheet(n.pid, n.id);
    return;
  }
  const pe = t.closest("[data-pedit]"); if (pe) { prodSheet(pe.dataset.pedit, null); return; }
  const ax = t.closest("[data-addex]"); if (ax) { curList().push({ id: newId(), t: "p", pid: ax.dataset.addex, size: "m" }); A.save({ catalog: true }); A.closeSheet(); A.render(); return; }
  const mv = t.closest("[data-mvto]"); if (mv) { moveTo(mv.dataset.mvto); return; }
  const a = t.closest("[data-ea]"); if (a && EA[a.dataset.ea]) { e.preventDefault(); EA[a.dataset.ea](a); }
}, true);
document.addEventListener("change", e => {
  const t = e.target;
  if (t.matches("[data-pavail]")) { const p = S().products[t.dataset.pavail]; if (p) { p.soldout = !t.checked; A.save({ catalog: true }); A.toast(p.name + (p.soldout ? ": εξαντλήθηκε" : ": διαθέσιμο")); const sm = t.closest("div").querySelector("small"); if (sm) { sm.textContent = p.soldout ? "Εξαντλήθηκε" : "Διαθέσιμο"; sm.style.color = p.soldout ? "var(--bad)" : "var(--ok)"; } } }
  if (t.matches("[data-pprice]")) setPrice(t.dataset.pprice, t.value);
});
document.addEventListener("input", e => { if (e.target.id === "edQ") { ed.q = e.target.value; const p = e.target.selectionStart; A.render(); const i = $("#edQ"); i.focus(); i.setSelectionRange(p, p); } });
})();
