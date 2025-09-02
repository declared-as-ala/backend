import express from "express";
import {
  getAllDiscounts,
  getDiscountById,
  createDiscount,
  updateDiscount,
  deleteDiscount,
} from "../../controllers/admin/discountController.js";
import { requireAdmin, requireRole } from "../../middleware/authAdmin.js";

const router = express.Router();

// GET /api/admin/discounts
router.get("/", requireAdmin, getAllDiscounts);

// GET /api/admin/discounts/:id
router.get("/:id", requireAdmin, getDiscountById);

// POST /api/admin/discounts
router.post("/", requireAdmin, requireRole("admin", "manager"), createDiscount);

// PUT /api/admin/discounts/:id
router.put(
  "/:id",
  requireAdmin,
  requireRole("admin", "manager"),
  updateDiscount
);

// DELETE /api/admin/discounts/:id
router.delete("/:id", requireAdmin, requireRole("admin"), deleteDiscount);

export default router;
