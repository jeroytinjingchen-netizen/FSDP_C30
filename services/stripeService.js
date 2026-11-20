// services/stripeService.js - Stripe Checkout for packages and webhook processing.
// Students pay for a package with Stripe test-mode Checkout. Stripe then calls our webhook, and
// the webhook records the payment. A Successful payment also creates the student's package.
// Each webhook event id is stored once in stripe_events, and everything is written in one
// transaction, so a replayed or retried event cannot record the same payment twice.
const Stripe = require('stripe');
const pool = require('../dbConfig');

// The Stripe client is created on first use so the server can start without a Stripe key.
let stripe = null;

function getStripe() {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

// Creates a hosted Checkout page for one package and returns its URL.
// The student and package ids travel in "metadata" so the webhook knows who bought what.
async function createCheckoutForPackage(student, pkg, { returnPath = '/student' } = {}) {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: pkg.currency.toLowerCase(),
          unit_amount: pkg.price_cents,
          product_data: { name: pkg.name },
        },
      },
    ],
    metadata: { student_id: student.id, package_id: pkg.id },
    success_url: `${baseUrl}${returnPath}?paid=1`,
    cancel_url: `${baseUrl}${returnPath}`,
  });
  return { url: session.url, sessionId: session.id };
}

// Writes a Successful payment and the package it activates. Runs inside the caller's transaction.
// paid_at is the exact time the customer pays. The database generates the ST-00001-style reference.
async function recordSuccessfulPayment(client, session) {
  const { student_id: studentId, package_id: packageId } = session.metadata || {};
  if (!studentId || !packageId) return;

  const payment = await client.query(
    `INSERT INTO payments
        (student_id, package_id, amount_cents, channel, status,
         paid_at, stripe_checkout_session, stripe_payment_intent)
     VALUES ($1, $2, $3, 'STRIPE', 'COMPLETED', now(), $4, $5)
     ON CONFLICT DO NOTHING
     RETURNING id, paid_at`,
    [
      studentId,
      packageId,
      session.amount_total,
      session.id,
      session.payment_intent || null,
    ]
  );
  // No row means this checkout was already recorded, so there is nothing more to do.
  if (payment.rowCount === 0) return;

  // The package starts on the payment date and expires after its validity period.
  // make_interval(weeks => n) builds an interval such as "11 weeks".
  await client.query(
    `INSERT INTO student_packages (student_id, package_id, payment_id, name, sessions_total, purchased_at, expires_at)
     SELECT $1, pk.id, $2, pk.name, pk.sessions_total, $3::timestamptz,
            $3::timestamptz + make_interval(weeks => pk.validity_weeks)
       FROM packages pk
      WHERE pk.id = $4`,
    [studentId, payment.rows[0].id, payment.rows[0].paid_at, packageId]
  );
}

// Writes a Failed payment so the admin can explain why a package did not start.
// A Failed payment never activates a package, but it still names the package the student tried to buy.
async function recordFailedPayment(client, session) {
  const { student_id: studentId, package_id: packageId } = session.metadata || {};
  if (!studentId || !packageId) return;

  await client.query(
    `INSERT INTO payments
        (student_id, package_id, amount_cents, channel, status, notes, stripe_checkout_session)
     VALUES ($1, $2, $3, 'STRIPE', 'FAILED', $4, $5)
     ON CONFLICT DO NOTHING`,
    [studentId, packageId, session.amount_total, 'Payment did not complete.', session.id]
  );
}

// Processes one verified Stripe event. Returns 'PROCESSED' or 'DUPLICATE'.
async function handleStripeEvent(event) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Store the event id first. If it is already there, this event was handled before.
    const seen = await client.query(
      `INSERT INTO stripe_events (id, type) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING RETURNING id`,
      [event.id, event.type]
    );
    if (seen.rowCount === 0) {
      await client.query('ROLLBACK');
      return 'DUPLICATE';
    }

    const session = event.data.object;
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      // Only sessions that actually settled count. Some payment methods settle later.
      if (session.payment_status === 'paid') await recordSuccessfulPayment(client, session);
    } else if (event.type === 'checkout.session.async_payment_failed' || event.type === 'checkout.session.expired') {
      await recordFailedPayment(client, session);
    }

    await client.query('COMMIT');
    return 'PROCESSED';
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getStripe, createCheckoutForPackage, handleStripeEvent };
