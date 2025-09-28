const CACHE='gb-cache-v8';
const ASSETS=[
  './',
  './index.html',
  './style.css',
  './boot.js',
  './app.js',
  './db.js',
  './theme.js',
  './push.js',
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

self.addEventListener('push', (event)=>{
  if (!event.data) return;
  const payload = (()=>{
    try{ return event.data.json(); }catch{ return { body: event.data.text?.() || '' }; }
  })();
  const title = payload.title || 'Gentle Budget';
  const actions = Array.isArray(payload.actions) && payload.actions.length
    ? payload.actions
    : [
        { action: 'confirm_paid', title: 'Yes — posted' },
        { action: 'resched', title: 'Not yet' }
      ];
  const options = {
    body: payload.body || '',
    data: payload.data || {},
    actions,
    tag: payload.tag || undefined
  };

  event.waitUntil((async()=>{
    const clients = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
    for (const client of clients){
      client.postMessage({ type:'push-notification', payload });
    }
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', (event)=>{
  const action = event.action;
  const data = event.notification?.data || {};
  event.notification.close();
  if (action === 'confirm_paid') {
    event.waitUntil(self.clients.openWindow('./#/confirm?id='+encodeURIComponent(data?.recurringId||'')));
  } else if (action === 'resched') {
    event.waitUntil(self.clients.openWindow('./#/reschedule?id='+encodeURIComponent(data?.recurringId||'')));
  } else {
    event.waitUntil(self.clients.openWindow('./'));
  }
});

self.addEventListener('pushsubscriptionchange', (event)=>{
  event.waitUntil((async()=>{
    const subscription = await self.registration.pushManager.getSubscription();
    if (subscription) return;
    // Subscription expired; notify clients to refresh their stored value.
    const clients = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
    for (const client of clients){
      client.postMessage({ type:'push-subscription-changed' });
    }
  })());
});
