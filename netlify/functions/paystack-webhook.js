// netlify/functions/paystack-webhook.js
const crypto = require('crypto');
const { rdb } = require('./lib/firebase-admin');

const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET || '';

exports.handler = async function(event) {
  try {
    // Netlify sends body as string
    const signature = event.headers['x-paystack-signature'] || event.headers['X-Paystack-Signature'] || '';
    const body = event.body || '';
    // verify signature
    const hash = crypto.createHmac('sha512', PAYSTACK_WEBHOOK_SECRET).update(body).digest('hex');
    if (!signature || hash !== signature) {
      console.warn('Invalid webhook signature');
      return { statusCode: 401, body: 'Invalid signature' };
    }

    const payload = JSON.parse(body);
    const ev = payload.event;
    const data = payload.data || {};

    if (ev === 'charge.success' || ev === 'payment.created' || ev === 'transaction.success') {
      const reference = data.reference;
      const amount = data.amount || 0;
      // mark transaction global
      await rdb.ref(`transactions/${reference}`).update({ status: 'success', paystack: data, updatedAt: Date.now() });

      // try to find userId from existing record
      const txSnap = await rdb.ref(`transactions/${reference}`).once('value');
      const existing = txSnap.val();
      let userId = existing && existing.userId;
      if (!userId && data.metadata && data.metadata.userId) userId = data.metadata.userId;

      if (userId) {
        // push user transaction
        const userTxRef = rdb.ref(`users/${userId}/transactions`).push();
        await userTxRef.set({
          reference,
          amount,
          type: 'credit',
          description: 'Top-up via Paystack (webhook)',
          status: 'success',
          timestamp: Date.now()
        });
        // increment user balance atomically
        const balRef = rdb.ref(`users/${userId}/balance`);
        await balRef.transaction(current => {
          const cur = (current || 0);
          return cur + Number(amount);
        });
      }
    }

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('Webhook handler error', err);
    return { statusCode: 500, body: 'error' };
  }
};
