import Order from "../../models/Order.js";
import Customer from "../../models/Customer.js";
import Product from "../../models/Product.js";
import DiscountCode from "../../models/DiscountCode.js";

// ========================
// DASHBOARD MAIN STATS
// ========================
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
          name: { $first: "$items.productTitle" }, // Changed from name to productTitle
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

// ========================
// RECENT ORDERS
// ========================
export const getRecentOrders = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    // Removed populate since customer is embedded, not referenced
    const orders = await Order.find({})
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json({ success: true, data: orders });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching recent orders", error: err.message });
  }
};

// ========================
// SALES BY PAYMENT METHOD
// ========================
export const getSalesByPaymentMethod = async (req, res) => {
  try {
    const sales = await Order.aggregate([
      { $match: { status: { $in: ["payé", "terminé"] } } },
      {
        $group: {
          _id: "$paymentMethod",
          revenue: { $sum: "$amount" },
          orders: { $sum: 1 },
        },
      },
    ]);
    res.json({ success: true, data: sales });
  } catch (err) {
    res
      .status(500)
      .json({
        message: "Error fetching sales by payment method",
        error: err.message,
      });
  }
};

// ========================
// MONTHLY REVENUE TREND
// ========================
export const getMonthlyRevenue = async (req, res) => {
  try {
    const monthly = await Order.aggregate([
      { $match: { status: { $in: ["payé", "terminé"] } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          revenue: { $sum: "$amount" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json({ success: true, data: monthly });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching monthly revenue", error: err.message });
  }
};

// ========================
// TOP CATEGORIES
// ========================
export const getTopCategories = async (req, res) => {
  try {
    const categories = await Order.aggregate([
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $group: {
          _id: "$product.category",
          totalQty: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]);
    res.json({ success: true, data: categories });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching top categories", error: err.message });
  }
};

// ========================
// CUSTOMER GROWTH
// ========================
export const getCustomerGrowth = async (req, res) => {
  try {
    const growth = await Customer.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json({ success: true, data: growth });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching customer growth", error: err.message });
  }
};

// ========================
// LOW STOCK PRODUCTS
// ========================
export const getLowStockProducts = async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 5;
    // Note: Your Product model doesn't have stock fields anymore
    // This function needs to be updated based on your inventory management approach
    // For now, returning empty array until you define how stock is managed
    const products = [];
    
    // If you add stock management back to variants, use this:
    // const products = await Product.find({
    //   "variants.stock": { $lte: threshold },
    // }).select("title variants");
    
    res.json({ 
      success: true, 
      data: products,
      message: "Stock management not implemented in current Product model"
    });
  } catch (err) {
    res
      .status(500)
      .json({
        message: "Error fetching low stock products",
        error: err.message,
      });
  }
};

// ========================
// ORDERS BY HOUR
// ========================
export const getOrdersByHour = async (req, res) => {
  try {
    const hours = await Order.aggregate([
      {
        $group: {
          _id: { $hour: "$createdAt" },
          count: { $sum: 1 },
          revenue: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json({ success: true, data: hours });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching orders by hour", error: err.message });
  }
};

// ========================
// CUSTOMER ACTIVITY
// ========================
export const getCustomerActivity = async (req, res) => {
  try {
    const active = await Order.distinct("customer.email", {
      createdAt: { $gte: new Date(Date.now() - 30 * 86400000) },
    });
    const total = await Customer.countDocuments({});
    res.json({
      success: true,
      data: {
        activeCustomers: active.length,
        inactiveCustomers: total - active.length,
      },
    });
  } catch (err) {
    res
      .status(500)
      .json({
        message: "Error fetching customer activity",
        error: err.message,
      });
  }
};