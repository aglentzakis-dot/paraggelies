/*
  Παραγγελίες — γλώσσα της εφαρμογής του πωλητή (Ελληνικά / Αγγλικά).
  © 2026 Ανδρέας Μ. Γλεντζάκης (Andreas M. Glentzakis). Με την επιφύλαξη παντός δικαιώματος. All rights reserved.
  Η εφαρμογή γράφεται στα ελληνικά· όταν διαλέγεις Αγγλικά, τα κείμενα της οθόνης μεταφράζονται από το λεξικό
  (glossa-en.js) τη στιγμή που εμφανίζονται. Τα δεδομένα (ονόματα πελατών, προϊόντα, διευθύνσεις) δεν αλλάζουν.
*/
(function () {
  "use strict";
  const KEY = "paraggelies-lang";
  let lang = "el";
  try { lang = localStorage.getItem(KEY) || "el"; } catch (e) {}
  if (lang !== "en") lang = "el";
  const G = window.Glossa = { lang, set(l) { try { localStorage.setItem(KEY, l); localStorage.setItem("paraggelies-tameio-lang", l); } catch (e) {} location.reload(); }, t: s => s };
  document.documentElement.lang = lang;
  if (lang === "el") return;
  const D = window.GL_EN || {};
  const GRK = /[Ͱ-Ͽἀ-῿]/;
  const norm = s => s.replace(/\s+/g, " ").trim();
  /* για κείμενα με αριθμούς, ονόματα κ.λπ.: αντικατάσταση των γνωστών κομματιών μέσα στο κείμενο */
  /* σύντομα: μήνες και ημέρες */
  const AB = { "Ιαν": "Jan", "Φεβ": "Feb", "Μαρ": "Mar", "Απρ": "Apr", "Μαΐ": "May", "Μάι": "May", "Ιουν": "Jun", "Ιούν": "Jun", "Ιουλ": "Jul", "Ιούλ": "Jul", "Αυγ": "Aug", "Αύγ": "Aug", "Σεπ": "Sep", "Οκτ": "Oct", "Νοε": "Nov", "Νοέ": "Nov", "Δεκ": "Dec", "Δευ": "Mon", "Τρί": "Tue", "Τρι": "Tue", "Τετ": "Wed", "Πέμ": "Thu", "Πεμ": "Thu", "Παρ": "Fri", "Σάβ": "Sat", "Σαβ": "Sat", "Κυρ": "Sun" };
  for (const k in AB) if (D[k] == null) D[k] = AB[k];
  /* μονάδες: μόνο όταν είναι μόνες τους (μπορεί να είναι και μέσα σε όνομα προϊόντος) */
  const UNITS = new Set(["δωδεκάδα", "δεκάδα", "εξάδα", "κιλό", "λίτρο", "βάζο", "θήκη 30", "κιβώτιο", "ματσάκι", "μερίδα", "μπουκάλι", "μπλοκ", "παλέτα", "σακί", "σετ", "συσκευασία", "ταψί", "τελάρο", "φραντζόλα", "τεμ.", "γρ.", "δοχείο", "άτομο", "κομμάτια"]);
  const parts = Object.keys(D).filter(k => k.length >= 3 && !UNITS.has(k)).sort((a, b) => b.length - a.length);
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  /* όρια λέξης μόνο όπου το κομμάτι αρχίζει ή τελειώνει σε γράμμα */
  const L = "[\\u0370-\\u03ff\\u1f00-\\u1fff]";
  const pat = k => (GRK.test(k[0]) ? "(?<!" + L + ")" : "") + esc(k) + (GRK.test(k[k.length - 1]) ? "(?!" + L + ")" : "");
  const RX = parts.length ? new RegExp(parts.map(pat).join("|"), "g") : null;
  function tr(s) {
    if (!s || !GRK.test(s)) return s;
    const n = norm(s);
    if (D[n] != null) { const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0]; return lead + D[n] + trail; }
    if (!RX) return s;
    return s.replace(/\s+/g, " ").replace(RX, m => D[m] != null ? D[m] : m);
  }
  G.t = tr;
  const SKIP = "script,style,textarea,input,select option[data-notr],[data-notr],iframe,code";
  const ATTRS = ["placeholder", "aria-label", "title"];
  const done = new WeakMap();
  function doText(n) {
    const p = n.parentElement; if (!p || p.closest(SKIP)) return;
    const v = n.nodeValue; if (done.get(n) === v) return;
    const t = tr(v); if (t !== v) n.nodeValue = t; done.set(n, n.nodeValue);
  }
  function doEl(el) {
    if (el.closest && el.closest("[data-notr],iframe")) return;
    for (const a of ATTRS) { const v = el.getAttribute && el.getAttribute(a); if (v && GRK.test(v)) { const t = tr(v); if (t !== v) el.setAttribute(a, t); } }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1) return;
    doEl(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let x; while ((x = w.nextNode())) { if (x.nodeType === 3) doText(x); else doEl(x); }
  }
  let busy = false;
  const mo = new MutationObserver(list => {
    if (busy) return; busy = true;
    try {
      for (const m of list) {
        if (m.type === "characterData") doText(m.target);
        else if (m.type === "attributes") doEl(m.target);
        else m.addedNodes.forEach(walk);
      }
    } finally { busy = false; }
  });
  function start() {
    walk(document.body); document.title = tr(document.title);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
  /* και τα παράθυρα επιβεβαίωσης */
  const c0 = window.confirm.bind(window), a0 = window.alert.bind(window), p0 = window.prompt.bind(window);
  window.confirm = m => c0(trLines(m)); window.alert = m => a0(trLines(m)); window.prompt = (m, d) => p0(trLines(m), d);
  function trLines(m) { return String(m == null ? "" : m).split("\n").map(tr).join("\n"); }
})();
