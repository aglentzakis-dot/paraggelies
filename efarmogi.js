/*
  Παραγγελίες — εφαρμογή πωλητή
  © 2026 Ανδρέας Μ. Γλεντζάκης (Andreas M. Glentzakis). Με την επιφύλαξη παντός δικαιώματος. All rights reserved.
  Απαγορεύεται η αντιγραφή, τροποποίηση και διάθεση, εν όλω ή εν μέρει, χωρίς προηγούμενη γραπτή άδεια του κατόχου.
  Copying, modification and distribution, in whole or in part, without the owner's prior written permission are prohibited.
*/
(function () {
"use strict";
const K = window.Kat, esc = K.esc;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const VERSION = (document.querySelector('meta[name="app-version"]') || {}).content || "1.0";
const BASE = new URL("./", location.href).href.replace(/index\.html$/, "");
const TRIAL_DAYS = 30, FREE_PRODUCTS = 10;
const PRO_PRICE = "18 € για έναν χρόνο · 30 € για δύο χρόνια";
const PRO_MAIL = "aglentzakis.apps@gmail.com";
const LIC_PUB = { kty: "EC", crv: "P-256", x: "vz6Lkoa7PzVQ1xGOcUyYmYPdOYYjbsp5t1xSsgc8cwg", y: "x9KzKNLFp5OKklXt6VcEaFlwr3wzvRjb1OJ9t1cBR1Q" };
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ST = { new: "Νέα", prep: "Ετοιμάζεται", done: "Παραδόθηκε", paid: "Πληρώθηκε", cancel: "Ακυρώθηκε", dup: "Πιθανή διπλή" };
const A = window.App = {};
let S = null, tab = "orders", saveT = null, pollT = null, ordFilter = { st: "new", day: "" }, totDay = "", custQ = "";

/* ---------- αποθήκευση: IndexedDB (χωράει πολλές παραγγελίες και φωτογραφίες) ---------- */
const IDB = {
  db: null,
  open() { return this.db ? Promise.resolve(this.db) : new Promise((res, rej) => { const r = indexedDB.open("paraggelies", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => { this.db = r.result; res(this.db); }; r.onerror = () => rej(r.error); }); },
  async get(k) { const db = await this.open(); return new Promise((res, rej) => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  async set(k, v) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }
};
function defaults() {
  return {
    v: 1, created: Date.now(),
    shop: { name: "", legal: "", addr: "", afm: "", phone: "", viber: "", email: "", logo: "", c1: "#17324D", c2: "#F2B632", welcome: "", vatIncl: true },
    deliv: { how: "both", days: [1, 2, 3, 4, 5, 6], slots: [], min: 0, max: 14, cut: "", closed: [], askAddr: true, minOrder: 0, note: "" },
    menu: [], products: {}, orders: [], customers: {}, rejected: [],
    nt: { topic: "", pub: "", priv: null, on: false, since: "" },
    seen: [], seq: 0, lic: { trial: Date.now() }, terms: null,
    link: { photos: false, logo: true, dirty: true, sentAt: 0 },
    gdrive: {}, phone: {}, meta: { changes: 0, lastBackup: "" }, drom: { on: false }, ui: {}
  };
}
function migrate(s) {
  const d = defaults();
  for (const k of Object.keys(d)) if (s[k] == null) s[k] = d[k];
  for (const k of ["shop", "deliv", "nt", "link", "lic", "meta"]) s[k] = Object.assign({}, d[k], s[k]);
  return s;
}
let writing = false, again = false;
async function write() {
  if (writing) { again = true; return; }
  writing = true;
  try { await IDB.set("state", S); } catch (e) { toast("⚠️ Δεν αποθηκεύτηκε: " + (e && e.message || e)); }
  writing = false;
  if (again) { again = false; write(); }
}
function save(opt) {
  S.meta.changes = (S.meta.changes || 0) + 1;
  if (opt && opt.catalog) S.link.dirty = true;
  clearTimeout(saveT); saveT = setTimeout(write, 250);
  try { window.GlenDrive && GlenDrive.state().on && GlenDrive.changed(); } catch {}
  phoneBackupSoon();
}
A.save = save; A.S = () => S;

/* ---------- μικρά εργαλεία διεπαφής ---------- */
let toastT;
function toast(m, ms) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), ms || 2600); }
let shOnClose = null;
function sheet(title, body, foot, onOpen, onClose) {
  $("#shT").textContent = title; $("#shB").innerHTML = body; $("#shF").innerHTML = foot || ""; $("#shF").style.display = foot ? "" : "none";
  if (!isSheetOpen()) histPush({ sh: 1 });
  $("#sheetbg").classList.add("open"); $("#shB").scrollTop = 0; shOnClose = onClose || null;
  if (onOpen) onOpen($("#shB"));
}
function hideSheet() { $("#sheetbg").classList.remove("open"); const f = shOnClose; shOnClose = null; if (f) f(); }
function closeSheet() { if (!isSheetOpen()) return; hideSheet(); if (history.state && history.state.sh) { skipPop++; history.back(); } }
const isSheetOpen = () => $("#sheetbg").classList.contains("open");
A.toast = toast; A.sheet = sheet; A.closeSheet = closeSheet;
const custKey = ph => String(ph || "").replace(/\D/g, "").slice(-10);
const today = () => K.ymd(new Date());
const addDays = (y, n) => { const d = K.fromYmd(y) || new Date(); d.setDate(d.getDate() + n); return K.ymd(d); };
const fmtWhen = o => (o.when.date ? K.dayLabel(o.when.date) : "Χωρίς ημέρα") + (o.when.slot ? " · " + o.when.slot : "");
const fmtTime = ts => { const d = new Date(ts); return d.getDate() + "/" + (d.getMonth() + 1) + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
const code = o => o.id.slice(-5).toUpperCase().replace(/[-_.]/g, "X");
const qtyTxt = l => K.num(l.q) + " " + l.unit;

/* ---------- Pro και δωρεάν δοκιμή (όπως στο Δρομολόγιο) ---------- */
function b32dec(t) { let e = 0, n = 0; const o = []; for (const a of t) { const i = B32.indexOf(a); if (i < 0) return null; n = n << 5 | i; e += 5; if (e >= 8) { e -= 8; o.push(n >> e & 255); } } return new Uint8Array(o); }
function licParse(t) {
  const e = String(t || "").toUpperCase().replace(/[\s\-–—_.]+/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  const m = /^PA2(\d{6})([0-9A-Z]{100,110})$/.exec(e); if (!m) return null;
  const sig = b32dec(m[2]); if (!sig || sig.length < 64) return null;
  return { clean: e, until: "20" + m[1].slice(0, 2) + "-" + m[1].slice(2, 4) + "-" + m[1].slice(4, 6), sig: sig.slice(0, 64) };
}
const emailNorm = t => String(t || "").trim().toLowerCase();
async function sha256hex(s) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join(""); }
async function licVerify(email, key) {
  const p = licParse(key); if (!p) return "";
  try {
    const k = await crypto.subtle.importKey("jwk", LIC_PUB, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, k, p.sig, new TextEncoder().encode("P|" + await sha256hex(emailNorm(email)) + "|" + p.until));
    return ok ? p.until : "";
  } catch { return ""; }
}
function lic() {
  const L = S.lic || {};
  if (L.until && L.until >= today()) return { kind: "pro", until: L.until, left: Math.round((K.fromYmd(L.until) - K.fromYmd(today())) / 864e5) };
  const left = TRIAL_DAYS - Math.floor((Date.now() - (L.trial || Date.now())) / 864e5);
  if (left > 0) return { kind: "trial", left };
  return { kind: "free", expired: !!L.until };
}
const isPro = () => lic().kind !== "free";
A.isPro = isPro;
const PRO_WHAT = { photos: "φωτογραφίες στον σύνδεσμο", products: "περισσότερα από " + FREE_PRODUCTS + " προϊόντα", viber: "κοινοποίηση μηνυμάτων από το Viber", excel: "εξαγωγή σε Excel" };
function proGate(what) { if (isPro()) return true; proSheet(what); return false; }
A.proGate = proGate; A.FREE_PRODUCTS = FREE_PRODUCTS;
function proSheet(what) {
  const l = lic();
  sheet("⭐ Pro", `
   ${what ? `<div class="warnbox">Το «${esc(PRO_WHAT[what] || what)}» είναι λειτουργία Pro.</div>` : ""}
   <div class="card"><b>${l.kind === "pro" ? "✓ Pro μέχρι " + esc(S.lic.until.split("-").reverse().join("/")) : l.kind === "trial" ? "Δωρεάν δοκιμή: μένουν " + l.left + " ημέρες" : "Δωρεάν έκδοση"}</b>
   <p class="note">Ο αγοραστής δεν πληρώνει ποτέ τίποτα. Η δοκιμή και το Pro αφορούν μόνο τον πωλητή.</p></div>
   <div class="card"><h3>Τι είναι πάντα δωρεάν</h3><p class="note" style="margin:0">Σύνδεσμος παραγγελίας, ειδοποιήσεις, λίστα παραγγελιών, σύνολα ημέρας, πελάτες, έως ${FREE_PRODUCTS} προϊόντα, αντίγραφα ασφαλείας.</p>
   <h3 style="margin-top:12px">Τι ανοίγει το Pro</h3><p class="note" style="margin:0">Απεριόριστα προϊόντα, φωτογραφίες στον σύνδεσμο, κοινοποίηση από το Viber, εξαγωγή σε Excel.</p>
   <p style="margin:12px 0 0"><b>${esc(PRO_PRICE)}</b></p>
   <p class="note">Το κλειδί «Παραγγελίες» ανοίγει μόνο αυτή την εφαρμογή. Για αγορά στείλε μήνυμα στο <a href="mailto:${PRO_MAIL}?subject=${encodeURIComponent("Κλειδί Pro Παραγγελίες")}">${PRO_MAIL}</a>. Μαζί με το κλειδί λαμβάνεις και απόδειξη της πληρωμής.</p></div>
   <div class="card"><h3>Ενεργοποίηση κλειδιού</h3>
   <label class="f" for="lmail">Ηλεκτρονικό ταχυδρομείο αγοράς</label><input class="t" id="lmail" type="email" value="${esc(S.lic.email || "")}">
   <label class="f" for="lkey">Κλειδί</label><textarea class="t" id="lkey" rows="3" placeholder="PA2…">${esc(S.lic.key || "")}</textarea>
   <div id="lerr"></div></div>`,
   `<button type="button" class="btn soft" data-act="shClose">Κλείσιμο</button><button type="button" class="btn amber" data-act="licGo">Ενεργοποίηση</button>`);
}
async function licGo() {
  const em = $("#lmail").value, key = $("#lkey").value;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailNorm(em))) { $("#lerr").innerHTML = `<div class="errbox">Γράψε το ηλεκτρονικό ταχυδρομείο με το οποίο αγόρασες.</div>`; return; }
  if (!licParse(key)) { $("#lerr").innerHTML = `<div class="errbox">Το κλειδί δεν έχει σωστή μορφή. Ξεκινά με «PA2».${/^DR2/i.test(key.trim()) ? " Αυτό είναι κλειδί του Δρομολογίου· για τις Παραγγελίες χρειάζεται ξεχωριστό κλειδί." : ""}</div>`; return; }
  const until = await licVerify(em, key);
  if (!until) { $("#lerr").innerHTML = `<div class="errbox">Το κλειδί δεν ταιριάζει με αυτό το ταχυδρομείο.</div>`; return; }
  if (until < today()) { $("#lerr").innerHTML = `<div class="errbox">Το κλειδί έχει λήξει (${until.split("-").reverse().join("/")}).</div>`; return; }
  Object.assign(S.lic, { email: emailNorm(em), key: licParse(key).clean, until });
  save(); closeSheet(); toast("✓ Pro ενεργό μέχρι " + until.split("-").reverse().join("/")); render();
}

/* ---------- κλειδιά κρυπτογράφησης και θέμα ειδοποιήσεων του πωλητή ---------- */
async function ensureKeys() {
  if (S.nt.pub && S.nt.priv && S.nt.topic) return;
  const k = await K.genKeys();
  S.nt.pub = k.pub; S.nt.priv = k.priv;
  S.nt.topic = "parag_" + K.uid(15).replace(/[.]/g, "_");
  await write();
}

/* ---------- εισερχόμενες παραγγελίες ---------- */
const seenHas = id => S.seen.includes(id);
function seenAdd(id) { if (!seenHas(id)) { S.seen.push(id); if (S.seen.length > 2000) S.seen.splice(0, S.seen.length - 2000); } }
function upsertCustomer(c, at) {
  const k = custKey(c.phone); if (!k) return null;
  const x = S.customers[k] || (S.customers[k] = { key: k, name: c.name, phone: c.phone, addr: "", notes: "", first: at || Date.now() });
  if (c.name) x.name = c.name; if (c.phone) x.phone = c.phone; if (c.addr) x.addr = c.addr;
  x.last = Math.max(x.last || 0, at || Date.now());
  return x;
}
A.upsertCustomer = upsertCustomer;
async function receive(ct, src) {
  if (!S.nt.priv) return { err: "nokey" };
  let O;
  try { O = await K.open(S.nt.priv, ct); } catch { rejectLog("Δεν άνοιξε (άλλος πωλητής ή αλλοιωμένο μήνυμα)."); return { err: "open" }; }
  if (O && O.id && seenHas(O.id)) return { dup: true, id: O.id };
  const r = K.checkOrder(O, S);
  if (r.err) { rejectLog(r.err); if (O && O.id) seenAdd(O.id); save(); return { err: r.err }; }
  const o = r.order;
  o.no = ++S.seq; o.st = "new"; o.paid = false; o.src = src || "link"; o.warn = r.warn; o.log = [[Date.now(), "Ήρθε από τον σύνδεσμο"]];
  const fp = K.fingerprint(o);
  const twin = S.orders.find(x => x.st !== "cancel" && x.st !== "dup" && Math.abs((x.rx || 0) - o.rx) < 15 * 6e4 && K.fingerprint(x) === fp);
  if (twin) { o.st = "dup"; o.twin = twin.id; }
  S.orders.push(o); seenAdd(o.id);
  upsertCustomer(o.cust, o.rx);
  save();
  return { ok: true, order: o };
}
function rejectLog(msg) { S.rejected.unshift([Date.now(), msg]); S.rejected.length = Math.min(S.rejected.length, 30); }
async function pollOnce(manual) {
  if (!S || !S.nt.topic || (document.hidden && !manual)) return;
  let msgs;
  try { msgs = await K.ntfyPoll(S.nt.topic, S.nt.since || "12h"); } catch { if (manual) toast("Δεν υπάρχει σύνδεση με την υπηρεσία ειδοποιήσεων."); return; }
  let got = 0;
  for (const m of msgs) {
    const mm = /#o=([0-9A-Za-z_.-]+)/.exec(String(m.click || ""));
    if (mm) { const r = await receive(mm[1], "link"); if (r.ok) { got++; announce(r.order); } }
    else if (m.title && /Δοκιμή/.test(m.title) && m.message === "test") { if (manual !== "silent" && !S.nt.on) { S.nt.on = true; } }
    S.nt.since = m.id;
  }
  if (msgs.length) save();
  if (got) render(); else if (manual === true) toast("Δεν υπάρχουν νέες παραγγελίες.");
}
function startPoll() { clearInterval(pollT); pollT = setInterval(() => pollOnce(), 30000); setTimeout(() => pollOnce(), 800); }
function announce(o) {
  toast("🛒 Νέα παραγγελία από " + o.cust.name, 4000);
  try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch {}
  try {
    if ("Notification" in window && Notification.permission === "granted" && document.hidden && navigator.serviceWorker)
      navigator.serviceWorker.ready.then(r => r.showNotification("🛒 Νέα παραγγελία", { body: o.cust.name + " · " + K.money(o.total), icon: "eikonidia/icon-192.png", tag: o.id }));
  } catch {}
}
async function handleHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  const o = h.get("o");
  const q = new URLSearchParams(location.search);
  if (o || location.hash || q.get("text") || q.get("share")) history.replaceState(history.state, "", location.pathname);
  if (o) {
    const r = await receive(o, "link");
    if (r.ok) { announce(r.order); tab = "orders"; ordFilter.st = r.order.st === "dup" ? "dup" : "new"; render(); openOrder(r.order.id); }
    else if (r.dup) { const x = S.orders.find(z => z.id === r.id); toast("Αυτή η παραγγελία έχει ήδη καταχωριστεί."); if (x) { tab = "orders"; render(); openOrder(x.id); } }
    else if (r.err === "open") toast("⚠️ Η παραγγελία δεν άνοιξε. Ίσως είναι για άλλον πωλητή ή άλλο κινητό.", 5000);
    else toast("⚠️ Η παραγγελία απορρίφθηκε: " + r.err, 5000);
  }
  if (h.has("test")) { S.nt.on = true; save(); toast("✓ Οι ειδοποιήσεις δουλεύουν!", 4000); render(); }
  const txt = [q.get("title"), q.get("text"), q.get("url")].filter(Boolean).join("\n");
  if (txt) { tab = "orders"; render(); if (proGate("viber")) A.importText(txt); }
}

/* ---------- απόδοση ---------- */
function render() {
  if (!S) return;
  $("#ttl").textContent = S.shop.name || "Παραγγελίες";
  let rb = $("#roleBtn");
  if (S.ui.test && !rb) { $(".top").insertAdjacentHTML("beforeend", `<button type="button" class="lnk" id="roleBtn" data-act="role" style="background:#fff;color:#17324D">👤 Πελάτης</button>`); }
  else if (!S.ui.test && rb) rb.remove();
  $$("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  const nNew = S.orders.filter(o => o.st === "new" || o.st === "dup").length;
  const ob = $('#tabs [data-tab="orders"]'); const d = ob.querySelector(".dot"); if (d) d.remove();
  if (nNew) ob.insertAdjacentHTML("beforeend", `<span class="dot">${nNew}</span>`);
  document.body.classList.remove("editing");
  const m = $("#main");
  if (tab === "orders") m.innerHTML = ordersView();
  else if (tab === "totals") m.innerHTML = totalsView();
  else if (tab === "menu") { A.menuView(m); return; }
  else if (tab === "custs") m.innerHTML = custsView();
  else m.innerHTML = moreView();
  if (tab === "orders" || tab === "more") efmMount();
}
A.render = render;

/* ---------- πρώτα βήματα ---------- */
function setupDone() { return { shop: shopOk().ok, prod: Object.values(S.products).some(p => !p.del) && S.menu.length > 0, nt: !!S.nt.on, link: !!S.link.sentAt }; }
function onboarding() {
  const s = setupDone();
  if (s.shop && s.prod && s.nt && s.link) return "";
  const st = (ok, n, t, d, act, lbl) => `<div class="step${ok ? " ok" : ""}"><div class="n">${ok ? "✓" : n}</div><div class="t"><b>${t}</b><div class="note" style="margin:2px 0 6px">${d}</div>${ok ? "" : `<button type="button" class="btn sm ${n === 1 || (n === 2 && s.shop) || (n === 3 && s.prod) || (n === 4 && s.nt) ? "amber" : "soft"}" data-act="${act}">${lbl}</button>`}</div></div>`;
  return `<div class="card"><h2>👋 Καλώς ήρθες στις Παραγγελίες</h2><p class="note" style="margin:0 0 6px">Οι πελάτες σου θα παραγγέλνουν από έναν σύνδεσμο στο Viber, χωρίς τηλεφωνήματα. Τέσσερα βήματα:</p>
   ${st(s.shop, 1, "Τα στοιχεία σου", "Όνομα, επωνυμία, διεύθυνση, ΑΦΜ, τηλέφωνο, λογότυπο και χρώματα.", "shop", "Συμπλήρωση")}
   ${st(s.prod, 2, "Τα προϊόντα σου", "Ξεκίνα από έτοιμο πρότυπο (αυγά, μέλι, λάδι, φούρνος, νερά) ή φτιάξε τα δικά σου.", "goMenu", "Κατάλογος")}
   ${st(s.nt, 3, "Ειδοποιήσεις", "Να χτυπάει το κινητό σου για κάθε νέα παραγγελία.", "notif", "Ενεργοποίηση")}
   ${st(s.link, 4, "Στείλε τον σύνδεσμο", "Στείλ' τον στους πελάτες σου στο Viber.", "link", "Σύνδεσμος")}</div>`;
}

/* ---------- παραγγελίες ---------- */
function ordMatch(o, f) {
  if (f.day && o.when.date !== f.day) return false;
  if (f.st === "all") return o.st !== "dup";
  if (f.st === "paid") return o.paid && o.st === "done";
  if (f.st === "done") return o.st === "done" && !o.paid;
  return o.st === f.st;
}
function ordersView() {
  const dups = S.orders.filter(o => o.st === "dup").length;
  if (ordFilter.st === "dup" && !dups) ordFilter.st = "new";
  const tabsDef = [["new", "Νέες"], ["prep", "Ετοιμάζονται"], ["done", "Παραδόθηκαν"], ["paid", "Πληρώθηκαν"], ["cancel", "Ακυρώθηκαν"], ["all", "Όλες"]];
  if (dups) tabsDef.unshift(["dup", "⚠️ Διπλές"]);
  const cnt = st => S.orders.filter(o => ordMatch(o, { st, day: ordFilter.day })).length;
  const days = [...new Set(S.orders.filter(o => o.st !== "cancel" && o.when.date && o.when.date >= addDays(today(), -1)).map(o => o.when.date))].sort().slice(0, 12);
  const list = S.orders.filter(o => ordMatch(o, ordFilter)).sort((a, b) => ordFilter.st === "all" || ordFilter.st === "paid" || ordFilter.st === "cancel" ? b.rx - a.rx : (a.when.date || "9").localeCompare(b.when.date || "9") || a.rx - b.rx);
  const lk = S.link.dirty && S.link.sentAt ? `<div class="warnbox">Άλλαξαν προϊόντα ή τιμές μετά τον τελευταίο σύνδεσμο. <button type="button" class="btn sm amber" data-act="link" style="margin-top:6px">Στείλε νέο σύνδεσμο</button></div>` : "";
  const ntw = S.shop.name && !S.nt.on ? `<div class="warnbox">🔔 Οι ειδοποιήσεις δεν έχουν ενεργοποιηθεί ακόμα. <button type="button" class="btn sm amber" data-act="notif" style="margin-top:6px">Ενεργοποίηση</button></div>` : "";
  return updBanner() + installBanner() + onboarding() + lk + ntw + `
   <div class="row" style="margin-bottom:10px"><button type="button" class="btn amber grow" data-act="newOrder">＋ Παραγγελία</button><button type="button" class="btn ghost grow" data-act="paste">📋 Από μήνυμα</button><button type="button" class="btn soft" data-act="poll" aria-label="Έλεγχος για νέες">⟳</button></div>
   <div class="chips">${tabsDef.map(([k, l]) => `<button type="button" class="chip${ordFilter.st === k ? " on" : ""}" data-ost="${k}">${l}<span class="n">${cnt(k)}</span></button>`).join("")}</div>
   ${days.length ? `<div class="chips"><button type="button" class="chip${!ordFilter.day ? " on" : ""}" data-oday="">Όλες οι ημέρες</button>${days.map(d => `<button type="button" class="chip${ordFilter.day === d ? " on" : ""}" data-oday="${d}">${esc(K.dayLabel(d))}</button>`).join("")}</div>` : ""}
   ${ordFilter.st === "dup" ? `<div class="warnbox">Αυτές ήρθαν δεύτερη φορά με ίδια είδη από τον ίδιο πελάτη μέσα σε 15 λεπτά. Κράτησέ τες μόνο αν είναι πράγματι νέες παραγγελίες.</div>` : ""}
   ${list.length ? list.map(ordCard).join("") : `<div class="card" style="text-align:center;color:var(--mute)">Δεν υπάρχουν παραγγελίες εδώ.</div>`}
   <div class="efm-host" id="efmHost"></div>`;
}
function ordCard(o) {
  const items = o.lines.map(l => qtyTxt(l) + " " + l.name).join(" · ");
  const next = o.st === "new" ? ["prep", "▶ Ετοιμάζεται"] : o.st === "prep" ? ["done", "✓ Παραδόθηκε"] : o.st === "done" && !o.paid ? ["paid", "€ Πληρώθηκε"] : null;
  return `<div class="ord st-${o.st}${o.paid ? " paid" : ""}" data-ord="${o.id}">
   <div class="h"><b>#${o.no} · ${esc(o.cust.name)}</b><span class="tot">${K.money(o.total)}</span></div>
   <div class="m">${o.when.how === "pick" ? "🏪" : "🚚"} ${esc(fmtWhen(o))}${o.when.how !== "pick" && o.cust.addr ? " · " + esc(o.cust.addr) : ""}</div>
   <div class="it">${esc(items)}</div>
   <div class="row">${o.test ? `<span class="pill warn">🧪 Δοκιμή</span>` : ""}<span class="pill ${o.st}">${ST[o.st]}</span>${o.paid ? `<span class="pill paid">Πληρωμένη</span>` : ""}${o.warn && o.warn.length ? `<span class="pill warn">⚠️ ${o.warn.length}</span>` : ""}${o.cust.note ? `<span class="pill">📝</span>` : ""}<span class="grow"></span>${next ? `<button type="button" class="btn sm ${next[0] === "paid" ? "green" : "amber"}" data-next="${o.id}" data-to="${next[0]}">${next[1]}</button>` : ""}</div></div>`;
}
function setStatus(o, st) {
  if (st === "paid") { o.paid = true; o.paidAt = Date.now(); o.log.push([Date.now(), "Πληρώθηκε"]); if (o.st === "new" || o.st === "prep") { } }
  else if (st === "unpaid") { o.paid = false; o.paidAt = 0; o.log.push([Date.now(), "Σημειώθηκε απλήρωτη"]); }
  else { o.st = st; o.log.push([Date.now(), ST[st]]); }
  save();
}
function openOrder(id) {
  const o = S.orders.find(x => x.id === id); if (!o) return;
  const c = S.customers[custKey(o.cust.phone)];
  const phone = o.cust.phone;
  const stBtn = (st, l) => `<button type="button" class="chip${o.st === st ? " on" : ""}" data-ordst="${st}">${l}</button>`;
  sheet("#" + o.no + " · " + o.cust.name, `
   ${o.st === "dup" ? `<div class="warnbox">Ήρθε ξανά ίδια παραγγελία μέσα σε 15 λεπτά. Μάλλον ο πελάτης πάτησε δύο φορές «Αποστολή».<div class="row" style="margin-top:8px"><button type="button" class="btn sm green" data-act="dupKeep">Είναι νέα, κράτησέ την</button><button type="button" class="btn sm red" data-act="dupDel">Διπλή, διαγραφή</button></div></div>` : ""}
   ${(o.warn || []).map(w => `<div class="warnbox">⚠️ ${esc(w)}</div>`).join("")}
   <div class="card"><div class="row"><span class="pill ${o.st}">${ST[o.st]}</span>${o.paid ? `<span class="pill paid">Πληρωμένη</span>` : ""}<span class="grow"></span><span class="note" style="margin:0">Κωδικός ${code(o)}</span></div>
    <p style="margin:8px 0 2px"><b>${o.when.how === "pick" ? "🏪 Παραλαβή" : "🚚 Παράδοση"}</b> · ${esc(fmtWhen(o))}</p>
    ${o.cust.addr ? `<p style="margin:2px 0">📍 ${esc(o.cust.addr)} <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.cust.addr)}" target="_blank" rel="noopener">χάρτης</a></p>` : ""}
    <p style="margin:2px 0">📞 <a href="tel:${esc(phone)}">${esc(phone)}</a></p>
    ${o.cust.note ? `<div class="warnbox">📝 ${esc(o.cust.note)}</div>` : ""}
    ${c && c.notes ? `<p class="note">Σημείωση πελάτη: ${esc(c.notes)}</p>` : ""}</div>
   <div class="card">${o.lines.map(l => `<div class="qrow"><div class="qn"><b>${esc(l.name)}</b><span>${K.num(l.q)} ${esc(l.unit)} × ${K.money(l.price)}${l.vat != null ? " · ΦΠΑ " + l.vat + "%" : ""}</span></div><b>${K.money(l.sum)}</b></div>`).join("")}
    <div class="row" style="margin-top:8px"><b class="grow">Σύνολο</b><b class="big-num" style="font-size:20px">${K.money(o.total)}</b></div>
    <p class="note">Οι τιμές γράφτηκαν από τον δικό σου κατάλογο, όπως ίσχυαν ${fmtTime(o.at)}.</p></div>
   <h3 style="margin:4px 2px 6px;font-size:15px">Κατάσταση</h3>
   <div class="chips">${stBtn("new", "Νέα")}${stBtn("prep", "Ετοιμάζεται")}${stBtn("done", "Παραδόθηκε")}${stBtn("cancel", "Ακυρώθηκε")}</div>
   <div class="row" style="margin:0 0 12px">${o.paid ? `<button type="button" class="btn soft grow" data-ordpaid="0">Σημείωσε απλήρωτη</button>` : `<button type="button" class="btn green grow" data-ordpaid="1">€ Πληρώθηκε</button>`}</div>
   <h3 style="margin:4px 2px 6px;font-size:15px">Ενημέρωση πελάτη</h3>
   <div class="row" style="margin-bottom:12px">${msgButtons(o)}</div>
   <div class="row" style="margin-bottom:12px"><button type="button" class="btn ghost grow" data-act="ordEdit">✏️ Αλλαγή</button><button type="button" class="btn ghost grow" data-act="ordProof">🧾 Βεβαίωση</button><button type="button" class="btn ghost grow" data-act="ordRepeat">🔁 Ξανά</button></div>
   <details class="card"><summary style="cursor:pointer;font-weight:700">Ιστορικό</summary>${(o.log || []).map(([t, x]) => `<div class="note">${fmtTime(t)} · ${esc(x)}</div>`).join("")}<div class="note">Προέλευση: ${o.src === "viber" ? "μήνυμα Viber" : o.src === "manual" ? "καταχώριση από εσένα" : "σύνδεσμος παραγγελίας"}</div></details>
   <button type="button" class="btn red wide" data-act="ordDel" style="margin-top:4px">Διαγραφή παραγγελίας</button>`,
   "", el => { el.dataset.ord = o.id; });
  $("#shB").dataset.ord = o.id;
}
A.openOrder = openOrder;
function statusText(o) {
  const n = S.shop.name || "";
  const base = { new: "λάβαμε την παραγγελία σας", prep: "ετοιμάζουμε την παραγγελία σας", done: "η παραγγελία σας παραδόθηκε. Ευχαριστούμε", cancel: "η παραγγελία σας ακυρώθηκε" }[o.st] || "";
  const when = o.st === "new" || o.st === "prep" ? " για " + (o.when.how === "pick" ? "παραλαβή " : "παράδοση ") + fmtWhen(o).replace(/^Αύριο, /, "αύριο ").replace(/^Σήμερα, /, "σήμερα ") : "";
  return "Γεια σας " + (o.cust.name.split(" ")[0] || "") + "! " + (n ? n + ": " : "") + base + when + ". Κωδικός " + code(o) + ", σύνολο " + K.money(o.total) + (o.st === "done" && !o.paid ? " (εκκρεμεί η πληρωμή)" : "") + ".";
}
function msgButtons(o) {
  const t = encodeURIComponent(statusText(o)), ph = o.cust.phone.replace(/[^\d+]/g, ""), intl = ph.startsWith("+") ? ph.slice(1) : ph.length === 10 ? "30" + ph : ph;
  return `<a class="btn soft sm grow" href="viber://forward?text=${t}">💬 Viber</a><a class="btn soft sm grow" href="sms:${esc(ph)}?body=${t}">✉️ Μήνυμα</a><a class="btn soft sm grow" href="https://wa.me/${esc(intl)}?text=${t}" target="_blank" rel="noopener">WhatsApp</a><a class="btn soft sm grow" href="tel:${esc(ph)}">📞</a>`;
}
function proof(o) {
  const s = S.shop;
  const html = `<!DOCTYPE html><html lang="el"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Βεβαίωση παραγγελίας ${code(o)}</title>
  <style>body{font:15px/1.45 system-ui,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#111}h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin:14px 0}td,th{padding:6px 4px;border-bottom:1px solid #ccc;text-align:left}td.r,th.r{text-align:right}.big{font-size:18px;font-weight:800}.nf{border:2px solid #111;padding:8px;text-align:center;font-weight:800;margin:16px 0}.m{color:#555;font-size:13px}@media print{button{display:none}}</style></head><body>
  <h1>${esc(s.legal || s.name)}</h1><div class="m">${esc(s.addr)}${s.afm ? " · ΑΦΜ " + esc(s.afm) : ""}${s.phone ? " · " + esc(s.phone) : ""}</div>
  <div class="nf">ΔΕΝ ΑΠΟΤΕΛΕΙ ΦΟΡΟΛΟΓΙΚΟ ΠΑΡΑΣΤΑΤΙΚΟ</div>
  <p><b>Βεβαίωση παραγγελίας #${o.no}</b> · κωδικός ${code(o)}<br>Υποβολή: ${fmtTime(o.at)}<br>${o.when.how === "pick" ? "Παραλαβή" : "Παράδοση"}: ${esc(fmtWhen(o))}</p>
  <p><b>${esc(o.cust.name)}</b><br>${esc(o.cust.phone)}${o.cust.addr ? "<br>" + esc(o.cust.addr) : ""}</p>
  <table><tr><th>Είδος</th><th class="r">Ποσότητα</th><th class="r">Τιμή</th><th class="r">Ποσό</th></tr>${o.lines.map(l => `<tr><td>${esc(l.name)}</td><td class="r">${K.num(l.q)} ${esc(l.unit)}</td><td class="r">${K.money(l.price)}</td><td class="r">${K.money(l.sum)}</td></tr>`).join("")}
  <tr><td colspan="3" class="big">Σύνολο</td><td class="r big">${K.money(o.total)}</td></tr></table>
  <div class="m">${s.vatIncl !== false ? "Οι τιμές περιλαμβάνουν ΦΠΑ." : "Οι τιμές δεν περιλαμβάνουν ΦΠΑ."} ${o.paid ? "Πληρωμένη." : "Δεν έχει πληρωθεί."}</div>
  <div class="nf">Η βεβαίωση αυτή δεν αποτελεί φορολογικό παραστατικό. Το νόμιμο παραστατικό εκδίδεται από τον πωλητή.</div>
  <div class="m">Παραγγελίες με GlenApps</div><p><button onclick="print()">Εκτύπωση</button></p></body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
  else { const b = new Blob([html], { type: "text/html" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "vevaiosi-" + code(o) + ".html"; a.click(); }
}

/* ---------- φόρμα παραγγελίας (νέα, αλλαγή, από μήνυμα, επανάληψη) ---------- */
let F = null;
function orderForm(init) {
  F = Object.assign({ id: null, name: "", phone: "", addr: "", note: "", date: K.availDays(S.deliv)[0] || today(), slot: (S.deliv.slots || [])[0] || "", how: S.deliv.how === "pick" ? "pick" : "del", q: {}, keep: {}, src: "manual", rest: [] }, init || {});
  drawForm();
}
function drawForm() {
  const prods = Object.values(S.products).filter(p => !p.del).sort((a, b) => a.name.localeCompare(b.name, "el"));
  const sel = prods.filter(p => F.q[p.id] > 0), others = prods.filter(p => !(F.q[p.id] > 0));
  const custs = Object.values(S.customers).sort((a, b) => (b.last || 0) - (a.last || 0));
  let tot = 0;
  const row = p => { const q = F.q[p.id] || 0; const price = F.keep[p.id] != null ? F.keep[p.id] : p.price; tot += K.round2(q * price); return `<div class="qrow"><div class="qn"><b>${esc(p.name)}${p.soldout ? " · εξαντλήθηκε" : ""}</b><span>${K.money(price)} / ${esc(p.unit)}</span></div><button type="button" class="qb" data-fm="${p.id}">−</button><input class="qi" inputmode="decimal" data-fq="${p.id}" value="${q ? K.num(q) : ""}" placeholder="0"><button type="button" class="qb plus" data-fp="${p.id}">+</button></div>`; };
  const selHTML = sel.map(row).join("");
  sheet(F.id ? "Αλλαγή παραγγελίας" : F.src === "viber" ? "Παραγγελία από μήνυμα" : "Νέα παραγγελία", `
   ${F.src === "viber" ? `<div class="okbox">Συμπληρώθηκαν αυτόματα όσα αναγνωρίστηκαν. Έλεγξέ τα πριν την αποθήκευση.</div>${F.rest.length ? `<div class="warnbox">Δεν αναγνωρίστηκαν: ${esc(F.rest.join(" · "))}</div>` : ""}${F.text ? `<details class="card"><summary style="cursor:pointer;font-weight:700">Το μήνυμα</summary><p style="white-space:pre-wrap;margin:8px 0 0">${esc(F.text)}</p></details>` : ""}` : ""}
   <div class="card"><h3>Πελάτης</h3>
    ${custs.length ? `<select class="t" id="fcSel"><option value="">— Νέος ή διάλεξε πελάτη —</option>${custs.map(c => `<option value="${c.key}"${custKey(F.phone) === c.key ? " selected" : ""}>${esc(c.name)} · ${esc(c.phone)}</option>`).join("")}</select>` : ""}
    <label class="f" for="fn">Ονοματεπώνυμο</label><input class="t" id="fn" value="${esc(F.name)}" maxlength="80">
    <div class="two"><div><label class="f" for="fph">Τηλέφωνο</label><input class="t" id="fph" type="tel" value="${esc(F.phone)}" maxlength="20"></div><div><label class="f" for="fhow">Τρόπος</label><select class="t" id="fhow"><option value="del"${F.how === "del" ? " selected" : ""}>Παράδοση</option><option value="pick"${F.how === "pick" ? " selected" : ""}>Παραλαβή</option></select></div></div>
    <label class="f" for="fad">Διεύθυνση</label><input class="t" id="fad" value="${esc(F.addr)}" maxlength="160">
    <div class="two"><div><label class="f" for="fd">Ημέρα</label><input class="t" id="fd" type="date" value="${esc(F.date)}"></div><div><label class="f" for="fs">Ώρα</label>${(S.deliv.slots || []).length ? `<select class="t" id="fs"><option value="">—</option>${S.deliv.slots.map(x => `<option${x === F.slot ? " selected" : ""}>${esc(x)}</option>`).join("")}</select>` : `<input class="t" id="fs" value="${esc(F.slot)}" placeholder="π.χ. 10:00-12:00" maxlength="30">`}</div></div>
    <label class="f" for="fnote">Σημείωση</label><input class="t" id="fnote" value="${esc(F.note)}" maxlength="400"></div>
   <div class="card"><h3>Είδη</h3>${selHTML || `<p class="note">Πρόσθεσε είδη από κάτω.</p>`}
    <div class="row" style="margin-top:10px"><b class="grow">Σύνολο</b><b style="font-size:19px" id="ftot">${K.money(tot)}</b></div>
    ${F.id ? `<p class="note">Τα είδη που υπήρχαν κρατούν την τιμή της παραγγελίας· τα καινούργια μπαίνουν με την τρέχουσα τιμή.</p>` : ""}</div>
   ${others.length ? `<div class="card"><h3>Προσθήκη είδους</h3><input class="t" id="fsearch" placeholder="Αναζήτηση…" style="margin-bottom:6px">${others.map(row).join("")}</div>` : prods.length ? "" : `<div class="warnbox">Δεν έχεις ακόμα προϊόντα. Φτιάξε τα πρώτα στον Κατάλογο.</div>`}
   <div id="ferr"></div>`,
   `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-act="fSave">Αποθήκευση</button>`,
   el => {
     const s = el.querySelector("#fsearch");
     if (s) s.addEventListener("input", () => { const q = K.norm(s.value); s.parentElement.querySelectorAll(".qrow").forEach(r => r.style.display = !q || K.norm(r.textContent).includes(q) ? "" : "none"); });
     const cs = el.querySelector("#fcSel");
     if (cs) cs.addEventListener("change", () => { const c = S.customers[cs.value]; if (c) { readForm(); F.name = c.name; F.phone = c.phone; F.addr = c.addr || ""; drawForm(); } });
   });
}
function readForm() {
  if (!F || !$("#fn")) return;
  F.name = $("#fn").value.trim(); F.phone = $("#fph").value.trim(); F.addr = $("#fad").value.trim(); F.note = $("#fnote").value.trim();
  F.date = $("#fd").value; F.slot = $("#fs").value; F.how = $("#fhow").value;
  $$("[data-fq]").forEach(i => { const v = K.parseNum(i.value); if (isFinite(v) && v > 0) F.q[i.dataset.fq] = Math.min(v, K.MAX_QTY); else delete F.q[i.dataset.fq]; });
}
function formSave() {
  readForm();
  const err = m => { $("#ferr").innerHTML = `<div class="errbox">${esc(m)}</div>`; $("#ferr").scrollIntoView({ block: "center" }); };
  if (F.name.length < 2) return err("Γράψε το όνομα του πελάτη.");
  if (F.phone.replace(/\D/g, "").length < 10) return err("Γράψε έγκυρο τηλέφωνο (10 ψηφία).");
  const ids = Object.keys(F.q).filter(id => F.q[id] > 0 && S.products[id]);
  if (!ids.length) return err("Πρόσθεσε τουλάχιστον ένα είδος.");
  const lines = ids.map(id => { const p = S.products[id], price = F.keep[id] != null ? F.keep[id] : K.priceAt(p, Date.now()), q = F.q[id]; return { pid: id, name: p.name, unit: p.unit, q, price, vat: +p.vat || 0, sum: K.round2(q * price) }; });
  const total = K.round2(lines.reduce((a, l) => a + l.sum, 0));
  const cust = { name: F.name, phone: F.phone, addr: F.addr, note: F.note };
  const when = { date: F.date, slot: F.slot, how: F.how };
  if (F.id) {
    const o = S.orders.find(x => x.id === F.id); if (!o) return closeSheet();
    Object.assign(o, { cust, when, lines, total }); o.log.push([Date.now(), "Αλλαγή από εσένα"]);
    upsertCustomer(cust, Date.now()); save(); closeSheet(); toast("✓ Αποθηκεύτηκε"); render(); openOrder(o.id); return;
  }
  const o = { id: K.uid(12), no: ++S.seq, at: Date.now(), rx: Date.now(), cust, when, lines, total, st: "new", paid: false, src: F.src === "viber" ? "viber" : "manual", warn: [], log: [[Date.now(), F.src === "viber" ? "Από μήνυμα Viber" : "Καταχώριση από εσένα"]] };
  S.orders.push(o); seenAdd(o.id); upsertCustomer(cust, o.rx); save(); closeSheet(); toast("✓ Η παραγγελία καταχωρίστηκε");
  tab = "orders"; ordFilter = { st: "new", day: "" }; render();
}
function formQty(id, d) { readForm(); const p = S.products[id]; if (!p) return; const q = Math.max(0, Math.round(((F.q[id] || 0) + d * (+p.step || 1)) * 1000) / 1000); if (q > 0) F.q[id] = q; else delete F.q[id]; const y = $("#shB").scrollTop; drawForm(); $("#shB").scrollTop = y; }
A.importText = function (text) {
  const r = K.parseMsg(text, S);
  const c = r.cust;
  const q = {}; r.lines.forEach(l => q[l.pid] = l.q);
  orderForm({ src: "viber", text, rest: r.rest, name: c ? c.name : "", phone: c ? c.phone : r.phone, addr: c ? c.addr || "" : "", date: r.date || K.availDays(S.deliv)[0] || today(), q });
};
function pasteSheet() {
  if (!proGate("viber")) return;
  sheet("📋 Παραγγελία από μήνυμα", `<p class="note" style="margin-top:0">Αντέγραψε το μήνυμα του πελάτη από το Viber και επικόλλησέ το εδώ. Συμπληρώνονται μόνα τους πελάτης, ποσότητες, προϊόντα και ημέρα, και τα ελέγχεις πριν την αποθήκευση.</p>
   <textarea class="t" id="ptxt" rows="6" placeholder="π.χ. Καλημέρα! 2 δωδεκάδες αυγά και ένα κιλό μέλι για αύριο. Μαρία"></textarea>
   <div class="card" style="margin-top:12px"><b>Πιο γρήγορα:</b><p class="note" style="margin:4px 0 0">Αφού βάλεις τις Παραγγελίες στην αρχική οθόνη, στο Viber κράτα πατημένο το μήνυμα → «Κοινοποίηση» → «Παραγγελίες». Η εφαρμογή διαβάζει μόνο το μήνυμα που διαλέγεις εσύ· ποτέ τις συνομιλίες σου.</p></div>`,
   `<button type="button" class="btn soft" data-act="pasteClip">Επικόλληση</button><button type="button" class="btn amber" data-act="pasteGo">Ανάγνωση</button>`);
}

/* ---------- σύνολα ημέρας ---------- */
function totalsView() {
  const act = S.orders.filter(o => o.st !== "cancel" && o.st !== "dup");
  const days = [...new Set([today(), addDays(today(), 1)].concat(act.filter(o => o.when.date && o.when.date >= addDays(today(), -14)).map(o => o.when.date)))].sort();
  if (!totDay || !days.includes(totDay)) totDay = today();
  const L = act.filter(o => o.when.date === totDay);
  const sum = K.round2(L.reduce((a, o) => a + o.total, 0)), paid = K.round2(L.filter(o => o.paid).reduce((a, o) => a + o.total, 0));
  const per = {};
  L.forEach(o => o.lines.forEach(l => { const x = per[l.pid] || (per[l.pid] = { name: l.name, unit: l.unit, q: 0, sum: 0, n: 0 }); x.q += l.q; x.sum = K.round2(x.sum + l.sum); x.n++; }));
  const prep = Object.values(per).sort((a, b) => a.name.localeCompare(b.name, "el"));
  const del = L.filter(o => o.when.how !== "pick").sort((a, b) => (a.when.slot || "").localeCompare(b.when.slot || ""));
  const pick = L.filter(o => o.when.how === "pick");
  return `<div class="chips">${days.map(d => `<button type="button" class="chip${d === totDay ? " on" : ""}" data-tday="${d}">${esc(K.dayLabel(d))}</button>`).join("")}</div>
   <div class="stats"><div class="card"><div class="lbl">Παραγγελίες</div><div class="big-num">${L.length}</div></div><div class="card"><div class="lbl">Σύνολο</div><div class="big-num">${K.money(sum)}</div></div>
    <div class="card"><div class="lbl">Εισπράχθηκαν</div><div class="big-num" style="color:var(--ok)">${K.money(paid)}</div></div><div class="card"><div class="lbl">Απλήρωτα</div><div class="big-num" style="color:${sum - paid > 0 ? "var(--bad)" : "inherit"}">${K.money(sum - paid)}</div></div></div>
   <div class="card"><h3>📦 Τι ετοιμάζω</h3>${prep.length ? prep.map(x => `<div class="qrow"><div class="qn"><b>${esc(x.name)}</b><span>${x.n} ${x.n === 1 ? "παραγγελία" : "παραγγελίες"} · ${K.money(x.sum)}</span></div><b style="font-size:18px">${K.num(x.q)} ${esc(x.unit)}</b></div>`).join("") : `<p class="note">Καμία παραγγελία για αυτή την ημέρα.</p>`}</div>
   ${del.length ? `<div class="card"><h3>🚚 Παραδόσεις (${del.length})</h3>${del.map(o => `<div class="list"><div class="it" data-ord="${o.id}"><div class="t"><b>${esc(o.cust.name)} · ${K.money(o.total)}</b><span>${esc(o.when.slot || "")} ${esc(o.cust.addr || "χωρίς διεύθυνση")}</span></div><span class="pill ${o.paid ? "paid" : o.st}">${o.paid ? "Πληρωμένη" : ST[o.st]}</span></div></div>`).join("")}</div>` : ""}
   ${pick.length ? `<div class="card"><h3>🏪 Παραλαβές (${pick.length})</h3>${pick.map(o => `<div class="list"><div class="it" data-ord="${o.id}"><div class="t"><b>${esc(o.cust.name)} · ${K.money(o.total)}</b><span>${esc(o.when.slot || "")}</span></div><span class="pill ${o.paid ? "paid" : o.st}">${o.paid ? "Πληρωμένη" : ST[o.st]}</span></div></div>`).join("")}</div>` : ""}
   <div class="row"><button type="button" class="btn ghost grow" data-act="xlsDay">📤 Εξαγωγή ημέρας σε Excel</button></div>
   <p class="note">Η σύνδεση με το Δρομολόγιο (παραδόσεις ως στάσεις στη διαδρομή) έρχεται σε επόμενη έκδοση.</p>`;
}

/* ---------- πελάτες ---------- */
function custStats(k) {
  const L = S.orders.filter(o => custKey(o.cust.phone) === k && o.st !== "dup");
  const act = L.filter(o => o.st !== "cancel");
  return { n: act.length, sum: K.round2(act.reduce((a, o) => a + o.total, 0)), owed: K.round2(act.filter(o => o.st === "done" && !o.paid).reduce((a, o) => a + o.total, 0)), list: L.sort((a, b) => b.rx - a.rx) };
}
function custsView() {
  const q = K.norm(custQ);
  const L = Object.values(S.customers).filter(c => !q || K.norm(c.name + " " + c.phone + " " + (c.addr || "")).includes(q)).sort((a, b) => (b.last || 0) - (a.last || 0));
  const owedAll = K.round2(Object.keys(S.customers).reduce((a, k) => a + custStats(k).owed, 0));
  return `<div class="row" style="margin-bottom:10px"><input class="t grow" id="custQ" placeholder="🔍 Αναζήτηση πελάτη" value="${esc(custQ)}"></div>
   ${owedAll > 0 ? `<div class="warnbox">Σου χρωστάνε συνολικά <b>${K.money(owedAll)}</b> από παραδομένες παραγγελίες.</div>` : ""}
   <div class="card list">${L.length ? L.map(c => { const s = custStats(c.key); return `<div class="it" data-cust="${c.key}"><div class="ic">👤</div><div class="t"><b>${esc(c.name)}</b><span>${esc(c.phone)} · ${s.n} ${s.n === 1 ? "παραγγελία" : "παραγγελίες"} · ${K.money(s.sum)}</span></div>${s.owed > 0 ? `<span class="pill new">χρωστά ${K.money(s.owed)}</span>` : ""}</div>`; }).join("") : `<p class="note">Οι πελάτες προστίθενται μόνοι τους με την πρώτη τους παραγγελία.</p>`}</div>`;
}
function openCust(k) {
  const c = S.customers[k]; if (!c) return;
  const s = custStats(k);
  sheet(c.name, `<div class="stats"><div class="card"><div class="lbl">Παραγγελίες</div><div class="big-num">${s.n}</div></div><div class="card"><div class="lbl">Χρωστά</div><div class="big-num" style="color:${s.owed ? "var(--bad)" : "inherit"}">${K.money(s.owed)}</div></div></div>
   <div class="card"><label class="f" for="cuN">Όνομα</label><input class="t" id="cuN" value="${esc(c.name)}"><label class="f" for="cuP">Τηλέφωνο</label><input class="t" id="cuP" value="${esc(c.phone)}"><label class="f" for="cuA">Διεύθυνση</label><input class="t" id="cuA" value="${esc(c.addr || "")}"><label class="f" for="cuNo">Σημειώσεις (μόνο για σένα)</label><input class="t" id="cuNo" value="${esc(c.notes || "")}"></div>
   <div class="row" style="margin-bottom:12px"><a class="btn soft grow" href="tel:${esc(c.phone)}">📞 Κλήση</a><button type="button" class="btn amber grow" data-act="custNew">＋ Παραγγελία</button>${s.list.length ? `<button type="button" class="btn ghost grow" data-act="custRepeat">🔁 Ξανά την τελευταία</button>` : ""}</div>
   ${s.owed > 0 ? `<button type="button" class="btn green wide" data-act="custPayAll" style="margin-bottom:12px">€ Πλήρωσε όλες (${K.money(s.owed)})</button>` : ""}
   <div class="card list"><h3>Ιστορικό</h3>${s.list.map(o => `<div class="it" data-ord="${o.id}"><div class="t"><b>#${o.no} · ${K.money(o.total)}</b><span>${esc(fmtWhen(o))} · ${esc(o.lines.map(l => K.num(l.q) + " " + l.name).join(", "))}</span></div><span class="pill ${o.paid ? "paid" : o.st}">${o.paid ? "Πληρωμένη" : ST[o.st]}</span></div>`).join("") || `<p class="note">Καμία παραγγελία.</p>`}</div>
   <button type="button" class="btn red wide" data-act="custDel">Διαγραφή πελάτη και των παραγγελιών του</button>
   <p class="note">Η διαγραφή ικανοποιεί αίτημα διαγραφής του πελάτη (GDPR). Πρόσεξε: αν χρειάζεσαι τις παραγγελίες για τα βιβλία σου, κάνε πρώτα εξαγωγή.</p>`,
   `<button type="button" class="btn soft" data-act="shClose">Κλείσιμο</button><button type="button" class="btn amber" data-act="custSave">Αποθήκευση</button>`);
  $("#shB").dataset.cust = k;
}
function repeatOrder(o) {
  const q = {}; o.lines.forEach(l => { if (S.products[l.pid] && !S.products[l.pid].del) q[l.pid] = l.q; });
  orderForm({ name: o.cust.name, phone: o.cust.phone, addr: o.cust.addr, how: o.when.how, slot: o.when.slot, q });
}

/* ---------- περισσότερα ---------- */
function moreView() {
  const l = lic(), sh = shopOk();
  const it = (ic, t, d, act) => `<div class="it" data-act="${act}"><div class="ic">${ic}</div><div class="t"><b>${t}</b><span>${d}</span></div><span>›</span></div>`;
  const gd = gdState();
  return `<div class="card list">
   ${it("🏪", "Στοιχεία πωλητή", sh.ok ? "Συμπληρωμένα" : "Λείπουν: " + sh.miss.join(", "), "shop")}
   ${it("🚚", "Παράδοση και ημέρες", deliveryText(), "deliv")}
   ${it("🔗", "Σύνδεσμος παραγγελίας", S.link.sentAt ? "Στάλθηκε " + fmtTime(S.link.sentAt) + (S.link.dirty ? " · χρειάζεται νέος" : "") : "Δεν έχει σταλεί ακόμα", "link")}
   ${it("🔔", "Ειδοποιήσεις", S.nt.on ? "Ενεργές" : "Δεν έχουν ενεργοποιηθεί", "notif")}
   ${it("📋", "Παραγγελία από μήνυμα Viber", "Επικόλληση ή κοινοποίηση μηνύματος", "paste")}</div>
   <div class="card list">
   ${it("💾", "Αντίγραφα ασφαλείας", gd, "backup")}
   ${it("📤", "Εξαγωγή σε Excel", "Παραγγελίες και σύνολα ημερών", "xls")}
   ${it("⭐", "Pro", l.kind === "pro" ? "Ενεργό μέχρι " + S.lic.until.split("-").reverse().join("/") : l.kind === "trial" ? "Δοκιμή: μένουν " + l.left + " ημέρες" : "Δωρεάν έκδοση", "pro")}
   ${it("🧭", "Σύνδεση με Δρομολόγιο", "Στάσεις, υπενθυμίσεις, «Χρωστάνε» · σε επόμενη έκδοση", "drom")}</div>
   <div class="card list">
   ${it("🧩", "Οι εφαρμογές μας", "Κι άλλες εφαρμογές της GlenApps", "efm")}
   ${it("⚖️", "Όροι χρήσης και απόρρητο", "Τι ισχύει για σένα και τους πελάτες σου", "legal")}
   ${it("📲", "Εγκατάσταση στο κινητό", installed() ? "Εγκατεστημένη ✓" : "Με δικό της εικονίδιο στην αρχική οθόνη", "install")}
   ${it("ℹ️", "Έκδοση " + VERSION, updNew && updNew !== VERSION ? "Υπάρχει νέα έκδοση " + updNew + " — πάτα για αναβάθμιση" : "Αυτόματες αναβαθμίσεις · πάτα για έλεγχο τώρα", "update")}</div>
   ${S.rejected.length ? `<details class="card"><summary style="cursor:pointer;font-weight:700">Απορρίφθηκαν (${S.rejected.length})</summary>${S.rejected.map(([t, m]) => `<div class="note">${fmtTime(t)} · ${esc(m)}</div>`).join("")}</details>` : ""}
   <div class="efm-host" id="efmHost"></div>
   ${S.ui.test ? `<div class="card list"><div class="it" data-act="role"><div class="ic">🧪</div><div class="t"><b>Λειτουργία δοκιμών</b><span>Πάτα «👤 Πελάτης» πάνω δεξιά για να παραγγείλεις στον εαυτό σου</span></div></div><div class="it" data-act="testDel"><div class="ic">🗑</div><div class="t"><b>Διαγραφή δοκιμαστικών παραγγελιών</b><span>${S.orders.filter(o => o.test).length} δοκιμαστικές</span></div></div><div class="it" data-act="testOff"><div class="ic">✕</div><div class="t"><b>Κλείσιμο λειτουργίας δοκιμών</b></div></div></div>` : ""}
   <p class="note" style="text-align:center" data-act="secret">Παραγγελίες · GlenApps · © 2026 Ανδρέας Μ. Γλεντζάκης</p>`;
}
function deliveryText() { const d = S.deliv; return (d.how === "both" ? "Παράδοση και παραλαβή" : d.how === "pick" ? "Μόνο παραλαβή" : "Μόνο παράδοση") + " · " + (d.days || []).map(x => K.WD[x].slice(0, 3)).join(" "); }
function afmOk(a) { a = String(a || "").trim(); if (!/^\d{9}$/.test(a) || a === "000000000") return false; let s = 0; for (let i = 0; i < 8; i++) s += +a[i] * Math.pow(2, 8 - i); return (s % 11) % 10 === +a[8]; }
function shopOk() {
  const s = S.shop, miss = [];
  if (!s.name.trim()) miss.push("όνομα"); if (!s.legal.trim()) miss.push("επωνυμία"); if (!s.addr.trim()) miss.push("διεύθυνση");
  if (!afmOk(s.afm)) miss.push("ΑΦΜ"); if (String(s.phone).replace(/\D/g, "").length < 10) miss.push("τηλέφωνο");
  return { ok: !miss.length, miss };
}
A.shopOk = shopOk;
const PALETTE = ["#17324D", "#0B6E4F", "#7A3E1D", "#8C1C13", "#4A2C6F", "#1F5F8B", "#3D3D3D", "#C2185B", "#E07A00", "#F2B632", "#5B8C2A", "#00838F"];
function shopSheet() {
  const s = S.shop;
  const col = (id, v) => `<div class="colors" data-colfor="${id}">${PALETTE.map(c => `<button type="button" style="background:${c}" data-col="${c}" class="${c.toLowerCase() === String(v).toLowerCase() ? "on" : ""}" aria-label="${c}"></button>`).join("")}<input type="color" id="${id}" value="${esc(v)}" style="width:44px;height:40px;border:0;background:none"></div>`;
  sheet("🏪 Στοιχεία πωλητή", `
   <div class="card"><h3>Όπως σε βλέπει ο πελάτης</h3>
    <label class="f" for="shN">Όνομα καταστήματος (εμφανίζεται και στο εικονίδιο)</label><input class="t" id="shN" value="${esc(s.name)}" maxlength="40" placeholder="π.χ. Τα αυγά της Κατερίνας">
    <label class="f">Λογότυπο</label><div class="row"><div id="shLogoPrev">${s.logo ? `<img src="${esc(s.logo)}" style="width:64px;height:64px;border-radius:14px;object-fit:cover">` : `<span class="note">Χωρίς λογότυπο</span>`}</div><label class="btn soft sm">📷 Επιλογή<input type="file" accept="image/*" id="shLogo" hidden></label>${s.logo ? `<button type="button" class="btn soft sm" data-act="logoDel">Αφαίρεση</button>` : ""}</div>
    <p class="note">Ανέβασε μόνο λογότυπο που σου ανήκει ή έχεις δικαίωμα να χρησιμοποιείς.</p>
    <label class="f">Κύριο χρώμα</label>${col("shC1", s.c1)}
    <label class="f">Δεύτερο χρώμα (κουμπιά, καλάθι)</label>${col("shC2", s.c2)}
    <label class="f" for="shW">Μήνυμα καλωσορίσματος</label><input class="t" id="shW" value="${esc(s.welcome)}" maxlength="90" placeholder="π.χ. Φρέσκα αυγά κάθε πρωί από τη φάρμα μας"></div>
   <div class="card"><h3>Υποχρεωτικά στοιχεία πωλητή</h3><p class="note" style="margin-top:0">Εμφανίζονται στη σελίδα παραγγελίας, όπως απαιτεί η νομοθεσία για τις πωλήσεις από απόσταση.</p>
    <label class="f" for="shL">Επωνυμία (όπως στη ΔΟΥ)</label><input class="t" id="shL" value="${esc(s.legal)}" maxlength="90">
    <label class="f" for="shA">Διεύθυνση έδρας</label><input class="t" id="shA" value="${esc(s.addr)}" maxlength="140">
    <div class="two"><div><label class="f" for="shAfm">ΑΦΜ</label><input class="t" id="shAfm" inputmode="numeric" value="${esc(s.afm)}" maxlength="9"></div><div><label class="f" for="shP">Τηλέφωνο</label><input class="t" id="shP" type="tel" value="${esc(s.phone)}" maxlength="20"></div></div>
    <label class="f" for="shE">Ηλεκτρονικό ταχυδρομείο (προαιρετικά)</label><input class="t" id="shE" type="email" value="${esc(s.email)}" maxlength="80">
    <label class="ck"><input type="checkbox" id="shV"${s.vatIncl !== false ? " checked" : ""}><span>Οι τιμές μου περιλαμβάνουν ΦΠΑ (λιανική)</span></label></div>
   <div id="shErr"></div>`,
   `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-act="shopSave">Αποθήκευση</button>`,
   el => {
     el.querySelectorAll("[data-colfor]").forEach(g => g.addEventListener("click", e => { const b = e.target.closest("[data-col]"); if (!b) return; g.querySelector("input").value = b.dataset.col; g.querySelectorAll("[data-col]").forEach(x => x.classList.toggle("on", x === b)); }));
     el.querySelector("#shLogo").addEventListener("change", async e => { const f = e.target.files[0]; if (!f) return; try { const d = await K.shrinkImage(f, 72, 0.72); el.dataset.logo = d; el.querySelector("#shLogoPrev").innerHTML = `<img src="${d}" style="width:64px;height:64px;border-radius:14px;object-fit:cover">`; } catch { toast("Η εικόνα δεν άνοιξε."); } });
   });
}
function shopSave() {
  const s = S.shop, b = $("#shB"), v = id => $("#" + id).value.trim();
  const afm = v("shAfm").replace(/\D/g, "");
  if (afm && !afmOk(afm)) { $("#shErr").innerHTML = `<div class="errbox">Ο ΑΦΜ δεν είναι έγκυρος. Έλεγξε τα 9 ψηφία.</div>`; return; }
  Object.assign(s, { name: v("shN"), legal: v("shL"), addr: v("shA"), afm, phone: v("shP"), email: v("shE"), welcome: v("shW"), c1: $("#shC1").value, c2: $("#shC2").value, vatIncl: $("#shV").checked });
  if (b.dataset.logo) s.logo = b.dataset.logo;
  if (b.dataset.logoDel) s.logo = "";
  save({ catalog: true }); closeSheet(); toast("✓ Αποθηκεύτηκε"); render();
  const ok = shopOk(); if (!ok.ok) toast("Λείπουν ακόμα: " + ok.miss.join(", "), 4000);
}
function delivSheet() {
  const d = S.deliv;
  sheet("🚚 Παράδοση και ημέρες", `
   <div class="card"><h3>Τρόπος</h3><select class="t" id="dvH"><option value="both"${d.how === "both" ? " selected" : ""}>Παράδοση και παραλαβή</option><option value="del"${d.how === "del" ? " selected" : ""}>Μόνο παράδοση</option><option value="pick"${d.how === "pick" ? " selected" : ""}>Μόνο παραλαβή</option></select>
    <label class="ck"><input type="checkbox" id="dvA"${d.askAddr !== false ? " checked" : ""}><span>Ζήτα διεύθυνση για την παράδοση</span></label></div>
   <div class="card"><h3>Ημέρες που δέχεσαι</h3><div class="chips" style="flex-wrap:wrap">${[1, 2, 3, 4, 5, 6, 0].map(i => `<label class="chip${(d.days || []).includes(i) ? " on" : ""}"><input type="checkbox" data-dvd="${i}"${(d.days || []).includes(i) ? " checked" : ""} hidden>${K.WD[i]}</label>`).join("")}</div>
    <div class="two"><div><label class="f" for="dvMin">Από (ημέρες μετά)</label><select class="t" id="dvMin">${[0, 1, 2, 3].map(n => `<option value="${n}"${+d.min === n ? " selected" : ""}>${n === 0 ? "Ίδια ημέρα" : n === 1 ? "Από αύριο" : "Σε " + n + " ημέρες"}</option>`).join("")}</select></div><div><label class="f" for="dvMax">Έως (ημέρες μπροστά)</label><select class="t" id="dvMax">${[3, 7, 14, 21, 30].map(n => `<option${+d.max === n ? " selected" : ""}>${n}</option>`).join("")}</select></div></div>
    <label class="f" for="dvCut">Παραγγελίες για την ίδια ημέρα έως</label><input class="t" id="dvCut" type="time" value="${esc(d.cut || "")}">
    <label class="f" for="dvCl">Κλειστές ημερομηνίες (π.χ. αργίες), μία ανά γραμμή</label><textarea class="t" id="dvCl" rows="2" placeholder="2026-12-25">${esc((d.closed || []).join("\n"))}</textarea></div>
   <div class="card"><h3>Ώρες παράδοσης</h3><p class="note" style="margin-top:0">Μία ανά γραμμή. Άφησέ το κενό αν δεν θέλεις ώρες.</p><textarea class="t" id="dvSl" rows="3" placeholder="09:00-12:00&#10;17:00-20:00">${esc((d.slots || []).join("\n"))}</textarea></div>
   <div class="card"><h3>Άλλα</h3><label class="f" for="dvMo">Ελάχιστη παραγγελία (€, 0 για καμία)</label><input class="t" id="dvMo" inputmode="decimal" value="${d.minOrder ? K.num(d.minOrder) : ""}">
    <label class="f" for="dvNt">Σημείωση για τον πελάτη</label><input class="t" id="dvNt" value="${esc(d.note || "")}" maxlength="140" placeholder="π.χ. Δωρεάν παράδοση στο χωριό, πληρωμή κατά την παράδοση"></div>`,
   `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-act="delivSave">Αποθήκευση</button>`,
   el => el.querySelectorAll("[data-dvd]").forEach(i => i.addEventListener("change", () => i.parentElement.classList.toggle("on", i.checked))));
}
function delivSave() {
  const d = S.deliv;
  d.how = $("#dvH").value; d.askAddr = $("#dvA").checked;
  d.days = $$("[data-dvd]").filter(i => i.checked).map(i => +i.dataset.dvd);
  if (!d.days.length) { toast("Διάλεξε τουλάχιστον μία ημέρα."); return; }
  d.min = +$("#dvMin").value; d.max = +$("#dvMax").value; d.cut = $("#dvCut").value;
  d.closed = $("#dvCl").value.split(/\s+/).filter(x => /^\d{4}-\d\d-\d\d$/.test(x));
  d.slots = $("#dvSl").value.split("\n").map(x => x.trim()).filter(Boolean).slice(0, 8);
  const mo = K.parseNum($("#dvMo").value); d.minOrder = isFinite(mo) && mo > 0 ? mo : 0;
  d.note = $("#dvNt").value.trim();
  save({ catalog: true }); closeSheet(); toast("✓ Αποθηκεύτηκε"); render();
}

/* ---------- σύνδεσμος παραγγελίας ---------- */
async function thumbOf(src, n, q) {
  n = n || 56; q = q || 0.6;
  return new Promise(res => { const i = new Image(); i.onload = () => { const c = document.createElement("canvas"); c.width = c.height = n; c.getContext("2d").drawImage(i, 0, 0, n, n); let d = c.toDataURL("image/webp", q); if (!d.startsWith("data:image/webp")) d = c.toDataURL("image/jpeg", q); res(d); }; i.onerror = () => res(""); i.src = src; });
}
async function makeLink() {
  await ensureKeys();
  const st = S;
  let prodsForLink = st.products;
  if (S.link.photos && isPro()) {
    prodsForLink = {};
    for (const [id, p] of Object.entries(st.products)) prodsForLink[id] = p.photo ? Object.assign({}, p, { photo: await thumbOf(p.photo) }) : p;
  }
  const shopForLink = st.shop.logo && S.link.logo ? Object.assign({}, st.shop, { logo: await thumbOf(st.shop.logo, 48, 0.5) }) : st.shop;
  const C = K.buildCatalog(Object.assign({}, st, { products: prodsForLink, shop: shopForLink }), { photos: S.link.photos && isPro(), logo: S.link.logo, appUrl: BASE });
  const pk = await K.pack(C);
  return BASE + "p.html#k=" + pk + "&n=" + pk.length;
}
A.makeLink = makeLink;
async function linkSheet() {
  const ok = shopOk();
  if (!ok.ok) { toast("Συμπλήρωσε πρώτα: " + ok.miss.join(", "), 4000); shopSheet(); return; }
  const n = Object.values(S.products).filter(p => !p.del && !p.hidden).length;
  if (!n || !S.menu.length) { toast("Πρόσθεσε πρώτα προϊόντα στον κατάλογο."); tab = "menu"; render(); return; }
  if (!S.terms) {
    sheet("Πριν τον πρώτο σύνδεσμο", `<div class="card"><p style="margin-top:0">Με τη χρήση των Παραγγελιών δηλώνεις ότι:</p>
     <ul style="padding-left:20px;margin:0"><li>ευθύνεσαι εσύ για τα προϊόντα, τις τιμές, τις άδειες της δραστηριότητάς σου και τα στοιχεία που εμφανίζεις·</li><li>έχεις δικαίωμα να χρησιμοποιείς το λογότυπο και τις φωτογραφίες που ανεβάζεις·</li><li>εκδίδεις εσύ τα νόμιμα φορολογικά παραστατικά — η εφαρμογή δεν εκδίδει παραστατικά·</li><li>είσαι υπεύθυνος για τα προσωπικά στοιχεία των πελατών σου και τα χρησιμοποιείς μόνο για τις παραγγελίες τους.</li></ul>
     <p class="note"><a href="oroi.html" target="_blank" rel="noopener">Όροι χρήσης</a> · <a href="aporrito.html" target="_blank" rel="noopener">Πολιτική απορρήτου</a></p></div>
     <label class="ck"><input type="checkbox" id="trmOk"><span>Διάβασα και αποδέχομαι τους όρους χρήσης</span></label>`,
     `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-act="termsOk">Συνέχεια</button>`);
    return;
  }
  const url = await makeLink();
  const len = url.length, pct = Math.min(100, Math.round(len / 7000 * 100));
  const msg = "Παραγγείλτε από «" + S.shop.name + "» εδώ, χωρίς τηλεφωνήματα:\n" + url;
  sheet("🔗 Σύνδεσμος παραγγελίας", `
   <div class="okbox">Αυτή είναι η σελίδα του καταστήματός σου για τους πελάτες. Στείλ' την μία φορά στο Viber και παραγγέλνουν από εκεί όσες φορές θέλουν. Νέα αποστολή χρειάζεται μόνο όταν αλλάζεις τιμές ή προϊόντα.</div>
   ${S.link.dirty && S.link.sentAt ? `<div class="warnbox">Άλλαξες προϊόντα ή τιμές. Στείλε τον νέο σύνδεσμο στους πελάτες σου. Ακόμα κι αν κάποιος παραγγείλει από τον παλιό, γράφονται πάντα οι δικές σου τρέχουσες τιμές.</div>` : ""}
   <div class="card"><div class="prev" style="--c1:${esc(S.shop.c1)};--on1:${K.contrast(S.shop.c1)}"><div class="ph">${S.shop.logo && S.link.logo ? `<img src="${esc(S.shop.logo)}" alt="">` : ""}<b>${esc(S.shop.name)}</b></div></div>
    <div class="lnkbox" style="margin-top:10px">${esc(url)}</div>
    <div class="meter ${pct > 90 ? "b" : pct > 65 ? "w" : ""}"><i style="width:${pct}%"></i></div><div class="note" style="margin:0">Μήκος ${len.toLocaleString("el-GR")} χαρακτήρες${pct > 90 ? " — πολύ μεγάλος, μπορεί να κοπεί στο Viber. Βγάλε τις φωτογραφίες ή το λογότυπο." : ""}</div>
    <label class="ck"><input type="checkbox" id="lkPh"${S.link.photos ? " checked" : ""}><span>Με φωτογραφίες προϊόντων (μεγαλώνει τον σύνδεσμο) ${isPro() ? "" : "· Pro"}</span></label>
    <label class="ck"><input type="checkbox" id="lkLg"${S.link.logo ? " checked" : ""}><span>Με λογότυπο</span></label></div>
   <div class="row" style="margin-bottom:10px"><a class="btn amber grow" href="viber://forward?text=${encodeURIComponent(msg)}" data-act="lkSent">💬 Viber</a><button type="button" class="btn grow" data-act="lkShare">📤 Κοινοποίηση</button></div>
   <div class="row" style="margin-bottom:10px"><button type="button" class="btn ghost grow" data-act="lkCopy">📋 Αντιγραφή</button><button type="button" class="btn ghost grow" data-act="lkPreview">👁 Όπως το βλέπει ο πελάτης</button></div>
   <p class="note">Ο κατάλογος ταξιδεύει μέσα στον σύνδεσμο. Δεν ανεβαίνει πουθενά. Οι παραγγελίες έρχονται κρυπτογραφημένες και ανοίγουν μόνο σε αυτό το κινητό.</p>
   <p class="note">Όταν αλλάζεις προϊόντα, τιμές ή «εξαντλήθηκε», ξαναστείλε τον σύνδεσμο ή καρφίτσωσέ τον στη συνομιλία σου στο Viber.</p>`, "",
   el => { el.dataset.url = url; el.dataset.msg = msg; });
}
function linkSent() { S.link.sentAt = Date.now(); S.link.dirty = false; save(); }

/* ---------- ειδοποιήσεις ---------- */
const NT_PLAY = "https://play.google.com/store/apps/details?id=io.heckel.ntfy", NT_IOS = "https://apps.apple.com/app/ntfy/id1625396347";
async function notifSheet() {
  await ensureKeys();
  const sub = `ntfy://ntfy.sh/${S.nt.topic}?display=${encodeURIComponent("Παραγγελίες")}`;
  sheet("🔔 Ειδοποιήσεις", `
   <div class="card"><p style="margin-top:0;font-weight:700">Για να χτυπάει το κινητό σου για κάθε νέα παραγγελία, ακόμα κι όταν οι Παραγγελίες είναι κλειστές, χρειάζεται η μικρή δωρεάν εφαρμογή ntfy — η ίδια με το Δρομολόγιο.</p>
    ${S.nt.on ? `<div class="okbox">✓ Οι ειδοποιήσεις είναι ενεργές σε αυτό το κινητό.</div>` : ""}
    <div class="step"><div class="n">1</div><div class="t"><b>Εγκατάσταση της ntfy</b><div class="row" style="margin-top:6px"><a class="btn sm amber" href="${NT_PLAY}" target="_blank" rel="noopener">Google Play</a><a class="btn sm soft" href="${NT_IOS}" target="_blank" rel="noopener">iPhone</a></div></div></div>
    <div class="step"><div class="n">2</div><div class="t"><b>Σύνδεση με τις Παραγγελίες</b><p class="note" style="margin:2px 0 6px">Ανοίγει η ntfy με όλα συμπληρωμένα. Πάτα «Subscribe» (Εγγραφή) και γύρνα εδώ.</p><a class="btn sm amber" href="${esc(sub)}">Άνοιγμα στην ntfy</a>
     <details style="margin-top:8px"><summary class="note">Αν δεν άνοιξε η ntfy</summary><p class="note">Στην ntfy πάτα «+» και στο «Topic» επικόλλησε αυτό:</p><div class="lnkbox">${esc(S.nt.topic)}</div><button type="button" class="btn sm soft" data-act="ntCopy" style="margin-top:6px">Αντιγραφή</button></details></div></div>
    <div class="step"><div class="n">3</div><div class="t"><b>Δοκιμή</b><p class="note" style="margin:2px 0 6px">Στέλνει μια δοκιμαστική ειδοποίηση. Πάτησέ την όταν έρθει.</p><button type="button" class="btn sm amber" data-act="ntTest">Στείλε δοκιμή</button></div></div></div>
   <div class="card"><h3>Και όταν η εφαρμογή είναι ανοιχτή</h3><button type="button" class="btn sm soft" data-act="ntPerm">Να εμφανίζονται ειδοποιήσεις και από εδώ</button>
    <p class="note">Η εφαρμογή ελέγχει για νέες παραγγελίες κάθε 30 δευτερόλεπτα όσο είναι ανοιχτή.</p></div>
   <p class="note">Οι παραγγελίες είναι κρυπτογραφημένες: τις διαβάζουν μόνο οι Παραγγελίες σε αυτό το κινητό, όχι η ntfy. Η ntfy είναι δωρεάν, χωρίς λογαριασμό και χωρίς κάρτα. Η υπηρεσία κρατά τα μηνύματα έως 12 ώρες· η ειδοποίηση όμως μένει στο κινητό σου και ανοίγει την παραγγελία όποτε την πατήσεις.</p>
   <label class="ck"><input type="checkbox" id="ntOn"${S.nt.on ? " checked" : ""}><span>Έκανα τα βήματα και οι ειδοποιήσεις έρχονται</span></label>`,
   `<button type="button" class="btn amber" data-act="ntDone">Τέλος</button>`);
}

/* ---------- αντίγραφα ασφαλείας: Google Drive και φάκελος κινητού ---------- */
function backupPayload() { return JSON.stringify({ app: "paraggelies", version: VERSION, at: new Date().toISOString(), state: Object.assign({}, S, { gdrive: undefined }) }); }
function gdInit() {
  try {
    window.GlenDrive && GlenDrive.init({ app: "paraggelies", folder: "Παραγγελίες", prefix: "paraggelies-antigrafo", payload: backupPayload, t: s => s, toast,
      store: { get: () => S.gdrive || {}, set: t => { const was = (S.gdrive || {}).last || 0; S.gdrive = t; if ((t.last || 0) > was) S.meta.lastBackup = new Date().toISOString(); clearTimeout(saveT); saveT = setTimeout(write, 250); } },
      onState: () => { if (isSheetOpen() && $("#bkBox")) backupSheet(); } });
  } catch {}
}
function gdState() { try { if (!window.GlenDrive) return "Φάκελος κινητού και αρχείο"; const g = GlenDrive.state(); return g.on ? "Google Drive ✓" + (g.last ? " · " + fmtTime(g.last) : "") : "Δεν είναι ενεργά στο Google Drive"; } catch { return ""; } }
const PH = {
  key: "paraggelies-root",
  db() { return new Promise((res, rej) => { const r = indexedDB.open("shared-backups", 1); r.onupgradeneeded = () => r.result.createObjectStore("handles"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async get() { try { const db = await this.db(); return await new Promise(res => { const q = db.transaction("handles").objectStore("handles").get(this.key); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch { return null; } },
  async set(h) { const db = await this.db(); return new Promise(res => { const t = db.transaction("handles", "readwrite"); h ? t.objectStore("handles").put(h, this.key) : t.objectStore("handles").delete(this.key); t.oncomplete = () => res(); }); },
  async dir(h, ask) { if (!h) return null; const o = { mode: "readwrite" }; let p = await h.queryPermission(o); if (p !== "granted" && ask) p = await h.requestPermission(o); if (p !== "granted") return null; const g = await h.getDirectoryHandle("GlenApps", { create: true }); return g.getDirectoryHandle("Παραγγελίες", { create: true }); },
  async write(ask) { const d = await this.dir(await this.get(), ask); if (!d) return false; const f = await d.getFileHandle("paraggelies-antigrafo-" + today() + ".json", { create: true }); const w = await f.createWritable(); await w.write(backupPayload()); await w.close(); S.phone = { last: Date.now() }; S.meta.lastBackup = new Date().toISOString(); clearTimeout(saveT); saveT = setTimeout(write, 250); return true; },
  async list() { const d = await this.dir(await this.get(), true); if (!d) return []; const out = []; for await (const [n, h] of d.entries()) if (h.kind === "file" && /^paraggelies-antigrafo-.*\.json$/.test(n)) out.push({ n, h }); return out.sort((a, b) => b.n.localeCompare(a.n)).slice(0, 10); }
};
let phT = null;
function phoneBackupSoon() { clearTimeout(phT); phT = setTimeout(() => { PH.get().then(h => h && PH.write(false)).catch(() => {}); }, 20000); }
async function backupSheet() {
  const g = window.GlenDrive ? GlenDrive.state() : { on: false };
  const ph = await PH.get();
  const hasDir = "showDirectoryPicker" in window;
  sheet("💾 Αντίγραφα ασφαλείας", `<div id="bkBox">
   <div class="card"><h3>Google Drive</h3><p class="note" style="margin-top:0">Με το Google Drive τα δεδομένα σου είναι ασφαλή ακόμα κι αν χαλάσει ή χαθεί το κινητό. Ανεβαίνει αντίγραφο αυτόματα μετά από κάθε αλλαγή, στον φάκελο «GlenApps › Παραγγελίες» του δικού σου Drive.</p>
    ${g.on ? `<div class="okbox">✓ Συνδεδεμένο${g.email ? " (" + esc(g.email) + ")" : ""}${g.last ? " · τελευταίο " + fmtTime(g.last) : ""}</div>${g.needTap ? `<div class="warnbox">Πάτα «Ανέβασμα τώρα» για να ξαναδώσεις άδεια.</div>` : ""}${g.err ? `<div class="errbox">${esc(g.err)}</div>` : ""}<div class="row"><button type="button" class="btn sm amber grow" data-act="gdNow">Ανέβασμα τώρα</button><button type="button" class="btn sm soft grow" data-act="gdRestore">Επαναφορά</button><button type="button" class="btn sm soft" data-act="gdOff">Αποσύνδεση</button></div>` : `<button type="button" class="btn amber wide" data-act="gdOn">Σύνδεση με Google Drive</button>`}</div>
   <div class="card"><h3>Φάκελος στο κινητό</h3><p class="note" style="margin-top:0">Δεύτερη επιλογή, για όσους δεν έχουν Google Drive. Γράφει αυτόματα στο «GlenApps › Παραγγελίες» μέσα στον φάκελο που θα διαλέξεις (προτείνεται οι «Λήψεις»).</p>
    ${hasDir ? (ph ? `<div class="okbox">✓ Ενεργός${S.phone && S.phone.last ? " · τελευταίο " + fmtTime(S.phone.last) : ""}</div><div class="row"><button type="button" class="btn sm amber grow" data-act="phNow">Αντίγραφο τώρα</button><button type="button" class="btn sm soft grow" data-act="phRestore">Επαναφορά</button><button type="button" class="btn sm soft" data-act="phOff">✕</button></div>` : `<button type="button" class="btn amber wide" data-act="phOn">Επιλογή φακέλου</button>`) : `<p class="note">Αυτός ο περιηγητής δεν υποστηρίζει φάκελο· χρησιμοποίησε το αρχείο από κάτω.</p>`}</div>
   <div class="card"><h3>Αρχείο</h3><div class="row"><button type="button" class="btn sm soft grow" data-act="fileOut">⬇️ Λήψη αρχείου</button><label class="btn sm soft grow">⬆️ Επαναφορά από αρχείο<input type="file" accept=".json,application/json" id="fileIn" hidden></label></div></div>
   <p class="note">Το αντίγραφο περιέχει τον κατάλογο, τις παραγγελίες, τους πελάτες και τα κλειδιά κρυπτογράφησης. Κράτα το ιδιωτικό.</p></div>`, "",
   el => { const fi = el.querySelector("#fileIn"); fi && fi.addEventListener("change", async e => { const f = e.target.files[0]; if (f) restoreText(await f.text()); }); });
}
function restoreText(txt) {
  let d; try { d = JSON.parse(txt); } catch { toast("Το αρχείο δεν είναι αντίγραφο των Παραγγελιών."); return; }
  const st = d && d.app === "paraggelies" && d.state;
  if (!st || !Array.isArray(st.orders) || !st.products) { toast("Το αρχείο δεν είναι αντίγραφο των Παραγγελιών."); return; }
  if (!confirm("Επαναφορά από αντίγραφο " + (d.at || "").slice(0, 16).replace("T", " ") + ";\nΘα αντικατασταθούν τα τωρινά δεδομένα (" + S.orders.length + " παραγγελίες). Πριν την επαναφορά κατεβαίνει αντίγραφο των τωρινών.")) return;
  download("paraggelies-prin-tin-epanafora-" + today() + ".json", backupPayload(), "application/json");
  const keepGd = S.gdrive;
  S = migrate(st); S.gdrive = keepGd;
  write().then(() => { closeSheet(); toast("✓ Έγινε επαναφορά"); render(); });
}
function download(name, text, type) { const b = new Blob([text], { type }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }

/* ---------- εξαγωγή σε Excel (CSV με ελληνικούς χαρακτήρες) ---------- */
const csvCell = v => { const s = typeof v === "number" ? String(Math.round(v * 1000) / 1000).replace(".", ",") : String(v == null ? "" : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csv = rows => "﻿" + rows.map(r => r.map(csvCell).join(";")).join("\r\n");
function xlsOrders(from, to) {
  const L = S.orders.filter(o => o.st !== "dup" && (!from || (o.when.date || "") >= from) && (!to || (o.when.date || "") <= to)).sort((a, b) => (a.when.date || "").localeCompare(b.when.date || "") || a.no - b.no);
  const rows = [["Αρ.", "Κωδικός", "Υποβολή", "Ημέρα", "Ώρα", "Τρόπος", "Πελάτης", "Τηλέφωνο", "Διεύθυνση", "Είδος", "Ποσότητα", "Μονάδα", "Τιμή", "ΦΠΑ %", "Ποσό", "Σύνολο παραγγελίας", "Κατάσταση", "Πληρωμένη", "Σημείωση"]];
  L.forEach(o => o.lines.forEach((l, i) => rows.push([o.no, code(o), fmtTime(o.at), o.when.date, o.when.slot, o.when.how === "pick" ? "Παραλαβή" : "Παράδοση", o.cust.name, o.cust.phone, o.cust.addr, l.name, l.q, l.unit, l.price, l.vat, l.sum, i === 0 ? o.total : "", ST[o.st], o.paid ? "Ναι" : "Όχι", i === 0 ? o.cust.note : ""])));
  return rows;
}
function xlsDay(day) {
  const L = S.orders.filter(o => o.st !== "cancel" && o.st !== "dup" && o.when.date === day), per = {};
  L.forEach(o => o.lines.forEach(l => { const x = per[l.pid] || (per[l.pid] = [l.name, 0, l.unit, 0]); x[1] += l.q; x[3] = K.round2(x[3] + l.sum); }));
  return [["Σύνολα ημέρας", day], [], ["Είδος", "Ποσότητα", "Μονάδα", "Ποσό"]].concat(Object.values(per)).concat([[], ["Παραγγελίες", L.length], ["Σύνολο", K.round2(L.reduce((a, o) => a + o.total, 0))], ["Εισπράχθηκαν", K.round2(L.filter(o => o.paid).reduce((a, o) => a + o.total, 0))], [], ["Αναλυτικά"]]).concat(xlsOrders(day, day));
}
function xlsSheet() {
  if (!proGate("excel")) return;
  const first = S.orders.map(o => o.when.date).filter(Boolean).sort()[0] || today();
  sheet("📤 Εξαγωγή σε Excel", `<div class="card"><label class="f" for="xF">Από</label><input class="t" type="date" id="xF" value="${addDays(today(), -30) < first ? first : addDays(today(), -30)}"><label class="f" for="xT">Έως</label><input class="t" type="date" id="xT" value="${addDays(today(), 14)}">
   <p class="note">Ανοίγει στο Excel, στα Φύλλα Google και σε κάθε πρόγραμμα λογιστικών φύλλων.</p></div>`,
   `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-act="xlsGo">Εξαγωγή</button>`);
}

/* ---------- αναβάθμιση: αυτόματη, όπως στο Δρομολόγιο ---------- */
let updBusy = false, updLast = 0, updNew = "";
async function checkUpdate(manual) {
  if (updBusy) return; updBusy = true; updLast = Date.now();
  try {
    const r = await fetch("index.html?v=" + Date.now(), { cache: "no-store" });
    const t = await r.text();
    const m = /name="app-version" content="([^"]+)"/.exec(t);
    S.ui.updChecked = today(); save();
    if (m && m[1] !== VERSION) {
      updNew = m[1];
      if (manual || !isSheetOpen()) await applyUpdate();
      else render();
    } else if (manual) toast("✓ Έχεις την τελευταία έκδοση (" + VERSION + ").");
  } catch { if (manual) toast("Δεν υπάρχει σύνδεση στο διαδίκτυο."); }
  updBusy = false;
}
async function applyUpdate() {
  toast("⬆️ Αναβάθμιση σε " + (updNew || "νέα έκδοση") + "… τα δεδομένα σου μένουν.", 3000);
  clearTimeout(saveT); await write();
  try { const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (reg) { await reg.update(); if (reg.waiting) reg.waiting.postMessage({ type: "skipWaiting" }); } } catch {}
  try { const ks = await caches.keys(); await Promise.all(ks.filter(k => k.startsWith("paraggelies-")).map(k => caches.delete(k))); } catch {}
  setTimeout(() => location.reload(), 1200);
}
function updBanner() { return updNew && updNew !== VERSION ? `<div class="okbox">⬆️ Νέα έκδοση ${esc(updNew)} έτοιμη. <button type="button" class="btn sm amber" data-act="updGo" style="margin-top:6px">Αναβάθμιση τώρα</button></div>` : ""; }

/* ---------- εγκατάσταση στο κινητό ---------- */
let instPrompt = null;
const installed = () => { try { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch { return false; } };
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); instPrompt = e; if (S) render(); });
window.addEventListener("appinstalled", () => { instPrompt = null; if (S) { S.ui.installed = true; save(); render(); } toast("✓ Οι Παραγγελίες μπήκαν στην αρχική οθόνη."); });
function installBanner() {
  if (installed() || (S.ui && S.ui.installed && !instPrompt) || (S.ui && S.ui.instHide === today())) return "";
  return `<div class="card" style="display:flex;gap:12px;align-items:center"><img src="eikonidia/icon-192.png?v=${VERSION}" alt="" style="width:52px;height:52px;border-radius:12px"><div style="flex:1;min-width:0"><b>Εγκατάσταση στο κινητό</b><div class="note" style="margin:2px 0 0">Ανοίγει σαν κανονική εφαρμογή, με δικό της εικονίδιο, και δέχεται μηνύματα από το Viber.</div></div><div style="display:flex;flex-direction:column;gap:6px"><button type="button" class="btn sm amber" data-act="install">📲 Εγκατάσταση</button><button type="button" class="btn sm soft" data-act="instLater">Αργότερα</button></div></div>`;
}
async function doInstall() {
  if (instPrompt) { try { instPrompt.prompt(); const c = await instPrompt.userChoice; if (c && c.outcome === "accepted") { S.ui.installed = true; save(); } } catch {} instPrompt = null; render(); return; }
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  sheet("📲 Εγκατάσταση", `<div class="card">${installed() ? `<div class="okbox">✓ Οι Παραγγελίες είναι ήδη εγκατεστημένες.</div>` : ios
    ? `<p><b>1.</b> Άνοιξε τη σελίδα στο Safari.</p><p><b>2.</b> Πάτα το κουμπί κοινοποίησης ⬆️.</p><p><b>3.</b> Διάλεξε «Προσθήκη στην οθόνη Αφετηρίας».</p>`
    : `<p><b>1.</b> Άνοιξε τη σελίδα στο Chrome (όχι μέσα από το Viber).</p><p><b>2.</b> Πάτα τις τρεις τελείες <b>⋮</b> πάνω δεξιά.</p><p><b>3.</b> Διάλεξε «Εγκατάσταση εφαρμογής» ή «Προσθήκη στην αρχική οθόνη».</p>`}
    <p class="note">Η διεύθυνση της εφαρμογής: aglentzakis-dot.github.io/paraggelies</p></div>`);
}

/* ---------- οι εφαρμογές μας ---------- */
function efmInit() { try { window.EfarmogesMas && EfarmogesMas.init({ app: "paraggelies", isPro: () => lic().kind === "pro", lang: () => "el", t: s => s, canShow: () => S.orders.length > 0 }); } catch {} }
function efmMount() { try { const h = $("#efmHost"); if (!h || !window.EfarmogesMas || tab === "more") return; EfarmogesMas.mount(h); } catch {} }
function efmSheet() {
  sheet("🧩 Οι εφαρμογές μας", `<p class="note" style="margin-top:0">Κι άλλες εφαρμογές της GlenApps που ίσως σου φανούν χρήσιμες.</p><div id="efmList"></div>`, "", el => { try { window.EfarmogesMas ? EfarmogesMas.page(el.querySelector("#efmList"), { skip: ["paraggelies"] }) : (el.querySelector("#efmList").innerHTML = `<p class="note">Η λίστα δεν φορτώθηκε.</p>`); } catch {} });
}

/* ---------- πατήματα ---------- */
const ACT = {
  shClose: closeSheet,
  link: linkSheet, shop: shopSheet, deliv: delivSheet, notif: notifSheet, backup: backupSheet, xls: xlsSheet, pro: () => proSheet(),
  goMenu: () => { tab = "menu"; render(); },
  paste: pasteSheet, newOrder: () => orderForm(),
  poll: () => pollOnce(true),
  update: () => checkUpdate(true),
  updGo: () => applyUpdate(),
  lkPreview: () => { const u = $("#shB").dataset.url; closeSheet(); setTimeout(() => openPreview(u), 60); },
  pvClose: () => closePreview(false),
  role: () => switchRole(),
  efm: () => efmSheet(),
  secret: () => secretTap(),
  testDel: () => { const n = S.orders.filter(o => o.test).length; if (!n) { toast("Δεν υπάρχουν δοκιμαστικές παραγγελίες."); return; } if (!confirm("Διαγραφή " + n + " δοκιμαστικών παραγγελιών;")) return; S.orders = S.orders.filter(o => !o.test); save(); render(); toast("Διαγράφηκαν."); },
  testOff: () => { S.ui.test = false; save(); render(); },
  install: () => doInstall(),
  instLater: () => { S.ui.instHide = today(); save(); render(); },
  legal: () => sheet("⚖️ Όροι και απόρρητο", `<div class="card list"><a class="it" href="oroi.html" target="_blank" rel="noopener" style="color:inherit;text-decoration:none"><div class="ic">📄</div><div class="t"><b>Όροι χρήσης</b><span>Για πωλητές και αγοραστές</span></div></a><a class="it" href="aporrito.html" target="_blank" rel="noopener" style="color:inherit;text-decoration:none"><div class="ic">🔒</div><div class="t"><b>Πολιτική απορρήτου</b><span>Τι δεδομένα υπάρχουν και πού</span></div></a></div>
    <div class="card"><h3>Υπενθυμίσεις για τον πωλητή</h3><ul style="padding-left:20px;margin:0;font-size:14.5px"><li>Η εφαρμογή δεν εκδίδει φορολογικά παραστατικά. Έκδωσε απόδειξη ή τιμολόγιο όπως ορίζει ο νόμος (myDATA).</li><li>Για τρόφιμα χρειάζεται καταχώριση ή άδεια της δραστηριότητάς σου (π.χ. ΕΦΕΤ, ΔΑΟΚ, κανόνες σήμανσης για αυγά και μέλι).</li><li>Τα στοιχεία των πελατών σου χρησιμοποίησέ τα μόνο για τις παραγγελίες τους.</li></ul></div>`),
  drom: () => sheet("🧭 Σύνδεση με Δρομολόγιο", `<div class="card"><p style="margin-top:0">Σε επόμενη έκδοση, με έναν διακόπτη:</p><ul style="padding-left:20px;margin:0"><li>οι παραδόσεις μπαίνουν ως στάσεις στη διαδρομή σου·</li><li>υπενθυμίσεις για κάθε παράδοση·</li><li>οι απλήρωτες παραγγελίες εμφανίζονται στο «Χρωστάνε»·</li><li>κοινοί πελάτες.</li></ul><p class="note">Δουλεύει μόνο αν έχεις και το Δρομολόγιο στο ίδιο κινητό. Τα δεδομένα δεν φεύγουν από το κινητό σου.</p></div>
    <label class="ck"><input type="checkbox" disabled><span>Σύνδεση με το Δρομολόγιο (σύντομα)</span></label>`),
  termsOk: () => { if (!$("#trmOk").checked) { toast("Χρειάζεται η αποδοχή των όρων."); return; } S.terms = { v: 1, at: Date.now() }; save(); closeSheet(); linkSheet(); },
  lkShare: async () => { const b = $("#shB"); try { await navigator.share({ title: S.shop.name, text: b.dataset.msg }); linkSent(); } catch (e) { if (e && e.name !== "AbortError") ACT.lkCopy(); } },
  lkCopy: async () => { try { await navigator.clipboard.writeText($("#shB").dataset.msg); linkSent(); toast("✓ Αντιγράφηκε. Επικόλλησέ το στο Viber."); } catch { toast("Δεν έγινε αντιγραφή."); } },
  lkSent: () => linkSent(),
  ntCopy: async () => { try { await navigator.clipboard.writeText(S.nt.topic); toast("✓ Αντιγράφηκε"); } catch {} },
  ntTest: async () => { try { await K.ntfySend(S.nt.topic, "🔔 Δοκιμή — Παραγγελίες", "Πάτα εδώ για να ολοκληρωθεί η δοκιμή.", BASE + "#test=1"); toast("Στάλθηκε. Περίμενε την ειδοποίηση στο κινητό."); } catch { toast("Δεν στάλθηκε. Έλεγξε τη σύνδεση στο διαδίκτυο."); } },
  ntPerm: async () => { try { const p = await Notification.requestPermission(); toast(p === "granted" ? "✓ Ενεργοποιήθηκαν" : "Δεν δόθηκε άδεια."); } catch { toast("Ο περιηγητής δεν το υποστηρίζει."); } },
  ntDone: () => { S.nt.on = $("#ntOn").checked; save(); closeSheet(); render(); },
  shopSave, delivSave, licGo,
  logoDel: () => { $("#shB").dataset.logoDel = "1"; delete $("#shB").dataset.logo; $("#shLogoPrev").innerHTML = `<span class="note">Χωρίς λογότυπο</span>`; },
  fSave: formSave,
  pasteClip: async () => { try { $("#ptxt").value = await navigator.clipboard.readText(); } catch { toast("Κράτα πατημένο το πλαίσιο και διάλεξε «Επικόλληση»."); } },
  pasteGo: () => { const t = $("#ptxt").value.trim(); if (!t) { toast("Επικόλλησε πρώτα το μήνυμα."); return; } A.importText(t); },
  ordEdit: () => { const o = curOrd(); if (!o) return; const q = {}, keep = {}; o.lines.forEach(l => { q[l.pid] = l.q; keep[l.pid] = l.price; }); orderForm({ id: o.id, name: o.cust.name, phone: o.cust.phone, addr: o.cust.addr, note: o.cust.note, date: o.when.date, slot: o.when.slot, how: o.when.how, q, keep }); },
  ordProof: () => { const o = curOrd(); if (o) proof(o); },
  ordRepeat: () => { const o = curOrd(); if (o) repeatOrder(o); },
  ordDel: () => { const o = curOrd(); if (!o || !confirm("Διαγραφή της παραγγελίας #" + o.no + ";")) return; S.orders = S.orders.filter(x => x !== o); save(); closeSheet(); render(); toast("Διαγράφηκε."); },
  dupKeep: () => { const o = curOrd(); if (!o) return; o.st = "new"; o.log.push([Date.now(), "Κρατήθηκε ως νέα"]); save(); closeSheet(); ordFilter.st = "new"; render(); },
  dupDel: () => { const o = curOrd(); if (!o) return; S.orders = S.orders.filter(x => x !== o); save(); closeSheet(); render(); toast("Η διπλή διαγράφηκε."); },
  custSave: () => { const c = S.customers[$("#shB").dataset.cust]; if (!c) return; c.name = $("#cuN").value.trim() || c.name; c.phone = $("#cuP").value.trim() || c.phone; c.addr = $("#cuA").value.trim(); c.notes = $("#cuNo").value.trim(); save(); closeSheet(); render(); },
  custNew: () => { const c = S.customers[$("#shB").dataset.cust]; if (c) orderForm({ name: c.name, phone: c.phone, addr: c.addr || "" }); },
  custRepeat: () => { const k = $("#shB").dataset.cust, s = custStats(k); const o = s.list.find(x => x.st !== "cancel") || s.list[0]; if (o) repeatOrder(o); },
  custPayAll: () => { const k = $("#shB").dataset.cust; S.orders.filter(o => custKey(o.cust.phone) === k && o.st === "done" && !o.paid).forEach(o => setStatus(o, "paid")); save(); openCust(k); render(); toast("✓ Πληρώθηκαν"); },
  custDel: () => { const k = $("#shB").dataset.cust, c = S.customers[k]; if (!c || !confirm("Οριστική διαγραφή του πελάτη «" + c.name + "» και όλων των παραγγελιών του;")) return; S.orders = S.orders.filter(o => custKey(o.cust.phone) !== k); delete S.customers[k]; save(); closeSheet(); render(); toast("Διαγράφηκε."); },
  xlsDay: () => { if (!proGate("excel")) return; download("paraggelies-" + totDay + ".csv", csv(xlsDay(totDay)), "text/csv"); },
  xlsGo: () => { download("paraggelies-" + $("#xF").value + "-eos-" + $("#xT").value + ".csv", csv(xlsOrders($("#xF").value, $("#xT").value)), "text/csv"); closeSheet(); },
  gdOn: async () => { try { await GlenDrive.connect(); toast("✓ Συνδέθηκε με Google Drive"); } catch { toast("Δεν έγινε σύνδεση."); } backupSheet(); },
  gdNow: async () => { try { await GlenDrive.uploadNow(); toast("✓ Ανέβηκε στο Google Drive."); } catch { toast("Δεν ανέβηκε. Έλεγξε τη σύνδεση στο διαδίκτυο."); } backupSheet(); },
  gdOff: () => { if (confirm("Αποσύνδεση από το Google Drive; Τα αρχεία που υπάρχουν εκεί μένουν.")) { GlenDrive.disconnect(); backupSheet(); } },
  gdRestore: async () => { try { const L = (await GlenDrive.list()).sort((a, b) => b.name.localeCompare(a.name)).slice(0, 10); sheet("Επαναφορά από Google Drive", `<div class="card list">${L.map((f, i) => `<div class="it" data-gdf="${esc(f.id)}"><div class="ic">📄</div><div class="t"><b>${esc(f.name)}</b>${i === 0 ? `<span>νεότερο</span>` : ""}</div></div>`).join("") || `<p class="note">Δεν βρέθηκαν αντίγραφα.</p>`}</div>`); } catch { toast("Δεν φορτώθηκε η λίστα."); } },
  phOn: async () => { try { const h = await window.showDirectoryPicker({ id: "backups", mode: "readwrite", startIn: "downloads" }); await PH.set(h); await PH.write(true); toast("✓ Γράφτηκε το πρώτο αντίγραφο."); } catch (e) { if (e && e.name !== "AbortError") { toast("Δεν έγινε· κατεβαίνει αρχείο."); ACT.fileOut(); } } backupSheet(); },
  phNow: async () => { try { toast(await PH.write(true) ? "✓ Γράφτηκε αντίγραφο." : "Δεν δόθηκε άδεια."); } catch { toast("Δεν γράφτηκε."); } backupSheet(); },
  phOff: async () => { await PH.set(null); backupSheet(); },
  phRestore: async () => { const L = await PH.list(); sheet("Επαναφορά από φάκελο", `<div class="card list">${L.map((f, i) => `<div class="it" data-phf="${esc(f.n)}"><div class="ic">📄</div><div class="t"><b>${esc(f.n)}</b>${i === 0 ? `<span>νεότερο</span>` : ""}</div></div>`).join("") || `<p class="note">Δεν βρέθηκαν αντίγραφα.</p>`}</div>`); A._phl = L; },
  fileOut: () => { download("paraggelies-antigrafo-" + today() + ".json", backupPayload(), "application/json"); S.meta.lastBackup = new Date().toISOString(); save(); }
};
A.ACT = ACT;
const curOrd = () => S.orders.find(x => x.id === $("#shB").dataset.ord);
document.addEventListener("click", async e => {
  const t = e.target;
  const tb = t.closest("#tabs [data-tab]"); if (tb) { if (tab !== tb.dataset.tab) { tab = tb.dataset.tab; window.scrollTo(0, 0); render(); } return; }
  if (t.id === "sheetbg") { closeSheet(); return; }
  const fm = t.closest("[data-fm]"); if (fm) { formQty(fm.dataset.fm, -1); return; }
  const fp = t.closest("[data-fp]"); if (fp) { formQty(fp.dataset.fp, 1); return; }
  const nx = t.closest("[data-next]"); if (nx) { e.stopPropagation(); const o = S.orders.find(x => x.id === nx.dataset.next); if (o) { setStatus(o, nx.dataset.to); render(); } return; }
  const os = t.closest("[data-ost]"); if (os) { ordFilter.st = os.dataset.ost; render(); return; }
  const od = t.closest("[data-oday]"); if (od) { ordFilter.day = od.dataset.oday; render(); return; }
  const td = t.closest("[data-tday]"); if (td) { totDay = td.dataset.tday; render(); return; }
  const ost = t.closest("[data-ordst]"); if (ost) { const o = curOrd(); if (o) { setStatus(o, ost.dataset.ordst); openOrder(o.id); render(); } return; }
  const op = t.closest("[data-ordpaid]"); if (op) { const o = curOrd(); if (o) { setStatus(o, op.dataset.ordpaid === "1" ? "paid" : "unpaid"); openOrder(o.id); render(); } return; }
  const gf = t.closest("[data-gdf]"); if (gf) { try { restoreText(await GlenDrive.download(gf.dataset.gdf)); } catch { toast("Δεν κατέβηκε."); } return; }
  const pf = t.closest("[data-phf]"); if (pf) { const f = (A._phl || []).find(x => x.n === pf.dataset.phf); if (f) restoreText(await (await f.h.getFile()).text()); return; }
  const or = t.closest(".ord[data-ord],.it[data-ord]"); if (or && !t.closest("button,a")) { openOrder(or.dataset.ord); return; }
  const cu = t.closest("[data-cust]"); if (cu && cu.classList.contains("it")) { openCust(cu.dataset.cust); return; }
  const a = t.closest("[data-act]");
  if (a && ACT[a.dataset.act]) { if (a.tagName === "A" && a.dataset.act !== "lkSent") e.preventDefault(); ACT[a.dataset.act](a, e); }
});
document.addEventListener("input", e => { if (e.target.id === "custQ") { custQ = e.target.value; const p = e.target.selectionStart; render(); const i = $("#custQ"); i.focus(); i.setSelectionRange(p, p); } });
document.addEventListener("change", e => {
  if (e.target.id === "lkPh") { if (e.target.checked && !proGate("photos")) { e.target.checked = false; return; } S.link.photos = e.target.checked; save(); linkSheet(); }
  if (e.target.id === "lkLg") { S.link.logo = e.target.checked; save(); linkSheet(); }
  if (e.target.matches("[data-fq]")) { readForm(); const t = $("#ftot"); if (t) { let s = 0; for (const [id, q] of Object.entries(F.q)) { const p = S.products[id]; if (p) s += K.round2(q * (F.keep[id] != null ? F.keep[id] : p.price)); } t.textContent = K.money(s); } }
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) { pollOnce(); if (S && Date.now() - updLast > 30 * 6e4) checkUpdate(false); } });
window.addEventListener("hashchange", () => handleHash().then(render));
/* ---------- κουμπί «πίσω» του κινητού: πάντα ένα βήμα πίσω ----------
   φύλλο → κλείνει · προεπισκόπηση → κλείνει · κατηγορία μενού → μία πάνω ·
   άλλη καρτέλα → Παραγγελίες · στις Παραγγελίες → «πάτα ξανά για έξοδο» */
let skipPop = 0, exitAt = 0;
function histPush(st) { try { history.pushState(st, ""); } catch {} }
function appBack() {
  if (tab === "menu" && A.menuBack && A.menuBack()) return true;
  if (tab !== "orders") { tab = "orders"; window.scrollTo(0, 0); render(); return true; }
  return false;
}
window.addEventListener("popstate", e => {
  if (skipPop) { skipPop--; return; }
  if (previewOpen()) { closePreview(true); return; }
  if (isSheetOpen()) { hideSheet(); return; }
  const st = e.state || {};
  if (st.root || !st.app) {
    if (appBack()) { histPush({ app: 1 }); return; }
    if (Date.now() - exitAt < 2000) { history.back(); return; }
    exitAt = Date.now(); toast("Πάτα ξανά «πίσω» για έξοδο", 2000); histPush({ app: 1 });
  }
});
/* ---------- λειτουργία δοκιμών: πελάτης ⇄ πωλητής στο ίδιο κινητό ---------- */
window.addEventListener("message", async e => {
  if (e.origin !== location.origin || !e.data || e.data.t !== "paraggelia" || typeof e.data.ct !== "string") return;
  const r = await receive(e.data.ct, "link");
  if (r.ok) { r.order.test = true; r.order.log.push([Date.now(), "Δοκιμή από την προβολή πελάτη"]); save(); toast("🛒 Η δοκιμαστική παραγγελία ήρθε στον πωλητή", 3500); }
});
function switchRole() {
  if (previewOpen()) { closePreview(false); tab = "orders"; ordFilter = { st: "new", day: "" }; window.scrollTo(0, 0); render(); pollOnce(); return; }
  const ok = shopOk();
  if (!ok.ok) { toast("Συμπλήρωσε πρώτα: " + ok.miss.join(", "), 4000); shopSheet(); return; }
  if (!Object.values(S.products).some(p => !p.del && !p.hidden) || !S.menu.length) { toast("Βάλε πρώτα προϊόντα στον κατάλογο."); tab = "menu"; render(); return; }
  makeLink().then(openPreview);
}
let secretN = 0, secretT = 0;
function secretTap() {
  if (Date.now() - secretT > 2500) secretN = 0;
  secretT = Date.now();
  if (++secretN >= 5) { secretN = 0; S.ui.test = !S.ui.test; save(); render(); toast(S.ui.test ? "🧪 Λειτουργία δοκιμών ενεργή: κουμπί «Πελάτης» πάνω δεξιά" : "Η λειτουργία δοκιμών έκλεισε"); }
}
/* ---------- προεπισκόπηση μέσα στην εφαρμογή ---------- */
const previewOpen = () => !!$("#pvWrap");
function openPreview(url) {
  if (previewOpen()) closePreview(false);
  histPush({ pv: 1 });
  document.body.insertAdjacentHTML("beforeend", `<div id="pvWrap" style="position:fixed;inset:0;z-index:80;background:#F3F4F1;display:flex;flex-direction:column">
   <div style="background:#1d2b36;color:#fff;padding:calc(8px + env(safe-area-inset-top)) 10px 8px;display:flex;align-items:center;gap:8px"><button type="button" data-act="pvClose" style="border:0;background:rgba(255,255,255,.15);color:#fff;border-radius:10px;padding:8px 12px;font-weight:800">← Πίσω</button><b style="flex:1">${S.ui.test ? "👤 Είσαι ο πελάτης" : "👁 Όπως το βλέπει ο πελάτης"}</b>${S.ui.test ? `<button type="button" data-act="role" style="border:0;background:#F2B632;color:#17324D;border-radius:10px;padding:8px 12px;font-weight:800">🏪 Πωλητής</button>` : ""}</div>
   <iframe id="pvFrame" style="flex:1;border:0;width:100%" title="Προεπισκόπηση"></iframe></div>`);
  $("#pvFrame").src = url;
}
function closePreview(fromPop) {
  const w = $("#pvWrap"); if (!w) return;
  w.remove();
  if (!fromPop && history.state && history.state.pv) { skipPop++; history.back(); }
}
A.openPreview = openPreview;

/* ---------- εκκίνηση ---------- */
async function boot() {
  try { S = await IDB.get("state"); } catch { S = null; }
  S = migrate(S || defaults());
  await ensureKeys();
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {}
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  try { history.replaceState({ root: 1 }, ""); histPush({ app: 1 }); } catch {}
  render();
  await handleHash();
  render();
  startPoll(); gdInit(); efmInit(); render();
  setTimeout(() => checkUpdate(false), 3000);
}
A.boot = boot;
window.addEventListener("load", () => boot());
})();
