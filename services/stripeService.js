// services/stripeService.js
// Stripe Checkout creation and webhook processing.
// Webhook events are stored once in stripe_events, and the payment is recorded in the same
// transaction, so a replayed or retried event cannot record the same payment twice.
const Stripe = require('stripe');
const pool = require('../dbConfig');

let stripe = null;

function getStripe() {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

// Creates a hosted Checkout session for the outstanding balance of one invoice.
async function createCheckoutForInvoice(invoiceId, { returnPath = '/admin/payments' } = {}) {
  const { rows } = await pool.query(
    `SELECT b.id, b.invoice_number, b.outstanding_cents, i.currency, s.email
       FROM invoice_balances b
       JOIN invoices i ON i.id = b.id
       JOIN students s ON s.id = b.student_id
      WHERE b.id = $1`,
    [invoiceId]
  );
  if (!rows.length) return { error: 'NOT_FOUND' };
  const inv = rows[0];
  if (inv.outstanding_cents <= 0) return { error: 'NO_BALANCE' };

  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: inv.currency.toLowerCase(),
          unit_amount: inv.outstanding_cents,
          product_data: { name: `Invoice ${inv.invoice_number}` },
        },
      },
    ],
    customer_email: inv.email || undefined,
    // The invoice id travels with the session so the webhook knows which invoice to update.
    metadata: { invoice_id: inv.id },
    success_url: `${baseUrl}${returnPath}?paid=${inv.id}`,
    cancel_url: `${baseUrl}${returnPath}`,
  });
  return { url: session.url, sessionId: session.id };
}

// Recalculates the invoice status after a payment, the same rule billingModel.recordPayment uses.
async function refreshInvoiceStatus(client, invoiceId) {
  const { rows } = await client.query(
    `SELECT i.amount_cents - COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'COMPLETED'), 0) AS outstanding
       FROM invoices i LEFT JOIN payments p ON p.invoice_id = i.id
      WHERE i.id = $1 GROUP BY i.amount_cents`,
    [invoiceId]
  );
  const newStatus = Number(rows[0].outstanding) <= 0 ? 'PAID' : 'PARTIALLY_PAID';
  await client.query(
    `UPDATE invoices
        SET status = $2::invoice_status,
            paid_at = CASE WHEN $2::text = 'PAID' THEN now() ELSE NULL END
      WHERE id = $1`,
    [invoiceId, newStatus]
  );
}

// Processes one verified Stripe event. Returns 'PROCESSED' or 'DUPLICATE'.
async function handleStripeEvent(event) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const seen = await client.query(
      `INSERT INTO stripe_events (id, type) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING RETURNING id`,
      [event.id, event.type]
    );
    if (seen.rowCount === 0) {
      await client.query('ROLLBACK');
      return 'DUPLICATE';
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const invoiceId = session.metadata && session.metadata.invoice_id;
      // Only sessions that actually settled are recorded. Async methods finish later.
      if (invoiceId && session.payment_status === 'paid') {
        await client.query('SELECT id FROM invoices WHERE id = $1 FOR UPDATE', [invoiceId]);
        await client.query(
          `INSERT INTO payments (invoice_id, amount_cents, channel, status, reference, stripe_checkout_session, stripe_payment_intent)
           VALUES ($1, $2, 'STRIPE', 'COMPLETED', $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [invoiceId, session.amount_total, session.id, session.id, session.payment_intent || null]
        );
        await refreshInvoiceStatus(client, invoiceId);
      }
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

module.exports = { getStripe, createCheckoutForInvoice, handleStripeEvent };
