// src/controllers/orderController.js
import Order from '../models/Order.js';

/**
 * Get all orders (admin)
 */
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ data: orders });
  } catch (err) {
    console.error('[getAllOrders] Error:', err);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
};

/**
 * Get orders for logged-in customer
 */
export const getMyOrders = async (req, res) => {
  try {
    console.log('🔹 JWT decoded req.customer:', req.customer);

    const email = req.customer.email;
    console.log('🔹 Searching orders for email:', email);

    const orders = await Order.find({ 'customer.email': email }).sort({
      createdAt: -1,
    });

    console.log('🔹 Orders found:', orders);

    res.json({ data: orders });
  } catch (err) {
    console.error('[getMyOrders] Error:', err);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
};

/**
 * Get single order by ID (admin or the owner)
 */
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the order by its ID
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // If not admin, verify that the requester is the owner
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
