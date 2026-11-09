/*
  Παραγγελίες
  © 2026 Ανδρέας Μ. Γλεντζάκης (Andreas M. Glentzakis). Με την επιφύλαξη παντός δικαιώματος. All rights reserved.
*/
/* ΚΑΝΟΝΑΣ GlenApps (10/11/2026): η εφαρμογή ανοίγει αμέσως από τη συσκευή· δίκτυο το πολύ 3″ — ΜΗΝ αφαιρεθεί.
   gaNet(δίκτυο, αποθήκη, συμβάν): αν το δίκτυο δεν απαντήσει σε 3″ και υπάρχει αποθηκευμένο αντίγραφο, δίνεται αυτό
   (το δίκτυο συνεχίζει στο παρασκήνιο και ενημερώνει την αποθήκη)· μετά από καθυστέρηση, για 30″ όλα κατευθείαν από τη συσκευή.
   Σφάλμα διακομιστή (5xx) δεν αντικαθιστά το αποθηκευμένο. Οι αναβαθμίσεις έρχονται όπως πριν (νέο όνομα αποθήκης σε κάθε έκδοση). */
var GA_MS=3000,gaSlow=0;
function gaNet(net,fromCache,ev){var p=Promise.resolve(net);try{ev&&ev.waitUntil&&ev.waitUntil(p.catch(function(){}))}catch(x){}
  function fc(){try{return Promise.resolve(fromCache()).catch(function(){})}catch(x){return Promise.resolve()}}
  if(Date.now()<gaSlow)return fc().then(function(c){return c||p});
  return new Promise(function(ok){var done=false,t;function fin(r){if(!done){done=true;clearTimeout(t);ok(r)}}
    t=setTimeout(function(){fc().then(function(c){if(c){gaSlow=Date.now()+30000;fin(c)}})},GA_MS);
    p.then(function(r){if(r&&r.status>=500)fc().then(function(c){fin(c||r)});else fin(r)},function(){fc().then(function(c){fin(c||Response.error())})});});}
const CACHE="paraggelies-1.92",SHELL=["./","./index.html","./plaisio.js","./metafora-rythmisi.js","./metafora-lipsi.js","./p.html","./p.js?v=1.91","./glossa-en.js?v=1.91","./glossa.js?v=1.91","./katalogos.js?v=1.91","./koino.css?v=1.91","./efarmogi.js?v=1.91","./epexergasia.js?v=1.91","./excel.js?v=1.91","./protypa.js?v=1.91","./antigrafa.js?v=1.91","./efarmoges-mas.js?v=1.91","./oroi.html","./aporrito.html","./manifest.json","./tameio/index.html","./tameio/enswmatosi.js","./tameio/enswmatosi.css","./tameio/prosopika.js","./tameio/koinoxrista.js","./tameio/xiliosta.js","./tameio/dexameni.js","./tameio/promitheftes.js","./tameio/orometrites.js","./tameio/trapeza.js","./tameio/eisagogi.js","./tameio/apo-trapeza.js","./tameio/foni.js","./tameio/apodeixeis.js","./tameio/antigrafa.js","./tameio/efarmoges-mas.js","./tameio/eikonidia.js","./tameio/icon-192.png","./eikonidia/icon-192.png?v=1.91","./eikonidia/icon-512.png?v=1.91","./eikonidia/icon-512-maskable.png?v=1.91","./eikonidia/apple-touch-icon.png?v=1.91"];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>Promise.all(SHELL.map(u=>c.add(u).catch(()=>{})))))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith("paraggelies-")&&x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("message",e=>{e.data&&e.data.type==="skipWaiting"&&self.skipWaiting()});
self.addEventListener("fetch",e=>{const r=e.request,u=new URL(r.url);
  if(r.method!=="GET"||u.origin!==location.origin||/\/efarmoges\.json$/.test(u.pathname))return;
  if(r.mode==="navigate"){const rel=u.pathname.slice(new URL(self.registration.scope).pathname.length);const page=rel==="p.html"?"./p.html":rel===""||rel==="index.html"?"./index.html":/^tameio\//.test(rel)?"./tameio/index.html":null;
    e.respondWith(gaNet(fetch(new Request(r.url,{cache:"reload",credentials:"same-origin"})).then(res=>{/* μετακόμιση: αν η παλιά διεύθυνση ανακατευθύνει, πάμε κι εμείς εκεί (κρατιούνται ?… και #…) */if(res.redirected)return Response.redirect(res.url,302);if(page&&res.ok){const c=res.clone();caches.open(CACHE).then(x=>x.put(page,c)).catch(()=>{})}return res}),()=>caches.match(page||r,{ignoreSearch:true}).then(x=>x||caches.match("./index.html")),e));return}
  /* ο έλεγχος για νέα έκδοση (no-store) δεν κρατιέται· τα αρχεία χωρίς ?v= (Ταμείο) ελέγχονται πάντα για νεότερο */
  if(r.cache==="no-store"){e.respondWith(fetch(r).catch(()=>caches.match(r,{ignoreSearch:true})));return}
  const fr=u.search?r:new Request(r,{cache:"no-cache"});
  e.respondWith(gaNet(fetch(fr).then(res=>{if(res.ok){const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c)).catch(()=>{})}return res}),()=>caches.match(r,{ignoreSearch:true}),e))});
/* ειδοποίηση νέας παραγγελίας με κουμπιά: Αποδοχή / Αναμονή / Απόρριψη */
self.addEventListener("notificationclick",e=>{e.notification.close();const d=e.notification.data||{},act=e.action||"",id=d.id||"";e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:!0}).then(l=>{for(const c of l)if(/index\.html|\/$|\/#/.test(c.url)&&"focus"in c){if(id)c.postMessage({nact:act||"open",nid:id});return c.focus()}if(self.clients.openWindow)return self.clients.openWindow(id?"./#nact="+(act||"open")+"&nid="+encodeURIComponent(id):"./")}))});
