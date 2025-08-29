// routes/paypal.routes.js
import { Router } from 'express';
import {
  createPayPalOrder,
  capturePayPalOrder,
  handlePayPalReturn,
  handlePayPalCancel,
  getOrderStatus
} from '../controllers/paypal.controller.js';
import { validatePayPalOrder, rateLimitPayPal, securePayPalEndpoint } from '../middleware/paypal.middleware.js';

const router = Router();

// Apply security and rate limiting to all PayPal routes
router.use(securePayPalEndpoint);

// Different rate limiting based on environment
const isDevelopment = process.env.NODE_ENV === 'development';
if (!isDevelopment) {
  router.use(rateLimitPayPal);
}

/**
 * @route   POST /api/payments/paypal/create-order
 * @desc    Create a new PayPal order
 * @access  Public (but should be protected by authentication in production)
 */
router.post('/create-order', validatePayPalOrder, createPayPalOrder);

/**
 * @route   POST /api/payments/paypal/capture-order
 * @desc    Capture a PayPal payment
 * @access  Public (but should be protected by authentication in production)
 */
router.post('/capture-order', capturePayPalOrder);

/**
 * @route   GET /api/payments/paypal/return
 * @desc    Handle successful PayPal payment return
 * @access  Public
 */
router.get('/return', handlePayPalReturn);

/**
 * @route   GET /api/payments/paypal/cancel
 * @desc    Handle cancelled PayPal payment
 * @access  Public
 */
router.get('/cancel', handlePayPalCancel);

/**
 * @route   GET /api/payments/paypal/order-status/:orderId
 * @desc    Get order status
 * @access  Public (but should be protected by authentication in production)
 */
router.get('/order-status/:orderId', getOrderStatus);

export default router;