import express from "express";
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,

  deleteProduct,
  addVariant,
  updateVariant,
  deleteVariant,
  replaceAllVariants,
} from "../../controllers/admin/productController.js";
import { requireAdmin, requireRole } from "../../middleware/authAdmin.js";

const router = express.Router();

// ====================
// 📌 PRODUCT CRUD
// ====================

// GET /api/admin/products → Get all products
router.get("/", requireAdmin, getAllProducts);

// GET /api/admin/products/:id → Get single product by ID
router.get("/:id", requireAdmin, getProductById);

// POST /api/admin/products → Create a new product
router.post("/", requireAdmin, requireRole("admin", "manager"), createProduct);

// PUT /api/admin/products/:id → Update an existing product
router.put(
  "/:id",
  requireAdmin,
  requireRole("admin", "manager"),
  updateProduct
);

// DELETE /api/admin/products/:id → Delete a product
router.delete("/:id", requireAdmin, requireRole("admin"), deleteProduct);

// ====================
// 🧩 VARIANT MANAGEMENT
// ====================

// ➕ Add a new variant to a product
// POST /api/admin/products/:id/variants
router.post(
  "/:id/variants",
  requireAdmin,
  requireRole("admin", "manager"),
  addVariant
);

// ✏️ Update an existing variant
// PUT /api/admin/products/:id/variants/:variantId
router.put(
  "/:id/variants/:variantId",
  requireAdmin,
  requireRole("admin", "manager"),
  updateVariant
);

// ❌ Delete a specific variant
// DELETE /api/admin/products/:id/variants/:variantId
router.delete(
  "/:id/variants/:variantId",
  requireAdmin,
  requireRole("admin", "manager"),
  deleteVariant
);

// 📦 Update stock for a specific variant


// 🔄 Replace ALL variants at once (optional but very useful for dashboards)
// PUT /api/admin/products/:id/variants
router.put(
  "/:id/variants",
  requireAdmin,
  requireRole("admin", "manager"),
  replaceAllVariants
);

export default router;
