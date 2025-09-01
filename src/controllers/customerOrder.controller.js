import Order from '../models/Order.js';
import Product from '../models/Product.js';
import mongoose from 'mongoose';

/**
 * Place a new order
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
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Your cart is empty' });
    }

    let totalAmount = 0;

    // Build formatted items with correct variant info
    const formattedItems = await Promise.all(
      items.map(async (item) => {
        const product = await Product.findById(item.productId);
        if (!product) {
          throw new Error(`Product with ID ${item.productId} not found`);
        }

        const variant = product.variants.find((v) => v.id === item.variantId);
        if (!variant) {
          throw new Error(
            `Variant ${item.variantId} not found for product ${product.title}`
          );
        }

        if (variant.stock < item.quantity) {
          throw new Error(
            `Insufficient stock for ${product.title} (${variant.unit})`
          );
        }

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

    // Add delivery fee and subtract discount
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
    });

    res.status(201).json({ message: 'Order placed successfully', data: order });
  } catch (err) {
    console.error('[createOrder] Error:', err);
    res.status(400).json({ message: err.message || 'Failed to create order' });
  }
};

/**
 * Get all orders (admin)
 * GET /api/orders
 * Supports pagination
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
    console.error('[getAllOrders] Error:', err);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
};

/**
 * Get orders for logged-in customer
 * GET /api/orders/my
 * Supports pagination
 */
export const getMyOrders = async (req, res) => {
  try {
    if (!req.customer?.email) {
      return res.status(401).json({ message: 'Unauthorized: email missing' });
    }

    const email = req.customer.email;
    const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
    const limit = Number(req.query.limit) > 0 ? Number(req.query.limit) : 10;
    const skip = (page - 1) * limit;

    // Make sure only orders with valid customer.email are returned
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
    console.error('[getMyOrders] Error:', err);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
};

/**
 * Get single order by ID (admin or owner)
 * GET /api/orders/:id
 */
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Only admin or order owner can access
    if (
      !req.customer?.isAdmin &&
      order.customer.email !== req.customer?.email
    ) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(order);
  } catch (err) {
    console.error('[getOrderById] Error:', err);
    res.status(500).json({ message: 'Failed to fetch order' });
  }
};
