# Gentle Budget (PWA)

Installable PWA with ADHD-friendly budgeting, affirmations, and kind reminders.
Built for Cameron by James. ❤️

## Deploy (static hosting)
Upload the contents of this folder to any HTTPS static host (Vercel/Netlify/Firebase Hosting).
On iPhone, open in Safari → Share → Add to Home Screen.

## Firebase setup
- Project config is already embedded.
- Generate Public VAPID in Firebase Console → Project Settings → Cloud Messaging → Web Push Certificates.

## Push notifications
This app requests permission and saves the FCM token in `localStorage` (`fcm_token`). The sample Cloud Function expects you to store tokens in Firestore under `users/{uid}` with `fcm_token` field (adapt as needed).

## Cloud Functions (server/)
Deploy the functions and then wire Cloud Scheduler to hit them at 12:00 PM America/Detroit.

Example `gcloud` (replace REGION/PROJECT):
```bash
gcloud scheduler jobs create http weekly-reset --schedule="0 12 * * 0" --uri="https://REGION-PROJECT.cloudfunctions.net/weeklyReset" --http-method=GET --time-zone="America/Detroit"
gcloud scheduler jobs create http mid-week --schedule="0 12 * * 3" --uri="https://REGION-PROJECT.cloudfunctions.net/midWeek" --http-method=GET --time-zone="America/Detroit"
gcloud scheduler jobs create http daily-nudge --schedule="0 10 * * *" --uri="https://REGION-PROJECT.cloudfunctions.net/dailyNudge" --http-method=GET --time-zone="America/Detroit"
# For a specific recurring item (you would automate per user/item)
gcloud scheduler jobs create http recurring-spotify --schedule="0 12 15 * *" --uri="https://REGION-PROJECT.cloudfunctions.net/recurringConfirm?name=Spotify&recurringId=abc123" --http-method=GET --time-zone="America/Detroit"
```