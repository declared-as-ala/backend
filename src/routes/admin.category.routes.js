import { Router } from 'express';
import { requireAdmin, requireRole } from '../middleware/authAdmin.js';
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/admin.category.controller.js';

const router = Router();
router.post('/', requireAdmin, requireRole('admin', 'manager'), createCategory);
router.put(
  '/:id',
  requireAdmin,
  requireRole('admin', 'manager'),
  updateCategory
);
router.delete('/:id', requireAdmin, requireRole('admin'), deleteCategory);

export default router;
