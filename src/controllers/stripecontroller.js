import stripe from '../utils/stripe.js';
import Order from '../models/Order.js';
import { sendInvoiceEmail } from '../utils/mailer.js';

/**
 * Créer un PaymentIntent Stripe SANS sauvegarder la commande
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
      deliveryTime,
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

    // Calcul des articles
    const orderItems = items.map((item) => {
      const total = item.price * item.quantity;
      return {
        productId: item.productId,
        variantId: item.variantId,
        productTitle: item.name,
        variantName: item.variantUnit || '',
        unitType: item.unitType || 'piece',
        grams: item.grams || null,
        quantity: item.quantity,
        price: item.price,
        total,
        image: item.image || '',
        currency: item.currency || 'EUR',
      };
    });

    // Calcul du montant total
    const totalAmount =
      orderItems.reduce((sum, i) => sum + i.total, 0) +
      deliveryFee -
      (discountAmount || 0);

    if (totalAmount <= 0)
      return res.status(400).json({ message: 'Montant total invalide' });

    // Préparer les données de commande pour les métadonnées
    const orderData = {
      items: orderItems,
      customer: {
        fullName: customer.fullName || customer.name || 'Inconnu',
        email: customer.email,
        phone: customer.phone,
        isAdmin: customer.isAdmin || false,
      },
      pickupType,
      pickupLocation: pickupType === 'store' ? pickupLocationDetails : undefined,
      deliveryAddress: pickupType === 'delivery' ? deliveryAddress : undefined,
      deliveryTime: pickupType === 'delivery' ? deliveryTime : undefined,
      deliveryFee,
      amount: totalAmount,
      currency: currency.toUpperCase(),
      notes,
      discountCode: discountCode || '',
      discountAmount: discountAmount || 0,
    };

    // Créer PaymentIntent Stripe avec toutes les données dans les métadonnées
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100), // en cents
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      receipt_email: customer.email,
      metadata: {
        orderData: JSON.stringify(orderData), // Stocker toutes les données ici
        paymentMethod: 'stripe'
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
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
 * Gérer le webhook Stripe - CRÉER la commande seulement après paiement réussi
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
        
        try {
          // Récupérer les données de commande depuis les métadonnées
          const orderData = JSON.parse(pi.metadata.orderData);
          
          // CRÉER la commande maintenant que le paiement est confirmé
          const order = await Order.create({
            ...orderData,
            status: 'payé', // Directement payé puisque le paiement a réussi
            paymentMethod: 'stripe',
            stripePaymentIntentId: pi.id,
          });

          console.log('✅ Commande créée après paiement réussi:', order._id);
          
          // Envoyer la facture
          await sendInvoiceEmailSafely(order);
          
        } catch (parseError) {
          console.error('❌ Erreur lors de la création de commande:', parseError);
          // Le paiement a réussi mais on n'a pas pu créer la commande
          // Log this for manual intervention
          console.error('URGENT: Paiement réussi mais commande non créée!', {
            paymentIntentId: pi.id,
            customerEmail: pi.receipt_email,
            amount: pi.amount,
            metadata: pi.metadata
          });
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        console.log('❌ Paiement échoué pour PaymentIntent:', pi.id);
        // Pas de commande à supprimer car elle n'a pas été créée
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