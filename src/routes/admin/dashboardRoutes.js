import express from "express";
import {
  getDashboardStats,
  getRecentOrders,
} from "../../controllers/admin/dashboardController.js";
import { requireAdmin, requireRole } from "../../middleware/authAdmin.js";

const router = express.Router();

// GET /api/admin/dashboard/stats
router.get("/stats", requireAdmin, getDashboardStats);

// GET /api/admin/dashboard/recent-orders
router.get(
  "/recent-orders",
  requireAdmin,
  requireRole("admin", "manager"),
  getRecentOrders
);

export default router;
