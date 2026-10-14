/*
  Παραγγελίες — κοινός πυρήνας (πωλητής και πελάτης)
  © 2026 Ανδρέας Μ. Γλεντζάκης (Andreas M. Glentzakis). Με την επιφύλαξη παντός δικαιώματος. All rights reserved.
  Απαγορεύεται η αντιγραφή, τροποποίηση και διάθεση, εν όλω ή εν μέρει, χωρίς προηγούμενη γραπτή άδεια του κατόχου.
  Copying, modification and distribution, in whole or in part, without the owner's prior written permission are prohibited.
*/
(function () {
  "use strict";
  const K = {};
  K.NTFY = "https://ntfy.sh";
  K.MAX_LINES = 60;
  K.MAX_QTY = 999;

  /* ---------- βασικά ---------- */
  K.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  K.uid = (n = 9) => { const a = crypto.getRandomValues(new Uint8Array(n)); return K.b64u.enc(a); };
  K.b64u = {
    /* «.» αντί για «_»: το Viber θεωρεί το _κείμενο_ πλάγια γραφή, σβήνει τις κάτω παύλες και κόβει τον σύνδεσμο */
    enc(u8) { let s = ""; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, ".").replace(/=+$/, ""); },
    dec(t) { t = String(t).replace(/-/g, "+").replace(/[_.]/g, "/"); while (t.length % 4) t += "="; const s = atob(t), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  };
  async function streamBytes(u8, Ctor, fmt) {
    const cs = new Ctor(fmt), w = cs.writable.getWriter();
    w.write(u8); w.close();
    return new Uint8Array(await new Response(cs.readable).arrayBuffer());
  }
  /* αποσυμπίεση σε καθαρή JavaScript, για παλιούς περιηγητές
     (π.χ. ο ενσωματωμένος περιηγητής του Viber σε παλιά κινητά) */
  function jsInflate(src) {
    let pos = 0, bit = 0, cnt = 0;
    const out = [];
    const getBit = () => { if (!cnt) { if (pos >= src.length) throw new Error("τέλος"); bit = src[pos++]; cnt = 8; } const b = bit & 1; bit >>>= 1; cnt--; return b; };
    const bits = n => { let v = 0; for (let i = 0; i < n; i++) v |= getBit() << i; return v; };
    const build = lens => {
      const counts = new Uint16Array(16), offs = new Uint16Array(16), syms = new Uint16Array(lens.length);
      for (const l of lens) counts[l]++;
      counts[0] = 0;
      for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + counts[i - 1];
      for (let i = 0; i < lens.length; i++) if (lens[i]) syms[offs[lens[i]]++] = i;
      return { counts, syms };
    };
    const decode = t => {
      let code = 0, first = 0, index = 0;
      for (let len = 1; len < 16; len++) {
        code |= getBit(); const c = t.counts[len];
        if (code - c < first) return t.syms[index + (code - first)];
        index += c; first += c; first <<= 1; code <<= 1;
      }
      throw new Error("κώδικας");
    };
    const LB = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258], LE = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
    const DB = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577], DE = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
    let fixedL = null, fixedD = null;
    let last = 0;
    while (!last) {
      last = getBit();
      const type = bits(2);
      if (type === 0) {
        cnt = 0; if (pos + 4 > src.length) throw new Error("τέλος");
        const len = src[pos] | src[pos + 1] << 8; pos += 4;
        for (let i = 0; i < len; i++) { if (pos >= src.length) throw new Error("τέλος"); out.push(src[pos++]); }
        continue;
      }
      let lt, dt;
      if (type === 1) {
        if (!fixedL) { const l = new Array(288); for (let i = 0; i < 288; i++) l[i] = i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8; fixedL = build(l); fixedD = build(new Array(30).fill(5)); }
        lt = fixedL; dt = fixedD;
      } else if (type === 2) {
        const hl = bits(5) + 257, hd = bits(5) + 1, hc = bits(4) + 4;
        const ORD = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15], cl = new Array(19).fill(0);
        for (let i = 0; i < hc; i++) cl[ORD[i]] = bits(3);
        const ct = build(cl), lens = [];
        while (lens.length < hl + hd) {
          const sym = decode(ct);
          if (sym < 16) lens.push(sym);
          else if (sym === 16) { const p = lens[lens.length - 1], r = 3 + bits(2); for (let i = 0; i < r; i++) lens.push(p); }
          else if (sym === 17) { const r = 3 + bits(3); for (let i = 0; i < r; i++) lens.push(0); }
          else { const r = 11 + bits(7); for (let i = 0; i < r; i++) lens.push(0); }
        }
        lt = build(lens.slice(0, hl)); dt = build(lens.slice(hl));
      } else throw new Error("μπλοκ");
      for (;;) {
        const sym = decode(lt);
        if (sym === 256) break;
        if (sym < 256) { out.push(sym); continue; }
        const i = sym - 257, len = LB[i] + bits(LE[i]);
        const d = decode(dt), dist = DB[d] + bits(DE[d]);
        if (dist > out.length) throw new Error("απόσταση");
        const st = out.length - dist;
        for (let k = 0; k < len; k++) out.push(out[st + k]);
      }
    }
    return new Uint8Array(out);
  }
  K.jsInflate = jsInflate;
  K.canStream = typeof CompressionStream === "function" && typeof DecompressionStream === "function";
  K.deflate = u8 => streamBytes(u8, CompressionStream, "deflate-raw");
  K.inflate = async u8 => {
    if (typeof DecompressionStream === "function") { try { return await streamBytes(u8, DecompressionStream, "deflate-raw"); } catch {} }
    return jsInflate(u8);
  };
  /* καθάρισμα κειμένου που πέρασε από άλλες εφαρμογές (κενά, αλλαγές γραμμής, κωδικοποίηση) */
  K.cleanB64 = str => {
    str = String(str || "");
    if (/%[0-9A-Fa-f]{2}/.test(str)) { try { str = decodeURIComponent(str); } catch {} }
    return str.replace(/\s+/g, "").replace(/\+/g, "-").replace(/\//g, ".").replace(/=+/g, "").replace(/[^0-9A-Za-z_.-].*$/, "");
  };
  /* συμπίεση αντικειμένου σε κείμενο για σύνδεσμο */
  K.pack = async obj => "1" + K.b64u.enc(await K.deflate(new TextEncoder().encode(JSON.stringify(obj))));
  K.unpack = async str => {
    str = K.cleanB64(str);
    if (str[0] !== "1") throw new Error("μορφή");
    const raw = await K.inflate(K.b64u.dec(str.slice(1)));
    if (raw.length > 3e6) throw new Error("μέγεθος");
    return JSON.parse(new TextDecoder().decode(raw));
  };

  /* ---------- κρυπτογράφηση: μόνο ο πωλητής διαβάζει την παραγγελία ----------
     Ο σύνδεσμος έχει μόνο το δημόσιο κλειδί του πωλητή. Ο πελάτης φτιάχνει
     προσωρινό ζεύγος κλειδιών (ECDH P-256) και κρυπτογραφεί με AES-GCM.
     Όποιος έχει τον σύνδεσμο ΔΕΝ μπορεί να διαβάσει παραγγελίες άλλων. */
  const EC = { name: "ECDH", namedCurve: "P-256" };
  K.genKeys = async () => {
    const kp = await crypto.subtle.generateKey(EC, true, ["deriveKey"]);
    const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
    const priv = await crypto.subtle.exportKey("jwk", kp.privateKey);
    return { pub: K.b64u.enc(pub), priv };
  };
  const aesFrom = (privKey, pubKey) => crypto.subtle.deriveKey({ name: "ECDH", public: pubKey }, privKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  K.seal = async (sellerPubB64, obj) => {
    const sp = await crypto.subtle.importKey("raw", K.b64u.dec(sellerPubB64), EC, false, []);
    const eph = await crypto.subtle.generateKey(EC, true, ["deriveKey"]);
    const ephPub = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
    const key = await aesFrom(eph.privateKey, sp);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = new TextEncoder().encode(JSON.stringify(obj));
    const zip = K.canStream;
    const body = zip ? await K.deflate(plain) : plain;
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, body));
    const out = new Uint8Array(65 + 12 + ct.length);
    out.set(ephPub, 0); out.set(iv, 65); out.set(ct, 77);
    return (zip ? "1" : "2") + K.b64u.enc(out);
  };
  K.open = async (privJwk, str) => {
    str = String(str || "");
    str = K.cleanB64(str);
    if ((str[0] !== "1" && str[0] !== "2") || str.length > 12000) throw new Error("μορφή");
    const u = K.b64u.dec(str.slice(1));
    if (u.length < 65 + 12 + 17) throw new Error("μορφή");
    const priv = await crypto.subtle.importKey("jwk", privJwk, EC, false, ["deriveKey"]);
    const ep = await crypto.subtle.importKey("raw", u.slice(0, 65), EC, false, []);
    const key = await aesFrom(priv, ep);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: u.slice(65, 77) }, key, u.slice(77));
    const raw = str[0] === "1" ? await K.inflate(new Uint8Array(pt)) : new Uint8Array(pt);
    if (raw.length > 200000) throw new Error("μέγεθος");
    return JSON.parse(new TextDecoder().decode(raw));
  };

  /* ---------- μορφοποίηση ---------- */
  K.money = n => (Math.round((+n || 0) * 100) / 100).toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  K.num = n => { n = Math.round((+n || 0) * 1000) / 1000; return n.toLocaleString("el-GR", { maximumFractionDigits: 3 }); };
  K.round2 = n => Math.round((+n || 0) * 100 + 1e-9) / 100;
  K.UNITS = ["τεμ.", "κιλό", "γρ.", "λίτρο", "δωδεκάδα", "εξάδα", "δεκάδα", "θήκη 30", "βάζο", "μπουκάλι", "συσκευασία", "κιβώτιο", "τελάρο", "σακί", "παλέτα", "δοχείο", "φραντζόλα", "μερίδα", "ματσάκι", "ταψί", "άτομο", "σετ"];
  /* ελληνική γραφή: «.» χιλιάδες, «,» δεκαδικά — το «1.000» είναι χίλια, το «4.5» τέσσερα και μισό */
  K.parseNum = s => { let t = String(s == null ? "" : s).replace(/[\s€]/g, "");
    if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    const v = parseFloat(t); return isFinite(v) && /^-?(\d+\.?\d*|\.\d+)$/.test(t) ? v : NaN; };
  K.WD = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];
  K.MON = ["Ιαν", "Φεβ", "Μαρ", "Απρ", "Μαΐ", "Ιουν", "Ιουλ", "Αυγ", "Σεπ", "Οκτ", "Νοε", "Δεκ"];
  K.ymd = d => { const p = n => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); };
  K.fromYmd = s => { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  K.dayLabel = (s, today) => {
    const d = K.fromYmd(s); if (!d) return "";
    const t = today ? new Date(today) : new Date(); t.setHours(0, 0, 0, 0);
    const diff = Math.round((d - t) / 864e5);
    const base = K.WD[d.getDay()] + " " + d.getDate() + " " + K.MON[d.getMonth()];
    return diff === 0 ? "Σήμερα, " + base : diff === 1 ? "Αύριο, " + base : base;
  };
  /* διαθέσιμες ημέρες παράδοσης από τις ρυθμίσεις του πωλητή */
  K.availDays = (d, now) => {
    d = d || {};
    const days = Array.isArray(d.days) && d.days.length ? d.days : [1, 2, 3, 4, 5, 6];
    const closed = new Set(d.closed || []);
    const out = [], t = now ? new Date(now) : new Date();
    let from = +d.min || 0;
    if (d.cut && from === 0) { const [h, m] = String(d.cut).split(":").map(Number); if (t.getHours() * 60 + t.getMinutes() >= h * 60 + (m || 0)) from = 1; }
    const max = Math.min(+d.max || 14, 60);
    for (let i = from; i <= max; i++) {
      const x = new Date(t); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() + i);
      const y = K.ymd(x);
      if (days.includes(x.getDay()) && !closed.has(y)) out.push(y);
    }
    return out;
  };

  /* ---------- αργίες (όπως στο Ημερολόγιο) ---------- */
  const pad2 = n => String(n).padStart(2, "0");
  const addD = (y, n) => { const d = K.fromYmd(y); d.setHours(12); d.setDate(d.getDate() + n); return K.ymd(d); };
  K.orthEaster = y => { const a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7; const mo = Math.floor((d + e + 114) / 31), da = (d + e + 114) % 31 + 1; const j = new Date(y, mo - 1, da, 12); j.setDate(j.getDate() + 13); return K.ymd(j); };
  K.grHolidays = y => {
    const E = K.orthEaster(y), F = (m, d) => y + "-" + pad2(m) + "-" + pad2(d);
    return [["ny", F(1, 1), "Πρωτοχρονιά", 1], ["epi", F(1, 6), "Θεοφάνεια", 1], ["kd", addD(E, -48), "Καθαρά Δευτέρα", 1], ["25m", F(3, 25), "25η Μαρτίου", 1],
      ["mp", addD(E, -2), "Μεγάλη Παρασκευή", 1], ["ms", addD(E, -1), "Μεγάλο Σάββατο", 0], ["pa", E, "Κυριακή του Πάσχα", 1], ["dp", addD(E, 1), "Δευτέρα του Πάσχα", 1], ["pm", F(5, 1), "Πρωτομαγιά", 1],
      ["ap", addD(E, 50), "Αγίου Πνεύματος", 1], ["15a", F(8, 15), "Κοίμηση της Θεοτόκου", 1], ["28o", F(10, 28), "Επέτειος του «Όχι»", 1],
      ["xm", F(12, 24), "Παραμονή Χριστουγέννων", 0], ["xr", F(12, 25), "Χριστούγεννα", 1], ["sy", F(12, 26), "Σύναξη της Θεοτόκου", 1], ["pp", F(12, 31), "Παραμονή Πρωτοχρονιάς", 0]]
      .map(([id, date, name, def]) => ({ id, date, name, def: !!def }));
  };
  K.holOn = (d, h) => { const H = (d && d.hol) || {}; return H[h.id] !== undefined ? !!H[h.id] : h.def; };
  /* όλες οι κλειστές ημερομηνίες (αργίες + δικές του) από σήμερα για τις επόμενες ημέρες */
  K.closedDates = (d, days, now) => {
    d = d || {}; days = days || 70;
    const t = now ? new Date(now) : new Date(), from = K.ymd(t), to = (() => { const x = new Date(t); x.setDate(x.getDate() + days); return K.ymd(x); })();
    const out = new Set((d.closed || []).filter(x => x >= from && x <= to));
    if (!d.holOff) for (const y of [t.getFullYear(), t.getFullYear() + 1]) for (const h of K.grHolidays(y)) if (K.holOn(d, h) && h.date >= from && h.date <= to) out.add(h.date);
    return [...out].sort();
  };

  /* ---------- τιμές ---------- */
  /* τιμή που ίσχυε τη στιγμή ts (ιστορικό τιμών του πωλητή) */
  K.priceAt = (p, ts) => {
    const h = (p && p.hist) || [];
    let price = p ? +p.price || 0 : 0;
    if (h.length) {
      const sorted = h.slice().sort((a, b) => a[0] - b[0]);
      let found = null;
      for (const [t, v] of sorted) if (t <= ts) found = v;
      if (found != null) price = found; else price = sorted[0][1];
    }
    return price;
  };
  /* κλιμακωτή τιμή: [[από ποσότητα, τιμή], …] — ισχύει η χαμηλότερη για την ποσότητα */
  K.tierPrice = (tiers, q, base) => { let r = base; for (const t of tiers || []) if (Array.isArray(t) && q >= +t[0] && +t[1] > 0 && +t[1] < r) r = +t[1]; return r; };
  K.unitPrice = (p, q) => p ? K.tierPrice(p.tiers, q || 0, +p.price || 0) : 0;
  /* τιμή που ορίζει ο πωλητής για συγκεκριμένο πελάτη: προσωπική > χονδρική > λιανική, και μετά κλιμακωτή */
  K.priceFor = (p, cust, q, at) => {
    if (!p) return 0;
    if (cust && cust.prices && cust.prices[p.id] != null && isFinite(+cust.prices[p.id])) return +cust.prices[p.id];
    const base = cust && cust.pl === "w" && +p.whole > 0 ? +p.whole : (at ? K.priceAt(p, at) : +p.price || 0);
    return K.tierPrice(p.tiers, q || 0, base);
  };
  K.priceKind = (p, cust) => cust && cust.prices && cust.prices[p.id] != null ? "personal" : cust && cust.pl === "w" && +p.whole > 0 ? "whole" : "retail";
  /* εποχικά: μήνες 1–12 που κυκλοφορεί */
  K.inSeason = (p, d) => { const m = p && p.season; if (!Array.isArray(m) || !m.length || m.length >= 12) return true; return m.includes((d || new Date()).getMonth() + 1); };
  K.MONTHS = ["Ιαν", "Φεβ", "Μαρ", "Απρ", "Μάι", "Ιούν", "Ιούλ", "Αύγ", "Σεπ", "Οκτ", "Νοέ", "Δεκ"];
  /* απόθεμα: ό,τι δήλωσε ο πωλητής μείον όσα έχουν παραγγελθεί από τότε (εκτός ακυρωμένων) */
  K.reserved = (pid, orders, since) => { let r = 0; since = since || 0;
    for (const o of orders || []) { if (o.st === "cancel" || o.st === "dup") continue;
      const base = o.rx0 || o.rx || o.at || 0;
      if (base >= since) { for (const l of o.lines || []) if (l.pid === pid) r += +l.q || 0; }
      else for (const a of o.adds || []) if (a.at >= since) for (const [ap, aq] of a.l || []) if (ap === pid) r += +aq || 0; }
    return Math.round(r * 1000) / 1000; };
  K.avail = (p, orders) => p && p.stock != null && p.stock !== "" && isFinite(+p.stock) ? Math.round((+p.stock - K.reserved(p.id, orders, p.stockAt)) * 1000) / 1000 : Infinity;
  K.stepOk = (q, step) => { step = +step || 1; const r = q / step; return Math.abs(r - Math.round(r)) < 1e-6; };

  /* ---------- έλεγχος εισερχόμενης παραγγελίας ----------
     Ο πωλητής ΠΟΤΕ δεν δέχεται τιμές από τον πελάτη: οι τιμές γράφονται από
     τον δικό του κατάλογο, όπως ίσχυαν τη στιγμή της υποβολής. */
  K.checkOrder = (O, st, now) => {
    now = now || Date.now();
    const warn = [];
    if (!O || typeof O !== "object" || O.v !== 1) return { err: "Άγνωστη μορφή παραγγελίας." };
    if (typeof O.id !== "string" || !/^[A-Za-z0-9_.-]{8,40}$/.test(O.id)) return { err: "Λείπει ο κωδικός της παραγγελίας." };
    const c = O.c || {};
    const name = String(c.n || "").trim().slice(0, 80), phone = String(c.p || "").replace(/[^\d+]/g, "").slice(0, 20);
    if (!name) return { err: "Λείπει το όνομα του πελάτη." };
    if (phone.replace(/\D/g, "").length < 10) return { err: "Λείπει έγκυρο τηλέφωνο." };
    if (!O.cons) return { err: "Ο πελάτης δεν αποδέχτηκε την ενημέρωση απορρήτου." };
    if (!Array.isArray(O.l) || !O.l.length) return { err: "Η παραγγελία είναι άδεια." };
    if (O.l.length > K.MAX_LINES) return { err: "Πάρα πολλά είδη." };
    let at = +O.at || now;
    if (at > now + 10 * 6e4 || at < now - 7 * 864e5) { warn.push("Η ώρα υποβολής δεν ήταν έγκυρη· μπήκαν οι σημερινές τιμές."); at = now; }
    const lines = [], seen = new Set();
    /* ειδικές τιμές μόνο με τον προσωπικό σύνδεσμο (κλειδί tk)· ποτέ μόνο από το τηλέφωνο που γράφει ο πελάτης */
    const ckey = phone.replace(/\D/g, "").slice(-10), C0 = st.customers || {};
    const special = c => !!c && (c.pl === "w" || (c.prices && Object.keys(c.prices).length) || Object.values(st.products || {}).some(p => p.only && (p.onlyFor || []).includes(c.key)));
    const tk = typeof O.tk === "string" && O.tk.length >= 8 ? O.tk : "";
    const byTok = tk ? Object.values(C0).find(c => c.tok && c.tok === tk) : null;
    let cu = byTok || C0[ckey] || null;
    if (!byTok && special(cu)) { warn.push("Ο πελάτης παρήγγειλε χωρίς τον προσωπικό του σύνδεσμο (με το τηλέφωνο του «" + cu.name + "»)· γράφτηκαν οι κανονικές τιμές. Αν είναι όντως αυτός, στείλ' του τον προσωπικό του σύνδεσμο."); cu = null; }
    if (byTok && byTok.key !== ckey) warn.push("Παραγγελία από τον προσωπικό σύνδεσμο του «" + byTok.name + "» με άλλο τηλέφωνο (" + phone + ")· γράφτηκαν οι τιμές του «" + byTok.name + "».");
    const allowKey = cu ? cu.key : "";
    let total = 0;
    for (const row of O.l) {
      if (!Array.isArray(row)) continue;
      const [pid, qRaw, seenPrice] = row;
      const p = st.products[pid];
      if (!p || p.del) { warn.push("Ένα είδος δεν υπάρχει πια στον κατάλογο και παραλείφθηκε."); continue; }
      const opt = row[3] && typeof row[3] === "object" ? row[3] : null;
      const sk = pid + (opt ? "~" + JSON.stringify(opt) : ""); if (seen.has(sk)) continue; seen.add(sk);
      let q = +qRaw;
      if (!isFinite(q) || q <= 0) continue;
      if (q > K.MAX_QTY) { q = K.MAX_QTY; warn.push("Πολύ μεγάλη ποσότητα στο «" + p.name + "»· ελέγξτε."); }
      if (!K.stepOk(q, p.step)) warn.push("Ασυνήθιστη ποσότητα στο «" + p.name + "».");
      if (p.soldout) warn.push("Το «" + p.name + "» είναι σημειωμένο ως εξαντλημένο.");
      if (p.draft || p.hidden) warn.push("Το «" + p.name + "» δεν είναι ενεργό στον κατάλογό σας.");
      if (p.only && !(p.onlyFor || []).includes(allowKey)) warn.push("Το «" + p.name + "» είναι μόνο για επιλεγμένους πελάτες και αυτός δεν είναι ανάμεσά τους.");
      if (+p.min > 0 && q < +p.min) warn.push("Στο «" + p.name + "» ζήτησε " + K.num(q) + ", λιγότερο από την ελάχιστη ποσότητα " + K.num(p.min) + ".");
      if (!K.inSeason(p, new Date(at))) warn.push("Το «" + p.name + "» είναι εκτός εποχής.");
      const av = K.avail(p, st.orders);
      if (av !== Infinity && q > av + 1e-9) warn.push("Το «" + p.name + "» ξεπερνά το απόθεμα: ζήτησε " + K.num(q) + ", υπάρχουν " + K.num(Math.max(0, av)) + ".");
      const oc = K.optCheck(p.mods, st.mods || {}, opt && opt.o, opt && opt.n, !!p.nt);
      if (opt || (p.mods || []).some(g => (st.mods || {})[g] && st.mods[g].mn > 0)) oc.warn.forEach(w => warn.push("«" + p.name + "»: " + w));
      const price = K.round2(K.priceFor(p, cu, q, at) + oc.x);
      if (seenPrice != null && Math.abs(+seenPrice - price) > 0.004) warn.push("Ο πελάτης είδε άλλη τιμή στο «" + p.name + "» (" + K.money(seenPrice) + ")· γράφτηκε η δική σας " + K.money(price) + ". Στείλτε του τον νέο σύνδεσμο.");
      const sum = K.round2(q * price);
      total += sum;
      lines.push(Object.assign({ pid, name: p.name, unit: p.unit, q, price, vat: +p.vat || 0, sum }, oc.text ? { opt: oc.text } : {}, oc.note ? { note: oc.note } : {}));
    }
    if (!lines.length) return { err: "Κανένα έγκυρο είδος στην παραγγελία." };
    const w = O.w || {};
    const date = /^\d{4}-\d\d-\d\d$/.test(w.d || "") ? w.d : "";
    { const zs = (st.deliv && st.deliv.zones) || [], z = c.ar && w.h !== "pick" && !w.x ? K.zoneFor(zs, c.ar) : null;
      if (z && date && !(z.d || []).includes(K.fromYmd(date).getDay())) warn.push("Η ημέρα παράδοσης δεν είναι από τις ημέρες της περιοχής «" + String(c.ar).slice(0, 60) + "». Ελέγξτε την."); }
    return {
      ok: true, warn, at,
      order: {
        id: O.id, at, rx: now,
        cust: { name, phone, addr: String(c.a || "").trim().slice(0, 160), note: String(c.note || "").trim().slice(0, 400), area: String(c.ar || "").trim().slice(0, 60) },
        when: { date, slot: String(w.s || "").slice(0, 30), how: w.h === "pick" ? "pick" : "del", extra: !!w.x },
        lines, total: K.round2(total), cv: +O.cv || 0,
        inv: O.inv && O.inv.t === "i" ? { t: "i", n: String(O.inv.n || "").slice(0, 100), f: String(O.inv.f || "").replace(/\D/g, "").slice(0, 9), d: String(O.inv.d || "").slice(0, 60), j: String(O.inv.j || "").slice(0, 80), a: String(O.inv.a || "").slice(0, 140) } : { t: O.inv && O.inv.t === "r" ? "r" : "" }
      }
    };
  };
  /* αποτύπωμα για εντοπισμό διπλών (ίδιο τηλέφωνο, ίδια είδη, ίδια ημέρα, μέσα σε 15 λεπτά) */
  K.fingerprint = o => [String(o.cust.phone).replace(/\D/g, "").slice(-10), o.when.date, o.lines.map(l => l.pid + ":" + l.q).sort().join(",")].join("|");

  /* ---------- σύντομος σύνδεσμος (is.gd, χωρίς λογαριασμό) ----------
     Το Viber δείχνει ολόκληρο το κείμενο του συνδέσμου· με σύντομο σύνδεσμο το μήνυμα
     μένει μικρό και φαίνεται η κάρτα με το εικονίδιο. Αν αποτύχει, μένει ο κανονικός. */
  K.shorten = (url, ms, host) => new Promise((res, rej) => {
    host = host === "v.gd" ? "v.gd" : "is.gd";
    const cb = "glenSh" + Math.random().toString(36).slice(2);
    const sc = document.createElement("script");
    const done = (f, v) => { clearTimeout(tm); try { delete window[cb]; } catch { window[cb] = undefined; } sc.remove(); f(v); };
    const tm = setTimeout(() => done(rej, new Error("χρόνος")), ms || 7000);
    window[cb] = d => { if (d && d.shorturl && /^https:\/\/(is|v)\.gd\/\w+$/.test(d.shorturl)) return done(res, d.shorturl); const e = new Error((d && d.errormessage) || "άγνωστο"); e.svc = 1; e.code = d && d.errorcode; done(rej, e); };
    sc.onerror = () => done(rej, new Error("δίκτυο"));
    sc.src = "https://" + host + "/create.php?format=json&callback=" + cb + "&url=" + encodeURIComponent(url);
    document.head.appendChild(sc);
  });

  /* εφεδρικές υπηρεσίες συντόμευσης (απλό κείμενο): da.gd και TinyURL */
  K.shorten2 = async (url, host, ms) => {
    const ctrl = new AbortController(), tm = setTimeout(() => ctrl.abort(), ms || 9000);
    try {
      const api = host === "tinyurl" ? "https://tinyurl.com/api-create.php?url=" : "https://da.gd/s?url=";
      const r = await fetch(api + encodeURIComponent(url), { signal: ctrl.signal });
      const t = (await r.text()).trim();
      if (r.ok && /^https:\/\/(da\.gd|tinyurl\.com)\/[\w-]{3,40}$/.test(t)) return t;
      const e = new Error(t.slice(0, 80) || ("HTTP " + r.status)); e.svc = 1; throw e;
    } finally { clearTimeout(tm); }
  };
  /* ---------- ειδοποιήσεις (ntfy, όπως στο Δρομολόγιο) ---------- */
  /* ---------- ζωντανή διαθεσιμότητα: υπογεγραμμένη ενημέρωση του πωλητή που διαβάζει ο πελάτης ---------- */
  K.LIVE_SUFFIX = "_z";
  K.liveKeys = async () => {
    const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
    return { pub: K.b64u.enc(raw), priv: await crypto.subtle.exportKey("jwk", kp.privateKey) };
  };
  K.liveSign = async (privJwk, d) => {
    const k = await crypto.subtle.importKey("jwk", privJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    return K.b64u.enc(new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, k, new TextEncoder().encode(d))));
  };
  K.liveVerify = async (pubB64, d, sig) => {
    try {
      const k = await crypto.subtle.importKey("raw", K.b64u.dec(pubB64), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
      return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, k, K.b64u.dec(sig), new TextEncoder().encode(d));
    } catch { return false; }
  };
  /* s: {pid: [κατάσταση 1=εξαντλήθηκε 2=εκτός εποχής, μέγιστο]} μόνο για όσα δεν είναι ελεύθερα· r: λιανικές τιμές */
  /* a: ενεργά προϊόντα (όσα λείπουν = δεν υπάρχουν πια)· s: εξαντλημένα/εκτός εποχής/όριο αποθέματος· r: λιανικές τιμές */
  K.liveSnapshot = (st, withPrices) => {
    const s = {}, r = {}, a = [], now = new Date();
    for (const p of Object.values(st.products || {})) {
      if (p.del || p.hidden || p.draft) continue;
      if (withPrices) r[p.id] = +p.price || 0; else a.push(p.id);
      if (p.soldout) { s[p.id] = [1]; continue; }
      if (!K.inSeason(p, now)) { s[p.id] = [2]; continue; }
      const av = K.avail(p, st.orders);
      if (av !== Infinity) s[p.id] = av <= 0 ? [1] : [0, av];
    }
    const d = { ts: Date.now(), s };
    if (withPrices) d.r = r; else d.a = a;
    return d;
  };
  K.liveBody = st => { let o = K.liveSnapshot(st, true), d = JSON.stringify(o); if (d.length > 3300) { o = K.liveSnapshot(st, false); d = JSON.stringify(o); } if (d.length > 3300) o = { ts: Date.now(), off: 1 }; return o; };
  K.livePublish = async (st, o) => {
    if (!st.nt || !st.nt.topic || !st.nt.spriv) return false;
    const d = JSON.stringify(o || K.liveBody(st));
    const msg = JSON.stringify({ d, g: await K.liveSign(st.nt.spriv, d) });
    const r = await fetch(K.NTFY + "/" + st.nt.topic + K.LIVE_SUFFIX, { method: "POST", body: msg });
    return r.ok;
  };
  K.liveFetch = async (C) => {
    if (!C || !C.g || !C.t) return null;
    const r = await fetch(K.NTFY + "/" + C.t + K.LIVE_SUFFIX + "/json?poll=1&since=12h", { cache: "no-store" });
    if (!r.ok) return null;
    const cands = [];
    for (const ln of (await r.text()).split("\n")) { if (!ln.trim()) continue;
      try { const m = JSON.parse(ln); if (m.event !== "message") continue; const o = JSON.parse(m.message); if (typeof o.d !== "string" || typeof o.g !== "string") continue; const d = JSON.parse(o.d); if (typeof d.ts === "number") cands.push({ d, raw: o.d, g: o.g }); } catch {} }
    cands.sort((a, b) => b.d.ts - a.d.ts);
    const now = Date.now();
    for (const c of cands.slice(0, 40)) {
      if (!(c.d.ts > (C.ts || 0)) || c.d.ts > now + 10 * 6e4 || now - c.d.ts > 13 * 36e5) continue;
      if (await K.liveVerify(C.g, c.raw, c.g)) return c.d.off ? null : c.d;
    }
    return null;
  };
  /* ---------- ζωντανός κατάλογος: ο πελάτης παίρνει κάθε αλλαγή χωρίς νέο σύνδεσμο ---------- */
  K.CAT_SUFFIX = "_k";
  K.CHUNK = 3000;
  K.catalogPublish = async (st, C) => {
    if (!st.nt || !st.nt.topic || !st.nt.spriv) return false;
    const pk = await K.pack(C), g = await K.liveSign(st.nt.spriv, pk), n = Math.ceil(pk.length / K.CHUNK);
    if (n > 20) return false;
    for (let i = 0; i < n; i++) {
      const r = await fetch(K.NTFY + "/" + st.nt.topic + K.CAT_SUFFIX, { method: "POST", body: JSON.stringify({ v: 2, id: C.ts, i, n, c: pk.slice(i * K.CHUNK, (i + 1) * K.CHUNK), g }) });
      if (!r.ok) return false;
    }
    return true;
  };
  K.catalogFetch = async (C0, after) => {
    if (!C0 || !C0.g || !C0.t) return null;
    const r = await fetch(K.NTFY + "/" + C0.t + K.CAT_SUFFIX + "/json?poll=1&since=12h", { cache: "no-store" });
    if (!r.ok) return null;
    const sets = new Map();
    for (const ln of (await r.text()).split("\n")) { if (!ln.trim()) continue;
      try { const m = JSON.parse(ln); if (m.event !== "message") continue; const o = JSON.parse(m.message);
        if (o.v !== 2 || typeof o.id !== "number" || typeof o.c !== "string" || !(o.n > 0 && o.n <= 20) || !(o.i >= 0 && o.i < o.n)) continue;
        const k = o.id + "|" + o.g; if (!sets.has(k)) sets.set(k, { id: o.id, n: o.n, g: o.g, parts: [] }); sets.get(k).parts[o.i] = o.c; } catch {} }
    const now = Date.now();
    const L = [...sets.values()].filter(x => x.id > (after || 0) && x.id < now + 10 * 6e4 && x.parts.filter(v => typeof v === "string").length === x.n).sort((a, b) => b.id - a.id);
    for (const x of L.slice(0, 10)) {
      const pk = x.parts.join("");
      if (!(await K.liveVerify(C0.g, pk, x.g))) continue;
      try { const C = await K.unpack(pk); if (C && C.v === 1 && C.ts === x.id && C.k === C0.k && C.t === C0.t && C.g === C0.g) return { C, pk, g: x.g }; } catch {}
    }
    return null;
  };
  K.verifyPacked = async (C0, pk, g) => (await K.liveVerify(C0.g, pk, g)) ? K.unpack(pk) : null;
  K.ntfySend = async (topic, title, message, click) => {
    const r = await fetch(K.NTFY + "/", {
      method: "POST",
      body: JSON.stringify({ topic, title, message, click, tags: ["shopping_cart"], priority: 4 })
    });
    if (!r.ok) throw new Error("ntfy " + r.status);
    return r.json().catch(() => ({}));
  };
  K.ntfyPoll = async (topic, since) => {
    const r = await fetch(K.NTFY + "/" + encodeURIComponent(topic) + "/json?poll=1&since=" + encodeURIComponent(since || "12h"), { cache: "no-store" });
    if (!r.ok) throw new Error("ntfy " + r.status);
    const t = await r.text();
    return t.split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(m => m && m.event === "message");
  };

  /* ---------- κανονικοποίηση ελληνικών και ανάλυση μηνύματος ---------- */
  K.norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ς/g, "σ").replace(/[^a-z0-9α-ω\s.,/:+-]/g, " ").replace(/\s+/g, " ").trim();
  /* περιοχές: «Αμπελόκηποι» = «Αμπελοκήπους» = «αμπελοκηποι» (ίδια ρίζα, χωρίς τόνους) */
  K.areaEq = (a, b) => { a = K.norm(a); b = K.norm(b); if (!a || !b) return false; if (a === b) return true;
    const n = Math.min(a.length, b.length); if (n < 5) return false; let k = 0; while (k < n && a[k] === b[k]) k++; return k >= Math.max(5, n - 2); };
  /* ---------- επιλογές προϊόντος (ζάχαρη, γάλα, πάγος, ψήσιμο…): ομάδες που μπαίνουν σε όσα προϊόντα θέλεις ---------- */
  /* ομάδα: { id, n: όνομα, mn: ελάχιστες επιλογές (0 = προαιρετική), mx: μέγιστες (0 = όσες θέλει), o: [{ n, p: επιπλέον €, def: προεπιλογή, off: δεν υπάρχει τώρα }] } */
  K.MOD_TPL = [
    ["Καφές και ροφήματα", [
      ["zachari", "Ζάχαρη", 1, 1, [["Σκέτος"], ["Μέτριος"], ["Γλυκός"], ["Πολύ γλυκός"]]],
      ["glykantiko", "Γλυκαντικό", 0, 1, [["Λευκή ζάχαρη"], ["Καστανή ζάχαρη"], ["Ζαχαρίνη"], ["Στέβια"], ["Μέλι", 0.2]]],
      ["gala", "Γάλα", 0, 1, [["Φρέσκο γάλα"], ["Εβαπορέ"], ["Φυτικό γάλα", 0.3]]],
      ["pagos", "Πάγος", 0, 1, [["Λίγος"], ["Πολύς"], ["Χωρίς πάγο"]]],
      ["extra_kafe", "Επιπλέον", 0, 0, [["Διπλή δόση", 0.5], ["Σαντιγί", 0.4], ["Σιρόπι καραμέλα", 0.3], ["Σιρόπι βανίλια", 0.3], ["Κανέλα"]]],
      ["megethos", "Μέγεθος", 1, 1, [["Κανονικό"], ["Μεγάλο", 0.5]]]]],
    ["Φαγητό", [
      ["psisimo", "Ψήσιμο", 0, 1, [["Καλοψημένο"], ["Λίγο ψημένο"]]],
      ["zesto", "Ζέσταμα", 1, 1, [["Ζεστό"], ["Χωρίς ζέσταμα"]]],
      ["saltses", "Σάλτσες", 0, 0, [["Μαγιονέζα"], ["Μουστάρδα"], ["Κέτσαπ"], ["Χωρίς σάλτσα"]]],
      ["psomi", "Ψωμί", 1, 1, [["Ολόκληρο"], ["Κομμένο σε φέτες"]]],
      ["ylika", "Υλικά", 0, 0, [["Χωρίς κρεμμύδι"], ["Χωρίς ντομάτα"], ["Χωρίς σάλτσα"], ["Χωρίς πατάτες"], ["Έξτρα τυρί", 0.5]]]]],
    ["Κρέας και ψάρι", [
      ["kopsimo", "Κόψιμο", 1, 1, [["Ολόκληρο"], ["Σε μπριζόλες"], ["Σε κομμάτια"], ["Κιμάς"]]],
      ["katharisma", "Καθάρισμα", 1, 1, [["Ολόκληρο, χωρίς καθάρισμα"], ["Καθαρισμένο"], ["Φιλέτο", 1]]]]],
    ["Άλλα", [
      ["thermokrasia", "Θερμοκρασία", 0, 1, [["Κρύο", 0, 1], ["Θερμοκρασία δωματίου"]]],
      ["orimansi", "Ωρίμανση", 0, 1, [["Για σήμερα", 0, 1], ["Για σε 2–3 ημέρες"]]],
      ["doro", "Συσκευασία δώρου", 0, 1, [["Ναι, σε συσκευασία δώρου", 2]]]]]
  ];
  /* έτοιμες ομάδες της 1.67 που άλλαξαν: αν ο πωλητής δεν τις πείραξε, ενημερώνονται μόνες τους */
  K.MOD_OLD = {"zachari": "{\"id\":\"m_zachari\",\"n\":\"Ζάχαρη\",\"mn\":1,\"mx\":1,\"o\":[{\"n\":\"Σκέτος\"},{\"n\":\"Μέτριος\",\"def\":1},{\"n\":\"Γλυκός\"},{\"n\":\"Πολύ γλυκός\"}]}", "megethos": "{\"id\":\"m_megethos\",\"n\":\"Μέγεθος\",\"mn\":1,\"mx\":1,\"o\":[{\"n\":\"Κανονικό\",\"def\":1},{\"n\":\"Μεγάλο\",\"p\":0.5}]}", "zesto": "{\"id\":\"m_zesto\",\"n\":\"Ζέσταμα\",\"mn\":0,\"mx\":1,\"o\":[{\"n\":\"Ζεστό\",\"def\":1},{\"n\":\"Κρύο\"}]}", "psomi": "{\"id\":\"m_psomi\",\"n\":\"Ψωμί\",\"mn\":0,\"mx\":1,\"o\":[{\"n\":\"Ολόκληρο\",\"def\":1},{\"n\":\"Κομμένο σε φέτες\"}]}", "katharisma": "{\"id\":\"m_katharisma\",\"n\":\"Καθάρισμα\",\"mn\":0,\"mx\":1,\"o\":[{\"n\":\"Καθαρισμένο\"},{\"n\":\"Φιλέτο\",\"p\":1}]}"};
  K.modUpgrade = mods => { let n = 0; for (const [id, g] of Object.entries(mods || {})) { const t = id.slice(2); if (id.startsWith("m_") && K.MOD_OLD[t] === JSON.stringify(g)) { mods[id] = K.modFromTpl(t); n++; } } return n; };
  K.modFromTpl = id => { for (const [, L] of K.MOD_TPL) for (const t of L) if (t[0] === id) return { id: "m_" + id, n: t[1], mn: t[2], mx: t[3], o: t[4].map(([n, p, d]) => Object.assign({ n }, p ? { p } : {}, d ? { def: 1 } : {})) }; return null; };
  K.modRule = g => g.mn > 0 ? (g.mx === 1 ? "Υποχρεωτικό · διάλεξε 1" : g.mx > 1 ? "Υποχρεωτικό · " + g.mn + " έως " + g.mx : "Υποχρεωτικό · τουλάχιστον " + g.mn) : (g.mx === 1 ? "Προαιρετικό · έως 1" : g.mx > 1 ? "Προαιρετικό · έως " + g.mx : "Προαιρετικό · όσα θέλεις");
  /* το «πώς το θέλει» μιας γραμμής παραγγελίας σε κείμενο */
  K.lnOpt = l => [l && l.opt, l && l.note ? "«" + l.note + "»" : ""].filter(Boolean).join(" · ");
  K.lnName = l => l.name + (K.lnOpt(l) ? " (" + K.lnOpt(l) + ")" : "");
  /* έλεγχος επιλογών: { o: { gid: [δείκτες] }, n: σχόλιο } → κείμενο, επιπλέον τιμή, προβλήματα */
  K.optCheck = (gids, groups, sel, note, allowNote) => {
    const out = [], warn = []; let x = 0; sel = sel && typeof sel === "object" ? sel : {};
    for (const gid of gids || []) { const g = groups[gid]; if (!g) continue;
      const ix = [...new Set((Array.isArray(sel[gid]) ? sel[gid] : []).map(Number).filter(i => Number.isInteger(i) && g.o[i]))];
      const ok = ix.filter(i => !g.o[i].off); if (ok.length < ix.length) warn.push("Επιλογή που δεν υπάρχει τώρα στο «" + g.n + "».");
      if (g.mx > 0 && ok.length > g.mx) { warn.push("Πάρα πολλές επιλογές στο «" + g.n + "»."); ok.length = g.mx; }
      if (ok.length < (g.mn || 0)) warn.push("Λείπει η επιλογή «" + g.n + "».");
      if (ok.length) { out.push(ok.map(i => g.o[i].n).join(", ")); x += ok.reduce((a, i) => a + (+g.o[i].p || 0), 0); } }
    const n = allowNote ? String(note || "").trim().slice(0, 120) : "";
    return { text: out.join(" · "), x: Math.round(x * 100) / 100, note: n, warn };
  };
  K.zoneFor = (zones, area) => (zones || []).find(z => (z.a || []).some(x => K.areaEq(x, area))) || null;
  const stem = w => w.length <= 3 ? w : w.slice(0, Math.max(3, w.length - 2));
  const WORDNUM = { ενα: 1, μια: 1, μιαν: 1, ενασ: 1, δυο: 2, τρια: 3, τρεισ: 3, τεσσερα: 4, τεσσερισ: 4, πεντε: 5, εξι: 6, επτα: 7, εφτα: 7, οκτω: 8, οχτω: 8, εννια: 9, εννεα: 9, δεκα: 10, εντεκα: 11, δωδεκα: 12, δεκαπεντε: 15, εικοσι: 20, τριαντα: 30, σαραντα: 40, πενηντα: 50, μισο: 0.5, μιση: 0.5, μισα: 0.5, μισοκιλο: 0.5, εναμισο: 1.5, εναμιση: 1.5, εναμισι: 1.5, μιαμισι: 1.5, ενασημισο: 1.5, μιαμιση: 1.5 };
  const WDN = { κυριακη: 0, δευτερα: 1, τριτη: 2, τεταρτη: 3, πεμπτη: 4, παρασκευη: 5, σαββατο: 6 };
  /* οι κανονικές εκφράσεις \b δεν πιάνουν ελληνικά, γι' αυτό δουλεύουμε με λέξεις */
  const words = s => s.split(/[\s.,/:+-]+/).filter(Boolean);
  K.parseMsg = (text, st, now) => {
    const res = { lines: [], date: "", cust: null, phone: "", rest: [] };
    const t0 = now ? new Date(now) : new Date(); t0.setHours(12, 0, 0, 0);
    const all = K.norm(text), W = words(all);
    const has = w => W.includes(w), pre = w => W.some(x => x.startsWith(w));
    const addD = n => { const d = new Date(t0); d.setDate(d.getDate() + n); return K.ymd(d); };
    if (has("μεθαυριο")) res.date = addD(2);
    else if (has("αυριο")) res.date = addD(1);
    else if (has("σημερα") || has("αποψε")) res.date = addD(0);
    else {
      for (const [w, n] of Object.entries(WDN)) {
        if (pre(w)) { let diff = (n - t0.getDay() + 7) % 7; if ((has("αλλη") || has("επομενη")) && diff === 0) diff = 7; res.date = addD(diff); break; }
      }
      const dm = /(?:^|\s)(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?(?=\s|$)/.exec(all);
      if (!res.date && dm) {
        let y = dm[3] ? +dm[3] : t0.getFullYear(); if (y < 100) y += 2000;
        const d = new Date(y, +dm[2] - 1, +dm[1], 12);
        if (d.getMonth() === +dm[2] - 1) { if (!dm[3] && d < t0 - 864e5) d.setFullYear(y + 1); res.date = K.ymd(d); }
      }
    }
    const ph = /(?:\+?30)?(69\d{8}|2\d{9})/.exec(String(text).replace(/[\s().-]/g, ""));
    if (ph) res.phone = ph[1];
    const custs = Object.values(st.customers || {});
    let best = null, bestScore = 0;
    for (const c of custs) {
      let score = 0;
      if (res.phone && String(c.phone).replace(/\D/g, "").endsWith(res.phone)) score = 100;
      const cn = K.norm(c.name);
      if (cn && (" " + all + " ").includes(" " + cn + " ")) score = Math.max(score, 50 + cn.length);
      else { const first = cn.split(" ")[0]; if (first && first.length >= 3 && pre(stem(first))) score = Math.max(score, 10 + first.length); }
      if (score > bestScore) { bestScore = score; best = c; }
    }
    if (best) res.cust = best;
    const prods = Object.values(st.products || {}).filter(p => !p.del && !p.draft);
    const pTok = prods.map(p => ({ p, toks: [...new Set(words(K.norm(p.name + " " + (p.keys || ""))).filter(w => w.length >= 3 && !/^\d/.test(w)).map(stem))] }));
    const segs = String(text).split(/\n|(?<!\d),|,(?!\d)|;|\+/).flatMap(x => K.norm(x).split(/ και | κ /)).map(x => x.trim()).filter(Boolean);
    const used = new Map();
    for (const seg of segs) {
      const ws = words(seg);
      let bp = null, bs = 0;
      for (const { p, toks } of pTok) {
        let s = 0;
        for (const tk of toks) if (ws.some(w => w.startsWith(tk))) s += tk.length;
        if (s > bs) { bs = s; bp = p; }
      }
      if (!bp || bs < 3) { if (seg.length > 2) res.rest.push(seg); continue; }
      const clean = seg.replace(/(?:^|\s)\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?(?=\s|$)/g, " ").replace(/(69\d{8}|2\d{9})/g, " ");
      let q = null;
      const cw = words(clean);
      for (let i = 0; i < cw.length; i++) {
        const w = cw[i];
        if (/^\d+$/.test(w)) { q = +w; break; }
        if (w === "ενα" && cw[i + 1] && /^μισ/.test(cw[i + 1])) { q = 1.5; break; }
        if (WORDNUM[w] != null) { q = WORDNUM[w]; if (q >= 1 && q % 1 === 0 && cw[i + 1] && /^μισ/.test(cw[i + 1])) q += 0.5; break; }
      }
      const dec = /(\d+)[.,](\d+)/.exec(clean.replace(/(?:^|\s)\d{1,2}[/.-]\d{1,2}(?=\s|$)/g, " "));
      if (dec) q = K.parseNum(dec[1] + "." + dec[2]);
      if (q == null) q = 1;
      if (cw.some(w => /^γρ/.test(w)) && /κιλ/.test(K.norm(bp.unit)) && q >= 50) q = q / 1000;
      if (used.has(bp.id)) { used.get(bp.id).q += q; continue; }
      const line = { pid: bp.id, q };
      used.set(bp.id, line);
      res.lines.push(line);
    }
    return res;
  };

  /* ---------- απόδοση μενού (κοινή για προεπισκόπηση και πελάτη) ---------- */
  K.SIZES = { s: "Μικρό", m: "Μεσαίο", l: "Μεγάλο", w: "Φαρδύ" };
  K.findNode = (nodes, id, parent) => {
    for (const n of nodes || []) {
      if (n.id === id) return { node: n, parent, list: nodes };
      if (n.kids) { const f = K.findNode(n.kids, id, n); if (f) return f; }
    }
    return null;
  };
  K.pathTo = (nodes, id) => {
    for (const n of nodes || []) {
      if (n.id === id) return [n];
      if (n.kids) { const p = K.pathTo(n.kids, id); if (p) return [n].concat(p); }
    }
    return null;
  };
  /* ctx: {prod(pid)→προϊόν, qty(pid)→ποσότητα, edit, marked:Set, count(node)} */
  K.tilesHTML = (nodes, ctx) => {
    const out = [];
    for (const n of nodes || []) {
      const sz = K.SIZES[n.size] ? n.size : "m";
      const mk = ctx.edit ? `<button type="button" class="mk${ctx.marked && ctx.marked.has(n.id) ? " on" : ""}" data-mk="${n.id}" aria-label="Μαρκάρισμα">✓</button>` : "";
      const sel = ctx.marked && ctx.marked.has(n.id) ? " marked" : "";
      if (n.t === "p") {
        const p = ctx.prod(n.pid);
        if (!p || (p.hidden && !ctx.edit)) continue;
        const q = ctx.qty ? ctx.qty(p.id) : 0;
        const so = !!p.soldout;
        const img = p.photo ? `<img class="ph" src="${K.esc(p.photo)}" alt="">` : /^data:image\//.test(p.aic || "") ? `<img class="em emi" src="${K.esc(p.aic)}" alt="">` : (n.emoji || p.emoji ? `<span class="em">${K.esc(n.emoji || p.emoji)}</span>` : "");
        const ctl = ctx.edit ? "" : so ? `<div class="so">${p.oos ? "Εκτός εποχής" : "Εξαντλήθηκε"}</div>` :
          `<div class="qty"><button type="button" class="qb" data-minus="${p.id}" aria-label="Λιγότερο"${q ? "" : " disabled"}>−</button><span class="qv" data-qv="${p.id}">${q ? K.num(q) : "0"}</span><button type="button" class="qb plus" data-plus="${p.id}" aria-label="Περισσότερο">+</button></div>`;
        out.push(`<div class="tile prod sz-${sz}${so ? " soldout" : ""}${q ? " has" : ""}${p.hidden || p.draft ? " hid" : ""}${sel}" data-node="${n.id}" data-pid="${p.id}"${n.color ? ` style="--tc:${K.esc(n.color)};color:${K.contrast(n.color)}"` : ""}>${mk}${img}<div class="tx"><div class="nm">${K.esc(n.name || p.name)}</div><div class="pr">${K.money(p.price)} <small>/ ${K.esc(p.unit)}</small></div>${+p.step && +p.step !== 1 ? `<div class="stp">κάθε ＋ ${K.num(p.step)} ${K.esc(p.unit)} = <b>${K.money(p.price * p.step)}</b></div>` : ""}${(p.tiers || []).length ? `<div class="stp">${p.tiers.slice().sort((a, b) => a[0] - b[0]).map(t => `από ${K.num(t[0])}: <b>${K.money(t[1])}</b>`).join(" · ")}</div>` : ""}${+p.min > 0 && !ctx.edit ? `<div class="stp">ελάχιστη παραγγελία: ${K.num(p.min)}</div>` : ""}${p.max != null && !ctx.edit && p.max < 20 ? `<div class="stp lft">έμειναν ${K.num(p.max)}</div>` : ""}${p.desc && sz !== "s" ? `<div class="ds">${K.esc(p.desc)}</div>` : ""}</div>${ctl}${ctx.edit && (so || p.hidden || p.draft) ? `<div class="flag">${p.draft ? "Ενδεικτικό" : so ? "Εξαντλήθηκε" : "Κρυφό"}</div>` : ""}</div>`);
      } else {
        const cnt = ctx.count ? ctx.count(n) : 0;
        const img = n.photo ? `<img class="ph" src="${K.esc(n.photo)}" alt="">` : /^data:image\//.test(n.aic || "") ? `<img class="em emi" src="${K.esc(n.aic)}" alt="">` : n.emoji ? `<span class="em">${K.esc(n.emoji)}</span>` : "";
        /* βασικές κατηγορίες (στην αρχική): άλλο χρώμα και από κάτω οι υποκατηγορίες τους (ή τα πρώτα προϊόντα) */
        let subs = "";
        if (ctx.root) { const kc = (n.kids || []).filter(k => k.t === "c").map(k => k.name).filter(Boolean);
          const kp = kc.length ? [] : (n.kids || []).filter(k => k.t === "p").map(k => { const p = ctx.prod(k.pid); return p && !(p.hidden && !ctx.edit) ? (k.name || p.name) : ""; }).filter(Boolean);
          const L = kc.length ? kc : kp; if (L.length) subs = `<span class="subs">${K.esc(L.slice(0, 4).join(" · "))}${L.length > 4 ? " …" : ""}</span>`; }
        out.push(`<div role="button" tabindex="0" class="tile cat${ctx.root ? " top" : ""} sz-${sz}${sel}" data-node="${n.id}" data-open="${n.id}"${n.color ? ` style="--tc:${K.esc(n.color)};color:${K.contrast(n.color)}"` : ""}>${mk}${img}<span class="nm">${K.esc(n.name || "Χωρίς όνομα")}</span>${subs}${cnt ? `<span class="badge">${K.num(cnt)}</span>` : ""}${ctx.edit ? `<span class="sub">${(n.kids || []).length} μέσα</span>` : ""}</div>`);
      }
    }
    return out.join("") || (ctx.edit ? "" : `<p class="empty">Δεν υπάρχουν είδη εδώ ακόμα.</p>`);
  };
  /* πόσα τεμάχια από το καλάθι βρίσκονται μέσα σε μια κατηγορία */
  K.countIn = (node, qty) => { let s = 0; for (const k of node.kids || []) s += k.t === "p" ? (qty(k.pid) ? 1 : 0) : K.countIn(k, qty); return s; };

  /* ---------- χρώματα ---------- */
  K.contrast = hex => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#fff";
    const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#1b1b1b" : "#ffffff";
  };

  /* ---------- εικόνες: σμίκρυνση για τον σύνδεσμο ---------- */
  K.shrinkImage = (file, size, quality) => new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"), s = Math.min(img.width, img.height);
      c.width = c.height = size;
      const x = c.getContext("2d");
      x.imageSmoothingQuality = "high";
      x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      let d = c.toDataURL("image/webp", quality || 0.7);
      if (!d.startsWith("data:image/webp")) d = c.toDataURL("image/jpeg", quality || 0.7);
      res(d);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("εικόνα")); };
    img.src = url;
  });

  /* ---------- σύνδεσμος καταλόγου ---------- */
  K.buildCatalog = (st, opts) => {
    opts = opts || {};
    const sh = st.shop || {};
    const used = new Set();
    const ck = opts.cust && opts.cust.k, cu = ck && st.customers ? st.customers[ck] : null;
    const visible = p => p && !p.hidden && !p.del && !p.draft && (!p.only || (ck && (p.onlyFor || []).includes(ck)));
    const walk = ns => (ns || []).map(n => {
      const o = { i: n.id, n: n.name || "" };
      if (n.size && n.size !== "m") o.z = n.size;
      if (n.emoji) o.e = n.emoji;
      if (n.color) o.c = n.color;
      if (n.t === "p") { const p = st.products[n.pid]; if (!visible(p)) return null; o.p = n.pid; used.add(n.pid); if (o.n === p.name) delete o.n; }
      else { o.k = walk(n.kids).filter(Boolean); if (!o.k.length) return null; if (opts.photos && n.photo) o.f = n.photo; if (opts.icons !== false && n.aic) o.ai = n.aic; }
      return o;
    }).filter(Boolean);
    const m = walk(st.menu);
    const p = {}, usedG = new Set();
    for (const id of used) {
      const x = st.products[id];
      const kind = K.priceKind(x, cu);
      const o = { n: x.name, u: x.unit, r: kind === "retail" ? +x.price || 0 : K.priceFor(x, cu, 0) };
      if (+x.step && +x.step !== 1) o.s = +x.step;
      if (x.only) o.xo = 1;
      if (kind !== "retail" && opts.cust) { opts.cust.pp = opts.cust.pp || {}; opts.cust.pp[id] = o.r; }
      if (kind !== "personal" && Array.isArray(x.tiers) && x.tiers.length) { const tq = x.tiers.filter(t => +t[0] > 0 && +t[1] > 0 && +t[1] < o.r).map(t => [+t[0], +t[1]]); if (tq.length) o.tq = tq; }
      if (+x.min > 0) o.mn = +x.min;
      if (!K.inSeason(x)) o.xs = 1;
      const av = K.avail(x, st.orders);
      if (av !== Infinity) { if (av <= 0) o.x = 1; else o.mx = av; }
      if (x.vat != null && +x.vat !== 13) o.v = +x.vat;
      if (x.soldout) o.x = 1;
      if (x.desc) o.d = x.desc;
      if (x.emoji) o.e = x.emoji;
      if (x.perish === false) o.np = 1;
      { const gs = (x.mods || []).filter(g => (st.mods || {})[g]); if (gs.length) { o.g = gs; gs.forEach(g => usedG.add(g)); } if (x.nt) { o.nt = 1; if (x.ntp) o.ntp = String(x.ntp).slice(0, 60); } }
      if (opts.photos && x.photo) o.f = x.photo;
      if (opts.icons !== false && x.aic) o.ai = x.aic;
      p[id] = o;
    }
    const d = st.deliv || {};
    return {
      v: 1, ts: Date.now(),
      s: { n: sh.name || "", l: sh.legal || "", a: sh.addr || "", f: sh.afm || "", t: sh.phone || "", vb: sh.viber || "", m: sh.email || "", lg: opts.logo !== false ? sh.logo || "" : "", c1: sh.c1 || "#17324D", c2: sh.c2 || "#F2B632", w: sh.welcome || "", vi: sh.vatIncl !== false ? 1 : 0, lic: sh.lic || "", tr: sh.terms || "" },
      d: { h: d.how || "both", days: d.days || [1, 2, 3, 4, 5, 6], sl: d.slots || [], min: +d.min || 0, max: +d.max || 14, cut: d.cut || "", cl: K.closedDates(d, 70), ad: d.askAddr !== false ? 1 : 0, mo: +d.minOrder || 0, nt: d.note || "", z: (d.zones || []).filter(z => (z.a || []).length && (z.d || []).length).map(z => ({ a: z.a, d: z.d })), zo: d.zOther === "pick" ? 1 : 0 },
      m, p, og: usedG.size ? Object.fromEntries([...usedG].map(id => { const g = st.mods[id]; return [id, { n: g.n, mn: +g.mn || 0, mx: +g.mx || 0, o: (g.o || []).map(x => [x.n, +x.p || 0, x.def ? 1 : 0, x.off ? 1 : 0]) }]; })) : undefined,
      k: st.nt.pub, t: st.nt.topic, u: opts.appUrl || "", g: st.nt.spub || undefined,
      c: opts.cust || undefined
    };
  };
  /* από τον συμπαγή κατάλογο σε κοινή μορφή για την απόδοση */
  K.expandCatalog = C => {
    const products = {};
    for (const [id, o] of Object.entries(C.p || {})) products[id] = { id, name: o.n, unit: o.u, price: +o.r || 0, step: +o.s || 1, vat: o.v != null ? +o.v : 13, soldout: !!o.x || !!o.xs, oos: !!o.xs, desc: o.d || "", emoji: o.e || "", perish: !o.np, photo: o.f || "", tiers: Array.isArray(o.tq) ? o.tq : [], min: +o.mn || 0, max: o.mx != null ? +o.mx : null, aic: typeof o.ai === "string" ? o.ai : "", mods: Array.isArray(o.g) ? o.g : [], nt: !!o.nt, ntp: o.ntp || "" };
    const walk = ns => (ns || []).map(o => o.p ? { id: o.i, t: "p", pid: o.p, name: o.n || (products[o.p] || {}).name || "", size: o.z || "m", emoji: o.e || "", color: o.c || "" } : { id: o.i, t: "c", name: o.n, size: o.z || "m", emoji: o.e || "", color: o.c || "", photo: o.f || "", aic: typeof o.ai === "string" ? o.ai : "", kids: walk(o.k) });
    const groups = {}; for (const [id, g] of Object.entries(C.og || {})) groups[id] = { id, n: g.n, mn: +g.mn || 0, mx: +g.mx || 0, o: (g.o || []).map(a => ({ n: a[0], p: +a[1] || 0, def: !!a[2], off: !!a[3] })) };
    return { products, menu: walk(C.m), groups };
  };

  window.Kat = K;
})();
