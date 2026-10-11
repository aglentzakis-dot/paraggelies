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
  if (!window.__emR) { window.__emR = 1; var r0 = render; render = function () { var x = r0.apply(this, arguments); emDebtCard(); return x; }; setTimeout(emDebtCard, 0); }
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
    if (typeof op.id !== "string" || !/^pg-[\w.-]{1,60}$/.test(op.id)) return;
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
    /* κλειδωμένο Ταμείο: και οι ρυθμίσεις του θέλουν τον κωδικό */
    if (emLockOn() && !pUnlocked) { toast(emL("Ξεκλείδωσε πρώτα το Ταμείο με τον κωδικό.", "Unlock the Cash with the code first.")); return; }
    ss.apply(this, arguments);
    try {
      var body = document.getElementById("shBody"); if (!body) return;
      body.querySelectorAll('[data-act="lang"],[data-act="licSheet"],[data-act="backup"],[data-act="install"],[data-act="about"],[data-act="checkUpdate"]').forEach(function (x) { x.remove(); });
      var g = body.querySelector('[data-act="settingsGroup"][data-g="w_money"]'); if (g) g.dataset.g = "w_mx:" + emBook();
      var sl = body.querySelector(".setlist .row, .setlist [data-act]");
      if (sl && !body.querySelector('[data-act="emLock"]')) {
        sl.insertAdjacentHTML("beforebegin", setRow("emLock", "🔒", emL("Κλείδωμα με κωδικό", "Lock with a code"), emLockOn() ? emL("ενεργό · ζητά κωδικό για να ανοίξει", "on · asks for a code to open") : emL("ανενεργό · για να μη βλέπει υπάλληλος τα οικονομικά", "off · so an employee cannot see the finances")));
        var lr = body.querySelector('[data-act="emLock"]'); if (lr) lr.addEventListener("click", function (ev) { ev.stopPropagation(); emLockSheet(); });
      }
      var v = document.getElementById("s_ver"); if (v) v.innerHTML = "Ταμείο των Παραγγελιών · ίδιο με το βιβλίο «Α.Ε.» των Ταμείων<br>© 2026 Ανδρέας Μ. Γλεντζάκης";
    } catch (e) {}
  };
}
/* οι Παραγγελίες «σπρώχνουν» αμέσως κάθε νέα πληρωμή όταν το Ταμείο είναι ανοιχτό */
window.emPoke = function () { try { if (typeof S !== "undefined" && S && emInbox()) { write(); render(); } } catch (e) {} };
var emEN = function () { return typeof LANG !== "undefined" && LANG === "en"; };
var emL = function (el, en) { return emEN() ? en : el; };
var emMoney = function (v) { return (Math.round(v * 100) / 100).toLocaleString(emEN() ? "en-GB" : "el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"; };
/* «Χρωστάνε»: μικρό κουτάκι δίπλα σε Έσοδα · Έξοδα · Υπόλοιπο· πατάς και βλέπεις ποιοι χρωστάνε (ολική ή μερική εξόφληση) */
function emDebtCard() {
  try {
    var A = emParent(); if (!A || !A.owedInfo) return;
    var old = document.getElementById("emDebt"); if (old) old.remove();
    emLockExtras();
    var row = document.querySelector("#main .sum3.psum"); if (!row) return;   /* κλειδωμένο ή άλλη οθόνη: τίποτα */
    var i = A.owedInfo(), owe = i.sum > 0;
    row.classList.add("has4");
    row.insertAdjacentHTML("beforeend", '<button type="button" id="emDebt" class="sumcard emdebt' + (owe ? " owe" : "") + '" aria-label="' + emL("Ποιοι χρωστάνε", "Who owes you") + '"><span><i class="pdot" style="background:' + (owe ? "#C8412B" : "#9AA7B2") + '"></i>' + emL("Χρωστάνε", "Owed") + '</span><b>' + emMoney(i.sum) + '</b>' + (owe ? '<small>' + (i.n === 1 ? emL("1 πελάτης ›", "1 customer ›") : i.n + emL(" πελάτες ›", " customers ›")) + '</small>' : '') + '</button>');
    document.getElementById("emDebt").onclick = function () { if (A.owedInfo().sum > 0) A.owedOpen(); else if (typeof toast === "function") toast(emL("Κανείς δεν σου χρωστά.", "Nobody owes you.")); };
  } catch (e) {}
}
window.emDebtCard = emDebtCard;
/* ---------- κλείδωμα του Ταμείου με κωδικό (όπως στα Ταμεία), για να μη βλέπει τα οικονομικά όποιος άλλος πιάνει το κινητό ---------- */
function emLockOn() { return !!(S.settings.pLock && S.settings.pLock.on && S.settings.pLock.pin); }
function emAskPin(msg) { var v = prompt(msg); if (v == null) return null; return String(v).trim(); }
function emNewPin() {
  var a = emAskPin(emL("Γράψε νέο κωδικό για το Ταμείο (4 έως 8 ψηφία):", "Type a new code for the Cash (4 to 8 digits):")); if (a == null) return null;
  if (!/^\d{4,8}$/.test(a)) { toast(emL("Ο κωδικός θέλει 4 έως 8 ψηφία.", "The code needs 4 to 8 digits.")); return null; }
  var b = emAskPin(emL("Γράψε τον ξανά, για επιβεβαίωση:", "Type it again to confirm:")); if (b == null) return null;
  if (a !== b) { toast(emL("Οι δύο κωδικοί δεν είναι ίδιοι.", "The two codes are not the same.")); return null; }
  return a;
}
function emCloseSheet() { try { if (typeof closeSheet === "function") closeSheet(); else { var c = document.querySelector("#sheet .sheetclose, [data-sheet-close]"); if (c) c.click(); } } catch (e) {} }
function emLockSheet() {
  var on = emLockOn();
  openSheet({ title: "🔒 " + emL("Κλείδωμα Ταμείου", "Cash lock"), cancelLabel: emL("Κλείσιμο", "Close"), body:
    '<p class="note" style="margin-top:0">' + emL("Ζητάει κωδικό κάθε φορά που ανοίγεις το Ταμείο (και όταν γυρνάς σε αυτό από άλλη καρτέλα). Χρήσιμο όταν την εφαρμογή τη χρησιμοποιεί και υπάλληλος: βλέπει τις παραγγελίες, όχι τα οικονομικά.", "Asks for a code every time you open the Cash (and when you come back from another tab). Useful when an employee also uses the app: they see the orders, not the finances.") + '</p>' +
    (on ? '<p class="note" style="color:var(--green);font-weight:800">✓ ' + emL("Το κλείδωμα είναι ενεργό.", "The lock is on.") + '</p><button type="button" class="btn ghost" id="eml_ch" style="width:100%">' + emL("Αλλαγή κωδικού", "Change code") + '</button><button type="button" class="btn danger" id="eml_off" style="width:100%;margin-top:8px">' + emL("Βγάλε το κλείδωμα", "Remove the lock") + '</button>'
        : '<button type="button" class="btn amber" id="eml_on" style="width:100%;margin-top:8px">🔒 ' + emL("Βάλε κωδικό", "Set a code") + '</button>') +
    '<p class="note" style="margin-top:12px">' + emL("Είναι οθόνη ιδιωτικότητας: κρατά μακριά τα μάτια, δεν κρυπτογραφεί τα δεδομένα. Αν κάποιος πατήσει «Ξέχασα τον κωδικό», το κλείδωμα βγαίνει αλλά μένει σημείωση με την ώρα, για να το δεις.", "It is a privacy screen: it keeps eyes away, it does not encrypt the data. If someone taps «Forgot the code», the lock is removed but a note with the time stays, so you will see it.") + '</p>' });
  var g = function (id) { return document.getElementById(id); };
  if (g("eml_on")) g("eml_on").onclick = function () { var p = emNewPin(); if (!p) return; S.settings.pLock = { on: true, pin: p }; delete S.settings.lockReset; pUnlocked = true; write(); emCloseSheet(); toast(emL("🔒 Το Ταμείο κλειδώνει με κωδικό.", "🔒 The Cash now locks with a code.")); render(); };
  if (g("eml_ch")) g("eml_ch").onclick = function () { var c = emAskPin(emL("Γράψε τον τρέχοντα κωδικό:", "Type the current code:")); if (c == null) return; if (c !== String(S.settings.pLock.pin)) { toast(emL("Λάθος κωδικός.", "Wrong code.")); return; } var p = emNewPin(); if (!p) return; S.settings.pLock.pin = p; write(); toast(emL("✓ Ο κωδικός άλλαξε.", "✓ The code changed.")); };
  if (g("eml_off")) g("eml_off").onclick = function () { var c = emAskPin(emL("Γράψε τον κωδικό για να βγει το κλείδωμα:", "Type the code to remove the lock:")); if (c == null) return; if (c !== String(S.settings.pLock.pin)) { toast(emL("Λάθος κωδικός.", "Wrong code.")); return; } S.settings.pLock = { on: false }; write(); emCloseSheet(); toast(emL("Το κλείδωμα βγήκε.", "The lock was removed.")); render(); };
}
/* πάνω στην οθόνη κλειδώματος: «Ξέχασα τον κωδικό» · και ειδοποίηση αν κάποιος έβγαλε το κλείδωμα έτσι */
function emLockExtras() {
  try {
    var pin = document.getElementById("lock_pin");
    if (pin) {
      var box = pin.parentElement, notes = box.querySelectorAll("p.note"), last = notes[notes.length - 1];
      var h2 = box.querySelector("h2"); if (h2) h2.textContent = emL("Το Ταμείο είναι κλειδωμένο", "The Cash is locked");
      if (last && !document.getElementById("eml_forgot")) last.outerHTML = '<button type="button" class="btn ghost" id="eml_forgot" style="max-width:280px;margin-top:18px">' + emL("Ξέχασα τον κωδικό", "Forgot the code") + '</button>';
      var f = document.getElementById("eml_forgot");
      if (f) f.onclick = function () {
        if (!confirm(emL("Θα βγει το κλείδωμα του Ταμείου.\n\nΘα μείνει σημείωση με την ημέρα και την ώρα, ώστε να το δει ο ιδιοκτήτης. Συνέχεια;", "The Cash lock will be removed.\n\nA note with the date and time will stay, so the owner sees it. Continue?"))) return;
        S.settings.pLock = { on: false }; S.settings.lockReset = Date.now(); pUnlocked = true; write(); render();
      };
      return;
    }
    var old = document.getElementById("emLockNote"); if (old) old.remove();
    var at = S.settings.lockReset; if (!at) return;
    var m = document.getElementById("main"); if (!m) return;
    var d = new Date(at).toLocaleString(emEN() ? "en-GB" : "el-GR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
    m.insertAdjacentHTML("afterbegin", '<div id="emLockNote" class="emlocknote"><b>⚠️ ' + emL("Το κλείδωμα του Ταμείου βγήκε με «Ξέχασα τον κωδικό»", "The Cash lock was removed with «Forgot the code»") + '</b><small>' + d + emL(". Αν δεν ήσουν εσύ, βάλε νέο κωδικό.", ". If it was not you, set a new code.") + '</small><div class="emlnb"><button type="button" class="btn amber small" id="eml_new">🔒 ' + emL("Νέος κωδικός", "New code") + '</button><button type="button" class="btn ghost small" id="eml_ok">' + emL("Ήμουν εγώ", "It was me") + '</button></div></div>');
    document.getElementById("eml_new").onclick = function () { var p = emNewPin(); if (!p) return; S.settings.pLock = { on: true, pin: p }; delete S.settings.lockReset; pUnlocked = true; write(); render(); toast(emL("🔒 Το Ταμείο κλειδώνει με κωδικό.", "🔒 The Cash now locks with a code.")); };
    document.getElementById("eml_ok").onclick = function () { delete S.settings.lockReset; write(); render(); };
  } catch (e) {}
}
/* οι Παραγγελίες το ξανακλειδώνουν όταν φεύγεις από την καρτέλα «Ταμείο» */
window.emRelock = function () { try { if (typeof S !== "undefined" && S && emLockOn() && pUnlocked) { pUnlocked = false; render(); } } catch (e) {} };
