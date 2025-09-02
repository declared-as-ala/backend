// controllers/admin/dashboardController.js
import Order from "../../models/Order.js";
import Customer from "../../models/Customer.js";
import Product from "../../models/Product.js";
import DiscountCode from "../../models/DiscountCode.js";

// Existing: getDashboardStats
export const getDashboardStats = async (req, res) => {
  try {
    const [totalOrders, totalCustomers, totalProducts, activeDiscounts] =
      await Promise.all([
        Order.countDocuments({}),
        Customer.countDocuments({}),
        Product.countDocuments({}),
        DiscountCode.countDocuments({ active: true }),
      ]);

    const revenueAgg = await Order.aggregate([
      { $match: { status: { $in: ["payé", "terminé"] } } },
      { $group: { _id: null, revenue: { $sum: "$amount" } } },
    ]);

    const ordersByStatus = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const last30DaysSales = await Order.aggregate([
      {
        $match: {
          status: { $in: ["payé", "terminé"] },
          createdAt: { $gte: new Date(Date.now() - 30 * 86400000) },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$amount" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const topProducts = await Order.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          name: { $first: "$items.name" },
          totalQty: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        },
      },
      { $sort: { totalQty: -1 } },
      { $limit: 5 },
    ]);

    const topCustomers = await Order.aggregate([
      { $match: { status: { $in: ["payé", "terminé"] } } },
      {
        $group: {
          _id: "$customer.email",
          fullName: { $first: "$customer.fullName" },
          orders: { $sum: 1 },
          spent: { $sum: "$amount" },
        },
      },
      { $sort: { spent: -1 } },
      { $limit: 5 },
    ]);

    res.json({
      success: true,
      stats: {
        totalOrders,
        totalCustomers,
        totalProducts,
        activeDiscounts,
        totalRevenue: revenueAgg[0]?.revenue || 0,
        ordersByStatus,
        last30DaysSales,
        topProducts,
        topCustomers,
      },
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching stats", error: err.message });
  }
};

// NEW: getRecentOrders
export const getRecentOrders = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const orders = await Order.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("customer", "fullName email");
    res.json({ success: true, data: orders });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching recent orders", error: err.message });
  }
};
