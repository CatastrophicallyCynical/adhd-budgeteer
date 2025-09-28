# Gentle Budget (PWA)

Installable PWA with ADHD-friendly budgeting, affirmations, and kind reminders.
Built for Cameron by James. ❤️

## Deploy (static hosting)
Upload the contents of this folder to any HTTPS static host (Vercel/Netlify/Firebase Hosting).
On iPhone, open in Safari → Share → Add to Home Screen.

## Web Push setup
- `push.js` contains a helper around the standard Web Push APIs.
- It is preconfigured with the VAPID public key you supplied (`BAf1NArK…`). If you ever rotate keys, update the `VAPID_PUBLIC_KEY` constant or set `VAPID_PUBLIC_KEY` in the push server environment.
- Call `ensurePushPermission()` somewhere in your UI to register the service worker, request notification permission, and create a `PushSubscription`. The serialized subscription is stored in `localStorage` under `webpush_subscription` so you can upload it to your backend.

## Push relay backend
A minimal Express server lives in `/server` to send push payloads with your VAPID credentials.

1. Copy `server/.env.example` to `server/.env` and keep it private.
2. Fill in `VAPID_PRIVATE_KEY=MLMp1_fNG6P5Fjk4PLLCC0O9TPZ9tD7R5pl4LCc5lAE` and, optionally, override the public key or contact email.
3. From the `server` directory run `npm install` once, then start the relay with `node index.js` (or deploy it to your preferred Node host).
4. POST to `POST /api/push` with a JSON body containing a `subscription` object (as returned by the Web Push API) and an optional `payload` object/string. The endpoint returns `202 Accepted` when the notification is queued with the push service.

## Service worker notifications
`sw.js` handles standard `push` events. It will display a notification and post a message (`type: 'push-notification'`) to any open clients so you can react in-page. Update the default notification actions if your flow differs from the built-in “confirm paid / reschedule” affordances.