/**
 * Minimal Cloud Functions for scheduling pushes.
 * - Store FCM tokens per user (simple demo uses 'users' collection)
 * - Scheduler hits endpoints to send: weekly reset, mid-week, daily nudges, and recurring confirmations.
 */
import { onRequest } from 'firebase-functions/v2/https';
import admin from 'firebase-admin';

try {
  admin.initializeApp();
} catch (e) {
  // Functions emulator may initialize more than once during tests.
}

const fcm = admin.messaging();
const firestore = admin.firestore();

export function makeSendToAll({ firestore, messaging }) {
  return async function sendToAll(title, body, data = {}) {
    const snap = await firestore.collection('users').get();
    const tokens = [];
    snap.forEach(doc => {
      const token = doc.get('fcm_token');
      if (token) tokens.push(token);
    });
    if (!tokens.length) return { ok: false, reason: 'no tokens' };
    const res = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
    });
    return { ok: true, res: res.responses.length };
  };
}

const sendToAll = makeSendToAll({ firestore, messaging: fcm });

export const weeklyReset = onRequest(async (req, res) => {
  const { ok, reason } = await sendToAll(
    'Weekly reset',
    'New week, new buckets. Want to roll leftovers forward?',
    { kind: 'weekly_reset' },
  );
  res.json({ ok: ok || false, reason: reason || null });
});

export const midWeek = onRequest(async (req, res) => {
  const { ok, reason } = await sendToAll(
    'Mid-week check',
    'Halfway through the week. Quick peek at your buckets?',
    { kind: 'mid_week' },
  );
  res.json({ ok: ok || false, reason: reason || null });
});

export const dailyNudge = onRequest(async (req, res) => {
  const { ok, reason } = await sendToAll('Money check', '2-min money check?', { kind: 'daily' });
  res.json({ ok: ok || false, reason: reason || null });
});

// Example recurring confirm (your scheduler would call this per due item with ID)
export const recurringConfirm = onRequest(async (req, res) => {
  const { name = 'Bill', recurringId = 'unknown' } = req.query;
  const { ok, reason } = await sendToAll(
    `${name} — due today`,
    'Looks like it should post around now. Did it happen?',
    { kind: 'recurring', recurringId },
  );
  res.json({ ok: ok || false, reason: reason || null });
});
