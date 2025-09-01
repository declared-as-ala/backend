import stripe from '../utils/stripe.js';
import Order from '../models/Order.js';
import { sendInvoiceEmail } from '../utils/mailer.js';

/**
 * Créer un PaymentIntent Stripe et sauvegarder la commande
 * POST /api/stripe/create-payment-intent
 */
export const createPaymentIntent = async (req, res) => {
  try {
    const {
      items,
      customer,
      pickupType,
      pickupLocationDetails,
      deliveryAddress,
      deliveryFee = 0,
      notes,
      discountCode,
      discountAmount = 0,
      currency = 'EUR',
    } = req.body;

    // Validation de base
    if (!items || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: 'Le panier est vide' });

    if (!customer?.email || !customer?.phone)
      return res
        .status(400)
        .json({ message: 'Informations client manquantes' });

    if (!pickupType || !['store', 'delivery'].includes(pickupType))
      return res.status(400).json({ message: 'Type de retrait invalide' });

    if (pickupType === 'store' && !pickupLocationDetails)
      return res
        .status(400)
        .json({ message: 'Informations du magasin manquantes' });

    if (pickupType === 'delivery' && !deliveryAddress)
      return res
        .status(400)
        .json({ message: 'Adresse de livraison manquante' });

    // Calcul du montant total
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

    const totalAmount =
      orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0) +
      deliveryFee -
      (discountAmount || 0);

    if (totalAmount <= 0)
      return res.status(400).json({ message: 'Montant total invalide' });

    // Créer PaymentIntent Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100), // en cents
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      receipt_email: customer.email,
    });

    // Préparer la commande pour la BDD
    const orderData = {
      items: orderItems,
      customer: {
        fullName: customer.fullName || customer.name || 'Inconnu',
        email: customer.email,
        phone: customer.phone,
      },
      pickupType,
      pickupLocation:
        pickupType === 'store' ? pickupLocationDetails : undefined,
      deliveryAddress: pickupType === 'delivery' ? deliveryAddress : undefined,
      deliveryFee,
      amount: totalAmount,
      currency: currency.toUpperCase(),
      status: 'en_attente', // statut par défaut
      paymentMethod: 'stripe',
      stripePaymentIntentId: paymentIntent.id,
      notes,
      discountCode: discountCode || '',
      discountAmount: discountAmount || 0,
    };

    const order = await Order.create(orderData);

    // Mettre à jour PaymentIntent metadata avec orderId
    await stripe.paymentIntents.update(paymentIntent.id, {
      metadata: { orderId: order._id.toString() },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      orderId: order._id,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error('[createPaymentIntent] Erreur:', err);
    res.status(500).json({
      message: 'Échec de création du PaymentIntent',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

/**
 * Gérer le webhook Stripe pour mettre à jour la commande après paiement
 * POST /api/stripe/webhook
 */
export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('❌ Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;

        const order = await Order.findOneAndUpdate(
          { stripePaymentIntentId: pi.id },
          { status: 'payé' },
          { new: true }
        );

        if (order) await sendInvoiceEmailSafely(order);

        break;
      }

      case 'charge.succeeded': {
        const charge = event.data.object;

        const order = await Order.findOneAndUpdate(
          { stripePaymentIntentId: charge.payment_intent },
          { status: 'payé' },
          { new: true }
        );

        if (order) await sendInvoiceEmailSafely(order);
        break;
      }

      default:
        console.log('⚠️ Webhook non géré:', event.type);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('❌ Stripe webhook processing error:', err.message);
    res.status(500).send(`Webhook processing failed: ${err.message}`);
  }
};

// Fonction helper pour envoyer facture sans casser le webhook
async function sendInvoiceEmailSafely(order) {
  try {
    await sendInvoiceEmail(order.customer.email, order);
    console.log('📧 Facture envoyée à:', order.customer.email);
  } catch (err) {
    console.error('❌ Échec envoi facture:', err.message);
  }
}
