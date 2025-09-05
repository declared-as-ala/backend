import Order from "../../models/Order.js";

/**
 * @desc Get all orders with pagination + search
 * @route GET /api/admin/orders?search=&page=&limit=
 */
export const getOrders = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim();

    const filter = {};

    // 🔍 Search by customer fullName, email, phone, or order _id
    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { "customer.fullName": regex },
        { "customer.email": regex },
        { "customer.phone": regex },
        { _id: regex }, // search by order ID
      ];
    }

    // Fetch paginated orders and total count
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc Get single order by ID
 * @route GET /api/admin/orders/:id
 */
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id).lean();

    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    res.json({ success: true, data: order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc Update order status
 * @route PUT /api/admin/orders/:id/status
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["en_attente", "payé", "terminé", "annulé"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    const order = await Order.findById(id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    order.status = status;

    // Auto-update delivery status
    if (
      order.pickupType === "delivery" &&
      (status === "payé" || status === "terminé")
    ) {
      order.isDelivered = true;
    }

    await order.save();
    res.json({ success: true, data: order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc Toggle delivery status
 * @route PUT /api/admin/orders/:id/delivery
 */
export const toggleDelivery = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    order.isDelivered = !order.isDelivered;

    if (order.isDelivered) order.status = "terminé";
    else if (!order.isDelivered && order.status === "terminé")
      order.status = "payé";

    await order.save();
    res.json({ success: true, data: order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc Delete order by ID
 * @route DELETE /api/admin/orders/:id
 */
export const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findByIdAndDelete(id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    res.json({ success: true, message: "Order deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
