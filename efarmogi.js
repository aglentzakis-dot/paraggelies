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
  if (s.mods) K.modUpgrade(s.mods);
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
const _save0 = save; save = function (opt) { _save0(opt); if (!tmBusy) tmSoon(); if (!geoPreOn) geoPrefetchSoon(); }; A.save = save;
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
    let C = K.buildCatalog(S, { photos: false, logo: false, appUrl: BASE });
    if (Math.ceil((await K.pack(C)).length / K.CHUNK) > 20) C = K.buildCatalog(S, { photos: false, logo: false, icons: false, appUrl: BASE });   /* πολύ μεγάλος: χωρίς τα εικονίδια, μένουν τα σύμβολα */
    const sig = JSON.stringify(Object.assign({}, C, { ts: 0 }));
    if (!force && sig === S.link.catSig) return;
    if (sig !== S.link.catSig) ownRefresh();
    if (await K.catalogPublish(S, C)) { S.link.catSig = sig; S.link.catAt = Date.now(); S.link.dirty = false; clearTimeout(saveT); saveT = setTimeout(write, 250); if (tab === "orders" || tab === "more") render(); }
  } catch {} }, ms == null ? 8000 : ms);
}
setInterval(() => { try { S && liveKeep(); } catch {} }, 30 * 6e4);

/* ---------- μικρά εργαλεία διεπαφής ---------- */
let toastT;
function toast(m, ms) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), ms || 2600); }
let shOnClose = null;
function sheet(title, body, foot, onOpen, onClose) {
  { const b = $("#shB"); for (const k of Object.keys(b.dataset)) delete b.dataset[k]; }   /* κάθε παράθυρο ξεκινά καθαρό: όχι σημάδια από το προηγούμενο */
  $("#shT").textContent = title; $("#shB").innerHTML = body; $("#shF").innerHTML = foot || ""; $("#shF").style.display = foot ? "" : "none";
  if (!isSheetOpen()) histPush({ sh: 1 });
  $("#sheetbg").classList.remove("peek"); $("#sheetbg").classList.add("open"); $("#shB").scrollTop = 0; shOnClose = onClose || null;
  $("#shB").querySelectorAll("[data-phs]").forEach(phSync);
  if (onOpen) onOpen($("#shB"));
}
function hideSheet() { if (typeof PEEK !== "undefined" && PEEK.prev != null) PEEK.off(); $("#sheetbg").classList.remove("open", "peek"); const f = shOnClose; shOnClose = null; if (f) f(); }
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
  /* ο αριθμός είναι δεύτερο τηλέφωνο γνωστού πελάτη: δεν φτιάχνεται νέος πελάτης */
  if (!S.customers[k]) { const alt = Object.values(S.customers).find(y => (y.phones || []).some(p => custKey(p) === k)); if (alt) { if (c.addr && !alt.addr) alt.addr = c.addr; if (c.area && !alt.area) alt.area = c.area; alt.last = Math.max(alt.last || 0, at || Date.now()); return alt; } }
  const x = S.customers[k] || (S.customers[k] = { key: k, name: c.name, phone: c.phone, addr: "", notes: "", first: at || Date.now() });
  if (c.name) x.name = c.name; if (c.phone) x.phone = c.phone; if (c.addr) x.addr = c.addr; if (c.area && !x.area) x.area = c.area;
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
    if (host) { mergeInto(host, o); applyPend(host); seenAdd(o.id); upsertCustomer(o.cust, o.rx); save(); stockAlert(host); return { ok: true, order: host, merged: true }; }
    const sib = o.when.date && S.orders.find(x => (x.st === "prep" || x.st === "done") && custKey(x.cust.phone) === custKey(o.cust.phone) && x.when.date === o.when.date);
    if (sib) { o.sib = sib.id; o.warn.push("Ο πελάτης έχει και την παραγγελία #" + sib.no + " για την ίδια ημέρα, που ήδη ετοιμάζεται. Πήγαινέ τις μαζί."); }
  }
  applyPend(o);
  S.orders.push(o); seenAdd(o.id);
  upsertCustomer(o.cust, o.rx);
  save();
  stockAlert(o);
  return { ok: true, order: o };
}
function mergeInto(host, o) {
  const was = host.total;
  for (const l of o.lines) {
    const same = host.lines.find(h => h.pid === l.pid && Math.abs(h.price - l.price) < 0.004 && (h.opt || "") === (l.opt || "") && (h.note || "") === (l.note || ""));
    if (same) { same.q = Math.round((same.q + l.q) * 1000) / 1000; same.sum = K.round2(same.q * same.price); same.added = (same.added || 0) + l.q; }
    else host.lines.push(Object.assign({}, l, { added: l.q }));
  }
  host.total = K.round2(host.lines.reduce((a, l) => a + l.sum, 0));
  if (o.cust.note) host.cust.note = (host.cust.note ? host.cust.note + " · " : "") + o.cust.note;
  if (o.cust.addr && !host.cust.addr) host.cust.addr = o.cust.addr;
  if (o.when.extra) host.when.extra = true;
  if (o.when.urgent) host.when.urgent = true;
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
  toast(o.mergedAt && Date.now() - o.mergedAt < 5000 ? "🔗 Ο/η " + o.cust.name + " πρόσθεσε κι άλλα στην παραγγελία #" + o.no + " — ενώθηκαν σε μία" : (o.when.urgent ? "🚨 Επείγουσα παραγγελία από " : "🛒 Νέα παραγγελία από ") + o.cust.name, 4500);
  try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch {}
  try {
    if ("Notification" in window && Notification.permission === "granted" && document.hidden && navigator.serviceWorker)
      navigator.serviceWorker.ready.then(r => r.showNotification(o.when.urgent ? "🚨 Επείγουσα παραγγελία" : "🛒 Νέα παραγγελία", Object.assign({ body: "#" + o.no + " · " + o.cust.name + " · " + K.money(o.total), icon: "eikonidia/icon-192.png", tag: o.id, data: { id: o.id } },
        o.st === "new" && ringMode() !== "off" ? { actions: [{ action: "acc", title: "✓ Αποδοχή" }, { action: "hold", title: "⏸ Αναμονή" }, { action: "rej", title: "✕ Απόρριψη" }], requireInteraction: ringMode() === "loop" } : {})));
  } catch {}
  if (o.st === "new") ringAdd(o);
}
/* ---------- κουδούνι νέας παραγγελίας: χτυπά (μία φορά ή συνεχόμενα) μέχρι Αποδοχή, Αναμονή ή Απόρριψη ---------- */
const RING = { q: [], t: null, ac: null, start: 0, n: 0 };
const ringMode = () => (S && S.nt && S.nt.ring) || "once";
function ringAc() { try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; if (!RING.ac) RING.ac = new C(); if (RING.ac.state === "suspended") RING.ac.resume().catch(() => {}); return RING.ac; } catch { return null; } }
document.addEventListener("pointerdown", () => { ringAc(); }, { capture: true, passive: true });
function chime() {
  const ac = ringAc();
  if (ac) try { const t0 = ac.currentTime + 0.02; [[988, 0], [1319, 0.16], [1760, 0.32]].forEach(([f, d]) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = "triangle"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.6, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.55); o.connect(g); g.connect(ac.destination); o.start(t0 + d); o.stop(t0 + d + 0.6); }); } catch {}
  try { navigator.vibrate && navigator.vibrate([250, 120, 250]); } catch {}
}
const ringOpen = () => RING.q.map(id => S.orders.find(x => x.id === id)).filter(o => o && o.st === "new" && !o.hold);
function ringAdd(o) {
  if (ringMode() === "off" || o.test && DEMO) return;
  if (!RING.q.includes(o.id)) RING.q.push(o.id);
  chime(); if (ringMode() === "loop") ringLoop(); else setTimeout(() => { if (!RING.t && RING.q.includes(o.id)) { RING.q = RING.q.filter(x => x !== o.id); ringBar(); } }, 6e4);
  ringBar();
}
function ringLoop() {
  if (RING.t) return; RING.start = Date.now(); RING.n = 0;
  RING.t = setInterval(() => { RING.q = ringOpen().map(o => o.id); if (!RING.q.length) { ringStop(); return; }
    RING.n++; const el = Date.now() - RING.start;
    if (el < 10 * 6e4 || RING.n % 15 === 0) chime();   /* τα πρώτα 10 λεπτά κάθε 4΄΄, μετά μία φορά το λεπτό */
    ringBar(); }, 4000);
}
function ringStop() { clearInterval(RING.t); RING.t = null; ringBar(); }
function ringBar() {
  const L = ringOpen(); RING.q = L.map(o => o.id);
  let b = $("#ringBar"); if (!L.length) { if (b) b.remove(); if (RING.t) { clearInterval(RING.t); RING.t = null; } return; }
  const o = L[0];
  const html = `<div class="rbi" data-ringopen="${o.id}"><span class="rbe">${RING.t ? "🔔" : "🛒"}</span><span class="rbt"><b>${o.when.urgent ? "🚨 Επείγουσα" : "Νέα παραγγελία"} #${o.no} · ${esc(o.cust.name)}</b><small>${esc(fmtWhen(o))} · ${K.money(o.total)}${L.length > 1 ? " · <b>+" + (L.length - 1) + " ακόμα</b>" : ""}</small></span>${RING.t ? "" : `<button type="button" class="rbx" data-ring="dismiss" data-rid="${o.id}" aria-label="Κλείσιμο">✕</button>`}</div>
    <div class="rbb"><button type="button" class="ok" data-ring="acc" data-rid="${o.id}">✓ Αποδοχή</button><button type="button" class="hold" data-ring="hold" data-rid="${o.id}">⏸ Αναμονή</button><button type="button" class="no" data-ring="rej" data-rid="${o.id}">✕ Απόρριψη</button></div>`;
  if (!b) { document.body.insertAdjacentHTML("beforeend", `<div id="ringBar" role="alertdialog" aria-live="assertive"></div>`); b = $("#ringBar"); }
  b.classList.toggle("loop", !!RING.t); b.innerHTML = html;
}
function ringAct(act, id) {
  const o = S.orders.find(x => x.id === id); RING.q = RING.q.filter(x => x !== id);
  if (!o) { ringBar(); return; }
  if (act === "dismiss") { ringBar(); return; }
  if (act === "open") { ringBar(); tab = "orders"; render(); openOrder(o.id); return; }
  if (o.st !== "new") { ringBar(); toast("Η #" + o.no + " είναι ήδη «" + (ST[o.st] || o.st) + "»."); return; }
  if (act === "acc") { setStatus(o, "prep"); delete o.hold; save(); ringBar(); render(); toast("✓ Αποδέχτηκες την #" + o.no + " · ετοιμάζεται"); askNotify(o, "prep"); }
  else if (act === "hold") { o.hold = Date.now(); o.log.push([Date.now(), "Σε αναμονή (θα απαντήσεις αργότερα)"]); save(); ringBar(); render(); toast("⏸ Η #" + o.no + " σε αναμονή· μένει στις Νέες"); }
  else if (act === "rej") { if (!confirm("Απόρριψη της παραγγελίας #" + o.no + " (" + o.cust.name + ", " + K.money(o.total) + ");\nΘα σημειωθεί «Ακυρώθηκε».")) { if (!RING.q.includes(id)) RING.q.unshift(id); ringBar(); return; }
    setStatus(o, "cancel"); save(); ringBar(); render(); toast("✕ Η #" + o.no + " απορρίφθηκε"); askNotify(o, "cancel"); }
}
A.ringAct = ringAct; A.chime = chime; A.announce = announce;
try { navigator.serviceWorker && navigator.serviceWorker.addEventListener("message", e => { const d = e.data || {}; if (d.nact && d.nid && S) ringAct(d.nact === "open" ? "open" : d.nact, d.nid); }); } catch {}
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
  if (h.get("nact") && h.get("nid")) setTimeout(() => ringAct(h.get("nact"), h.get("nid")), 300);
  if (h.has("test")) { S.nt.on = true; save(); toast("✓ Οι ειδοποιήσεις δουλεύουν!", 4000); render(); }
  const txt = [q.get("title"), q.get("text"), q.get("url")].filter(Boolean).join("\n");
  if (txt) { tab = "orders"; render(); if (proGate("viber")) A.importText(txt); }
}

/* ---------- απόδοση ---------- */
function render() {
  if (!S) return;
  applyLook(); $("#ttl").textContent = "Παραγγελίες"; $("#ttlSub").textContent = S.shop.name || "";
  { const lb = $("#langBtn"), en = window.Glossa && Glossa.lang === "en"; if (lb) lb.textContent = en ? "🇬🇧 EN" : "🇬🇷 ΕΛ"; }
  let rb = $("#roleBtn");
  if (S.ui.test && !rb) { $(".top").insertAdjacentHTML("beforeend", `<button type="button" id="roleBtn" data-act="role" aria-label="Δοκιμή: δες και παράγγειλε σαν πελάτης"><span>🛒</span><small>Δοκιμή<br>ως πελάτης</small></button>`); }
  else if (!S.ui.test && rb) rb.remove();
  $$("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  const gb = $("#gearBtn"); if (gb) gb.style.background = tab === "more" ? "var(--accent)" : "rgba(255,255,255,.12)";
  const nNew = S.orders.filter(o => o.st === "new" || o.st === "dup").length;
  const ob = $('#tabs [data-tab="orders"]'); const d = ob.querySelector(".dot"); if (d) d.remove();
  if (nNew) ob.insertAdjacentHTML("beforeend", `<span class="dot">${nNew}</span>`);
  document.body.classList.remove("editing");
  try { ringBar(); } catch {}
  if (tab !== "menu") { const ab = $("#actbar"); if (ab) ab.remove(); }
  const m = $("#main");
  tmShow(tab === "totals"); cmDock(tab === "map");
  if (tab === "orders") { m.innerHTML = ordersView(); ordSeenSoon(); }
  else if (tab === "totals") m.innerHTML = totalsView();
  else if (tab === "menu") { A.menuView(m); return; }
  else if (tab === "custs") m.innerHTML = custsView();
  else if (tab === "map") m.innerHTML = "";
  else if (tab === "route") { m.innerHTML = routeView(); if (RT.step === "res" && RT.res) setTimeout(rtAfter, 0); }
  else m.innerHTML = moreView();
  if (tab === "orders" || tab === "more") efmMount();
  newBar();
  tmPos();
}
A.render = render;
/* όσες νέες φάνηκαν στη λίστα των Παραγγελιών λογαριάζονται «διαβασμένες»: φεύγει η κόκκινη μπάρα */
let ordSeenT = null;
function ordSeenSoon() {
  clearTimeout(ordSeenT);
  ordSeenT = setTimeout(() => {
    if (tab !== "orders" || document.hidden || isSheetOpen() || previewOpen()) { if (tab === "orders" && !document.hidden) ordSeenSoon(); return; }   /* σκεπάζεται από παράθυρο: όχι ακόμα */
    const shown = new Set([...document.querySelectorAll("#main .ord[data-ord]")].map(e => e.dataset.ord));
    let n = 0; for (const o of unread()) if (shown.has(o.id)) { o.seen = Date.now(); n++; }
    if (n) { save(); newBar(); }
  }, 1200);
}
/* μπάρα «νέα παραγγελία» σε κάθε καρτέλα, μέχρι να δεις τις παραγγελίες */
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
  if (f.day === "fut") { if (!(o.when.date > today()) || o.st === "cancel" || o.st === "dup") return false; }
  else if (f.day && o.when.date !== f.day) return false;
  if (f.st === "all") return o.st !== "dup";
  if (f.st === "paid") return o.paid && o.st === "done" && !owes(o);
  if (f.st === "done") return o.st === "done" && owes(o);
  return o.st === f.st;
}
function ordersView() {
  const dups = S.orders.filter(o => o.st === "dup").length;
  if (ordFilter.st === "dup" && !dups) ordFilter.st = "new";
  const tabsDef = [["new", "Νέες"], ["prep", "Ετοιμάζονται"], ["done", "Παραδόθηκαν"], ["paid", "Πληρώθηκαν"], ["cancel", "Ακυρώθηκαν"], ["all", "Όλες"]];
  if (dups) tabsDef.unshift(["dup", "⚠️ Διπλές"]);
  const cnt = st => S.orders.filter(o => ordMatch(o, { st, day: ordFilter.day })).length;
  const days = [...new Set(S.orders.filter(o => o.st !== "cancel" && o.when.date && o.when.date >= addDays(today(), -1)).map(o => o.when.date))].sort().slice(0, 12);
  const fsig = JSON.stringify(ordFilter);
  const list = S.orders.filter(o => ordMatch(o, ordFilter) || movedNow(o, fsig)).sort((a, b) => (urgOn(b) - urgOn(a)) || (ordFilter.st === "all" || ordFilter.st === "paid" || ordFilter.st === "cancel" ? b.rx - a.rx : (a.when.date || "9").localeCompare(b.when.date || "9") || a.rx - b.rx));
  const lk = S.link.sentAt && !S.link.gSent ? `<div class="warnbox"><b>Στείλε μία τελευταία φορά τον κατάλογο στους πελάτες σου.</b> Από εκεί και πέρα κάθε αλλαγή σε προϊόντα, τιμές και ημέρες φτάνει μόνη της, χωρίς νέο σύνδεσμο. <button type="button" class="btn sm amber" data-act="link" style="margin-top:6px">Στείλε τον κατάλογο</button></div>` : "";
  const ntw = S.shop.name && !S.nt.on ? `<div class="warnbox">🔔 Οι ειδοποιήσεις δεν έχουν ενεργοποιηθεί ακόμα. <button type="button" class="btn sm amber" data-act="notif" style="margin-top:6px">Ενεργοποίηση</button></div>` : "";
  return heroHTML() + demoBanner() + updBanner() + installBanner() + (DEMO ? "" : onboarding()) + (DEMO ? "" : lk + ntw) + remindersHTML() + `
   <div class="note" id="liveSt" style="margin:0 2px 8px">${liveText()}</div>
   <div class="row" style="margin-bottom:10px"><button type="button" class="btn amber grow" data-act="newOrder">＋ Παραγγελία</button><button type="button" class="btn soft" data-act="poll" aria-label="Έλεγχος για νέες">⟳</button></div>
   <div class="row" style="margin-bottom:10px"><button type="button" class="btn green grow" data-act="rtOpen">🚐 Δρομολόγιο</button><button type="button" class="btn soft grow" data-act="dvOpen">🚚 Διανομή</button><button type="button" class="btn soft grow" data-act="prepSheet">📦 Ετοιμασία</button></div>
   <div class="chips">${tabsDef.map(([k, l]) => `<button type="button" class="chip${ordFilter.st === k ? " on" : ""}" data-ost="${k}">${l}<span class="n">${cnt(k)}</span></button>`).join("")}</div>
   ${days.length || ordFilter.day === "fut" ? `<div class="chips"><button type="button" class="chip${!ordFilter.day ? " on" : ""}" data-oday="">Όλες οι ημέρες</button><button type="button" class="chip${ordFilter.day === "fut" ? " on" : ""}" data-oday="fut">📅 Επόμενες μέρες</button>${days.map(d => `<button type="button" class="chip${ordFilter.day === d ? " on" : ""}" data-oday="${d}">${esc(K.dayLabel(d))}</button>`).join("")}</div>` : ""}
   ${ordFilter.st === "dup" ? `<div class="warnbox">Αυτές ήρθαν δεύτερη φορά με ίδια είδη από τον ίδιο πελάτη μέσα σε 15 λεπτά. Κράτησέ τες μόνο αν είναι πράγματι νέες παραγγελίες.</div>` : ""}
   ${list.length ? list.map(ordCard).join("") : ordEmpty()}
   <div class="efm-host" id="efmHost"></div>`;
}
/* καλωσόρισμα με τη μέρα σου με μια ματιά */
/* τα τρία κουμπιά του καλωσορίσματος: το καθένα δείχνει ολόκληρη τη δική του λίστα */
const heroOn = () => ordFilter.st === "new" && !ordFilter.day ? "new" : ordFilter.st === "all" && ordFilter.day === today() ? "today" : ordFilter.st === "all" && ordFilter.day === "fut" ? "fut" : "";
function heroGo(k) { ordFilter = k === "new" ? { st: "new", day: "" } : k === "today" ? { st: "all", day: today() } : { st: "all", day: "fut" }; render(); }
/* παραδόσεις μιας ημέρας που δεν έχουν γίνει ακόμα: για τη διαδρομή */
function dayDels(d) { const sv = RT.day; RT.day = "all"; try { return rtCands().filter(x => x.kind === "del" && x.o.when.date === d); } finally { RT.day = sv; } }
function dayRouteBar() {
  const d = /^\d{4}-\d\d-\d\d$/.test(ordFilter.day || "") ? ordFilter.day : ""; if (!d) return "";
  const L = dayDels(d); if (!L.length) return "";
  const lbl = d === today() ? "σήμερα" : d === addDays(today(), 1) ? "αύριο" : K.dayLabel(d);
  return `<button type="button" class="btn green wide drbar" data-act="dayRoute"><span class="e">🚐</span><span class="t"><b>Διαδρομή για ${esc(lbl)}</b><small>${L.length === 1 ? "1 παράδοση" : L.length + " παραδόσεις"} · σειρά στάσεων και πλοήγηση</small></span><span class="g">›</span></button>`;
}
const urgOn = o => o.when && o.when.urgent && (o.st === "new" || o.st === "prep") ? 1 : 0;
function heroHTML() {
  const h = new Date().getHours(), gr = h < 5 ? "Καλό βράδυ" : h < 13 ? "Καλημέρα" : h < 21 ? "Καλησπέρα" : "Καλό βράδυ";
  const td = today(), act = S.orders.filter(o => o.st !== "cancel" && o.st !== "dup");
  const nT = act.filter(o => o.when && o.when.date === td).length, nN = S.orders.filter(o => o.st === "new").length, nF = act.filter(o => o.when && o.when.date > td).length;
  const zt = (S.deliv.zones || []).filter(z => (z.d || []).includes(new Date().getDay())).flatMap(z => z.a);
  return `<div class="hero"><div class="hh"><span class="hg">${gr} 👋</span><b>${esc(S.shop.name || "Καλώς ήρθες")}</b>${zt.length ? `<span class="hz">🚚 Σήμερα: ${esc(zt.join(", "))}</span>` : ""}</div>
   <div class="hs"><button type="button" data-hero="new"${heroOn() === "new" ? ' class="on"' : ""}><b>${nN}</b><small>${nN === 1 ? "νέα" : "νέες"}</small></button><button type="button" data-hero="today"${heroOn() === "today" ? ' class="on"' : ""}><b>${nT}</b><small>για σήμερα</small></button><button type="button" data-hero="fut"${heroOn() === "fut" ? ' class="on"' : ""}><b>${nF}</b><small>για τις επόμενες μέρες</small></button></div></div>` + dayRouteBar();
}
function ordEmpty() {
  const st = ordFilter.st;
  if (st === "new") return `<div class="emp"><div class="ee">🧺</div><b>Καμία νέα παραγγελία αυτή τη στιγμή</b><span>Στείλε τον κατάλογο στους πελάτες σου στο Viber. Οι παραγγελίες τους έρχονται εδώ μόνες τους.</span><button type="button" class="btn amber" data-act="link">📤 Στείλε τον κατάλογο</button></div>`;
  const M = { prep: ["📦", "Τίποτα δεν ετοιμάζεται τώρα"], done: ["🚚", "Δεν υπάρχουν παραδομένες εδώ"], paid: ["💶", "Δεν υπάρχουν πληρωμένες εδώ"], cancel: ["🙌", "Καμία ακυρωμένη"], all: ["🧾", "Δεν υπάρχουν παραγγελίες εδώ."] }[st] || ["🧾", "Δεν υπάρχουν παραγγελίες εδώ."];
  return `<div class="emp sm"><div class="ee">${M[0]}</div><b>${M[1]}</b></div>`;
}
/* μόλις άλλαξε κατάσταση με το γρήγορο κουμπί: μένει λίγο στη λίστα με «↩ Αναίρεση», για να μη «χάνεται» */
const MOVED = {};
const movedNow = (o, fsig) => { const m = MOVED[o.id]; return !!m && m.f === fsig && Date.now() - m.at < 3 * 6e4 && !ordMatch(o, ordFilter); };
const ST_TAB = { new: "Νέες", prep: "Ετοιμάζονται", done: "Παραδόθηκαν", paid: "Πληρώθηκαν", cancel: "Ακυρώθηκαν" };
function movedHTML(o) {
  const m = MOVED[o.id]; if (!m || !movedNow(o, JSON.stringify(ordFilter))) return "";
  const tabK = o.st === "done" && !owes(o) ? "paid" : o.st;
  return `<div class="movedbox">✓ ${m.paid ? "Πληρώθηκε" + (o.payVia ? " · " + payIc(o.payVia) + " " + esc(o.payVia) : "") : "Έγινε «" + esc(ST[o.st] || o.st) + "»"}. Τη βρίσκεις στις <button type="button" class="lnk" data-ost="${tabK}">«${ST_TAB[tabK] || "Όλες"}»</button>${m.undo ? ` · <button type="button" class="lnk" data-undost="${o.id}">↩ Αναίρεση</button>` : ""}</div>`;
}
function ordCard(o) {
  const items = o.lines.map(l => qtyTxt(l) + " " + K.lnName(l)).join(" · ");
  const next = o.st === "new" ? ["prep", "▶ Ετοιμάζεται"] : o.st === "prep" ? ["done", "✓ Παραδόθηκε"] : o.st === "done" && !o.paid ? ["paid", "€ Πληρώθηκε"] : o.st === "done" && owes(o) ? ["paydiff", "€ Υπόλοιπο " + K.money(dueOf(o))] : null;
  return `<div class="ord st-${o.st}${o.paid ? " paid" : ""}${MOVED[o.id] && movedNow(o, JSON.stringify(ordFilter)) ? " moved" : ""}" data-ord="${o.id}">${movedHTML(o)}
   <div class="h"><b>#${o.no} · ${esc(o.cust.name)}</b><span class="tot">${K.money(o.total)}</span></div>
   <div class="m">${o.when.how === "pick" ? "🏪" : "🚚"} ${esc(fmtWhen(o))}${o.when.how !== "pick" && o.cust.addr ? " · " + esc(o.cust.addr) : ""}</div>
   <div class="it">${esc(items)}</div>
   <div class="row">${o.test ? `<span class="pill warn">🧪 Δοκιμή</span>` : ""}${o.when.urgent && (o.st === "new" || o.st === "prep") ? `<span class="pill urg">🚨 Επείγουσα</span>` : ""}${o.hold && o.st === "new" ? `<span class="pill warn">⏸ Σε αναμονή</span>` : ""}${o.when.extra ? `<span class="pill new">⚡ Έκτακτη</span>` : ""}${o.merged && o.merged.length ? `<span class="pill done">🔗 ${o.merged.length + 1} σε μία</span>` : ""}${["prep", "done", "cancel"].includes(o.st) && !o.test ? (ntfOf(o) ? `<span class="pill paid">💬 ✓</span>` : `<span class="pill warn">💬 χωρίς ενημέρωση</span>`) : ""}${o.sib ? `<span class="pill warn">🔗 μαζί με άλλη</span>` : ""}${o.inv && o.inv.t === "i" ? `<span class="pill done">📄 Τιμολόγιο</span>` : ""}<span class="pill ${o.st}">${ST[o.st]}</span>${o.paid ? `<span class="pill paid">Πληρωμένη</span>` : ""}${diffOf(o) > 0 ? `<span class="pill new">χρωστά ${K.money(diffOf(o))}</span>` : diffOf(o) < 0 ? `<span class="pill warn">επιστροφή ${K.money(-diffOf(o))}</span>` : ""}${o.warn && o.warn.length ? `<span class="pill warn">⚠️ ${o.warn.length}</span>` : ""}${o.cust.note ? `<span class="pill">📝</span>` : ""}<span class="grow"></span>${next ? `<button type="button" class="btn sm ${next[0] === "paid" ? "green" : "amber"}" data-next="${o.id}" data-to="${next[0]}">${next[1]}</button>` : ""}</div></div>`;
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
/* πόσα μένουν να εισπραχθούν: όλο το ποσό αν δεν πληρώθηκε, ή το υπόλοιπο μιας μερικής πληρωμής */
const dueOf = o => o.paid ? Math.max(0, diffOf(o)) : K.round2(o.total);
const owes = o => dueOf(o) > 0.004;
A.diffOf = diffOf;
/* κάθε είσπραξη κρατιέται χωριστά (ολική ή μερική εξόφληση) και γίνεται χωριστή κίνηση στο Ταμείο */
function paySeed(o) { if (!o.pays) o.pays = o.paid ? [{ at: o.paidAt || o.rx, amt: K.round2(paidOf(o)), via: o.payVia || "" }] : []; return o.pays; }
function payAdd(o, amt, via) {
  amt = K.round2(amt); if (!amt) return;
  paySeed(o).push({ at: Date.now(), amt, via: via || "" });
  const sum = K.round2(o.pays.reduce((a, p) => a + p.amt, 0));
  o.paid = sum > 0; o.paidAt = Date.now(); o.paidAmt = sum; if (via) o.payVia = via;
  o.partial = o.paid && sum < o.total - 0.004;
  o.log.push([Date.now(), (amt < 0 ? "Επιστροφή " + K.money(-amt) : (o.partial ? "Μερική πληρωμή " : "Πληρώθηκε ") + K.money(amt)) + (via ? " (" + via + ")" : "") + (o.partial ? " · μένουν " + K.money(K.round2(o.total - sum)) : "")]);
}
A.payAdd = payAdd;
function setStatus(o, st) {
  if (st === "paid") { o.pays = [{ at: Date.now(), amt: o.total, via: o.payVia || "" }]; o.partial = false; o.paid = true; o.paidAt = Date.now(); o.paidAmt = o.total; o.log.push([Date.now(), "Πληρώθηκε " + K.money(o.total)]); save(); return true; }
  if (st === "paydiff") { const d = diffOf(o); paySeed(o).push({ at: Date.now(), amt: d, via: o.payVia || "" }); o.partial = false; o.paidAmt = o.total; o.paidAt = Date.now(); o.log.push([Date.now(), d > 0 ? "Πληρώθηκε η διαφορά " + K.money(d) : "Επιστράφηκε η διαφορά " + K.money(-d)]); save(); return true; }
  if (st === "unpaid") { if (!confirm("Να σημειωθεί ξανά ως απλήρωτη η παραγγελία #" + o.no + ";")) return false; o.paid = false; o.paidAt = 0; o.pays = []; o.partial = false; o.log.push([Date.now(), "Σημειώθηκε απλήρωτη"]); save(); return true; }
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
/* ---------- σε αναμονή: προϊόν που δεν υπάρχει τώρα πηγαίνει σε άλλη ημέρα ή στην επόμενη παραγγελία, και η υπόλοιπη φεύγει κανονικά ---------- */
function custNextDays(k, after) {
  const c = S.customers[k] || {}, d = S.deliv, cl = K.closedDates(d);
  const z = !(c.route && c.route.days && c.route.days.length) && c.area ? K.zoneFor(d.zones, c.area) : null;
  const days = c.route && c.route.days && c.route.days.length ? c.route.days : z ? z.d : d.days;
  return K.availDays({ days, closed: cl, min: 1, max: 28 }).filter(x => !after || x > after);
}
function heldHTML(o) {
  const H = (o.held || []).filter(h => !h.undone); if (!H.length) return "";
  return `<div class="heldbox"><b>⏳ Σε αναμονή</b>${H.map(h => `<div class="heldr"><span>${esc(h.name)} · ${K.num(h.q)} ${esc(h.unit)} · <b>${h.to ? esc(K.dayLabel(h.to)) : "με την επόμενη παραγγελία"}</b>${h.doneNo ? ` <span class="pill paid">μπήκε στην #${h.doneNo}</span>` : ""}</span>${h.doneNo && !h.oid ? "" : `<button type="button" class="btn ghost sm" data-unhold="${esc(h.id)}">↩ Επαναφορά</button>`}</div>`).join("")}
   <p class="note" style="margin:6px 0 0">Ο πελάτης το μαθαίνει με το μήνυμα ενημέρωσης πιο κάτω.</p></div>`;
}
function holdSheet(o, i) {
  const l = o.lines[i]; if (!l) return;
  const k = custKey(o.cust.phone), nx = custNextDays(k, o.when.date || today());
  sheet("⏳ Δεν το έχω τώρα", `<div class="card" style="margin-top:0"><b>${esc(l.name)}</b><div class="note" style="margin:2px 0 8px">Στην παραγγελία #${o.no}: ${K.num(l.q)} ${esc(l.unit)} × ${K.money(l.price)}</div>
     <label class="f" for="hdQ">Πόσο μπαίνει σε αναμονή</label><input class="t" id="hdQ" inputmode="decimal" value="${K.num(l.q)}">
     <p class="note">Βγαίνει από αυτή την παραγγελία και η υπόλοιπη στέλνεται κανονικά. Κρατά την ίδια τιμή.</p></div>
   <div class="ambl">
    <div class="ambo" style="cursor:default;flex-wrap:wrap"><span class="ambn">📅</span><span class="t"><b>Σε άλλη ημέρα</b><small>φτιάχνεται νέα παραγγελία για εκείνη την ημέρα</small></span>
      <div class="row" style="flex-basis:100%;margin-top:8px"><select class="t grow" id="hdD">${nx.slice(0, 12).map(x => `<option value="${x}">${esc(K.dayLabel(x))}</option>`).join("")}<option value="">Άλλη ημερομηνία…</option></select><input class="t" type="date" id="hdD2" min="${today()}" style="display:none;flex:1"><button type="button" class="btn amber" data-act="holdDay">✓</button></div></div>
    <button type="button" class="ambo" data-act="holdNext"><span class="ambn">🔁</span><span class="t"><b>Με την επόμενη παραγγελία του</b><small>μπαίνει μόνο του στην επόμενη παραγγελία του πελάτη</small></span><span class="g">›</span></button></div>`,
   `<button type="button" class="btn soft" data-act="holdBack">Άκυρο</button>`,
   el => { el.dataset.hdo = o.id; el.dataset.hdi = i; const s1 = el.querySelector("#hdD"), s2 = el.querySelector("#hdD2"); s1.addEventListener("change", () => { s2.style.display = s1.value ? "none" : ""; if (!s1.value) s2.focus(); }); if (!nx.length) { s1.value = ""; s2.style.display = ""; } });
}
function holdDo(to) {
  const b = $("#shB"), o = S.orders.find(x => x.id === b.dataset.hdo), i = +b.dataset.hdi, l = o && o.lines[i]; if (!l) return;
  let q = K.parseNum($("#hdQ").value); if (!isFinite(q) || q <= 0) { toast("Γράψε ποσότητα."); return; } q = Math.min(q, l.q);
  if (to === "day") { to = $("#hdD").value || $("#hdD2").value; if (!/^\d{4}-\d\d-\d\d$/.test(to || "")) { toast("Διάλεξε ημέρα."); return; } } else to = "";
  if (o.paid && o.paidAmt == null) o.paidAmt = o.total;
  const was = o.total, h = Object.assign({ id: K.uid(8), pid: l.pid, name: l.name, unit: l.unit, q, price: l.price, vat: l.vat, to, at: Date.now() }, l.opt ? { opt: l.opt } : {}, l.note ? { note: l.note } : {});
  if (q >= l.q - 1e-9) o.lines.splice(i, 1); else { l.q = K.round2(l.q - q); l.sum = K.round2(l.q * l.price); }
  o.total = K.round2(o.lines.reduce((a, x) => a + x.sum, 0));
  if (to) {
    const n = { id: K.uid(12), no: ++S.seq, at: Date.now(), rx: Date.now(), cust: Object.assign({}, o.cust, { note: "" }), when: { date: to, slot: o.when.slot || "", how: o.when.how }, lines: [{ pid: h.pid, name: h.name, unit: h.unit, q, price: h.price, vat: h.vat, sum: K.round2(q * h.price), pend: o.no }], st: "new", seen: Date.now(), paid: false, src: "manual", warn: [], log: [[Date.now(), "Από την αναμονή της #" + o.no]] };
    n.total = n.lines[0].sum; S.orders.push(n); seenAdd(n.id); h.oid = n.id; h.doneNo = n.no;
  } else (S.pend || (S.pend = [])).push({ k: custKey(o.cust.phone), from: o.id, no: o.no, hid: h.id, pid: h.pid, name: h.name, unit: h.unit, q, price: h.price, vat: h.vat, at: Date.now(), opt: h.opt, note: h.note });
  (o.held || (o.held = [])).push(h);
  o.log.push([Date.now(), "Σε αναμονή: " + K.num(q) + " " + h.unit + " " + h.name + " → " + (to ? K.dayLabel(to) : "επόμενη παραγγελία") + " (" + K.money(was) + " → " + K.money(o.total) + ")"]);
  save(); render(); openOrder(o.id);
  toast("⏳ " + h.name + ": " + (to ? K.dayLabel(to) : "με την επόμενη παραγγελία") + ". Η υπόλοιπη παραγγελία συνεχίζει κανονικά.", 4500);
  if (diffOf(o) < 0) setTimeout(() => toast("⚠️ Ήταν πληρωμένη: του επιστρέφεις " + K.money(-diffOf(o)) + " ή το κρατάς για την επόμενη.", 5000), 4600);
}
function unhold(o, hid) {
  const h = (o.held || []).find(x => x.id === hid); if (!h || h.undone) return;
  if (h.oid) { const n = S.orders.find(x => x.id === h.oid);
    if (n) { const j = n.lines.findIndex(x => x.pend === o.no && x.pid === h.pid); if (j >= 0) n.lines.splice(j, 1); n.total = K.round2(n.lines.reduce((a, x) => a + x.sum, 0)); if (!n.lines.length && (n.st === "new" || n.st === "dup")) S.orders = S.orders.filter(x => x !== n); else n.log.push([Date.now(), "Αφαιρέθηκε το «" + h.name + "» (επέστρεψε στην #" + o.no + ")"]); } }
  else if (h.doneNo) { toast("Έχει ήδη μπει στην παραγγελία #" + h.doneNo + ". Άλλαξέ το από εκεί.", 4000); return; }
  S.pend = (S.pend || []).filter(x => x.hid !== hid);
  const same = o.lines.find(x => x.pid === h.pid && Math.abs(x.price - h.price) < .004);
  if (same) { same.q = K.round2(same.q + h.q); same.sum = K.round2(same.q * same.price); } else o.lines.push({ pid: h.pid, name: h.name, unit: h.unit, q: h.q, price: h.price, vat: h.vat, sum: K.round2(h.q * h.price) });
  o.total = K.round2(o.lines.reduce((a, x) => a + x.sum, 0)); h.undone = Date.now();
  o.log.push([Date.now(), "Επαναφορά από αναμονή: " + h.name]); save(); render(); openOrder(o.id);
}
/* η επόμενη παραγγελία του πελάτη παίρνει μόνη της ό,τι περίμενε */
function applyPend(o) {
  const k = custKey(o.cust.phone), P = (S.pend || []).filter(x => x.k === k); if (!P.length || o.st === "dup" || o.st === "cancel") return;
  for (const x of P) {
    const same = o.lines.find(l => l.pid === x.pid && Math.abs(l.price - x.price) < .004 && l.pend === x.no && (l.opt || "") === (x.opt || "") && (l.note || "") === (x.note || ""));
    if (same) { same.q = K.round2(same.q + x.q); same.sum = K.round2(same.q * same.price); } else o.lines.push(Object.assign({ pid: x.pid, name: x.name, unit: x.unit, q: x.q, price: x.price, vat: x.vat, sum: K.round2(x.q * x.price), pend: x.no }, x.opt ? { opt: x.opt } : {}, x.note ? { note: x.note } : {}));
    (o.warn || (o.warn = [])).push("⏳ Προστέθηκε από την αναμονή της #" + x.no + ": " + K.num(x.q) + " " + x.unit + " " + x.name + ".");
    o.log.push([Date.now(), "Προστέθηκε από την αναμονή της #" + x.no + ": " + x.name]);
    const src = S.orders.find(y => y.id === x.from), h = src && (src.held || []).find(y => y.id === x.hid); if (h) h.doneNo = o.no;
  }
  o.total = K.round2(o.lines.reduce((a, l) => a + l.sum, 0));
  S.pend = (S.pend || []).filter(x => x.k !== k);
}
const pendOf = k => (S.pend || []).filter(x => x.k === k);
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
    ${o.cust.addr || (c && c.addr) ? `<p class="olin">📍 <span class="grow">${esc(o.cust.addr || c.addr)}</span>${o.when.how === "pick" ? "" : `<a class="minib" href="${esc(navHref(o))}" target="_blank" rel="noopener">🧭 Πλοήγηση</a>`}</p>` : ""}
    <p class="olin">📞 <a class="grow" href="tel:${esc(phone)}">${esc(phone)}</a>${c && c.phones ? c.phones.filter(p => phDig(p) !== phDig(phone)).map(p => `<a href="tel:${esc(p)}" style="margin-right:8px">${PHK[phKind(p)][0]} ${esc(p)}</a>`).join("") : ""}${c && c.inPh ? "" : `<button type="button" class="minib" data-act="ordVcf">📇 Στις επαφές</button>`}</p>
    ${o.cust.note ? `<div class="warnbox">📝 ${esc(o.cust.note)}</div>` : ""}
    ${o.when.urgent ? `<div class="errbox">🚨 <b>Επείγουσα:</b> ο πελάτης τη χρειάζεται όσο πιο γρήγορα γίνεται.${o.st === "new" ? " Αν δεν προλαβαίνεις, ενημέρωσέ τον." : ""}</div>` : ""}
    ${o.when.extra ? `<div class="warnbox">⚡ Έκτακτη παραγγελία, εκτός από τις κανονικές ημέρες του πελάτη.</div>` : ""}
    ${o.merged && o.merged.length ? `<div class="okbox">🔗 Ο πελάτης έστειλε ${o.merged.length + 1} παραγγελίες για την ίδια ημέρα· ενώθηκαν σε αυτή. Τα είδη που προστέθηκαν έχουν σημάδι «＋».</div>` : ""}
    ${o.inv && o.inv.t === "i" ? `<div class="okbox"><b>📄 Θέλει τιμολόγιο</b><br>${esc(o.inv.n)}<br>ΑΦΜ ${esc(o.inv.f)}${o.inv.d ? " · ΔΟΥ " + esc(o.inv.d) : ""}${o.inv.j ? "<br>" + esc(o.inv.j) : ""}<br>${esc(o.inv.a)}</div>` : o.inv && o.inv.t === "r" ? `<p class="note">🧾 Θέλει απόδειξη</p>` : ""}
    ${c && c.notes ? `<p class="note">Σημείωση πελάτη: ${esc(c.notes)}</p>` : ""}</div>
   <div class="card">${o.lines.map((l, i) => `<div class="qrow"><div class="qn"><b>${esc(l.name)}${K.lnOpt(l) ? `<em class="lopt">${esc(K.lnOpt(l))}</em>` : ""}${l.added ? ` <span class="pill done">＋${K.num(l.added)}</span>` : ""}${l.pend ? ` <span class="pill warn">⏳ από #${esc(String(l.pend))}</span>` : ""}</b><span>${K.num(l.q)} ${esc(l.unit)} × ${K.money(l.price)}${l.vat != null ? " · ΦΠΑ " + l.vat + "%" : ""}</span></div><b>${K.money(l.sum)}</b>${o.st === "new" || o.st === "prep" || o.st === "dup" ? `<button type="button" class="holdb" data-hold="${i}" aria-label="Δεν το έχω: σε αναμονή" title="Δεν το έχω τώρα: σε αναμονή">⏳</button>` : ""}</div>`).join("")}
    ${heldHTML(o)}
    <div class="row" style="margin-top:8px"><b class="grow">Σύνολο</b><b class="big-num" style="font-size:20px">${K.money(o.total)}</b></div>
    <p class="note">Οι τιμές γράφτηκαν από τον δικό σου κατάλογο, όπως ίσχυαν ${fmtTime(o.at)}.${o.src === "link" ? " Ο πελάτης αποδέχθηκε τους όρους και την ενημέρωση απορρήτου πριν την αποστολή." : ""}</p></div>
   <h3 style="margin:4px 2px 6px;font-size:15px">Κατάσταση</h3>
   <div class="chips">${stBtn("new", "Νέα")}${stBtn("prep", "Ετοιμάζεται")}${stBtn("done", "Παραδόθηκε")}${stBtn("cancel", "Ακυρώθηκε")}</div>
   ${diffOf(o) ? `<div class="${diffOf(o) > 0 ? "errbox" : "warnbox"}"><b>${o.partial ? "Μερική εξόφληση." : "Η παραγγελία άλλαξε μετά την πληρωμή."}</b><br>Πληρώθηκαν ${K.money(paidOf(o))}, ${o.partial ? "" : "νέο "}σύνολο ${K.money(o.total)}.<br>${diffOf(o) > 0 ? "Ο πελάτης <b>χρωστά " + K.money(diffOf(o)) + "</b>." : "Του <b>επιστρέφεις " + K.money(-diffOf(o)) + "</b>."}<div style="margin-top:8px"><button type="button" class="btn sm ${diffOf(o) > 0 ? "green" : "amber"}" data-ordpaid="diff">${diffOf(o) > 0 ? "€ Πλήρωσε τη διαφορά " + K.money(diffOf(o)) : "↩ Επιστράφηκαν " + K.money(-diffOf(o))}</button></div></div>` : ""}
   <div class="row payrow" style="margin:0 0 12px;flex-wrap:wrap">${o.paid ? `<span class="pill paid" style="font-size:14px;padding:8px 12px;flex:1 1 auto;min-width:0">✓ Πληρωμένη ${K.money(paidOf(o))}${o.payVia ? " · " + payIc(o.payVia) + " " + esc(o.payVia) : ""}</span><button type="button" class="btn ghost sm" style="border-color:var(--bad);color:var(--bad);flex:0 0 auto;white-space:nowrap" data-ordpaid="0">✕ Απλήρωτη</button>` : `<button type="button" class="btn green grow" data-ordpaid="1">€ Πληρώθηκε ${K.money(o.total)}</button>`}</div>
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
/* πλοήγηση κατευθείαν σε μία παραγγελία: με τη θέση του πελάτη αν την ξέρουμε, αλλιώς με τη διεύθυνση */
function navHref(o) {
  const k = custKey(o.cust.phone), c = S.customers[k] || {}, addr = o.cust.addr || c.addr || "", area = o.cust.area || c.area || "";
  const pin = custPin(k), g = geoMem()[geoKey(addr, c.area || area)], loc = pin || (g && g.lat != null ? g : null);
  return "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" + (loc ? loc.lat.toFixed(6) + "," + loc.lng.toFixed(6) : encodeURIComponent([addr, area].filter(Boolean).join(", ")));
}
A.navHref = navHref;
/* αποθήκευση πελάτη στις επαφές του κινητού: στο Android ανοίγει έτοιμη τη φόρμα «Νέα επαφή»,
   στο iPhone και αλλού δίνει κάρτα επαφής (.vcf) που ανοίγει με «Δημιουργία νέας επαφής» */
const vEsc = v => String(v || "").replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
const intlPh = p => { const d = String(p || "").replace(/[^\d+]/g, ""); return /^\d{10}$/.test(d) ? "+30" + d : d; };
/* όνομα αρχείου με λατινικούς χαρακτήρες: κάποια κινητά χάνουν τα ελληνικά στο όνομα αρχείου */
const GRL = { α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o" };
const latinName = n => (String(n || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ου/g, "ou").replace(/αυ/g, "av").replace(/ευ/g, "ev").replace(/μπ/g, "b").replace(/ντ/g, "d").replace(/γκ/g, "g").split("").map(ch => GRL[ch] != null ? GRL[ch] : ch).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/(^|-)([a-z])/g, (m, d, c) => d + c.toUpperCase()) || "Pelatis");
function vcardOf(x) {
  const parts = String(x.name || "").trim().split(/\s+/), last = parts.length > 1 ? parts.slice(1).join(" ") : "", first = parts[0] || "";
  return ["BEGIN:VCARD", "VERSION:3.0", "N:" + vEsc(last) + ";" + vEsc(first) + ";;;", "FN:" + vEsc(x.name), "TEL;TYPE=CELL:" + intlPh(x.phone), ...(x.phones || []).map(p => "TEL;TYPE=" + (phKind(p) === "s" ? "HOME,VOICE" : "CELL") + ":" + intlPh(p)),
    x.addr || x.area ? "ADR;TYPE=HOME:;;" + vEsc(x.addr) + ";" + vEsc(x.area) + ";;;Ελλάδα" : "", x.note ? "NOTE:" + vEsc(x.note) : "", "END:VCARD"].filter(Boolean).join("\r\n") + "\r\n";
}
async function saveToPhone(x, k) {
  const note = "Πελάτης" + (S.shop.name ? " · " + S.shop.name : "");
  const mark = () => { const c = k && S.customers[k]; if (c) { c.inPh = 1; save(); } };
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) {
    const ex = [["name", x.name], ["phone", intlPh(x.phone)], ["postal", [x.addr, x.area].filter(Boolean).join(", ")], ["notes", note]].filter(([, v]) => v);
    location.href = "intent:#Intent;action=android.intent.action.INSERT;type=vnd.android.cursor.dir/raw_contact;" + ex.map(([a, v]) => "S." + a + "=" + encodeURIComponent(v)).join(";") + ";i.phone_type=2;end";
    mark(); return "android";
  }
  const file = new File([vcardOf(Object.assign({ note }, x))], latinName(x.name) + ".vcf", { type: "text/vcard" });
  if (/iPhone|iPad|Macintosh/i.test(ua) && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); mark(); return "share"; } catch (e) { if (e && e.name === "AbortError") return "cancel"; }
  }
  const u = URL.createObjectURL(file), a = document.createElement("a"); a.href = u; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000);
  mark(); toast("📇 Κατέβηκε η κάρτα επαφής «" + file.name + "». Άνοιξέ τη για να αποθηκευτεί στις επαφές.", 5000); return "file";
}
A.vcardOf = vcardOf; A.saveToPhone = saveToPhone;
function statusText(o) {
  const n = S.shop.name || "";
  const base = { new: "λάβαμε την παραγγελία σας", prep: "ετοιμάζουμε την παραγγελία σας", done: "η παραγγελία σας παραδόθηκε. Ευχαριστούμε", cancel: "η παραγγελία σας ακυρώθηκε" }[o.st] || "";
  const when = o.st === "new" || o.st === "prep" ? " για " + (o.when.how === "pick" ? "παραλαβή " : "παράδοση ") + fmtWhen(o).replace(/^Αύριο, /, "αύριο ").replace(/^Σήμερα, /, "σήμερα ") : "";
  const hl = (o.held || []).filter(h => !h.undone);
  const held = hl.length && o.st !== "cancel" ? " " + hl.map(h => "Το «" + h.name + "» (" + K.num(h.q) + " " + h.unit + ") δεν το έχουμε αυτή τη στιγμή· " + (h.to ? "θα σας έρθει " + K.dayLabel(h.to).replace(/^Αύριο, /, "αύριο ").replace(/^Σήμερα, /, "σήμερα ") : "θα σας έρθει με την επόμενη παραγγελία σας") + ", χωρίς να το ξαναζητήσετε.").join(" ") : "";
  return "Γεια σας " + (o.cust.name.split(" ")[0] || "") + "! " + (n ? n + ": " : "") + base + when + ". Κωδικός " + code(o) + ", σύνολο " + K.money(o.total) + (o.st === "done" && !o.paid ? " (εκκρεμεί η πληρωμή)" : "") + "." + held;
}
/* μετά από αλλαγή κατάστασης: πρόταση να ενημερωθεί ο πελάτης */
function askNotify(o, st) {
  if (!["prep", "done", "cancel"].includes(st) || S.ui.noAsk) { if (isSheetOpen()) openOrder(o.id); return; }
  const head = { prep: "▶ Η παραγγελία ετοιμάζεται", done: "✓ Η παραγγελία παραδόθηκε", cancel: "✕ Η παραγγελία ακυρώθηκε" }[st];
  sheet("💬 Ενημέρωση πελάτη", `<div class="okbox"><b>${head}.</b> Θέλεις να το μάθει και ο/η ${esc(o.cust.name)};</div>
   <div class="card"><div class="note" style="margin:0 0 6px">Το μήνυμα που θα σταλεί:</div><div style="background:#f5f7f8;border-radius:10px;padding:10px;font-size:14.5px">${esc(statusText(o))}</div></div>
   ${ntfOf(o) ? ntfStatus(o) : ""}<div class="row" style="margin-bottom:10px">${msgButtons(o)}</div>
   <label class="ck noask"><input type="checkbox" id="anOff"><span><b>Να μην ξαναεμφανιστεί</b><small>Το μήνυμα το στέλνεις και από μέσα από την παραγγελία («💬 Ενημέρωση πελάτη»). Αν θέλεις να ξαναβγαίνει, το ανοίγεις από τις <b>⚙️ Ρυθμίσεις › 💬 Πρόταση ενημέρωσης πελάτη</b>.</small></span></label>`,
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
  <h1>${esc(s.legal || s.name)}</h1><div class="m">${esc(s.addr)}${s.afm ? " · ΑΦΜ " + esc(s.afm) : ""}${s.phone ? " · " + esc(phAll(s).join(", ")) : ""}</div>
  <div class="nf">ΔΕΝ ΑΠΟΤΕΛΕΙ ΦΟΡΟΛΟΓΙΚΟ ΠΑΡΑΣΤΑΤΙΚΟ</div>
  <p><b>Βεβαίωση παραγγελίας #${o.no}</b> · κωδικός ${code(o)}<br>Υποβολή: ${fmtTime(o.at)}<br>${o.when.how === "pick" ? "Παραλαβή" : "Παράδοση"}: ${esc(fmtWhen(o))}</p>
  <p><b>${esc(o.cust.name)}</b><br>${esc(o.cust.phone)}${o.cust.addr ? "<br>" + esc(o.cust.addr) : ""}</p>
  ${o.inv && o.inv.t === "i" ? `<p>Στοιχεία τιμολογίου: <b>${esc(o.inv.n)}</b> · ΑΦΜ ${esc(o.inv.f)}${o.inv.d ? " · ΔΟΥ " + esc(o.inv.d) : ""} · ${esc(o.inv.a)}</p>` : o.inv && o.inv.t === "r" ? `<p>Ζητήθηκε: απόδειξη</p>` : ""}
  <table><tr><th>Είδος</th><th class="r">Ποσότητα</th><th class="r">Τιμή</th><th class="r">Ποσό</th></tr>${o.lines.map(l => `<tr><td>${esc(K.lnName(l))}</td><td class="r">${K.num(l.q)} ${esc(l.unit)}</td><td class="r">${K.money(l.price)}</td><td class="r">${K.money(l.sum)}</td></tr>`).join("")}
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
    (o.when.how === "pick" ? "Παραλαβή: " : "Παράδοση: ") + fmtWhen(o), o.when.urgent ? "!!! ΕΠΕΙΓΟΥΣΑ !!!" : "", o.when.extra ? "*** ΕΚΤΑΚΤΗ ***" : "", line,
    o.cust.name, o.cust.phone, o.cust.addr || "", o.cust.note ? "Σημ.: " + o.cust.note : "", line];
  for (const l of o.lines) { L.push(K.lnName(l)); L.push(pad("  " + K.num(l.q) + " " + l.unit + " x " + K.money(l.price), K.money(l.sum))); }
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
  F = Object.assign({ id: null, name: "", phone: "", addr: "", note: "", date: K.availDays(Object.assign({}, S.deliv, { closed: K.closedDates(S.deliv) }))[0] || today(), slot: (S.deliv.slots || [])[0] || "", how: S.deliv.how === "pick" ? "pick" : "del", q: {}, keep: {}, ol: [], src: "manual", rest: [] }, init || {});
  drawForm();
}
function drawForm() {
  const prods = Object.values(S.products).filter(p => !p.del && (!p.draft || F.q[p.id] > 0)).sort((a, b) => a.name.localeCompare(b.name, "el"));
  const sel = prods.filter(p => F.q[p.id] > 0), others = prods.filter(p => !(F.q[p.id] > 0));
  const custs = Object.values(S.customers).sort((a, b) => (b.last || 0) - (a.last || 0));
  let tot = 0;
  const fcu = S.customers[custKey(F.phone)];
  const row = p => { if (pHasOpts(p)) { const n = (F.ol || []).filter(y => y.pid === p.id).reduce((a, y) => a + y.q, 0); return `<div class="qrow"><div class="qn"><b>${esc(p.name)}${p.soldout ? " · εξαντλήθηκε" : ""}</b><span>${K.money(p.price)} / ${esc(p.unit)} · με επιλογές${n ? " · <b>" + K.num(n) + " στην παραγγελία</b>" : ""}</span></div><button type="button" class="btn sm amber" data-fopt="${p.id}">🧩 ＋</button></div>`; }
    const q = F.q[p.id] || 0; const price = F.keep[p.id] != null ? F.keep[p.id] : K.priceFor(p, fcu, q || 1); tot += K.round2(q * price); return `<div class="qrow"><div class="qn"><b>${esc(p.name)}${p.soldout ? " · εξαντλήθηκε" : ""}</b><span>${K.money(price)} / ${esc(p.unit)}</span></div><button type="button" class="qb" data-fm="${p.id}">−</button><input class="qi" inputmode="decimal" data-fq="${p.id}" value="${q ? K.num(q) : ""}" placeholder="0"><button type="button" class="qb plus" data-fp="${p.id}">+</button></div>`; };
  sheet(F.id ? "Αλλαγή παραγγελίας" : F.src === "viber" ? "Παραγγελία από μήνυμα" : "Νέα παραγγελία", `
   ${F.src === "viber" ? `<div class="okbox">Συμπληρώθηκαν αυτόματα όσα αναγνωρίστηκαν. Έλεγξέ τα πριν την αποθήκευση.</div>${F.rest.length ? `<div class="warnbox">Δεν αναγνωρίστηκαν: ${esc(F.rest.join(" · "))}</div>` : ""}${F.text ? `<details class="card"><summary style="cursor:pointer;font-weight:700">Το μήνυμα</summary><p style="white-space:pre-wrap;margin:8px 0 0">${esc(F.text)}</p></details>` : ""}` : ""}
   <div class="card"><h3>Πελάτης</h3>
    ${custs.length ? `<select class="t" id="fcSel"><option value="">— Νέος ή διάλεξε πελάτη —</option>${custs.map(c => `<option value="${c.key}"${custKey(F.phone) === c.key ? " selected" : ""}>${esc(c.name)} · ${esc(c.phone)}</option>`).join("")}</select>` : ""}
    <label class="f" for="fn">Ονοματεπώνυμο</label><input class="t" id="fn" value="${esc(F.name)}" maxlength="80">
    <div class="two"><div><label class="f" for="fph">Τηλέφωνο</label><input class="t" id="fph" type="tel" value="${esc(F.phone)}" maxlength="20"></div><div><label class="f" for="fhow">Τρόπος</label><select class="t" id="fhow"><option value="del"${F.how === "del" ? " selected" : ""}>Παράδοση</option><option value="pick"${F.how === "pick" ? " selected" : ""}>Παραλαβή</option></select></div></div>
    <label class="f" for="fad">Διεύθυνση</label><input class="t" id="fad" value="${esc(F.addr)}" maxlength="160">
    <div class="two"><div><label class="f" for="fd">Ημέρα</label><input class="t" id="fd" type="date" value="${esc(F.date)}"></div><div><label class="f" for="fs">Ώρα</label>${(S.deliv.slots || []).length ? `<select class="t" id="fs"><option value="">—</option>${S.deliv.slots.map(x => `<option${x === F.slot ? " selected" : ""}>${esc(x)}</option>`).join("")}</select>` : `<input class="t" id="fs" value="${esc(F.slot)}" placeholder="π.χ. 10:00-12:00" maxlength="30">`}</div></div>
    <label class="f" for="fnote">Σημείωση</label><input class="t" id="fnote" value="${esc(F.note)}" maxlength="400"></div>
   ${prods.length ? `<div class="card"><h3>Είδη</h3>
    <button type="button" class="btn amber wide catpick" data-act="catPick">🛍 Κατάλογος όπως τον βλέπει ο πελάτης</button><p class="note" style="margin:4px 0 10px;text-align:center">ή διάλεξε από τη λίστα:</p>
    ${olHTML(fcu, v => { tot += v; })}
    <input class="t" id="fsearch" placeholder="🔍 Αναζήτηση…" style="margin-bottom:6px">${groupedRows(prods, row, id => F.q[id] > 0 || (F.ol || []).some(y => y.pid === id))}
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
/* είδη με επιλογές (ζάχαρη, γάλα…) μέσα στη χειροκίνητη παραγγελία */
const pHasOpts = p => !!p && (((p.mods || []).some(g => (S.mods || {})[g])) || !!p.nt);
const olPrice = (y, fcu) => { const p = S.products[y.pid]; return y.price != null ? y.price : K.round2(K.priceFor(p, fcu, y.q, Date.now()) + (y.x || 0)); };
function olHTML(fcu, addTot) {
  const L = (F.ol || []).map((y, i) => [y, i]).filter(([y]) => S.products[y.pid] && y.q > 0); if (!L.length) return "";
  return `<div class="olbox"><b class="olh">🧩 Με επιλογές ή χωριστές γραμμές</b>${L.map(([y, i]) => { const p = S.products[y.pid], pr = olPrice(y, fcu); addTot(K.round2(y.q * pr)); const t = [y.opt, y.n ? "«" + y.n + "»" : "", y.pend ? "⏳ από #" + y.pend : ""].filter(Boolean).join(" · ");
    return `<div class="qrow"><div class="qn"><b>${esc(p.name)}<em class="lopt">${esc(t || (pHasOpts(p) ? "χωρίς επιλογές" : "χωριστή γραμμή"))}</em></b><span>${K.money(pr)} / ${esc(p.unit)}</span></div><button type="button" class="qb" data-olm="${i}">−</button><span class="qv" style="min-width:34px;text-align:center;font-weight:800">${K.num(y.q)}</span><button type="button" class="qb plus" data-olp="${i}">+</button></div>`; }).join("")}</div>`;
}
function olQty(i, d) { readForm(); const y = (F.ol || [])[i]; if (!y) return; const p = S.products[y.pid], st = +(p && p.step) || 1; y.q = Math.max(0, Math.round((y.q + d * st) * 1000) / 1000); if (!y.q) F.ol.splice(i, 1); const sy = $("#shB").scrollTop; drawForm(); $("#shB").scrollTop = sy; }
/* ο κατάλογος του πελάτη σε όλη την οθόνη, για γρήγορη χειροκίνητη παραγγελία */
async function catPick(pid) {
  readForm();
  let url = ""; try { url = await makeLink(null, { noPhotos: 1 }); } catch {}
  if (!url) { toast("Ο κατάλογος δεν άνοιξε. Διάλεξε από τη λίστα."); return; }
  if (location.origin && url.indexOf(location.origin) !== 0) url = new URL("p.html", location.href).href + url.slice(url.indexOf("#"));
  openPreview(url + "&m=1" + (pid ? "&p=" + encodeURIComponent(pid) : ""), `<b style="display:block;font-size:15.5px">🛍 Διάλεξε είδη για την παραγγελία</b><small style="display:block;font-size:12.5px;opacity:.85">Όπως τα βλέπει ο πελάτης. Στο τέλος πάτα «✓ Πέρασέ τα στην παραγγελία».</small>`);
}
function pickMerge(L) {
  closePreview(false); if (!F || !Array.isArray(L)) return; let n = 0; F.ol = F.ol || [];
  for (const x of L) { const p = S.products[x && x.pid]; const q = +(x && x.q); if (!p || !(q > 0)) continue; n++;
    if (x.o != null) { const r = K.optCheck(p.mods, S.mods || {}, x.o, x.n, !!p.nt); const same = F.ol.find(y => y.pid === p.id && y.price == null && (y.opt || "") === r.text && (y.n || "") === r.note);
      if (same) same.q = Math.round((same.q + q) * 1000) / 1000; else F.ol.push({ pid: p.id, q, o: x.o, n: r.note, opt: r.text, x: r.x }); }
    else F.q[p.id] = Math.round(((F.q[p.id] || 0) + q) * 1000) / 1000; }
  drawForm(); if (n) toast("✓ Μπήκαν " + n + (n === 1 ? " είδος" : " είδη") + " στην παραγγελία");
}
window.addEventListener("message", e => { const f = $("#pvFrame"); if (!f || e.source !== f.contentWindow || !e.data || !Array.isArray(e.data.glenPick)) return; pickMerge(e.data.glenPick); });
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
  const ids = Object.keys(F.q).filter(id => F.q[id] > 0 && S.products[id]), OL = (F.ol || []).filter(y => y.q > 0 && S.products[y.pid]);
  if (!ids.length && !OL.length) return err("Πρόσθεσε τουλάχιστον ένα είδος.");
  const fcu = S.customers[custKey(F.phone)];
  const lines = ids.map(id => { const p = S.products[id], q = F.q[id], price = F.keep[id] != null ? F.keep[id] : K.priceFor(p, fcu, q, Date.now()); return { pid: id, name: p.name, unit: p.unit, q, price, vat: +p.vat || 0, sum: K.round2(q * price) }; })
    .concat(OL.map(y => { const p = S.products[y.pid], price = olPrice(y, fcu); return Object.assign({ pid: y.pid, name: p.name, unit: p.unit, q: y.q, price, vat: +p.vat || 0, sum: K.round2(y.q * price) }, y.opt ? { opt: y.opt } : {}, y.n ? { note: y.n } : {}, y.pend ? { pend: y.pend } : {}); }));
  const total = K.round2(lines.reduce((a, l) => a + l.sum, 0));
  const cust = { name: F.name, phone: F.phone, addr: F.addr, note: F.note };
  const when = { date: F.date, slot: F.slot, how: F.how };
  if (F.id) {
    const o = S.orders.find(x => x.id === F.id); if (!o) return closeSheet();
    const was = o.total; if (o.paid && o.paidAmt == null) o.paidAmt = was;
    Object.assign(o, { cust: Object.assign({}, o.cust, cust), when: Object.assign({}, o.when, when), lines, total }); o.log.push([Date.now(), "Αλλαγή από εσένα" + (was !== total ? ": " + K.money(was) + " → " + K.money(total) : "")]);
    if (diffOf(o)) setTimeout(() => toast(diffOf(o) > 0 ? "⚠️ Ο πελάτης χρωστά τώρα τη διαφορά " + K.money(diffOf(o)) : "⚠️ Του επιστρέφεις " + K.money(-diffOf(o)), 4500), 300);
    upsertCustomer(cust, Date.now()); save(); closeSheet(); toast("✓ Αποθηκεύτηκε"); render(); openOrder(o.id); return;
  }
  const o = { id: K.uid(12), no: ++S.seq, at: Date.now(), rx: Date.now(), cust, when, lines, total, st: "new", seen: Date.now(), paid: false, src: F.src === "viber" ? "viber" : "manual", warn: [], log: [[Date.now(), F.src === "viber" ? "Από μήνυμα Viber" : "Καταχώριση από εσένα"]] };
  applyPend(o); S.orders.push(o); seenAdd(o.id); upsertCustomer(cust, o.rx); save(); closeSheet(); toast("✓ Η παραγγελία καταχωρίστηκε");
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
/* ---------- Ταμείο: αυτούσιο το βιβλίο «Α.Ε.» των Ταμείων, με δικά του δεδομένα (φάκελος tameio/) ----------
   Οι Παραγγελίες δουλεύουν αυτόνομα. Οι πληρωμές των παραγγελιών αφήνονται σε «γραμματοκιβώτιο» και το Ταμείο τις παίρνει μόνο του.
   Συγχρονισμός με την εφαρμογή «Ταμεία» μόνο αν ο χρήστης έχει το πακέτο GlenApps Full ή κλειδί Ταμείων, και αφού το εγκρίνει. */
const EM_KEY = "paraggelies-tameio-v1", EMQ = "paraggelies-tameio-inbox";
const TM_KEY = "tameia-v1", TM_INBOX = "glen-tameia-inbox";
const PAYMAP = { "Μετρητά": "cash", "Κάρτα": "card", "Ηλεκτρονικά": "bank", "Τράπεζα": "bank" };
/* τρόποι πληρωμής: [όνομα, εικονίδιο, εξήγηση] */
const PAYS = [["Μετρητά", "💵", "στο χέρι"], ["Κάρτα", "💳", "πιστωτική ή χρεωστική, με τερματικό"], ["Ηλεκτρονικά", "📲", "IRIS, σύνδεσμος πληρωμής, ηλεκτρονικό πορτοφόλι"], ["Τράπεζα", "🏦", "κατάθεση ή μεταφορά σε λογαριασμό"]];
const payIc = v => (PAYS.find(x => x[0] === v) || [, ""])[1];
function paySheet(o, fromList) {
  const last = S.ui.payVia || "";
  sheet("€ Πληρώθηκε " + K.money(o.total), `<p class="note" style="margin-top:0">#${o.no} · ${esc(o.cust.name)}. Πώς πλήρωσε;</p>
   <div class="bigopts">${PAYS.map(([v, ic, d]) => `<button type="button" class="bigopt${v === last ? " on" : ""}" data-payvia="${v}"><span class="e">${ic}</span><span class="t"><b>${v}</b><small>${d}</small></span><span class="g">›</span></button>`).join("")}</div>
   <p class="note">Ο τρόπος πληρωμής γράφεται στην παραγγελία και περνά στο Ταμείο (μετρητά, κάρτα ή τράπεζα).</p>`,
   `<button type="button" class="btn soft" data-act="payBack">← Πίσω</button>`, el => { el.dataset.ord = o.id; if (fromList) { el.dataset.pfrom = "list"; el.dataset.fsig = JSON.stringify(ordFilter); } });
}
const SALES_KIND = { id: "ae73", emoji: "💶", name: "Πωλήσεις και υπηρεσίες", dir: "in", subs: ["Παροχή υπηρεσιών", "Πωλήσεις εμπορευμάτων", "Πωλήσεις προϊόντων"] };
/* παλιές χειροκίνητες κινήσεις (έως 1.36) → κατηγορίες του βιβλίου Α.Ε. */
const CK2AE = { sales: ["ae73", ""], cinother: ["ae75", ""], buy: ["ae20", ""], tax: ["ae63", ""], efka: ["ae60", "Εισφορές ΕΦΚΑ"], acct: ["ae61", "Λογιστής"], staff: ["ae60", ""], office: ["ae62", ""], repair: ["aerep", ""], vehicle: ["ae64", "Καύσιμα"], equip: ["ae14", ""], soft: ["ae64", "Συνδρομές"], ads: ["ae64", "Διαφήμιση"], bank: ["ae65", ""], insur: ["ae62", "Ασφάλιστρα"], cother: ["aeoth", ""] };
function orderVats(o, amt) {
  const by = {}; let tot = 0; for (const l of o.lines) { const r = +l.vat || 0; by[r] = (by[r] || 0) + (+l.sum || 0); tot += +l.sum || 0; }
  if (!tot) return null; const f = amt / tot, incl = S.shop.vatIncl !== false;
  return Object.entries(by).map(([r, g]) => { g = g * f; r = +r; const net = incl ? g / (1 + r / 100) : g; return { r, net: K.round2(net), vat: K.round2(incl ? g - net : g * r / 100) }; });
}
function emDesired() {
  const W = new Map();
  for (const o of S.orders) if (o.paid && !o.test && o.st !== "cancel" && o.st !== "dup" && paidOf(o) > 0) {
    const P = o.pays && o.pays.length ? o.pays : [{ at: o.paidAt || o.rx, amt: K.round2(paidOf(o)), via: o.payVia || "" }];
    P.forEach((py, i) => {
      if (!py.amt) return;
      const back = py.amt < 0, amt = K.round2(Math.abs(py.amt)), v = orderVats(o, amt) || [];
      const e = back ? { dir: "out", kind: "aeoth", sub: "Επιστροφή σε πελάτη", amount: amt, date: new Date(py.at).toISOString(), note: "Παραγγελία #" + o.no, cp: o.cust.name || "", pay: PAYMAP[py.via] || "cash" }
        : { dir: "in", kind: "ae73", sub: "Πωλήσεις εμπορευμάτων", amount: amt, date: new Date(py.at).toISOString(), note: "Παραγγελία #" + o.no + (P.length > 1 ? " · " + (i + 1) + "η είσπραξη" : ""), cp: (o.inv && o.inv.t === "i" && o.inv.n) || o.cust.name || "", pay: PAYMAP[py.via] || "cash", doc: o.inv && o.inv.t === "i" ? "inv" : "rcpt" };
      if (!back && o.inv && o.inv.t === "i" && o.inv.f) e.afm = o.inv.f;
      if (!back) { if (v.length === 1) e.vat = v[0].r; else if (v.length > 1) e.vats = v; }
      W.set("pg-o" + pgId(o.id) + (P.length > 1 || (o.pays && o.pays.length > 1) ? "-" + i : ""), e);
    });
  }
  return W;
}
function qPush(key, ops) {
  if (!ops.length || DEMO) return true;
  try { let q = JSON.parse(localStorage.getItem(key) || "[]"); if (!Array.isArray(q)) q = []; q.push(...ops); localStorage.setItem(key, JSON.stringify(q)); return true; } catch { return false; }
}
let tmT = null, tmBusy = false;
function tmSoon() { if (tmBusy) return; clearTimeout(tmT); tmT = setTimeout(tmSync, 300); }
/* αναγνωριστικό για Ταμείο/Ημερολόγιο: μόνο γράμματα, ψηφία, _ και - (οι κωδικοί παραγγελιών μπορεί να έχουν τελεία, που εκείνα απορρίπτουν) */
const pgId = x => String(x).replace(/[^\w-]/g, "_");
function tmSync() {
  /* μία φορά: όσες κινήσεις είχαν σταλεί με τελεία στο αναγνωριστικό δεν μπήκαν ποτέ — ξαναστέλνονται σωστά */
  if (S && !S.pgFix) { for (const m of [S.emSent, S.tmSent, S.imSent]) if (m) for (const k of Object.keys(m)) if (/[^\w-]/.test(k)) delete m[k]; S.pgFix = Date.now(); }
  if (!S || DEMO) return;
  let changed = false;
  /* 1. πληρωμές παραγγελιών → Ταμείο των Παραγγελιών */
  const sent = S.emSent || (S.emSent = {}), W = emDesired(), ops = [];
  for (const [id, e] of W) { const h = JSON.stringify(e); if (sent[id] !== h) ops.push({ op: "put", id, e, k: SALES_KIND, at: Date.now() }); }
  for (const id of Object.keys(sent)) if (!W.has(id)) ops.push({ op: "del", id, at: Date.now() });
  if (ops.length && qPush(EMQ, ops)) { for (const op of ops) if (op.op === "put") sent[op.id] = JSON.stringify(op.e); else delete sent[op.id]; changed = true; }
  if (ops.length) try { tmFrameEl && tmFrameEl.contentWindow && tmFrameEl.contentWindow.emPoke && setTimeout(() => tmFrameEl.contentWindow.emPoke(), 50); } catch {}
  /* 2. μία φορά: οι παλιές χειροκίνητες κινήσεις, και όσες είχαν πάει στα Ταμεία με την 1.37 */
  if (!S.emMig) {
    const mig = [];
    for (const c of cashList()) { const m = CK2AE[c.ck] || [c.kind === "in" ? "ae75" : "aeoth", ""]; mig.push({ op: "put", id: "pg-c" + pgId(c.id), e: { dir: c.kind === "in" ? "in" : "out", kind: m[0], sub: c.sub || m[1], amount: K.round2(+c.amt || 0), date: new Date(c.d + "T12:00:00").toISOString(), note: c.note || "", vat: c.vat } }); }
    try { const T0 = JSON.parse(localStorage.getItem(TM_KEY) || "null"); for (const e of (T0 && T0.company && T0.company.ent) || []) if (e && /^pg-c/.test(e.id || "")) { const m = CK2AE[e.kind] || [e.dir === "in" ? "ae75" : "aeoth", ""]; mig.push({ op: "put", id: e.id, e: { dir: e.dir, kind: m[0], sub: e.sub || m[1], amount: e.amount, date: e.date, note: e.note || "", vat: e.vat } }); } } catch {}
    if (qPush(EMQ, mig)) { S.emMig = Date.now(); S.cash = []; changed = true; }
  }
  /* 3. προαιρετικά: αντίγραφο των κινήσεων στο βιβλίο «Εταιρεία» της εφαρμογής Ταμεία */
  if (mainSync()) changed = true;
  /* 4. προαιρετικά: οι παραδόσεις στο Ημερολόγιο */
  if (imSync()) changed = true;
  if (changed) { tmBusy = true; try { save(); } finally { tmBusy = false; } }
}
/* οι κινήσεις του Ταμείου των Παραγγελιών (με όσες περιμένουν ακόμα στο γραμματοκιβώτιο) */
function emEntries() {
  let T = null; try { T = JSON.parse(localStorage.getItem(EM_KEY) || "null"); } catch {}
  const M = new Map(); let kinds = null;
  const xb = T && T.xbooks ? Object.values(T.xbooks).find(b => b && b.tpl === "ae") : null;
  if (xb) { for (const e of xb.ent || []) if (e && e.id) M.set(e.id, e); kinds = xb.kinds || null; }
  try { const q = JSON.parse(localStorage.getItem(EMQ) || "[]"); if (Array.isArray(q)) for (const op of q) { if (!op || !op.id) continue; if (op.op === "del") M.delete(op.id); else if (op.e) M.set(op.id, Object.assign({ id: op.id }, op.e)); } } catch {}
  return { M, kinds };
}
/* ---------- πακέτο GlenApps Full ή κλειδί Ταμείων ---------- */
let packSt = null;
async function packCheck() {
  const r = { full: false, tameia: false };
  try { const s = JSON.parse(localStorage.getItem("glenapps-kleidi") || "null"); if (s && s.kleidi && s.email) r.full = !!(await keyOk(s.kleidi, "GA2", "GA|" + await sha256hex(emailNorm(s.email)))); } catch {}
  try { const T0 = JSON.parse(localStorage.getItem(TM_KEY) || "null"), L = T0 && T0.settings && T0.settings.lic; if (L && L.key) { const eh = L.eh || (L.email ? await sha256hex(emailNorm(L.email)) : L.name ? await sha256hex(emailNorm(L.name)) : ""); if (eh) r.tameia = !!(await keyOk(L.key, "TM2", "T|" + eh)); } } catch {}
  packSt = r; return r;
}
async function keyOk(key, pre, msg) {
  const e = String(key || "").toUpperCase().replace(/[\s\-–—_.]+/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  const m = new RegExp("^" + pre + "(\\d{6})([0-9A-Z]{100,110})$").exec(e); if (!m) return "";
  const until = "20" + m[1].slice(0, 2) + "-" + m[1].slice(2, 4) + "-" + m[1].slice(4, 6); if (until < today()) return "";
  const sig = b32dec(m[2]); if (!sig || sig.length < 64) return "";
  try { const k = await crypto.subtle.importKey("jwk", LIC_PUB, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]); return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, k, sig.slice(0, 64), new TextEncoder().encode(msg + "|" + until)) ? until : ""; } catch { return ""; }
}
const packOk = () => !!(packSt && (packSt.full || packSt.tameia));
if (location.hostname === "localhost") { A.__packTest = v => { packSt = v; }; A.__applyPend = o => applyPend(o); }  /* μόνο για τις δοκιμές στον υπολογιστή */
/* συγχρονισμός με τα Ταμεία: μόνο με πακέτο και έγκριση· αλλιώς ό,τι είχε σταλεί παλιότερα αποσύρεται */
function mainSync() {
  const sent = S.tmSent || (S.tmSent = {}), on = packOk() && S.ui.tmSync === true, ops = [];
  const W = new Map();
  if (on) { const { M, kinds } = emEntries(); for (const e of M.values()) { const id = /^pg-/.test(e.id) ? e.id : "pg-t" + String(e.id).replace(/[^\w-]/g, "").slice(0, 30); const kd = (kinds || []).find(k => k.id === e.kind); W.set(id, { e: { dir: e.dir, kind: e.kind, sub: e.sub || "", amount: e.amount, date: e.date, note: [e.note, e.cp].filter(Boolean).join(" · "), vat: e.vat }, k: kd ? { id: kd.id, emoji: kd.emoji, name: kd.name, dir: kd.dir, subs: kd.subs || [] } : null }); } }
  for (const [id, x] of W) { const h = JSON.stringify(x.e); if (sent[id] !== h) ops.push({ op: "put", book: "company", id, e: x.e, k: x.k, at: Date.now() }); }
  if (on || packSt) for (const id of Object.keys(sent)) if (!W.has(id)) ops.push({ op: "del", book: "company", id, at: Date.now() });
  if (!ops.length || !qPush(TM_INBOX, ops)) return false;
  for (const op of ops) if (op.op === "put") sent[op.id] = JSON.stringify(op.e); else delete sent[op.id];
  return true;
}
/* παραδόσεις → Ημερολόγιο (μόνο με το πακέτο GlenApps Full και έγκριση) */
const IMQ = "glen-imerologio-inbox";
function slotTimes(slot) { const m = /(\d{1,2})[:.](\d{2})(?:\s*[-–]\s*(\d{1,2})[:.](\d{2}))?/.exec(slot || ""); if (!m) return {}; const p2 = x => String(x).padStart(2, "0"); return { s: p2(m[1]) + ":" + m[2], e: m[3] ? p2(m[3]) + ":" + m[4] : "" }; }
function imSync() {
  const sent = S.imSent || (S.imSent = {}), on = !!(packSt && packSt.full) && S.ui.imSync === true, W = new Map(), ops = [];
  if (on) for (const o of S.orders) if (!o.test && o.when.how !== "pick" && o.when.date && (o.st === "new" || o.st === "prep" || o.st === "done")) {
    const c = S.customers[custKey(o.cust.phone)] || {}, t = slotTimes(o.when.slot);
    W.set("pg-o" + pgId(o.id), { date: o.when.date, s: t.s || "", e: t.e || "", name: o.cust.name, phone: o.cust.phone, addr: o.cust.addr || c.addr || "", note: "🚚 Παράδοση #" + o.no + " · " + o.lines.map(l => K.num(l.q) + " " + l.unit + " " + l.name).join(", ") + (o.cust.addr || c.addr ? " · 📍 " + (o.cust.addr || c.addr) : "") + (o.paid ? " · πληρωμένη" : " · να εισπραχθούν " + K.money(o.total)) });
  }
  for (const [id, e] of W) { const h = JSON.stringify(e); if (sent[id] !== h) ops.push({ op: "put", id, e, at: Date.now() }); }
  if (on || packSt) for (const id of Object.keys(sent)) if (!W.has(id)) ops.push({ op: "del", id, at: Date.now() });
  if (!ops.length || !qPush(IMQ, ops)) return false;
  for (const op of ops) if (op.op === "put") sent[op.id] = JSON.stringify(op.e); else delete sent[op.id];
  return true;
}
function linkSheet2() {
  if (!packOk()) { toast("Χρειάζεται το πακέτο GlenApps Full ή κλειδί Ταμείων.", 3500); return; }
  sheet("🔗 Σύνδεση με άλλες εφαρμογές", `<p class="note" style="margin-top:0">Οι Παραγγελίες δουλεύουν πάντα αυτόνομα. Εδώ διαλέγεις αν θέλεις να βλέπεις κάποια στοιχεία και στις άλλες σου εφαρμογές GlenApps, μέσα στο ίδιο κινητό.</p>
   <div class="card"><label class="ck"><input type="checkbox" id="lkTm"${S.ui.tmSync ? " checked" : ""}><span><b>💶 Ταμεία</b><br><small class="note">Τα έσοδα και τα έξοδα του Ταμείου των Παραγγελιών φαίνονται και στο βιβλίο «Εταιρεία» των Ταμείων.</small></span></label></div>
   <div class="card"${packSt.full ? "" : ' style="opacity:.55"'}><label class="ck"><input type="checkbox" id="lkIm"${S.ui.imSync ? " checked" : ""}${packSt.full ? "" : " disabled"}><span><b>📅 Ημερολόγιο</b><br><small class="note">Οι παραδόσεις φαίνονται στο Ημερολόγιο: ποιος, πού, πότε. Όσες δεν έχουν ώρα μπαίνουν στην πρώτη ελεύθερη μισή ώρα μέσα στο ωράριο της επιχείρησής σου.${packSt.full ? "" : " Χρειάζεται το πακέτο GlenApps Full."}</small></span></label></div>
   <p class="note">Αν κλείσεις κάποιο, ό,τι είχε περάσει εκεί από τις Παραγγελίες αποσύρεται.</p>`,
   `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-act="lkSave">Αποθήκευση</button>`);
}
/* μία φορά, όταν βρεθεί πακέτο: ερώτηση */
async function packAsk() {
  await packCheck();
  if (!packOk() || S.ui.asked || DEMO) { tmSoon(); return; }
  S.ui.asked = Date.now(); save();
  toast("Έχεις " + (packSt.full ? "το πακέτο GlenApps Full" : "και την εφαρμογή Ταμεία") + ". Διάλεξε αν θέλεις σύνδεση.", 4000);
  linkSheet2();
}
/* ---------- εμφάνιση: χρώματα, φόντο, διαφάνεια (1.60 — όπως στο Ημερολόγιο, πιο πλούσιο) ---------- */
const THEMES = {
  classic: { name: "Κλασικό", brand: "#17324D", accent: "#F2B632", paper: "#EEF2F4", ink: "#16232f" },
  honey: { name: "Μέλι", brand: "#A85A07", accent: "#FACC15", paper: "#FFF8E5", ink: "#3A2306" },
  rose: { name: "Τριαντάφυλλο", brand: "#BE185D", accent: "#F9A8D4", paper: "#FFF1F6", ink: "#4A0D28" },
  cherry: { name: "Κεράσι", brand: "#B91C1C", accent: "#FBBF24", paper: "#FEF3F2", ink: "#3F0D0D" },
  sky: { name: "Ουρανός", brand: "#1D4ED8", accent: "#38BDF8", paper: "#EFF6FF", ink: "#0F1E46" },
  lavender: { name: "Λεβάντα", brand: "#6D28D9", accent: "#F0ABFC", paper: "#F6F3FF", ink: "#2A1052" },
  mint: { name: "Μέντα", brand: "#0F766E", accent: "#5EEAD4", paper: "#EDFBF7", ink: "#083B37" },
  orange: { name: "Πορτοκάλι", brand: "#C2410C", accent: "#FDBA74", paper: "#FFF6EE", ink: "#431A06" },
  forest: { name: "Δάσος", brand: "#1E4D3A", accent: "#E9B949", paper: "#EDF3EF", ink: "#16372A" },
  sea: { name: "Θάλασσα", brand: "#0B4F6C", accent: "#4FD1C5", paper: "#EAF3F6", ink: "#0C3446" },
  sunset: { name: "Δειλινό", brand: "#5A2A3C", accent: "#F29E4C", paper: "#F6EFEC", ink: "#3B1E28" },
  earth: { name: "Χώμα", brand: "#4A3726", accent: "#D9A441", paper: "#F3EFE8", ink: "#33261A" },
  graphite: { name: "Γραφίτης", brand: "#1F2937", accent: "#F59E0B", paper: "#F2F3F5", ink: "#111827" }
};
const BGS = { wc: ["🎨", "Υδατογραφία"], pat: ["🌿", "Μοτίβο"], icon: ["🧺", "Το σήμα"], photo: ["📷", "Φωτογραφία"], none: ["▫️", "Απλό"] };
const LOOK0 = { theme: "classic", bg: "wc", op: 0.55, br: 1, glass: 0, custom: "", own: null };
const lookOf = () => { const L = Object.assign({}, LOOK0, S && S.ui.look || {}); if (L.bg === "art") L.bg = L.custom ? "photo" : "icon"; if (L.bg === "photo" && !L.custom) L.bg = "wc"; return L; };
const lumOf = hex => { const n = parseInt(String(hex).replace("#", ""), 16); if (isNaN(n)) return .5; const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }; return .2126 * f(n >> 16 & 255) + .7152 * f(n >> 8 & 255) + .0722 * f(n & 255); };
const hexMix = (a, b, t) => { const p = h => { const n = parseInt(String(h).replace("#", ""), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }, x = p(a), y = p(b); return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
/* δικό σου χρώμα: αν είναι πολύ ανοιχτό, σκουραίνει όσο χρειάζεται για να διαβάζονται τα γράμματα */
function ownTheme(o) {
  let b = /^#[0-9a-f]{6}$/i.test(o && o.brand || "") ? o.brand : "#17324D"; const a = /^#[0-9a-f]{6}$/i.test(o && o.accent || "") ? o.accent : "#F2B632";
  for (let i = 0; i < 12 && lumOf(b) > .2; i++) b = hexMix(b, "#000000", .15);
  return { name: "Δικό μου", brand: b, accent: a, paper: hexMix(b, "#ffffff", .93), ink: hexMix(b, "#000000", .55) };
}
const themeOf = L => L.theme === "own" ? ownTheme(L.own) : (THEMES[L.theme] || THEMES.classic);
function patSvg(c, a) {
  const e = encodeURIComponent(c), f = encodeURIComponent(a);
  return `url("data:image/svg+xml,${`%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cg fill='none' stroke='${e}' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cellipse cx='30' cy='34' rx='11' ry='14'/%3E%3Cpath d='M104 22c14 0 24 10 24 24-14 0-24-10-24-24zM104 22l24 24'/%3E%3Cpath d='M40 112h34l-4 22H44zM44 112c0-9 26-9 26 0'/%3E%3Cpath d='M120 112c-8-8-2-18 6-12 8-6 14 4 6 12l-6 6z'/%3E%3C/g%3E%3Cg fill='${f}'%3E%3Ccircle cx='80' cy='70' r='3.5'/%3E%3Ccircle cx='146' cy='84' r='2.5'/%3E%3Ccircle cx='12' cy='86' r='2.5'/%3E%3Ccircle cx='88' cy='150' r='2.5'/%3E%3C/g%3E%3C/svg%3E`}")`;
}
function applyLook() {
  if (!S) return; const L = lookOf(), T = themeOf(L), R = document.documentElement.style, H = document.documentElement;
  R.setProperty("--brand", T.brand); R.setProperty("--accent", T.accent); R.setProperty("--paper", T.paper); R.setProperty("--ink", T.ink);
  R.setProperty("--onbrand", lumOf(T.brand) > .45 ? "#10202E" : "#fff"); R.setProperty("--onaccent", lumOf(T.accent) > .35 ? "#10202E" : "#fff");
  R.setProperty("--cardbg", `rgba(255,255,255,${(1 - Math.min(.45, Math.max(0, +L.glass || 0))).toFixed(2)})`); if (L.glass > .02) H.dataset.glass = "1"; else delete H.dataset.glass;
  R.setProperty("--bgop", String(Math.min(1, Math.max(0, +L.op)))); R.setProperty("--bgbr", String(L.br || 1));
  const m = $('meta[name="theme-color"]'); if (m) m.content = T.brand;
  let bg = $("#skinbg"); if (!bg) { document.body.insertAdjacentHTML("afterbegin", `<div id="skinbg" aria-hidden="true"><div class="ski"></div><i class="wc wc1"></i><i class="wc wc2"></i><i class="wc wc3"></i><i class="wc wc4"></i></div>`); bg = $("#skinbg"); }
  H.dataset.bg = L.bg;
  const img = L.bg === "photo" ? `url("${L.custom}")` : L.bg === "icon" ? `url("eikonidia/icon-512.png")` : L.bg === "pat" ? patSvg(T.brand, T.accent) : "none";
  document.querySelectorAll(".ski").forEach(x => { x.style.backgroundImage = img; });
  document.body.classList.remove("hasbg");
}
A.applyLook = applyLook;
/* ματιά: δείχνει πάντα τις Παραγγελίες (την πιο γεμάτη σελίδα) και μετά γυρνά εκεί που ήσουν */
const PEEK = { t0: 0, tm: null, prev: null, y: 0,
  on() { clearTimeout(PEEK.tm); if (tab !== "orders" && PEEK.prev == null) { PEEK.prev = tab; PEEK.y = window.scrollY; tab = "orders"; render(); window.scrollTo(0, 0); } $("#sheetbg").classList.add("peek"); },
  off() { $("#sheetbg").classList.remove("peek"); if (PEEK.prev != null) { tab = PEEK.prev; PEEK.prev = null; render(); window.scrollTo(0, PEEK.y); } },
  up() { if (!PEEK.t0) return; const held = Date.now() - PEEK.t0; PEEK.t0 = 0; if (held < 350) PEEK.tm = setTimeout(PEEK.off, 2000); else PEEK.off(); } };
window.addEventListener("pointerup", PEEK.up);
document.addEventListener("change", e => { if (e.target && e.target.id === "anOff") { S.ui.noAsk = e.target.checked; save(); if (e.target.checked) toast("Δεν θα ξαναβγαίνει. Αν το θέλεις πάλι: ⚙️ Ρυθμίσεις › 💬 Πρόταση ενημέρωσης πελάτη.", 5000); } }); window.addEventListener("pointercancel", PEEK.up);
const lookLabel = () => { const L = lookOf(); return themeOf(L).name + " · " + BGS[L.bg][1].toLowerCase(); };
function lookSheet() {
  const L = lookOf(), pc = v => Math.round(v * 100) + "%", own = ownTheme(L.own);
  const sw = (k, t) => `<button type="button" class="theme${L.theme === k ? " on" : ""}" data-theme="${k}" style="--tb:${t.brand};--ta:${t.accent};--tp:${t.paper}"><span class="thh"></span><span class="thb"><i></i><i></i></span><em>${t.name}</em>${L.theme === k ? `<span class="thok">✓</span>` : ""}</button>`;
  const pv = `<div class="lkstick"><div class="lkpv" aria-hidden="true"><div class="pvbg"><div class="ski"></div><i class="wc wc1"></i><i class="wc wc2"></i><i class="wc wc3"></i></div>
     <div class="pvtop"><img src="eikonidia/icon-192.png" alt=""><b>Παραγγελίες</b><span>⚙️</span></div>
     <div class="pvin"><div class="pvhero"><small>Καλημέρα 👋</small><b>${esc(S.shop.name || "Το κατάστημά σου")}</b><span class="pvst"><i><b>3</b>νέες</i><i><b>5</b>για σήμερα</i></span></div>
      <div class="pvrow"><span class="btn amber sm">＋ Παραγγελία</span><span class="btn green sm">🚐 Δρομολόγιο</span></div>
      <div class="pvrow"><span class="chip on">Νέες 3</span><span class="chip">Ετοιμάζονται</span></div>
      <div class="ord st-new pvord"><b>Μαρία Νικολάου</b><span class="tot">12,50 €</span></div></div>
     <div class="pvtabs"><span>🗺</span><span class="on">🧾</span><span>🛒</span><span>👥</span><span>💶</span></div></div>
    <button type="button" class="btn soft sm wide lkpeek" id="lkPeek">👁 Κράτα πατημένο για να δεις όλη την εφαρμογή</button></div>`;
  sheet("🎨 Εμφάνιση", pv + `<div class="card"><h3>Χρώματα</h3><div class="themes">${Object.entries(THEMES).map(([k, t]) => sw(k, t)).join("")}</div>
     <div class="ownrow"><span><b>Δικό μου χρώμα</b><small>Διάλεξε κύριο και δεύτερο χρώμα</small></span><label class="cpick" style="--c:${own.brand}"><input type="color" id="lkOwnB" value="${own.brand}" aria-label="Κύριο χρώμα"></label><label class="cpick" style="--c:${own.accent}"><input type="color" id="lkOwnA" value="${own.accent}" aria-label="Δεύτερο χρώμα"></label></div></div>
    <div class="card"><h3>Φόντο</h3><div class="bgopts">${Object.entries(BGS).map(([k, [e, n]]) => `<button type="button" class="bgo bg-${k}${L.bg === k ? " on" : ""}" data-lkbg="${k}"><span class="bgp"${k === "photo" && L.custom ? ` style="background-image:url('${L.custom}')"` : ""}>${k === "photo" && L.custom ? "" : e}</span><em>${n}</em></button>`).join("")}</div>
     <input type="file" id="lkFile" accept="image/*" hidden>
     <div class="sld"><label for="lkOp">Ένταση φόντου <b id="lkOpV">${pc(L.op)}</b></label><input type="range" id="lkOp" min="0" max="1" step="0.05" value="${L.op}"></div>
     <div class="sld"><label for="lkBr">Φωτεινότητα <b id="lkBrV">${pc(L.br)}</b></label><input type="range" id="lkBr" min="0.4" max="1.6" step="0.05" value="${L.br}"></div>
     <div class="sld"><label for="lkGl">Διαφάνεια καρτών <b id="lkGlV">${pc(L.glass)}</b></label><input type="range" id="lkGl" min="0" max="0.45" step="0.03" value="${L.glass}"></div>
     <div class="row" style="margin-top:8px"><button type="button" class="btn soft sm grow" data-act="lkPhoto">📷 ${L.custom ? "Άλλη φωτογραφία" : "Δική μου φωτογραφία"}</button><button type="button" class="btn ghost sm" data-act="lkReset">↩ Αρχικά</button></div>
     <p class="note" style="margin:8px 0 0">Βάλε μόνο φωτογραφία που σου ανήκει ή έχεις δικαίωμα να χρησιμοποιείς. Μένει μόνο στο κινητό σου.</p></div>`, "",
    el => {
      const set = (k, v) => { S.ui.look = Object.assign(lookOf(), { [k]: v }); applyLook(); save(); };
      const sl = (id, k, f) => el.querySelector(id).addEventListener("input", e => { set(k, +e.target.value); el.querySelector(id + "V").textContent = pc(+e.target.value); });
      applyLook();
      sl("#lkOp", "op"); sl("#lkBr", "br"); sl("#lkGl", "glass");
      /* ματιά σε όλη την εφαρμογή: κρατάς πατημένο (ή ένα πάτημα = 2 δευτερόλεπτα) */
      { const pk = el.querySelector("#lkPeek");
        pk.addEventListener("pointerdown", e => { e.preventDefault(); PEEK.t0 = Date.now(); PEEK.on(); });
        pk.addEventListener("contextmenu", e => e.preventDefault());
        pk.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); PEEK.on(); PEEK.tm = setTimeout(PEEK.off, 2000); } }); }
      const ownSet = (k, v) => { const o = Object.assign({}, lookOf().own || { brand: own.brand, accent: own.accent }, { [k]: v }); S.ui.look = Object.assign(lookOf(), { own: o, theme: "own" }); applyLook(); save(); el.querySelectorAll(".theme.on").forEach(x => { x.classList.remove("on"); const k2 = x.querySelector(".thok"); if (k2) k2.remove(); }); };
      el.querySelector("#lkOwnB").addEventListener("input", e => { ownSet("brand", e.target.value); e.target.parentNode.style.setProperty("--c", e.target.value); });
      el.querySelector("#lkOwnA").addEventListener("input", e => { ownSet("accent", e.target.value); e.target.parentNode.style.setProperty("--c", e.target.value); });
      el.querySelector("#lkFile").addEventListener("change", async e => { const f = e.target.files[0]; if (!f) return; try { const d = await K.shrinkImage(f, 1080, 0.72); S.ui.look = Object.assign(lookOf(), { custom: d, bg: "photo", op: Math.max(.35, lookOf().op) }); save(); applyLook(); toast("✓ Η φωτογραφία μπήκε ως φόντο"); lookSheet(); } catch { toast("Η φωτογραφία δεν άνοιξε."); } });
    });
}
/* ---------- η καρτέλα «Ταμείο» ---------- */
/* «Σου χρωστάνε» μέσα στο Ταμείο: το ζητάει το ίδιο το Ταμείο */
A.owedInfo = () => { const D = debtors(); return { sum: K.round2(D.reduce((a, x) => a + x.v, 0)), n: D.length }; };
A.owedOpen = () => collectList();
let tmFrameEl = null;
function tmWrap() {
  let w = $("#tmWrap"); if (w) return w;
  w = document.createElement("div"); w.id = "tmWrap"; w.className = "tmwrap"; w.hidden = true;
  w.innerHTML = `<div class="tmstrip" id="tmStrip"></div><div class="tmfw" id="tmFw"></div>`;
  document.body.appendChild(w); return w;
}
function tmShow(on) {
  const w = tmWrap();
  if (!on) { if (!w.hidden) { try { tmFrameEl && tmFrameEl.contentWindow.emRelock && tmFrameEl.contentWindow.emRelock(); } catch {} } w.hidden = true; document.body.classList.remove("tmon"); return; }
  if (!tmFrameEl) { tmFrameEl = document.createElement("iframe"); tmFrameEl.id = "tmFrame"; tmFrameEl.title = "Ταμείο"; tmFrameEl.src = "tameio/index.html?v=" + encodeURIComponent($('meta[name="app-version"]').content); $("#tmFw").appendChild(tmFrameEl); }
  $("#tmStrip").innerHTML = ""; if (0) `<button type="button" class="btn sm" data-act="owedSheet" style="background:${sum ? "#FBE7E3" : "#E3F1E8"};color:${sum ? "#C8412B" : "#2E7D5B"};border:1px solid ${sum ? "#F1B3AD" : "#A8D8B7"}">${sum ? "🔴 Σου χρωστάνε " + K.money(sum) : "✓ Κανείς δεν χρωστά"}</button>${sum ? `<button type="button" class="btn sm green" data-act="collectList">💶 Είσπραξη</button>` : ""}<button type="button" class="btn sm soft" data-act="prepSheet">📦 Ετοιμασία</button>`;
  w.hidden = false; document.body.classList.add("tmon"); tmPos();
  try { tmFrameEl.contentWindow.emDebtCard && tmFrameEl.contentWindow.emDebtCard(); } catch {}
  /* ό,τι πληρώθηκε μπαίνει αμέσως */
  tmSync();
}
function tmPos() {
  const w = $("#tmWrap"); if (!w || w.hidden) return;
  const h = $("header.top"), tb = $("#tabs"), nb = $("#newBar");
  let top = h ? h.getBoundingClientRect().bottom : 56;
  if (nb && nb.offsetParent !== null) top = Math.max(top, nb.getBoundingClientRect().bottom);
  w.style.top = top + "px"; w.style.bottom = (tb ? tb.getBoundingClientRect().height : 70) + "px";
}
window.addEventListener("resize", () => tmPos());
function totalsView() { return `<div class="tmspace"></div>`; }
function cashMoves() {
  const [f, t] = perRange(), { M, kinds } = emEntries(), mv = [];
  for (const e of M.values()) { const amt = +e.amount; if (!(amt > 0)) continue; const d = K.ymd(new Date(e.date)); if (d < f || d > t) continue; const k = (kinds || []).find(x => x.id === e.kind); const top = k ? (k.emoji ? k.emoji + " " : "") + k.name : "📦 Λοιπά"; mv.push({ id: e.id, d, kind: e.dir, amt: K.round2(amt), ck: e.kind, sub: e.sub || "", vat: e.vat, note: e.note || "", top, cat: top + (e.sub ? " › " + e.sub : ""), ord: /^pg-o/.test(e.id) ? e.id.slice(4) : null }); }
  return mv.sort((a, b) => b.d.localeCompare(a.d));
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
    <button type="button" class="bigopt" data-act="tmIn"><span class="e">➕</span><span class="t"><b>Άλλο έσοδο</b><small>Ανοίγει στο Ταμείο «Εταιρεία»: πώληση χωρίς παραγγελία, επιδότηση, τόκοι…</small></span><span class="g">›</span></button></div>`);
}
function collectList() {
  const D = debtors(), sum = K.round2(D.reduce((a, x) => a + x.v, 0));
  sheet("💶 Είσπραξη", D.length ? `<p class="note" style="margin-top:0">Πρώτα όσοι χρωστάνε τα περισσότερα. Πάτα έναν πελάτη για να σημειώσεις τι πλήρωσε.</p>
    <div class="card list">${D.map(x => `<div class="it" data-coll="${esc(x.c.key)}"><div class="ic">👤</div><div class="t"><b>${esc(x.c.name)}</b><span>${esc(x.c.phone || "")} · ${custUnpaid(x.c.key).length} ${custUnpaid(x.c.key).length === 1 ? "παραγγελία" : "παραγγελίες"}</span></div><b style="color:#C8412B;font-size:17px">${K.money(x.v)}</b></div>`).join("")}</div>
    <div class="row" style="padding:0 4px"><b class="grow">Σύνολο</b><b style="color:#C8412B;font-size:19px">${K.money(sum)}</b></div>` : `<div class="okbox">✓ Κανείς δεν σου χρωστά.</div>`, `<button type="button" class="btn soft" data-cash="in">← Πίσω</button>`);
}
function custUnpaid(k) { return S.orders.filter(o => custKey(o.cust.phone) === k && o.st !== "cancel" && o.st !== "dup" && ((o.st === "done" && !o.paid) || (o.paid && diffOf(o) > 0.004))).sort((a, b) => (a.when.date || "").localeCompare(b.when.date || "") || a.rx - b.rx); }
function collectCust(k, mode) {
  const c = S.customers[k]; if (!c) return;
  const L = custUnpaid(k), via = S.ui.payVia || "Μετρητά", rem = o => o.paid ? diffOf(o) : o.total, tot = K.round2(L.reduce((a, o) => a + rem(o), 0));
  mode = mode || "full";
  sheet("💶 " + c.name, `<div class="okbox" style="margin-top:0;background:#FBE7E3;border-color:#F1B3AD;color:#8a2a1c">Χρωστά <b style="font-size:18px">${K.money(tot)}</b> από ${L.length === 1 ? "1 παραγγελία" : L.length + " παραγγελίες"}</div>
    <div class="paysel"><button type="button" class="${mode === "full" ? "on" : ""}" data-colmode="full">✓ Ολική εξόφληση</button><button type="button" class="${mode === "part" ? "on" : ""}" data-colmode="part">½ Μερική</button></div>
    ${mode === "full" ? `<div class="card" style="margin-top:10px">${L.map(o => `<label class="ck" style="align-items:center"><input type="checkbox" data-colo="${o.id}" data-amt="${rem(o)}" checked><span style="flex:1"><b>#${o.no}</b> · ${esc(fmtWhen(o))}${o.partial ? " · υπόλοιπο" : o.paid ? " · διαφορά" : ""}</span><b>${K.money(rem(o))}</b></label>`).join("")}</div>`
    : `<div class="card" style="margin-top:10px"><label class="f" for="colAmt" style="margin-top:0">Πόσα έδωσε (€)</label><input class="t" id="colAmt" inputmode="decimal" placeholder="π.χ. 20" style="font-size:22px;font-weight:800"><p class="note" style="margin:6px 0 0">Εξοφλούνται πρώτα οι παλαιότερες παραγγελίες· ό,τι μείνει φαίνεται ως υπόλοιπο.</p></div>`}
    <div class="card"><h3>Πώς πλήρωσε</h3><div class="chips">${PAYS.map(([v, ic]) => `<button type="button" class="chip${v === via ? " on" : ""}" data-pv="${v}">${ic} ${v}</button>`).join("")}</div></div>`,
    `<button type="button" class="btn soft" data-act="collectList">← Πίσω</button><button type="button" class="btn green" data-act="collectGo" id="colBtn">${mode === "full" ? "✓ Εισπράχθηκαν " + K.money(tot) : "✓ Καταχώριση πληρωμής"}</button>`,
    el => { el.dataset.cust = k; el.dataset.mode = mode; const i = el.querySelector("#colAmt"); if (i) setTimeout(() => i.focus(), 80); });
}
function collectSum() { let t = 0; $$("[data-colo]").forEach(i => { if (i.checked) t += +i.dataset.amt || 0; }); const b = $("#colBtn"); if (b) b.textContent = "✓ Εισπράχθηκαν " + K.money(K.round2(t)); }

/* ---------- ανάλυση εσόδων και εξόδων, με PDF και Excel για τον λογιστή ---------- */
function anaData(kind) {
  const mv = cashMoves().filter(x => kind === "all" || x.kind === kind);
  const groups = {};
  for (const x of mv) {
    const k = x.ord ? "sales|Παραγγελίες" : (x.ck || "other") + "|" + (x.sub || "");
    const top = x.ord ? "💶 Πωλήσεις από παραγγελίες" : (x.top || (ckOf(x.ck) ? ckOf(x.ck).emoji + " " + ckOf(x.ck).name : x.cat || "Άλλο"));
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
  const sum = K.round2(L.reduce((a, o) => a + o.total, 0)), paid = K.round2(L.filter(o => o.paid).reduce((a, o) => a + Math.min(o.total, paidOf(o)), 0));
  const per = {};
  L.forEach(o => o.lines.forEach(l => { const pk = l.pid + "|" + K.lnOpt(l), x = per[pk] || (per[pk] = { name: K.lnName(l), unit: l.unit, q: 0, sum: 0, n: 0 }); x.q += l.q; x.sum = K.round2(x.sum + l.sum); x.n++; }));
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
/* 📞 κλήση · 💬 μήνυμα · 📍 στον χάρτη, δίπλα σε κάθε πελάτη */
const custActs = c => `<span class="cact">${c.phone ? `${c.phones && c.phones.length ? `<button type="button" data-ccall="${esc(c.key)}" aria-label="Κλήση">📞</button>` : `<a href="tel:${esc(c.phone)}" data-noprop="1" aria-label="Κλήση">📞</a>`}<button type="button" data-cmsg="${esc(c.key)}" aria-label="Μήνυμα">💬</button>` : ""}<button type="button" data-cpin="${esc(c.key)}" aria-label="Στον χάρτη">📍</button></span>`;
/* πού είναι ο πελάτης στον χάρτη: pin (σημείο που κράτησες) · ok · approx (μόνο η περιοχή) · miss (δεν βρέθηκε) · noad (χωρίς διεύθυνση) · "" (δεν έχει ψαχτεί ακόμα) */
function custGeoState(c) {
  if (c.pin && c.pin.lat != null) return "pin";
  if (!(c.addr || "").trim()) return "noad";
  const g = geoMem()[K.norm(String(c.addr || "").trim() + "|" + String(c.area || "").trim())];
  return !g ? "" : g.lat != null ? (g.amb && g.amb.length > 1 ? "amb" : g.off ? "off" : g.approx ? "approx" : "ok") : g.miss ? "miss" : "";
}
const GEO_VIA = { osm: "OpenStreetMap", photon: "Photon", here: "HERE", tomtom: "TomTom" };
function custGeoSrc(c) {
  const p = custPin(c.key), g = geoMem()[geoKey(c.addr, c.area)], loc = p || (g && g.lat != null ? g : null); if (!loc) return "";
  const from = p ? "δική σου θέση" : (GEO_VIA[g.via] || "OpenStreetMap") + (g.approx ? " · μόνο περιοχή" : "") + (g.lbl ? " · «" + esc(g.lbl) + "»" : "");
  return `<div class="geosrc">🔬 Από: ${from} · <a href="https://www.google.com/maps/search/?api=1&query=${loc.lat.toFixed(6)},${loc.lng.toFixed(6)}" target="_blank" rel="noopener">δες τη θέση στο Google Maps</a></div>`;
}
function custGeoLine(c) {
  return custGeoLine0(c) + custGeoSrc(c);
}
function custGeoLine0(c) {
  const g = custGeoState(c);
  return g === "pin" ? `<span class="ok">✓ Ακριβής θέση κρατημένη (από «Είμαι εδώ» ή σύροντας την πινέζα).</span>`
    : g === "ok" ? `<span class="ok">✓ Η διεύθυνση βρέθηκε στον χάρτη.</span>`
    : g === "amb" ? `<span class="bad">❓ Υπάρχουν ίδιες διευθύνσεις σε πολλές περιοχές. <a href="#" data-ambfor="${esc(c.key)}">Διάλεξε ποια ›</a></span>`
    : g === "off" ? `<span class="bad">⚠️ Βρέθηκε σε άλλη περιοχή («${esc((geoMem()[geoKey(c.addr, c.area)] || {}).off || "")}»), όχι «${esc(c.area || "")}». Έλεγξε τη διεύθυνση ή βάλ' τη στον χάρτη.</span>`
    : g === "approx" ? `<span class="mid">≈ Βρέθηκε μόνο η περιοχή, όχι ο δρόμος.</span>`
    : g === "miss" ? `<span class="bad">⚠️ Δεν βρέθηκε. Γράψε ολόκληρο το όνομα του δρόμου και την περιοχή, και πάτα «Έλεγχος».</span>`
    : g === "noad" ? `<span class="mid">Δεν υπάρχει διεύθυνση.</span>` : `<span class="mid">Δεν έχει ελεγχθεί ακόμα. Πάτα «Έλεγχος».</span>`;
}
const CU_COLS = ["#0B6E4F", "#17324D", "#8E3B46", "#B45309", "#5B3F8C", "#0E7490", "#4D7C0F", "#9D174D"];
const custColor = k => { let h = 0; for (const ch of String(k)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return CU_COLS[h % CU_COLS.length]; };
const custInit = n => String(n || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase() || "?";
const intlPhone = p => { let d = String(p || "").replace(/\D/g, ""); if (d.startsWith("00")) d = d.slice(2); if (d.length === 10) d = "30" + d; return d; };

/* ---------- πολλά τηλέφωνα: το πρώτο μένει το κύριο (κλειδί πελάτη), τα υπόλοιπα στο .phones ---------- */
const PH_MAX = 4;
const phDig = p => { let d = String(p || "").replace(/\D/g, ""); if (d.startsWith("00")) d = d.slice(2); if (d.length === 12 && d.startsWith("30")) d = d.slice(2); return d; };
const phKind = p => { const d = phDig(p); return d.length < 10 ? "" : /^69/.test(d) ? "m" : /^2/.test(d) ? "s" : "o"; };
const PHK = { m: ["📱", "Κινητό"], s: ["☎️", "Σταθερό"], o: ["📞", "Τηλέφωνο"], "": ["📞", ""] };
const phAll = c => [c && c.phone, ...((c && c.phones) || [])].filter(Boolean);
function phRow(v, main, id) {
  const k = PHK[phKind(v)];
  return `<div class="phr${main ? " main" : ""}"><span class="phw"><span class="phk" aria-hidden="true">${k[0]}</span><input class="t" ${main ? `id="${id}"` : "data-phx"} type="tel" inputmode="tel" autocomplete="tel" maxlength="20" value="${esc(v || "")}" placeholder="${main ? "π.χ. 69xxxxxxxx" : "κινητό ή σταθερό"}"><span class="phtag">${k[1]}</span></span>${main ? "" : `<button type="button" class="phdel" data-phdel aria-label="Αφαίρεση τηλεφώνου">✕</button>`}<button type="button" class="phadd" data-phadd aria-label="Πρόσθεσε κι άλλο τηλέφωνο" title="Κι άλλο τηλέφωνο">＋</button></div>`;
}
function phonesHTML(id, label, main, extra) {
  return `<div class="phs" data-phs><label class="f" for="${id}">${label}</label>${phRow(main, true, id)}${(extra || []).map(x => phRow(x, false)).join("")}</div>`;
}
/* ενημέρωση εικονιδίου, ετικέτας και του «＋» (φαίνεται μόνο στην τελευταία συμπληρωμένη γραμμή) */
function phSync(box) {
  const rows = [...box.querySelectorAll(".phr")];
  rows.forEach((r, i) => { const v = r.querySelector("input").value, k = PHK[phKind(v)]; r.querySelector(".phk").textContent = k[0]; r.querySelector(".phtag").textContent = k[1];
    r.classList.toggle("can", i === rows.length - 1 && phDig(v).length >= 10 && rows.length < PH_MAX); });
}
function phonesRead(id) {
  const box = ($("#" + id) || {}).closest ? $("#" + id).closest("[data-phs]") : null;
  const main = $("#" + id) ? $("#" + id).value.trim() : "";
  if (!box) return { main, extra: [] };
  const seen = new Set([phDig(main)]), extra = [];
  box.querySelectorAll("[data-phx]").forEach(i => { const v = i.value.trim(), d = phDig(v); if (d.length >= 10 && !seen.has(d)) { seen.add(d); extra.push(v); } });
  return { main, extra };
}
/* επιλογή αριθμού για κλήση όταν ο πελάτης έχει πάνω από ένα τηλέφωνο */
function custCall(k) {
  const c = S.customers[k]; if (!c) return; const L = phAll(c);
  if (L.length < 2) { location.href = "tel:" + L[0]; return; }
  sheet("📞 " + c.name, `<div class="bigopts">${L.map(p => { const kk = PHK[phKind(p)]; return `<a class="bigopt" href="tel:${esc(p.replace(/[^\d+]/g, ""))}" style="text-decoration:none;color:inherit"><span class="e">${kk[0]}</span><span class="t"><b>${esc(p)}</b><small>${kk[1] || "Τηλέφωνο"}</small></span><span class="g">›</span></a>`; }).join("")}</div>`);
}
document.addEventListener("input", e => { const b = e.target.closest && e.target.closest("[data-phs]"); if (b) phSync(b); });
document.addEventListener("click", e => {
  const a = e.target.closest && e.target.closest("[data-phadd]");
  if (a) { const box = a.closest("[data-phs]"), r = a.closest(".phr"); if (box.querySelectorAll(".phr").length >= PH_MAX) return;
    r.insertAdjacentHTML("afterend", phRow("", false)); phSync(box); const n = r.nextElementSibling; n.classList.add("new"); n.querySelector("input").focus(); return; }
  const d = e.target.closest && e.target.closest("[data-phdel]");
  if (d) { const box = d.closest("[data-phs]"); d.closest(".phr").remove(); phSync(box); }
});
function custMsg(k) {
  const c = S.customers[k]; if (!c || !c.phone) return;
  const n = intlPhone(c.phone);
  sheet("💬 " + c.name, `<div class="bigopts">
    <a class="bigopt" href="viber://chat?number=%2B${n}" style="text-decoration:none;color:inherit"><span class="e">🟣</span><span class="t"><b>Viber</b><small>${esc(c.phone)}</small></span><span class="g">›</span></a>
    <a class="bigopt" href="https://wa.me/${n}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><span class="e">🟢</span><span class="t"><b>WhatsApp</b><small>${esc(c.phone)}</small></span><span class="g">›</span></a>
    <a class="bigopt" href="sms:${esc(c.phone)}" style="text-decoration:none;color:inherit"><span class="e">✉️</span><span class="t"><b>Γραπτό μήνυμα (SMS)</b><small>${esc(c.phone)}</small></span><span class="g">›</span></a></div>`);
}
function custPinGo(k) {
  const c = S.customers[k]; if (!c) return;
  if (!(c.addr || "").trim() && !(c.pin && c.pin.lat != null)) { toast("Ο πελάτης δεν έχει διεύθυνση. Πρόσθεσέ τη στην καρτέλα του, ή πάτα «📍 Είμαι εδώ» όταν είσαι εκεί.", 4500); openCust(k); return; }
  closeSheet(); cm.focus = k; cm.f = "all"; cm.area = ""; tab = "map"; render();
}
/* εικονίδιο χάρτη (δικό μας, ίδιο σε όλα τα κινητά) */
const MAPIC = `<svg viewBox="0 0 48 48" width="1em" height="1em" aria-hidden="true"><path d="M4 13.5 16 8.5l16 5 12-5v28l-12 5-16-5-12 5z" fill="#D7EFD9"/><path d="M16 8.5v28l16 5v-28z" fill="#BFE3C4"/><path d="M4 13.5 16 8.5l16 5 12-5v28l-12 5-16-5-12 5z" fill="none" stroke="#3E8E57" stroke-width="2.2" stroke-linejoin="round"/><path d="M6.5 30c5-3 8.5 2 13.5 0s7-8 12.5-6.5S39 27 42 25" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M33.5 3.5c-5 0-8.6 3.8-8.6 8.4 0 6.2 8.6 15.1 8.6 15.1s8.6-8.9 8.6-15.1c0-4.6-3.6-8.4-8.6-8.4z" fill="#E53935" stroke="#B71C1C" stroke-width="1.2"/><circle cx="33.5" cy="12" r="3.3" fill="#fff"/></svg>`;
A.MAPIC = MAPIC;
const CU_SORT = { rec: "🕒 Πρόσφατοι", freq: "🔁 Συχνότεροι", sum: "💶 Τζίρος", name: "🔤 Όνομα", owe: "🔴 Χρωστάνε", area: "📍 Περιοχή", idle: "💤 Καιρό χωρίς παραγγελία" };
function custsView() {
  const q = K.norm(custQ);
  const owe = {}; for (const k of Object.keys(S.customers)) owe[k] = custStats(k).owed;
  const so = CU_SORT[S.ui.cuSort] ? S.ui.cuSort : "rec", st = {}; for (const k of Object.keys(S.customers)) st[k] = custStats(k);
  const byName = (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "el");
  const cmp = { rec: (a, b) => ((owe[b.key] > 0) - (owe[a.key] > 0)) || (owe[a.key] > 0 ? owe[b.key] - owe[a.key] : 0) || (b.last || 0) - (a.last || 0),
    freq: (a, b) => st[b.key].n - st[a.key].n || st[b.key].sum - st[a.key].sum || byName(a, b),
    sum: (a, b) => st[b.key].sum - st[a.key].sum || byName(a, b),
    name: byName,
    owe: (a, b) => (owe[b.key] || 0) - (owe[a.key] || 0) || byName(a, b),
    area: (a, b) => (!a.area - !b.area) || String(a.area || "").localeCompare(String(b.area || ""), "el") || byName(a, b),
    idle: (a, b) => ((!a.last) - (!b.last)) || (a.last || 0) - (b.last || 0) || byName(a, b) }[so];
  const L = Object.values(S.customers).filter(c => !q || K.norm(c.name + " " + c.phone + " " + (c.addr || "") + " " + (c.area || "")).includes(q)).filter(c => so !== "owe" || owe[c.key] > 0).sort(cmp);
  const nAll = Object.keys(S.customers).length;
  const owedAll = K.round2(Object.keys(S.customers).reduce((a, k) => a + custStats(k).owed, 0));
  return `<div class="row" style="margin-bottom:10px"><input class="t grow" id="custQ" placeholder="🔍 Αναζήτηση πελάτη" value="${esc(custQ)}"><button type="button" class="btn amber" data-act="custNewBtn">＋ Νέος</button></div>
   <button type="button" class="btn soft wide cumapb" data-act="custMap"><span class="mapic">${MAPIC}</span> Χάρτης πελατών <span class="cumapg">›</span></button>
   ${nAll > 1 ? `<div class="cusort"><span>Ταξινόμηση</span><div class="chips">${Object.entries(CU_SORT).map(([k, l]) => `<button type="button" class="chip sm${so === k ? " on" : ""}" data-cusort="${k}">${l}</button>`).join("")}</div></div>` : ""}
   ${owedAll > 0 ? `<div class="warnbox">Σου χρωστάνε συνολικά <b>${K.money(owedAll)}</b> από παραδομένες παραγγελίες.</div>` : ""}
   ${L.length ? `<div class="culist">${L.map(c => { const s = custStats(c.key), g = custGeoState(c); return `<div class="it cuit${s.owed > 0 ? " owe" : ""}${g === "miss" || g === "amb" || g === "off" ? " nogeo" : ""}" data-cust="${c.key}" style="--cc:${custColor(c.key)}">
     <div class="cav" aria-hidden="true">${esc(custInit(c.name))}</div>
     <div class="cut"><b class="cun">${esc(c.name)}${rateAvg(c.ratings) ? ` <span class="cur">★${rateAvg(c.ratings)}</span>` : ""}</b>
      <span class="cup">${esc(c.phone || "")}</span>
      ${c.area ? `<span class="cuar${c.areaAuto ? " auto" : ""}">📍 ${esc(c.area)}${c.areaAuto ? (c.areaAuto === "c" ? " · από τις επαφές" : " · αυτόματα") : ""}</span>` : ""}
      <span class="cus">${s.n} ${s.n === 1 ? "παραγγελία" : "παραγγελίες"} · τζίρος ${K.money(s.sum)}</span>
      ${pendOf(c.key).length || s.owed > 0 || s.owed < 0 || g === "miss" || g === "noad" || g === "approx" || g === "amb" || g === "off" ? `<div class="cupl">${pendOf(c.key).length ? `<span class="pill warn">⏳ περιμένει ${pendOf(c.key).length}</span>` : ""}${s.owed > 0 ? `<span class="pill new">χρωστά ${K.money(s.owed)}</span>` : s.owed < 0 ? `<span class="pill warn">επιστροφή ${K.money(-s.owed)}</span>` : ""}${g === "off" ? `<span class="cugeo bad">⚠️ Βρέθηκε σε άλλη περιοχή</span>` : g === "amb" ? `<span class="cugeo bad">❓ Ίδια διεύθυνση σε πολλές περιοχές</span>` : g === "miss" ? `<span class="cugeo bad">⚠️ Δεν βρέθηκε η διεύθυνση</span>` : g === "noad" ? `<span class="cugeo">Χωρίς διεύθυνση</span>` : g === "approx" ? `<span class="cugeo">≈ κατά προσέγγιση</span>` : ""}</div>` : ""}</div>
     ${custActs(c)}</div>`; }).join("")}</div>` : custQ ? `<div class="emp sm"><div class="ee">🔍</div><b>Δεν βρέθηκε πελάτης</b><span>Δοκίμασε άλλο όνομα ή τηλέφωνο.</span></div>` : `<div class="emp"><div class="ee">👥</div><b>Οι πελάτες σου θα φαίνονται εδώ</b><span>Μπαίνουν μόνοι τους με την πρώτη τους παραγγελία. Μπορείς και να τους φέρεις από τις επαφές ή να τους γράψεις.</span><div class="row" style="justify-content:center"><button type="button" class="btn amber" data-act="link">📤 Στείλε τον κατάλογο</button><button type="button" class="btn soft" data-act="custNewBtn">＋ Νέος</button></div></div>`}`;
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
  const gs = custGeoState(c);
  sheet(c.name, `<div class="cuacts3">${c.phone ? `${c.phones && c.phones.length ? `<button type="button" data-ccall="${esc(k)}"><span class="e">📞</span><span>Κλήση</span></button>` : `<a href="tel:${esc(c.phone)}"><span class="e">📞</span><span>Κλήση</span></a>`}<button type="button" data-cmsg="${esc(k)}"><span class="e">💬</span><span>Μήνυμα</span></button>` : ""}<button type="button" data-cpin="${esc(k)}"><span class="e">📍</span><span>Χάρτης</span></button></div>
   <div class="cuacts2"><button type="button" class="btn amber" data-act="custNew">＋ Νέα παραγγελία</button>${s.list.length ? `<button type="button" class="btn soft" data-act="custRepeat">🔁 Επανάληψη παραγγελίας</button>` : ""}</div>${c.phone && !c.inPh ? `<p class="olin" style="justify-content:center;margin:-4px 0 10px"><button type="button" class="minib" data-act="custVcf">📇 Αποθήκευση στις επαφές του κινητού</button></p>` : ""}
   ${custInfoHTML(k)}
   ${pendOf(k).length ? `<div class="heldbox"><b>⏳ Περιμένει με την επόμενη παραγγελία</b>${pendOf(k).map(x => `<div class="heldr"><span>${esc(x.name)} · ${K.num(x.q)} ${esc(x.unit)} <span class="note">(από #${x.no})</span></span></div>`).join("")}</div>` : ""}
   ${gs === "off" ? `<div class="errbox cugeobox"><b>⚠️ ΒΡΕΘΗΚΕ ΣΕ ΑΛΛΗ ΠΕΡΙΟΧΗ</b><br>Η «${esc(c.addr)}» βρέθηκε στη «${esc(geoMem()[geoKey(c.addr, c.area)].off)}», όχι «${esc(c.area || "")}». Μάλλον είναι ομώνυμος δρόμος. Διόρθωσε τη διεύθυνση, ή πάτα «🗺 Βάλ' το στον χάρτη».</div>` : gs === "amb" ? `<div class="errbox cugeobox"><b>❓ ΠΟΙΑ «${esc(c.addr)}»;</b><br>Υπάρχουν ίδιες διευθύνσεις σε ${(geoMem()[geoKey(c.addr, c.area)].amb || []).length} περιοχές. Διάλεξε τη σωστή, αλλιώς η διαδρομή μπορεί να σε πάει αλλού. <button type="button" class="btn sm amber" data-ambfor="${esc(k)}" style="margin-top:6px">Διάλεξε περιοχή ›</button></div>` : gs === "miss" ? `<div class="errbox cugeobox"><b>⚠️ ΔΕΝ ΒΡΕΘΗΚΕ Η ΔΙΕΥΘΥΝΣΗ ΣΤΟΝ ΧΑΡΤΗ</b><br>Ο πελάτης δεν φαίνεται στον χάρτη και στο δρομολόγιο. Διόρθωσε τη διεύθυνση ή την περιοχή παρακάτω (π.χ. ολόκληρο το όνομα του δρόμου), ή πάτα «📍 Είμαι εδώ» όταν βρίσκεσαι στο σημείο.</div>` : gs === "approx" ? `<div class="warnbox">≈ Στον χάρτη μπήκε <b>κατά προσέγγιση</b>, στο κέντρο της περιοχής. Σύρε την πινέζα στο σωστό σημείο ή πάτα «📍 Είμαι εδώ» όταν βρίσκεσαι εκεί.</div>` : ""}
   <div class="card"><label class="f" for="cuN">Όνομα</label><input class="t" id="cuN" value="${esc(c.name)}">${phonesHTML("cuP", "Τηλέφωνα", c.phone, c.phones)}<label class="f" for="cuA">Διεύθυνση</label><input class="t" id="cuA" value="${esc(c.addr || "")}"><div class="row" style="margin-top:6px"><button type="button" class="btn soft sm grow" data-act="custGeoCheck" style="flex:1 1 0">🔎 Έλεγχος</button><button type="button" class="btn soft sm grow" data-act="custPinHere" style="flex:1 1 0">📍 Είμαι εδώ</button></div><div id="cuGeoSt" class="cugeost">${custGeoLine(c)}</div><div class="row" style="margin-top:6px"><button type="button" class="btn ghost sm grow" data-act="custPick" style="flex:1 1 0">🗺 Βάλ' το στον χάρτη</button><button type="button" class="btn ghost sm grow" data-act="custGm" style="flex:1 1 0">🔗 Από Google Maps</button></div><label class="f" for="cuAr">Περιοχή (για την οργάνωση της διανομής)${c.areaAuto ? ` <span class="autoarl">· ${c.areaAuto === "c" ? "από τις επαφές" : "αυτόματα από τον χάρτη"} — έλεγξέ τη</span>` : ""}</label><input class="t${c.areaAuto ? " autoar" : ""}" id="cuAr" value="${esc(c.area || "")}" placeholder="π.χ. Κορωπί" list="areaL"><datalist id="areaL">${[...new Set(Object.values(S.customers).map(x => x.area).filter(Boolean))].map(a => `<option value="${esc(a)}">`).join("")}</datalist><label class="f" for="cuNo">Σημειώσεις (μόνο για σένα)</label><input class="t" id="cuNo" value="${esc(c.notes || "")}"></div>
   ${custPriceCard(c)}
   <div class="card"><h3>🚚 Πότε περνάς</h3><p style="margin:0 0 8px">${c.route && c.route.days && c.route.days.length ? esc(c.route.days.map(x => K.WD[x]).join(", ")) + (c.route.slot ? " · " + esc(c.route.slot) : "") + (c.route.note ? " · " + esc(c.route.note) : "") + (c.route.ex !== false ? " · ⚡ δέχεται έκτακτη" : "") : `<span class="note">Δεν έχεις δηλώσει ημέρες· βλέπει τις γενικές.</span>`}</p>
    <div class="row"><button type="button" class="btn soft sm grow" data-act="custRoute">📅 Ημέρες</button><button type="button" class="btn amber sm grow" data-act="custLink">📤 Στείλε του τον κατάλογο</button></div></div>
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
  const unpaid = act.filter(o => o.st === "done" && owes(o));
  if (unpaid.length) R.push({ id: "unpaid", ic: "💶", t: `${unpaid.length === 1 ? "Υπάρχει <b>1</b> ανεξόφλητη παράδοση" : "Υπάρχουν <b>" + unpaid.length + "</b> ανεξόφλητες παραδόσεις"} (${K.money(unpaid.reduce((a, o) => a + dueOf(o), 0))})`, act: `data-remgo="unpaid"` });
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
let dvDay = "", dvBy = "area";
function areaOf(o) { const c = S.customers[custKey(o.cust.phone)] || {}; const a = (c.area || "").trim(); if (a) return a; const ad = (o.cust.addr || c.addr || "").split(",").map(x => x.trim()).filter(Boolean); return ad.length > 1 ? ad[ad.length - 1] : "Χωρίς περιοχή"; }
const slotTxt = t => { const m = /(\d{1,2})[:.](\d{2})/.exec(t || ""); return m ? m[1].padStart(2, "0") + ":" + m[2] : "99"; };
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
  const owed = K.round2(L.reduce((a, o) => a + dueOf(o), 0));
  const stop = o => { const c = S.customers[custKey(o.cust.phone)] || {}, ad = o.cust.addr || c.addr || ""; return `<div class="dvs"><div class="dvh"><b>${esc(o.cust.name)}</b><span class="note">${o.when.slot ? esc(o.when.slot) + " · " : ""}#${o.no} · ${K.money(o.total)} ${!owes(o) ? "✓ πληρώθηκε" : "<b style='color:var(--bad)'>να εισπραχθ" + (o.paid ? "ούν " + K.money(dueOf(o)) : "εί") + "</b>"}</span></div>
     ${ad ? `<div class="note">📍 ${esc(ad)}</div>` : `<div class="note" style="color:var(--bad)">Χωρίς διεύθυνση</div>`}
     <div class="note">${esc(o.lines.map(l => K.num(l.q) + " " + l.unit + " " + l.name).join(" · "))}</div>${o.cust.note ? `<div class="note">📝 ${esc(o.cust.note)}</div>` : ""}
     <div class="row" style="margin-top:6px;flex-wrap:wrap"><a class="btn soft sm" href="tel:${esc(o.cust.phone)}">📞</a>${ad ? `<a class="btn soft sm" href="https://www.google.com/maps/search/?api=1&query=${mapsQ(ad)}" target="_blank" rel="noopener">🗺 Χάρτης</a>` : ""}<button type="button" class="btn ghost sm" data-dvo="${o.id}">Άνοιγμα</button></div></div>`; };
  sheet("🚚 Διανομή", `
   <div class="chips">${days.map(d => `<button type="button" class="chip${d === dvDay ? " on" : ""}" data-dvday="${d}">${esc(K.dayLabel(d))}<span class="n">${dvOrders(d).length}</span></button>`).join("")}</div>
   <div class="chips">${[["area", "📍 Περιοχή"], ["time", "🕘 Ώρα"], ["cust", "👤 Πελάτης"]].map(([k, l]) => `<button type="button" class="chip${dvBy === k ? " on" : ""}" data-dvby="${k}">${l}</button>`).join("")}</div>
   ${L.some(o => (o.st === "new" || o.st === "prep") && o.when.how !== "pick") ? `<button type="button" class="btn green wide" data-act="rtDay" style="margin-bottom:10px">🚐 Δρομολόγιο με τις παραδόσεις της ημέρας</button>` : ""}
   ${L.length ? `<div class="card"><div class="okbox" style="margin-top:0">${L.length === 1 ? "1 παραγγελία" : L.length + " παραγγελίες"} · ${K.money(L.reduce((a, o) => a + o.total, 0))}${owed ? ` · <b>να εισπραχθούν ${K.money(owed)}</b>` : ""}</div>
    <details><summary style="cursor:pointer;font-weight:700">📦 Τι φορτώνω</summary>${Object.entries(load).sort().map(([k, q]) => { const [n, u] = k.split("|"); return `<div class="qrow"><div class="qn"><b>${esc(n)}</b></div><b>${K.num(q)} ${esc(u)}</b></div>`; }).join("")}</details></div>
    ${G.map(g => `<div class="card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><h3 style="margin:0;flex:1">${esc(g.k)} <span class="note" style="font-weight:400">· ${g.os.length}</span></h3>${!g.pick && routeUrl(g.os) ? `<a class="btn sm amber" href="${esc(routeUrl(g.os))}" target="_blank" rel="noopener">🗺 Διαδρομή</a>` : ""}</div>${g.os.map(stop).join("")}</div>`).join("")}
    <p class="note">«🗺 Διαδρομή» ανοίγει τους Χάρτες Google με τις στάσεις της ομάδας στη σειρά (έως 10).</p>`
   : `<div class="card" style="text-align:center;color:var(--mute)">Δεν υπάρχουν παραγγελίες για ${esc(K.dayLabel(dvDay))}.</div>`}`);
}
A.dvSheet = dvSheet;
/* ---------- 🚐 Δρομολόγιο: διαλέγεις σε ποιους θα πας και βγαίνει η διαδρομή (ίδιο στήσιμο με την εφαρμογή Δρομολόγιο) ---------- */
const RT = { step: "pick", day: "today", sel: null, off: new Set(), res: null, busy: false };
const rtPref = () => S.ui.rt || (S.ui.rt = { from: "base", fromText: "", end: "back", endText: "", mode: "fast", real: true });
/* «χωρίς διόδια»: η δημόσια υπηρεσία διαδρομών δεν το υποστηρίζει σταθερά, οπότε μένει κρυφό (ο κώδικας μένει για όταν βρεθεί υπηρεσία που το κάνει σωστά) */
const TOLLS_ON = false;
const rtNoToll = () => TOLLS_ON && rtPref().tolls === false;
const rtKm = (a, b) => { const R = 6371, r = x => x * Math.PI / 180, dLa = r(b.lat - a.lat), dLo = r(b.lng - a.lng); const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.min(1, Math.sqrt(h))) * 1.3; };
const rtFmtKm = k => (k < 10 ? K.num(Math.round(k * 10) / 10) : K.num(Math.round(k))) + " χλμ";
const rtMin = m => m < 60 ? Math.round(m) + " λεπτά" : Math.floor(m / 60) + " ώρ. " + Math.round(m % 60) + " λεπ.";
const custAddr = (k, o) => ((o && o.cust.addr) || (S.customers[k] || {}).addr || "").trim();
/* ό,τι εκκρεμεί: παραδόσεις (ανοιχτές παραγγελίες) και εισπράξεις (πελάτες που χρωστάνε) */
function rtCands() {
  const t0 = today(), t1 = addDays(t0, 1);
  const dayOk = o => RT.day === "all" ? true : RT.day === "tom" ? o.when.date === t1 : (!o.when.date || o.when.date <= t0);
  const del = S.orders.filter(o => (o.st === "new" || o.st === "prep") && !o.test && o.when.how !== "pick" && dayOk(o))
    .sort((a, b) => (a.when.date || "").localeCompare(b.when.date || "") || slotKey(a).localeCompare(slotKey(b)));
  const C = [];
  for (const o of del) { const k = custKey(o.cust.phone); C.push({ key: "o:" + o.id, kind: "del", ck: k, name: o.cust.name, addr: custAddr(k, o), o, amt: dueOf(o), slot: o.when.slot || "", date: o.when.date || "" }); }
  const inDel = new Set(C.map(x => x.ck));
  for (const d of debtors()) if (!inDel.has(d.c.key)) C.push({ key: "c:" + d.c.key, kind: "pay", ck: d.c.key, name: d.c.name, addr: custAddr(d.c.key), amt: d.v });
  if (RT.visit) for (const k of RT.visit) if (S.customers[k] && !C.some(x => x.ck === k)) C.push({ key: "v:" + k, kind: "vis", ck: k, name: S.customers[k].name, addr: custAddr(k), amt: 0 });
  return C;
}
function rtOpen(keys) {
  RT.step = "pick"; RT.res = null; RT.off = new Set();
  RT.sel = keys ? new Set(keys) : null;
  tab = "route"; window.scrollTo(0, 0); render();
}
const rtFromLbl = P => P.from === "me" ? "📍 Η θέση μου" : P.from === "text" ? "✏️ " + (P.fromText || "Άλλο σημείο") : "🏠 Έδρα";
const rtEndLbl = P => P.end === "last" ? "🏁 Τελευταία στάση" : P.end === "text" ? "✏️ " + (P.endText || "Άλλο σημείο") : "↩ Επιστροφή";
/* αφετηρία και τέλος σε αναδυόμενο παράθυρο, για να μένει μαζεμένη η οθόνη του Δρομολογίου */
function rtSetSheet() {
  const P = rtPref();
  const fromChips = [["base", "🏠 Έδρα"], ["me", "📍 Η θέση μου"], ["text", "✏️ Άλλο σημείο"]], endChips = [["back", "↩ Επιστροφή στην αφετηρία"], ["last", "🏁 Τέλος στην τελευταία στάση"], ["text", "✏️ Άλλο σημείο"]];
  sheet("🧭 Αφετηρία και τέλος", `<div class="card"><h3>Ξεκινάς από</h3><div class="chips" style="flex-wrap:wrap">${fromChips.map(([k, l]) => `<button type="button" class="chip${P.from === k ? " on" : ""}" data-rtfrom="${k}">${l}</button>`).join("")}</div>
    ${P.from === "base" ? `<p class="note" style="margin:6px 0 0">${S.shop.addr ? "🏠 " + esc(S.shop.addr) : `<span style="color:var(--bad)">Δεν έχεις γράψει διεύθυνση έδρας.</span> <a href="#" data-act="shop">Συμπλήρωσέ τη</a>`}</p>` : ""}
    ${P.from === "text" ? `<input class="t" id="rtFromT" value="${esc(P.fromText)}" placeholder="π.χ. Λεωφόρος Κηφισίας 10, Μαρούσι" style="margin-top:6px">` : ""}
    <h3 style="margin-top:12px">Τελειώνεις</h3><div class="chips" style="flex-wrap:wrap">${endChips.map(([k, l]) => `<button type="button" class="chip${P.end === k ? " on" : ""}" data-rtend="${k}">${l}</button>`).join("")}</div>
    ${P.end === "text" ? `<input class="t" id="rtEndT" value="${esc(P.endText)}" placeholder="π.χ. Αποθήκη, Αχαρνών 200" style="margin-top:6px">` : ""}
        <label class="ck" style="margin-top:8px"><input type="checkbox" id="rtReal"${P.real ? " checked" : ""}> Πραγματικά χιλιόμετρα και λεπτά από τον δρόμο</label></div>`, `<button type="button" class="btn amber wide" data-act="shClose">✓ Εντάξει</button>`, el => { el.dataset.rtset = "1"; });
}
function routeView() {
  const P = rtPref(), C = rtCands();
  if (RT.step === "res" && RT.res) return rtResHTML();
  if (!RT.sel) RT.sel = new Set(C.filter(x => x.kind === "del" && x.addr).map(x => x.key));
  for (const k of [...RT.sel]) if (!C.some(x => x.key === k)) RT.sel.delete(k);
  const del = C.filter(x => x.kind === "del"), pay = C.filter(x => x.kind === "pay"), vis = C.filter(x => x.kind === "vis");
  const row = x => { const on = RT.sel.has(x.key), na = !x.addr;
    return `<label class="rtc${on ? " on" : ""}${na ? " na" : ""}"><input type="checkbox" data-rtsel="${esc(x.key)}"${on ? " checked" : ""}${na ? " disabled" : ""}>
     <span class="t"><b>${esc(x.name)}</b><small>${x.kind === "del" ? `#${x.o.no} · ${esc(fmtWhen(x.o))}` : x.kind === "vis" ? "Επίσκεψη (από τον χάρτη πελατών)" : "Χρωστά από προηγούμενες παραγγελίες"}</small>
     <small>${na ? `<span style="color:var(--bad)">Χωρίς διεύθυνση</span> · <a href="#" data-rtcust="${esc(x.ck)}">πρόσθεσέ τη</a>` : "📍 " + esc(x.addr)}</small></span>
     ${x.amt > 0 ? `<b class="am">${K.money(x.amt)}</b>` : x.kind === "vis" ? "" : `<span class="pill paid">✓</span>`}</label>`; };
  const fromChips = [["base", "🏠 Έδρα"], ["me", "📍 Η θέση μου"], ["text", "✏️ Άλλο σημείο"]], endChips = [["back", "↩ Επιστροφή στην αφετηρία"], ["last", "🏁 Τέλος στην τελευταία στάση"], ["text", "✏️ Άλλο σημείο"]];
  const modes = [["fast", "⚡ Γρηγορότερη"], ["time", "🕘 Κατά ώρα παράδοσης"], ["area", "📍 Κατά περιοχή"]];
  const n = RT.sel.size;
  return `<div class="row" style="margin:2px 2px 10px;align-items:center"><h2 style="margin:0;font-size:20px" class="grow">🚐 Δρομολόγιο</h2><button type="button" class="btn soft sm" data-act="custMap">🗺 Χάρτης πελατών</button></div>
   <div class="card rtsetc"><button type="button" class="rtsetrow" data-rt="setp" aria-label="Αφετηρία και τέλος">
     <span class="rtsx"><small>Ξεκινάς</small><b>${esc(rtFromLbl(P))}</b></span><span class="rtsarr">→</span><span class="rtsx"><small>Τελειώνεις</small><b>${esc(rtEndLbl(P))}</b></span><span class="rtsch">Αλλαγή ›</span></button>
    <h3 style="margin-top:12px">Τρόπος διαδρομής</h3><div class="seg rtseg">${modes.map(([k, l]) => `<button type="button" class="${P.mode === k ? "on" : ""}" data-rtmode="${k}">${l}</button>`).join("")}</div>
    <p class="note" style="margin:6px 0 0">${P.mode === "fast" ? "Βάζει μόνη της τη σειρά με τα λιγότερα λεπτά οδήγησης." : P.mode === "time" ? "Πρώτα όσοι έχουν νωρίτερη ώρα παράδοσης, μετά οι υπόλοιποι με τη συντομότερη σειρά." : "Τελειώνεις μία περιοχή και μετά πας στην επόμενη, με τη συντομότερη σειρά."}</p>
    ${TOLLS_ON ? `<h3 style="margin-top:12px">Διόδια</h3><div class="seg rtseg">${[[true, "🛣 Με διόδια"], [false, "🚫 Χωρίς διόδια"]].map(([k, l]) => `<button type="button" class="${(P.tolls !== false) === k ? "on" : ""}" data-rttoll="${k ? 1 : 0}">${l}</button>`).join("")}</div>` : ""}
</div>
   <div class="chips">${[["today", "Σήμερα"], ["tom", "Αύριο"], ["all", "Όλες οι ανοιχτές"]].map(([k, l]) => `<button type="button" class="chip${RT.day === k ? " on" : ""}" data-rtday="${k}">${l}</button>`).join("")}</div>
   <div class="card"><div style="display:flex;align-items:center;gap:8px"><h3 style="margin:0;flex:1">🚚 Παραδόσεις <span class="note" style="font-weight:400">· ${del.length}</span></h3>${del.length ? `<button type="button" class="lnk sm" data-rtall="del">Όλες / καμία</button>` : ""}</div>
    ${del.length ? del.map(row).join("") : `<p class="note">Καμία ανοιχτή παραγγελία για παράδοση ${RT.day === "today" ? "σήμερα" : RT.day === "tom" ? "αύριο" : ""}.</p>`}</div>
   <div class="card"><div style="display:flex;align-items:center;gap:8px"><h3 style="margin:0;flex:1">💶 Εισπράξεις <span class="note" style="font-weight:400">· ${pay.length}</span></h3>${pay.length ? `<button type="button" class="lnk sm" data-rtall="pay">Όλες / καμία</button>` : ""}</div>
    ${pay.length ? `<p class="note" style="margin:2px 0 6px">Πελάτες που σου χρωστάνε. Τσέκαρε όσους θέλεις να περάσεις να εισπράξεις.</p>` + pay.map(row).join("") : `<p class="note">Κανείς δεν σου χρωστά.</p>`}</div>
   ${vis.length ? `<div class="card"><div style="display:flex;align-items:center;gap:8px"><h3 style="margin:0;flex:1">👋 Επισκέψεις <span class="note" style="font-weight:400">· ${vis.length}</span></h3><button type="button" class="lnk sm" data-rtall="vis">Όλες / καμία</button><button type="button" class="lnk sm" data-rt="visClear">Καθάρισμα</button></div>${vis.map(row).join("")}</div>` : ""}
   <div class="rtgo"><button type="button" class="btn amber wide" data-rt="go"${n ? "" : " disabled"}>🧭 Δείξε διαδρομή${n ? " · " + (n === 1 ? "1 στάση" : n + " στάσεις") : ""}</button></div>`;
}
/* --- τοποθεσίες: διεύθυνση → σημείο στον χάρτη (OpenStreetMap), με μνήμη ώστε να μην ξαναψάχνεται ---
   Πιο έξυπνα από ένα απλό «ψάξε»: ανοίγουν οι συντομογραφίες (Λεωφ., Βασ., Αγ.…), μπαίνει η περιοχή του πελάτη,
   από πολλά αποτελέσματα κρατιέται όποιο είναι πιο κοντά στην έδρα, και ό,τι πέφτει πολύ μακριά απορρίπτεται.
   Αν δεν βρεθεί ο δρόμος, μπαίνει «κατά προσέγγιση» στο κέντρο της περιοχής (≈) — και η πινέζα σέρνεται στη σωστή θέση. */
const geoMem = () => {
  const G = S.geo2 || (S.geo2 = {});
  /* μία φορά (1.50): οι παλιές θέσεις ξαναψάχνονται για να φανεί αν υπάρχουν ίδιες διευθύνσεις σε άλλες περιοχές — όσες διάλεξες εσύ μένουν */
  if (!S.geoV || S.geoV < 2) { for (const k of Object.keys(G)) if (!G[k].picked && !k.startsWith("πόλη|")) delete G[k]; S.geoQ = {}; S.geoV = 2; }
  /* 1.54: όσες ήρθαν από HERE/TomTom ξαναψάχνονται (πριν μπορούσε να κρατηθεί σκέτη πόλη, π.χ. Σύνταγμα αντί για τον δρόμο) */
  if (S.geoV < 3) { for (const k of Object.keys(G)) if (G[k].src) delete G[k]; S.geoV = 3; }
  /* 1.57: ξαναψάχνονται οι θέσεις των δωρεάν υπηρεσιών (ελέγχεται πλέον αν είναι στη σωστή περιοχή) */
  if (S.geoV < 4) { for (const k of Object.keys(G)) if (!G[k].src && !G[k].picked && !k.startsWith("πόλη|")) delete G[k]; S.geoQ = {}; S.geoV = 4; }
  /* 1.58: και όσες ήρθαν από HERE/TomTom (ελέγχεται πλέον η περιοχή και στα λατινικά) */
  if (S.geoV < 5) { for (const k of Object.keys(G)) if (G[k].src) delete G[k]; S.geoV = 5; }
  return G;
};
let geoLast = 0;
const GR_ABBR = [[/(^|[\s,])Λεωφ(?:\.\s*|\s+)/gi, "$1Λεωφόρος "], [/(^|[\s,])Λ\.\s*/g, "$1Λεωφόρος "], [/(^|[\s,])Βασ\.\s*/gi, "$1Βασιλέως "], [/(^|[\s,])Βασιλ\.\s*/gi, "$1Βασιλίσσης "], [/(^|[\s,])Αγ\.\s*/gi, "$1Αγίου "], [/(^|[\s,])Πλ\.\s*/gi, "$1Πλατεία "], [/(^|[\s,])Εθν\.\s*/gi, "$1Εθνικής "], [/(^|[\s,])Ελ\.\s*Βενιζέλου/gi, "$1Ελευθερίου Βενιζέλου"], [/(^|[\s,])Οδ\.\s*/gi, "$1Οδός "], [/(^|[\s,])Π\.\s*Ράλλη/gi, "$1Πέτρου Ράλλη"], [/(^|[\s,])Κων\/νου/gi, "$1Κωνσταντίνου"], [/(^|[\s,])Αρ\.\s*/g, "$1"], [/(^|[\s,])Τ\.Κ\.\s*\d{3}\s?\d{2}/gi, "$1"], [/(^|[\s,])λεωφόρου?\s+/gi, "$1Λεωφόρος "], [/(^|[\s,])πλατεία[ςν]?\s+/gi, "$1Πλατεία "], [/(^|[\s,])(οδός|οδό|οδού)\s+/gi, "$1Οδός "], [/(^|[\s,])\d{3}\s?\d{2}(?=[\s,]|$)/g, "$1"]];
function geoClean(q) { let t = " " + String(q || "") + " "; for (const [r, w] of GR_ABBR) t = t.replace(r, w);
  t = t.replace(/(\d+)\s*[-–—\/&]\s*\d+[α-ωa-z]?(?=[\s,]|$)/gi, "$1");   /* «19-21», «19/21» → 19 */ return t.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim().replace(/^,|,$/g, "").trim(); }
const geoKm = (a, b) => { const R = 6371, r = x => x * Math.PI / 180, dLa = r(b.lat - a.lat), dLo = r(b.lng - a.lng); const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.min(1, Math.sqrt(h))); };
let geoChain = Promise.resolve();
/* κάθε αναζήτηση γίνεται μία φορά: μνήμη αποτελεσμάτων (30 μέρες) και κοινό αίτημα όταν ζητιέται ταυτόχρονα
   (π.χ. το «Μαρκόπουλο» για όλους τους πελάτες του Μαρκόπουλου). Μία αναζήτηση το δευτερόλεπτο, όπως ζητά το OpenStreetMap. */
const geoFly = {};
function geoAsk(q, force) {
  const k = K.norm(q), Q = S.geoQ || (S.geoQ = {}), m = Q[k];
  if (!force && m && Date.now() - m.at < 30 * 864e5) return Promise.resolve(m.L);
  if (geoFly[k]) return geoFly[k];
  const p = geoChain.then(() => geoAsk0(q)).then(L => {
    delete geoFly[k];
    if (L !== null) { Q[k] = { L: L.slice(0, 5), at: Date.now() }; const ks = Object.keys(Q); if (ks.length > 600) ks.sort((a, b) => Q[a].at - Q[b].at).slice(0, 100).forEach(x => delete Q[x]); }
    return L;
  });
  geoChain = p.catch(() => null); geoFly[k] = p; return p;
}
const GEO_MISS = 7 * 864e5;   /* διεύθυνση που δεν βρέθηκε: ξαναψάχνεται σε 7 μέρες, ή αμέσως αν αλλάξει */
/* οι θέσεις των πελατών βρίσκονται στο παρασκήνιο, για να ανοίγει ο χάρτης αμέσως με όλες τις πινέζες */
let geoPreT = null, geoPreOn = false;
function geoPrefetchSoon(ms) { clearTimeout(geoPreT); geoPreT = setTimeout(geoPrefetch, ms == null ? 15000 : ms); }
async function geoPrefetch() {
  if (geoPreOn || !S || !navigator.onLine) return; geoPreOn = true;
  try {
    await geoBase();
    const unsure = g => (GEO_KEYS.here || GEO_KEYS.tomtom) && g && !g.src && !g.paidTried && (g.approx || g.nonum || (g.amb && g.amb.length > 1));
    const L = Object.values(S.customers).filter(c => (c.addr || "").trim() && !custPin(c.key) && (!custGeoCached(c) || unsure(custGeoCached(c))));
    let n = 0;
    for (const c of L) { const k = K.norm(String(c.addr || "").trim() + "|" + String(c.area || "").trim()), g = geoMem()[k]; if (g && g.miss && Date.now() - g.miss < GEO_MISS && !((GEO_KEYS.here || GEO_KEYS.tomtom) && !g.paidTried)) continue; await custGeo(c); n++; if (n % 5 === 0) save(); if (tab === "map") break; }
    if (n) save();
  } finally { geoPreOn = false; }
}
async function geoAsk0(q) {
  if (!navigator.onLine) return null;
  const wait = 1100 - (Date.now() - geoLast); if (wait > 0) await new Promise(r => setTimeout(r, wait));
  geoLast = Date.now();
  const ctrl = new AbortController(), tm = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&addressdetails=1&countrycodes=gr&accept-language=el&q=" + encodeURIComponent(q), { signal: ctrl.signal });
    const js = await r.json();
    if (!r.ok || !Array.isArray(js)) return null;
    return js.map(x => { const a = x.address || {}, town = a.suburb || a.neighbourhood || a.quarter || a.village || a.town || a.city || a.municipality || "", city = a.city || a.town || a.village || a.municipality || "";
      return { where: [a.suburb, a.neighbourhood, a.quarter, a.village, a.town, a.city, a.municipality, a.city_district, a.county, a.state_district].filter(Boolean).join(" "), lat: +x.lat, lng: +x.lon, type: x.addresstype || x.type || "", num: !!a.house_number, label: [[a.road, a.house_number].filter(Boolean).join(" "), town, city !== town ? city : ""].filter(Boolean).join(", ") || String(x.display_name || "").split(",").slice(0, 3).join(","), town: town || city }; }).filter(x => isFinite(x.lat) && isFinite(x.lng));
  } catch { return null; } finally { clearTimeout(tm); }
}
/* η έδρα: για να ξέρουμε πού «είναι κοντά» */
let geoBaseP = null;
function geoBase() { if (S.shop.pin && S.shop.pin.lat != null) return Promise.resolve(S.shop.pin); if (!S.shop.addr) return Promise.resolve(null); if (!geoBaseP) geoBaseP = geoFind(S.shop.addr, { noBase: true }).catch(() => null).then(r => { if (!r) geoBaseP = null; return r; }); return geoBaseP; }
/* δεύτερη γνώμη όταν το OpenStreetMap δεν βρίσκει τη διεύθυνση: Photon (komoot), ψάχνει πιο «χαλαρά» (λάθη, χωρίς αριθμό) */
let phChain = Promise.resolve(), phLast = 0;
function geoPhoton(q, ref) {
  const p = phChain.then(async () => {
    if (!navigator.onLine) return null;
    const wait = 1100 - (Date.now() - phLast); if (wait > 0) await new Promise(r => setTimeout(r, wait)); phLast = Date.now();
    const ctrl = new AbortController(), tm = setTimeout(() => ctrl.abort(), 9000);
    try {
      const r = await fetch("https://photon.komoot.io/api/?limit=6&q=" + encodeURIComponent(q) + (ref ? "&lat=" + ref.lat + "&lon=" + ref.lng : ""), { signal: ctrl.signal });
      const js = await r.json(); if (!r.ok || !js || !Array.isArray(js.features)) return null;
      return js.features.filter(f => f && f.properties && (f.properties.countrycode || "").toUpperCase() === "GR" && f.geometry && Array.isArray(f.geometry.coordinates))
        .map(f => { const q = f.properties, town = q.district || q.locality || q.city || ""; return { where: [q.district, q.locality, q.city, q.county].filter(Boolean).join(" "), lat: +f.geometry.coordinates[1], lng: +f.geometry.coordinates[0], type: q.type || "", num: !!q.housenumber, label: [[q.street || q.name, q.housenumber].filter(Boolean).join(" "), town, q.city && q.city !== town ? q.city : ""].filter(Boolean).join(", "), town: town || q.city || "" }; }).filter(x => isFinite(x.lat) && isFinite(x.lng));
    } catch { return null; } finally { clearTimeout(tm); }
  });
  phChain = p.catch(() => null); return p;
}
/* πολλά αποτελέσματα σε διαφορετικά σημεία (π.χ. «Θεοφανούς» σε Αθήνα, Θεσσαλονίκη…): κρατιούνται όλα για να ρωτήσει την επιλογή */
function geoClusters(L, base, best) {
  const far = base ? L.filter(c => geoKm(base, c) <= 150) : L;
  const G = [best];
  for (const c of far) if (!G.some(g => geoKm(g, c) < 1.5)) G.push(c);
  return G.slice(0, 6).map(c => ({ lat: c.lat, lng: c.lng, label: c.label || "", town: c.town || "", km: base ? Math.round(geoKm(base, c)) : null }));
}
/* ---- επί πληρωμή υπηρεσίες με δωρεάν μηνιαίο όριο: HERE (30.000) και TomTom (20.000) ----
   Μπαίνουν ΜΟΝΟ όταν οι δωρεάν δεν βρουν ή βρουν αβέβαια (μόνο περιοχή, χωρίς αριθμό, ίδιες σε πολλές περιοχές).
   Λογαριασμοί χωρίς κάρτα: όταν τελειώσει το όριο του μήνα αρνούνται (όχι χρέωση) και πάμε στην επόμενη.
   Όροι: τα αποτελέσματά τους κρατιούνται έως 30 ημέρες και μετά ξαναψάχνονται. */
const GEO_KEYS = { here: "", tomtom: "36dqCn41wV9UUPHJuycyATGdkVk9XBHY" };   /* συμπληρώνονται τα κλειδιά (περιορισμένα στο aglentzakis-dot.github.io) */
const PAID_TTL = 30 * 864e5;
A._geoKeys = GEO_KEYS;   /* για τις δοκιμές */
let paidOff = {};   /* υπηρεσία που αρνήθηκε (όριο/κλειδί): δεν ξαναρωτιέται σε αυτό το άνοιγμα */
function paidCount(svc) { const m = K.ymd(new Date()).slice(0, 7), u = S.ui.geoPaid || (S.ui.geoPaid = {}); if (u.m !== m) { u.m = m; u.here = 0; u.tomtom = 0; } u[svc] = (u[svc] || 0) + 1; }
async function geoPaidAsk(svc, q, base) {
  if (!GEO_KEYS[svc] || paidOff[svc] || !navigator.onLine) return null;
  const ctrl = new AbortController(), tm = setTimeout(() => ctrl.abort(), 9000);
  try {
    const at = base ? base.lat.toFixed(5) + "," + base.lng.toFixed(5) : "";
    const url = svc === "here"
      ? "https://geocode.search.hereapi.com/v1/geocode?lang=el&limit=6&in=countryCode:GRC&q=" + encodeURIComponent(q) + (at ? "&at=" + at : "") + "&apiKey=" + encodeURIComponent(GEO_KEYS.here)
      : "https://api.tomtom.com/search/2/geocode/" + encodeURIComponent(q) + ".json?countrySet=GR&language=el-GR&limit=6" + (base ? "&lat=" + base.lat + "&lon=" + base.lng : "") + "&key=" + encodeURIComponent(GEO_KEYS.tomtom);
    const r = await fetch(url, { signal: ctrl.signal }); paidCount(svc);
    if (r.status === 401 || r.status === 403 || r.status === 429) { paidOff[svc] = r.status; return null; }   /* τέλος ορίου ή λάθος κλειδί */
    if (!r.ok) return null;
    const js = await r.json();
    if (svc === "here") return (js.items || []).filter(x => x.position).map(x => { const a = x.address || {}; return { lat: +x.position.lat, lng: +x.position.lng, type: x.resultType === "houseNumber" ? "house" : x.resultType === "street" ? "road" : x.resultType === "intersection" ? "cross" : "area", num: x.resultType === "houseNumber", label: a.label ? a.label.replace(/,\s*Ελλάδα$/, "") : "", town: a.district || a.city || "", where: [a.district, a.city, a.county, a.subdistrict].filter(Boolean).join(" ") }; });
    return (js.results || []).filter(x => x.position).map(x => { const a = x.address || {}; return { lat: +x.position.lat, lng: +x.position.lon, type: x.type === "Point Address" ? "house" : x.type === "Address Range" ? "range" : x.type === "Street" ? "road" : x.type === "Cross Street" ? "cross" : "area", num: x.type === "Point Address", label: a.freeformAddress || "", town: a.municipalitySubdivision || a.municipality || "", where: [a.municipalitySubdivision, a.municipality, a.localName, a.countrySecondarySubdivision, a.countrySubdivision].filter(Boolean).join(" ") }; });
  } catch { return null; } finally { clearTimeout(tm); }
}
/* σύγκριση περιοχών και όταν η υπηρεσία απαντά με λατινικά (π.χ. «Athina» = «Αθήνα», «Nea Peramos» = «Νέα Πέραμος») */
const GR2L = { α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o" };
const GRDI = [[/ου/g, "u"], [/αι/g, "e"], [/ει|οι|υι/g, "i"], [/αυ/g, "av"], [/ευ/g, "ev"], [/μπ/g, "b"], [/ντ/g, "d"], [/γκ|γγ/g, "g"]];
const LADI = [[/ou/g, "u"], [/ai/g, "e"], [/ei|oi|yi/g, "i"], [/a[uf]/g, "av"], [/e[uf]/g, "ev"], [/mp/g, "b"], [/nt/g, "d"], [/gk|gg/g, "g"], [/ch|kh/g, "h"], [/y/g, "i"], [/ks/g, "x"], [/(.)\1/g, "$1"]];
const latn = t => { let x = K.norm(t); for (const [r, w] of GRDI) x = x.replace(r, w); x = x.replace(/[α-ως]/g, ch => GR2L[ch] || ch); for (const [r, w] of LADI) x = x.replace(r, w); return x.replace(/[^a-z0-9]+/g, " ").trim(); };
const inArea = (where, area) => { if (!area) return true; const w = latn(where), a = latn(area); return !w || w.includes(a); };
async function geoFind(q, ctx) {
  ctx = ctx || {};
  const area0 = String(ctx.area || "").trim(), k0 = K.norm(String(q || "").trim() + "|" + area0), G0 = geoMem();
  const old = G0[k0];
  /* θέση από επί πληρωμή υπηρεσία: ισχύει 30 ημέρες (όροι χρήσης), μετά ξαναψάχνεται */
  const stale = old && old.src && old.at && Date.now() - old.at > PAID_TTL;
  if (old && old.src && old.lat != null && !stale) return old;   /* φρέσκια θέση από HERE/TomTom: δεν ξαναρωτάμε (ούτε με «Έλεγχο») */
  const r = await geoFindFree(q, stale ? Object.assign({}, ctx, { force: true }) : ctx);
  if (!GEO_KEYS.here && !GEO_KEYS.tomtom) return r;
  const g = G0[k0];
  const unsure = !r || (g && (g.approx || (g.amb && g.amb.length > 1) || g.nonum || g.off));
  if (!unsure || (g && g.src && !stale && !ctx.force)) return r;
  if (!ctx.force && !stale && g && g.paidTried && Date.now() - g.paidTried < PAID_TTL) return r;   /* ψάχτηκε ήδη στις επί πληρωμή: όχι ξανά */
  /* οι δωρεάν δεν βρήκαν σίγουρα: HERE και, αν αρνηθεί, TomTom — μία αναζήτηση ανά διεύθυνση, ακόμα κι αν ζητηθεί ταυτόχρονα */
  if (paidFly[k0]) return paidFly[k0];
  const p = geoFindPaid(q, ctx, area0, k0, r); paidFly[k0] = p;
  try { return await p; } finally { delete paidFly[k0]; }
}
const paidFly = {};
async function geoFindPaid(q, ctx, area0, k0, r) {
  const G0 = geoMem();
  const base = ctx.noBase ? null : await geoBase();
  const qq = geoClean(String(q).trim()) + (area0 && !K.norm(String(q)).includes(K.norm(area0)) ? ", " + area0 : "");
  let answered = false;
  for (const svc of ["here", "tomtom"]) {
    const L = await geoPaidAsk(svc, qq, base);
    if (L) answered = true;
    if (!L || !L.length) { if (L) break; continue; }   /* απάντησε «τίποτα»: δεν ρωτάμε και τη δεύτερη */
    /* μόνο δρόμος ή πόρτα — ποτέ σκέτη πόλη/περιοχή (το «κέντρο της Αθήνας» είναι το Σύνταγμα) */
    let near = (base ? L.filter(x => geoKm(base, x) <= 150) : L).filter(x => x.type !== "area"); if (!near.length) break;
    /* μόνο μέσα στην περιοχή του πελάτη (π.χ. όχι «Ypatis 9, Nea Peramos» για «Υπάτης 9, Αθήνα») */
    if (area0) { const inA = near.filter(x => inArea(x.where + " " + x.label + " " + x.town, area0)); if (!inA.length) continue; near = inA; }
    const best = near.find(x => x.num) || near[0];
    const out = { lat: best.lat, lng: best.lng, src: svc, at: Date.now(), via: svc, lbl: String(best.label || "").slice(0, 90), town: String(best.town || "").slice(0, 60) };
    if (!best.num && /\d/.test(q)) out.nonum = 1;
    if (!area0) { const A = geoClusters(near.filter(x => x.type === best.type), base, best); if (A.length > 1) out.amb = A; }
    G0[k0] = out; return out;
  }
  if (answered && G0[k0]) G0[k0].paidTried = Date.now();   /* αν όλες αρνήθηκαν (όριο), ξαναδοκιμάζει αργότερα */
  return r;
}
async function geoFindFree(q, ctx) {
  ctx = ctx || {};
  q = String(q || "").trim(); if (!q) return null;
  const ll = /^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/.exec(q); if (ll) return { lat: +ll[1], lng: +ll[2] };
  const area = String(ctx.area || "").trim(), force = !!ctx.force;
  const k = K.norm(q + "|" + area), G = geoMem();
  if (!force && G[k] && G[k].lat != null) return G[k];
  if (!force && G[k] && G[k].miss && Date.now() - G[k].miss < GEO_MISS) return null;
  const base = ctx.noBase ? null : await geoBase(), FAR = 150;
  const full = geoClean(q), parts = full.split(",").map(x => x.trim()).filter(Boolean);
  const hasArea = area && K.norm(full).includes(K.norm(area));
  const town = area || (parts.length > 1 ? parts[parts.length - 1] : "");
  const street = parts[0] || "", noNum = street.replace(/\s+\d+[α-ωa-z]?$/i, "").replace(/^\d+\s+/, "");
  const noOdos = s => s.replace(/(^|,\s*)Οδός\s+/g, "$1");
  const tries = [];
  const add = (t, approx) => { t = t.replace(/\s+/g, " ").trim(); if (t && !tries.some(x => x.t === t)) tries.push({ t, approx }); };
  if (area && !hasArea) add(full + ", " + area, false);
  add(full, false);
  if (/Οδός/.test(full)) add(noOdos(area && !hasArea ? full + ", " + area : full), false);
  if (town && noNum && noNum !== street) add(noOdos(noNum) + ", " + town, false);
  /* χωρίς περιοχή: ο δρόμος χωρίς αριθμό, ο πιο κοντινός στην έδρα */
  if (!town && noNum && noNum !== street && base) add(noOdos(noNum), false);
  let failedNet = false;
  const pick = (L, approx) => {
    let ref = base;
    if (!ref && L.length > 1 && town && !approx && G["πόλη|" + K.norm(town)] && G["πόλη|" + K.norm(town)].lat != null) ref = G["πόλη|" + K.norm(town)];
    const best = ref ? L.slice().sort((a, b) => geoKm(ref, a) - geoKm(ref, b))[0] : L[0];
    if (base && geoKm(base, best) > FAR && !approx) return null;   /* πολύ μακριά: μάλλον λάθος ομώνυμος δρόμος */
    return best;
  };
  const paidFresh = () => G[k] && G[k].src && G[k].lat != null && G[k].at && Date.now() - G[k].at < PAID_TTL;
  /* η δωρεάν απάντηση δεν πατά ποτέ φρέσκια απάντηση της HERE/TomTom (π.χ. που ήρθε στο μεταξύ από το παρασκήνιο) */
  /* βρέθηκε έξω από την περιοχή του πελάτη; (π.χ. «Υπάτης 9, Αθήνα» → Νέα Πέραμος) */
  const offArea = best => { if (!area || !best) return ""; const w = (best.where || "") + " " + (best.label || "") + " " + (best.town || ""); if (!K.norm(w).trim()) return "";   /* καμία πληροφορία περιοχής: δεν κρίνουμε */ return inArea(w, area) ? "" : (best.town || String(best.label || "").split(",").slice(-1)[0] || "άλλη περιοχή").trim(); };
  const keep = (best, approx, via) => { if (paidFresh()) return G[k]; G[k] = { lat: best.lat, lng: best.lng, via: via || "osm", lbl: String(best.label || "").slice(0, 90), town: String(best.town || "").slice(0, 60) }; if (approx) G[k].approx = 1; return G[k]; };
  /* για δρόμο: όχι πόλεις και χωριά με παρόμοιο όνομα (π.χ. «Υπάτης» → η πόλη Υπάτη) */
  const PLACE = /^(city|town|village|hamlet|municipality|county|state|region|country|administrative|postcode|island|locality|district)$/;
  const streetOnly = L => L.filter(x => !PLACE.test(x.type || ""));
  for (const tr of tries) {
    let L = await geoAsk(tr.t, force); if (L === null) { failedNet = true; continue; }
    L = streetOnly(L);
    if (!L.length) continue;
    if (area) { const inA = L.filter(x => !offArea(x)); if (inA.length) L = inA; }   /* πρώτα όσα είναι στην περιοχή του πελάτη */
    /* χωρίς έδρα: άγκυρα η πόλη, για να μη διαλέξει ομώνυμο δρόμο σε άλλη περιοχή */
    if (!base && L.length > 1 && town) { const tk = "πόλη|" + K.norm(town); if (!G[tk]) { const T = await geoAsk(town); G[tk] = T && T[0] ? { lat: T[0].lat, lng: T[0].lng } : { miss: Date.now() }; } }
    const best = pick(L, false); if (best) { const r = keep(best, false); if (r.src) return r; if (/\d/.test(street) && !best.num) r.nonum = 1; { const o = offArea(best); if (o) r.off = o; } if (!area) { const A = geoClusters(L, base, best); if (A.length > 1) r.amb = A; } return r; }
  }
  /* δεύτερη γνώμη */
  let PL = await geoPhoton(area && !hasArea ? full + ", " + area : full, base);
  if (PL) PL = streetOnly(PL);
  if (PL && !PL.length && base && noNum) { const P2 = await geoPhoton(noOdos(noNum) + (town ? ", " + town : ""), base); if (P2) PL = streetOnly(P2); }   /* μόνο ο δρόμος, κοντά στην έδρα */
  if (PL && area) { const inA = PL.filter(x => !offArea(x)); if (inA.length) PL = inA; }
  if (PL === null) failedNet = true;
  else if (PL.length) { const best = pick(PL, false); if (best) { const r = keep(best, false, "photon"); if (r.src) return r; if (/\d/.test(street) && !best.num) r.nonum = 1;
      { const o = offArea(best); if (o) r.off = o; }   /* έξω από την περιοχή του πελάτη: αβέβαιο → ρωτιέται και η TomTom */ if (!area) { const A = geoClusters(PL, base, best); if (A.length > 1) r.amb = A; } return r; } }
  /* τελευταία λύση: το κέντρο της περιοχής, «κατά προσέγγιση» */
  if (town) { const L = await geoAsk(town, force); if (L === null) failedNet = true; else if (L.length) { const best = pick(L, true); if (best) return keep(best, true); } }
  if (paidFresh()) return G[k];
  if (!failedNet) G[k] = { miss: Date.now() };
  return null;
}
/* η περιοχή συμπληρώνεται μόνη της όταν λείπει (πορτοκαλί, «αυτόματα», για να φαίνεται αν είναι λάθος) */
function custAutoArea(c, r) {
  if (!c || c.area || !r || r.approx || (r.amb && r.amb.length > 1) || !r.town) return false;
  const G = geoMem(), k0 = geoKey(c.addr, ""), area = r.town;
  c.area = area; c.areaAuto = 1;
  const k1 = geoKey(c.addr, area); if (!G[k1] && G[k0]) G[k1] = G[k0];   /* ίδια θέση και με το νέο κλειδί: δεν ξαναψάχνεται */
  return true;
}
const custGeo = async c => { const r = await geoFind(c.addr, { area: c.area }); if (custAutoArea(c, r)) { try { save(); } catch {} } return r; };
const geoKey = (addr, area) => K.norm(String(addr || "").trim() + "|" + String(area || "").trim());
/* «Ποια από όλες;» — διαλέγεις τη σωστή διεύθυνση όταν υπάρχουν ίδιες σε πολλές περιοχές */
function geoAmbSheet(addr, area, ck, after) {
  const k = geoKey(addr, area), g = geoMem()[k]; if (!g || !g.amb) { if (after) after(); return; }
  const c = ck && S.customers[ck];
  sheet("❓ Ποια διεύθυνση;", `<div class="warnbox" style="margin-top:0">Βρέθηκαν <b>${g.amb.length}</b> δρόμοι «${esc(addr)}» σε διαφορετικές περιοχές${c ? " για τον/την <b>" + esc(c.name) + "</b>" : ""}. Διάλεξε τη σωστή· θα τη θυμάται.</div>
   <div class="ambl">${g.amb.map((a, i) => `<button type="button" class="ambo" data-ambpick="${i}"><span class="ambn">${i + 1}</span><span class="t"><b>${esc(a.label || addr)}</b><small>${a.town ? "📍 " + esc(a.town) : ""}${a.km != null ? (a.town ? " · " : "") + a.km + " χλμ. από την έδρα" : ""}</small></span><span class="g">›</span></button>`).join("")}</div>
   <p class="note">Δεν είναι καμία; ${c ? `<a href="#" data-ambcust="${esc(ck)}">Γράψε την περιοχή στην καρτέλα του πελάτη</a>` : "Γράψε τη διεύθυνση μαζί με την περιοχή"} (π.χ. «${esc(addr)}, Μαρούσι»)${c ? `, ή <a href="#" data-ambmap="${esc(ck)}">βάλ' το μόνος σου στον χάρτη</a>` : ""}.</p>`, "",
   el => { el.dataset.ambk = k; el.dataset.ambck = ck || ""; });
  A._ambAfter = after || null;
}
/* συντεταγμένες από ό,τι επικολλήσεις: «37.98, 23.72», σύνδεσμο Google Maps με @…, q=…, !3d…!4d… */
/* Θέση από ό,τι κι αν επικολλήσεις (όπως στο Fish IQ): 37.98380, 23.72750 · 37,98380, 23,72750 (ελληνικό κόμμα) ·
   37,98380 23,72750 · 37°59'01.7"N 23°43'39.0"E · 37,98380° Β, 23,72750° Α (Χάρτες iPhone) · N 37° 59.017' E 23° 43.650' ·
   σύνδεσμοι Google Maps (!3d!4d, @, q=, query=, ll=, destination=) · Apple Maps (?ll= / ?q= / &sll=) · Plus Code (8G95WQRF+X2 ή WQRF+X2 Αθήνα) */
const OLC_A = "23456789CFGHJMPQRVWX", OLC_R = [20, 1, .05, .0025, .000125];
function olcFull(code) {
  code = code.toUpperCase(); const sep = code.indexOf("+"); if (sep !== 8) return null;
  const s = code.replace("+", "").replace(/0+$/, ""); let lat = -90, lng = -180, n = 0;
  for (let i = 0; i + 1 < s.length && n < 5; i += 2, n++) { const a = OLC_A.indexOf(s[i]), b = OLC_A.indexOf(s[i + 1]); if (a < 0 || b < 0) return null; lat += a * OLC_R[n]; lng += b * OLC_R[n]; }
  if (!n) return null; return { lat: lat + OLC_R[n - 1] / 2, lng: lng + OLC_R[n - 1] / 2 };
}
function olcShort(code, ref) {
  code = code.toUpperCase(); const sep = code.indexOf("+"); if (sep < 2 || sep > 7 || sep % 2) return null;
  const pad = 8 - sep, res = Math.pow(20, 2 - pad / 2); let la = Math.min(89.99, Math.max(-90, ref.lat)) + 90, ln = ((ref.lng + 180) % 360 + 360) % 360, pre = "";
  for (let p = 0; p < pad / 2; p++) { const a = Math.floor(la / OLC_R[p]), b = Math.floor(ln / OLC_R[p]); la -= a * OLC_R[p]; ln -= b * OLC_R[p]; pre += OLC_A[a] + OLC_A[b]; }
  const g = olcFull(pre + code); if (!g) return null;
  if (ref.lat + res / 2 < g.lat && g.lat - res >= -90) g.lat -= res; else if (ref.lat - res / 2 > g.lat && g.lat + res <= 90) g.lat += res;
  if (ref.lng + res / 2 < g.lng) g.lng -= res; else if (ref.lng - res / 2 > g.lng) g.lng += res;
  return g;
}
function parseLL(t, ref) {
  t = String(t || "").trim(); if (!t) return null;
  try { if (/%[0-9a-f]{2}/i.test(t)) t = decodeURIComponent(t.replace(/\+/g, " ")); } catch {}
  const num = x => +String(x).replace(",", "."), okp = (lat, lng) => {
    if (!isFinite(lat) || !isFinite(lng)) return null;
    if (lat > 19 && lat < 30.5 && lng > 34 && lng < 42) [lat, lng] = [lng, lat];   /* ανάποδα (μήκος, πλάτος) */
    return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat || lng) ? { lat: +lat.toFixed(7), lng: +lng.toFixed(7) } : null; };
  const D = "(-?\\d{1,3}(?:[.,]\\d+)?)", pair = re => { const m = re.exec(t); return m ? okp(num(m[1]), num(m[2])) : null; };
  let p = pair(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/)
    || pair(/[?&#](?:q|query|ll|sll|destination|daddr|center|coordinate|loc|location)=(?:loc:)?\s*(-?\d{1,3}\.\d+)\s*(?:,|\s)\s*(-?\d{1,3}\.\d+)/i)
    || pair(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/)
    || pair(/\/maps\/(?:place|search|dir)\/[^@]*?(-?\d{1,3}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/);
  if (p) return p;
  /* μοίρες: με ή χωρίς λεπτά/δεύτερα, γράμμα πριν ή μετά (N/S/E/W ή Β/Ν/Α/Δ) */
  const H = "NSEWnsewΒΝΑΔβναδ", re = new RegExp(`([${H}])?\\s*(\\d{1,3}(?:[.,]\\d+)?)\\s*[°º˚]\\s*(?:(\\d{1,2}(?:[.,]\\d+)?)\\s*['′’´]\\s*)?(?:(\\d{1,2}(?:[.,]\\d+)?)\\s*(?:["″”]|''|′′)\\s*)?([${H}](?![a-zα-ω]))?`, "g");
  const dm = [...t.matchAll(re)];
  if (dm.length >= 2) {
    const v = m => { const h = (m[1] || m[5] || "").toUpperCase(); const x = num(m[2]) + (m[3] ? num(m[3]) / 60 : 0) + (m[4] ? num(m[4]) / 3600 : 0); return { x: /[SWΝΔ]/.test(h) ? -x : x, ew: /[EWΑΔ]/.test(h) }; };
    const a = v(dm[0]), b = v(dm[1]); p = a.ew && !b.ew ? okp(b.x, a.x) : okp(a.x, b.x); if (p) return p;
  }
  /* Plus Code */
  let m = /(?:^|[^0-9A-Z])([23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2,3})(?![0-9A-Z])/i.exec(t);
  if (m) { p = olcFull(m[1]); if (p) return okp(p.lat, p.lng); }
  m = /(?:^|[^0-9A-Z])([23456789CFGHJMPQRVWX]{4,6}\+[23456789CFGHJMPQRVWX]{2,3})(?![0-9A-Z])/i.exec(t);
  if (m) { p = olcShort(m[1], ref || { lat: 37.9755, lng: 23.7348 }); if (p) return okp(p.lat, p.lng); }
  /* απλοί αριθμοί: με τελεία ή με ελληνικό κόμμα, χωρισμένοι με κόμμα, ερωτηματικό, κενό ή «/» */
  return pair(new RegExp(`(-?\\d{1,3}[.,]\\d{3,})\\s*[,;/]\\s*\\+?\\s*(-?\\d{1,3}[.,]\\d{3,})`))
    || pair(new RegExp(`(-?\\d{1,3}[.,]\\d{3,})[\\s+]+(-?\\d{1,3}[.,]\\d{3,})`))
    || pair(new RegExp(`(-?\\d{1,3}[.,]\\d{3,})\\D{1,12}?(-?\\d{1,3}[.,]\\d{3,})`));
}
/* «Από Google Maps»: το βρίσκεις εκεί και φέρνεις μόνο τη θέση — χωρίς κλειδί και χωρίς κάρτα.
   Όπως στο Fish IQ: δέχεται κάθε μορφή (και ελληνικό κόμμα), κουμπί επικόλλησης, οδηγίες για Android και iPhone, «Είμαι εδώ», «Στον χάρτη». */
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const gmRef = c => (c && custGeoCached(c)) || (S.shop.pin && S.shop.pin.lat != null ? S.shop.pin : null) || { lat: 37.9755, lng: 23.7348 };
const inGR = p => p.lat > 34 && p.lat < 42 && p.lng > 19 && p.lng < 30.5;
const gmShortLink = t => /(?:goo\.gl|maps\.app|g\.co\/|maps\.apple\/p|apple\.co\/|share\.google)/i.test(t);
function gmPreview(c) {
  const el = $("#gmPv"), t = ($("#gmLL") || {}).value || ""; if (!el) return;
  if (!t.trim()) { el.className = "gmpv"; el.innerHTML = ""; return; }
  const p = parseLL(t, gmRef(c));
  if (!p) { el.className = "gmpv bad"; el.innerHTML = gmShortLink(t) ? "⚠️ Αυτός ο σύντομος σύνδεσμος δεν έχει μέσα αριθμούς. Αντέγραψε τους <b>αριθμούς</b> της καρφίτσας (βήμα 2)." : "❌ Δεν βρίσκω θέση εδώ μέσα ακόμη."; return; }
  el.className = "gmpv " + (inGR(p) ? "good" : "bad");
  el.innerHTML = `${inGR(p) ? "✓ Βρέθηκε" : "⚠️ Έξω από την Ελλάδα"}: <b>${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</b> · <a href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}" target="_blank" rel="noopener">δες το</a>`;
}
function gmSheet(k) {
  const c = S.customers[k]; if (!c) return;
  const q = [c.addr, c.area].filter(Boolean).join(", "), ios = isIOS(), qe = encodeURIComponent(q || c.name);
  const gBtn = `<a class="btn soft wide" href="https://www.google.com/maps/search/?api=1&query=${qe}" target="_blank" rel="noopener">🗺 Google Maps</a>`,
    aBtn = `<a class="btn soft wide" href="https://maps.apple.com/?q=${qe}" target="_blank" rel="noopener">🍎 Χάρτες Apple</a>`;
  const andr = `<details class="gmdev"${ios ? "" : " open"}><summary>🤖 Android</summary><ol class="gmsteps">
      <li>Στο Google Maps <b>κράτα πατημένο</b> το σωστό σημείο (την πόρτα) μέχρι να πέσει κόκκινη καρφίτσα.</li>
      <li>Πάνω, στο κουτί αναζήτησης, φαίνονται αριθμοί, π.χ. <b>37,98380, 23,72750</b>. Πάτα τους → <b>Αντιγραφή</b>.</li></ol></details>`;
  const iph = `<details class="gmdev"${ios ? " open" : ""}><summary>📱 iPhone</summary><ol class="gmsteps">
      <li><b>Χάρτες Apple:</b> κράτα πατημένο το σημείο → πέφτει καρφίτσα → σήκωσε την κάρτα από κάτω → πάτα τους αριθμούς (π.χ. <b>37,98380° Β, 23,72750° Α</b>) → <b>Αντιγραφή</b>.</li>
      <li><b>Google Maps στο iPhone:</b> κράτα πατημένο το σημείο → οι αριθμοί βγαίνουν πάνω στο κουτί → πάτα τους → <b>Αντιγραφή</b>.</li>
      <li>Ή <b>Κοινοποίηση → Αντιγραφή</b> του συνδέσμου (αν δεν τον δέχεται, πάρε τους αριθμούς).</li></ol></details>`;
  sheet("🔗 Θέση από Google Maps", `<div class="card" style="margin-top:0">
    <p class="note" style="margin:0 0 6px">1. Άνοιξε τη διεύθυνση «<b>${esc(q || c.name)}</b>»:</p>
    <div class="row gmapps">${ios ? aBtn + gBtn : gBtn + aBtn}</div>
    <p class="note" style="margin:10px 0 4px">2. Κράτα πατημένο το σωστό σημείο, αντέγραψε τους αριθμούς, γύρνα εδώ και επικόλλησέ τους:</p>
    <div class="row gmin"><textarea class="t" id="gmLL" rows="2" placeholder="37,98380, 23,72750 ή σύνδεσμος" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea><button type="button" class="btn amber sm" data-act="gmPaste">📋 Επικόλληση</button></div>
    <div id="gmPv" class="gmpv"></div>
    <p class="note" style="margin:10px 0 4px"><b>❓ Πώς αντιγράφω τη θέση;</b></p>
    ${ios ? iph + andr : andr + iph}
    <p class="note" style="margin:6px 0 0">Δέχεται: αριθμούς με κόμμα ή τελεία, μοίρες (37°59'01"N), σύνδεσμο Google Maps ή Χαρτών Apple, Plus Code (π.χ. WQRF+X2).</p></div>
    <div class="card"><p class="note" style="margin:0 0 6px"><b>Ή αλλιώς:</b></p><div class="row"><button type="button" class="btn ghost sm grow" data-act="gmHere" style="flex:1 1 0">📍 Είμαι εκεί τώρα</button><button type="button" class="btn ghost sm grow" data-act="gmPick" style="flex:1 1 0">🗺 Πάτα στον χάρτη</button></div></div>`,
    `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-act="gmSave">✓ Κράτα τη θέση</button>`,
    el => { el.dataset.gmk = k; const i = el.querySelector("#gmLL"); if (i) i.addEventListener("input", () => gmPreview(c)); });
}
/* «Βάλ' το στον χάρτη»: πατάς το σωστό σημείο */
async function pickOnMap(k) {
  const c = S.customers[k]; if (!c) return;
  closeSheet();
  const Lf = await cmShow(); if (!Lf) return;
  cm.mode = "pick"; cm.stamp = Date.now();
  $("#cmT").textContent = "📍 " + c.name; $("#cmF").innerHTML = "";
  const bar = $("#cmBar"); bar.innerHTML = `<div class="grow"><b>Πάτα πάνω στον χάρτη</b> το σημείο του πελάτη${c.addr ? " (" + esc(c.addr) + ")" : ""}. Μεγέθυνε με δύο δάχτυλα.</div>`;
  if (cm.layer) cm.layer.remove(); cm.layer = Lf.layerGroup().addTo(cm.map);
  const g = custPin(k) || custGeoCached(c), st = g || await geoBase() || { lat: 37.9755, lng: 23.7348 };
  try { cm.map.setView([st.lat, st.lng], g ? 16 : 13); } catch {}
  if (cm.pickH && cm.map.off) cm.map.off("click", cm.pickH);
  let mk = null;
  cm.pickH = e => {
    if (cm.mode !== "pick") return;
    const p = e.latlng;
    if (mk) mk.setLatLng(p); else mk = Lf.marker([p.lat, p.lng], { icon: Lf.divIcon({ className: "jpin", iconSize: [34, 42], iconAnchor: [17, 41], html: pinSvg("#0B6E4F", "✓") }) }).addTo(cm.layer);
    bar.innerHTML = `<div class="grow">Εδώ είναι; Αν όχι, πάτα σε άλλο σημείο.</div><button type="button" class="btn sm green" id="pickOk">✓ Κράτα το</button>`;
    $("#pickOk").onclick = () => { c.pin = { lat: p.lat, lng: p.lng, at: Date.now() }; save(); if (cm.map.off) cm.map.off("click", cm.pickH); cm.mode = ""; cmClose(); toast("✓ Κρατήθηκε η θέση του πελάτη", 3000); setTimeout(() => openCust(k), 150); };
  };
  if (cm.map.on) cm.map.on("click", cm.pickH);
}
/* στάση που βρέθηκε μόνο ως περιοχή: δεν σε στέλνει στο κέντρο της πόλης χωρίς να ρωτήσει */
function rtApproxSheet(x) {
  sheet("❓ Δεν βρέθηκε ο δρόμος", `<div class="warnbox" style="margin-top:0">Για τον/την <b>${esc(x.name)}</b> («${esc(x.addr)}») ${(() => { const g = geoMem()[geoKey(x.addr, (S.customers[x.ck] || {}).area)] || {}; return g.off ? "η θέση βρέθηκε σε άλλη περιοχή («" + esc(g.off) + "») — μάλλον ομώνυμος δρόμος. Αν συνεχίσεις έτσι, θα σε πάει εκεί." : "βρέθηκε μόνο η περιοχή, όχι ο δρόμος. Αν συνεχίσεις έτσι, η διαδρομή θα σε πάει στο κέντρο της περιοχής."; })()}</div>
   <div class="ambl">
    <button type="button" class="ambo" data-rtap="pick"><span class="ambn">🗺</span><span class="t"><b>Βάλ' το στον χάρτη</b><small>πατάς το σωστό σημείο· το θυμάται για πάντα</small></span><span class="g">›</span></button>
    <button type="button" class="ambo" data-rtap="gm"><span class="ambn">🔗</span><span class="t"><b>Από Google Maps</b><small>αντιγράφεις τη θέση από εκεί</small></span><span class="g">›</span></button>
    <button type="button" class="ambo" data-rtap="skip"><span class="ambn">⏭</span><span class="t"><b>Χωρίς αυτή τη στάση</b><small>βγαίνει από τη σημερινή διαδρομή</small></span><span class="g">›</span></button>
    <button type="button" class="ambo" data-rtap="go"><span class="ambn">→</span><span class="t"><b>Συνέχεια έτσι</b><small>στο κέντρο της περιοχής (≈)</small></span><span class="g">›</span></button></div>`, "", el => { el.dataset.rtapk = x.key; el.dataset.rtapc = x.ck || ""; });
}
function ambFor(k) {
  const c = S.customers[k]; if (!c) return;
  try { cm.map && cm.map.closePopup(); } catch {}
  geoAmbSheet(c.addr, c.area, c.key, () => { if (tab === "map" && cm.map) cmDrawCust(false); else render(); });
}
function geoAmbPick(i) {
  const b = $("#shB"), k = b.dataset.ambk, ck = b.dataset.ambck, G = geoMem(), g = G[k]; if (!g || !g.amb || !g.amb[i]) return;
  const a = g.amb[i]; G[k] = { lat: a.lat, lng: a.lng, picked: Date.now() };
  const c = ck && S.customers[ck];
  if (c && geoKey(c.addr, c.area) === k) { c.pin = { lat: a.lat, lng: a.lng, at: Date.now() }; if (!c.area && a.town) c.area = a.town; }
  save(); closeSheet(); toast("✓ Κρατήθηκε: " + (a.label || a.town || ""), 3000);
  const f = A._ambAfter; A._ambAfter = null; if (f) setTimeout(f, 80); else render();
}
const custGeoCached = c => { const g = geoMem()[K.norm(String(c.addr || "").trim() + "|" + String(c.area || "").trim())]; return g && g.lat != null ? g : null; };
const custPin = k => { const c = S.customers[k]; return c && c.pin && c.pin.lat != null ? c.pin : null; };
function myPos() { return new Promise(res => { if (!navigator.geolocation) return res(null); navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }); }); }
/* --- σειρά στάσεων --- */
function rtTour(A, pts, B) {
  if (pts.length < 2) return pts.slice();
  const rest = pts.slice(), out = []; let cur = A;
  while (rest.length) { let bi = 0, bd = Infinity; rest.forEach((p, i) => { const d = rtKm(cur, p.loc); if (d < bd) { bd = d; bi = i; } }); cur = rest[bi].loc; out.push(rest.splice(bi, 1)[0]); }
  const len = L => { let s = 0, c = A; for (const p of L) { s += rtKm(c, p.loc); c = p.loc; } return s + (B ? rtKm(c, B) : 0); };
  let best = len(out), imp = true, g = 0;
  while (imp && g++ < 60) { imp = false;
    for (let i = 0; i < out.length - 1; i++) for (let j = i + 1; j < out.length; j++) {
      const t = out.slice(0, i).concat(out.slice(i, j + 1).reverse(), out.slice(j + 1)), l = len(t);
      if (l < best - 1e-6) { out.splice(0, out.length, ...t); best = l; imp = true; } } }
  return out;
}
function rtOrder(A, pts, B, mode) {
  if (mode === "time") {
    const timed = pts.filter(p => p.slot).sort((a, b) => (a.date || "").localeCompare(b.date || "") || slotTxt(a.slot).localeCompare(slotTxt(b.slot)));
    const free = pts.filter(p => !p.slot);
    const last = timed.length ? timed[timed.length - 1].loc : A;
    return timed.concat(rtTour(last, free, B));
  }
  if (mode === "area") {
    const g = new Map(); for (const p of pts) { if (!g.has(p.area)) g.set(p.area, []); g.get(p.area).push(p); }
    const groups = [...g.values()].map(L => ({ L, loc: { lat: L.reduce((a, p) => a + p.loc.lat, 0) / L.length, lng: L.reduce((a, p) => a + p.loc.lng, 0) / L.length } }));
    const order = rtTour(A, groups, B); let cur = A, out = [];
    order.forEach((gr, i) => { const nxt = order[i + 1] ? order[i + 1].loc : B; const t = rtTour(cur, gr.L, nxt); out = out.concat(t); if (t.length) cur = t[t.length - 1].loc; });
    return out;
  }
  return rtTour(A, pts, B);
}
/* πραγματικός δρόμος (δημόσια υπηρεσία OSRM): για «γρηγορότερη» ζητάμε και τη σειρά με τα λιγότερα λεπτά */
async function osrm(path, q) {
  if (!navigator.onLine) return null;
  if (rtNoToll()) { const r = await osrm0(path, q + "&exclude=toll"); if (r) return r; RT.tollWarn = true; }
  return osrm0(path, q);
}
async function osrm0(path, q) {
  const ctrl = new AbortController(), tm = setTimeout(() => ctrl.abort(), 12000);
  try { const r = await fetch("https://router.project-osrm.org/" + path + "?" + q, { signal: ctrl.signal }); const js = await r.json(); return js && js.code === "Ok" ? js : null; } catch { return null; } finally { clearTimeout(tm); }
}
const llq = L => L.map(p => p.lng.toFixed(6) + "," + p.lat.toFixed(6)).join(";");
async function rtFastOrder(A, pts, B, P) {
  if (pts.length < 3 || pts.length > 60) return null;
  if (!B && P.end !== "back") return null;   /* «τέλος στην τελευταία στάση»: η υπηρεσία δεν το υποστηρίζει — μένει η δική μας σειρά */
  const all = [A, ...pts.map(p => p.loc)].concat(B && P.end !== "back" ? [B] : []);
  const q = "overview=false&steps=false&source=first" + (P.end === "back" ? "&roundtrip=true" : "&roundtrip=false&destination=" + (B ? "last" : "any"));
  const js = await osrm("trip/v1/driving/" + llq(all), q);
  if (!js || !js.waypoints) return null;
  const ix = js.waypoints.map((w, i) => ({ i, o: w.waypoint_index })).filter(x => x.i >= 1 && x.i <= pts.length).sort((a, b) => a.o - b.o);
  return ix.length === pts.length ? ix.map(x => pts[x.i - 1]) : null;
}
async function rtGo() {
  if (RT.busy) return; const P = rtPref(), C = rtCands().filter(x => RT.sel.has(x.key) && x.addr);
  if (!C.length) { toast("Διάλεξε τουλάχιστον μία στάση."); return; }
  RT.busy = true; const btn = $('[data-rt="go"]'); const say = s => { if (btn) btn.textContent = s; };
  try {
    say("📍 Βρίσκω την αφετηρία…");
    let A = null, B = null;
    if (P.from === "me") { A = await myPos(); if (!A) { toast("Δεν βρέθηκε η θέση σου. Άνοιξε τον εντοπισμό ή διάλεξε «Έδρα».", 4500); return; } A.label = "Η θέση μου"; }
    else if (P.from === "base" && S.shop.pin && S.shop.pin.lat != null) A = { lat: S.shop.pin.lat, lng: S.shop.pin.lng, label: "Έδρα" };
    else { const q = P.from === "base" ? S.shop.addr : P.fromText; if (!q) { toast(P.from === "base" ? "Γράψε πρώτα τη διεύθυνση της έδρας στις ρυθμίσεις." : "Γράψε από πού ξεκινάς.", 4000); return; }
      A = await geoFind(q, { noBase: P.from === "base" }); if (!A) { toast("Δεν βρέθηκε στον χάρτη η αφετηρία «" + q + "». Γράψ' την πιο συγκεκριμένα, π.χ. με την πόλη.", 5000); return; } A = Object.assign({ label: P.from === "base" ? "Έδρα" : q }, A); }
    if (P.end === "back") B = Object.assign({}, A, { label: A.label });
    else if (P.end === "text") { if (!P.endText) { toast("Γράψε πού τελειώνεις."); return; } B = await geoFind(P.endText); if (!B) { toast("Δεν βρέθηκε στον χάρτη το «" + P.endText + "».", 5000); return; } B = Object.assign({ label: P.endText }, B); }
    /* στάσεις: ίδια διεύθυνση = μία στάση */
    const map = new Map(), miss = [];
    let i = 0;
    for (const x of C) {
      i++; say("📍 Βρίσκω τις διευθύνσεις… " + i + "/" + C.length);
      const loc = custPin(x.ck) || await geoFind(x.addr, { area: (S.customers[x.ck] || {}).area });
      if (!loc) { miss.push(x); continue; }
      if ((loc.approx || loc.off) && !custPin(x.ck) && !(RT.okApprox && RT.okApprox.has(x.key))) { RT.busy = false; say("🧭 Δείξε διαδρομή"); rtApproxSheet(x); return; }
      if (loc.amb && loc.amb.length > 1) { RT.busy = false; say("🧭 Δείξε διαδρομή"); toast("Η διεύθυνση του/της " + x.name + " υπάρχει σε πολλές περιοχές· διάλεξε ποια.", 4000); geoAmbSheet(x.addr, (S.customers[x.ck] || {}).area, x.ck, () => rtGo()); return; }
      const key = loc.lat.toFixed(4) + "," + loc.lng.toFixed(4);
      if (!map.has(key)) map.set(key, { key, loc, addr: x.addr, items: [], area: x.o ? areaOf(x.o) : ((S.customers[x.ck] || {}).area || x.addr.split(",").pop().trim()), slot: "", date: "" });
      const s = map.get(key); s.items.push(x);
      if (x.slot && (!s.slot || slotTxt(x.slot) < slotTxt(s.slot))) { s.slot = x.slot; s.date = x.date; }
    }
    let pts = [...map.values()];
    say("🧭 Βάζω σειρά στις στάσεις…");
    let order = null;
    if (P.mode === "fast" && P.real) order = await rtFastOrder(A, pts, B, P);
    pts = order || rtOrder(A, pts, B, P.mode);
    RT.res = { A, B, pts, miss, at: Date.now(), road: null }; RT.off = new Set(); RT.step = "res";
    save(); render(); window.scrollTo(0, 0);
  } finally { RT.busy = false; if ($('[data-rt="go"]')) render(); }
}
function rtActive() { return RT.res ? RT.res.pts.filter(p => !RT.off.has(p.key)) : []; }
function rtLine() { const R = RT.res, L = [R.A, ...rtActive().map(p => p.loc)]; if (R.B) L.push(R.B); return L; }
function rtEst() { const L = rtLine(); let k = 0; for (let i = 1; i < L.length; i++) k += rtKm(L[i - 1], L[i]); return { km: k, min: k / 32 * 60 + rtActive().length * 4 }; }
async function rtRefine() {
  const R = RT.res; if (!R || !rtPref().real) { rtMap(); return; }
  const L = rtLine(); if (L.length < 2) { rtMap(); return; }
  RT.tollWarn = false;
  const js = await osrm("route/v1/driving/" + llq(L), "overview=false&geometries=geojson&steps=true");
  if (RT.res !== R || llq(rtLine()) !== llq(L)) return;   /* άλλαξαν οι στάσεις στο μεταξύ: έρχεται νεότερη απάντηση */
  R.tried = llq(L);
  const rt = js && js.routes && js.routes[0];
  if (rt) {
    const legs = rt.legs.map(l => ({ km: l.distance / 1000, min: l.duration / 60, geo: (l.steps || []).flatMap(st => (st.geometry && st.geometry.coordinates) || []) }));
    const back = !!R.B && legs.length > 1, go = back ? legs.slice(0, -1) : legs, bk = back ? legs[legs.length - 1] : null;
    R.road = { km: rt.distance / 1000, min: rt.duration / 60, geoGo: go.flatMap(l => l.geo), geoBack: bk ? bk.geo : null, backKm: bk ? bk.km : 0, backMin: bk ? bk.min : 0, legs, sig: llq(L), noToll: rtNoToll() && !RT.tollWarn };
  } else R.road = null;
  const el = $("#rtSum"); if (el) el.innerHTML = rtSumHTML();
  rtLegs(); rtMap();
}
function rtSumHTML() {
  const R = RT.res, n = rtActive().length, e = rtEst(), road = R.road && R.road.sig === llq(rtLine()) ? R.road : null;
  const k = road ? road.km : e.km, m = road ? road.min + n * 4 : e.min;
  const leg = R.B ? `<div class="rtleg2"><span><i style="background:#0B6E4F"></i>Πήγαινε${road ? " " + rtFmtKm(road.km - road.backKm) + " · " + rtMin(road.min - road.backMin + n * 4) : ""}</span><span><i style="background:#E07A00"></i>Επιστροφή${road ? " " + rtFmtKm(road.backKm) + " · " + rtMin(road.backMin) : ""}</span></div>` : "";
  const tl = rtNoToll() ? (RT.tollWarn ? ` <span class="note" style="margin:0;color:#B45309">· η υπηρεσία δεν δέχτηκε «χωρίς διόδια», δείχνει κανονική διαδρομή</span>` : ` <span class="note" style="margin:0">· χωρίς διόδια</span>`) : "";
  const ppl = rtActive().reduce((a, p) => a + Math.max(1, rtPeople(p).length), 0);
  return leg + `<b>${n === 1 ? "1 στάση" : n + " στάσεις"}</b>${ppl > n ? ` <span class="note" style="margin:0">(${ppl} πελάτες)</span>` : ""} · ${road ? "" : "περίπου "}${rtFmtKm(k)} · ${rtMin(m)}${tl}${road ? ` <span class="note" style="margin:0">(πραγματικός δρόμος, μαζί με 4 λεπτά ανά στάση)</span>` : rtPref().real && R.tried !== llq(rtLine()) ? ` <span class="note" style="margin:0">υπολογίζω πραγματικό δρόμο…</span>` : ` <span class="note" style="margin:0">εκτίμηση σε ευθεία</span>`}`;
}
const gmLL = p => p.lat.toFixed(6) + "," + p.lng.toFixed(6);
function rtGmaps() {
  /* οι Χάρτες Google δέχονται έως 9 ενδιάμεσες στάσεις, οπότε η διαδρομή χωρίζεται σε κομμάτια */
  const R = RT.res, S2 = rtActive(), L = S2.map(p => p.loc).concat(R.B ? [R.B] : []), out = [];
  let start = R.A, i = 0, part = 1;
  while (i < L.length) { const chunk = L.slice(i, i + 10), dest = chunk[chunk.length - 1], wp = chunk.slice(0, -1);
    const url = rtNoToll()
      ? "https://www.google.com/maps?saddr=" + gmLL(start) + "&daddr=" + chunk.map(gmLL).join("+to:") + "&dirflg=t"
      : "https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=" + gmLL(start) + "&destination=" + gmLL(dest) + (wp.length ? "&waypoints=" + encodeURIComponent(wp.map(gmLL).join("|")) : "");
    { const NM = rtNums(), a0 = S2[i], b0 = S2[Math.min(i + chunk.length, S2.length) - 1]; out.push({ part, from: a0 && NM.get(a0.key) ? NM.get(a0.key).a : i + 1, to: b0 && NM.get(b0.key) ? NM.get(b0.key).b : Math.min(i + chunk.length, S2.length), url }); }
    start = dest; i += chunk.length; part++; }
  return out;
}
function rtResHTML() {
  const R = RT.res, P = rtPref(), NM = rtNums(); let n = 0, li = 0;
  const legSpan = off => off ? "" : `<span class="rleg" data-rtleg="${li++}"></span>`;
  const node = p => { const off = RT.off.has(p.key); if (!off) n++;
    const itm = x => {
      if (x.kind === "del") { const o = S.orders.find(y => y.id === x.o.id) || x.o; const doneNow = o.st === "done";
        return `<div class="rtit"><div><b>#${o.no}</b> ${esc(o.lines.map(l => K.num(l.q) + " " + l.unit + " " + l.name).join(" · "))}${o.when.slot ? ` · 🕘 ${esc(o.when.slot)}` : ""}</div>
         <div class="rtst">${doneNow ? `<span class="pill done">✓ Παραδόθηκε</span>` : `<span class="pill todo">🚚 Προς παράδοση</span>`}${!owes(o) ? `<span class="pill paid">✓ Πληρωμένη</span>` : `<span class="pill owe">💶 Να εισπραχθούν ${K.money(dueOf(o))}</span>`}</div>
         <div class="rtbtns">${doneNow ? "" : `<button type="button" class="btn sm green" data-rtdone="${o.id}">✓ Έγινε η παράδοση</button>`}${owes(o) ? `<button type="button" class="btn sm red" data-rtpaid="${o.id}">💶 Εισπράχθηκαν</button>` : ""}<button type="button" class="btn sm ghost" data-dvo="${o.id}">Άνοιγμα</button></div></div>`; }
      if (x.kind === "vis") return `<div class="rtit">👋 Επίσκεψη <button type="button" class="btn sm ghost" data-rtcard="${esc(x.ck)}" style="margin-left:6px">📇 Καρτέλα</button></div>`;
      const owed = custStats(x.ck).owed;
      return owed > 0 ? `<div class="rtit owe"><div class="rtowe">🔴 ΓΙΑ ΕΙΣΠΡΑΞΗ · χρωστά <b>${K.money(owed)}</b></div><div class="rtbtns"><button type="button" class="btn sm red" data-rtpay="${esc(x.ck)}">💶 Είσπραξη (ολική ή μερική)</button></div></div>` : `<div class="rtit"><span class="pill paid">✓ Εξοφλήθηκε</span></div>`; };
    const PP = rtPeople(p), rn = NM.get(p.key);
    const lines = PP.length > 1 ? `<div class="rtmany">👥 ${PP.length} πελάτες στο ίδιο σημείο</div>` + PP.map((pp, j) => { const o0 = (pp.items.find(x => x.o) || {}).o, ph2 = o0 ? o0.cust.phone : (S.customers[pp.ck] || {}).phone;
      return `<div class="rtper"><div class="rtph"><span class="rtpn">${off ? "–" : rn.a + j}</span><b class="grow">${esc(pp.name)}</b>${ph2 && !off ? `<a href="tel:${esc(ph2)}" aria-label="Κλήση">📞</a>` : ""}</div>${pp.items.map(itm).join("")}</div>`; }).join("") : p.items.map(itm).join("");
    const names = [...new Set(p.items.map(x => x.name))].join(", "), ph = p.items[0].o ? p.items[0].o.cust.phone : (S.customers[p.items[0].ck] || {}).phone;
    const payOnly = p.items.every(x => x.kind === "pay");
    return `<div class="node${off ? " off" : ""}"><div class="rail"><div class="pin${rn && rn.b > rn.a ? " multi" : ""}"${payOnly && !off ? ' style="background:#C8412B"' : ""}>${off ? "–" : rtLbl(rn)}</div></div><div class="body">${legSpan(off)}
      <div class="rthead"><div class="title">${esc(names)}</div><span class="rtic">${off ? "" : `${ph && PP.length < 2 ? `<a href="tel:${esc(ph)}" aria-label="Κλήση">📞</a>` : ""}<a href="https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${gmLL(p.loc)}" target="_blank" rel="noopener" aria-label="Πλοήγηση μόνο εδώ">🧭</a>`}<button type="button" data-rtoff="${esc(p.key)}" aria-label="${off ? "Βάλ' την ξανά" : "Παράλειψη στάσης"}" title="${off ? "Βάλ' την ξανά" : "Παράλειψη στάσης"}">${off ? "↩" : "⏭"}</button></span></div><div class="meta">📍 ${esc(p.addr)}</div>${off ? "" : lines}</div></div>`; };
  const G = rtGmaps();
  return `<div class="row" style="margin:2px 2px 10px;align-items:center"><button type="button" class="btn soft sm" data-rt="back">‹ Στάσεις</button><h2 style="margin:0 0 0 6px;font-size:20px" class="grow">🚐 Διαδρομή</h2></div>
   ${TOLLS_ON ? `<div class="seg rtseg" style="margin-bottom:8px">${[[true, "🛣 Με διόδια"], [false, "🚫 Χωρίς διόδια"]].map(([k, l]) => `<button type="button" class="${(P.tolls !== false) === k ? "on" : ""}" data-rttoll="${k ? 1 : 0}">${l}</button>`).join("")}</div>` : ""}
   <div class="card" id="rtSum" style="padding:12px 14px">${rtSumHTML()}</div>
   <div class="rtmapw"><div id="rtMap" class="rtmap"></div><button type="button" class="rtfull" data-rt="full">⛶ Όλη η οθόνη</button></div>
   <div class="rtnav">${G.map(g => `<a class="btn amber wide" href="${esc(g.url)}" target="_blank" rel="noopener">🧭 Πλοήγηση${G.length > 1 ? ` · μέρος ${g.part} (στάσεις ${g.from}–${g.to})` : " στους Χάρτες Google"}</a>`).join("")}</div>
   ${G.length > 1 ? `<p class="note">Οι Χάρτες Google δέχονται έως 10 στάσεις κάθε φορά, γι’ αυτό η διαδρομή άνοιξε σε ${G.length} κομμάτια. Όταν τελειώσεις το πρώτο, πάτα το επόμενο.</p>` : ""}
   <div class="card route">
    <div class="node"><div class="rail"><div class="pin end">Α</div></div><div class="body"><div class="title">${esc(R.A.label)}</div><div class="meta">Αφετηρία</div></div></div>
    ${R.pts.map(node).join("")}
    ${R.B ? `<div class="node"><div class="rail"><div class="pin end">Β</div></div><div class="body">${legSpan(false)}<div class="title">${esc(R.B.label)}</div><div class="meta">${P.end === "back" ? "Επιστροφή" : "Τέλος"}</div></div></div>` : ""}
   </div>
   ${R.miss.length ? `<div class="errbox"><b>Δεν βρέθηκαν στον χάρτη (${R.miss.length}):</b>${R.miss.map(x => `<div style="margin-top:6px">${esc(x.name)} · ${esc(x.addr)} <a href="#" data-rtcust="${esc(x.ck)}">διόρθωση διεύθυνσης</a></div>`).join("")}<p class="note" style="margin:6px 0 0">Γράψε τη διεύθυνση με οδό, αριθμό και πόλη, ή όταν είσαι εκεί πάτα «📍 Είμαι εδώ» στην καρτέλα του πελάτη.</p></div>` : ""}
   <p class="note">Η σειρά βγήκε ${P.mode === "fast" ? "με τα λιγότερα λεπτά οδήγησης" : P.mode === "time" ? "με βάση την ώρα παράδοσης" : "ανά περιοχή"}. Οι θέσεις βρίσκονται από τις διευθύνσεις με το OpenStreetMap και ο δρόμος με τη δημόσια υπηρεσία OSRM.</p>`;
}
/* --- χάρτης (Leaflet, φορτώνει μόνο όταν χρειαστεί) --- */
let lfP = null, rtMapObj = null;
function loadLeaflet() {
  if (window.L && window.L.map) return Promise.resolve(window.L);
  if (lfP) return lfP;
  lfP = new Promise((res, rej) => {
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"; document.head.appendChild(css);
    const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"; s.onload = () => res(window.L); s.onerror = () => { lfP = null; rej(); }; document.head.appendChild(s);
  });
  return lfP;
}
async function rtMap() {
  const box = $("#rtMap"), R = RT.res; if (!box || !R) return;
  let Lf; try { Lf = await loadLeaflet(); } catch { box.innerHTML = `<p class="note" style="padding:12px">Ο χάρτης δεν φόρτωσε (χωρίς σύνδεση;). Η σειρά και η πλοήγηση δουλεύουν κανονικά.</p>`; return; }
  if (!document.body.contains(box)) return;
  if (rtMapObj) { try { rtMapObj.remove(); } catch {} rtMapObj = null; }
  const M = rtMapObj = Lf.map(box, { zoomControl: true, attributionControl: true });
  Lf.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(M);
  if (M.on) M.on("popupopen", e => mpBind(e.popup.getElement()));
  rtDrawOn(Lf, M, false);
}
/* κουμπιά μέσα στο αναδυόμενο της πινέζας */
function mpBind(el) {
  if (!el) return;
  el.querySelectorAll("[data-mpc]").forEach(b => b.onclick = ev => { ev.preventDefault(); openCust(b.dataset.mpc); });
  el.querySelectorAll("[data-mpn]").forEach(b => b.onclick = ev => { ev.preventDefault(); const c = S.customers[b.dataset.mpn]; if (c) orderForm({ name: c.name, phone: c.phone, addr: c.addr || "" }); });
  el.querySelectorAll("[data-mpo]").forEach(b => b.onclick = ev => { ev.preventDefault(); openOrder(b.dataset.mpo); });
  el.querySelectorAll("[data-ambfor]").forEach(b => b.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); ambFor(b.dataset.ambfor); });
}
function rtLegs() { const R = RT.res, ok = R && R.road && R.road.sig === llq(rtLine()); $$("[data-rtleg]").forEach(x => { const lg = ok && R.road.legs[+x.dataset.rtleg]; x.textContent = lg ? "🚗 " + rtFmtKm(lg.km) + " · " + rtMin(lg.min) : ""; }); }
function rtAfter() { const R = RT.res; if (!R) return; if (rtPref().real && !(R.road && R.road.sig === llq(rtLine()))) rtRefine(); else { rtLegs(); rtMap(); } }
async function rtAct(k, el) {
  const P = rtPref();
  if (k === "setp") return rtSetSheet();
  if (k === "go") { const f = $("#rtFromT"), e2 = $("#rtEndT"); if (f) P.fromText = f.value.trim(); if (e2) P.endText = e2.value.trim(); return rtGo(); }
  if (k === "back") { RT.step = "pick"; render(); window.scrollTo(0, 0); return; }
  if (k === "visClear") { RT.visit = null; render(); return; }
  if (k === "full") { routeMapFull(); return; }
}

/* ---------- 🗺 Χάρτης: όλες οι πινέζες σε όλη την οθόνη, πατάς μία και βλέπεις ποιος είναι (ίδια λογική με το Δρομολόγιο) ---------- */
const CMF = [["open", "🚚 Ανοιχτή παραγγελία", "#2468B5"], ["all", "Όλοι", "#17324D"], ["often", "🔥 Ψωνίζουν συχνά", "#0B8A4F"], ["idle", "😴 Έχουν καιρό", "#8A8F98"], ["owe", "🔴 Χρωστάνε", "#C8412B"], ["big", "💎 Μεγάλος τζίρος", "#7B3FB5"], ["new", "⭐ Νέοι", "#E07A00"], ["today", "📅 Περνάς σήμερα", "#0E7C86"], ["never", "🆕 Δεν έχουν παραγγείλει", "#B08900"]];
const cm = { f: "open", idle: 30, area: "", busy: false, mode: "cust", map: null, layer: null, me: null };
const dayMs = 864e5;
function cmInfo(c) {
  const st = custStats(c.key), act = st.list.filter(o => o.st !== "cancel" && o.st !== "dup");
  const last = act.length ? Math.max(...act.map(o => o.rx)) : 0, first = act.length ? Math.min(...act.map(o => o.rx)) : 0;
  const n60 = act.filter(o => o.rx > Date.now() - 60 * dayMs).length;
  const open = act.filter(o => o.st === "new" || o.st === "prep");
  const wd = (new Date().getDay() + 6) % 7;
  return { c, st, last, first, n60, open, days: last ? Math.floor((Date.now() - last) / dayMs) : null, today: !!(c.route && c.route.days && c.route.days.includes(wd)) };
}
function cmMatch(x, bigMin) {
  const f = cm.f;
  if (cm.area && K.norm(x.c.area || "") !== K.norm(cm.area)) return false;
  if (f === "often") return x.n60 >= 3;
  if (f === "idle") return x.last && x.days >= cm.idle;
  if (f === "owe") return x.st.owed > 0;
  if (f === "open") return x.open.length > 0;
  if (f === "big") return x.st.sum > 0 && x.st.sum >= bigMin;
  if (f === "new") return x.first && Date.now() - x.first < 30 * dayMs;
  if (f === "today") return x.today;
  if (f === "never") return !x.st.n;
  return true;
}
function cmColor(x) { return x.st.owed > 0 ? "#C8412B" : x.open.length ? "#2468B5" : x.n60 >= 3 ? "#0B8A4F" : x.last && x.days >= cm.idle ? "#8A8F98" : !x.st.n ? "#B08900" : "#17324D"; }
/* στάση με πολλούς πελάτες στο ίδιο ακριβώς σημείο: κάθε πελάτης παίρνει δικό του αριθμό (π.χ. «3·4», «5–7») */
const rtPeople = p => { const g = new Map(); for (const x of p.items) { const id = x.ck || x.name; if (!g.has(id)) g.set(id, { ck: x.ck, name: x.name, items: [] }); g.get(id).items.push(x); } return [...g.values()]; };
function rtNums() { const m = new Map(); let n = 0; for (const p of rtActive()) { const k = Math.max(1, rtPeople(p).length); m.set(p.key, { a: n + 1, b: n + k }); n += k; } return m; }
const rtLbl = r => !r ? "" : r.a === r.b ? String(r.a) : r.b === r.a + 1 ? r.a + "·" + r.b : r.a + "–" + r.b;
const pinMulti = (col, txt, cnt) => `<svg viewBox="0 -3 32 33" width="45" height="46"><path d="M18 27S10 17.5 10 11A8 8 0 0126 11C26 17.5 18 27 18 27z" fill="${col}" opacity=".55" stroke="#fff" stroke-width="1.4"/><path d="M12 29S3 18.5 3 11.5A9 9 0 0121 11.5C21 18.5 12 29 12 29z" fill="${col}" stroke="#fff" stroke-width="1.6"/><text x="12" y="14.6" text-anchor="middle" font-size="${String(txt).length > 3 ? 5.6 : 7}" font-weight="800" fill="#fff" font-family="system-ui">${txt}</text><circle cx="25" cy="2.5" r="5.2" fill="#fff" stroke="${col}" stroke-width="1.4"/><text x="25" y="5" text-anchor="middle" font-size="6.6" font-weight="900" fill="${col}" font-family="system-ui">${cnt}</text></svg>`;
const pinSvg = (col, txt) => `<svg viewBox="0 0 24 30" width="34" height="42"><path d="M12 29S3 18.5 3 11.5A9 9 0 0121 11.5C21 18.5 12 29 12 29z" fill="${col}" stroke="#fff" stroke-width="1.6"/>${txt != null ? `<text x="12" y="15" text-anchor="middle" font-size="9" font-weight="800" fill="#fff" font-family="system-ui">${txt}</text>` : `<circle cx="12" cy="11.5" r="3.6" fill="#fff"/>`}</svg>`;
function cmPopup(x) {
  const c = x.c, ph = c.phone || "", ad = c.addr || "";
  return `<div class="jpop"><b>${esc(c.name)}</b>
   <div class="meta">${esc(ad)}${c.area ? " · " + esc(c.area) : ""}</div>
   <div class="meta">${x.st.n ? `${x.st.n} ${x.st.n === 1 ? "παραγγελία" : "παραγγελίες"} · τζίρος ${K.money(x.st.sum)}` : "Δεν έχει παραγγείλει ακόμα"}${x.last ? ` · τελευταία ${x.days === 0 ? "σήμερα" : x.days === 1 ? "χθες" : "πριν " + x.days + " ημέρες"}` : ""}</div>
   ${x.st.owed > 0 ? `<div class="meta" style="color:#C8412B;font-weight:800">Χρωστά ${K.money(x.st.owed)}</div>` : ""}
   ${x.loc.off && !custPin(c.key) ? `<div class="meta" style="color:#C8412B;font-weight:800">⚠️ Βρέθηκε σε άλλη περιοχή («${esc(x.loc.off)}») — μάλλον λάθος θέση.</div>` : ""}
   ${x.loc.amb && !custPin(c.key) ? `<div class="meta" style="color:#C8412B;font-weight:800">❓ Ίδια διεύθυνση σε ${x.loc.amb.length} περιοχές — ίσως λάθος θέση. <a href="#" data-ambfor="${esc(c.key)}">Διάλεξε ποια ›</a></div>` : ""}
   ${x.loc.approx && !custPin(c.key) ? `<div class="meta" style="color:#B45309">≈ Κατά προσέγγιση: βρέθηκε μόνο η περιοχή. Κράτα πατημένη την πινέζα και σύρ' την στη σωστή θέση, ή πάτα «📍 Είμαι εδώ» στην καρτέλα όταν είσαι εκεί.</div>` : ""}
   ${x.open.length ? `<div class="meta" style="color:#2468B5;font-weight:700">🚚 ${x.open.map(o => "#" + o.no + " " + esc(fmtWhen(o))).join(", ")}</div>` : ""}
   ${x.today ? `<div class="meta" style="color:#0E7C86;font-weight:700">📅 Σήμερα περνάς${c.route.slot ? " · " + esc(c.route.slot) : ""}</div>` : ""}
   <div class="row2"><button type="button" data-mpc="${esc(c.key)}">📇 Καρτέλα</button>${ph ? `<a href="tel:${esc(ph)}">📞 Κλήση</a>` : ""}<button type="button" data-mpn="${esc(c.key)}">＋ Παραγγελία</button>${x.open[0] ? `<button type="button" data-mpo="${x.open[0].id}">Άνοιγμα #${x.open[0].no}</button>` : ""}<a href="https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${x.loc.lat.toFixed(6)},${x.loc.lng.toFixed(6)}" target="_blank" rel="noopener">🧭 Πλοήγηση</a></div></div>`;
}
function cmDlg() {
  let d = $("#cmDlg"); if (d) return d;
  d = document.createElement("div"); d.id = "cmDlg"; d.className = "cmdlg";
  d.innerHTML = `<div class="cmh"><b id="cmT" style="flex:1;min-width:0">🗺 Χάρτης</b><button type="button" class="cmb" data-cm="me" aria-label="Η θέση μου">📍</button><button type="button" class="cmb" data-cm="x" aria-label="Κλείσιμο">✕</button></div>
   <div class="cmf" id="cmF"></div><div id="cmBox" class="cmbox"></div><div class="cmbar" id="cmBar"></div>`;
  document.body.appendChild(d); return d;
}
const cmIsOpen = () => !!($("#cmDlg") && $("#cmDlg").classList.contains("open") && !$("#cmDlg").classList.contains("docked"));
/* η καρτέλα «🗺 Χάρτης» της κάτω μπάρας: ο χάρτης πελατών ανάμεσα στην πάνω και την κάτω μπάρα */
function cmDock(on) {
  const d = $("#cmDlg");
  if (!on) { if (d && d.classList.contains("docked")) d.classList.remove("open", "docked"); return; }
  const w = cmDlg(); w.classList.add("docked");
  const h = $("header.top"), tb = $("#tabs"), nb = $("#newBar");
  let top = h ? h.getBoundingClientRect().bottom : 56; if (nb && nb.offsetParent !== null) top = Math.max(top, nb.getBoundingClientRect().bottom);
  w.style.top = top + "px"; w.style.bottom = (tb ? tb.getBoundingClientRect().height : 70) + "px";
  if (!w.classList.contains("open") || cm.focus) custMap();
}
function cmClose(fromPop) { const d = $("#cmDlg"); if (!d || !d.classList.contains("open") || d.classList.contains("docked")) return; d.classList.remove("open"); document.body.classList.remove("cmon"); if (!fromPop) { skipPop++; history.back(); } }
async function cmShow() {
  let Lf; try { Lf = await loadLeaflet(); } catch { toast("Ο χάρτης χρειάζεται σύνδεση στο διαδίκτυο.", 3500); return null; }
  const d = cmDlg(); if (!d.classList.contains("docked")) { d.style.top = ""; d.style.bottom = ""; }
  if (!d.classList.contains("open")) { d.classList.add("open"); if (!d.classList.contains("docked")) { document.body.classList.add("cmon"); histPush({ cm: 1 }); } }
  if (!cm.map) {
    cm.map = Lf.map($("#cmBox"), { zoomControl: true }).setView([37.9755, 23.7348], 11);
    if (cm.map.on) cm.map.on("popupopen", e => mpBind(e.popup.getElement()));
    Lf.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(cm.map);
  }
  setTimeout(() => { try { cm.map.invalidateSize(); } catch {} }, 120);
  return Lf;
}
/* χάρτης πελατών με φίλτρα */
async function custMap(f) {
  if (f) cm.f = f; cm.mode = "cust";
  const Lf = await cmShow(); if (!Lf) return;
  const areas = [...new Set(Object.values(S.customers).map(c => (c.area || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "el"));
  $("#cmT").textContent = "🗺 Χάρτης πελατών";
  $("#cmF").innerHTML = `<div class="chips">${CMF.map(([k, l, col]) => `<button type="button" class="chip${cm.f === k ? " on" : ""}" data-cmf="${k}"><span class="dotc" style="background:${col}"></span>${l}</button>`).join("")}</div>
   <div class="cmsub">${cm.f === "idle" ? `<span>Χωρίς παραγγελία πάνω από</span>${[14, 30, 60, 90].map(n => `<button type="button" class="chip sm${cm.idle === n ? " on" : ""}" data-cmidle="${n}">${n} ημέρες</button>`).join("")}` : ""}
   ${areas.length ? `<select id="cmArea" class="t sm"><option value="">Όλες οι περιοχές</option>${areas.map(a => `<option${a === cm.area ? " selected" : ""}>${esc(a)}</option>`).join("")}</select>` : ""}</div>`;
  await cmDrawCust(true);
}
function cmMissSheet() {
  const row = (k, why) => { const c = S.customers[k]; if (!c) return ""; return `<div class="it" data-cust="${esc(k)}"><div class="ic">📍</div><div class="t" style="min-width:0"><b>${esc(c.name)}</b><span>${c.addr ? esc(c.addr) + (c.area ? " · " + esc(c.area) : "") : "Χωρίς διεύθυνση"}</span><span style="color:#C8412B">${why}</span></div><span>›</span></div>`; };
  const M = (cm.missList || []).map(k => row(k, "Δεν βρέθηκε στον χάρτη")).join(""), N = (cm.noAd || []).map(k => row(k, "Δεν έχει διεύθυνση")).join("");
  sheet("📍 Πελάτες εκτός χάρτη", `<p class="note" style="margin-top:0">Πάτα έναν πελάτη και διόρθωσε τη διεύθυνση: οδός και αριθμός, και στο «Περιοχή» η πόλη ή το χωριό (π.χ. «Κορωπί»). Γράψε ολόκληρες τις λέξεις (όχι «Λεωφ.» ή «Βασ.»). Αλλιώς, όταν είσαι εκεί, πάτα «📍 Είμαι εδώ».</p>
    <div class="card list">${M + N || `<p class="note">Όλοι φαίνονται στον χάρτη.</p>`}</div>`);
}
async function cmDrawCust(fit) {
  const Lf = window.L, M = cm.map; if (!M) return;
  const all = Object.values(S.customers).map(cmInfo);
  const sums = all.map(x => x.st.sum).filter(v => v > 0).sort((a, b) => b - a);
  const bigMin = sums.length ? sums[Math.max(0, Math.ceil(sums.length * 0.2) - 1)] : Infinity;
  const L = all.filter(x => cmMatch(x, bigMin));
  if (cm.layer) cm.layer.remove(); cm.layer = Lf.layerGroup().addTo(M);
  const bar = $("#cmBar"), pts = [], noAd = L.filter(x => !(x.c.addr || "").trim() && !custPin(x.c.key));
  let miss = 0, done = 0;
  const need = L.filter(x => !custPin(x.c.key) && (x.c.addr || "").trim() && !custGeoCached(x.c));
  const stamp = cm.stamp = Date.now();
  let focusMk = null;
  const put = x => { pts.push([x.loc.lat, x.loc.lng]); const mk = Lf.marker([x.loc.lat, x.loc.lng], { draggable: true, icon: Lf.divIcon({ className: "jpin", iconSize: [34, 42], iconAnchor: [17, 41], html: pinSvg(cmColor(x), custPin(x.c.key) ? null : x.loc.off ? "!" : x.loc.amb ? "?" : x.loc.approx ? "≈" : null) }) }).addTo(cm.layer).bindPopup(cmPopup(x), { maxWidth: 290 }); if (cm.focus === x.c.key) focusMk = { mk, x };
    if (mk.on) mk.on("dragend", () => { const p = mk.getLatLng(); if (confirm("Να κρατηθεί η νέα θέση για «" + x.c.name + "»;")) { x.c.pin = { lat: p.lat, lng: p.lng, at: Date.now() }; save(); toast("✓ Κρατήθηκε η νέα θέση", 2500); } else mk.setLatLng([x.loc.lat, x.loc.lng]); }); };
  const status = () => { if (cm.stamp !== stamp) return; const shown = pts.length;
    bar.innerHTML = `<div class="grow"><b>${shown}</b> ${shown === 1 ? "πελάτης" : "πελάτες"} στον χάρτη${need.length && done < need.length ? ` · βρίσκω διευθύνσεις ${done}/${need.length}…` : ""}${miss || noAd.length ? ` · <a href="#" data-cmmiss="1" style="color:#C8412B;font-weight:700">δες ποιοι λείπουν ›</a>` : ""}${miss ? ` · <span style="color:#C8412B">${miss} δεν βρέθηκαν</span>` : ""}${noAd.length ? ` · ${noAd.length} χωρίς διεύθυνση` : ""}</div>${(() => { const nO = rtCands().filter(r => r.kind === "del" && (cm.shown || []).includes(r.ck)).length; return nO ? `<button type="button" class="btn sm green" data-cm="route">🚐 Δρομολόγιο: ${nO} ${nO === 1 ? "παράδοση" : "παραδόσεις"}</button>` : cm.f === "open" && !shown && !need.length ? `<button type="button" class="btn sm soft" data-cmf="all">Καμία ανοιχτή παραγγελία · δες όλους</button>` : ""; })()}`; };
  cm.shown = []; cm.missList = []; cm.noAd = noAd.map(x => x.c.key);
  for (const x of L) { const p = custPin(x.c.key) || custGeoCached(x.c) || {}; if (p.lat != null) { x.loc = p; put(x); cm.shown.push(x.c.key); } }
  status();
  const doFocus = () => { if (!focusMk) return false; M.setView([focusMk.x.loc.lat, focusMk.x.loc.lng], 16); try { focusMk.mk.openPopup(); } catch {} cm.focus = null; focused = true; return true; }; let focused = false;
  if (!doFocus() && fit && pts.length) { if (pts.length === 1) M.setView(pts[0], 15); else M.fitBounds(pts, { padding: [40, 40], maxZoom: 16 }); }
  if (!L.length) toast("Κανένας πελάτης με αυτό το φίλτρο.", 2500);
  /* όσοι δεν έχουν βρεθεί ακόμα: ένας ένας, με μνήμη (την πρώτη φορά μόνο) */
  /* όσοι βρίσκονται τώρα μπαίνουν σε ομάδες (κάθε 5 ή κάθε 3 δευτερόλεπτα), όχι ένας ένας και όχι μόνο στο τέλος */
  let found = [], lastFlush = Date.now();
  const flush = () => { for (const x of found) { put(x); cm.shown.push(x.c.key); } found = []; lastFlush = Date.now(); doFocus(); };
  for (const x of need) {
    if (cm.stamp !== stamp || !($("#cmDlg") && $("#cmDlg").classList.contains("open"))) { if (done) save(); return; }
    const p = await custGeo(x.c); done++;
    if (cm.stamp !== stamp) return;
    if (p) { x.loc = p; found.push(x); } else { miss++; cm.missList.push(x.c.key); }
    if (found.length >= 5 || (found.length && Date.now() - lastFlush > 3000)) flush();
    if (done % 5 === 0) save();
    status();
  }
  flush(); status();
  if (need.length) { save(); if (pts.length && fit && !focused) { if (pts.length === 1) M.setView(pts[0], 15); else M.fitBounds(pts, { padding: [40, 40], maxZoom: 16 }); } }
}
/* η διαδρομή σε όλη την οθόνη, με πατήσιμες πινέζες */
async function routeMapFull() {
  const R = RT.res; if (!R) return; cm.mode = "route";
  const Lf = await cmShow(); if (!Lf) return;
  $("#cmT").textContent = "🚐 Διαδρομή"; $("#cmF").innerHTML = ""; $("#cmBar").innerHTML = `<div class="grow">${rtSumHTML()}</div>`;
  rtDrawOn(Lf, cm.map, true);
}
function rtStopPopup(p, r) {
  const PP = rtPeople(p), many = PP.length > 1, nav = `<a href="https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${gmLL(p.loc)}" target="_blank" rel="noopener">🧭 Πλοήγηση</a>`;
  const per = (pp, j) => { const k = pp.ck, c = S.customers[k] || {}, o0 = (pp.items.find(x => x.o) || {}).o, ph = o0 ? o0.cust.phone : c.phone, owed = custStats(k).owed;
    return `<div class="${many ? "jper" : ""}"><b>${many ? `<span class="jpn">${r.a + j}</span> ` : (typeof r === "object" ? r.a : r) + ". "}${esc(pp.name)}</b>${many ? "" : `<div class="meta">${esc(p.addr)}</div>`}
     ${pp.items.filter(x => x.kind === "del").map(x => `<div class="meta">🚚 #${x.o.no} ${esc(x.o.lines.map(l => K.num(l.q) + " " + l.unit + " " + K.lnName(l)).join(" · "))}${x.o.paid ? " · πληρωμένη" : " · <b>" + K.money(x.o.total) + "</b>"}</div>`).join("")}
     ${owed > 0 ? `<div class="meta" style="color:#C8412B;font-weight:800">Χρωστά ${K.money(owed)}</div>` : ""}
     <div class="row2">${S.customers[k] ? `<button type="button" data-mpc="${esc(k)}">📇 Καρτέλα</button>` : ""}${ph ? `<a href="tel:${esc(ph)}">📞 Κλήση</a>` : ""}${pp.items.filter(x => x.o).map(x => `<button type="button" data-mpo="${x.o.id}">Άνοιγμα #${x.o.no}</button>`).join("")}${many ? "" : nav}</div></div>`; };
  return `<div class="jpop">${many ? `<div class="jmany">👥 ${PP.length} πελάτες στο ίδιο σημείο</div>` : ""}${many ? `<div class="meta">📍 ${esc(p.addr)}</div>` : ""}${PP.map(per).join("")}${many ? `<div class="row2">${nav}</div>` : ""}</div>`;
}
function rtDrawOn(Lf, M, big) {
  const R = RT.res, act = rtActive(), pts = [[R.A.lat, R.A.lng]];
  const lay = Lf.layerGroup ? Lf.layerGroup().addTo(M) : M;
  if (big) { if (cm.layer) cm.layer.remove(); cm.layer = lay; }
  const mk = (p, html) => Lf.marker([p.lat, p.lng], { icon: Lf.divIcon({ className: "jpin", iconSize: [34, 42], iconAnchor: [17, 41], html }) }).addTo(lay);
  mk(R.A, pinSvg("#17324D", "Α")).bindPopup(`<div class="jpop"><b>Αφετηρία</b><div class="meta">${esc(R.A.label)}</div></div>`);
  const NM = rtNums();
  act.forEach(p => { const col = p.items.every(x => x.kind === "pay") ? "#C8412B" : "#0B6E4F", r = NM.get(p.key), many = r.b > r.a;
    const m = many ? Lf.marker([p.loc.lat, p.loc.lng], { icon: Lf.divIcon({ className: "jpin", iconSize: [45, 46], iconAnchor: [17, 45], html: pinMulti(col, rtLbl(r), r.b - r.a + 1) }) }).addTo(lay) : mk(p.loc, pinSvg(col, r.a));
    m.bindPopup(rtStopPopup(p, r), { maxWidth: 300 }); pts.push([p.loc.lat, p.loc.lng]); });
  if (R.B && (R.B.lat !== R.A.lat || R.B.lng !== R.A.lng)) { mk(R.B, pinSvg("#17324D", "Β")); pts.push([R.B.lat, R.B.lng]); }
  const road = R.road && R.road.sig === llq(rtLine()) ? R.road : null;
  /* πράσινο το «πήγαινε», πορτοκαλί η επιστροφή από την τελευταία παραγγελία */
  if (road) {
    if (road.geoBack && road.geoBack.length) Lf.polyline(road.geoBack.map(c => [c[1], c[0]]), { color: "#E07A00", weight: 5, opacity: .85, dashArray: "10 8" }).addTo(lay);
    Lf.polyline(road.geoGo.map(c => [c[1], c[0]]), { color: "#0B6E4F", weight: 5, opacity: .9 }).addTo(lay);
  } else {
    const LN = rtLine(), cut = R.B ? LN.length - 1 : LN.length;
    Lf.polyline(LN.slice(0, cut).map(p => [p.lat, p.lng]), { color: "#0B6E4F", weight: 3, dashArray: "6 8" }).addTo(lay);
    if (R.B && LN.length > 1) Lf.polyline(LN.slice(cut - 1).map(p => [p.lat, p.lng]), { color: "#E07A00", weight: 3, dashArray: "2 8" }).addTo(lay);
  }
  if (pts.length === 1) M.setView(pts[0], 15); else M.fitBounds(pts, { padding: [40, 40], maxZoom: 16 });
}
async function cmAct(k) {
  if (k === "x") { cmClose(); return; }
  if (k === "me") { const p = await myPos(); if (!p) { toast("Δεν βρέθηκε η θέση σου.", 3000); return; } const Lf = window.L; cm.map.setView([p.lat, p.lng], 15); if (cm.me) cm.me.remove(); cm.me = Lf.circleMarker([p.lat, p.lng], { radius: 8, color: "#fff", weight: 3, fillColor: "#2468B5", fillOpacity: 1 }).addTo(cm.map); return; }
  if (k === "route") {   /* μόνο όσοι έχουν ανοιχτή παραγγελία: δεν έχει νόημα να πας σε όλους */
    const keys = (cm.shown || []).slice(); cmClose(); RT.visit = null; RT.day = "all";
    const L = rtCands().filter(x => x.kind === "del" && keys.includes(x.ck)).map(x => x.key);
    if (!L.length) { toast("Δεν υπάρχει ανοιχτή παραγγελία για παράδοση σε αυτούς.", 3500); return; }
    rtOpen(L); toast("Τσεκαρίστηκαν " + L.length + (L.length === 1 ? " παράδοση" : " παραδόσεις") + ". Πάτα «Δείξε διαδρομή».", 3500); return; }
}
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
  const q = {}, ol = []; o.lines.forEach(l => { const p = S.products[l.pid]; if (!p || p.del) return; if (l.opt || l.note || pHasOpts(p)) ol.push({ pid: l.pid, q: l.q, opt: l.opt || "", n: l.note || "", x: Math.max(0, K.round2(l.price - K.priceFor(p, null, l.q))) }); else q[l.pid] = Math.round(((q[l.pid] || 0) + l.q) * 1000) / 1000; });
  orderForm({ name: o.cust.name, phone: o.cust.phone, addr: o.cust.addr, how: o.when.how, slot: o.when.slot, q, ol });
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
   ${it("🎨", "Εμφάνιση", "Χρώματα, φόντο, διαφάνεια · " + lookLabel(), "look")}
   ${it("🔔", "Ειδοποιήσεις", S.nt.on ? "Ενεργές" : "Δεν έχουν ενεργοποιηθεί", "notif")}
   ${it("💬", "Πρόταση ενημέρωσης πελάτη", S.ui.noAsk ? "Κλειστή · πάτα για να ξαναβγαίνει μετά από κάθε αλλαγή κατάστασης" : "Βγαίνει μετά από «Ετοιμάζεται», «Παραδόθηκε», «Ακυρώθηκε» · πάτα για να κλείσει", "askToggle")}
   ${it("🏷️", "Έτοιμοι κατάλογοι επαγγελμάτων", "Πρόσθεσε ή άλλαξε επάγγελμα", "presetsGo")}
   ${it("📋", "Παραγγελία από μήνυμα Viber", "Επικόλληση ή κοινοποίηση μηνύματος", "paste")}</div>
   <div class="card list">
   ${it("💾", "Αντίγραφα ασφαλείας", gd, "backup")}
   ${it("📤", "Εξαγωγή σε Excel", "Παραγγελίες και σύνολα ημερών", "xls")}
   ${it("⭐", "Pro", l.kind === "pro" ? "Ενεργό μέχρι " + S.lic.until.split("-").reverse().join("/") : l.kind === "trial" ? "Δοκιμή: μένουν " + l.left + " ημέρες" : "Δωρεάν έκδοση", "pro")}
   ${packOk() ? it("🔗", "Σύνδεση με άλλες εφαρμογές GlenApps", "Ταμεία: " + (S.ui.tmSync ? "ναι" : "όχι") + " · Ημερολόγιο: " + (S.ui.imSync ? "ναι" : "όχι"), "tmLink") : ""}
   ${it("🗺", "Προβολή στο «Κοντά μου»", "Η επιχείρησή σου στον χάρτη της κοινότητας · σε επόμενη έκδοση", "kontamou")}</div>
   <div class="card list">
   ${DEMO ? it("🎬", "Τέλος επίδειξης", "Πίσω στα δικά σου δεδομένα", "demoEnd") : it("🎬", "Επίδειξη", "Δοκίμασε την εφαρμογή με έτοιμα παραδείγματα", "demoStart")}
   ${it("🧩", "Οι εφαρμογές μας", "Κι άλλες εφαρμογές της GlenApps", "efm")}
   ${it("⚖️", "Όροι χρήσης και απόρρητο", "Τι ισχύει για σένα και τους πελάτες σου", "legal")}
   ${it("📲", "Εγκατάσταση στο κινητό", installed() ? "Εγκατεστημένη ✓" : "Με δικό της εικονίδιο στην αρχική οθόνη", "install")}
   ${it("ℹ️", "Έκδοση " + VERSION, updNew && updNew !== VERSION ? "Υπάρχει νέα έκδοση " + updNew + " — πάτα για αναβάθμιση" : "Αυτόματες αναβαθμίσεις · πάτα για έλεγχο τώρα", "update")}</div>
   ${S.rejected.length ? `<details class="card"><summary style="cursor:pointer;font-weight:700">Απορρίφθηκαν (${S.rejected.length})</summary>${S.rejected.map(([t, m]) => `<div class="note">${fmtTime(t)} · ${esc(m)}</div>`).join("")}</details>` : ""}
   <div class="efm-host" id="efmHost"></div>
   ${S.ui.test ? `<div class="card list"><div class="it" data-act="role"><div class="ic">🧪</div><div class="t"><b>Λειτουργία δοκιμών</b><span>Πάτα «🛒 Δοκιμή ως πελάτης» πάνω δεξιά για να παραγγείλεις στον εαυτό σου</span></div></div><div class="it" data-act="testDel"><div class="ic">🗑</div><div class="t"><b>Διαγραφή δοκιμαστικών παραγγελιών</b><span>${S.orders.filter(o => o.test).length} δοκιμαστικές</span></div></div><div class="it" data-act="testOff"><div class="ic">✕</div><div class="t"><b>Κλείσιμο λειτουργίας δοκιμών</b></div></div></div>` : ""}
   <p class="note" style="text-align:center" data-act="secret">Παραγγελίες · GlenApps · © 2026 Ανδρέας Μ. Γλεντζάκης</p>`;
}
function deliveryText() { const d = S.deliv, nz = (d.zones || []).length; return (d.how === "both" ? "Παράδοση και παραλαβή" : d.how === "pick" ? "Μόνο παραλαβή" : "Μόνο παράδοση") + " · " + (d.days || []).map(x => K.WD[x].slice(0, 3)).join(" ") + (nz ? " · " + nz + (nz === 1 ? " ομάδα περιοχών" : " ομάδες περιοχών") : ""); }
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
    <label class="f" for="shA">Διεύθυνση έδρας</label><input class="t" id="shA" value="${esc(s.addr)}" maxlength="140"><div class="row" style="margin-top:6px;align-items:center"><button type="button" class="btn soft sm" data-act="shopPinHere">📍 Είμαι στην έδρα</button><span class="note" style="margin:0;flex:1">${s.pin ? "✓ Έχει κρατηθεί ακριβής θέση της έδρας." : "Για σωστή αφετηρία στο Δρομολόγιο και στον χάρτη."}</span></div>
    <label class="f" for="shAfm">ΑΦΜ</label><input class="t" id="shAfm" inputmode="numeric" value="${esc(s.afm)}" maxlength="9">
    ${phonesHTML("shP", "Τηλέφωνα επικοινωνίας", s.phone, s.phones)}<p class="note" style="margin:4px 0 0">Με το ＋ προσθέτεις κι άλλο (π.χ. σταθερό). Ο πελάτης τα βλέπει όλα.</p>
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
  geoBaseP = null;   /* νέα διεύθυνση έδρας: ξαναβρίσκεται */
  const s = S.shop, b = $("#shB"), v = id => $("#" + id).value.trim();
  const afm = v("shAfm").replace(/\D/g, "");
  if (afm && !afmOk(afm)) { $("#shErr").innerHTML = `<div class="errbox">Ο ΑΦΜ δεν είναι έγκυρος. Έλεγξε τα 9 ψηφία.</div>`; return; }
  Object.assign(s, { name: v("shN"), legal: v("shL"), addr: v("shA"), afm, phone: v("shP"), phones: phonesRead("shP").extra.slice(0, PH_MAX - 1), email: v("shE"), welcome: v("shW"), terms: ($("#shTr").value || "").trim().slice(0, 600), c1: $("#shC1").value, c2: $("#shC2").value, vatIncl: $("#shV").checked });
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
   <div class="card zcard"><h3>📍 Ημέρες ανά περιοχή</h3><p class="note" style="margin-top:0">Χώρισε τις παραδόσεις σε περιοχές. Ο πελάτης διαλέγει την περιοχή του και βλέπει <b>μόνο τις ημέρες της</b>.</p>
    <div id="zList">${zonesHTML(d.zones || [])}</div>
    <div class="row" style="margin-top:8px"><button type="button" class="btn soft sm grow" data-act="zAdd">＋ Ομάδα περιοχών</button>${(d.zones || []).length ? "" : `<button type="button" class="btn amber sm grow" data-act="zEx">💡 Βάλε παράδειγμα</button>`}</div>
    <label class="f" for="dvZo">Για τις άλλες περιοχές</label><select class="t" id="dvZo"><option value="gen"${d.zOther !== "pick" ? " selected" : ""}>Οι γενικές ημέρες (πιο πάνω)</option><option value="pick"${d.zOther === "pick" ? " selected" : ""}>Μόνο παραλαβή, όχι παράδοση</option></select>
    <datalist id="areaL2">${[...new Set(Object.values(S.customers).map(x => x.area).filter(Boolean))].map(a => `<option value="${esc(a)}">`).join("")}</datalist></div>
   ${holidaysHTML(d)}
   <div class="card"><h3>Ώρες παράδοσης</h3><p class="note" style="margin-top:0">Μία ανά γραμμή. Άφησέ το κενό αν δεν θέλεις ώρες.</p><textarea class="t" id="dvSl" rows="3" placeholder="09:00-12:00&#10;17:00-20:00">${esc((d.slots || []).join("\n"))}</textarea></div>
   <div class="card"><h3>Άλλα</h3><label class="f" for="dvMo">Ελάχιστη παραγγελία (€, 0 για καμία)</label><input class="t" id="dvMo" inputmode="decimal" value="${d.minOrder ? K.num(d.minOrder) : ""}">
    <label class="f" for="dvNt">Σημείωση για τον πελάτη</label><input class="t" id="dvNt" value="${esc(d.note || "")}" maxlength="140" placeholder="π.χ. Δωρεάν παράδοση στο χωριό, πληρωμή κατά την παράδοση"></div>`,
   `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-act="delivSave">Αποθήκευση</button>`,
   el => { bindChips(el); bindFor(el); el.querySelectorAll("#zList .zone").forEach(bindZone); const hc = el.querySelector("#dvHolOn"); hc.addEventListener("change", () => { const b = el.querySelector("#holBox"); b.style.opacity = hc.checked ? "" : ".5"; b.style.pointerEvents = hc.checked ? "" : "none"; }); });
}
/* ομάδες περιοχών με τις δικές τους ημέρες */
function zonesHTML(Z) {
  if (!Z.length) return `<p class="note" style="margin:4px 0 0">Καμία ακόμα. Όλες οι περιοχές έχουν τις γενικές ημέρες.</p>`;
  return Z.map((z, i) => `<div class="zone" data-zi="${i}"><div class="zh"><b>Ομάδα ${i + 1}</b><span class="zsum">${(z.d || []).length ? esc(wdShort(z.d)) : "χωρίς ημέρες"}</span><button type="button" class="zx" data-zdel="${i}" aria-label="Διαγραφή ομάδας">🗑</button></div>
    <input class="t" data-za="${i}" value="${esc((z.a || []).join(", "))}" placeholder="Περιοχές, με κόμμα: π.χ. Εξάρχεια, Αμπελόκηποι" list="areaL2" maxlength="300">
    ${dayChips(z.d, "data-zd" + i)}</div>`).join("");
}
const wdShort = a => a.slice().sort((x, y) => ((x + 6) % 7) - ((y + 6) % 7)).map(i => K.WD[i].slice(0, 3)).join(" · ");
function zonesRead() {
  return $$("#zList .zone").map(el => { const i = el.dataset.zi; return { a: [...new Set(($(`[data-za="${i}"]`).value || "").split(/[,;\n]/).map(x => x.trim().replace(/\s+/g, " ")).filter(Boolean))].slice(0, 30), d: $$(`[data-zd${i}]`).filter(x => x.checked).map(x => +x.dataset["zd" + i]) }; });
}
function zonesPut(Z) { const L = $("#zList"); if (!L) return; L.innerHTML = zonesHTML(Z); bindChips(L); L.querySelectorAll(".zone").forEach(bindZone); const ex = $('[data-act="zEx"]'); if (ex && Z.length) ex.remove(); }
function bindZone(el) { const i = el.dataset.zi; el.querySelectorAll(`[data-zd${i}]`).forEach(c => c.addEventListener("change", () => { const d = $$(`[data-zd${i}]`).filter(x => x.checked).map(x => +x.dataset["zd" + i]); el.querySelector(".zsum").textContent = d.length ? wdShort(d) : "χωρίς ημέρες"; })); }
function bindFor(el) {
  el.querySelector("#dvFor").addEventListener("change", e => {
    const v = e.target.value;
    if (v === "+") { e.target.value = dvFor; newCustSheet(k => delivSheet(k)); return; }
    delivSheet(v);
  });
}
/* ---------- επαφές του κινητού (όπως στο Δρομολόγιο): μόνο όσες διαλέξεις, μένουν στο κινητό ---------- */
const canContacts = () => "contacts" in navigator && "select" in navigator.contacts;
async function pickContacts(multiple) {
  if (!canContacts()) { toast(/iPhone|iPad/i.test(navigator.userAgent) ? "Στο iPhone ο φυλλομετρητής δεν επιτρέπει πρόσβαση στις επαφές. Γράψε τον πελάτη με το χέρι ή αντέγραψε το τηλέφωνο από τις Επαφές." : window !== window.top ? "Μέσα στην προεπισκόπηση οι επαφές δεν ανοίγουν. Άνοιξε την εφαρμογή από το εικονίδιό της." : "Οι επαφές ανοίγουν από το Chrome του κινητού Android.", 6000); return null; }
  const props = ["name", "tel"];
  try { const av = await navigator.contacts.getProperties(); if (av.includes("address")) props.push("address"); } catch {}
  toast(multiple ? "Διάλεξε επαφές και πάτα «Ολοκληρώθηκε» πάνω δεξιά." : "Διάλεξε την επαφή και πάτα «Ολοκληρώθηκε» πάνω δεξιά.", 3500);
  try { const r = await navigator.contacts.select(props, { multiple }); return r && r.length ? r : null; } catch { toast("Δεν δόθηκε πρόσβαση στις επαφές."); return null; }
}
function contactToCust(ct) {
  const name = ((ct.name || [])[0] || "").trim();
  const tels = (ct.tel || []).map(t => String(t || "").trim()).filter(Boolean);
  const dg = t => t.replace(/[^\d]/g, "").replace(/^(00)?30(?=\d{10}$)/, "");
  const phone = tels.find(t => /^69\d{8}$/.test(dg(t))) || tels.find(t => dg(t).length >= 10) || "";
  let addr = "", area = "";
  const a = (ct.address || [])[0];
  if (a) {
    const lines = (a.addressLine || []).map(x => String(x || "").trim()).filter(Boolean);
    addr = lines[0] || ""; area = (a.dependentLocality || a.city || a.region || "").trim();
    if (!area && addr.includes(",")) { const p = addr.split(","); addr = p[0].trim(); area = p.slice(1).join(",").replace(/\d{3}\s?\d{2}/, "").trim(); }
  }
  return { name, phone, addr, area };
}
async function importContacts() {
  const list = await pickContacts(true); if (!list) return;
  let added = 0, had = 0, nophone = 0;
  for (const ct of list) {
    const d = contactToCust(ct);
    const k = d.phone && custKey(d.phone); if (!k) { nophone++; continue; }
    if (S.customers[k]) { had++; continue; }
    S.customers[k] = { key: k, name: d.name || d.phone, phone: d.phone, addr: d.addr, notes: "", first: Date.now(), inPh: 1 };
    if (d.area) { S.customers[k].area = d.area; S.customers[k].areaAuto = "c"; }
    added++;
  }
  save(); render();
  toast((added === 1 ? "✓ Προστέθηκε 1 πελάτης." : "✓ Προστέθηκαν " + added + " πελάτες.") + (had ? " " + had + (had === 1 ? " υπήρχε ήδη." : " υπήρχαν ήδη.") : "") + (nophone ? " " + nophone + " χωρίς κινητό." : ""), 4500);
}
function newCustSheet(after) {
  sheet("＋ Νέος πελάτης", `<div class="nccts"><button type="button" class="btn soft grow" data-act="ncContact">📇 Από τις επαφές<small>έναν, συμπληρώνει τη φόρμα</small></button><button type="button" class="btn soft grow" data-act="ncMany">👥 Πολλούς μαζί<small>διαλέγεις όσους θέλεις</small></button></div><div class="card"><label class="f" for="ncN">Ονοματεπώνυμο</label><input class="t" id="ncN" maxlength="80">
   ${phonesHTML("ncP", "Τηλέφωνο", "", [])}<label class="f" for="ncA">Διεύθυνση</label><input class="t" id="ncA" maxlength="160"><label class="f" for="ncAr">Περιοχή</label><input class="t" id="ncAr" maxlength="60" placeholder="π.χ. Κορωπί"></div><div id="ncErr"></div>`,
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
  { const Z = zonesRead(), bad = Z.findIndex(z => !z.a.length !== !z.d.length);
    if (bad >= 0) { toast("Στην ομάδα " + (bad + 1) + " " + (Z[bad].a.length ? "διάλεξε ημέρες." : "γράψε περιοχές."), 4000); const el = $(`[data-zi="${bad}"]`); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
    const all = Z.flatMap(z => z.a), dup = all.find((x, i) => all.findIndex(y => K.areaEq(x, y)) !== i);
    if (dup) { toast("Η περιοχή «" + dup + "» είναι σε δύο ομάδες. Κράτησέ τη σε μία.", 4500); return; }
    d.zones = Z.filter(z => z.a.length && z.d.length); d.zOther = $("#dvZo").value; }
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
  const W = lkWait("📤 Κατάλογος για " + c.name);
  const SL = await shortLink({ k, d: r.days || [], sl: r.slot || "", nt: r.note || "", ex: r.ex !== false ? 1 : 0 }), long = SL.long, short = SL.short;
  if (!lkStill(W)) return;
  const url = short || long;
  const msg = "Γεια σας " + c.name.split(" ")[0] + "! 🛒 Παραγγελίες «" + S.shop.name + "»\n" + url;
  sheet("📤 Κατάλογος για " + c.name, `<div class="okbox">Αυτός ο σύνδεσμος είναι μόνο για ${esc(c.name)}: ${r.days && r.days.length ? "βλέπει ότι περνάς " + esc(r.days.map(x => K.WD[x]).join(", ")) + (r.slot ? ", " + esc(r.slot) : "") : "βλέπει τις γενικές σου ημέρες"}${r.ex !== false && r.days && r.days.length ? ", με κουμπί για έκτακτη παραγγελία" : ""}.</div>
   <div class="row" style="margin-bottom:10px"><button type="button" class="btn amber grow" data-act="lkShare">💬 Αποστολή στο Viber</button><button type="button" class="btn ghost grow" data-act="lkCopy">📋 Αντιγραφή</button></div>
   ${short ? droppedTxt(SL.dropped) : shortFailTxt(SL)}
   <p class="note">${short ? "Σύντομος σύνδεσμος ✓. " : ""}Την πρώτη φορά ο πελάτης γράφει όνομα και τηλέφωνο· μετά τα θυμάται το κινητό του.</p>
   <h3 style="margin:14px 2px 6px;font-size:16px">👁 Όπως το βλέπει ${esc(c.name.split(" ")[0])}</h3>
   <div style="border:3px solid #1d2b36;border-radius:22px;overflow:hidden;height:560px;background:#F3F4F1"><iframe src="${esc(long)}" title="Προεπισκόπηση" style="width:100%;height:100%;border:0"></iframe></div>`, "",
   el => { el.dataset.url = long; el.dataset.msg = msg; el.dataset.lkcust = k; });
}

/* ---------- σύνδεσμος παραγγελίας ---------- */
async function thumbOf(src, n, q) {
  n = n || 56; q = q || 0.6;
  return new Promise(res => { const i = new Image(); i.onload = () => { const c = document.createElement("canvas"); c.width = c.height = n; c.getContext("2d").drawImage(i, 0, 0, n, n); let d = c.toDataURL("image/webp", q); if (!d.startsWith("data:image/webp")) d = c.toDataURL("image/jpeg", q); res(d); }; i.onerror = () => res(""); i.src = src; });
}
async function makeLink(cust, lo) {
  lo = lo || {};
  await ensureKeys(); await ensureLiveKeys();
  if (cust && cust.k && S.customers[cust.k]) { const c = S.customers[cust.k]; if (!c.tok) { c.tok = K.uid(12).replace(/[.]/g, "x"); save(); } cust = Object.assign({}, cust, { tk: c.tok }); }
  const st = S;
  let prodsForLink = st.products;
  if (S.link.photos && isPro() && !lo.noPhotos) {
    prodsForLink = {};
    for (const [id, p] of Object.entries(st.products)) prodsForLink[id] = p.photo ? Object.assign({}, p, { photo: await thumbOf(p.photo) }) : p;
  }
  const shopForLink = st.shop.logo && S.link.logo && !lo.noLogo ? Object.assign({}, st.shop, { logo: await thumbOf(st.shop.logo, 48, 0.5) }) : st.shop;
  const C = K.buildCatalog(Object.assign({}, st, { products: prodsForLink, shop: shopForLink }), { photos: S.link.photos && isPro() && !lo.noPhotos, logo: S.link.logo && !lo.noLogo, icons: !lo.noIcons, appUrl: BASE, cust: cust || undefined });
  const pk = await K.pack(C);
  return BASE + "p.html#n=" + pk.length + "&k=" + pk;
}
A.makeLink = makeLink;
async function shortOf(url) {
  let h = 2166136261; for (let i = 0; i < url.length; i++) { h ^= url.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } h = url.length + ":" + h;
  const c = (S.link.shorts || (S.link.shorts = {}));
  if (c[h] && !/\/\/(da|v)\.gd\//.test(c[h])) return { url: c[h] };   /* όχι παλιούς από da.gd/v.gd: δείχνουν σελίδα προειδοποίησης */
  /* ο σύντομος δείχνει στη μορφή με «?»: κάποιοι συντομευτές πετούν ό,τι είναι μετά το «#» */
  const target = url.length < 7000 ? url.replace("p.html#", "p.html?") : url;
  let err = null;
  /* τέσσερις προσπάθειες με τη σειρά: is.gd, v.gd, da.gd, TinyURL — αν μία έχει βλάβη, πάει στην επόμενη */
  /* πρώτα το is.gd (6΄΄), μετά το TinyURL */
  let svc = false;
  const keep = u => { c[h] = u; const keys = Object.keys(c); if (keys.length > 30) delete c[keys[0]]; save(); return { url: u }; };
  /* μόνο υπηρεσίες που ανοίγουν κατευθείαν τη σελίδα (όχι da.gd/v.gd, που βάζουν ενδιάμεση σελίδα «προσοχή») */
  try { return keep(await K.shorten(target, 6000, "is.gd")); } catch (e) { err = e; if (e && e.svc) svc = true; }
  try { return keep(await K.shorten2(target, "tinyurl", 9000)); } catch (e) { err = e; if (e && e.svc) svc = true; }
  return { url: "", err: (err && err.message) || "άγνωστο", svc };
}
/* ο καλύτερος σύντομος σύνδεσμος: αν η υπηρεσία δεν δέχεται τόσο μεγάλο κατάλογο, ξαναδοκιμάζει χωρίς φωτογραφίες και μετά χωρίς λογότυπο */
/* ο δικός μας σύντομος σύνδεσμος: «…/p.html#s=κωδικός» — ο κατάλογος φυλάγεται υπογεγραμμένος στην υπηρεσία μας */
async function ownShort(cust, lo) {
  if (!K.SHORT || S.link.noOwn) return "";
  await ensureKeys(); await ensureLiveKeys(); if (!S.nt.spriv || !S.nt.spub) return "";
  const long = await makeLink(cust, lo), pk = long.split("&k=")[1]; if (!pk) return "";
  const slot = cust && cust.k ? cust.k : "*", ids = S.link.sids || (S.link.sids = {});
  try { const id = await K.shortPut({ id: ids[slot], pk, g: await K.liveSign(S.nt.spriv, pk), sp: S.nt.spub });
    ids[slot] = id; save(); return { long, short: BASE + "p.html#s=" + id + S.nt.spub.slice(2, 8) }; } catch { return ""; }
}
/* όταν αλλάζει ο κατάλογος, ενημερώνεται και ο γενικός σύντομος σύνδεσμος (για όσους τον ανοίξουν αργότερα) */
let ownT = null;
function ownRefresh() { if (!K.SHORT || !(S.link.sids || {})["*"]) return; clearTimeout(ownT); ownT = setTimeout(() => ownShort(null).catch(() => {}), 300); }
async function shortLink(cust) {
  { const o = await ownShort(cust); if (o) return { long: o.long, short: o.short, dropped: {}, full: o.long, own: 1 }; }
  const tries = [{}];
  if (S.link.photos && isPro()) tries.push({ noPhotos: 1 });
  const hasIc = Object.values(S.products).some(p => p.aic) || JSON.stringify(S.menu).includes('"aic"');
  if (hasIc) tries.push({ noPhotos: 1, noIcons: 1 });
  if (S.shop.logo && S.link.logo) tries.push({ noPhotos: 1, noIcons: 1, noLogo: 1 });
  let first = "", r = null;
  for (const t of tries) {
    const long = await makeLink(cust, t); if (!first) first = long;
    r = await shortOf(long);
    if (r.url) return { long, short: r.url, dropped: t, full: first };
    if (!r.svc) break;   /* χωρίς διαδίκτυο ή η υπηρεσία δεν απαντά: το μικρότερο δεν θα βοηθήσει */
  }
  /* καμία υπηρεσία: στέλνεται ο μικρότερος κανονικός (χωρίς φωτογραφίες και λογότυπο), για να χωρέσει ολόκληρος */
  const small = tries.length > 1 ? await makeLink(cust, { noPhotos: 1, noLogo: 1, noIcons: 1 }) : first;
  return { long: small, short: "", err: r && r.err, svc: r && r.svc, full: first, small: small !== first };
}
const droppedTxt = d => d && (d.noPhotos || d.noLogo) ? `<div class="okbox" style="margin-top:8px">ℹ️ Ο κατάλογος ήταν πολύ μεγάλος για σύντομο σύνδεσμο, οπότε στέλνεται ${d.noLogo && S.link.photos && isPro() ? "χωρίς φωτογραφίες και χωρίς λογότυπο" : d.noLogo ? "χωρίς λογότυπο" : "χωρίς φωτογραφίες"}. Τα προϊόντα και οι τιμές είναι όλα μέσα.</div>` : "";
const VIBER_MAX = 6000;   /* πάνω από τόσο, το Viber μπορεί να κόψει τον σύνδεσμο */
const shortFailTxt = L => L.long.length > VIBER_MAX
  ? `<div class="errbox" style="margin-top:8px"><b>⛔ Μην τον στείλεις ακόμα: θα φτάσει κομμένος.</b><br>Οι υπηρεσίες σύντομου συνδέσμου δεν απαντούν τώρα (${L.svc ? esc(L.err || "") : "χωρίς διαδίκτυο"}) και ο κανονικός σύνδεσμος είναι πολύ μεγάλος για το Viber (${K.num(L.long.length)} χαρακτήρες). Περίμενε λίγα λεπτά και πάτα ξανά. <button type="button" class="btn sm amber" data-act="lkRetry" style="margin-top:6px">↻ Δοκίμασε ξανά</button></div>`
  : `<div class="warnbox" style="margin-top:8px">⚠️ Δεν έγινε σύντομος σύνδεσμος (${L.svc ? "οι υπηρεσίες απάντησαν: " + esc(L.err || "") : "χωρίς διαδίκτυο ή δεν απάντησαν"}). Στέλνεται ο κανονικός (${K.num(L.long.length)} χαρακτήρες)${L.small ? ", χωρίς λογότυπο και φωτογραφίες για να χωρέσει" : ""}· φτάνει ολόκληρος, απλώς το μήνυμα είναι μεγάλο. <button type="button" class="lnk" data-act="lkRetry">↻ Δοκίμασε ξανά</button></div>`;
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
  const W = lkWait("📤 Στείλε τον κατάλογο στους πελάτες");
  const SL = await shortLink(), long = SL.long, short = SL.short;
  if (!lkStill(W)) return;   /* το έκλεισες στο μεταξύ */
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
    ${short ? `<div class="okbox" style="margin-top:8px">✓ Σύντομος σύνδεσμος: φτάνει ολόκληρος και το μήνυμα μένει μικρό.</div>` + droppedTxt(SL.dropped) : shortFailTxt(SL)}
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
/* «λίγη υπομονή»: ανοίγει αμέσως, για να μη νομίζεις ότι δεν δουλεύει */
function lkWait(title) {
  sheet(title, `<div class="lkwait"><div class="spin" aria-hidden="true"></div><b>Ετοιμάζεται ο σύνδεσμος…</b><span>Λίγη υπομονή: φτιάχνεται ο σύντομος σύνδεσμος για το Viber. Συνήθως παίρνει 2–5 δευτερόλεπτα, καμιά φορά έως 15.</span></div>`, `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button>`, el => { el.dataset.lkwait = String(Date.now()); });
  return $("#shB").dataset.lkwait;
}
const lkStill = w => isSheetOpen() && $("#shB").dataset.lkwait === w;
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
   <div class="card"><h3>🔔 Ήχος για νέα παραγγελία</h3>
    <div class="ringopts">${[["off", "🔕", "Χωρίς ήχο", "μόνο η ειδοποίηση"], ["once", "🔔", "Ένα καμπανάκι", "χτυπά μία φορά"], ["loop", "🔁", "Συνεχόμενα", "μέχρι Αποδοχή, Αναμονή ή Απόρριψη"]].map(([k, ic, t, d]) => `<button type="button" class="${ringMode() === k ? "on" : ""}" data-ringmode="${k}"><span>${ic}</span><b>${t}</b><small>${d}</small></button>`).join("")}</div>
    <button type="button" class="btn sm soft" data-act="ringTest" style="margin-top:8px">▶ Άκου τον ήχο</button>
    <p class="note" style="margin:8px 0 0">Όσο είναι ανοιχτές οι Παραγγελίες, βγαίνει πάνω πάνω μια μπάρα με <b>✓ Αποδοχή · ⏸ Αναμονή · ✕ Απόρριψη</b>· τα ίδια κουμπιά υπάρχουν και πάνω στην ειδοποίηση του κινητού.</p>
    ${ringMode() === "loop" ? `<div class="warnbox" style="margin-top:8px">📲 <b>Και με κλειστή την εφαρμογή:</b> στην ntfy άνοιξε τη ροή «Παραγγελίες» → ⚙️ Ρυθμίσεις → άναψε το <b>«Keep alerting on highest priority»</b> (συνεχές χτύπημα για τις πιο σημαντικές). Οι παραγγελίες σου έρχονται πλέον με την υψηλότερη προτεραιότητα.</div>` : ""}</div>
   <div class="card"><h3>Και όταν η εφαρμογή είναι ανοιχτή</h3><button type="button" class="btn sm soft" data-act="ntPerm">Να εμφανίζονται ειδοποιήσεις και από εδώ</button>
    <p class="note">Η εφαρμογή ελέγχει για νέες παραγγελίες κάθε 30 δευτερόλεπτα όσο είναι ανοιχτή.</p></div>
   <p class="note">Οι παραγγελίες είναι κρυπτογραφημένες: τις διαβάζουν μόνο οι Παραγγελίες σε αυτό το κινητό, όχι η ntfy. Η ntfy είναι δωρεάν, χωρίς λογαριασμό και χωρίς κάρτα. Η υπηρεσία κρατά τα μηνύματα έως 12 ώρες· η ειδοποίηση όμως μένει στο κινητό σου και ανοίγει την παραγγελία όποτε την πατήσεις.</p>
   <label class="ck"><input type="checkbox" id="ntOn"${S.nt.on ? " checked" : ""}><span>Έκανα τα βήματα και οι ειδοποιήσεις έρχονται</span></label>`,
   `<button type="button" class="btn amber" data-act="ntDone">Τέλος</button>`);
}

/* ---------- αντίγραφα ασφαλείας: Google Drive και φάκελος κινητού ---------- */
function backupPayload() { let tm = null; try { tm = localStorage.getItem(EM_KEY); } catch {} return JSON.stringify({ app: "paraggelies", version: VERSION, at: new Date().toISOString(), state: Object.assign({}, S, { gdrive: undefined }), tameio: tm }); }
/* όταν αλλάζει κάτι μέσα στο Ταμείο, κρατιέται και στα αντίγραφα των Παραγγελιών */
let tmChT = null;
A.tameioChanged = () => { clearTimeout(tmChT); tmChT = setTimeout(() => { if (S) save(); }, 1200); };
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
/* άμεσο αντίγραφο ασφαλείας (πριν από μεγάλες διαγραφές) */
A.backupInfo = () => { let on = false; try { on = !!(window.GlenDrive && GlenDrive.state().on); } catch {} return { drive: on, text: gdState() }; };
A.backupFile = () => download("paraggelies-antigrafo-" + today() + ".json", backupPayload(), "application/json");
A.backupNow = () => { if (DEMO) return; clearTimeout(saveT); write(); try { window.GlenDrive && GlenDrive.state().on && GlenDrive.changed(); } catch {} PH.get().then(h => h && PH.write(false)).catch(() => {}); };
function phoneBackupSoon() { if (DEMO) return; clearTimeout(phT); phT = setTimeout(() => { PH.get().then(h => h && PH.write(false)).catch(() => {}); }, 20000); }
async function backupSheet() {
  let g = { on: false }; try { if (window.GlenDrive) g = GlenDrive.state() || g; } catch {}
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
  if (typeof d.tameio === "string") { try { localStorage.setItem(EM_KEY, d.tameio); localStorage.removeItem(EMQ); } catch {} if (tmFrameEl) { tmFrameEl.remove(); tmFrameEl = null; } }
  write().then(() => { closeSheet(); toast("✓ Έγινε επαναφορά"); render(); });
}
function download(name, text, type) { const b = new Blob([text], { type }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }

/* ---------- εξαγωγή σε Excel (CSV με ελληνικούς χαρακτήρες) ---------- */
const csvCell = v => { const s = typeof v === "number" ? String(Math.round(v * 1000) / 1000).replace(".", ",") : String(v == null ? "" : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csv = rows => "﻿" + rows.map(r => r.map(csvCell).join(";")).join("\r\n");
function xlsOrders(from, to) {
  const L = S.orders.filter(o => o.st !== "dup" && (!from || (o.when.date || "") >= from) && (!to || (o.when.date || "") <= to)).sort((a, b) => (a.when.date || "").localeCompare(b.when.date || "") || a.no - b.no);
  const rows = [["Αρ.", "Κωδικός", "Υποβολή", "Ημέρα", "Ώρα", "Τρόπος", "Πελάτης", "Τηλέφωνο", "Διεύθυνση", "Είδος", "Ποσότητα", "Μονάδα", "Τιμή", "ΦΠΑ %", "Ποσό", "Σύνολο παραγγελίας", "Κατάσταση", "Πληρωμένη", "Σημείωση", "Παραστατικό", "Επωνυμία", "ΑΦΜ", "ΔΟΥ", "Έκτακτη"]];
  L.forEach(o => o.lines.forEach((l, i) => rows.push([o.no, code(o), fmtTime(o.at), o.when.date, o.when.slot, o.when.how === "pick" ? "Παραλαβή" : "Παράδοση", o.cust.name, o.cust.phone, o.cust.addr, K.lnName(l), l.q, l.unit, l.price, l.vat, l.sum, i === 0 ? o.total : "", ST[o.st], o.paid ? "Ναι" : "Όχι", i === 0 ? o.cust.note : "", i === 0 ? (o.inv && o.inv.t === "i" ? "Τιμολόγιο" : o.inv && o.inv.t === "r" ? "Απόδειξη" : "") : "", i === 0 && o.inv && o.inv.t === "i" ? o.inv.n : "", i === 0 && o.inv && o.inv.t === "i" ? o.inv.f : "", i === 0 && o.inv && o.inv.t === "i" ? o.inv.d : "", i === 0 && o.when.extra ? "Ναι" : ""])));
  return rows;
}
function xlsDay(day) {
  const L = S.orders.filter(o => o.st !== "cancel" && o.st !== "dup" && o.when.date === day), per = {};
  L.forEach(o => o.lines.forEach(l => { const x = per[l.pid] || (per[l.pid] = [l.name, 0, l.unit, 0]); x[1] += l.q; x[3] = K.round2(x[3] + l.sum); }));
  return [["Σύνολα ημέρας", day], [], ["Είδος", "Ποσότητα", "Μονάδα", "Ποσό"]].concat(Object.values(per)).concat([[], ["Παραγγελίες", L.length], ["Σύνολο", K.round2(L.reduce((a, o) => a + o.total, 0))], ["Εισπράχθηκαν", K.round2(L.filter(o => o.paid).reduce((a, o) => a + Math.min(o.total, paidOf(o)), 0))], [], ["Αναλυτικά"]]).concat(xlsOrders(day, day));
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
      /* όχι μόνη της όταν δουλεύεις: ανοιχτό παράθυρο, προεπισκόπηση, ή διαδρομή σε εξέλιξη (θα χανόταν) — τότε βγαίνει η μπάρα «νέα έκδοση» */
      if (manual || (!isSheetOpen() && !previewOpen() && tab !== "route" && tab !== "map" && !RT.res)) await applyUpdate();
      else render();
    } else if (manual) toast("✓ Έχεις την τελευταία έκδοση (" + VERSION + ").");
  } catch { if (manual) toast("Δεν υπάρχει σύνδεση στο διαδίκτυο."); }
  updBusy = false;
}
async function applyUpdate() {
  toast("⬆️ Αναβάθμιση σε " + (updNew || "νέα έκδοση") + "… τα δεδομένα σου μένουν.", 3000);
  clearTimeout(saveT); await write();
  try { const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (reg) { await reg.update(); if (reg.waiting) reg.waiting.postMessage({ type: "skipWaiting" }); } } catch {}
  /* τις παλιές μνήμες τις σβήνει ο νέος διαχειριστής εκτός σύνδεσης όταν ενεργοποιηθεί· έτσι το Ταμείο δουλεύει και χωρίς διαδίκτυο */
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
  paste: pasteSheet, newOrder: () => orderForm(), catPick: () => catPick(),
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
  look: () => lookSheet(),
  lkReset: () => { S.ui.look = {}; save(); applyLook(); lookSheet(); },
  holdNext: () => holdDo("next"), holdDay: () => holdDo("day"),
  holdBack: () => { const o = $("#shB").dataset.hdo; if (o) openOrder(o); else closeSheet(); },
  askToggle: () => { S.ui.noAsk = !S.ui.noAsk; save(); render(); toast(S.ui.noAsk ? "Η πρόταση ενημέρωσης πελάτη δεν θα βγαίνει. Το μήνυμα το στέλνεις από μέσα από την παραγγελία." : "✓ Η πρόταση ενημέρωσης πελάτη θα βγαίνει πάλι μετά από κάθε αλλαγή κατάστασης.", 4500); },
  heroFut: () => heroGo("fut"),
  dayRoute: () => { const d = ordFilter.day, L = dayDels(d).map(x => x.key); if (!L.length) return; RT.visit = null; RT.day = "all"; rtOpen(L); setTimeout(() => { if (tab === "route" && RT.sel && RT.sel.size) rtGo(); }, 80); },
  zAdd: () => { const Z = zonesRead(); Z.push({ a: [], d: [] }); zonesPut(Z); const i = $(`[data-za="${Z.length - 1}"]`); if (i) i.focus(); },
  zEx: () => { const Z = zonesRead().filter(z => z.a.length || z.d.length); Z.push({ a: ["Εξάρχεια", "Αμπελόκηποι"], d: [1, 3, 5] }, { a: ["Κυψέλη", "Πατήσια"], d: [2, 4, 6] }); zonesPut(Z); toast("Άλλαξε τις περιοχές και τις ημέρες όπως θέλεις και πάτα «Αποθήκευση».", 4500); },
  lkPhoto: () => { const f = $("#lkFile"); if (f) f.click(); },
  lang: () => sheet("🌐 Γλώσσα · Language", `<div class="bigopts">${[["el", "🇬🇷", "Ελληνικά"], ["en", "🇬🇧", "English"]].map(([k, f, n]) => `<button type="button" class="bigopt" data-setlang="${k}"><span class="e">${f}</span><span class="t"><b data-notr="1">${n}</b></span>${(window.Glossa && Glossa.lang) === k ? '<span class="g">✓</span>' : ""}</button>`).join("")}</div><p class="note" data-notr="1">Η γλώσσα αφορά την εφαρμογή σου. Οι πελάτες βλέπουν τη σελίδα παραγγελίας στα ελληνικά. · The language applies to your app. Customers see the order page in Greek.</p>`),
  prepSheet: () => sheet("📦 Ετοιμασία ημέρας", prepView()),
  lkSave: () => { S.ui.tmSync = !!$("#lkTm").checked; S.ui.imSync = !!($("#lkIm") && $("#lkIm").checked && packSt && packSt.full); save(); closeSheet(); tmSync(); toast("✓ Αποθηκεύτηκε", 2000); render(); },
  tmYes: () => { S.ui.tmSync = true; save(); closeSheet(); tmSync(); toast("✓ Τα έσοδα και τα έξοδα θα φαίνονται και στα Ταμεία (βιβλίο «Εταιρεία»).", 4000); render(); },
  tmNo: () => { S.ui.tmSync = false; save(); closeSheet(); tmSync(); toast("Εντάξει, οι Παραγγελίες μένουν χωριστά. Αλλάζει από τις Ρυθμίσεις.", 3500); render(); },
  tmLink: () => linkSheet2(),
  kontamou: () => sheet("🗺 Προβολή στο «Κοντά μου»", `<div class="card"><p style="margin-top:0">Το «Κοντά μου» είναι ο χάρτης της κοινότητας GlenApps, όπου ήδη βρίσκουν μάστορες και επαγγελματίες της περιοχής τους.</p><p>Σε επόμενη έκδοση θα μπορείς, αν το θέλεις, να εμφανίζεται και η επιχείρησή σου εκεί, ώστε νέοι πελάτες να βρίσκουν τον κατάλογό σου και να παραγγέλνουν.</p><p class="note" style="margin:0">Τίποτα δεν δημοσιεύεται χωρίς να το ενεργοποιήσεις εσύ.</p></div>`),
  cashSave: () => { const b = $("#shB"), v = K.parseNum($("#cxA").value); if (!isFinite(v) || v <= 0) { toast("Γράψε ποσό."); return; } const id = b.dataset.cid; let x = id && cashList().find(c => c.id === id); if (!x) { x = { id: "c" + K.uid(6).replace(/[.]/g, "x"), kind: b.dataset.ckind, src: "paraggelies", created: Date.now() }; cashList().push(x); } const k = ckOf(b.dataset.xck); Object.assign(x, { d: $("#cxD").value || today(), amt: K.round2(v), ck: b.dataset.xck, sub: b.dataset.xsub || "", cat: b.dataset.xsub || (k ? k.name : ""), vat: $("#cxV").value === "" ? "" : +$("#cxV").value, note: $("#cxN").value.trim() }); save(); closeSheet(); render(); toast("✓ Καταχωρίστηκε"); },
  cashDel: () => { const id = $("#shB").dataset.cid; if (!confirm("Διαγραφή της κίνησης;")) return; S.cash = cashList().filter(c => c.id !== id); save(); closeSheet(); render(); },
  clAdd: () => { const v = $("#dvClAdd").value; if (!/^\d{4}-\d\d-\d\d$/.test(v)) { toast("Διάλεξε ημερομηνία."); return; } const d = S.deliv; d.closed = [...new Set((d.closed || []).concat(v))]; save({ catalog: true }); keepDeliv(); },
  rtLink: async () => { const c = delivSave(true); if (c) { await custLinkSheet(c.key); } },
  ncSave: () => { const n = $("#ncN").value.trim(), p = $("#ncP").value.trim(); if (n.length < 2 || p.replace(/\D/g, "").length < 10) { $("#ncErr").innerHTML = `<div class="errbox">Γράψε όνομα και τηλέφωνο (10 ψηφία).</div>`; return; } const c = upsertCustomer({ name: n, phone: p, addr: $("#ncA").value.trim() }, Date.now()); { const ex = phonesRead("ncP").extra.filter(x => phDig(x) !== phDig(c.phone)); if (ex.length) c.phones = [...new Set([...(c.phones || []), ...ex])].slice(0, PH_MAX - 1); } { const ar = $("#ncAr") ? $("#ncAr").value.trim() : ""; if (ar) c.area = ar; } if (A._ncPh && A._ncPh === c.key) c.inPh = 1; A._ncPh = null; save(); const f = A._ncAfter; A._ncAfter = null; if (f) f(c.key); else { render(); openCust(c.key); } },
  custNewBtn: () => newCustSheet(null),
  custContacts: () => importContacts(),
  ncMany: async () => { closeSheet(); await importContacts(); },
  ncContact: async () => { const r = await pickContacts(false); if (!r) return; const d = contactToCust(r[0]); if ($("#ncN") && d.name) $("#ncN").value = d.name; if ($("#ncP") && d.phone) { $("#ncP").value = d.phone; phSync($("#ncP").closest("[data-phs]")); } if ($("#ncA") && d.addr) $("#ncA").value = d.addr; if ($("#ncAr") && d.area) $("#ncAr").value = d.area; if (!d.phone) toast("Η επαφή δεν έχει κινητό.", 3000); else A._ncPh = custKey(d.phone); },
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
  termsOk: () => { if (!$("#trmOk").checked) { toast("Χρειάζεται η αποδοχή των όρων."); return; } S.terms = { v: 1, at: Date.now() }; save(); closeSheet(); linkSheet(); },
  lkShare: async () => { const b = $("#shB"); if (navigator.share) { try { await navigator.share({ text: b.dataset.msg }); linkSent(); return; } catch (e) { if (e && e.name === "AbortError") return; } } await ACT.lkCopy(); setTimeout(() => { location.href = "viber://forward?text=" + encodeURIComponent("Επικόλλησε εδώ τον σύνδεσμο"); }, 400); },
  lkRetry: () => { const k = $("#shB") && $("#shB").dataset.lkcust; closeSheet(); setTimeout(() => k ? custLinkSheet(k) : linkSheet(), 50); },
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
  ringTest: () => { ringAc(); chime(); },
  ntDone: () => { S.nt.on = $("#ntOn").checked; save(); closeSheet(); render(); },
  shopSave, delivSave: () => delivSave(), licGo,
  logoDel: () => { $("#shB").dataset.logoDel = "1"; delete $("#shB").dataset.logo; $("#shLogoPrev").innerHTML = `<span class="note">Χωρίς λογότυπο</span>`; },
  fSave: formSave,
  pasteClip: async () => { try { $("#ptxt").value = await navigator.clipboard.readText(); } catch { toast("Κράτα πατημένο το πλαίσιο και διάλεξε «Επικόλληση»."); } },
  pasteGo: () => { const t = $("#ptxt").value.trim(); if (!t) { toast("Επικόλλησε πρώτα το μήνυμα."); return; } A.importText(t); },
  ordEdit: () => { const o = curOrd(); if (!o) return; const q = {}, keep = {}, ol = []; o.lines.forEach(l => { if (l.opt || l.note || l.pend || q[l.pid] != null || pHasOpts(S.products[l.pid])) ol.push(Object.assign({ pid: l.pid, q: l.q, opt: l.opt || "", n: l.note || "", price: l.price }, l.pend ? { pend: l.pend } : {})); else { q[l.pid] = l.q; keep[l.pid] = l.price; } }); orderForm({ id: o.id, name: o.cust.name, phone: o.cust.phone, addr: o.cust.addr, note: o.cust.note, date: o.when.date, slot: o.when.slot, how: o.when.how, q, keep, ol }); },
  ordVcf: async () => { const o = curOrd(); if (!o) return; const k = custKey(o.cust.phone), c = S.customers[k] || {};
    await saveToPhone({ name: o.cust.name || c.name, phone: o.cust.phone, phones: c.phones, addr: o.cust.addr || c.addr, area: o.cust.area || c.area }, k); if (curOrd()) openOrder(o.id); },
  custVcf: async () => { const k = $("#shB").dataset.cust, c = S.customers[k]; if (!c) return; await saveToPhone({ name: c.name, phone: c.phone, phones: c.phones, addr: c.addr, area: c.area }, k); },
  payBack: () => { const o = curOrd(); if ($("#shB").dataset.pfrom === "list" || !o) closeSheet(); else openOrder(o.id); },
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
  custPick: () => { const k = $("#shB").dataset.cust; ACT.custSave(true); pickOnMap(k); },
  custGm: () => { const k = $("#shB").dataset.cust; ACT.custSave(true); gmSheet(k); },
  gmSave: () => { const k = $("#shB").dataset.gmk, c = S.customers[k]; if (!c) return; const t = ($("#gmLL").value || "").trim();
    if (!t) { toast("Επικόλλησε πρώτα τη θέση (βήμα 3) ή πάτα «📋 Επικόλληση».", 4000); return; }
    const p = parseLL(t, gmRef(c));
    if (!p) { toast(gmShortLink(t) ? "Αυτός είναι σύντομος σύνδεσμος χωρίς αριθμούς. Αντέγραψε τους αριθμούς της καρφίτσας (π.χ. 37,98380, 23,72750)." : "Δεν βρήκα θέση. Επικόλλησε κάτι σαν 37,98380, 23,72750", 6000); return; }
    if (!inGR(p) && !confirm("Αυτό το σημείο είναι έξω από την Ελλάδα. Να κρατηθεί;")) return;
    c.pin = { lat: p.lat, lng: p.lng, at: Date.now() }; save(); toast("✓ Κρατήθηκε η θέση του πελάτη", 3000); openCust(k); },
  gmPaste: async () => { const c = S.customers[$("#shB").dataset.gmk], i = $("#gmLL"); if (!i) return;
    let t = ""; try { t = navigator.clipboard && navigator.clipboard.readText ? await navigator.clipboard.readText() : ""; } catch { t = ""; }
    if (!t) { i.focus(); toast("Κράτα πατημένο το κουτί και διάλεξε «Επικόλληση».", 4500); return; }
    i.value = t.trim(); gmPreview(c); },
  gmHere: async () => { const k = $("#shB").dataset.gmk, c = S.customers[k]; if (!c) return; toast("📍 Βρίσκω τη θέση σου…");
    const p = await myPos(); if (!p) { toast("Δεν βρέθηκε η θέση. Άνοιξε τον εντοπισμό (Ρυθμίσεις → Απόρρητο → Υπηρεσίες τοποθεσίας στο iPhone).", 6000); return; }
    c.pin = { lat: p.lat, lng: p.lng, at: Date.now() }; save(); toast("✓ Κρατήθηκε η θέση εκεί που είσαι τώρα", 3000); openCust(k); },
  gmPick: () => { const k = $("#shB").dataset.gmk; if (k) pickOnMap(k); },
  custGeoCheck: async () => {
    const k = $("#shB").dataset.cust, c = S.customers[k]; if (!c) return;
    ACT.custSave(true);
    if (!(c.addr || "").trim()) { toast("Γράψε πρώτα διεύθυνση.", 2500); return; }
    if (!navigator.onLine) { toast("Χρειάζεται σύνδεση στο διαδίκτυο.", 3000); return; }
    const st = $("#cuGeoSt"); if (st) st.innerHTML = `<span class="mid">🔎 Ψάχνω «${esc(c.addr)}${c.area ? ", " + esc(c.area) : ""}»…</span>`;
    const p = await geoFind(c.addr, { area: c.area, force: true }); custAutoArea(c, p); save();
    render();
    if (isSheetOpen() && $("#shB").dataset.cust === k) { const sc = $("#shB").scrollTop; openCust(k); $("#shB").scrollTop = sc; }
    toast(p ? (p.approx ? "≈ Βρέθηκε μόνο η περιοχή" : "✓ Βρέθηκε στον χάρτη") : navigator.onLine ? "⚠️ Δεν βρέθηκε η διεύθυνση" : "Χωρίς σύνδεση", 3000);
  },
  custSave: (keep) => { let c = S.customers[$("#shB").dataset.cust]; if (!c) return; c.name = $("#cuN").value.trim() || c.name;
    { const np = $("#cuP").value.trim(), ok = custKey(np || ""), ok0 = c.key;
      if (np && ok && ok !== ok0) {
        /* νέο κινητό: ο πελάτης μεταφέρεται στο νέο του κλειδί, μαζί με τις παραγγελίες του (αλλιώς η επόμενη παραγγελία θα έφτιαχνε δεύτερο πελάτη) */
        if (S.customers[ok]) { toast("Υπάρχει ήδη πελάτης με αυτό το κινητό (" + S.customers[ok].name + "). Δεν άλλαξε.", 4500); }
        else { for (const o of S.orders) if (custKey(o.cust.phone) === ok0) o.cust.phone = np;
          for (const x of S.pend || []) if (x.k === ok0) x.k = ok;
          for (const p of Object.values(S.products)) if ((p.onlyFor || []).includes(ok0)) p.onlyFor = p.onlyFor.map(v => v === ok0 ? ok : v);
          if (S.link.sids && S.link.sids[ok0]) { S.link.sids[ok] = S.link.sids[ok0]; delete S.link.sids[ok0]; }
          delete S.customers[ok0]; c.key = ok; S.customers[ok] = c; c.phone = np; $("#shB").dataset.cust = ok; }
      } else if (np) c.phone = np;
      const ex = phonesRead("cuP").extra.filter(x => phDig(x) !== phDig(c.phone)); if (ex.length) c.phones = ex; else delete c.phones; } const oldAd = (c.addr || "") + "|" + (c.area || ""); c.addr = $("#cuA").value.trim(); { const na = ($("#cuAr").value || "").trim(); if (na !== (c.area || "") || keep !== true) delete c.areaAuto; c.area = na; } const adCh = oldAd !== c.addr + "|" + c.area; if (c.pin && adCh && !c.pin.keep) delete c.pin; if (!c.area) delete c.area; if (adCh && keep !== true && (c.addr || "").trim()) setTimeout(() => custGeo(c).then(() => { save(); if (tab === "custs") render(); }).catch(() => {}), 50); c.notes = $("#cuNo").value.trim(); save(); if (keep === true) return; closeSheet(); render(); },
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
  rtOpen: () => rtOpen(),
  custMap: () => { closeSheet(); tab = "map"; window.scrollTo(0, 0); render(); },
  rtDay: () => { const d = dvDay, L = dvOrders(d).filter(o => (o.st === "new" || o.st === "prep") && o.when.how !== "pick"); closeSheet(); RT.day = d === today() ? "today" : d === addDays(today(), 1) ? "tom" : "all"; rtOpen(L.map(o => "o:" + o.id)); },
  shopPinHere: async () => { toast("📍 Βρίσκω τη θέση σου…"); const p = await myPos(); if (!p) { toast("Δεν βρέθηκε η θέση. Άνοιξε τον εντοπισμό του κινητού.", 4000); return; } S.shop.pin = { lat: p.lat, lng: p.lng, at: Date.now() }; geoBaseP = null; save(); toast("✓ Κρατήθηκε η θέση της έδρας", 2500); },
  custPinHere: async () => { const k = $("#shB").dataset.cust, c = S.customers[k]; if (!c) return; toast("📍 Βρίσκω τη θέση σου…"); const p = await myPos(); if (!p) { toast("Δεν βρέθηκε η θέση. Άνοιξε τον εντοπισμό του κινητού.", 4000); return; } c.pin = { lat: p.lat, lng: p.lng, at: Date.now() }; save(); toast("✓ Κρατήθηκε η θέση του πελάτη για το Δρομολόγιο"); },
  collectList: () => collectList(),
  buyPro: async () => { const r = $("#lref"); if (r) { const v = r.value.trim().toUpperCase(); if (v && !/^GA-[0-9A-F]{6}$/.test(v)) { toast("Ο κωδικός σύστασης έχει τη μορφή GA-XXXXXX."); return; } if (v) S.lic.ref = v; else delete S.lic.ref; save(); }
    const pr = proPriceNow(), em = ($("#lmail") && $("#lmail").value.trim()) || S.lic.email || "", sh = S.shop;
    const body = "Θέλω κλειδί Pro για την εφαρμογή «Παραγγελίες».\n\nΗλεκτρονικό ταχυδρομείο για το κλειδί: " + (em || "…") + "\nΕπιχείρηση: " + (sh.name || "…") + (sh.legal ? " (" + sh.legal + ")" : "") + "\nΑΦΜ: " + (sh.afm || "…") + "\nΤηλέφωνο: " + (sh.phone || "…") + "\nΤιμή: " + pr.v + " € " + pr.why + (S.lic.ref ? "\nΚωδικός σύστασης: " + S.lic.ref : "") + (S.lic.until ? "\nΤωρινό κλειδί λήγει: " + S.lic.until.split("-").reverse().join("/") : "");
    location.href = "mailto:" + PRO_MAIL + "?subject=" + encodeURIComponent("Κλειδί Pro Παραγγελίες" + (S.lic.until ? " (ανανέωση)" : "")) + "&body=" + encodeURIComponent(body); },
  refShare: async () => { const c = await refCode(S.lic.email), t = "Για τις παραγγελίες των πελατών μου χρησιμοποιώ τις «Παραγγελίες» της GlenApps. Με τον κωδικό σύστασής μου " + c + " πληρώνεις " + PRO_INTRO + " € και τον δεύτερο χρόνο του Pro: " + BASE;
    if (navigator.share) { try { await navigator.share({ text: t }); return; } catch (e) { if (e && e.name === "AbortError") return; } } try { await navigator.clipboard.writeText(t); toast("✓ Αντιγράφηκε"); } catch { prompt("", t); } },
  collectGo: () => {
    const b = $("#shB"), k = b.dataset.cust, via = S.ui.payVia || "Μετρητά", L = custUnpaid(k), rem = o => o.paid ? diffOf(o) : o.total;
    let sum = 0, n = 0;
    if (b.dataset.mode === "part") {
      let left = K.parseNum(($("#colAmt") || {}).value || ""), tot = K.round2(L.reduce((a, o) => a + rem(o), 0));
      if (!(left > 0)) { toast("Γράψε πόσα έδωσε."); return; }
      if (left > tot + 0.004) { toast("Είναι περισσότερα από όσα χρωστά (" + K.money(tot) + ")."); return; }
      for (const o of L) { if (left <= 0.004) break; const take = K.round2(Math.min(rem(o), left)); if (take > 0) { payAdd(o, take, via); left = K.round2(left - take); sum += take; n++; } }
    } else {
      $$("[data-colo]").forEach(i => { if (!i.checked) return; const o = S.orders.find(x => x.id === i.dataset.colo); if (!o) return; const r = rem(o); if (r > 0) { payAdd(o, r, via); sum += r; n++; } });
    }
    if (!n) { toast("Διάλεξε τουλάχιστον μία παραγγελία."); return; }
    save(); render(); const still = custStats(k).owed;
    toast("✓ Εισπράχθηκαν " + K.money(K.round2(sum)) + " (" + via + ")" + (still > 0 ? " · μένουν " + K.money(still) : " · εξοφλήθηκε"), 4000);
    if (still > 0) collectCust(k, b.dataset.mode); else collectList(); },   /* μένει στον ίδιο τρόπο: ένα δεύτερο πάτημα δεν εξοφλεί κατά λάθος τα πάντα */
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
  { const x = t.closest("[data-theme]"); if (x) { S.ui.look = Object.assign(lookOf(), { theme: x.dataset.theme }); save(); applyLook(); const y = $("#shB").scrollTop; lookSheet(); $("#shB").scrollTop = y; return; } }
  { const x = t.closest("[data-lkbg]"); if (x) { if (x.dataset.lkbg === "photo" && !lookOf().custom) { const f = $("#lkFile"); if (f) f.click(); return; } S.ui.look = Object.assign(lookOf(), { bg: x.dataset.lkbg }); save(); applyLook(); const y = $("#shB").scrollTop; lookSheet(); $("#shB").scrollTop = y; return; } }
  { const x = t.closest("[data-setlang]"); if (x) { if (window.Glossa) Glossa.set(x.dataset.setlang); return; } }
  { const x = t.closest("[data-ccall]"); if (x) { e.stopPropagation(); custCall(x.dataset.ccall); return; } }
  { const x = t.closest("[data-cmsg]"); if (x) { e.stopPropagation(); custMsg(x.dataset.cmsg); return; } }
  { const x = t.closest("[data-cpin]"); if (x) { e.stopPropagation(); custPinGo(x.dataset.cpin); return; } }
  if (t.closest("[data-noprop]")) return;
  { let x;
    if ((x = t.closest("[data-cm]"))) { cmAct(x.dataset.cm); return; }
    if ((x = t.closest("[data-cmf]"))) { custMap(x.dataset.cmf); return; }
    if ((x = t.closest("[data-cmmiss]"))) { e.preventDefault(); cmMissSheet(); return; }
    if ((x = t.closest("[data-cmidle]"))) { cm.idle = +x.dataset.cmidle; custMap(); return; } }
  /* «Αφετηρία και τέλος» μέσα στο αναδυόμενο παράθυρο */
  { const x = t.closest("#shB [data-rtfrom], #shB [data-rtend]");
    if (x) { const f = $("#rtFromT"), f2 = $("#rtEndT"); if (f) rtPref().fromText = f.value.trim(); if (f2) rtPref().endText = f2.value.trim();
      if (x.dataset.rtfrom) rtPref().from = x.dataset.rtfrom; else rtPref().end = x.dataset.rtend;
      save(); if (tab === "route") render(); rtSetSheet(); return; } }
  if (tab === "route" && !t.closest("#sheetbg") && !t.closest("#cmDlg")) {
    const q = (sel) => t.closest(sel);
    let x;
    if ((x = q("[data-rt]"))) { rtAct(x.dataset.rt, x); return; }
    if ((x = q("[data-rtsel]"))) { const k = x.dataset.rtsel; if (x.checked) RT.sel.add(k); else RT.sel.delete(k); render(); return; }
    if ((x = q("[data-rtall]"))) { const L = rtCands().filter(y => y.kind === x.dataset.rtall && y.addr), all = L.every(y => RT.sel.has(y.key)); L.forEach(y => all ? RT.sel.delete(y.key) : RT.sel.add(y.key)); render(); return; }
    if ((x = q("[data-rtfrom]"))) { const f = $("#rtFromT"); if (f) rtPref().fromText = f.value.trim(); rtPref().from = x.dataset.rtfrom; save(); render(); if ($("#shB") && $("#shB").dataset.rtset) rtSetSheet(); return; }
    if ((x = q("[data-rtend]"))) { const f = $("#rtEndT"); if (f) rtPref().endText = f.value.trim(); rtPref().end = x.dataset.rtend; save(); render(); if ($("#shB") && $("#shB").dataset.rtset) rtSetSheet(); return; }
    if ((x = q("[data-rtmode]"))) { rtPref().mode = x.dataset.rtmode; save(); render(); return; }
    if ((x = q("[data-rtday]"))) { RT.day = x.dataset.rtday; RT.sel = null; render(); return; }
    if ((x = q("[data-rttoll]"))) { rtPref().tolls = x.dataset.rttoll === "1"; save(); if (RT.step === "res" && RT.res) { RT.res.road = null; RT.res.tried = null; render(); } else render(); return; }
    if (t.id === "rtReal") { rtPref().real = t.checked; save(); return; }
    if ((x = q("[data-rtcard]"))) { openCust(x.dataset.rtcard); return; }
    if ((x = q("[data-rtcust]"))) { e.preventDefault(); openCust(x.dataset.rtcust); return; }
    if ((x = q("[data-rtoff]"))) { const k = x.dataset.rtoff; RT.off.has(k) ? RT.off.delete(k) : RT.off.add(k); render(); return; }
    if ((x = q("[data-rtdone]"))) { const o = S.orders.find(y => y.id === x.dataset.rtdone); if (o && setStatus(o, "done")) { render(); askNotify(o, "done"); } return; }
    if ((x = q("[data-rtpay]"))) { collectCust(x.dataset.rtpay); return; }
    if ((x = q("[data-rtpaid]"))) { const o = S.orders.find(y => y.id === x.dataset.rtpaid); if (o && owes(o) && confirm("Εισπράχθηκαν " + K.money(dueOf(o)) + " για την παραγγελία #" + o.no + " (" + o.cust.name + ");")) { setStatus(o, o.paid ? "paydiff" : "paid"); render(); toast("✓ Πληρώθηκε · μπήκε στο Ταμείο"); } return; }
  }
  const fo = t.closest("[data-fopt]"); if (fo) { catPick(fo.dataset.fopt); return; }
  const olm = t.closest("[data-olm]"); if (olm) { olQty(+olm.dataset.olm, -1); return; }
  const olp = t.closest("[data-olp]"); if (olp) { olQty(+olp.dataset.olp, 1); return; }
  const fm = t.closest("[data-fm]"); if (fm) { formQty(fm.dataset.fm, -1); return; }
  const fp = t.closest("[data-fp]"); if (fp) { formQty(fp.dataset.fp, 1); return; }
  const nx = t.closest("[data-next]"); if (nx) { e.stopPropagation(); const o = S.orders.find(x => x.id === nx.dataset.next); if (o) {
      if (nx.dataset.to === "paid") { paySheet(o, true); return; }
      const from = o.st, fsig = JSON.stringify(ordFilter); const done = setStatus(o, nx.dataset.to);
      if (done) { MOVED[o.id] = { at: Date.now(), f: fsig, from, undo: nx.dataset.to === "prep" || nx.dataset.to === "done" }; setTimeout(() => { if (tab === "orders" && !isSheetOpen()) render(); }, 3 * 6e4 + 500); }
      render(); if (done) askNotify(o, nx.dataset.to); } return; }
  const us = t.closest("[data-undost]"); if (us) { e.stopPropagation(); const o = S.orders.find(x => x.id === us.dataset.undost), m = o && MOVED[o.id]; if (o && m && m.undo) { o.log.push([Date.now(), "Αναίρεση: ξανά «" + ST[m.from] + "»"]); o.st = m.from; delete MOVED[o.id]; save(); render(); toast("↩ Η #" + o.no + " ξανά «" + ST[m.from] + "»"); } return; }
  const rgb = t.closest("[data-ring]"); if (rgb) { ringAct(rgb.dataset.ring, rgb.dataset.rid); return; }
  const ro = t.closest("[data-ringopen]"); if (ro) { ringAct("open", ro.dataset.ringopen); return; }
  const rm = t.closest("[data-ringmode]"); if (rm) { S.nt.ring = rm.dataset.ringmode; save({ catalog: true }); if (rm.dataset.ringmode !== "off") { ringAc(); chime(); } if (rm.dataset.ringmode !== "loop") { clearInterval(RING.t); RING.t = null; ringBar(); } notifSheet(); return; }
  const hro = t.closest("[data-hero]"); if (hro) { heroGo(hro.dataset.hero); return; }
  const os = t.closest("[data-ost]"); if (os) { ordFilter.st = os.dataset.ost; render(); return; }
  const hb = t.closest("[data-hold]"); if (hb) { const o = curOrd(); if (o) holdSheet(o, +hb.dataset.hold); return; }
  const uh = t.closest("[data-unhold]"); if (uh) { const o = curOrd(); if (o) unhold(o, uh.dataset.unhold); return; }
  const csx = t.closest("[data-cusort]"); if (csx) { S.ui.cuSort = csx.dataset.cusort; save(); render(); return; }
  const zd = t.closest("[data-zdel]"); if (zd) { const Z = zonesRead(); Z.splice(+zd.dataset.zdel, 1); zonesPut(Z); return; }
  const od = t.closest("[data-oday]"); if (od) { ordFilter.day = od.dataset.oday; render(); return; }
  const td = t.closest("[data-tday]"); if (td) { totDay = td.dataset.tday; render(); return; }
  const ost = t.closest("[data-ordst]"); if (ost) { const o = curOrd(); if (o) { const done = setStatus(o, ost.dataset.ordst); render(); if (done) askNotify(o, ost.dataset.ordst); else openOrder(o.id); } return; }
  const pyv = t.closest("[data-payvia]"); if (pyv) { const o = curOrd(); if (o) { o.payVia = S.ui.payVia = pyv.dataset.payvia; const b = $("#shB"), fromList = b.dataset.pfrom === "list", fsig = b.dataset.fsig, from = o.st; setStatus(o, "paid"); o.log[o.log.length - 1][1] += " · " + o.payVia; save();
      if (fromList) { MOVED[o.id] = { at: Date.now(), f: fsig, from, undo: false, paid: 1 }; closeSheet(); setTimeout(() => { if (tab === "orders" && !isSheetOpen()) render(); }, 3 * 6e4 + 500); } else openOrder(o.id); render(); toast("✓ Πληρώθηκε " + K.money(o.total) + " · " + payIc(o.payVia) + " " + o.payVia); } return; }
  const op = t.closest("[data-ordpaid]"); if (op) { const o = curOrd(); if (o && op.dataset.ordpaid === "1") { paySheet(o); return; } if (o) { setStatus(o, op.dataset.ordpaid === "1" ? "paid" : op.dataset.ordpaid === "diff" ? "paydiff" : "unpaid"); openOrder(o.id); render(); } return; }
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
  const cpl = t.closest("[data-cpl]"); if (cpl) { const k = $("#shB").dataset.cust, c = S.customers[k]; if (c) { ACT.custSave(true); if (cpl.dataset.cpl === "w") c.pl = "w"; else delete c.pl; save(); openCust(k); toast(c.pl === "w" ? "Χονδρική: παίρνει τις τιμές χονδρικής όπου υπάρχουν." : "Λιανική."); } return; }
  const ckb = t.closest("[data-ck]"); if (ckb) { const b = $("#shB"); b.dataset.xck = ckb.dataset.ck; b.dataset.xsub = ""; $$("[data-ck]").forEach(x => x.classList.toggle("on", x === ckb)); $("#cxSubs").innerHTML = subsHTML(ckOf(ckb.dataset.ck), ""); return; }
  const csb = t.closest("[data-csub]"); if (csb) { const b = $("#shB"); b.dataset.xsub = b.dataset.xsub === csb.dataset.csub ? "" : csb.dataset.csub; $$("[data-csub]").forEach(x => x.classList.toggle("on", x.dataset.csub === b.dataset.xsub)); return; }
  const cs = t.closest("[data-cash]"); if (cs) { collectList(); return; }
  const cn = t.closest("[data-cashnew]"); if (cn) { cashSheet(cn.dataset.cashnew); return; }
  { const x = t.closest("[data-rtap]"); if (x) { const b = $("#shB"), key = b.dataset.rtapk, ck = b.dataset.rtapc, a = x.dataset.rtap;
      if (a === "pick") { if (ck) pickOnMap(ck); return; }
      if (a === "gm") { if (ck) { closeSheet(); setTimeout(() => gmSheet(ck), 60); } return; }
      if (a === "skip") { RT.sel && RT.sel.delete(key); closeSheet(); render(); if (RT.sel && RT.sel.size) setTimeout(() => rtGo(), 80); else toast("Δεν έμεινε άλλη στάση.", 2500); return; }
      if (a === "go") { (RT.okApprox || (RT.okApprox = new Set())).add(key); closeSheet(); setTimeout(() => rtGo(), 80); return; } } }
  { const x = t.closest("[data-ambpick]"); if (x) { geoAmbPick(+x.dataset.ambpick); return; } }
  { const x = t.closest("[data-ambfor]"); if (x) { e.preventDefault(); ambFor(x.dataset.ambfor); return; } }
  { const x = t.closest("[data-ambmap]"); if (x) { e.preventDefault(); A._ambAfter = null; pickOnMap(x.dataset.ambmap); return; } }
  { const x = t.closest("[data-ambcust]"); if (x) { e.preventDefault(); closeSheet(); setTimeout(() => openCust(x.dataset.ambcust), 60); return; } }
  const co = t.closest("[data-coll]"); if (co) { collectCust(co.dataset.coll); return; }
  const cm2 = t.closest("[data-colmode]"); if (cm2) { collectCust($("#shB").dataset.cust, cm2.dataset.colmode); return; }
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
document.addEventListener("change", e => { if (e.target.id === "cmArea") { cm.area = e.target.value; cmDrawCust(true); } });
document.addEventListener("input", e => { if (e.target.id === "rtFromT") { rtPref().fromText = e.target.value.trim(); return; } if (e.target.id === "rtEndT") { rtPref().endText = e.target.value.trim(); return; } if (e.target.id === "custQ") { custQ = e.target.value; const p = e.target.selectionStart; render(); const i = $("#custQ"); i.focus(); i.setSelectionRange(p, p); } });
document.addEventListener("change", e => {
  if (e.target.matches("[data-colo]")) collectSum();
  if (e.target.matches("[data-hol]")) { const r = e.target.closest(".holr"); if (r) r.classList.toggle("off", !e.target.checked); const c = $("#holCnt"); if (c) c.textContent = $$("[data-hol]:checked").length + " από " + $$("[data-hol]").length + " ›"; }
  if (e.target.id === "totPer") { totPer = e.target.value; render(); return; }
  if (e.target.id === "lkPh") { if (e.target.checked && !proGate("photos")) { e.target.checked = false; return; } S.link.photos = e.target.checked; save(); linkSheet(); }
  if (e.target.id === "lkLg") { S.link.logo = e.target.checked; save(); linkSheet(); }
  if (e.target.matches("[data-fq]")) { readForm(); const t = $("#ftot"); if (t) { const fcu = S.customers[custKey(F.phone)]; let s = 0; for (const [id, q] of Object.entries(F.q)) { const p = S.products[id]; if (p) s += K.round2(q * (F.keep[id] != null ? F.keep[id] : K.priceFor(p, fcu, q))); } for (const y of F.ol || []) if (S.products[y.pid] && y.q > 0) s += K.round2(y.q * olPrice(y, fcu)); t.textContent = K.money(K.round2(s)); } }
});
/* αν η εφαρμογή κλείσει ή πάει στο παρασκήνιο αμέσως μετά από μια αλλαγή, γράφεται αμέσως (όχι μετά από ¼ δευτερολέπτου) */
const flushSave = () => { if (saveT) { clearTimeout(saveT); saveT = null; try { write(); } catch {} } };
window.addEventListener("pagehide", flushSave);
document.addEventListener("visibilitychange", () => { if (document.hidden) flushSave(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) { pollOnce(); liveStart(); if (S && Date.now() - updLast > 30 * 6e4) checkUpdate(false); } else liveStop(); });
/* όταν γυρνάς από τα Ταμεία, το Ταμείο εδώ δείχνει αμέσως τα νέα ποσά */
/* όταν αλλάξει κάτι στο Ταμείο, ο συγχρονισμός (αν είναι ανοιχτός) το παίρνει */
window.addEventListener("storage", e => { if (e.key === EM_KEY && S && S.ui.tmSync) tmSoon(); });
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
  if (cmIsOpen()) { cmClose(true); return; }
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
  if (++secretN >= 5) { secretN = 0; S.ui.test = !S.ui.test; save(); render(); toast(S.ui.test ? "🧪 Λειτουργία δοκιμών ενεργή: κουμπί «Δοκιμή ως πελάτης» πάνω δεξιά" : "Η λειτουργία δοκιμών έκλεισε"); }
}
/* ---------- προεπισκόπηση μέσα στην εφαρμογή ---------- */
const previewOpen = () => !!$("#pvWrap");
function openPreview(url, head) {
  if (previewOpen()) closePreview(false);
  histPush({ pv: 1 });
  document.body.insertAdjacentHTML("beforeend", `<div id="pvWrap" style="position:fixed;inset:0;z-index:80;background:#F3F4F1;display:flex;flex-direction:column">
   <div style="background:#1d2b36;color:#fff;padding:calc(8px + env(safe-area-inset-top)) 10px 8px;display:flex;align-items:center;gap:8px"><button type="button" data-act="pvClose" aria-label="Πίσω" style="border:0;background:rgba(255,255,255,.15);color:#fff;border-radius:10px;padding:8px 12px;font-weight:800;flex:none">←</button><div style="flex:1;min-width:0;line-height:1.2">${head ? head : S.ui.test ? `<b style="display:block;font-size:15.5px">🧪 Δοκιμή: είσαι στη θέση του πελάτη</b><small style="display:block;font-size:12.5px;opacity:.85">Βλέπεις ό,τι βλέπει ο πελάτης σου. Ό,τι παραγγείλεις έρχεται σε σένα ως δοκιμαστική.</small>` : `<b style="display:block;font-size:15.5px">👁 Έτσι το βλέπει ο πελάτης σου</b><small style="display:block;font-size:12.5px;opacity:.85">Μόνο προβολή</small>`}</div>${S.ui.test ? `<button type="button" data-act="role" style="border:0;background:#F2B632;color:#17324D;border-radius:10px;padding:6px 10px;font-weight:800;flex:none;line-height:1.15;font-size:13px">🏪 Πίσω στον<br>πωλητή</button>` : ""}</div>
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
  startPoll(); gdInit(); efmInit(); render(); setTimeout(() => { try { liveKeep(); } catch {} }, 3000); setTimeout(() => { try { packAsk(); } catch {} }, 1500); setTimeout(() => { try { geoPrefetch(); } catch {} }, 1500);
  setTimeout(() => checkUpdate(false), 3000);
}
A.boot = boot;
window.addEventListener("load", () => boot());
})();
