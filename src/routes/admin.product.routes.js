import { Router } from 'express';
import { requireAdmin, requireRole } from '../middleware/authAdmin.js';
import {
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/admin.product.controller.js';

const router = Router();
router.post('/', requireAdmin, requireRole('admin', 'manager'), createProduct);
router.put(
  '/:id',
  requireAdmin,
  requireRole('admin', 'manager'),
  updateProduct
);
router.delete('/:id', requireAdmin, requireRole('admin'), deleteProduct);

export default router;
