importScripts('https://www.gstatic.com/firebasejs/10.12.3/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.3/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyANub2HfbC4cxtMA5KLF_koMcg88Sn3TbM",
  authDomain: "adhd-budgeteer.firebaseapp.com",
  projectId: "adhd-budgeteer",
  storageBucket: "adhd-budgeteer.firebasestorage.app",
  messagingSenderId: "745115474281",
  appId: "1:745115474281:web:bf6c4e944a77f98676c5f8",
  measurementId: "G-D5F4EGX034"
});
const messaging = firebase.messaging();

self.addEventListener('notificationclick', (event)=>{
  const action = event.action;
  const data = event.notification?.data || {};
  event.notification.close();
  if (action === 'confirm_paid') {
    // Open app and route to confirm paid action; client will finalize logging
    event.waitUntil(self.clients.openWindow('./#/confirm?id='+encodeURIComponent(data?.recurringId||'')));
  } else if (action === 'resched') {
    event.waitUntil(self.clients.openWindow('./#/reschedule?id='+encodeURIComponent(data?.recurringId||'')));
  } else {
    event.waitUntil(self.clients.openWindow('./'));
  }
});

// Optional: background handler (FCM legacy compat)
messaging.onBackgroundMessage((payload)=>{
  const { title, body, data } = payload.notification || {};
  self.registration.showNotification(title || 'Gentle Budget', {
    body: body || '',
    data: payload.data || {},
    actions: [
      { action: 'confirm_paid', title: 'Yes — posted' },
      { action: 'resched', title: 'Not yet' }
    ]
  });
});