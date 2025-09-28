// push.js — helper for Web Push API subscriptions
const VAPID_PUBLIC_KEY = "BAf1NArKW908JYRuw8FQr6deEFeqJEI3Vpjg2izq9dhnY2po5rxA_geyBS3INhHHJe1-1USABczT53jDSnwqvXM";
const LS_KEY = 'webpush_subscription';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  return navigator.serviceWorker.register('/sw.js');
}

export async function ensurePushPermission() {
  try {
    if (!('Notification' in window)) return { ok: false, reason: 'unsupported-notifications' };
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { ok: false, reason: 'unsupported-push' };
    }

    if (Notification.permission === 'denied') {
      return { ok: false, reason: 'denied' };
    }

    const reg = await registerServiceWorker();
    if (!reg) return { ok: false, reason: 'no-service-worker' };

    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        return { ok: false, reason: perm === 'denied' ? 'denied' : 'dismissed' };
      }
    }

    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    localStorage.setItem(LS_KEY, JSON.stringify(subscription));
    return { ok: true, subscription };
  } catch (error) {
    console.error('Push permission error', error);
    return { ok: false, error: error?.message || String(error) };
  }
}

export function getStoredSubscription() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function unsubscribePush() {
  if (!('serviceWorker' in navigator)) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await sub.unsubscribe();
  }
  localStorage.removeItem(LS_KEY);
  return true;
}

export function listenForegroundMessages(handler) {
  if (!('serviceWorker' in navigator)) return () => {};
  const listener = (event) => {
    if (!event.data || event.data.type !== 'push-notification') return;
    handler?.(event.data.payload || {});
  };
  navigator.serviceWorker.addEventListener('message', listener);
  return () => navigator.serviceWorker.removeEventListener('message', listener);
}

export async function sendPushNotification({
  endpoint = '/api/push',
  subscription = getStoredSubscription(),
  payload,
  options
} = {}) {
  if (!subscription) throw new Error('No push subscription available. Call ensurePushPermission() first.');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription, payload, options })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Push request failed: ${res.status} ${res.statusText} ${text}`.trim());
  }

  return res.json().catch(() => ({}));
}
