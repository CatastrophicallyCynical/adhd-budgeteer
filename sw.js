const CACHE='gb-cache-v1';
const ASSETS=[
  './',
  './index.html',
  './style.css',
  './app.js',
  './db.js',
  './firebase.js',
  './appMeta.json',
  './affirmations.json',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png'
];
self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('activate', (e)=>{
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (e)=>{
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
});