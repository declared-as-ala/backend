// src/controllers/stripeController.js
import stripe from '../utils/stripe.js';
import Order from '../models/Order.js';
import { sendInvoiceEmail } from '../utils/mailer.js';

/**
 * Create a PaymentIntent and automatically create an Order
 */
export const createPaymentIntent = async (req, res) => {
  try {
    const {
      amount,
      currency = 'EUR',
      customer,
      items,
      pickupType,
      deliveryFee = 0,
      pickupLocationDetails,
      deliveryAddress,
      notes,
      discountCode,
      discountAmount = 0,
    } = req.body;

    // ✅ Validate required fields
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    if (!customer || !customer.email || !customer.phone) {
      return res
        .status(400)
        .json({ message: 'Customer info missing or phone not provided' });
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

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Items are required' });
    }

    // Map items to match new schema
    const orderItems = items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      name: item.name,
      variantUnit: item.variantUnit,
      quantity: item.quantity,
      price: item.price,
      currency: item.currency || 'EUR',
      image: item.image || '',
    }));

    // Calculate total amount if needed
    const totalAmount =
      orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0) +
      deliveryFee -
      (discountAmount || 0);

    // Convert amount to cents for Stripe
    const amountInCents = Math.round(amount * 100);

    // Prepare metadata for Stripe
    const metadata = {
      pickupType,
      deliveryFee: deliveryFee.toString(),
      amountEur: amount.toString(),
      orderId: '', // Will update after order creation
    };

    if (pickupLocationDetails) {
      metadata.pickupLocationId = pickupLocationDetails.id;
      metadata.pickupLocationName = pickupLocationDetails.name;
      metadata.pickupLocationAddress = pickupLocationDetails.address;
    }

    if (deliveryAddress) {
      metadata.deliveryStreet = deliveryAddress.street || '';
      metadata.deliveryCity = deliveryAddress.city || '';
      metadata.deliveryPostalCode = deliveryAddress.postalCode || '';
      metadata.deliveryCountry = deliveryAddress.country || '';
    }

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      receipt_email: customer.email,
      metadata,
    });

    // Prepare order data
    const orderData = {
      items: orderItems,
      customer: {
        fullName: customer.name || customer.fullName || 'Unknown',
        email: customer.email,
        phone: customer.phone,
      },
      pickupType,
      pickupLocation:
        pickupType === 'store' ? pickupLocationDetails : undefined,
      deliveryAddress: pickupType === 'delivery' ? deliveryAddress : undefined,
      deliveryFee,
      amount, // keep in EUR
      currency: currency.toUpperCase(),
      status: 'pending',
      stripePaymentIntentId: paymentIntent.id,
      notes,
      discountCode: discountCode || '',
      discountAmount: discountAmount || 0,
    };

    // Save order in DB
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
      amount: `${order.amount} EUR`,
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
export const handleStripeWebhook = async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];

    // Stripe requires raw body buffer
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log('✅ Webhook event received:', event.type);

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      console.log('💳 Payment succeeded for PaymentIntent:', pi.id);

      const order = await Order.findOneAndUpdate(
        { stripePaymentIntentId: pi.id },
        { status: 'paid' },
        { new: true }
      );

      if (order) await sendInvoiceEmailSafely(order);
    } else if (event.type === 'charge.succeeded') {
      const charge = event.data.object;
      const order = await Order.findOneAndUpdate(
        { stripePaymentIntentId: charge.payment_intent },
        { status: 'paid' },
        { new: true }
      );

      if (order) await sendInvoiceEmailSafely(order);
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
  }
}
