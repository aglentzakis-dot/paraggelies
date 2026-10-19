/*
  Παραγγελίες — σελίδα πελάτη
  © 2026 Ανδρέας Μ. Γλεντζάκης (Andreas M. Glentzakis). Με την επιφύλαξη παντός δικαιώματος. All rights reserved.
*/
(function(){
"use strict";
const K=window.Kat,$=s=>document.querySelector(s),esc=K.esc;
const APP_URL=new URL("./",location.href).href;
const INFRAME=(()=>{try{return window.top!==window}catch{return true}})();
/* ο πωλητής περνά χειροκίνητη παραγγελία μέσα από τον κατάλογο (ανοίγει από την εφαρμογή του) */
const SELM=INFRAME&&new URLSearchParams(location.hash.slice(1)).get("m")==="1";
let C0=null,C=null,P=null,M=null,GR={},copt={},cart={},view=[],stage="shop",lastSent=null,sending=false,orderId=null,deferredPrompt=null;
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
let SK="";
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e});

function bad(msg){$("#app").innerHTML=`<div class="bad"><div style="font-size:48px">🔗</div><h2>Ο σύνδεσμος δεν άνοιξε</h2><p>${esc(msg)}</p><p class="note">Ζήτησε από τον πωλητή να σου στείλει ξανά τον σύνδεσμο παραγγελίας.</p></div>`}

async function load(){
  /* ο κατάλογος έρχεται μετά το # (κανονικός σύνδεσμος) ή μετά το ? (σύντομος σύνδεσμος, που δεν τον κόβει κανείς συντομευτής) */
  const h0=new URLSearchParams(location.hash.slice(1)),h=h0.get("k")||h0.get("t")?h0:new URLSearchParams(location.search.slice(1));
  if(h.get("t")){const x=(h.get("x")||""),n=+h.get("n")||0,ok=x.length===n;
    $("#app").innerHTML=`<div class="bad"><div style="font-size:48px">${ok?"✅":"✂️"}</div><h2>Δοκιμή ${esc(h.get("t"))}: ${ok?"έφτασε ολόκληρος":"κόπηκε"}</h2><p style="font-size:20px"><b>${x.length}</b> από <b>${n}</b> χαρακτήρες</p><p class="note">Συνολικό μήκος διεύθυνσης: ${location.href.length}<br>Περιηγητής: ${esc(navigator.userAgent.slice(0,140))}</p><p class="note" style="word-break:break-all">Τέλος: …${esc(x.slice(-24))}</p></div>`;return}
  let k=h.get("k"),SJ=null;
  /* σύντομος σύνδεσμος: «#s=» + κωδικός 7 γραμμάτων + 6 χαρακτήρες από το κλειδί του πωλητή */
  const sv=h0.get("s");
  if(!k&&sv&&/^[a-z0-9]{7}/.test(sv)){const id=sv.slice(0,7),fp=sv.slice(7);
    $("#app").innerHTML=`<div class="bad"><div style="font-size:42px">⏳</div><h2>Ανοίγει ο κατάλογος…</h2></div>`;
    let j=null;if(K.SHORT){try{j=await K.shortGet(id)}catch{}}
    if(!j||!j.pk){const c=store.get("ps:"+id,null);if(c&&c.pk)j=c;else{bad(j&&j.miss?"Ο κατάλογος δεν βρέθηκε. Ίσως ο σύνδεσμος γράφτηκε λάθος.":"Ο κατάλογος δεν άνοιξε: χρειάζεται σύνδεση στο διαδίκτυο την πρώτη φορά. Δοκίμασε ξανά σε λίγο.");return}}
    if((fp&&String(j.sp).slice(2,8)!==fp)||!(await K.liveVerify(j.sp,j.pk,j.g))){bad("Ο σύνδεσμος δεν είναι έγκυρος.");return}
    store.set("ps:"+id,{pk:j.pk,g:j.g,sp:j.sp,ts:j.ts});k=j.pk;SJ=j}
  if(!k){bad("Λείπει ο κατάλογος από τον σύνδεσμο.");return}
  const want=SJ?0:+h.get("n")||0,got=K.cleanB64(k).length;
  if(!SJ&&!want&&got<400){bad("Ο σύνδεσμος κόπηκε στη μεταφορά (έφτασαν μόνο "+got+" χαρακτήρες). Ζήτησε από τον πωλητή να σου στείλει νέο σύνδεσμο από την εφαρμογή του.");return}
  if(want&&got<want){bad("Ο σύνδεσμος κόπηκε στη μεταφορά: έφτασαν "+got+" από "+want+" χαρακτήρες. Ζήτησε από τον πωλητή να τον στείλει με το κουμπί «Αντιγραφή» ή να βγάλει το λογότυπο από τον σύνδεσμο.");return}
  try{C=await K.unpack(k)}catch(e){bad("Ο σύνδεσμος δεν διαβάστηκε σε αυτόν τον περιηγητή. Δοκίμασε: τρεις τελείες ⋮ πάνω δεξιά → «Άνοιγμα σε Chrome». (Τεχνική ένδειξη: "+esc(String(e&&e.message||e))+", "+got+(want?"/"+want:"")+")");return}
  if(!C||C.v!==1||!C.k||!C.t||!C.s||!C.s.n||(SJ&&C.g!==SJ.sp)){bad("Ο σύνδεσμος δεν είναι έγκυρος.");return}
  /* υπογραφή: ο μακρύς σύνδεσμος (#k=) ελέγχεται με το κλειδί υπογραφής του πωλητή, όπως ο σύντομος.
     Το κλειδί «καρφώνεται» στο κινητό του πελάτη: αλλαγμένος ή χωρίς υπογραφή σύνδεσμος του ίδιου πωλητή δεν ανοίγει. */
  {const pin=store.get("pin:"+C.k.slice(0,16),"");const sg=SJ?SJ.g:h.get("g");
   if(!SJ&&sg){if(!C.g||!((await K.liveVerify(C.g,k,sg))||(await K.liveVerify(C.g,K.cleanB64(k),sg)))){bad("Ο σύνδεσμος έχει αλλοιωθεί στη μεταφορά (η υπογραφή του πωλητή δεν ταιριάζει).");return}}
   if(pin&&(!sg||C.g!==pin)){bad(sg?"Ο σύνδεσμος υπογράφεται με άλλο κλειδί από αυτό που ξέρει το κινητό σου για αυτό το κατάστημα.":"Ο σύνδεσμος δεν έχει την υπογραφή του πωλητή. Άνοιξε τον πιο πρόσφατο σύνδεσμο που σου έστειλε.");return}
   if(sg&&C.g&&!pin)store.set("pin:"+C.k.slice(0,16),C.g)}
  C0=C;SK=(SELM?"parm:":"par:")+C.k.slice(0,16);if(SELM){store.set(SK+":cart",{});store.set(SK+":copt",{})}
  /* ο πιο πρόσφατος κατάλογος που είχε έρθει ζωντανά από τον πωλητή (αν είναι νεότερος από τον σύνδεσμο) */
  try{const L=store.get(SK+":live",null);if(L&&L.ts>C.ts&&L.pk&&L.g){const X=await K.verifyPacked(C0,L.pk,L.g);if(X&&X.ts===L.ts&&X.k===C0.k&&X.t===C0.t)C=mergeLive(X)}}catch{}
  const ex=K.expandCatalog(C);P=ex.products;M=ex.menu;GR=ex.groups||{};
  cart=store.get(SK+":cart",{});copt=store.get(SK+":copt",{});cartClean();
  brand();if(!INFRAME){history.replaceState(null,"");history.pushState({v:[],s:"shop"},"")}render();
  liveAll();
  if(SELM){const pid=h0.get("p");if(pid&&P[pid]&&hasOpts(P[pid])&&!P[pid].soldout)setTimeout(()=>optSheet(P[pid]),60)}
  if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
}

/* ---------- ζωντανός κατάλογος: κάθε αλλαγή του πωλητή φτάνει χωρίς νέο σύνδεσμο ---------- */
function mergeLive(L){
  L=JSON.parse(JSON.stringify(L));L.c=C0.c;L.u=L.u||C0.u;
  if(!L.s.lg&&C0.s.lg)L.s.lg=C0.s.lg;
  for(const[id,o]of Object.entries(L.p||{})){const a=(C0.p||{})[id];if(a&&a.f&&!o.f)o.f=a.f}
  const catPh={};(function w(ns){for(const n of ns||[]){if(n.k){if(n.f)catPh[n.i]=n.f;w(n.k)}}})(C0.m);
  (function w(ns){for(const n of ns||[]){if(n.k){if(!n.f&&catPh[n.i])n.f=catPh[n.i];w(n.k)}}})(L.m);
  if(C0.c){
    const pp=C0.c.pp||{};for(const[id,r]of Object.entries(pp))if(L.p[id]){L.p[id].r=r;const t0=(C0.p[id]||{}).tq;if(t0)L.p[id].tq=t0;else delete L.p[id].tq}
    const parentOf={};(function w(ns,par){for(const n of ns||[]){if(n.k)w(n.k,n.i);else if(n.p)parentOf[n.p]={node:n,par}}})(C0.m,null);
    const catById={};(function w(ns){for(const n of ns||[]){if(n.k){catById[n.i]=n;w(n.k)}}})(L.m);
    if(C0.og)L.og=Object.assign({},C0.og,L.og||{});
    for(const[id,o]of Object.entries(C0.p||{}))if(o.xo&&!L.p[id]){L.p[id]=o;const x=parentOf[id];if(x){(x.par&&catById[x.par]?catById[x.par].k:L.m).push(x.node)}}
  }
  return L;
}
async function liveCatalog(){
  let r=null;try{r=await K.catalogFetch(C0,C.ts)}catch{}
  if(!r)return false;
  store.set(SK+":live",{ts:r.C.ts,pk:r.pk,g:r.g});
  C=mergeLive(r.C);const ex=K.expandCatalog(C);P=ex.products;M=ex.menu;GR=ex.groups||{};liveTs=0;
  if(OS&&(!P[OS.pid]||!hasOpts(P[OS.pid]))){OS=null;closeModal()}
  cartClean();
  const ok=ids=>{let L=M;for(const id of ids){const n=L.find(x=>x.id===id&&x.t==="c");if(!n)return false;L=n.kids}return true};
  if(!ok(view))view=[];
  brand();if(stage==="shop"||stage==="check")keepInputs(render);
  return true;
}
async function liveAll(){await liveCatalog();await liveUpdate()}

/* ---------- ζωντανή διαθεσιμότητα από τον πωλητή ---------- */
let liveTs=0;
async function liveUpdate(){
  let d=null;try{d=await K.liveFetch(C)}catch{}
  if(!d||d.ts<=liveTs)return;liveTs=d.ts;
  let gone=0;
  const act=new Set(d.r?Object.keys(d.r):(d.a||[]));
  for(const p of Object.values(P)){const e=d.s&&d.s[p.id],off=!act.has(p.id);
    p.soldout=off||!!(e&&e[0]);p.oos=!off&&!!(e&&e[0]===2);p.max=!off&&e&&e[0]===0&&e[1]!=null?+e[1]:null;
    if(d.r&&!C.c&&d.r[p.id]!=null)p.price=+d.r[p.id];
    const q=qty(p.id);if(q&&(p.soldout||(p.max!=null&&q>p.max))){gone++;
      if(p.soldout){for(const k of keysOf(p.id)){delete cart[k];delete copt[k]}}
      else{let left=p.max;for(const k of keysOf(p.id)){const st=p.step||1,v=Math.min(cart[k],Math.floor(Math.max(0,left)/st+1e-9)*st);if(v>0&&!(p.min>0&&v<p.min)){cart[k]=Math.round(v*1000)/1000;left-=cart[k]}else{delete cart[k];delete copt[k]}}}
      store.set(SK+":cart",cart);store.set(SK+":copt",copt)}}
  if(stage==="shop"||stage==="check")keepInputs(render);
  if(gone)toastMsg("Ενημερώθηκε η διαθεσιμότητα· άλλαξαν "+gone+" είδη στο καλάθι σου.");
}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&C)liveAll()});

/* ---------- στοιχεία πωλητή: χρώματα, λογότυπο, όνομα στην αρχική οθόνη ---------- */
function brand(){
  const s=C.s,r=document.documentElement.style;
  const c1=/^#[0-9a-f]{6}$/i.test(s.c1)?s.c1:"#17324D",c2=/^#[0-9a-f]{6}$/i.test(s.c2)?s.c2:"#F2B632";
  r.setProperty("--c1",c1);r.setProperty("--c2",c2);r.setProperty("--on1",K.contrast(c1));r.setProperty("--on2",K.contrast(c2));
  $("#themeColor").content=c1;
  document.title=s.n;
  let ttl=document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if(!ttl){ttl=document.createElement("meta");ttl.name="apple-mobile-web-app-title";document.head.appendChild(ttl)}
  ttl.content=s.n;
  makeIcons(s.lg,c1,s.n).then(ic=>{
    $("#fav").href=ic[192];$("#fav2").href=ic[180];
    /* δυναμικό αρχείο εφαρμογής με το όνομα και το εικονίδιο του πωλητή — πρέπει να δοκιμαστεί σε Android */
    const man={name:s.n,short_name:s.n.length>14?s.n.slice(0,14):s.n,id:"p-"+C.k.slice(0,20),start_url:location.href,scope:APP_URL,display:"standalone",background_color:"#F3F4F1",theme_color:c1,lang:"el",
      icons:[{src:ic[192],sizes:"192x192",type:"image/png"},{src:ic[512],sizes:"512x512",type:"image/png"},{src:ic[512],sizes:"512x512",type:"image/png",purpose:"maskable"}]};
    let l=document.querySelector('link[rel="manifest"]');
    if(!l){l=document.createElement("link");l.rel="manifest";document.head.appendChild(l)}
    l.href="data:application/manifest+json;charset=utf-8,"+encodeURIComponent(JSON.stringify(man));
  }).catch(()=>{});
}
function makeIcons(logo,c1,name){
  return new Promise(res=>{
    const draw=img=>{const out={};for(const n of[180,192,512]){const c=document.createElement("canvas");c.width=c.height=n;const x=c.getContext("2d");
      x.fillStyle=c1;x.fillRect(0,0,n,n);
      if(img){const pad=n*.14,s=n-2*pad;x.save();x.beginPath();const rr=n*.16;x.roundRect?x.roundRect(pad,pad,s,s,rr):x.rect(pad,pad,s,s);x.clip();x.fillStyle="#fff";x.fillRect(pad,pad,s,s);x.drawImage(img,pad,pad,s,s);x.restore()}
      else{x.fillStyle=K.contrast(c1);x.font=`800 ${n*.46}px system-ui,sans-serif`;x.textAlign="center";x.textBaseline="middle";x.fillText((name||"?").trim().charAt(0).toUpperCase(),n/2,n/2+n*.03)}
      out[n]=c.toDataURL("image/png")}res(out)};
    if(logo){const i=new Image();i.onload=()=>draw(i);i.onerror=()=>draw(null);i.src=logo}else draw(null)});
}

/* ---------- καλάθι ---------- */
/* κάθε γραμμή του καλαθιού έχει κλειδί: σκέτο το προϊόν, ή «προϊόν~επιλογές» όταν ο πελάτης διάλεξε ζάχαρη, γάλα, ψήσιμο κ.λπ. */
const pidOf=k=>String(k).split("~")[0];
const hasOpts=p=>!!p&&((p.mods||[]).some(g=>GR[g])||p.nt);
function cartClean(){for(const k of Object.keys(cart)){const p=P[pidOf(k)];if(!p||p.soldout){delete cart[k];delete copt[k]}}for(const k of Object.keys(copt))if(!cart[k])delete copt[k];
  /* οι επιλογές ξαναϋπολογίζονται με τον τρέχοντα κατάλογο (αν άλλαξε η επιπλέον τιμή) */
  for(const[k,c]of Object.entries(copt)){const p=P[pidOf(k)];if(!p)continue;const r=K.optCheck(p.mods,GR,c.o,c.n,p.nt);c.x=r.x;c.t=r.text}store.set(SK+":cart",cart);store.set(SK+":copt",copt)}
const lineUnit=(k,q)=>{const p=P[pidOf(k)];return K.round2(K.unitPrice(p,q)+((copt[k]||{}).x||0))};
const qty=id=>{let s=0;for(const[k,q]of Object.entries(cart))if(pidOf(k)===id)s+=q;return Math.round(s*1000)/1000};
const keysOf=id=>Object.keys(cart).filter(k=>pidOf(k)===id);
function setQ(id,q,dir){const p=P[pidOf(id)];if(!p)return;q=Math.max(0,Math.min(K.MAX_QTY,Math.round(q*1000)/1000));
  const st=p.step||1;
  if(p.min>0&&q>0&&q<p.min){if(dir>0){q=Math.ceil(p.min/st-1e-9)*st;q=Math.round(q*1000)/1000}else q=0}
  {const others=Math.round((qty(p.id)-(cart[id]||0))*1000)/1000,room=p.max!=null?Math.max(0,p.max-others):null;
  if(room!=null&&q>room){q=Math.floor(room/st+1e-9)*st;q=Math.round(q*1000)/1000;if(p.min>0&&q<p.min)q=0;toastMsg(q>0?"Από το «"+p.name+"» έμειναν μόνο "+K.num(p.max)+" ("+p.unit+").":"😔 Το «"+p.name+"» δεν φτάνει για την ελάχιστη ποσότητα ή τελείωσε.")}}
  if(q<=0){delete cart[id];delete copt[id]}else cart[id]=q;store.set(SK+":cart",cart);store.set(SK+":copt",copt)}
function totals(){let n=0,t=0;for(const[k,q]of Object.entries(cart)){const p=P[pidOf(k)];if(!p)continue;n++;t+=K.round2(q*lineUnit(k,q))}return{n,t:K.round2(t)}}
/* παράθυρο επιλογών: πατάς το προϊόν και διαλέγεις πώς το θέλεις */
let OS=null;
function optSheet(p){
  const gs=(p.mods||[]).map(g=>GR[g]).filter(Boolean);
  OS={pid:p.id,sel:{},q:p.min>0?Math.ceil(p.min/(p.step||1)-1e-9)*(p.step||1):(p.step||1)};
  for(const g of gs){OS.sel[g.id]=g.o.map((o,i)=>o.def&&!o.off?i:-1).filter(i=>i>=0);if(g.mx>0&&OS.sel[g.id].length>g.mx)OS.sel[g.id].length=g.mx}
  openModal(`<div class="optsh"><h3>${p.emoji&&!/^data:/.test(p.emoji)?esc(p.emoji)+" ":""}${esc(p.name)}</h3><p class="note" style="margin:0 0 6px">${K.money(p.price)} / ${esc(p.unit)}</p>
   ${gs.map(g=>`<div class="og" data-g="${esc(g.id)}"><div class="ogh"><b>${esc(g.n)}${g.mn>0?` <span class="oreq">υποχρεωτικό</span>`:""}</b><small>${esc(K.modRule(g).replace(/^Υποχρεωτικό · |^Προαιρετικό · /,""))}</small></div><div class="chips">${g.o.map((o,i)=>`<button type="button" class="chip${o.off?" off":""}" data-oo="${esc(g.id)}|${i}"${o.off?" disabled":""}>${esc(o.n)}${o.p?` <small>+${K.money(o.p)}</small>`:""}${o.off?` <small>(δεν υπάρχει)</small>`:""}</button>`).join("")}</div></div>`).join("")}
   ${p.nt?`<label class="f" for="onote">📝 Σχόλιο (προαιρετικά)</label><input class="t" id="onote" maxlength="120" placeholder="${esc(p.ntp||"π.χ. καλοψημένη, χωρίς κρεμμύδι")}">`:""}
   <div class="oqty"><span>Ποσότητα</span><div class="qty"><button type="button" class="qb" data-oq="-1">−</button><span class="qv" id="oqv"></span><button type="button" class="qb plus" data-oq="1">+</button></div></div>
   <p class="err" id="oerr"></p>
   <div class="row" style="display:flex;gap:8px"><button type="button" class="btn ghost" data-act="close" style="flex:0 0 auto">Άκυρο</button><button type="button" class="btn alt" data-act="oadd" id="oadd" style="flex:1"></button></div></div>`);
  optPaint();
}
function optCalc(){const p=P[OS.pid];const r=K.optCheck(p.mods,GR,OS.sel,"",false);return{unit:K.round2(K.unitPrice(p,OS.q)+r.x),r}}
function optPaint(){if(!OS)return;const p=P[OS.pid];
  document.querySelectorAll("[data-oo]").forEach(b=>{const[g,i]=b.dataset.oo.split("|");b.classList.toggle("on",(OS.sel[g]||[]).includes(+i))});
  const v=$("#oqv");if(v)v.textContent=K.num(OS.q)+" "+p.unit;
  const c=optCalc(),ad=$("#oadd"),miss=(p.mods||[]).map(g=>GR[g]).filter(g=>g&&(OS.sel[g.id]||[]).length<(g.mn||0));if(ad){ad.textContent=miss.length?"Διάλεξε: "+miss.map(g=>g.n).join(", "):"Προσθήκη · "+K.money(K.round2(OS.q*c.unit));ad.classList.toggle("wait",!!miss.length)}}
function optAdd(){const p=P[OS.pid];
  const miss=(p.mods||[]).map(g=>GR[g]).filter(g=>g&&(OS.sel[g.id]||[]).length<(g.mn||0));
  document.querySelectorAll(".og.miss").forEach(x=>x.classList.remove("miss"));
  if(miss.length){$("#oerr").textContent="👆 Διάλεξε πώς το θέλεις: "+miss.map(g=>g.n).join(", ")+".";miss.forEach(g=>{const el=document.querySelector(`.og[data-g="${CSS.escape(g.id)}"]`);if(el)el.classList.add("miss")});const f=document.querySelector(`.og[data-g="${CSS.escape(miss[0].id)}"]`);if(f)f.scrollIntoView({behavior:"smooth",block:"center"});return}
  const note=$("#onote")?$("#onote").value.trim().slice(0,120):"";
  const o={};for(const[g,L]of Object.entries(OS.sel))if(L.length)o[g]=L.slice().sort((a,b)=>a-b);
  const r=K.optCheck(p.mods,GR,o,note,p.nt);
  const key=p.id+"~"+(JSON.stringify(o)+"|"+note).split("").reduce((h,ch)=>(h*31+ch.charCodeAt(0))>>>0,7).toString(36);
  copt[key]={o,n:note,x:r.x,t:r.text};
  setQ(key,(cart[key]||0)+OS.q,1);
  OS=null;closeModal();refreshTile(p.id);toastMsg("✓ Μπήκε στο καλάθι: "+p.name+(r.text?" · "+r.text:""))}

function header(){const s=C.s;return`<header class="hdr">${s.lg?`<img src="${esc(s.lg)}" alt="">`:""}<div><h1>${esc(s.n)}</h1>${s.w?`<p>${esc(s.w)}</p>`:`<p>Παραγγελία χωρίς τηλεφωνήματα</p>`}</div></header>`}
function footer(){const s=C.s;const perish=Object.values(P).some(p=>p.perish);
  return`<footer class="foot">
  <details class="seller"><summary>ℹ️ Στοιχεία πωλητή, τιμές και όροι</summary>
  <div><b>${esc(s.l||s.n)}</b>${s.a?" · "+esc(s.a):""}${s.f?" · ΑΦΜ "+esc(s.f):""}${[s.t,...(s.t2||[])].filter(Boolean).map(x=>` · <a href="tel:${esc(x)}">${esc(x)}</a>`).join("")}${s.m?` · ${esc(s.m)}`:""}</div>
  <div>${s.vi?"Όλες οι τιμές περιλαμβάνουν ΦΠΑ.":"Οι τιμές δεν περιλαμβάνουν ΦΠΑ."} Οι τιμές και η διαθεσιμότητα επιβεβαιώνονται από τον πωλητή.</div>
  <div>Η επιβεβαίωση της παραγγελίας δεν αποτελεί φορολογικό παραστατικό. Το νόμιμο παραστατικό εκδίδεται από τον πωλητή.</div>
  ${perish?`<div>Για τρόφιμα που αλλοιώνονται γρήγορα δεν ισχύει το δικαίωμα υπαναχώρησης (ν. 2251/1994, άρθρο 3ιδ).</div>`:""}
  ${s.tr?`<div><b>Όροι πώλησης:</b> ${esc(s.tr)}</div>`:""}
  <div>Υπεύθυνος για τα προϊόντα, τις τιμές και τα προσωπικά σας στοιχεία είναι ο πωλητής. <a href="aporrito.html#pelatis" target="_blank" rel="noopener">Απόρρητο</a> · <a href="oroi.html#agorastis" target="_blank" rel="noopener">Όροι</a></div></details>
  <button type="button" class="home-add" data-act="home">📲 Βάλ' το στην αρχική οθόνη</button>
  <div class="gl">Παραγγελίες με GlenApps</div></footer>`}

/* μέσα σε κατηγορία: οι υποκατηγορίες γίνονται τίτλοι και τα προϊόντα τους φαίνονται αμέσως, χωρίς δεύτερο πάτημα */
function sectionsHTML(nodes,parent){
  const ctx={prod:id=>P[id],qty,count:n=>K.countIn(n,qty)};
  const prods=n=>(n||[]).filter(x=>x.t==="p"),cats=n=>(n||[]).filter(x=>x.t==="c");
  const has=n=>prods(n.kids).some(x=>P[x.pid])||cats(n.kids).some(has);
  let html="";const top=prods(nodes);
  if(top.length)html+=`<div class="grid">${K.tilesHTML(top,ctx)}</div>`;
  const walk=(list,depth,parentName)=>{for(const c of cats(list)){if(!has(c))continue;
    const same=K.norm(c.name)===K.norm(parentName||"")&&cats(list).length===1;
    if(!same)html+=`<h2 class="sect d${Math.min(depth,3)}">${c.emoji?esc(c.emoji)+" ":""}${esc(c.name)}</h2>`;
    const ps=prods(c.kids);if(ps.length)html+=`<div class="grid">${K.tilesHTML(ps,ctx)}</div>`;
    walk(c.kids,same?depth:depth+1,c.name)}};
  walk(nodes,1,parent&&parent.name);
  return html||`<p class="empty">Δεν υπάρχουν είδη εδώ ακόμα.</p>`}
function curNodes(){if(!view.length)return M;const f=K.findNode(M,view[view.length-1]);return f&&f.node.kids?f.node.kids:M}
function render(){
  document.querySelectorAll("body > .bar").forEach(e=>e.remove());
  if(stage==="check")return renderCheck();
  if(stage==="done")return renderDone();
  const nodes=curNodes();
  const path=view.map(id=>(K.findNode(M,id)||{}).node).filter(Boolean);
  const last=store.get(SK+":last",null);
  const t=totals();
  $("#app").innerHTML=header()+`<main>
   ${path.length?`<div class="crumb"><button type="button" class="back" data-act="back">← Πίσω</button>${path.length>1?`<span class="note" style="margin:0">${esc(path.slice(0,-1).map(n=>n.name).join(" › "))}</span>`:""}</div>
   <h1 class="cattl">${path[path.length-1].emoji?esc(path[path.length-1].emoji)+" ":""}${esc(path[path.length-1].name)}</h1>`:""}
   ${!path.length&&last&&!t.n?(()=>{const L=Object.entries(last).filter(([id])=>P[pidOf(id)]).map(([id,q])=>K.num(q)+" "+P[pidOf(id)].name);return L.length?`<button type="button" class="again" data-act="again"><b>🔁 Επανάληψη παραγγελίας</b><small>ίδια με την προηγούμενη: ${esc(L.slice(0,3).join(", "))}${L.length>3?"…":""}</small></button>`:""})():""}
   ${!path.length?routeBox():""}
   ${!path.length?(()=>{const L=store.get(SK+":sent",[]).filter(x=>x.ok&&x.d>=K.ymd(new Date()));return L.length?`<div class="how" style="border-left-color:#1f7a3d">✅ Έχεις στείλει παραγγελία για ${esc([...new Set(L.map(x=>K.dayLabel(x.d)))].join(" και "))}. Ό,τι στείλεις ακόμα για την ίδια ημέρα θα προστεθεί σε αυτή.</div>`:""})():""}
   ${!path.length&&!t.n&&M.length?`<div class="how">🛒 <b>Πώς παραγγέλνεις:</b> πάτα μια κατηγορία, βάλε ποσότητες με <b>+</b> και στο τέλος πάτα <b>«Συνέχεια»</b>.</div>`:""}
   ${M.length?`<div class="grid" id="grid">${K.tilesHTML(nodes,{prod:id=>P[id],qty,count:n=>K.countIn(n,qty),root:!view.length})}</div>`:`<div class="sec" style="text-align:center"><div style="font-size:40px">📦</div><b>Ο κατάλογος είναι άδειος</b><p class="note">Ο πωλητής δεν έχει βάλει ακόμα προϊόντα. Ζήτησέ του να σου στείλει νέο σύνδεσμο.</p></div>`}</main>`+footer()+bar();
}
function bar(){const t=totals();if(!t.n)return"";return`<div class="bar"><div class="sum"><b>${K.money(t.t)}</b><span>${t.n} ${t.n===1?"είδος":"είδη"} στο καλάθι</span></div><button type="button" class="btn alt" data-act="check">${SELM?"✓ Πέρασέ τα στην παραγγελία":"Συνέχεια →"}</button></div>`}
function sellerSend(){const L=Object.entries(cart).filter(([k])=>P[pidOf(k)]).map(([k,q])=>({pid:pidOf(k),q,o:copt[k]?copt[k].o||{}:null,n:copt[k]?copt[k].n||"":""}));
  try{parent.postMessage({glenPick:L},"*")}catch{}cart={};copt={};store.set(SK+":cart",cart);store.set(SK+":copt",copt)}
function refreshTile(id){const q=qty(id);document.querySelectorAll(`[data-qv="${CSS.escape(id)}"]`).forEach(e=>e.textContent=q?K.num(q):"0");document.querySelectorAll(`.tile[data-pid="${CSS.escape(id)}"]`).forEach(t=>{t.classList.toggle("has",!!q);const m=t.querySelector("[data-minus]");if(m)m.disabled=!q});
  const old=document.querySelector(".bar");const html=bar();if(old)old.outerHTML=html||"";else if(html)document.body.insertAdjacentHTML("beforeend",html);
  const again=document.querySelector(".again");if(again&&totals().n)again.remove()}

/* ---------- ολοκλήρωση ---------- */
const sentFor=d=>store.get(SK+":sent",[]).filter(x=>x.d===d&&x.ok!==false);
function sentBox(d){const L=sentFor(d);if(!L.length)return"";const tot=L.reduce((a,x)=>a+(+x.t||0),0);
  return`<div class="how" style="border-left-color:#e3a008;background:#fff8e1">📨 <b>Έχεις ήδη στείλει ${L.length===1?"παραγγελία":L.length+" παραγγελίες"} για ${esc(K.dayLabel(d).replace(/^(Σήμερα|Αύριο), .*/,m=>m.split(",")[0].toLowerCase()))}</b> (${L.map(x=>esc(x.c)).join(", ")} · ${K.money(tot)}).<br>Αν στείλεις κι αυτή, ο πωλητής θα την προσθέσει στην προηγούμενη και θα έρθουν μαζί.</div>`}
/* προσωπικός σύνδεσμος πελάτη: οι ημέρες που περνάει ο πωλητής από εκείνον */
const PCd=()=>C.c&&Array.isArray(C.c.d)&&C.c.d.length?C.c:null;
function daysFor(extra){const d=C.d||{},pc=PCd();
  if(pc&&!extra)return K.availDays({days:pc.d,closed:d.cl,min:d.min,max:28,cut:d.cut});
  const zd=zoneDays();if(zd)return zd.length?K.availDays({days:zd,closed:d.cl,min:d.min,max:d.max,cut:d.cut}):[];
  return K.availDays({days:d.days,closed:d.cl,min:d.min,max:d.max,cut:d.cut})}
/* ημέρες ανά περιοχή: ο πελάτης διαλέγει περιοχή και βλέπει μόνο τις δικές της ημέρες */
const ZS=()=>{const z=(C.d||{}).z;return Array.isArray(z)&&z.length&&!PCd()?z:null};
const ZOTHER="_";
function zoneOn(){const ch=store.get(SK+":ck",{});const d=C.d||{};const how=d.h==="pick"?"pick":d.h==="del"?"del":(ch.h||"del");return ZS()&&how==="del"}
function zoneDays(){if(!zoneOn())return null;const ch=store.get(SK+":ck",{}),d=C.d||{};
  if(!ch.ar)return[];if(ch.ar===ZOTHER)return d.zo?[]:(d.days||[]);
  const z=K.zoneFor(ZS(),ch.ar);return z?z.d:[]}
function zoneBox(){if(!zoneOn())return"";const ch=store.get(SK+":ck",{}),d=C.d||{},Z=ZS();
  const areas=Z.flatMap(z=>z.a);const z=ch.ar&&ch.ar!==ZOTHER?K.zoneFor(Z,ch.ar):null;
  return`<label class="f">📍 Η περιοχή σου</label><div class="chips zchips">${areas.map(a=>`<button type="button" class="chip${ch.ar&&ch.ar!==ZOTHER&&K.areaEq(ch.ar,a)?" on":""}" data-zar="${esc(a)}">${esc(a)}</button>`).join("")}<button type="button" class="chip${ch.ar===ZOTHER?" on":""}" data-zar="${ZOTHER}">Άλλη περιοχή</button></div>
   ${!ch.ar?`<p class="note" style="margin:6px 0 10px">Διάλεξε την περιοχή σου για να δεις τις ημέρες παράδοσης.</p>`:z?`<div class="how" style="margin:8px 0 10px">🚚 <b>${esc(ch.ar)}:</b> περνάμε ${esc(wdList(z.d))}</div>`:d.zo?`<div class="how" style="margin:8px 0 10px;border-left-color:#e3a008;background:#fff8e1">🏪 Στην περιοχή σου δεν κάνουμε παράδοση.${d.h==="both"?` Μπορείς να την παραλάβεις από εμάς.<br><button type="button" class="btn ghost" data-how="pick" style="margin-top:8px">🏪 Παραλαβή</button>`:""}</div>`:`<p class="note" style="margin:6px 0 10px">Γράψε πιο κάτω τη διεύθυνσή σου.</p>`}`}
const wdList=a=>a.slice().sort((x,y)=>((x+6)%7)-((y+6)%7)).map(i=>K.WD[i]).join(", ").replace(/, ([^,]*)$/," και $1");
function routeBox(){const pc=PCd();if(!pc)return"";const nx=daysFor(false)[0];
  return`<div class="how">🚚 <b>Περνάμε από εσάς:</b> ${esc(wdList(pc.d))}${pc.sl?", "+esc(pc.sl):""}${pc.nt?" · "+esc(pc.nt):""}${nx?`<br>Επόμενη διανομή: <b>${esc(K.dayLabel(nx))}</b>`:""}</div>`}
function renderCheck(){
  const d=C.d||{},s=C.s,pc=PCd();const me=store.get(SK+":me",null)||(C.c?{n:C.c.n||"",p:C.c.p||"",a:C.c.a||""}:{});
  const ch=store.get(SK+":ck",{});const inv=store.get(SK+":inv",{});
  if(!pc||!pc.ex)ch.x=0;
  const extra=!!(pc&&ch.x);
  const days=daysFor(extra);
  if(!ch.d||!days.includes(ch.d))ch.d=days[0]||"";
  const how=d.h==="pick"?"pick":d.h==="del"?"del":(ch.h||"del");ch.h=how;
  const slots=pc&&!extra?(pc.sl?[pc.sl]:[]):(d.sl||[]);
  if(slots.length&&!slots.includes(ch.s))ch.s=slots[0];if(!slots.length)ch.s="";
  store.set(SK+":ck",ch);
  const t=totals();
  const lines=Object.entries(cart).filter(([id])=>P[pidOf(id)]).map(([id,q])=>{const p=P[pidOf(id)],co=copt[id],u=lineUnit(id,q);return`<div class="line"><div class="ln"><b>${esc(p.name)}</b>${co&&(co.t||co.n)?`<em class="lopt">${esc([co.t,co.n?"«"+co.n+"»":""].filter(Boolean).join(" · "))}</em>`:""}<span>${K.money(u)} / ${esc(p.unit)}${K.unitPrice(p,q)<p.price-.004?" (με έκπτωση ποσότητας)":""}</span></div><div class="qty"><button type="button" class="qb" data-minus="${esc(id)}">−</button><span class="qv">${K.num(q)}</span><button type="button" class="qb plus" data-plus="${esc(id)}">+</button></div><div class="lt">${K.money(q*u)}</div></div>`}).join("");
  const perish=Object.keys(cart).some(id=>P[pidOf(id)]&&P[pidOf(id)].perish);
  const needAddr=how==="del"&&d.ad;
  $("#app").innerHTML=header()+`<main>
  <div class="crumb"><button type="button" class="back" data-act="shop">← Συνέχεια αγορών</button></div>
  <div class="sec"><h2>Η παραγγελία σου</h2>${lines}<div class="total"><span>Σύνολο</span><span>${K.money(t.t)}</span></div>
   <p class="note">${s.vi?"Οι τιμές περιλαμβάνουν ΦΠΑ.":"Οι τιμές δεν περιλαμβάνουν ΦΠΑ."} Ισχύουν οι τρέχουσες τιμές του πωλητή.</p>
   ${d.mo&&t.t<d.mo?`<p class="err">Ελάχιστη παραγγελία ${K.money(d.mo)}.</p>`:""}</div>
  <div class="sec"><h2>Πότε</h2>
   ${pc?(extra?`<div class="how" style="border-left-color:#d93025">⚡ <b>Έκτακτη παραγγελία</b> — εκτός από τις κανονικές σας ημέρες. Ο πωλητής θα σας επιβεβαιώσει αν μπορεί.</div>`:routeBox()):""}
   ${d.h==="both"?`<div class="chips" style="margin-bottom:10px"><button type="button" class="chip${how==="del"?" on":""}" data-how="del">🚚 Παράδοση</button><button type="button" class="chip${how==="pick"?" on":""}" data-how="pick">🏪 Παραλαβή</button></div>`:`<p class="note" style="margin:0 0 8px">${how==="pick"?"🏪 Παραλαβή από τον πωλητή":"🚚 Παράδοση"}</p>`}
   ${zoneBox()}
   ${zoneOn()&&!zoneDays().length?"":days.length?`<div class="chips">${days.slice(0,10).map(x=>`<button type="button" class="chip${x===ch.d?" on":""}" data-day="${x}">${esc(K.dayLabel(x))}</button>`).join("")}</div>`:`<p class="err">Δεν υπάρχουν διαθέσιμες ημέρες αυτή τη στιγμή.</p>`}
   ${slots.length>1?`<label class="f">Ώρα</label><div class="chips">${slots.map(x=>`<button type="button" class="chip${x===ch.s?" on":""}" data-slot="${esc(x)}">${esc(x)}</button>`).join("")}</div>`:slots.length?`<p class="note">Ώρα: ${esc(slots[0])}</p>`:""}
   ${pc&&pc.ex?(extra?`<button type="button" class="btn ghost wide" data-act="normal" style="margin-top:10px">↩ Κανονική διανομή</button>`:`<button type="button" class="btn ghost wide" data-act="extra" style="margin-top:10px;border-color:#d93025;color:#d93025">⚡ Έκτακτη παραγγελία σε άλλη ημέρα</button>`):""}
   <button type="button" class="urg${ch.u?" on":""}" data-act="urg" aria-pressed="${ch.u?"true":"false"}"><span class="ue">🚨</span><span class="ut"><b>Επείγουσα</b><small>${ch.u?"Ο πωλητής θα τη δει πρώτη και θα σας ενημερώσει αν προλαβαίνει":"Πάτα αν τη χρειάζεσαι όσο πιο γρήγορα γίνεται"}</small></span><span class="uc">${ch.u?"✓":""}</span></button>
   ${d.nt?`<p class="note">${esc(d.nt)}</p>`:""}${sentBox(ch.d)}</div>
  <div class="sec"><h2>Τα στοιχεία σου</h2>
   <label class="f" for="cn">Ονοματεπώνυμο</label><input class="t" id="cn" autocomplete="name" value="${esc(me.n||"")}" maxlength="80">
   <label class="f" for="cp">Κινητό τηλέφωνο</label><input class="t" id="cp" type="tel" inputmode="tel" autocomplete="tel" value="${esc(me.p||"")}" maxlength="20">
   ${needAddr?`<label class="f" for="ca">Διεύθυνση παράδοσης</label><input class="t" id="ca" autocomplete="street-address" value="${esc(me.a||"")}" maxlength="160">`:""}
   <label class="f" for="cnote">Σημείωση (προαιρετικά)</label><textarea class="t" id="cnote" rows="2" maxlength="400" placeholder="π.χ. χτυπήστε το δεύτερο κουδούνι">${esc(ch.note||"")}</textarea>
   <label class="f">Παραστατικό</label>
   <div class="chips"><button type="button" class="chip${ch.inv==="r"?" on":""}" data-inv="r">🧾 Απόδειξη</button><button type="button" class="chip${ch.inv==="i"?" on":""}" data-inv="i">📄 Τιμολόγιο</button></div>
   ${ch.inv==="i"?`<div style="margin-top:6px">
    <label class="f" for="iN">Επωνυμία</label><input class="t" id="iN" value="${esc(inv.n||"")}" maxlength="100">
    <label class="f" for="iA">ΑΦΜ</label><input class="t" id="iA" inputmode="numeric" maxlength="9" value="${esc(inv.f||"")}">
    <label class="f" for="iD">ΔΟΥ</label><input class="t" id="iD" value="${esc(inv.d||"")}" maxlength="60">
    <label class="f" for="iJ">Επάγγελμα</label><input class="t" id="iJ" value="${esc(inv.j||"")}" maxlength="80">
    <label class="f" for="iAd">Διεύθυνση έδρας</label><input class="t" id="iAd" value="${esc(inv.a||"")}" maxlength="140"></div>`:""}
   <label class="ck"><input type="checkbox" id="crem"${me.n?" checked":""}><span>Να θυμάται αυτό το κινητό τα στοιχεία μου για την επόμενη φορά</span></label>
   ${s.tr?`<details class="sec" style="padding:10px 12px;margin:10px 0 0;background:#fafafa"><summary style="font-weight:700;cursor:pointer">📜 Όροι πώλησης του καταστήματος</summary><p style="white-space:pre-wrap;font-size:14px;margin:8px 0 0">${esc(s.tr)}</p></details>`:""}
   <label class="ck"><input type="checkbox" id="ccons"><span>Διάβασα και αποδέχομαι ${s.tr?"τους όρους πώλησης του καταστήματος, ":""}τους <a href="oroi.html#agorastis" target="_blank" rel="noopener">όρους χρήσης</a> και την <a href="aporrito.html#pelatis" target="_blank" rel="noopener">ενημέρωση απορρήτου</a>. Δίνω τα στοιχεία μου στον πωλητή «${esc(s.l||s.n)}» μόνο για την εκτέλεση της παραγγελίας.</span></label>
   ${perish?`<p class="note">Τα τρόφιμα που αλλοιώνονται γρήγορα δεν επιστρέφονται (εξαίρεση από το δικαίωμα υπαναχώρησης). Για αλλαγή ή ακύρωση επικοινώνησε με τον πωλητή πριν από την παράδοση.</p>`:""}
   <div class="err" id="cerr"></div></div>
  <button type="button" class="btn wide" id="send" data-act="send"${sending?" disabled":""}>${sending?"Αποστολή…":"Παραγγελία με υποχρέωση πληρωμής · "+K.money(t.t)}</button>
  <p class="note" style="text-align:center">Η επιβεβαίωση δεν αποτελεί φορολογικό παραστατικό.</p>
  </main>`+footer();
}
function saveCk(){const ch=store.get(SK+":ck",{});const n=$("#cnote");if(n)ch.note=n.value;store.set(SK+":ck",ch);if($("#iN"))store.set(SK+":inv",{n:$("#iN").value.trim(),f:$("#iA").value.replace(/\D/g,""),d:$("#iD").value.trim(),j:$("#iJ").value.trim(),a:$("#iAd").value.trim()})}
function afmOk(a){a=String(a||"");if(!/^\d{9}$/.test(a)||a==="000000000")return false;let s=0;for(let i=0;i<8;i++)s+=+a[i]*Math.pow(2,8-i);return (s%11)%10===+a[8]}

async function send(){
  if(sending)return;
  const err=m=>{$("#cerr").textContent=m;$("#cerr").scrollIntoView({block:"center",behavior:"smooth"})};
  const d=C.d||{},ch=store.get(SK+":ck",{});
  const n=$("#cn").value.trim(),p=$("#cp").value.trim(),a=$("#ca")?$("#ca").value.trim():"",note=$("#cnote").value.trim();
  const t=totals();
  if(!t.n)return err("Το καλάθι είναι άδειο.");
  if(d.mo&&t.t<d.mo)return err("Η ελάχιστη παραγγελία είναι "+K.money(d.mo)+".");
  if(n.length<3)return err("Γράψε το ονοματεπώνυμό σου.");
  if(p.replace(/\D/g,"").length<10)return err("Γράψε ένα έγκυρο κινητό τηλέφωνο (10 ψηφία).");
  if($("#ca")&&a.length<5)return err("Γράψε τη διεύθυνση παράδοσης.");
  const extra=!!(PCd()&&PCd().ex&&ch.x);
  const days=daysFor(extra);
  if(zoneOn()&&!ch.ar)return err("Διάλεξε την περιοχή σου.");
  if(!ch.d||!days.includes(ch.d))return err(zoneOn()&&!days.length?"Στην περιοχή σου δεν υπάρχουν ημέρες παράδοσης.":"Διάλεξε ημέρα.");
  if(ch.inv!=="r"&&ch.inv!=="i")return err("Διάλεξε αν θέλεις απόδειξη ή τιμολόγιο.");
  let inv=null;if(ch.inv==="i"){saveCk();inv=store.get(SK+":inv",{});if((inv.n||"").length<2)return err("Γράψε την επωνυμία για το τιμολόγιο.");if(!afmOk(inv.f))return err("Ο ΑΦΜ για το τιμολόγιο δεν είναι έγκυρος.");if((inv.a||"").length<4)return err("Γράψε τη διεύθυνση έδρας για το τιμολόγιο.")}
  if(!$("#ccons").checked)return err("Χρειάζεται να αποδεχτείς τους όρους και την ενημέρωση απορρήτου.");
  if(sentFor(ch.d).length&&!confirm("Έχεις ήδη στείλει παραγγελία για "+K.dayLabel(ch.d)+".\n\nΝα σταλεί κι αυτή; Ο πωλητής θα την προσθέσει στην προηγούμενη."))return;
  if($("#crem").checked)store.set(SK+":me",{n,p,a});else{try{localStorage.removeItem(SK+":me")}catch{}}
  if(!orderId)orderId=K.uid(12);
  const O={v:1,id:orderId,cv:C.ts,at:Date.now(),c:Object.assign({n,p,a,note},zoneOn()&&ch.ar?{ar:ch.ar===ZOTHER?"":ch.ar}:{}),w:Object.assign({d:ch.d,s:ch.s||"",h:ch.h||"del",x:extra?1:0},ch.u?{u:1}:{}),l:Object.entries(cart).filter(([id])=>P[pidOf(id)]).map(([id,q])=>copt[id]?[pidOf(id),q,lineUnit(id,q),{o:copt[id].o,n:copt[id].n||undefined}]:[pidOf(id),q,lineUnit(id,q)]),cons:1,tk:C.c&&C.c.tk||undefined,inv:ch.inv==="i"?Object.assign({t:"i"},inv):{t:"r"}};
  if(O.l.length>K.MAX_LINES)return err("Η παραγγελία έχει πάρα πολλές γραμμές ("+O.l.length+"). Το ανώτερο είναι "+K.MAX_LINES+": στείλε τα υπόλοιπα σε δεύτερη παραγγελία.");
  sending=true;$("#send").disabled=true;$("#send").textContent="Αποστολή…";
  let ct;
  try{ct=await K.seal(C.k,O)}catch{sending=false;render();return err("Το κινητό δεν μπόρεσε να κρυπτογραφήσει την παραγγελία. Δοκίμασε σε άλλον περιηγητή (π.χ. Chrome).")}
  const click=(C.u||APP_URL)+"#o="+ct;
  const code=orderId.slice(-5).toUpperCase().replace(/[-_.]/g,"X");
  let ok=false;
  try{await K.ntfySend(C.t,(ch.u?"🚨 Επείγουσα παραγγελία ":"🛒 Νέα παραγγελία ")+code,t.n+(t.n===1?" είδος":" είδη")+" · "+K.dayLabel(ch.d)+" — πάτα για να την ανοίξεις",click,(C.d||{}).pr===5||ch.u?5:4);ok=true}catch{}
  if(INFRAME){try{parent.postMessage({t:"paraggelia",ct},location.origin)}catch{}ok=true}
  sending=false;
  if(ok){const c2=store.get(SK+":ck",{});if(c2.u){c2.u=0;store.set(SK+":ck",c2)}}
  lastSent={form:{n,p,a,note},code,click,ok,day:ch.d,slot:ch.s,how:ch.h,total:t.t,lines:O.l.map(([id,q,pr,op])=>({name:P[id].name+(op?(()=>{const r=K.optCheck(P[id].mods,GR,op.o,op.n,P[id].nt);return r.text||r.note?" ("+[r.text,r.note?"«"+r.note+"»":""].filter(Boolean).join(" · ")+")":""})():""),unit:P[id].unit,q,price:pr}))};
  {const sent=store.get(SK+":sent",[]).filter(x=>x.d>=K.ymd(new Date()));if(ok){const i=sent.findIndex(x=>x.c===code);const e={d:ch.d,c:code,t:t.t,at:Date.now(),ok};if(i>=0)sent[i]=e;else sent.push(e)}store.set(SK+":sent",sent.slice(-20))}
  if(ok){store.set(SK+":last",Object.assign({},cart));store.set(SK+":lastopt",Object.assign({},copt));cart={};copt={};store.set(SK+":cart",{});store.set(SK+":copt",{});const c2=store.get(SK+":ck",{});delete c2.note;store.set(SK+":ck",c2);orderId=null}
  stage="done";view=[];history.replaceState({v:[],s:"done"},"");render();window.scrollTo(0,0);
}
function viberText(){return"Παραγγελία "+lastSent.code+" — "+K.money(lastSent.total)+"\n"+lastSent.click}
function renderDone(){
  const L=lastSent,s=C.s;
  $("#app").innerHTML=header()+`<main><div class="done">
   <div class="big">${L.ok?"✅":"⚠️"}</div>
   <h2>${L.ok?"Η παραγγελία στάλθηκε":"Η παραγγελία δεν στάλθηκε ακόμα"}</h2>
   <div>Κωδικός</div><div class="code">${esc(L.code)}</div>
   <p>${esc(K.dayLabel(L.day))}${L.slot?" · "+esc(L.slot):""} · ${L.how==="pick"?"Παραλαβή":"Παράδοση"}</p></div>
   <div class="sec">${L.lines.map(l=>`<div class="line"><div class="ln"><b>${esc(l.name)}</b><span>${K.num(l.q)} × ${K.money(l.price)} / ${esc(l.unit)}</span></div><div class="lt">${K.money(l.q*l.price)}</div></div>`).join("")}<div class="total"><span>Σύνολο</span><span>${K.money(L.total)}</span></div>
   <p class="note">Τελικές είναι οι τιμές του πωλητή. Η επιβεβαίωση αυτή δεν αποτελεί φορολογικό παραστατικό.</p></div>
   ${L.ok?`<p class="okline">✓ Έφτασε στον πωλητή. Δεν χρειάζεται να κάνεις τίποτα άλλο.</p>`:`<p class="err" style="text-align:center">Δεν υπήρξε σύνδεση στο διαδίκτυο. Δοκίμασε ξανά ή στείλ' την στο Viber του πωλητή.</p><button type="button" class="btn wide" data-act="retry" style="margin-bottom:10px">Δοκίμασε ξανά</button>
   <button type="button" class="btn alt wide" style="margin-bottom:10px" data-act="vshare">💬 Στείλ' την στο Viber</button>`}
   ${[s.t,...(s.t2||[])].filter(Boolean).map((x,i,L)=>`<a class="btn ghost wide" style="display:block;text-align:center;text-decoration:none;margin-bottom:10px" href="tel:${esc(x)}">${/^(\+?30|0030)?2/.test(x.replace(/[^\d+]/g,""))?"☎️":"📞"} Κάλεσε τον πωλητή${L.length>1?" · "+esc(x):""}</a>`).join("")}
   <button type="button" class="btn wide" data-act="new">Νέα παραγγελία</button></main>`+footer();
}

/* ---------- αρχική οθόνη ---------- */
async function homeAdd(){
  if(deferredPrompt){try{deferredPrompt.prompt();await deferredPrompt.userChoice}catch{}deferredPrompt=null;return}
  const inViber=/Viber/i.test(navigator.userAgent),ios=/iPhone|iPad|iPod/i.test(navigator.userAgent);
  openModal(`<h3>📲 Στην αρχική οθόνη</h3>
   ${inViber?`<p><b>1.</b> Πάτα τις τρεις τελείες πάνω δεξιά και διάλεξε «Άνοιγμα σε περιηγητή» (Chrome).</p>`:""}
   ${ios?`<p><b>${inViber?"2":"1"}.</b> Στο Safari πάτα το κουμπί κοινοποίησης <b>⬆️</b>.</p><p><b>${inViber?"3":"2"}.</b> Διάλεξε «Προσθήκη στην οθόνη Αφετηρίας».</p>`
   :`<p><b>${inViber?"2":"1"}.</b> Στο Chrome πάτα τις τρεις τελείες <b>⋮</b> πάνω δεξιά.</p><p><b>${inViber?"3":"2"}.</b> Διάλεξε «Προσθήκη στην αρχική οθόνη» ή «Εγκατάσταση εφαρμογής».</p>`}
   <p class="note">Το εικονίδιο θα έχει το όνομα «${esc(C.s.n)}». Δεν χρειάζεται εγκατάσταση από κατάστημα εφαρμογών.</p>
   <button type="button" class="btn wide" data-act="close">Εντάξει</button>`);
}
/* το «πίσω» του κινητού κλείνει το παράθυρο. Όταν το κλείνουμε εμείς, περιμένουμε να ολοκληρωθεί το «πίσω»
   πριν ανοίξει το επόμενο· αλλιώς ένα γρήγορο δεύτερο πάτημα έκλεινε το νέο παράθυρο χωρίς να μπει τίποτα στο καλάθι */
let backPend=0,afterBack=null,backT=0;
function backDone(){backPend=0;clearTimeout(backT);const f=afterBack;afterBack=null;if(f)f()}
function openModal(h){$("#mbox").innerHTML=h;$("#modal").classList.add("open");const push=()=>history.pushState({v:view.slice(),s:stage,m:1},"");if(backPend)afterBack=push;else push()}
function closeModal(){if($("#modal").classList.contains("open")){$("#modal").classList.remove("open");if(history.state&&history.state.m&&!backPend){backPend=1;afterBack=null;backT=setTimeout(backDone,700);history.back()}else if(backPend)afterBack=null}}

/* ---------- πατήματα ---------- */
document.addEventListener("click",e=>{
  const so=e.target.closest(".tile.prod.soldout");
  if(so&&stage==="shop"){const p=P[so.dataset.pid];toastMsg(p&&p.oos?"🍂 Το «"+p.name+"» είναι εκτός εποχής αυτή την περίοδο.":"😔 Το «"+(p?p.name:"")+"» έχει εξαντληθεί. Δοκίμασε ξανά αργότερα.");return}
  {const tp=e.target.closest(".tile.prod[data-pid]");if(tp&&stage==="shop"&&!e.target.closest("button")){const p=P[tp.dataset.pid];if(p&&!p.soldout&&hasOpts(p)){optSheet(p);return}}}
  const b=e.target.closest("button,[data-open]");if(!b)return;
  if(b.dataset.oo){const[g,i]=b.dataset.oo.split("|");const G=GR[g];if(!G||!OS)return;let L=OS.sel[g]||[];const n=+i;
    if(L.includes(n)){if(!(G.mx===1&&G.mn>0))L=L.filter(x=>x!==n)}else if(G.mx===1)L=[n];else{if(G.mx>0&&L.length>=G.mx){toastMsg("Έως "+G.mx+" στο «"+G.n+"».");return}L=L.concat(n)}
    OS.sel[g]=L;$("#oerr").textContent="";const og=b.closest(".og");if(og&&(L.length>=(G.mn||0)))og.classList.remove("miss");optPaint();return}
  if(b.dataset.oq){if(!OS)return;const p=P[OS.pid],st=p.step||1;OS.q=Math.max(st,Math.round((OS.q+(+b.dataset.oq)*st)*1000)/1000);if(p.max!=null&&OS.q>p.max)OS.q=Math.max(st,p.max);optPaint();return}
  if(b.dataset.plus){const k=b.dataset.plus,p=P[pidOf(k)];if(!p)return;
    if(stage!=="check"&&hasOpts(p)){optSheet(p);return}
    const key=cart[k]!=null||!hasOpts(p)?k:null;if(!key){optSheet(p);return}
    setQ(key,(cart[key]||0)+(p.step||1),1);stage==="check"?renderCheck():refreshTile(p.id);return}
  if(b.dataset.minus){const k=b.dataset.minus,p=P[pidOf(k)];if(!p)return;
    let key=cart[k]!=null?k:null;if(!key){const ks=keysOf(p.id);if(ks.length===1)key=ks[0];else if(ks.length>1){toastMsg("Το έχεις με διαφορετικές επιλογές· άλλαξέ το από το καλάθι.");go(view,"check");return}else return}
    setQ(key,(cart[key]||0)-(p.step||1),-1);if(stage==="check"){if(!totals().n)stage="shop";render()}else refreshTile(p.id);return}
  if(b.dataset.open){go(view.concat(b.dataset.open),"shop");return}
  if(b.dataset.zar){saveCk();const ch=store.get(SK+":ck",{});ch.ar=b.dataset.zar;ch.d="";store.set(SK+":ck",ch);keepInputs(renderCheck);return}
  if(b.dataset.day||b.dataset.slot||b.dataset.how||b.dataset.inv){saveCk();const ch=store.get(SK+":ck",{});if(b.dataset.day)ch.d=b.dataset.day;if(b.dataset.slot)ch.s=b.dataset.slot;if(b.dataset.how)ch.h=b.dataset.how;if(b.dataset.inv)ch.inv=b.dataset.inv;store.set(SK+":ck",ch);keepInputs(renderCheck);return}
  const a=b.dataset.act;if(!a)return;
  if(a==="back"){history.back()}
  else if(a==="check"){if(SELM){sellerSend();return}go(view,"check");liveAll()}
  else if(a==="shop"){saveCk();history.back()}
  else if(a==="send")send();
  else if(a==="retry"){const f=lastSent&&lastSent.form;stage="check";render();if(f){const v=(id,x)=>{const e=$("#"+id);if(e&&x!=null)e.value=x};v("cn",f.n);v("cp",f.p);v("ca",f.a);v("cnote",f.note);const cc=$("#ccons");if(cc)cc.checked=true}send()}   /* ξανά με τα ίδια στοιχεία, χωρίς να τα ξαναγράψει */
  else if(a==="new"){stage="shop";view=[];history.replaceState({v:[],s:"shop"},"");render();window.scrollTo(0,0)}
  else if(a==="oadd")optAdd();
  else if(a==="again"){const last=store.get(SK+":last",{}),lo=store.get(SK+":lastopt",{});let miss=0;for(const[id,q]of Object.entries(last)){const p=P[pidOf(id)];if(p&&!p.soldout){if(lo[id]){const r=K.optCheck(p.mods,GR,lo[id].o,lo[id].n,p.nt);copt[id]={o:lo[id].o,n:r.note,x:r.x,t:r.text}}setQ(id,q)}else miss++}go(view,"check");if(miss)$("#cerr").textContent="Κάποια είδη της προηγούμενης φοράς δεν είναι διαθέσιμα τώρα."}
  else if(a==="urg"){saveCk();const ch=store.get(SK+":ck",{});ch.u=ch.u?0:1;store.set(SK+":ck",ch);keepInputs(renderCheck)}
  else if(a==="extra"||a==="normal"){saveCk();const ch=store.get(SK+":ck",{});ch.x=a==="extra"?1:0;ch.d="";store.set(SK+":ck",ch);keepInputs(renderCheck)}
  else if(a==="vshare"){(async()=>{const t=viberText();if(navigator.share){try{await navigator.share({text:t});return}catch(e){if(e&&e.name==="AbortError")return}}try{await navigator.clipboard.writeText(t);toastMsg("Αντιγράφηκε· επικόλλησέ το στο Viber του πωλητή")}catch{}})()}
  else if(a==="home")homeAdd();
  else if(a==="close")closeModal();
});
$("#modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal()});
function keepInputs(fn){const v={};document.querySelectorAll("input.t,textarea.t").forEach(i=>v[i.id]=i.value);const c={};document.querySelectorAll(".ck input").forEach(i=>c[i.id]=i.checked);const y=window.scrollY;fn();for(const[id,x]of Object.entries(v)){const i=document.getElementById(id);if(i)i.value=x}for(const[id,x]of Object.entries(c)){const i=document.getElementById(id);if(i)i.checked=x}window.scrollTo(0,y)}
window.addEventListener("hashchange",()=>location.reload());
/* ---------- κουμπί «πίσω» του κινητού: ένα βήμα πίσω, όχι έξοδος ---------- */
function go(v,st){history.pushState({v:v.slice(),s:st},"");view=v.slice();stage=st;render();window.scrollTo(0,0)}
window.addEventListener("popstate",e=>{
  if(backPend){backDone();return}
  const st=e.state;
  if($("#modal").classList.contains("open")){$("#modal").classList.remove("open");if(st&&st.m)return}
  if(!st){
    /* στην αρχική: δεύτερο «πίσω» μέσα σε 2 δευτερόλεπτα βγάζει έξω */
    if(INFRAME){view=[];stage="shop";render();return}
    if(stage==="shop"&&!view.length){if(Date.now()-exitAt<2000){history.back();return}exitAt=Date.now();toastMsg("Πάτα ξανά «πίσω» για έξοδο");history.pushState({v:[],s:"shop"},"");return}
    view=[];stage="shop";history.pushState({v:[],s:"shop"},"");render();return}
  let s=st.s||"shop";
  if(s==="check"&&!totals().n)s="shop";
  if(s==="done"&&stage!=="done")s="shop";
  view=(st.v||[]).filter(id=>K.findNode(M,id));stage=s;render();
});
let exitAt=0;
function toastMsg(m){let t=document.getElementById("toast");if(!t){t=document.createElement("div");t.id="toast";t.style.cssText="position:fixed;left:50%;bottom:120px;transform:translateX(-50%);background:#1d2b36;color:#fff;padding:10px 16px;border-radius:12px;font-size:14.5px;z-index:90;transition:opacity .2s";document.body.appendChild(t)}t.textContent=m;t.style.opacity=1;clearTimeout(t._h);t._h=setTimeout(()=>t.style.opacity=0,2000)}

load();
/* για τους ελέγχους της εφαρμογής */
window.__pg={get C(){return C},get P(){return P},get cart(){return cart},totals:()=>totals(),liveUpdate:()=>liveUpdate(),liveAll:()=>liveAll(),get C0(){return C0},get liveTs(){return liveTs}};
})();
