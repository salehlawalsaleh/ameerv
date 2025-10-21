// netlify/functions/lib/firebase-admin.js
const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  // Load service account JSON placed at netlify/functions/serviceAccountKey.json
  // IMPORTANT: Do NOT commit your real serviceAccountKey.json to a public repo.
  const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  let serviceAccount;
  try {
    serviceAccount = require(serviceAccountPath);
  } catch (err) {
    console.error('serviceAccountKey.json not found or invalid. Make sure the file exists at netlify/functions/serviceAccountKey.json');
    throw err;
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // If you want to override databaseURL, you can set process.env.FIREBASE_DATABASE_URL
    databaseURL: process.env.FIREBASE_DATABASE_URL || serviceAccount.database_url || "https://ameernin-ba310-default-rtdb.firebaseio.com"
  });
}

const rdb = admin.database();
module.exports = { admin, rdb };
