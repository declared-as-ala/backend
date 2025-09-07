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
      deliveryFee = 0,
      discountCode,
      discountAmount = 0,
      notes,
      paymentMethod,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Le panier est vide' });
    }

    if (!['stripe', 'paypal', 'espèces'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Mode de paiement invalide' });
    }

    let totalAmount = 0;

    const formattedItems = await Promise.all(
      items.map(async (item) => {
        const product = await Product.findById(item.productId);
        if (!product)
          throw new Error(`Produit avec l'ID ${item.productId} introuvable`);

        const variant = product.variants.find((v) => v.id === item.variant_id);
        if (!variant)
          throw new Error(
            `Variante ${item.variant_id} introuvable pour ${product.title}`
          );

        if (variant.stock < item.quantity)
          throw new Error(
            `Stock insuffisant pour ${product.title} (${variant.unit})`
          );

        const subtotal = variant.price * item.quantity;
        totalAmount += subtotal;

        return {
          productId: product.id,
          variantId: variant.id,
          name: product.title,
          variantUnit: variant.unit,
          quantity: item.quantity,
          price: variant.price,
          currency: variant.currency,
          image: product.image,
        };
      })
    );

    totalAmount = totalAmount + deliveryFee - discountAmount;

    const order = await Order.create({
      items: formattedItems,
      customer,
      pickupType,
      pickupLocation,
      deliveryAddress,
      deliveryFee,
      amount: totalAmount,
      currency: 'EUR',
      discountCode,
      discountAmount,
      notes,
      paymentMethod,
    });

    res
      .status(201)
      .json({ message: 'Commande créée avec succès', data: order });
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
    if (!order)
      return res.status(404).json({ message: 'Commande introuvable' });

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
    if (!order)
      return res.status(404).json({ message: 'Commande introuvable' });

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
