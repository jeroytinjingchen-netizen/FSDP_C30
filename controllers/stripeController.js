// controllers/stripeController.js - the public Stripe webhook.
const { getStripe, handleStripeEvent } = require('../services/stripeService');

// POST /api/billing/webhook. Stripe calls this after a Checkout session ends.
// The body must be the raw Buffer (not parsed JSON) so the signature can be checked.
// The signature is the only protection, because Stripe has no admin session.
async function webhook(req, res) {
  let event;
  try {
    // constructEvent throws if the signature does not match STRIPE_WEBHOOK_SECRET.
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
    // A non-2xx reply makes Stripe retry the event later.
    console.error('Stripe webhook processing failed:', err.message);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
}

module.exports = { webhook };
