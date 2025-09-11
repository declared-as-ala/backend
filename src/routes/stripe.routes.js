import { Router } from 'express';
import {
  createPaymentIntent,
  handleStripeWebhook,
} from '../controllers/stripecontroller.js';

const router = Router();

// ---------------- STRIPE ----------------

// Route pour créer un PaymentIntent (JSON normal)
router.post('/stripe/create-intent', createPaymentIntent);

// Webhook Stripe - Raw body handling is done in app.js
// No need for express.raw() here since it's handled globally
router.post('/stripe/webhook', handleStripeWebhook);



export default router;
