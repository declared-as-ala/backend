import express from "express";
import {
  listCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
} from "../../controllers/admin/customerController.js";
import { requireAdmin, requireRole } from "../../middleware/authAdmin.js";

const router = express.Router();

// GET /api/admin/customers
router.get("/", requireAdmin, listCustomers);

// GET /api/admin/customers/:id
router.get("/:id", requireAdmin, getCustomerById);

// PUT /api/admin/customers/:id
router.put(
  "/:id",
  requireAdmin,
  requireRole("admin", "manager"),
  updateCustomer
);

// DELETE /api/admin/customers/:id
router.delete("/:id", requireAdmin, requireRole("admin"), deleteCustomer);

export default router;
