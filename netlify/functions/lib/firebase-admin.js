// netlify/functions/lib/firebase-admin.js
const admin = require('firebase-admin');
const path = require('path');
let initialized = false;

function initFromServiceAccountFile() {
  try {
    // look for netlify/functions/serviceAccountKey.json
    const saPath = path.join(__dirname, '..', 'serviceAccountKey.json');
    const serviceAccount = require(saPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || serviceAccount.database_url
    });
    initialized = true;
    console.log('Firebase Admin initialized from serviceAccountKey.json');
  } catch (err) {
    // file not found or invalid -> fallthrough to env method
    // console.warn('serviceAccountKey.json not found or invalid, will try env vars. err:', err.message);
  }
}

function initFromEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const databaseURL = process.env.FIREBASE_DATABASE_URL;

  if (!projectId || !clientEmail || !privateKey) {
    // Not enough env info to init
    return false;
  }

  // privateKey stored in Netlify should have \\n for newlines;
  // replace literal \n sequences with actual newlines
  const fixedKey = privateKey.replace(/\\n/g, '\n');

  const serviceAccount = {
    project_id: projectId,
    client_email: clientEmail,
    private_key: fixedKey,
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL || `https://${projectId}-default-rtdb.firebaseio.com`
  });
  initialized = true;
  console.log('Firebase Admin initialized from environment variables');
  return true;
}

// initialize once
if (!admin.apps.length && !initialized) {
  initFromServiceAccountFile();
  if (!initialized) {
    const ok = initFromEnv();
    if (!ok) {
      // Give a helpful runtime error (so logs show why)
      const msg = 'Firebase Admin init failed: provide netlify/functions/serviceAccountKey.json OR set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (with \\n for newlines) in env vars.';
      console.error(msg);
      throw new Error(msg);
    }
  }
}

const rdb = admin.database();
module.exports = { admin, rdb };
