// netlify/functions/verify-transaction.js
const fetch = require('node-fetch');
const { rdb } = require('./lib/firebase-admin');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

exports.handler = async function(event) {
  try {
    if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
    const reference = event.queryStringParameters && event.queryStringParameters.reference;
    if (!reference) return { statusCode: 400, body: JSON.stringify({ message: 'Missing reference' }) };

    // verify with Paystack
    const resp = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, Accept: 'application/json' }
    });
    const data = await resp.json();

    if (!data || data.status !== true) {
      return { statusCode: 400, body: JSON.stringify({ status: 'failed', message: 'Paystack verify failed', data }) };
    }

    const txn = data.data;
    if (txn.status !== 'success') {
      return { statusCode: 400, body: JSON.stringify({ status: 'failed', message: 'Transaction not successful', txn }) };
    }

    const referenceFromPaystack = txn.reference;
    const amountKobo = txn.amount; // kobo
    const metadata = txn.metadata || {};
    // fetch our pending transaction record
    const txSnap = await rdb.ref(`transactions/${referenceFromPaystack}`).once('value');
    const existing = txSnap.val();

    // Idempotency: if already success, return success
    if (existing && existing.status === 'success') {
      return { statusCode: 200, body: JSON.stringify({ status: 'success', message: 'Already processed' }) };
    }

    // determine userId: prefer our existing record, else try metadata.userId
    const userId = (existing && existing.userId) || metadata.userId || (txn.customer && txn.customer.email) || null;
    if (!userId) {
      // still update global transaction record and return error
      await rdb.ref(`transactions/${referenceFromPaystack}`).update({ status: 'success', paystack: txn, updatedAt: Date.now() });
      return { statusCode: 200, body: JSON.stringify({ status: 'success', message: 'Verified but userId missing — manual reconcile needed' }) };
    }

    // update transaction globally and under user (mark success)
    await rdb.ref(`transactions/${referenceFromPaystack}`).update({ status: 'success', paystack: txn, updatedAt: Date.now() });

    // update user's transaction node: find entry with that reference (simple approach: push new success record)
    const userTxRef = rdb.ref(`users/${userId}/transactions`).push();
    await userTxRef.set({
      reference: referenceFromPaystack,
      amount: amountKobo,
      type: 'credit',
      description: 'Top-up via Paystack',
      status: 'success',
      timestamp: Date.now()
    });

    // increment user balance atomically
    const balRef = rdb.ref(`users/${userId}/balance`);
    await balRef.transaction(current => {
      const cur = (current || 0);
      return cur + Number(amountKobo);
    });

    return { statusCode: 200, body: JSON.stringify({ status: 'success', message: 'Verified and balance updated' }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ status: 'error', message: err.message }) };
  }
};
