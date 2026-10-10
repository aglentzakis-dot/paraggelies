/*
  Παραγγελίες
  © 2026 Ανδρέας Μ. Γλεντζάκης (Andreas M. Glentzakis). Με την επιφύλαξη παντός δικαιώματος. All rights reserved.
*/
const CACHE="paraggelies-1.18",SHELL=["./","./index.html","./p.html","./katalogos.js?v=1.18","./koino.css?v=1.18","./efarmogi.js?v=1.18","./epexergasia.js?v=1.18","./protypa.js?v=1.18","./antigrafa.js?v=1.18","./efarmoges-mas.js?v=1.18","./oroi.html","./aporrito.html","./manifest.json","./eikonidia/icon-192.png?v=1.18","./eikonidia/icon-512.png?v=1.18","./eikonidia/icon-512-maskable.png?v=1.18","./eikonidia/apple-touch-icon.png?v=1.18"];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>Promise.all(SHELL.map(u=>c.add(u).catch(()=>{})))))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith("paraggelies-")&&x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("message",e=>{e.data&&e.data.type==="skipWaiting"&&self.skipWaiting()});
self.addEventListener("fetch",e=>{const r=e.request,u=new URL(r.url);
  if(r.method!=="GET"||u.origin!==location.origin||/\/efarmoges\.json$/.test(u.pathname))return;
  if(r.mode==="navigate"){const page=/p\.html$/.test(u.pathname)?"./p.html":/\/(index\.html)?$/.test(u.pathname)?"./index.html":null;
    e.respondWith(fetch(new Request(r.url,{cache:"reload",credentials:"same-origin"})).then(res=>{if(page&&res.ok){const c=res.clone();caches.open(CACHE).then(x=>x.put(page,c)).catch(()=>{})}return res}).catch(()=>caches.match(page||r).then(x=>x||caches.match("./index.html"))));return}
  e.respondWith(fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c)).catch(()=>{})}return res}).catch(()=>caches.match(r)))});
self.addEventListener("notificationclick",e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:!0}).then(l=>{for(const c of l)if(/index\.html|\/$/.test(c.url)&&"focus"in c)return c.focus();if(self.clients.openWindow)return self.clients.openWindow("./")}))});
