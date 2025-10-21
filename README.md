# my-paystack-firebase-app

This repository contains a small frontend (auth, dashboard, NIN slip page) and Netlify Functions that integrate Paystack and Firebase Realtime Database.

## What is inside

- `index.html` — Register / Login (Firebase Auth)
- `dashboard.html` — Shows available balance, Add Fund (Paystack), transaction history toggle
- `ni.html` — Your NIN slip generator (copied from your uploaded file)
- `netlify/functions/create-transaction.js` — creates pending transaction and returns Paystack public key + reference
- `netlify/functions/verify-transaction.js` — verifies Paystack transaction server-side and increments user balance
- `netlify/functions/lib/firebase-admin.js` — initializes Firebase Admin SDK (server-side) using env vars
- `netlify.toml`, `package.json`, `.gitignore`

## How to deploy (phone-friendly steps)

1. Create a GitHub repository (e.g. `my-paystack-firebase-app`) and upload the files from this ZIP (you can use GitHub mobile web UI -> Add file -> Upload files).
2. Go to Netlify -> New Site from GitHub -> pick the repository.
3. In Netlify site settings -> Build & deploy -> Environment -> Add the following environment variables:

```
PAYSTACK_PUBLIC_KEY=pk_test_...
PAYSTACK_SECRET_KEY=sk_test_...   # do NOT share this publicly
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=...         # from service account JSON
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
```

> NOTE: When pasting the private key into Netlify's variable value, replace actual newlines with `\n` (two characters) OR paste the full JSON and use a secure method. The helper code replaces `\n` back to real newlines.

4. Deploy. Netlify will auto-detect functions in `netlify/functions`.
5. Use Paystack test keys and test cards (e.g., `4084084084084081`) for testing.

## Important security notes

- **Do not** commit `FIREBASE_PRIVATE_KEY` or `PAYSTACK_SECRET_KEY` into your repo.
- Use Netlify environment variables for all server-side secrets.
- Consider adding Paystack webhooks for stronger reliability.

## Troubleshooting

- If balances don't update after payment, check Netlify function logs (Site -> Functions -> function name -> logs) and ensure `PAYSTACK_SECRET_KEY` is correct.
- Ensure realtime DB rules allow read/write for authenticated users (or adjust rules appropriately).



## Using a local `serviceAccountKey.json` (alternative to environment variables)

If you prefer to place the Firebase service account JSON inside the functions folder and require it directly (like `require('../serviceAccountKey.json')`), the repo now supports that.

**Steps**
1. Download the service account JSON from Firebase Console (Project Settings → Service accounts → Generate new private key).
2. Rename it to `serviceAccountKey.json` and upload into `netlify/functions/` in the repository root.
   - Path should be: `netlify/functions/serviceAccountKey.json`
3. IMPORTANT: **Do not** upload the real `serviceAccountKey.json` to a public GitHub repository. Make your GitHub repo *Private* if you include this file.
4. The helper `netlify/functions/lib/firebase-admin.js` will `require()` this file and initialize Admin SDK.
5. You may still set `FIREBASE_DATABASE_URL` as Netlify env var to override the DB URL.

**Security note:** Including the service account JSON in your repository exposes your Firebase project credentials if the repo is public. Use a private repo or the environment-variable approach instead.
