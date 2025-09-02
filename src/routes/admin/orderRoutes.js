import express from "express";
import {
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
} from "../../controllers/admin/orderController.js";
import { requireAdmin, requireRole } from "../../middleware/authAdmin.js";

const router = express.Router();

// GET /api/admin/orders
router.get("/", requireAdmin, getAllOrders);

// GET /api/admin/orders/:id
router.get("/:id", requireAdmin, getOrderById);

// PUT /api/admin/orders/:id/status
router.put(
  "/:id/status",
  requireAdmin,
  requireRole("admin", "manager"),
  updateOrderStatus
);

// DELETE /api/admin/orders/:id
router.delete("/:id", requireAdmin, requireRole("admin"), deleteOrder);

export default router;
