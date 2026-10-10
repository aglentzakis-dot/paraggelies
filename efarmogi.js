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
/* τιμές Pro: κανονική 79 €/χρόνο· εισαγωγική 49 € τον πρώτο χρόνο έως OFFER_END· με σύσταση 49 € και τον δεύτερο χρόνο */
const PRO_FULL = 79, PRO_INTRO = 49, OFFER_END = "2028-10-11";
const PRO_TERMS = `<p><b>Κανονική τιμή:</b> ${PRO_FULL} € τον χρόνο.</p>
 <p><b>Εισαγωγική προσφορά:</b> όποιος αγοράσει Pro για πρώτη φορά έως ${OFFER_END.split("-").reverse().join("/")} πληρώνει ${PRO_INTRO} € για τον πρώτο χρόνο. Ισχύει μία φορά ανά επιχείρηση (ΑΦΜ) και ηλεκτρονικό ταχυδρομείο. Από τον δεύτερο χρόνο η ανανέωση γίνεται στην κανονική τιμή.</p>
 <p><b>Σύσταση:</b> όποιος αγοράσει για πρώτη φορά με τον κωδικό σύστασης άλλου επαγγελματία που έχει ενεργό Pro πληρώνει ${PRO_INTRO} € και τον δεύτερο χρόνο, αν ανανεώσει έως 30 ημέρες μετά τη λήξη του πρώτου. Ο κωδικός δηλώνεται στην πρώτη αγορά και δεν προστίθεται αργότερα. Δεν ισχύει ο δικός σου κωδικός ούτε για δεύτερο λογαριασμό της ίδιας επιχείρησης. Κωδικός που διαδίδεται με ανεπιθύμητα μαζικά μηνύματα ή με παραπλανητικό τρόπο μπορεί να ακυρωθεί.</p>
 <p>Οι προσφορές δεν συνδυάζονται μεταξύ τους και δεν εξαργυρώνονται σε χρήματα. Δεν υπάρχει αυτόματη ανανέωση ούτε αυτόματη χρέωση: κάθε χρόνο αποφασίζεις εσύ αν θα ανανεώσεις. Οι τιμές περιλαμβάνουν ΦΠΑ, όπου οφείλεται, και για κάθε πληρωμή εκδίδεται απόδειξη. Οι τιμές μπορεί να αλλάξουν για το μέλλον· όσοι έχουν ήδη πληρώσει ή δικαιούνται τιμή σύστασης την κρατούν για τον χρόνο που τους αναλογεί.</p>`;
const refCode = async em => "GA-" + (await sha256hex("REF|" + emailNorm(em))).slice(0, 6).toUpperCase();
function proPriceNow() {
  const L = S.lic || {}, first = !L.n && !L.until, offer = today() <= OFFER_END;
  if (first) return offer ? { v: PRO_INTRO, why: "τον πρώτο χρόνο (εισαγωγική προσφορά)" } : { v: PRO_FULL, why: "τον χρόνο" };
  if (L.ref && (L.n || 1) === 1) return { v: PRO_INTRO, why: "τον δεύτερο χρόνο (τιμή σύστασης)" };
  return { v: PRO_FULL, why: "τον χρόνο" };
}
const PRO_MAIL = "aglentzakis.apps@gmail.com";
const LIC_PUB = { kty: "EC", crv: "P-256", x: "vz6Lkoa7PzVQ1xGOcUyYmYPdOYYjbsp5t1xSsgc8cwg", y: "x9KzKNLFp5OKklXt6VcEaFlwr3wzvRjb1OJ9t1cBR1Q" };
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ST = { new: "Νέα", prep: "Ετοιμάζεται", done: "Παραδόθηκε", paid: "Πληρώθηκε", cancel: "Ακυρώθηκε", dup: "Πιθανή διπλή" };
const A = window.App = {};
/* ---------- επίδειξη: ξεχωριστά δεδομένα, τα πραγματικά δεν αγγίζονται ---------- */
const DEMO_FLAG = "glen-epideixi-paraggelies";
const DEMO = (() => { try { return !!localStorage.getItem(DEMO_FLAG); } catch { return false; } })();
const STKEY = DEMO ? "state-epideixi" : "state";
A.DEMO = DEMO;
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
  try { await IDB.set(STKEY, S); } catch (e) { toast("⚠️ Δεν αποθηκεύτηκε: " + (e && e.message || e)); }
  writing = false;
  if (again) { again = false; write(); }
}
function save(opt) {
  S.meta.changes = (S.meta.changes || 0) + 1;
  if (opt && opt.catalog) S.link.dirty = true;
  clearTimeout(saveT); saveT = setTimeout(write, 250);
  if (!DEMO) try { window.GlenDrive && GlenDrive.state().on && GlenDrive.changed(); } catch {}
  phoneBackupSoon();
  if ((opt && opt.catalog) || hasStock()) liveSoon();
  if (opt && opt.catalog) catSoon();
}
A.save = save; A.S = () => S;
/* ---------- ζωντανή διαθεσιμότητα: ο πελάτης βλέπει αμέσως τι τελείωσε, χωρίς νέο σύνδεσμο ---------- */
const hasStock = () => S && Object.values(S.products).some(p => !p.del && p.stock != null && p.stock !== "");
let liveT = null;
function liveSoon(ms, force) {
  if (!S.link.sentAt || !S.nt.spriv) return;
  clearTimeout(liveT); liveT = setTimeout(async () => { try {
    const o = K.liveBody(S), sig = JSON.stringify(Object.assign({}, o, { ts: 0 }));
    if (!force && sig === S.link.liveSig && S.link.liveAt && Date.now() - S.link.liveAt < 4 * 36e5) return;
    if (await K.livePublish(S, o)) { S.link.liveAt = Date.now(); S.link.liveSig = sig; clearTimeout(saveT); saveT = setTimeout(write, 250); } } catch {} }, ms == null ? 4000 : ms);
}
function liveKeep() { if (!S.link.liveAt || Date.now() - S.link.liveAt > 4 * 36e5) liveSoon(500, true); if (!S.link.catAt || Date.now() - S.link.catAt > 4 * 36e5) catSoon(1500, true); }
/* ο κατάλογος (προϊόντα, τιμές, κατηγορίες, ημέρες παράδοσης) φτάνει μόνος του σε όσους έχουν ήδη τον σύνδεσμο */
let catT = null;
function catSoon(ms, force) {
  if (!S.link.gSent || !S.nt.spriv) return;
  clearTimeout(catT); catT = setTimeout(async () => { try {
    const C = K.buildCatalog(S, { photos: false, logo: false, appUrl: BASE });
    const sig = JSON.stringify(Object.assign({}, C, { ts: 0 }));
    if (!force && sig === S.link.catSig) return;
    if (await K.catalogPublish(S, C)) { S.link.catSig = sig; S.link.catAt = Date.now(); S.link.dirty = false; clearTimeout(saveT); saveT = setTimeout(write, 250); if (tab === "orders" || tab === "more") render(); }
  } catch {} }, ms == null ? 8000 : ms);
}
setInterval(() => { try { S && liveKeep(); } catch {} }, 30 * 6e4);

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
const PRO_WHAT = { report: "ανάλυση σε PDF και Excel και αποστολή στον λογιστή", photos: "φωτογραφίες στον σύνδεσμο", products: "περισσότερα από " + FREE_PRODUCTS + " προϊόντα", viber: "κοινοποίηση μηνυμάτων από το Viber", excel: "εξαγωγή σε Excel" };
function proGate(what) { if (isPro()) return true; proSheet(what); return false; }
A.proGate = proGate; A.FREE_PRODUCTS = FREE_PRODUCTS;
function proSheet(what) {
  const l = lic(), pr = proPriceNow(), first = !S.lic.n && !S.lic.until, offer = today() <= OFFER_END;
  sheet("⭐ Pro", `
   ${what ? `<div class="warnbox">Το «${esc(PRO_WHAT[what] || what)}» είναι λειτουργία Pro.</div>` : ""}
   <div class="card"><b>${l.kind === "pro" ? "✓ Pro μέχρι " + esc(S.lic.until.split("-").reverse().join("/")) : l.kind === "trial" ? "Δωρεάν δοκιμή: μένουν " + l.left + " ημέρες" : "Δωρεάν έκδοση"}</b>
   <p class="note">Ο αγοραστής δεν πληρώνει ποτέ τίποτα. Η δοκιμή και το Pro αφορούν μόνο τον πωλητή.</p></div>
   <div class="card"><h3>Τι είναι πάντα δωρεάν</h3><p class="note" style="margin:0">Σύνδεσμος παραγγελίας, ειδοποιήσεις, λίστα παραγγελιών, σύνολα ημέρας, πελάτες, έως ${FREE_PRODUCTS} προϊόντα, αντίγραφα ασφαλείας.</p>
   <h3 style="margin-top:12px">Τι ανοίγει το Pro</h3><p class="note" style="margin:0">Απεριόριστα προϊόντα, φωτογραφίες στον σύνδεσμο, κοινοποίηση από το Viber, εξαγωγή σε Excel, ανάλυση εσόδων και εξόδων σε PDF και αποστολή στον λογιστή.</p></div>
   <div class="card" style="border:2px solid var(--accent)">
    <div style="display:flex;align-items:baseline;gap:8px"><span style="font-size:34px;font-weight:900;white-space:nowrap">${pr.v} €</span><span class="note" style="margin:0">${esc(pr.why)}</span></div>
    ${first && offer ? `<p style="margin:4px 0 0">Εισαγωγική τιμή για αγορές έως ${OFFER_END.split("-").reverse().join("/")}. Από τον δεύτερο χρόνο: <b>${PRO_FULL} € τον χρόνο</b>.</p>
     <div class="okbox">🤝 Σε σύστησε άλλος επαγγελματίας με Pro; Γράψε τον κωδικό του και πληρώνεις <b>${PRO_INTRO} € και τον δεύτερο χρόνο</b>.</div>
     <label class="f" for="lref">Κωδικός σύστασης (αν έχεις)</label><input class="t" id="lref" value="${esc(S.lic.ref || "")}" placeholder="π.χ. GA-4F9A2C" maxlength="12" style="text-transform:uppercase">` : ""}
    <button type="button" class="btn amber wide" data-act="buyPro" style="margin-top:10px">Αγορά Pro · ${pr.v} €</button>
    <p class="note">Ανοίγει μήνυμα προς ${PRO_MAIL} με τα στοιχεία σου. Μόλις γίνει η πληρωμή λαμβάνεις το κλειδί και την απόδειξη. Το κλειδί «Παραγγελίες» ανοίγει μόνο αυτή την εφαρμογή.</p>
    <details><summary class="note" style="cursor:pointer;font-weight:700">Όροι τιμών, προσφοράς και σύστασης</summary><div class="note">${PRO_TERMS}</div></details></div>
   ${l.kind === "pro" && S.lic.email ? `<div class="card"><h3>🤝 Ο κωδικός σύστασής σου</h3><div class="lnkbox" id="myRef" style="font-size:20px;font-weight:900;text-align:center">…</div><p class="note">Δώσ' τον σε συναδέλφους: με αυτόν πληρώνουν ${PRO_INTRO} € και τον δεύτερο χρόνο. Στείλ' τον μόνο σε όσους γνωρίζεις, όχι με μαζικά μηνύματα.</p><button type="button" class="btn soft wide" data-act="refShare">Στείλε τον κωδικό</button></div>` : ""}
   <div class="card"><h3>Ενεργοποίηση κλειδιού</h3>
   <label class="f" for="lmail">Ηλεκτρονικό ταχυδρομείο αγοράς</label><input class="t" id="lmail" type="email" value="${esc(S.lic.email || "")}">
   <label class="f" for="lkey">Κλειδί</label><textarea class="t" id="lkey" rows="3" placeholder="PA2…">${esc(S.lic.key || "")}</textarea>
   <div id="lerr"></div></div>`,
   `<button type="button" class="btn soft" data-act="shClose">Κλείσιμο</button><button type="button" class="btn amber" data-act="licGo">Ενεργοποίηση</button>`,
   async () => { const m = $("#myRef"); if (m) m.textContent = await refCode(S.lic.email); });
}
async function licGo() {
  const em = $("#lmail").value, key = $("#lkey").value;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailNorm(em))) { $("#lerr").innerHTML = `<div class="errbox">Γράψε το ηλεκτρονικό ταχυδρομείο με το οποίο αγόρασες.</div>`; return; }
  if (!licParse(key)) { $("#lerr").innerHTML = `<div class="errbox">Το κλειδί δεν έχει σωστή μορφή. Ξεκινά με «PA2».${/^DR2/i.test(key.trim()) ? " Αυτό είναι κλειδί του Δρομολογίου· για τις Παραγγελίες χρειάζεται ξεχωριστό κλειδί." : ""}</div>`; return; }
  const until = await licVerify(em, key);
  if (!until) { $("#lerr").innerHTML = `<div class="errbox">Το κλειδί δεν ταιριάζει με αυτό το ταχυδρομείο.</div>`; return; }
  if (until < today()) { $("#lerr").innerHTML = `<div class="errbox">Το κλειδί έχει λήξει (${until.split("-").reverse().join("/")}).</div>`; return; }
  if (S.lic.until !== until) S.lic.n = (S.lic.n || 0) + 1;
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
async function ensureLiveKeys() { if (S.nt.spub && S.nt.spriv) return; try { const l = await K.liveKeys(); S.nt.spub = l.pub; S.nt.spriv = l.priv; await write(); } catch {} }

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
/* όταν μια παραγγελία αδειάζει το απόθεμα, ο πωλητής το μαθαίνει αμέσως */
function stockAlert(o) {
  const out = [];
  for (const l of o.lines || []) { const p = S.products[l.pid]; if (!p) continue; const av = K.avail(p, S.orders); if (av !== Infinity && av <= 0) out.push(p.name + (av < 0 ? " (λείπουν " + K.num(-av) + ")" : "")); }
  if (out.length) { S.meta.stockOut = Date.now(); setTimeout(() => toast("📦 Τελείωσε το απόθεμα: " + out.join(", "), 6000), 600); }
}
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
  else {
    /* ίδιος πελάτης, ίδια ημέρα και τρόπος παράδοσης: γίνεται μία παραγγελία, αν η προηγούμενη είναι ακόμα «Νέα» */
    const host = o.when.date && S.orders.find(x => x.st === "new" && x.id !== o.id && custKey(x.cust.phone) === custKey(o.cust.phone) && x.when.date === o.when.date && x.when.how === o.when.how);
    if (host) { mergeInto(host, o); seenAdd(o.id); upsertCustomer(o.cust, o.rx); save(); stockAlert(host); return { ok: true, order: host, merged: true }; }
    const sib = o.when.date && S.orders.find(x => (x.st === "prep" || x.st === "done") && custKey(x.cust.phone) === custKey(o.cust.phone) && x.when.date === o.when.date);
    if (sib) { o.sib = sib.id; o.warn.push("Ο πελάτης έχει και την παραγγελία #" + sib.no + " για την ίδια ημέρα, που ήδη ετοιμάζεται. Πήγαινέ τις μαζί."); }
  }
  S.orders.push(o); seenAdd(o.id);
  upsertCustomer(o.cust, o.rx);
  save();
  stockAlert(o);
  return { ok: true, order: o };
}
function mergeInto(host, o) {
  const was = host.total;
  for (const l of o.lines) {
    const same = host.lines.find(h => h.pid === l.pid && Math.abs(h.price - l.price) < 0.004);
    if (same) { same.q = Math.round((same.q + l.q) * 1000) / 1000; same.sum = K.round2(same.q * same.price); same.added = (same.added || 0) + l.q; }
    else host.lines.push(Object.assign({}, l, { added: l.q }));
  }
  host.total = K.round2(host.lines.reduce((a, l) => a + l.sum, 0));
  if (o.cust.note) host.cust.note = (host.cust.note ? host.cust.note + " · " : "") + o.cust.note;
  if (o.cust.addr && !host.cust.addr) host.cust.addr = o.cust.addr;
  if (o.when.extra) host.when.extra = true;
  if (o.inv && o.inv.t === "i") host.inv = o.inv;
  delete host.seen;
  host.warn = (host.warn || []).concat(o.warn || []);
  host.merged = (host.merged || []).concat(o.id);
  host.adds = (host.adds || []).concat([{ at: o.rx || Date.now(), l: o.lines.map(l => [l.pid, l.q]) }]);
  if (!host.rx0) host.rx0 = host.rx;
  host.mergedAt = Date.now(); host.rx = Date.now();
  host.log.push([Date.now(), "Ενώθηκε με νέα παραγγελία του πελάτη (" + code(o) + "): " + K.money(was) + " → " + K.money(host.total)]);
  if (host.paid && host.paidAmt == null) host.paidAmt = was;
}
function rejectLog(msg) { S.rejected.unshift([Date.now(), msg]); S.rejected.length = Math.min(S.rejected.length, 30); }
/* ---------- λήψη παραγγελιών ----------
   1) ζωντανή σύνδεση (ροή γεγονότων) όσο η εφαρμογή είναι ανοιχτή: η παραγγελία μπαίνει αμέσως
   2) έλεγχος κάθε 20 δευτερόλεπτα για σιγουριά, και όταν ξανανοίγει η εφαρμογή ή επανέρχεται το διαδίκτυο
   3) όταν η εφαρμογή είναι κλειστή: ειδοποίηση από την ntfy, που ανοίγει την παραγγελία */
let liveES = null, liveOk = false, lastPollOk = 0, busyMsg = Promise.resolve();
async function handleMsg(m, manual) {
  let got = null;
  const mm = /#o=([0-9A-Za-z_.-]+)/.exec(String(m.click || ""));
  if (mm) { const r = await receive(mm[1], "link"); if (r.ok) { got = r.order; announce(r.order); } }
  else if (m.title && /Δοκιμή/.test(m.title) && !S.nt.on) S.nt.on = true;
  if (m.id) S.nt.since = m.id;
  return got;
}
function queueMsg(m) { busyMsg = busyMsg.then(async () => { const o = await handleMsg(m); save(); if (o) render(); else liveMark(); }).catch(() => {}); return busyMsg; }
async function pollOnce(manual) {
  if (!S || !S.nt.topic || DEMO || (document.hidden && !manual)) return;
  let msgs;
  try { msgs = await K.ntfyPoll(S.nt.topic, S.nt.since || "12h"); lastPollOk = Date.now(); } catch { liveMark(); if (manual) toast("Δεν υπάρχει σύνδεση με την υπηρεσία ειδοποιήσεων."); return; }
  let got = 0;
  await busyMsg;
  for (const m of msgs) if (await handleMsg(m)) got++;
  if (msgs.length) save();
  if (got) render(); else { liveMark(); if (manual === true) toast("✓ Όλα ενημερωμένα· δεν υπάρχουν νέες παραγγελίες."); }
}
function liveStart() {
  if (DEMO || !S || !S.nt.topic || liveES || document.hidden || typeof EventSource !== "function") return;
  try {
    liveES = new EventSource(K.NTFY + "/" + encodeURIComponent(S.nt.topic) + "/sse?since=" + encodeURIComponent(S.nt.since || "12h"));
    liveES.onopen = () => { liveOk = true; liveMark(); };
    liveES.onmessage = ev => { try { const m = JSON.parse(ev.data); if (m.event === "message") queueMsg(m); } catch {} };
    liveES.onerror = () => { liveOk = false; liveMark(); };
  } catch { liveES = null; }
}
function liveStop() { if (liveES) { try { liveES.close(); } catch {} liveES = null; } liveOk = false; }
function liveText() {
  if (DEMO) return "🎬 Επίδειξη: δεν γίνεται λήψη από το διαδίκτυο";
  const on = liveOk || Date.now() - lastPollOk < 60000;
  return on ? "🟢 Αυτόματη λήψη ενεργή · οι νέες παραγγελίες μπαίνουν μόνες τους" : navigator.onLine === false ? "🟠 Χωρίς διαδίκτυο · θα μπουν μόλις συνδεθείς" : "🟡 Σύνδεση με την υπηρεσία…";
}
function liveMark() { const e = $("#liveSt"); if (e) e.textContent = liveText(); }
function startPoll() {
  if (DEMO) return; clearInterval(pollT);
  pollT = setInterval(() => { pollOnce(); if (!liveES) liveStart(); }, 20000);
  setTimeout(() => { pollOnce(); liveStart(); }, 600);
  window.addEventListener("online", () => { pollOnce(); liveStop(); liveStart(); });
  window.addEventListener("focus", () => pollOnce());
}
function announce(o) {
  toast(o.mergedAt && Date.now() - o.mergedAt < 5000 ? "🔗 Ο/η " + o.cust.name + " πρόσθεσε κι άλλα στην παραγγελία #" + o.no + " — ενώθηκαν σε μία" : "🛒 Νέα παραγγελία από " + o.cust.name, 4500);
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
  if (S.ui.test && !rb) { $(".top").insertAdjacentHTML("beforeend", `<button type="button" class="lnk" id="roleBtn" data-act="role" aria-label="Προβολή ως πελάτης" style="background:#fff;color:#17324D;padding:8px 10px">👤</button>`); }
  else if (!S.ui.test && rb) rb.remove();
  $$("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  const gb = $("#gearBtn"); if (gb) gb.style.background = tab === "more" ? "var(--accent)" : "rgba(255,255,255,.12)";
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
  newBar();
}
A.render = render;
/* μπάρα «νέα παραγγελία» σε κάθε καρτέλα, μέχρι να ανοιχτεί η παραγγελία */
function unread() { return S ? S.orders.filter(o => (o.st === "new" || o.st === "dup") && !o.seen) : []; }
function newBar() {
  const U = unread(); let b = $("#newBar");
  if (!U.length) { b && b.remove(); return; }
  if (!b) { $(".top").insertAdjacentHTML("afterend", `<button type="button" id="newBar" data-act="seeNew"></button>`); b = $("#newBar"); }
  document.documentElement.style.setProperty("--toph", $(".top").offsetHeight + "px");
  const who = [...new Set(U.map(o => o.cust.name).filter(Boolean))].slice(0, 2).join(", ");
  b.innerHTML = `<span class="nbi">🔔</span><span class="nbt"><b>${U.length === 1 ? "Έχεις νέα παραγγελία" : "Έχεις " + U.length + " νέες παραγγελίες"}</b>${who ? `<small>${esc(who)}${U.length > 2 ? " και άλλοι" : ""}</small>` : ""}</span><span class="nbg">Δες ›</span>`;
}
A.seeNew = () => {
  const U = unread(); if (!U.length) return;
  if (isSheetOpen()) closeSheet();
  tab = "orders"; ordFilter = { st: U.some(o => o.st === "new") ? "new" : "dup", day: "" }; render(); window.scrollTo(0, 0);
  if (U.length === 1) openOrder(U[0].id);
};

/* ---------- επίδειξη ---------- */
function demoBanner() { return DEMO ? `<div class="card" style="background:#1d2b36;color:#fff;display:flex;gap:10px;align-items:center"><div style="font-size:28px">🎬</div><div style="flex:1"><b>Επίδειξη</b><div style="font-size:13px;opacity:.85">Παραδείγματα για δοκιμή. Τα δικά σου δεδομένα δεν αγγίζονται. Πάτα «👤 Πελάτης» πάνω δεξιά για να παραγγείλεις σαν πελάτης.</div></div><button type="button" class="btn sm amber" data-act="demoEnd">Τέλος</button></div>` : ""; }
async function demoStart() {
  if (!confirm("Ξεκινά επίδειξη με έτοιμα παραδείγματα. Τα δικά σου δεδομένα μένουν ανέγγιχτα και γυρίζουν μόλις πατήσεις «Τέλος επίδειξης». Συνέχεια;")) return;
  clearTimeout(saveT); await write();
  const D = defaults(), now = Date.now(), P = window.PROTYPA || {};
  Object.assign(D.shop, { name: "Η φάρμα της Κατερίνας", legal: "Αικατερίνη Παπαδοπούλου", addr: "Αγίου Δημητρίου 12, Μαρκόπουλο", afm: "094014201", phone: "6970000000", welcome: "Φρέσκα αυγά και γαλακτοκομικά κάθε πρωί", c1: "#0B6E4F", c2: "#F2B632" });
  const k = await K.genKeys(); Object.assign(D.nt, { pub: k.pub, priv: k.priv, topic: "parag_demo_" + K.uid(9).replace(/[.]/g, "_"), on: true });
  D.terms = { v: 1, at: now }; D.ui = { test: true }; D.lic = { trial: now };
  const ids = [];
  for (const key of ["avga", "galatas", "meli"]) { const pr = P[key]; if (!pr) continue;
    const top = { id: "n" + K.uid(5), t: "c", name: ({ avga: "Αυγά", galatas: "Γαλατάς", meli: "Μέλι" })[key] || pr.n, emoji: pr.e, size: "l", kids: [] };
    for (const [cn, ce, items] of pr.c) { const cat = { id: "n" + K.uid(5), t: "c", name: cn, emoji: ce, size: "m", kids: [] };
      for (const [n, u, price, step, o] of items) { const id = "p" + K.uid(5); D.products[id] = { id, name: n, unit: u, price, step: step || 1, vat: (o && o.v) || 13, perish: !(o && o.np), emoji: ce, hist: [[now, price]], created: now }; cat.kids.push({ id: "n" + K.uid(5), t: "p", pid: id, size: "m" }); ids.push(id); }
      top.kids.push(cat); }
    D.menu.push(top); }
  const people = [["Μαρία Νικολάου", "6971234567", "Ανεμώνης 3, Κορωπί", [2, 5], "09:00-11:00", "Κορωπί"], ["Γιώργος Αλεξίου", "6982345678", "Βασ. Παύλου 8, Μαρκόπουλο", [3], "10:00-12:00", "Μαρκόπουλο"], ["Ελένη Σταύρου", "6943456789", "Λεωφ. Λαυρίου 40, Παιανία", [1, 4], "17:00-19:00", "Παιανία"], ["Καφενείο «Η Πλατεία»", "2299012345", "Πλατεία Μαρκοπούλου", [1, 3, 5], "08:00-09:00", "Πλατεία"]];
  people.forEach(([name, phone, addr, days, slot, note], i) => { const kk = phone.slice(-10); D.customers[kk] = { key: kk, name, phone, addr, notes: "", first: now - 864e5 * 40, last: now - 864e5 * i, route: { days, slot, note, ex: true } }; });
  const mkO = (pi, items, dd, st, paid, extra, inv) => { const c = people[pi], lines = items.map(([ix, q]) => { const p = D.products[ids[ix]]; return { pid: p.id, name: p.name, unit: p.unit, q, price: p.price, vat: p.vat, sum: K.round2(q * p.price) }; });
    const at = now - 864e5 * Math.max(0, -dd) - 3600e3 * (pi + 1), when = K.ymd(new Date(now + 864e5 * dd));
    return { id: K.uid(12), no: ++D.seq, at, rx: at, cust: { name: c[0], phone: c[1], addr: c[2], note: "" }, when: { date: when, slot: c[4], how: "del", extra: !!extra }, lines, total: K.round2(lines.reduce((a, l) => a + l.sum, 0)), st, paid, paidAt: paid ? at + 3600e3 : 0, src: "link", warn: [], inv: inv || { t: "r" }, log: [[at, "Ήρθε από τον σύνδεσμο"]] }; };
  D.orders = [mkO(0, [[0, 2], [5, 1]], -6, "done", true), mkO(1, [[1, 1]], -4, "done", true), mkO(2, [[0, 1], [8, 2]], -3, "done", false), mkO(3, [[1, 2], [5, 4], [6, 3]], -1, "done", true, false, { t: "i", n: "Ο. Πλατεία ΟΕ", f: "094014201", d: "Κορωπίου", j: "Καφενείο", a: "Πλατεία Μαρκοπούλου" }),
    mkO(0, [[0, 2], [6, 2]], 0, "prep", false), mkO(1, [[2, 1], [9, 1]], 0, "new", false, true), mkO(2, [[0, 1]], 1, "new", false), mkO(3, [[1, 3], [7, 2]], 1, "new", false, false, { t: "i", n: "Ο. Πλατεία ΟΕ", f: "094014201", d: "Κορωπίου", j: "Καφενείο", a: "Πλατεία Μαρκοπούλου" })];
  D.cash = [{ id: "c1", kind: "out", d: K.ymd(new Date(now - 864e5 * 5)), amt: 42, cat: "Πρώτες ύλες", note: "Καλαμπόκι για τις κότες", src: "paraggelies" }, { id: "c2", kind: "out", d: K.ymd(new Date(now - 864e5 * 2)), amt: 25, cat: "Καύσιμα", note: "Διανομή", src: "paraggelies" }, { id: "c3", kind: "in", d: today(), amt: 9, cat: "Πώληση χωρίς παραγγελία", note: "Λαϊκή", src: "paraggelies" }];
  D.link.sentAt = now; D.link.dirty = false;
  await IDB.set("state-epideixi", D);
  try { localStorage.setItem(DEMO_FLAG, JSON.stringify({ at: now })); } catch {}
  location.reload();
}
async function demoEnd() {
  if (!confirm("Τέλος επίδειξης; Σβήνονται τα παραδείγματα. Τα δικά σου δεδομένα γυρίζουν ακριβώς όπως ήταν.")) return;
  try { await IDB.set("state-epideixi", null); } catch {}
  try { localStorage.removeItem(DEMO_FLAG); } catch {}
  location.reload();
}

/* ---------- πρώτα βήματα ---------- */
function setupDone() { return { shop: shopOk().ok, prod: Object.values(S.products).some(p => !p.del) && S.menu.length > 0, nt: !!S.nt.on, link: !!S.link.sentAt }; }
function onboarding() {
  const s = setupDone();
  if (s.shop && s.prod && s.nt && s.link) return "";
  const demoBtn = DEMO ? "" : `<button type="button" class="btn ghost wide" data-act="demoStart" style="margin:4px 0 8px">🎬 Δες πρώτα μια επίδειξη με έτοιμα παραδείγματα</button>`;
  const st = (ok, n, t, d, act, lbl) => `<div class="step${ok ? " ok" : ""}"><div class="n">${ok ? "✓" : n}</div><div class="t"><b>${t}</b><div class="note" style="margin:2px 0 6px">${d}</div>${ok ? "" : `<button type="button" class="btn sm ${n === 1 || (n === 2 && s.shop) || (n === 3 && s.prod) || (n === 4 && s.nt) ? "amber" : "soft"}" data-act="${act}">${lbl}</button>`}</div></div>`;
  return `<div class="card"><h2>👋 Καλώς ήρθες στις Παραγγελίες</h2><p class="note" style="margin:0 0 6px">Οι πελάτες σου θα παραγγέλνουν από έναν σύνδεσμο στο Viber, χωρίς τηλεφωνήματα. Τέσσερα βήματα:</p>${demoBtn}
   ${st(s.shop, 1, "Τα στοιχεία σου", "Όνομα, επωνυμία, διεύθυνση, ΑΦΜ, τηλέφωνο, λογότυπο και χρώματα.", "shop", "Συμπλήρωση")}
   ${st(s.prod, 2, "Τα προϊόντα σου", "Ξεκίνα από έτοιμο πρότυπο (αυγά, μέλι, λάδι, φούρνος, νερά) ή φτιάξε τα δικά σου.", "goMenu", "Κατάλογος")}
   ${st(s.nt, 3, "Ειδοποιήσεις", "Να χτυπάει το κινητό σου για κάθε νέα παραγγελία.", "notif", "Ενεργοποίηση")}
   ${st(s.link, 4, "Στείλε τον κατάλογο", "Στείλ' τον στους πελάτες σου στο Viber.", "link", "Αποστολή")}</div>`;
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
  const lk = S.link.sentAt && !S.link.gSent ? `<div class="warnbox"><b>Στείλε μία τελευταία φορά τον κατάλογο στους πελάτες σου.</b> Από εκεί και πέρα κάθε αλλαγή σε προϊόντα, τιμές και ημέρες φτάνει μόνη της, χωρίς νέο σύνδεσμο. <button type="button" class="btn sm amber" data-act="link" style="margin-top:6px">Στείλε τον κατάλογο</button></div>` : "";
  const ntw = S.shop.name && !S.nt.on ? `<div class="warnbox">🔔 Οι ειδοποιήσεις δεν έχουν ενεργοποιηθεί ακόμα. <button type="button" class="btn sm amber" data-act="notif" style="margin-top:6px">Ενεργοποίηση</button></div>` : "";
  return demoBanner() + updBanner() + installBanner() + (DEMO ? "" : onboarding()) + (DEMO ? "" : lk + ntw) + remindersHTML() + `
   <div class="note" id="liveSt" style="margin:0 2px 8px">${liveText()}</div>
   <div class="row" style="margin-bottom:10px"><button type="button" class="btn amber grow" data-act="newOrder">＋ Παραγγελία</button><button type="button" class="btn ghost grow" data-act="paste">📋 Από μήνυμα</button><button type="button" class="btn soft" data-act="poll" aria-label="Έλεγχος για νέες">⟳</button></div>
   <button type="button" class="btn soft wide" data-act="dvOpen" style="margin-bottom:10px">🚚 Οργάνωση διανομής ημέρας</button>
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
   <div class="row">${o.test ? `<span class="pill warn">🧪 Δοκιμή</span>` : ""}${o.when.extra ? `<span class="pill new">⚡ Έκτακτη</span>` : ""}${o.merged && o.merged.length ? `<span class="pill done">🔗 ${o.merged.length + 1} σε μία</span>` : ""}${["prep", "done", "cancel"].includes(o.st) && !o.test ? (ntfOf(o) ? `<span class="pill paid">💬 ✓</span>` : `<span class="pill warn">💬 χωρίς ενημέρωση</span>`) : ""}${o.sib ? `<span class="pill warn">🔗 μαζί με άλλη</span>` : ""}${o.inv && o.inv.t === "i" ? `<span class="pill done">📄 Τιμολόγιο</span>` : ""}<span class="pill ${o.st}">${ST[o.st]}</span>${o.paid ? `<span class="pill paid">Πληρωμένη</span>` : ""}${diffOf(o) > 0 ? `<span class="pill new">χρωστά ${K.money(diffOf(o))}</span>` : diffOf(o) < 0 ? `<span class="pill warn">επιστροφή ${K.money(-diffOf(o))}</span>` : ""}${o.warn && o.warn.length ? `<span class="pill warn">⚠️ ${o.warn.length}</span>` : ""}${o.cust.note ? `<span class="pill">📝</span>` : ""}<span class="grow"></span>${next ? `<button type="button" class="btn sm ${next[0] === "paid" ? "green" : "amber"}" data-next="${o.id}" data-to="${next[0]}">${next[1]}</button>` : ""}</div></div>`;
}
/* η κατάσταση πάει μόνο μπροστά: νέα → ετοιμάζεται → παραδόθηκε· κάθε βήμα με επιβεβαίωση */
const RANK = { dup: -1, new: 0, prep: 1, done: 2, cancel: 3 };
const STEP_MSG = {
  prep: o => "Να ξεκινήσει η ετοιμασία της παραγγελίας #" + o.no + " (" + o.cust.name + ");\n\nΗ παραγγελία καταχωρίζεται ως «Ετοιμάζεται» και μπαίνει στο πρόγραμμα παράδοσης. Δεν γυρίζει πίσω σε «Νέα».",
  done: o => "Παραδόθηκε η παραγγελία #" + o.no + " (" + o.cust.name + ");\n\nΔεν γυρίζει πίσω.",
  cancel: o => "Ακύρωση της παραγγελίας #" + o.no + " (" + o.cust.name + ");\n\nΗ ακύρωση είναι οριστική."
};
const paidOf = o => o.paid ? (o.paidAmt != null ? o.paidAmt : o.total) : 0;
/* διαφορά παραγγελίας που άλλαξε μετά την πληρωμή: θετική = χρωστά, αρνητική = του επιστρέφεις */
const diffOf = o => o.paid ? K.round2(o.total - paidOf(o)) : 0;
A.diffOf = diffOf;
function setStatus(o, st) {
  if (st === "paid") { o.paid = true; o.paidAt = Date.now(); o.paidAmt = o.total; o.log.push([Date.now(), "Πληρώθηκε " + K.money(o.total)]); save(); return true; }
  if (st === "paydiff") { const d = diffOf(o); o.paidAmt = o.total; o.paidAt = Date.now(); o.log.push([Date.now(), d > 0 ? "Πληρώθηκε η διαφορά " + K.money(d) : "Επιστράφηκε η διαφορά " + K.money(-d)]); save(); return true; }
  if (st === "unpaid") { if (!confirm("Να σημειωθεί ξανά ως απλήρωτη η παραγγελία #" + o.no + ";")) return false; o.paid = false; o.paidAt = 0; o.log.push([Date.now(), "Σημειώθηκε απλήρωτη"]); save(); return true; }
  if (st === o.st) return false;
  if (o.st === "cancel") { toast("Η παραγγελία έχει ακυρωθεί οριστικά."); return false; }
  if (st === "cancel" && o.st === "done") { toast("Η παραγγελία έχει παραδοθεί· δεν ακυρώνεται."); return false; }
  if (st !== "cancel" && (RANK[st] || 0) < (RANK[o.st] || 0)) { toast("Η παραγγελία είναι ήδη «" + ST[o.st] + "»· δεν γυρίζει πίσω."); return false; }
  if (STEP_MSG[st] && !confirm(STEP_MSG[st](o))) return false;
  if (st === "done" && o.st === "new") o.log.push([Date.now(), ST.prep]);
  o.st = st; o.log.push([Date.now(), ST[st]]);
  if (st === "prep") o.prepAt = Date.now();
  if (st === "done") o.doneAt = Date.now();
  save(); toast("✓ " + ST[st]);
  return true;
}
function openOrder(id) {
  const o = S.orders.find(x => x.id === id); if (!o) return;
  if (!o.seen) { o.seen = Date.now(); save(); newBar(); }
  const c = S.customers[custKey(o.cust.phone)];
  const phone = o.cust.phone;
  const locked = st => o.st === "cancel" || (st !== "cancel" && RANK[st] < RANK[o.st]) || (st === "cancel" && o.st === "done");
  const stBtn = (st, l) => `<button type="button" class="chip${o.st === st ? " on" : ""}" data-ordst="${st}"${locked(st) && o.st !== st ? ` disabled style="opacity:.4"` : ""}>${o.st !== st && locked(st) ? "🔒 " : ""}${l}</button>`;
  sheet("#" + o.no + " · " + o.cust.name, `
   ${o.st === "dup" ? `<div class="warnbox">Ήρθε ξανά ίδια παραγγελία μέσα σε 15 λεπτά. Μάλλον ο πελάτης πάτησε δύο φορές «Αποστολή».<div class="row" style="margin-top:8px"><button type="button" class="btn sm green" data-act="dupKeep">Είναι νέα, κράτησέ την</button><button type="button" class="btn sm red" data-act="dupDel">Διπλή, διαγραφή</button></div></div>` : ""}
   ${(o.warn || []).map(w => `<div class="warnbox">⚠️ ${esc(w)}</div>`).join("")}
   <div class="card"><div class="row"><span class="pill ${o.st}">${ST[o.st]}</span>${o.paid ? `<span class="pill paid">Πληρωμένη</span>` : ""}<span class="grow"></span><span class="note" style="margin:0">Κωδικός ${code(o)}</span></div>
    <p style="margin:8px 0 2px"><b>${o.when.how === "pick" ? "🏪 Παραλαβή" : "🚚 Παράδοση"}</b> · ${esc(fmtWhen(o))}</p>
    ${o.cust.addr ? `<p style="margin:2px 0">📍 ${esc(o.cust.addr)} <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.cust.addr)}" target="_blank" rel="noopener">χάρτης</a></p>` : ""}
    <p style="margin:2px 0">📞 <a href="tel:${esc(phone)}">${esc(phone)}</a></p>
    ${o.cust.note ? `<div class="warnbox">📝 ${esc(o.cust.note)}</div>` : ""}
    ${o.when.extra ? `<div class="warnbox">⚡ Έκτακτη παραγγελία, εκτός από τις κανονικές ημέρες του πελάτη.</div>` : ""}
    ${o.merged && o.merged.length ? `<div class="okbox">🔗 Ο πελάτης έστειλε ${o.merged.length + 1} παραγγελίες για την ίδια ημέρα· ενώθηκαν σε αυτή. Τα είδη που προστέθηκαν έχουν σημάδι «＋».</div>` : ""}
    ${o.inv && o.inv.t === "i" ? `<div class="okbox"><b>📄 Θέλει τιμολόγιο</b><br>${esc(o.inv.n)}<br>ΑΦΜ ${esc(o.inv.f)}${o.inv.d ? " · ΔΟΥ " + esc(o.inv.d) : ""}${o.inv.j ? "<br>" + esc(o.inv.j) : ""}<br>${esc(o.inv.a)}</div>` : o.inv && o.inv.t === "r" ? `<p class="note">🧾 Θέλει απόδειξη</p>` : ""}
    ${c && c.notes ? `<p class="note">Σημείωση πελάτη: ${esc(c.notes)}</p>` : ""}</div>
   <div class="card">${o.lines.map(l => `<div class="qrow"><div class="qn"><b>${esc(l.name)}${l.added ? ` <span class="pill done">＋${K.num(l.added)}</span>` : ""}</b><span>${K.num(l.q)} ${esc(l.unit)} × ${K.money(l.price)}${l.vat != null ? " · ΦΠΑ " + l.vat + "%" : ""}</span></div><b>${K.money(l.sum)}</b></div>`).join("")}
    <div class="row" style="margin-top:8px"><b class="grow">Σύνολο</b><b class="big-num" style="font-size:20px">${K.money(o.total)}</b></div>
    <p class="note">Οι τιμές γράφτηκαν από τον δικό σου κατάλογο, όπως ίσχυαν ${fmtTime(o.at)}.${o.src === "link" ? " Ο πελάτης αποδέχθηκε τους όρους και την ενημέρωση απορρήτου πριν την αποστολή." : ""}</p></div>
   <h3 style="margin:4px 2px 6px;font-size:15px">Κατάσταση</h3>
   <div class="chips">${stBtn("new", "Νέα")}${stBtn("prep", "Ετοιμάζεται")}${stBtn("done", "Παραδόθηκε")}${stBtn("cancel", "Ακυρώθηκε")}</div>
   ${diffOf(o) ? `<div class="${diffOf(o) > 0 ? "errbox" : "warnbox"}"><b>Η παραγγελία άλλαξε μετά την πληρωμή.</b><br>Πληρώθηκαν ${K.money(paidOf(o))}, νέο σύνολο ${K.money(o.total)}.<br>${diffOf(o) > 0 ? "Ο πελάτης <b>χρωστά " + K.money(diffOf(o)) + "</b>." : "Του <b>επιστρέφεις " + K.money(-diffOf(o)) + "</b>."}<div style="margin-top:8px"><button type="button" class="btn sm ${diffOf(o) > 0 ? "green" : "amber"}" data-ordpaid="diff">${diffOf(o) > 0 ? "€ Πλήρωσε τη διαφορά " + K.money(diffOf(o)) : "↩ Επιστράφηκαν " + K.money(-diffOf(o))}</button></div></div>` : ""}
   <div class="row" style="margin:0 0 12px">${o.paid ? `<span class="pill paid" style="font-size:14px;padding:8px 12px">✓ Πληρωμένη ${K.money(paidOf(o))}</span><button type="button" class="btn ghost grow" style="border-color:var(--bad);color:var(--bad)" data-ordpaid="0">✕ Σημείωσε απλήρωτη</button>` : `<button type="button" class="btn green grow" data-ordpaid="1">€ Πληρώθηκε ${K.money(o.total)}</button>`}</div>
   <div class="card" style="border-left:5px solid var(--accent)"><h3 style="margin:0 0 4px">💬 Ενημέρωση πελάτη</h3>
    <p class="note" style="margin:0 0 10px">Στέλνει στον πελάτη έτοιμο μήνυμα με την κατάσταση της παραγγελίας («${esc(ST[o.st])}»), τον κωδικό και το σύνολο.</p>
    ${ntfStatus(o)}<div class="row">${msgButtons(o)}</div></div>
   <div class="row" style="margin-bottom:12px"><button type="button" class="btn amber grow" data-act="ordPrint">🖨 Εκτύπωση</button><select class="t" id="prFmt" style="width:auto;flex:0 0 auto">${[["58", "Θερμικός 58 χιλ."], ["80", "Θερμικός 80 χιλ."], ["a4", "Χαρτί Α4"]].map(([k, l]) => `<option value="${k}"${(S.ui.printFmt || "58") === k ? " selected" : ""}>${l}</option>`).join("")}</select><button type="button" class="btn soft" data-act="ordPrText" aria-label="Κείμενο για εφαρμογή εκτυπωτή">📤</button></div>
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
/* μετά από αλλαγή κατάστασης: πρόταση να ενημερωθεί ο πελάτης */
function askNotify(o, st) {
  if (!["prep", "done", "cancel"].includes(st)) { if (isSheetOpen()) openOrder(o.id); return; }
  const head = { prep: "▶ Η παραγγελία ετοιμάζεται", done: "✓ Η παραγγελία παραδόθηκε", cancel: "✕ Η παραγγελία ακυρώθηκε" }[st];
  sheet("💬 Ενημέρωση πελάτη", `<div class="okbox"><b>${head}.</b> Θέλεις να το μάθει και ο/η ${esc(o.cust.name)};</div>
   <div class="card"><div class="note" style="margin:0 0 6px">Το μήνυμα που θα σταλεί:</div><div style="background:#f5f7f8;border-radius:10px;padding:10px;font-size:14.5px">${esc(statusText(o))}</div></div>
   ${ntfOf(o) ? ntfStatus(o) : ""}<div class="row" style="margin-bottom:10px">${msgButtons(o)}</div>`,
   `<button type="button" class="btn soft" data-act="shClose">Όχι τώρα</button><button type="button" class="btn ghost" data-act="ntOrder" data-oid="${o.id}">Άνοιγμα παραγγελίας</button>`);
}
function msgButtons(o) {
  const t = encodeURIComponent(statusText(o)), ph = o.cust.phone.replace(/[^\d+]/g, ""), intl = ph.startsWith("+") ? ph.slice(1) : ph.length === 10 ? "30" + ph : ph;
  const d = `data-oid="${o.id}"`;
  return `<a class="btn soft sm grow" href="viber://forward?text=${t}" data-ntf="Viber" ${d}>💬 Viber</a><a class="btn soft sm grow" href="sms:${esc(ph)}?body=${t}" data-ntf="μήνυμα" ${d}>✉️ Μήνυμα</a><a class="btn soft sm grow" href="https://wa.me/${esc(intl)}?text=${t}" target="_blank" rel="noopener" data-ntf="WhatsApp" ${d}>WhatsApp</a><a class="btn soft sm grow" href="tel:${esc(ph)}" data-ntf="τηλέφωνο" ${d}>📞</a>`;
}
/* καταγραφή ενημέρωσης πελάτη ανά κατάσταση, για να μην ξαναστέλνεται */
const ntfOf = o => (o.notified || {})[o.st];
function ntfStatus(o) {
  const n = ntfOf(o);
  if (n) return `<div class="okbox" style="margin:0 0 10px">✓ Ο πελάτης <b>ενημερώθηκε</b> για «${esc(ST[o.st])}» στις ${fmtTime(n.at)} (${esc(n.via)}). Δεν χρειάζεται να ξανασταλεί.</div>`;
  return `<div class="warnbox" style="margin:0 0 10px">✉️ <b>Δεν έχει σταλεί</b> ακόμα ενημέρωση για «${esc(ST[o.st])}».</div>`;
}
function proof(o) {
  const s = S.shop;
  const html = `<!DOCTYPE html><html lang="el"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Βεβαίωση παραγγελίας ${code(o)}</title>
  <style>body{font:15px/1.45 system-ui,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#111}h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin:14px 0}td,th{padding:6px 4px;border-bottom:1px solid #ccc;text-align:left}td.r,th.r{text-align:right}.big{font-size:18px;font-weight:800}.nf{border:2px solid #111;padding:8px;text-align:center;font-weight:800;margin:16px 0}.m{color:#555;font-size:13px}@media print{button{display:none}}</style></head><body>
  <h1>${esc(s.legal || s.name)}</h1><div class="m">${esc(s.addr)}${s.afm ? " · ΑΦΜ " + esc(s.afm) : ""}${s.phone ? " · " + esc(s.phone) : ""}</div>
  <div class="nf">ΔΕΝ ΑΠΟΤΕΛΕΙ ΦΟΡΟΛΟΓΙΚΟ ΠΑΡΑΣΤΑΤΙΚΟ</div>
  <p><b>Βεβαίωση παραγγελίας #${o.no}</b> · κωδικός ${code(o)}<br>Υποβολή: ${fmtTime(o.at)}<br>${o.when.how === "pick" ? "Παραλαβή" : "Παράδοση"}: ${esc(fmtWhen(o))}</p>
  <p><b>${esc(o.cust.name)}</b><br>${esc(o.cust.phone)}${o.cust.addr ? "<br>" + esc(o.cust.addr) : ""}</p>
  ${o.inv && o.inv.t === "i" ? `<p>Στοιχεία τιμολογίου: <b>${esc(o.inv.n)}</b> · ΑΦΜ ${esc(o.inv.f)}${o.inv.d ? " · ΔΟΥ " + esc(o.inv.d) : ""} · ${esc(o.inv.a)}</p>` : o.inv && o.inv.t === "r" ? `<p>Ζητήθηκε: απόδειξη</p>` : ""}
  <table><tr><th>Είδος</th><th class="r">Ποσότητα</th><th class="r">Τιμή</th><th class="r">Ποσό</th></tr>${o.lines.map(l => `<tr><td>${esc(l.name)}</td><td class="r">${K.num(l.q)} ${esc(l.unit)}</td><td class="r">${K.money(l.price)}</td><td class="r">${K.money(l.sum)}</td></tr>`).join("")}
  <tr><td colspan="3" class="big">Σύνολο</td><td class="r big">${K.money(o.total)}</td></tr></table>
  <div class="m">${s.vatIncl !== false ? "Οι τιμές περιλαμβάνουν ΦΠΑ." : "Οι τιμές δεν περιλαμβάνουν ΦΠΑ."} ${o.paid ? "Πληρωμένη." : "Δεν έχει πληρωθεί."}</div>
  <div class="nf">Η βεβαίωση αυτή δεν αποτελεί φορολογικό παραστατικό. Το νόμιμο παραστατικό εκδίδεται από τον πωλητή.</div>
  <div class="m">Παραγγελίες με GlenApps</div><p><button onclick="print()">Εκτύπωση</button></p></body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
  else { const b = new Blob([html], { type: "text/html" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "vevaiosi-" + code(o) + ".html"; a.click(); }
}

/* ---------- εκτύπωση: απλή, και σε θερμικό εκτυπωτή ---------- */
function printText(o, w) {
  w = w || 32;
  const pad = (a, b) => { a = String(a); b = String(b); const sp = Math.max(1, w - a.length - b.length); return a.length + b.length + 1 > w ? a + "\n" + " ".repeat(Math.max(0, w - b.length)) + b : a + " ".repeat(sp) + b; };
  const line = "-".repeat(w), sh = S.shop;
  const L = [sh.name || "", "ΠΑΡΑΓΓΕΛΙΑ #" + o.no + "  (" + code(o) + ")", line,
    (o.when.how === "pick" ? "Παραλαβή: " : "Παράδοση: ") + fmtWhen(o), o.when.extra ? "*** ΕΚΤΑΚΤΗ ***" : "", line,
    o.cust.name, o.cust.phone, o.cust.addr || "", o.cust.note ? "Σημ.: " + o.cust.note : "", line];
  for (const l of o.lines) { L.push(l.name); L.push(pad("  " + K.num(l.q) + " " + l.unit + " x " + K.money(l.price), K.money(l.sum))); }
  L.push(line, pad("ΣΥΝΟΛΟ", K.money(o.total)), o.paid ? "ΠΛΗΡΩΜΕΝΗ" : "ΑΠΛΗΡΩΤΗ");
  if (o.inv && o.inv.t === "i") L.push(line, "ΤΙΜΟΛΟΓΙΟ:", o.inv.n, "ΑΦΜ " + o.inv.f + (o.inv.d ? " ΔΟΥ " + o.inv.d : ""), o.inv.a);
  else if (o.inv && o.inv.t === "r") L.push("Παραστατικό: απόδειξη");
  L.push(line, "Δεν αποτελεί φορολογικό", "παραστατικό.", fmtTime(Date.now()));
  return L.filter(x => x !== "").join("\n");
}
function printOrder(o, fmt) {
  fmt = fmt || "58";
  const th = fmt !== "a4", mm = fmt === "80" ? 80 : 58;
  const css = th ? `@page{size:${mm}mm auto;margin:0}html,body{margin:0}body{width:${mm - 4}mm;padding:2mm;font:${mm === 58 ? 11 : 13}px/1.35 "Courier New",monospace;color:#000}pre{white-space:pre-wrap;margin:0;font:inherit;font-weight:700}`
    : `@page{size:A4;margin:15mm}body{font:15px/1.5 "Courier New",monospace;color:#000}pre{white-space:pre-wrap;font:inherit;font-size:16px}`;
  const txt = printText(o, th ? (mm === 58 ? 32 : 42) : 60);
  const html = `<!DOCTYPE html><html lang="el"><head><meta charset="UTF-8"><title>Παραγγελία ${o.no}</title><style>${css}</style></head><body><pre>${esc(txt)}</pre></body></html>`;
  const old = $("#prFrame"); if (old) old.remove();
  const f = document.createElement("iframe");
  f.id = "prFrame"; f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(f);
  const d = f.contentWindow.document; d.open(); d.write(html); d.close();
  setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch { toast("Η εκτύπωση δεν άνοιξε."); } }, 250);
  o.log.push([Date.now(), "Εκτυπώθηκε"]); save();
}

/* ---------- φόρμα παραγγελίας (νέα, αλλαγή, από μήνυμα, επανάληψη) ---------- */
let F = null;
function orderForm(init) {
  F = Object.assign({ id: null, name: "", phone: "", addr: "", note: "", date: K.availDays(Object.assign({}, S.deliv, { closed: K.closedDates(S.deliv) }))[0] || today(), slot: (S.deliv.slots || [])[0] || "", how: S.deliv.how === "pick" ? "pick" : "del", q: {}, keep: {}, src: "manual", rest: [] }, init || {});
  drawForm();
}
function drawForm() {
  const prods = Object.values(S.products).filter(p => !p.del && (!p.draft || F.q[p.id] > 0)).sort((a, b) => a.name.localeCompare(b.name, "el"));
  const sel = prods.filter(p => F.q[p.id] > 0), others = prods.filter(p => !(F.q[p.id] > 0));
  const custs = Object.values(S.customers).sort((a, b) => (b.last || 0) - (a.last || 0));
  let tot = 0;
  const fcu = S.customers[custKey(F.phone)];
  const row = p => { const q = F.q[p.id] || 0; const price = F.keep[p.id] != null ? F.keep[p.id] : K.priceFor(p, fcu, q || 1); tot += K.round2(q * price); return `<div class="qrow"><div class="qn"><b>${esc(p.name)}${p.soldout ? " · εξαντλήθηκε" : ""}</b><span>${K.money(price)} / ${esc(p.unit)}</span></div><button type="button" class="qb" data-fm="${p.id}">−</button><input class="qi" inputmode="decimal" data-fq="${p.id}" value="${q ? K.num(q) : ""}" placeholder="0"><button type="button" class="qb plus" data-fp="${p.id}">+</button></div>`; };
  sheet(F.id ? "Αλλαγή παραγγελίας" : F.src === "viber" ? "Παραγγελία από μήνυμα" : "Νέα παραγγελία", `
   ${F.src === "viber" ? `<div class="okbox">Συμπληρώθηκαν αυτόματα όσα αναγνωρίστηκαν. Έλεγξέ τα πριν την αποθήκευση.</div>${F.rest.length ? `<div class="warnbox">Δεν αναγνωρίστηκαν: ${esc(F.rest.join(" · "))}</div>` : ""}${F.text ? `<details class="card"><summary style="cursor:pointer;font-weight:700">Το μήνυμα</summary><p style="white-space:pre-wrap;margin:8px 0 0">${esc(F.text)}</p></details>` : ""}` : ""}
   <div class="card"><h3>Πελάτης</h3>
    ${custs.length ? `<select class="t" id="fcSel"><option value="">— Νέος ή διάλεξε πελάτη —</option>${custs.map(c => `<option value="${c.key}"${custKey(F.phone) === c.key ? " selected" : ""}>${esc(c.name)} · ${esc(c.phone)}</option>`).join("")}</select>` : ""}
    <label class="f" for="fn">Ονοματεπώνυμο</label><input class="t" id="fn" value="${esc(F.name)}" maxlength="80">
    <div class="two"><div><label class="f" for="fph">Τηλέφωνο</label><input class="t" id="fph" type="tel" value="${esc(F.phone)}" maxlength="20"></div><div><label class="f" for="fhow">Τρόπος</label><select class="t" id="fhow"><option value="del"${F.how === "del" ? " selected" : ""}>Παράδοση</option><option value="pick"${F.how === "pick" ? " selected" : ""}>Παραλαβή</option></select></div></div>
    <label class="f" for="fad">Διεύθυνση</label><input class="t" id="fad" value="${esc(F.addr)}" maxlength="160">
    <div class="two"><div><label class="f" for="fd">Ημέρα</label><input class="t" id="fd" type="date" value="${esc(F.date)}"></div><div><label class="f" for="fs">Ώρα</label>${(S.deliv.slots || []).length ? `<select class="t" id="fs"><option value="">—</option>${S.deliv.slots.map(x => `<option${x === F.slot ? " selected" : ""}>${esc(x)}</option>`).join("")}</select>` : `<input class="t" id="fs" value="${esc(F.slot)}" placeholder="π.χ. 10:00-12:00" maxlength="30">`}</div></div>
    <label class="f" for="fnote">Σημείωση</label><input class="t" id="fnote" value="${esc(F.note)}" maxlength="400"></div>
   ${prods.length ? `<div class="card"><h3>Είδη</h3><input class="t" id="fsearch" placeholder="🔍 Αναζήτηση…" style="margin-bottom:6px">${groupedRows(prods, row, id => F.q[id] > 0)}
    <div class="row" style="margin-top:10px;border-top:2px solid var(--line);padding-top:10px"><b class="grow">Σύνολο</b><b style="font-size:19px" id="ftot">${K.money(tot)}</b></div>
    ${F.id ? `<p class="note">Τα είδη που υπήρχαν κρατούν την τιμή της παραγγελίας· τα καινούργια μπαίνουν με την τρέχουσα τιμή.</p>` : ""}</div>` : `<div class="warnbox">Δεν έχεις ακόμα προϊόντα. Φτιάξε τα πρώτα στον Κατάλογο.</div>`}
   <div id="ferr"></div>`,
   `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-act="fSave">Αποθήκευση</button>`,
   el => {
     const s = el.querySelector("#fsearch");
     if (s) s.addEventListener("input", () => { const q = K.norm(s.value); const box = s.parentElement;
       box.querySelectorAll(".qrow").forEach(r => r.style.display = !q || K.norm(r.textContent).includes(q) ? "" : "none");
       box.querySelectorAll("details.fcat").forEach(d => { const any = [...d.querySelectorAll(".qrow")].some(r => r.style.display !== "none"); d.style.display = any ? "" : "none"; if (q) d.open = any; });
       if (!q) box.querySelectorAll("details.fcat").forEach(d => { d.open = false; }); });
     const cs = el.querySelector("#fcSel");
     if (cs) cs.addEventListener("change", () => { const c = S.customers[cs.value]; if (c) { readForm(); F.name = c.name; F.phone = c.phone; F.addr = c.addr || ""; drawForm(); } });
   });
}
/* είδη ομαδοποιημένα όπως στο μενού: κατηγορίες και υποκατηγορίες */
function groupedRows(list, row, picked) {
  picked = picked || (() => false);
  const want = new Set(list.map(p => p.id)), used = new Set();
  const countPicked = n => (n.kids || []).reduce((a, k) => a + (k.t === "p" ? (want.has(k.pid) && picked(k.pid) ? 1 : 0) : countPicked(k)), 0);
  const walk = (nodes, depth) => {
    let html = "";
    for (const n of nodes || []) {
      if (n.t === "p") { if (want.has(n.pid) && !used.has(n.pid)) { used.add(n.pid); html += row(S.products[n.pid]); } }
      else { const inner = walk(n.kids, depth + 1); const cnt = countPicked(n); if (inner) html += `<details class="fcat"${cnt ? " open" : ""} style="margin:${depth ? "2px 0 2px 10px" : "6px 0"};border-left:3px solid ${cnt ? "var(--ok)" : depth ? "var(--line)" : "var(--accent)"};padding-left:8px"><summary style="cursor:pointer;font-weight:800;padding:8px 0;font-size:${depth ? 14.5 : 16}px">${esc(n.emoji || "📁")} ${esc(n.name)}${cnt ? ` <span class="pill paid">${cnt} στην παραγγελία</span>` : ""}</summary>${inner}</details>`; }
    }
    return html;
  };
  let html = walk(S.menu, 0);
  const rest = list.filter(p => !used.has(p.id));
  if (rest.length) html += `<details class="fcat"${rest.some(p => picked(p.id)) ? " open" : ""} style="margin:6px 0;border-left:3px solid var(--line);padding-left:8px"><summary style="cursor:pointer;font-weight:800;padding:8px 0">📦 Χωρίς κατηγορία</summary>${rest.map(row).join("")}</details>`;
  return html;
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
  const lines = ids.map(id => { const p = S.products[id], q = F.q[id], price = F.keep[id] != null ? F.keep[id] : K.priceFor(p, S.customers[custKey(F.phone)], q, Date.now()); return { pid: id, name: p.name, unit: p.unit, q, price, vat: +p.vat || 0, sum: K.round2(q * price) }; });
  const total = K.round2(lines.reduce((a, l) => a + l.sum, 0));
  const cust = { name: F.name, phone: F.phone, addr: F.addr, note: F.note };
  const when = { date: F.date, slot: F.slot, how: F.how };
  if (F.id) {
    const o = S.orders.find(x => x.id === F.id); if (!o) return closeSheet();
    const was = o.total; if (o.paid && o.paidAmt == null) o.paidAmt = was;
    Object.assign(o, { cust, when, lines, total }); o.log.push([Date.now(), "Αλλαγή από εσένα" + (was !== total ? ": " + K.money(was) + " → " + K.money(total) : "")]);
    if (diffOf(o)) setTimeout(() => toast(diffOf(o) > 0 ? "⚠️ Ο πελάτης χρωστά τώρα τη διαφορά " + K.money(diffOf(o)) : "⚠️ Του επιστρέφεις " + K.money(-diffOf(o)), 4500), 300);
    upsertCustomer(cust, Date.now()); save(); closeSheet(); toast("✓ Αποθηκεύτηκε"); render(); openOrder(o.id); return;
  }
  const o = { id: K.uid(12), no: ++S.seq, at: Date.now(), rx: Date.now(), cust, when, lines, total, st: "new", seen: Date.now(), paid: false, src: F.src === "viber" ? "viber" : "manual", warn: [], log: [[Date.now(), F.src === "viber" ? "Από μήνυμα Viber" : "Καταχώριση από εσένα"]] };
  S.orders.push(o); seenAdd(o.id); upsertCustomer(cust, o.rx); save(); closeSheet(); toast("✓ Η παραγγελία καταχωρίστηκε");
  tab = "orders"; ordFilter = { st: "new", day: "" }; render();
}
function formQty(id, d) { readForm(); const p = S.products[id]; if (!p) return; const q = Math.max(0, Math.round(((F.q[id] || 0) + d * (+p.step || 1)) * 1000) / 1000); if (q > 0) F.q[id] = q; else delete F.q[id]; const y = $("#shB").scrollTop; drawForm(); $("#shB").scrollTop = y; }
A.importText = function (text) {
  const r = K.parseMsg(text, S);
  const c = r.cust;
  const q = {}; r.lines.forEach(l => q[l.pid] = l.q);
  orderForm({ src: "viber", text, rest: r.rest, name: c ? c.name : "", phone: c ? c.phone : r.phone, addr: c ? c.addr || "" : "", date: r.date || K.availDays(Object.assign({}, S.deliv, { closed: K.closedDates(S.deliv) }))[0] || today(), q });
};
function pasteSheet() {
  if (!proGate("viber")) return;
  sheet("📋 Παραγγελία από μήνυμα", `<p class="note" style="margin-top:0">Αντέγραψε το μήνυμα του πελάτη από το Viber και επικόλλησέ το εδώ. Συμπληρώνονται μόνα τους πελάτης, ποσότητες, προϊόντα και ημέρα, και τα ελέγχεις πριν την αποθήκευση.</p>
   <textarea class="t" id="ptxt" rows="6" placeholder="π.χ. Καλημέρα! 2 δωδεκάδες αυγά και ένα κιλό μέλι για αύριο. Μαρία"></textarea>
   <div class="card" style="margin-top:12px"><b>Πιο γρήγορα:</b><p class="note" style="margin:4px 0 0">Αφού βάλεις τις Παραγγελίες στην αρχική οθόνη, στο Viber κράτα πατημένο το μήνυμα → «Κοινοποίηση» → «Παραγγελίες». Η εφαρμογή διαβάζει μόνο το μήνυμα που διαλέγεις εσύ· ποτέ τις συνομιλίες σου.</p></div>`,
   `<button type="button" class="btn soft" data-act="pasteClip">Επικόλληση</button><button type="button" class="btn amber" data-act="pasteGo">Ανάγνωση</button>`);
}

/* ---------- σύνολα ημέρας ---------- */
/* ---------- Ταμείο: ίδια εμφάνιση με την εφαρμογή «Ταμεία» ---------- */
let totPer = "month";
const PERIODS = { today: "Σήμερα", week: "Αυτή η εβδομάδα", month: "Αυτός ο μήνας", prev: "Προηγούμενος μήνας", year: "Φέτος", all: "Όλα" };
/* ίδιες κατηγορίες με το βιβλίο «Εταιρεία» της εφαρμογής Ταμεία, ώστε να περνούν αυτούσιες εκεί */
const CKINDS = [["sales", "💶", "Πωλήσεις και υπηρεσίες", "in", ["Πωλήσεις", "Παροχή υπηρεσιών"]], ["cinother", "➕", "Άλλα έσοδα", "in", ["Επιδότηση", "Επιστροφή φόρου"]],
  ["buy", "🛒", "Αγορές και πρώτες ύλες", "out", ["Πρώτες ύλες", "Εμπορεύματα", "Συσκευασίες", "Ζωοτροφές"]],
  ["tax", "🏛️", "Φόροι και τέλη", "out", ["ΦΠΑ", "Φόρος εισοδήματος", "Προκαταβολή φόρου", "Τέλος επιτηδεύματος", "Δημοτικά τέλη"]], ["efka", "🧾", "Ασφαλιστικά", "out", ["ΕΦΚΑ", "Επικουρικό", "Εισφορές εργαζομένων"]],
  ["acct", "📒", "Λογιστής", "out", ["Μηνιαία αμοιβή", "Δηλώσεις", "Μισθοδοσία"]], ["staff", "👷", "Προσωπικό", "out", ["Μισθοί", "Μεροκάματα", "Δώρα και επιδόματα"]],
  ["office", "🏢", "Χώρος και λογαριασμοί", "out", ["Ενοίκιο", "ΔΕΗ", "Νερό", "Κοινόχρηστα", "Καθαριότητα", "Κινητό", "Σταθερό", "Σύνδεση διαδικτύου"]],
  ["repair", "🔧", "Επισκευές και συντηρήσεις", "out", ["Ψυκτικός", "Ηλεκτρολόγος", "Υδραυλικός", "Τεχνικός κλιματισμού και θέρμανσης", "Πυροσβεστήρες", "Απεντόμωση", "Τεχνικός υπολογιστών", "Επισκευή μηχανημάτων", "Επισκευή οχημάτων", "Οικοδομικές εργασίες", "Ανταλλακτικά"]],
  ["vehicle", "🚐", "Οχήματα εταιρείας", "out", ["Καύσιμα", "Σέρβις", "Ασφάλεια", "Τέλη κυκλοφορίας", "ΚΤΕΟ", "Διόδια", "Λάστιχα"]], ["equip", "🧰", "Εξοπλισμός, εργαλεία", "out", ["Εργαλεία", "Μηχανήματα", "Επισκευή εργαλείων", "Ρούχα εργασίας"]],
  ["soft", "💻", "Προγράμματα, συνδρομές", "out", ["Πρόγραμμα τιμολόγησης", "Εφαρμογές", "Ιστοσελίδα"]], ["ads", "📣", "Διαφήμιση", "out", ["Διαφήμιση στο διαδίκτυο", "Κάρτες, φυλλάδια", "Επιγραφές"]],
  ["bank", "🏦", "Τράπεζα και δάνεια", "out", ["Προμήθειες", "Τερματικό καρτών", "Τόκοι", "Δόση δανείου", "Χρηματοδοτική μίσθωση"]], ["insur", "🛡️", "Ασφάλειες", "out", ["Αστική ευθύνη", "Ασφάλεια χώρου"]], ["cother", "📦", "Άλλο", "out", []]]
  .map(([id, emoji, name, dir, subs]) => ({ id, emoji, name, dir, subs }));
const ckOf = id => CKINDS.find(k => k.id === id);
const cashLabel = x => { const k = ckOf(x.ck); return k ? k.emoji + " " + k.name + (x.sub ? " › " + x.sub : "") : x.cat || ""; };
function perRange() {
  const n = new Date(), y = n.getFullYear(), m = n.getMonth();
  if (totPer === "today") return [today(), today()];
  if (totPer === "week") { const d = new Date(n); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); const e = new Date(d); e.setDate(e.getDate() + 6); return [K.ymd(d), K.ymd(e)]; }
  if (totPer === "month") return [K.ymd(new Date(y, m, 1)), K.ymd(new Date(y, m + 1, 0))];
  if (totPer === "prev") return [K.ymd(new Date(y, m - 1, 1)), K.ymd(new Date(y, m, 0))];
  if (totPer === "year") return [y + "-01-01", y + "-12-31"];
  return ["0000", "9999"];
}
const cashList = () => S.cash || (S.cash = []);
function cashMoves() {
  const [f, t] = perRange(), inR = d => d >= f && d <= t, mv = [];
  for (const o of S.orders) if (o.paid && o.st !== "cancel" && o.st !== "dup") { const d = K.ymd(new Date(o.paidAt || o.rx)); if (inR(d)) mv.push({ d, kind: "in", amt: paidOf(o), cat: "💶 Πωλήσεις και υπηρεσίες › Παραγγελία #" + o.no, note: o.cust.name, ord: o.id }); }
  for (const c of cashList()) if (inR(c.d)) mv.push(Object.assign({ man: 1 }, c, { cat: cashLabel(c) }));
  return mv.sort((a, b) => b.d.localeCompare(a.d));
}
function totalsView() {
  const [f, t] = perRange();
  const mv = cashMoves();
  const inc = K.round2(mv.filter(x => x.kind === "in").reduce((a, x) => a + x.amt, 0)), out = K.round2(mv.filter(x => x.kind === "out").reduce((a, x) => a + x.amt, 0));
  const ords = S.orders.filter(o => o.st !== "cancel" && o.st !== "dup" && (o.when.date || K.ymd(new Date(o.rx))) >= f && (o.when.date || K.ymd(new Date(o.rx))) <= t);
  const sales = K.round2(ords.reduce((a, o) => a + o.total, 0)), owed = K.round2(ords.filter(o => !o.paid).reduce((a, o) => a + o.total, 0));
  const kpi = (c, l, v, col) => `<div class="card kpi" data-ana="${l === "Έσοδα" ? "in" : l === "Έξοδα" ? "out" : "all"}" role="button" style="margin:0;padding:10px;cursor:pointer"><div class="note" style="margin:0;display:flex;align-items:center;gap:6px"><span style="width:9px;height:9px;border-radius:5px;background:${c}"></span>${l}</div><div style="font-weight:800;font-size:19px;color:${col}">${K.money(v)}</div><div class="note" style="margin:2px 0 0;font-size:11.5px">Ανάλυση ›</div></div>`;
  const row = (l, v, col, b) => `<div class="qrow"><div class="qn">${b ? `<b>${l}</b>` : l}</div><b style="color:${col};${b ? "font-size:19px" : ""}">${v < 0 ? "− " : ""}${K.money(Math.abs(v))}</b></div>`;
  const debt = Object.values(S.customers).map(c => ({ c, v: custStats(c.key).owed })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
  const debtSum = K.round2(debt.reduce((a, x) => a + x.v, 0));
  return `<div class="row" style="margin:2px 2px 10px;align-items:center"><h2 style="margin:0;font-size:20px" class="grow">💶 Ταμείο</h2><button type="button" class="btn sm" data-act="owedSheet" style="background:${debtSum ? "#FBE7E3" : "#E3F1E8"};color:${debtSum ? "#C8412B" : "#2E7D5B"};border:1px solid ${debtSum ? "#F1B3AD" : "#A8D8B7"}">${debtSum ? "🔴 Σου χρωστάνε " + K.money(debtSum) : "✓ Κανείς δεν χρωστά"}</button></div>
   <label style="display:flex;align-items:center;gap:8px;background:var(--brand);color:#fff;border-radius:14px;padding:12px 14px;font-weight:800;margin-bottom:10px">⏳<select id="totPer" style="flex:1;background:transparent;border:0;color:#fff;font:inherit;font-weight:800;appearance:none">${Object.entries(PERIODS).map(([k, v]) => `<option value="${k}" style="color:#000"${k === totPer ? " selected" : ""}>${v}</option>`).join("")}</select><span style="color:var(--accent)">▾</span></label>
   <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">${kpi("#2E7D5B", "Έσοδα", inc, "#2E7D5B")}${kpi("#C8412B", "Έξοδα", out, "#C8412B")}${kpi("#2468B5", "Υπόλοιπο", inc - out, "#2468B5")}</div>
   <div class="row" style="margin-bottom:12px"><button type="button" class="btn grow" style="background:#E3F1E8;color:#2E7D5B;border:1px solid #A8D8B7" data-cash="in">＋ Έσοδο</button><button type="button" class="btn grow" style="background:#FBE7E3;color:#C8412B;border:1px solid #F1B3AD" data-cash="out">＋ Έξοδο</button></div>
   <h3 style="margin:4px 2px 6px;font-size:16px">🧮 Καθαρή εικόνα · ${PERIODS[totPer]}</h3>
   <div class="card">${row("Πωλήσεις από παραγγελίες", sales, "var(--ink)")}${row("Εισπράχθηκαν", inc, "#2E7D5B")}${row("Απλήρωτα (σου χρωστάνε)", owed, owed ? "#C8412B" : "var(--ink)")}${row("Έξοδα", -out, "#C8412B")}${row("Αυτό που μένει", inc - out, inc - out >= 0 ? "#2E7D5B" : "#C8412B", 1)}</div>
   <h3 style="margin:4px 2px 6px;font-size:16px">📒 Κινήσεις</h3>
   <div class="card list">${mv.length ? mv.slice(0, 80).map(x => `<div class="it"${x.ord ? ` data-ord="${x.ord}"` : x.man ? ` data-cashed="${x.id}"` : ""}><div class="ic">${x.kind === "in" ? "🟢" : "🔴"}</div><div class="t"><b>${esc(x.cat)}</b><span>${esc(K.dayLabel(x.d).replace(/^(Σήμερα|Αύριο), /, ""))}${x.note ? " · " + esc(x.note) : ""}</span></div><b style="color:${x.kind === "in" ? "#2E7D5B" : "#C8412B"}">${x.kind === "in" ? "" : "− "}${K.money(x.amt)}</b></div>`).join("") : `<p class="note">Καμία κίνηση σε αυτή την περίοδο.</p>`}</div>
   <h3 style="margin:14px 2px 6px;font-size:16px">📦 Ετοιμασία ημέρας</h3>
   ${prepView()}
   <p class="note">Οι κινήσεις έχουν την ίδια μορφή με την εφαρμογή «Ταμεία», για να περάσουν αργότερα εκεί.</p>`;
}
function cashSheet(kind, id) {
  const x = id ? cashList().find(c => c.id === id) : { kind, d: today(), amt: "", ck: kind === "in" ? "sales" : "buy", sub: "", vat: "", note: "" };
  if (!x) return; kind = x.kind;
  if (!x.ck) { const k = CKINDS.find(k => k.dir === kind && k.subs.includes(x.cat)); x.ck = k ? k.id : kind === "in" ? "cinother" : "cother"; x.sub = k ? x.cat : ""; }
  const kinds = CKINDS.filter(k => k.dir === kind), cur = ckOf(x.ck) || kinds[0];
  sheet(kind === "in" ? "＋ Έσοδο" : "＋ Έξοδο", `<div class="card"><label class="f" for="cxA" style="margin-top:0">Ποσό (€)</label><input class="t" id="cxA" inputmode="decimal" value="${x.amt !== "" ? K.num(x.amt) : ""}" style="font-size:22px;font-weight:800">
   <div class="two"><div><label class="f" for="cxD">Ημερομηνία</label><input class="t" id="cxD" type="date" value="${esc(x.d)}"></div><div><label class="f" for="cxV">ΦΠΑ</label><select class="t" id="cxV"><option value="">—</option>${[24, 13, 6, 0].map(v => `<option value="${v}"${String(x.vat) === String(v) ? " selected" : ""}>${v}%</option>`).join("")}</select></div></div></div>
   <div class="card"><h3>Κατηγορία</h3><div class="cxg">${kinds.map(k => `<button type="button" class="cxt${k.id === cur.id ? " on" : ""}" data-ck="${k.id}"><span class="e">${k.emoji}</span><span class="n">${esc(k.name)}</span></button>`).join("")}</div>
    <div id="cxSubs">${subsHTML(cur, x.sub)}</div></div>
   <div class="card"><label class="f" for="cxN" style="margin-top:0">Σημείωση</label><input class="t" id="cxN" value="${esc(x.note || "")}" maxlength="80" placeholder="π.χ. προμηθευτής, αριθμός παραστατικού"></div>
   <p class="note">Οι ίδιες κατηγορίες με το βιβλίο «Εταιρεία» της εφαρμογής Ταμεία.</p>
   ${id ? `<button type="button" class="btn red wide" data-act="cashDel">Διαγραφή κίνησης</button>` : ""}`,
   `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-act="cashSave">Αποθήκευση</button>`,
   el => { el.dataset.cid = id || ""; el.dataset.ckind = kind; el.dataset.xck = cur.id; el.dataset.xsub = x.sub || ""; setTimeout(() => { const i = el.querySelector("#cxA"); i && i.focus(); }, 80); });
}
function subsHTML(k, sel) { return k.subs.length ? `<label class="f">Είδος</label><div class="chips" style="flex-wrap:wrap">${k.subs.map(sb => `<button type="button" class="chip${sb === sel ? " on" : ""}" data-csub="${esc(sb)}">${esc(sb)}</button>`).join("")}</div>` : ""; }

/* ---------- έσοδο: είσπραξη από πελάτη ή άλλο έσοδο ---------- */
function debtors() { return Object.values(S.customers).map(c => ({ c, v: custStats(c.key).owed })).filter(x => x.v > 0).sort((a, b) => b.v - a.v); }
function incomeChooser() {
  const D = debtors(), sum = K.round2(D.reduce((a, x) => a + x.v, 0));
  sheet("＋ Έσοδο", `<div class="bigopts">
    <button type="button" class="bigopt" data-act="collectList"><span class="e">💶</span><span class="t"><b>Είσπραξη από πελάτη</b><small>${sum ? "Σου χρωστάνε " + K.money(sum) + " · " + D.length + (D.length === 1 ? " πελάτης" : " πελάτες") : "Κανείς δεν σου χρωστά"}</small></span><span class="g">›</span></button>
    <button type="button" class="bigopt" data-cashnew="in"><span class="e">➕</span><span class="t"><b>Άλλο έσοδο</b><small>Πώληση χωρίς παραγγελία, ενοίκιο, επιδότηση, τόκοι…</small></span><span class="g">›</span></button></div>`);
}
function collectList() {
  const D = debtors(), sum = K.round2(D.reduce((a, x) => a + x.v, 0));
  sheet("💶 Είσπραξη", D.length ? `<p class="note" style="margin-top:0">Πρώτα όσοι χρωστάνε τα περισσότερα. Πάτα έναν πελάτη για να σημειώσεις τι πλήρωσε.</p>
    <div class="card list">${D.map(x => `<div class="it" data-coll="${esc(x.c.key)}"><div class="ic">👤</div><div class="t"><b>${esc(x.c.name)}</b><span>${esc(x.c.phone || "")} · ${custUnpaid(x.c.key).length} ${custUnpaid(x.c.key).length === 1 ? "παραγγελία" : "παραγγελίες"}</span></div><b style="color:#C8412B;font-size:17px">${K.money(x.v)}</b></div>`).join("")}</div>
    <div class="row" style="padding:0 4px"><b class="grow">Σύνολο</b><b style="color:#C8412B;font-size:19px">${K.money(sum)}</b></div>` : `<div class="okbox">✓ Κανείς δεν σου χρωστά.</div>`, `<button type="button" class="btn soft" data-cash="in">← Πίσω</button>`);
}
function custUnpaid(k) { return S.orders.filter(o => custKey(o.cust.phone) === k && o.st !== "cancel" && o.st !== "dup" && ((o.st === "done" && !o.paid) || (o.paid && diffOf(o)))).sort((a, b) => (a.when.date || "").localeCompare(b.when.date || "") || a.rx - b.rx); }
function collectCust(k) {
  const c = S.customers[k]; if (!c) return;
  const L = custUnpaid(k), via = S.ui.payVia || "Μετρητά";
  const amt = o => o.paid ? diffOf(o) : o.total;
  sheet("💶 " + c.name, `<div class="card">${L.map(o => `<label class="ck" style="align-items:center"><input type="checkbox" data-colo="${o.id}" data-amt="${amt(o)}" checked><span style="flex:1"><b>#${o.no}</b> · ${esc(fmtWhen(o))}${o.paid ? " · διαφορά" : ""}</span><b>${K.money(amt(o))}</b></label>`).join("")}</div>
    <div class="card"><h3>Πώς πλήρωσε</h3><div class="chips">${["Μετρητά", "Κάρτα", "Τράπεζα"].map(v => `<button type="button" class="chip${v === via ? " on" : ""}" data-pv="${v}">${v === "Μετρητά" ? "💵" : v === "Κάρτα" ? "💳" : "🏦"} ${v}</button>`).join("")}</div></div>`,
    `<button type="button" class="btn soft" data-act="collectList">← Πίσω</button><button type="button" class="btn green" data-act="collectGo" id="colBtn">✓ Εισπράχθηκαν ${K.money(L.reduce((a, o) => a + amt(o), 0))}</button>`,
    el => { el.dataset.cust = k; });
}
function collectSum() { let t = 0; $$("[data-colo]").forEach(i => { if (i.checked) t += +i.dataset.amt || 0; }); const b = $("#colBtn"); if (b) b.textContent = "✓ Εισπράχθηκαν " + K.money(K.round2(t)); }

/* ---------- ανάλυση εσόδων και εξόδων, με PDF και Excel για τον λογιστή ---------- */
function anaData(kind) {
  const mv = cashMoves().filter(x => kind === "all" || x.kind === kind);
  const groups = {};
  for (const x of mv) {
    const k = x.ord ? "sales|Παραγγελίες" : (x.ck || "other") + "|" + (x.sub || "");
    const top = x.ord ? "💶 Πωλήσεις από παραγγελίες" : (ckOf(x.ck) ? ckOf(x.ck).emoji + " " + ckOf(x.ck).name : x.cat || "Άλλο");
    const g = groups[top] || (groups[top] = { name: top, kind: x.kind, sum: 0, subs: {}, n: 0 });
    g.sum = K.round2(g.sum + x.amt); g.n++;
    const sb = x.ord ? "" : (x.sub || ""); if (sb) g.subs[sb] = K.round2((g.subs[sb] || 0) + x.amt);
  }
  /* ΦΠΑ: από τις γραμμές των παραγγελιών και από τις κινήσεις με ΦΠΑ */
  const vat = {};
  const addV = (kd, rate, gross) => { if (rate === "" || rate == null || !isFinite(+rate)) return; const r = +rate, k = kd + "|" + r; const v = vat[k] || (vat[k] = { kind: kd, rate: r, gross: 0 }); v.gross = K.round2(v.gross + gross); };
  for (const x of mv) {
    if (x.ord) { const o = S.orders.find(y => y.id === x.ord); if (o) { const f = o.total ? x.amt / o.total : 1; for (const l of o.lines) addV("in", +l.vat || 0, l.sum * f); } }
    else addV(x.kind, x.vat, x.amt);
  }
  const G = Object.values(groups).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "in" ? -1 : 1) || b.sum - a.sum);
  const inc = K.round2(mv.filter(x => x.kind === "in").reduce((a, x) => a + x.amt, 0)), out = K.round2(mv.filter(x => x.kind === "out").reduce((a, x) => a + x.amt, 0));
  return { mv, G, inc, out, vat: Object.values(vat).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "in" ? -1 : 1) || b.rate - a.rate) };
}
const vatNet = v => K.round2(v.gross / (1 + v.rate / 100)), vatAmt = v => K.round2(v.gross - vatNet(v));
function anaSheet(kind) {
  const A2 = anaData(kind), [f, t] = perRange(), ttl = kind === "in" ? "Ανάλυση εσόδων" : kind === "out" ? "Ανάλυση εξόδων" : "Έσοδα και έξοδα";
  const max = Math.max(1, ...A2.G.map(g => g.sum));
  sheet("📊 " + ttl, `<div class="chips">${Object.entries(PERIODS).map(([k, v]) => `<button type="button" class="chip${k === totPer ? " on" : ""}" data-anaper="${k}" data-anak="${kind}">${v}</button>`).join("")}</div>
   <div class="card">${kind !== "out" ? `<div class="qrow"><div class="qn"><b>Έσοδα</b></div><b style="color:#2E7D5B;font-size:19px">${K.money(A2.inc)}</b></div>` : ""}${kind !== "in" ? `<div class="qrow"><div class="qn"><b>Έξοδα</b></div><b style="color:#C8412B;font-size:19px">${K.money(A2.out)}</b></div>` : ""}${kind === "all" ? `<div class="qrow"><div class="qn"><b>Υπόλοιπο</b></div><b style="color:#2468B5;font-size:19px">${K.money(A2.inc - A2.out)}</b></div>` : ""}</div>
   ${A2.G.length ? `<div class="card"><h3>Ανά κατηγορία</h3>${A2.G.map(g => `<div class="anr"><div class="anh"><b>${esc(g.name)}</b><b style="color:${g.kind === "in" ? "#2E7D5B" : "#C8412B"}">${K.money(g.sum)}</b></div><div class="anb"><i style="width:${Math.round(g.sum / max * 100)}%;background:${g.kind === "in" ? "#2E7D5B" : "#C8412B"}"></i></div>${Object.entries(g.subs).sort((a, b) => b[1] - a[1]).map(([n, v]) => `<div class="ans"><span>${esc(n)}</span><span>${K.money(v)}</span></div>`).join("")}</div>`).join("")}</div>` : `<div class="card" style="text-align:center;color:var(--mute)">Καμία κίνηση σε αυτή την περίοδο.</div>`}
   ${A2.vat.length ? `<div class="card"><h3>ΦΠΑ ανά συντελεστή</h3>${A2.vat.map(v => `<div class="qrow"><div class="qn"><b>${v.kind === "in" ? "Έσοδα" : "Έξοδα"} ${v.rate}%</b><span>καθαρό ${K.money(vatNet(v))} · ΦΠΑ ${K.money(vatAmt(v))}</span></div><b>${K.money(v.gross)}</b></div>`).join("")}<p class="note" style="margin:6px 0 0">Ενδεικτικός υπολογισμός από τις τιμές με ΦΠΑ. Τον τελικό τον κάνει ο λογιστής σου.</p></div>` : ""}
   <div class="card"><h3>⭐ Για τον λογιστή</h3><div class="row" style="flex-wrap:wrap"><button type="button" class="btn soft sm grow" data-anaout="pdf" data-anak="${kind}">📄 PDF</button><button type="button" class="btn soft sm grow" data-anaout="xlsx" data-anak="${kind}">📊 Excel</button><button type="button" class="btn amber sm grow" data-anaout="send" data-anak="${kind}">📧 Στείλε στον λογιστή</button></div>
    ${S.shop.acct ? `<p class="note" style="margin:6px 0 0">Λογιστής: ${esc(S.shop.acct)} · <a href="#" data-act="acctSet">αλλαγή</a></p>` : ""}</div>
   <p class="note">Περίοδος: ${f === "0000" ? "όλες οι κινήσεις" : esc(f.split("-").reverse().join("/")) + " έως " + esc(t.split("-").reverse().join("/"))}.</p>`);
}
function anaHTML(kind) {
  const A2 = anaData(kind), [f, t] = perRange(), sh = S.shop, ttl = kind === "in" ? "Ανάλυση εσόδων" : kind === "out" ? "Ανάλυση εξόδων" : "Έσοδα και έξοδα";
  const per = f === "0000" ? "Όλες οι κινήσεις" : f.split("-").reverse().join("/") + " – " + t.split("-").reverse().join("/");
  const m = v => K.money(v);
  return `<!DOCTYPE html><html lang="el"><head><meta charset="UTF-8"><title>${esc(ttl)} ${esc(per)}</title><style>@page{size:A4;margin:14mm}body{font:12.5px/1.45 system-ui,"Segoe UI",Arial,sans-serif;color:#111}h1{font-size:20px;margin:0}h2{font-size:15px;margin:18px 0 6px;border-bottom:2px solid #17324D;padding-bottom:3px}table{width:100%;border-collapse:collapse}td,th{padding:4px 6px;border-bottom:1px solid #ddd;text-align:left}th{background:#f1f3f5}.r{text-align:right;white-space:nowrap}.in{color:#1f6b45}.out{color:#b3261e}.sub td{color:#555;font-size:11.5px;padding-left:22px}.hd{display:flex;justify-content:space-between;align-items:flex-end;gap:12px}.small{color:#666;font-size:11px}</style></head><body>
   <div class="hd"><div><h1>${esc(ttl)}</h1><div>${esc(per)}</div></div><div class="small" style="text-align:right">${esc(sh.name || "")}${sh.legal ? "<br>" + esc(sh.legal) : ""}${sh.afm ? "<br>ΑΦΜ " + esc(sh.afm) : ""}${sh.addr ? "<br>" + esc(sh.addr) : ""}</div></div>
   <h2>Σύνοψη</h2><table>${kind !== "out" ? `<tr><td>Έσοδα</td><td class="r in"><b>${m(A2.inc)}</b></td></tr>` : ""}${kind !== "in" ? `<tr><td>Έξοδα</td><td class="r out"><b>${m(A2.out)}</b></td></tr>` : ""}${kind === "all" ? `<tr><td><b>Υπόλοιπο</b></td><td class="r"><b>${m(A2.inc - A2.out)}</b></td></tr>` : ""}</table>
   <h2>Ανά κατηγορία</h2><table><tr><th>Κατηγορία</th><th class="r">Κινήσεις</th><th class="r">Ποσό</th></tr>${A2.G.map(g => `<tr><td><b>${esc(g.name)}</b></td><td class="r">${g.n}</td><td class="r ${g.kind}"><b>${m(g.sum)}</b></td></tr>${Object.entries(g.subs).sort((a, b) => b[1] - a[1]).map(([n, v]) => `<tr class="sub"><td>${esc(n)}</td><td></td><td class="r">${m(v)}</td></tr>`).join("")}`).join("")}</table>
   ${A2.vat.length ? `<h2>ΦΠΑ ανά συντελεστή (ενδεικτικά)</h2><table><tr><th></th><th class="r">Καθαρό</th><th class="r">ΦΠΑ</th><th class="r">Σύνολο</th></tr>${A2.vat.map(v => `<tr><td>${v.kind === "in" ? "Έσοδα" : "Έξοδα"} ${v.rate}%</td><td class="r">${m(vatNet(v))}</td><td class="r">${m(vatAmt(v))}</td><td class="r">${m(v.gross)}</td></tr>`).join("")}</table>` : ""}
   <h2>Κινήσεις</h2><table><tr><th>Ημερομηνία</th><th>Κατηγορία</th><th>Σημείωση</th><th class="r">Ποσό</th></tr>${A2.mv.map(x => `<tr><td>${esc(x.d.split("-").reverse().join("/"))}</td><td>${esc(x.cat)}</td><td>${esc(x.note || "")}</td><td class="r ${x.kind}">${x.kind === "out" ? "− " : ""}${m(x.amt)}</td></tr>`).join("")}</table>
   <p class="small">Παραγγελίες με GlenApps · ${esc(new Date().toLocaleString("el-GR"))}. Δεν αποτελεί φορολογικό παραστατικό.</p></body></html>`;
}
function anaXlsx(kind) {
  const A2 = anaData(kind), rows = [["Ημερομηνία", "Είδος", "Κατηγορία", "Σημείωση", "ΦΠΑ %", "Ποσό €"]];
  for (const x of A2.mv) rows.push([x.d.split("-").reverse().join("/"), x.kind === "in" ? "Έσοδο" : "Έξοδο", x.cat, x.note || "", x.vat === "" || x.vat == null ? "" : +x.vat, x.kind === "out" ? -x.amt : x.amt]);
  const cat = [["Κατηγορία", "Είδος", "Κινήσεις", "Ποσό €"]]; for (const g of A2.G) { cat.push([g.name, g.kind === "in" ? "Έσοδο" : "Έξοδο", g.n, g.sum]); for (const [n, v] of Object.entries(g.subs)) cat.push(["   " + n, "", "", v]); }
  const vt = [["", "Συντελεστής %", "Καθαρό €", "ΦΠΑ €", "Σύνολο €"]]; for (const v of A2.vat) vt.push([v.kind === "in" ? "Έσοδα" : "Έξοδα", v.rate, vatNet(v), vatAmt(v), v.gross]);
  return GXlsx.write([{ name: "Κινήσεις", head: true, cols: [12, 9, 40, 30, 8, 12], num: [5], rows }, { name: "Ανά κατηγορία", head: true, cols: [40, 10, 10, 12], num: [3], rows: cat }, { name: "ΦΠΑ", head: true, cols: [10, 14, 12, 12, 12], num: [2, 3, 4], rows: vt }]);
}
function anaName(kind, ext) { const [f, t] = perRange(); return "tameio-" + (kind === "in" ? "esoda" : kind === "out" ? "exoda" : "kiniseis") + "-" + (f === "0000" ? "ola" : f + "-eos-" + t) + "." + ext; }
function printHTML(html) {
  const old = $("#prFrame"); if (old) old.remove();
  const f = document.createElement("iframe"); f.id = "prFrame"; f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(f); const d = f.contentWindow.document; d.open(); d.write(html); d.close();
  setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch { toast("Η εκτύπωση δεν άνοιξε."); } }, 300);
}
async function anaOut(how, kind) {
  if (!proGate("report")) return;
  if (how === "pdf") { printHTML(anaHTML(kind)); toast("Στο παράθυρο εκτύπωσης διάλεξε «Αποθήκευση ως PDF».", 4500); return; }
  const blob = anaXlsx(kind), name = anaName(kind, "xlsx");
  if (how === "xlsx") { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); toast("⬇️ Κατέβηκε το Excel."); return; }
  /* αποστολή στον λογιστή */
  let mail = S.shop.acct || ""; if (!mail) { mail = (prompt("Ηλεκτρονικό ταχυδρομείο του λογιστή σου:") || "").trim(); if (mail) { S.shop.acct = mail; save(); } }
  const [f, t] = perRange(), per = f === "0000" ? "όλες οι κινήσεις" : f.split("-").reverse().join("/") + " έως " + t.split("-").reverse().join("/");
  const subj = "Έσοδα και έξοδα " + (S.shop.name || "") + " · " + per, body = "Καλησπέρα,\n\nσας στέλνω τα έσοδα και τα έξοδα για την περίοδο " + per + " (συνημμένο Excel).\n\n" + (S.shop.legal || S.shop.name || "") + (S.shop.afm ? "\nΑΦΜ " + S.shop.afm : "");
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: subj, text: body }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  location.href = "mailto:" + encodeURIComponent(mail) + "?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(body + "\n\n(Επισύναψε το αρχείο " + name + " από τις Λήψεις.)");
}

function prepView() {
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
   <p class="note" style="margin:0 2px 8px">${L.length} ${L.length === 1 ? "παραγγελία" : "παραγγελίες"} · ${K.money(sum)} · εισπράχθηκαν ${K.money(paid)}</p>
   <div class="card"><h3>📦 Τι ετοιμάζω</h3>${prep.length ? prep.map(x => `<div class="qrow"><div class="qn"><b>${esc(x.name)}</b><span>${x.n} ${x.n === 1 ? "παραγγελία" : "παραγγελίες"} · ${K.money(x.sum)}</span></div><b style="font-size:18px">${K.num(x.q)} ${esc(x.unit)}</b></div>`).join("") : `<p class="note">Καμία παραγγελία για αυτή την ημέρα.</p>`}</div>
   ${del.length ? `<div class="card"><h3>🚚 Παραδόσεις (${del.length})</h3>${del.map(o => `<div class="list"><div class="it" data-ord="${o.id}"><div class="t"><b>${esc(o.cust.name)} · ${K.money(o.total)}</b><span>${esc(o.when.slot || "")} ${esc(o.cust.addr || "χωρίς διεύθυνση")}</span></div><span class="pill ${o.paid ? "paid" : o.st}">${o.paid ? "Πληρωμένη" : ST[o.st]}</span></div></div>`).join("")}</div>` : ""}
   ${pick.length ? `<div class="card"><h3>🏪 Παραλαβές (${pick.length})</h3>${pick.map(o => `<div class="list"><div class="it" data-ord="${o.id}"><div class="t"><b>${esc(o.cust.name)} · ${K.money(o.total)}</b><span>${esc(o.when.slot || "")}</span></div><span class="pill ${o.paid ? "paid" : o.st}">${o.paid ? "Πληρωμένη" : ST[o.st]}</span></div></div>`).join("")}</div>` : ""}
   <div class="row"><button type="button" class="btn ghost grow" data-act="xlsDay">📤 Εξαγωγή ημέρας σε Excel</button></div>
`;
}

/* ---------- πελάτες ---------- */
function custStats(k) {
  const L = S.orders.filter(o => custKey(o.cust.phone) === k && o.st !== "dup");
  const act = L.filter(o => o.st !== "cancel");
  const owed = K.round2(act.filter(o => o.st === "done" && !o.paid).reduce((a, o) => a + o.total, 0) + act.reduce((a, o) => a + diffOf(o), 0));
  return { n: act.length, sum: K.round2(act.reduce((a, o) => a + o.total, 0)), owed, list: L.sort((a, b) => b.rx - a.rx) };
}
function custsView() {
  const q = K.norm(custQ);
  const owe = {}; for (const k of Object.keys(S.customers)) owe[k] = custStats(k).owed;
  const L = Object.values(S.customers).filter(c => !q || K.norm(c.name + " " + c.phone + " " + (c.addr || "")).includes(q)).sort((a, b) => ((owe[b.key] > 0) - (owe[a.key] > 0)) || (owe[a.key] > 0 ? owe[b.key] - owe[a.key] : 0) || (b.last || 0) - (a.last || 0));
  const owedAll = K.round2(Object.keys(S.customers).reduce((a, k) => a + custStats(k).owed, 0));
  return `<div class="row" style="margin-bottom:10px"><input class="t grow" id="custQ" placeholder="🔍 Αναζήτηση πελάτη" value="${esc(custQ)}"><button type="button" class="btn amber" data-act="custNewBtn">＋ Νέος</button></div>
   ${owedAll > 0 ? `<div class="warnbox">Σου χρωστάνε συνολικά <b>${K.money(owedAll)}</b> από παραδομένες παραγγελίες.</div>` : ""}
   <div class="card list">${L.length ? L.map(c => { const s = custStats(c.key); return `<div class="it" data-cust="${c.key}"><div class="ic">👤</div><div class="t"><b>${esc(c.name)}${rateAvg(c.ratings) ? ` <span style="color:#F2B632;font-size:13px">★${rateAvg(c.ratings)}</span>` : ""}</b><span>${esc(c.phone)} · ${s.n} ${s.n === 1 ? "παραγγελία" : "παραγγελίες"} · τζίρος ${K.money(s.sum)}</span></div>${s.owed > 0 ? `<span class="pill new">χρωστά ${K.money(s.owed)}</span>` : s.owed < 0 ? `<span class="pill warn">επιστροφή ${K.money(-s.owed)}</span>` : ""}</div>`; }).join("") : `<p class="note">Οι πελάτες προστίθενται μόνοι τους με την πρώτη τους παραγγελία, ή με «＋ Νέος».</p>`}</div>`;
}
/* ---------- αξιολόγηση πελάτη (όπως στο Δρομολόγιο, για πωλητή) ---------- */
const RATE_CATS = [
  ["pay", "Πληρωμή", "πληρώνει στην ώρα του, χωρίς παζάρια και καθυστερήσεις"],
  ["behav", "Συμπεριφορά", "ευγένεια, σεβασμός, ηρεμία"],
  ["comm", "Συνεννόηση", "παραγγέλνει καθαρά, απαντάει, δεν αλλάζει γνώμη την τελευταία στιγμή"],
  ["punct", "Συνέπεια στην παράδοση", "είναι εκεί όταν πας, δεν σε στήνει, παραλαμβάνει"],
  ["value", "Αξία παραγγελιών", "μέγεθος και συχνότητα που αξίζουν τη διαδρομή"],
  ["claims", "Παράπονα και επιστροφές", "λίγα και δίκαια, όχι για να πάρει έκπτωση"],
  ["refer", "Συστάσεις", "σε φέρνει σε άλλους πελάτες"]
];
const rateAvg = r => { const v = Object.values(r || {}).map(Number).filter(n => n > 0); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : 0; };
const stars = n => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
function rateSheet(k) {
  const c = S.customers[k]; if (!c) return;
  const r = Object.assign({}, c.ratings || {}), x = custInfo(k);
  const hint = { pay: x.owed > 0 ? "Από τα στοιχεία: χρωστά τώρα " + K.money(x.owed) + (x.payDays != null ? " · πληρώνει σε " + x.payDays + " ημέρες κατά μέσο όρο" : "") : x.payDays != null ? "Από τα στοιχεία: πληρώνει σε " + x.payDays + " ημέρες κατά μέσο όρο" : "", value: x.n ? "Από τα στοιχεία: " + x.n + " παραγγελίες, μέση " + K.money(x.avg) : "", punct: x.cancel ? "Από τα στοιχεία: " + x.cancel + " ακυρωμένες" : "" };
  sheet("⭐ Αξιολόγηση: " + c.name, `<p class="note" style="margin-top:0">Μόνο για σένα — ο πελάτης δεν τη βλέπει. Πάτα αστέρια σε όσα θέλεις.</p>
   ${RATE_CATS.map(([id, t, d]) => `<div class="card" style="padding:10px 12px"><b>${t}</b><div class="note" style="margin:2px 0 6px">${d}</div>${hint[id] ? `<div class="note" style="margin:0 0 6px;color:var(--brand)">${esc(hint[id])}</div>` : ""}
     <div class="row" style="gap:4px">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-rate="${id}" data-v="${n}" style="border:0;background:none;font-size:30px;line-height:1;cursor:pointer;color:${(+r[id] || 0) >= n ? "#F2B632" : "#cfd6db"}">★</button>`).join("")}<button type="button" class="btn soft sm" data-rate="${id}" data-v="0" style="margin-left:auto">Καθαρισμός</button></div></div>`).join("")}
   <div class="card"><label class="f" for="rtNote" style="margin-top:0">Σημείωση</label><input class="t" id="rtNote" value="${esc(c.rateNote || "")}" maxlength="120" placeholder="π.χ. καλύτερα να του τηλεφωνείς πριν"></div>`,
   `<button type="button" class="btn soft" data-act="shClose">Κλείσιμο</button><button type="button" class="btn amber" data-act="rateSave">Αποθήκευση</button>`,
   el => { el.dataset.cust = k; el._r = r; });
}
/* ---------- αναλυτικά στοιχεία πελάτη ---------- */
function custInfo(k) {
  const all = S.orders.filter(o => custKey(o.cust.phone) === k && o.st !== "dup");
  const act = all.filter(o => o.st !== "cancel").sort((a, b) => a.rx - b.rx);
  const sum = K.round2(act.reduce((a, o) => a + o.total, 0)), n = act.length;
  const now = new Date(), y0 = K.ymd(new Date(now.getFullYear(), 0, 1)), m0 = K.ymd(new Date(now.getFullYear(), now.getMonth(), 1));
  const pm0 = K.ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), pm1 = K.ymd(new Date(now.getFullYear(), now.getMonth(), 0));
  const dOf = o => o.when.date || K.ymd(new Date(o.rx));
  const inR = (f, t) => K.round2(act.filter(o => dOf(o) >= f && dOf(o) <= t).reduce((a, o) => a + o.total, 0));
  const prod = {};
  act.forEach(o => o.lines.forEach(l => { const x = prod[l.name] || (prod[l.name] = { q: 0, unit: l.unit, sum: 0, n: 0 }); x.q += l.q; x.sum += l.sum; x.n++; }));
  const top = Object.entries(prod).sort((a, b) => b[1].sum - a[1].sum).slice(0, 4);
  const wd = {}; act.forEach(o => { if (o.when.date) { const d = K.fromYmd(o.when.date).getDay(); wd[d] = (wd[d] || 0) + 1; } });
  const favDay = Object.entries(wd).sort((a, b) => b[1] - a[1])[0];
  let gap = null; if (n > 1) gap = Math.round((act[n - 1].rx - act[0].rx) / 864e5 / (n - 1));
  const paidL = act.filter(o => o.paid && o.paidAt && o.doneAt);
  const payDays = paidL.length ? Math.round(paidL.reduce((a, o) => a + Math.max(0, (o.paidAt - o.doneAt) / 864e5), 0) / paidL.length) : null;
  const last = act[n - 1], since = last ? Math.round((Date.now() - last.rx) / 864e5) : null;
  const late = gap && since != null && since > gap * 1.8 && since > 7;
  return { n, sum, avg: n ? K.round2(sum / n) : 0, year: inR(y0, "9999"), month: inR(m0, "9999"), prev: inR(pm0, pm1), top, favDay: favDay ? K.WD[favDay[0]] : "", gap, payDays, owed: custStats(k).owed,
    paid: K.round2(act.reduce((a, o) => a + paidOf(o), 0)), cancel: all.filter(o => o.st === "cancel").length, extra: act.filter(o => o.when.extra).length,
    inv: act.filter(o => o.inv && o.inv.t === "i").length, first: act[0] ? act[0].rx : 0, last: last ? last.rx : 0, since, late };
}
function custInfoHTML(k) {
  const x = custInfo(k), c = S.customers[k], ra = rateAvg(c.ratings);
  const kp = (l, v, col) => `<div class="card" style="margin:0;padding:10px"><div class="lbl" style="font-size:12.5px;color:var(--mute)">${l}</div><div style="font-weight:800;font-size:18px;${col ? "color:" + col : ""}">${v}</div></div>`;
  const trend = x.prev ? Math.round((x.month - x.prev) / x.prev * 100) : null;
  const row = (l, v) => v ? `<div class="qrow"><div class="qn">${l}</div><b>${v}</b></div>` : "";
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
     ${kp("💶 Συνολικός τζίρος", K.money(x.sum))}${kp(x.owed < 0 ? "Του επιστρέφεις" : "🔴 Χρωστά", K.money(Math.abs(x.owed)), x.owed > 0 ? "var(--bad)" : x.owed < 0 ? "#b26b00" : "")}
     ${kp("🧾 Παραγγελίες", x.n)}${kp("Μέση παραγγελία", K.money(x.avg))}
     ${kp("Αυτόν τον μήνα", K.money(x.month) + (trend != null ? ` <small style="color:${trend >= 0 ? "#2E7D5B" : "#C8412B"}">${trend >= 0 ? "▲" : "▼"}${Math.abs(trend)}%</small>` : ""))}${kp("Φέτος", K.money(x.year))}</div>
   ${x.late ? `<div class="warnbox">⏰ Συνήθως παραγγέλνει κάθε ${x.gap} ημέρες, αλλά έχει ${x.since} ημέρες να παραγγείλει. Ίσως αξίζει ένα τηλέφωνο.</div>` : ""}
   <div class="card">${row("⭐ Αξιολόγηση", ra ? `<span style="color:#F2B632">${stars(ra)}</span> ${ra}` : "")}
     ${row("Πρώτη παραγγελία", x.first ? fmtTime(x.first).split(" ")[0] : "")}${row("Τελευταία παραγγελία", x.last ? fmtTime(x.last).split(" ")[0] + (x.since === 0 ? " (σήμερα)" : x.since === 1 ? " (χθες)" : x.since != null ? " (πριν " + x.since + " ημέρες)" : "") : "")}
     ${row("Παραγγέλνει περίπου κάθε", x.gap ? x.gap + " ημέρες" : "")}${row("Συνήθως για", x.favDay)}
     ${row("Πληρώνει κατά μέσο όρο σε", x.payDays != null ? (x.payDays ? x.payDays + " ημέρες μετά την παράδοση" : "την ίδια ημέρα") : "")}
     ${row("Έχει πληρώσει συνολικά", x.paid ? K.money(x.paid) : "")}${row("Έκτακτες παραγγελίες", x.extra || "")}${row("Ακυρώσεις", x.cancel || "")}${row("Παραστατικό", x.n ? (x.inv ? "τιμολόγιο σε " + x.inv + " από " + x.n : "απόδειξη") : "")}</div>
   ${x.top.length ? `<div class="card"><h3>🏆 Τι αγοράζει περισσότερο</h3>${x.top.map(([nm, v]) => `<div class="qrow"><div class="qn"><b>${esc(nm)}</b><span>${K.num(v.q)} ${esc(v.unit)} σε ${v.n} ${v.n === 1 ? "παραγγελία" : "παραγγελίες"}</span></div><b>${K.money(v.sum)}</b></div>`).join("")}</div>` : ""}
   <button type="button" class="btn ghost wide" data-act="rateOpen" style="margin-bottom:12px">⭐ ${ra ? "Αξιολόγηση " + ra + " · αναλυτικά" : "Αξιολόγηση πελάτη (πληρωμή, συμπεριφορά, συνέπεια…)"}</button>
   ${c.rateNote ? `<div class="note" style="margin:-6px 2px 12px">📝 ${esc(c.rateNote)}</div>` : ""}`;
}
function openCust(k) {
  const c = S.customers[k]; if (!c) return;
  const s = custStats(k);
  sheet(c.name, `${custInfoHTML(k)}
   <div class="card"><label class="f" for="cuN">Όνομα</label><input class="t" id="cuN" value="${esc(c.name)}"><label class="f" for="cuP">Τηλέφωνο</label><input class="t" id="cuP" value="${esc(c.phone)}"><label class="f" for="cuA">Διεύθυνση</label><input class="t" id="cuA" value="${esc(c.addr || "")}"><label class="f" for="cuAr">Περιοχή (για την οργάνωση της διανομής)</label><input class="t" id="cuAr" value="${esc(c.area || "")}" placeholder="π.χ. Κορωπί" list="areaL"><datalist id="areaL">${[...new Set(Object.values(S.customers).map(x => x.area).filter(Boolean))].map(a => `<option value="${esc(a)}">`).join("")}</datalist><label class="f" for="cuNo">Σημειώσεις (μόνο για σένα)</label><input class="t" id="cuNo" value="${esc(c.notes || "")}"></div>
   ${custPriceCard(c)}
   <div class="card"><h3>🚚 Πότε περνάς</h3><p style="margin:0 0 8px">${c.route && c.route.days && c.route.days.length ? esc(c.route.days.map(x => K.WD[x]).join(", ")) + (c.route.slot ? " · " + esc(c.route.slot) : "") + (c.route.note ? " · " + esc(c.route.note) : "") + (c.route.ex !== false ? " · ⚡ δέχεται έκτακτη" : "") : `<span class="note">Δεν έχεις δηλώσει ημέρες· βλέπει τις γενικές.</span>`}</p>
    <div class="row"><button type="button" class="btn soft sm grow" data-act="custRoute">📅 Ημέρες</button><button type="button" class="btn amber sm grow" data-act="custLink">📤 Στείλε του τον κατάλογο</button></div></div>
   <div class="row" style="margin-bottom:12px"><a class="btn soft grow" href="tel:${esc(c.phone)}">📞 Κλήση</a><button type="button" class="btn amber grow" data-act="custNew">＋ Παραγγελία</button>${s.list.length ? `<button type="button" class="btn ghost grow" data-act="custRepeat">🔁 Ξανά την τελευταία</button>` : ""}</div>
   ${s.owed > 0 ? `<button type="button" class="btn green wide" data-act="custPayAll" style="margin-bottom:12px">€ Πλήρωσε όλα όσα χρωστά (${K.money(s.owed)})</button>` : s.owed < 0 ? `<button type="button" class="btn amber wide" data-act="custPayAll" style="margin-bottom:12px">↩ Επιστράφηκαν ${K.money(-s.owed)}</button>` : ""}
   <div class="card list"><h3>Ιστορικό</h3>${s.list.map(o => `<div class="it" data-ord="${o.id}"><div class="t"><b>#${o.no} · ${K.money(o.total)}</b><span>${esc(fmtWhen(o))} · ${esc(o.lines.map(l => K.num(l.q) + " " + l.name).join(", "))}</span></div><span class="pill ${o.paid ? "paid" : o.st}">${o.paid ? "Πληρωμένη" : ST[o.st]}</span></div>`).join("") || `<p class="note">Καμία παραγγελία.</p>`}</div>
   <button type="button" class="btn red wide" data-act="custDel">Διαγραφή πελάτη και των παραγγελιών του</button>
   <p class="note">Η διαγραφή ικανοποιεί αίτημα διαγραφής του πελάτη (GDPR). Πρόσεξε: αν χρειάζεσαι τις παραγγελίες για τα βιβλία σου, κάνε πρώτα εξαγωγή.</p>`,
   `<button type="button" class="btn soft" data-act="shClose">Κλείσιμο</button><button type="button" class="btn amber" data-act="custSave">Αποθήκευση</button>`);
  $("#shB").dataset.cust = k;
}
/* ---------- έξυπνες υπενθυμίσεις στην αρχή των παραγγελιών ---------- */
function remindersList() {
  const R = [], t1 = addDays(today(), 1);
  const act = S.orders.filter(o => o.st !== "cancel" && o.st !== "dup");
  const tom = act.filter(o => o.when.date === t1);
  if (tom.length) R.push({ id: "tom", ic: "🚚", t: `Έχεις <b>${tom.length}</b> ${tom.length === 1 ? "παραγγελία" : "παραγγελίες"} για αύριο (${K.money(tom.reduce((a, o) => a + o.total, 0))})`, act: `data-dvday="${t1}"` });
  const tod = act.filter(o => o.when.date === today() && (o.st === "new" || o.st === "prep"));
  if (tod.length) R.push({ id: "tod", ic: "📦", t: `Σήμερα: ${tod.length === 1 ? "<b>1</b> παραγγελία δεν έχει παραδοθεί" : "<b>" + tod.length + "</b> παραγγελίες δεν έχουν παραδοθεί"} ακόμα`, act: `data-dvday="${today()}"` });
  const unpaid = act.filter(o => o.st === "done" && !o.paid);
  if (unpaid.length) R.push({ id: "unpaid", ic: "💶", t: `${unpaid.length === 1 ? "Υπάρχει <b>1</b> ανεξόφλητη παράδοση" : "Υπάρχουν <b>" + unpaid.length + "</b> ανεξόφλητες παραδόσεις"} (${K.money(unpaid.reduce((a, o) => a + o.total, 0))})`, act: `data-remgo="unpaid"` });
  /* τακτικοί πελάτες που αργούν */
  const quiet = [];
  for (const c of Object.values(S.customers)) {
    const os = act.filter(o => custKey(o.cust.phone) === c.key).sort((a, b) => a.rx - b.rx);
    const regular = (c.route && (c.route.days || []).length) || os.length >= 3;
    if (!regular || !os.length) continue;
    const last = os[os.length - 1].rx, gaps = os.slice(1).map((o, i) => o.rx - os[i].rx), avg = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 7 * 864e5;
    const wait = Math.max(7 * 864e5, Math.min(avg * 1.5, 30 * 864e5));
    if (Date.now() - last > wait && !os.some(o => o.when.date && o.when.date >= today())) quiet.push({ c, days: Math.floor((Date.now() - last) / 864e5) });
  }
  quiet.sort((a, b) => a.days - b.days);
  for (const q of quiet.slice(0, 3)) R.push({ id: "q-" + q.c.key, ic: "👤", t: `Ο/η <b>${esc(q.c.name)}</b> δεν έχει παραγγείλει εδώ και ${q.days} ημέρες`, act: `data-cust="${esc(q.c.key)}" data-remc="1"` });
  if (quiet.length > 3) R.push({ id: "q-more", ic: "👥", t: quiet.length - 3 === 1 ? "Και άλλος 1 τακτικός πελάτης αργεί να παραγγείλει" : `Και άλλοι ${quiet.length - 3} τακτικοί πελάτες αργούν να παραγγείλουν`, act: `data-remgo="custs"` });
  const low = Object.values(S.products).filter(p => !p.del && !p.draft && p.stock != null && p.stock !== "").map(p => [p, K.avail(p, S.orders)]).filter(([p, a]) => a <= Math.max(0, (+p.stock || 0) * 0.15));
  if (low.length) R.push({ id: "stock", ic: "📦", t: `Απόθεμα: ${low.slice(0, 3).map(([p, a]) => "<b>" + esc(p.name) + "</b> " + (a <= 0 ? "τελείωσε" : "μένουν " + K.num(a))).join(", ")}${low.length > 3 ? "…" : ""}`, act: `data-remgo="stock"` });
  const nd = Object.values(S.products).filter(p => !p.del && p.draft).length;
  if (nd) R.push({ id: "draft", ic: "📝", t: nd === 1 ? "<b>1</b> ενδεικτικό προϊόν περιμένει έλεγχο και ενεργοποίηση" : `<b>${nd}</b> ενδεικτικά προϊόντα περιμένουν έλεγχο και ενεργοποίηση`, act: `data-remgo="draft"` });
  const hide = (S.ui.remHide && S.ui.remHide.d === today()) ? S.ui.remHide.ids || [] : [];
  return R.filter(r => !hide.includes(r.id));
}
function remindersHTML() {
  if (DEMO && !S.orders.length) return "";
  const R = remindersList(); if (!R.length) return "";
  return `<div class="card rem"><div style="display:flex;align-items:center;margin-bottom:4px"><h3 style="margin:0;flex:1">💡 Υπενθυμίσεις</h3><button type="button" class="lnk" data-act="remHideAll" aria-label="Απόκρυψη για σήμερα" style="color:var(--mute);background:none;border:0;font-size:13px">Κρύψ' τες για σήμερα</button></div>
   ${R.map(r => `<div class="remi" ${r.act}><span class="ic">${r.ic}</span><span class="tx">${r.t}</span><span class="go">›</span></div>`).join("")}</div>`;
}
/* ---------- οργάνωση διανομής: παραγγελίες ημέρας ανά περιοχή, ώρα ή πελάτη ---------- */
const DROMOLOGIO = "https://aglentzakis-dot.github.io/dromologio/";
let dvDay = "", dvBy = "area";
function areaOf(o) { const c = S.customers[custKey(o.cust.phone)] || {}; const a = (c.area || "").trim(); if (a) return a; const ad = (o.cust.addr || c.addr || "").split(",").map(x => x.trim()).filter(Boolean); return ad.length > 1 ? ad[ad.length - 1] : "Χωρίς περιοχή"; }
const slotKey = o => { const m = /(\d{1,2})[:.](\d{2})/.exec(o.when.slot || ""); return m ? m[1].padStart(2, "0") + ":" + m[2] : "99"; };
function dvOrders(day) { return S.orders.filter(o => o.st !== "cancel" && o.st !== "dup" && o.when.date === day); }
function dvGroups(L) {
  const del = L.filter(o => o.when.how !== "pick"), pick = L.filter(o => o.when.how === "pick");
  const map = new Map();
  const key = o => dvBy === "time" ? (o.when.slot || "Χωρίς ώρα") : dvBy === "cust" ? o.cust.name : areaOf(o);
  for (const o of del.slice().sort((a, b) => slotKey(a).localeCompare(slotKey(b)) || areaOf(a).localeCompare(areaOf(b), "el") || a.cust.name.localeCompare(b.cust.name, "el"))) { const k = key(o); if (!map.has(k)) map.set(k, []); map.get(k).push(o); }
  let G = [...map.entries()].map(([k, os]) => ({ k, os }));
  if (dvBy === "time") G.sort((a, b) => slotKey(a.os[0]).localeCompare(slotKey(b.os[0]))); else G.sort((a, b) => a.k.localeCompare(b.k, "el"));
  if (pick.length) G.push({ k: "🏠 Παραλαβή από εσένα", os: pick, pick: 1 });
  return G;
}
const mapsQ = a => encodeURIComponent(a);
function routeUrl(os) { const ad = os.map(o => o.cust.addr || (S.customers[custKey(o.cust.phone)] || {}).addr || "").filter(Boolean); if (!ad.length) return ""; const dest = ad[ad.length - 1], wp = ad.slice(0, -1).slice(0, 9); return "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" + mapsQ(dest) + (wp.length ? "&waypoints=" + wp.map(mapsQ).join("%7C") : ""); }
function dvSheet(day) {
  const act = S.orders.filter(o => o.st !== "cancel" && o.st !== "dup");
  const days = [...new Set([today(), addDays(today(), 1)].concat(act.filter(o => o.when.date && o.when.date >= today()).map(o => o.when.date)))].sort().slice(0, 10);
  dvDay = day || dvDay || today(); if (!days.includes(dvDay)) days.unshift(dvDay);
  const L = dvOrders(dvDay), G = dvGroups(L);
  const load = {}; for (const o of L) for (const l of o.lines) { const k = l.name + "|" + l.unit; load[k] = (load[k] || 0) + l.q; }
  const owed = K.round2(L.filter(o => !o.paid).reduce((a, o) => a + o.total, 0));
  const stop = o => { const c = S.customers[custKey(o.cust.phone)] || {}, ad = o.cust.addr || c.addr || ""; return `<div class="dvs"><div class="dvh"><b>${esc(o.cust.name)}</b><span class="note">${o.when.slot ? esc(o.when.slot) + " · " : ""}#${o.no} · ${K.money(o.total)} ${o.paid ? "✓ πληρώθηκε" : "<b style='color:var(--bad)'>να εισπραχθεί</b>"}</span></div>
     ${ad ? `<div class="note">📍 ${esc(ad)}</div>` : `<div class="note" style="color:var(--bad)">Χωρίς διεύθυνση</div>`}
     <div class="note">${esc(o.lines.map(l => K.num(l.q) + " " + l.unit + " " + l.name).join(" · "))}</div>${o.cust.note ? `<div class="note">📝 ${esc(o.cust.note)}</div>` : ""}
     <div class="row" style="margin-top:6px;flex-wrap:wrap"><a class="btn soft sm" href="tel:${esc(o.cust.phone)}">📞</a>${ad ? `<a class="btn soft sm" href="https://www.google.com/maps/search/?api=1&query=${mapsQ(ad)}" target="_blank" rel="noopener">🗺 Χάρτης</a>` : ""}<button type="button" class="btn soft sm" data-dvdr="${o.id}">📲 Δρομολόγιο</button><button type="button" class="btn ghost sm" data-dvo="${o.id}">Άνοιγμα</button></div></div>`; };
  sheet("🚚 Διανομή", `
   <div class="chips">${days.map(d => `<button type="button" class="chip${d === dvDay ? " on" : ""}" data-dvday="${d}">${esc(K.dayLabel(d))}<span class="n">${dvOrders(d).length}</span></button>`).join("")}</div>
   <div class="chips">${[["area", "📍 Περιοχή"], ["time", "🕘 Ώρα"], ["cust", "👤 Πελάτης"]].map(([k, l]) => `<button type="button" class="chip${dvBy === k ? " on" : ""}" data-dvby="${k}">${l}</button>`).join("")}</div>
   ${L.length ? `<div class="card"><div class="okbox" style="margin-top:0">${L.length === 1 ? "1 παραγγελία" : L.length + " παραγγελίες"} · ${K.money(L.reduce((a, o) => a + o.total, 0))}${owed ? ` · <b>να εισπραχθούν ${K.money(owed)}</b>` : ""}</div>
    <details><summary style="cursor:pointer;font-weight:700">📦 Τι φορτώνω</summary>${Object.entries(load).sort().map(([k, q]) => { const [n, u] = k.split("|"); return `<div class="qrow"><div class="qn"><b>${esc(n)}</b></div><b>${K.num(q)} ${esc(u)}</b></div>`; }).join("")}</details></div>
    ${G.map(g => `<div class="card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><h3 style="margin:0;flex:1">${esc(g.k)} <span class="note" style="font-weight:400">· ${g.os.length}</span></h3>${!g.pick && routeUrl(g.os) ? `<a class="btn sm amber" href="${esc(routeUrl(g.os))}" target="_blank" rel="noopener">🗺 Διαδρομή</a>` : ""}</div>${g.os.map(stop).join("")}</div>`).join("")}
    <p class="note">«🗺 Διαδρομή» ανοίγει τους Χάρτες Google με τις στάσεις της ομάδας στη σειρά (έως 10). «📲 Δρομολόγιο» περνάει την παράδοση στο Δρομολόγιο της GlenApps μαζί με τον πελάτη και τη διεύθυνση, χωρίς να τα γράψεις ξανά.</p>`
   : `<div class="card" style="text-align:center;color:var(--mute)">Δεν υπάρχουν παραγγελίες για ${esc(K.dayLabel(dvDay))}.</div>`}`);
}
function dromologioLink(o) {
  const c = S.customers[custKey(o.cust.phone)] || {}, ad = o.cust.addr || c.addr || "";
  const ar = areaOf(o) === "Χωρίς περιοχή" ? "" : areaOf(o);
  const parts = ad.split(",").map(x => x.trim()).filter(Boolean);
  const street = ar && parts.length > 1 && K.norm(parts[parts.length - 1]) === K.norm(ar) ? parts.slice(0, -1).join(", ") : ad;
  const m = /(\d{1,2})[:.](\d{2})/.exec(o.when.slot || "");
  const start = o.when.date ? o.when.date + "T" + (m ? m[1].padStart(2, "0") + ":" + m[2] : "09:00") : "";
  const pk = { v: 1, k: "job", from: S.shop.name || "Παραγγελίες", to: "", pid: "", src: "parag-" + o.id, at: Date.now(), b: null,
    t: { title: "Παράδοση #" + o.no + " · " + o.cust.name, desc: o.lines.map(l => K.num(l.q) + " " + l.unit + " " + l.name).join(", ") + " · " + K.money(o.total) + (o.paid ? " (πληρώθηκε)" : " (να εισπραχθεί)") + (o.cust.note ? "\n" + o.cust.note : ""), start, end: "", status: "pending", priority: 2, area: areaOf(o) === "Χωρίς περιοχή" ? "" : areaOf(o), address: ad, loc: null, amount: o.paid ? "" : o.total, check: o.lines.map(l => K.num(l.q) + " " + l.unit + " " + l.name) },
    c: { name: o.cust.name, company: "", mobile: o.cust.phone, phone: "", street, number: "", area: street === ad && ar && K.norm(ad).includes(K.norm(ar)) ? "" : ar, zip: "", floor: "", hours: o.when.slot || "", notes: "", lat: null, lng: null } };
  const raw = new TextEncoder().encode(JSON.stringify(pk));
  let x = ""; raw.forEach(n => x += String.fromCharCode(n));
  return DROMOLOGIO + "#dj=j" + btoa(x).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
A.dvSheet = dvSheet;
/* ---------- τιμές ανά πελάτη: λιανική ή χονδρική, προσωπικές τιμές, αποκλειστικά προϊόντα ---------- */
function custPriceCard(c) {
  const np = Object.keys(c.prices || {}).filter(id => S.products[id] && !S.products[id].del).length;
  const ex = Object.values(S.products).filter(p => !p.del && p.only && (p.onlyFor || []).includes(c.key)).length;
  return `<div class="card"><h3>💶 Τιμές για αυτόν</h3>
    <div class="chips"><button type="button" class="chip${c.pl !== "w" ? " on" : ""}" data-cpl="r">Λιανική</button><button type="button" class="chip${c.pl === "w" ? " on" : ""}" data-cpl="w">Χονδρική</button></div>
    <p class="note" style="margin:4px 0 8px">${np ? "<b>" + np + "</b> προσωπικές τιμές · " : ""}${ex ? "<b>" + ex + "</b> αποκλειστικά προϊόντα · " : ""}Τις τιμές τις ελέγχει πάντα η εφαρμογή σου: ό,τι κι αν στείλει ο πελάτης, γράφεται η δική σου τιμή.</p>
    <button type="button" class="btn soft sm" data-act="custPrices">✏️ Προσωπικές τιμές</button>
    ${np || c.pl === "w" || ex ? `<p class="note" style="margin:8px 0 0">Ο πελάτης τις βλέπει στον <b>προσωπικό του σύνδεσμο</b> («Στείλε του τον κατάλογο»). Μετά από αλλαγή, στείλ' του τον ξανά.</p>` : ""}</div>`;
}
function custPricesSheet(k) {
  const c = S.customers[k]; if (!c) return;
  const prods = Object.values(S.products).filter(p => !p.del && !p.draft).sort((a, b) => a.name.localeCompare(b.name, "el"));
  sheet("Προσωπικές τιμές · " + c.name, `<p class="note" style="margin-top:0">Γράψε τιμή μόνο όπου υπάρχει ειδική συμφωνία με τον πελάτη «${esc(c.name)}». Κενό = ${c.pl === "w" ? "τιμή χονδρικής" : "κανονική τιμή"}.</p>
   <input class="t" id="cppQ" placeholder="🔍 Αναζήτηση" style="margin-bottom:8px">
   <div class="card">${prods.map(p => `<div class="qrow" data-cpr="${esc(K.norm(p.name))}"><div class="qn"><b>${esc(p.name)}</b><span>${K.money(p.price)}${+p.whole > 0 ? " · χονδρ. " + K.money(p.whole) : ""} / ${esc(p.unit)}</span></div><input class="t" data-cpp="${p.id}" inputmode="decimal" style="width:96px;text-align:right" value="${c.prices && c.prices[p.id] != null ? K.num(c.prices[p.id]) : ""}" placeholder="—"></div>`).join("") || `<p class="note">Δεν υπάρχουν προϊόντα.</p>`}</div>`,
   `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-act="custPricesSave">Αποθήκευση</button>`,
   el => { el.dataset.cust = k; const q = el.querySelector("#cppQ"); q.addEventListener("input", () => { const v = K.norm(q.value); el.querySelectorAll("[data-cpr]").forEach(r => r.style.display = !v || r.dataset.cpr.includes(v) ? "" : "none"); }); });
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
   ${it("📤", "Στείλε τον κατάλογο", S.link.sentAt ? (S.link.gSent ? "Οι αλλαγές φτάνουν μόνες τους στους πελάτες" + (S.link.catAt ? " · τελευταία " + fmtTime(S.link.catAt) : "") : "Στάλθηκε " + fmtTime(S.link.sentAt) + " · στείλ' τον μία τελευταία φορά") : "Δεν έχει σταλεί ακόμα", "link")}
   ${it("🔔", "Ειδοποιήσεις", S.nt.on ? "Ενεργές" : "Δεν έχουν ενεργοποιηθεί", "notif")}
   ${it("🏷️", "Έτοιμοι κατάλογοι επαγγελμάτων", "Πρόσθεσε ή άλλαξε επάγγελμα", "presetsGo")}
   ${it("📋", "Παραγγελία από μήνυμα Viber", "Επικόλληση ή κοινοποίηση μηνύματος", "paste")}</div>
   <div class="card list">
   ${it("💾", "Αντίγραφα ασφαλείας", gd, "backup")}
   ${it("📤", "Εξαγωγή σε Excel", "Παραγγελίες και σύνολα ημερών", "xls")}
   ${it("⭐", "Pro", l.kind === "pro" ? "Ενεργό μέχρι " + S.lic.until.split("-").reverse().join("/") : l.kind === "trial" ? "Δοκιμή: μένουν " + l.left + " ημέρες" : "Δωρεάν έκδοση", "pro")}
   ${it("🧭", "Σύνδεση με Δρομολόγιο", "Στάσεις, υπενθυμίσεις, «Χρωστάνε» · σε επόμενη έκδοση", "drom")}</div>
   <div class="card list">
   ${DEMO ? it("🎬", "Τέλος επίδειξης", "Πίσω στα δικά σου δεδομένα", "demoEnd") : it("🎬", "Επίδειξη", "Δοκίμασε την εφαρμογή με έτοιμα παραδείγματα", "demoStart")}
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
   <div class="card"><h3>📜 Οι δικοί σου όροι πώλησης</h3><p class="note" style="margin-top:0">Προαιρετικά. Ο πελάτης τους βλέπει και τους αποδέχεται πριν στείλει. Γράψε απλά: χρέωση μεταφορικών, πώς πληρώνει, ως πότε ακυρώνει.</p>
    <textarea class="t" id="shTr" rows="4" maxlength="600" placeholder="π.χ. Πληρωμή με μετρητά ή κάρτα κατά την παράδοση. Δωρεάν μεταφορικά πάνω από 15 €, αλλιώς 2 €. Ακύρωση έως το προηγούμενο βράδυ.">${esc(s.terms || "")}</textarea></div>
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
  Object.assign(s, { name: v("shN"), legal: v("shL"), addr: v("shA"), afm, phone: v("shP"), email: v("shE"), welcome: v("shW"), terms: ($("#shTr").value || "").trim().slice(0, 600), c1: $("#shC1").value, c2: $("#shC2").value, vatIncl: $("#shV").checked });
  if (b.dataset.logo) s.logo = b.dataset.logo;
  if (b.dataset.logoDel) s.logo = "";
  save({ catalog: true }); closeSheet(); toast("✓ Αποθηκεύτηκε"); render();
  const ok = shopOk(); if (!ok.ok) toast("Λείπουν ακόμα: " + ok.miss.join(", "), 4000);
}
/* ---------- παράδοση και ημέρες: για όλους ή για συγκεκριμένο πελάτη ---------- */
let dvFor = "";
const dayChips = (sel, attr) => `<div class="chips" style="flex-wrap:wrap">${[1, 2, 3, 4, 5, 6, 0].map(i => `<label class="chip${(sel || []).includes(i) ? " on" : ""}"><input type="checkbox" ${attr}="${i}"${(sel || []).includes(i) ? " checked" : ""} hidden>${K.WD[i]}</label>`).join("")}</div>`;
function bindChips(el) { el.querySelectorAll(".chip input[type=checkbox]").forEach(i => i.addEventListener("change", () => i.parentElement.classList.toggle("on", i.checked))); }
function holidaysHTML(d) {
  const y = new Date().getFullYear(), t = today(), end = addDays(t, 366), seen = new Set();
  const list = [y, y + 1].flatMap(yy => K.grHolidays(yy)).filter(h => h.date >= t && h.date <= end).sort((a, b) => a.date.localeCompare(b.date)).filter(h => !seen.has(h.id) && seen.add(h.id));
  const MN = ["Ιαν", "Φεβ", "Μαρ", "Απρ", "Μαΐ", "Ιουν", "Ιουλ", "Αυγ", "Σεπ", "Οκτ", "Νοε", "Δεκ"];
  const nOn = list.filter(h => K.holOn(d, h)).length;
  const rows = list.map(h => { const dt = K.fromYmd(h.date), on = K.holOn(d, h), days = Math.round((dt - K.fromYmd(t)) / 864e5);
    return `<label class="holr${on ? "" : " off"}"><span class="hd"><b>${dt.getDate()}</b><small>${MN[dt.getMonth()]}</small></span><span class="hn"><b>${esc(h.name)}</b><small>${esc(K.WD[dt.getDay()])}${days === 0 ? " · σήμερα" : days === 1 ? " · αύριο" : " · σε " + days + " ημέρες"}</small></span><span class="tog g"><input type="checkbox" data-hol="${h.id}"${on ? " checked" : ""}><span></span></span></label>`; }).join("");
  return `<div class="card"><h3>🎌 Κλειστές ημέρες</h3>
    <label class="ck"><input type="checkbox" id="dvHolOn"${d.holOff ? "" : " checked"}><span><b>Κλειστά τις αργίες</b> (επίσημες αργίες, Καθαρά Δευτέρα, Πάσχα, Αγίου Πνεύματος)</span></label>
    <details class="holx" style="margin:6px 0 8px"><summary class="btn soft wide" style="list-style:none;display:flex;justify-content:space-between"><span>📅 Ποιες αργίες κλείνεις</span><span id="holCnt">${nOn} από ${list.length} ›</span></summary><p class="note" style="margin:8px 2px 4px">Πράσινο = κλειστά εκείνη την ημέρα. Ισχύει κάθε χρόνο.</p><div id="holBox" style="${d.holOff ? "opacity:.5;pointer-events:none" : ""}">${rows}</div></details>
    <label class="ck"><input type="checkbox" id="dvHolOn"${d.holOff ? "" : " checked"}><span><b>Κλειστά τις αργίες</b> (επίσημες αργίες, Καθαρά Δευτέρα, Πάσχα, Αγίου Πνεύματος)</span></label>
    <details style="margin:4px 0 8px"><summary class="note" style="cursor:pointer">Διάλεξε ποιες αργίες (μία μία)</summary><div id="holBox" style="${d.holOff ? "opacity:.5;pointer-events:none" : ""}">${rows}</div></details>
    <label class="f">Δικές σου κλειστές ημερομηνίες (άδεια, ασθένεια…)</label>
    <div class="row"><input class="t grow" type="date" id="dvClAdd" min="${t}"><button type="button" class="btn soft" data-act="clAdd">＋ Προσθήκη</button></div>
    <div class="chips" id="clList" style="flex-wrap:wrap;margin-top:8px">${(d.closed || []).filter(x => x >= t).sort().map(x => `<span class="chip on" style="cursor:default">${esc(K.dayLabel(x))} <button type="button" data-cldel="${x}" style="border:0;background:none;color:inherit;font-weight:900;padding:0 0 0 4px">✕</button></span>`).join("") || `<span class="note">Καμία</span>`}</div></div>`;
}
function delivSheet(forKey) {
  if (forKey !== undefined) dvFor = forKey;
  if (dvFor && !S.customers[dvFor]) dvFor = "";
  const d = S.deliv, custs = Object.values(S.customers).sort((a, b) => a.name.localeCompare(b.name, "el"));
  const top = `<div class="card"><label class="f" for="dvFor" style="margin-top:0">👤 Για ποιον</label>
    <select class="t" id="dvFor"><option value="">Όλοι οι πελάτες (γενικές ρυθμίσεις)</option>${custs.map(c => `<option value="${c.key}"${c.key === dvFor ? " selected" : ""}>${esc(c.name)}${c.route && c.route.days && c.route.days.length ? " · " + c.route.days.map(x => K.WD[x].slice(0, 3)).join(" ") : ""}</option>`).join("")}<option value="+">＋ Νέος πελάτης…</option></select>
    <p class="note">Διάλεξε πελάτη για να δηλώσεις ποιες ημέρες περνάς από εκεί. Αυτές τις ημέρες θα βλέπει μόνο εκείνος, στον δικό του σύνδεσμο.</p></div>`;
  if (dvFor) {
    const c = S.customers[dvFor], r = c.route || {};
    sheet("🚚 Ημέρες για " + c.name, top + `
     <div class="card"><h3>Πότε περνάς από ${esc(c.name.split(" ")[0])}</h3>${dayChips(r.days, "data-rtd")}
      <label class="f" for="rtSl">Ώρα</label><input class="t" id="rtSl" value="${esc(r.slot || "")}" placeholder="π.χ. 09:00-12:00" maxlength="30">
      <label class="f" for="rtNt">Σημείωση (περιοχή, σημείο)</label><input class="t" id="rtNt" value="${esc(r.note || "")}" placeholder="π.χ. Μαρκόπουλο, στην πλατεία" maxlength="80">
      <label class="ck"><input type="checkbox" id="rtEx"${r.ex !== false ? " checked" : ""}><span>Να μπορεί να κάνει <b>έκτακτη παραγγελία</b> σε άλλη ημέρα</span></label></div>
     <div class="card"><h3>Ο δικός του κατάλογος</h3><p class="note" style="margin-top:0">Βλέπει μόνο τις δικές του ημέρες, με έτοιμα το όνομα, το τηλέφωνο και τη διεύθυνσή του.</p>
      <button type="button" class="btn amber wide" data-act="rtLink">📤 Αποθήκευση και αποστολή καταλόγου</button></div>`,
     `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-act="delivSave">Αποθήκευση</button>`, el => { bindChips(el); bindFor(el); });
    return;
  }
  sheet("🚚 Παράδοση και ημέρες", top + `
   <div class="card"><h3>Τρόπος</h3><select class="t" id="dvH"><option value="both"${d.how === "both" ? " selected" : ""}>Παράδοση και παραλαβή</option><option value="del"${d.how === "del" ? " selected" : ""}>Μόνο παράδοση</option><option value="pick"${d.how === "pick" ? " selected" : ""}>Μόνο παραλαβή</option></select>
    <label class="ck"><input type="checkbox" id="dvA"${d.askAddr !== false ? " checked" : ""}><span>Ζήτα διεύθυνση για την παράδοση</span></label></div>
   <div class="card"><h3>Ημέρες που δέχεσαι</h3>${dayChips(d.days, "data-dvd")}
    <div class="two"><div><label class="f" for="dvMin">Από (ημέρες μετά)</label><select class="t" id="dvMin">${[0, 1, 2, 3].map(n => `<option value="${n}"${+d.min === n ? " selected" : ""}>${n === 0 ? "Ίδια ημέρα" : n === 1 ? "Από αύριο" : "Σε " + n + " ημέρες"}</option>`).join("")}</select></div><div><label class="f" for="dvMax">Έως (ημέρες μπροστά)</label><select class="t" id="dvMax">${[3, 7, 14, 21, 30].map(n => `<option${+d.max === n ? " selected" : ""}>${n}</option>`).join("")}</select></div></div>
    <label class="f" for="dvCut">Παραγγελίες για την ίδια ημέρα έως</label><input class="t" id="dvCut" type="time" value="${esc(d.cut || "")}"></div>
   ${holidaysHTML(d)}
   <div class="card"><h3>Ώρες παράδοσης</h3><p class="note" style="margin-top:0">Μία ανά γραμμή. Άφησέ το κενό αν δεν θέλεις ώρες.</p><textarea class="t" id="dvSl" rows="3" placeholder="09:00-12:00&#10;17:00-20:00">${esc((d.slots || []).join("\n"))}</textarea></div>
   <div class="card"><h3>Άλλα</h3><label class="f" for="dvMo">Ελάχιστη παραγγελία (€, 0 για καμία)</label><input class="t" id="dvMo" inputmode="decimal" value="${d.minOrder ? K.num(d.minOrder) : ""}">
    <label class="f" for="dvNt">Σημείωση για τον πελάτη</label><input class="t" id="dvNt" value="${esc(d.note || "")}" maxlength="140" placeholder="π.χ. Δωρεάν παράδοση στο χωριό, πληρωμή κατά την παράδοση"></div>`,
   `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-act="delivSave">Αποθήκευση</button>`,
   el => { bindChips(el); bindFor(el); const hc = el.querySelector("#dvHolOn"); hc.addEventListener("change", () => { const b = el.querySelector("#holBox"); b.style.opacity = hc.checked ? "" : ".5"; b.style.pointerEvents = hc.checked ? "" : "none"; }); });
}
function bindFor(el) {
  el.querySelector("#dvFor").addEventListener("change", e => {
    const v = e.target.value;
    if (v === "+") { e.target.value = dvFor; newCustSheet(k => delivSheet(k)); return; }
    delivSheet(v);
  });
}
function newCustSheet(after) {
  sheet("＋ Νέος πελάτης", `<div class="card"><label class="f" for="ncN">Ονοματεπώνυμο</label><input class="t" id="ncN" maxlength="80">
   <label class="f" for="ncP">Κινητό</label><input class="t" id="ncP" type="tel" maxlength="20"><label class="f" for="ncA">Διεύθυνση</label><input class="t" id="ncA" maxlength="160"></div><div id="ncErr"></div>`,
   `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-act="ncSave">Αποθήκευση</button>`);
  A._ncAfter = after;
}
function delivSave(keepOpen) {
  if (dvFor) {
    const c = S.customers[dvFor]; if (!c) return;
    c.route = { days: $$("[data-rtd]").filter(i => i.checked).map(i => +i.dataset.rtd), slot: $("#rtSl").value.trim(), note: $("#rtNt").value.trim(), ex: $("#rtEx").checked };
    save(); if (keepOpen !== true) { closeSheet(); toast("✓ Οι ημέρες του " + c.name + " αποθηκεύτηκαν"); render(); }
    return c;
  }
  const d = S.deliv;
  d.how = $("#dvH").value; d.askAddr = $("#dvA").checked;
  d.days = $$("[data-dvd]").filter(i => i.checked).map(i => +i.dataset.dvd);
  if (!d.days.length) { toast("Διάλεξε τουλάχιστον μία ημέρα."); return; }
  d.min = +$("#dvMin").value; d.max = +$("#dvMax").value; d.cut = $("#dvCut").value;
  d.holOff = !$("#dvHolOn").checked;
  const hol = {}; $$("[data-hol]").forEach(i => { hol[i.dataset.hol] = i.checked; }); d.hol = hol;
  d.slots = $("#dvSl").value.split("\n").map(x => x.trim()).filter(Boolean).slice(0, 8);
  const mo = K.parseNum($("#dvMo").value); d.minOrder = isFinite(mo) && mo > 0 ? mo : 0;
  d.note = $("#dvNt").value.trim();
  save({ catalog: true }); closeSheet(); toast("✓ Αποθηκεύτηκε"); render();
}
function keepDeliv() { const y = $("#shB").scrollTop; const L = $("#clList"); const tmp = document.createElement("div"); tmp.innerHTML = holidaysHTML(S.deliv); const nl = tmp.querySelector("#clList"); if (L && nl) L.innerHTML = nl.innerHTML; $("#shB").scrollTop = y; }
/* προσωπικός σύνδεσμος πελάτη */
async function custLinkSheet(k) {
  const c = S.customers[k]; if (!c) return;
  const ok = shopOk(); if (!ok.ok) { toast("Συμπλήρωσε πρώτα: " + ok.miss.join(", "), 4000); shopSheet(); return; }
  if (!S.terms) { linkSheet(); return; }
  const r = c.route || {};
  /* στον σύντομο σύνδεσμο δεν μπαίνουν όνομα, τηλέφωνο, διεύθυνση: η υπηρεσία συντόμευσης δεν πρέπει να τα βλέπει */
  const long = await makeLink({ k, d: r.days || [], sl: r.slot || "", nt: r.note || "", ex: r.ex !== false ? 1 : 0 });
  toast("Ετοιμάζεται ο σύντομος σύνδεσμος…", 1500);
  const short = await shortOf(long);
  const url = short || long;
  const msg = "Γεια σας " + c.name.split(" ")[0] + "! 🛒 Παραγγελίες «" + S.shop.name + "»\n" + url;
  sheet("📤 Κατάλογος για " + c.name, `<div class="okbox">Αυτός ο σύνδεσμος είναι μόνο για ${esc(c.name)}: ${r.days && r.days.length ? "βλέπει ότι περνάς " + esc(r.days.map(x => K.WD[x]).join(", ")) + (r.slot ? ", " + esc(r.slot) : "") : "βλέπει τις γενικές σου ημέρες"}${r.ex !== false && r.days && r.days.length ? ", με κουμπί για έκτακτη παραγγελία" : ""}.</div>
   <div class="row" style="margin-bottom:10px"><button type="button" class="btn amber grow" data-act="lkShare">💬 Αποστολή στο Viber</button><button type="button" class="btn ghost grow" data-act="lkCopy">📋 Αντιγραφή</button></div>
   <p class="note">${short ? "Σύντομος σύνδεσμος ✓. " : ""}Την πρώτη φορά ο πελάτης γράφει όνομα και τηλέφωνο· μετά τα θυμάται το κινητό του.</p>
   <h3 style="margin:14px 2px 6px;font-size:16px">👁 Όπως το βλέπει ${esc(c.name.split(" ")[0])}</h3>
   <div style="border:3px solid #1d2b36;border-radius:22px;overflow:hidden;height:560px;background:#F3F4F1"><iframe src="${esc(long)}" title="Προεπισκόπηση" style="width:100%;height:100%;border:0"></iframe></div>`, "",
   el => { el.dataset.url = long; el.dataset.msg = msg; });
}

/* ---------- σύνδεσμος παραγγελίας ---------- */
async function thumbOf(src, n, q) {
  n = n || 56; q = q || 0.6;
  return new Promise(res => { const i = new Image(); i.onload = () => { const c = document.createElement("canvas"); c.width = c.height = n; c.getContext("2d").drawImage(i, 0, 0, n, n); let d = c.toDataURL("image/webp", q); if (!d.startsWith("data:image/webp")) d = c.toDataURL("image/jpeg", q); res(d); }; i.onerror = () => res(""); i.src = src; });
}
async function makeLink(cust) {
  await ensureKeys(); await ensureLiveKeys();
  if (cust && cust.k && S.customers[cust.k]) { const c = S.customers[cust.k]; if (!c.tok) { c.tok = K.uid(12).replace(/[.]/g, "x"); save(); } cust = Object.assign({}, cust, { tk: c.tok }); }
  const st = S;
  let prodsForLink = st.products;
  if (S.link.photos && isPro()) {
    prodsForLink = {};
    for (const [id, p] of Object.entries(st.products)) prodsForLink[id] = p.photo ? Object.assign({}, p, { photo: await thumbOf(p.photo) }) : p;
  }
  const shopForLink = st.shop.logo && S.link.logo ? Object.assign({}, st.shop, { logo: await thumbOf(st.shop.logo, 48, 0.5) }) : st.shop;
  const C = K.buildCatalog(Object.assign({}, st, { products: prodsForLink, shop: shopForLink }), { photos: S.link.photos && isPro(), logo: S.link.logo, appUrl: BASE, cust: cust || undefined });
  const pk = await K.pack(C);
  return BASE + "p.html#n=" + pk.length + "&k=" + pk;
}
A.makeLink = makeLink;
async function shortOf(url) {
  let h = 2166136261; for (let i = 0; i < url.length; i++) { h ^= url.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } h = url.length + ":" + h;
  const c = (S.link.shorts || (S.link.shorts = {}));
  if (c[h]) return c[h];
  try { const u = await K.shorten(url); c[h] = u; const keys = Object.keys(c); if (keys.length > 30) delete c[keys[0]]; save(); return u; } catch { return ""; }
}
async function linkSheet() {
  const ok = shopOk();
  if (!ok.ok) { toast("Συμπλήρωσε πρώτα: " + ok.miss.join(", "), 4000); shopSheet(); return; }
  const n = Object.values(S.products).filter(p => !p.del && !p.hidden && !p.draft).length;
  if (!n || !S.menu.length) { toast("Πρόσθεσε πρώτα προϊόντα στον κατάλογο."); tab = "menu"; render(); return; }
  if (!S.terms) {
    sheet("Πριν τον πρώτο σύνδεσμο", `<div class="card"><p style="margin-top:0">Με τη χρήση των Παραγγελιών δηλώνεις ότι:</p>
     <ul style="padding-left:20px;margin:0"><li>ευθύνεσαι εσύ για τα προϊόντα, τις τιμές, τις άδειες της δραστηριότητάς σου και τα στοιχεία που εμφανίζεις·</li><li>έχεις δικαίωμα να χρησιμοποιείς το λογότυπο και τις φωτογραφίες που ανεβάζεις·</li><li>εκδίδεις εσύ τα νόμιμα φορολογικά παραστατικά — η εφαρμογή δεν εκδίδει παραστατικά·</li><li>είσαι υπεύθυνος για τα προσωπικά στοιχεία των πελατών σου και τα χρησιμοποιείς μόνο για τις παραγγελίες τους.</li></ul>
     <p class="note"><a href="oroi.html" target="_blank" rel="noopener">Όροι χρήσης</a> · <a href="aporrito.html" target="_blank" rel="noopener">Πολιτική απορρήτου</a></p></div>
     <label class="ck"><input type="checkbox" id="trmOk"><span>Διάβασα και αποδέχομαι τους όρους χρήσης</span></label>`,
     `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-act="termsOk">Συνέχεια</button>`);
    return;
  }
  const long = await makeLink();
  toast("Ετοιμάζεται ο σύντομος σύνδεσμος…", 1500);
  const short = await shortOf(long);
  const url = short || long;
  const len = long.length, pct = Math.min(100, Math.round(len / 7000 * 100));
  const msg = "🛒 Παραγγελίες «" + S.shop.name + "»\n" + url;
  sheet("📤 Στείλε τον κατάλογο στους πελάτες", `
   <div class="okbox">Αυτή είναι η σελίδα του καταστήματός σου για τους πελάτες. Στείλ' την μία φορά στο Viber και παραγγέλνουν από εκεί όσες φορές θέλουν. Νέα αποστολή χρειάζεται μόνο όταν αλλάζεις τιμές ή προϊόντα.</div>
   ${S.link.gSent ? `<div class="okbox">✓ Όσοι έχουν ήδη τον σύνδεσμο παίρνουν μόνοι τους κάθε αλλαγή (προϊόντα, τιμές, διαθεσιμότητα, ημέρες) μόλις τον ανοίξουν. Τον στέλνεις μόνο σε νέους πελάτες.</div>` : S.link.sentAt ? `<div class="warnbox">Στείλε τον μία τελευταία φορά στους πελάτες σου: από εκεί και πέρα οι αλλαγές φτάνουν μόνες τους.</div>` : ""}
   <div class="card"><div class="prev" style="--c1:${esc(S.shop.c1)};--on1:${K.contrast(S.shop.c1)}"><div class="ph">${S.shop.logo && S.link.logo ? `<img src="${esc(S.shop.logo)}" alt="">` : ""}<b>${esc(S.shop.name)}</b></div></div>
    <div class="note" style="margin:10px 0 4px">Έτσι θα φαίνεται στο Viber:</div>
    <div style="background:#efe9fb;border-radius:14px 14px 14px 4px;padding:10px 12px;font-size:14.5px;max-width:280px">🛒 Παραγγελίες «${esc(S.shop.name)}»<br><span style="color:#5b3fd1;word-break:break-all">${esc(short || long.slice(0, 60) + "…")}</span>
     <div style="margin-top:8px;background:#fff;border-radius:10px;display:flex;gap:8px;align-items:center;padding:6px"><img src="eikonidia/icon-192.png" style="width:42px;height:42px;border-radius:9px" alt=""><div><b style="font-size:13.5px">🛒 Κάνε την παραγγελία σου</b><div style="font-size:12px;color:#666">Διάλεξε προϊόντα, χωρίς τηλεφωνήματα</div></div></div></div>
    ${short ? `<div class="okbox" style="margin-top:8px">✓ Σύντομος σύνδεσμος: φτάνει ολόκληρος και το μήνυμα μένει μικρό.</div>` : `<div class="warnbox" style="margin-top:8px">Δεν έγινε σύντομος σύνδεσμος (χωρίς διαδίκτυο ή η υπηρεσία δεν απάντησε). Θα σταλεί ο κανονικός, μακρύς σύνδεσμος (${len.toLocaleString("el-GR")} χαρακτήρες).</div>`}
    <label class="ck"><input type="checkbox" id="lkPh"${S.link.photos ? " checked" : ""}><span>Με φωτογραφίες προϊόντων (μεγαλώνει τον σύνδεσμο) ${isPro() ? "" : "· Pro"}</span></label>
    <label class="ck"><input type="checkbox" id="lkLg"${S.link.logo ? " checked" : ""}><span>Με λογότυπο</span></label></div>
   <div class="row" style="margin-bottom:10px"><button type="button" class="btn amber grow" data-act="lkShare">💬 Αποστολή στο Viber</button><button type="button" class="btn ghost grow" data-act="lkCopy">📋 Αντιγραφή</button></div>
   <p class="note" style="margin-top:0">Το «Αποστολή» ανοίγει τη λίστα εφαρμογών του κινητού: διάλεξε Viber και τον πελάτη. Αν προτιμάς, πάτα «Αντιγραφή» και επικόλλησέ τον στη συνομιλία.</p>
   ${S.ui.test ? `<button type="button" class="btn soft wide" data-act="lkDiag" style="margin-bottom:10px">🔬 Δοκιμή: φτάνει ολόκληρος ο σύνδεσμος;</button>` : ""}
   <p class="note">Ο κατάλογος ταξιδεύει μέσα στον σύνδεσμο. Οι παραγγελίες έρχονται κρυπτογραφημένες και ανοίγουν μόνο σε αυτό το κινητό.</p>
   <h3 style="margin:14px 2px 6px;font-size:16px">👁 Όπως το βλέπει ο πελάτης</h3>
   <div style="border:3px solid #1d2b36;border-radius:22px;overflow:hidden;height:560px;background:#F3F4F1"><iframe src="${esc(long)}" title="Προεπισκόπηση" style="width:100%;height:100%;border:0"></iframe></div>
   <button type="button" class="btn ghost wide" data-act="lkPreview" style="margin-top:8px">⛶ Προεπισκόπηση σε όλη την οθόνη</button>`, "",
   el => { el.dataset.url = long; el.dataset.msg = msg; });
}
function linkSent() { S.link.sentAt = Date.now(); S.link.dirty = false; if (S.nt.spub) { if (!S.link.gSent) S.link.gSent = Date.now(); } save(); catSoon(1500, true); liveSoon(2500, true); }

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
  if (DEMO) return;
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
function phoneBackupSoon() { if (DEMO) return; clearTimeout(phT); phT = setTimeout(() => { PH.get().then(h => h && PH.write(false)).catch(() => {}); }, 20000); }
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
   <p class="note">Το αντίγραφο περιέχει όλα τα δεδομένα: στοιχεία και εμφάνιση επιχείρησης, κατάλογο με φωτογραφίες, τιμές και ιστορικό τιμών, παραγγελίες, πελάτες με ημέρες παράδοσης, βαθμολογίες και οφειλές, ταμείο (έσοδα και έξοδα), αργίες, ρυθμίσεις, άδεια Pro και τα κλειδιά κρυπτογράφησης. Γράφεται αυτόματα μετά από κάθε αλλαγή. Κράτα το ιδιωτικό.</p></div>`, "",
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
  const rows = [["Αρ.", "Κωδικός", "Υποβολή", "Ημέρα", "Ώρα", "Τρόπος", "Πελάτης", "Τηλέφωνο", "Διεύθυνση", "Είδος", "Ποσότητα", "Μονάδα", "Τιμή", "ΦΠΑ %", "Ποσό", "Σύνολο παραγγελίας", "Κατάσταση", "Πληρωμένη", "Σημείωση", "Παραστατικό", "Επωνυμία", "ΑΦΜ", "ΔΟΥ", "Έκτακτη"]];
  L.forEach(o => o.lines.forEach((l, i) => rows.push([o.no, code(o), fmtTime(o.at), o.when.date, o.when.slot, o.when.how === "pick" ? "Παραλαβή" : "Παράδοση", o.cust.name, o.cust.phone, o.cust.addr, l.name, l.q, l.unit, l.price, l.vat, l.sum, i === 0 ? o.total : "", ST[o.st], o.paid ? "Ναι" : "Όχι", i === 0 ? o.cust.note : "", i === 0 ? (o.inv && o.inv.t === "i" ? "Τιμολόγιο" : o.inv && o.inv.t === "r" ? "Απόδειξη" : "") : "", i === 0 && o.inv && o.inv.t === "i" ? o.inv.n : "", i === 0 && o.inv && o.inv.t === "i" ? o.inv.f : "", i === 0 && o.inv && o.inv.t === "i" ? o.inv.d : "", i === 0 && o.when.extra ? "Ναι" : ""])));
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
  link: () => linkSheet(), shop: () => shopSheet(), deliv: () => delivSheet(""), notif: notifSheet, backup: backupSheet, xls: xlsSheet, pro: () => proSheet(),
  goMenu: () => { tab = "menu"; render(); },
  paste: pasteSheet, newOrder: () => orderForm(),
  poll: () => pollOnce(true),
  update: () => checkUpdate(true),
  updGo: () => applyUpdate(),
  lkPreview: () => { const u = $("#shB").dataset.url; closeSheet(); setTimeout(() => openPreview(u), 60); },
  pvClose: () => closePreview(false),
  role: () => switchRole(),
  rateOpen: () => rateSheet($("#shB").dataset.cust),
  rateSave: () => { const b = $("#shB"), c = S.customers[b.dataset.cust]; if (!c) return; c.ratings = b._r || {}; c.rateNote = $("#rtNote").value.trim(); save(); const k = c.key; closeSheet(); setTimeout(() => openCust(k), 60); render(); toast("✓ Αποθηκεύτηκε η αξιολόγηση"); },
  ntOrder: a => { const id = a.dataset.oid; closeSheet(); setTimeout(() => openOrder(id), 60); },
  owedSheet: () => {
    const debt = Object.values(S.customers).map(c => ({ c, v: custStats(c.key).owed })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
    sheet("🔴 Σου χρωστάνε", debt.length ? `<div class="card list">${debt.map(x => `<div class="it" data-cust="${x.c.key}"><div class="ic">👤</div><div class="t"><b>${esc(x.c.name)}</b><span>${esc(x.c.phone)}</span></div><b style="color:#C8412B">${K.money(x.v)}</b></div>`).join("")}</div><div class="row" style="padding:0 4px"><b class="grow">Σύνολο</b><b style="color:#C8412B;font-size:19px">${K.money(debt.reduce((a, x) => a + x.v, 0))}</b></div>` : `<div class="okbox">✓ Κανείς δεν σου χρωστά.</div>`);
  },
  demoStart: () => demoStart(),
  demoEnd: () => demoEnd(),
  cashSave: () => { const b = $("#shB"), v = K.parseNum($("#cxA").value); if (!isFinite(v) || v <= 0) { toast("Γράψε ποσό."); return; } const id = b.dataset.cid; let x = id && cashList().find(c => c.id === id); if (!x) { x = { id: "c" + K.uid(6).replace(/[.]/g, "x"), kind: b.dataset.ckind, src: "paraggelies", created: Date.now() }; cashList().push(x); } const k = ckOf(b.dataset.xck); Object.assign(x, { d: $("#cxD").value || today(), amt: K.round2(v), ck: b.dataset.xck, sub: b.dataset.xsub || "", cat: b.dataset.xsub || (k ? k.name : ""), vat: $("#cxV").value === "" ? "" : +$("#cxV").value, note: $("#cxN").value.trim() }); save(); closeSheet(); render(); toast("✓ Καταχωρίστηκε"); },
  cashDel: () => { const id = $("#shB").dataset.cid; if (!confirm("Διαγραφή της κίνησης;")) return; S.cash = cashList().filter(c => c.id !== id); save(); closeSheet(); render(); },
  clAdd: () => { const v = $("#dvClAdd").value; if (!/^\d{4}-\d\d-\d\d$/.test(v)) { toast("Διάλεξε ημερομηνία."); return; } const d = S.deliv; d.closed = [...new Set((d.closed || []).concat(v))]; save({ catalog: true }); keepDeliv(); },
  rtLink: async () => { const c = delivSave(true); if (c) { await custLinkSheet(c.key); } },
  ncSave: () => { const n = $("#ncN").value.trim(), p = $("#ncP").value.trim(); if (n.length < 2 || p.replace(/\D/g, "").length < 10) { $("#ncErr").innerHTML = `<div class="errbox">Γράψε όνομα και κινητό (10 ψηφία).</div>`; return; } const c = upsertCustomer({ name: n, phone: p, addr: $("#ncA").value.trim() }, Date.now()); save(); const f = A._ncAfter; A._ncAfter = null; if (f) f(c.key); else { render(); openCust(c.key); } },
  custNewBtn: () => newCustSheet(null),
  custRoute: () => delivSheet($("#shB").dataset.cust),
  custLink: () => custLinkSheet($("#shB").dataset.cust),
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
  lkShare: async () => { const b = $("#shB"); if (navigator.share) { try { await navigator.share({ text: b.dataset.msg }); linkSent(); return; } catch (e) { if (e && e.name === "AbortError") return; } } await ACT.lkCopy(); setTimeout(() => { location.href = "viber://forward?text=" + encodeURIComponent("Επικόλλησε εδώ τον σύνδεσμο"); }, 400); },
  lkCopy: async () => { try { await navigator.clipboard.writeText($("#shB").dataset.msg); linkSent(); toast("✓ Αντιγράφηκε. Επικόλλησέ το στο Viber."); } catch { toast("Δεν έγινε αντιγραφή."); } },
  lkSent: () => linkSent(),
  lkDiag: () => {
    const real = $("#shB").dataset.url;
    const mk = (tag, body) => BASE + "p.html#t=" + tag + "&n=" + body.length + "&x=" + body;
    const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
    const A1 = mk("A", Array.from({ length: 600 }, (_, i) => abc[i % abc.length]).join(""));
    const B1 = mk("B", K.uid(450).replace(/[^A-Za-z0-9]/g, "x"));
    sheet("🔬 Δοκιμή συνδέσμου", `<p class="note" style="margin-top:0">Στείλε στον εαυτό σου (ή σε φίλο) στο Viber αυτούς τους συνδέσμους, με τους δύο τρόπους, και άνοιξέ τους. Η σελίδα θα γράψει πόσοι χαρακτήρες έφτασαν. Πες μου τα αποτελέσματα.</p>
     ${[["Α: 600 απλά γράμματα", A1], ["Β: 600 ανακατεμένοι χαρακτήρες", B1], ["Γ: ο πραγματικός σου σύνδεσμος", real]].map(([l, u], i) => `<div class="card"><b>${l}</b><div class="note">${u.length} χαρακτήρες</div><div class="row" style="margin-top:8px"><button type="button" class="btn sm amber grow" data-diag-share="${i}">📤 Κοινοποίηση</button><button type="button" class="btn sm soft grow" data-diag-copy="${i}">📋 Αντιγραφή</button><a class="btn sm ghost grow" href="viber://forward?text=${encodeURIComponent(u)}">Viber απευθείας</a></div></div>`).join("")}`, "",
     el => { el._diag = [A1, B1, real]; });
  },
  ntCopy: async () => { try { await navigator.clipboard.writeText(S.nt.topic); toast("✓ Αντιγράφηκε"); } catch {} },
  ntTest: async () => { try { await K.ntfySend(S.nt.topic, "🔔 Δοκιμή — Παραγγελίες", "Πάτα εδώ για να ολοκληρωθεί η δοκιμή.", BASE + "#test=1"); toast("Στάλθηκε. Περίμενε την ειδοποίηση στο κινητό."); } catch { toast("Δεν στάλθηκε. Έλεγξε τη σύνδεση στο διαδίκτυο."); } },
  ntPerm: async () => { try { const p = await Notification.requestPermission(); toast(p === "granted" ? "✓ Ενεργοποιήθηκαν" : "Δεν δόθηκε άδεια."); } catch { toast("Ο περιηγητής δεν το υποστηρίζει."); } },
  ntDone: () => { S.nt.on = $("#ntOn").checked; save(); closeSheet(); render(); },
  shopSave, delivSave: () => delivSave(), licGo,
  logoDel: () => { $("#shB").dataset.logoDel = "1"; delete $("#shB").dataset.logo; $("#shLogoPrev").innerHTML = `<span class="note">Χωρίς λογότυπο</span>`; },
  fSave: formSave,
  pasteClip: async () => { try { $("#ptxt").value = await navigator.clipboard.readText(); } catch { toast("Κράτα πατημένο το πλαίσιο και διάλεξε «Επικόλληση»."); } },
  pasteGo: () => { const t = $("#ptxt").value.trim(); if (!t) { toast("Επικόλλησε πρώτα το μήνυμα."); return; } A.importText(t); },
  ordEdit: () => { const o = curOrd(); if (!o) return; const q = {}, keep = {}; o.lines.forEach(l => { q[l.pid] = l.q; keep[l.pid] = l.price; }); orderForm({ id: o.id, name: o.cust.name, phone: o.cust.phone, addr: o.cust.addr, note: o.cust.note, date: o.when.date, slot: o.when.slot, how: o.when.how, q, keep }); },
  ordPrint: () => { const o = curOrd(); if (!o) return; const f = $("#prFmt") ? $("#prFmt").value : "58"; S.ui.printFmt = f; save(); printOrder(o, f); },
  ordPrText: async () => { const o = curOrd(); if (!o) return; const t = printText(o, (S.ui.printFmt || "58") === "80" ? 42 : 32); try { await navigator.share({ text: t }); } catch (e) { if (!e || e.name !== "AbortError") { try { await navigator.clipboard.writeText(t); toast("✓ Αντιγράφηκε το κείμενο της παραγγελίας"); } catch {} } } },
  ordProof: () => { const o = curOrd(); if (o) proof(o); },
  ordRepeat: () => { const o = curOrd(); if (o) repeatOrder(o); },
  ordDel: () => { const o = curOrd(); if (!o || !confirm("Διαγραφή της παραγγελίας #" + o.no + ";")) return; S.orders = S.orders.filter(x => x !== o); save(); closeSheet(); render(); toast("Διαγράφηκε."); },
  dupKeep: () => { const o = curOrd(); if (!o) return; o.st = "new"; o.log.push([Date.now(), "Κρατήθηκε ως νέα"]); save(); closeSheet(); ordFilter.st = "new"; render(); },
  dupDel: () => { const o = curOrd(); if (!o) return; S.orders = S.orders.filter(x => x !== o); save(); closeSheet(); render(); toast("Η διπλή διαγράφηκε."); },
  custPrices: () => { const k = $("#shB").dataset.cust; ACT.custSave(true); custPricesSheet(k); },
  custPricesSave: () => { const b = $("#shB"), c = S.customers[b.dataset.cust]; if (!c) return; const pr = {};
    b.querySelectorAll("[data-cpp]").forEach(i => { const v = K.parseNum(i.value); if (i.value.trim() && isFinite(v) && v >= 0) pr[i.dataset.cpp] = K.round2(v); });
    if (Object.keys(pr).length) c.prices = pr; else delete c.prices; save(); closeSheet(); toast("✓ Αποθηκεύτηκαν " + Object.keys(pr).length + " προσωπικές τιμές. Στείλε του ξανά τον κατάλογο."); setTimeout(() => openCust(c.key), 300); },
  custSave: (keep) => { const c = S.customers[$("#shB").dataset.cust]; if (!c) return; c.name = $("#cuN").value.trim() || c.name; c.phone = $("#cuP").value.trim() || c.phone; c.addr = $("#cuA").value.trim(); c.area = ($("#cuAr").value || "").trim(); if (!c.area) delete c.area; c.notes = $("#cuNo").value.trim(); save(); if (keep === true) return; closeSheet(); render(); },
  custNew: () => { const c = S.customers[$("#shB").dataset.cust]; if (c) orderForm({ name: c.name, phone: c.phone, addr: c.addr || "" }); },
  custRepeat: () => { const k = $("#shB").dataset.cust, s = custStats(k); const o = s.list.find(x => x.st !== "cancel") || s.list[0]; if (o) repeatOrder(o); },
  custPayAll: () => { const k = $("#shB").dataset.cust; S.orders.filter(o => custKey(o.cust.phone) === k && o.st !== "cancel" && o.st !== "dup").forEach(o => { if (o.st === "done" && !o.paid) setStatus(o, "paid"); else if (diffOf(o)) setStatus(o, "paydiff"); }); save(); openCust(k); render(); toast("✓ Πληρώθηκαν"); },
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
  seeNew: () => A.seeNew(),
  dvOpen: () => dvSheet(ordFilter.day || today()),
  collectList: () => collectList(),
  buyPro: async () => { const r = $("#lref"); if (r) { const v = r.value.trim().toUpperCase(); if (v && !/^GA-[0-9A-F]{6}$/.test(v)) { toast("Ο κωδικός σύστασης έχει τη μορφή GA-XXXXXX."); return; } if (v) S.lic.ref = v; else delete S.lic.ref; save(); }
    const pr = proPriceNow(), em = ($("#lmail") && $("#lmail").value.trim()) || S.lic.email || "", sh = S.shop;
    const body = "Θέλω κλειδί Pro για την εφαρμογή «Παραγγελίες».\n\nΗλεκτρονικό ταχυδρομείο για το κλειδί: " + (em || "…") + "\nΕπιχείρηση: " + (sh.name || "…") + (sh.legal ? " (" + sh.legal + ")" : "") + "\nΑΦΜ: " + (sh.afm || "…") + "\nΤηλέφωνο: " + (sh.phone || "…") + "\nΤιμή: " + pr.v + " € " + pr.why + (S.lic.ref ? "\nΚωδικός σύστασης: " + S.lic.ref : "") + (S.lic.until ? "\nΤωρινό κλειδί λήγει: " + S.lic.until.split("-").reverse().join("/") : "");
    location.href = "mailto:" + PRO_MAIL + "?subject=" + encodeURIComponent("Κλειδί Pro Παραγγελίες" + (S.lic.until ? " (ανανέωση)" : "")) + "&body=" + encodeURIComponent(body); },
  refShare: async () => { const c = await refCode(S.lic.email), t = "Για τις παραγγελίες των πελατών μου χρησιμοποιώ τις «Παραγγελίες» της GlenApps. Με τον κωδικό σύστασής μου " + c + " πληρώνεις " + PRO_INTRO + " € και τον δεύτερο χρόνο του Pro: " + BASE;
    if (navigator.share) { try { await navigator.share({ text: t }); return; } catch (e) { if (e && e.name === "AbortError") return; } } try { await navigator.clipboard.writeText(t); toast("✓ Αντιγράφηκε"); } catch { prompt("", t); } },
  collectGo: () => { const k = $("#shB").dataset.cust, via = S.ui.payVia || "Μετρητά"; let n = 0, sum = 0;
    $$("[data-colo]").forEach(i => { if (!i.checked) return; const o = S.orders.find(x => x.id === i.dataset.colo); if (!o) return; sum += +i.dataset.amt || 0; if (!o.paid) setStatus(o, "paid"); else setStatus(o, "paydiff"); o.payVia = via; o.log.push([Date.now(), "Τρόπος πληρωμής: " + via]); n++; });
    if (!n) { toast("Διάλεξε τουλάχιστον μία παραγγελία."); return; } save(); render(); toast("✓ Εισπράχθηκαν " + K.money(K.round2(sum)) + " (" + via + ")"); collectList(); },
  acctSet: () => { const m = (prompt("Ηλεκτρονικό ταχυδρομείο του λογιστή σου:", S.shop.acct || "") || "").trim(); S.shop.acct = m; save(); toast(m ? "✓ Αποθηκεύτηκε" : "Αφαιρέθηκε"); },
  presetsGo: () => { tab = "menu"; render(); setTimeout(() => { const b = document.createElement("button"); b.dataset.ea = "presets"; b.hidden = true; document.body.appendChild(b); b.click(); b.remove(); }, 50); },
  remHideAll: () => { S.ui.remHide = { d: today(), ids: remindersList().map(r => r.id).concat((S.ui.remHide && S.ui.remHide.d === today() ? S.ui.remHide.ids : [])) }; save(); render(); toast("Θα ξαναεμφανιστούν αύριο."); },
  phRestore: async () => { const L = await PH.list(); sheet("Επαναφορά από φάκελο", `<div class="card list">${L.map((f, i) => `<div class="it" data-phf="${esc(f.n)}"><div class="ic">📄</div><div class="t"><b>${esc(f.n)}</b>${i === 0 ? `<span>νεότερο</span>` : ""}</div></div>`).join("") || `<p class="note">Δεν βρέθηκαν αντίγραφα.</p>`}</div>`); A._phl = L; },
  fileOut: () => { download("paraggelies-antigrafo-" + today() + ".json", backupPayload(), "application/json"); S.meta.lastBackup = new Date().toISOString(); save(); }
};
A.ACT = ACT;
const curOrd = () => S.orders.find(x => x.id === $("#shB").dataset.ord);
document.addEventListener("click", async e => {
  const t = e.target;
  const tb = t.closest("#tabs [data-tab], #gearBtn"); if (tb) { if (tab !== tb.dataset.tab) { tab = tb.dataset.tab; window.scrollTo(0, 0); render(); } return; }
  if (t.id === "sheetbg") { closeSheet(); return; }
  const fm = t.closest("[data-fm]"); if (fm) { formQty(fm.dataset.fm, -1); return; }
  const fp = t.closest("[data-fp]"); if (fp) { formQty(fp.dataset.fp, 1); return; }
  const nx = t.closest("[data-next]"); if (nx) { e.stopPropagation(); const o = S.orders.find(x => x.id === nx.dataset.next); if (o) { const done = setStatus(o, nx.dataset.to); render(); if (done) askNotify(o, nx.dataset.to); } return; }
  const os = t.closest("[data-ost]"); if (os) { ordFilter.st = os.dataset.ost; render(); return; }
  const od = t.closest("[data-oday]"); if (od) { ordFilter.day = od.dataset.oday; render(); return; }
  const td = t.closest("[data-tday]"); if (td) { totDay = td.dataset.tday; render(); return; }
  const ost = t.closest("[data-ordst]"); if (ost) { const o = curOrd(); if (o) { const done = setStatus(o, ost.dataset.ordst); render(); if (done) askNotify(o, ost.dataset.ordst); else openOrder(o.id); } return; }
  const op = t.closest("[data-ordpaid]"); if (op) { const o = curOrd(); if (o) { setStatus(o, op.dataset.ordpaid === "1" ? "paid" : op.dataset.ordpaid === "diff" ? "paydiff" : "unpaid"); openOrder(o.id); render(); } return; }
  const ds = t.closest("[data-diag-share]"); if (ds) { const u = $("#shB")._diag[+ds.dataset.diagShare]; try { await navigator.share({ text: u }); } catch (e) { if (!e || e.name !== "AbortError") { try { await navigator.clipboard.writeText(u); toast("Αντιγράφηκε"); } catch {} } } return; }
  const dc = t.closest("[data-diag-copy]"); if (dc) { try { await navigator.clipboard.writeText($("#shB")._diag[+dc.dataset.diagCopy]); toast("✓ Αντιγράφηκε. Επικόλλησέ το στο Viber."); } catch { toast("Δεν έγινε αντιγραφή."); } return; }
  const nf = t.closest("[data-ntf]"); if (nf) { const o = S.orders.find(x => x.id === nf.dataset.oid); if (o && nf.dataset.ntf !== "τηλέφωνο" || (o && nf.dataset.ntf === "τηλέφωνο")) { o.notified = o.notified || {}; o.notified[o.st] = { at: Date.now(), via: nf.dataset.ntf }; o.log.push([Date.now(), "Ενημέρωση πελάτη (" + nf.dataset.ntf + "): " + ST[o.st]]); save(); setTimeout(() => { if (isSheetOpen() && $("#shB").dataset.ord === o.id) openOrder(o.id); render(); }, 600); } }
  const rt = t.closest("[data-rate]"); if (rt) { const b = $("#shB"); b._r = b._r || {}; b._r[rt.dataset.rate] = +rt.dataset.v; rt.parentElement.querySelectorAll("[data-rate][data-v]").forEach(x => { if (+x.dataset.v > 0) x.style.color = +x.dataset.v <= +rt.dataset.v ? "#F2B632" : "#cfd6db"; }); return; }
  const rc = t.closest("[data-remc]"); if (rc) { openCust(rc.dataset.cust); return; }
  const rg = t.closest("[data-remgo]"); if (rg) { const g = rg.dataset.remgo;
    if (g === "unpaid") { ordFilter = { st: "done", day: "" }; tab = "orders"; render(); window.scrollTo(0, 0); toast("Οι παραδομένες που δεν έχουν πληρωθεί."); }
    else if (g === "custs") { tab = "custs"; render(); }
    else { tab = "menu"; render(); A.menuList && A.menuList(); }
    return; }
  const dvd = t.closest("[data-dvday]"); if (dvd) { dvSheet(dvd.dataset.dvday); return; }
  const dvb = t.closest("[data-dvby]"); if (dvb) { dvBy = dvb.dataset.dvby; dvSheet(dvDay); return; }
  const dvo = t.closest("[data-dvo]"); if (dvo) { openOrder(dvo.dataset.dvo); return; }
  const dvr = t.closest("[data-dvdr]"); if (dvr) { const o = S.orders.find(x => x.id === dvr.dataset.dvdr); if (o) { const u = dromologioLink(o); o.log.push([Date.now(), "Στάλθηκε στο Δρομολόγιο"]); o.toDr = Date.now(); save(); window.open(u, "_blank"); dvr.textContent = "✓ Στάλθηκε"; } return; }
  const cpl = t.closest("[data-cpl]"); if (cpl) { const k = $("#shB").dataset.cust, c = S.customers[k]; if (c) { ACT.custSave(true); if (cpl.dataset.cpl === "w") c.pl = "w"; else delete c.pl; save(); openCust(k); toast(c.pl === "w" ? "Χονδρική: παίρνει τις τιμές χονδρικής όπου υπάρχουν." : "Λιανική."); } return; }
  const ckb = t.closest("[data-ck]"); if (ckb) { const b = $("#shB"); b.dataset.xck = ckb.dataset.ck; b.dataset.xsub = ""; $$("[data-ck]").forEach(x => x.classList.toggle("on", x === ckb)); $("#cxSubs").innerHTML = subsHTML(ckOf(ckb.dataset.ck), ""); return; }
  const csb = t.closest("[data-csub]"); if (csb) { const b = $("#shB"); b.dataset.xsub = b.dataset.xsub === csb.dataset.csub ? "" : csb.dataset.csub; $$("[data-csub]").forEach(x => x.classList.toggle("on", x.dataset.csub === b.dataset.xsub)); return; }
  const cs = t.closest("[data-cash]"); if (cs) { if (cs.dataset.cash === "in") incomeChooser(); else cashSheet(cs.dataset.cash); return; }
  const cn = t.closest("[data-cashnew]"); if (cn) { cashSheet(cn.dataset.cashnew); return; }
  const co = t.closest("[data-coll]"); if (co) { collectCust(co.dataset.coll); return; }
  const pv = t.closest("[data-pv]"); if (pv) { S.ui.payVia = pv.dataset.pv; $$("[data-pv]").forEach(x => x.classList.toggle("on", x === pv)); return; }
  const an = t.closest("[data-ana]"); if (an) { anaSheet(an.dataset.ana); return; }
  const ap = t.closest("[data-anaper]"); if (ap) { totPer = ap.dataset.anaper; anaSheet(ap.dataset.anak); render(); return; }
  const ao = t.closest("[data-anaout]"); if (ao) { anaOut(ao.dataset.anaout, ao.dataset.anak); return; }
  const ce = t.closest("[data-cashed]"); if (ce) { cashSheet(null, ce.dataset.cashed); return; }
  const cd = t.closest("[data-cldel]"); if (cd) { S.deliv.closed = (S.deliv.closed || []).filter(x => x !== cd.dataset.cldel); save({ catalog: true }); keepDeliv(); return; }
  const gf = t.closest("[data-gdf]"); if (gf) { try { restoreText(await GlenDrive.download(gf.dataset.gdf)); } catch { toast("Δεν κατέβηκε."); } return; }
  const pf = t.closest("[data-phf]"); if (pf) { const f = (A._phl || []).find(x => x.n === pf.dataset.phf); if (f) restoreText(await (await f.h.getFile()).text()); return; }
  const or = t.closest(".ord[data-ord],.it[data-ord]"); if (or && !t.closest("button,a")) { openOrder(or.dataset.ord); return; }
  const cu = t.closest("[data-cust]"); if (cu && cu.classList.contains("it")) { openCust(cu.dataset.cust); return; }
  const a = t.closest("[data-act]");
  if (a && ACT[a.dataset.act]) { if (a.tagName === "A" && a.dataset.act !== "lkSent") e.preventDefault(); ACT[a.dataset.act](a, e); }
});
document.addEventListener("input", e => { if (e.target.id === "custQ") { custQ = e.target.value; const p = e.target.selectionStart; render(); const i = $("#custQ"); i.focus(); i.setSelectionRange(p, p); } });
document.addEventListener("change", e => {
  if (e.target.matches("[data-colo]")) collectSum();
  if (e.target.matches("[data-hol]")) { const r = e.target.closest(".holr"); if (r) r.classList.toggle("off", !e.target.checked); const c = $("#holCnt"); if (c) c.textContent = $$("[data-hol]:checked").length + " από " + $$("[data-hol]").length + " ›"; }
  if (e.target.id === "totPer") { totPer = e.target.value; render(); return; }
  if (e.target.id === "lkPh") { if (e.target.checked && !proGate("photos")) { e.target.checked = false; return; } S.link.photos = e.target.checked; save(); linkSheet(); }
  if (e.target.id === "lkLg") { S.link.logo = e.target.checked; save(); linkSheet(); }
  if (e.target.matches("[data-fq]")) { readForm(); const t = $("#ftot"); if (t) { let s = 0; for (const [id, q] of Object.entries(F.q)) { const p = S.products[id]; if (p) s += K.round2(q * (F.keep[id] != null ? F.keep[id] : p.price)); } t.textContent = K.money(s); } }
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) { pollOnce(); liveStart(); if (S && Date.now() - updLast > 30 * 6e4) checkUpdate(false); } else liveStop(); });
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
  try { S = await IDB.get(STKEY); } catch { S = null; }
  S = migrate(S || defaults());
  await ensureKeys();
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {}
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  try { history.replaceState({ root: 1 }, ""); histPush({ app: 1 }); } catch {}
  render();
  await handleHash();
  render();
  startPoll(); gdInit(); efmInit(); render(); setTimeout(() => { try { liveKeep(); } catch {} }, 3000);
  setTimeout(() => checkUpdate(false), 3000);
}
A.boot = boot;
window.addEventListener("load", () => boot());
})();
