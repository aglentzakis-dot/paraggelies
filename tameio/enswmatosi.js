/*
  Ταμείο των Παραγγελιών — αυτούσιος ο κώδικας των Ταμείων (βιβλίο «Εταιρεία Α.Ε.»), με δικά του δεδομένα.
  © 2026 Ανδρέας Μ. Γλεντζάκης (Andreas M. Glentzakis). Με την επιφύλαξη παντός δικαιώματος. All rights reserved.
  Εδώ είναι μόνο η σύνδεση με τις Παραγγελίες: Pro, ένα βιβλίο, και οι πληρωμές των παραγγελιών που μπαίνουν μόνες τους.
*/
var EMQ = "paraggelies-tameio-inbox";
function emParent() { try { return window.parent && window.parent !== window && window.parent.App ? window.parent.App : null; } catch (e) { return null; } }
function emPro() { var A = emParent(); try { return A ? !!A.isPro() : false; } catch (e) { return false; } }
function emProGate() { var A = emParent(); try { if (A && A.proGate) A.proGate("report"); } catch (e) {} }
/* το βιβλίο «Εταιρεία Α.Ε.» (τα Ταμεία το φτιάχνουν μόνα τους την πρώτη φορά) */
function emBook() {
  var L = xbList();
  for (var i = 0; i < L.length; i++) { if ((xbData(L[i]).tpl || "") === "ae") return L[i]; }
  return L[L.length - 1] || "extra";
}
function emShop() { var A = emParent(); try { return A && A.S ? A.S().shop || {} : {}; } catch (e) { return {}; } }
function emStart() {
  var b = emBook(), d = xbData(b);
  S.settings.bookHidden = S.settings.bookHidden || {}; S.settings.bookHidden[b] = false;
  S.settings.defaultBook = b;
  if (!S.meta.emInit) {
    S.meta.emInit = Date.now();
    d.dn = "Ταμείο"; d.icon = "💶";
    var sh = emShop(), bz = S.settings.biz || (S.settings.biz = {});
    if (!bz.name) { bz.name = sh.legal || sh.name || ""; bz.afm = bz.afm || sh.afm || ""; bz.address = bz.address || sh.addr || ""; bz.phone = bz.phone || sh.phone || ""; bz.email = bz.email || sh.email || ""; }
  }
  try { setBook(b); } catch (e) {}
  emInbox();
  try { document.getElementById("appTitle").textContent = "Ταμείο"; } catch (e) {}
  emSettings();
  if (!window.__emW) { window.__emW = 1; var w0 = write; write = function () { var r = w0.apply(this, arguments); try { var A = emParent(); if (A && A.tameioChanged) A.tameioChanged(); } catch (e) {} return r; }; }
}
function emEnsureKind(k, b) {
  try {
    if (!k || typeof k.id !== "string" || !/^[a-z0-9]{2,12}$/.test(k.id)) return;
    var x = bookObj(b); if (!Array.isArray(x.kinds) || !x.kinds.length) return;
    if (x.kinds.some(function (n) { return n.id === k.id; })) return;
    var o = { id: k.id, emoji: String(k.emoji || "📦").slice(0, 4), name: String(k.name || "Άλλο").slice(0, 60), dir: k.dir === "in" ? "in" : "out", subs: (Array.isArray(k.subs) ? k.subs : []).slice(0, 30) };
    var i = x.kinds.length; if (o.dir === "in") { i = 0; x.kinds.forEach(function (n, j) { if (n.dir === "in") i = j + 1; }); }
    x.kinds.splice(i, 0, o);
  } catch (e) {}
}
/* οι κινήσεις από τις Παραγγελίες (πληρωμές παραγγελιών): μπαίνουν, αλλάζουν ή σβήνουν με το ίδιο αναγνωριστικό */
function emInbox() {
  var q; try { q = JSON.parse(localStorage.getItem(EMQ) || "null"); } catch (e) { q = null; }
  if (!Array.isArray(q) || !q.length) return 0;
  var b = emBook(), B = xbData(b), n = 0, done = new Set();
  q.forEach(function (op) {
    if (!op || typeof op !== "object") return; done.add(JSON.stringify(op));
    if (typeof op.id !== "string" || !/^pg-[\w-]{1,40}$/.test(op.id)) return;
    var i = B.ent.findIndex(function (x) { return x && x.id === op.id; });
    if (op.op === "del") { if (i >= 0) { B.ent.splice(i, 1); n++; } return; }
    var e = op.e || {}, a = Math.round(+e.amount * 100) / 100;
    if (!(a > 0) || (e.dir !== "in" && e.dir !== "out")) return;
    if (op.k) emEnsureKind(op.k, b);
    var d = new Date(e.date || Date.now());
    var r = { dir: e.dir, kind: /^[a-z0-9]{2,12}$/.test(e.kind || "") ? e.kind : (e.dir === "in" ? "ae73" : "aeoth"), sub: String(e.sub || "").slice(0, 60), amount: a, date: (isNaN(d) ? new Date() : d).toISOString(), note: String(e.note || "").slice(0, 200), src: "paraggelies" };
    ["pay", "doc", "docno", "cp", "afm", "vatBase"].forEach(function (f) { if (e[f]) r[f] = String(e[f]).slice(0, 80); });
    if (e.vat !== "" && e.vat != null && !isNaN(+e.vat)) r.vat = +e.vat;
    if (Array.isArray(e.vats) && e.vats.length) r.vats = e.vats.slice(0, 6).map(function (v) { return { r: +v.r, net: +v.net || 0, vat: +v.vat || 0 }; });
    if (i >= 0) Object.assign(B.ent[i], r); else B.ent.push(Object.assign({ id: op.id, createdAt: Date.now() }, r));
    n++;
  });
  try { var now = JSON.parse(localStorage.getItem(EMQ) || "[]"), left = Array.isArray(now) ? now.filter(function (o) { return !done.has(JSON.stringify(o)); }) : []; if (left.length) localStorage.setItem(EMQ, JSON.stringify(left)); else localStorage.removeItem(EMQ); } catch (e) {}
  return n;
}
window.addEventListener("storage", function (e) { if (e.key === EMQ && e.newValue && typeof S !== "undefined" && S && emInbox()) { write(); render(); } });
document.addEventListener("visibilitychange", function () { if (!document.hidden && typeof S !== "undefined" && S && emInbox()) { write(); render(); } });
/* οι Ρυθμίσεις: μόνο ό,τι αφορά αυτό το ταμείο (όχι γλώσσα, κλειδιά, αντίγραφα, εγκατάσταση — τα αναλαμβάνουν οι Παραγγελίες) */
function emSettings() {
  if (window.__emSet) return; window.__emSet = 1;
  var ss = settingsSheet;
  settingsSheet = function () {
    ss.apply(this, arguments);
    try {
      var body = document.getElementById("shBody"); if (!body) return;
      body.querySelectorAll('[data-act="lang"],[data-act="licSheet"],[data-act="backup"],[data-act="install"],[data-act="about"],[data-act="checkUpdate"]').forEach(function (x) { x.remove(); });
      var g = body.querySelector('[data-act="settingsGroup"][data-g="w_money"]'); if (g) g.dataset.g = "w_mx:" + emBook();
      var v = document.getElementById("s_ver"); if (v) v.innerHTML = "Ταμείο των Παραγγελιών · ίδιο με το βιβλίο «Α.Ε.» των Ταμείων<br>© 2026 Ανδρέας Μ. Γλεντζάκης";
    } catch (e) {}
  };
}
/* οι Παραγγελίες «σπρώχνουν» αμέσως κάθε νέα πληρωμή όταν το Ταμείο είναι ανοιχτό */
window.emPoke = function () { try { if (typeof S !== "undefined" && S && emInbox()) { write(); render(); } } catch (e) {} };
