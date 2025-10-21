// netlify/functions/create-transaction.js
const { v4: uuidv4 } = require('uuid');
const { rdb } = require('./lib/firebase-admin');

exports.handler = async function(event) {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    const body = JSON.parse(event.body || '{}');
    const { userId, amount } = body;
    if (!userId || !amount) return { statusCode: 400, body: JSON.stringify({ message: 'Missing userId or amount' }) };

    // create reference
    const reference = `txn_${uuidv4()}`;
    const amountKobo = Math.round(Number(amount) * 100);

    const tx = {
      reference,
      userId,
      amount: amountKobo,
      currency: 'NGN',
      status: 'pending',
      createdAt: Date.now()
    };

    // save pending transaction under /transactions and under user's transactions (quick lookup)
    await rdb.ref(`transactions/${reference}`).set(tx);
    const userTxRef = rdb.ref(`users/${userId}/transactions`).push();
    await userTxRef.set(Object.assign({}, tx, { _refKey: userTxRef.key }));

    // return reference + public key
    return {
      statusCode: 200,
      body: JSON.stringify({
        reference,
        publicKey: process.env.PAYSTACK_PUBLIC_KEY || ''
      })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};
