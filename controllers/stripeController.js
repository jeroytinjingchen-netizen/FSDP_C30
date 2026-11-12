// controllers/stripeController.js
const { getStripe, createCheckoutForInvoice, handleStripeEvent } = require('../services/stripeService');

// Admin: creates a Checkout link for an invoice's outstanding balance.
async function createCheckout(req, res, next) {
  try {
    const result = await createCheckoutForInvoice(req.params.id);
    if (result.error === 'NOT_FOUND') return res.status(404).json({ error: 'Invoice not found.' });
    if (result.error === 'NO_BALANCE') return res.status(400).json({ error: 'Invoice has no outstanding balance.' });
    res.json({ url: result.url, sessionId: result.sessionId });
  } catch (err) {
    next(err);
  }
}

// Public Stripe webhook. The body must be the raw Buffer so the signature can be checked.
async function webhook(req, res) {
  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }
  try {
    const result = await handleStripeEvent(event);
    res.json({ received: true, result });
  } catch (err) {
    // Non-2xx makes Stripe retry the event later.
    console.error('Stripe webhook processing failed:', err.message);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
}

module.exports = { createCheckout, webhook };
