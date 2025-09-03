import express from "express";
import {
  getDashboardStats,
  getRecentOrders,
  getSalesByPaymentMethod,
  getMonthlyRevenue,
  getTopCategories,
  getCustomerGrowth,
  getLowStockProducts,
  getOrdersByHour,
  getCustomerActivity,
} from "../../controllers/admin/dashboardController.js";
import { requireAdmin, requireRole } from "../../middleware/authAdmin.js";

const router = express.Router();

// Stats overview
router.get("/stats", requireAdmin, getDashboardStats);

// Orders
router.get(
  "/recent-orders",
  requireAdmin,
  requireRole("admin", "manager"),
  getRecentOrders
);
router.get("/orders-by-hour", requireAdmin, getOrdersByHour);

// Sales & Revenue
router.get("/sales-by-payment-method", requireAdmin, getSalesByPaymentMethod);
router.get("/monthly-revenue", requireAdmin, getMonthlyRevenue);

// Products
router.get("/top-categories", requireAdmin, getTopCategories);
router.get("/low-stock", requireAdmin, getLowStockProducts);

// Customers
router.get("/customer-growth", requireAdmin, getCustomerGrowth);
router.get("/customer-activity", requireAdmin, getCustomerActivity);

export default router;
