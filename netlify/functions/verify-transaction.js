// netlify/functions/verify-transaction.js
export async function handler(event) {
  try {
    const { reference, userId } = JSON.parse(event.body);

    if (!reference || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing reference or userId" }),
      };
    }

    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    const FIREBASE_DB_URL = process.env.FIREBASE_DATABASE_URL;

    // 1️⃣ Verify payment with Paystack
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const verifyData = await verifyRes.json();
    if (!verifyData.status || verifyData.data.status !== "success") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Transaction not verified" }),
      };
    }

    const amount = verifyData.data.amount / 100;

    // 2️⃣ Get current balance from Firebase
    const userRes = await fetch(`${FIREBASE_DB_URL}/users/${userId}.json`);
    const userData = await userRes.json();
    const oldBalance = userData?.balance || 0;
    const newBalance = oldBalance + amount;

    // 3️⃣ Update user balance
    await fetch(`${FIREBASE_DB_URL}/users/${userId}.json`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balance: newBalance }),
    });

    // 4️⃣ Save transaction record
    await fetch(`${FIREBASE_DB_URL}/transactions/${userId}.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference,
        amount,
        status: "success",
        verifiedAt: new Date().toISOString(),
      }),
    });

    // 5️⃣ Done
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "ok",
        balance: newBalance,
        message: "Payment verified successfully",
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
