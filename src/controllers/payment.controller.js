// src/controllers/stripeController.js
import stripe from '../utils/stripe.js';
import Order from '../models/Order.js';
import { sendInvoiceEmail } from '../utils/mailer.js';
/**
 * Create a PaymentIntent and automatically create an Order
 */
export const createPaymentIntent = async (req, res, next) => {
  try {
    const {
      amount,
      currency = 'eur',
      customer,
      items,
      pickupType,
      deliveryFee = 0,
      pickupLocationDetails,
      deliveryAddress,
      notes,
    } = req.body;

    // Validate required fields
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    if (!customer || !customer.email) {
      return res.status(400).json({ message: 'Customer info missing' });
    }

    if (!pickupType || !['store', 'delivery'].includes(pickupType)) {
      return res.status(400).json({ message: 'Invalid pickupType' });
    }

    if (pickupType === 'store' && !pickupLocationDetails) {
      return res
        .status(400)
        .json({ message: 'pickupLocationDetails required for store pickup' });
    }

    if (pickupType === 'delivery' && !deliveryAddress) {
      return res
        .status(400)
        .json({ message: 'deliveryAddress required for delivery' });
    }

    // Validate pickup location structure if provided
    if (pickupLocationDetails) {
      const { id, name, address } = pickupLocationDetails;
      if (!id || !name || !address) {
        return res.status(400).json({
          message: 'pickupLocationDetails must include id, name, and address',
        });
      }
    }

    // Keep amount in EUR (Stripe still requires cents internally, but we handle the conversion)
    const amountInCents = Math.round(amount * 100); // Convert to cents only for Stripe

    // Prepare metadata for Stripe
    const metadata = {
      pickupType,
      deliveryFee: deliveryFee.toString(),
      amountEur: amount.toString(), // Store EUR amount in metadata
      orderId: '', // Will be updated after order creation
    };

    // Add pickup location to metadata if present
    if (pickupLocationDetails) {
      metadata.pickupLocationId = pickupLocationDetails.id;
      metadata.pickupLocationName = pickupLocationDetails.name;
      metadata.pickupLocationAddress = pickupLocationDetails.address;
    }

    // Add delivery address to metadata if present
    if (deliveryAddress) {
      metadata.deliveryStreet = deliveryAddress.street || '';
      metadata.deliveryCity = deliveryAddress.city || '';
      metadata.deliveryPostalCode = deliveryAddress.postalCode || '';
      metadata.deliveryCountry = deliveryAddress.country || '';
    }

    // Create Stripe PaymentIntent (Stripe API requires cents)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents, // Stripe requires cents
      currency,
      automatic_payment_methods: { enabled: true },
      receipt_email: customer.email,
      metadata,
    });

    // Save order in DB with amounts in EUR
    const orderData = {
      items,
      customer: {
        fullName: customer.name || customer.fullName || 'Unknown',
        email: customer.email,
        phone: customer.phone || '',
      },
      pickupType,
      deliveryFee, // Keep in EUR
      amount, // Keep in EUR
      currency: currency.toUpperCase(),
      status: 'pending',
      stripePaymentIntentId: paymentIntent.id,
      notes,
    };

    // Add pickup location or delivery address based on type
    if (pickupType === 'store' && pickupLocationDetails) {
      orderData.pickupLocation = {
        id: pickupLocationDetails.id,
        name: pickupLocationDetails.name,
        address: pickupLocationDetails.address,
        description: pickupLocationDetails.description || '',
      };
    } else if (pickupType === 'delivery' && deliveryAddress) {
      orderData.deliveryAddress = deliveryAddress;
    }

    const order = await Order.create(orderData);

    // Update PaymentIntent metadata with orderId
    await stripe.paymentIntents.update(paymentIntent.id, {
      metadata: {
        ...metadata,
        orderId: order._id.toString(),
      },
    });

    console.log('Order created successfully:', {
      orderId: order._id,
      amount: `${order.amount} EUR`, // Log in EUR
      pickupType: order.pickupType,
      pickupLocation: order.pickupLocation,
      deliveryAddress: order.deliveryAddress,
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      orderId: order._id,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error('[createPaymentIntent] Error:', err);
    res.status(500).json({
      message: 'Payment intent creation failed',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};
/**
 * Handle Stripe webhook to update order status
 */

/**
 * Handle Stripe webhook to update order status
 */
/**
 * Handle Stripe webhook to update order status
 */
export const handleStripeWebhook = async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];

    console.log('Webhook body type:', typeof req.body);
    console.log('Is Buffer:', Buffer.isBuffer(req.body)); // should be true

    const event = stripe.webhooks.constructEvent(
      req.body, // raw body required
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log('✅ Webhook event received:', event.type);

    // Handle both payment_intent.succeeded and charge.succeeded
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      console.log('💳 Payment succeeded for PaymentIntent:', pi.id);

      const order = await Order.findOneAndUpdate(
        { stripePaymentIntentId: pi.id },
        { status: 'paid' },
        { new: true }
      );

      if (order) {
        console.log('📦 Order found and updated:', order._id);
        await sendInvoiceEmailSafely(order);
      } else {
        console.log('⚠️ No order found for PaymentIntent:', pi.id);
      }
    }

    // Handle charge.succeeded event (alternative approach)
    else if (event.type === 'charge.succeeded') {
      const charge = event.data.object;
      console.log(
        '💳 Charge succeeded for PaymentIntent:',
        charge.payment_intent
      );

      const order = await Order.findOneAndUpdate(
        { stripePaymentIntentId: charge.payment_intent },
        { status: 'paid' },
        { new: true }
      );

      if (order) {
        console.log('📦 Order found and updated:', order._id);
        await sendInvoiceEmailSafely(order);
      } else {
        console.log(
          '⚠️ No order found for PaymentIntent:',
          charge.payment_intent
        );
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('❌ Stripe webhook error:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
};

// Helper function to safely send invoice email
async function sendInvoiceEmailSafely(order) {
  try {
    await sendInvoiceEmail(order.customer.email, order);
    console.log('📧 Invoice email sent successfully to:', order.customer.email);
  } catch (emailError) {
    console.error('❌ Failed to send invoice email:', emailError);
    // Don't fail the webhook if email fails
  }
}
