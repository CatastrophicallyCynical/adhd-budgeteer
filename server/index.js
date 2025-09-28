require('dotenv').config();

const express = require('express');
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 3333;
const DEFAULT_PUBLIC_KEY = 'BAf1NArKW908JYRuw8FQr6deEFeqJEI3Vpjg2izq9dhnY2po5rxA_geyBS3INhHHJe1-1USABczT53jDSnwqvXM';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || DEFAULT_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const CONTACT = process.env.VAPID_CONTACT_EMAIL || 'support@example.com';
const VAPID_SUBJECT = CONTACT.startsWith('mailto:') ? CONTACT : `mailto:${CONTACT}`;

app.use(express.json({ limit: '100kb' }));

if (!VAPID_PRIVATE_KEY) {
  console.warn('[push] VAPID_PRIVATE_KEY is not set. Push delivery requests will be rejected.');
} else {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, message: 'Gentle Budget push relay online.' });
});

app.post('/api/push', async (req, res) => {
  if (!VAPID_PRIVATE_KEY) {
    return res.status(500).json({ ok: false, error: 'VAPID private key missing on server.' });
  }

  const { subscription, payload, options } = req.body || {};
  if (!subscription || typeof subscription !== 'object') {
    return res.status(400).json({ ok: false, error: 'A push `subscription` object is required.' });
  }

  try {
    const body = payload && typeof payload === 'object' ? JSON.stringify(payload) : payload ?? '';
    await webpush.sendNotification(subscription, body, options);
    res.status(202).json({ ok: true });
  } catch (error) {
    console.error('[push] Failed to send notification', error);
    const status = error.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 500;
    res.status(status).json({ ok: false, error: error.body || error.message || 'Unknown push error' });
  }
});

app.listen(PORT, () => {
  console.log(`[push] Listening on port ${PORT}`);
});

module.exports = app;
