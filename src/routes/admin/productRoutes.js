import express from "express";
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  updateVariantStock,
  deleteProduct,
} from "../../controllers/admin/productController.js";
import { requireAdmin, requireRole } from "../../middleware/authAdmin.js";

const router = express.Router();

// GET /api/admin/products
router.get("/", requireAdmin, getAllProducts);

// GET /api/admin/products/:id
router.get("/:id", requireAdmin, getProductById);

// POST /api/admin/products
router.post("/", requireAdmin, requireRole("admin", "manager"), createProduct);

// PUT /api/admin/products/:id
router.put(
  "/:id",
  requireAdmin,
  requireRole("admin", "manager"),
  updateProduct
);

// PUT /api/admin/products/:id/variants/:variantId/stock
// Update stock for a specific product variant
router.put(
  "/:id/variants/:variantId/stock",
  requireAdmin,
  requireRole("admin", "manager"),
  updateVariantStock
);

// DELETE /api/admin/products/:id
router.delete("/:id", requireAdmin, requireRole("admin"), deleteProduct);

export default router;
