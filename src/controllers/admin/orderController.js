import Order from "../../models/Order.js";

const parsePagination = (q) => {
  const page = Math.max(parseInt(q.page) || 1, 1);
  const limit = Math.min(parseInt(q.limit) || 20, 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

// ✅ Get all orders (with filters + pagination)
export const getAllOrders = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { status, pickupType, paymentMethod, email, from, to, q } = req.query;
    const sortBy = req.query.sortBy || "createdAt";
    const sortDir = req.query.sortDir === "asc" ? 1 : -1;

    const filter = {};
    if (status) filter.status = status;
    if (pickupType) filter.pickupType = pickupType;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (email) filter["customer.email"] = email;

    // Date filtering
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    // Search by multiple fields
    if (q) {
      filter.$or = [
        { "customer.fullName": new RegExp(q, "i") },
        { "customer.email": new RegExp(q, "i") },
        { "items.name": new RegExp(q, "i") },
        { discountCode: new RegExp(q, "i") },
      ];
    }

    const [items, total] = await Promise.all([
      Order.find(filter)
        .sort({ [sortBy]: sortDir })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching orders", error: err.message });
  }
};

// ✅ Get order by ID
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Update order status
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    const allowedStatuses = ["en_attente", "payé", "terminé", "annulé"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.status = status;

    // If status is "terminé" mark as delivered automatically
    if (status === "terminé") order.isDelivered = true;

    await order.save();
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ✅ Delete order
export const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    await Order.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Order deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔄 Mark order as delivered (optional helper)
export const markDelivered = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const saved = await order.marquerLivree();
    res.json({ success: true, data: saved });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ✍️ Update delivery address, pickup location, or notes
export const updateLogistics = async (req, res) => {
  try {
    const { deliveryAddress, pickupLocation, notes, deliveryFee } =
      req.body || {};

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (deliveryAddress)
      order.deliveryAddress = {
        ...order.deliveryAddress?.toObject?.(),
        ...deliveryAddress,
      };

    if (pickupLocation)
      order.pickupLocation = {
        ...order.pickupLocation?.toObject?.(),
        ...pickupLocation,
      };

    if (typeof notes === "string") order.notes = notes;
    if (typeof deliveryFee === "number") order.deliveryFee = deliveryFee;

    await order.save();
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ❌ Cancel order (optional, kept for admins)
export const cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body || {};
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.status = "annulé";
    order.notes = [order.notes, reason].filter(Boolean).join(" | ");
    await order.save();

    res.json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
