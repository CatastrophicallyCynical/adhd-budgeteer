const CACHE='gb-cache-v6';
const ASSETS=[
  './',
  './index.html',
  './style.css',
  './boot.js',
  './app.js',
  './db.js',
  './theme.js',
  './firebase.js',
  './appMeta.json',
  './affirmations.json',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './expense.html',
  './income.html',
  './about.html',
  './recurring.html',
  './history.html'
];
self.addEventListener('install', (e)=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); });
self.addEventListener('activate', (e)=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))) .then(()=>self.clients.claim()));
});
self.addEventListener('fetch', (e)=>{ e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request))); });
