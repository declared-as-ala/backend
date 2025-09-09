import Order from '../models/Order.js';
import Product from '../models/Product.js';
import mongoose from 'mongoose';

/**
 * Créer une nouvelle commande
 * POST /api/orders
 */
export const createOrder = async (req, res) => {
  try {
    const {
      items,
      customer,
      pickupType,
      pickupLocation,
      deliveryAddress,
      deliveryTime, // 🆕 added
      deliveryFee = 0,
      discountCode,
      discountAmount = 0,
      notes,
      paymentMethod,
    } = req.body;

    // Vérification des champs obligatoires
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Le panier est vide' });
    }

    if (!['stripe', 'paypal', 'espèces'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Mode de paiement invalide' });
    }

    // Vérification du deliveryTime si livraison
    if (pickupType === 'delivery' && !deliveryTime) {
      return res.status(400).json({ message: "Veuillez choisir l'heure de livraison" });
    }

    let totalAmount = 0;

    // Préparer les items formatés
    const formattedItems = await Promise.all(
      items.map(async (item) => {
        const product = await Product.findById(item.productId);
        if (!product) {
          throw new Error(`Produit avec l'ID ${item.productId} introuvable`);
        }

        const variant = product.variants.find(
          (v) => v.variant_id === item.variantId
        );
        if (!variant) {
          throw new Error(
            `Variante ${item.variantId} introuvable pour ${product.title}`
          );
        }

        // Calcul du sous-total
        const subtotal = variant.price * item.quantity;
        totalAmount += subtotal;

        return {
          productId: product._id,
          variantId: variant.variant_id,
          productTitle: product.title,
          variantName: variant.variant_name || '',
          unitType: variant.unit_type,
          grams: variant.grams || null,
          quantity: item.quantity,
          price: variant.price,
          total: subtotal,
          image: product.Image,
          currency: 'EUR',
        };
      })
    );

    // Calcul du montant total
    totalAmount = totalAmount + deliveryFee - discountAmount;

    // Créer la commande
    const order = await Order.create({
      items: formattedItems,
      customer,
      pickupType,
      pickupLocation,
      deliveryAddress,
      deliveryTime, // 🆕 included
      deliveryFee,
      amount: totalAmount,
      currency: 'EUR',
      discountCode,
      discountAmount,
      notes,
      paymentMethod,
    });

    res.status(201).json({
      message: 'Commande créée avec succès',
      data: order,
    });
  } catch (err) {
    console.error('[createOrder] Erreur :', err);
    res
      .status(400)
      .json({ message: err.message || 'Échec de la création de la commande' });
  }
};


/**
 * Récupérer toutes les commandes (admin)
 * GET /api/orders
 */
export const getAllOrders = async (req, res) => {
  try {
    const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) > 0 ? Number(req.query.limit) : 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments();

    res.json({
      data: orders,
      page,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('[getAllOrders] Erreur :', err);
    res.status(500).json({ message: 'Échec de récupération des commandes' });
  }
};

/**
 * Récupérer les commandes du client connecté
 * GET /api/orders/my
 */
export const getMyOrders = async (req, res) => {
  try {
    if (!req.customer?.email) {
      return res.status(401).json({ message: 'Non autorisé : email manquant' });
    }

    const email = req.customer.email;
    const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) > 0 ? Number(req.query.limit) : 10;
    const skip = (page - 1) * limit;

    const query = { 'customer.email': email };

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments(query);

    res.json({
      data: orders,
      page,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('[getMyOrders] Erreur :', err);
    res.status(500).json({ message: 'Échec de récupération des commandes' });
  }
};

/**
 * Récupérer une commande par ID (admin ou propriétaire)
 * GET /api/orders/:id
 */
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID de commande invalide' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Commande introuvable' });
    }

    // Vérification de l'accès
    if (
      !req.customer?.isAdmin &&
      order.customer.email !== req.customer?.email
    ) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    res.json(order);
  } catch (err) {
    console.error('[getOrderById] Erreur :', err);
    res.status(500).json({ message: 'Échec de récupération de la commande' });
  }
};

/**
 * Mettre à jour le statut / livraison
 * PATCH /api/orders/:id/status
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, markDelivered } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Commande introuvable' });
    }

    if (status) order.status = status;

    if (markDelivered && order.pickupType === 'delivery') {
      order.isDelivered = true;
      order.status = 'terminé';
    }

    await order.save();

    res.json({ message: 'Commande mise à jour', data: order });
  } catch (err) {
    console.error('[updateOrderStatus] Erreur :', err);
    res.status(500).json({ message: 'Échec de mise à jour de la commande' });
  }
};
