/*
  Παραγγελίες — κατάλογος από και προς Excel (πρότυπο, εξαγωγή, ανέβασμα)
  © 2026 Ανδρέας Μ. Γλεντζάκης (Andreas M. Glentzakis). Με την επιφύλαξη παντός δικαιώματος. All rights reserved.
  Απαγορεύεται η αντιγραφή, τροποποίηση και διάθεση, εν όλω ή εν μέρει, χωρίς προηγούμενη γραπτή άδεια του κατόχου.
*/
(function () {
"use strict";
const K = window.Kat, A = window.App, esc = K.esc;
const $ = s => document.querySelector(s);
const S = () => A.S();

/* ================= γενικό: γράψιμο και διάβασμα αρχείων .xlsx ================= */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const enc = new TextEncoder();
function zipStore(files) {
  const parts = [], central = []; let off = 0;
  const d = new Date(), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  for (const [name, text] of files) {
    const nm = enc.encode(name), data = typeof text === "string" ? enc.encode(text) : text, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, tm, true); h.setUint16(12, dt, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), nm, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, tm, true); c.setUint16(14, dt, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + data.length;
  }
  const cdSize = central.reduce((a, x) => a + x.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
const xe = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const colL = i => { let s = ""; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
/* sheets: [{ name, cols:[πλάτη], rows:[[τιμές]], head:true, num:[στήλες αριθμών], valid:[{col, list:[...]}], wrap:true }] */
function writeXlsx(sheets) {
  const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const files = [];
  files.push(["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`]);
  files.push(["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`]);
  files.push(["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ${NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xe(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`]);
  files.push(["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`]);
  files.push(["xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet ${NS}><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF17324D"/><name val="Calibri"/></font><font><i/><sz val="11"/><color rgb="FF6B7785"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF17324D"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF4D6"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`]);
  sheets.forEach((sh, si) => {
    const rows = sh.rows.map((r, ri) => `<row r="${ri + 1}"${sh.head && ri === 0 ? ' ht="34" customHeight="1"' : ""}>${r.map((v, ci) => {
      if (v === "" || v == null) return "";
      const ref = colL(ci) + (ri + 1);
      const st = sh.head && ri === 0 ? 1 : sh.title && ri === 0 ? 3 : (sh.ex && sh.ex.includes(ri)) ? 5 : (sh.num || []).includes(ci) && typeof v === "number" ? 2 : sh.wrap ? 4 : 0;
      if (typeof v === "number" && isFinite(v)) return `<c r="${ref}"${st ? ` s="${st}"` : ""}><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${st ? ` s="${st}"` : ""}><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
    }).join("")}</row>`).join("");
    const dv = (sh.valid || []).map(v => `<dataValidation type="list" allowBlank="1" showErrorMessage="0" showInputMessage="0" sqref="${colL(v.col)}2:${colL(v.col)}1000"><formula1>"${xe(v.list.join(","))}"</formula1></dataValidation>`).join("");
    files.push([`xl/worksheets/sheet${si + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet ${NS}><sheetViews><sheetView workbookViewId="0"${si === 0 ? ' tabSelected="1"' : ""}>${sh.head ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : ""}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${sh.cols ? `<cols>${sh.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : ""}<sheetData>${rows}</sheetData>${dv ? `<dataValidations count="${sh.valid.length}">${dv}</dataValidations>` : ""}</worksheet>`]);
  });
  return zipStore(files);
}
async function unzip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  let e = -1; for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error("zip");
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
  const out = {}, dec = new TextDecoder();
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + xl + cl;
    if (!/\.(xml|rels)$/i.test(name)) continue;
    const ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
    const raw = u8.subarray(ds, ds + csize);
    out[name] = dec.decode(method === 8 ? await K.inflate(raw) : raw);
  }
  return out;
}
const colIdx = ref => { const m = /^([A-Z]+)/.exec(ref || ""); if (!m) return -1; let n = 0; for (const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
async function readXlsx(buf) {
  const F = await unzip(buf), P = new DOMParser();
  const xml = s => P.parseFromString(s, "application/xml");
  const tags = (d, t) => [...d.getElementsByTagNameNS("*", t)];
  const txt = el => tags(el, "t").map(t => t.textContent).join("");
  const ss = F["xl/sharedStrings.xml"] ? tags(xml(F["xl/sharedStrings.xml"]), "si").map(txt) : [];
  const wb = xml(F["xl/workbook.xml"] || "<x/>");
  const rels = {}; if (F["xl/_rels/workbook.xml.rels"]) for (const r of tags(xml(F["xl/_rels/workbook.xml.rels"]), "Relationship")) rels[r.getAttribute("Id")] = r.getAttribute("Target");
  const out = [];
  for (const s of tags(wb, "sheet")) {
    const rid = s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || s.getAttribute("r:id");
    let t = (rels[rid] || "").replace(/^\//, ""); if (t && !t.startsWith("xl/")) t = "xl/" + t;
    const src = F[t]; if (!src) continue;
    const rows = [];
    for (const r of tags(xml(src), "row")) {
      const ri = (+r.getAttribute("r") || rows.length + 1) - 1, row = [];
      for (const c of tags(r, "c")) {
        const ci = colIdx(c.getAttribute("r")); if (ci < 0) continue;
        const ty = c.getAttribute("t"), v = tags(c, "v")[0];
        let val = "";
        if (ty === "s") val = ss[+(v && v.textContent)] || "";
        else if (ty === "inlineStr") val = txt(c);
        else if (ty === "b") val = v && v.textContent === "1" ? "ΝΑΙ" : "ΟΧΙ";
        else if (v) val = ty === "str" || ty === "e" ? v.textContent : (isFinite(+v.textContent) ? +v.textContent : v.textContent);
        row[ci] = val;
      }
      rows[ri] = row;
    }
    out.push({ name: s.getAttribute("name") || "", rows: Array.from(rows, r => r || []) });
  }
  return out;
}
function readCsv(text) {
  text = text.replace(/^﻿/, "");
  const first = text.split(/\r?\n/)[0] || "", d = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ";" : (first.includes("\t") ? "\t" : ",");
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === d) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return [{ name: "Κατάλογος", rows }];
}
window.GXlsx = { write: writeXlsx, read: readXlsx, csv: readCsv };

/* ================= κατάλογος ⇄ Excel ================= */
const SIZES = [["s", "Μικρό"], ["m", "Μεσαίο"], ["l", "Μεγάλο"], ["w", "Φαρδύ"]];
const COLS = [
  ["cat", "Κατηγορία", 18], ["sub", "Υποκατηγορία", 18], ["name", "Προϊόν *", 30], ["price", "Τιμή € *", 10], ["unit", "Μονάδα", 12], ["step", "Βήμα (κάθε +)", 10],
  ["vat", "ΦΠΑ %", 8], ["desc", "Περιγραφή", 32], ["av", "Διαθέσιμο", 11], ["hid", "Κρυφό", 9], ["per", "Ευπαθές", 9], ["emoji", "Εικονίδιο", 10],
  ["size", "Μέγεθος κουμπιού", 14], ["keys", "Άλλες λέξεις (για Viber)", 26], ["code", "Κωδικός προϊόντος", 14], ["min", "Ελάχιστη ποσότητα", 11],
  ["stock", "Απόθεμα (κενό = δεν μετράω)", 14], ["whole", "Τιμή χονδρικής €", 11], ["tiers", "Έκπτωση ποσότητας (π.χ. 10: 4,00; 50: 3,50)", 26], ["season", "Εποχή: μήνες (κενό = όλο τον χρόνο)", 22],
  ["id", "Αναγνωριστικό εφαρμογής (μην το αλλάζεις)", 16]
];
const tiersText = t => (t || []).map(x => K.num(x[0]) + ": " + K.num(x[1])).join("; ");
const seasonText = m => Array.isArray(m) && m.length && m.length < 12 ? m.slice().sort((a, b) => a - b).map(x => K.MONTHS[x - 1]).join(", ") : "";
const tiersParse = v => { const out = []; for (const part of String(v || "").split(/[;·|\n]+/)) { const m = part.split(/\s*[:=→>]\s*/); if (m.length < 2) continue; const q = K.parseNum(m[0].replace(/[^\d.,]/g, "")), pr = K.parseNum(m[1].replace(/[^\d.,]/g, "")); if (isFinite(q) && q > 0 && isFinite(pr) && pr > 0) out.push([q, K.round2(pr)]); } return out.sort((a, b) => a[0] - b[0]).slice(0, 5); };
const seasonParse = v => { const set = new Set(); const MN = K.MONTHS.map(m => K.norm(m));
  for (const tok of String(v == null ? "" : v).replace(/\s*[-–]\s*/g, "-").split(/[,;\s]+/).filter(Boolean)) { const r = /^(\d{1,2})\s*-\s*(\d{1,2})$/.exec(tok);
    if (r) { let a = +r[1], b = +r[2]; for (let i = 0; i < 12 && a >= 1 && a <= 12 && b >= 1 && b <= 12; i++) { set.add(a); if (a === b) break; a = a % 12 + 1; } continue; }
    if (/^\d{1,2}$/.test(tok) && +tok >= 1 && +tok <= 12) { set.add(+tok); continue; }
    const n = K.norm(tok); let i = MN.indexOf(n); if (i < 0) i = MN.findIndex(m => n.startsWith(m) || (n.length >= 3 && m.startsWith(n))); if (i < 0) { const full = ["ιανουαρ", "φεβρουαρ", "μαρτ", "απριλ", "μαι", "ιουν", "ιουλ", "αυγουστ", "σεπτεμβρ", "οκτωβρ", "νοεμβρ", "δεκεμβρ"]; i = full.findIndex(f => n.startsWith(f)); } if (i >= 0) set.add(i + 1); }
  const a = [...set].sort((x, y) => x - y); return a.length && a.length < 12 ? a : null; };
const CCOLS = [["path", "Κατηγορία (υποκατηγορίες με >)", 34], ["emoji", "Εικονίδιο", 10], ["size", "Μέγεθος κουμπιού", 16]];
const yes = v => v ? "ΝΑΙ" : "ΟΧΙ";
const sizeName = z => (SIZES.find(x => x[0] === z) || SIZES[1])[1];
const SEP = " > ";

function catalogRows() {
  const st = S(), rows = [], crows = [];
  const walk = (L, trail) => {
    for (const n of L) {
      if (n.t === "c") { const t2 = trail.concat(n.name || "Χωρίς όνομα"); crows.push([t2.join(SEP), n.emoji || "", sizeName(n.size)]); walk(n.kids || [], t2); }
      else if (n.t === "p") { const p = st.products[n.pid]; if (!p || p.del) continue; rows.push(prodRow(p, trail, n)); }
    }
  };
  walk(st.menu, []);
  const inMenu = new Set(rows.map(r => r[r.length - 1]));
  for (const p of Object.values(st.products)) if (!p.del && !inMenu.has(p.id)) rows.push(prodRow(p, null, null));
  return { rows, crows };
}
function prodRow(p, trail, n) {
  const cat = trail ? trail[0] || "" : "", sub = trail ? trail.slice(1).join(SEP) : "";
  const av = K.avail(p, S().orders);
  return [trail ? cat : "(εκτός μενού)", sub, p.name, K.round2(+p.price || 0), p.unit || "", +p.step && +p.step !== 1 ? +p.step : "", +p.vat || 0, p.desc || "", yes(!p.soldout), yes(!!p.hidden || !!p.draft), yes(p.perish !== false), p.emoji || "", sizeName(n ? n.size : "m"), p.keys || "",
    p.code || "", +p.min > 0 ? +p.min : "", av === Infinity ? "" : Math.max(0, av), +p.whole > 0 ? +p.whole : "", tiersText(p.tiers), seasonText(p.season), p.id];
}
const EXAMPLES = [
  ["Αυγά", "", "Αυγά ελευθέρας βοσκής", 4.5, "δωδεκάδα", "", 13, "Φρέσκα, από κότες που βόσκουν ελεύθερες", "ΝΑΙ", "ΟΧΙ", "ΝΑΙ", "🥚", "Μεσαίο", "αυγουλάκια", "ΑΥΓ-12", "", 60, 3.8, "10: 4,20; 30: 4,00", "", ""],
  ["Αυγά", "", "Αυγά ελευθέρας βοσκής", 10, "θήκη 30", "", 13, "", "ΝΑΙ", "ΟΧΙ", "ΝΑΙ", "🥚", "Μεσαίο", "", "ΑΥΓ-30", "", "", "", "", "", ""],
  ["Αυγά", "Βιολογικά", "Αυγά βιολογικά", 0.45, "τεμ.", 6, 13, "Κάθε «+» προσθέτει 6 αυγά", "ΝΑΙ", "ΟΧΙ", "ΝΑΙ", "🥚", "Μικρό", "", "", 12, "", "", "", "", ""],
  ["Μέλι", "", "Μέλι θυμαρίσιο", 12, "βάζο", "", 13, "1 κιλό", "ΝΑΙ", "ΟΧΙ", "ΟΧΙ", "🍯", "Μεγάλο", "μελι", "", "", "", 10, "", "", ""],
  ["Μέλι", "", "Μέλι ελάτου", 14, "βάζο", "", 13, "1 κιλό", "ΝΑΙ", "ΟΧΙ", "ΟΧΙ", "🍯", "Μεσαίο", "", "", "", "", "", "", "Ιούν, Ιούλ, Αύγ, Σεπ", ""]
];
const HELP = [
  ["Πώς συμπληρώνεται ο κατάλογος"],
  [""],
  ["1. Στο φύλλο «Κατάλογος» κάθε γραμμή είναι ένα προϊόν. Η σειρά των γραμμών είναι η σειρά που θα το βλέπει ο πελάτης."],
  ["2. Υποχρεωτικά είναι μόνο το «Προϊόν» και η «Τιμή €». Όλα τα άλλα, αν μείνουν κενά, παίρνουν τις συνηθισμένες τιμές."],
  ["3. «Κατηγορία»: το κουμπί της αρχικής σελίδας (π.χ. Αυγά). Αν μείνει κενή, το προϊόν μπαίνει χύμα στην αρχική."],
  ["4. «Υποκατηγορία»: φάκελος μέσα στην κατηγορία (π.χ. Βιολογικά). Για πιο βαθιά επίπεδα γράψε με «>»: Βιολογικά > Μεγάλα."],
  ["5. «Τιμή €»: η τιμή για μία «Μονάδα». Γράψε 4,50 ή 4.50 ή 1.000 για χίλια."],
  ["6. «Μονάδα»: τεμ., κιλό, λίτρο, δωδεκάδα, θήκη 30, βάζο… ή ό,τι άλλο θέλεις."],
  ["7. «Βήμα»: πόσες μονάδες προσθέτει κάθε «+» του πελάτη. Κενό = 1. Π.χ. τιμή 0,45 ανά τεμ. και βήμα 6 → κάθε «+» 6 αυγά = 2,70 €."],
  ["8. «ΦΠΑ %»: 13, 24, 6 ή 0. Κενό = 13."],
  ["9. «Διαθέσιμο» ΝΑΙ/ΟΧΙ: με ΟΧΙ ο πελάτης το βλέπει «Εξαντλήθηκε». «Κρυφό» ΝΑΙ: δεν το βλέπει καθόλου."],
  ["10. «Ευπαθές» ΝΑΙ: τρόφιμο που αλλοιώνεται γρήγορα (δεν ισχύει δικαίωμα υπαναχώρησης)."],
  ["11. «Εικονίδιο»: ένα σύμβολο όπως 🥚 🍯 🫒 🍞. Οι φωτογραφίες μπαίνουν μετά από την εφαρμογή."],
  ["12. «Μέγεθος κουμπιού»: Μικρό (3 στη σειρά), Μεσαίο (2), Μεγάλο (όλο το πλάτος), Φαρδύ (όλο το πλάτος σε μία γραμμή)."],
  ["13. «Κωδικός προϊόντος»: δικός σου κωδικός (προαιρετικός), π.χ. ΑΥΓ-12."],
  ["14. «Ελάχιστη ποσότητα»: ο πελάτης δεν μπορεί να παραγγείλει λιγότερο."],
  ["15. «Απόθεμα»: πόσα έχεις τώρα. Αφαιρούνται μόνα τους με κάθε παραγγελία και όταν τελειώσουν ο πελάτης δεν μπορεί να το παραγγείλει. Κενό = δεν μετράς απόθεμα."],
  ["16. «Τιμή χονδρικής»: ισχύει για τους πελάτες που έχεις ορίσει «χονδρικής» (Πελάτες › πελάτης › Τιμές για αυτόν)."],
  ["17. «Έκπτωση ποσότητας»: γράψε «από ποσότητα: τιμή», χωρισμένα με ερωτηματικό. Π.χ. 10: 4,00; 50: 3,50."],
  ["18. «Εποχή»: οι μήνες που το έχεις, π.χ. «Ιούν, Ιούλ, Αύγ» ή «6-9». Τους άλλους μήνες ο πελάτης το βλέπει «Εκτός εποχής». Κενό = όλο τον χρόνο."],
  ["19. «Αναγνωριστικό εφαρμογής»: το γράφει η εφαρμογή όταν κατεβάζεις τον δικό σου κατάλογο. Μην το αλλάζεις: έτσι κρατιούνται φωτογραφίες και ιστορικό τιμών ακόμα κι αν αλλάξεις όνομα. Στα νέα προϊόντα άφησέ το κενό."],
  ["20. Στο φύλλο «Κατηγορίες» (προαιρετικό) δίνεις σειρά, εικονίδιο και μέγεθος στα κουμπιά των κατηγοριών."],
  [""],
  ["Οι γραμμές με τα παραδείγματα (κίτρινες) σβήσ' τες ή άλλαξέ τες με τα δικά σου."],
  ["Όταν τελειώσεις: Παραγγελίες › Κατάλογος › Προϊόντα και τιμές › 📊 Excel › Ανέβασμα."]
];
function buildBook(mine) {
  const head = COLS.map(c => c[1]), chead = CCOLS.map(c => c[1]);
  let rows, crows, ex = [];
  if (mine) { const r = catalogRows(); rows = r.rows; crows = r.crows; }
  else { rows = EXAMPLES; crows = [["Αυγά", "🥚", "Μεγάλο"], ["Αυγά > Βιολογικά", "🥚", "Μεσαίο"], ["Μέλι", "🍯", "Μεσαίο"]]; ex = rows.map((_, i) => i + 1); }
  const yn = ["ΝΑΙ", "ΟΧΙ"], sz = SIZES.map(x => x[1]);
  return writeXlsx([
    { name: "Κατάλογος", head: true, cols: COLS.map(c => c[2]), num: [3, 5, 6], ex, rows: [head, ...rows],
      valid: [{ col: 4, list: K.UNITS }, { col: 6, list: ["13", "24", "6", "0"] }, { col: 8, list: yn }, { col: 9, list: yn }, { col: 10, list: yn }, { col: 12, list: sz }] },
    { name: "Κατηγορίες", head: true, cols: CCOLS.map(c => c[2]), ex: mine ? [] : crows.map((_, i) => i + 1), rows: [chead, ...crows], valid: [{ col: 2, list: sz }] },
    { name: "Οδηγίες", title: true, wrap: true, cols: [120], rows: mine ? HELP.concat([[""], ["Εξαγωγή καταλόγου: " + new Date().toLocaleString("el-GR") + " · #" + Date.now() + " (μην το σβήσεις)"]]) : HELP }
  ]);
}
function saveBlob(name, blob) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
const GRL = { α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o" };
const latin = t => K.norm(t).replace(/[α-ω]/g, c => GRL[c] || "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const fileName = mine => (mine ? "katalogos-" + (latin(S().shop.name || "") || "mou") : "protypo-katalogou") + ".xlsx";

/* ---------- ανάγνωση αρχείου → σχέδιο εισαγωγής ---------- */
const hdrKey = h => { const n = K.norm(h).replace(/\*/g, "").trim(); if (!n) return "";
  if (/μην το|αναγνωρ/.test(n)) return "id"; if (n.includes("κωδικ")) return "code"; if (n.includes("χονδρ")) return "whole"; if (n.includes("εκπτωσ")) return "tiers"; if (n.includes("εποχ")) return "season"; if (n.includes("αποθεμ")) return "stock"; if (n.includes("ελαχιστ")) return "min";
  const M = [["υποκατηγ", "sub"], ["κατηγορ", "cat"], ["προιον", "name"], ["ονομα", "name"], ["τιμη", "price"], ["μοναδα", "unit"], ["βημα", "step"], ["φπα", "vat"], ["περιγραφ", "desc"], ["διαθεσιμ", "av"], ["κρυφ", "hid"], ["ευπαθ", "per"], ["εικονιδ", "emoji"], ["μεγεθ", "size"], ["λεξεις", "keys"]];
  for (const [k, v] of M) if (n.includes(k)) return v; return ""; };
const ynParse = (v, def) => { if (v === "" || v == null) return def; const n = K.norm(String(v)); if (/^(ναι|ν|yes|y|1|true|✓|x)$/.test(n) || v === 1 || v === true) return true; if (/^(οχι|ο|no|n|0|false)$/.test(n) || v === 0) return false; return def; };
const sizeParse = v => { const n = K.norm(String(v || "")); if (!n) return ""; if (/^(s|μικρ)/.test(n)) return "s"; if (/^(l|μεγαλ)/.test(n)) return "l"; if (/^(w|φαρδ)/.test(n)) return "w"; if (/^(m|μεσα)/.test(n)) return "m"; return ""; };
const numParse = v => typeof v === "number" ? v : K.parseNum(String(v || "").replace(/[€%]/g, ""));
const splitPath = s => String(s || "").split(/\s*[>›\/]\s*/).map(x => x.trim()).filter(Boolean);

function makePlan(sheets) {
  const main = sheets.find(s => /καταλογ/.test(K.norm(s.name))) || sheets[0];
  if (!main) throw new Error("Το αρχείο είναι άδειο.");
  const hi = main.rows.findIndex(r => r && r.some(c => hdrKey(c) === "name"));
  if (hi < 0) throw new Error("Δεν βρέθηκε στήλη «Προϊόν». Χρησιμοποίησε το πρότυπο της εφαρμογής.");
  const map = {}; main.rows[hi].forEach((h, i) => { const k = hdrKey(h); if (k && map[k] == null) map[k] = i; });
  if (map.price == null) throw new Error("Δεν βρέθηκε στήλη «Τιμή».");
  const g = (r, k) => map[k] == null ? "" : (r[map[k]] == null ? "" : r[map[k]]);
  const items = [], errs = [], warns = [];
  main.rows.slice(hi + 1).forEach((r, i) => {
    const line = hi + i + 2; if (!r || !r.some(c => String(c == null ? "" : c).trim())) return;
    const name = String(g(r, "name")).trim(), catS = String(g(r, "cat")).trim(), subS = String(g(r, "sub")).trim();
    const path = /^\(εκτος μενου\)$/.test(K.norm(catS)) ? null : splitPath(catS).concat(splitPath(subS));
    if (!name) { if (path && path.length) items.push({ line, onlyCat: true, path }); return; }
    const price = numParse(g(r, "price"));
    if (!isFinite(price) || price < 0) { errs.push(`Γραμμή ${line}: «${name}» χωρίς σωστή τιμή.`); return; }
    let step = numParse(g(r, "step")); if (!isFinite(step) || step <= 0) step = 1;
    let vat = numParse(g(r, "vat")); if (isFinite(vat) && vat > 0 && vat < 1) vat = Math.round(vat * 100); if (!isFinite(vat)) vat = 13;
    if (![0, 6, 13, 24].includes(vat)) { warns.push(`Γραμμή ${line}: ΦΠΑ ${vat}% δεν υπάρχει· μπήκε 13%.`); vat = 13; }
    const unit = String(g(r, "unit")).trim() || "τεμ.";
    items.push({ line, path, id: String(g(r, "id")).trim(), name: name.slice(0, 60), price: K.round2(price), unit: unit.slice(0, 20), step: Math.round(step * 1000) / 1000, vat,
      desc: String(g(r, "desc")).trim().slice(0, 80), av: ynParse(g(r, "av"), true), hid: ynParse(g(r, "hid"), false), per: ynParse(g(r, "per"), true),
      emoji: String(g(r, "emoji")).trim().slice(0, 4), size: sizeParse(g(r, "size")), keys: String(g(r, "keys")).trim().slice(0, 100),
      code: map.code != null ? String(g(r, "code")).trim().slice(0, 30) : undefined, min: map.min != null ? numParse(g(r, "min")) : undefined,
      stock: map.stock == null ? undefined : String(g(r, "stock")).trim() === "" ? null : numParse(g(r, "stock")), whole: map.whole != null ? numParse(g(r, "whole")) : undefined,
      tiers: map.tiers != null ? tiersParse(g(r, "tiers")) : undefined, season: map.season != null ? seasonParse(g(r, "season")) : undefined });
  });
  /* φύλλο κατηγοριών */
  const cats = [];
  const cs = sheets.find(s => s !== main && /κατηγορ/.test(K.norm(s.name)));
  if (cs) { const h = cs.rows.findIndex(r => r && r.some(c => /κατηγορ/.test(K.norm(c))));
    if (h >= 0) { const cm = {}; cs.rows[h].forEach((x, i) => { const n = K.norm(x); if (/κατηγορ/.test(n) && cm.path == null) cm.path = i; else if (/εικονιδ/.test(n)) cm.emoji = i; else if (/μεγεθ/.test(n)) cm.size = i; });
      cs.rows.slice(h + 1).forEach(r => { if (!r) return; const p = splitPath(r[cm.path]); if (p.length) cats.push({ path: p, emoji: cm.emoji != null ? String(r[cm.emoji] || "").trim().slice(0, 4) : "", size: cm.size != null ? sizeParse(r[cm.size]) : "" }); }); } }
  /* ταίριασμα με τα υπάρχοντα */
  const st = S(), live = Object.values(st.products).filter(p => !p.del);
  const byKey = {}; for (const p of live) byKey[K.norm(p.name) + "|" + K.norm(p.unit)] = byKey[K.norm(p.name) + "|" + K.norm(p.unit)] || p;
  const used = new Set(); let nNew = 0, nPrice = 0, nSame = 0;
  for (const it of items) { if (it.onlyCat) continue;
    let p = it.id && st.products[it.id] && !st.products[it.id].del ? st.products[it.id] : null;
    if (p && used.has(p.id)) p = null;
    if (!p) { const q = byKey[K.norm(it.name) + "|" + K.norm(it.unit)]; if (q && !used.has(q.id)) p = q; }
    if (p) { used.add(p.id); it.pid = p.id; if (Math.abs((+p.price || 0) - it.price) > 0.004) { nPrice++; it.oldPrice = +p.price || 0; } else nSame++; }
    else nNew++; }
  const prods = items.filter(x => !x.onlyCat);
  /* χρονική στιγμή εξαγωγής (για σωστό απόθεμα όταν ξαναανεβαίνει ο κατάλογός μου) */
  let expAt = 0; for (const sh of sheets) if (/οδηγι/.test(K.norm(sh.name))) for (const r of sh.rows) for (const c of r || []) { const m = /#(\d{13})\b/.exec(String(c == null ? "" : c)); if (m) expAt = +m[1]; }
  const willDraft = it => !(it.price > 0) || (it.pid && st.products[it.pid] && st.products[it.pid].draft && it.hid);
  const active = prods.filter(it => !willDraft(it)).length;
  const catSet = new Set(); for (const it of items) if (it.path) for (let i = 1; i <= it.path.length; i++) catSet.add(it.path.slice(0, i).map(K.norm).join(">")); for (const c of cats) for (let i = 1; i <= c.path.length; i++) catSet.add(c.path.slice(0, i).map(K.norm).join(">"));
  const missing = live.filter(p => !used.has(p.id));
  return { items, cats, errs, warns, expAt, active, drafts: prods.length - active, prods: prods.length, nNew, nPrice, nSame, nCats: catSet.size, missing, loose: prods.filter(x => x.path && !x.path.length).length, outMenu: prods.filter(x => !x.path).length };
}

function applyPlan(plan, delMissing) {
  const st = S(), now = Date.now();
  st.undoImport = { at: now, label: "Ανέβασμα από Excel", menu: JSON.parse(JSON.stringify(st.menu)), products: JSON.parse(JSON.stringify(st.products)) };
  /* παλιές ρυθμίσεις κουμπιών για να μη χαθούν */
  const oldNode = {}, oldCat = {};
  const w = (L, tr) => { for (const n of L) { if (n.t === "c") { const t2 = tr.concat(K.norm(n.name)); oldCat[t2.join(">")] = n; w(n.kids || [], t2); } else if (n.t === "p" && !oldNode[n.pid]) oldNode[n.pid] = n; } };
  w(st.menu, []);
  const menu = [], catIdx = {};
  const getCat = path => { let L = menu, key = [];
    for (const nm of path) { key.push(K.norm(nm)); const k = key.join(">");
      if (!catIdx[k]) { const o = oldCat[k] || {}; const c = { id: o.id || "n" + K.uid(5), t: "c", name: nm.slice(0, 40), emoji: o.emoji || "", size: o.size || "m", color: o.color || "", kids: [] }; if (o.photo) c.photo = o.photo; L.push(c); catIdx[k] = c; }
      L = catIdx[k].kids; }
    return L; };
  for (const it of plan.items) {
    if (it.onlyCat) { getCat(it.path); continue; }
    let p = it.pid ? st.products[it.pid] : null;
    if (!p) { const id = "p" + K.uid(5); p = st.products[id] = { id, hist: [], created: now }; it.pid = id; }
    if (!p.hist) p.hist = [];
    if (!p.hist.length || Math.abs(p.hist[p.hist.length - 1][1] - it.price) > 0.004) p.hist.push([now, it.price]);
    Object.assign(p, { name: it.name, unit: it.unit, price: it.price, step: it.step, vat: it.vat, desc: it.desc, soldout: !it.av, hidden: it.hid, perish: it.per, keys: it.keys });
    if (it.emoji) p.emoji = it.emoji;
    const wasDraft = !!p.draft;
    delete p.hidBySo; delete p.del; delete p.draft;
    if (!(it.price > 0) || (wasDraft && it.hid)) { p.draft = true; if (wasDraft && it.hid) p.hidden = false; }
    if (it.code !== undefined) { if (it.code) p.code = it.code; else delete p.code; }
    if (it.min !== undefined) { if (isFinite(it.min) && it.min > 0) p.min = it.min; else delete p.min; }
    if (it.whole !== undefined) { if (isFinite(it.whole) && it.whole > 0) p.whole = K.round2(it.whole); else delete p.whole; }
    if (it.tiers !== undefined) { if (it.tiers.length) p.tiers = it.tiers; else delete p.tiers; }
    if (it.season !== undefined) { if (it.season) p.season = it.season; else delete p.season; }
    if (it.stock !== undefined) { if (it.stock === null || !isFinite(it.stock) || it.stock < 0) { delete p.stock; delete p.stockAt; }
      else { let ref = K.avail(p, st.orders);
        if (plan.expAt && p.stock != null && p.stock !== "" && (p.stockAt || 0) <= plan.expAt) ref = Math.round((+p.stock - (K.reserved(p.id, st.orders, p.stockAt) - K.reserved(p.id, st.orders, plan.expAt))) * 1000) / 1000;
        if (ref === Infinity || Math.abs(ref - it.stock) > 1e-9) { p.stock = Math.round(it.stock * 1000) / 1000; p.stockAt = now; } } }
    if (!it.path) continue;
    const L = it.path.length ? getCat(it.path) : menu;
    const o = oldNode[p.id] || {};
    if (!L.some(n => n.t === "p" && n.pid === p.id)) L.push({ id: o.id && !Object.values(catIdx).some(c => c.id === o.id) ? o.id : "n" + K.uid(5), t: "p", pid: p.id, size: it.size || o.size || "m", color: o.color || "", ...(o.name ? { name: o.name } : {}) });
  }
  /* φύλλο «Κατηγορίες»: εικονίδιο, μέγεθος και σειρά των κατηγοριών (τα προϊόντα μένουν στη σειρά των γραμμών) */
  const order = {};
  plan.cats.forEach((c, i) => { getCat(c.path); const k = c.path.map(K.norm).join(">"), n = catIdx[k]; if (c.emoji) n.emoji = c.emoji; if (c.size) n.size = c.size; if (order[k] == null) order[k] = i; });
  if (plan.cats.length) { const keyOf = new Map(Object.entries(catIdx).map(([k, n]) => [n, k]));
    const sortL = L => { const pos = [], cs = []; L.forEach((n, i) => { if (n.t === "c") { pos.push(i); cs.push(n); } });
      cs.map((n, i) => [n, order[keyOf.get(n)] != null ? order[keyOf.get(n)] : 1e6 + i]).sort((a, b) => a[1] - b[1]).forEach(([n], j) => { L[pos[j]] = n; });
      for (const n of L) if (n.t === "c") sortL(n.kids); };
    sortL(menu); }
  if (delMissing) for (const p of plan.missing) delete st.products[p.id];
  /* ίδια ταυτότητα κόμβου μόνο μία φορά */
  const seen = new Set(); const fix = L => { for (const n of L) { if (seen.has(n.id)) n.id = "n" + K.uid(5); seen.add(n.id); if (n.kids) fix(n.kids); } }; fix(menu);
  st.menu.splice(0, st.menu.length, ...menu);
  A.save({ catalog: true });
}

/* ---------- οθόνες ---------- */
function mainSheet() {
  const st = S(), has = Object.values(st.products).some(p => !p.del), u = st.undoImport;
  A.sheet("📊 Κατάλογος με Excel", `
   <div class="card"><p class="note" style="margin-top:0">Γράψε όλο τον κατάλογο σε Excel (στο κινητό ή στον υπολογιστή): κατηγορίες, υποκατηγορίες, προϊόντα, τιμές, μονάδες, βήμα, ΦΠΑ, διαθεσιμότητα, εικονίδια, μέγεθος κουμπιών και σειρά. Μετά το ανεβάζεις εδώ και στήνεται μόνο του. Τις φωτογραφίες τις βάζεις μετά από την εφαρμογή.</p>
    <div class="step"><div class="n">1</div><div class="t"><b>Κατέβασε το αρχείο</b><div class="row" style="margin-top:6px"><button type="button" class="btn sm amber grow" data-xl="tpl">⬇️ Κενό πρότυπο με παραδείγματα</button>${has ? `<button type="button" class="btn sm soft grow" data-xl="mine">⬇️ Ο κατάλογός μου</button>` : ""}</div>${has ? `<p class="note" style="margin:6px 0 0">«Ο κατάλογός μου» έχει ήδη μέσα όλα σου τα προϊόντα: αλλάζεις μόνο ό,τι θέλεις.</p>` : ""}</div></div>
    <div class="step"><div class="n">2</div><div class="t"><b>Συμπλήρωσέ το</b><p class="note" style="margin:2px 0 0">Με Excel, Φύλλα Google ή όποια εφαρμογή λογιστικών φύλλων έχεις. Μία γραμμή για κάθε προϊόν· η σειρά των γραμμών είναι η σειρά στο μενού. Οδηγίες υπάρχουν μέσα στο αρχείο, στο φύλλο «Οδηγίες».</p></div></div>
    <div class="step"><div class="n">3</div><div class="t"><b>Ανέβασέ το</b><div style="margin-top:6px"><label class="btn sm amber">⬆️ Επιλογή αρχείου<input type="file" id="xlIn" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" hidden></label></div><p class="note" style="margin:6px 0 0">Πριν αλλάξει οτιδήποτε, θα δεις τι θα γίνει και θα επιβεβαιώσεις.</p></div></div></div>
   ${u ? `<div class="card"><p class="note" style="margin:0 0 6px">Τελευταίο ανέβασμα: ${new Date(u.at).toLocaleString("el-GR")}</p><button type="button" class="btn sm soft" data-xl="undo">↩️ Αναίρεση τελευταίου ανεβάσματος</button></div>` : ""}`, "",
   el => { el.querySelector("#xlIn").addEventListener("change", e => { const f = e.target.files[0]; if (f) loadFile(f); }); });
}
async function loadFile(f) {
  let sheets;
  try { sheets = /\.csv$/i.test(f.name) || /csv|text/.test(f.type) ? readCsv(await f.text()) : await readXlsx(await f.arrayBuffer()); }
  catch (e) { A.toast("Το αρχείο δεν άνοιξε. Αποθήκευσέ το ως .xlsx και ξαναδοκίμασε.", 4500); return; }
  let plan; try { plan = makePlan(sheets); } catch (e) { A.toast(e.message || "Λάθος αρχείο.", 4500); return; }
  A._xlPlan = plan; previewSheet(plan);
}
function previewSheet(plan) {
  const over = !A.isPro() && plan.active > A.FREE_PRODUCTS;
  const ch = plan.items.filter(x => x.oldPrice != null).slice(0, 12);
  A.sheet("📊 Τι θα γίνει", `
   <div class="card"><div class="okbox" style="margin-top:0">Βρέθηκαν <b>${plan.prods}</b> προϊόντα σε <b>${plan.nCats}</b> κατηγορίες.</div>
    <div class="note">✨ Νέα προϊόντα: <b>${plan.nNew}</b></div>
    <div class="note">💶 Αλλαγή τιμής: <b>${plan.nPrice}</b></div>
    <div class="note">✓ Ίδια τιμή: <b>${plan.nSame}</b></div>
    ${plan.drafts ? `<div class="note">📝 Ενδεικτικά (χωρίς τιμή ή κρυφά ενδεικτικά, δεν τα βλέπουν οι πελάτες): <b>${plan.drafts}</b></div>` : ""}
    ${plan.loose ? `<div class="note">⚠️ Χωρίς κατηγορία (μπαίνουν χύμα στην αρχική): <b>${plan.loose}</b></div>` : ""}
    ${plan.outMenu ? `<div class="note">Εκτός μενού: <b>${plan.outMenu}</b></div>` : ""}
    ${ch.length ? `<details style="margin-top:6px"><summary class="note" style="cursor:pointer">Δες τις αλλαγές τιμών</summary>${ch.map(x => `<div class="note">${esc(x.name)} (${esc(x.unit)}): ${K.money(x.oldPrice)} → <b>${K.money(x.price)}</b></div>`).join("")}${plan.nPrice > ch.length ? `<div class="note">…και άλλες ${plan.nPrice - ch.length}</div>` : ""}</details>` : ""}</div>
   ${plan.errs.length ? `<div class="errbox">${plan.errs.length} γραμμές δεν θα μπουν:<br>${plan.errs.slice(0, 8).map(esc).join("<br>")}${plan.errs.length > 8 ? "<br>…" : ""}</div>` : ""}
   ${plan.warns.length ? `<div class="warnbox">${plan.warns.slice(0, 6).map(esc).join("<br>")}</div>` : ""}
   ${plan.missing.length ? `<div class="card"><p class="note" style="margin-top:0">${plan.missing.length} προϊόντα σου δεν υπάρχουν στο αρχείο (π.χ. ${plan.missing.slice(0, 3).map(p => "«" + esc(p.name) + "»").join(", ")}).</p><label class="ck"><input type="checkbox" id="xlDel"><span>Να διαγραφούν από τον κατάλογο</span></label><p class="note" style="margin-bottom:0">Αλλιώς μένουν στα «Προϊόντα και τιμές» ως «Δεν είναι στο μενού».</p></div>` : ""}
   <p class="note">Το μενού του πελάτη θα στηθεί όπως στο αρχείο. Φωτογραφίες, χρώματα κουμπιών και ιστορικό τιμών των ίδιων προϊόντων κρατιούνται. Αν κάτι δεν σου αρέσει, υπάρχει «Αναίρεση».</p>
   ${over ? `<div class="warnbox">Η δωρεάν έκδοση έχει έως ${A.FREE_PRODUCTS} προϊόντα. Για ${plan.active} ενεργά χρειάζεται η πλήρης έκδοση.</div>` : ""}`,
   `<button type="button" class="btn soft" data-act="shClose">Άκυρο</button><button type="button" class="btn amber" data-xl="go"${plan.prods || plan.nCats ? "" : " disabled"}>✓ Εισαγωγή</button>`);
}
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-xl]"); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const k = b.dataset.xl;
  if (k === "open") return mainSheet();
  if (k === "tpl") { saveBlob(fileName(false), buildBook(false)); A.toast("⬇️ Κατέβηκε το πρότυπο. Άνοιξέ το από τις Λήψεις.", 3500); return; }
  if (k === "mine") { saveBlob(fileName(true), buildBook(true)); A.toast("⬇️ Κατέβηκε ο κατάλογός σου σε Excel.", 3500); return; }
  if (k === "go") {
    const plan = A._xlPlan; if (!plan) return;
    if (!A.isPro() && plan.active > A.FREE_PRODUCTS) { A.proGate("products"); return; }
    applyPlan(plan, !!($("#xlDel") && $("#xlDel").checked)); A._xlPlan = null;
    A.closeSheet(); A.render(); A.toast(`✓ Μπήκαν ${plan.prods} προϊόντα σε ${plan.nCats} κατηγορίες. Πρόσθεσε φωτογραφίες όπου θέλεις.`, 4500); return;
  }
  if (k === "undo") {
    const st = S(), u = st.undoImport; if (!u) return;
    if (!confirm("Να γυρίσει ο κατάλογος όπως ήταν πριν την αλλαγή της " + new Date(u.at).toLocaleString("el-GR") + ";")) return;
    st.menu.splice(0, st.menu.length, ...u.menu); st.products = u.products; delete st.undoImport;
    A.save({ catalog: true }); A.closeSheet(); A.render(); A.toast("↩️ Ο κατάλογος γύρισε όπως ήταν."); return;
  }
}, true);
window.GExcel = { mainSheet, makePlan, applyPlan, buildBook, catalogRows };
})();
