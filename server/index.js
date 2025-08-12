/**
 * Minimal Cloud Functions for scheduling pushes.
 * - Store FCM tokens per user (simple demo uses 'users' collection)
 * - Scheduler hits endpoints to send: weekly reset, mid-week, daily nudges, and recurring confirmations.
 */
const functions = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { onRequest } = functions;

try { admin.initializeApp(); } catch(e){}

const fcm = admin.messaging();

async function sendToAll(title, body, data={}){
  const snap = await admin.firestore().collection('users').get();
  const tokens = [];
  snap.forEach(doc=>{
    const t = doc.get('fcm_token'); if (t) tokens.push(t);
  });
  if (!tokens.length) return { ok:false, reason:'no tokens' };
  const res = await fcm.sendEachForMulticast({
    tokens, notification: { title, body }, data
  });
  return { ok:true, res: res.responses.length };
}

exports.weeklyReset = onRequest(async (req, res)=>{
  const { ok, reason } = await sendToAll('Weekly reset', 'New week, new buckets. Want to roll leftovers forward?', { kind:'weekly_reset' });
  res.json({ ok: ok || false, reason: reason || null });
});

exports.midWeek = onRequest(async (req, res)=>{
  const { ok, reason } = await sendToAll('Mid-week check', 'Halfway through the week. Quick peek at your buckets?', { kind:'mid_week' });
  res.json({ ok: ok || false, reason: reason || null });
});

exports.dailyNudge = onRequest(async (req, res)=>{
  const { ok, reason } = await sendToAll('Money check', '2-min money check?', { kind:'daily' });
  res.json({ ok: ok || false, reason: reason || null });
});

// Example recurring confirm (your scheduler would call this per due item with ID)
exports.recurringConfirm = onRequest(async (req, res)=>{
  const { name='Bill', recurringId='unknown' } = req.query;
  const { ok, reason } = await sendToAll(`${name} — due today`, 'Looks like it should post around now. Did it happen?', { kind:'recurring', recurringId });
  res.json({ ok: ok || false, reason: reason || null });
});