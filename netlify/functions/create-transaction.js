// netlify/functions/create-transaction.js
export async function handler(event) {
  try {
    const { userId, amount } = JSON.parse(event.body);
    if (!userId || !amount) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing userId or amount" }),
      };
    }

    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    const FIREBASE_DB_URL = process.env.FIREBASE_DATABASE_URL;

    // 1️⃣ Create Paystack transaction
    const payRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
      body: JSON.stringify({
        amount: amount * 100,
        email: `${userId}@tech.net`,
        // callback now points to dashboard.html (make sure file exists and is deployed)
        callback_url: `https://verifymynin.netlify.app/dashboard.html?uid=${encodeURIComponent(userId)}`,
      }),
    });

    const payData = await payRes.json();
    if (!payData.status) {
      throw new Error("Paystack error: " + payData.message);
    }

    // 2️⃣ Save pending transaction to Firebase via REST
    await fetch(`${FIREBASE_DB_URL}/transactions/${encodeURIComponent(userId)}.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference: payData.data.reference,
        amount,
        status: "pending",
        createdAt: new Date().toISOString(),
      }),
    });

    // 3️⃣ Return Paystack checkout URL
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "ok",
        reference: payData.data.reference,
        checkoutUrl: payData.data.authorization_url,
      }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
